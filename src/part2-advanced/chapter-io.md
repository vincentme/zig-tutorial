# std.Io 接口详解

> **版本说明**：
>
> 本章基于 Zig 0.16 的 `std.Io` 接口编写。`std.Io` 已可用于常见场景，但后续版本仍可能继续调整细节。

## `std.Io` 的位置

`std.Io` 是 Zig 0.16 中统一的 I/O 与并发入口。文件系统、网络、时间、任务调度和一部分同步能力都围绕 `Io` 展开。

与旧接口相比，最直接的变化是：**大多数 I/O 操作都显式接收一个 `io: std.Io` 参数。**

这带来两点变化：

- I/O 依赖变成显式输入，和 `Allocator` 的传递方式一致
- 同一套业务代码可以运行在不同 `Io` 实现之上

对大多数代码，首先需要建立的直觉只有一个：**文件、Reader、Writer、异步任务，都从 `Io` 出发。**

## 获取 `Io` 实例

常见来源有三种：测试中的 `std.testing.io`、`std.process.Init` 提供的 `init.io`、手动构造的 `std.Io.Threaded`。

### 测试代码中的 `std.testing.io`

```zig
const std = @import("std");

test "use testing io" {
    const io = std.testing.io;
    _ = io;
}
```

### `main(init: std.process.Init)` 中的 `init.io`

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;
    _ = io;
    _ = gpa;
}
```

这是 0.16 中最常见的入口写法。

### 手动创建 `std.Io.Threaded`

```zig
const std = @import("std");
const Io = std.Io;

pub fn main() !void {
    var threaded: Io.Threaded = .init_single_threaded;
    const io = threaded.io();
    _ = io;
}
```

`std.Io.Threaded` 是当前最常见的实现。手动创建通常用于需要明确控制运行方式的场景。

## 文件与目录操作

文件操作从 `std.Io.Dir` 开始。最常用的入口是 `Io.Dir.cwd()`。

### 打开、创建、关闭

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const cwd = Io.Dir.cwd();

    const input = try cwd.openFile(io, "input.txt", .{});
    defer input.close(io);

    const output = try cwd.createFile(io, "output.txt", .{});
    defer output.close(io);
}
```

迁移时最容易注意到的变化是：

- 旧写法：`std.fs.cwd().openFile(path, .{})`
- 新写法：`std.Io.Dir.cwd().openFile(io, path, .{})`

`openFile` 的第三个参数是 `OpenFlags`，常用选项：

| 标志 | 作用 |
| ---- | ---- |
| `.mode = .read_only` | 只读（默认） |
| `.mode = .write_only` | 只写 |
| `.mode = .read_write` | 读写 |

`createFile` 默认只写，加 `.read = true` 可同时开放读取。

### 直接写入整个字节切片

整块写入时，可以直接使用 `File.writeStreamingAll`：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try Io.Dir.cwd().createFile(io, "output.txt", .{});
    defer file.close(io);

    try file.writeStreamingAll(io, "hello from zig\n");
}
```

这种写法适合一次性写入现成的数据。需要缓冲、格式化输出或分步写入时，使用 `File.Writer`。

## 整体读取与流式读取

读取通常分成两类：

- 文件内容整体进入内存
- 通过 Reader 逐步消费数据

### 读取整个文件

已知大小上限时，`readFileAlloc` 更直接：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;

    const contents = try Io.Dir.cwd().readFileAlloc(io, "input.txt", gpa, .limited(1024 * 1024));
    defer gpa.free(contents);

    std.debug.print("{s}\n", .{contents});
}
```

这适合小文件或有明确上限的输入。上限被超过时会返回 `error.StreamTooLong`。

### 用 `File.Reader` 流式读取

