# std.Io 接口详解

> **版本说明**：
>
> `std.Io` 是 Zig 0.16 引入的重大接口变更。它将文件系统、网络、定时器、同步等几乎所有可能阻塞的操作统一到一个接口之下。这一接口目前处于"可用于大多数场景并收集反馈"的阶段，未来可能会根据实际使用继续演进。本章代码以 0.16-dev 源码为准。

## 为什么需要 `std.Io`？

在 0.16 之前，文件操作散布在 `std.fs` 和 `std.posix` 中。0.16 做了一件与 Allocator 模型对齐的事情：

> **所有执行 I/O 的代码都需要访问一个 `Io` 实例，就像所有分配内存的代码都需要访问一个 `Allocator` 实例一样。**

这意味着：

- `std.fs` 的 API 已迁移到 `std.Io.File` 和 `std.Io.Dir` 下
- `std.posix` 的大部分 API 已被 `std.Io` 取代
- 大多数 I/O API 现在都需要一个 `std.Io` 参数
- 底层平台特定 API 仍然可用（`std.c` 也在需要时可以 使用）

这种设计带来的核心好处是：**通过切换你实例化的 `Io` 实现，就能选择同步、异步（协程、线程等）不同的 I/O 模型**，而业务代码不需要改动。

---

## 获取 `Io` 实例

使用 `std.Io` 的第一步是拿到一个 `Io` 实例。常见场景有三种：

### 在测试中

```zig
const std = @import("std");

test "使用 testing.io" {
    const io = std.testing.io;
    // 接下来所有 I/O 操作都可以使用 io
}
```

`std.testing.io` 是标准库为测试预先准备好的 `Io` 实例。

### 在 juicy main 中

0.16 引入了"juicy main"入口，标准库可以提供预选的 `Io` 和 `Allocator` 实例：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;
    // ...
}
```

`init.io` 会根据平台能力自动选择合适的实现。

### 手动创建

如果需要明确控制 I/O 模型，可以自己创建：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main() !void {
    // 单线程版本——不使用并发
    var threaded: Io.Threaded = .init_single_threaded;
    const io = threaded.io();

    // 多线程版本——支持异步和并发
    // var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    // var threaded = Io.Threaded.init(gpa.allocator(), .{});
    // const io = threaded.io();
}
```

目前唯一完整可用的实现是 `std.Io.Threaded`。其他实现包括：
- `failing`：用于测试，所有操作直接失败
- `Evented`：基于 `Uring`（Linux）、`Kqueue`（BSD）或 `Dispatch`（macOS），目前为概念验证阶段

---

## 文件操作基础

### 打开与关闭文件

文件操作从 `std.Io.Dir` 开始。`Dir.cwd()` 返回当前工作目录的句柄：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    // 打开文件用于读取
    if (Io.Dir.cwd().openFile(io, "input.txt", .{})) |file| {
        defer file.close(io);

        // 使用 file 进行读写...
    } else |err| switch (err) {
        error.FileNotFound => {
            std.debug.print("文件未找到\n", .{});
        },
        error.AccessDenied => {
            std.debug.print("访问被拒绝\n", .{});
        },
        else => |e| return e,
    }
}
```

注意关键变化：

- 旧版：`std.fs.cwd().openFile(path, .{})`
- 新版：`std.Io.Dir.cwd().openFile(io, path, .{})`

`io` 作为第一个参数传入每个 I/O 函数。

### 创建文件

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try Io.Dir.cwd().createFile(io, "output.txt", .{});
    defer file.close(io);

    // 写入数据
    try file.writeStreamingAll(io, "hello from zig\n");
}
```

### 简单写入

`File.writeStreamingAll` 是最直接的写入方式，适合写入整块数据：

```zig
try file.writeStreamingAll(io, "some content");
```

对于更精细的控制（缓冲写入、格式化输出），需要使用 Writer 接口，后面会详细介绍。

---

## 读取文件内容

### 读取整个文件

