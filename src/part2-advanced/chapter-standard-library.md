# 【draft】标准库常用模块

> ⚠️ **I/O 系统重大变更警告**：Zig 0.16 对标准库进行了重大重构。
> 
> - **网络模块迁移**：`std.net` → `std.Io.net`
> - **I/O 函数签名变更**：大部分 I/O 函数新增 `io` 参数
> - **API 稳定性**：部分 API 仍在调整中，可能继续变化
> - **建议**：生产环境使用稳定版本，开发环境关注官方更新

## 标准库概览与版本兼容性

# 标准库架构

Zig标准库按功能模块组织，主要包含：

- `std.mem`: 内存操作和分配器
- `std.io`: 输入输出操作
- `std.fs`: 文件系统操作
- `std.net`: 网络编程（**注意**：0.16.0-dev已迁移）
- `std.process`: 进程管理
- `std.fs`: 文件系统
- `std.debug`: 调试工具
- `std.fmt`: 格式化
- `std.math`: 数学函数
- `std.collections`: 集合类型

# 如何查阅文档

1. **在线文档**: https://ziglang.org/documentation/master/std/
2. **本地文档**: 运行`zig std`启动本地服务器
3. **源码阅读**: 标准库源码本身就是最好的文档

# ⚠️ 版本兼容性重要说明

**本教程基于 Zig 0.16.0-dev 版本**，该版本引入了重大API变更：

| 变更内容    | 旧版本 (0.15.x)          | 新版本 (0.16.0-dev)       | 影响范围       |
| ----------- | ------------------------ | ------------------------- | -------------- |
| I/O接口     | `std.io.getStdOut()`     | `std.Io.File.stdout()`    | 所有I/O操作    |
| 网络模块    | `std.net`                | `std.Io.net`              | 网络编程       |
| 分配器      | `std.heap.smp_allocator` | `std.heap.page_allocator` | 多线程内存管理 |
| I/O函数签名 | 无`io`参数               | 新增`io`参数              | 大部分I/O函数  |

**迁移示例**：

旧版本代码：
```zig
const stdout = std.io.getStdOut().writer();
try stdout.print("Hello\n", .{});
```

新版本代码：
```zig
// ✨ 新特性：std.Io 统一接口
pub fn main(init: std.process.Init) !void {
    try std.Io.File.stdout().writeStreamingAll(init.io, "Hello\n");
}
```

**如果遇到编译错误**：
1. 检查是否使用了已废弃的API
2. 查阅官方迁移指南
3. 参考标准库源码中的最新用法

## 标准输入输出（0.16.0-dev 新API）

> 📖 **本节内容来源**：整合自 Pedro Park 的 Zig Book 和官方文档

### I/O 基础概念

**什么是输入/输出（I/O）？**

如果您有高级编程语言的经验，您一定使用过输入或输出功能。例如，在 Python 中，我们可以使用 `input()` 内置函数接收用户输入，使用 `print()` 函数向用户显示输出。

但是，您知道这些函数如何与操作系统交互吗？它们如何利用操作系统的资源来接收或发送输入/输出？

**操作系统层面的 I/O**

本质上，高级语言的输入/输出函数只是对操作系统标准输出和标准输入通道的抽象。这意味着：

- 我们通过操作系统接收输入或发送输出
- 操作系统是用户和程序之间的桥梁
- 程序不直接访问用户，而是通过操作系统中介

**标准通道**

操作系统通常为每个程序创建三个标准通道：

1. **标准输出（stdout）**：输出流通道
   - 程序的正常输出通过此通道发送
   - 通常显示在终端

2. **标准输入（stdin）**：输入流通道
   - 用户的输入通过此通道接收
   - 可以来自键盘、文件或其他程序

3. **标准错误（stderr）**：错误消息通道
   - 错误和警告消息通过此通道发送
   - 通常以红色或橙色显示在终端

**进程隔离**

每个运行的程序都有独立的 stdin、stdout 和 stderr 通道：

```
程序 A                程序 B                程序 C
├─ stdin   ─┐       ├─ stdin   ─┐       ├─ stdin   ─┐
├─ stdout ──┼─ OS ──├─ stdout ──┼─ OS ──├─ stdout ──┼─ OS
└─ stderr ──┘       └─ stderr ──┘       └─ stderr ──┘
```

这是操作系统的行为，与编程语言无关。无论使用什么编程语言，操作系统都是程序与用户之间的中介。

**Zig 中的 I/O 模型**

Zig 通过 `std.Io` 模块（0.16.0+）提供跨平台的 I/O 操作：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // stdout - 标准输出
    const stdout = std.Io.File.stdout();
    try stdout.writeStreamingAll(init.io, "Normal output\n");
    
    // stderr - 标准错误
    const stderr = std.Io.File.stderr();
    try stderr.writeStreamingAll(init.io, "Error message\n");
    
    // stdin - 标准输入
    const stdin = std.Io.File.stdin();
    var buffer: [100]u8 = undefined;
    const bytes = try stdin.read(init.io, &buffer);
}
```

**关键概念总结**：

| 概念     | 说明                      | Zig API                |
| -------- | ------------------------- | ---------------------- |
| stdin    | 标准输入通道              | `std.Io.File.stdin()`  |
| stdout   | 标准输出通道              | `std.Io.File.stdout()` |
| stderr   | 标准错误通道              | `std.Io.File.stderr()` |
| 进程隔离 | 每个程序有独立的 I/O 通道 | 操作系统自动管理       |

Zig 0.16.0-dev 对I/O系统进行了全面重构，引入了新的 `std.Io` 模块。

# 新版本方式（0.16.0-dev）

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // 标准输出 - 使用新的 std.Io API
    const stdout = std.Io.File.stdout();
    try stdout.writeStreamingAll(init.io, "Hello, stdout!\n");
    
    // 标准错误
    const stderr = std.Io.File.stderr();
    try stderr.writeStreamingAll(init.io, "Error message\n");
    
    // 使用格式化输出（通过 std.fmt 和 writer）
    var buf: [256]u8 = undefined;
    const formatted = try std.fmt.bufPrint(&buf, "数字: {}, 字符串: {s}\n", .{ 42, "hello" });
    try stdout.writeStreamingAll(init.io, formatted);
    
    // 标准输入 - 使用 init.io 进行读取
    var buffer: [100]u8 = undefined;
    try stdout.writeStreamingAll(init.io, "请输入一行文本：");
    
    // 从标准输入读取
    const stdin = std.Io.File.stdin();
    const bytes_read = try stdin.read(init.io, &buffer);
    if (bytes_read > 0) {
        const line = std.mem.trimRight(u8, buffer[0..bytes_read], "\r\n");
        try stdout.writeStreamingAll(init.io, "你输入了：");
        try stdout.writeStreamingAll(init.io, line);
        try stdout.writeStreamingAll(init.io, "\n");
    }
}
```

# 简化版本（使用 Minimal Init）

对于简单的程序，可以使用 `std.process.Init.Minimal`：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 使用 std.debug.print 进行简单输出（无需 init.io）
    std.debug.print("Hello, stdout!\n", .{});
    
    // 标准错误
    std.debug.print("Error message\n", .{});
    
    // 注意：Minimal 模式下无法使用完整的 I/O 功能
    // 如需文件操作或网络，请使用 std.process.Init
}
```

# API 变更对比

| 功能     | 旧版本 (0.15.x)                           | 新版本 (0.16.0-dev)                            |
| -------- | ----------------------------------------- | ---------------------------------------------- |
| 标准输出 | `std.io.getStdOut().writer()`             | `std.Io.File.stdout()`                         |
| 标准输入 | `std.io.getStdIn().reader()`              | `std.Io.File.stdin()`                          |
| 标准错误 | `std.io.getStdErr().writer()`             | `std.Io.File.stderr()`                         |
| 写入操作 | `try writer.print("...", .{})`            | `try stdout.writeStreamingAll(init.io, "...")` |
| 读取操作 | `try reader.readUntilDelimiterOrEof(...)` | `try stdin.read(init.io, &buffer)`             |

# 旧版本兼容说明（0.15.x及之前）

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 旧版本方式（已废弃）
    const stdout = std.io.getStdOut().writer();
    try stdout.print("Hello, stdout!\n", .{});
    
    const stdin = std.io.getStdIn().reader();
    var buffer: [100]u8 = undefined;
    if (try stdin.readUntilDelimiterOrEof(buffer[0..], '\n')) |line| {
        std.debug.print("你输入了：{s}\n", .{line});
    }
}
```

