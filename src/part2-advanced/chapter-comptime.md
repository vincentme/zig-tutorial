# 编译期计算与元编程

Zig 的 `comptime` 让一部分代码在编译阶段执行，从而把类型生成、约束检查、代码选择和预计算提前完成。本章聚焦于 **`comptime` 的机制**——语法、内建函数、能力边界。泛型设计模式将在[泛型编程](chapter-generics.md)中展开。

> **进阶**：读完后应该能回答——
>
> - `comptime` 参数、`comptime` 块、`comptime var` 分别用来做什么？
> - `@typeInfo`、`@hasDecl`、`@hasField`、`@embedFile` 等内建函数在编译期能提供什么能力？
> - `inline fn` 和 `comptime` 参数有什么区别？
> - 编译期计算有哪些硬性限制？

---

## 编译期和运行时：核心区分

| 维度 | 编译期（compile time） | 运行时（runtime） |
| ---- | ---------------------- | ----------------- |
| 执行时机 | 编译器生成程序时 | 程序真正运行时 |
| 能处理的数据 | 编译期已知的值、类型、结构信息 | 用户输入、文件内容、网络数据等动态值 |
| 典型用途 | 类型生成、约束检查、分支裁剪、预计算 | 真正处理业务数据 |
| 错误暴露时机 | 编译期报错 | 运行时报错或返回错误 |

> **只有那些在编译阶段已经确定的信息，才能参与 `comptime` 计算。**

例如类型参数、固定常量、结构体字段的类型信息都属于编译期已知；而用户输入、文件读取结果、网络请求内容则属于运行时。

---

## `comptime` 不是宏

很多初学者把 `comptime` 误解成"Zig 版宏系统"或"更厉害的模板"。更准确的理解是：

> `comptime` 是 Zig 语言本身的一部分，允许用**普通 Zig 代码**参与编译阶段的计算与决策。

它复用同一门语言的语法和类型系统，不需要额外的 DSL。这带来几个效果：

1. 编译期检查和运行时逻辑共享同一套表达方式
2. 泛型和普通函数风格一致
3. 元编程不必绕进"宏展开式思维"

---

## 机制一：`comptime` 参数

这是最基础也最常用的机制——函数参数标记为 `comptime`，调用者必须在编译期提供值。

```zig
const std = @import("std");

fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

pub fn main() void {
    const a = max(i32, 10, 20);
    const b = max(f64, 3.14, 2.71);

    std.debug.print("int max: {}\n", .{a});
    std.debug.print("float max: {d}\n", .{b});
}
```

要点：

- `T` 必须在编译期已知，不能由运行时值决定
- 编译器会为每个不同的 `T` 生成一份特化实现
- 这就是 Zig 泛型的底层机制——详见[泛型编程](chapter-generics.md)

`comptime` 参数不限于 `type`，也可以是整数、枚举等编译期值：

```zig
const std = @import("std");

fn repeat(comptime n: u32, value: u8) [n]u8 {
    return [_]u8{value} ** n;
}

pub fn main() void {
    const buf = repeat(5, 'A');
    std.debug.print("{s}\n", .{&buf}); // AAAAA
}
```

---

## 机制二：`comptime` 块

`comptime { }` 块强制其中的代码在编译期执行。最常见的用法是配合标签块计算编译期常量：

```zig
const std = @import("std");

const factorial_10 = comptime blk: {
    var result: u32 = 1;
    for (1..11) |i| {
        result *= @as(u32, @intCast(i));
    }
    break :blk result;
};

pub fn main() void {
    // factorial_10 == 3628800 (10!), 在编译期已经算好
    std.debug.print("10! = {}\n", .{factorial_10});
}
```

`comptime` 块也可以用于编译期断言，确保静态约束成立：

