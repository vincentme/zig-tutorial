# 编译期计算与元编程

Zig 的 `comptime` 让一部分代码在编译阶段执行，从而把类型生成、约束检查、代码选择和预计算提前完成。它不是宏系统或 DSL，而是用普通 Zig 代码参与编译阶段的计算与决策——编译期检查和运行时逻辑共享同一套表达方式，泛型和普通函数风格一致。本章聚焦于 **`comptime` 的机制**——语法、内建函数、能力边界。泛型设计模式将在[泛型编程](chapter-generics.md)中展开。

## 编译期和运行时：核心区分

| 维度         | 编译期（compile time）               | 运行时（runtime）                    |
| ------------ | ------------------------------------ | ------------------------------------ |
| 执行时机     | 编译器生成程序时                     | 程序真正运行时                       |
| 能处理的数据 | 编译期已知的值、类型、结构信息       | 用户输入、文件内容、网络数据等动态值 |
| 典型用途     | 类型生成、约束检查、分支裁剪、预计算 | 真正处理业务数据                     |
| 错误暴露时机 | 编译期报错                           | 运行时报错或返回错误                 |

只有编译期已知的值和类型信息才能参与 `comptime` 计算。类型参数、常量、结构体字段信息属于编译期已知；用户输入、文件内容、网络请求则属于运行时。

## `comptime` 参数

这是最基础也最常用的机制——函数参数标记为 `comptime`，调用者必须在编译期提供值。

```zig
const std = @import("std");

fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

pub fn main() void {
    const a = max(i32, 10, 20);
    const b = max(f64, 3.14, 2.72);

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

#### `inline fn` vs `comptime` 参数

|                        | `comptime` 参数          | `inline fn`                |
| ---------------------- | ------------------------ | -------------------------- |
| 参数是否必须编译期已知 | 是                       | 否                         |
| 是否生成多份特化代码   | 是（按参数值特化）       | 否（只是内联展开）         |
| 主要用途               | 泛型、编译期计算         | 性能优化、避免函数调用开销 |
| 类型参数化能力         | 有（`comptime T: type`） | 无                         |

`inline` 不等于编译期——它只是建议编译器在调用处展开函数体，不会让参数变成编译期值。

## `comptime` 块

`comptime { }` 块用于显式写出"一段代码必须在编译期执行"。典型用法是在类型定义中写编译期检查：

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

如果断言不成立，错误会在编译阶段直接暴露出来。

## `comptime var`

`comptime` 参数和 `comptime` 块处理的都是编译期已知的**固定值**。但如果编译期计算需要循环累积中间结果，就需要一个能在编译期**被修改**的变量——这正是 `comptime var` 的设计意图：声明一个只存在于编译期的可变变量。

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

`comptime var` 只能在编译期执行的代码中修改——包括 `comptime` 函数体、`comptime` 块和 `inline for` / `inline while` 循环体。普通运行时 `for` 不能修改 `comptime var`，因为运行时代码执行时编译期变量已不存在。`inline for` 之所以可以，是因为它在编译期展开：每次迭代生成一份独立的编译期语句，所有语句都在编译期执行完毕后才进入运行时。

## `@typeInfo` 与 `@compileError`

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

读取结构体字段信息：

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

`.@"struct" => |info|` 捕获的 `info` 是一个 `std.builtin.Type.Struct`，包含：
- **`fields`** — `[]const StructField`，每个字段含 `name`（名称）、`type`（类型）、`default_value`（默认值）、`is_comptime`、`alignment`
- **`decls`** — `[]const Declaration`，类型内部的声明（函数、常量）
- **`layout`** — `ContainerLayout`，结构体布局方式（`.auto` / `@"packed"`）
- **`is_tuple`** — 是否为元组（匿名结构体）

这组信息使得编译期代码可以遍历字段、按名称查找、根据字段类型做条件分支，是系列化、配置映射和代码生成的基础。`inline for` 一节将展示如何遍历 `fields`。

`@compileError` 在 `@typeInfo` 的 `else` 分支中用于阻止不支持的用法，也可单独用于类型前置校验：

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

## `inline for`：编译期循环展开

`inline for` 在编译期展开循环，每次迭代的捕获值都是编译期已知的，可在循环体内做编译期类型推导：

```zig
const std = @import("std");

fn printFieldNames(comptime T: type) void {
    const fields = @typeInfo(T).@"struct".fields;
    inline for (fields) |field| {
        std.debug.print("{s}\n", .{field.name});
    }
}

const Config = struct { host: []const u8, port: u16, debug: bool };

pub fn main() void {
    printFieldNames(Config);
}
```

输出：`host` / `port` / `debug`

## `@hasDecl` 与 `@hasField`：编译期鸭子类型

```zig
const std = @import("std");

fn canSerialize(comptime T: type) bool {
    return @hasDecl(T, "serialize");
}
fn hasNameField(comptime T: type) bool {
    return @hasField(T, "name");
}

const S = struct {
    data: u32,
    pub fn serialize(_: @This()) []const u8 { return "ok"; }
};
const P = struct { name: []const u8, value: u32 };

