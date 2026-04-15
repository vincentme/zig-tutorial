# 复合类型

本章介绍 Zig 中最常见的复合类型，包括数组、切片、枚举、联合、结构体和元组。它们用于把基础类型组织成更有结构的数据，是后续学习控制流、错误处理、内存管理和工程实践的基础。

## 数组

数组是固定大小的连续内存序列，其长度是编译期常量，也是类型的一部分。

### 基本用法

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const array: [5]i32 = [_]i32{ 1, 2, 3, 4, 5 };

    const len = array.len;
    const first = array[0];
    const last = array[array.len - 1];

    for (array, 0..) |item, index| {
        std.debug.print("array[{}] = {}\n", .{ index, item });
    }

    std.debug.print("array length: {}, first: {}, last: {}\n", .{ len, first, last });

    const matrix: [3][3]i32 = [_][3]i32{
        [_]i32{ 1, 2, 3 },
        [_]i32{ 4, 5, 6 },
        [_]i32{ 7, 8, 9 },
    };
    for (matrix, 0..) |row, row_index| {
        for (row, 0..) |item, col_index| {
            std.debug.print("matrix[{}][{}] = {}\n", .{ row_index, col_index, item });
        }
    }
}
```

**预期输出：**
```
array[0] = 1
array[1] = 2
array[2] = 3
array[3] = 4
array[4] = 5
array length: 5, first: 1, last: 5
matrix[0][0] = 1
matrix[0][1] = 2
matrix[0][2] = 3
matrix[1][0] = 4
matrix[1][1] = 5
matrix[1][2] = 6
matrix[2][0] = 7
matrix[2][1] = 8
matrix[2][2] = 9
```

**核心特性**：

- **大小固定**：数组大小在编译期确定，不可改变
- **类型包含大小**：`[5]i32` 和 `[10]i32` 是不同的类型
- **值语义**：数组赋值会复制所有元素
- **内存连续**：元素在内存中连续存储，访问高效
- **边界检查**：数组长度是编译期常量，编译器可以在索引已知时提前发现越界；索引为运行时变量时仍进行运行时边界检查

> **相关章节**：数组遍历使用的 `for` 循环将在[控制流与资源管理](chapter-control-flow.md)中详细讲解。

### 数组操作

**初始化语法**：`[_]T{...}` 中的 `_` 表示让编译器从元素数量推断数组长度。

**连接（`++`）**：将两个编译期已知的数组连接为新数组。

**重复（`**`）**：将数组重复指定次数，生成新数组。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const part1 = [_]u8{ 1, 2, 3 };
    const part2 = [_]u8{ 4, 5 };

    const combined = part1 ++ part2;
    std.debug.print("连接: {any}\n", .{combined});

    const repeated = part1 ** 3;
    std.debug.print("重复: {any}\n", .{repeated});
}
```

**预期输出：**
```
连接: { 1, 2, 3, 4, 5 }
重复: { 1, 2, 3, 1, 2, 3, 1, 2, 3 }
```

`++` 和 `**` 都是编译期操作，操作数必须是编译期已知的值。

## 切片

切片是对连续内存区域的"视图"，包含指针和长度两个字段（胖指针）。切片本身大小固定（64 位系统上 16 字节），但可以在运行时引用不同长度的数据。

### 基本用法

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    var array = [_]i32{ 1, 2, 3, 4, 5 };

    const slice: []i32 = array[1..4];
    std.debug.print("slice length: {}, first: {}\n", .{ slice.len, slice[0] });

    slice[0] = 99;
    std.debug.print("array[1] after modification: {}\n", .{array[1]});

    const subslice = slice[0..2];
    std.debug.print("subslice length: {}\n", .{subslice.len});
}
```

**预期输出：**
```
slice length: 3, first: 2
array[1] after modification: 99
subslice length: 2
```

**核心特性**：

- **胖指针**：包含指针和长度两个字段（64 位系统上共 16 字节）
- **引用语义**：切片是对底层内存的引用，不拥有数据；修改切片会影响原数据
- **边界检查**：切片长度是运行时值，只能在运行时检查边界

> **进阶**：胖指针是 Zig 指针系统的重要组成部分，[指针、切片与对齐](../part2-advanced/chapter-pointers.md)将详细讲解各种指针类型及其应用场景。

### 切片创建方式

| 方式 | 语法 | 说明 |
|------|------|------|
| 从数组切片 | `array[start..end]` | 包含 `start`，不包含 `end` |
| 全切片 | `array[:]` | 等价于 `array[0..array.len]` |
|从 many-item pointer 构造切片 | `ptr[0..len]` | 需要已知起始位置和长度|
| 重新切片 | `slice[start..end]` | 从已有切片创建子切片 |

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    var array = [_]i32{ 1, 2, 3, 4, 5 };

    const full: []i32 = array[:];
    const sub: []i32 = array[1..4];
    const reslice: []i32 = sub[0..2];

    std.debug.print("full len: {}, sub len: {}, reslice len: {}\n", .{ full.len, sub.len, reslice.len });
}
```

