# 指针、切片与对齐

## 类型总览

| 类型         | 语法        | 含义                     | 常见用途                 |
| ------------ | ----------- | ------------------------ | ------------------------ |
| 单项指针     | `*T`        | 指向一个 `T` 值          | 传参、原地修改、避免复制 |
| 只读单项指针 | `*const T`  | 指向一个只读 `T` 值      | 只读借用                 |
| 可选指针     | `?*T`       | 可能有 `T`，也可能没有   | 查找结果、可空句柄       |
| 数组指针     | `*[N]T`     | 指向固定长度数组         | 保留数组长度信息         |
| 多项指针     | `[*]T`      | 指向连续元素，不携带长度 | 底层内存、C 互操作       |
| 切片         | `[]T`       | 指针 + 长度              | 动态序列视图             |
| 只读切片     | `[]const T` | 只读切片视图             | 字符串、只读序列参数     |
| 哨兵切片     | `[:S]T`     | 带长度，以哨兵值结尾     | C 风格数据协作           |
| 哨兵多项指针 | `[*:S]T`    | 无长度，以哨兵值结尾     | C 风格字符串             |

日常最常用的是 `*T`、`*const T`、`[]T`、`[]const T`。多项指针、哨兵指针和裸地址转换主要用于系统/底层场景。

## 单项指针 `*T`

`*T` 指向一个确定存在的 `T` 值，不可为空。取地址用 `&value`，解引用用 `ptr.*`。

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

    var user = User{ .id = 1, .score = 10 };
    printUser(&user);
    bumpScore(&user);
    try std.testing.expect(user.score == 11);
}
```

`*User` 允许修改数据，`*const User` 承诺不修改——可变性由类型表达。

## 切片 `[]T`

切片是 Zig 的序列视图，携带起始地址和长度，索引访问做边界检查。

```zig
const std = @import("std");

fn sum(nums: []const i32) i32 {
    var total: i32 = 0;
    for (nums) |n| total += n;
    return total;
}

test "slice basics" {
    var array = [_]i32{ 10, 20, 30, 40, 50 };
    const slice: []i32 = array[1..4];

    try std.testing.expect(slice.len == 3);
    try std.testing.expect(slice[0] == 20);

    slice[1] = 99;
    try std.testing.expect(array[2] == 99);

    try std.testing.expect(sum(&[_]i32{ 1, 2, 3, 4 }) == 10);
}
```

`array[1..4]` 是原数组的一段视图，不是复制；修改切片元素会反映到原数组。

### 字符串

Zig 中没有独立的字符串类型——字符串就是 `[]const u8`（只读字节切片）。

```zig
test "string as readonly byte slice" {
    const name: []const u8 = "zig";
    try std.testing.expect(name.len == 3);
    try std.testing.expect(name[0] == 'z');
}
```

### 哨兵切片与哨兵指针

C 接口常用哨兵值（如 `0`）标记结尾：

- `[:0]const u8` — 带长度，以 `0` 结尾的切片
- `[*:0]const u8` — 无长度，以 `0` 结尾的多项指针

Zig 将哨兵信息写进类型而非隐藏。

### 切片的底层字段

切片是一个"胖指针"，可直接访问 `.ptr` 和 `.len`：

```zig
test "slice ptr and len" {
    var array = [_]i32{ 10, 20, 30, 40 };
    const slice: []i32 = &array;

    try std.testing.expect(slice.len == 4);
    try std.testing.expect(slice.ptr[0] == 10);
}
```

`.ptr` 的类型是 `[*]i32`，访问时不携带长度信息也不做边界检查。

## 其他指针类型

### 数组指针 `*[N]T`

数组指针指向固定长度数组，长度是类型的一部分：

```zig
fn xorBlock(block: *[16]u8, value: u8) void {
    for (block) |*byte| byte.* ^= value;
}

test "array pointer" {
    var arr = [_]u8{ 1, 2, 3, 4 };
    const ptr: *[4]u8 = &arr;
    ptr[1] = 99;
    try std.testing.expect(arr[1] == 99);

    var block = [_]u8{0} ** 16;
    xorBlock(&block, 0xff);
    try std.testing.expect(block[0] == 0xff);
}
```

`*[N]T` 的长度在编译期已知；`[]T` 的长度在运行时可变。

### 可选指针 `?*T`

`?*T` 允许为 `null`，常见于查找函数返回"找到了则修改"的语义：

```zig
fn findValue(items: []i32, target: i32) ?*i32 {
    for (items) |*item| {
        if (item.* == target) return item;
    }
    return null;
}