test "@hasDecl and @hasField" {
    try std.testing.expect(canSerialize(S));
    try std.testing.expect(!canSerialize(P));
    try std.testing.expect(hasNameField(P));
    try std.testing.expect(!hasNameField(S));
}
```

`@hasDecl` 检查命名空间声明，`@hasField` 检查数据字段。详见[泛型编程](chapter-generics.md)。

## `@embedFile`：编译期嵌入文件

`@embedFile` 在编译期将文件内容嵌入为 `*const [N:0]u8` 字节数组常量：

```zig
// const version = @embedFile("data/version.txt");
// 返回 *const [N:0]u8，NUL 结尾
```

典型场景：嵌入配置文件、模板、shader 源码、静态资源、版本号或构建信息。

## 类型构造内建函数

从 `@typeInfo` 结果构造类型的能力由一组专用内建函数提供：

| 内建函数                 | 用途           |
| ------------------------ | -------------- |
| `@Int(signedness, bits)` | 构造整数类型   |
| `@Struct(...)`           | 构造结构体类型 |
| `@Union(...)`            | 构造联合体类型 |
| `@Enum(...)`             | 构造枚举类型   |
| `@Pointer(...)`          | 构造指针类型   |
| `@Fn(...)`               | 构造函数类型   |
| `@Tuple(field_types)`    | 构造元组类型   |

这些内建函数与 `@typeInfo` 形成**拆解—组装**的对应关系：`@typeInfo` 把一个类型拆成结构化信息（`std.builtin.Type` 标签联合的某个 variant），内建函数把这些信息重新组装成类型。例如 `@typeInfo(i32)` 返回 `.int = .{ .signedness = .signed, .bits = 32 }`，`@Int(.signed, 32)` 则用同样的信息构造出 `i32`。下面的 `DoubleWidth` 就是这个模式的最好示范——读出、修改、重建。

根据需求选择最小整数类型：

```zig
fn SmallestUint(comptime max_val: comptime_int) type {
    if (max_val < (1 << 8)) return u8;
    if (max_val < (1 << 16)) return u16;
    if (max_val < (1 << 32)) return u32;
    return u64;
}
```

使用 `@Int` 构造精确位宽：

```zig
fn DoubleWidth(comptime T: type) type {
    const info = @typeInfo(T).int;
    return @Int(info.signedness, info.bits * 2);
}
```

`@Struct` 可在编译期重建结构体（如修改字段）：

```zig
const MyStruct = @Struct(
    .@"packed", null,
    &.{ "x", "y" },       // 字段名
    &.{ u8, u8 },         // 字段类型
    &.{ null, null },     // 默认值
    &.{ false, false },   // is_comptime
    &.{ null, null },     // 对齐
);
```

## 编译期的硬性限制

`comptime` 能力强大，但有明确的边界：

```zig
const std = @import("std");

comptime {
    // 编译期可以做的：
    var x: u32 = 0;
    for (0..10) |i| {
        x += @as(u32, @intCast(i));
    }
    std.debug.assert(x == 45);

    // 编译期不能做的（取消注释会产生编译错误）：
    // _ = std.heap.page_allocator;  // 运行时分配器
    // std.fs.cwd()                  // 编译期不能访问文件系统
}
```

| 限制               | 说明                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| **无 I/O**         | 不能读写文件、网络、标准输入输出（`@embedFile` 是例外——由编译器特殊处理）              |
| **无运行时指针**   | 不能解引用指向运行时内存的指针                                                         |
| **有限内存**       | 编译期求值器有内存上限，过大的数据结构会触发 `"eval branch quota exceeded"` 或内存不足 |
| **递归深度限制**   | 默认分支配额 1000，可用 `@setEvalBranchQuota` 提高，但不能无限                         |
| **无内联汇编**     | `asm` 在编译期不可用                                                                   |
| **无运行时副作用** | 不能修改全局可变状态、不能调用外部函数                                                 |

## 本章小结

| 机制            | 关键语法                         | 适用场景                                                |
| --------------- | -------------------------------- | ------------------------------------------------------- |
| `comptime` 参数 | `fn f(comptime T: type, ...)`    | 泛型数据结构与函数——详见[泛型编程](chapter-generics.md) |
| `comptime` 块   | `comptime { }`                   | 编译期断言与静态检查                                    |
| `comptime` 变量 | `comptime var x = ...`           | 编译期循环中累积状态                                    |
| 类型反射 + 约束 | `@typeInfo(T)` + `@compileError` | 根据类型生成代码、编译期约束检查                        |
| 编译期鸭子类型  | `@hasDecl`, `@hasField`          | 检查类型是否具备某声明或字段                            |
| 循环展开        | `inline for`                     | 编译期遍历与展开                                        |
| 文件嵌入        | `@embedFile("path")`             | 嵌入外部资源                                            |
| 类型构造        | `@Int`, `@Struct`, `@Enum` 等    | 编译期生成自定义类型                                    |

## 边界与常见陷阱

- **别把运行时问题硬塞进编译期**——用户输入、文件、网络数据天然属于运行时。
- **编译期 ≠ 免费**——编译期计算会增加编译时间，不要为省下微不足道的运行时开销而大幅拖慢编译。
- **先学稳基础再玩反射**——推荐顺序：`comptime` 参数 → 编译期条件分支 → 类型构造 → `@typeInfo` 反射。跳过前面直接沉迷复杂反射，代码往往自己也看不清。

> **注意**：如果需要运行时切换实现、类型擦除或 VTable，那更适合运行时抽象而非 `comptime`。完整对比见[接口与设计模式](chapter-interfaces.md)章节。

---

> **相关阅读**：[泛型编程](chapter-generics.md)