# 8.1.1 ⚠️ I/O API 详细说明（0.15.x+）

> **重要**：Zig 0.15.x 对 I/O 系统进行了全面重构（"Writergate"）。理解底层 API 对于编写高效程序至关重要。

# I/O API 层次结构

Zig 的 I/O 系统分为三个层次：

| 层次       | API                    | 适用场景                 | 复杂度 |
| ---------- | ---------------------- | ------------------------ | ------ |
| **便捷层** | `writeStreamingAll()`  | 简单输出、一次性写入     | 低     |
| **缓冲层** | `writer()` + `flush()` | 需要多次写入、格式化输出 | 中     |
| **底层**   | `write()` / `read()`   | 直接系统调用、零拷贝     | 高     |

# 方式一：便捷方法（推荐用于简单场景）

**适用场景**：
- 一次性写入少量数据
- 简单的日志输出
- 不需要格式化的场景

**示例**：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // 便捷方法：一次性写入并自动刷新
    try std.Io.File.stdout().writeStreamingAll(init.io, "Hello, World!\n");
    
    // 也适用于文件
    const file = try std.fs.cwd().createFile("output.txt", .{});
    defer file.close();
    try file.writeStreamingAll(init.io, "File content\n");
}
```

**优点**：
- 代码简洁
- 自动处理缓冲和刷新
- 不需要手动管理缓冲区

**缺点**：
- 每次调用都会刷新，性能较低
- 不适合频繁写入的场景

# 方式二：缓冲写入（推荐用于复杂场景）

**适用场景**：
- 需要多次写入
- 需要格式化输出
- 性能敏感的场景

**示例**：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // 步骤1：创建缓冲区
    var buf: [4096]u8 = undefined;
    
    // 步骤2：创建 writer
    var stdout_writer = std.Io.File.stdout().writer(init.io, &buf);
    const stdout = &stdout_writer.interface;
    
    // 步骤3：多次写入（数据会缓冲在 buf 中）
    try stdout.print("第一行\n", .{});
    try stdout.print("第二行：{}\n", .{42});
    try stdout.print("第三行：{s}\n", .{"hello"});
    
    // 步骤4：必须手动刷新！
    try stdout.flush();
}
```

**关键点**：
1. **必须手动刷新**：忘记 `flush()` 会导致数据丢失
2. **缓冲区大小**：通常 4KB-64KB，根据场景调整
3. **生命周期**：缓冲区必须在 writer 整个生命周期内有效

**常见错误**：

```zig
// ✨ 新特性：std.Io 统一接口
var stdout_writer = std.Io.File.stdout().writer(init.io, &buf);
const stdout = &stdout_writer.interface;
try stdout.print("Hello\n", .{});
// 缺少 flush，数据可能不会写入！

// ❌ 错误2：缓冲区生命周期错误
fn badExample(init: std.process.Init) !void {
    var buf: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buf);
    // 返回 writer 会导致 buf 失效
    return writer;  // 编译错误或运行时错误
}

// ✅ 正确：确保 flush
var stdout_writer = std.Io.File.stdout().writer(init.io, &buf);
const stdout = &stdout_writer.interface;
try stdout.print("Hello\n", .{});
try stdout.flush();  // 必须刷新
```

# 方式三：固定缓冲区（用于内存操作）

**适用场景**：
- 在内存中构建字符串
- 不涉及文件或网络
- 需要获取写入的数据

**示例**：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 创建固定缓冲区 writer
    var buf: [256]u8 = undefined;
    var w: std.Io.Writer = .fixed(&buf);
    
    // 写入数据
    try w.print("Hello, {s}!", .{"World"});
    
    // 获取写入的数据
    const result = w.buffered();  // "Hello, World!"
    std.debug.print("结果：{s}\n", .{result});
}
```

# 读取操作

**方式一：便捷读取**

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const file = try std.fs.cwd().openFile("input.txt", .{});
    defer file.close();
    
    // 读取所有内容
    var buf: [4096]u8 = undefined;
    const bytes_read = try file.read(init.io, &buf);
    const content = buf[0..bytes_read];
    
    std.debug.print("读取到：{s}\n", .{content});
}
```

**方式二：缓冲读取（推荐）**

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const file = try std.fs.cwd().openFile("input.txt", .{});
    defer file.close();
    
    // 创建缓冲 reader
    var buf: [4096]u8 = undefined;
    var file_reader = file.reader(init.io, &buf);
    const r = &file_reader.interface;
    
    // 逐行读取
    while (try r.takeDelimiter('\n')) |line| {
        std.debug.print("行：{s}\n", .{line});
    }
    
    // 读取二进制数据
    const header = try r.takeStruct(Header, .little);
    const value = try r.takeInt(u32, .big);
}
```

**方式三：固定缓冲区读取**

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 从字符串创建 reader
    var r: std.Io.Reader = .fixed("hello\nworld");
    
    // 读取第一行
    const line1 = (try r.takeDelimiter('\n')).?;  // "hello"
    
    // 读取第二行
    const line2 = (try r.takeDelimiter('\n')).?;  // "world"
    
    // EOF 时返回 null
    const line3 = try r.takeDelimiter('\n');  // null
}
```

# 缓冲区管理最佳实践

**1. 选择合适的缓冲区大小**

```zig
// 小数据：1-4 KB
var small_buf: [1024]u8 = undefined;

// 一般用途：4-16 KB
var medium_buf: [4096]u8 = undefined;

// 大文件/高性能：16-64 KB
var large_buf: [65536]u8 = undefined;
```

**2. 使用 Arena Allocator 管理缓冲区**

```zig
// ✨ 新特性：std.Io 统一接口
pub fn main(init: std.process.Init) !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    
    // 动态分配缓冲区
    const buf = try arena.allocator().alloc(u8, 4096);
    
    var writer = std.Io.File.stdout().writer(init.io, buf);
    const stdout = &writer.interface;
    
    try stdout.print("Hello\n", .{});
    try stdout.flush();
}
```

**3. 重用缓冲区**

```zig
pub fn processFiles(init: std.process.Init, files: []const []const u8) !void {
    var buf: [4096]u8 = undefined;
    
    for (files) |file_path| {
        const file = try std.fs.cwd().openFile(file_path, .{});
        defer file.close();
        
        // 重用同一个缓冲区
        var reader = file.reader(init.io, &buf);
        const r = &reader.interface;
        
        // 处理文件...
        while (try r.takeDelimiter('\n')) |line| {
            // 处理每一行
        }
    }
}
```

# 性能对比

| 方法                  | 适用场景 | 性能 | 内存使用 |
| --------------------- | -------- | ---- | -------- |
| `writeStreamingAll()` | 简单输出 | 低   | 最小     |
| 缓冲写入 + flush      | 频繁写入 | 高   | 中等     |
| 固定缓冲区            | 内存操作 | 最高 | 可控     |

# 迁移指南：从旧 API 迁移

**旧版本（0.14.x）：**

```zig
const stdout = std.io.getStdOut().writer();
try stdout.print("Hello\n", .{});
// 自动刷新
```

**新版本（0.15.x+）：**

```zig
// 方式1：便捷方法
// ✨ 新特性：std.Io 统一接口
try std.Io.File.stdout().writeStreamingAll(init.io, "Hello\n");

// 方式2：缓冲写入
var buf: [4096]u8 = undefined;
var writer = std.Io.File.stdout().writer(init.io, &buf);
const stdout = &writer.interface;
try stdout.print("Hello\n", .{});
try stdout.flush();  // 必须手动刷新
```