**预期输出：**
```
full len: 5, sub len: 3, reslice len: 2
```

### 数组 vs 切片

| 特性 | 数组 | 切片 |
|------|------|------|
| **大小** | 编译期常量，类型的一部分 | 运行时值，存储在 `len` 字段中 |
| **内存** | 直接存储数据 | 胖指针（ptr + len，共 16 字节） |
| **语义** | 值语义（赋值复制） | 引用语义（赋值共享底层数据） |
| **边界检查** | 索引已知时编译期检查，否则运行时检查 | 运行时检查 |

```mermaid
graph TB
    classDef ptrStyle fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef lenStyle fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    classDef arrayElement fill:#e1f5ff,stroke:#01579b,stroke-width:3px
    classDef inactive fill:#f5f5f5,stroke:#999,stroke-dasharray: 5 5
    classDef container fill:#fafafa,stroke:#666,stroke-width:1px

    subgraph SliceVar["切片变量（栈上）- 胖指针结构"]
        direction LR
        Ptr["ptr (指针)<br/>8 字节<br/>指向 array[1]"]:::ptrStyle
        Len["len (长度)<br/>8 字节<br/>值: 3"]:::lenStyle
    end

    subgraph Array["底层数组（array）"]
        direction LR
        A0["[0]<br/>值: 1"]:::inactive
        A1["[1]<br/>值: 2"]:::arrayElement
        A2["[2]<br/>值: 3"]:::arrayElement
        A3["[3]<br/>值: 4"]:::arrayElement
        A4["[4]<br/>值: 5"]:::inactive
    end

    Ptr -.->|指向| A1

    class SliceVar container
    class Array container
```

**选择指南**：

| 场景 | 推荐使用 | 原因 |
|------|----------|------|
| 编译期已知大小 | 数组 | 性能更好，编译期检查 |
| 函数参数 | 切片 | 灵活，避免复制 |
| 返回值 | 切片 | 可以返回部分数据 |
| 全局常量 | 数组 | 存储在静态内存 |
| 动态大小 | 切片 | 唯一选择 |

## 哨兵终止数组

哨兵终止数组在数组末尾添加一个"哨兵值"来标记结束，主要用于 C 语言兼容性，以及需要明确终止标记的数据表示。

**语法**：
- `[N:S]T`：长度为 `N`、哨兵值为 `S`、元素类型为 `T` 的数组
- `[:S]T`：带哨兵值 `S` 的切片
- 最常见的：`[:0]const u8` —— 以 `0` 结尾的字节切片，常用于 C 风格字符串

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const message: [5:0]u8 = "hello".*;

    std.debug.print("消息：{s}\n", .{&message});
    std.debug.print("长度（不含哨兵）：{}\n", .{message.len});
    std.debug.print("哨兵在索引 {} 处\n", .{message.len});

    for (message, 0..) |byte, index| {
        std.debug.print("[{}] = {c} ({})\n", .{ index, byte, byte });
    }

    const str: [:0]const u8 = &message;
    std.debug.print("哨兵终止切片长度：{}\n", .{str.len});
}
```

**注意事项**：
1. **哨兵值不在 `len` 中**：`message.len` 返回 5，但实际占用 6 字节
2. **访问哨兵**：`arr[arr.len]` 返回哨兵值
3. **编译期检查**：Zig 会确保哨兵值正确设置

| 特性 | 普通数组 `[N]T` | 哨兵数组 `[N:S]T` |
|------|-----------------|-------------------|
| 长度信息 | 编译期已知 | 编译期已知 |
| 内存布局 | N 个元素 | N+1 个元素（含哨兵） |
| C 兼容性 | 需要转换 | 直接兼容 |

**实际应用场景**：

```zig
extern "c" fn puts(s: [*:0]const u8) c_int;

