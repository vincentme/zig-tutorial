# 并发编程概述

> **进阶**：
>
> 本章的重点是建立 Zig 中并发编程的**稳定概念框架**：线程、共享状态、同步原语、原子操作与常见取舍。
>
> 与 I/O 相关的“异步方向”在开发版语境下仍然更容易演进，因此本章不会把某些 dev 版接口当作稳定 API 手册来讲解。关于这一方向的阅读建议，请结合第三部分的[异步 I/O：现状与未来方向](../part3-practice/chapter-async.md)一起看。

## 三个容易混淆的概念

在进入具体代码之前，必须先分清：**异步（asynchrony）**、**并发（concurrency）**、**并行（parallelism）**。

| 概念 | 更关注什么 | 一个直观例子 |
| ---- | ---------- | ------------ |
| 异步 | 顺序是否可以被放宽 | 两个互不依赖的文件保存任务，谁先完成都可以 |
| 并发 | 多个任务能否被同时推进 | 服务器同时处理多个客户端请求 |
| 并行 | 多个任务是否真的在物理上同时运行 | 多核 CPU 上多个线程同时执行 |

### 异步：“顺序是否重要”

异步首先讨论的是**正确性约束**，而不是“有没有多线程”。

如果两个操作只要最终都完成即可，中间顺序并不重要，那么它们就具有异步性。

### 并发：“系统是否能同时推进多个任务”

并发讨论的是**组织方式**。

即使只有一个 CPU 核心，系统也可以通过任务切换，在时间上交替推进多个任务。这仍然是并发，但不一定是并行。

### 并行：“硬件层面是否真的同时执行”

并行强调的是**物理同时执行**。这通常依赖多核 CPU，或者其他底层并行资源。

因此，常见的关系可以这样理解：

- 并发不一定并行
- 异步不一定并发
- 并行通常是实现并发的一种方式

## Zig 中并发编程的阅读重点

Zig 在并发上的一个重要特点是：**尽量把成本和机制显式化**。

这意味着在 Zig 中更常直接面对：

- 线程
- 锁
- 条件变量
- 原子操作
- 共享数据和生命周期边界

而不是一开始就被隐藏在“自动调度器”或“语言级运行时”之后。

这有两个直接后果：

1. 能更清楚地看到并发成本和数据边界
2. 也更需要自己做出正确的设计判断

## 什么时候需要并发？

不是所有程序都需要并发。

更准确地说，通常在下面这些场景里才真的需要它：

- 需要同时处理多个任务
- 存在明显的等待时间，希望程序更有响应性
- 希望利用多核 CPU 加速独立计算任务
- 希望把某些后台工作与主流程解耦

常见例子包括：

- 多客户端服务器
- 并行数据处理
- 图像、音频、视频处理
- 后台日志、监控、缓存刷新

而对于很小的 CLI 工具或纯串行的数据转换脚本，并发往往不是起点。

## 最基础的并发工具：线程

在 Zig 中，最直接的并发入口通常是 `std.Thread`。

### 创建线程

```zig
const std = @import("std");

fn worker(id: usize) void {
    std.debug.print("worker {} start\n", .{id});
    std.time.sleep(200 * std.time.ns_per_ms);
    std.debug.print("worker {} done\n", .{id});
}

pub fn main() !void {
    const t1 = try std.Thread.spawn(.{}, worker, .{1});
    const t2 = try std.Thread.spawn(.{}, worker, .{2});

    t1.join();
    t2.join();
}
```

这段代码展示了最基本的线程模型：

- 主线程创建两个工作线程
- 每个线程执行自己的任务
- 主线程通过 `join()` 等待它们结束

### `join()` 与 `detach()`

线程创建之后，通常要明确选择如何结束它的生命周期。

#### `join()`：等待线程完成

适用于：

- 需要确认工作已经完成
- 后续逻辑依赖线程结果
- 希望生命周期最清晰

#### `detach()`：让线程独立运行

适用于：

- 不打算等待该线程
- 它确实是一个后台任务
- 能保证它不会访问已经释放的资源

> **注意**：
>
> 大多数教程和普通工程代码里，**优先选择 `join()`** 会更安全。`detach()` 更容易引入生命周期错误，尤其是后台线程引用了栈对象、临时缓冲区或即将销毁的分配器时。

## 共享状态：为什么需要同步？

一旦多个线程访问同一份数据，就会出现并发编程里最核心的问题：

- 数据竞争
- 竞态条件
- 内存可见性

例如，下面这个“看起来很简单”的计数器递增，在多线程里其实并不安全：

```zig
counter += 1;
```