**关键差异**：
1. 新 API 需要显式传递 `init.io`
2. 缓冲写入需要手动 `flush()`
3. 需要手动管理缓冲区

# 8.1.2 Writer/Reader 模式

> 📖 **本节内容来源**：整合自 Pedro Park 的 Zig Book

# Writer/Reader 模式概述

在 Zig 中，有一个围绕输入/输出（I/O）的模式。本质上，每个 I/O 操作都通过 Reader 或 Writer 对象进行。

这两个数据类型实际上是接口，来自 Zig 标准库的 `std.Io` 模块。顾名思义：

- **Reader**：提供从"某处"读取数据的工具
- **Writer**：提供向"某处"写入数据的工具

这个"某处"可能是不同的东西：
- 文件系统中的文件
- 系统中的网络套接字
- 连续的数据流（如标准输入设备）
- 游戏中的实时聊天（不断接收和显示新消息）

# Writer 接口

每个 Writer 对象都有以下主要方法：

**核心方法**：

| 方法          | 说明                   | 示例                                     |
| ------------- | ---------------------- | ---------------------------------------- |
| `print()`     | 写入格式化字符串       | `try writer.print("值: {}\n", .{42});`   |
| `writeAll()`  | 写入字符串或字节数组   | `try writer.writeAll("Hello");`          |
| `writeByte()` | 写入单个字节           | `try writer.writeByte('\n');`            |
| `writeInt()`  | 写入整数（指定字节序） | `try writer.writeInt(u32, 42, .little);` |

**示例：使用 Writer 写入文件**

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // 创建文件
    const file = try std.fs.cwd().createFile("output.txt", .{});
    defer file.close();
    
    // 创建缓冲区
    var buf: [4096]u8 = undefined;
    
    // 创建 Writer
    var file_writer = file.writer(init.io, &buf);
    const writer = &file_writer.interface;
    
    // 写入数据
    try writer.print("第一行：{}\n", .{42});
    try writer.print("第二行：{s}\n", .{"hello"});
    try writer.writeAll("第三行：直接写入\n");
    
    // 必须刷新！
    try writer.flush();
}
```

# Reader 接口

每个 Reader 对象都有以下主要方法：

**核心方法**：

| 方法              | 说明             | 示例                                                     |
| ----------------- | ---------------- | -------------------------------------------------------- |
| `takeDelimiter()` | 读取到指定分隔符 | `const line = try reader.takeDelimiter('\n');`           |
| `takeStruct()`    | 读取结构体       | `const header = try reader.takeStruct(Header, .little);` |
| `takeInt()`       | 读取整数         | `const value = try reader.takeInt(u32, .big);`           |
| `read()`          | 读取原始字节     | `const n = try reader.read(buf);`                        |

**示例：使用 Reader 读取文件**

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // 打开文件
    const file = try std.fs.cwd().openFile("input.txt", .{});
    defer file.close();
    
    // 创建缓冲区
    var buf: [4096]u8 = undefined;
    
    // 创建 Reader
    var file_reader = file.reader(init.io, &buf);
    const reader = &file_reader.interface;
    
    // 逐行读取
    while (try reader.takeDelimiter('\n')) |line| {
        std.debug.print("行：{s}\n", .{line});
    }
}
```

# 文件描述符

Writer 和 Reader 对象通常从文件描述符对象创建。更具体地说，通过文件描述符对象的 `writer()` 和 `reader()` 方法创建。

**什么是文件描述符？**

文件描述符是操作系统用于标识打开文件的整数。在 Zig 中，`std.fs.File` 类型封装了文件描述符，提供了跨平台的文件操作接口。

**从文件描述符创建 Writer/Reader**：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // 标准输出的文件描述符
    const stdout_file = std.Io.File.stdout();
    
    // 创建 Writer
    var buf: [4096]u8 = undefined;
    var stdout_writer = stdout_file.writer(init.io, &buf);
    const stdout = &stdout_writer.interface;
    
    try stdout.print("Hello, World!\n", .{});
    try stdout.flush();
    
    // 标准输入的文件描述符
    const stdin_file = std.Io.File.stdin();
    
    // 创建 Reader
    var stdin_reader = stdin_file.reader(init.io, &buf);
    const stdin = &stdin_reader.interface;
    
    var input_buf: [100]u8 = undefined;
    if (try stdin.takeDelimiter('\n')) |line| {
        try stdout.print("你输入了：{s}\n", .{line});
        try stdout.flush();
    }
}
```

# Writer/Reader 模式的优势

**1. 统一的接口**

无论数据源是什么（文件、网络、内存），都使用相同的 Reader/Writer 接口：

```zig
// 写入文件
// ✨ 新特性：std.Io 统一接口
const file = try std.fs.cwd().createFile("file.txt", .{});
var file_writer = file.writer(init.io, &buf);

// 写入标准输出
var stdout_writer = std.Io.File.stdout().writer(init.io, &buf);

// 两者使用相同的接口
const writer = &file_writer.interface; // 或 stdout_writer.interface
try writer.print("相同的方式写入\n", .{});
try writer.flush();
```

**2. 组合性**

Reader 和 Writer 可以组合使用，实现复杂的数据流：

```zig
// 读取文件，处理数据，写入另一个文件
fn processFile(init: std.process.Init, input_path: []const u8, output_path: []const u8) !void {
    const input = try std.fs.cwd().openFile(input_path, .{});
    defer input.close();
    
    const output = try std.fs.cwd().createFile(output_path, .{});
    defer output.close();
    
    var buf: [4096]u8 = undefined;
    
    var input_reader = input.reader(init.io, &buf);
    const reader = &input_reader.interface;
    
    var output_writer = output.writer(init.io, &buf);
    const writer = &output_writer.interface;
    
    // 逐行处理
    while (try reader.takeDelimiter('\n')) |line| {
        // 处理数据
        try writer.print("处理：{s}\n", .{line});
    }
    
    try writer.flush();
}
```

**3. 可测试性**

使用固定缓冲区的 Reader/Writer 可以轻松编写测试：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

fn processData(reader: *std.Io.Reader, writer: *std.Io.Writer) !void {
    while (try reader.takeDelimiter('\n')) |line| {
        try writer.print("处理：{s}\n", .{line});
    }
}

test "processData" {
    // 使用固定缓冲区测试
    var reader: std.Io.Reader = .fixed("input1\ninput2\n");
    var output_buf: [256]u8 = undefined;
    var writer: std.Io.Writer = .fixed(&output_buf);
    
    try processData(&reader, &writer);
    
    const result = writer.buffered();
    try std.testing.expectEqualStrings("处理：input1\n处理：input2\n", result);
}
```

# Writer/Reader 模式最佳实践

**1. 总是使用缓冲区**

```zig
// ✨ 新特性：DebugAllocator
try file.writeStreamingAll(init.io, "line1\n");
try file.writeStreamingAll(init.io, "line2\n");

// ✅ 推荐：使用缓冲区
var buf: [4096]u8 = undefined;
var writer = file.writer(init.io, &buf);
const w = &writer.interface;
try w.print("line1\n", .{});
try w.print("line2\n", .{});
try w.flush(); // 一次性写入
```

**2. 记得刷新 Writer**

```zig
// ✨ 新特性：DebugAllocator
var writer = file.writer(init.io, &buf);
const w = &writer.interface;

try w.print("数据\n", .{});
// ❌ 忘记 flush，数据可能丢失！

// ✅ 正确：刷新缓冲区
try w.flush();
```

**3. 使用 defer 确保资源释放**

```zig
// ✨ 新特性：DebugAllocator
const file = try std.fs.cwd().createFile("output.txt", .{});
defer file.close(); // 确保文件关闭

var buf: [4096]u8 = undefined;
var writer = file.writer(init.io, &buf);
const w = &writer.interface;

try w.print("数据\n", .{});
try w.flush();
// defer 会自动关闭文件
```

**4. 选择合适的缓冲区大小**

