# 【draft】异步编程（未来规划）

> ⚠️ **重要说明：Zig 当前不支持异步编程**
>
> **关键事实**：
> - `async`/`await` 关键字在 **0.11.0 版本已完全移除**
> - 异步 I/O 功能**尚未实现**，仍在规划中
> - 当前推荐使用**线程**进行并发编程
> - `std.Io` 接口是统一的 I/O 抽象，为未来的异步 I/O 设计奠定基础
>
> **历史背景**：Zig 曾尝试将异步作为语言核心特性，但在实践中发现设计存在问题，因此在 0.11.0 版本移除。异步 I/O 支持计划在未来版本重新引入，但具体时间表未定。
>
> **新设计理念**：根据 Zig 2026 路线图，新的异步 I/O 设计将采用 `std.Io` 接口模式，由调用者提供 I/O 实现（类似 Allocator 模式），实现"异步不等于并发"的设计哲学。这意味着库作者可以使用 `io.async` 而不强制用户使用事件循环。
>
> **章节定位**：本章是实战案例部分，侧重于异步 I/O 的实践应用和高级场景。关于并发编程的理论基础和线程模型，请参见高级部分的[并发编程概述](../part2-advanced/chapter-concurrency.md)章节。

## Zig 异步编程的现状

# 为什么移除 async/await？

Zig 团队移除 `async`/`await` 关键字的原因：

1. **设计问题**：原有的 async/await 设计在类型系统和错误处理方面存在根本性问题
2. **实现复杂度**：异步运行时的实现比预期复杂得多
3. **更好的方案**：团队正在探索更符合 Zig 哲学的异步解决方案

# 当前推荐的并发方案

在异步功能重新引入之前，推荐使用以下方案：

| 场景           | 推荐方案                | 说明                 |
| -------------- | ----------------------- | -------------------- |
| CPU 密集型任务 | `std.Thread`            | 使用操作系统线程     |
| I/O 密集型任务 | `std.Thread` + 阻塞 I/O | 每个连接一个线程     |
| 高并发服务器   | 第三方库（如 zap）      | 使用事件循环或线程池 |
| 未来异步 I/O   | 等待官方实现            | 关注官方路线图       |

## 使用线程进行并发编程

# 基本线程使用

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 创建线程
    const thread = try std.Thread.spawn(.{}, worker, .{});
    
    // 等待线程完成
    thread.join();
    
    std.debug.print("线程完成\n", .{});
}

fn worker() void {
    for (0..5) |i| {
        std.debug.print("工作：{}\n", .{i});
        std.time.sleep(100 * std.time.ns_per_ms);
    }
}
```

# 线程池模式

对于 I/O 密集型任务，可以使用线程池：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    
    // 创建线程池（需要手动实现或使用第三方库）
    // 这里展示基本概念
    const num_threads = 4;
    var threads: [num_threads]std.Thread = undefined;
    
    for (0..num_threads) |i| {
        threads[i] = try std.Thread.spawn(.{}, handleConnection, .{i});
    }
    
    for (threads) |thread| {
        thread.join();
    }
}

fn handleConnection(id: usize) void {
    std.debug.print("线程 {} 处理连接\n", .{id});
    // 处理 I/O 操作...
}
```

## std.Io 接口说明

> 💡 **重要概念**：`std.Io` 是 Zig 0.16 引入的**统一 I/O 接口**，采用类似 Allocator 的设计模式，为未来的异步 I/O 设计奠定基础。

# std.Io 的核心设计理念

`std.Io` 采用了一个重要的设计模式：**由调用者提供 I/O 实现**。这意味着：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    // init.io 是预配置的 Io 实例
    const io = init.io;
    
    // 所有 I/O 操作都需要 io 参数
    try std.Io.File.stdout().writeStreamingAll(io, "Hello\n");
}
```

**关键特性**：

1. **Io 接口由调用者提供**：类似 Allocator 模式，程序作者可以决定具体的 I/O 实现
2. **统一所有 I/O 操作**：文件、网络、标准输入输出都使用相同的接口
3. **支持未来异步设计**：Io 接口负责并发操作，为 `io.async` 提供基础
4. **异步不等于并发**：使用 `io.async` 不强制并发，可以在单线程阻塞模式下运行

# 异步 vs 并发 vs 并行

在理解 Zig 的 I/O 设计时，需要区分三个关键概念：

| 概念 | 定义                           | Zig 中的体现          |
| ---- | ------------------------------ | --------------------- |
| 异步 | 任务可以乱序执行且仍然正确     | `io.async` 表达异步性 |
| 并发 | 系统能够同时推进多个任务       | 事件循环、线程池      |
| 并行 | 系统在物理层面同时执行多个任务 | 多线程、多核          |

**Zig 的独特设计**：在 Zig 中，**异步不等于并发**。这意味着：

- 使用 `io.async` 的代码可以在单线程阻塞模式下运行
- 库作者可以使用 `io.async` 而不强制用户使用事件循环
- 用户可以选择阻塞 I/O 或事件循环 I/O，而不需要库提供两个版本

# 未来的 io.async 模式

根据 Zig 2026 路线图，未来的异步 I/O 将采用以下模式：

```zig
const std = @import("std");
const Io = std.Io;

