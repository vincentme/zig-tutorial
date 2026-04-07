# 【draft】函数定义与调用

# Zig函数的核心原则

1. **显式错误处理**
   - 错误是类型系统的一部分，不是异常
   - 调用者必须显式处理可能的错误
   - 没有`try-catch`块，使用`try`和`catch`关键字

2. **无隐式分配**
   - 函数不会隐式分配内存
   - 所有分配器必须显式传递
   - 内存所有权清晰明确

3. **参数不可变**
   - 默认情况下，函数参数是只读的
   - 需要修改时，显式传递指针
   - 防止意外修改，提高代码安全性

# 与其他语言的对比

| 特性       | C         | Rust           | Go         | Zig            |
| ---------- | --------- | -------------- | ---------- | -------------- |
| 错误处理   | 返回码    | Result<T, E>   | error类型  | !T错误联合     |
| 内存分配   | 隐式/显式 | 所有权系统     | GC         | 显式分配器     |
| 参数可变性 | 可变      | 不可变（默认） | 可变       | 不可变（默认） |
| 泛型       | 宏        | 泛型/trait     | 无（接口） | comptime       |

# 实际应用场景

**场景1：库函数设计**
```zig
// 好的设计：显式分配器，清晰的错误处理
pub fn readFile(
    allocator: std.mem.Allocator,
    path: []const u8,
) ![]u8 {
    // 调用者知道：
    // 1. 需要提供分配器
    // 2. 可能返回错误
    // 3. 返回的内存需要释放
}
```

**场景2：错误传播策略**
```zig
// 使用try：将错误传播给调用者
// ❌ 错误示例
fn processFile(path: []const u8) !void {
    const content = try readFile(path);  // 错误会自动传播
    // ...
}

// 使用catch：在当前层级处理错误
fn safeProcessFile(path: []const u8) void {
    const content = readFile(path) catch {
        std.debug.print("读取失败，使用默认内容\n", .{});
        return;
    };
    // ...
}
```

**场景3：性能优化**
```zig
// 内联函数：适合小型、频繁调用的函数
inline fn max(a: anytype, b: @TypeOf(a)) @TypeOf(a) {
    return if (a > b) a else b;
}

// 普通函数：适合复杂逻辑
fn complexCalculation(data: []const f32) f32 {
    // 复杂计算...
}
```

## 函数基础

```zig
const std = @import("std");

// 基本函数定义
fn add(a: i32, b: i32) i32 {
    return a + b;
}

// 无返回值函数
fn greet(name: []const u8) void {
    std.debug.print("Hello, {s}!\n", .{name});
}

// 可选返回值
fn divide(a: i32, b: i32) ?i32 {
    if (b == 0) return null;
    return @divTrunc(a, b);
}

pub fn main(init: std.process.Init.Minimal) void {
    const sum = add(10, 20);
    std.debug.print("sum: {}\n", .{sum});
    
    greet("Zig");
    
    if (divide(10, 2)) |result| {
        std.debug.print("10 / 2 = {}\n", .{result});
    }
}
```

## 错误处理函数

Zig 使用错误联合类型（`!T`）来表示可能失败的操作。这是 Zig 错误处理的核心机制。

# 基本概念

```zig
const std = @import("std");

// 定义错误集合
const MathError = error{
    DivisionByZero,
    Overflow,
};

// 返回错误的函数：MathError!i32 表示可能返回 MathError 或 i32
fn safeDivide(a: i32, b: i32) MathError!i32 {
    if (b == 0) return MathError.DivisionByZero;
    return @divTrunc(a, b);
}
```

# 使用方式

```zig
pub fn main(init: std.process.Init.Minimal) void {
    // 方式1：使用 catch 处理错误，提供默认值
    const result1 = safeDivide(10, 2) catch 0;
    std.debug.print("10 / 2 = {}\n", .{result1});
    
    // 方式2：使用 catch 捕获错误并处理
    const result2 = safeDivide(10, 0) catch |err| {
        std.debug.print("错误：{}\n", .{err});
        return;
    };
    std.debug.print("结果：{}\n", .{result2});
}
```

> **深入学习**：错误处理是 Zig 的重要特性，[错误处理基础](chapter-error-handling.md)将详细讲解错误集合、错误联合类型、`try`/`catch`、`errdefer` 等高级用法。

## 函数参数传递

# Zig 参数传递的核心原则

Zig 采用独特的参数传递策略，理解这一点对于编写高效、安全的代码至关重要：

1. **参数默认不可变**：防止意外修改，提高代码可预测性
2. **值语义优先**：小类型（指针大小或更小）通过值传递
3. **显式传递意图**：需要修改时必须显式传递指针

# 为什么参数不可变？

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
// 大类型通过指针传递以避免复制，但不允许修改
fn printValue(x: *const i32) void {
    std.debug.print("值：{}\n", .{x.*});
    // x.* = 10; // 编译错误：常量指针不可修改
}

