# 【draft】控制流语句

本章介绍 Zig 的控制流语句，包括条件判断、循环和分支选择。Zig 的控制流设计强调显式性和安全性。

## 条件语句

# Zig 控制流的独特设计

与其他语言相比，Zig 的控制流有以下特点：

1. **if 是表达式**：可以返回值，不仅用于控制流
2. **模式匹配**：if 可以解构可选类型和错误联合类型
3. **无三元运算符**：使用 if 表达式替代
4. **编译期执行**：控制流可以在编译期运行

**if 语句：**

# if 语句的核心概念

在 Zig 中，if 不仅是语句，还是表达式。这意味着：
- if 可以返回值
- 必须保证所有分支都返回相同类型的值
- 最后一个表达式就是返回值

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const number: i32 = 42;
    
    // 基本 if 语句：控制流
    if (number > 50) {
        std.debug.print("大于 50\n", .{});
    } else if (number > 30) {
        std.debug.print("大于 30 但小于等于 50\n", .{});
    } else {
        std.debug.print("小于等于 30\n", .{});
    }
    
    // if 作为表达式：返回值
    // 注意：所有分支必须返回相同类型
    const result = if (number > 40) "大数" else "小数";
    std.debug.print("结果：{s}\n", .{result});
    
    // 实际应用：条件初始化
    const max_value = if (number > 100) number else 100;
    std.debug.print("最大值：{}\n", .{max_value});
    
    // 嵌套 if 表达式
    const category = if (number < 10) "小"
                     else if (number < 100) "中"
                     else "大";
    std.debug.print("类别：{s}\n", .{category});
}
```

# if 表达式 vs 三元运算符

Zig 没有三元运算符（?:），而是使用 if 表达式：

```zig
// 其他语言：const result = condition ? value1 : value2;
// Zig：const result = if (condition) value1 else value2;

const abs_value = if (x >= 0) x else -x;
const max = if (a > b) a else b;
```

**处理 Optionals 的 if：**

# 可选类型的模式匹配

Zig 的 if 可以直接解构可选类型，这是 Zig 的重要特性：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const maybe_number: ?i32 = 42;
    
    // 模式匹配：自动解包可选类型
    // 如果 maybe_number 不为 null，number 绑定到内部值
    if (maybe_number) |number| {
        std.debug.print("数字是：{}\n", .{number});
        // number 的类型是 i32，不是 ?i32
    } else {
        std.debug.print("没有数字 (null)\n", .{});
    }
    
    // 捕获指针：可以修改值
    var mutable_number: ?i32 = 10;
    if (mutable_number) |*num| {
        num.* += 5; // 修改内部值
    }
    std.debug.print("修改后：{}\n", .{mutable_number});
    
    // 处理错误联合类型
    const error_value: anyerror!i32 = 42;
    if (error_value) |number| {
        std.debug.print("数字是：{}\n", .{number});
    } else |err| {
        std.debug.print("错误：{}\n", .{err});
    }
}
```

# 实际应用场景

```zig
// 场景1：安全的配置读取
const Config = struct {
    timeout: ?u32,
    max_retries: ?u32,
};

fn getTimeout(config: Config) u32 {
    // 如果配置中有值，使用配置值；否则使用默认值
    return if (config.timeout) |t| t else 30;
}

// 场景2：错误处理
fn readFile(path: []const u8) ?[]const u8 {
    // 可能返回 null
    return null;
}

fn processFile(path: []const u8) void {
    if (readFile(path)) |content| {
        std.debug.print("文件内容：{s}\n", .{content});
    } else {
        std.debug.print("无法读取文件\n", .{});
    }
}

// 场景3：链式可选值处理
fn getNestedValue(data: ?*const Data) ?i32 {
    if (data) |d| {
        if (d.value) |v| {
            return v * 2;
        }
    }
    return null;
}
```

## 循环语句

**while 循环：**

# while 循环的独特之处

