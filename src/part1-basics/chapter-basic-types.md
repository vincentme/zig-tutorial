# 变量、常量与基础类型

本章是 Zig 语法学习的起点。你会先接触最常见、最基础的几个主题：`const` 与 `var` 的区别、作用域与初始化、整数与浮点、布尔值、字符串字面量，以及显式类型转换。

这一章的目标不是一次讲完所有细节，而是帮助你建立几个最重要的直觉：

- Zig 鼓励你明确区分“可变”和“不可变”
- 值的类型通常需要尽早想清楚
- 类型转换应当显式表达意图
- 字符与字符串在 Zig 中是两个不同层次的概念

有些小节会顺带提到后续章节才会系统展开的内容，例如数组、元组、可选类型或格式化输出。第一次阅读时，你只需要先抓住主线，不必急着把所有扩展知识一次吃透。

## 声明、作用域与风格约定

### 变量声明

Zig 是强类型语言，支持类型推断。变量声明使用 `const`（常量）或 `var`（变量）：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const constant: i32 = 42;    // 常量：不可变
    var mutable: i32 = 10;       // 变量：可变

    mutable = 30;                 // 合法
    // constant = 50;             // 编译错误：常量不可修改

    std.debug.print("constant: {}, mutable: {}\n", .{ constant, mutable });
}
```

预期输出：
```
constant: 42, mutable: 30
```

#### undefined

`undefined` 用于声明未初始化的变量，表示该内存区域尚未被赋予有意义的值：

```zig
var buffer: [256]u8 = undefined;  // 声明缓冲区，稍后填充
var x: i32 = undefined;           // 声明占位变量，解包赋值时立即覆盖
```

**重要**：读取 `undefined` 值是非法行为（Illegal Behavior）。在 Debug/ReleaseSafe 模式下会触发 panic。`undefined` 仅用于声明后立即赋值的场景（如解包赋值的占位符、缓冲区分配等）。

#### 编译期常量

Zig 中 `const` 声明的值如果能在编译期确定，会自动成为编译期常量：

- **顶层 `const`**：文件级别的 `const` 声明默认是编译期求值的
- **函数内 `const`**：如果值是编译期已知的（如字面量、comptime 表达式），也会被编译期求值

```zig
const std = @import("std");

const PI = 3.14159;           // 顶层 const，编译期常量

pub fn main(_: std.process.Init) void {
    const answer = 42;         // 编译期常量（值已知）
    var runtime_val: i32 = 10; // 运行时变量
    _ = PI;
    _ = answer;
    _ = &runtime_val;
}
```

### 命名风格建议

这一节更适合作为**本教程的代码风格约定**来理解，而不是把它看成 Zig 语言层面的硬性规则。  
实际项目中，不同团队和代码库可能会有不同风格；阅读 Zig 标准库时，你也会看到与某些语言不同的命名习惯。

本教程后续示例主要采用下面这套较容易阅读的风格：

| 标识符类型                 | 建议风格   | 示例                        |
| -------------------------- | ---------- | --------------------------- |
| 变量、常量                 | snake_case | `user_name`, `max_size`     |
| 函数                       | camelCase  | `calculateTotal`, `isValid` |
| 类型（结构体、枚举、联合） | PascalCase | `Person`, `Status`          |
| 局部辅助名称               | 简短但清晰 | `count`, `index`, `result`  |

最重要的不是“死记某张表”，而是保持以下几点：

- 同一项目内尽量一致
- 名称要能表达意图
- 不要为了简短而牺牲可读性

### 注释

Zig 支持三种注释形式：

| 注释类型     | 语法  | 用途                              |
| ------------ | ----- | --------------------------------- |
| 普通注释     | `//`  | 代码说明                          |
| 文档注释     | `///` | 为声明添加文档，被 `zig doc` 提取 |
| 顶层文档注释 | `//!` | 为文件或模块添加文档              |

```zig
//! 本模块提供用户管理功能

/// 计算两个整数的和
fn add(a: i32, b: i32) i32 {
    return a + b;  // 普通注释
}
```

### 变量遮蔽规则

在局部作用域中，Zig 对变量遮蔽（shadowing）采取了非常严格的态度。  
对初学者来说，可以先把它理解为：

- **嵌套作用域里不要重新声明外层已经存在的同名局部变量**
- **独立的兄弟作用域中可以出现同名变量**