pub fn main(init: std.process.Init.Minimal) void {
    var num: i32 = 10;
    
    // 值传递：num 不会被修改
    const result = incrementValue(num);
    std.debug.print("incrementValue 结果：{}\n", .{result});
    std.debug.print("原始值不变：{}\n", .{num});
    
    // 指针传递：num 会被修改
    incrementPointer(&num);
    std.debug.print("incrementPointer 后：{}\n", .{num});
    
    // 常量指针传递：高效且安全
    printValue(&num);
}
```

# 参数传递策略选择

| 数据类型               | 推荐传递方式        | 原因           |
| ---------------------- | ------------------- | -------------- |
| 原始类型（i32, f64等） | 值传递              | 复制成本低     |
| 小结构体（≤指针大小）  | 值传递              | 复制成本可接受 |
| 大结构体               | `*const T`          | 避免复制       |
| 需要修改的数据         | `*T`                | 显式表达意图   |
| 可选数据               | `?T` 或 `*const ?T` | 根据大小选择   |

# 实际应用示例

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

# 什么是内建函数？

内建函数（Builtin Functions）是 Zig 提供的特殊函数，以 `@` 开头。它们：
- 由编译器直接实现
- 提供底层操作能力
- 在编译期或运行期执行
- 是 Zig 元编程的基础

# 常用内建函数分类

| 类别     | 函数                         | 用途           |
| -------- | ---------------------------- | -------------- |
| 类型操作 | `@TypeOf`, `@typeInfo`       | 获取类型信息   |
| 内存操作 | `@bitCast`, `@ptrCast`       | 内存重解释     |
| 指针操作 | `@ptrFromInt`, `@intFromPtr` | 指针与整数转换 |
| 编译期   | `@comptime`, `@compileError` | 编译期计算     |
| 数学运算 | `@sqrt`, `@sin`, `@cos`      | 数学函数       |

Zig 提供了大量内建函数，以`@`开头：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 类型信息：获取类型的详细信息
    const type_info = @typeInfo(i32);
    std.debug.print("i32 类型信息：{}\n", .{type_info});
    
    // 编译期类型推断：获取表达式的类型
    const T = @TypeOf(42);
    std.debug.print("42 的类型：{}\n", .{T});
    
    // 内存操作：位重解释
    var bytes: [4]u8 = [_]u8{ 1, 2, 3, 4 };
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

# 内建函数的实际应用

```zig
// 场景1：泛型编程
fn printTypeInfo(comptime T: type) void {
    const info = @typeInfo(T);
    switch (info) {
        .Int => |int_info| {
            std.debug.print("整数类型，位数：{}\n", .{int_info.bits});
        },
        .Float => {
            std.debug.print("浮点类型\n", .{});
        },
        else => {
            std.debug.print("其他类型\n", .{});
        },
    }
}

// 场景2：安全的类型转换
fn safeCast(comptime T: type, value: anytype) ?T {
    const Src = @TypeOf(value);
    if (@typeInfo(Src) == .Int and @typeInfo(T) == .Int) {
        if (value >= std.math.minInt(T) and value <= std.math.maxInt(T)) {
            return @intCast(value);
        }
    }
    return null;
}

// 场景3：内存布局检查
fn checkStructLayout(comptime T: type) void {
    comptime {
        std.debug.print("类型 {} 的大小：{}\n", .{ T, @sizeOf(T) });
        std.debug.print("类型 {} 的对齐：{}\n", .{ T, @alignOf(T) });
    }
}
```

## 函数高级特性

# anytype 参数类型

# 什么是 anytype？

`anytype` 是 Zig 的一个特殊关键字，它允许函数接受任意类型的参数。与泛型不同，`anytype` 在调用时会为每个不同的类型生成一个专门的函数版本。

# anytype 的工作原理

1. **编译期类型推断**：编译器在调用点推断实际类型
2. **单态化**：为每种使用的类型生成专门的函数版本
3. **类型安全**：虽然接受任意类型，但仍是类型安全的

# anytype vs 泛型参数

```zig
// 使用 anytype：更简洁，适合简单场景
fn print(value: anytype) void {
    std.debug.print("{}\n", .{value});
}

// 使用泛型参数：更明确，适合复杂场景
fn printGeneric(comptime T: type, value: T) void {
    std.debug.print("{}\n", .{value});
}
```

使用 `anytype` 可以让函数接受任意类型的参数，编译器会自动推断类型：

```zig
const std = @import("std");

// 使用 anytype 的泛型函数
// 编译器会为每种类型生成专门的版本
fn printType(value: anytype) void {
    const T = @TypeOf(value);
    std.debug.print("值: {}, 类型: {}\n", .{ value, T });
}

// 获取类型信息：实现类型安全的泛型操作
fn describeType(value: anytype) void {
    const T = @TypeOf(value);
    const info = @typeInfo(T);
    
    switch (info) {
        .int => |int_info| {
            std.debug.print("整数类型，位数: {}, 有符号: {}\n", .{
                int_info.bits,
                int_info.signedness == .signed,
            });
        },
        .float => {
            std.debug.print("浮点类型\n", .{});
        },
        .pointer => {
            std.debug.print("指针类型\n", .{});
        },
        else => {
            std.debug.print("其他类型\n", .{});
        },
    }
}

