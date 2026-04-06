# 【draft】基础语法（下）- 控制流与资源管理

本章介绍 Zig 的控制流语句和资源管理机制，包括可选类型、条件判断 if、循环（for 和 while）、分支选择 switch、资源管理 defer 和块表达式。与许多语言不同，Zig 的所有控制流语句都是表达式，可以返回值，结合穷尽性检查和编译期验证，确保代码的安全性和可维护性。资源管理方面，Zig 通过 defer 和 errdefer 机制确保资源的正确释放，避免内存泄漏和资源泄漏问题。

## 可选类型（Optional）

Zig 的可选类型使用 `?T` 表示，用于表示值可能存在或不存在的情况，是 Zig 类型系统的重要组成部分。

### 核心概念

- **可选类型**：表示值可能存在（`T`）或不存在（`null`）
- **语法**：`?T` 表示类型 `T` 或 `null`
- **内存布局**：额外存储一个标志位，指示值是否存在

### 为什么需要可选类型？

**问题场景**：
- 查找操作可能找不到结果
- 配置项可能未设置
- 资源可能未初始化

**传统解决方案的问题**：
- C 语言：使用特殊值（如 `-1`、`NULL`）表示"不存在"，容易出错
- Java：使用 `null` 引用，导致 `NullPointerException`
- Zig：使用可选类型，编译期强制处理"不存在"的情况

### Zig 的设计理念

**类型安全**：
- 编译期强制处理 `null` 情况
- 不能直接使用可选值，必须先解包
- 避免空指针异常

**显式处理**：
- 使用 `if`、`orelse`、`.?` 等操作显式处理
- 代码意图清晰，易于理解
- 错误处理逻辑显式可见

### 解包操作

Zig 提供了三种解包可选类型的方式：`if` 模式匹配、`.?` 操作符和 `orelse` 表达式。

#### if 模式匹配

Zig 的 if 可以直接解构可选类型，这是 Zig 的重要特性：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
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
    std.debug.print("修改后：{any}\n", .{mutable_number});
}
```

预期输出：
```
数字是：42
修改后：15
```

#### .? 操作符

`.?` 操作符用于解包可选类型，如果值为 `null` 则触发 panic：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    const maybe_number: ?i32 = 42;
    
    // 使用 .? 操作符（确定不为 null）
    const value = maybe_number.?;
    std.debug.print(".? 操作符: {}\n", .{value});
    
    // ⚠️ 如果为 null 会 panic
    // const maybe_null: ?i32 = null;
    // const bad = maybe_null.?; // 运行时错误：attempt to use null value
}
```

预期输出：
```
.? 操作符: 42
```

**适用场景**：确定值不为 `null`，否则是编程错误。

#### orelse 表达式

`orelse` 用于为 `null` 提供默认值：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    const maybe_null: ?i32 = null;
    
    // 使用 orelse 提供默认值
    const value1 = maybe_null orelse 0;
    std.debug.print("orelse 默认值: {}\n", .{value1});
    
    // orelse 可以接表达式
    const value2 = maybe_null orelse blk: {
        std.debug.print("遇到 null，计算默认值\n", .{});
        break :blk 100;
    };
    std.debug.print("orelse 表达式: {}\n", .{value2});
    
    // orelse 可以接块表达式（提前返回）
    const value3 = maybe_null orelse {
        std.debug.print("值为 null，提前返回\n", .{});
        return;
    };
    _ = value3;
}
```

**适用场景**：需要为 `null` 提供合理的默认值。

#### 三种方式的对比

| 方式     | 用途                    | 安全性 | 适用场景                        |
| -------- | ----------------------- | ------ | ------------------------------- |
| `if`     | 条件处理 null 和非 null | 高     | 需要区分 null 和非 null 的逻辑  |
| `.?`     | 确定不为 null 时使用    | 低     | 确定值不为 null，否则是编程错误 |
| `orelse` | 提供 null 时的默认值    | 高     | 需要为 null 提供合理的默认值    |

#### 实际应用场景

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

### 可选类型与错误联合类型的关联

> 📖 **深入学习**：错误联合类型的详细用法将在[错误处理基础](chapter-error-handling.md)中讲解。

可选类型 `?T` 和错误联合类型 `!T` 都用于表示"可能失败"的值，但用途不同：

| 类型 | 含义               | 使用场景           |
| ---- | ------------------ | ------------------ |
| `?T` | 值可能存在或不存在 | 查找操作、可选配置 |
| `!T` | 操作可能成功或失败 | 可能出错的操作     |

## if 语句

可选类型部分介绍了如何使用 `if` 进行模式匹配来解包可选值，这里将进一步介绍 `if` 语句的其他特性。Zig 的 if 语句相对于其他语言，具有以下特性：

- **模式匹配**：可以解包可选类型和错误联合类型
- **指针捕获**：使用 `|*val|` 捕获指针，允许在分支内修改值
- **类型安全**：所有分支必须返回相同类型的值
- **编译期执行**：支持 comptime if，在编译期进行条件判断

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
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

预期输出：
```
大于 30 但小于等于 50
结果：大数
最大值：100
类别：中
```

### if 表达式 vs 三元运算符

Zig 没有三元运算符（?:），而是使用 if 表达式：

```zig
// 其他语言：const result = condition ? value1 : value2;
// Zig：const result = if (condition) value1 else value2;

