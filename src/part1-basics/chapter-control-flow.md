# 控制流与资源管理

本章介绍 Zig 的控制流语句和资源管理机制，包括可选类型、条件判断 if、循环（for 和 while）、分支选择 switch、资源管理 defer 和块表达式。Zig 的所有控制流语句都是表达式，可以返回值；结合穷尽性检查和编译期验证，确保代码的安全性和可维护性。资源管理方面，Zig 通过 `defer` 和 `errdefer` 机制确保资源的正确释放，避免内存泄漏和资源泄漏问题。

## 可选类型（Optional）

Zig 的可选类型使用 `?T` 表示，用于表示值可能存在或不存在的情况。C 语言使用特殊值（如 `-1`、`NULL`）表示"不存在"，容易出错；Java 的 `null` 引用导致 `NullPointerException`。Zig 通过可选类型在编译期强制处理"不存在"的情况，避免空指针异常。

**核心概念**：
- `?T` 表示类型 `T` 或 `null`，内存布局额外存储一个标志位指示值是否存在
- 不能直接使用可选值，必须先解包（通过 `if`、`orelse`、`.?` 等操作）
- 类型系统区分 `T` 和 `?T`，意图清晰，代码显式可读

可选类型 `?T` 和错误联合类型 `!T` 都用于表示"可能失败"的值，但用途不同：

| 类型 | 含义               | 使用场景           |
| ---- | ------------------ | ------------------ |
| `?T` | 值可能存在或不存在 | 查找操作、可选配置 |
| `!T` | 操作可能成功或失败 | 可能出错的操作     |

> 📖 **深入学习**：错误联合类型的详细用法将在[错误处理基础](chapter-error-handling.md)中讲解。

### 解包操作

Zig 提供了三种解包可选类型的方式：`if` 模式匹配、`.?` 操作符和 `orelse` 表达式。

#### .? 操作符

`.?` 操作符用于解包可选类型，如果值为 `null` 则触发 panic：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    const maybe_number: ?i32 = 42;
    
    const value = maybe_number.?;
    std.debug.print(".? 操作符: {}\n", .{value});
    
    // ⚠️ 如果为 null 会 panic
    // const maybe_null: ?i32 = null;
    // const bad = maybe_null.?; // 运行时错误：attempt to use null value
}
```

**预期输出：**
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
    
    // orelse 可以接块表达式（提前返回）
    const value2 = maybe_null orelse {
        std.debug.print("值为 null，提前返回\n", .{});
        return;
    };
    _ = value2;
}
```

**预期输出：**
```
orelse 默认值: 0
值为 null，提前返回
```

**适用场景**：需要为 `null` 提供合理的默认值或提前退出。

#### 三种解包方式对比

| 方式     | 用途                    | 安全性 | 适用场景                        |
| -------- | ----------------------- | ------ | ------------------------------- |
| `if`     | 条件处理 null 和非 null | 高     | 需要区分 null 和非 null 的逻辑  |
| `.?`     | 确定不为 null 时使用    | 低     | 确定值不为 null，否则是编程错误 |
| `orelse` | 提供 null 时的默认值    | 高     | 需要为 null 提供合理的默认值    |

## if 语句

Zig 的 if 语句相对于其他语言，具有以下特性：

- **模式匹配**：直接解包可选类型（`if (opt) |val|`）和错误联合类型（`if (result) |val| else |err|`）
- **指针捕获**：使用 `|*val|` 捕获指针，允许在分支内修改值
- **类型安全**：所有分支必须返回相同类型的值
- **编译期执行**：支持 comptime if，在编译期进行条件判断

### 基本用法

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
    
    // if 作为表达式：返回值（所有分支必须返回相同类型）
    const result = if (number > 40) "大数" else "小数";
    std.debug.print("结果：{s}\n", .{result});
    
    // 条件初始化
    const max_value = if (number > 100) number else 100;
    std.debug.print("最大值：{}\n", .{max_value});
    
    // 嵌套 if 表达式
    const category = if (number < 10) "小"
                     else if (number < 100) "中"
                     else "大";
    std.debug.print("类别：{s}\n", .{category});
}
```

**预期输出：**
```
大于 30 但小于等于 50
结果：大数
最大值：100
类别：中
```

Zig 没有三元运算符（`?:`），而是使用 if 表达式：`const result = if (condition) value1 else value2;`。这是 Zig 故意的设计——if 表达式更具可读性且无歧义。

### 模式匹配解包可选类型

Zig 的 if 可以直接解构可选类型，这是 Zig 的重要特性：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    const maybe_number: ?i32 = 42;

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
        num.* += 5;
    }
    std.debug.print("修改后：{any}\n", .{mutable_number});
    
    // if 表达式与可选类型结合：简洁的条件计算
    const maybe_value: ?i32 = 42;
    const result = if (maybe_value) |v| v * 2 else 0;
    std.debug.print("结果：{}\n", .{result});
}
```