pub fn main(init: std.process.Init.Minimal) void {
    // 每次调用都会生成专门的函数版本
    printType(42);        // 生成 printType(i32) 版本
    printType(3.14);      // 生成 printType(f64) 版本
    printType("hello");   // 生成 printType(*const [5:0]u8) 版本
    
    describeType(@as(i32, 100));
    describeType(@as(f64, 2.5));
}
```

# anytype 的实际应用

```zig
// 场景1：通用比较函数
fn max(a: anytype, b: @TypeOf(a)) @TypeOf(a) {
    return if (a > b) a else b;
}

// 场景2：通用打印函数
fn debugPrint(value: anytype) void {
    const T = @TypeOf(value);
    switch (@typeInfo(T)) {
        .Optional => {
            if (value) |v| {
                std.debug.print("Some({})\n", .{v});
            } else {
                std.debug.print("None\n", .{});
            }
        },
        else => {
            std.debug.print("{}\n", .{value});
        },
    }
}

// 场景3：约束 anytype 类型
fn addNumbers(a: anytype, b: @TypeOf(a)) @TypeOf(a) {
    const T = @TypeOf(a);
    // 编译期检查类型是否支持加法
    if (@typeInfo(T) != .Int and @typeInfo(T) != .Float) {
        @compileError("addNumbers 只支持数字类型");
    }
    return a + b;
}
```

# noreturn 函数类型

# 什么是 noreturn？

`noreturn` 是一个特殊类型，表示函数永远不会返回。这用于：
- 表示程序终止
- 无限循环
- 错误处理（如 panic）

# 为什么需要 noreturn？

1. **类型系统完整性**：让编译器知道某些代码路径不会继续
2. **优化提示**：编译器可以进行更好的控制流分析
3. **代码清晰**：明确表达函数的意图

`noreturn` 用于表示永远不会返回的函数：

```zig
const std = @import("std");

// 永不返回的函数：无限循环
fn panicHandler(message: []const u8) noreturn {
    std.debug.print("PANIC: {s}\n", .{message});
    while (true) {} // 必须确保永不返回
}

// 退出程序：系统调用
fn exitProgram(code: u8) noreturn {
    std.os.exit(code);
    // exit 之后代码不会执行
}

// noreturn 在控制流中的作用
fn assertPositive(value: i32) void {
    if (value < 0) {
        // 编译器知道这里不会返回，所以后续代码是可达的
        std.os.exit(1);
    }
    std.debug.print("值是正数: {}\n", .{value});
}

pub fn main(init: std.process.Init.Minimal) void {
    const should_panic = false;
    
    if (should_panic) {
        panicHandler("测试 panic");
        // 这里不需要处理返回值，因为 panicHandler 不会返回
    }
    
    std.debug.print("程序正常执行\n", .{});
}
```

**使用场景**：
- 错误处理函数（如 panic）
- 无限循环
- 程序退出

# noreturn 的类型系统作用

```zig
// noreturn 可以赋值给任何类型
fn getValueOrPanic(maybe_value: ?i32) i32 {
    // 如果 panic，返回类型是 noreturn，可以赋值给 i32
    return maybe_value orelse {
        std.debug.print("错误：值为 null\n", .{});
        std.os.exit(1);
    };
}

// 在 switch 中使用
fn classify(n: i32) []const u8 {
    return switch (n) {
        0...10 => "小",
        11...100 => "中",
        else => {
            std.debug.print("无效值: {}\n", .{n});
            std.os.exit(1);
        },
    };
}
```

# export 函数

# 什么是 export？

`export` 关键字使函数在生成的目标文件中可见，并遵循 C ABI 调用约定。这用于：
- 创建可供其他语言调用的库
- 与 C 代码互操作
- 创建动态链接库

# export 的特点

1. **C ABI 兼容**：函数签名遵循 C 语言的调用约定
2. **符号可见**：函数符号在目标文件中可见
3. **名称修饰**：函数名不会被修饰，保持原样

`export` 使函数在生成的目标文件中可见，并遵循 C ABI：

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

pub fn main(init: std.process.Init.Minimal) void {
    const result = addNumbers(10, 20);
    std.debug.print("结果: {}\n", .{result});
}
```

**用途**：
- 创建动态库/静态库
- 与其他语言互操作
- 提供C兼容接口

# extern 函数

`extern` 用于声明外部库的函数：

```zig
const std = @import("std");

// 声明外部 C 库函数
extern "c" fn printf(format: [*:0]const u8, ...) c_int;
extern "c" fn atan2(a: f64, b: f64) f64;

pub fn main(init: std.process.Init.Minimal) void {
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

# inline 函数

`inline` 强制函数内联，否则编译失败：

```zig
const std = @import("std");

// 强制内联函数
inline fn square(x: i32) i32 {
    return x * x;
}

// 条件内联
fn maybeInline(x: i32) i32 {
    // 编译器决定是否内联
    return x + 1;
}

pub fn main(init: std.process.Init.Minimal) void {
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

**何时使用 inline**：
- 小型、频繁调用的函数
- 性能关键路径
- 编译期计算

**注意事项**：
- 过度使用会增加代码体积
- 不适合复杂函数
- 可能影响编译速度
