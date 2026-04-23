# 函数定义与调用

函数是 Zig 程序组织逻辑的核心方式。本章涵盖：

- 函数的声明、调用、参数与返回值
- 参数传递的基本思路
- 内建函数概览
- 进阶特性：`anytype`、`extern`、`export`、`inline`、函数类型

## 函数基础

### 函数语法结构

Zig 函数的基本语法结构如下：

```zig
fn 函数名(参数列表) 返回值类型 {
    函数体
}
```

**组成部分说明**：

1. **`fn` 关键字**：函数声明的开始
2. **函数名**：遵循 camelCase 命名规范（如 `calculateTotal`、`processData`）
3. **参数列表**：
   - 格式：`参数名: 类型`
   - 多个参数用逗号分隔
   - 参数默认不可变
4. **返回值类型**：
   - `void` 表示无返回值
   - `?T` 表示可选返回值
   - `!T` 表示错误联合类型
   - `noreturn` 表示永不返回（如 panic、exit）
5. **函数体**：包含具体的逻辑代码

### 基本函数示例

```zig
const std = @import("std");

// 基本函数：两个参数，返回 i32
fn add(a: i32, b: i32) i32 {
    return a + b;
}

// 无返回值函数：使用 void
fn greet(name: []const u8) void {
    std.debug.print("Hello, {s}!\n", .{name});
}

// 可选返回值：使用 ?T
fn divide(a: i32, b: i32) ?i32 {
    if (b == 0) return null;
    return @divTrunc(a, b);
}

// 错误联合类型：使用 !T
const MathError = error{DivisionByZero};
fn safeDivide(a: i32, b: i32) MathError!i32 {
    if (b == 0) return MathError.DivisionByZero;
    return @divTrunc(a, b);
}

pub fn main(_: std.process.Init) void {
    // 调用基本函数
    const sum = add(10, 20);
    std.debug.print("sum: {}\n", .{sum});
    
    // 调用无返回值函数
    greet("Zig");
    
    // 处理可选返回值
    if (divide(10, 2)) |result| {
        std.debug.print("10 / 2 = {}\n", .{result});
    }
    
    // 处理错误联合类型
    const safe_result = safeDivide(10, 2) catch {
        std.debug.print("除零错误\n", .{});
        return;
    };
    std.debug.print("安全除法: {}\n", .{safe_result});
}
```

**预期输出：**
```
sum: 30
Hello, Zig!
10 / 2 = 5
安全除法: 5
```

> **深入学习**：关于 `?T`（可选类型）和 `!T`（错误联合类型）的详细对比，见[错误处理](chapter-error-handling.md)章节。

### Zig 函数的一些基础限制

Zig 不支持以下特性：
- **函数重载**：不能定义同名但参数不同的函数
- **默认参数**：所有参数必须显式传递
- **运行时闭包**：Zig 函数不能捕获外层作用域的运行时变量。需要传递上下文时，应显式通过参数传入。

**替代方案**：
- 使用 `anytype` 实现泛型
- 使用可选参数 `?T` 实现可选值
- 使用结构体参数实现命名参数

```zig
const std = @import("std");

// ❌ 不支持：函数重载
// fn add(a: i32, b: i32) i32 { ... }
// fn add(a: f64, b: f64) f64 { ... }  // 编译错误：重复定义

// ✅ 替代方案：使用 anytype
// 注意：b: @TypeOf(a) 限制 b 与 a 同类型，非 anytype 的通用模式
fn add(a: anytype, b: @TypeOf(a)) @TypeOf(a) {
    return a + b;
}

// ❌ 不支持：默认参数
// fn greet(name: []const u8, greeting: []const u8 = "Hello") void { ... }

// ✅ 替代方案：使用可选参数
fn greet(name: []const u8, greeting: ?[]const u8) void {
    const g = greeting orelse "Hello";
    std.debug.print("{s}, {s}!\n", .{ g, name });
}

pub fn main(_: std.process.Init) void {
    const int_sum = add(10, 20);
    const float_sum = add(3.14, 2.86);
    std.debug.print("int: {}, float: {}\n", .{ int_sum, float_sum });
    
    greet("Zig", null);           // 使用默认值
    greet("World", "Hi");         // 显式传递
}
```

**预期输出：**
```
int: 30, float: 6
Hello, Zig!
Hi, World!
```