`Dir.readFile` 将整个文件读入已有缓冲区：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    // 缓冲区必须足够大以容纳整个文件
    var buf: [10240]u8 = undefined;
    const contents = Io.Dir.readFile(Io.Dir.cwd(), io, "input.txt", &buf) catch |err| switch (err) {
        error.FileNotFound => {
            std.debug.print("文件未找到\n", .{});
            return;
        },
        else => |e| return e,
    };

    // contents 是 buf 上的一个切片，不是新分配的内存
    std.debug.print("读取了 {d} 字节\n", .{contents.len});

    // 按行遍历
    var tok = std.mem.tokenizeSequence(u8, contents, "\n");
    while (tok.next()) |line| {
        std.debug.print("行: {s}\n", .{line});
    }
}
```

几点注意：

- `contents` 只是 `buf` 上的一个切片，不会凭空产生内存
- 应该使用 `contents` 而不是 `buf`，因为 `contents.len` 对应实际读取的数据量
- 如果文件比 `buf` 大，只会读取 `buf.len` 字节，剩余内容留在文件中
- 生产代码应检查 `contents.len < buf.len` 来判断是否读取了全部内容

如果文件大小未知，可以先 `statFile` 获取大小，再用 allocator 分配足够的空间：

```zig
const stat = try Io.Dir.cwd().statFile(io, "input.txt", .{});
var buf = try init.gpa.alloc(u8, stat.size);
defer init.gpa.free(buf);
const contents = try Io.Dir.readFile(Io.Dir.cwd(), io, "input.txt", buf);
```

### 使用 Reader 按行读取

对于大文件或行式处理，使用 `File.Reader` 更合适：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try Io.Dir.cwd().openFile(io, "input.txt", .{});
    defer file.close(io);

    // 创建带缓冲的 Reader
    var buf: [1024]u8 = undefined;
    var file_reader: Io.File.Reader = file.reader(io, &buf);

    // takeDelimiter 返回到分隔符为止的数据（可选结果）
    while (file_reader.interface.takeDelimiter('\n')) |result| {
        if (result) |line| {
            std.debug.print("行: {s}\n", .{line});
        } else {
            // null 表示流结束
            break;
        }
    } else |err| switch (err) {
        error.ReadFailed => {
            std.debug.print("读取失败\n", .{});
            return file_reader.err.?;
        },
        error.StreamTooLong => {
            std.debug.print("单行超过缓冲区大小\n", .{});
            return err;
        },
    }
}
```

### 理解 Reader 的 interface 字段

`File.Reader` 是一个具体实现，它包含一个 `interface` 字段（类型为 `Io.Reader`）来提供通用读取接口：

```zig
var file_reader: Io.File.Reader = file.reader(io, &buf);

// 通过 interface 访问通用方法
while (file_reader.interface.takeDelimiter('\n')) |result| {
    // ...
}
```

**常见陷阱**：不要复制 `interface`，必须通过引用访问：

```zig
// 正确：直接使用
file_reader.interface.takeDelimiter('\n');

// 正确：取地址赋值
const reader = &file_reader.interface;

// 错误！复制会断开与父 Reader 的连接
// const reader = file_reader.interface;
```

### takeDelimiter 的三种变体

| 方法 | 返回内容 | 遇到流结束时的行为 |
| ---- | -------- | ------------------ |
| `takeDelimiter(delim)` | 不含分隔符的数据 | 返回 `null`（可选结果） |
| `takeDelimiterInclusive(delim)` | 含分隔符的数据 | 返回 `error.EndOfStream` |
| `takeDelimiterExclusive(delim)` | 不含分隔符的数据 | 返回尾数据或 `error.EndOfStream` |

使用 `takeDelimiterInclusive` 时，如果文件最后一行没有以 `\n` 结尾，会有"尾部"数据需要处理：

```zig
while (file_reader.interface.takeDelimiterInclusive('\n')) |line| {
    std.debug.print("{s}", .{line}); // 注意：line 已包含 \n
} else |err| switch (err) {
    error.ReadFailed => return file_reader.err.?,
    error.EndOfStream => {
        // 处理尾部数据（没有 \n 结尾的最后一行）
        const remaining = file_reader.interface.buffer[file_reader.interface.seek..file_reader.interface.end];
        if (remaining.len > 0) {
            std.debug.print("尾部: {s}\n", .{remaining});
        }
    },
    error.StreamTooLong => return err,
}
```

### 使用流式读取处理任意长度行

