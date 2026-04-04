# 【draft】指针与引用类型

Zig 提供了多种指针类型，每种都有特定的用途和安全保证。

## 指针类型概览

# 为什么 Zig 有这么多指针类型？

Zig 的指针设计体现了其核心哲学：**显式优于隐式**。不同的指针类型表达不同的意图：

1. **`*T`**：我知道这里有一个值，我想操作它
2. **`[*]T`**：我有一个连续的内存区域，大小未知
3. **`*[N]T`**：我有一个固定大小的数组
4. **`[]T`**：我有一个动态大小的序列（胖指针）
5. **`?*T`**：我可能有一个值，也可能没有

# Zig 指针的安全性

与 C 语言不同，Zig 的指针设计注重安全性：

| 安全特性   | C 语言 | Zig                |
| ---------- | ------ | ------------------ |
| 空指针检查 | 无     | 可选指针显式处理   |
| 边界检查   | 无     | 切片有运行时检查   |
| 别名分析   | 无     | 编译器可以优化     |
| 对齐检查   | 无     | 编译期和运行时检查 |

| 指针类型 | 语法    | 说明             | 用途                  |
| -------- | ------- | ---------------- | --------------------- |
| 单项指针 | `*T`    | 指向单个值       | 函数参数传递、修改值  |
| 多项指针 | `[*]T`  | 指向多个连续元素 | C互操作、低级内存操作 |
| 数组指针 | `*[N]T` | 指向固定大小数组 | 数组操作              |
| 切片     | `[]T`   | 指针+长度        | 动态大小序列          |
| 哨兵切片 | `[:N]T` | 以哨兵值结尾     | C字符串兼容           |
| 可选指针 | `?*T`   | 可能为null的指针 | 安全的指针操作        |

**基本操作**：
- **取地址**：`&variable`
- **解引用**：`ptr.*`

## 指针基础

# 单项目指针详解

单项目指针 `*T` 是最常用的指针类型，它：
- 指向单个值
- 不携带长度信息
- 支持解引用操作

Zig 有多种指针类型，每种都有不同的用途：

**单项目指针 `*T`：**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var value: i32 = 42;
    
    // 创建指针：使用 & 取地址
    const ptr: *i32 = &value;
    
    // 解引用访问值：使用 .* 操作符
    std.debug.print("值：{}\n", .{ptr.*});
    
    // 通过指针修改值
    ptr.* = 100;
    std.debug.print("修改后的值：{}\n", .{value});
    
    // 指针的类型信息
    std.debug.print("指针大小：{} 字节\n", .{@sizeOf(*i32)});
    
    // 常量指针：不能修改指向的值
    const const_ptr: *const i32 = &value;
    // const_ptr.* = 200; // 编译错误：常量指针不可修改
}
```

# 多项目指针详解

多项目指针 `[*]T` 用于：
- 指向连续内存区域
- 与 C 代码互操作
- 低级内存操作

**重要提示**：多项目指针不携带长度信息，使用时需要小心！

**多项目指针 `[*]T`：**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var array = [_]i32{ 1, 2, 3, 4, 5 };
    
    // 多项目指针：指向数组的第一个元素
    const ptr: [*]i32 = &array;
    
    // 可以像数组一样索引（但没有边界检查！）
    std.debug.print("第一个元素：{}\n", .{ptr[0]});
    std.debug.print("第二个元素：{}\n", .{ptr[1]});
    
    // 指针算术：移动指针位置
    const ptr2 = ptr + 2;
    std.debug.print("第三个元素：{}\n", .{ptr2[0]});
    
    // ⚠️ 危险：没有边界检查
    // std.debug.print("越界访问：{}\n", .{ptr[100]}); // 未定义行为！
    
    // 安全做法：转换为切片
    const slice: []i32 = ptr[0..array.len];
    // 现在有边界检查了
}
```

# 指针类型选择指南