`File.Reader` 适合按行、按块或按结构读取。

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try Io.Dir.cwd().openFile(io, "input.txt", .{});
    defer file.close(io);

    var buf: [1024]u8 = undefined;
    var file_reader: Io.File.Reader = file.reader(io, &buf);

    while (file_reader.interface.takeDelimiter('\n')) |maybe_line| {
        const line = maybe_line orelse break;
        std.debug.print("{s}\n", .{line});
    } else |err| switch (err) {
        error.ReadFailed => return file_reader.err.?,
        error.StreamTooLong => return err,
    }
}
```

这里有两个要点：

- `file.reader(io, &buf)` 创建具体的 `File.Reader`
- 通用读取操作通过 `file_reader.interface` 完成

### 不复制 `interface`

`File.Reader` 持有具体状态，`interface` 只是它暴露出来的通用读接口。应直接使用，或传递指针：

```zig
const reader = &file_reader.interface;
_ = reader;
```

不要把 `interface` 复制到另一个值里再长期使用。

### 行长未知时的读取方式

固定缓冲区适合常规行读取。行长无法预估时，可以把数据流式写入 `Io.Writer.Allocating`：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;

    const file = try Io.Dir.cwd().openFile(io, "input.txt", .{});
    defer file.close(io);

    var read_buf: [64]u8 = undefined;
    var file_reader: Io.File.Reader = file.reader(io, &read_buf);

    var line: Io.Writer.Allocating = .init(gpa);
    defer line.deinit();

    while (file_reader.interface.streamDelimiter(&line.writer, '\n')) |_| {
        file_reader.interface.toss(1);
        std.debug.print("{s}\n", .{line.written()});
        line.clearRetainingCapacity();
    } else |err| switch (err) {
        error.ReadFailed, error.WriteFailed => return file_reader.err.?,
        error.EndOfStream => {
            if (line.written().len != 0) {
                std.debug.print("{s}\n", .{line.written()});
            }
        },
        else => return err,
    }
}
```

### 更细粒度的读取

`Io.Reader` 还提供字节、整数和固定长度切片等读取方式：

```zig
const byte = try file_reader.interface.takeByte();
const value = try file_reader.interface.takeInt(u32, .little);
const chunk = try file_reader.interface.take(16);

_ = byte;
_ = value;
_ = chunk;
```

## 使用 `File.Writer`

需要缓冲、格式化或多次写入时，使用 `File.Writer`。

### 缓冲 IO 与 flush

Zig 的 Reader 和 Writer 要求显式传入缓冲区——与 C 的 `FILE*`（隐式分配内部缓冲区）不同，程序员完全控制缓冲区的大小和生命周期，符合"无隐藏分配"原则。数据先写入缓冲区，调用 `flush()` 后才真正落到底层 IO 资源。忘记 `flush()` 最常见的结果是输出不完整。

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try Io.Dir.cwd().createFile(io, "output.txt", .{});
    defer file.close(io);

    var buf: [1024]u8 = undefined;
    var file_writer: Io.File.Writer = file.writer(io, &buf);

    try file_writer.interface.writeAll("hello\n");
    try file_writer.interface.print("count = {d}\n", .{42});
    try file_writer.interface.writeInt(u32, 1234, .little);
    try file_writer.interface.flush();
}
```

### 写入内存缓冲区

写入内存而不是文件时，可以直接使用 `Io.Writer.fixed`：

```zig
const std = @import("std");

pub fn main() !void {
    var buf: [128]u8 = undefined;
    var writer: std.Io.Writer = .fixed(&buf);

    try writer.writeAll("hello");
    try writer.writeByte('\n');
    try writer.print("value = {d}\n", .{42});

    const written = writer.buffered();
    std.debug.print("{s}", .{written});
}
```

## 标准输入输出

操作系统为每个进程创建三个标准通道：stdin（输入）、stdout（输出）、stderr（错误）。Zig 通过 `std.Io.File` 暴露它们：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    // stdout：正常输出
    var out_buf: [1024]u8 = undefined;
    var stdout_writer = Io.File.stdout().writer(io, &out_buf);
    try stdout_writer.interface.writeAll("hello stdout\n");
    try stdout_writer.interface.flush();

    // stderr：错误和警告
    var err_buf: [1024]u8 = undefined;
    var stderr_writer = Io.File.stderr().writer(io, &err_buf);
    try stderr_writer.interface.writeAll("error: something went wrong\n");
    try stderr_writer.interface.flush();

    // stdin：读取用户输入（阻塞直到收到换行）
    var in_buf: [1024]u8 = undefined;
    var stdin_reader = Io.File.stdin().reader(io, &in_buf);
    const name = try stdin_reader.interface.takeDelimiter('\n');
    std.debug.print("you typed: {s}\n", .{name});
}
```