如果行长度不可预知，可以使用 `Writer.Allocating` 进行动态分配的流式读取：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try Io.Dir.cwd().openFile(io, "input.txt", .{});
    defer file.close(io);

    var line = Io.Writer.Allocating.init(init.gpa);
    defer line.deinit();

    var buf: [64]u8 = undefined; // 较小的缓冲区也能工作
    var file_reader: Io.File.Reader = file.reader(io, &buf);

    while (file_reader.interface.streamDelimiter(&line.writer, '\n')) |written_count| {
        _ = written_count;
        // 跳过分隔符本身
        file_reader.interface.toss(1);

        std.debug.print("行: {s}\n", .{line.written()});
        line.clearRetainingCapacity();
    } else |err| switch (err) {
        error.ReadFailed, error.WriteFailed => return file_reader.err.?,
        error.EndOfStream => {
            // 处理尾部
            if (line.written().len > 0) {
                std.debug.print("尾部: {s}\n", .{line.written()});
            }
        },
        else => return err,
    }
}
```

### 字节级读取

Reader 也支持更细粒度的读取操作：

```zig
// 读取单个字节
const byte = try reader.interface.takeByte();

// 读取整数（指定字节序）
const int = try reader.interface.takeInt(u32, .little);

// 读取固定数量的字节
const chunk = try reader.interface.take(16);
```

还有 `takeStruct`、`takeEnum`、`peekByte`、`peek` 等方法值得探索。

---

## 写入文件内容

### 使用 File.Writer

对于需要缓冲、格式化等功能的写入，使用 `File.Writer`：

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    const file = try Io.Dir.cwd().createFile(io, "output.txt", .{});
    defer file.close(io);

    var buf: [1024]u8 = undefined;
    var file_writer: Io.File.Writer = file.writer(io, &buf);

    // 写入数据
    try file_writer.interface.writeAll("hello\n");
    try file_writer.interface.print("count = {d}\n", .{42});
    try file_writer.interface.writeByte(0x0A);
    try file_writer.interface.writeInt(u32, 1234, .little);

    // 写完后刷新缓冲
    try file_writer.interface.flush();
}
```

**重要**：写入操作后务必调用 `flush()`，确保缓冲区中的数据写入底层文件。

### 固定缓冲区 Writer（用于测试或内存写入）

`Io.Writer.fixed` 创建一个写入到已有缓冲区的 Writer：

```zig
var buf: [1024]u8 = undefined;
var writer: std.Io.Writer = .fixed(&buf);

try writer.writeAll("hello");
try writer.writeByte('\n');
try writer.print("value = {d}\n", .{42});

// 获取已写入的内容
const written = writer.buffered();
std.debug.print("{s}", .{written});
```

对于 `.fixed()` Writer，`flush()` 是空操作（no-op），但仍建议养成调用习惯。

---

## 错误处理的特殊之处

`std.Io` 的错误处理有几个需要特别注意的地方：Reader 和 Writer 的通用接口只暴露 `ReadFailed` 和 `WriteFailed` 这样的高层错误，具体错误信息保存在具体实现的 `.err` 字段中；在异步/并发上下文中，`error.Canceled` 是一个特殊错误，**必须被正确传播**才能让取消机制工作。

下面用一个完整示例展示这个模式：

```zig
// 下层函数只接收接口，出错时直接 try 让 ReadFailed 传播上去
fn handleLine(reader: *Io.Reader, line: []const u8) !void {
    _ = try reader.take(10);
}

// 上层函数创建具体实现，负责在 catch 中检查 .err 获取具体错误
fn processFile(io: Io, file: Io.File) !void {
    var buf: [1024]u8 = undefined;
    var file_reader = file.reader(io, &buf);

    while (file_reader.interface.takeDelimiter('\n')) |result| {
        if (result) |line| {
            handleLine(&file_reader.interface, line) catch |err| switch (err) {
                error.ReadFailed => return file_reader.err.?,
                else => |e| return e,
            };
        } else break;
    } else |err| switch (err) {
        error.ReadFailed => return file_reader.err.?,
        error.StreamTooLong => return err,
    }
}
```

简而言之：**下层代码**（只接收 `Io.Reader` 或 `Io.Writer` 接口的函数）直接用 `try` 传播；**上层代码**（创建 Reader/Writer 的地方）负责在 `catch` 中检查 `.err` 字段，获取并传播 `error.Canceled` 等具体错误。

---

## 时间相关 API

`std.Io` 引入了 `Timestamp`、`Duration` 和 `Clock` 类型，比之前的 API 有很大改进。

### Clock：时钟类型

```zig
pub const Clock = enum {
    real,         // 系统墙上时钟（受 NTP 和手动调整影响）
    awake,        // 单调时钟（不含系统休眠时间）
    boot,         // 单调时钟（含系统休眠时间）
    cpu_process,  // 进程使用的 CPU 时间
    cpu_thread,   // 线程使用的 CPU 时间
};
```

