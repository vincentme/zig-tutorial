# 【draft】并发编程概述

> 💡 **重要章节**：并发编程是现代系统编程的核心技能，掌握它对于构建高性能、响应迅速的应用程序至关重要。
> 
> **章节定位**：本章是高级特性部分，侧重于并发编程的理论、模型和基本用法。关于异步 I/O 的实践应用，请参见实战部分的[异步IO编程](../part3-practice/chapter-async.md)章节。

## 核心概念：异步、并发与并行

> 📖 **关键区分**：在深入学习并发编程之前，必须理解三个容易混淆的概念：异步（Asynchrony）、并发（Concurrency）和并行（Parallelism）。

# 三个概念的定义

| 概念 | 定义 | 例子 |
|------|------|------|
| **异步** | 任务可以乱序执行且仍然正确 | 保存两个文件，顺序不重要 |
| **并发** | 系统能够同时推进多个任务（通过并行或任务切换） | 服务器同时处理多个客户端连接 |
| **并行** | 系统在物理层面同时执行多个任务 | 多核 CPU 同时执行多个线程 |

# 深入理解

**异步（Asynchrony）**：
- 关注的是**正确性**：任务可以乱序执行而不会出错
- 例如：保存文件 A 和文件 B，谁先谁后都可以
- 不需要任务执行时间重叠

**并发（Concurrency）**：
- 关注的是**进度**：多个任务可以同时推进
- 例如：TCP 服务器必须同时接受连接和处理请求
- 可以通过任务切换（单核）或并行（多核）实现

**并行（Parallelism）**：
- 关注的是**物理执行**：真正的同时执行
- 例如：4 核 CPU 同时运行 4 个线程
- 需要硬件支持

# Zig 的独特设计：异步不等于并发

在 Zig 中，**异步不等于并发**。这是一个重要的设计理念：

```zig
// 这段代码表达了异步性（顺序不重要）
io.async(saveFileA, .{io});
io.async(saveFileB, .{io});
```

**关键点**：
- 使用 `io.async` **不强制并发**
- 这段代码可以在**单线程阻塞模式**下运行
- 在阻塞模式下，`io.async` 会立即执行函数（相当于顺序调用）
- 在事件循环模式下，`io.async` 会调度任务（实现并发）

**实际意义**：
- 库作者可以使用 `io.async` 而不强制用户使用事件循环
- 用户可以选择阻塞 I/O 或事件循环 I/O
- 避免了库需要提供同步/异步两个版本的问题

## 线程基础理论