stdout 和 stderr 都用于输出，区别在于约定：正常输出走 stdout，错误和警告走 stderr（终端中通常以不同颜色显示）。

## `ReadFailed`、`WriteFailed` 与 `.err`

`Io.Reader` 和 `Io.Writer` 的通用接口会把底层错误折叠成较高层的错误：

- 读取侧常见为 `error.ReadFailed`
- 写入侧常见为 `error.WriteFailed`

具体错误保存在具体实现的 `.err` 字段里。

这意味着分层代码通常有一个稳定模式：

- 只接收 `*Io.Reader` / `*Io.Writer` 的下层函数，直接传播高层错误
- 持有 `File.Reader` / `File.Writer` 的调用点，负责从 `.err` 取出具体错误

```zig
const std = @import("std");
const Io = std.Io;

fn consume(reader: *Io.Reader) !void {
    _ = try reader.takeByte();
}

fn run(io: Io, file: Io.File) !void {
    var buf: [256]u8 = undefined;
    var file_reader = file.reader(io, &buf);

    consume(&file_reader.interface) catch |err| switch (err) {
        error.ReadFailed => return file_reader.err.?,
        else => |e| return e,
    };
}
```

这个模式在异步场景里同样重要，因为 `error.Canceled` 也需要通过具体实现继续向上传递。

## 异步任务与 `Future`

`std.Io` 不只是文件接口，也提供任务启动、等待和取消能力。

### `io.async`

`io.async` 启动一个任务，返回 `Future`：

```zig
const std = @import("std");
const Io = std.Io;

fn save(io: Io, file_name: []const u8, data: []const u8) !Io.File {
    const file = try Io.Dir.cwd().createFile(io, file_name, .{});
    errdefer file.close(io);
    try file.writeStreamingAll(io, data);
    return file;
}

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    var future = io.async(save, .{ io, "output.txt", "hello\n" });
    defer if (future.cancel(io)) |file| file.close(io) else |_| {};

    const file = try future.await(io);
    file.close(io);
}
```

### `await` 和 `cancel`

- `await` 等待任务完成并取得结果
- `cancel` 请求取消，并等待任务结束
- 任务已经完成时，`cancel` 的行为与 `await` 等价

最常见的资源管理写法是：**启动任务后立刻 `defer future.cancel(io)`。**

这样做的原因不是语法习惯，而是生命周期完整：如果后续流程提前返回，仍然有人回收 Future 和任务返回值。

### `io.concurrent`

`io.async` 表示异步执行；`io.concurrent` 额外要求运行时为任务分配真实的并发执行资源。并发不可用时会返回 `error.ConcurrencyUnavailable`。

```zig
var future = try io.concurrent(save, .{ io, "output.txt", "hello\n" });
defer if (future.cancel(io)) |file| file.close(io) else |_| {};
```

## 任务协调工具

`std.Io` 里常见的多任务协调工具有三种：

### `Io.Queue(T)`

多生产者、多消费者 FIFO 队列，适合生产者-消费者模型。

- `putOne(io, value)` 写入元素
- `getOne(io)` 读取元素
- `close(io)` 关闭队列，让等待中的消费者最终退出

### `Io.Group`

适合管理一组返回 `void` 或可取消 `void` 的任务。

- `group.async(io, f, args)` 把任务加入组
- `group.await(io)` 等待整组完成
- `group.cancel(io)` 取消整组任务

### `Io.Select(U)`

适合等待多种不同结果类型的任务，把结果统一到一个 tagged union 中。

- `select.async(tag, f, args)` 提交任务
- `select.next(io)` 取得下一个完成的结果
- `select.cancel(io)` 或 `select.cancelDiscard(io)` 停止剩余任务