pub fn callCFunction() void {
    const message = "Hello from Zig";
    _ = puts(message.ptr);
}
```

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const names: [3][:0]const u8 = .{ "Alice", "Bob", "Charlie" };
    for (names, 0..) |name, i| {
        std.debug.print("名字 {}：{s}\n", .{ i, name });
    }
}
```

> **相关章节**：哨兵终止数组主要用于 C 互操作，详细内容请参考 [C 互操作](../part2-advanced/chapter-c-interop.md)。

## 枚举

枚举用于定义一组命名的整数值，提供类型安全和代码可读性。

**Zig 枚举的特点**：
- 可以指定底层整数类型
- 可以包含方法
- 与 C 枚举完全兼容
- switch 语句必须穷尽所有枚举值

### 基本枚举

```zig
const std = @import("std");

const Color = enum {
    red,
    green,
    blue,
};

pub fn main(_: std.process.Init) void {
    const color: Color = .red;

    const color_name = switch (color) {
        .red => "红色",
        .green => "绿色",
        .blue => "蓝色",
    };
    std.debug.print("颜色：{s}\n", .{color_name});

    std.debug.print("序值：{}\n", .{@intFromEnum(color)});

    const green_value: Color = @enumFromInt(1);
    std.debug.print("从整数创建：{}\n", .{green_value});
}
```

**预期输出：**
```
颜色：红色
序值：0
从整数创建：.green
```

> **相关章节**：枚举与 `switch` 语句配合使用时，编译器会强制穷尽性检查，详见[控制流与资源管理](chapter-control-flow.md)。

### 带整数类型的枚举

指定底层整数类型，用于 C 互操作、内存优化或协议兼容：

```zig
const std = @import("std");

const Priority = enum(u8) {
    low = 1,
    medium = 5,
    high = 10,
    critical = 20,
};

pub fn main(_: std.process.Init) void {
    const p: Priority = .high;
    std.debug.print("优先级：{s}，值：{}\n", .{ @tagName(p), @intFromEnum(p) });
}
```

**预期输出：**
```
优先级：high，值：10
```

### 枚举方法

```zig
const std = @import("std");

const Direction = enum(u4) {
    north = 0,
    east = 1,
    south = 2,
    west = 3,

    fn toString(self: Direction) []const u8 {
        return switch (self) {
            .north => "北",
            .east => "东",
            .south => "南",
            .west => "西",
        };
    }

    fn opposite(self: Direction) Direction {
        return switch (self) {
            .north => .south,
            .east => .west,
            .south => .north,
            .west => .east,
        };
    }

    fn allDirections() [4]Direction {
        return .{ .north, .east, .south, .west };
    }
};

pub fn main(_: std.process.Init) void {
    const dir: Direction = .north;
    std.debug.print("方向：{s}\n", .{dir.toString()});
    std.debug.print("相反方向：{s}\n", .{dir.opposite().toString()});

    const all = Direction.allDirections();
    std.debug.print("所有方向数量：{}\n", .{all.len});
}
```

**预期输出：**
```
方向：北
相反方向：南
所有方向数量：4
```

### 非穷尽枚举

非穷尽枚举使用 `_` 占位符表示未列出的值，适用于处理外部协议和 C 互操作时无法穷举所有可能值的场景：

```zig
const std = @import("std");

const TcpState = enum(u8) {
    closed = 0,
    listen = 1,
    established = 3,
    _, // 非穷尽：允许其他 u8 值
};

pub fn main(_: std.process.Init) void {
    const known: TcpState = .established;
    std.debug.print("已知状态：{s}\n", .{@tagName(known)});

    const unknown: TcpState = @enumFromInt(99);
    std.debug.print("未知状态值：{}\n", .{@intFromEnum(unknown)});

    switch (unknown) {
        .closed => std.debug.print("closed\n", .{}),
        .listen => std.debug.print("listen\n", .{}),
        .established => std.debug.print("established\n", .{}),
        _ => std.debug.print("其他状态\n", .{}),
    }
}
```

**预期输出：**
```
已知状态：established
未知状态值：99
其他状态
```