> 📖 **内容来源**：本节内容整合自 [Zig Book - Introducing threads and parallelism in Zig](https://pedropark99.github.io/zig-book/Chapters/14-threads.html)

# 什么是线程？

线程（Thread）本质上是一个独立的执行上下文。我们使用线程在程序中引入并行性，在大多数情况下，这会使程序运行得更快，因为我们可以同时执行多个任务，彼此并行运行。

程序默认是单线程的。这意味着每个程序通常在单个线程上运行，或者说，在单个执行上下文中运行。当我们只有一个线程运行时，就没有并行性。当没有并行性时，命令是按顺序执行的，也就是说，一次只执行一个命令，一个接一个。通过在程序中创建多个线程，我们开始同时执行多个命令。

**实际应用场景**：

创建多线程的程序在实际中非常常见。因为许多不同类型的应用程序都非常适合并行处理。很好的例子包括：

1. **视频和照片编辑应用**（如 Adobe Photoshop 或 DaVinci Resolve）
2. **游戏**（如 The Witcher 3）
3. **网页浏览器**（如 Google Chrome、Firefox、Microsoft Edge 等）

例如，在网页浏览器中，线程通常用于实现标签页。浏览器中的标签页通常作为主进程中的独立线程运行。也就是说，你在浏览器中打开的每个新标签页通常都在一个独立的执行线程上运行。

通过在每个标签页的独立线程中运行，我们允许浏览器中所有打开的标签页同时运行，并且彼此独立。例如，你可能当前在某个标签页中打开了 YouTube 或 Spotify，正在收听播客，同时又在另一个标签页中工作，在 Google Docs 上写文章。即使你没有查看 YouTube 标签页，你仍然可以听到播客，正是因为这个 YouTube 标签页与运行 Google Docs 的另一个标签页并行运行。

**为什么使用线程而不是进程？**

如果没有线程，另一个选择是将每个标签页作为计算机中完全独立的进程运行。但这将是一个糟糕的选择，因为仅仅几个标签页就会消耗计算机过多的电力和资源。换句话说，与创建新的执行线程相比，创建一个全新的进程非常昂贵。此外，你在使用浏览器时遇到延迟和开销的可能性会很大。线程创建速度更快，而且它们消耗的计算机资源也少得多，特别是因为它们与主进程共享一些资源。

因此，现代网页浏览器中线程的使用使你能够在 Google Docs 上写东西的同时听到播客。如果没有线程，网页浏览器可能仅限于一个标签页。

# 线程 vs 进程

当我们运行程序时，该程序作为操作系统中的一个进程执行。这是一对一的关系，你执行的每个程序或应用程序都是操作系统中的一个独立进程。但每个程序或每个进程可以在其中创建和包含多个线程。因此，进程和线程具有一对多的关系。

这也意味着我们创建的每个线程总是与计算机中的特定进程相关联。换句话说，线程始终是现有进程的子集（或子项）。所有线程共享与创建它们的进程相关联的一些资源。因为线程与进程共享资源，它们非常有利于使任务之间的通信更容易。

**关键区别**：

| 特性           | 进程                             | 线程                                   |
| -------------- | -------------------------------- | -------------------------------------- |
| **创建成本**   | 高（需要独立的内存空间）         | 低（共享进程资源）                     |
| **资源占用**   | 独立的内存空间、文件描述符       | 共享进程的堆、全局数据、文件描述符     |
| **通信方式**   | IPC（进程间通信）复杂            | 直接通过共享内存通信                   |
| **上下文切换** | 慢（需要切换内存映射）           | 快（只需切换栈和寄存器）               |
| **独立性**     | 高（一个进程崩溃不影响其他进程） | 低（一个线程崩溃可能导致整个进程崩溃） |
| **适用场景**   | 需要高度隔离的任务               | 需要频繁通信和共享数据的任务           |

**线程的内存模型**：

更详细地说，你创建的每个线程都有一个单独的栈帧专门为该线程保留，这本质上意味着你在这个线程内创建的每个局部对象都是该线程局部的，即其他线程无法看到这个局部对象。除非你创建的这个对象是存储在堆上的对象。换句话说，如果与该对象关联的内存位于堆上，那么其他线程可能可以访问该对象。

因此：
- **存储在栈上的对象**是创建它们的线程局部的
- **存储在堆上的对象**可能被其他线程访问
- 每个线程都有自己的独立栈帧
- 所有线程共享相同的堆、相同的标准文件描述符（意味着它们共享相同的 stdout、stdin、stderr）以及程序中相同的全局数据段

# 线程的实际应用：餐厅点餐系统

线程也非常适合任何涉及服务请求或订单的场景。因为服务请求需要时间，通常涉及大量的"等待时间"。换句话说，我们花费大量时间处于空闲状态，等待某事完成。

例如，考虑一家餐厅。在餐厅服务订单通常涉及以下步骤：

1. 从客户接收订单
2. 将订单传递给厨房，等待食物烹饪
3. 在厨房开始烹饪食物
4. 当食物完全煮熟后，将食物送到客户手中

如果你思考上面的要点，你会注意到整个过程中存在一个大的等待时刻，那就是食物在厨房里烹饪的时候。在食物准备过程中，服务员和客户本人都在等待食物准备好并送达。

如果我们编写一个程序来表示这家餐厅，更具体地说，一个单线程程序，那么这个程序将非常低效。因为程序会在"检查食物是否准备好"步骤上花费大量时间处于空闲等待状态。考虑下面可能代表这样一个程序的代码片段：

```zig
const std = @import("std");

const Order = struct {
    name: []const u8,
    quantity: u32,
};

fn serveOrder(order: Order) void {
    std.debug.print("接收订单: {s} x {}\n", .{ order.name, order.quantity });
    
    // 等待食物烹饪（阻塞等待）
    std.debug.print("等待厨房烹饪...\n", .{});
    std.time.sleep(5 * std.time.ns_per_s);  // 模拟烹饪时间
    
    std.debug.print("食物已准备好，送餐到客户\n", .{});
}

pub fn main(_: std.process.Init.Minimal) void {
    // 只能一次服务一个订单
    serveOrder(.{ .name = "Pizza Margherita", .quantity = 1 });
    // 第一个订单完成后才能服务第二个
    serveOrder(.{ .name = "Pasta", .quantity = 2 });
}
```

这个程序的问题在于它会花费大量时间在等待上，除了检查食物是否准备好之外什么都不做。这是时间的浪费。与其等待某事发生，服务员可以直接将订单发送到厨房，然后继续前进，继续从其他客户接收更多订单，并将更多订单发送到厨房，而不是什么都不做地等待食物准备好。

这就是为什么线程非常适合这个程序。我们可以使用线程将服务员从他们的"等待职责"中解放出来，这样他们就可以继续进行其他任务，并接收更多订单。看看下一个示例，我已经将上面的程序重写为一个使用线程来烹饪和送餐订单的不同程序：

```zig
// ✅ 高效的多线程版本
const std = @import("std");

const Order = struct {
    name: []const u8,
    quantity: u32,
};

fn cookAndDeliver(order: Order) void {
    const thread_id = std.Thread.getCurrentId();
    std.debug.print("[线程 {}] 开始烹饪: {s}\n", .{ thread_id, order.name });
    
    // 模拟烹饪时间
    std.time.sleep(5 * std.time.ns_per_s);
    
    std.debug.print("[线程 {}] 食物已准备好，送餐: {s}\n", .{ thread_id, order.name });
}

pub fn main(_: std.process.Init.Minimal) !void {
    std.debug.print("=== 餐厅点餐系统（多线程版本）===\n", .{});
    
    // 可以同时服务多个订单
    var threads: [3]std.Thread = undefined;
    const orders = [_]Order{
        .{ .name = "Pizza Margherita", .quantity = 1 },
        .{ .name = "Pasta", .quantity = 2 },
        .{ .name = "Salad", .quantity = 1 },
    };
    
    // 为每个订单创建独立的线程
    for (&threads, orders) |*thread, order| {
        std.debug.print("接收订单: {s} x {}\n", .{ order.name, order.quantity });
        thread.* = try std.Thread.spawn(.{}, cookAndDeliver, .{order});
    }
    
    // 等待所有订单完成
    for (threads) |thread| {
        thread.join();
    }
    
    std.debug.print("所有订单已完成\n", .{});
}
```

**关键改进**：

1. **并行处理**：多个订单可以同时烹饪，不需要等待
2. **资源利用**：服务员（主线程）可以继续接收新订单
3. **响应性**：客户不需要等待前面的订单完成
4. **效率提升**：总时间从 15 秒（串行）降低到约 5 秒（并行）

## 并发编程概述

# 为什么需要并发编程？

在实际编程中，我们经常遇到这样的问题：

```zig
// 串行执行：总时间 = 任务1时间 + 任务2时间
// ⏪ 旧版本：0.11.0 已移除 async/await
fn processData(data1: []const u8, data2: []const u8) !void {
    try processTask1(data1);  // 耗时 100ms
    try processTask2(data2);  // 耗时 100ms
    // 总耗时：200ms
}

// 并发执行：总时间 ≈ max(任务1时间, 任务2时间)
fn processDataConcurrent(io: *std.Io, data1: []const u8, data2: []const u8) !void {
    var fut1 = io.async(processTask1, .{data1});
    var fut2 = io.async(processTask2, .{data2});
    try fut1.await(io);
    try fut2.await(io);
    // 总耗时：≈ 100ms（并行执行）
}
```

**问题**：
- 串行执行效率低，无法充分利用多核CPU
- I/O操作阻塞整个程序，降低响应性
- 难以处理大量并发请求

**解决方案**：使用并发编程，让多个任务同时执行，提高效率和响应性。

# 并发 vs 并行

**并发（Concurrency）**：
- 多个任务在**时间段上交替执行**
- 单核CPU也可以实现并发（时间片轮转）
- 关注的是**结构**：如何组织多个任务

**并行（Parallelism）**：
- 多个任务在**同一时刻同时执行**
- 需要多核CPU才能真正并行
- 关注的是**执行**：如何同时运行多个任务

**关键区别**：
```
并发：单线程处理多个任务（交替执行）
┌─────────────────────────────────────┐
│ Task A: ████░░░░░░░░████░░░░░░░░████ │
│ Task B: ░░░░████░░░░░░░░████░░░░░░░░ │
└─────────────────────────────────────┘

并行：多线程同时执行多个任务
┌─────────────────────────────────────┐
│ Thread 1: ████████████████████████  │
│ Thread 2: ████████████████████████  │
└─────────────────────────────────────┘
```

# Zig 的并发哲学

Zig 的并发设计遵循其核心理念：**显式优于隐式**。与 Go（goroutine）、Rust（async/await）不同，Zig 提供：

1. **显式线程管理**：线程创建、销毁都是显式的
2. **无运行时调度器**：没有隐藏的调度开销
3. **低级原语**：直接使用操作系统线程和同步原语
4. **可预测性能**：没有 GC 或运行时的不确定性

**Zig 并发 vs 其他语言**：

| 特性     | Go                  | Rust                 | Zig               |
| -------- | ------------------- | -------------------- | ----------------- |
| 并发模型 | Goroutine + Channel | async/await + Future | 系统线程          |
| 调度器   | 运行时调度          | 异步运行时           | 无（直接使用 OS） |
| 内存模型 | GC                  | 所有权系统           | 手动管理          |
| 学习曲线 | 平缓                | 陡峭                 | 中等              |

**适用场景**：
- **适合**：系统编程、嵌入式、高性能服务器
- **不适合**：需要大量轻量级协程的场景（可考虑使用第三方库）

# Zig 的并发模型

Zig 提供了两种并发机制：

1. **线程模型**：基于操作系统线程
   - `std.Thread`：创建和管理线程
   - `std.Thread.Mutex`：互斥锁
   - `std.Thread.Condition`：条件变量
   - 适合CPU密集型任务

2. **异步 I/O 模型**：基于事件循环
   - `std.Io`：异步I/O接口
   - `io.async()`：异步操作
   - `io.concurrent()`：并发操作
   - 适合I/O密集型任务

**选择依据**：
- CPU密集型任务 → 使用线程
- I/O密集型任务 → 使用异步I/O
- 混合型任务 → 结合使用

## 线程基础

# 创建和管理线程

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
pub fn main(_: std.process.Init.Minimal) !void {
    // 创建线程
    const thread = try std.Thread.spawn(.{}, worker, .{42});
    
    std.debug.print("Main thread: waiting for worker\n", .{});
    
    // 等待线程完成
    thread.join();
    
    std.debug.print("Main thread: worker finished\n", .{});
}

fn worker(id: u32) void {
    std.debug.print("Worker thread {}: starting\n", .{id});
    std.time.sleep(1 * std.time.ns_per_s);
    std.debug.print("Worker thread {}: finished\n", .{id});
}
```

**关键概念**：
- `std.Thread.spawn(.{}, func, .{args})`：创建新线程
- `.join()`：等待线程完成
- 线程函数可以是任意函数

# 线程返回机制：join 和 detach

> 📖 **内容来源**：本节内容整合自 [Zig Book - Introducing threads and parallelism in Zig](https://pedropark99.github.io/zig-book/Chapters/14-threads.html)

当我们创建线程后，需要决定如何处理线程的返回。Zig 提供了两种机制：`join()` 和 `detach()`。

**join：等待线程完成**

当你调用 `join()` 时，你本质上是在说："嘿！请等待线程完成，然后再继续执行"。例如，在下面的代码中，我们在 `main()` 函数中创建了一个线程，并在最后调用了 `join()`。

因为我们在 `main()` 的作用域内 join 这个新线程，这意味着 `main()` 函数的执行会暂时停止，等待线程的执行完成。也就是说，`main()` 的执行会在调用 `join()` 的那一行暂时停止，只有在线程完成其任务后才会继续。

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) !void {
    const thread = try std.Thread.spawn(.{}, doSomeWork, .{});
    
    std.debug.print("主线程：等待工作线程完成\n", .{});
    
    // join 会阻塞主线程，直到工作线程完成
    thread.join();
    
    std.debug.print("主线程：工作线程已完成\n", .{});
}

fn doSomeWork() void {
    std.debug.print("工作线程：开始工作\n", .{});
    std.time.sleep(2 * std.time.ns_per_s);
    std.debug.print("工作线程：工作完成\n", .{});
}
```

**输出示例**：
```
主线程：等待工作线程完成
工作线程：开始工作
工作线程：工作完成
主线程：工作线程已完成
```

因为我们在这个线程上调用了 `join()`，所以我们有保证这个新线程会在 `main()` 执行结束之前完成。因为 `main()` 会等待线程完成其任务。

**detach：让线程独立运行**

当你调用 `detach()` 时，与该线程关联的资源会自动释放回系统，而不需要另一个线程来 join 这个已终止的线程。

换句话说，当你在线程上调用 `detach()` 时，就像你的孩子长大成人，变得独立于你。一个 detached 的线程会自我释放，当这个线程完成其任务时，它不会将结果报告给你。因此，你通常在线程不需要返回值，或者你不关心线程何时完成时，将线程标记为 detached。

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) !void {
    const thread = try std.Thread.spawn(.{}, independentWork, .{});
    
    // detach 线程，让它独立运行
    thread.detach();
    
    std.debug.print("主线程：继续执行，不等待工作线程\n", .{});
    std.time.sleep(1 * std.time.ns_per_s);
    std.debug.print("主线程：结束\n", .{});
}