### Duration：时间长度

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    // 从不同单位创建 Duration
    const d1 = std.Io.Duration.fromNanoseconds(100);
    const d2 = std.Io.Duration.fromMicroseconds(500);
    const d3 = std.Io.Duration.fromMilliseconds(200);
    const d4 = std.Io.Duration.fromSeconds(3);

    // 转换为不同单位
    std.debug.print("毫秒: {d}\n", .{d3.toMilliseconds()});
    std.debug.print("秒: {d}\n", .{d4.toSeconds()});
}
```

### Timestamp：时间点

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    // 获取当前时间
    const now = std.Io.Timestamp.now(io, .real);

    // 计算时间差
    const start = std.Io.Timestamp.now(io, .awake);
    // ... 执行一些操作 ...
    const end = std.Io.Timestamp.now(io, .awake);
    const elapsed = start.durationTo(end);
    std.debug.print("耗时: {}\n", .{elapsed});
}
```

### sleep：休眠

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    // 休眠 2 秒（使用 real 时钟）
    try io.sleep(.fromSeconds(2), .real);

    // sleep 也可能返回 error.Canceled（在异步上下文中）
}
```

---

## 异步基础

`std.Io` 不只是 I/O 接口，它还是一个管理异步和并发任务的运行时。

关于异步、并发、并行三个概念的区别，见[并发编程概述](../part2-advanced/chapter-concurrency.md)章节。`std.Io` 提供异步和并发能力，其中并发是可选的。

### io.async 和 Future

`io.async` 启动一个异步任务，返回一个 `Future`：

```zig
const std = @import("std");
const Io = std.Io;

fn saveData(io: Io, file_name: []const u8, data: []const u8) !Io.File {
    const fd = try Io.Dir.cwd().createFile(io, file_name, .{});
    errdefer fd.close(io);
    try fd.writeStreamingAll(io, data);
    return fd;
}

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    // 同时启动两个异步保存任务
    var future_foo = io.async(saveData, .{ io, "foo.txt", "foo\n" });
    var future_bar = io.async(saveData, .{ io, "bar.txt", "bar\n" });

    // 等待两个任务完成
    const foo = try future_foo.await(io);
    defer foo.close(io);
    const bar = try future_bar.await(io);
    defer bar.close(io);
}
```

两个保存操作互不依赖，可以受益于异步执行。

### await 和 cancel

- **`await`**：等待任务完成，返回结果
- **`cancel`**：请求取消任务，然后等待完成，返回结果
- 两者在任务已完成时行为相同，直接返回结果
- 取消通过 `error.Canceled` 被任务检测到

### 资源泄漏问题

上面的代码有一个隐患：如果 `future_foo.await` 失败，`future_bar` 永远不会被 await，导致 Future 和文件句柄泄漏。

解决方案是用 `defer` 加 `cancel`：

```zig
pub fn main(init: std.process.Init) !void {
    const io = init.io;

    var future_foo = io.async(saveData, .{ io, "foo.txt", "foo\n" });
    defer if (future_foo.cancel(io)) |file| file.close(io) else |_| {};

    var future_bar = io.async(saveData, .{ io, "bar.txt", "bar\n" });
    defer if (future_bar.cancel(io)) |file| file.close(io) else |_| {};

    // cancel 在已完成的任务上等同于 await，返回结果
    // 在未完成的任务上则请求取消
    // 无论哪种情况，都确保资源被清理
    _ = try future_foo.await(io);
    _ = try future_bar.await(io);
}
```

`cancel` 的返回类型和原函数相同。使用 `if (future.cancel(io))` 模式：
- 成功时拿到返回值（如文件句柄），进行清理
- 失败时（包括 `error.Canceled`）用 `else |_| {}` 忽略

这是 `std.Io` 异步编程中最重要的模式之一。

### 异步打开文件

```zig
const std = @import("std");
const Io = std.Io;

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    // 异步打开文件
    var open_task = io.async(Io.Dir.openFile, .{ Io.Dir.cwd(), io, "data.txt", .{} });
    defer if (open_task.cancel(io)) |file| file.close(io) else |_| {};

    // 等待文件打开
    const file = try open_task.await(io);
    // 现在可以读取...
}
```

---

## 并发

### io.concurrent

`io.concurrent` 保证真正的并发。如果不可用则返回 `error.ConcurrencyUnavailable`：

```zig
var future = try io.concurrent(someTask, .{io, arg1, arg2});
defer _ = future.cancel(io) catch {};
```

juicy main 提供的 `io` 实例在可能的情况下会支持并发。

### 队列：生产者-消费者模式

`std.Io.Queue` 是多生产者、多消费者的 FIFO 队列，操作在队列满/空时会阻塞：

```zig
const std = @import("std");
const Io = std.Io;

