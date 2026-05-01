# std.Io 接口详解

> **版本说明**：本章基于 Zig 0.16 的 `std.Io` 接口编写。

## Io 是什么

`std.Io` 是 Zig 0.16 中统一的 I/O 入口。类比 `Allocator`：前者管理"数据从哪里来、到哪里去"，后者管理"数据放在内存的哪里"。两者都是显式传入的依赖。

```zig
fn doWork(gpa: Allocator, io: Io) !void {
    // gpa 解决分配，io 解决读写
}
```

一个 `Io` 实例背后可以是终端、文件系统、网络、定时器，甚至测试 mock。对调用方来说，同一个接口对这些实现都有效。对大多数代码，建立这一个直觉就够了：**文件、Reader、Writer，都从 `Io` 出发。**

0.16 最显著的变化是：几乎一切 I/O 操作都显式接收 `io: std.Io`。不再有隐藏的全局状态。

## 从 init.io 开始

获取 `Io` 实例的最简单方式是在 `main` 参数中接收：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;

    // 后续代码从这里展开
    _ = io;
    _ = gpa;
}
```

`std.process.Init` 是 0.16 推荐的 `main` 签名。`init.io` 返回当前进程的默认 `Io`，`init.gpa` 返回通用分配器。一个入口同时拿到底层两个基础设施，之后逐层传递即可。

测试代码中可以用一行拿到 `Io`：

```zig
test "basic io" {
    const io = std.testing.io;
    _ = io;
}
```

`std.testing.io` 只在 `test` 块内可用，用在任何非测试代码中会直接触发 `@compileError("not testing")`。它的底层是 `Io.Threaded`，行为与 `init.io` 一致——所以测试中测出来的 I/O 逻辑在 `main` 里不加修改就能跑。

没有 `std.process.Init` 的场景（例如库代码或自行构造运行时），可以手动创建：

```zig
var threaded: std.Io.Threaded = .init_single_threaded;
const io = threaded.io();
```

`std.Io.Threaded` 是当前最常见的实现，也是 `init.io` 在桌面平台上的底层类型。单独程序用 `.init_single_threaded` 即可覆盖大部分同步 I/O 场景。

## 写入 stdout

第一个真正的 IO 操作：向终端输出一行文本。

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    var buf: [1024]u8 = undefined;
    var stdout_writer = std.Io.File.stdout().writer(io, &buf);

    try stdout_writer.interface.writeAll("你好 zig\n");
    try stdout_writer.interface.flush();
}
```

四步拆开看：

1. `std.Io.File.stdout()` 拿到标准输出的文件句柄
2. `writer(io, &buf)` 创建一个带缓冲的 Writer，缓冲区由调用方提供
3. `writeAll(...)` 把数据写入缓冲区
4. `flush()` 把缓冲区的内容真正推到底层输出

Zig 的 Writer 和 C 的 `FILE*` 的核心区别在于：缓冲区是你自己的栈上数组，大小和生命周期完全由你控制，不存在隐藏分配。

不需要格式化输出时，更短的写法是直接用 `writeStreamingAll`，绕过 Writer：

```zig
try std.Io.File.stdout().writeStreamingAll(io, "你好\n");
```

stdout 和 stderr 的区别是约定性的：正常输出走 stdout，错误和警告走 stderr（`Io.File.stderr()`）。API 写法完全一致。

## 读取 stdin

读取和写入是镜面操作——Writer 变成 Reader：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    var buf: [1024]u8 = undefined;
    var stdin_reader = std.Io.File.stdin().reader(io, &buf);

    const line = try stdin_reader.interface.takeDelimiter('\n');
    std.debug.print("你输入了: {s}\n", .{line.?});
}
```

`takeDelimiter('\n')` 会阻塞，直到用户输入换行。返回的字节切片**不包含**分隔符本身。

## 读取整个文件

已知文件大小上限时，一次性把内容读进内存最简洁：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;

    const contents = try std.Io.Dir.cwd().readFileAlloc(
        io, "input.txt", gpa, .limited(1024 * 1024),
    );
    defer gpa.free(contents);

    std.debug.print("{s}\n", .{contents});
}
```

几个要点：