Zig 的 while 循环支持：
- **continue 表达式**：每次迭代后执行的表达式
- **可选类型解包**：自动处理可选值
- **标签**：支持嵌套循环的控制

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var i: usize = 0;
    
    // 基本 while 循环
    while (i < 5) {
        std.debug.print("i = {}\n", .{i});
        i += 1;
    }
    
    // 带 continue 表达式的 while
    // 格式：while (condition) : (continue_expression) { ... }
    var j: usize = 0;
    while (j < 10) : (j += 2) {
        std.debug.print("j = {}\n", .{j});
        // j += 2 在每次迭代后自动执行
    }
    
    // 带 break 条件的 while
    var k: usize = 0;
    while (true) {
        if (k >= 3) break;
        std.debug.print("k = {}\n", .{k});
        k += 1;
    }
    
    // 处理可选值的 while
    var numbers = [_]?i32{ 1, 2, null, 4, null };
    var index: usize = 0;
    while (index < numbers.len) : (index += 1) {
        if (numbers[index]) |num| {
            std.debug.print("有效数字：{}\n", .{num});
        }
    }
}
```

# while 循环的实际应用

```zig
// 场景1：读取直到结束
fn readUntilEnd(reader: anytype) !void {
    var buffer: [1024]u8 = undefined;
    while (try reader.read(buffer[0..])) |bytes_read| {
        if (bytes_read == 0) break;
        // 处理数据
    }
}

// 场景2：带重试的操作
fn retryOperation(max_retries: u32) !void {
    var retries: u32 = 0;
    while (retries < max_retries) : (retries += 1) {
        if (tryRiskyOperation()) {
            return; // 成功，退出
        }
        std.time.sleep(1000 * std.time.ns_per_ms);
    }
    return error.MaxRetriesExceeded;
}

// 场景3：迭代器模式
fn Iterator(comptime T: type) type {
    return struct {
        items: []T,
        index: usize = 0,
        
        fn next(self: *@This()) ?T {
            if (self.index >= self.items.len) return null;
            defer self.index += 1;
            return self.items[self.index];
        }
    };
}
```

**for 循环：**

# for 循环的强大功能

Zig 的 for 循环支持：
- **单元素遍历**：遍历数组、切片等
- **带索引遍历**：同时获取元素和索引
- **多序列并行遍历**：同时遍历多个序列
- **范围遍历**：遍历数字范围

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const array = [_]i32{ 1, 2, 3, 4, 5 };
    
    // 遍历数组：只获取元素
    for (array) |item| {
        std.debug.print("item = {}\n", .{item});
    }
    
    // 带索引的遍历：使用 0.. 获取索引
    for (array, 0..) |item, index| {
        std.debug.print("array[{}] = {}\n", .{ index, item });
    }
    
    // 多数组并行遍历：同时遍历两个数组
    const array2 = [_]i32{ 10, 20, 30, 40, 50 };
    for (array, array2) |a, b| {
        std.debug.print("{} + {} = {}\n", .{ a, b, a + b });
    }
    
    // 修改元素：使用指针捕获
    var mutable_array = [_]i32{ 1, 2, 3, 4, 5 };
    for (&mutable_array) |*item| {
        item.* *= 2; // 每个元素乘以 2
    }
    
    // 范围遍历：遍历数字范围
    for (0..5) |i| {
        std.debug.print("i = {}\n", .{i});
    }
    
    // 标签和 break/continue
    outer: for (0..3) |i| {
        for (0..3) |j| {
            if (i == 1 and j == 1) break :outer;
            std.debug.print("({}, {})\n", .{ i, j });
        }
    }
}
```

# for 循环的实际应用

```zig
// 场景1：数据处理管道
fn processBatch(data: []const u8) void {
    for (data) |byte| {
        // 处理每个字节
        _ = byte;
    }
}

// 场景2：查找和过滤
fn findFirst(items: []const i32, target: i32) ?usize {
    for (items, 0..) |item, index| {
        if (item == target) return index;
    }
    return null;
}

// 场景3：矩阵操作
fn matrixAdd(a: [][]f32, b: [][]f32, result: [][]f32) void {
    for (a, b, result) |row_a, row_b, row_result| {
        for (row_a, row_b, row_result) |val_a, val_b, *val_result| {
            val_result.* = val_a + val_b;
        }
    }
}
```

## switch 语句

# switch 的强大功能