test "optional pointer" {
    var data = [_]i32{ 10, 20, 30 };
    if (findValue(&data, 20)) |ptr| ptr.* = 99;
    try std.testing.expect(data[1] == 99);
    try std.testing.expect(findValue(&data, 100) == null);
}
```

返回 `?*T` 时，底层数据的生命周期由调用者保证——数据被释放后指针失效。

### 多项指针 `[*]T`

`[*]T` 指向连续元素但不携带长度。普通代码应优先使用 `[]T`，多项指针主要用于 C 互操作和底层内存操作。

```zig
test "many item pointer" {
    var array = [_]i32{ 1, 2, 3, 4 };
    const ptr: [*]i32 = &array;

    try std.testing.expect(ptr[0] == 1);
    const slice = ptr[0..array.len];
    try std.testing.expect(slice.len == 4);
}
```

> Zig 不支持 C 风格的指针算术（`ptr + 1`）。偏移访问使用 `slice[i]` 或 `ptr[i]`。

## 隐式指针强制转换

Zig 支持从更具体的类型向更宽泛的类型自动转换：

| 源类型    | 目标类型     | 说明         |
| --------- | ------------ | ------------ |
| `*[N]T`   | `[]T`        |              |
| `*[N]T`   | `[*]T`       |              |
| `*[N:s]T` | `[:s]T`      |              |
| `*T`      | `*const T`   | 放弃可变性   |
| `[]T`     | `[]const T`  | 放弃可变性   |
| `[:s]T`   | `[]T`        | 丢弃哨兵信息 |
| `*T`      | `*anyopaque` | 类型擦除     |

反方向需要显式操作。

## 对齐

对齐指值的地址满足特定倍数边界（如 4 字节、16 字节）。正常声明的变量自动满足基本对齐要求。手动指针转换、SIMD 或 MMIO 场景中需要显式处理。

```zig
test "aligned value" {
    var value: i32 align(16) = 42;
    const ptr: *align(16) i32 = &value;

    try std.testing.expect(ptr.* == 42);
    try std.testing.expect(@intFromPtr(ptr) % 16 == 0);
}
```

不能将普通 `*i32` 当作 `*align(16) i32`——这等于对编译器做更强的保证。错误的对齐假设可能导致性能下降或未定义行为。

## 指针转换

### `@ptrCast`

`@ptrCast` 将一种指针类型转为另一种，前提是底层内存兼容、地址满足目标对齐：

```zig
test "ptrCast" {
    var value: u32 = 0x11223344;
    const byte_ptr: *u8 = @ptrCast(&value);
    _ = byte_ptr;
}
```

`@ptrCast` 是底层工具，处理字节序列时优先使用更安全的接口。

### `@intFromPtr` / `@ptrFromInt`

`@intFromPtr` 将指针转为整数地址；`@ptrFromInt` 将整数转为指针，仅在裸机、内核、MMIO 等明确知道地址有效的场景下使用：

```zig
test "pointer to integer" {
    var value: i32 = 123;
    const addr = @intFromPtr(&value);
    try std.testing.expect(addr != 0);
}
```

## `volatile` 指针

`volatile` 表示该地址的读写具有外部可观察语义，编译器不应优化掉这些访问。用于内存映射寄存器（MMIO）和硬件设备访问。

```zig
const UART_DR: *volatile u32 = @ptrFromInt(0x4000_1000);

test "volatile pointer" {
    _ = UART_DR;
}
```

`volatile` 不等于线程安全或并发同步。线程同步应使用锁或原子操作。

## `@fieldParentPtr`：从字段指针反推结构体

`@fieldParentPtr` 从某个字段的指针反推出整个结构体对象的指针，用于侵入式链表和回调上下文对象：

```zig
const std = @import("std");

const Creature = struct {
    health: f32,
    mana: u32,
};

fn boostMana(mana_ptr: *u32, amount: u32) void {
    const creature: *Creature = @fieldParentPtr("mana", mana_ptr);
    creature.mana += amount;
}

test "fieldParentPtr" {
    var elf = Creature{ .health = 100.0, .mana = 10 };
    boostMana(&elf.mana, 20);
    try std.testing.expect(elf.mana == 30);
}
```

字段必须确实来自对应结构体，偏移关系在当前类型布局中成立。
