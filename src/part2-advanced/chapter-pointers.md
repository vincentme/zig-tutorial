# 指针、切片与对齐

Zig 的指针设计要求在类型层面明确表达数据的完整语义：指向单个值还是连续数据、有没有长度信息、能不能修改、可能为空吗、对齐要求是什么。本章按以下顺序展开：

1. 单项指针 `*T` / `*const T`
2. 切片 `[]T` / `[]const T`
3. 数组指针、可选指针、多项指针
4. 对齐、指针转换、`volatile`、`@fieldParentPtr`

## 类型总览

| 类型         | 语法        | 含义                       | 常见用途                 |
| ------------ | ----------- | -------------------------- | ------------------------ |
| 单项指针     | `*T`        | 指向一个 `T` 值            | 传参、原地修改、避免复制 |
| 只读单项指针 | `*const T`  | 指向一个只读 `T` 值        | 只读借用                 |
| 可选指针     | `?*T`       | 可能有一个 `T`，也可能没有 | 查找结果、可空句柄       |
| 数组指针     | `*[N]T`     | 指向固定长度数组           | 保留数组长度信息         |
| 多项指针     | `[*]T`      | 指向连续元素，不携带长度   | 底层内存、C 互操作       |
| 切片         | `[]T`       | 指针 + 长度                | 动态序列视图             |
| 只读切片     | `[]const T` | 只读切片视图               | 字符串、只读序列参数     |
| 哨兵切片     | `[:S]T`     | 带长度，以哨兵值结尾       | C 风格数据协作           |
| 哨兵多项指针 | `[*:S]T`    | 无长度，以哨兵值结尾       | C 风格字符串             |

日常最常用的是 `*T`、`*const T`、`[]T` 和 `[]const T`。多项指针、哨兵指针和裸地址转换主要用于系统/底层场景。

## 单项指针 `*T`

`*T` 指向一个确定存在的 `T` 值，不携带长度，不可为空。取地址用 `&value`，解引用用 `ptr.*`。

```zig
const std = @import("std");

const User = struct {
    id: u32,
    score: i32,
};

fn printUser(user: *const User) void {
    std.debug.print("user id = {}, score = {}\n", .{ user.id, user.score });
}

fn bumpScore(user: *User) void {
    user.score += 1;
}

test "single item pointer" {
    var x: i32 = 42;
    const ptr: *i32 = &x;

    ptr.* = 100;
    try std.testing.expect(x == 100);

    var user = User{ .id = 1, .score = 10 };
    printUser(&user);
    bumpScore(&user);
    try std.testing.expect(user.score == 11);
}
```

`*T` 和 `*const T` 的区别在于可变性。`printUser` 接收 `*const User`，承诺不修改数据；`bumpScore` 接收 `*User`，允许原地修改。可变性写进类型，而不是留给调用者猜测。

单项指针的典型使用场景：避免复制大对象、原地修改数据、在数据结构之间建立链接。下面的例子演示按指针传递大对象：

```zig
const std = @import("std");

const Big = struct {
    data: [1024]u8,
};

fn inspect(big: *const Big) usize {
    return big.data.len;
}

test "pass large value by pointer" {
    const value = Big{ .data = [_]u8{0} ** 1024 };
    try std.testing.expect(inspect(&value) == 1024);
}
```

按值传递会复制整个对象，按指针传递只是借用已有对象的地址。

## 切片 `[]T`

切片是 Zig 中最常用的序列视图，同时携带起始地址和长度。与多项指针 `[*]T` 的关键区别在于：切片有长度，索引访问会做边界检查。

```zig
const std = @import("std");

fn sum(nums: []const i32) i32 {
    var total: i32 = 0;
    for (nums) |n| {
        total += n;
    }
    return total;
}

fn findFirst(items: []const i32, target: i32) ?usize {
    for (items, 0..) |item, index| {
        if (item == target) return index;
    }
    return null;
}

test "slice basics" {
    var array = [_]i32{ 10, 20, 30, 40, 50 };
    const slice: []i32 = array[1..4];

    try std.testing.expect(slice.len == 3);
    try std.testing.expect(slice[0] == 20);

    slice[1] = 99;
    try std.testing.expect(array[2] == 99);

    const data = [_]i32{ 1, 2, 3, 4 };
    try std.testing.expect(sum(&data) == 10);
    try std.testing.expect(findFirst(&data, 3).? == 2);
    try std.testing.expect(findFirst(&data, 99) == null);
}
```