Zig 的 switch 语句非常强大：
- **穷尽性检查**：必须处理所有可能的情况
- **模式匹配**：支持范围、多值匹配
- **表达式**：可以返回值
- **编译期检查**：确保所有分支都被处理

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const number: i32 = 2;
    
    // 基本 switch：必须穷尽所有情况
    // 使用 else 处理其他所有情况
    const result = switch (number) {
        1 => "一",
        2 => "二",
        3 => "三",
        else => "其他",
    };
    std.debug.print("结果：{s}\n", .{result});
    
    // 范围匹配：使用 ... 操作符
    // 注意：范围是闭区间（包含两端）
    const grade: u8 = 85;
    const level = switch (grade) {
        90...100 => "A",
        80...89 => "B",
        70...79 => "C",
        60...69 => "D",
        else => "F",
    };
    std.debug.print("等级：{s}\n", .{level});
    
    // 多值匹配：使用逗号分隔
    const char: u8 = 'a';
    const is_vowel = switch (char) {
        'a', 'e', 'i', 'o', 'u' => true,
        'A', 'E', 'I', 'O', 'U' => true,
        else => false,
    };
    std.debug.print("是元音：{}\n", .{is_vowel});
}
```

# switch 的高级用法

```zig
// 场景1：枚举匹配（编译器确保穷尽）
const Color = enum {
    red,
    green,
    blue,
};

fn colorToHex(color: Color) u32 {
    return switch (color) {
        .red => 0xFF0000,
        .green => 0x00FF00,
        .blue => 0x0000FF,
        // 不需要 else：编译器会检查是否穷尽
    };
}

// 场景2：捕获匹配值
fn classifyNumber(n: i32) []const u8 {
    return switch (n) {
        0 => "零",
        1...10 => |val| blk: {
            std.debug.print("小数字：{}\n", .{val});
            break :blk "小";
        },
        11...100 => "中",
        else => "大",
    };
}

// 场景3：指针捕获（修改值）
fn doublePositive(numbers: []i32) void {
    for (numbers) |*n| {
        switch (n.*) {
            1...100 => |*val| val.* *= 2,
            else => {},
        }
    }
}
```

## defer 语句

# 什么是 defer？

`defer` 是 Zig 的资源管理核心机制，它确保指定的代码在当前作用域结束时执行。这类似于其他语言的 RAII（资源获取即初始化）模式。

# 为什么使用 defer？

1. **资源安全释放**：确保文件、内存等资源被正确释放
2. **异常安全**：即使发生错误，defer 代码也会执行
3. **代码清晰**：资源获取和释放代码放在一起，更易理解
4. **减少错误**：避免忘记释放资源

`defer`用于确保代码在作用域结束时执行，常用于资源清理：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("开始\n", .{});

    {
        // defer 在作用域结束时执行
        defer std.debug.print("作用域结束\n", .{});
        std.debug.print("作用域中间\n", .{});
    }

    std.debug.print("结束\n", .{});
}

// 输出顺序：
// 开始
// 作用域中间
// 作用域结束
// 结束
```

# defer 的实际应用

```zig
// 场景1：文件操作
fn readFile(path: []const u8) !void {
    const file = try std.fs.cwd().openFile(path, .{});
    defer file.close(); // 确保文件关闭
    
    // 使用文件...
    // 即使发生错误，文件也会被关闭
}

// 场景2：内存管理
fn processBuffer(allocator: std.mem.Allocator) !void {
    const buffer = try allocator.alloc(u8, 1024);
    defer allocator.free(buffer); // 确保内存释放
    
    // 使用缓冲区...
    // 即使发生错误，内存也会被释放
}

// 场景3：互斥锁
// 📖 **相关章节**：并发编程的详细讲解请参考[并发编程模型](../part2-advanced/chapter-c-interop.md)
fn protectedOperation(mutex: *std.Thread.Mutex) void {
    mutex.lock();
    defer mutex.unlock(); // 确保解锁
    
    // 临界区代码...
    // 即使发生 panic，锁也会被释放
}
```

**多个 defer 的执行顺序：**

# LIFO（后进先出）原则

多个 defer 按照后进先出的顺序执行，这确保了资源的正确释放顺序：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    defer std.debug.print("第一个 defer\n", .{});
    defer std.debug.print("第二个 defer\n", .{});
    defer std.debug.print("第三个 defer\n", .{});
    
    std.debug.print("主体代码\n", .{});
}