| 场景             | 推荐类型           | 原因               |
| ---------------- | ------------------ | ------------------ |
| 函数参数（只读） | `*const T`         | 明确意图，避免复制 |
| 函数参数（修改） | `*T`               | 显式表达修改意图   |
| 动态大小序列     | `[]T`              | 有边界检查，更安全 |
| C 互操作         | `[*]T` 或 `[*:0]T` | 匹配 C 指针语义    |
| 可能不存在的值   | `?*T`              | 显式处理空指针     |

## 切片指针

# 什么是切片？

切片是 Zig 中最常用的"指针"类型，它是一个胖指针，包含：
- **指针**：指向数据的起始位置
- **长度**：数据的元素数量

切片是包含指针和长度的胖指针：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var array = [_]i32{ 1, 2, 3, 4, 5 };
    
    // 创建切片：从数组中"切出"一部分
    const slice: []i32 = array[1..4];
    
    // 切片包含指针和长度
    std.debug.print("切片长度：{}\n", .{slice.len});
    std.debug.print("切片指针：{}\n", .{slice.ptr});
    
    // 访问元素：有边界检查
    for (slice, 0..) |item, index| {
        std.debug.print("slice[{}] = {}\n", .{ index, item });
    }
    
    // 切片的内存布局
    std.debug.print("切片大小：{} 字节（指针 + 长度）\n", .{@sizeOf([]i32)});
    
    // 修改元素
    var mutable_slice: []i32 = array[0..];
    mutable_slice[0] = 10;
    std.debug.print("修改后：{}\n", .{array[0]});
}
```

# 切片的实际应用

```zig
// 场景1：安全的函数参数
fn sumSlice(numbers: []const i32) i32 {
    var total: i32 = 0;
    for (numbers) |num| {
        total += num;
    }
    return total;
}

// 场景2：动态数据处理
fn findFirst(items: []const i32, target: i32) ?usize {
    for (items, 0..) |item, index| {
        if (item == target) return index;
    }
    return null;
}

// 场景3：子切片
fn processSubslice(data: []u8) void {
    const header = data[0..4];  // 前4字节
    const body = data[4..];     // 剩余部分
    // 处理 header 和 body...
}
```

## 可选指针

# 为什么需要可选指针？

可选指针 `?*T` 解决了 C 语言中空指针的问题：
- 显式表示指针可能为空
- 编译器强制处理空指针情况
- 避免空指针解引用错误

可选指针可以表示可能为 null 的指针：

```zig
const std = @import("std");

// 返回可选指针的函数
fn findValue(arr: []const i32, target: i32) ?*const i32 {
    for (arr, 0..) |item, index| {
        if (item == target) {
            return &arr[index];
        }
    }
    return null;
}

pub fn main(init: std.process.Init.Minimal) void {
    var array = [_]i32{ 10, 20, 30, 40, 50 };
    
    // 查找存在的值
    if (findValue(&array, 30)) |ptr| {
        std.debug.print("找到值：{}\n", .{ptr.*});
    }
    
    // 查找不存在的值
    if (findValue(&array, 99)) |ptr| {
        std.debug.print("找到值：{}\n", .{ptr.*});
    } else {
        std.debug.print("未找到值\n", .{});
    }
}
```

## 指针类型转换

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var value: i32 = 0x12345678;
    
    // 整数到指针
    const ptr: *i32 = @ptrFromInt(0x1000);
    std.debug.print("指针地址：{x}\n", .{@intFromPtr(ptr)});
    
    // 指针到整数
    const addr = @intFromPtr(&value);
    std.debug.print("value 的地址：{x}\n", .{addr});
    
    // 类型转换指针
    const byte_ptr: *u8 = @ptrCast(&value);
    std.debug.print("第一个字节：{x}\n", .{byte_ptr.*});
}
```

## 对齐和 volatile 指针