> **深入学习**：anytype 的详细内容请参考[编译期计算与元编程](../part2-advanced/chapter-comptime.md#anytype-与动态类型)章节。

### 递归函数

Zig 支持递归函数，但需要注意栈深度限制：

```zig
const std = @import("std");

// 递归计算阶乘
fn factorial(n: u32) u32 {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

// 尾递归形式（注意：Zig 目前不保证尾调用优化）
fn factorialTail(n: u32, acc: u32) u32 {
    if (n <= 1) return acc;
    return factorialTail(n - 1, n * acc);
}

pub fn main(_: std.process.Init) void {
    const result1 = factorial(5);
    const result2 = factorialTail(5, 1);
    std.debug.print("阶乘(5): {}\n", .{result1});
    std.debug.print("尾递归阶乘(5): {}\n", .{result2});
}
```

**预期输出：**
```
阶乘(5): 120
尾递归阶乘(5): 120
```

**注意事项**：
  - 递归深度受栈大小限制
  - Zig 目前不保证尾调用优化，因此深度递归场景通常应优先考虑迭代实现

## 函数参数与调用方式

### 参数传递核心原则

理解 Zig 函数时，先抓住下面三条原则即可：

1. **参数默认不可变**：函数参数不能直接修改，这能减少意外副作用
2. **优先按值语义理解代码**：阅读代码时，先把参数看作"传入了一个值"
3. **需要修改调用者数据时，要显式传递指针**：修改行为必须清楚写出来

> **注意**：编译器可能自动将较大的值参数通过引用传递以避免复制。这是透明的优化，不影响代码语义。

```zig
const std = @import("std");

// 值传递（原始类型）：小类型通过值传递，复制成本很低
fn incrementValue(x: i32) i32 {
    // x += 1; // 编译错误：参数不可变
    return x + 1; // 返回新值
}

// 指针传递（可修改）：当需要修改调用者的数据时，显式传递指针
fn incrementPointer(x: *i32) void {
    x.* += 1; // 通过指针修改
}

// 常量指针传递（不可修改）：大类型通过常量指针传递以避免复制
const BigStruct = struct {
    values: [100]i32,
    name: []const u8,
};

fn printBigStruct(data: *const BigStruct) void {
    std.debug.print("名称：{s}, 第一个值：{}\n", .{ data.name, data.values[0] });
    // data.values[0] = 10; // 编译错误：常量指针不可修改
}

pub fn main(_: std.process.Init) void {
    var num: i32 = 10;
    
    // 值传递：num 不会被修改
    const result = incrementValue(num);
    std.debug.print("incrementValue 结果：{}\n", .{result});
    std.debug.print("原始值不变：{}\n", .{num});
    
    // 指针传递：num 会被修改
    incrementPointer(&num);
    std.debug.print("调用 incrementPointer 后：{}\n", .{num});
    
    // 常量指针传递：高效且安全
    var big_data = BigStruct{
        .values = [_]i32{0} ** 100,
        .name = "测试数据",
    };
    big_data.values[0] = 42;
    printBigStruct(&big_data);
}
```

**预期输出：**
```
incrementValue 结果：11
原始值不变：10
调用 incrementPointer 后：11
名称：测试数据, 第一个值：42
```

### 参数传递策略选择

| 数据类型                 | 推荐传递方式        | 原因                         |
| ------------------------ | ------------------- | ---------------------------- |
| 原始类型（`i32`、`f64` 等） | 值传递              | 复制成本低                   |
| 小结构体                 | 值传递              | 语义直接，复制成本通常可接受 |
| 大结构体                 | `*const T`          | 避免复制，并明确只读借用     |
| 需要修改的数据           | `*T`                | 显式表达可变借用             |
| 允许缺失的小值           | `?T`                | 直接表达"值可能不存在"       |
| 允许缺失的大对象         | `?*const T` 或 `?*T` | 同时表达"可能不存在"和"避免复制" |

**两种常见参数模式**

1. 切片参数：按值传递，但仍可修改底层元素

```zig
fn fillArray(arr: []u8, value: u8) void {
    for (arr) |*item| {
        item.* = value;
    }
}
```

这里的 `arr` 是切片，函数拿到的是切片这个值本身；但切片指向的底层数据仍然可以被修改。  
如果不希望函数修改元素，应使用 `[]const u8`。

2. 输出参数模式：通过指针写回附加结果

这种写法在 C 中很常见；在 Zig 中通常不是首选，但在与 C 交互、复用缓冲区或有明确性能需求时仍然有用。

```zig
fn divideWithRemainder(a: i32, b: i32, remainder: *i32) i32 {
    remainder.* = @mod(a, b);
    return @divTrunc(a, b);
}
```

## 内建函数（入门了解即可）

### 什么是内建函数？

内建函数（Builtin Functions）是 Zig 提供的特殊函数，以 `@` 开头。它们：
- 由编译器直接实现
- 提供底层操作能力
- 是 Zig 元编程的基础

### 常用内建函数分类

| 类别     | 函数                           | 用途             |
| -------- | ------------------------------ | ---------------- |
| 类型操作 | `@TypeOf`, `@typeInfo`         | 获取类型信息     |
| 内存操作 | `@bitCast`, `@ptrCast`         | 内存重解释       |
| 指针操作 | `@ptrFromInt`, `@intFromPtr`   | 指针与整数转换   |
| 编译期   | `@compileError`, `@compileLog` | 编译期诊断       |
| 数学函数 | `@sqrt`, `@sin`, `@cos`        | 常见数学函数调用 | |

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    // 类型信息：获取类型的详细信息
    const type_info = @typeInfo(i32);
    std.debug.print("i32 类型信息：{}\n", .{type_info});

    // 编译期类型推断：获取表达式的类型
    const T = @TypeOf(42);
    std.debug.print("42 的类型：{}\n", .{T});

    // 内存操作：位重解释
    const bytes: [4]u8 = [_]u8{ 1, 2, 3, 4 };
    const as_int: u32 = @bitCast(bytes);
    std.debug.print("字节转整数：{}\n", .{as_int});

    // 指针操作：获取变量地址
    var value: i32 = 42;
    const ptr: *const i32 = &value;
    const addr = @intFromPtr(ptr);
    std.debug.print("指针地址：0x{x}\n", .{addr});

    // 编译期断言
    comptime {
        std.debug.assert(@sizeOf(u64) == 8);
    }
}
```

**预期输出：**
```
i32 类型信息：.{ .int = .{ .signedness = .signed, .bits = 32 } }
42 的类型：comptime_int
字节转整数：67305985
指针地址：0x...
```

> **注意**：`@ptrFromInt` 将整数转换为指针，在非裸机环境下使用硬编码地址会导致未定义行为。仅在嵌入式开发等场景中使用，并确保地址有效。

## 函数高级特性（可先略读）

`pub` 是 Zig 的可见性修饰符，使函数或变量在当前文件外可见。默认情况下，Zig 中的声明是私有的（仅在当前文件可见）。

```zig
// 私有函数：仅当前文件可用
fn helper() void { ... }