这样做的好处是：

- 避免“看起来像在改同一个变量，实际上换了一个新变量”的错误
- 降低阅读代码时的歧义
- 让编译器更早发现潜在命名冲突

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const pi = 3.14;

    {
        // 编译错误：嵌套块中的变量遮蔽了外层的 pi
        // var pi: i32 = 1234; // error: local variable shadows declaration of 'pi'
    }
}

// 兄弟作用域示例：这是合法的
test "separate scopes" {
    {
        const pi = 3.14;
        _ = pi;
    }
    {
        var pi: bool = true;
        _ = &pi; // 合法：这是不同的作用域，不构成遮蔽
    }
}
```

**设计理念**：
- 避免因变量遮蔽导致的逻辑错误
- 提高代码可读性和可维护性
- 编译器能够更早发现潜在的命名冲突
- 一个标识符在其定义的作用域内始终保持相同的含义

### 解包赋值（语法预览）

Zig 支持解包赋值，可以从元组、向量或数组中一次性提取多个值：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    // 元组解包
    const tuple = .{ 1, 2, 3 };
    var x: i32 = undefined;
    var y: i32 = undefined;
    var z: i32 = undefined;
    x, y, z = tuple;
    std.debug.print("元组解包：x={}, y={}, z={}\n", .{ x, y, z });

    // 向量解包
    const vector: @Vector(3, u32) = .{ 7, 8, 9 };
    var a: u32 = undefined;
    var b: u32 = undefined;
    var c: u32 = undefined;
    a, b, c = vector;
    std.debug.print("向量解包：a={}, b={}, c={}\n", .{ a, b, c });

    // 数组解包
    const array = [_]u32{ 4, 5, 6 };
    var p: u32 = undefined;
    var q: u32 = undefined;
    var r: u32 = undefined;
    p, q, r = array;
    std.debug.print("数组解包：p={}, q={}, r={}\n", .{ p, q, r });

    // 混合声明：可以同时声明常量和变量
    const tuple2 = .{ 10, 20, 30 };
    const first, var second: i32, const third = tuple2; // 变量需要显式声明类型
    second = 25; // 可以修改
    std.debug.print("混合声明：{}, {}, {}\n", .{ first, second, third });
}
```

**预期输出：**
```
元组解包：x=1, y=2, z=3
向量解包：a=7, b=8, c=9
数组解包：p=4, q=5, r=6
混合声明：10, 25, 30
```

## 基本数据类型

### 类型总览

Zig 提供了以下基础类型：

| 类型分类 | 类型                                       | 说明                  |
| -------- | ------------------------------------------ | --------------------- |
| 整数     | `i8`~`i128`, `u8`~`u128`, `isize`, `usize` | 有符号/无符号整数     |
| 浮点     | `f16`, `f32`, `f64`, `f80`, `f128`         | IEEE 浮点数           |
| 布尔     | `bool`                                     | `true` 或 `false`     |
| 空       | `void`                                     | 空类型，大小为 0 字节 |
| 不可达   | `noreturn`                                 | 永不返回的类型        |
| 编译期   | `comptime_int`, `comptime_float`           | 编译期确定的数值类型  |
| 可选     | `?T`                                       | 可能为 `null` 的类型  |

> **深入学习**：可选类型 `?T` 的详细用法请参考[控制流与资源管理](chapter-control-flow.md)。

### 整数类型

Zig 提供了从 8 位到 128 位的整数类型，以及平台相关的 `isize`/`usize`：

| 类型    | 位数 | 最小值         | 最大值        |
| ------- | ---- | -------------- | ------------- |
| `i8`    | 8    | -128           | 127           |
| `u8`    | 8    | 0              | 255           |
| `i16`   | 16   | -32,768        | 32,767        |
| `u16`   | 16   | 0              | 65,535        |
| `i32`   | 32   | -2,147,483,648 | 2,147,483,647 |
| `u32`   | 32   | 0              | 4,294,967,295 |
| `i64`   | 64   | ≈ -9.2 × 10¹⁸  | ≈ 9.2 × 10¹⁸  |
| `u64`   | 64   | 0              | ≈ 1.8 × 10¹⁹  |
| `i128`  | 128  | ≈ -1.7 × 10³⁸  | ≈ 1.7 × 10³⁸  |
| `u128`  | 128  | 0              | ≈ 3.4 × 10³⁸  |
| `isize` | 指针 | 与平台相关     | 与平台相关    |
| `usize` | 指针 | 0              | 与平台相关    |