fn independentWork() void {
    std.debug.print("独立线程：开始工作\n", .{});
    std.time.sleep(2 * std.time.ns_per_s);
    std.debug.print("独立线程：工作完成\n", .{});
}
```

**输出示例**：
```
主线程：继续执行，不等待工作线程
独立线程：开始工作
主线程：结束
独立线程：工作完成
```

注意，"独立线程：工作完成" 可能会在 "主线程：结束" 之后出现，因为主线程不会等待独立线程完成。

**join vs detach 对比**：

| 特性         | join                           | detach                       |
| ------------ | ------------------------------ | ---------------------------- |
| **行为**     | 阻塞当前线程，等待目标线程完成 | 让线程独立运行，不阻塞       |
| **资源释放** | 线程完成后自动释放资源         | 线程完成后自动释放资源       |
| **结果获取** | 可以获取线程的执行结果         | 无法获取线程的执行结果       |
| **使用场景** | 需要等待线程完成或获取结果     | 后台任务、不需要结果的任务   |
| **生命周期** | 线程必须在 join 之前完成       | 线程可以比主线程存活更长时间 |

**重要规则**：

1. **每个线程必须被 join 或 detach**：如果你不对线程调用 `join()` 或 `detach()`，会引入未定义行为
2. **不能同时 join 和 detach**：一个线程不能既是 joinable 又是 detached
3. **只能调用一次**：`join()` 和 `detach()` 都只能调用一次

**实际应用示例**：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) !void {
    // 场景1：需要结果的线程 - 使用 join
    const result_thread = try std.Thread.spawn(.{}, calculateResult, .{});
    result_thread.join();
    std.debug.print("计算线程已完成\n", .{});
    
    // 场景2：后台日志记录 - 使用 detach
    const log_thread = try std.Thread.spawn(.{}, backgroundLogging, .{});
    log_thread.detach();
    std.debug.print("日志线程已启动，主线程继续\n", .{});
    
    std.debug.print("主线程继续执行其他任务\n", .{});
}

fn calculateResult() void {
    std.debug.print("开始计算...\n", .{});
    std.time.sleep(1 * std.time.ns_per_s);
    std.debug.print("计算完成\n", .{});
}

fn backgroundLogging() void {
    for (0..5) |i| {
        std.debug.print("日志记录: {}\n", .{i});
        std.time.sleep(500 * std.time.ns_per_ms);
    }
}
```

**最佳实践**：

1. **优先使用 join**：在大多数情况下，使用 `join()` 更安全，可以确保线程正确完成
2. **谨慎使用 detach**：只在确定不需要等待线程完成时使用 `detach()`
3. **资源管理**：确保 detached 线程不会访问已经释放的资源
4. **错误处理**：detached 线程中的错误需要在线程内部处理

# 线程安全的数据共享

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
const Counter = struct {
    mutex: std.Thread.Mutex,
    value: i32,
    
    pub fn init() Counter {
        return .{
            .mutex = .{},
            .value = 0,
        };
    }
    
    pub fn increment(self: *Counter) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.value += 1;
    }
    
    pub fn get(self: *Counter) i32 {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.value;
    }
};

pub fn main(_: std.process.Init.Minimal) !void {
    var counter = Counter.init();
    
    // 创建多个线程
    var threads: [10]std.Thread = undefined;
    for (&threads, 0..) |*t, i| {
        t.* = try std.Thread.spawn(.{}, incrementWorker, .{ &counter, i });
    }
    
    // 等待所有线程完成
    for (threads) |t| {
        t.join();
    }
    
    std.debug.print("Final counter value: {}\n", .{counter.get()});
}

fn incrementWorker(counter: *Counter, id: usize) void {
    for (0..1000) |i| {
        counter.increment();
        if (i % 100 == 0) {
            std.debug.print("Thread {}: incrementing\n", .{id});
        }
    }
}
```

**讲解要点**：
- `std.Thread.Mutex` 保护共享数据
- `lock()` 和 `unlock()` 必须成对使用
- `defer` 确保锁一定会释放
- 多线程环境下必须同步访问共享数据

# 线程局部变量（Thread-Local Storage, TLS）

除了使用互斥锁保护共享数据，另一种避免数据竞争的方法是使用线程局部变量，让每个线程拥有独立的数据副本。

### 基本语法

使用 `threadlocal` 关键字声明线程局部变量：

```zig
const std = @import("std");

