# 变量声明和基础类型

本章介绍 Zig 的变量声明和基础类型，包括变量声明规则、基本数据类型、字符和字符串以及类型转换。这些是 Zig 编程的基础，后续章节将在此基础上介绍复合类型、控制流、错误处理和内存管理等核心概念。

## Zig 编程基础

### 变量声明

Zig 是强类型语言，支持类型推断。变量声明使用 `const`（常量）或 `var`（变量）：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
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

### 命名规范

Zig 遵循明确的命名规范，确保代码风格一致：

| 标识符类型                 | 命名规范   | 示例                        |
| -------------------------- | ---------- | --------------------------- |
| 变量、常量                 | snake_case | `user_name`, `max_size`     |
| 函数                       | camelCase  | `calculateTotal`, `isValid` |
| 类型（结构体、枚举、联合） | PascalCase | `Person`, `Status`          |
| 枚举成员                   | PascalCase | `Pending`, `InProgress`     |
| 私有字段和方法             | 下划线前缀 | `_count`, `_validate`       |

```zig
const Person = struct {
    name: []const u8,
    age: u32,
    _internal_id: usize,  // 私有字段
};

const Status = enum {
    Pending,
    InProgress,
    Completed,
};

fn calculateTotal() i32 { }
```

### 注释规范

Zig 支持三种注释形式，用于提高代码可读性和生成文档。

#### 注释类型对比

| 注释类型     | 语法  | 用途                     | 示例           |
| ------------ | ----- | ------------------------ | -------------- |
| 普通注释     | `//`  | 代码说明等               | `// 临时注释`  |
| 文档注释     | `///` | 为结构体、函数等添加文档 | `/// 函数说明` |
| 顶层文档注释 | `//!` | 为文件或模块添加文档     | `//! 模块说明` |

#### 普通注释

使用 `//` 进行单行注释，不会被文档工具提取：

```zig
// 这是单行注释
const x = 10;  // 行尾注释

// 多行注释使用多个单行注释
// 第二行注释
// 第三行注释
const y = 20;
```

#### 文档注释

使用 `///` 为结构体、函数对象等添加文档注释，会被 `zig doc` 工具提取生成 API 文档：

```zig
/// 计算两个整数的和
/// 
/// 参数：
///   - a: 第一个整数
///   - b: 第二个整数
/// 
/// 返回：两个整数的和
/// 
/// 示例：
/// ```zig
/// const result = add(2, 3); // result = 5
/// ```
fn add(a: i32, b: i32) i32 {
    return a + b;
}

/// 用户信息结构体
const Person = struct {
    /// 用户姓名
    name: []const u8,
    /// 用户年龄
    age: u32,
};
```

#### 顶层文档注释

使用 `//!` 为整个文件或模块添加文档说明：

```zig
//! 用户管理模块
//! 
//! 提供用户信息的存储、查询和更新功能。
//! 
//! 示例：
//! ```zig
//! const user = User{ .name = "Alice", .age = 30 };
//! ```

const std = @import("std");

pub const User = struct {
    name: []const u8,
    age: u32,
};
```

顶层文档注释通常放在文件开头，用于说明整个模块的用途和使用方法。

#### 注释最佳实践

1. **解释"为什么"，而不是"是什么"**：
   ```zig
   // ❌ 不好的注释：重复代码
   // 将 x 加 1
   x += 1;
   
   // ✅ 好的注释：解释意图
   // 跳过第一个元素，因为它包含标题
   x += 1;
   ```

2. **保持注释与代码同步**：
   ```zig
   // ❌ 注释过时
   // 最大连接数为 10
   const MAX_CONNECTIONS = 100;  // 实际已改为 100
   ```

3. **使用文档注释而不是普通注释**：
   ```zig
   // ❌ 普通注释不会被文档工具提取
   // 计算总和
   fn sum(a: i32, b: i32) i32 { ... }
   
   // ✅ 文档注释会被提取
   /// 计算总和
   fn sum(a: i32, b: i32) i32 { ... }
   ```

4. **为复杂逻辑添加注释**：
   ```zig
   // 使用位运算优化乘法
   // 等价于 x * 8，但更快
   const result = x << 3;
   ```

### 变量遮蔽规则

Zig **完全禁止**变量遮蔽（Shadowing）。标识符永远不允许使用相同的名称来"隐藏"其他标识符。这意味着：

- **嵌套作用域不能声明同名变量**：内部作用域不能重新声明外部作用域已有的变量名
- **兄弟作用域可以同名**：不嵌套的独立作用域可以使用相同的变量名

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
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

### 解包赋值

Zig 支持解包赋值，可以从元组、向量或数组中一次性提取多个值：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
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
    const first, var second: i32, const third = tuple2; // 变量需要显示声明类型
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

### 整数类型

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // 有符号整数
    const signed_i8: i8 = -128;
    const signed_i16: i16 = -32768;
    const signed_i32: i32 = -2147483648;
    const signed_i64: i64 = -9223372036854775808;
    const signed_i128: i128 = -170141183460469231731687303715884105728;
    
    // 无符号整数
    const unsigned_u8: u8 = 255;
    const unsigned_u16: u16 = 65535;
    const unsigned_u32: u32 = 4294967295;
    const unsigned_u64: u64 = 18446744073709551615;
    const unsigned_u128: u128 = 340282366920938463463374607431768211455;
    
    // 平台相关大小
    const isize_val: isize = 100; // 指针大小
    const usize_val: usize = 200;
    
    // C ABI 兼容类型
    const c_int_val: c_int = 10;
    const c_long_val: c_long = 20;
}
```