// 示例：保存两个文件（顺序不重要）
fn saveData(io: Io, data: []const u8) !void {
    // 创建两个异步任务
    var a_future = io.async(saveFile, .{io, data, "saveA.txt"});
    var b_future = io.async(saveFile, .{io, data, "saveB.txt"});
    
    // 必须等待所有 Future 完成
    const a_result = a_future.await(io);
    const b_result = b_future.await(io);
    
    // 分别处理错误
    try a_result;
    try b_result;
}

fn saveFile(io: Io, data: []const u8, name: []const u8) !void {
    const file = try Io.Dir.cwd().createFile(io, name, .{});
    defer file.close(io);
    try file.writeAll(io, data);
}
```

**关键要点**：

1. `io.async` 创建异步任务，返回 Future
2. Future 必须被 `await` 或 `cancel`（资源管理）
3. 在阻塞模式下，`io.async` 会立即执行函数
4. 在事件循环模式下，`io.async` 会调度任务

**当前状态**：这些 API 仍在规划中，当前版本的 `std.Io` 主要提供统一的阻塞 I/O 接口。

## 第三方异步解决方案

在官方异步功能实现之前，可以使用第三方库：

# 使用 Zap 构建 HTTP 服务器

```zig
const std = @import("std");
const zap = @import("zap");

pub fn main(init: std.process.Init.Minimal) !void {
    var listener = zap.HttpListener.init(.{
        .port = 3000,
        .on_request = onRequest,
        .log = true,
    });
    
    try listener.listen();
    
    zap.start(.{
        .threads = 2,
        .workers = 2,
    });
}

fn onRequest(r: zap.Request) void {
    r.sendBody("Hello from Zap!\n") catch return;
}
```

## 未来展望

Zig 团队计划在未来重新引入异步 I/O 支持，可能的方案包括：

1. **基于 io_uring 的异步 I/O**（Linux）
2. **基于 GCD 的异步 I/O**（macOS）
3. **基于 IOCP 的异步 I/O**（Windows）

**关注官方进展**：
- GitHub Issue: https://github.com/ziglang/zig/issues
- 官方路线图: https://ziglang.org/learn/overview/

## 迁移指南

如果您有使用 `async`/`await` 的旧代码，需要进行以下迁移：

| 旧语法         | 新方案                         |
| -------------- | ------------------------------ |
| `async func()` | 直接调用函数或使用线程         |
| `await handle` | 使用 `thread.join()`           |
| `suspend`      | 不推荐使用（保留用于底层实现） |
| `resume`       | 不推荐使用（保留用于底层实现） |

**示例迁移**：

```zig
// 旧版本（0.10.x 及之前）
// ⏪ 旧版本：0.11.0 已移除 async/await
fn oldAsyncCode() void {
    const handle = async fetchData();
    const result = await handle;
}

// 新版本（0.11.x+）
fn newThreadCode() !void {
    const thread = try std.Thread.spawn(.{}, fetchData, .{});
    thread.join();
    // 结果通过共享内存或通道传递
}
```

> ⚠️ **重要提示**：异步编程 API 仍在规划中。建议：
> - 生产环境使用线程或第三方库
> - 关注官方更新日志获取最新进展
> - 不要依赖 `suspend`/`resume`，它们可能在未来版本中变更

---

> 💡 **章节过渡**：从异步编程到高级内存管理
> 
> 在[高级内存管理技巧](chapter-advanced-memory.md)中，我们了解了异步编程的未来规划，理解了 Zig 并发编程的发展方向。
> 现在，我们将学习高级内存管理技巧，深入理解内存优化和自定义分配器。
> 
> **为什么异步编程需要高级内存管理？**
> 
> 1. **内存效率**：异步任务需要高效的内存管理
> 2. **生命周期**：异步操作的内存生命周期更复杂
> 3. **性能优化**：自定义分配器可以针对特定场景优化
> 
> **学习建议**：
> - 回顾[内存管理模型](../part2-advanced/chapter-memory-management.md)的内存管理基础知识
> - 理解不同分配器的适用场景
> - 准备实现自定义分配器