`isize`/`usize` 的大小与平台指针大小一致（64 位平台上为 64 位），常用于表示内存大小和索引。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const a: i32 = -100;
    const b: u32 = 200;
    const size: usize = 1024;

    std.debug.print("i32: {}, u32: {}, usize: {}\n", .{ a, b, size });
}
```

#### 数字字面量

整数字面量默认类型为 `comptime_int`，浮点字面量默认类型为 `comptime_float`：

```zig
const decimal = 42;          // comptime_int
const hex = 0xFF;            // 十六进制
const octal = 0o755;         // 八进制
const binary = 0b1010;       // 二进制
const float_val = 3.14;      // comptime_float
const readable = 1_000_000;  // 下划线分隔
```

**进制前缀**：
- 十进制：无前缀（如 `42`）
- 十六进制：`0x`（如 `0xFF`）
- 八进制：`0o`（如 `0o755`）
- 二进制：`0b`（如 `0b1010`）

**下划线分隔符**：数字中可插入 `_` 提高可读性（如 `1_000_000`、`0xFFFF_FFFF`、`1_000.0_001`）。

### 浮点类型

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const float_16: f16 = 3.14;      // 16位半精度
    const float_32: f32 = 3.14159;   // 32位单精度
    const float_64: f64 = 3.141592653589793; // 64位双精度
    const float_80: f80 = 3.141592653589793238; // 80位扩展精度
    const float_128: f128 = 3.14159265358979323846264338327950288; // 128位四精度

    std.debug.print("f16: {}, f32: {}, f64: {}, f80: {}, f128: {}\n", .{ float_16, float_32, float_64, float_80, float_128 });
}
```

**预期输出：**
```
f16: 3.140625, f32: 3.14159, f64: 3.141592653589793, f80: 3.141592653589793238, f128: 3.14159265358979323846264338327950288
```

### 编译期类型

Zig 提供了编译期数值类型，用于表示“在编译阶段仍保持精确语义”的数值：

- `comptime_int`：编译期整数类型
- `comptime_float`：编译期浮点类型

它们不应简单理解为“先自动推断成某个固定宽度的整数或浮点类型”，而更适合理解为：

- 在被具体上下文约束之前，它们仍然保留编译期数值语义
- 当你把它们赋给某个具体类型变量，或参与需要确定类型的表达式时，编译器才会将其落实到具体类型上

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const int_val: comptime_int = 42;
    const float_val: comptime_float = 3.14;
    std.debug.print("comptime_int: {}, comptime_float: {}\n", .{ int_val, float_val });
}
```

**预期输出：**
```
comptime_int: 42, comptime_float: 3.14
```

### 布尔类型

布尔类型表示逻辑值，只有 `true` 和 `false` 两个取值：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const is_enabled: bool = true;
    const is_disabled: bool = false;

    const result_and = is_enabled and is_disabled;  // false
    const result_or = is_enabled or is_disabled;    // true
    const result_not = !is_enabled;                  // false

    std.debug.print("and: {}, or: {}, not: {}\n", .{ result_and, result_or, result_not });
}
```

**预期输出：**
```
and: false, or: true, not: false
```

**要点**：
- 独立的 `bool` 值通常可以按 1 字节来理解
- 支持逻辑运算：`and`（与）、`or`（或）、`!`（非）
- 主要用于条件判断和逻辑运算

> **深入学习**：布尔类型在控制流中的详细用法请参考[控制流与资源管理](chapter-control-flow.md)。

### void 和 noreturn

**`void`** 是空类型，大小为 0 字节，用于不返回有用值的函数：

```zig
fn logMessage(msg: []const u8) void {
    std.debug.print("{s}\n", .{msg});
}
```

**`noreturn`** 是永不返回的类型，用于表示程序不会继续执行的位置：

```zig
fn infiniteLoop() noreturn {
    while (true) {}
}
```

`noreturn` 类型的表达式包括：`return`、`while (true) {}`、`unreachable`、`std.process.exit()` 等。

## 类型转换

### 为什么需要显式类型转换？

