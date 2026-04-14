# 控制流、可选类型与资源管理

本章介绍 Zig 中最常用的控制流与资源管理机制，包括可选类型、`if`、`while`、`for`、`switch`、`defer` 和块表达式。你可以把这一章理解为“如何组织程序执行过程”的入门：条件怎么分支、循环怎么展开、值不存在时怎么处理、资源在作用域结束时如何可靠释放。

Zig 的很多控制流结构不只是语句，也是表达式，可以直接返回值；再配合穷尽性检查、显式解包和作用域化的资源清理，代码的行为会更清楚、更容易验证。关于 `errdefer` 的完整展开会放在错误处理章节，本章先聚焦于建立控制流与资源管理的整体直觉。

## 可选类型（Optional）

Zig 的可选类型使用 `?T` 表示，用于表示值可能存在或不存在的情况。C 语言使用特殊值（如 `-1`、`NULL`）表示"不存在"，容易出错；Java 的 `null` 引用导致 `NullPointerException`。Zig 通过可选类型在编译期强制处理"不存在"的情况，避免空指针异常。

**核心概念**：
- `?T` 表示类型 `T` 或 `null`；从语义上看，它表示“这个值可能存在，也可能不存在”
- 不能直接使用可选值，必须先解包（通过 `if`、`orelse`、`.?` 等操作）
- 类型系统区分 `T` 和 `?T`，意图清晰，代码显式可读

可选类型 `?T` 和错误联合类型 `!T` 都用于表示"可能失败"的值，但用途不同：

| 类型 | 含义               | 使用场景           |
| ---- | ------------------ | ------------------ |
| `?T` | 值可能存在或不存在 | 查找操作、可选配置 |
| `!T` | 操作可能成功或失败 | 可能出错的操作     |

> **深入学习**：错误联合类型的详细用法将在[错误处理基础](chapter-error-handling.md)中讲解。

### 解包操作

Zig 提供了三种解包可选类型的方式：`if` 模式匹配、`.?` 操作符和 `orelse` 表达式。其中，`if` 解包会在后文介绍 `if` 语句时结合示例详细说明

#### .? 操作符

`.?` 操作符用于解包可选类型；如果值为 `null`，在 `Debug` / `ReleaseSafe` 等开启运行时安全检查的模式下会触发 panic，在关闭安全检查的模式下则不能依赖这种错误被捕获。因此只应在你确信值不为 `null` 时使用。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
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