对非穷尽枚举进行 `switch` 时，需要使用 `_` 或 `else` 处理未显式匹配到的值。两者的区别是：`_` 更适合兜底未命名的底层 tag 值，并让编译器继续检查所有已知命名值是否已被显式处理；`else` 则会兜底所有未列出的情况，包括未列出的命名值和未命名值。

## 联合

联合允许在同一内存位置存储不同类型的数据。Zig 将联合分为两大类：

- **带标签联合**：有类型标签，自动跟踪活动成员，类型安全（推荐）
- **无标签联合**：无类型标签，需手动跟踪活动成员

### 带标签联合

带标签联合是联合和枚举的结合体，通过标签自动跟踪当前存储的值类型。这是 Zig 中实现安全多态的核心机制。

**基本用法**：

```zig
const std = @import("std");

const Shape = union(enum) {
    circle: struct { radius: f32 },
    rectangle: struct { width: f32, height: f32 },
    triangle: struct { base: f32, height: f32 },

    fn area(self: Shape) f32 {
        return switch (self) {
            .circle => |c| std.math.pi * c.radius * c.radius,
            .rectangle => |r| r.width * r.height,
            .triangle => |t| t.base * t.height * 0.5,
        };
    }
};

pub fn main(_: std.process.Init) void {
    const shapes: [3]Shape = .{
        Shape{ .circle = .{ .radius = 1.0 } },
        Shape{ .rectangle = .{ .width = 3.0, .height = 5.0 } },
        Shape{ .triangle = .{ .base = 6.0, .height = 4.0 } },
    };

    for (shapes, 0..) |shape, i| {
        std.debug.print("形状 {} 面积：{:.2}\n", .{ i, shape.area() });
    }
}
```

**预期输出：**
```
形状 0 面积：3.14
形状 1 面积：15.00
形状 2 面积：12.00
```

**两种定义方式**：

方式一（匿名标记，推荐）：使用 `union(enum)`，编译器自动生成枚举标签。

方式二（显式标签）：先定义枚举类型，再定义联合引用它：

```zig
const ShapeTag = enum { circle, rectangle };
const Shape = union(ShapeTag) {
    circle: struct { radius: f32 },
    rectangle: struct { width: f32, height: f32 },
};
```

### 无标签联合

无标签联合没有类型标签，程序员需要自己跟踪当前活动的成员。根据内存布局的不同，分为三种：

| 类型 | 内存布局 | 访问非活动成员 | 主要用途 |
|------|----------|----------------|----------|
| **普通 union** | 由编译器决定 | 安全模式下触发运行时错误 | 通用场景 |
| **extern union** | C ABI | 允许 | C 互操作、类型转换 |
| **packed union** | 位级精确 | 允许 | 硬件编程、位操作 |

**普通 union**：

```zig
const std = @import("std");

const Data = union {
    as_i32: i32,
    as_f32: f32,
    as_bytes: [4]u8,
};

pub fn main(_: std.process.Init) void {
    var data: Data = .{ .as_i32 = 42 };
    std.debug.print("as_i32: {}\n", .{data.as_i32});

    data = .{ .as_f32 = 3.14 };
    std.debug.print("as_f32: {}\n", .{data.as_f32});

    std.debug.print("联合大小: {} 字节\n", .{@sizeOf(Data)});
}
```

**预期输出：**
```
as_i32: 42
as_f32: 3.14
联合大小: 8 字节
```

注意：虽然所有成员都是 4 字节，但普通 union 的大小不一定等于最大成员的大小。普通 union 的内存布局由编译器决定，实际大小取决于编译器实现。访问非活动成员在安全构建模式下会触发运行时错误，在 ReleaseFast/ReleaseSmall 模式下是未定义行为。

**extern union**：

`extern union` 遵循 C ABI，内存布局与 C 语言一致，大小等于最大成员的大小。与普通 union 不同，`extern union` 允许访问非活动成员，可用于类型重解释：

```zig
const std = @import("std");

const Data = extern union {
    as_i32: i32,
    as_f32: f32,
    as_bytes: [4]u8,
};

pub fn main(_: std.process.Init) void {
    const data: Data = .{ .as_i32 = 0x41424344 };
    std.debug.print("as_bytes: {s}\n", .{data.as_bytes});
    std.debug.print("联合大小: {} 字节\n", .{@sizeOf(Data)});
}
```

**packed union**：