```zig
const std = @import("std");

const Block = struct {
    data: [block_size]u8 = undefined,

    const block_size = 4096;

    comptime {
        // 编译期断言：block_size 必须是 2 的幂
        std.debug.assert(block_size > 0 and (block_size & (block_size - 1)) == 0);
    }
};

pub fn main() void {
    var b: Block = .{};
    b.data[0] = 42;
    std.debug.print("first byte: {}\n", .{b.data[0]});
}
```

---

## 机制三：`comptime var`

`comptime var` 声明一个只存在于编译期的可变变量，可以在编译期循环中累积状态：

```zig
const std = @import("std");

fn fibonacci(comptime n: u32) u32 {
    comptime var a: u32 = 0;
    comptime var b: u32 = 1;
    inline for (0..n) |_| {
        const tmp = a + b;
        a = b;
        b = tmp;
    }
    return a;
}

test "fibonacci at comptime" {
    // fibonacci(10) == 55，编译期计算完毕
    try std.testing.expectEqual(55, comptime fibonacci(10));
}
```

> **注意**：`comptime var` 只能在编译期上下文中被修改。配合 `inline for` 使用时，循环本身在编译期展开，每次迭代都能读写 `comptime var`。

---

## 机制四：编译期条件选择与 `@typeInfo`

`@typeInfo` 返回一个类型的结构化描述，可以在编译期根据类型信息做分支决策：

```zig
const std = @import("std");

fn zeroValue(comptime T: type) T {
    return switch (@typeInfo(T)) {
        .int => 0,
        .float => 0.0,
        .bool => false,
        else => @compileError("unsupported type for zeroValue"),
    };
}

test "zeroValue" {
    try std.testing.expectEqual(@as(i32, 0), zeroValue(i32));
    try std.testing.expectEqual(@as(f64, 0.0), zeroValue(f64));
    try std.testing.expectEqual(false, zeroValue(bool));
}
```

更完整的类型描述示例——读取结构体字段数量：

```zig
const std = @import("std");

fn fieldCount(comptime T: type) usize {
    return switch (@typeInfo(T)) {
        .@"struct" => |info| info.fields.len,
        else => @compileError("expected struct type"),
    };
}

const User = struct {
    id: u32,
    name: []const u8,
    active: bool,
};

test "fieldCount" {
    try std.testing.expectEqual(3, fieldCount(User));
}
```

---

## 机制五：`inline for` 与编译期循环展开

`inline for` 在编译期展开循环，每次迭代的捕获值都是编译期已知的。这使得在循环体内可以做编译期类型推导：

```zig
const std = @import("std");

fn printFieldNames(comptime T: type) void {
    const fields = @typeInfo(T).@"struct".fields;
    inline for (fields) |field| {
        std.debug.print("{s}\n", .{field.name});
    }
}

const Config = struct {
    host: []const u8,
    port: u16,
    debug: bool,
};

pub fn main() void {
    printFieldNames(Config);
}
```

输出：

```
host
port
debug
```

---

## 机制六：`@compileError` —— 把约束写进编译阶段

当某段抽象只允许某些条件成立时，`@compileError` 可以在编译期阻止错误用法：

```zig
const std = @import("std");

fn safeDiv(comptime T: type, a: T, b: T) T {
    switch (@typeInfo(T)) {
        .int => {},
        .float => {},
        else => @compileError("safeDiv only supports integer and float types"),
    }
    if (b == 0) return 0;
    return a / b;
}

test "safeDiv" {
    try std.testing.expectEqual(@as(i32, 3), safeDiv(i32, 10, 3));
    try std.testing.expectEqual(@as(f64, 2.5), safeDiv(f64, 5.0, 2.0));
    try std.testing.expectEqual(@as(i32, 0), safeDiv(i32, 10, 0));
}
```

编译期错误信息直接出现在编译输出中，比运行时 panic 更早、更明确。

---

## 机制七：`@hasDecl` 与 `@hasField` —— 编译期鸭子类型

这两个内建函数可以在编译期检查一个类型是否具备某个声明或字段：