`array[1..4]` 产生原数组的一段视图，不是复制；修改切片中的元素会反映到原数组。`sum` 和 `findFirst` 都接收 `[]const i32`，表达"借用一段只读连续数据，不拥有也不修改"。

### 只读切片与字符串

`[]const T` 表示只读切片。字符串在 Zig 中就是 `[]const u8`——只读字节切片，没有独立的字符串类型。

```zig
const std = @import("std");

fn startsWithHello(s: []const u8) bool {
    return std.mem.startsWith(u8, s, "hello");
}

test "string as readonly byte slice" {
    try std.testing.expect(startsWithHello("hello zig"));
    try std.testing.expect(!startsWithHello("world"));
}
```

### 哨兵切片与哨兵指针

C 字符串等数据使用哨兵值（如 `0`）标记结尾。对应类型：

- `[:0]const u8`：带长度，以 `0` 结尾的切片
- `[*:0]const u8`：无长度，以 `0` 结尾的多项指针

长度信息和哨兵信息是两种不同的边界表达方式。切片主要依赖长度，C 风格接口常依赖哨兵。Zig 将这些约束写进类型而不是隐藏起来。

### 切片的底层字段

切片是一个"胖指针"，通过 `.ptr` 和 `.len` 可以直接访问底层字段：

```zig
const std = @import("std");

test "slice ptr and len fields" {
    var array = [_]i32{ 10, 20, 30, 40 };
    const slice: []i32 = &array;

    try std.testing.expect(slice.len == 4);
    try std.testing.expect(slice.ptr[0] == 10);
    try std.testing.expect(slice.ptr[2] == 30);
}
```

`.ptr` 的类型是 `[*]i32`，即底层多项指针，访问时不做边界检查。

## 其他指针类型

### 数组指针 `*[N]T`

数组指针指向一个长度在类型层面固定的数组。与切片的区别：长度是类型的一部分，适合需要静态长度约束的场景。

```zig
const std = @import("std");

fn xorBlock(block: *[16]u8, value: u8) void {
    for (block) |*byte| {
        byte.* ^= value;
    }
}

test "array pointer" {
    var data = [_]u8{ 1, 2, 3, 4 };
    const ptr: *[4]u8 = &data;

    try std.testing.expect(ptr[0] == 1);
    ptr[1] = 99;
    try std.testing.expect(data[1] == 99);

    var block = [_]u8{0} ** 16;
    xorBlock(&block, 0xff);
    try std.testing.expect(block[0] == 0xff);
    try std.testing.expect(block[15] == 0xff);
}
```

- `*[N]T`：固定长度数组本体的地址
- `[]T`：运行时长度的序列视图

### 可选指针 `?*T`

`*T` 一定有值，`?*T` 允许为 `null`。接口返回 `?*T` 时，调用者必须处理"未找到"的情况。

```zig
const std = @import("std");

fn findValue(items: []i32, target: i32) ?*i32 {
    for (items) |*item| {
        if (item.* == target) return item;
    }
    return null;
}

test "optional pointer" {
    var data = [_]i32{ 10, 20, 30 };

    if (findValue(&data, 20)) |ptr| {
        ptr.* = 99;
    } else {
        return error.TestUnexpectedResult;
    }

    try std.testing.expect(data[1] == 99);
    try std.testing.expect(findValue(&data, 100) == null);
}
```

返回 `?*T` 时，底层存储的生命周期由调用者保证——如果底层数据被释放或移动，指针将失效。

### 多项指针 `[*]T`

`[*]T` 指向连续元素但不携带长度，主要用于 C 互操作和底层内存操作。

```zig
const std = @import("std");

test "many item pointer from array" {
    var array = [_]i32{ 1, 2, 3, 4 };

    const ptr: [*]i32 = &array;

    try std.testing.expect(ptr[0] == 1);
    try std.testing.expect(ptr[2] == 3);

    const slice = ptr[0..array.len];
    try std.testing.expect(slice.len == 4);
}
```

`[*]T` 没有长度信息，越界风险更难识别。普通代码中应优先使用 `[]T` 表示序列。