```zig
// 小数据：1-4 KB
var small_buf: [1024]u8 = undefined;

// 一般用途：4-16 KB（推荐）
var medium_buf: [4096]u8 = undefined;

// 大文件/高性能：16-64 KB
var large_buf: [65536]u8 = undefined;
```

## 字符串格式化

Zig 提供了强大的字符串格式化功能，通过 `std.fmt` 模块和 `std.debug.print` 函数实现。格式化字符串使用花括号 `{}` 作为占位符，支持丰富的格式说明符。

# 基本格式说明符

Zig 的格式说明符具有**类型多态性**：同一个说明符对不同类型有不同的行为。下表按说明符分类，展示其完整用法：

| 说明符  | 整数类型         | 浮点类型           | 其他类型                               |
| ------- | ---------------- | ------------------ | -------------------------------------- |
| `{}`    | 十进制           | 十进制小数         | 类型默认格式                           |
| `{d}`   | 十进制           | 十进制小数         | 枚举（整数值）、结构体（formatNumber） |
| `{x}`   | 十六进制（小写） | 十六进制浮点       | 字节数组/切片（十六进制）              |
| `{X}`   | 十六进制（大写） | 十六进制浮点       | 字节数组/切片（十六进制）              |
| `{b}`   | 二进制           | ❌ 不支持           | 结构体（formatNumber）                 |
| `{o}`   | 八进制           | ❌ 不支持           | 结构体（formatNumber）                 |
| `{e}`   | ❌ 不支持         | 科学计数法（小写） | 结构体（formatNumber）                 |
| `{E}`   | ❌ 不支持         | 科学计数法（大写） | 结构体（formatNumber）                 |
| `{c}`   | ASCII 字符       | ❌ 不支持           | -                                      |
| `{u}`   | Unicode 码点     | ❌ 不支持           | -                                      |
| `{s}`   | ❌ 不支持         | ❌ 不支持           | 字符串/字节数组                        |
| `{*}`   | ❌ 不支持         | ❌ 不支持           | 指针地址                               |
| `{any}` | 调试格式         | 调试格式           | 调试格式（完整结构）                   |
| `{f}`   | ❌ 不支持         | ❌ 不支持           | 调用自定义 format 方法                 |

# `{f}` 说明符详解（0.15.x+ 重要变更）

从 Zig 0.15.x 开始，`{f}` 说明符用于调用类型的自定义 `format` 方法。这是一个**破坏性变更**，旧版本中 `{}` 可以调用 format 方法，现在必须使用 `{f}`。

**为什么需要 `{f}`？**

在旧版本中，`{}` 对某些类型会产生歧义：
- 是打印类型的默认格式？
- 还是调用类型的 `format` 方法？

`{f}` 明确指定要调用自定义格式化方法，消除了这种歧义。

**使用示例：**

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

// 自定义类型，实现 format 方法
const Point = struct {
    x: f32,
    y: f32,
    
    // 新版本的 format 方法签名（0.15.x+）
    pub fn format(self: @This(), writer: *std.Io.Writer) std.Io.Writer.Error!void {
        try writer.print("Point({d}, {d})", .{ self.x, self.y });
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    const p = Point{ .x = 10.5, .y = 20.3 };
    
    // ❌ 错误：在 0.15.x+ 中，{} 不会调用 format 方法
    // std.debug.print("{}", .{p});  // 编译错误：ambiguous format string
    
    // ✅ 正确：使用 {f} 调用自定义 format 方法
    std.debug.print("{f}\n", .{p});  // 输出: Point(10.5, 20.3)
    
    // 使用 {any} 打印调试格式
    std.debug.print("{any}\n", .{p});  // 输出: main.Point{ .x = 10.5, .y = 20.3 }
}
```

**标准库中使用 `{f}` 的例子：**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // std.zig.fmtId 返回一个有 format 方法的类型
    const identifier = std.zig.fmtId("my-identifier");
    
    // ❌ 错误：ambiguous format string
    // std.debug.print("{}", .{identifier});
    
    // ✅ 正确：使用 {f}
    std.debug.print("{f}\n", .{identifier});  // 输出: my-identifier
}
```

**迁移指南：**

如果你在旧版本代码中使用了自定义 `format` 方法：

```zig
// 旧版本（0.14.x 及之前）
pub fn format(
    self: @This(),
    comptime fmt: []const u8,
    opts: std.fmt.FormatOptions,
    writer: anytype,
) !void {
    try writer.print("...", .{});
}

// 调用方式
std.debug.print("{}", .{my_type});  // 可以工作
```

```zig
// 新版本（0.15.x+）
// ✨ 新特性：std.Io 统一接口
pub fn format(
    self: @This(),
    writer: *std.Io.Writer,
) std.Io.Writer.Error!void {
    try writer.print("...", .{});
}

// 调用方式
std.debug.print("{f}", .{my_type});  // 必须使用 {f}
```

**关键变更总结：**
1. `format` 方法签名已简化，不再需要 `comptime fmt` 和 `opts` 参数
2. 调用自定义 `format` 方法必须使用 `{f}` 说明符
3. `{}` 用于类型的默认格式，`{any}` 用于调试格式

**详细用法示例：**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // ===== 整数格式化 =====
    const int_val: u8 = 255;
    std.debug.print("十进制: {d}\n", .{int_val});
    std.debug.print("十六进制(小写): {x}\n", .{int_val});
    std.debug.print("十六进制(大写): {X}\n", .{int_val});
    std.debug.print("二进制: {b}\n", .{int_val});
    std.debug.print("八进制: {o}\n", .{int_val});
    
    // ===== 浮点数格式化 =====
    const float_val: f64 = 1234.567;
    std.debug.print("十进制浮点: {d}\n", .{float_val});
    std.debug.print("科学计数法(小写): {e}\n", .{float_val});
    std.debug.print("科学计数法(大写): {E}\n", .{float_val});
    std.debug.print("十六进制浮点: {x}\n", .{float_val});
    
    // 浮点数精度控制
    const pi: f64 = 3.14159265359;
    std.debug.print("默认精度: {d}\n", .{pi});
    std.debug.print("2位小数: {d:.2}\n", .{pi});
    std.debug.print("科学计数法2位: {e:.2}\n", .{pi});
    
    // ===== 字符和字符串 =====
    const char: u8 = 'A';
    std.debug.print("ASCII字符: {c}\n", .{char});
    
    const unicode = '💯';
    std.debug.print("Unicode: {u}\n", .{unicode});
    
    const str = "hello";
    std.debug.print("字符串: {s}\n", .{str});
    
    // ===== 指针 =====
    var value: i32 = 42;
    std.debug.print("指针地址: {*}\n", .{&value});
    
    // ===== 字节数组十六进制 =====
    const bytes = [_]u8{ 0xDE, 0xAD, 0xBE, 0xEF };
    std.debug.print("字节(小写): {x}\n", .{bytes});
    std.debug.print("字节(大写): {X}\n", .{bytes});
    
    // ===== 调试格式 =====
    const tuple = .{ 1, "hello", true };
    std.debug.print("调试格式: {any}\n", .{tuple});
}
```

**输出：**
```
十进制: 255
十六进制(小写): ff
十六进制(大写): FF
二进制: 11111111
八进制: 377
十进制浮点: 1234.567
科学计数法(小写): 1.234567e+03
科学计数法(大写): 1.234567E+03
十六进制浮点: 0x1.34a4bc6a7ef9dp+10
默认精度: 3.14159265359
2位小数: 3.14
科学计数法2位: 3.14e+00
ASCII字符: A
Unicode: 💯
字符串: hello
指针地址: i32@0x7ffd...
字节(小写): deadbeef
字节(大写): DEADBEEF
调试格式: { 1, "hello", true }
```

# 浮点数格式化详解

Zig 提供了多种浮点数格式化方式，每种适用于不同的场景：

**1. 十进制格式 `{d}`**

最常用的浮点数格式，支持精度控制：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const pi: f64 = 3.141592653589793;
    
    std.debug.print("默认精度: {d}\n", .{pi});
    std.debug.print("2位小数: {d:.2}\n", .{pi});
    std.debug.print("6位小数: {d:.6}\n", .{pi});
    std.debug.print("宽度10精度4: {d:10.4}\n", .{pi});
    
    const small: f64 = 0.00000123456;
    std.debug.print("小数: {d}\n", .{small});
    std.debug.print("小数8位: {d:.8}\n", .{small});
}
```

