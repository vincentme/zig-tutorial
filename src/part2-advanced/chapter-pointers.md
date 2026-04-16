# 指针、切片与对齐

> **进阶**：这一章是第二部分里的基础核心章节之一。  
> 在 Zig 中，很多"看起来像语法问题"的困惑，最后其实都和**数据布局、生命周期、可变性、边界信息以及所有权责任**有关。  
> 因此，本章的目标不是把所有指针写法都列一遍，而是建立一条更可靠的理解路径：
>
> 1. 先理解最常见的单项指针 `*T`
> 2. 再理解最常用的数据视图：切片 `[]T`
> 3. 然后区分数组指针、多项指针、可选指针
> 4. 最后再进入对齐、裸指针转换、`volatile`、`@fieldParentPtr` 这些更偏底层的话题
>
> 初次系统接触 Zig 指针时，建议优先把前半章读扎实；后半章的高级内容更适合作为"按需深入"。

---

## 相关阅读与衔接建议

- 刚读完[泛型编程](chapter-generics.md)的话，可以把这一章当成"编译期抽象"之后的下一步：开始把注意力从类型工厂与泛型接口，转向**数据视图、可变性、边界信息和底层表示**。
- 接下来准备读[内存管理模型](chapter-memory-management.md)的话，这一章其实就是很重要的前置基础。因为很多内存管理问题，最后都会落到：
  - 拿到的是值、指针还是切片
  - 这里表达的是拥有、借用还是共享访问
  - 生命周期和边界信息是否足够清楚
- 如果目前只想抓主线，请优先掌握：
  - `*T` / `*const T`
  - `[]T` / `[]const T`
  - `?*T`
  - 数组指针与多项指针的基本区别  
  至于 `@ptrCast`、`@ptrFromInt`、`volatile`、`@fieldParentPtr`，更适合作为第二遍阅读时的"按需深入"。

---

## 为什么这一章很重要？

在 Zig 里，指针不是"高级技巧"，而是迟早会稳定接触的基本工具。原因很简单：

- 函数参数常常需要避免复制大对象
- 数据结构往往需要共享、修改或借用同一块内存
- 切片、字符串、容器、分配器接口都和内存视图密切相关
- 与 C 互操作、系统编程、内存管理更离不开指针语义

但更重要的是：

> **Zig 的设计意图不是"模糊地用指针"，而是明确表达手里拿到的到底是什么。**

因此，学习指针时，最值得反复问自己的不是"这个语法怎么写"，而是：

- 这里指向的是单个值，还是一段连续数据？
- 这里有没有长度信息？
- 这里能不能修改原值？
- 这里可能为空吗？
- 这里的生命周期由谁保证？
- 这里有没有对齐、越界或悬空风险？

---

## 先建立总览：常见相关类型有哪些？

Zig 中最常见的几类"指向数据"的类型如下：

| 类型      | 语法      | 表达的含义                    | 最常见用途                    |
| --------- | --------- | ----------------------------- | ----------------------------- |
| 单项指针  | `*T`      | 指向一个 `T` 值               | 传参、原地修改、避免复制      |
| 只读单项指针 | `*const T` | 指向一个只读 `T` 值         | 只读借用                      |
| 可选指针  | `?*T`     | 可能有一个 `T`，也可能没有    | 查找结果、可空句柄            |
| 数组指针  | `*[N]T`   | 指向一个固定长度数组          | 保留数组长度信息              |
| 多项指针  | `[*]T`    | 指向连续元素，但不携带长度    | 底层内存、C 互操作            |
| 切片      | `[]T`     | 指针 + 长度                   | 最常见的动态序列视图          |
| 只读切片  | `[]const T` | 只读的切片视图              | 字符串、只读序列参数          |
| 哨兵切片  | `[:S]T`   | 带长度，且约定以哨兵值结尾    | 与特定 C 风格数据协作         |
| 哨兵多项指针 | `[*:S]T` | 无长度，但约定以哨兵值结尾   | C 风格字符串、底层接口        |

建议牢牢记住三件事：

1. **日常最常用的是 `*T` 和 `[]T`**
2. **切片比多项指针更安全，也更常见**
3. **多项指针、裸地址转换、`volatile` 更偏系统/底层场景**

---

## 单项指针 `*T`

### 什么是单项指针？

单项指针 `*T` 表示：

> **这里有一个确定存在的 `T` 值，我拿到了它的地址。**

它不表示"很多元素"，也不表示"可能为空"，更不附带长度信息。  
它只是单纯地指向一个值。

### 基本操作

- 取地址：`&value`
- 解引用：`ptr.*`