// 线程局部变量：每个线程有独立的副本
threadlocal var counter: i32 = 0;

fn incrementCounter() void {
    counter += 1;
    std.debug.print("计数器值: {}\n", .{counter});
}

pub fn main(_: std.process.Init.Minimal) void {
    // 主线程
    incrementCounter(); // 输出: 1
    incrementCounter(); // 输出: 2
}
```

### 多线程示例

```zig
const std = @import("std");

threadlocal var thread_id: usize = 0;

fn worker(id: usize) void {
    thread_id = id;  // 每个线程设置自己的 ID
    
    for (0..3) |i| {
        std.debug.print("线程 {}: 第 {} 次执行\n", .{ thread_id, i });
        std.time.sleep(100 * std.time.ns_per_ms);
    }
}

pub fn main(_: std.process.Init.Minimal) !void {
    var threads: [3]std.Thread = undefined;
    
    for (&threads, 0..) |*t, i| {
        t.* = try std.Thread.spawn(.{}, worker, .{i});
    }
    
    for (threads) |t| {
        t.join();
    }
}
```

**预期输出**：
```
线程 0: 第 0 次执行
线程 1: 第 0 次执行
线程 2: 第 0 次执行
线程 0: 第 1 次执行
线程 1: 第 1 次执行
线程 2: 第 1 次执行
...
```

### 线程局部变量 vs 互斥锁

| 特性           | 线程局部变量                     | 互斥锁                       |
| -------------- | -------------------------------- | ---------------------------- |
| **数据共享**   | 每个线程独立副本                 | 线程间共享                   |
| **同步开销**   | 无                               | 有（锁竞争）                 |
| **适用场景**   | 线程特定状态、避免竞争           | 需要线程间共享数据           |
| **内存占用**   | 每个线程一份                     | 只有一份                     |

### 实际应用场景

1. **线程特定的日志缓冲区**：
   ```zig
   threadlocal var log_buffer: [1024]u8 = undefined;
   ```

2. **随机数生成器**：
   ```zig
   threadlocal var rng: std.Random.DefaultPrng = undefined;
   ```

3. **线程 ID 或状态**：
   ```zig
   threadlocal var thread_local_id: usize = 0;
   ```

### 注意事项

- 线程局部变量的初始化在第一次访问时发生
- 需要平台支持 TLS
- 在单线程程序中，行为与普通全局变量相同
- 不能用于需要线程间共享的数据

## 同步机制

# 为什么需要同步？

多线程访问共享数据时，需要同步机制来避免数据竞争：

1. **数据竞争**：多个线程同时读写同一数据
2. **竞态条件**：结果依赖于线程执行顺序
3. **内存可见性**：一个线程的修改对其他线程不可见

# 互斥锁（Mutex）

互斥锁确保同一时间只有一个线程可以访问共享数据：

```zig
const std = @import("std");

var counter: usize = 0;
var mutex: std.Thread.Mutex = .{};

fn incrementCounter() void {
    for (0..1000) |_| {
        mutex.lock();
        defer mutex.unlock();
        counter += 1;
    }
}

pub fn main(_: std.process.Init.Minimal) !void {
    const thread_count = 4;
    var threads: [thread_count]std.Thread = undefined;
    
    for (0..thread_count) |i| {
        threads[i] = try std.Thread.spawn(.{}, incrementCounter, .{});
    }
    
    for (threads) |thread| {
        thread.join();
    }
    
    std.debug.print("计数器：{}\n", .{counter});
}
```

# 条件变量（Condition Variable）

条件变量用于线程间的等待/通知机制：

```zig
const std = @import("std");

var counter: usize = 0;
var mutex: std.Thread.Mutex = .{};
var cond: std.Thread.Condition = .{};
var done: bool = false;

// 生产者：增加计数器
fn producer() void {
    for (0..10) |_| {
        mutex.lock();
        defer mutex.unlock();
        
        counter += 1;
        std.debug.print("生产：counter = {}\n", .{counter});
        
        // 通知等待的消费者
        cond.signal();
        std.time.sleep(50 * std.time.ns_per_ms);
    }
    
    // 标记完成
    mutex.lock();
    defer mutex.unlock();
    done = true;
    cond.signal();
}

// 消费者：减少计数器
fn consumer() void {
    while (true) {
        mutex.lock();
        defer mutex.unlock();
        
        // 等待条件：counter > 0 或 done
        while (counter == 0 and !done) {
            cond.wait(&mutex); // 释放锁并等待
        }
        
        if (done and counter == 0) break;
        
        counter -= 1;
        std.debug.print("消费：counter = {}\n", .{counter});
    }
}

pub fn main(_: std.process.Init.Minimal) !void {
    const producer_thread = try std.Thread.spawn(.{}, producer, .{});
    const consumer_thread = try std.Thread.spawn(.{}, consumer, .{});
    
    producer_thread.join();
    consumer_thread.join();
    
    std.debug.print("生产者-消费者完成\n", .{});
}
```

**关键要点**：
- `cond.wait(&mutex)` 会自动释放锁并等待通知
- 收到通知后，会重新获取锁
- 使用 `while` 循环检查条件，避免虚假唤醒
- `signal()` 唤醒一个等待线程，`broadcast()` 唤醒所有等待线程

## Zig 0.16.0 异步 I/O

> ⚠️ **重要说明**：Zig 0.16.0 引入了全新的异步I/O设计，与旧版本的 `async`/`await` 关键字完全不同。

# 异步 I/O 的核心理念

**关键概念**：**异步 ≠ 并发**
- `async`：操作**可以**乱序执行（顺序等待也是有效的）
- `concurrent`：操作**必须**同时执行（需要并行性）

**设计哲学**：
- 将并发表达与执行模型解耦
- 代码可以在同步、多线程、事件驱动环境中无缝工作
- 没有函数着色问题

# std.Io 接口

```zig
// ⏪ 旧版本：0.11.0 已移除 async/await
const std = @import("std");

// 示例：Zig 0.16.0-dev
const Io = struct {
    /// 生成异步工作（可能立即执行或被调度）
    fn async(self: *Io, func: anytype, args: anytype) Future
    
    /// 生成并发工作（如果并行性不可用则失败）
    fn concurrent(self: *Io, func: anytype, args: anytype) !Future
    
    /// 消息传递原语
    fn Queue(comptime T: type) type
};
```

# Future 操作

```zig
// ⏪ 旧版本：0.11.0 已移除 async/await
const Future = struct {
    /// 等待结果（幂等）
    fn await(self: *Future, io: *Io) !T
    
    /// 取消并检索结果（幂等）
    fn cancel(self: *Future, io: *Io) !T
};
```

# 基本异步操作

```zig
// ⏪ 旧版本：0.11.0 已移除 async/await
const std = @import("std");

// 示例：Zig 0.16.0-dev
pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 创建 I/O 上下文
    var io = std.Io.Threaded.init(allocator);
    defer io.deinit();
    
    // 异步文件操作
    var fut1 = io.async(saveFile, .{ &io, "file1.txt", "Hello" });
    var fut2 = io.async(saveFile, .{ &io, "file2.txt", "World" });
    
    // 等待结果
    try fut1.await(&io);
    try fut2.await(&io);
    
    std.debug.print("Files saved concurrently\n", .{});
}

fn saveFile(io: *std.Io, filename: []const u8, content: []const u8) !void {
    _ = io;
    const file = try std.fs.cwd().createFile(filename, .{});
    defer file.close();
    try file.writeAll(content);
}
```

# 资源管理模式

```zig
// ⏪ 旧版本：0.11.0 已移除 async/await
const std = @import("std");