- `Io.Dir.cwd()` 代表当前工作目录（"current working directory"），是文件操作的起点
- `readFileAlloc` 在堆上分配，必须 `defer gpa.free`
- `.limited(1024 * 1024)` 设定了 1 MB 的上限，超出返回 `error.StreamTooLong`——防止误读一个大文件撑爆内存

文件大小不确定时，不宜用 `readFileAlloc`（你不知道该设多大上限）。下一节的"流式读取"用固定大小的缓冲区分块处理，无论文件多大内存占用恒定，是处理不定大小文件的标准方案。

## 写入整个文件

创建文件并一次性写入所有数据：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try std.Io.Dir.cwd().createFile(io, "output.txt", .{});
    defer file.close(io);

    try file.writeStreamingAll(io, "hello from zig\n");
}
```

这是最简单的写入路径：创建文件、写入数据、关闭文件——不需要 Reader 或 Writer。`createFile` 默认只写，`.{}` 使用默认选项。`close(io)` 和 `writeStreamingAll(io, ...)` 都需要传入 `io`，这是 0.16 的标志性变化。

## 流式读取（逐行）

文件很大、或者只想按行处理时，用 `File.Reader`：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try std.Io.Dir.cwd().openFile(io, "input.txt", .{});
    defer file.close(io);

    var buf: [1024]u8 = undefined;
    var file_reader = file.reader(io, &buf);

    while (file_reader.interface.takeDelimiter('\n')) |maybe_line| {
        const line = maybe_line orelse break;
        std.debug.print("{s}\n", .{line});
    } else |err| switch (err) {
        error.ReadFailed => return file_reader.err.?,
        error.StreamTooLong => return err,
    }
}
```

这里涉及两个概念：**具体实现**和**通用接口**。

- `file.reader(io, &buf)` 创建 `File.Reader`，它持有缓冲区指针和文件句柄，是"具体实现"
- `file_reader.interface` 是 `*Io.Reader`，是只暴露读取方法的"通用接口"
- 循环里调用的是 `interface.takeDelimiter`，它不知道自己在读文件还是网络流

`while ... else |err|` 是 Zig 的惯用写法：循环体处理每一行，`else` 分支处理循环提前退出的错误。这里有两个分支，返回方式不同：

- `error.ReadFailed` 是 `Io.Reader` 包装后的上层错误——真正的底层错误（如 `error.InputOutput`）藏在 `file_reader.err` 里，调用方需要取出它向上传播
- `error.StreamTooLong` 在这里不是限额被超，而是**一行太长，超出了缓冲区 `buf` 的 1 KB 容量**——`takeDelimiter` 在缓冲区里找不到 `'\n'`，无法返回结果。处理方式通常是加大缓冲区

**注意**：`interface` 是 `File.Reader` 内部字段的别名，不额外分配。如果要传递它给其他函数，传指针 `&file_reader.interface`。不要复制 `interface` 值，复制后它与原始状态脱钩，后续操作行为未定义。

### 更细粒度的读取

除了按行读取，`Io.Reader` 也支持按字节、按整数、按固定长度读取：

```zig
const byte = try file_reader.interface.takeByte();
const value = try file_reader.interface.takeInt(u32, .little);
const chunk = try file_reader.interface.take(16);
```

读取位置会自动推进，三种方法可以混用。

## 流式写入（格式化）

需要格式化输出或多次写入时，用 `File.Writer`：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try std.Io.Dir.cwd().createFile(io, "output.txt", .{});
    defer file.close(io);

    var buf: [1024]u8 = undefined;
    var file_writer = file.writer(io, &buf);

    try file_writer.interface.writeAll("hello line\n");
    try file_writer.interface.print("计数 = {d}\n", .{42});
    try file_writer.interface.writeInt(u32, 1234, .little);
    try file_writer.interface.flush();
}
```

`writeAll` 写入字节串，`print` 格式化输出，`writeInt` 写入整数。和 stdout 一样，最后务必调用 `flush()`——数据在缓冲区里，不 flush 就拿不到完整输出。

### 写入内存缓冲区

只想在内存里格式化一段文本，用 `Io.Writer.fixed`：

```zig
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

`writer.buffered()` 返回已写入的字节切片，无需 flush，不涉及任何 IO。这取代了旧版 `std.io.fixedBufferStream`。

## 文件模式与常见操作

`openFile` 的第三个参数是 `OpenFlags`，通过 mode 控制读写权限：