const abs_value = if (x >= 0) x else -x;
const max = if (a > b) a else b;
```

## while 循环

前面介绍的 if 语句用于条件判断，而 while 循环则用于重复执行代码块。与 if 类似，while 也支持可选类型解包和作为表达式使用。

Zig 的 while 循环支持：
- **continue 表达式**：每次迭代后执行的表达式
- **可选类型解包**：while 可直接处理可选类型，自动解包并在值为 null 时退出
- **标签**：支持带标签的 break/continue 控制嵌套循环

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    var i: usize = 0;

    // 基本 while 循环
    while (i < 5) {
        std.debug.print("i = {}\n", .{i});
        i += 1;
    }

    // 带 continue 表达式的 while
    // 格式：while (condition) : (continue_expression) { ... }
    // 与写在循环块结尾的区别是：continue 表达式在每次迭代后均执行，而循环块结尾的表达式可以被 continue 跳过
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
    // while 可以直接解包可选值，遇到 null 时自动结束循环
    const numbers = [_]?i32{ 1, 2, null, 4, null };
    var index: usize = 0;

    // 方式1：while 直接处理可选值
    while (numbers[index]) |num| : (index += 1) {
        std.debug.print("有效数字：{}\n", .{num});
        // 当 numbers[index] 为 null 时，循环自动结束
    }

    std.debug.print("--\n", .{});

    // 方式2：使用 if 在 while 内部处理（跳过 null 继续）
    index = 0;
    while (index < numbers.len) : (index += 1) {
        if (numbers[index]) |num| {
            std.debug.print("有效数字：{}\n", .{num});
        }
    }

    std.debug.print("--\n", .{});

    // 标签和带标签的 break/continue
    // 用于控制嵌套循环
    var outer_count: usize = 0;
    outer: while (outer_count < 3) : (outer_count += 1) {
        var inner: usize = 0;
        while (inner < 5) : (inner += 1) {
            if (inner == 2 and outer_count < 2) continue :outer;  // 前两次跳到外层循环
            if (outer_count == 2 and inner == 3) break :outer;    // 第三次跳出外层循环
            std.debug.print("outer={}, inner={}\n", .{ outer_count, inner });
        }
    }
}
```

预期输出：
```
i = 0
i = 1
i = 2
i = 3
i = 4
j = 0
j = 2
j = 4
j = 6
j = 8
k = 0
k = 1
k = 2
有效数字：1
有效数字：2
--
有效数字：1
有效数字：2
有效数字：4
--
outer=0, inner=0
outer=0, inner=1
outer=1, inner=0
outer=1, inner=1
outer=2, inner=0
outer=2, inner=1
outer=2, inner=2
```

### while 作为表达式