// 输出顺序（LIFO - 后进先出）：
// 主体代码
// 第三个 defer
// 第二个 defer
// 第一个 defer
```

# defer vs errdefer

Zig 还提供了 `errdefer`，只在发生错误时执行：

```zig
fn allocateAndInit(allocator: std.mem.Allocator) !*Resource {
    const resource = try allocator.create(Resource);
    // 如果后续代码出错，释放内存
    errdefer allocator.destroy(resource);
    
    try resource.init(); // 如果这里失败，errdefer 会执行
    
    // 成功时，errdefer 不会执行
    return resource;
}
```

**defer 的常见应用场景：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit(); // 确保分配器被清理
    
    const allocator = gpa.allocator();
    
    // 文件操作（0.16.0-dev 新API）
    const file = try std.fs.cwd().openFile("test.txt", .{});
    defer file.close(); // 确保文件被关闭
    
    // 内存分配
    const buffer = try allocator.alloc(u8, 1024);
    defer allocator.free(buffer); // 确保内存被释放
    
    // 使用资源。..
    std.debug.print("资源已分配\n", .{});
}
```

## 线程安全的最佳实践

# 线程安全的数据结构

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
        // 方式1：使用原子操作（推荐，性能更好）
        _ = self.value.fetchAdd(1, .monotonic);
    }
    
    fn incrementComplex(self: *ThreadSafeCounter) void {
        // 方式2：使用互斥锁（复杂操作）
        self.mutex.lock();
        defer self.mutex.unlock();
        // 执行复杂操作...
        const current = self.value.load(.monotonic);
        // 可以进行更复杂的逻辑
        self.value.store(current + 1, .monotonic);
    }
    
    fn get(self: *const ThreadSafeCounter) usize {
        return self.value.load(.monotonic);
    }
};