```zig
const std = @import("std");

fn canSerialize(comptime T: type) bool {
    return @hasDecl(T, "serialize");
}

fn hasNameField(comptime T: type) bool {
    return @hasField(T, "name");
}

const Serializable = struct {
    data: u32,

    pub fn serialize(self: @This()) []const u8 {
        _ = self;
        return "serialized";
    }
};

const Plain = struct {
    name: []const u8,
    value: u32,
};

test "@hasDecl and @hasField" {
    try std.testing.expect(canSerialize(Serializable));
    try std.testing.expect(!canSerialize(Plain));

    try std.testing.expect(hasNameField(Plain));
    try std.testing.expect(!hasNameField(Serializable));
}
```

> **注意**：`@hasDecl` 检查的是类型的**命名空间声明**（函数、常量等），`@hasField` 检查的是**数据字段**。两者用途不同。

这种能力是编译期约束检查的基础——泛型中如何用它实现接口约束，详见[泛型编程](chapter-generics.md)。

---

## 机制八：`@embedFile` —— 编译期嵌入文件

`@embedFile` 在编译期读取文件内容，将其作为字节数组常量嵌入到二进制中：

```zig
const std = @import("std");

// 假设项目中存在 src/data/version.txt，内容为 "1.0.0"
// const version = @embedFile("data/version.txt");
// version 的类型是 *const [N:0]u8

// 以下示例使用一个编译期已知的字符串来演示相同的效果：
const fallback_version = "1.0.0-dev";

pub fn main() void {
    std.debug.print("version: {s}\n", .{fallback_version});
}
```

`@embedFile` 的典型使用场景：

- 嵌入配置文件、模板、shader 源码
- 嵌入静态资源（图标、证书等）
- 嵌入版本号或构建信息

返回类型是 `*const [N:0]u8`——一个编译期已知长度的、以 0 结尾的字节数组指针。

---

## 机制九：类型构造内建函数

在 0.16-dev 中，从 `@typeInfo` 结果构造类型的能力由一组专用内建函数提供，而非单一的 `@Type`：

| 内建函数 | 用途 |
| --------- | ---- |
| `@Int(signedness, bits)` | 构造整数类型，如 `@Int(.unsigned, 18)` → `u18` |
| `@Struct(...)` | 构造结构体类型 |
| `@Union(...)` | 构造联合体类型 |
| `@Enum(...)` | 构造枚举类型 |
| `@Pointer(...)` | 构造指针类型 |
| `@Fn(...)` | 构造函数类型 |
| `@Tuple(field_types)` | 构造元组类型 |

一个使用 `@Int` 的示例——根据需求选择最小整数类型：

```zig
const std = @import("std");

fn SmallestUint(comptime max_val: comptime_int) type {
    if (max_val < (1 << 8)) return u8;
    if (max_val < (1 << 16)) return u16;
    if (max_val < (1 << 32)) return u32;
    return u64;
}

test "SmallestUint" {
    try std.testing.expect(SmallestUint(100) == u8);
    try std.testing.expect(SmallestUint(1000) == u16);
    try std.testing.expect(SmallestUint(100_000) == u32);
}
```

使用 `@Int` 构造精确位宽类型的示例：

```zig
const std = @import("std");

fn DoubleWidth(comptime T: type) type {
    const info = @typeInfo(T).int;
    return @Int(info.signedness, info.bits * 2);
}

test "DoubleWidth" {
    try std.testing.expect(DoubleWidth(u16) == u32);
    try std.testing.expect(DoubleWidth(i8) == i16);
}
```

---

## `inline fn` vs `comptime` 参数

这两个概念经常被混淆，但它们解决不同的问题：