示例：

```zig
const std = @import("std");

test "single item pointer basics" {
    var value: i32 = 42;

    const ptr: *i32 = &value;
    try std.testing.expect(ptr.* == 42);

    ptr.* = 100;
    try std.testing.expect(value == 100);
}
```

这个例子的核心在于语义：

- `ptr` 和 `value` 指向的是同一个底层值
- 修改 `ptr.*`，就是在修改原始变量
- 没有复制出第二份 `i32`

---

### `*T` 和 `*const T` 的区别

很多时候，函数不应修改传入的数据。这时应该使用只读指针 `*const T`。

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

test "mutable and const pointers" {
    var user = User{
        .id = 1,
        .score = 10,
    };

    printUser(&user);
    bumpScore(&user);

    try std.testing.expect(user.score == 11);
}
```

这里表达得非常清楚：

- `printUser` 只借用数据，只读不改
- `bumpScore` 借用数据，并且会修改它

这也是 Zig 一贯强调的风格：

> **把可变性写进类型里，而不是留给读者猜。**

---

### 什么时候用单项指针？

常见场景有这些：

1. **避免复制大对象**
2. **需要原地修改数据**
3. **数据结构之间需要建立链接**
4. **明确表达"借用同一个对象"**

比如函数参数：

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

如果把这种对象按值传递，语义上就是复制；
而按指针传递，语义上则是"借用已有对象"。

---

## 切片 `[]T`

### 为什么切片比很多指针话题更重要？

虽然"指针章节"往往让人先想到 `*T`，但在实际 Zig 代码里，更高频接触的通常是：

- `[]u8`
- `[]const u8`
- `[]T`
- `[]const T`

也就是切片。

因为很多程序真正操作的不是"单个对象"，而是"一段连续数据"。  
而切片正是 Zig 中最常用的这类数据视图。

---

### 什么是切片？

切片 `[]T` 可以理解为：

> **一段连续 `T` 元素的视图，它同时携带起始地址和长度。**

这和多项指针 `[*]T` 的关键区别在于：

- 切片有长度
- 切片的索引访问会做边界检查
- 切片更适合作为普通代码中的序列视图

示例：

```zig
const std = @import("std");

test "slice basics" {
    var array = [_]i32{ 10, 20, 30, 40, 50 };

    const slice: []i32 = array[1..4];

    try std.testing.expect(slice.len == 3);
    try std.testing.expect(slice[0] == 20);
    try std.testing.expect(slice[2] == 40);

    slice[1] = 99;
    try std.testing.expect(array[2] == 99);
}
```

这段代码说明了几个核心点：

- `array[1..4]` 得到的是一个切片
- 它是对原数组的一段"视图"，不是复制
- 修改切片中的元素，会反映到原数组上

---

### 切片的心智模型

理解切片时，可以把它当成两部分：

1. 一个起始指针
2. 一个长度

因此，切片不是"单纯的地址"。  
它是**带边界信息的视图**。

这正是为什么切片在普通代码里比 `[*]T` 更值得优先使用：

- 更安全
- 更易读
- 更能表达意图

---

### 只读切片 `[]const T`

如果只想读取一段数据，不允许修改，那么使用 `[]const T`。

```zig
const std = @import("std");

fn sum(nums: []const i32) i32 {
    var total: i32 = 0;
    for (nums) |n| {
        total += n;
    }
    return total;
}

test "readonly slice parameter" {
    const data = [_]i32{ 1, 2, 3, 4 };
    try std.testing.expect(sum(&data) == 10);
}
```

这类写法在 Zig 中非常常见：

- 字符串通常是 `[]const u8`
- 只读输入数据常用 `[]const T`
- 能只读时尽量只读，有助于减少误用

---

### 切片为什么适合作为函数参数？

因为它能同时表达三件事：

1. 我拿到的是连续数据
2. 我知道长度
3. 我不拥有这块内存，只是借用它

例如搜索：

```zig
const std = @import("std");

fn findFirst(items: []const i32, target: i32) ?usize {
    for (items, 0..) |item, index| {
        if (item == target) return index;
    }
    return null;
}