`packed union` 有位级精确的内存布局，所有成员必须有相同的位宽。可以作为 `packed struct` 的字段，用来表示同一段位数据的不同解释方式：

```zig
const std = @import("std");

const Data = packed union {
    as_u32: u32,
    as_i32: i32,
    as_f32: f32,
};

pub fn main(_: std.process.Init) void {
    const data: Data = .{ .as_u32 = 0x40490FDB };
    std.debug.print("as_u32: 0x{X}\n", .{data.as_u32});
    std.debug.print("as_f32: {}\n", .{data.as_f32});
}
```

**预期输出：**
```
as_u32: 0x40490FDB
as_f32: 3.1415927
```

> **进阶**：`extern union` 和 `packed union` 的详细用法见高级部分的指针与内存章节。

### 高级特性

**`@tagName`**：获取带标签联合当前变体的名称字符串，常用于日志和调试：

```zig
const std = @import("std");

const Result = union(enum) {
    success: i32,
    failure: []const u8,
};

pub fn main(_: std.process.Init) void {
    const r = Result{ .success = 100 };
    std.debug.print("标签: {s}\n", .{@tagName(r)});
}
```

**预期输出：**
```
标签: success
```

## 结构体

结构体是 Zig 中定义复合类型的主要方式，将多个相关的数据字段组合成一个逻辑单元。

### 基本用法

```zig
const std = @import("std");

const Rectangle = struct {
    width: f32,
    height: f32,

    fn area(self: Rectangle) f32 {
        return self.width * self.height;
    }

    fn scale(self: *Rectangle, factor: f32) void {
        self.width *= factor;
        self.height *= factor;
    }

    fn square(size: f32) Rectangle {
        return Rectangle{
            .width = size,
            .height = size,
        };
    }
};

pub fn main(_: std.process.Init) void {
    var rect = Rectangle{
        .width = 10.0,
        .height = 5.0,
    };

    std.debug.print("面积: {d:.2}\n", .{rect.area()});

    rect.scale(2.0);
    std.debug.print("放大后面积: {d:.2}\n", .{rect.area()});

    const sq = Rectangle.square(4.0);
    std.debug.print("正方形面积: {d:.2}\n", .{sq.area()});
}
```

**预期输出：**
```
面积: 50.00
放大后面积: 200.00
正方形面积: 16.00
```

**核心概念**：

- **字段**：存储数据的变量，可以有默认值。字段的可变性取决于结构体实例是否为 `var`：`var` 实例的字段可修改，`const` 实例的字段不可修改
- **方法**：带有 `self` 参数的函数（值类型 `self` 不能修改字段，指针类型 `*Self` 可以修改）
- **关联函数**：不带 `self` 参数的函数（类似静态方法/构造函数）

```zig
var p = Point{ .x = 1.0, .y = 2.0 };
p.x = 3.0;  // 合法：p 是 var

const q = Point{ .x = 1.0, .y = 2.0 };
// q.x = 3.0;  // 编译错误：q 是 const
```

**结果位置语义**：当目标类型已知时，可以省略结构体类型名，直接使用 `.{ ... }` 语法：

```zig
const std = @import("std");

const Point = struct {
    x: f32,
    y: f32,
};

fn printPoint(p: Point) void {
    std.debug.print("Point({}, {})\n", .{ p.x, p.y });
}

pub fn main(_: std.process.Init) void {
    const p: Point = .{ .x = 1.0, .y = 2.0 };
    printPoint(p);

    printPoint(.{ .x = 3.0, .y = 4.0 });
}
```

**预期输出：**
```
Point(1, 2)
Point(3, 4)
```

适用场景：变量声明（类型注解提供结果位置）、函数参数（函数签名提供结果位置）、返回值（返回类型提供结果位置）。类型必须明确，否则编译错误。

### 结构体布局

Zig 提供三种布局方式：

| 布局方式 | 使用场景 | 特点 |
|----------|----------|------|
| 默认 | 大多数情况 | 编译器可重排字段优化布局 |
| packed | 位操作、协议解析 | 紧凑存储，无填充，位级精确 |
| extern | 与 C 互操作 | 遵循 C ABI，按声明顺序排列 |