// 示例：Zig 0.16.0-dev
pub fn processWithCleanup(io: *std.Io) !void {
    var future = io.async(longOperation, .{io});
    
    // 使用 defer 确保资源清理
    defer if (future.cancel(io)) |result| {
        cleanup(result);
    } else |_| {}
    
    // 使用 future...
    try future.await(io);
}

fn longOperation(io: *std.Io) !i32 {
    _ = io;
    // 模拟长时间操作
    std.time.sleep(1 * std.time.ns_per_s);
    return 42;
}

fn cleanup(result: i32) void {
    std.debug.print("Cleaning up result: {}\n", .{result});
}
```

**讲解要点**：
- `io.async()` 用于可能并发的操作
- `future.await(io)` 等待结果
- `defer` + `cancel()` 模式处理资源清理
- 传递 `io` 参数就像传递 `allocator` 一样

# async vs concurrent 的选择

**使用 `io.async()` 当**：
- 操作可以以任何顺序进行
- 顺序等待是可接受的
- 想要与阻塞I/O实现一起工作

**使用 `io.concurrent()` 当**：
- 操作必须同时运行
- 解决生产者-消费者死锁
- 需要真正的并行性

```zig
// ⏪ 旧版本：0.11.0 已移除 async/await
const std = @import("std");

// 示例：Zig 0.16.0-dev
pub fn demonstrateAsyncVsConcurrent(io: *std.Io) !void {
    // async: 操作可以顺序执行
    var async_fut = io.async(task, .{io, "async task"});
    
    // concurrent: 操作必须并行执行
    var concurrent_fut = try io.concurrent(task, .{io, "concurrent task"});
    
    try async_fut.await(io);
    try concurrent_fut.await(io);
}

fn task(io: *std.Io, name: []const u8) !void {
    _ = io;
    std.debug.print("Executing: {s}\n", .{name});
}
```

## 原子操作

# 原子类型

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
const AtomicCounter = struct {
    value: std.atomic.Value(i32),
    
    pub fn init() AtomicCounter {
        return .{
            .value = std.atomic.Value(i32).init(0),
        };
    }
    
    pub fn increment(self: *AtomicCounter) void {
        _ = self.value.fetchAdd(1, .monotonic);
    }
    
    pub fn decrement(self: *AtomicCounter) void {
        _ = self.value.fetchSub(1, .monotonic);
    }
    
    pub fn get(self: *AtomicCounter) i32 {
        return self.value.load(.monotonic);
    }
    
    pub fn set(self: *AtomicCounter, new_value: i32) void {
        self.value.store(new_value, .monotonic);
    }
};

pub fn main(_: std.process.Init.Minimal) !void {
    var counter = AtomicCounter.init();
    
    var threads: [10]std.Thread = undefined;
    for (&threads) |*t| {
        t.* = try std.Thread.spawn(.{}, atomicIncrementWorker, .{&counter});
    }
    
    for (threads) |t| {
        t.join();
    }
    
    std.debug.print("Final atomic counter: {}\n", .{counter.get()});
}

fn atomicIncrementWorker(counter: *AtomicCounter) void {
    for (0..1000) |_| {
        counter.increment();
    }
}
```

# 内存序

Zig 支持多种内存序，影响可见性和性能：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
const Data = struct {
    ready: std.atomic.Value(bool),
    value: i32,
    
    pub fn init() Data {
        return .{
            .ready = std.atomic.Value(bool).init(false),
            .value = 0,
        };
    }
    
    // 写入者
    pub fn write(self: *Data, v: i32) void {
        self.value = v;
        // Release: 确保前面的写入对其他线程可见
        self.ready.store(true, .release);
    }
    
    // 读取者
    pub fn read(self: *Data) ?i32 {
        // Acquire: 确保看到最新的写入
        if (self.ready.load(.acquire)) {
            return self.value;
        }
        return null;
    }
};
```

**内存序说明**：

| 内存序       | 说明                           | 使用场景           |
| ------------ | ------------------------------ | ------------------ |
| `.monotonic` | 最弱，只保证原子性             | 简单计数器         |
| `.acquire`   | 读操作，防止后续操作重排到前面 | 读取共享数据       |
| `.release`   | 写操作，防止前面操作重排到后面 | 写入共享数据       |
| `.acq_rel`   | Acquire + Release              | 读-改-写操作       |
| `.seq_cst`   | 最强，全局顺序一致             | 需要严格顺序的场景 |

# 自旋锁实现

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
const SpinLock = struct {
    flag: std.atomic.Value(bool),
    
    pub fn init() SpinLock {
        return .{
            .flag = std.atomic.Value(bool).init(false),
        };
    }
    
    pub fn lock(self: *SpinLock) void {
        // CAS 循环：尝试将 false 改为 true
        while (self.flag.compareAndSwap(
            false,  // 期望值
            true,   // 新值
            .acquire,  // 成功时的内存序
            .monotonic, // 失败时的内存序
        )) |_| {
            // 自旋等待
            std.Thread.spinLoopHint();
        }
    }
    
    pub fn unlock(self: *SpinLock) void {
        // Release: 确保前面的操作对其他线程可见
        self.flag.store(false, .release);
    }
};

pub fn main(_: std.process.Init.Minimal) !void {
    var spinlock = SpinLock.init();
    var protected_value: i32 = 0;
    
    {
        spinlock.lock();
        defer spinlock.unlock();
        protected_value = 42;
        std.debug.print("Protected value: {}\n", .{protected_value});
    }
}
```

**讲解要点**：
- `compareAndSwap` 是 CAS 操作，用于无锁编程
- `spinLoopHint()` 提示CPU优化自旋等待
- 自旋锁适合短时间持有锁的场景

## 无锁数据结构

# 无锁栈

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
fn LockFreeStack(comptime T: type) type {
    return struct {
        const Self = @This();
        const Node = struct {
            data: T,
            next: ?*Node,
        };
        
        head: std.atomic.Value(?*Node),
        
        pub fn init() Self {
            return .{
                .head = std.atomic.Value(?*Node).init(null),
            };
        }
        
        pub fn push(self: *Self, node: *Node) void {
            var current = self.head.load(.monotonic);
            while (true) {
                node.next = current;
                // CAS: 尝试更新 head
                if (self.head.compareAndSwap(
                    current,
                    node,
                    .release,
                    .monotonic,
                )) |new_current| {
                    // CAS 失败，重试
                    current = new_current;
                } else {
                    // CAS 成功
                    break;
                }
            }
        }
        
        pub fn pop(self: *Self) ?*Node {
            var current = self.head.load(.monotonic);
            while (current) |node| {
                // CAS: 尝试更新 head
                if (self.head.compareAndSwap(
                    current,
                    node.next,
                    .acquire,
                    .monotonic,
                )) |_| {
                    // CAS 成功
                    return node;
                } else |new_current| {
                    // CAS 失败，重试
                    current = new_current;
                }
            }
            return null;
        }
    };
}

pub fn main(_: std.process.Init.Minimal) !void {
    var stack = LockFreeStack(i32).init();
    
    var nodes: [10]LockFreeStack(i32).Node = undefined;
    for (&nodes, 0..) |*node, i| {
        node.* = .{
            .data = @intCast(i),
            .next = null,
        };
        stack.push(node);
    }
    
    while (stack.pop()) |node| {
        std.debug.print("Popped: {}\n", .{node.data});
    }
}
```

**讲解要点**：
- CAS 循环是无锁编程的核心模式
- 无锁数据结构避免了锁的开销
- 注意 ABA 问题：节点被释放后重新分配，CAS 可能误判
- 内存回收是无锁数据结构的难点

## 自旋锁实现

自旋锁是一种简单的锁机制，线程在获取锁失败时会循环等待（自旋），而不是阻塞。

```zig
const std = @import("std");