**预期输出：**
```
数字是：42
修改后：15
结果：84
```

### 模式匹配解包错误联合类型

if 也可以解包错误联合类型，分别处理成功和失败：

```zig
const std = @import("std");

fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

pub fn main(_: std.process.Init.Minimal) void {
    const result = divide(10, 2);
    
    // 成功时 |value| 获取值，失败时 |err| 获取错误
    if (result) |value| {
        std.debug.print("结果：{}\n", .{value});
    } else |err| {
        std.debug.print("错误：{}\n", .{err});
    }
}
```

**预期输出：**
```
结果：5
```

> 📖 **深入学习**：错误联合类型的完整用法请参考[错误处理基础](chapter-error-handling.md)。

## while 循环

while 循环用于重复执行代码块，与 if 类似，while 也支持可选类型解包、错误联合类型解包和作为表达式使用。

Zig 的 while 循环支持：
- **continue 表达式**：每次迭代后执行的表达式，即使循环体中执行了 `continue` 也会执行——这是它与写在循环体末尾代码的关键区别
- **可选类型解包**：while 可直接处理可选类型，自动解包并在值为 null 时退出
- **错误联合类型解包**：while 可直接处理错误联合类型，成功时获取值，失败时退出
- **标签**：支持带标签的 break/continue 控制嵌套循环

### 基本用法

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
    var j: usize = 0;
    while (j < 10) : (j += 2) {
        std.debug.print("j = {}\n", .{j});
        // j += 2 在每次迭代后自动执行，即使 continue 也会执行
    }

    // 处理可选值的 while
    const numbers = [_]?i32{ 1, 2, null, 4, null };
    var index: usize = 0;

    // 方式1：while 直接处理可选值（遇到 null 时结束循环）
    while (numbers[index]) |num| : (index += 1) {
        std.debug.print("有效数字：{}\n", .{num});
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
    outer: for (0..3) |i2| {
        for (0..3) |j2| {
            if (i2 == 1 and j2 == 1) break :outer;
            std.debug.print("({}, {})\n", .{ i2, j2 });
        }
    }
}
```

**预期输出：**
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
有效数字：1
有效数字：2
--
有效数字：1
有效数字：2
有效数字：4
--
(0, 0)
(0, 1)
(0, 2)
(1, 0)
```

### 错误联合类型解包

while 可以直接处理错误联合类型，成功时获取值，失败时通过 `else` 捕获错误：

```zig
const std = @import("std");

fn readByte() !u8 {
    return 'A'; // 模拟读取操作
}

pub fn main(_: std.process.Init.Minimal) void {
    // while 解包错误联合类型
    while (readByte()) |byte| {
        std.debug.print("读取到：{c}\n", .{byte});
        break; // 示例中只读取一次
    } else |err| {
        std.debug.print("读取失败：{}\n", .{err});
    }
}
```

**预期输出：**
```
读取到：A
```

> 📖 **深入学习**：错误联合类型的详细用法请参考[错误处理基础](chapter-error-handling.md)。

### while 作为表达式