**对齐指针：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 特殊对齐的变量
    var aligned_value: i32 align(16) = 42;
    
    // 对齐指针
    const ptr: *align(16) i32 = &aligned_value;
    
    std.debug.print("对齐值：{}\n", .{ptr.*});
    
    // 检查对齐
    const addr = @intFromPtr(ptr);
    std.debug.print("地址对齐：{}\n", .{addr % 16 == 0});
}
```

**Volatile 指针：**
```zig
const std = @import("std");

// 硬件寄存器地址
const UART_DR: *volatile u32 = @ptrFromInt(0x4000_1000);

pub fn main(init: std.process.Init.Minimal) void {
    // volatile 读写不会被编译器优化
    UART_DR.* = 'A';
    const received = UART_DR.*;

    std.debug.print("接收到：{}\n", .{received});
}
```

## 从字段指针获取结构体指针

使用 `@fieldParentPtr` 可以从字段的指针反推出整个结构体的指针。这是一个高级指针操作技巧，常用于实现侵入式数据结构。

### 基本用法

```zig
const std = @import("std");

const Creature = struct {
    health: f32,
    mana: u32,
    stamina: u32,
};

fn boostMana(mana_ptr: *u32, amount: u32) void {
    // 从 mana 字段的指针，反推出整个 Creature 的指针
    const creature_ptr: *Creature = @fieldParentPtr("mana", mana_ptr);
    creature_ptr.mana += amount;
    
    // 也可以修改其他字段
    creature_ptr.health -= 1.0;
}

pub fn main(init: std.process.Init.Minimal) void {
    var elf = Creature{
        .health = 150.0,
        .mana = 10,
        .stamina = 100,
    };
    
    std.debug.print("强化前 - 生命: {}, 法力: {}\n", .{ elf.health, elf.mana });
    
    boostMana(&elf.mana, 40);
    
    std.debug.print("强化后 - 生命: {}, 法力: {}\n", .{ elf.health, elf.mana });
}
```

### 工作原理

`@fieldParentPtr` 通过以下步骤工作：

1. **编译期计算偏移量**：编译器知道字段在结构体中的偏移量
2. **指针算术**：从字段指针减去偏移量，得到结构体起始地址
3. **类型转换**：返回结构体指针类型

```zig
const std = @import("std");

const Node = struct {
    value: i32,
    next: ?*Node,
};

pub fn main(init: std.process.Init.Minimal) void {
    var node = Node{ .value = 42, .next = null };
    
    // 获取字段指针
    const value_ptr: *i32 = &node.value;
    
    // 从字段指针获取结构体指针
    const node_ptr: *Node = @fieldParentPtr("value", value_ptr);
    
    std.debug.print("节点值：{}\n", .{node_ptr.value});
    std.debug.print("偏移量：{} 字节\n", .{@offsetOf(Node, "value")});
}
```

### 实际应用：侵入式链表

侵入式链表是 `@fieldParentPtr` 的经典应用场景：

```zig
const std = @import("std");

// 侵入式链表节点（不包含数据，只包含指针）
const IntrusiveNode = struct {
    prev: ?*IntrusiveNode,
    next: ?*IntrusiveNode,
};

// 实际数据结构
const Task = struct {
    node: IntrusiveNode,  // 嵌入链表节点
    id: u32,
    name: []const u8,
};