```zig
const std = @import("std");

const AutoLayout = struct {
    a: u8,
    b: u32,
    c: u16,
};

const PackedStruct = packed struct {
    a: u8,
    b: u32,
    c: u16,
};

const ExternStruct = extern struct {
    a: u8,
    b: u32,
    c: u16,
};

pub fn main(_: std.process.Init) void {
    std.debug.print("AutoLayout 大小: {} 字节\n", .{@sizeOf(AutoLayout)});
    std.debug.print("PackedStruct 大小: {} 字节\n", .{@sizeOf(PackedStruct)});
    std.debug.print("ExternStruct 大小: {} 字节\n", .{@sizeOf(ExternStruct)});
}
```

**预期输出：**
```
AutoLayout 大小: 8 字节
PackedStruct 大小: 8 字节
ExternStruct 大小: 12 字节
```

> **进阶**：`packed struct` 的位操作详细用法见高级部分。

### 字段默认值

在结构体中，常见的"默认值"有两种不同方式：

1. **字段级默认值**：直接写在字段定义后面
2. **类型级默认实例**：在结构体内部定义一个命名常量，表示一组预设值

```zig
const std = @import("std");

const Config = struct {
    host: []const u8 = "localhost",
    port: u16 = 8080,
    timeout: u32 = 30,
    debug: bool = false,
};

const Threshold = struct {
    minimum: f32,
    maximum: f32,

    const default: Threshold = .{
        .minimum = 0.25,
        .maximum = 0.75,
    };
};

pub fn main(_: std.process.Init) void {
    const cfg = Config{ .host = "example.com" };
    std.debug.print("配置: {s}:{}\n", .{ cfg.host, cfg.port });

    const threshold: Threshold = .default;
    std.debug.print("阈值范围: {} - {}\n", .{ threshold.minimum, threshold.maximum });
}
```

**预期输出：**
```
配置: example.com:8080
阈值范围: 0.25 - 0.75
```

**字段级默认值**（如 `Config`）直接写在字段定义上——`host` 默认为 `"localhost"`、`port` 默认为 `8080` 等。创建结构体时只需提供想要覆盖的字段，未显式写出的字段自动使用默认值。这种方式适合"多数情况下使用同一组默认配置，只偶尔覆盖少数字段"的场景。

**类型级默认实例**（如 `Threshold`）中，字段本身没有默认值，默认方案来自结构体内部定义的常量 `default`。使用 `const threshold: Threshold = .default;` 表示"使用 `Threshold.default` 这个预先定义好的完整实例"。这种方式适合需要提供完整预设值、或以后可能有多个命名预设（如 `strict`、`relaxed`）的场景。

| 方式 | 写法位置 | 作用 | 初始化时是否可省略字段 |
| ---- | -------- | ---- | ---------------------- |
| 字段级默认值 | 字段定义后 | 给单个字段提供默认值 | 可以省略这些带默认值的字段 |
| 类型级默认实例 | 结构体内部常量 | 给整个类型提供一个预设实例 | 不能因此自动省略字段，除非直接使用该实例 |

> **注意**：字段默认值和类型级默认实例中的值都必须能在编译期确定。没有字段默认值的字段，在结构体字面量初始化时必须显式提供。`.default` 使用的是 decl literal 语法，编译器会根据结果位置类型将其解析为 `Threshold.default`。

### 泛型结构体

Zig 通过 `comptime` 参数实现泛型结构体：

```zig
const std = @import("std");

fn Vector(comptime T: type) type {
    return struct {
        x: T,
        y: T,
        z: T,

        const Self = @This(); // @This() 获取当前正在定义的类型

        fn add(self: Self, other: Self) Self {
            return .{
                .x = self.x + other.x,
                .y = self.y + other.y,
                .z = self.z + other.z,
            };
        }
    };
}

pub fn main(_: std.process.Init) void {
    const Vec3f = Vector(f32);
    const v1 = Vec3f{ .x = 1.0, .y = 2.0, .z = 3.0 };
    const v2 = Vec3f{ .x = 4.0, .y = 5.0, .z = 6.0 };

    const v3 = v1.add(v2);
    std.debug.print("v1 + v2 = ({d:.1}, {d:.1}, {d:.1})\n", .{ v3.x, v3.y, v3.z });
}
```

**预期输出：**
```
v1 + v2 = (5.0, 7.0, 9.0)
```

> **进阶**：泛型结构体的完整实现和高级用法请参考[泛型编程](../part2-advanced/chapter-generics.md)章节。