// 公开函数：其他文件可以通过 @import 引用
pub fn publicApi() void { ... }
```

**符号可见性对比**：

| 声明方式          | 当前编译单元 | 当前模块 | 其他目标文件       |
| ----------------- | ------------ | -------- | ------------------ |
| `fn foo()`        | ✅ 可见       | ❌ 不可见 | ❌ 不可见           |
| `pub fn foo()`    | ✅ 可见       | ✅ 可见   | ❌ 不可见           |
| `export fn foo()` | ✅ 可见       | ✅ 可见   | ✅ 可见（全局符号） |

### anytype 参数类型

`anytype` 允许函数接受任意类型的参数，编译器会为每种类型生成专门的函数版本（单态化）：

```zig
const std = @import("std");

fn print(value: anytype) void {
    std.debug.print("{}\n", .{value});
}

pub fn main(_: std.process.Init) void {
    print(42);      // 编译器生成 print(i32) 版本
    print(3.14);    // 编译器生成 print(f64) 版本
    print("hello"); // 编译器生成 print(*const [5:0]u8) 版本
}
```

`anytype` 参数会导致函数在编译期为每种实际传入的类型分别生成代码（单态化）。这意味着调用处的类型不匹配会产生编译错误，而不是运行时错误。对于性能敏感的泛型代码，这种方式不会引入运行时开销。

> **深入学习**：anytype 的详细内容请参考[编译期计算与元编程](../part2-advanced/chapter-comptime.md#anytype-与动态类型)章节。

### noreturn 函数类型

`noreturn` 是一个特殊类型，表示函数永远不会返回，用于程序终止（`std.process.exit`）、无限循环和 panic 处理等场景。

`noreturn` 在类型系统中是**底类型（Bottom Type）**，可以隐式转换为任何类型——因为一个永不返回的函数永远不会产生值，所以它可以出现在任何期望某种类型值的上下文中：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const should_panic = false;
    
    if (should_panic) {
        // panicHandler 返回 noreturn，但可以出现在 if 分支中
        @panic("测试 panic");
    }
    
    std.debug.print("程序正常执行\n", .{});
}

// noreturn 的典型应用：在 orelse 块中退出程序
fn getValueOrExit(maybe_value: ?i32) i32 {
    // orelse 块返回 noreturn，可以赋值给 i32
    return maybe_value orelse {
        std.debug.print("错误：值为 null，退出程序\n", .{});
        std.process.exit(1);
    };
}
```

**预期输出：**
```
程序正常执行
```

### export 关键字

`export` 关键字使函数或变量作为**全局符号**导出到目标文件中，并遵循 C ABI 调用约定。用于创建动态库或静态库供其他语言调用。