const SpinLock = struct {
    locked: std.atomic.Value(bool) = std.atomic.Value(bool).init(false),
    
    fn acquire(self: *SpinLock) void {
        while (self.locked.cmpxchgWeak(
            false,
            true,
            .acquire,
            .relaxed,
        ) != null) {
            // 自旋等待
            std.atomic.spinLoopHint();
        }
    }
    
    fn release(self: *SpinLock) void {
        self.locked.store(false, .release);
    }
};

pub fn main(_: std.process.Init.Minimal) !void {
    var lock: SpinLock = .{};
    var counter: usize = 0;
    
    const worker = struct {
        fn work(l: *SpinLock, c: *usize) void {
            for (0..1000) |_| {
                l.acquire();
                defer l.release();
                c.* += 1;
            }
        }
    }.work;
    
    const thread1 = try std.Thread.spawn(.{}, worker, .{ &lock, &counter });
    const thread2 = try std.Thread.spawn(.{}, worker, .{ &lock, &counter });
    
    thread1.join();
    thread2.join();
    
    std.debug.print("计数器：{}\n", .{counter});
}
```

**自旋锁 vs 互斥锁**：

| 特性           | 自旋锁               | 互斥锁               |
| -------------- | -------------------- | -------------------- |
| **等待方式**   | 忙等待（占用 CPU）   | 阻塞等待（释放 CPU） |
| **上下文切换** | 无                   | 有                   |
| **适用场景**   | 短时间持有锁         | 长时间持有锁         |
| **CPU 开销**   | 高（等待时占用 CPU） | 低（等待时释放 CPU） |
| **实现复杂度** | 简单                 | 复杂                 |

**使用建议**：
- ✅ **适合**：锁持有时间极短（< 100 条指令）
- ❌ **不适合**：锁持有时间较长，或竞争激烈
- ⚠️ **注意**：在单核 CPU 上，自旋锁可能导致死锁

## 并发模式

# 生产者-消费者模式

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
fn BoundedQueue(comptime T: type) type {
    return struct {
        mutex: std.Thread.Mutex,
        not_empty: std.Thread.Condition,
        not_full: std.Thread.Condition,
        buffer: []T,
        head: usize,
        tail: usize,
        count: usize,
        
        pub fn init(allocator: std.mem.Allocator, capacity: usize) !@This() {
            return .{
                .mutex = .{},
                .not_empty = .{},
                .not_full = .{},
                .buffer = try allocator.alloc(T, capacity),
                .head = 0,
                .tail = 0,
                .count = 0,
            };
        }
        
        pub fn deinit(self: *@This(), allocator: std.mem.Allocator) void {
            allocator.free(self.buffer);
        }
        
        pub fn enqueue(self: *@This(), item: T) void {
            self.mutex.lock();
            defer self.mutex.unlock();
            
            // 等待队列不满
            while (self.count == self.buffer.len) {
                self.not_full.wait(&self.mutex);
            }
            
            self.buffer[self.tail] = item;
            self.tail = (self.tail + 1) % self.buffer.len;
            self.count += 1;
            
            // 通知消费者
            self.not_empty.signal();
        }
        
        pub fn dequeue(self: *@This()) T {
            self.mutex.lock();
            defer self.mutex.unlock();
            
            // 等待队列不空
            while (self.count == 0) {
                self.not_empty.wait(&self.mutex);
            }
            
            const item = self.buffer[self.head];
            self.head = (self.head + 1) % self.buffer.len;
            self.count -= 1;
            
            // 通知生产者
            self.not_full.signal();
            
            return item;
        }
    };
}

pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var queue = try BoundedQueue(i32).init(allocator, 10);
    defer queue.deinit(allocator);
    
    // 生产者线程
    const producer = try std.Thread.spawn(.{}, producerWorker, .{&queue});
    
    // 消费者线程
    const consumer = try std.Thread.spawn(.{}, consumerWorker, .{&queue});
    
    producer.join();
    consumer.join();
}

fn producerWorker(queue: *BoundedQueue(i32)) void {
    for (0..20) |i| {
        queue.enqueue(@intCast(i));
        std.debug.print("Produced: {}\n", .{i});
        std.time.sleep(100 * std.time.ns_per_ms);
    }
}

fn consumerWorker(queue: *BoundedQueue(i32)) void {
    for (0..20) |_| {
        const item = queue.dequeue();
        std.debug.print("Consumed: {}\n", .{item});
        std.time.sleep(150 * std.time.ns_per_ms);
    }
}
```

**讲解要点**：
- 条件变量用于线程间通信
- `wait()` 会释放锁并等待信号
- `signal()` 唤醒等待的线程
- 循环队列实现有界缓冲

# 使用 Io.Queue 进行消息传递

```zig
// ⏪ 旧版本：0.11.0 已移除 async/await
const std = @import("std");

// 示例：Zig 0.16.0-dev
pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var io = std.Io.Threaded.init(allocator);
    defer io.deinit();
    
    // 创建消息队列
    var queue = io.Queue(i32).init();
    
    // 生产者
    var producer = try io.concurrent(produce, .{ &io, &queue });
    
    // 消费者
    var consumer = try io.concurrent(consume, .{ &io, &queue });
    
    try producer.await(&io);
    try consumer.await(&io);
}

fn produce(io: *std.Io, queue: *std.Io.Queue(i32)) !void {
    for (0..10) |i| {
        try queue.write(io, @intCast(i));
        std.debug.print("Produced: {}\n", .{i});
    }
}

fn consume(io: *std.Io, queue: *std.Io.Queue(i32)) !void {
    for (0..10) |_| {
        const item = try queue.read(io);
        std.debug.print("Consumed: {}\n", .{item});
    }
}
```

## 实践练习

# 练习1：基础练习（难度：简单）

**练习目标**：掌握线程和互斥锁的使用

```zig
// 练习1.1：实现线程安全的计数器
const ThreadSafeCounter = struct {
    mutex: std.Thread.Mutex,
    value: i32,
    
    // TODO: 实现 init, increment, decrement, get
};

// 练习1.2：实现线程安全的链表
const ThreadSafeList = struct {
    mutex: std.Thread.Mutex,
    head: ?*Node,
    
    // TODO: 实现 insert, remove, find
};

// 练习1.3：实现线程安全的哈希表
const ThreadSafeHashMap = struct {
    mutex: std.Thread.Mutex,
    buckets: []?Entry,
    
    // TODO: 实现 put, get, remove
};
```

# 练习2：进阶练习（难度：中等）

**练习目标**：掌握原子操作和无锁编程

```zig
// 练习2.1：实现自旋锁
const SpinLock = struct {
    flag: std.atomic.Value(bool),
    
    // TODO: 实现 lock, unlock
};

// 练习2.2：实现无锁队列
const LockFreeQueue = struct {
    head: std.atomic.Value(?*Node),
    tail: std.atomic.Value(?*Node),
    
    // TODO: 实现 enqueue, dequeue
};

// 练习2.3：实现读写锁
const ReadWriteLock = struct {
    readers: std.atomic.Value(i32),
    writer: std.atomic.Value(bool),
    
    // TODO: 实现 readLock, readUnlock, writeLock, writeUnlock
};
```