test "find in slice" {
    const data = [_]i32{ 5, 8, 13, 21 };

    try std.testing.expect(findFirst(&data, 13).? == 2);
    try std.testing.expect(findFirst(&data, 99) == null);
}
```

从接口设计角度看，这个函数写得很清楚：

- 它不拥有 `items`
- 它不修改 `items`
- 它按只读序列来处理输入

---

### 字符串与 `[]const u8`

在 Zig 中，最常见的"字符串"表示其实不是单独的字符串对象，而是：

- `[]const u8`

也就是"只读字节切片"。

例如：

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

这很符合 Zig 的风格：

- 不把字符串神秘化
- 它本质上就是字节序列
- 是否带长度、是否带哨兵，要看具体类型

---

### 哨兵切片和哨兵指针

有些数据约定会使用结尾标记，例如 C 字符串常见的 `0` 结尾。  
这时可能会看到：

- `[*:0]const u8`
- `[:0]const u8`

它们表达的是：

- 元素序列以某个哨兵值结尾
- 类型里显式保留了这个约定

不必把哨兵系列语法全部背下来。更重要的是理解：

> **长度信息和哨兵信息是两种不同的边界表达方式。**

- 切片主要依赖长度
- C 风格字符串常依赖哨兵
- Zig 会把这些约束写进类型，而不是隐藏起来

---

## 其他指针类型

### 数组指针 `*[N]T`

数组指针 `*[N]T` 表示：

> **我指向的是一个长度在类型层面就固定下来的数组。**

比如：

```zig
const std = @import("std");

test "array pointer keeps array length in type" {
    var data = [_]u8{ 1, 2, 3, 4 };

    const ptr: *[4]u8 = &data;

    try std.testing.expect(ptr[0] == 1);
    try std.testing.expect(ptr[3] == 4);

    ptr[1] = 99;
    try std.testing.expect(data[1] == 99);
}
```

和切片相比，数组指针的区别主要在于：

- 长度是类型的一部分
- 更适合那些"长度必须静态已知"的场景
- 不如切片灵活

可以这样记：

- `*[N]T`：**固定长度数组本体的地址**
- `[]T`：**一段运行时长度的序列视图**

**什么时候数组指针有用？**

它适合这些情况：

1. 明确要求某个固定长度
2. 想在类型层面保留这个约束
3. 处理的就是数组本身，而不是任意长度序列

例如只接受 16 字节块：

```zig
const std = @import("std");

fn xorBlock(block: *[16]u8, value: u8) void {
    for (block) |*byte| {
        byte.* ^= value;
    }
}

test "fixed size array pointer" {
    var block = [_]u8{0} ** 16;
    xorBlock(&block, 0xff);

    try std.testing.expect(block[0] == 0xff);
    try std.testing.expect(block[15] == 0xff);
}
```

---

### 可选指针 `?*T`

很多语言里，空指针是一种隐患。  
Zig 的做法不是"假装空指针不存在"，而是要求显式写出来：

- `*T`：一定有值
- `?*T`：可能没有值

这让接口的语义更清楚，也强迫调用者处理"没有找到"的情况。

示例：

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

**什么时候返回 `?*T` 合适？**

常见场景：

1. 在现有数据结构里查找元素
2. 返回"可能存在"的对象位置
3. 想让调用者原地修改找到的值

但要注意一点：

> 返回指针时，生命周期约束也随之暴露给了调用者。

如果底层数据后续失效、被移动或被释放，那么这个指针也会失效。  
所以返回 `?*T` 很强大，但也意味着必须清楚底层存储的生命周期。

---

### 多项指针 `[*]T`

多项指针 `[*]T` 表示：

> **这里有一段连续的 `T` 元素，但当前类型里不包含长度。**

它通常用于：

- 与 C 互操作
- 底层内存操作
- 已经通过其他方式知道边界的场景

示例：

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

**为什么普通代码里不应优先用 `[*]T`？**

因为它没有长度。  
这意味着：

- 读代码的人需要额外知道边界来自哪里
- 越界风险更难识别
- 接口语义不如切片清楚

所以在普通业务代码里，更推荐：

- 用 `[]T` / `[]const T` 表示序列
- 只有在确实需要底层语义时再使用 `[*]T`

可以理解为：

> **`[*]T` 更像"底层原始视图"，`[]T` 更像"日常安全视图"。**

---

## 底层操作：对齐、转换与 volatile

### 对齐

对齐可以简单理解为：

> **某个值的地址是否满足该类型或该平台要求的特定倍数边界。**

比如一个值可能要求地址是 4 的倍数、8 的倍数或 16 的倍数。

大多数时候，正常声明的变量都会自然满足自己的基本对齐要求。  
但在下面这些场景里，对齐会变得重要：

- 手动做指针转换
- 访问底层内存
- 与外部 ABI 交互
- 进行 SIMD、MMIO 或特殊平台优化

**显式对齐示例**

```zig
const std = @import("std");