while 循环支持 `else` 分支，在循环正常结束（没有 `break`）时执行：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    var i: usize = 0;
    const result = while (i < 10) : (i += 1) {
        if (i == 5) break i * 2;
    } else 0;  // 循环正常结束时执行（没有 break）
    
    std.debug.print("结果: {}\n", .{result});
    
    // 查找第一个满足条件的元素
    const items = [_]i32{ 1, 3, 5, 7, 9 };
    var index: usize = 0;
    const found = while (index < items.len) : (index += 1) {
        if (items[index] > 6) break items[index];
    } else -1;
    
    std.debug.print("找到的元素: {}\n", .{found});
}
```

**预期输出：**
```
结果: 10
找到的元素: 7
```

**关键点**：
- while 循环的 `else` 分支在循环**正常结束**（没有 `break`）时执行
- 使用 `break value` 可以提前退出并返回值
- 所有退出路径（break 和 else）必须返回相同类型的值

## for 循环

while 循环适合处理不确定次数的迭代，而 for 循环则更适合遍历已知长度的序列。

Zig 的 for 循环支持：
- **单元素遍历**：直接遍历数组、切片等序列的元素
- **带索引遍历**：使用 `0..` 语法同时获取元素和索引
- **多序列并行遍历**：同时遍历多个序列
- **范围遍历**：使用 `start..end` 语法遍历数字范围
- **指针捕获**：使用 `|*item|` 捕获指针，允许在循环中修改元素

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    const array = [_]i32{ 1, 2, 3, 4, 5 };

    // 遍历数组：只获取元素
    for (array) |item| {
        std.debug.print("item = {}\n", .{item});
    }

    // 带索引的遍历
    for (array, 0..) |item, index| {
        std.debug.print("array[{}] = {}\n", .{ index, item });
    }

    // 多数组并行遍历
    const array2 = [_]i32{ 10, 20, 30, 40, 50 };
    for (array, array2) |a, b| {
        std.debug.print("{} + {} = {}\n", .{ a, b, a + b });
    }

    // 修改元素：使用指针捕获
    var mutable_array = [_]i32{ 1, 2, 3, 4, 5 };
    for (&mutable_array) |*item| {
        item.* *= 2;
    }

    for (mutable_array) |item| {
        std.debug.print("double item = {}\n", .{item});
    }

    // 范围遍历
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

**预期输出：**
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

for 循环可以使用 `else` 分支处理循环正常结束的情况（与 while 的 `else` 语义一致）：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    const items = [_]i32{ 1, 3, 5, 7, 9 };
    
    // for 循环直接作为表达式
    const found = for (items) |item| {
        if (item > 6) break item;
    } else -1;
    
    std.debug.print("找到的元素: {}\n", .{found});
    
    // 带标签的 for 循环作为表达式
    const index = search: for (items, 0..) |item, i| {
        if (item > 6) break :search i;
    } else null;
    
    if (index) |i| {
        std.debug.print("找到索引: {}\n", .{i});
    }
}
```

**预期输出：**
```
找到的元素: 7
找到索引: 3
```

**关键点**：
- `break value` 可以提前退出并返回值
- `else` 分支在循环正常结束（没有 `break`）时执行
- 带标签的 for 循环可以更清晰地控制返回

## switch 语句

if 语句适合处理简单的条件判断，而 switch 语句则更适合处理多分支选择。switch 提供了更强大的模式匹配能力，并且编译器会强制要求处理所有可能的情况。