> Zig 禁止 C 风格的指针算术（如 `ptr + 1`）。需要偏移访问时使用切片索引 `slice[i]` 或多项指针索引 `ptr[i]`。

## 隐式类型强制转换

Zig 定义了一组隐式指针强制转换规则，从更具体的类型向更宽泛的类型自动转换，反方向需要显式操作。

| 源类型    | 目标类型     | 条件                 |
| --------- | ------------ | -------------------- |
| `*[N]T`   | `[]T`        | 隐式                 |
| `*[N]T`   | `[*]T`       | 隐式                 |
| `*[N:s]T` | `[:s]T`      | 隐式                 |
| `*T`      | `*const T`   | 隐式（放弃可变性）   |
| `[]T`     | `[]const T`  | 隐式（放弃可变性）   |
| `[:s]T`   | `[]T`        | 隐式（丢弃哨兵信息） |
| `*T`      | `*anyopaque` | 隐式（类型擦除）     |

## 对齐

对齐指值的地址是否满足特定倍数边界（如 4 字节、16 字节对齐）。正常声明的变量自动满足基本对齐要求。在手动指针转换、底层内存访问、SIMD 或 MMIO 等场景中，对齐需要显式处理。

```zig
const std = @import("std");

test "aligned value and pointer" {
    var value: i32 align(16) = 42;

    const ptr: *align(16) i32 = &value;

    try std.testing.expect(ptr.* == 42);
    try std.testing.expect(@intFromPtr(ptr) % 16 == 0);
}
```

更强的对齐承诺必须有真实依据——不能把普通 `*i32` 当作 `*align(16) i32`，这等于对编译器做更强的保证。错误的对齐假设可能导致性能下降、某些平台崩溃或未定义行为。

## 指针转换

### `@ptrCast`：改变指针的解释方式

`@ptrCast` 将一种指针类型转为另一种，前提是底层内存布局兼容、地址满足目标类型的对齐要求。

```zig
const std = @import("std");

test "ptrCast" {
    var value: u32 = 0x11223344;
    const byte_ptr: *u8 = @ptrCast(&value);

    _ = byte_ptr;
}
```

`@ptrCast` 属于底层工具，使用时需要清楚别名、布局、端序等问题。如果只是想安全处理字节序列，应优先使用更明确的接口。

### `@intFromPtr` 和 `@ptrFromInt`：地址与整数的转换

`@intFromPtr` 将指针转为整数地址，`@ptrFromInt` 将整数转为指针。前者是安全的只读操作，后者只有在裸机开发、内核开发、MMIO 寄存器映射等明确知道地址有效的场景下才有意义。

```zig
const std = @import("std");

test "pointer to integer" {
    var value: i32 = 123;
    const addr = @intFromPtr(&value);

    try std.testing.expect(addr != 0);
}

test "ptrFromInt" {
    const raw_addr: usize = 0x1000;
    const ptr: *u8 = @ptrFromInt(raw_addr);

    _ = ptr;
}
```

## `volatile` 指针

`volatile` 表示该地址上的读写具有外部可观察语义，编译器不应优化掉这些访问。它不等于线程安全，也不等于并发同步。主要用于内存映射寄存器（MMIO）和硬件设备访问。

```zig
const std = @import("std");

const UART_DR: *volatile u32 = @ptrFromInt(0x4000_1000);

test "volatile pointer" {
    _ = UART_DR;
}
```

线程同步应使用锁、原子操作和并发模型，`volatile` 仅用于硬件寄存器等特殊场景。

## `@fieldParentPtr`：从字段指针反推结构体

`@fieldParentPtr` 从某个字段的指针反推出整个结构体对象的指针，常用于侵入式链表、侵入式队列和回调上下文对象。

```zig
const std = @import("std");

const Creature = struct {
    health: f32,
    mana: u32,
    stamina: u32,
};

fn boostMana(mana_ptr: *u32, amount: u32) void {
    const creature_ptr: *Creature = @fieldParentPtr("mana", mana_ptr);
    creature_ptr.mana += amount;
}

test "fieldParentPtr" {
    var elf = Creature{
        .health = 100.0,
        .mana = 10,
        .stamina = 50,
    };

    boostMana(&elf.mana, 20);

    try std.testing.expect(elf.mana == 30);
}
```

这个机制依赖字段确实来自对应结构体，字段偏移关系在当前类型布局中成立。