**2. 科学计数法 `{e}` / `{E}`**

适用于非常大或非常小的数值：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const large: f64 = 123456789.0;
    const tiny: f64 = 0.00000012345;
    
    std.debug.print("大数科学计数: {e}\n", .{large});
    std.debug.print("大数科学计数(大写): {E}\n", .{large});
    std.debug.print("小数科学计数: {e}\n", .{tiny});
    std.debug.print("科学计数2位: {e:.2}\n", .{large});
}
```

**输出：**
```
大数科学计数: 1.23456789e+08
大数科学计数(大写): 1.23456789E+08
小数科学计数: 1.2345e-07
科学计数2位: 1.23e+08
```

**3. 十六进制浮点 `{x}` / `{X}`**

用于精确表示浮点数的二进制结构，常用于调试：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const val: f64 = 3.14159;
    std.debug.print("十六进制浮点: {x}\n", .{val});
    std.debug.print("十六进制浮点(大写): {X}\n", .{val});
    
    const inf = std.math.inf(f64);
    const nan = std.math.nan(f64);
    std.debug.print("无穷大: {x}\n", .{inf});
    std.debug.print("NaN: {x}\n", .{nan});
}
```

**4. 特殊浮点值处理**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const inf = std.math.inf(f64);
    const neg_inf = -std.math.inf(f64);
    const nan = std.math.nan(f64);
    
    std.debug.print("无穷大: {d}\n", .{inf});
    std.debug.print("负无穷: {d}\n", .{neg_inf});
    std.debug.print("NaN: {d}\n", .{nan});
}
```

**输出：**
```
无穷大: inf
负无穷: -inf
NaN: nan
```

**5. 不同浮点类型**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const f16_val: f16 = 3.14;
    const f32_val: f32 = 3.14159;
    const f64_val: f64 = 3.141592653589793;
    const f128_val: f128 = 3.14159265358979323846;
    
    std.debug.print("f16: {d}\n", .{f16_val});
    std.debug.print("f32: {d}\n", .{f32_val});
    std.debug.print("f64: {d}\n", .{f64_val});
    std.debug.print("f128: {d}\n", .{f128_val});
}
```

# 整数格式化详解

**1. 进制转换**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const num: u32 = 255;
    
    std.debug.print("十进制: {d}\n", .{num});
    std.debug.print("十六进制(小写): {x}\n", .{num});
    std.debug.print("十六进制(大写): {X}\n", .{num});
    std.debug.print("二进制: {b}\n", .{num});
    std.debug.print("八进制: {o}\n", .{num});
    
    const neg: i32 = -42;
    std.debug.print("负数十进制: {d}\n", .{neg});
    std.debug.print("负数十六进制: {x}\n", .{neg});
}
```

**2. 宽度和填充**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const num: i32 = 42;
    
    std.debug.print("宽度8: {d:8}\n", .{num});
    std.debug.print("补0宽度8: {d:08}\n", .{num});
    std.debug.print("十六进制宽度8: {x:8}\n", .{num});
    std.debug.print("十六进制补0: {x:08}\n", .{num});
    
    const hex: u32 = 0xABCD;
    std.debug.print("十六进制对齐: 0x{X:08}\n", .{hex});
}
```

# 精度和宽度控制

格式说明符支持精度和宽度控制，语法为 `{[宽度].[精度][类型]}`：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const pi: f64 = 3.14159265359;
    
    std.debug.print("默认: {}\n", .{pi});
    std.debug.print("2位小数: {d:.2}\n", .{pi});
    std.debug.print("4位小数: {d:.4}\n", .{pi});
    
    const num: i32 = 42;
    std.debug.print("宽度5: {d:5}\n", .{num});
    std.debug.print("宽度5补0: {d:0>5}\n", .{num});
    std.debug.print("左对齐宽度5: {d:<5}end\n", .{num});
    std.debug.print("右对齐宽度5: {d:>5}end\n", .{num});
    
    std.debug.print("宽度8精度2: {d:8.2}\n", .{pi});
}
```

**输出：**
```
默认: 3.14159265359
2位小数: 3.14
4位小数: 3.1416
宽度5:    42
宽度5补0: 00042
左对齐宽度5: 42   end
右对齐宽度5:    42end
宽度8精度2:     3.14
```

# 对齐和填充选项

| 选项 | 含义              | 示例      |
| ---- | ----------------- | --------- |
| `<`  | 左对齐            | `{d:<10}` |
| `>`  | 右对齐（默认）    | `{d:>10}` |
| `^`  | 居中对齐          | `{d:^10}` |
| `0>` | 用 0 填充（左侧） | `{d:0>5}` |

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const text = "Zig";
    
    std.debug.print("左对齐: '{s:<10}'\n", .{text});
    std.debug.print("右对齐: '{s:>10}'\n", .{text});
    std.debug.print("居中: '{s:^10}'\n", .{text});
    std.debug.print("填充字符: '{s:*^10}'\n", .{text});
}
```

# 空格式说明符 `{}` 的行为

当使用空的格式说明符 `{}` 时，Zig 会根据参数类型自动选择合适的格式：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("布尔值: {}\n", .{true});
    std.debug.print("整数: {}\n", .{42});
    std.debug.print("浮点数: {}\n", .{3.14});
    std.debug.print("可选值: {}\n", .{@as(?i32, 100)});
    std.debug.print("空值: {}\n", .{@as(?i32, null)});
    std.debug.print("错误: {}\n", .{error.FileNotFound});
}
```

**重要说明**：
- `{}` 对于字符串指针会打印地址而非内容，应使用 `{s}` 打印字符串
- `{}` 对于数组会打印其调试表示，通常应使用 `{s}` 或 `{any}`

# `{any}` 与 `{}` 的区别

| 说明符  | 用途         | 适用场景                     |
| ------- | ------------ | ---------------------------- |
| `{}`    | 类型默认格式 | 简单类型的快速输出           |
| `{any}` | 调试格式     | 复合类型、调试时查看完整结构 |

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const arr = [_]i32{ 1, 2, 3 };
    const slice: []const i32 = &arr;
    
    std.debug.print("数组默认: {}\n", .{arr});
    std.debug.print("数组any: {any}\n", .{arr});
    std.debug.print("切片any: {any}\n", .{slice});
    
    const Point = struct {
        x: i32,
        y: i32,
    };
    const p = Point{ .x = 10, .y = 20 };
    std.debug.print("结构体any: {any}\n", .{p});
}
```

# 格式化到缓冲区

使用 `std.fmt.bufPrint` 将格式化结果写入缓冲区：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var buf: [100]u8 = undefined;
    
    const result = try std.fmt.bufPrint(&buf, "值: {d}, 字符串: {s}", .{ 42, "hello" });
    
    std.debug.print("格式化结果: {s}\n", .{result});
    std.debug.print("长度: {}\n", .{result.len});
}
```

# 编译期格式检查

Zig 在编译期检查格式字符串，确保参数数量和类型匹配：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const name = "Zig";
    const version = 0.16;
    
    std.debug.print("{s} 版本: {d:.2}\n", .{ name, version });
    
    // 编译错误：参数数量不匹配
    // std.debug.print("{} {}\n", .{42});
    // error: unused argument in '{} {}'
    
    // 编译错误：参数过多
    // std.debug.print("{}\n", .{ 1, 2 });
    // error: unused argument in '{}'
}
```

# 转义花括号

当需要在输出中显示花括号时，使用双花括号转义：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("使用 {{}} 作为占位符\n", .{});
    std.debug.print("JSON 示例: {{\"name\": \"{s}\"}}\n", .{"Zig"});
}
```

**输出：**
```
使用 {} 作为占位符
JSON 示例: {"name": "Zig"}
```

# 自定义类型格式化

通过实现 `format` 方法，可以为自定义类型定义格式化行为：

```zig
const std = @import("std");