## 元组

元组是一种特殊的匿名结构体，字段没有名称，使用数字索引访问。元组可以包含不同类型的元素。

### 基本用法

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const tuple = .{ 1, "hello", 3.14, true };

    std.debug.print("第一个元素: {}\n", .{tuple[0]});
    std.debug.print("第二个元素: {s}\n", .{tuple[1]});
    std.debug.print("元组长度: {}\n", .{tuple.len});

    inline for (tuple, 0..) |item, index| {
        std.debug.print("tuple[{}] = {any}\n", .{ index, item });
    }
}
```

**预期输出：**
```
第一个元素: 1
第二个元素: hello
元组长度: 4
tuple[0] = 1
tuple[1] = { 104, 101, 108, 108, 111 }
tuple[2] = 3.14
tuple[3] = true
```

遍历元组必须使用 `inline for`，因为每个元素的类型可能不同，编译器需要在编译期为每个元素生成对应的代码。

### 元组操作

**元组连接**：使用 `++` 连接两个元组。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const a = .{ 1, 2 };
    const b = .{ "zig", true };
    const c = a ++ b;

    std.debug.print("{} {} {s} {}\n", .{ c[0], c[1], c[2], c[3] });
}
```

**预期输出：**
```text
1 2 zig true
```

**元组与结构体的关系**：元组本质上是无字段名的匿名结构体，字段名为数字索引（0, 1, 2...）。

| 特性 | 元组 | 结构体 | 数组 |
|------|------|--------|------|
| 字段访问 | 索引（0, 1, 2...） | 名称 | 索引 |
| 元素类型 | 可以不同 | 可以不同 | 必须相同 |
| 定义方式 | 匿名 | 命名类型 | 命名类型 |
| 适用场景 | 临时数据、多返回值 | 长期存储、复用 | 同类数据集合 |

### 解包赋值

Zig 支持从元组、数组或向量中一次性提取多个值到独立变量：

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

    // 数组解包
    const array = [_]u32{ 4, 5, 6 };
    var p: u32 = undefined;
    var q: u32 = undefined;
    var r: u32 = undefined;
    p, q, r = array;
    std.debug.print("数组解包：p={}, q={}, r={}\n", .{ p, q, r });

    // 混合声明：可以同时声明常量和变量
    const tuple2 = .{ 10, 20, 30 };
    const first, var second: i32, const third = tuple2;
    second = 25;
    std.debug.print("混合声明：{}, {}, {}\n", .{ first, second, third });
}
```

向量同样支持解包赋值。

## 本章要点

本章核心要点：

- **数组** 是长度固定、类型统一的连续数据；长度是类型的一部分。
- **切片** 是对连续数据的一段视图，运行时携带长度信息；它本身不拥有底层数据。
- **哨兵终止数组** 适合表示以特定结束值结尾的数据，常见于与 C 风格字符串或底层接口交互的场景。
- **枚举** 用于表示一组离散取值；带底层整数类型的枚举可以更明确地控制表示方式。
- **非穷尽枚举** 不能假定所有运行时值都已被当前源码完整列出；使用 `switch` 时要为未显式匹配到的情况保留兜底处理。
- **联合** 表示"一块存储在不同时间按不同类型解释"；如果需要让当前活跃字段始终可安全追踪，应优先考虑 **带标签联合**。
- **带标签联合** 常用于表示"一个值在若干变体中取其一"的数据；读取时通常使用 `switch` 按标签分别处理。
- **无标签联合** 更接近底层内存重解释；只有在确切知道当前活跃字段时才适合使用。
- **结构体** 用于把多个相关字段组织成一个整体；可以同时拥有字段、方法、工厂函数和内部常量。
- **结构体布局** 需要根据目标选择：
  - 普通 `struct` 适合日常编程
  - `packed struct` 适合位级精确布局
  - `extern struct` 适合与 C ABI 或外部布局约定对齐
- **字段默认值** 和 **类型级默认实例** 是两种不同机制：
  - 字段默认值允许在初始化时省略该字段
  - 类型级默认实例是为整个类型提供一个预设好的完整值
- **泛型结构体** 本质上是"返回类型的函数"，用于在同一模式下生成不同具体类型。
- **元组** 适合表示一组位置相关、通常较轻量的异构数据；它更强调"按位置访问"，而不是像结构体那样按字段名组织语义。