pub fn main(init: std.process.Init.Minimal) !void {
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

# 选择同步原语的原则

| 场景       | 推荐方案 | 原因           |
| ---------- | -------- | -------------- |
| 简单计数器 | 原子操作 | 性能最优，无锁 |
| 复杂临界区 | 互斥锁   | 保证互斥访问   |
| 读多写少   | 读写锁   | 提高并发度     |
| 等待条件   | 条件变量 | 高效等待       |

# 线程安全检查清单

1. ✅ **识别共享数据**：明确哪些数据会被多个线程访问
2. ✅ **选择同步原语**：根据访问模式选择合适的锁或原子操作
3. ✅ **最小化临界区**：锁的范围越小越好
4. ✅ **避免嵌套锁**：防止死锁
5. ✅ **使用 RAII 模式**：确保锁一定会释放

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
            
            std.time.sleep(100 * std.time.ns_per_ms);  // 模拟工作
            
            m2.lock();  // 可能死锁
            defer m2.unlock();
        }
    }.work, .{ &mutex1, &mutex2 });
    
    // 线程2：先锁 mutex2，再锁 mutex1（相反顺序）
    const thread2 = std.Thread.spawn(.{}, struct {
        fn work(m1: *std.Thread.Mutex, m2: *std.Thread.Mutex) void {
            m2.lock();
            defer m2.unlock();
            
            std.time.sleep(100 * std.time.ns_per_ms);
            
            m1.lock();  // 死锁发生
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
// 💡 最佳实践
fn noDeadlockMethod1() void {
    var mutex1: std.Thread.Mutex = .{};
    var mutex2: std.Thread.Mutex = .{};
    
    // 所有线程按相同顺序加锁
    mutex1.lock();
    defer mutex1.unlock();
    
    mutex2.lock();
    defer mutex2.unlock();
    
    // 执行操作...
}

// ✅ 方法2：使用 tryLock 避免阻塞
fn noDeadlockMethod2() void {
    var mutex1: std.Thread.Mutex = .{};
    var mutex2: std.Thread.Mutex = .{};
    
    mutex1.lock();
    errdefer mutex1.unlock();
    
    if (mutex2.tryLock()) {
        defer mutex2.unlock();
        // 成功获取两个锁
    } else {
        // 无法获取第二个锁，释放第一个锁
        mutex1.unlock();
        // 重试或返回错误
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
        counter += 1;  // 非原子操作，存在竞态
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
// 💡 最佳实践
fn livelockExample() void {
    var mutex: std.Thread.Mutex = .{};
    var should_retry = true;
    
    while (should_retry) {
        if (mutex.tryLock()) {
            defer mutex.unlock();
            // 执行操作
            should_retry = false;
        } else {
            // 立即重试，可能导致活锁
            // 应该添加退避策略
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
            // 执行操作
            break;
        }
        // 指数退避
        std.time.sleep(std.time.ns_per_ms * @as(u64, 1) << @intCast(retry_count));
    }
}
```

## 性能优化建议

# 1. 减少锁竞争

```zig
// ❌ 错误示例
fn inefficientLock(data: *Data) void {
    var mutex: std.Thread.Mutex = .{};
    mutex.lock();
    defer mutex.unlock();
    
    // 整个操作都在临界区内
    processData(data);  // 耗时操作
    saveResult(data);   // 耗时操作
}

// ✅ 最小化临界区
fn efficientLock(data: *Data) void {
    var mutex: std.Thread.Mutex = .{};
    
    // 只在必要时加锁
    mutex.lock();
    const local_copy = data.value;
    mutex.unlock();
    
    // 在锁外处理
    const result = processData(local_copy);
    
    // 只在写回时加锁
    mutex.lock();
    data.result = result;
    mutex.unlock();
}
```

# 2. 使用无锁数据结构

对于简单操作，优先使用原子操作：

```zig
// ✅ 无锁计数器
// 💡 最佳实践
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
    counter1: usize,  // 线程1访问
    counter2: usize,  // 线程2访问
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

---

# 章节练习题

# 基础题

**题目1**：编写一个程序，使用 for 循环打印九九乘法表。

**要求**：
- 使用嵌套 for 循环
- 格式化输出，对齐整齐
- 输出完整的 9x9 乘法表

**解题思路**：
1. 使用两层嵌套 for 循环
2. 外层循环控制行（1-9）
3. 内层循环控制列（1-当前行数）
4. 使用格式化字符串对齐输出

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("九九乘法表：\n\n", .{});
    
    for (1..10) |i| {
        for (1..i + 1) |j| {
            std.debug.print("{}x{}={:2} ", .{ j, i, j * i });
        }
        std.debug.print("\n", .{});
    }
}
```

**预期输出**：
```
九九乘法表：

1x1= 1 
1x2= 2 2x2= 4 
1x3= 3 2x3= 6 3x3= 9 
1x4= 4 2x4= 8 3x4=12 4x4=16 
1x5= 5 2x5=10 3x5=15 4x5=20 5x5=25 
1x6= 6 2x6=12 3x6=18 4x6=24 5x6=30 6x6=36 
1x7= 7 2x7=14 3x7=21 4x7=28 5x7=35 6x7=42 7x7=49 
1x8= 8 2x8=16 3x8=24 4x8=32 5x8=40 6x8=48 7x8=56 8x8=64 
1x9= 9 2x9=18 3x9=27 4x9=36 5x9=45 6x9=54 7x9=63 8x9=72 9x9=81 
```

**题目2**：编写一个程序，使用 while 循环计算阶乘。

**要求**：
- 计算 5! = 5 × 4 × 3 × 2 × 1
- 使用 while 循环
- 输出计算过程和结果

**解题思路**：
1. 初始化结果为 1
2. 使用 while 循环从 1 乘到 5
3. 在循环中累乘
4. 输出结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("=== 阶乘计算 ===\n\n", .{});
    
    var result: u32 = 1;
    var i: u32 = 1;
    const n: u32 = 5;
    
    std.debug.print("计算 {}! = ", .{n});
    
    while (i <= n) : (i += 1) {
        result *= i;
        if (i < n) {
            std.debug.print("{} × ", .{i});
        } else {
            std.debug.print("{} ", .{i});
        }
    }
    
    std.debug.print("= {}\n", .{result});
}
```

**预期输出**：
```
=== 阶乘计算 ===

计算 5! = 1 × 2 × 3 × 4 × 5  = 120
```

**题目3**：编写一个程序，使用 switch 语句判断成绩等级。

**要求**：
- 根据分数（0-100）判断等级
- A: 90-100, B: 80-89, C: 70-79, D: 60-69, F: 0-59
- 输出分数和对应等级

**解题思路**：
1. 使用整数除法将分数映射到等级
2. 使用 switch 匹配等级
3. 输出结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const scores: [5]u32 = [_]u32{ 95, 82, 75, 63, 45 };
    
    std.debug.print("=== 成绩等级判断 ===\n\n", .{});
    
    for (scores) |score| {
        const grade: u8 = @intCast(score / 10);
        const level = switch (grade) {
            10, 9 => "A",
            8 => "B",
            7 => "C",
            6 => "D",
            else => "F",
        };
        std.debug.print("分数 {} -> 等级 {s}\n", .{ score, level });
    }
}
```

**预期输出**：
```
=== 成绩等级判断 ===

分数 95 -> 等级 A
分数 82 -> 等级 B
分数 75 -> 等级 C
分数 63 -> 等级 D
分数 45 -> 等级 F
```

# 进阶题

**题目1**：实现一个简单的猜数字游戏，使用 while 循环和二分查找。

**要求**：
- 生成 1-100 的随机数
- 使用二分查找策略猜测
- 提示"太大"、"太小"或"正确"
- 记录猜测次数
- 输出猜测过程

**解题思路**：
1. 使用 `std.Random` 生成随机数
2. 使用 while 循环持续游戏
3. 使用 if-else 判断大小
4. 使用二分查找更新猜测范围
5. 猜对后退出循环

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var prng = std.Random.DefaultPrng.init(42);
    const random = prng.random();
    
    const target = random.intRangeAtMost(u32, 1, 100);
    var guess: u32 = 50;
    var attempts: u32 = 0;
    var low: u32 = 1;
    var high: u32 = 100;
    
    std.debug.print("=== 猜数字游戏 ===\n", .{});
    std.debug.print("目标数字（秘密）：{}\n\n", .{target});
    
    while (guess != target) {
        attempts += 1;
        std.debug.print("第 {} 次猜测：{}", .{ attempts, guess });
        
        if (guess < target) {
            std.debug.print(" - 太小！\n", .{});
            low = guess + 1;
        } else if (guess > target) {
            std.debug.print(" - 太大！\n", .{});
            high = guess - 1;
        } else {
            std.debug.print(" - 正确！\n", .{});
            break;
        }
        
        guess = (low + high) / 2;
    }
    
    std.debug.print("\n恭喜！你用了 {} 次猜对了数字 {}！\n", .{ attempts, target });
}
```

**预期输出**（示例）：
```
=== 猜数字游戏 ===
目标数字（秘密）：73

第 1 次猜测：50 - 太小！
第 2 次猜测：75 - 太大！
第 3 次猜测：62 - 太小！
第 4 次猜测：68 - 太小！
第 5 次猜测：71 - 太小！
第 6 次猜测：73 - 正确！

恭喜！你用了 6 次猜对了数字 73！
```

**题目2**：实现一个简单的状态机，使用 labeled switch 控制状态转换。

**要求**：
- 定义至少 4 个状态（如：空闲、运行、暂停、停止）
- 使用 labeled switch 实现状态转换
- 模拟状态机的执行过程
- 输出状态转换路径

**解题思路**：
1. 定义状态枚举
2. 使用 labeled switch 实现状态机
3. 使用 `continue :label` 实现状态转换
4. 使用计数器限制循环次数
5. 输出状态转换过程

**参考答案**：
```zig
const std = @import("std");

const State = enum {
    idle,
    running,
    paused,
    stopped,
};

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("=== 状态机演示 ===\n\n", .{});
    
    var current_state: State = .idle;
    var step: u32 = 0;
    const max_steps = 10;
    
    std.debug.print("初始状态：{s}\n\n", .{@tagName(current_state)});
    
    state_machine: switch (current_state) {
        .idle => {
            step += 1;
            std.debug.print("步骤 {} - 状态：空闲\n", .{step});
            std.debug.print("  -> 启动系统\n", .{});
            current_state = .running;
            if (step < max_steps) continue :state_machine current_state;
        },
        .running => {
            step += 1;
            std.debug.print("步骤 {} - 状态：运行中\n", .{step});
            
            if (step == 3) {
                std.debug.print("  -> 暂停系统\n", .{});
                current_state = .paused;
                continue :state_machine current_state;
            } else if (step == 7) {
                std.debug.print("  -> 停止系统\n", .{});
                current_state = .stopped;
                continue :state_machine current_state;
            } else {
                std.debug.print("  -> 继续运行\n", .{});
                if (step < max_steps) continue :state_machine current_state;
            }
        },
        .paused => {
            step += 1;
            std.debug.print("步骤 {} - 状态：已暂停\n", .{step});
            std.debug.print("  -> 恢复运行\n", .{});
            current_state = .running;
            if (step < max_steps) continue :state_machine current_state;
        },
        .stopped => {
            step += 1;
            std.debug.print("步骤 {} - 状态：已停止\n", .{step});
            std.debug.print("  -> 系统终止\n", .{});
            break :state_machine;
        },
    }
    
    std.debug.print("\n状态机执行完成！总步骤：{}\n", .{step});
}
```

**预期输出**：
```
=== 状态机演示 ===

初始状态：idle

步骤 1 - 状态：空闲
  -> 启动系统
步骤 2 - 状态：运行中
  -> 继续运行
步骤 3 - 状态：运行中
  -> 暂停系统
步骤 4 - 状态：已暂停
  -> 恢复运行
步骤 5 - 状态：运行中
  -> 继续运行
步骤 6 - 状态：运行中
  -> 继续运行
步骤 7 - 状态：运行中
  -> 停止系统
步骤 8 - 状态：已停止
  -> 系统终止

状态机执行完成！总步骤：8
```

# 挑战题

**题目**：实现一个简单的文本解析器，使用控制流语句解析简单的命令。

**要求**：
- 支持以下命令：`PRINT <message>`、`REPEAT <n> <message>`、`EXIT`
- 使用字符串比较和循环
- 输出解析结果和执行过程
- 处理无效命令

**解题思路**：
1. 定义命令枚举
2. 使用字符串比较识别命令
3. 使用循环处理 REPEAT 命令
4. 使用 switch 或 if-else 处理不同命令
5. 输出执行结果

**参考答案**：
```zig
const std = @import("std");

const Command = enum {
    print,
    repeat,
    exit,
    unknown,
};

fn parseCommand(input: []const u8) Command {
    if (std.mem.startsWith(u8, input, "PRINT ")) {
        return .print;
    } else if (std.mem.startsWith(u8, input, "REPEAT ")) {
        return .repeat;
    } else if (std.mem.eql(u8, input, "EXIT")) {
        return .exit;
    } else {
        return .unknown;
    }
}

pub fn main(init: std.process.Init.Minimal) void {
    const commands: [5][]const u8 = [_][]const u8{
        "PRINT Hello, World!",
        "REPEAT 3 Zig is awesome!",
        "INVALID",
        "PRINT Goodbye!",
        "EXIT",
    };
    
    std.debug.print("=== 文本命令解析器 ===\n\n", .{});
    
    var running = true;
    var cmd_index: usize = 0;
    
    while (running and cmd_index < commands.len) {
        const cmd = commands[cmd_index];
        std.debug.print("命令：{s}\n", .{cmd});
        
        switch (parseCommand(cmd)) {
            .print => {
                const message = cmd["PRINT ".len..];
                std.debug.print("  输出：{s}\n\n", .{message});
            },
            .repeat => {
                const rest = cmd["REPEAT ".len..];
                var iter = std.mem.split(u8, rest, " ");
                const count_str = iter.next() orelse "0";
                const count = std.fmt.parseInt(u32, count_str, 10) catch 0;
                const message = iter.rest();
                
                std.debug.print("  重复 {} 次：\n", .{count});
                var i: u32 = 0;
                while (i < count) : (i += 1) {
                    std.debug.print("    {d}: {s}\n", .{ i + 1, message });
                }
                std.debug.print("\n", .{});
            },
            .exit => {
                std.debug.print("  退出程序\n\n", .{});
                running = false;
            },
            .unknown => {
                std.debug.print("  错误：未知命令\n\n", .{});
            },
        }
        
        cmd_index += 1;
    }
    
    std.debug.print("解析器执行完成！\n", .{});
}
```

**预期输出**：
```
=== 文本命令解析器 ===

命令：PRINT Hello, World!
  输出：Hello, World!

命令：REPEAT 3 Zig is awesome!
  重复 3 次：
    1: Zig is awesome!
    2: Zig is awesome!
    3: Zig is awesome!

命令：INVALID
  错误：未知命令

命令：PRINT Goodbye!
  输出：Goodbye!

命令：EXIT
  退出程序

解析器执行完成！
```

---