while 循环支持 `else` 分支，在循环正常结束（没有 `break`）时执行：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // while 作为表达式返回值
    var i: usize = 0;
    const result = while (i < 10) : (i += 1) {
        if (i == 5) break i * 2;  // 找到后返回 10
    } else 0;  // else 分支：循环正常结束时执行（没有 break）
    
    std.debug.print("结果: {}\n", .{result});  // 输出：结果: 10
    
    // 实际应用：查找第一个满足条件的元素
    const items = [_]i32{ 1, 3, 5, 7, 9 };
    var index: usize = 0;
    const found = while (index < items.len) : (index += 1) {
        if (items[index] > 6) break items[index];
    } else -1;
    
    std.debug.print("找到的元素: {}\n", .{found});  // 输出：找到的元素: 7
}
```

预期输出：
```
结果: 10
找到的元素: 7
```

**关键点**：
- while 循环的 `else` 分支在循环**正常结束**（没有 `break`）时执行
- 使用 `break value` 可以提前退出并返回值
- 所有退出路径（break 和 else）必须返回相同类型的值

### while 循环的实际应用

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

## for 循环

while 循环适合处理不确定次数的迭代，而 for 循环则更适合遍历已知长度的序列。for 循环提供了更简洁的语法来处理数组、切片等数据结构。

Zig 的 for 循环支持：
- **单元素遍历**：直接遍历数组、切片、元组等序列的元素，无需手动管理索引
- **带索引遍历**：使用 `0..` 语法同时获取元素和索引，避免手动计数
- **多序列并行遍历**：同时遍历多个序列，自动处理长度不一致的情况
- **范围遍历**：使用 `start..end` 语法遍历数字范围，简洁直观
- **指针捕获**：使用 `|*item|` 捕获指针，允许在循环中修改元素

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
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

    // 遍历修改后的数组
    for (mutable_array) |item| {
        std.debug.print("double item = {}\n", .{item});
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

预期输出：
```
item = 1
item = 2
item = 3
item = 4
item = 5
array[0] = 1
array[1] = 2
array[2] = 3
array[3] = 4
array[4] = 5
1 + 10 = 11
2 + 20 = 22
3 + 30 = 33
4 + 40 = 44
5 + 50 = 55
double item = 2
double item = 4
double item = 6
double item = 8
double item = 10
i = 0
i = 1
i = 2
i = 3
i = 4
(0, 0)
(0, 1)
(0, 2)
(1, 0)
```

### for 作为表达式

for 循环可以使用 `else` 分支处理循环正常结束的情况：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // for 作为表达式：查找第一个满足条件的元素
    const items = [_]i32{ 1, 3, 5, 7, 9 };
    
    // 方式1：for 循环直接作为表达式
    const found = for (items) |item| {
        if (item > 6) break item;
    } else -1;  // else 分支：循环正常结束时执行（没有 break）
    
    std.debug.print("找到的元素: {}\n", .{found});  // 输出：找到的元素: 7
    
    // 方式2：带标签的 for 循环作为表达式
    const index = search: for (items, 0..) |item, i| {
        if (item > 6) break :search i;
    } else null;
    
    if (index) |i| {
        std.debug.print("找到索引: {}\n", .{i});  // 输出：找到索引: 3
    }
}
```

预期输出：
```
找到的元素: 7
找到索引: 3
```

**关键点**：
- `break value` 可以提前退出并返回值
- 带标签的 for 循环可以更清晰地控制返回

### for 循环的实际应用

```zig
// 场景1：查找元素
fn findItem(items: []const i32, target: i32) ?usize {
    for (items, 0..) |item, index| {
        if (item == target) return index;
    }
    return null;
}

// 场景2：计算聚合值
fn sum(items: []const i32) i32 {
    var total: i32 = 0;
    for (items) |item| {
        total += item;
    }
    return total;
}

// 场景3：数据转换
fn doubleAll(items: []i32) void {
    for (items) |*item| {
        item.* *= 2;
    }
}

// 场景4：并行处理
fn zipWith(a: []const i32, b: []const i32, result: []i32) void {
    for (a, b, result) |x, y, *r| {
        r.* = x + y;
    }
}
```