### 浮点类型

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
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

Zig 提供了编译期类型，用于在编译时确定值的类型：

- `comptime_int`：编译期整数类型，根据值自动推断位宽
- `comptime_float`：编译期浮点类型，根据值自动推断精度

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    const int_val: comptime_int = 42;      // 编译期确定类型
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

pub fn main(_: std.process.Init.Minimal) void {
    const is_enabled: bool = true;
    const is_disabled: bool = false;
    
    // 布尔运算
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

**要点：**
- 布尔类型占用 1 字节内存
- 支持逻辑运算：`and`（与）、`or`（或）、`!`（非）
- 主要用于条件判断和逻辑运算

> 📖 **深入学习**：布尔类型在控制流中的详细用法请参考[控制流与资源管理](chapter-control-flow.md)。

### 字符类型

字符字面量（如 `'A'`）的类型是 `comptime_int`，表示 Unicode 码位。详细说明请参考本章[字符和字符串](#字符和字符串)章节。

### 基本类型转换

#### 为什么需要显式类型转换？

Zig 的设计哲学是"显式优于隐式"，因此不进行隐式类型转换。这带来以下好处：
1. **避免精度丢失**：所有类型转换都是明确的，不会意外丢失数据
2. **提高代码可读性**：类型转换意图清晰可见
3. **减少运行时错误**：编译期就能发现潜在的类型问题

#### 基本类型转换策略

Zig 提供了多种类型转换方式，每种都有特定的用途和安全保证：

| 转换方式        | 用途           | 安全性                                                                                 | 示例          |
| --------------- | -------------- | -------------------------------------------------------------------------------------- | ------------- |
| `@intCast`      | 整数类型间转换 | **运行时安全检查**（Debug/ReleaseSafe模式panic，ReleaseFast/ReleaseSmall为未定义行为） | `u32` → `u8`  |
| `@floatFromInt` | 整数转浮点     | 安全，可能丢失精度                                                                     | `i32` → `f32` |
| `@intFromFloat` | 浮点转整数     | **运行时安全检查**（Debug/ReleaseSafe模式panic，ReleaseFast/ReleaseSmall为未定义行为） | `f64` → `i32` |
| `@truncate`     | 截断高位       | **不安全**，明确意图（不检查范围）                                                     | `i32` → `u8`  |
| `@bitCast`      | 位模式重解释   | **不安全**，保持位模式                                                                 | `f32` → `u32` |

**示例：**

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // 安全转换：@intCast（运行时检查）
    const small: i32 = 100;
    const small_u8: u8 = @intCast(small); // ✅ OK: 100 在 u8 范围内
    std.debug.print("i32({}) -> u8({})\n", .{ small, small_u8 });

    // 不安全转换：@truncate（直接截断）
    const value: u32 = 300;
    const truncated: u8 = @truncate(value); // ✅ OK: 300 % 256 = 44
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

#### 最佳实践

1. **优先使用安全转换**：`@intCast`、`@floatFromInt` 等有运行时检查的转换
2. **明确不安全操作**：使用 `@truncate`、`@bitCast` 时添加注释说明意图
3. **处理可能的错误**：对于可能失败的转换，先检查范围再使用 `@intCast`，或使用 `std.math.cast`

> 📖 **相关章节**：类型转换失败时的错误处理机制将在[错误处理基础](chapter-error-handling.md)中详细讲解。

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

pub fn main(_: std.process.Init.Minimal) void {
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
- 可以直接打印码位或使用 `{c}` 格式化为字符

> 📖 **深入学习**：字符串格式化（如 `{s}`, `{c}`, `{d}` 等格式说明符）的详细用法请参考[标准库常用模块](../part2-advanced/chapter-standard-library.md#字符串格式化)中的格式化输出部分。

### 字符串字面量

双引号用于字符串字面量，存储为 UTF-8 编码的字节序列：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
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

> 📖 **相关章节**：字符串的底层类型是哨兵终止数组（`*const [N:0]u8`），字符串的长度、索引访问等操作将在[复合类型](chapter-compound-types.md#哨兵终止数组)章节详细讲解。

### 字符 vs 字符串

字符和字符串是不同的概念，使用时需要注意区分：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // 字符：单个 Unicode 码位
    const ch = '我';
    std.debug.print("字符码位: 0x{x}\n", .{ch});  // 0x6211

    // 字符串：UTF-8 编码的字节序列
    const str = "我";
    std.debug.print("字符串: {s}\n", .{str});  // 我
}
```

**核心差异**：
- **字符**（`'我'`）：单个 Unicode 码位，类型是 `comptime_int`
- **字符串**（`"我"`）：UTF-8 编码的字节序列，可以包含多个字符
- **编码差异**：字符 '我' 存储为码位 0x6211，字符串 "我" 存储为 3 个字节（E6 88 91）

**常见误区**：
- ❌ 字符串 `"A"` 不是字符 `'A'`
- ❌ 字符串 `"我"` 的长度不是 1（而是 3 字节）
- ✅ 字符表示单个码位，字符串表示字节序列

### 多行字符串字面量

多行字符串以 `\\` 开头，不执行任何转义，不包含最后一行的换行符：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
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
- 不包含最后的换行符
- 适合嵌入代码、JSON、XML 等文本