Zig 的设计哲学是"显式优于隐式"，不进行隐式类型转换。以下代码展示了隐式转换可能带来的问题：

```zig
// 假设 Zig 允许隐式转换（实际不允许）：
// const x: u8 = 300;     // 静默溢出！300 超出 u8 范围
// const y: i32 = 3.14;   // 静默截断！丢失小数部分
// Zig 要求显式声明转换意图，避免此类隐患
```

### 转换方式一览

Zig 提供了多种类型转换方式，每种都有特定的用途和安全保证：

| 转换方式        | 用途           | 安全性                                                                                 | 示例          |
| --------------- | -------------- | -------------------------------------------------------------------------------------- | ------------- |
| `@intCast`      | 整数类型间转换 | **运行时安全检查**（Debug/ReleaseSafe模式panic，ReleaseFast/ReleaseSmall为未定义行为） | `u32` → `u8`  |
| `@floatFromInt` | 整数转浮点     | 不会 panic，但大整数可能丢失精度                                                       | `i32` → `f32` |
| `@intFromFloat` | 浮点转整数     | **运行时安全检查**（Debug/ReleaseSafe模式panic，ReleaseFast/ReleaseSmall为未定义行为） | `f64` → `i32` |
| `@truncate`     | 截断高位       | **不安全**，直接丢弃高位（不检查范围）                                                 | `u32` → `u8`  |
| `@bitCast`      | 位模式重解释   | **不安全**，保持位模式                                                                 | `f32` → `u32` |

> **Result Type Inference**：上表中 `@intCast`、`@truncate`、`@bitCast` 等内建函数支持结果类型推断——通过目标变量的类型自动推断转换的目标类型。例如 `const x: u8 = @intCast(val);` 中，`@intCast` 的目标类型由变量 `x` 的类型 `u8` 推断得出。

### 示例

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    // 安全转换：@intCast（运行时检查）
    const small: i32 = 100;
    const small_u8: u8 = @intCast(small); // OK: 100 在 u8 范围内
    std.debug.print("i32({}) -> u8({})\n", .{ small, small_u8 });

    // 不安全转换：@truncate（直接截断）
    const value: u32 = 300;
    const truncated: u8 = @truncate(value); // 300 % 256 = 44
    std.debug.print("u32({}) -> u8({}) [截断]\n", .{ value, truncated });

    // 位模式重解释：@bitCast
    const float_bits: f32 = 3.14159;
    const bits: u32 = @bitCast(float_bits);
    std.debug.print("f32({}) -> u32(0x{x})\n", .{ float_bits, bits });
}
```

**重要区分**：
- `@intCast` 用于**安全转换**：值必须在目标类型范围内，否则 panic
- `@truncate` 用于**不安全的截断**：直接丢弃高位，不检查范围

### 最佳实践

1. **优先使用安全转换**：`@intCast`、`@floatFromInt` 等有运行时检查的转换
2. **明确不安全操作**：使用 `@truncate`、`@bitCast` 时添加注释说明意图
3. **处理可能的错误**：对于可能失败的转换，先检查范围再使用 `@intCast`，或使用 `std.math.cast`

> **相关章节**：类型转换失败时的错误处理机制将在[错误处理基础](chapter-error-handling.md)中详细讲解。

## 字符和字符串

Zig 提供了强大的字符和字符串支持，原生支持 Unicode。字符和字符串在 Zig 中是两个不同的概念：字符是 Unicode 码位，字符串是 UTF-8 编码的字节序列。

### Unicode 码位与 UTF-8 编码

**核心概念**：
- **Unicode 码位**：字符的唯一标识符，32 位无符号整数[^1]（如 '我' = 0x6211）
- **UTF-8 编码**：不定长编码方式，一个码位对应 1-4 个字节（如 '我' = E6 88 91，3字节）

[^1]: Unicode 码位的实际范围是 0x0000 到 0x10FFFF（21 位），通常用 32 位类型存储以方便处理。

**UTF-8 编码长度规则**：
- 1 字节：ASCII 字符（0x00-0x7F），如 'A' = 0x41
- 2 字节：部分欧洲字符（0x80-0x7FF）
- 3 字节：大部分常用字符，包括中文（0x800-0xFFFF）
- 4 字节：辅助平面字符，如部分表情符号（0x10000-0x10FFFF）

**Zig 的处理方式**：
- **字符字面量**（`'我'`）：存储为 Unicode 码位
- **字符串字面量**（`"我"`）：存储为 UTF-8 编码的字节序列

### 字符字面量

单引号用于字符字面量，得到 Unicode 码位，类型为 `comptime_int`：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    // ASCII 字符
    const letter = 'A';
    std.debug.print("字符: {c}, 码位: {}\n", .{ letter, letter });

    // Unicode 字符（中文）
    const me_zh = '我';
    std.debug.print("字符: {0u} = 码位: 0x{0x}\n", .{me_zh});

    // 表情符号
    const emoji = '☔';
    std.debug.print("表情: {0u}, 码位: 0x{0x}\n", .{emoji});

    // 类型是 comptime_int
    const char_value: comptime_int = 'Z';
    std.debug.print("comptime_int 值: {}\n", .{char_value});
}
```