const TaskList = struct {
    head: ?*IntrusiveNode,
    
    fn init() TaskList {
        return .{ .head = null };
    }
    
    fn push(self: *TaskList, task: *Task) void {
        task.node.prev = null;
        task.node.next = self.head;
        if (self.head) |head| {
            head.prev = &task.node;
        }
        self.head = &task.node;
    }
    
    fn iterate(self: *TaskList) void {
        var current = self.head;
        while (current) |node| {
            // 从链表节点指针获取 Task 指针
            const task: *Task = @fieldParentPtr("node", node);
            std.debug.print("任务 {}: {s}\n", .{ task.id, task.name });
            current = node.next;
        }
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    var list = TaskList.init();
    
    var task1 = Task{ .node = .{ .prev = null, .next = null }, .id = 1, .name = "初始化" };
    var task2 = Task{ .node = .{ .prev = null, .next = null }, .id = 2, .name = "处理数据" };
    var task3 = Task{ .node = .{ .prev = null, .next = null }, .id = 3, .name = "清理资源" };
    
    list.push(&task1);
    list.push(&task2);
    list.push(&task3);
    
    list.iterate();
}
```

### 安全性注意事项

**1. 必须确保字段指针有效**

```zig
const std = @import("std");

const Point = struct { x: f32, y: f32 };

pub fn main(init: std.process.Init.Minimal) void {
    var point = Point{ .x = 1.0, .y = 2.0 };
    
    // ✅ 正确：字段指针有效
    const x_ptr = &point.x;
    const point_ptr: *Point = @fieldParentPtr("x", x_ptr);
    std.debug.print("点：({}, {})\n", .{ point_ptr.x, point_ptr.y });
    
    // ❌ 危险：野指针会导致未定义行为
    // var dangling: *f32 = undefined;
    // const bad_ptr: *Point = @fieldParentPtr("x", dangling);
}
```

**2. 字段名必须在编译期已知**

```zig
const std = @import("std");

const Point = struct { x: f32, y: f32 };

pub fn main(init: std.process.Init.Minimal) void {
    var point = Point{ .x = 1.0, .y = 2.0 };
    
    // ✅ 正确：字段名是编译期常量
    const ptr1: *Point = @fieldParentPtr("x", &point.x);
    
    // ❌ 错误：字段名不能是运行时变量
    // const field_name = "x";
    // const ptr2: *Point = @fieldParentPtr(field_name, &point.x);
}
```

**3. 指针必须指向结构体的字段**

```zig
const std = @import("std");

const Point = struct { x: f32, y: f32 };

pub fn main(init: std.process.Init.Minimal) void {
    var point = Point{ .x = 1.0, .y = 2.0 };
    var standalone: f32 = 3.0;
    
    // ✅ 正确：指向结构体字段
    const ptr1: *Point = @fieldParentPtr("x", &point.x);
    
    // ❌ 错误：指向独立变量，会导致未定义行为
    // const ptr2: *Point = @fieldParentPtr("x", &standalone);
}
```

### 应用场景

| 场景               | 说明                         | 优势           |
| ------------------ | ---------------------------- | -------------- |
| **侵入式数据结构** | 链表、树、图等数据结构       | 零额外内存分配 |
| **回调函数上下文** | 将用户数据传递给回调函数     | 避免全局变量   |
| **内存池管理**     | 从对象指针获取内存池元数据   | 高效的内存管理 |
| **事件系统**       | 从事件处理器指针获取对象指针 | 灵活的事件处理 |

### 性能考虑

- **编译期计算**：偏移量在编译期计算，运行时无开销
- **指针算术**：只是简单的指针减法，非常高效
- **类型安全**：编译器确保类型正确

### 最佳实践

1. **优先使用更简单的方法**：如果能直接传递结构体指针，就不要使用 `@fieldParentPtr`
2. **文档化使用**：明确说明为什么需要使用这个技巧
3. **确保指针有效**：只在确定指针有效的情况下使用
4. **用于特定场景**：主要用于侵入式数据结构等高级场景

## Alignment 对齐系统

# 什么是 Alignment？

每种类型都有一个 **alignment**（对齐值）——一个字节数，当该类型的值从内存加载或存储到内存时，内存地址必须能被这个数字整除。可以使用 `[@alignOf](#alignOf)` 获取任何类型的对齐值。

Alignment 取决于 CPU 架构，但始终是 2 的幂，且小于 `1 << 29`。

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // i32 类型默认对齐值
    std.debug.print("@alignOf(i32) = {}\n", .{@alignOf(i32)});
    std.debug.print("@alignOf(f64) = {}\n", .{@alignOf(f64)});
    std.debug.print("@alignOf(u8) = {}\n", .{@alignOf(u8)});

    var x: i32 = 1234;
    std.debug.print("变量 x 的地址对齐：{}\n", .{@intFromPtr(&x) % @alignOf(i32) == 0});
}
```

# 指针的对齐

指针类型可以显式指定对齐字节数。如果未指定，则假定对齐值等于底层类型的对齐值：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var x: i32 = 1234;

    // 隐式对齐指针（指向 i32 的指针默认对齐为 @alignOf(i32)）
    const ptr: *i32 = &x;

    // 显式指定对齐的指针
    const aligned_ptr: *align(@alignOf(i32)) i32 = &x;

    std.debug.print("ptr 类型：{}\n", .{@TypeOf(ptr)});
    std.debug.print("aligned_ptr 类型：{}\n", .{@TypeOf(aligned_ptr)});
}
```

# 变量和函数的对齐

可以对变量和函数指定对齐，这样指向它们的指针将获得指定的对齐：

```zig
const expectEqual = @import("std").testing.expectEqual;

var global_var: u8 align(4) = 100;

test "全局变量对齐" {
    try expectEqual(4, @typeInfo(@TypeOf(&global_var)).pointer.alignment);
    try expectEqual(*align(4) u8, @TypeOf(&global_var));
}

fn alignedFunction() align(@sizeOf(usize) * 2) i32 {
    return 1234;
}

test "函数对齐" {
    try expectEqual(1234, alignedFunction());
    try expectEqual(*align(@sizeOf(usize) * 2) const fn () i32, @TypeOf(&alignedFunction));
}
```

# @alignCast 和对齐转换

如果你有一个小对齐的指针或切片，但你知道它实际上有更大的对齐，可以使用 `[@alignCast](#alignCast)` 将指针转换为更大对齐的指针。这在运行时是 no-op，但会插入安全检查：

```zig
const std = @import("std");

test "指针对齐安全性" {
    var array align(4) = [_]u32{ 0x11111111, 0x11111111 };
    const bytes = std.mem.sliceAsBytes(array[0..]);
    try std.testing.expectEqual(0x11111111, foo(bytes));
}

fn foo(bytes: []u8) u32 {
    const slice4 = bytes[1..5];
    // @alignCast 将 []u8 转换为 []align(4) u8
    const int_slice = std.mem.bytesAsSlice(u32, @as([]align(4) u8, @alignCast(slice4)));
    return int_slice[0];
}
```

当对齐不正确时，在 Debug/ReleaseSafe 模式下会触发 panic：

```
$ zig test test_incorrect_pointer_alignment.zig
1/1 test_incorrect_pointer_alignment.test.pointer alignment safety...thread 2247083 panic: incorrect alignment
```

# 对齐转换规则

- `*T` 可以[强制转换](#Type-Coercion)为 `*const T`
- 具有更大对齐的指针可以隐式转换为具有更小对齐的指针，反之则不行

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var x: i32 = 1234;

    // 更大对齐的指针可以转换为更小对齐
    const ptr_align_8: *align(8) i32 = &x;
    const ptr_align_4: *i32 = ptr_align_8; // 合法：更大对齐 -> 更小对齐

    _ = ptr_align_4;

    // 更小对齐的指针不能转换为更大对齐
    // const ptr_align_16: *align(16) i32 = ptr_align_4; // 编译错误！
}
```

---

# 章节练习题

# 基础题

**题目1**：编写一个函数，使用指针交换两个变量的值。

**要求**：
- 函数签名为 `fn swap(a: *i32, b: *i32) void`
- 使用指针参数
- 交换两个变量的值

**参考答案**：
```zig
const std = @import("std");

fn swap(a: *i32, b: *i32) void {
    const temp = a.*;
    a.* = b.*;
    b.* = temp;
}

pub fn main(init: std.process.Init.Minimal) void {
    var x: i32 = 10;
    var y: i32 = 20;
    
    std.debug.print("交换前：x={}, y={}\n", .{ x, y });
    swap(&x, &y);
    std.debug.print("交换后：x={}, y={}\n", .{ x, y });
}
```

**题目2**：编写一个函数，使用指针修改数组元素。

**要求**：
- 函数签名为 `fn doubleAll(arr: []i32) void`
- 将数组中所有元素乘以 2
- 使用指针访问元素

**参考答案**：
```zig
fn doubleAll(arr: []i32) void {
    for (arr) |*item| {
        item.* *= 2;
    }
}

pub fn main(init: std.process.Init.Minimal) void {
    var arr = [_]i32{ 1, 2, 3, 4, 5 };
    doubleAll(&arr);
    std.debug.print("结果：{any}\n", .{arr});
}
```

**题目3**：编写一个函数，使用 const 指针读取数据。

**要求**：
- 函数签名为 `fn sum(arr: *const [5]i32) i32`
- 使用 const 指针参数
- 计算数组元素之和

**参考答案**：
```zig
fn sum(arr: *const [5]i32) i32 {
    var total: i32 = 0;
    for (arr.*) |item| {
        total += item;
    }
    return total;
}

pub fn main(init: std.process.Init.Minimal) void {
    const arr = [_]i32{ 1, 2, 3, 4, 5 };
    const result = sum(&arr);
    std.debug.print("总和：{}\n", .{result});
}
```

# 进阶题

**题目1**：实现一个简单的链表节点结构，使用指针链接。

**要求**：
- 定义链表节点结构
- 实现插入和遍历功能
- 使用指针管理节点

**参考答案**：
```zig
const std = @import("std");

const Node = struct {
    value: i32,
    next: ?*Node,
    
    fn init(value: i32) Node {
        return Node{
            .value = value,
            .next = null,
        };
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    var node1 = Node.init(1);
    var node2 = Node.init(2);
    var node3 = Node.init(3);
    
    node1.next = &node2;
    node2.next = &node3;
    
    var current: ?*Node = &node1;
    while (current) |node| {
        std.debug.print("{} -> ", .{node.value});
        current = node.next;
    }
    std.debug.print("null\n", .{});
}
```

**题目2**：使用多级指针实现二维数组的动态分配。

**要求**：
- 使用二级指针
- 分配 3x3 的二维数组
- 初始化并输出数组

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    const rows: usize = 3;
    const cols: usize = 3;
    
    var matrix = try allocator.alloc([]i32, rows);
    defer allocator.free(matrix);
    
    for (0..rows) |i| {
        matrix[i] = try allocator.alloc(i32, cols);
        for (0..cols) |j| {
            matrix[i][j] = @intCast(i * cols + j);
        }
    }
    
    defer {
        for (matrix) |row| {
            allocator.free(row);
        }
    }
    
    for (matrix, 0..) |row, i| {
        std.debug.print("行 {}: {any}\n", .{ i, row });
    }
}
```

# 挑战题

**题目**：实现一个简单的二叉树结构，使用指针管理节点。

**要求**：
- 定义二叉树节点结构
- 实现插入和遍历功能
- 使用递归遍历

**参考答案**：
```zig
const std = @import("std");

const TreeNode = struct {
    value: i32,
    left: ?*TreeNode,
    right: ?*TreeNode,
    
    fn init(value: i32) TreeNode {
        return TreeNode{
            .value = value,
            .left = null,
            .right = null,
        };
    }
    
    fn inorder(node: *const TreeNode) void {
        if (node.left) |left| {
            left.inorder();
        }
        std.debug.print("{} ", .{node.value});
        if (node.right) |right| {
            right.inorder();
        }
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    var root = TreeNode.init(5);
    var left = TreeNode.init(3);
    var right = TreeNode.init(7);
    
    root.left = &left;
    root.right = &right;
    
    std.debug.print("中序遍历：", .{});
    root.inorder();
    std.debug.print("\n", .{});
}
```

---

> 💡 **章节过渡**：从指针到并发编程
> 
> 在[指针与引用类型](chapter-pointers.md)中，我们学习了 Zig 的指针系统，理解了如何安全地操作内存。现在，我们已经完成了并发编程的学习。
> 
> **为什么指针是并发编程的基础？**
> 
> 1. **共享内存**：多个线程访问同一数据需要通过指针
> 2. **数据竞争**：指针的不当使用会导致并发问题
> 3. **原子操作**：理解指针是理解原子操作的前提
> 4. **无锁数据结构**：高级并发模式需要指针操作
> 
> **学习建议**：
> - 确保你已经理解了指针的安全使用
> - 注意并发编程中的指针安全问题
> - 理解原子操作如何保证指针访问的安全性

---

# 章节练习题

# 基础题

**题目1**：编写一个程序，创建两个线程，分别打印不同的消息。

**要求**：
- 使用 `std.Thread.spawn` 创建线程
- 每个线程打印 5 次消息
- 使用 `join()` 等待线程完成

**参考答案**：
```zig
const std = @import("std");

fn printMessage(msg: []const u8) void {
    for (0..5) |i| {
        std.debug.print("线程 {s}: 第 {} 次\n", .{ msg, i + 1 });
    }
}

pub fn main(init: std.process.Init.Minimal) !void {
    const thread1 = try std.Thread.spawn(.{}, printMessage, .{"A"});
    const thread2 = try std.Thread.spawn(.{}, printMessage, .{"B"});
    
    thread1.join();
    thread2.join();
    
    std.debug.print("所有线程完成\n", .{});
}
```

**题目2**：使用 `std.atomic.Value` 实现一个简单的原子计数器。

**要求**：
- 创建原子计数器
- 使用 `fetchAdd` 进行原子递增
- 输出最终结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var counter = std.atomic.Value(usize).init(0);
    
    _ = counter.fetchAdd(1, .monotonic);
    _ = counter.fetchAdd(1, .monotonic);
    _ = counter.fetchAdd(1, .monotonic);
    
    const value = counter.load(.monotonic);
    std.debug.print("计数器值：{}\n", .{value});
}
```

**题目3**：使用 `std.Thread.Mutex` 保护共享数据。

**要求**：
- 创建一个共享变量
- 使用互斥锁保护访问
- 确保线程安全

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var mutex = std.Thread.Mutex{};
    var counter: usize = 0;
    
    const worker = struct {
        fn work(m: *std.Thread.Mutex, c: *usize) void {
            for (0..100) |_| {
                m.lock();
                defer m.unlock();
                c.* += 1;
            }
        }
    }.work;
    
    const thread1 = try std.Thread.spawn(.{}, worker, .{ &mutex, &counter });
    const thread2 = try std.Thread.spawn(.{}, worker, .{ &mutex, &counter });
    
    thread1.join();
    thread2.join();
    
    std.debug.print("最终计数：{}\n", .{counter});
}
```

# 进阶题

**题目1**：实现一个简单的线程池，执行多个任务。

**要求**：
- 创建固定数量的工作线程
- 提交多个任务到任务队列
- 等待所有任务完成

**参考答案**：
```zig
const std = @import("std");

const ThreadPool = struct {
    threads: []std.Thread,
    mutex: std.Thread.Mutex,
    condition: std.Thread.Condition,
    tasks: std.ArrayList(fn () void),
    running: bool,
    
    fn init(allocator: std.mem.Allocator, count: usize) !ThreadPool {
        var pool = ThreadPool{
            .threads = try allocator.alloc(std.Thread, count),
            .mutex = .{},
            .condition = .{},
            .tasks = std.ArrayList(fn () void).init(allocator),
            .running = true,
        };
        
        for (0..count) |i| {
            pool.threads[i] = try std.Thread.spawn(.{}, worker, .{&pool});
        }
        
        return pool;
    }
    
    fn worker(pool: *ThreadPool) void {
        while (true) {
            pool.mutex.lock();
            defer pool.mutex.unlock();
            
            while (pool.tasks.items.len == 0 and pool.running) {
                pool.condition.wait(&pool.mutex);
            }
            
            if (!pool.running and pool.tasks.items.len == 0) {
                return;
            }
            
            if (pool.tasks.items.len > 0) {
                const task = pool.tasks.orderedRemove(0);
                pool.mutex.unlock();
                task();
                pool.mutex.lock();
            }
        }
    }
    
    fn submit(pool: *ThreadPool, task: fn () void) void {
        pool.mutex.lock();
        defer pool.mutex.unlock();
        pool.tasks.append(task) catch return;
        pool.condition.signal();
    }
    
    fn deinit(pool: *ThreadPool) void {
        pool.mutex.lock();
        pool.running = false;
        pool.condition.broadcast();
        pool.mutex.unlock();
        
        for (pool.threads) |thread| {
            thread.join();
        }
    }
};
```

**题目2**：使用 `std.Thread.WaitGroup` 等待多个线程完成。

**要求**：
- 创建多个工作线程
- 使用 WaitGroup 同步
- 等待所有线程完成后再继续

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var wg: std.Thread.WaitGroup = .{};
    var counter: usize = 0;
    var mutex = std.Thread.Mutex{};
    
    const worker = struct {
        fn work(wg: *std.Thread.WaitGroup, m: *std.Thread.Mutex, c: *usize) void {
            defer wg.finish();
            m.lock();
            defer m.unlock();
            c.* += 1;
        }
    }.work;
    
    for (0..10) |_| {
        wg.start();
        _ = try std.Thread.spawn(.{}, worker, .{ &wg, &mutex, &counter });
    }
    
    wg.wait();
    std.debug.print("最终计数：{}\n", .{counter});
}
```

# 挑战题

**题目**：实现一个生产者-消费者模型，使用通道进行通信。

**要求**：
- 创建生产者线程和消费者线程
- 使用线程安全的队列
- 正确处理同步和互斥

**参考答案**：
```zig
const std = @import("std");