这三者的关系可以概括为：

- 队列解决数据流转
- Group 解决一组同类任务的收尾
- Select 解决多路结果竞争

## 时间相关能力

`std.Io` 也提供时间接口，常见类型包括：

- `std.Io.Clock`
- `std.Io.Timestamp`
- `std.Io.Duration`

例如：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const start = std.Io.Timestamp.now(io, .awake);
    const end = std.Io.Timestamp.now(io, .awake);
    const elapsed = start.durationTo(end);

    _ = elapsed;
}
```

对文件 I/O 教程来说，这一组接口只需要先把握两点：

- 时间能力也依赖 `io`
- 异步任务中的休眠、等待和取消，与普通文件 I/O 使用同一套运行时语义

## 一个最小完整例子

下面的例子把本章最常见的几件事放在一起：打开文件、按行读取、格式化写入、刷新缓冲区。

```zig
const std = @import("std");
const Io = std.Io;

fn processFile(io: Io, input_path: []const u8, output_path: []const u8) !void {
    const input = try Io.Dir.cwd().openFile(io, input_path, .{});
    defer input.close(io);

    const output = try Io.Dir.cwd().createFile(io, output_path, .{});
    defer output.close(io);

    var read_buf: [1024]u8 = undefined;
    var file_reader: Io.File.Reader = input.reader(io, &read_buf);

    var write_buf: [1024]u8 = undefined;
    var file_writer: Io.File.Writer = output.writer(io, &write_buf);

    var line_no: usize = 0;

    while (file_reader.interface.takeDelimiter('\n')) |maybe_line| {
        const line = maybe_line orelse break;
        line_no += 1;
        try file_writer.interface.print("{d}: {s}\n", .{ line_no, line });
    } else |err| switch (err) {
        error.ReadFailed => return file_reader.err.?,
        error.StreamTooLong => return err,
    }

    try file_writer.interface.flush();
}

pub fn main(init: std.process.Init) !void {
    try processFile(init.io, "input.txt", "output.txt");
}
```

## 从旧 API 迁移

| 旧写法                              | 新写法                                                               |
| ----------------------------------- | -------------------------------------------------------------------- |
| `std.fs.cwd()`                      | `std.Io.Dir.cwd()`                                                   |
| `cwd.openFile(path, .{})`           | `cwd.openFile(io, path, .{})`                                        |
| `cwd.createFile(path, .{})`         | `cwd.createFile(io, path, .{})`                                      |
| `cwd.readFileAlloc(gpa, path, max)` | `cwd.readFileAlloc(io, path, gpa, .limited(max))`                    |
| `file.readToEndAlloc(gpa, max)`     | `file.reader(io, &buf).interface.allocRemaining(gpa, .limited(max))` |
| `file.writeAll(data)`               | `file.writeStreamingAll(io, data)` 或 `File.Writer`                  |
| `file.close()`                      | `file.close(io)`                                                     |
| `std.time.sleep(...)`               | 使用 `std.Io` 的时间与休眠接口                                       |

最大的迁移变化不是某一个函数名，而是：**I/O 依赖从隐式环境变成显式参数。**

## 本章小结

`std.Io` 这一章可以压缩成四个判断：

1. `io` 是 0.16 中 I/O 与并发能力的统一入口
2. 文件操作从 `Io.Dir` 和 `Io.File` 展开
3. 流式读写通过 `File.Reader` / `File.Writer` 和它们的 `interface` 完成
4. 异步任务需要显式等待或取消，不能把 Future 留给隐式清理

> **相关阅读**：
> - 并发基础见 [chapter-concurrency.md](chapter-concurrency.md)
> - 异步 I/O 的现状见 [chapter-async.md](../part3-practice/chapter-async.md)
> - 内存分配策略见 [chapter-memory-management.md](chapter-memory-management.md)

## 参考

- [std.Io overview](https://ziggit.dev/t/std-io-overview/14994)
- [File I/O basics (0.16)](https://ziggit.dev/t/file-i-o-basics-0-16/14968)