const Point = struct {
    x: f32,
    y: f32,
    
    pub fn format(
        self: Point,
        comptime fmt: []const u8,
        options: std.fmt.FormatOptions,
        writer: anytype,
    ) !void {
        _ = fmt;
        _ = options;
        try writer.print("Point({d:.2}, {d:.2})", .{ self.x, self.y });
    }
};

pub fn main(init: std.process.Init.Minimal) !void {
    const p = Point{ .x = 3.14159, .y = 2.71828 };
    std.debug.print("坐标: {}\n", .{p});
}
```

## 字符串处理

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 字符串字面量
    const str = "Hello, Zig!";
    std.debug.print("字符串：{s}\n", .{str});
    std.debug.print("长度：{}\n", .{str.len});
    
    // 字符串比较
    const str1 = "hello";
    const str2 = "world";
    const cmp = std.mem.order(u8, str1, str2);
    std.debug.print("比较结果：{}\n", .{cmp});
    
    // 字符串查找
    const text = "The quick brown fox";
    if (std.mem.indexOf(u8, text, "quick")) |index| {
        std.debug.print("'quick'在位置：{}\n", .{index});
    }
    
    // 字符串分割
    var iter = std.mem.split(u8, "a,b,c", ",");
    while (iter.next()) |part| {
        std.debug.print("部分：{s}\n", .{part});
    }
    
    // 字符串转数字
    const num = try std.fmt.parseInt(i32, "12345", 10);
    std.debug.print("数字：{}\n", .{num});
    
    // 数字转字符串
    var buf: [20]u8 = undefined;
    const str_num = try std.fmt.bufPrint(&buf, "{}", .{42});
    std.debug.print("字符串数字：{s}\n", .{str_num});
}
```

## 动态数组

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 创建动态数组
    var list = std.ArrayList(i32).init(allocator);
    defer list.deinit();
    
    // 添加元素
    try list.append(1);
    try list.append(2);
    try list.append(3);
    
    // 批量添加
    try list.appendSlice(&[_]i32{ 4, 5, 6 });
    
    // 访问元素
    std.debug.print("第一个元素：{}\n", .{list.items[0]});
    std.debug.print("长度：{}\n", .{list.items.len});
    
    // 遍历
    for (list.items) |item| {
        std.debug.print("元素：{}\n", .{item});
    }
    
    // 删除元素
    _ = list.orderedRemove(0);
    std.debug.print("删除后长度：{}\n", .{list.items.len});
}
```

## 哈希表

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 字符串到整数的哈希表
    var map = std.StringHashMap(i32).init(allocator);
    defer map.deinit();
    
    // 插入键值对
    try map.put("one", 1);
    try map.put("two", 2);
    try map.put("three", 3);
    
    // 查找
    if (map.get("two")) |value| {
        std.debug.print("'two' = {}\n", .{value});
    }
    
    // 检查是否存在
    if (map.contains("four")) {
        std.debug.print("'four'存在\n", .{});
    } else {
        std.debug.print("'four'不存在\n", .{});
    }
    
    // 遍历
    var iter = map.iterator();
    while (iter.next()) |entry| {
        std.debug.print("{s} = {}\n", .{ entry.key_ptr.*, entry.value_ptr.* });
    }
}
```

## 测试框架

Zig 内置了强大的测试框架，使用 `zig test` 命令运行测试：

**基本测试：**

```zig
const std = @import("std");

fn add(a: i32, b: i32) i32 {
    return a + b;
}

test "基本加法测试" {
    try std.testing.expect(add(2, 3) == 5);
    try std.testing.expect(add(-1, 1) == 0);
    try std.testing.expect(add(0, 0) == 0);
}

test "边界条件" {
    try std.testing.expect(add(std.math.maxInt(i32), 0) == std.math.maxInt(i32));
    try std.testing.expect(add(std.math.minInt(i32), 0) == std.math.minInt(i32));
}
```

**测试错误返回：**

```zig
const std = @import("std");

fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivideByZero;
    return @divTrunc(a, b);
}

test "除法测试" {
    const result = try divide(10, 2);
    try std.testing.expect(result == 5);
}

test "除以零返回错误" {
    try std.testing.expectError(error.DivideByZero, divide(10, 0));
}
```

**表格驱动测试：**

```zig
const std = @import("std");

fn fibonacci(n: u32) u32 {
    if (n < 2) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

test "fibonacci table driven" {
    const cases = [_]struct { input: u32, expected: u32 }{
        .{ .input = 0, .expected = 0 },
        .{ .input = 1, .expected = 1 },
        .{ .input = 2, .expected = 1 },
        .{ .input = 3, .expected = 2 },
        .{ .input = 10, .expected = 55 },
    };

    for (cases) |c| {
        try std.testing.expectEqual(c.expected, fibonacci(c.input));
    }
}
```

**运行测试：**
```bash
# 运行所有测试
zig test src/main.zig

# 运行指定测试
zig test src/main.zig --test-filter "fibonacci"
```

---

# 章节练习题

# 基础题

**题目1**：使用 `std.mem` 模块实现字符串反转。

**要求**：
- 函数签名为 `fn reverseString(allocator: std.mem.Allocator, str: []const u8) ![]u8`
- 使用 `std.mem.Allocator` 分配内存
- 返回反转后的字符串

**参考答案**：
```zig
const std = @import("std");

fn reverseString(allocator: std.mem.Allocator, str: []const u8) ![]u8 {
    const result = try allocator.alloc(u8, str.len);
    errdefer allocator.free(result);
    
    for (str, 0..) |char, i| {
        result[str.len - 1 - i] = char;
    }
    
    return result;
}

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    const reversed = try reverseString(allocator, "Hello, Zig!");
    defer allocator.free(reversed);
    
    std.debug.print("反转后：{s}\n", .{reversed});
}
```

**题目2**：使用 `std.ArrayList` 实现动态数组操作。

**要求**：
- 创建一个 `ArrayList(i32)`
- 添加元素 1-10
- 删除所有偶数
- 输出最终结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var list = std.ArrayList(i32).init(allocator);
    defer list.deinit();
    
    var i: i32 = 1;
    while (i <= 10) : (i += 1) {
        try list.append(i);
    }
    
    var j: usize = 0;
    while (j < list.items.len) {
        if (list.items[j] % 2 == 0) {
            _ = list.orderedRemove(j);
        } else {
            j += 1;
        }
    }
    
    std.debug.print("结果：{any}\n", .{list.items});
}
```

**题目3**：使用 `std.HashMap` 实现单词计数器。

**要求**：
- 统计字符串中每个单词出现的次数
- 使用 `std.StringHashMap`
- 输出统计结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var map = std.StringHashMap(u32).init(allocator);
    defer map.deinit();
    
    const text = "hello world hello zig world world";
    var iter = std.mem.split(u8, text, " ");
    
    while (iter.next()) |word| {
        const entry = try map.getOrPut(word);
        if (entry.found_existing) {
            entry.value_ptr.* += 1;
        } else {
            entry.value_ptr.* = 1;
        }
    }
    
    var map_iter = map.iterator();
    while (map_iter.next()) |entry| {
        std.debug.print("{s}: {}\n", .{ entry.key_ptr.*, entry.value_ptr.* });
    }
}
```

# 进阶题

**题目1**：使用 `std.fs` 模块读取文件内容。

**要求**：
- 打开文件并读取内容
- 处理可能的错误
- 使用 `defer` 确保资源释放

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    const file = try std.fs.cwd().openFile("test.txt", .{});
    defer file.close();
    
    var buffer: [1024]u8 = undefined;
    const bytes_read = try file.read(&buffer);
    const content = buffer[0..bytes_read];
    
    std.debug.print("文件内容：{s}\n", .{content});
}
```

**题目2**：使用 `std.json` 模块解析 JSON 数据。

**要求**：
- 解析 JSON 字符串
- 提取字段值
- 处理解析错误

**参考答案**：
```zig
const std = @import("std");