const Task = struct {
    id: Id,
    status: enum { started, pending, finished },
    const Id = enum(u8) { a, b, c };
};

fn logger(io: Io, queue: *Io.Queue(Task)) !void {
    // getOne 在队列为空时阻塞
    while (queue.getOne(io)) |t| {
        std.debug.print("{s}: {s}\n", .{ @tagName(t.status), @tagName(t.id) });
    } else |e| return e;
}

fn doWork(io: Io, task_id: Task.Id, queue: *Io.Queue(Task)) !void {
    try queue.putOne(io, .{ .id = task_id, .status = .started });
    try io.sleep(.fromSeconds(2), .real);
    try queue.putOne(io, .{ .id = task_id, .status = .finished });
}

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    var buf: [10]Task = undefined;
    var queue: Io.Queue(Task) = .init(&buf);

    // 日志任务需要并发运行
    var future_logger = try io.concurrent(logger, .{ io, &queue });
    defer future_logger.cancel(io) catch {};

    var future_a = io.async(doWork, .{ io, .a, &queue });
    defer future_a.cancel(io) catch {};

    var future_b = io.async(doWork, .{ io, .b, &queue });
    defer future_b.cancel(io) catch {};

    try future_a.await(io);
    try future_b.await(io);

    // 关闭队列，让 logger 能正常退出
    queue.close(io);
    try future_logger.await(io);
}
```

**重要**：`queue.close(io)` 会让 `getOne` 在处理完剩余元素后返回 `error.Closed`，而不是永远阻塞。这是让消费者任务正常退出的关键。

### Group：管理多个 Future

`Io.Group` 高效管理任意数量的 Future，可以一起 await 或 cancel：

```zig
const std = @import("std");
const Io = std.Io;

fn worker(io: Io, id: usize) !void {
    try io.sleep(.fromSeconds(@intCast(id)), .real);
    std.debug.print("worker {} done\n", .{id});
}

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    var group: Io.Group = .init;

    // 添加多个异步任务到组
    for (0..5) |i| {
        group.async(io, worker, .{ io, i });
    }

    // 等待所有任务完成
    try group.await(io);
}
```

Group 的限制是：
- 只能整体 await 或 cancel，不能单独操作
- 返回类型限制为 `void`、`error{Canceled}` 或 `error{Canceled}!void`

### Select：更灵活的多任务管理

`Io.Select` 结合了 Group 和 Queue 的能力，支持不同的返回类型：

```zig
const std = @import("std");
const Io = std.Io;

// 定义结果类型为 tagged union
const Result = union(enum) {
    file_content: []const u8,
    network_data: []const u8,
    timeout: void,
};

pub fn main(init: std.process.Init) !void {
    const io = init.io;

    var select: Io.Select(Result) = .{ .io = io };
    defer select.cancelDiscard(io);

    // 添加不同类型的任务
    select.async(.file_content, readFile, .{io, "data.txt"});
    select.async(.network_data, fetchNetwork, .{io, "example.com"});

    // 等待下一个完成的任务
    while (select.next(io)) |result| {
        switch (result) {
            .file_content => |data| std.debug.print("文件: {s}\n", .{data}),
            .network_data => |data| std.debug.print("网络: {s}\n", .{data}),
            .timeout => std.debug.print("超时\n", .{}),
        }
    } else |err| switch (err) {
        error.Canceled => return,
        else => return err,
    }
}
```

`cancelDiscard` 取消并丢弃所有结果（不需要缓冲空间），但如果任务返回需要清理的资源，必须使用 `cancel`。

---

## 同步原语

`std.Io` 提供了与任务管理集成的同步原语，应优先使用这些而不是操作系统原语：

- `Io.RwLock`：读写锁
- `Io.Semaphore`：信号量
- `Io.futexWait` / `Io.futexWake`：底层等待/唤醒

这些原语与 `Io` 实现的任务调度集成，在不同 `Io` 后端下行为一致。操作系统的同步原语在某些 `Io` 实现下可能无法按预期工作。

---

## 完整示例：文件处理工具

下面是一个综合运用本章知识的例子——一个简单的文件处理工具：

```zig
const std = @import("std");
const Io = std.Io;