pub fn main(_: std.process.Init) void {
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

pub fn main(_: std.process.Init) void {
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

pub fn main(_: std.process.Init) void {
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

pub fn main(_: std.process.Init) void {
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

## while 循环

while 循环用于重复执行代码块，与 if 类似，while 也支持可选类型解包、错误联合类型解包和作为表达式使用。

Zig 的 while 循环支持：
- **continue 表达式**：写在 `while` 条件后的 `: (...)` 部分，每轮迭代结束后、下一轮条件判断前执行；即使循环体中提前执行了 `continue`，它也仍会执行
- **可选类型解包**：while 可以直接处理可选类型，自动解包并在值为 null 时退出
- **错误联合类型解包**：`while` 也可以直接处理错误联合类型；成功时自动解包值，遇到错误时停止继续解包，并将错误交给对应的 `else |err|` 分支处理
- **标签**：支持带标签的 `break` / `continue` 控制嵌套循环；当循环或代码块作为表达式使用时，也可以通过 `break :label value` 返回值

### 基本用法

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
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

pub fn main(_: std.process.Init) void {
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

### while 作为表达式

当 `while` 作为表达式使用时，`break value` 和 `else` 分别对应两种不同的取值路径：前者用于提前结束并返回值，后者用于循环正常结束时提供值。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
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

`while` 更适合“是否继续循环取决于条件”的场景；`for` 更适合遍历数组、切片、范围等**已知序列**。

Zig 的 `for` 循环支持：

- **单元素遍历**：直接遍历数组、切片等序列中的每个元素
- **带索引遍历**：使用 `for (target, 0..) |item, index|` 同时获取元素和索引
- **多序列并行遍历**：按位置同时遍历多个序列；实际使用时通常应保证长度一致
- **范围遍历**：使用 `start..end` 遍历左闭右开的整数范围
- **指针捕获**：使用 `|*item|` 捕获元素指针；若要原地修改数组元素，通常需要遍历 `&array`

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const array = [_]i32{ 1, 2, 3, 4, 5 };

    // 遍历数组：只获取元素值
    for (array) |item| {
        std.debug.print("item = {}\n", .{item});
    }

    // 带索引遍历：同时获取元素和索引
    for (array, 0..) |item, index| {
        std.debug.print("array[{}] = {}\n", .{ index, item });
    }

    // 多序列并行遍历：这里两个数组长度相同，因此可以按位置一一对应
    const array2 = [_]i32{ 10, 20, 30, 40, 50 };
    for (array, array2) |a, b| {
        std.debug.print("{} + {} = {}\n", .{ a, b, a + b });
    }

    // 原地修改元素：遍历 &array，并用 |*item| 捕获元素指针
    var mutable_array = [_]i32{ 1, 2, 3, 4, 5 };
    for (&mutable_array) |*item| {
        item.* *= 2; // 直接写回原数组
    }

    for (mutable_array) |item| {
        std.debug.print("double item = {}\n", .{item});
    }

    // 范围遍历：0..5 表示 0 到 4，不包含 5
    for (0..5) |i| {
        std.debug.print("i = {}\n", .{i});
    }

    // 标签和 break/continue：带标签的 break 可以直接跳出外层循环
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

和 `while` 一样，`for` 也可以作为表达式使用。当它被放在赋值、返回值等“需要结果”的位置时，所有可能的结束路径都必须产生一个值：

- 如果在循环体中执行 `break value`，整个 `for` 表达式的值就是这个 `value`
- 如果序列被遍历完、循环正常结束，则由 `else` 分支提供结果值

这种写法很适合表达“查找成功则返回结果，否则返回默认值”的模式。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const items = [_]i32{ 1, 3, 5, 7, 9 };

    // 找到第一个大于 6 的元素；若没找到则返回 -1
    const found = for (items) |item| {
        if (item > 6) break item;
    } else -1;

    std.debug.print("找到的元素: {}\n", .{found});

    // 返回满足条件元素的索引；若没找到则返回 null
    const index = search: for (items, 0..) |item, i| {
        if (item > 6) break :search i;
    } else null;

    if (index) |i| {
        std.debug.print("找到索引: {}\n", .{i});
    }
}
```

**预期输出：**
```text
找到的元素: 7
找到索引: 3
```

**关键点**：
- `for` 作为表达式时，必须为所有结束路径提供结果
- `break value` 用于提前结束循环，并把 `value` 作为整个 `for` 表达式的结果
- `else` 分支在循环正常结束（没有执行 `break`）时提供结果
- 第二个例子中，`break :search i` 产生 `usize`，`else null` 产生 `null`，因此整个表达式的类型是 `?usize`

## switch 语句

`if` 更适合处理少量、局部的条件判断；当分支较多，或者你希望把“一个值映射成另一个值”时，`switch` 通常更清晰。  
在 Zig 中，`switch` 不仅可用于分支控制，也常直接作为表达式返回结果。

Zig 的 `switch` 具有这些特点：

- **穷尽性检查**：必须覆盖所有可能情况；如果无法逐个列出，通常需要使用 `else` 兜底
- **多种匹配方式**：支持按具体值、多个值、范围以及枚举成员分支
- **可作为表达式**：每个分支都可以产生一个值，整个 `switch` 表达式再把该值返回给外层
- **无隐式 fallthrough**：一个分支匹配后只执行该分支，不会自动继续进入下一个分支

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const number: i32 = 2;

    // 基本 switch：使用 else 处理未显式列出的情况
    const result = switch (number) {
        1 => "一",
        2 => "二",
        3 => "三",
        else => "其他",
    };
    std.debug.print("结果：{s}\n", .{result});

    // 范围匹配：1...10 表示闭区间，包含两端
    const grade: u8 = 85;
    const level = switch (grade) {
        90...100 => "A",
        80...89 => "B",
        70...79 => "C",
        60...69 => "D",
        else => "F",
    };
    std.debug.print("等级：{s}\n", .{level});

    // 多值匹配：多个候选值共用同一分支
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
```text
结果：二
等级：B
是元音：true
```

### switch 的高级用法

除了基本的值匹配外，`switch` 的特性还包括：

- **枚举匹配**：对枚举的所有成员分支，编译器会检查是否穷尽
- **捕获匹配值**：在范围匹配等场景下，把当前匹配到的值绑定到局部变量
- **配合指针修改数据**：在已经拿到指针的前提下，通过 `switch` 有条件地修改原值

```zig
const std = @import("std");

// 枚举匹配：已列出所有枚举成员，因此不需要 else
const Color = enum { red, green, blue };

fn colorToHex(color: Color) u32 {
    return switch (color) {
        .red => 0xFF0000,
        .green => 0x00FF00,
        .blue => 0x0000FF,
    };
}

// 捕获匹配值：1...10 分支中的 |val| 就是当前匹配到的具体值
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

// 配合指针修改原值：for 先拿到元素指针，再由 switch 决定是否修改
fn doublePositive(numbers: []i32) void {
    for (numbers) |*n| {
        switch (n.*) {
            1...100 => |*val| val.* *= 2,
            else => {},
        }
    }
}

pub fn main(_: std.process.Init) void {
    std.debug.print("红色：0x{X}\n", .{colorToHex(.red)});
    std.debug.print("分类：{s}\n", .{classifyNumber(5)});

    var arr = [_]i32{ 3, 50, -1, 99 };
    doublePositive(&arr);
    std.debug.print("翻倍后：{any}\n", .{arr});
}
```

**预期输出：**
```text
红色：0xFF0000
小数字：5
分类：小
翻倍后：{ 6, 100, -1, 198 }
```

**关键点**：

- 对穷尽枚举做 `switch` 时，如果已经覆盖所有枚举成员，就不需要 `else`
- 在 `1...10 => |val| ...` 这种写法中，`val` 是当前匹配到的具体值
- `blk: { ... break :blk value; }` 是一个带标签的块表达式，适合在“先做一点额外操作，再返回分支结果”时使用
- `doublePositive` 中真正拿到原数组元素指针的是 `for (numbers) |*n|`；`switch` 则根据 `n.*` 的值决定是否修改它

## defer 语句

if、while、for、switch 等控制流语句用于控制代码的执行路径，而 `defer` 则用于确保代码在作用域结束时执行，无论控制流如何跳转。`defer` 是 Zig 资源管理的核心机制，类似于其他语言的 RAII 模式——确保资源安全释放、代码清晰（获取和释放放在一起）、减少遗忘。

### 基本用法

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
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

### LIFO（后进先出）原则

多个 defer 按照后进先出的顺序执行，确保资源的正确释放顺序：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
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

> **深入学习**：errdefer 的完整用法（多资源管理、错误捕获 `|err|` 等）请参考[错误处理基础](chapter-error-handling.md#errdefer)。

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

pub fn main(_: std.process.Init) void {
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