const Person = struct {
    name: []const u8,
    age: u32,
};

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    const json_str = "{\"name\":\"Alice\",\"age\":30}";
    const parsed = try std.json.parseFromSlice(
        Person,
        allocator,
        json_str,
        .{},
    );
    defer parsed.deinit();
    
    const person = parsed.value;
    std.debug.print("姓名：{s}, 年龄：{}\n", .{ person.name, person.age });
}
```

# 挑战题

**题目**：实现一个简单的命令行参数解析器，使用 `std.process` 模块。

**要求**：
- 解析命令行参数
- 支持选项和参数
- 输出解析结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);
    
    std.debug.print("参数数量：{}\n", .{args.len});
    
    for (args, 0..) |arg, i| {
        std.debug.print("参数[{}]：{s}\n", .{ i, arg });
    }
}
```

## 文件系统操作

> 📖 **本节内容来源**：整合自 Pedro Park 的 Zig Book

# 文件系统操作概述

Zig 标准库提供了丰富的文件系统操作 API，位于 `std.fs` 模块。这些 API 提供了跨平台的文件和目录操作功能。

**主要功能**：
- 文件的创建、打开、读取、写入、删除
- 目录的创建、遍历、删除
- 文件元数据查询（大小、权限、修改时间等）
- 路径操作和文件系统遍历

### 文件创建和打开

**创建文件**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // 创建文件（如果存在则截断）
    const file = try std.fs.cwd().createFile(
        "hello.txt",
        .{
            .read = true,  // 同时打开读取权限
            .truncate = true,  // 如果文件存在，截断为空
        },
    );
    defer file.close();
    
    // 写入数据
    try file.writeStreamingAll(init.io, "Hello, World!\n");
}
```

**打开文件**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // 打开现有文件
    const file = try std.fs.cwd().openFile("hello.txt", .{
        .mode = .read_write,  // 读写模式
    });
    defer file.close();
    
    // 读取数据
    var buf: [100]u8 = undefined;
    const bytes_read = try file.read(init.io, &buf);
    const content = buf[0..bytes_read];
    
    std.debug.print("读取到：{s}\n", .{content});
}
```

**文件打开模式**：

| 模式          | 说明     |
| ------------- | -------- |
| `.read_only`  | 只读模式 |
| `.write_only` | 只写模式 |
| `.read_write` | 读写模式 |

### 文件读取和写入

**写入文件（便捷方法）**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const file = try std.fs.cwd().createFile("output.txt", .{});
    defer file.close();
    
    // 一次性写入
    try file.writeStreamingAll(init.io, "第一行\n");
    try file.writeStreamingAll(init.io, "第二行\n");
}
```

**写入文件（缓冲方法，推荐）**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const file = try std.fs.cwd().createFile("output.txt", .{});
    defer file.close();
    
    // 创建缓冲 Writer
    var buf: [4096]u8 = undefined;
    var file_writer = file.writer(init.io, &buf);
    const writer = &file_writer.interface;
    
    // 多次写入（缓冲）
    try writer.print("第一行：{}\n", .{1});
    try writer.print("第二行：{}\n", .{2});
    try writer.print("第三行：{s}\n", .{"hello"});
    
    // 必须刷新
    try writer.flush();
}
```

**读取文件（便捷方法）**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const file = try std.fs.cwd().openFile("input.txt", .{});
    defer file.close();
    
    // 读取所有内容
    var buf: [4096]u8 = undefined;
    const bytes_read = try file.read(init.io, &buf);
    const content = buf[0..bytes_read];
    
    std.debug.print("内容：{s}\n", .{content});
}
```

**读取文件（缓冲方法，推荐）**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const file = try std.fs.cwd().openFile("input.txt", .{});
    defer file.close();
    
    // 创建缓冲 Reader
    var buf: [4096]u8 = undefined;
    var file_reader = file.reader(init.io, &buf);
    const reader = &file_reader.interface;
    
    // 逐行读取
    var line_count: usize = 0;
    while (try reader.takeDelimiter('\n')) |line| {
        line_count += 1;
        std.debug.print("行 {}: {s}\n", .{ line_count, line });
    }
    
    std.debug.print("总共 {} 行\n", .{line_count});
}
```

**读取二进制文件**：

```zig
const std = @import("std");

const Header = extern struct {
    magic: u32,
    version: u32,
    count: u32,
};

pub fn main(init: std.process.Init) !void {
    const file = try std.fs.cwd().openFile("data.bin", .{});
    defer file.close();
    
    var buf: [4096]u8 = undefined;
    var file_reader = file.reader(init.io, &buf);
    const reader = &file_reader.interface;
    
    // 读取结构体
    const header = try reader.takeStruct(Header, .little);
    
    std.debug.print("Magic: {x}, Version: {}, Count: {}\n", .{
        header.magic,
        header.version,
        header.count,
    });
    
    // 读取整数数组
    var i: usize = 0;
    while (i < header.count) : (i += 1) {
        const value = try reader.takeInt(u32, .little);
        std.debug.print("值[{}]: {}\n", .{ i, value });
    }
}
```

### 目录操作

**创建目录**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 创建目录
    try std.fs.cwd().makeDir("mydir");
    
    // 创建嵌套目录
    try std.fs.cwd().makePath("path/to/nested/dirs");
    
    std.debug.print("目录创建成功\n", .{});
}
```

**打开目录**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 打开目录
    var dir = try std.fs.cwd().openDir("mydir", .{
        .iterate = true,  // 允许遍历
    });
    defer dir.close();
    
    // 遍历目录
    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        std.debug.print("名称: {s}, 类型: {}\n", .{
            entry.name,
            entry.kind,
        });
    }
}
```

**目录条目类型**：

| 类型                  | 说明          |
| --------------------- | ------------- |
| `.file`               | 普通文件      |
| `.directory`          | 目录          |
| `.sym_link`           | 符号链接      |
| `.block_device`       | 块设备        |
| `.character_device`   | 字符设备      |
| `.named_pipe`         | 命名管道      |
| `.unix_domain_socket` | Unix 域套接字 |
| `.unknown`            | 未知类型      |

**删除文件和目录**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 删除文件
    try std.fs.cwd().deleteFile("hello.txt");
    
    // 删除空目录
    try std.fs.cwd().deleteDir("mydir");
    
    // 删除目录及其内容
    try std.fs.cwd().deleteTree("path/to/directory");
    
    std.debug.print("删除成功\n", .{});
}
```

**递归遍历目录**：

```zig
const std = @import("std");

fn listFiles(dir: std.fs.Dir, path: []const u8, allocator: std.mem.Allocator) !void {
    var iter = dir.iterate();
    
    while (try iter.next()) |entry| {
        // 构建完整路径
        const full_path = try std.fs.path.join(allocator, &.{ path, entry.name });
        defer allocator.free(full_path);
        
        switch (entry.kind) {
            .file => {
                std.debug.print("文件: {s}\n", .{full_path});
            },
            .directory => {
                std.debug.print("目录: {s}\n", .{full_path});
                
                // 递归进入子目录
                var subdir = try dir.openDir(entry.name, .{ .iterate = true });
                defer subdir.close();
                
                try listFiles(subdir, full_path, allocator);
            },
            else => {
                std.debug.print("其他: {s}\n", .{full_path});
            },
        }
    }
}

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var dir = try std.fs.cwd().openDir(".", .{ .iterate = true });
    defer dir.close();
    
    try listFiles(dir, ".", allocator);
}
```

### 文件元数据

**获取文件信息**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    const file = try std.fs.cwd().openFile("hello.txt", .{});
    defer file.close();
    
    // 获取文件状态
    const stat = try file.stat();
    
    std.debug.print("文件大小: {} 字节\n", .{stat.size});
    std.debug.print("权限: {o}\n", .{stat.mode});
    std.debug.print("修改时间: {}\n", .{stat.mtime});
    std.debug.print("类型: {}\n", .{stat.kind});
}
```