fn processFile(io: Io, input_path: []const u8, output_path: []const u8) !void {
    // 打开输入文件
    const input = Io.Dir.cwd().openFile(io, input_path, .{}) catch |err| switch (err) {
        error.FileNotFound => {
            std.debug.print("输入文件不存在: {s}\n", .{input_path});
            return err;
        },
        else => |e| return e,
    };
    defer input.close(io);

    // 创建输出文件
    const output = try Io.Dir.cwd().createFile(io, output_path, .{});
    defer output.close(io);

    // 创建读写器
    var read_buf: [1024]u8 = undefined;
    var file_reader: Io.File.Reader = input.reader(io, &read_buf);

    var write_buf: [1024]u8 = undefined;
    var file_writer: Io.File.Writer = output.writer(io, &write_buf);

    var line_num: usize = 0;

    // 按行处理
    while (file_reader.interface.takeDelimiter('\n')) |result| {
        if (result) |line| {
            line_num += 1;
            try file_writer.interface.print("{d}: {s}\n", .{ line_num, line });
        } else break;
    } else |err| switch (err) {
        error.ReadFailed => return file_reader.err.?,
        error.StreamTooLong => {
            std.debug.print("行过长，超过缓冲区\n", .{});
            return err;
        },
    }

    // 确保所有数据写入
    try file_writer.interface.flush();
    std.debug.print("处理完成，共 {d} 行\n", .{line_num});
}

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    try processFile(io, "input.txt", "output.txt");
}
```

---

## 从旧 API 迁移

如果你有使用旧版 `std.fs` 的代码，迁移的核心变化是：

| 旧版 | 新版 |
| ---- | ---- |
| `std.fs.cwd()` | `std.Io.Dir.cwd()` |
| `cwd.openFile(path, .{})` | `cwd.openFile(io, path, .{})` |
| `cwd.createFile(path, .{})` | `cwd.createFile(io, path, .{})` |
| `file.readToEndAlloc(gpa, max)` | 使用 `Dir.readFile` 或 `File.Reader` |
| `file.writeAll(data)` | `file.writeStreamingAll(io, data)` 或使用 `File.Writer` |
| `file.close()` | `file.close(io)` |
| `std.posix` 相关操作 | `std.Io` 中的对应方法 |

每个 I/O 操作现在都需要传入 `io` 参数，这是最大的变化。

---

## 本章小结

`std.Io` 是 Zig I/O 模型的核心抽象，它的设计遵循与 Allocator 相同的理念：

1. **显式传递**：所有 I/O 操作需要 `Io` 实例，就像内存分配需要 `Allocator`
2. **实现可切换**：通过选择不同的 `Io` 实现（Threaded、Evented 等），改变 I/O 模型
3. **异步与并发一体化**：Future、Group、Select 提供从简单到复杂的多任务管理
4. **错误处理要注意**：`ReadFailed`/`WriteFailed` 下有具体错误；`error.Canceled` 必须正确传播
5. **资源管理要严谨**：使用 `defer` + `cancel` 模式确保异步任务的资源不泄漏

使用 `std.Io` 时要建立的直觉：

- 文件操作从 `Io.Dir.cwd()` 出发，所有方法第一个参数是 `io`
- 读取用 `File.Reader`（通过 `file.reader(io, &buf)` 创建）
- 写入用 `File.Writer`（通过 `file.writer(io, &buf)` 创建），别忘了 `flush()`
- 简单场景用 `Dir.readFile` / `File.writeStreamingAll`
- 异步场景用 `io.async` + `defer cancel` 模式
- 需要真正并发时用 `io.concurrent`

> **相关阅读**：
> - 并发编程的线程、锁、原子操作基础见[并发编程概述](chapter-concurrency.md)
> - 更完整的异步 I/O 方向讨论见[异步 I/O：现状与未来方向](../part3-practice/chapter-async.md)
> - 内存分配策略见[内存管理模型](chapter-memory-management.md)

## 参考

- [std.Io overview](https://ziggit.dev/t/std-io-overview/14994)
- [File I/O basics (0.16)](https://ziggit.dev/t/file-i-o-basics-0-16/14968)