test "aligned value and aligned pointer" {
    var value: i32 align(16) = 42;

    const ptr: *align(16) i32 = &value;

    try std.testing.expect(ptr.* == 42);
    try std.testing.expect(@intFromPtr(ptr) % 16 == 0);
}
```

这个例子里：

- `value` 被显式声明为 16 字节对齐
- 因而取地址后，可以安全地得到 `*align(16) i32`

这里的重点不是"总要手动写对齐"，而是理解：

> **更强的对齐承诺必须有真实依据。**

不能随意把一个普通 `*i32` 说成 `*align(16) i32`，  
因为那等于对编译器做更强的保证。

**为什么对齐很重要？**

因为错误的对齐假设可能导致：

- 性能下降
- 某些平台直接崩溃
- 未定义行为
- 错误的代码生成假设

所以只要开始接触：

- `@ptrCast`
- `@alignCast`
- 原始内存视图
- 硬件寄存器映射

就要把对齐问题认真看待。

---

### 指针转换

在 Zig 中，指针转换并不是"想转就转"的普通重命名。  
它往往意味着：

- 我知道底层内存布局兼容
- 我知道当前地址满足目标类型的对齐要求
- 我知道这种解释方式在当前场景下是合法的

因此，指针转换应该理解成一种**显式承诺**，而不是"方便写法"。

#### `@ptrCast`：改变解释方式

示例：

```zig
const std = @import("std");

test "ptrCast should be treated as low level operation" {
    var value: u32 = 0x11223344;

    const byte_ptr: *u8 = @ptrCast(&value);

    _ = byte_ptr;
}
```

这个例子只是为了说明语法存在。  
它**不适合**被理解为"普通代码里推荐这样做字节检查"。

为什么？

- 它会让读者很快掉进别名、布局、端序等更复杂的问题里
- 如果只是想安全处理字节序列，通常更应该使用更明确的数据接口
- 它属于底层能力，不是第一选择

所以这里最值得记住的是：

> **`@ptrCast` 不是禁用功能，但它属于需要清楚前提条件的低层工具。**

#### `@ptrFromInt` 和 `@intFromPtr`

这两个内置函数涉及"地址和整数之间的转换"。

示例：

```zig
const std = @import("std");

test "pointer to integer" {
    var value: i32 = 123;
    const addr = @intFromPtr(&value);

    try std.testing.expect(addr != 0);
}
```

而把整数直接变成指针则要危险得多：

```zig
const std = @import("std");

test "ptrFromInt is for very specific low level cases" {
    const raw_addr: usize = 0x1000;
    const ptr: *u8 = @ptrFromInt(raw_addr);

    _ = ptr;
}
```

这里必须非常明确：

> **在普通用户态程序里，随意把整数转成指针几乎没有通用教学价值。**

它通常只在这些场景下才有意义：

- 裸机开发
- 内核开发
- MMIO 寄存器映射
- 非常明确知道这个地址为何有效

如果不是这些场景，请不要把它当成普通编程技巧。

---

### 隐式类型强制转换（Coercion）

除了显式的 `@ptrCast`，Zig 还定义了一组**隐式指针强制转换**规则。  
理解这些规则有助于消除"为什么这里不用转换也能传？"之类的常见困惑。

| 源类型 | 目标类型 | 条件 |
|--------|----------|------|
| `*[N]T` | `[]T` | 隐式 |
| `*[N]T` | `[*]T` | 隐式 |
| `*[N:s]T` | `[:s]T` | 隐式 |
| `*T` | `*const T` | 隐式（放弃可变性） |
| `[]T` | `[]const T` | 隐式（放弃可变性） |
| `[:s]T` | `[]T` | 隐式（丢弃哨兵信息） |
| `*T` | `*anyopaque` | 隐式（类型擦除） |

基本原则是：**从更具体到更宽泛的方向可以隐式转换，反方向则需要显式操作。**

切片本身是一个"胖指针"结构，可以通过 `.ptr` 和 `.len` 直接访问它的底层字段：

```zig
const std = @import("std");

test "slice ptr and len fields" {
    var array = [_]i32{ 10, 20, 30, 40 };
    const slice: []i32 = &array;

    // .len 是切片携带的长度信息
    try std.testing.expect(slice.len == 4);

    // .ptr 是底层的多项指针 [*]i32
    try std.testing.expect(slice.ptr[0] == 10);
    try std.testing.expect(slice.ptr[2] == 30);
}
```

> **注意**：Zig 禁止 C 风格的指针算术（如 `ptr + 1`）。需要偏移访问时，应使用切片索引（`slice[i]`）或多项指针索引（`ptr[i]`），而不是对指针做加法运算。这是 Zig 类型安全设计的一部分。

---

### `volatile` 指针

`volatile` 的核心意思不是"线程安全"，也不是"防竞态"。  
它表达的是：

> **这个地址上的读写具有外部可观察语义，编译器不应把这些访问随意优化掉。**

它常见于：

- 内存映射寄存器（MMIO）
- 特定硬件设备访问
- 某些极底层同步场景

示例：

```zig
const std = @import("std");