## switch 语句

前面介绍的 if 语句适合处理简单的条件判断，而 switch 语句则更适合处理多分支选择。switch 提供了更强大的模式匹配能力，并且编译器会强制要求处理所有可能的情况。

Zig 的 switch 语句非常强大：
- **穷尽性检查**：编译器强制要求处理所有可能的情况，避免遗漏分支导致的运行时错误
- **模式匹配**：支持范围匹配（`1...10`）、多值匹配（`1, 2, 3`）、枚举匹配等高级模式
- **表达式**：可以返回值，支持函数式编程风格
- **编译期检查**：编译器在编译期验证所有分支是否被处理，提前发现错误
- **无隐式 fallthrough**：每个 case 自动 break，不会意外执行到下一个分支

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

预期输出：
```
结果：二
等级：B
是元音：true
```

### switch 的高级用法

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

前面介绍的 if、while、for、switch 等控制流语句用于控制代码的执行路径，而 `defer` 则用于确保代码在作用域结束时执行，无论控制流如何跳转。这种机制与控制流紧密配合，确保资源的正确管理。

### 什么是 defer？

`defer` 是 Zig 的资源管理核心机制，它确保指定的代码在当前作用域结束时执行。这类似于其他语言的 RAII（资源获取即初始化）模式。

### 为什么使用 defer？

1. **资源安全释放**：确保文件、内存等资源被正确释放
2. **异常安全**：即使发生错误，defer 代码也会执行
3. **代码清晰**：资源获取和释放代码放在一起，更易理解
4. **减少错误**：避免忘记释放资源

### 基本用法

`defer` 用于确保代码在作用域结束时执行，常用于资源清理：

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

### 实际应用场景

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

### LIFO（后进先出）原则

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

### defer vs errdefer

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
    
    // 使用资源...
    std.debug.print("资源已分配\n", .{});
}
```

## 块表达式（Block Expression）

前面介绍的 if、while、for 等控制流语句都可以作为表达式返回值，而块表达式则提供了另一种创建表达式的方式。块表达式可以包含复杂的逻辑和控制流，最终返回一个值，这在需要计算复杂表达式的场景中非常有用。

在 Zig 中，块（Block）不仅是作用域，还可以作为表达式返回值，但**必须使用标签**。

### 基本语法

```zig
const result = blk: {
    const a = 10;
    const b = 20;
    break :blk a + b;  // 使用 break :label 返回值
};
```

**要点**：
- 块开始处必须有标签（如 `blk:`）
- 使用 `break :label value` 返回值
- 不带标签的块不能返回值，只是一个作用域
- **所有分支的返回值类型必须一致**

### 类型一致性要求

块表达式的所有退出路径必须返回相同类型的值：

```zig
// ❌ 错误：不同分支返回不同类型
const result = blk: {
    if (condition) {
        break :blk 42;      // i32
    } else {
        break :blk "hello"; // 编译错误：类型不匹配
    }
};

// ✅ 正确：所有分支返回相同类型
const result = blk: {
    if (value < 10) break :blk "小";
    if (value < 20) break :blk "中";
    break :blk "大";  // 所有分支都返回 []const u8
};
```

### 完整示例

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // 基本用法：计算并返回值
    const result = blk: {
        const a = 10;
        const b = 20;
        break :blk a + b;
    };
    std.debug.print("块表达式结果: {}\n", .{result});

    // 条件返回：在条件分支中提前退出
    const value: i32 = 15;
    const category = blk: {
        if (value < 10) break :blk "小";
        if (value < 20) break :blk "中";
        break :blk "大";
    };
    std.debug.print("值 {} 的类别: {s}\n", .{ value, category });

    // 嵌套块：使用不同标签区分层级
    const nested = outer: {
        const inner = inner: {
            break :inner 5;
        };
        break :outer inner * 2;
    };
    std.debug.print("嵌套块结果: {}\n", .{nested});
}
```

预期输出：
```
块表达式结果: 30
值 15 的类别: 中
嵌套块结果: 10
```