预期输出：
```
字符: A, 码位: 65
字符: 我 = 码位: 0x6211
表情: ☔, 码位: 0x2614
comptime_int 值: 90
```

**要点**：
- 字符字面量用单引号 `'A'`，类型是 `comptime_int`
- 支持完整的 Unicode 字符集
- 可以直接打印码位，或使用 `{c}` 格式化为 ASCII 字符、`{u}` 格式化为 Unicode 字符

> **深入学习**：字符串格式化（如 `{s}`, `{c}`, `{u}` 等格式说明符）的详细用法请参考[标准库常用模块](../part2-advanced/chapter-standard-library.md#字符串格式化)中的格式化输出部分。

### 字符串字面量

双引号用于字符串字面量，存储为 UTF-8 编码的字节序列：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const str = "Hello, Zig!";

    std.debug.print("字符串: {s}\n", .{str});

    // 字符串可以包含任意 Unicode 字符
    const chinese = "你好，世界！";
    std.debug.print("中文: {s}\n", .{chinese});

    // 字符串可以包含转义字符
    const escaped = "第一行\n第二行\t制表符";
    std.debug.print("转义: {s}\n", .{escaped});
}
```

预期输出：
```
字符串: Hello, Zig!
中文: 你好，世界！
转义: 第一行
第二行	制表符
```

**要点**：
- 字符串字面量用双引号 `"Hello"`
- 支持 UTF-8 编码，可以包含任意 Unicode 字符
- 支持常见的转义字符：`\n`（换行）、`\t`（制表符）、`\\`（反斜杠）、`\"`（双引号）

> **相关章节**：更准确地说，**字符串字面量**的底层类型可理解为哨兵终止字节数组的只读指针（如 `*const [N:0]u8`）。字符串的长度、索引访问以及哨兵终止数组的含义，将在[复合类型](chapter-compound-types.md#哨兵终止数组)章节详细讲解。

### 字符与字符串的区别

| 方面     | 字符 `'我'`         | 字符串 `"我"`       |
| -------- | ------------------- | ------------------- |
| 类型     | `comptime_int`      | `*const [3:0]u8`    |
| 存储内容 | Unicode 码位 0x6211 | UTF-8 字节 E6 88 91 |
| 长度     | 不适用（单个码位）  | 3 字节              |

**常见误区**：
- ❌ 字符串 `"A"` 不是字符 `'A'`
- ❌ 字符串 `"我"` 的长度不是 1（而是 3 字节）
- ✅ 字符表示单个码位，字符串表示字节序列

### 多行字符串字面量

多行字符串以 `\\` 开头，不执行任何转义。行与行之间自动插入换行符，但最后一行末尾不包含换行符：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const multi_line =
        \\第一行
        \\第二行
        \\第三行
    ;

    std.debug.print("多行字符串:\n{s}\n", .{multi_line});

    // 包含特殊字符（无需转义）
    const code =
        \\fn main() void {
        \\    const x = "字符串";
        \\    std.debug.print("{s}\n", .{x});
        \\}
    ;

    std.debug.print("代码:\n{s}\n", .{code});
}
```

预期输出：
```
多行字符串:
第一行
第二行
第三行
代码:
fn main() void {
    const x = "字符串";
    std.debug.print("{s}\n", .{x});
}
```

**特点**：
- 不处理转义序列
- 行与行之间自动插入换行符，最后一行末尾不包含换行符
- 适合嵌入代码、JSON、XML 等文本