// 仅作语法示意，不适用于普通用户态程序。
const UART_DR: *volatile u32 = @ptrFromInt(0x4000_1000);

test "volatile pointer example is conceptual only" {
    _ = UART_DR;
}
```

这里必须强调两次：

1. 这不是普通程序该模仿的写法
2. `volatile` 不等于并发同步原语

处理线程同步时，优先考虑锁、原子操作和并发模型；处理硬件寄存器时，才更可能需要 `volatile`。

---

## `@fieldParentPtr`：从字段指针反推结构体

### 这个能力是做什么的？

`@fieldParentPtr` 可以从某个字段的指针，反推出整个结构体对象的指针。

这在下面这类场景里特别有用：

- 侵入式链表
- 侵入式队列
- 回调上下文对象
- 底层容器实现

它是很强的工具，但也明显属于高级内容。  
如果目前还在巩固 `*T`、切片和生命周期，不必急着深挖。

---

### 基本示例

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

test "fieldParentPtr basic example" {
    var elf = Creature{
        .health = 100.0,
        .mana = 10,
        .stamina = 50,
    };

    boostMana(&elf.mana, 20);

    try std.testing.expect(elf.mana == 30);
}
```

这个机制依赖的前提是：

- `mana_ptr` 确实来自某个 `Creature` 的 `mana` 字段
- 这个字段偏移关系在当前类型布局中成立

如果这些前提不成立，那么推导出的"父对象指针"也就不可靠。

---

### 为什么说它是高级特性？

因为它隐含了很多前提：

- 必须非常确定字段来源
- 必须理解对象布局
- 必须确认生命周期仍然有效
- 需要承担更强的正确性责任

所以对教程读者来说，更合适的定位是：

> **知道有这个能力，并理解它主要用于侵入式数据结构；普通业务代码不必优先依赖它。**

---

## 指针类型应该怎么选？

这是本章最实用的问题之一。

下面这张表可以帮助建立直觉：

| 场景 | 更推荐的类型 | 原因 |
| ---- | ------------ | ---- |
| 只读借用单个值 | `*const T` | 清楚表达只读，不复制 |
| 可修改单个值 | `*T` | 明确表达原地修改 |
| 只读序列输入 | `[]const T` | 安全、常见、带长度 |
| 可修改序列 | `[]T` | 适合批量处理连续数据 |
| 固定长度数组 | `*[N]T` | 长度进入类型 |
| 可能不存在的对象 | `?*T` | 显式处理空值 |
| 底层原始连续内存 | `[*]T` | 无长度，偏底层 |
| MMIO / 硬件寄存器 | `*volatile T` | 外部可观察内存访问 |

拿不准时，优先考虑这条经验：

> **普通代码优先：`*const T`、`*T`、`[]const T`、`[]T`。**  
> 其他形式通常是更底层、更专业化的表达。

---

## 学指针时最容易踩的坑

1. **把切片和指针混为一谈**：切片内部包含指针，但它还有长度信息，语义和安全边界都不同。
2. **不区分拥有和借用**：拿到指针或切片不代表拥有底层内存。必须始终知道谁创建了这块内存、谁负责释放、什么时候它会失效。
3. **过早沉迷底层技巧**：`@ptrCast`、`@ptrFromInt`、`volatile`、`@fieldParentPtr` 都很强，但应在熟悉 `*T`、切片和可选指针之后再深入。
4. **误把 `volatile` 当线程安全工具**：它不是锁，也不是原子操作，也不自动解决竞态条件。
5. **忽略对齐**：手动做底层指针转换时，必须确认地址满足目标类型对齐要求，不可对编译器做过强承诺。

---

## 小结

这一章的核心不是记住所有指针语法，而是建立一种判断方式：我手里的是单个值的地址还是一段数据视图？有没有长度和边界信息？能不能修改？可能为空吗？生命周期由谁保证？一旦这些判断清楚，Zig 的指针类型就不再是"一堆语法"，而是在明确描述数据关系和资源边界。

---

> **相关阅读**：
>
> 下一章我们将进入[内存管理模型](chapter-memory-management.md)，继续把"数据视图与借用边界"推进到更完整的资源语义：谁拥有数据、谁负责释放、分配器如何参与接口设计，以及失败路径该如何收口。