```zig
const std = @import("std");

// comptime 参数：调用者必须在编译期提供值
fn comptimeAdd(comptime a: u32, b: u32) u32 {
    // a 在编译期已知，b 可以是运行时值
    return a + b;
}

// inline fn：建议编译器内联整个函数体（不强制参数为编译期值）
inline fn inlineAdd(a: u32, b: u32) u32 {
    return a + b;
}

test "comptime param vs inline fn" {
    const x = comptimeAdd(10, 20);
    try std.testing.expectEqual(30, x);

    const y = inlineAdd(10, 20);
    try std.testing.expectEqual(30, y);
}
```

区别总结：

| | `comptime` 参数 | `inline fn` |
| --- | --- | --- |
| 参数是否必须编译期已知 | 是 | 否 |
| 是否生成多份特化代码 | 是（按参数值特化） | 否（只是内联展开） |
| 主要用途 | 泛型、编译期计算 | 性能优化、避免函数调用开销 |
| 类型参数化能力 | 有（`comptime T: type`） | 无 |

> **注意**：`inline fn` 不等于 `comptime`。把函数标记为 `inline` 不会让它的参数变成编译期值，只是建议编译器在调用处展开函数体。

---

## 编译期的硬性限制

`comptime` 能力强大，但有明确的边界：

```zig
const std = @import("std");

// 演示：编译期不能做 I/O
fn attemptCompileTimeWork() void {
    // 以下如果在 comptime 块中调用，都会产生编译错误：
    // - std.fs.cwd()         → 编译期不能访问文件系统
    // - std.net.tcpConnect() → 编译期不能进行网络操作
    // - std.heap.page_allocator.alloc() → 编译期不能使用运行时分配器
}

comptime {
    // 编译期可以做的：
    var x: u32 = 0;
    for (0..10) |i| {
        x += @as(u32, @intCast(i));
    }
    std.debug.assert(x == 45);

    // 编译期不能做的（取消注释会产生编译错误）：
    // _ = std.heap.page_allocator;  // 运行时分配器
}

test "comptime limits are clear" {
    // 编译期计算结果可以在运行时使用
    const sum = comptime blk: {
        var s: u32 = 0;
        for (0..100) |i| {
            s += @as(u32, @intCast(i));
        }
        break :blk s;
    };
    try std.testing.expectEqual(4950, sum);
}
```

完整的限制清单：

| 限制 | 说明 |
| ---- | ---- |
| **无 I/O** | 不能读写文件、网络、标准输入输出（`@embedFile` 是例外——由编译器特殊处理） |
| **无运行时指针** | 不能解引用指向运行时内存的指针 |
| **有限内存** | 编译期求值器有内存上限，过大的数据结构会触发"eval branch quota exceeded"或内存不足 |
| **递归深度限制** | 默认分支配额 1000，可用 `@setEvalBranchQuota` 提高，但不能无限 |
| **无内联汇编** | `asm` 在编译期不可用 |
| **无运行时副作用** | 不能修改全局可变状态、不能调用外部函数 |

如果遇到 `"unable to evaluate comptime expression"` 或 `"eval branch quota exceeded"`，通常意味着编译期计算触碰了这些限制。

---

## 预计算静态数据

当某个结果在编译期完全可知且运行时会频繁使用时，预计算是 `comptime` 的经典应用：

```zig
const std = @import("std");

/// 编译期生成 ASCII 查找表：标记哪些字符是十六进制数字
const hex_table: [256]bool = comptime blk: {
    var table = [_]bool{false} ** 256;
    for ("0123456789abcdefABCDEF") |c| {
        table[c] = true;
    }
    break :blk table;
};

fn isHexDigit(c: u8) bool {
    return hex_table[c];
}

test "hex lookup table" {
    try std.testing.expect(isHexDigit('a'));
    try std.testing.expect(isHexDigit('F'));
    try std.testing.expect(isHexDigit('0'));
    try std.testing.expect(!isHexDigit('g'));
    try std.testing.expect(!isHexDigit(' '));
}
```

这个查找表在编译期构建完毕，运行时只需一次数组索引——O(1) 查找，零运行时构建成本。

---

## 一个完整示例：按类型选择描述信息