| 标志                  | 作用         |
| --------------------- | ------------ |
| `.mode = .read_only`  | 只读（默认） |
| `.mode = .write_only` | 只写         |
| `.mode = .read_write` | 读写         |

```zig
// 只读打开
const f = try cwd.openFile(io, "data.txt", .{});

// 读写打开
const f = try cwd.openFile(io, "data.txt", .{ .mode = .read_write });
```

`createFile` 默认只写。想在创建后还能读回来，加 `.read = true`：

```zig
const f = try cwd.createFile(io, "data.txt", .{ .read = true });
```

`Io.Dir.cwd()` 中的 "cwd" 代表当前工作目录——程序启动时所在的那个目录。它不需要 `openDir`、不需要路径，是文件操作最常用的起点。

## ReadFailed / WriteFailed

`*Io.Reader` 和 `*Io.Writer` 是通用接口——它们不关心背后的具体实现是文件、网络还是内存缓冲区。不同实现产生的错误类型也完全不同：文件可能返回 `error.InputOutput`，网络可能返回 `error.ConnectionResetByPeer`，内存缓冲区可能返回 `error.OutOfMemory`。

如果 `Reader.takeByte()` 把这些错误原样暴露出来，任何接收 `*Io.Reader` 的函数都必须在签名里穷举所有可能的错误类型——这意味着一个通用解析函数会依赖它从未直接使用的错误，无法编译。

解决方案是两层设计：

- **接口层**只返回两个固定标签：`error.ReadFailed` 和 `error.WriteFailed`
- **底层真实错误**保存在具体实现的 `.err` 字段里（`File.Reader.err`、`File.Writer.err`）

效果是：库函数只依赖 `ReadFailed` / `WriteFailed`，保持通用性；调用方在拿到高层错误后，可以从具体实现里取出原始错误向上传播：

```zig
fn consume(reader: *std.Io.Reader) !void {
    // 这个函数不知道 reader 是文件还是网络——只关心 ReadFailed
    _ = try reader.takeByte();
}

fn run(io: std.Io, file: std.Io.File) !void {
    var buf: [256]u8 = undefined;
    var file_reader = file.reader(io, &buf);

    // 调用通用函数，如果失败就把具体错误还原出来
    consume(&file_reader.interface) catch |err| switch (err) {
        error.ReadFailed => return file_reader.err.?, // 文件真正的错误
        else => |e| return e,
    };
}
```

## 时间相关能力

`std.Io` 也提供时间接口，常见的类型包括 `std.Io.Clock`、`std.Io.Timestamp`、`std.Io.Duration`。和文件 IO 一样，时间操作也依赖 `io` 参数：

```zig
const start = std.Io.Timestamp.now(io, .awake);
const end = std.Io.Timestamp.now(io, .awake);
const elapsed = start.durationTo(end);
```

对文件 I/O 来说，知道时间能力也走 `io` 就够了——异步任务中的休眠、等待和取消，与普通文件 I/O 使用同一套运行时。

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
| `std.io.fixedBufferStream`          | `std.Io.Writer.fixed` / `std.Io.Reader.fixed`                        |

最大的迁移变化不是某一个函数名，而是：**I/O 依赖从隐式环境变成显式参数。**

## 本章小结

`std.Io` 这一章可以收敛为四句话：

1. `io` 是 0.16 中 I/O 与并发能力的统一入口，像 `Allocator` 一样显式传递
2. 文件操作从 `Io.Dir` 和 `Io.File` 展开，都显式接收 `io` 参数
3. 流式读写通过 `File.Reader` / `File.Writer` 和它们的 `interface` 完成，缓冲区由调用方提供
4. 通用接口只返回 `ReadFailed` / `WriteFailed`，具体错误在 `.err` 中，调用点负责拆开

> **相关阅读**：
> - 并发基础见 [chapter-concurrency.md](chapter-concurrency.md)
> - 异步 I/O 的现状见 [chapter-async.md](../part3-practice/chapter-async.md)
> - 内存分配策略见 [chapter-memory-management.md](chapter-memory-management.md)

## 参考

- [std.Io overview](https://ziggit.dev/t/std-io-overview/14994)
- [File I/O basics (0.16)](https://ziggit.dev/t/file-i-o-basics-0-16/14968)