```zig
const std = @import("std");

// 导出为 C ABI 兼容的函数
export fn addNumbers(a: i32, b: i32) i32 {
    return a + b;
}

// 导出函数供其他语言调用
// 注意：使用 C 兼容的字符串类型
export fn printMessage(msg: [*:0]const u8) void {
    std.debug.print("消息: {s}\n", .{msg});
}

// 导出全局变量
export var globalCounter: i32 = 0;

export fn incrementCounter() void {
    globalCounter += 1;
}

pub fn main(_: std.process.Init) void {
    const result = addNumbers(10, 20);
    std.debug.print("结果: {}\n", .{result});
}
```

### extern 关键字

`extern` 用于声明外部库的函数或变量，供 Zig 调用 C 等语言的代码：

```zig
const std = @import("std");

// 声明外部 C 库函数
extern "c" fn puts(s: [*:0]const u8) c_int;
extern "c" fn atan2(a: f64, b: f64) f64;

// 声明外部变量
extern "c" var errno: c_int;

pub fn main(_: std.process.Init) void {
    // 调用 C 标准库函数
    _ = puts("Hello from C!");
    
    const angle = atan2(1.0, 1.0);
    std.debug.print("atan2(1, 1) = {}\n", .{angle});
}
```

> **深入学习**：Zig 与 C 互操作的完整用法请参考[C 互操作](../part2-advanced/chapter-c-interop.md)。

**链接外部库**：
```bash
zig build-exe main.zig -lc -lm
```

### inline 关键字

`inline` 用于要求编译器以内联方式处理函数；这属于更偏性能和编译期语义的话题。对初学者来说，先知道它存在即可，不必在入门阶段频繁使用。

在很多日常代码里，**是否内联通常应交给编译器判断**；只有在明确知道为什么要这样做时，才考虑显式写出 `inline`。

```zig
const std = @import("std");

// 强制内联函数
inline fn square(x: i32) i32 {
    return x * x;
}

pub fn main(_: std.process.Init) void {
    const result = square(5);
    std.debug.print("平方: {}\n", .{result});
    
    // 在编译期使用内联函数
    comptime {
        const val = square(10);
        std.debug.assert(val == 100);
    }
}
```

**预期输出：**
```
平方: 25
```

**何时使用 inline**：
- 小型、频繁调用的函数
- 性能关键路径
- 编译期计算

**注意事项**：
- 过度使用会增加代码体积
- 不适合复杂函数
- 可能影响编译速度

### 函数类型

这一节展示"函数也是值"的基本概念。

Zig 支持将函数作为值传递，使用函数类型语法：

```zig
const std = @import("std");

// 定义函数类型：接受两个 i32，返回 i32
const BinaryOp = *const fn (i32, i32) i32;

fn add(a: i32, b: i32) i32 {
    return a + b;
}

fn multiply(a: i32, b: i32) i32 {
    return a * b;
}

pub fn main(_: std.process.Init) void {
    // 将函数赋值给变量
    const op: BinaryOp = add;
    std.debug.print("add(3, 4) = {}\n", .{op(3, 4)});
    
    // 动态选择函数
    const op2: BinaryOp = multiply;
    std.debug.print("multiply(3, 4) = {}\n", .{op2(3, 4)});
}
```

**预期输出：**
```
add(3, 4) = 7
multiply(3, 4) = 12
```

> **深入学习**：函数指针在接口和 VTable 中的应用请参考[接口与多态](../part2-advanced/chapter-interfaces.md)。

## 本章要点

本章核心要点：

- 会定义和调用基本函数
- 理解参数、返回值和 `void`
- 知道什么时候用 `?T`，什么时候用 `!T`
- 知道参数默认不可变，修改调用者数据需要显式传指针
- 能区分"入门必须掌握的函数知识"和"后续再深入的高级特性"

| 主题           | 核心概念                                                |
| -------------- | ------------------------------------------------------- |
| **函数基础**   | `fn` 定义函数；参数不可变；支持 `?T`/`!T`/`noreturn` 返回 |
| **参数传递**   | 值语义优先；大类型用 `*const T`；修改用 `*T`            |
| **内建函数**   | `@` 开头；类型操作、内存操作、编译期诊断                 |
| **pub**        | 可见性修饰符；`pub` 跨文件可见，`export` 跨目标文件可见  |
| **anytype**    | 编译期单态化泛型；为每种类型生成专门版本                 |
| **noreturn**   | 底类型，可隐式转换为任何类型；用于 panic、exit           |
| **export/extern** | C ABI 互操作；`export` 导出符号，`extern` 声明外部符号 |
| **inline**     | 强制内联；适合小型频繁调用的函数                         |
| **函数类型**   | `*const fn(...) type` 语法；函数作为值传递               |