综合运用多种机制——编译期类型参数、`@typeInfo` 分支、`@compileError`：

```zig
const std = @import("std");

fn describeType(comptime T: type) []const u8 {
    return switch (@typeInfo(T)) {
        .int => "integer",
        .float => "float",
        .bool => "boolean",
        .pointer => "pointer",
        .array => "array",
        .@"struct" => "struct",
        .@"enum" => "enum",
        else => "other",
    };
}

test "describeType" {
    try std.testing.expectEqualStrings("integer", describeType(i32));
    try std.testing.expectEqualStrings("float", describeType(f64));
    try std.testing.expectEqualStrings("boolean", describeType(bool));
    try std.testing.expectEqualStrings("pointer", describeType(*u8));
    try std.testing.expectEqualStrings("struct", describeType(struct { x: u32 }));
}
```

---

## `comptime` 适用场景速览

| 场景 | 说明 |
| ---- | ---- |
| 泛型数据结构与函数 | 类型参数化，编译期特化——详见[泛型编程](chapter-generics.md) |
| 编译期约束检查 | 用 `@compileError` 在编译期拒绝不合法的类型或配置 |
| 根据类型生成代码路径 | `@typeInfo` + `switch`，按类型选择不同实现 |
| 预计算静态数据 | 查找表、常量派生值、编译期生成的静态数据 |
| 嵌入外部资源 | `@embedFile` 将文件内容嵌入二进制 |
| 编译期断言 | `comptime { }` 块中做静态检查 |

---

## 边界与常见陷阱

以下问题在实践中最容易遇到，合并为一节。

### 1. 别把运行时问题硬塞进编译期

如果值来自用户输入、文件、网络、数据库——它天然属于运行时。不要为了"看起来高级"而强行 `comptime` 化。

### 2. 别让编译期代码比运行时更难读

层层嵌套的 `@typeInfo` 反射、过度抽象的字段驱动生成——如果明明可以普通写，却非要绕一圈编译期拼装，问自己：

> 这段 `comptime` 真的让设计更清楚了吗？

### 3. 编译期 ≠ 免费

编译期计算会增加编译时间。如果只是为了省下微不足道的运行时开销而大幅拖慢编译，通常不值得。

### 4. 先学稳基础再玩反射

推荐顺序：`comptime` 参数 → 编译期生成类型 → 编译期条件分支 → 类型反射。跳过前面直接沉迷复杂反射，往往导致代码自己也看不清。

### 5. 别用 `comptime` 掩盖设计不清

有时问题不是"需要更强的元编程"，而是数据结构没想清楚、接口边界没想清楚。继续堆 `comptime` 只会放大混乱。

> **注意**：编译期抽象和运行时抽象的选择是第二部分的核心主线之一。如果需要运行时切换实现、动态加载、类型擦除、VTable，那更适合运行时抽象，而不是 `comptime`。

---

## 本章小结

本章覆盖的 `comptime` 核心机制：

| 机制 | 关键语法/内建函数 |
| ---- | ----------------- |
| 编译期参数 | `fn f(comptime T: type, ...)` |
| 编译期块 | `comptime { }`, `comptime blk: { break :blk val; }` |
| 编译期变量 | `comptime var x = ...` |
| 类型反射 | `@typeInfo(T)` |
| 类型构造 | `@Int`, `@Struct`, `@Enum`, `@Union`, `@Pointer`, `@Fn`, `@Tuple` |
| 声明/字段检查 | `@hasDecl(T, name)`, `@hasField(T, name)` |
| 编译期错误 | `@compileError("message")` |
| 文件嵌入 | `@embedFile("path")` |
| 循环展开 | `inline for` |
| 性能配额 | `@setEvalBranchQuota(N)` |

这些机制是 Zig 泛型、零成本抽象和元编程的底层基础。掌握它们之后，下一章[泛型编程](chapter-generics.md)将展示如何把这些机制组合成可复用的设计模式。