**文件类型判断**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    const stat = try std.fs.cwd().statFile("hello.txt");
    
    switch (stat.kind) {
        .file => std.debug.print("这是一个普通文件\n", .{}),
        .directory => std.debug.print("这是一个目录\n", .{}),
        .sym_link => std.debug.print("这是一个符号链接\n", .{}),
        else => std.debug.print("这是其他类型的文件\n", .{}),
    }
}
```

**检查文件是否存在**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 方法1：使用 access
    const exists = std.fs.cwd().access("hello.txt", .{}) catch false;
    std.debug.print("文件存在: {}\n", .{exists});
    
    // 方法2：使用 statFile
    const stat = std.fs.cwd().statFile("hello.txt") catch |err| {
        if (err == error.FileNotFound) {
            std.debug.print("文件不存在\n", .{});
            return;
        }
        return err;
    };
    
    std.debug.print("文件大小: {}\n", .{stat.size});
}
```

**修改文件权限**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 设置文件权限（Unix 系统）
    // 0o644 = rw-r--r--
    try std.fs.cwd().chmod("hello.txt", 0o644);
    
    std.debug.print("权限修改成功\n", .{});
}
```

## 跨平台文件操作

> 📖 **本节内容来源**：整合自 Pedro Park 的 Zig Book

### 路径处理

Zig 提供了跨平台的路径处理 API，位于 `std.fs.path` 模块。

**路径分隔符**：

不同操作系统使用不同的路径分隔符：
- Windows: `\` (反斜杠)
- Unix/Linux/macOS: `/` (斜杠)

Zig 自动处理这些差异。

**路径拼接**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 跨平台路径拼接
    const path1 = try std.fs.path.join(allocator, &.{ "home", "user", "documents" });
    defer allocator.free(path1);
    
    // Windows: "home\user\documents"
    // Unix: "home/user/documents"
    std.debug.print("路径: {s}\n", .{path1});
    
    // 拼接绝对路径
    const path2 = try std.fs.path.join(allocator, &.{ "/usr", "local", "bin" });
    defer allocator.free(path2);
    
    std.debug.print("绝对路径: {s}\n", .{path2});
}
```

**路径分解**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    const path = "/home/user/documents/file.txt";
    
    // 获取目录名
    const dirname = std.fs.path.dirname(path); // "/home/user/documents"
    
    // 获取文件名
    const basename = std.fs.path.basename(path); // "file.txt"
    
    // 获取文件扩展名
    const ext = std.fs.path.extension(path); // ".txt"
    
    // 获取文件名（不含扩展名）
    const stem = std.fs.path.stem(path); // "file"
    
    std.debug.print("目录: {s}\n", .{dirname});
    std.debug.print("文件名: {s}\n", .{basename});
    std.debug.print("扩展名: {s}\n", .{ext});
    std.debug.print("主文件名: {s}\n", .{stem});
}
```

**路径规范化**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 规范化路径（处理 . 和 ..）
    const path = try std.fs.path.resolve(allocator, &.{
        "/home/user",
        "../other",
        "./documents",
    });
    defer allocator.free(path);
    
    // 结果: "/home/other/documents"
    std.debug.print("规范化路径: {s}\n", .{path});
}
```

**相对路径计算**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 计算相对路径
    const from = "/home/user/documents";
    const to = "/home/user/downloads/file.txt";
    
    const relative = try std.fs.path.relative(allocator, from, to);
    defer allocator.free(relative);
    
    // 结果: "../downloads/file.txt"
    std.debug.print("相对路径: {s}\n", .{relative});
}
```

### 权限管理

**文件权限常量**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // Unix 权限常量
    const mode = 0o644; // rw-r--r--
    
    // 权限解释：
    // 6 (110) = rw- (所有者：读写)
    // 4 (100) = r-- (组：只读)
    // 4 (100) = r-- (其他：只读)
    
    std.debug.print("权限: {o}\n", .{mode});
}
```

**常见权限组合**：

| 权限        | 八进制 | 说明                             |
| ----------- | ------ | -------------------------------- |
| `rw-r--r--` | 0o644  | 普通文件（所有者读写，其他只读） |
| `rwxr-xr-x` | 0o755  | 可执行文件                       |
| `rw-rw-r--` | 0o664  | 共享文件                         |
| `rw-------` | 0o600  | 私密文件（仅所有者可读写）       |
| `rwx------` | 0o700  | 私密目录                         |

**跨平台权限设置**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 创建文件时设置权限
    const file = try std.fs.cwd().createFile("script.sh", .{
        .mode = 0o755, // 可执行权限
    });
    defer file.close();
    
    try file.writeStreamingAll(std.io.getStdOut().writer().context, "#!/bin/sh\necho Hello\n");
    
    // 修改现有文件权限
    try std.fs.cwd().chmod("script.sh", 0o755);
    
    std.debug.print("权限设置成功\n", .{});
}
```

**Windows 平台注意事项**：

Windows 使用不同的权限模型，Zig 会自动处理：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // Windows 上，chmod 会转换为相应的文件属性
    // Unix 上，chmod 直接设置权限位
    
    // 在所有平台上都可以安全使用
    try std.fs.cwd().chmod("file.txt", 0o644);
    
    std.debug.print("权限设置成功（跨平台）\n", .{});
}
```

### 文件系统遍历最佳实践

**高效遍历大目录**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var dir = try std.fs.cwd().openDir(".", .{ .iterate = true });
    defer dir.close();
    
    var iter = dir.iterate();
    var file_count: usize = 0;
    var total_size: u64 = 0;
    
    // 使用 Walker 进行深度遍历
    var walker = try std.fs.walkPath(allocator, ".");
    defer walker.deinit();
    
    while (try walker.next()) |entry| {
        if (entry.kind == .file) {
            file_count += 1;
            
            // 获取文件大小
            const file = entry.dir.openFile(entry.basename, .{}) catch continue;
            defer file.close();
            
            const stat = file.stat() catch continue;
            total_size += stat.size;
        }
    }
    
    std.debug.print("文件数: {}\n", .{file_count});
    std.debug.print("总大小: {} 字节\n", .{total_size});
}
```

**错误处理最佳实践**：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 使用 errdefer 确保资源释放
    const file = std.fs.cwd().openFile("maybe_missing.txt", .{}) catch |err| {
        if (err == error.FileNotFound) {
            std.debug.print("文件不存在，跳过\n", .{});
            return;
        }
        return err;
    };
    defer file.close();
    
    // 处理文件...
    var buf: [4096]u8 = undefined;
    const bytes = file.read(std.io.getStdOut().writer().context, &buf) catch |err| {
        std.debug.print("读取失败: {}\n", .{err});
        return;
    };
    
    std.debug.print("读取到 {} 字节\n", .{bytes});
}
```

# 文件系统操作速查表

| 操作         | API              | 示例                                       |
| ------------ | ---------------- | ------------------------------------------ |
| 创建文件     | `createFile()`   | `try cwd.createFile("file.txt", .{})`      |
| 打开文件     | `openFile()`     | `try cwd.openFile("file.txt", .{})`        |
| 删除文件     | `deleteFile()`   | `try cwd.deleteFile("file.txt")`           |
| 创建目录     | `makeDir()`      | `try cwd.makeDir("mydir")`                 |
| 删除目录     | `deleteDir()`    | `try cwd.deleteDir("mydir")`               |
| 遍历目录     | `iterate()`      | `var iter = dir.iterate()`                 |
| 获取文件信息 | `stat()`         | `const stat = try file.stat()`             |
| 路径拼接     | `path.join()`    | `try path.join(alloc, &.{"a", "b"})`       |
| 路径规范化   | `path.resolve()` | `try path.resolve(alloc, &.{".", "file"})` |

---

## 第二部分：高级特性

> 💡 **学习建议**：在进入高级特性之前，请确保你已经掌握了：
> - 基本语法和数据类型（第3章）
> - 控制流和函数（第4-5章）
> - 错误处理机制（第6章）
> - 构建系统（第7章）
> - 标准库基础（第8章）
>
> 高级特性需要扎实的基础，建议按顺序学习。