const Channel = struct {
    mutex: std.Thread.Mutex,
    condition: std.Thread.Condition,
    buffer: std.ArrayList(i32),
    closed: bool,
    
    fn init(allocator: std.mem.Allocator) Channel {
        return .{
            .mutex = .{},
            .condition = .{},
            .buffer = std.ArrayList(i32).init(allocator),
            .closed = false,
        };
    }
    
    fn send(self: *Channel, value: i32) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.buffer.append(value) catch return;
        self.condition.signal();
    }
    
    fn receive(self: *Channel) ?i32 {
        self.mutex.lock();
        defer self.mutex.unlock();
        
        while (self.buffer.items.len == 0 and !self.closed) {
            self.condition.wait(&self.mutex);
        }
        
        if (self.buffer.items.len > 0) {
            return self.buffer.orderedRemove(0);
        }
        return null;
    }
    
    fn close(self: *Channel) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        self.closed = true;
        self.condition.broadcast();
    }
};

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var channel = Channel.init(allocator);
    
    const producer = struct {
        fn work(ch: *Channel) void {
            for (0..5) |i| {
                ch.send(@intCast(i));
                std.debug.print("生产：{}\n", .{i});
            }
            ch.close();
        }
    }.work;
    
    const consumer = struct {
        fn work(ch: *Channel) void {
            while (ch.receive()) |value| {
                std.debug.print("消费：{}\n", .{value});
            }
        }
    }.work;
    
    const p = try std.Thread.spawn(.{}, producer, .{&channel});
    const c = try std.Thread.spawn(.{}, consumer, .{&channel});
    
    p.join();
    c.join();
}
```

---