Zig 的 switch 语句特性：
- **穷尽性检查**：编译器强制要求处理所有可能的情况，避免遗漏分支
- **模式匹配**：支持范围匹配（`1..10`）、多值匹配（`1, 2, 3`）、枚举匹配等
- **表达式**：可以返回值，支持函数式编程风格
- **无隐式 fallthrough**：每个 case 自动 break

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    const number: i32 = 2;
    
    // 基本 switch：必须穷尽所有情况，使用 else 处理其他
    const result = switch (number) {
        1 => "一",
        2 => "二",
        3 => "三",
        else => "其他",
    };
    std.debug.print("结果：{s}\n", .{result});
    
    // 范围匹配：使用 .. 操作符（闭区间，包含两端）
    const grade: u8 = 85;
    const level = switch (grade) {
        90..100 => "A",
        80..89 => "B",
        70..79 => "C",
        60..69 => "D",
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

**预期输出：**
```
结果：二
等级：B
是元音：true
```

### switch 的高级用法

```zig
const std = @import("std");

// 枚举匹配：编译器确保穷尽，不需要 else
const Color = enum { red, green, blue };

fn colorToHex(color: Color) u32 {
    return switch (color) {
        .red => 0xFF0000,
        .green => 0x00FF00,
        .blue => 0x0000FF,
    };
}

// 捕获匹配值
fn classifyNumber(n: i32) []const u8 {
    return switch (n) {
        0 => "零",
        1..10 => |val| blk: {
            std.debug.print("小数字：{}\n", .{val});
            break :blk "小";
        },
        11..100 => "中",
        else => "大",
    };
}

// 指针捕获：在 switch 中修改匹配的值
fn doublePositive(numbers: []i32) void {
    for (numbers) |*n| {
        switch (n.*) {
            1..100 => |*val| val.* *= 2,  // 通过指针捕获修改原值
            else => {},
        }
    }
}

pub fn main(_: std.process.Init.Minimal) void {
    std.debug.print("红色：0x{X}\n", .{colorToHex(.red)});
    std.debug.print("分类：{s}\n", .{classifyNumber(5)});
    
    var arr = [_]i32{ 3, 50, -1, 99 };
    doublePositive(&arr);
    std.debug.print("翻倍后：{any}\n", .{arr});
}
```

**预期输出：**
```
红色：0xFF0000
小数字：5
分类：小
翻倍后：{ 6, 100, -1, 198 }
```

> 📖 **深入学习**：枚举与 switch 配合使用的更多示例请参考[复合类型](chapter-compound-types.md#枚举)。

## defer 语句

if、while、for、switch 等控制流语句用于控制代码的执行路径，而 `defer` 则用于确保代码在作用域结束时执行，无论控制流如何跳转。`defer` 是 Zig 资源管理的核心机制，类似于其他语言的 RAII 模式——确保资源安全释放、代码清晰（获取和释放放在一起）、减少遗忘。

### 基本用法

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    defer std.debug.print("主函数结束\n", .{});
    std.debug.print("开始\n", .{});

    {
        defer std.debug.print("作用域结束\n", .{});
        std.debug.print("作用域中间\n", .{});
    }

    std.debug.print("结束\n", .{});
}
```

**预期输出：**
```
开始
作用域中间
作用域结束
结束
主函数结束
```

**常见应用**：

```zig
// 文件操作：确保文件关闭
fn readFile(path: []const u8) !void {
    const file = try std.fs.cwd().openFile(path, .{});
    defer file.close();
    // 使用文件...
}

// 内存管理：确保内存释放
fn processBuffer(allocator: std.mem.Allocator) !void {
    const buffer = try allocator.alloc(u8, 1024);
    defer allocator.free(buffer);
    // 使用缓冲区...
}

// 互斥锁：确保解锁
fn protectedOperation(mutex: *std.Thread.Mutex) void {
    mutex.lock();
    defer mutex.unlock();
    // 临界区代码...
}
```

> 📖 **相关章节**：并发编程的详细讲解请参考[并发编程模型](../part2-advanced/chapter-concurrency.md)。

### LIFO（后进先出）原则

多个 defer 按照后进先出的顺序执行，确保资源的正确释放顺序：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    defer std.debug.print("第一个 defer\n", .{});
    defer std.debug.print("第二个 defer\n", .{});
    defer std.debug.print("第三个 defer\n", .{});
    
    std.debug.print("主体代码\n", .{});
}
```

**预期输出：**
```
主体代码
第三个 defer
第二个 defer
第一个 defer
```

### defer vs errdefer

`errdefer` 与 `defer` 类似，但只在函数返回错误时执行，正常返回时不执行。典型场景是**所有权转移**：函数成功时将资源返回给调用者（调用者负责释放），仅在失败时才需要清理。

| 机制        | 执行时机           | 适用场景                     |
| ----------- | ------------------ | ---------------------------- |
| `defer`     | 作用域结束时始终执行 | 资源在函数内完成生命周期     |
| `errdefer`  | 仅函数返回错误时执行 | 资源成功时转移给调用者       |

```zig
fn allocateAndInit(allocator: std.mem.Allocator) !*Resource {
    const resource = try allocator.create(Resource);
    errdefer allocator.destroy(resource);  // 失败时释放
    
    try resource.init();  // 如果这里失败，errdefer 会执行
    return resource;      // 成功时，errdefer 不执行，调用者负责释放
}
```

> 📖 **深入学习**：errdefer 的完整用法（多资源管理、错误捕获 `|err|` 等）请参考[错误处理基础](chapter-error-handling.md#errdefer)。

## 块表达式（Block Expression）

if、while、for 等控制流语句都可以作为表达式返回值，而块表达式则提供了另一种创建表达式的方式。块表达式是一个带标签的作用域，可以包含多条语句和复杂的控制流逻辑，最终通过 `break :label value` 返回一个值。

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
    if (true) {
        break :blk 42;      // i32
    } else {
        break :blk "hello"; // 编译错误：类型不匹配
    }
};

// ✅ 正确：所有分支返回相同类型
const value: i32 = 15;
const category = blk: {
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

**预期输出：**
```
块表达式结果: 30
值 15 的类别: 中
嵌套块结果: 10
```

## 本章要点

| 主题           | 核心概念                                           |
| -------------- | -------------------------------------------------- |
| **可选类型**   | `?T` 表示值或 null；通过 `if`、`.?`、`orelse` 解包 |
| **if**         | 支持模式匹配解包可选类型和错误联合类型；是表达式可返回值 |
| **while**      | 支持 continue 表达式、可选/错误联合类型解包、else 分支 |
| **for**        | 遍历序列；支持索引（`0..`）、并行遍历、指针捕获、范围遍历 |
| **switch**     | 穷尽性检查；支持范围匹配、多值匹配、枚举匹配、值捕获 |
| **defer**      | 作用域结束时执行（LIFO）；`errdefer` 仅错误时执行   |
| **块表达式**   | 带标签的作用域，通过 `break :label value` 返回值   |