因为这并不是一个不可分割的操作。它至少包含：

1. 读取旧值
2. 计算新值
3. 写回结果

多个线程交错执行时，最终结果就可能丢更新。

## 互斥锁：最常见的共享数据保护方式

对于复杂共享数据，最常见的第一选择通常是互斥锁 `std.Thread.Mutex`。

```zig
const std = @import("std");

const Counter = struct {
    mutex: std.Thread.Mutex = .{},
    value: usize = 0,

    pub fn increment(self: *Counter) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.value += 1;
    }

    pub fn get(self: *Counter) usize {
        self.mutex.lock();
        defer self.mutex.unlock();
        return self.value;
    }
};

fn worker(counter: *Counter) void {
    for (0..1000) |_| {
        counter.increment();
    }
}

pub fn main() !void {
    var counter = Counter{};
    var threads: [4]std.Thread = undefined;

    for (&threads) |*thread| {
        thread.* = try std.Thread.spawn(.{}, worker, .{&counter});
    }

    for (threads) |thread| {
        thread.join();
    }

    std.debug.print("final = {}\n", .{counter.get()});
}
```

### 这段代码体现了什么？

- 锁保护的是**共享状态**，不是“线程本身”
- `defer` 能帮助减少忘记解锁的风险
- 把锁和数据封装在一起，通常比在外面散落管理更清晰

### 什么时候优先用锁？

当面对的是：

- 结构体
- map / list / 缓冲区
- 需要多个步骤组成的修改操作
- 不容易用单个原子变量表达的共享状态

这时，锁往往比“试图全部用原子操作硬拼”更清晰、更可靠。

## 条件变量：让线程等待“某个条件成立”

有时线程不是要“抢同一把锁”，而是要等待某个状态变化，例如：

- 队列里终于有数据了
- 某个后台步骤完成了
- 生产者已经放入新任务

这时可以使用 `std.Thread.Condition`。

```zig
const std = @import("std");

// 这些变量必须声明为模块级（全局），因为 std.Thread.spawn 要求线程函数
// 的签名是固定的（不能捕获局部变量的闭包），所以共享状态只能通过全局变量
// 或显式传入的指针来实现。这里用全局变量是为了让示例尽可能简洁。
var mutex: std.Thread.Mutex = .{};
var cond: std.Thread.Condition = .{};
var ready = false;

fn producer() void {
    std.time.sleep(100 * std.time.ns_per_ms); // 模拟生产耗时
    mutex.lock();
    defer mutex.unlock();

    ready = true;
    cond.signal(); // 通知等待中的消费者
}

fn consumer() void {
    mutex.lock();
    defer mutex.unlock();

    while (!ready) {
        cond.wait(&mutex);
    }

    std.debug.print("consumer: resource is ready\n", .{});
}

pub fn main(_: std.process.Init) !void {
    const producer_thread = try std.Thread.spawn(.{}, producer, .{});
    const consumer_thread = try std.Thread.spawn(.{}, consumer, .{});

    consumer_thread.join();
    producer_thread.join();
}
```

### 条件变量的核心模式


- 等待条件变量时，要和一把互斥锁配合使用
- 条件检查通常写在 `while` 循环里，而不是 `if`
- 条件变量不是“数据本身”，而是“状态变化的通知机制”

## 原子操作：适合小而明确的共享状态

如果共享状态非常简单，例如：

- 计数器
- 标志位
- 统计值

那么原子操作往往比锁更轻量。

```zig
const std = @import("std");

const AtomicCounter = struct {
    value: std.atomic.Value(usize) = std.atomic.Value(usize).init(0),

    pub fn increment(self: *AtomicCounter) void {
        _ = self.value.fetchAdd(1, .monotonic);
    }

    pub fn get(self: *AtomicCounter) usize {
        return self.value.load(.monotonic);
    }
};
```

### 什么时候适合用原子操作？

适合：

- 单个数值
- 简单状态位
- 不需要把多个字段作为一个整体同时维护

不适合：

- 复杂结构体的一致性维护
- 多字段必须一起更新的状态
- 逻辑已经很难一眼看懂的并发代码

> **注意**：
>
> 如果在写原子代码时已经开始怀疑“这到底是否还容易验证”，那通常就该重新评估，看看是不是应该回到锁。

## 线程局部变量：避免不必要的共享

并发设计里，一个很重要的思路是：**如果能不共享，就尽量不共享。**

线程局部变量（`threadlocal`）正是这个方向的一种工具。