# 练习3：高级练习（难度：困难）

**练习目标**：掌握复杂并发模式

```zig
// 练习3.1：实现线程池
const ThreadPool = struct {
    workers: []std.Thread,
    tasks: BoundedQueue(Task),
    
    // TODO: 实现 init, deinit, submit, shutdown
};

// 练习3.2：实现工作窃取调度器
const WorkStealingScheduler = struct {
    queues: []ThreadLocalQueue,
    
    // TODO: 实现 submit, steal, run
};

// 练习3.3：实现并发哈希表
const ConcurrentHashMap = struct {
    segments: []Segment,
    
    // TODO: 实现 put, get, remove（使用分段锁）
};
```

## 线程安全的数据结构

在实际项目中，经常需要线程安全的数据结构。以下是线程安全计数器的实现：

```zig
const std = @import("std");

const ThreadSafeCounter = struct {
    value: std.atomic.Value(usize),
    mutex: std.Thread.Mutex,
    
    fn init() ThreadSafeCounter {
        return .{
            .value = std.atomic.Value(usize).init(0),
            .mutex = .{},
        };
    }
    
    fn increment(self: *ThreadSafeCounter) void {
        _ = self.value.fetchAdd(1, .monotonic);
    }
    
    fn incrementComplex(self: *ThreadSafeCounter) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        const current = self.value.load(.monotonic);
        self.value.store(current + 1, .monotonic);
    }
    
    fn get(self: *const ThreadSafeCounter) usize {
        return self.value.load(.monotonic);
    }
};

pub fn main(_: std.process.Init.Minimal) !void {
    var counter = ThreadSafeCounter.init();
    
    const worker = struct {
        fn work(c: *ThreadSafeCounter) void {
            for (0..1000) |_| {
                c.increment();
            }
        }
    }.work;
    
    var threads: [10]std.Thread = undefined;
    for (&threads, 0..) |*thread, i| {
        _ = i;
        thread.* = try std.Thread.spawn(.{}, worker, .{&counter});
    }
    
    for (threads) |thread| {
        thread.join();
    }
    
    std.debug.print("最终计数：{}\n", .{counter.get()});
}
```

**选择同步原语的原则**：

| 场景       | 推荐方案 | 原因           |
| ---------- | -------- | -------------- |
| 简单计数器 | 原子操作 | 性能最优，无锁 |
| 复杂临界区 | 互斥锁   | 保证互斥访问   |
| 读多写少   | 读写锁   | 提高并发度     |
| 等待条件   | 条件变量 | 高效等待       |

**线程安全检查清单**：

1. ✅ **识别共享数据**：明确哪些数据会被多个线程访问
2. ✅ **选择同步原语**：根据访问模式选择合适的锁或原子操作
3. ✅ **最小化临界区**：锁的范围越小越好
4. ✅ **避免嵌套锁**：防止死锁
5. ✅ **使用 defer 确保释放**：确保锁一定会释放

## 常见并发陷阱

# 死锁（Deadlock）

死锁是指两个或多个线程互相等待对方释放资源，导致所有线程都无法继续执行。

**死锁示例**：

```zig
// ❌ 错误示例
fn deadlockExample() void {
    var mutex1: std.Thread.Mutex = .{};
    var mutex2: std.Thread.Mutex = .{};
    
    // 线程1：先锁 mutex1，再锁 mutex2
    const thread1 = std.Thread.spawn(.{}, struct {
        fn work(m1: *std.Thread.Mutex, m2: *std.Thread.Mutex) void {
            m1.lock();
            defer m1.unlock();
            
            std.time.sleep(100 * std.time.ns_per_ms);
            
            m2.lock();
            defer m2.unlock();
        }
    }.work, .{ &mutex1, &mutex2 });
    
    // 线程2：先锁 mutex2，再锁 mutex1（相反顺序）
    const thread2 = std.Thread.spawn(.{}, struct {
        fn work(m1: *std.Thread.Mutex, m2: *std.Thread.Mutex) void {
            m2.lock();
            defer m2.unlock();
            
            std.time.sleep(100 * std.time.ns_per_ms);
            
            m1.lock();
            defer m1.unlock();
        }
    }.work, .{ &mutex1, &mutex2 });
    
    thread1.join();
    thread2.join();
}
```

**避免死锁的方法**：

```zig
// ✅ 方法1：统一加锁顺序
fn noDeadlockMethod1() void {
    var mutex1: std.Thread.Mutex = .{};
    var mutex2: std.Thread.Mutex = .{};
    
    mutex1.lock();
    defer mutex1.unlock();
    
    mutex2.lock();
    defer mutex2.unlock();
}

// ✅ 方法2：使用 tryLock 避免阻塞
fn noDeadlockMethod2() void {
    var mutex1: std.Thread.Mutex = .{};
    var mutex2: std.Thread.Mutex = .{};
    
    mutex1.lock();
    errdefer mutex1.unlock();
    
    if (mutex2.tryLock()) {
        defer mutex2.unlock();
    } else {
        mutex1.unlock();
    }
}
```

# 竞态条件（Race Condition）

竞态条件是指多个线程访问共享数据，且至少有一个线程在写入，导致结果依赖于执行顺序。

```zig
// ❌ 错误示例
var counter: usize = 0;

fn unsafeIncrement() void {
    for (0..1000) |_| {
        counter += 1;
    }
}

// ✅ 正确做法：使用原子操作
var safe_counter: std.atomic.Value(usize) = std.atomic.Value(usize).init(0);

fn safeIncrement() void {
    for (0..1000) |_| {
        _ = safe_counter.fetchAdd(1, .monotonic);
    }
}
```

# 活锁（Livelock）

活锁是指线程不断改变状态但无法取得进展，类似于两个人在走廊里互相让路。

```zig
// ❌ 错误示例：立即重试可能导致活锁
fn livelockExample() void {
    var mutex: std.Thread.Mutex = .{};
    var should_retry = true;
    
    while (should_retry) {
        if (mutex.tryLock()) {
            defer mutex.unlock();
            should_retry = false;
        }
    }
}

// ✅ 正确做法：添加退避策略
fn noLivelock() void {
    var mutex: std.Thread.Mutex = .{};
    var retry_count: usize = 0;
    
    while (retry_count < 10) : (retry_count += 1) {
        if (mutex.tryLock()) {
            defer mutex.unlock();
            break;
        }
        std.time.sleep(std.time.ns_per_ms * @as(u64, 1) << @intCast(retry_count));
    }
}
```

## 性能优化建议

# 1. 减少锁竞争

```zig
// ❌ 错误示例：整个操作都在临界区内
fn inefficientLock(data: *Data) void {
    var mutex: std.Thread.Mutex = .{};
    mutex.lock();
    defer mutex.unlock();
    
    processData(data);
    saveResult(data);
}

// ✅ 最小化临界区
fn efficientLock(data: *Data) void {
    var mutex: std.Thread.Mutex = .{};
    
    mutex.lock();
    const local_copy = data.value;
    mutex.unlock();
    
    const result = processData(local_copy);
    
    mutex.lock();
    data.result = result;
    mutex.unlock();
}
```

# 2. 使用无锁数据结构

对于简单操作，优先使用原子操作：

```zig
const LockFreeCounter = struct {
    value: std.atomic.Value(usize),
    
    fn increment(self: *LockFreeCounter) void {
        _ = self.value.fetchAdd(1, .monotonic);
    }
    
    fn get(self: *const LockFreeCounter) usize {
        return self.value.load(.monotonic);
    }
};
```

