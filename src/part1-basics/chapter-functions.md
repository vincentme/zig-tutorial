# 函数定义与调用

函数是 Zig 程序的基本构建块。Zig 的函数设计体现了语言的核心特性：显式错误处理通过错误联合类型实现、参数默认不可变确保安全性、无隐式内存分配保证性能可控。本章将介绍函数的定义、参数传递、错误处理和高级特性。

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

pub fn main(_: std.process.Init.Minimal) void {
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

**预期输出**：
```
sum: 30
Hello, Zig!
10 / 2 = 5
安全除法: 5
```

### Zig 函数的限制

Zig 不支持以下特性：
- **函数重载**：不能定义同名但参数不同的函数
- **默认参数**：所有参数必须显式传递

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

pub fn main(_: std.process.Init.Minimal) void {
    const int_sum = add(10, 20);
    const float_sum = add(3.14, 2.86);
    std.debug.print("int: {}, float: {}\n", .{ int_sum, float_sum });
    
    greet("Zig", null);           // 使用默认值
    greet("World", "Hi");         // 显式传递
}
```

**预期输出**：
```
int: 30, float: 6
Hello, Zig!
Hi, World!
```

### 递归函数

Zig 支持递归函数，但需要注意栈深度限制：

```zig
const std = @import("std");

// 递归计算阶乘
fn factorial(n: u32) u32 {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

// 尾递归优化
fn factorialTail(n: u32, acc: u32) u32 {
    if (n <= 1) return acc;
    return factorialTail(n - 1, n * acc);
}

pub fn main(_: std.process.Init.Minimal) void {
    const result1 = factorial(5);
    const result2 = factorialTail(5, 1);
    std.debug.print("阶乘(5): {}\n", .{result1});
    std.debug.print("尾递归阶乘(5): {}\n", .{result2});
}
```

**预期输出**：
```
阶乘(5): 120
尾递归阶乘(5): 120
```

**注意事项**：
- 递归深度受栈大小限制
- 尾递归可能被编译器优化
- 对于深度递归，考虑使用迭代替代

## 函数参数传递

### Zig 参数传递的核心原则

Zig 采用独特的参数传递策略，理解这一点对于编写高效、安全的代码至关重要：

1. **参数默认不可变**：防止意外修改，提高代码可预测性
2. **值语义优先**：所有参数按值传递（语义上），编译器可能优化大结构体的传递为常量指针传递
3. **显式传递意图**：需要修改时必须显式传递指针

### 为什么参数不可变？

不可变参数带来以下好处：
- **函数纯净性**：函数不会产生副作用，更易推理
- **编译器优化**：编译器可以做更激进的优化
- **并发安全**：不可变数据天然线程安全
- **避免错误**：防止意外修改调用者的数据

Zig 中函数参数是不可变的：

```zig
const std = @import("std");

// 值传递（原始类型）
// 小类型（如 i32）通过值传递，复制成本很低
fn incrementValue(x: i32) i32 {
    // x += 1; // 编译错误：参数不可变
    return x + 1; // 返回新值
}

// 指针传递（可修改）
// 当需要修改调用者的数据时，显式传递指针
fn incrementPointer(x: *i32) void {
    x.* += 1; // 通过指针修改
}

// 常量指针传递（不可修改）
// 大类型通过常量指针传递以避免复制，但不允许修改
const BigStruct = struct {
    values: [100]i32,
    name: []const u8,
};

fn printBigStruct(data: *const BigStruct) void {
    std.debug.print("名称：{s}, 第一个值：{}\n", .{ data.name, data.values[0] });
    // data.values[0] = 10; // 编译错误：常量指针不可修改
}

pub fn main(_: std.process.Init.Minimal) void {
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

预期输出
```
incrementValue 结果：11
原始值不变：10
调用 incrementPointer 后：11
名称：测试数据, 第一个值：42
```

### 参数传递策略选择

| 数据类型               | 推荐传递方式        | 原因           |
| ---------------------- | ------------------- | -------------- |
| 原始类型（i32, f64等） | 值传递              | 复制成本低     |
| 小结构体（≤指针大小）  | 值传递              | 复制成本可接受 |
| 大结构体               | `*const T`          | 避免复制       |
| 需要修改的数据         | `*T`                | 显式表达意图   |
| 可选数据               | `?T` 或 `*const ?T` | 根据大小选择   |

### 实际应用示例

```zig
// 场景1：大型结构体的高效传递
const BigData = struct {
    values: [1000]f32,
    metadata: [100]u8,
};

// 使用常量指针避免复制
fn processBigData(data: *const BigData) f32 {
    var sum: f32 = 0;
    for (data.values) |v| {
        sum += v;
    }
    return sum;
}

// 场景2：修改调用者的数据
fn fillArray(arr: []u8, value: u8) void {
    for (arr) |*item| {
        item.* = value;
    }
}

// 场景3：输出参数模式
fn divideWithRemainder(a: i32, b: i32, remainder: *i32) i32 {
    remainder.* = @mod(a, b);
    return @divTrunc(a, b);
}
```

## 内建函数

### 什么是内建函数？

内建函数（Builtin Functions）是 Zig 提供的特殊函数，以 `@` 开头。它们：
- 由编译器直接实现
- 提供底层操作能力
- 是 Zig 元编程的基础

### 常用内建函数分类

| 类别     | 函数                         | 用途           |
| -------- | ---------------------------- | -------------- |
| 类型操作 | `@TypeOf`, `@typeInfo`       | 获取类型信息   |
| 内存操作 | `@bitCast`, `@ptrCast`       | 内存重解释     |
| 指针操作 | `@ptrFromInt`, `@intFromPtr` | 指针与整数转换 |
| 编译期   | `@comptime`, `@compileError` | 编译期计算     |
| 数学运算 | `@sqrt`, `@sin`, `@cos`      | 数学函数       |

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
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

    // 指针操作：指针与整数转换
    const ptr: *const i32 = @ptrFromInt(0x1000);
    const addr = @intFromPtr(ptr);
    std.debug.print("指针地址：{x}\n", .{addr});

    // 编译期断言：在编译期检查条件
    comptime {
        std.debug.assert(@sizeOf(u64) == 8);
    }
}
```

预期输出
```
i32 类型信息：.{ .int = .{ .signedness = .signed, .bits = 32 } }
42 的类型：comptime_int
字节转整数：67305985
指针地址：1000
```

## 函数高级特性

### anytype 参数类型

`anytype` 允许函数接受任意类型的参数，编译器会为每种类型生成专门的函数版本（单态化）：

```zig
fn print(value: anytype) void {
    std.debug.print("{}\n", .{value});
}

print(42);      // 编译器生成 print(i32) 版本
print(3.14);    // 编译器生成 print(f64) 版本
print("hello"); // 编译器生成 print(*const [5:0]u8) 版本
```

> 📖 **深入学习**：anytype 的详细内容请参考[编译期计算与元编程](../part2-advanced/chapter-comptime.md#anytype-与动态类型)章节。

### noreturn 函数类型

`noreturn` 是一个特殊类型，表示函数永远不会返回。这用于：
- 表示程序终止
- 无限循环
- 错误处理（如 panic）

#### 为什么需要 noreturn？

1. **类型系统完整性**：让编译器知道某些代码路径不会继续
2. **优化提示**：编译器可以进行更好的控制流分析
3. **代码清晰**：明确表达函数的意图

```zig
const std = @import("std");

// 永不返回的函数：无限循环
fn panicHandler(message: []const u8) noreturn {
    std.debug.print("PANIC: {s}\n", .{message});
    while (true) {} // 必须确保永不返回
}

// 退出程序：系统调用
fn exitProgram(code: u8) noreturn {
    std.process.exit(code);
}

pub fn main(_: std.process.Init.Minimal) void {
    const should_panic = false;
    
    if (should_panic) {
        panicHandler("测试 panic");
    }
    
    std.debug.print("程序正常执行\n", .{});
}
```

预期输出
```
程序正常执行
```

**使用场景**：
- 错误处理函数（如 panic）
- 无限循环
- 程序退出

#### noreturn 的类型系统作用

`noreturn` 在类型系统中有一个特殊属性：**可以隐式转换为任何类型**。这是因为一个永不返回的函数永远不会产生值，所以它可以出现在任何期望某种类型值的上下文中。

**类型理论解释**：
- `noreturn` 是**底类型（Bottom Type）**，也称为空类型
- 在类型理论中，底类型是所有类型的子类型
- 因为没有任何值属于底类型，所以它不会违反类型安全

**实际意义**：
1. **简化控制流**：在条件分支中使用返回 `noreturn` 类型的函数，编译器知道该分支不会继续
2. **避免死代码警告**：编译器不会警告 `noreturn` 之后的代码不可达
3. **类型安全**：确保所有代码路径都返回正确的类型

```zig
// 示例1：noreturn 可以赋值给任何类型
fn getValueOrPanic(maybe_value: ?i32) i32 {
    // orelse 块返回 noreturn，可以赋值给 i32
    return maybe_value orelse {
        std.debug.print("错误：值为 null\n", .{});
        std.process.exit(1);
    };
}

// 示例2：在 switch 中使用
fn classify(n: i32) []const u8 {
    return switch (n) {
        0...10 => "小",
        11...100 => "中",
        else => {
            // else 分支返回 noreturn，可以赋值给 []const u8
            std.debug.print("无效值: {}\n", .{n});
            std.process.exit(1);
        },
    };
}
```

### export 关键字

`export` 关键字使函数或变量作为**全局符号**导出到目标文件中，并遵循 C ABI 调用约定。这用于：
- 创建动态库或静态库供其他语言调用
- 导出 C ABI 兼容的函数和变量

**符号可见性对比**：

| 声明方式          | 当前编译单元 | 当前模块 | 其他目标文件       |
| ----------------- | ------------ | -------- | ------------------ |
| `fn foo()`        | ✅ 可见       | ❌ 不可见 | ❌ 不可见           |
| `pub fn foo()`    | ✅ 可见       | ✅ 可见   | ❌ 不可见           |
| `export fn foo()` | ✅ 可见       | ✅ 可见   | ✅ 可见（全局符号） |


```zig
const std = @import("std");

// 导出为 C ABI 兼容的函数
// 可以从 C、Python 等语言调用
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

pub fn main(_: std.process.Init.Minimal) void {
    const result = addNumbers(10, 20);
    std.debug.print("结果: {}\n", .{result});
}
```

### extern 关键字

`extern` 用于声明外部库的函数或变量：

```zig
const std = @import("std");

// 声明外部 C 库函数
extern "c" fn printf(format: [*:0]const u8, ...) c_int;
extern "c" fn atan2(a: f64, b: f64) f64;

// 声明外部变量
extern "c" var errno: c_int;

pub fn main(_: std.process.Init.Minimal) void {
    // 调用 C 标准库函数
    _ = printf("Hello from C!\n");
    
    const angle = atan2(1.0, 1.0);
    std.debug.print("atan2(1, 1) = {}\n", .{angle});
}
```

**链接外部库**：
```bash
# 编译时链接数学库
zig build-exe main.zig -lc -lm
```

### inline 关键字

`inline` 强制函数内联，否则编译失败：

```zig
const std = @import("std");

// 强制内联函数
inline fn square(x: i32) i32 {
    return x * x;
}

// 普通编译器决定是否内联
fn maybeInline(x: i32) i32 {
    return x + 1;
}

pub fn main(_: std.process.Init.Minimal) void {
    // square 会被内联展开
    const result = square(5);
    std.debug.print("平方: {}\n", .{result});
    
    // 在编译期使用内联函数
    comptime {
        const val = square(10);
        std.debug.assert(val == 100);
    }
}
```

预期输出
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