```zig
const std = @import("std");

// threadlocal 变量必须声明在模块级。每个线程都会拥有自己独立的一份副本，
// 互不干扰，因此不需要锁保护。
threadlocal var local_counter: usize = 0;

fn worker(id: usize) void {
    for (0..3) |_| {
        local_counter += 1;
        std.debug.print("thread {} local = {}\n", .{ id, local_counter });
    }
}

pub fn main(_: std.process.Init) !void {
    var threads: [3]std.Thread = undefined;

    for (&threads, 0..) |*t, i| {
        t.* = try std.Thread.spawn(.{}, worker, .{i});
    }

    for (threads) |t| {
        t.join();
    }

    // 主线程也有自己的 local_counter 副本，它从未被修改过，仍然是 0
    std.debug.print("main thread local = {}\n", .{local_counter});
}
```

运行后会看到，每个线程的 `local_counter` 都从 0 独立递增到 3，互不影响。主线程的副本始终为 0。

每个线程都会拥有自己独立的一份 `local_counter`，因此它不需要互斥锁保护。

### 它适合什么场景？

- 每个线程自己的缓存区
- 线程自己的临时状态
- 每个线程独立的统计信息

### 它不适合什么场景？

- 多个线程必须共享和协调的数据
- 需要全局一致性的计数或状态

## 该选线程、锁、原子，还是条件变量？

可以先用下面这张表建立直觉：

| 场景 | 更常见的起点 |
| ---- | ------------ |
| 把几个独立计算任务分给多个 CPU 核心 | 线程 |
| 多线程共享复杂结构体 | 互斥锁 |
| 只维护一个计数器或标志位 | 原子操作 |
| 一个线程等待另一个线程准备好数据 | 条件变量 |
| 每个线程维护自己的临时状态 | `threadlocal` |

这张表不是绝对规则，但很适合作为第一判断。

## 当前语境下，如何看待“异步 I/O”方向？

可能已经在博客、issue、标准库源码或开发版讨论中看到过与异步 I/O 相关的方向性接口。

对于本教程读者，更重要的是建立一个**稳妥认知**：

1. 这属于更容易演进的区域
2. 它和线程模型不是简单替代关系
3. 教学上更适合先掌握线程、锁、条件变量、原子这些稳定概念
4. 真要落地具体 API，必须以本地版本和源码为准

因此，本章不把某个开发版里的 I/O 并发接口当作“现在必须背下来的主线知识”。

## 并发编程最常见的几个坑

### 1. 把“睡眠等待”当同步机制

`std.time.sleep()` 可以模拟场景，但不能代替真正的同步原语。

如果一个线程要等待另一个线程完成工作，应优先考虑：

- `join()`
- 条件变量
- 队列 / 通知机制

而不是“睡一会儿大概就好了”。

### 2. 锁持有时间过长

如果线程拿着锁做了太多事：

- 其他线程会被阻塞更久
- 争用变多
- 程序更容易出现性能问题或死锁风险

经验上，锁保护的临界区越小越好。

### 3. 分不清共享数据和只读数据

如果数据根本不需要修改，或者天然可以复制给线程，那么就不该急着把它做成共享可变状态。

### 4. `detach()` 线程访问了已经失效的资源

这是非常常见的生命周期错误来源。后台线程引用：

- 栈变量
- 临时切片
- 已经 `deinit()` 的分配器
- 已关闭文件/连接

都可能导致非常难查的问题。

### 5. 过早使用“更高级”的并发技巧

在还没完全掌握线程、锁、条件变量之前，过早上复杂 lock-free 结构、复杂原子协议，通常只会让代码更难验证。

## 关于线程池（Thread Pool）

可能会好奇标准库是否提供了线程池。在当前的 0.16-dev 版本中，`std.Thread` 不包含通用的线程池实现。早期版本曾经存在过 `std.Thread.Pool`，但在标准库重构过程中已被移除。

如果项目需要线程池模式，目前的常见做法是：

- 自己维护一组工作线程 + 任务队列
- 使用社区提供的第三方库
- 关注 `std.Io` 下正在演进的异步 I/O 基础设施，它在某些场景下可以替代传统线程池

对于学习目的，手动管理一组线程加上条件变量通知，恰好是理解线程池内部工作原理的好练习。

## 本章小结

本章的核心判断：

- 并发、并行、异步不是一回事
- Zig 中更常从**显式线程模型**开始理解并发
- 复杂共享状态优先考虑锁
- 简单计数和标志位可以考虑原子操作
- 能不共享，就尽量不共享
- 对版本敏感的异步 I/O 方向，先把它当作“需要结合本地版本核对的高级主题”

如果已经能看清这些边界，那么在后续阅读测试、构建、网络和实战章节时，就更不容易把“并发写法”误当成“只是语法技巧”。