# 3. 避免伪共享（False Sharing）

伪共享是指多个线程访问同一缓存行的不同变量，导致缓存频繁失效。

```zig
// ❌ 错误示例
const Data = struct {
    counter1: usize,
    counter2: usize,
};

// ✅ 使用缓存行对齐
const CACHE_LINE_SIZE = 64;

const AlignedData = struct {
    counter1: usize align(CACHE_LINE_SIZE),
    counter2: usize align(CACHE_LINE_SIZE),
};
```

# 4. 性能对比

| 同步方式         | 性能  | 适用场景         |
| ---------------- | ----- | ---------------- |
| 无锁（原子操作） | ⭐⭐⭐⭐⭐ | 简单计数、标志位 |
| 自旋锁           | ⭐⭐⭐⭐  | 短临界区、低竞争 |
| 互斥锁           | ⭐⭐⭐   | 长临界区、高竞争 |
| 读写锁           | ⭐⭐⭐   | 读多写少         |

# 5. 性能测试建议

```zig
const std = @import("std");

fn benchmarkMutex(allocator: std.mem.Allocator) !void {
    var mutex: std.Thread.Mutex = .{};
    var counter: usize = 0;
    
    const start = std.time.nanoTimestamp();
    
    var threads: [4]std.Thread = undefined;
    for (&threads) |*thread| {
        thread.* = try std.Thread.spawn(.{}, struct {
            fn work(m: *std.Thread.Mutex, c: *usize) void {
                for (0..100000) |_| {
                    m.lock();
                    defer m.unlock();
                    c.* += 1;
                }
            }
        }.work, .{ &mutex, &counter });
    }
    
    for (threads) |thread| thread.join();
    
    const end = std.time.nanoTimestamp();
    const elapsed = @as(f64, @floatFromInt(end - start)) / 1_000_000.0;
    
    std.debug.print("互斥锁耗时：{d:.2}ms\n", .{elapsed});
}
```

## 并发编程最佳实践

# 1. 避免数据竞争

```zig
// ✅ 好的做法：使用锁保护共享数据
// ❌ 错误示例
const SharedData = struct {
    mutex: std.Thread.Mutex,
    value: i32,
    
    pub fn update(self: *SharedData, new_value: i32) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.value = new_value;
    }
};

// ❌ 不好的做法：直接访问共享数据
const SharedData = struct {
    value: i32,
    
    pub fn update(self: *SharedData, new_value: i32) void {
        self.value = new_value;  // 数据竞争！
    }
};
```

# 2. 最小化锁的持有时间

```zig
// ✅ 好的做法：减少锁的持有时间
// ❌ 错误示例
fn processData(data: *SharedData) !void {
    // 先在锁外准备数据
    const prepared = try prepareData();
    
    // 只在必要时持有锁
    data.mutex.lock();
    defer data.mutex.unlock();
    data.value = prepared;
}

// ❌ 不好的做法：长时间持有锁
fn processData(data: *SharedData) !void {
    data.mutex.lock();
    defer data.mutex.unlock();
    
    // 在锁内进行耗时操作
    const prepared = try prepareData();  // 不应该在这里
    data.value = prepared;
}
```

# 3. 避免死锁

```zig
// ✅ 好的做法：按固定顺序获取锁
// ❌ 错误示例
fn transfer(from: *Account, to: *Account, amount: i32) void {
    const lock1 = if (@intFromPtr(from) < @intFromPtr(to)) from else to;
    const lock2 = if (@intFromPtr(from) < @intFromPtr(to)) to else from;
    
    lock1.mutex.lock();
    defer lock1.mutex.unlock();
    lock2.mutex.lock();
    defer lock2.mutex.unlock();
    
    from.balance -= amount;
    to.balance += amount;
}

// ❌ 不好的做法：随机顺序获取锁（可能死锁）
fn transfer(from: *Account, to: *Account, amount: i32) void {
    from.mutex.lock();
    defer from.mutex.unlock();
    to.mutex.lock();  // 可能死锁！
    defer to.mutex.unlock();
    
    from.balance -= amount;
    to.balance += amount;
}
```

# 4. 使用 defer 确保资源释放

```zig
// ✅ 好的做法：使用 defer
// ❌ 错误示例
fn safeOperation(data: *SharedData) void {
    data.mutex.lock();
    defer data.mutex.unlock();  // 确保一定会释放
    
    // 可能提前返回的代码
    if (data.value == 0) return;
    
    // 其他操作...
}

// ❌ 不好的做法：手动释放（容易忘记）
fn unsafeOperation(data: *SharedData) void {
    data.mutex.lock();
    
    if (data.value == 0) {
        data.mutex.unlock();  // 容易忘记
        return;
    }
    
    // 其他操作...
    data.mutex.unlock();  // 可能不会执行
}
```

# 5. 选择合适的同步机制

```zig
// 简单计数器 → 原子操作
var counter = std.atomic.Value(i32).init(0);
_ = counter.fetchAdd(1, .monotonic);

// 复杂操作 → 互斥锁
var data = struct {
    mutex: std.Thread.Mutex,
    map: std.StringHashMap(i32),
}{ .mutex = .{}, .map = undefined };

// 生产者-消费者 → 条件变量或 Io.Queue
var queue = BoundedQueue(i32).init(allocator, 10);

// 高性能场景 → 无锁数据结构
var stack = LockFreeStack(i32).init();
```

## 小结

本章介绍了 Zig 的并发编程，包括：

1. **并发基础概念**：
   - 并发 vs 并行
   - Zig 的并发模型
   - 线程创建和管理

2. **Zig 0.16.0 异步 I/O**：
   - std.Io 接口
   - Future 操作
   - async vs concurrent
   - 资源管理模式

3. **原子操作**：
   - 原子类型
   - 内存序
   - CAS 操作

4. **无锁数据结构**：
   - 无锁栈
   - CAS 循环模式
   - ABA 问题

5. **并发模式**：
   - 生产者-消费者
   - 消息传递

6. **最佳实践**：
   - 避免数据竞争
   - 最小化锁持有时间
   - 避免死锁
   - 使用 defer
   - 选择合适的同步机制

**关键要点**：
- Zig 提供线程和异步 I/O 两种并发机制
- Zig 0.16.0 的异步 I/O 解耦了并发表达和执行模型
- 原子操作是无锁编程的基础
- 内存序影响可见性和性能
- 并发编程需要特别注意正确性

**下一步学习**：
- 第十一章：指针与引用类型 - 深入理解指针
- 第十二章：与 C 语言互操作 - 学习与 C 库交互
- 第十三章：测试与基准测试 - 学习测试并发代码

---

> 💡 **章节过渡**：从并发编程到指针与引用类型
> 
> 在[并发编程概述](chapter-concurrency.md)中，我们学习了并发编程概述，掌握了线程、互斥锁、原子操作等基本概念。
> 现在，我们将深入学习指针与引用类型，了解 Zig 如何通过指针类型系统保证内存安全。
> 
> **为什么并发编程需要深入理解指针？**
> 
> 1. **共享内存**：多线程访问同一数据需要通过指针
> 2. **数据竞争**：指针的不当使用会导致并发问题
> 3. **原子操作**：理解指针是理解原子操作的前提
> 4. **无锁数据结构**：高级并发模式需要指针操作
> 
> **学习建议**：
> - 确保你已经理解了并发编程的基本概念
> - 注意指针在并发环境下的安全问题
> - 理解不同指针类型的安全保证
