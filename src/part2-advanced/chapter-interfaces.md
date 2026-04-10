# 【draft】接口、组合与设计模式

> 💡 **重要章节**：本章系统性地讲解 Zig 中的对象设计策略，包括运行时多态（接口）和编译期组合两大机制，以及常见设计模式的应用。

## 为什么需要多种对象设计策略？

Zig 没有类继承机制，因此需要通过以下方式构建复杂系统：

1. **接口与多态**：实现运行时灵活性
2. **对象组合**：实现编译期代码复用
3. **设计模式**：解决常见设计问题

本章将系统性地讲解这三种策略，帮助您设计出灵活、高效的 Zig 程序。

## 接口与多态概述

# 为什么需要接口与多态？

在实际编程中，我们经常遇到这样的问题：

```zig
// 为每种写入器写专门的函数
fn writeToFile(file: *std.fs.File, data: []const u8) !void {
    _ = try file.write(data);
}

fn writeToBuffer(buffer: *Buffer, data: []const u8) !void {
    try buffer.append(data);
}

fn writeToNetwork(socket: *Socket, data: []const u8) !void {
    _ = try socket.write(data);
}
```

**问题**：
- 代码重复，维护困难
- 无法统一处理不同类型
- 难以扩展新的实现类型

**解决方案**：使用接口实现运行时多态，编写一次代码，适用于多种类型。

# 接口 vs 泛型

**泛型（编译期多态）**：
```zig
fn writeData(writer: anytype, data: []const u8) !void {
    try writer.writeAll(data);
}
```
- ✅ 零运行时开销
- ✅ 编译期类型检查
- ❌ 类型在编译期固定，无法运行时切换

**接口（运行时多态）**：
```zig
fn writeData(writer: Writer, data: []const u8) !void {
    _ = try writer.write(data);
}
```
- ✅ 运行时可以切换实现
- ✅ 支持动态加载插件
- ❌ 小的性能开销（函数指针调用）

**选择依据**：
- 如果类型在编译期确定 → 使用泛型
- 如果需要运行时切换 → 使用接口

# Zig 的接口哲学

Zig 没有内置的接口概念，而是通过以下机制实现：

1. **Trait 模式**：使用结构体定义行为契约
2. **函数指针表（VTable）**：实现运行时分发
3. **类型擦除**：使用 `*anyopaque` 存储任意类型

这种设计体现了 Zig 的核心理念：**显式优于隐式**。

## 接口基础概念

# 什么是接口？

接口是一种**行为契约**，定义了一组方法签名，而不关心具体实现：

```zig
// 接口定义：Writer 行为契约
const Writer = struct {
    // 存储具体实现的指针
    ptr: *anyopaque,
    // 函数指针：写入数据
    writeFn: *const fn (ptr: *anyopaque, data: []const u8) anyerror!usize,
    
    // 接口方法：调用具体实现
    pub fn write(self: Writer, data: []const u8) !usize {
        return self.writeFn(self.ptr, data);
    }
};
```

**关键概念**：
- `*anyopaque`：类型擦除，存储任意类型指针
- 函数指针：实现运行时分发
- 接口方法：封装函数指针调用

# 类型擦除与恢复

```zig
const std = @import("std");

// 具体类型
const FileWriter = struct {
    file: std.fs.File,
    
    // 实现方法
    pub fn write(ptr: *anyopaque, data: []const u8) anyerror!usize {
        // 类型恢复：从 *anyopaque 恢复为 *FileWriter
        const self: *FileWriter = @ptrCast(@alignCast(ptr));
        return self.file.write(data);
    }
    
    // 转换为接口
    pub fn writer(self: *FileWriter) Writer {
        return .{
            .ptr = self,  // 类型擦除：*FileWriter → *anyopaque
            .writeFn = write,
        };
    }
};
```

**关键操作**：
- **类型擦除**：`*FileWriter → *anyopaque`（自动转换）
- **类型恢复**：`*anyopaque → *FileWriter`（使用 `@ptrCast` 和 `@alignCast`）

## Trait 模式详解

# 基本实现

让我们实现一个完整的 Writer trait：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
// 定义 Writer trait
const Writer = struct {
    ptr: *anyopaque,
    writeFn: *const fn (ptr: *anyopaque, data: []const u8) anyerror!usize,
    
    pub fn write(self: Writer, data: []const u8) !usize {
        return self.writeFn(self.ptr, data);
    }
};

// 实现1：文件写入器
const FileWriter = struct {
    file: std.fs.File,
    
    pub fn write(ptr: *anyopaque, data: []const u8) anyerror!usize {
        const self: *FileWriter = @ptrCast(@alignCast(ptr));
        return self.file.write(data);
    }
    
    pub fn writer(self: *FileWriter) Writer {
        return .{
            .ptr = self,
            .writeFn = write,
        };
    }
};

// 实现2：缓冲写入器
const BufferWriter = struct {
    buffer: []u8,
    pos: usize,
    
    pub fn write(ptr: *anyopaque, data: []const u8) anyerror!usize {
        const self: *BufferWriter = @ptrCast(@alignCast(ptr));
        const available = self.buffer.len - self.pos;
        const to_write = @min(data.len, available);
        @memcpy(self.buffer[self.pos..][0..to_write], data[0..to_write]);
        self.pos += to_write;
        return to_write;
    }
    
    pub fn writer(self: *BufferWriter) Writer {
        return .{
            .ptr = self,
            .writeFn = write,
        };
    }
};

// 使用示例
pub fn main(_: std.process.Init.Minimal) !void {
    // 文件写入器
    var file_writer = FileWriter{
        .file = try std.fs.cwd().createFile("test.txt", .{}),
    };
    defer file_writer.file.close();
    
    const w1 = file_writer.writer();
    _ = try w1.write("Hello from file!\n");
    
    // 缓冲写入器
    var buffer: [1024]u8 = undefined;
    var buffer_writer = BufferWriter{
        .buffer = &buffer,
        .pos = 0,
    };
    
    const w2 = buffer_writer.writer();
    _ = try w2.write("Hello from buffer!\n");
    
    std.debug.print("Buffer: {s}\n", .{buffer[0..buffer_writer.pos]});
}
```

**讲解要点**：
- 每个 trait 实现都需要提供转换函数（如 `writer()`）
- `@ptrCast` 和 `@alignCast` 必须成对使用
- 接口调用通过函数指针间接进行

# 多方法接口（VTable 模式）

当接口包含多个方法时，使用 VTable 模式更清晰：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
// 定义 Writer 接口（VTable 模式）
const Writer = struct {                                    // ①
    ptr: *anyopaque,                                       // ②
    vtable: *const VTable,                                 // ③
    
    const VTable = struct {                                // ④
        write: *const fn (ptr: *anyopaque, data: []const u8) anyerror!usize,
        flush: *const fn (ptr: *anyopaque) anyerror!void,
        close: *const fn (ptr: *anyopaque) void,
    };
    
    pub fn write(self: Writer, data: []const u8) !usize { // ⑤
        return self.vtable.write(self.ptr, data);
    }
    
    pub fn flush(self: Writer) !void {
        return self.vtable.flush(self.ptr);
    }
    
    pub fn close(self: Writer) void {
        self.vtable.close(self.ptr);
    }
};

// 实现文件写入器
const FileWriter = struct {                                // ⑥
    file: std.fs.File,
    
    // 定义 vtable 实例（所有实例共享）
    const vtable = Writer.VTable{                          // ⑦
        .write = write,
        .flush = flush,
        .close = close,
    };
    
    fn write(ptr: *anyopaque, data: []const u8) anyerror!usize {  // ⑧
        const self: *FileWriter = @ptrCast(@alignCast(ptr));
        return self.file.write(data);
    }
    
    fn flush(ptr: *anyopaque) anyerror!void {
        const self: *FileWriter = @ptrCast(@alignCast(ptr));
        return self.file.sync();
    }
    
    fn close(ptr: *anyopaque) void {
        const self: *FileWriter = @ptrCast(@alignCast(ptr));
        self.file.close();
    }
    
    pub fn writer(self: *FileWriter) Writer {              // ⑨
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};

// 使用示例：多态函数
fn writeMessage(w: Writer, message: []const u8) !void {    // ⑩
    _ = try w.write(message);
    try w.flush();
}

pub fn main(_: std.process.Init.Minimal) !void {
    var file_writer = FileWriter{
        .file = try std.fs.cwd().createFile("test.txt", .{}),
    };
    
    const w = file_writer.writer();
    try writeMessage(w, "Hello, World!\n");
    
    w.close();
}
```

**代码解析**：

**① Writer 接口结构体**
- 定义接口类型，包含两个关键字段
- 这是"类型擦除"后的统一接口

**② ptr: *anyopaque**
- 类型擦除后的指针，可以指向任何具体类型
- 类似 C 语言的 `void*`，但更安全
- 在调用时需要恢复为具体类型

**③ vtable: *const VTable**
- 指向虚函数表的指针
- VTable 包含所有接口方法的函数指针
- 每个具体类型都有自己的 VTable 实例

**④ VTable 结构体**
- 定义所有接口方法的函数签名
- 所有方法都接收 `*anyopaque` 作为第一个参数
- 这是实现多态的关键

**⑤ 接口方法**
- 通过 vtable 间接调用具体实现
- 将 ptr 传递给具体实现函数
- 提供统一的调用接口

**⑥ FileWriter 具体实现**
- 实现接口的具体类型
- 包含实际的数据字段
- 提供所有接口方法的实现

**⑦ vtable 实例**
- 所有 FileWriter 实例共享同一个 vtable
- 节省内存，避免每个实例都存储函数指针
- 编译期常量，性能优化

**⑧ 具体方法实现**
- 接收 `*anyopaque` 参数
- 使用 `@ptrCast` 和 `@alignCast` 恢复具体类型
- 调用实际的方法实现

**⑨ 类型转换函数**
- 将具体类型转换为接口类型
- 设置 ptr 指向 self
- 设置 vtable 指向类型的 vtable 实例

**⑩ 多态函数**
- 接收接口类型参数
- 可以处理任何实现了该接口的类型
- 实现运行时多态

**关键要点**：
1. **类型擦除**：`*anyopaque` 隐藏具体类型信息
2. **类型恢复**：`@ptrCast` + `@alignCast` 恢复具体类型
3. **间接调用**：通过 vtable 实现多态
4. **内存效率**：vtable 在所有实例间共享

**预期输出**：
```
文件 test.txt 已创建并写入内容
```

**下一步**：
- 尝试实现其他类型的 Writer（如 NetworkWriter）
- 理解 VTable 模式与其他接口模式的区别
- 参考标准库中的接口设计（如 std.mem.Allocator）

**VTable 模式优势**：
- 所有函数指针集中管理
- 每个 trait 实现共享同一个 vtable 实例（节省内存）
- 接口方法通过 vtable 进行间接调用
- 更容易扩展新方法

## 接口组合

# 多接口实现

一个类型可以实现多个接口：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
// 定义 Reader 接口
const Reader = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        read: *const fn (ptr: *anyopaque, buffer: []u8) anyerror!usize,
        close: *const fn (ptr: *anyopaque) void,
    };
    
    pub fn read(self: Reader, buffer: []u8) !usize {
        return self.vtable.read(self.ptr, buffer);
    }
    
    pub fn close(self: Reader) void {
        self.vtable.close(self.ptr);
    }
};

// 定义 Writer 接口
const Writer = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        write: *const fn (ptr: *anyopaque, data: []const u8) anyerror!usize,
        close: *const fn (ptr: *anyopaque) void,
    };
    
    pub fn write(self: Writer, data: []const u8) !usize {
        return self.vtable.write(self.ptr, data);
    }
    
    pub fn close(self: Writer) void {
        self.vtable.close(self.ptr);
    }
};

// 组合接口：ReadWriter
const ReadWriter = struct {
    ptr: *anyopaque,
    reader_vtable: *const Reader.VTable,
    writer_vtable: *const Writer.VTable,
    
    pub fn reader(self: ReadWriter) Reader {
        return .{
            .ptr = self.ptr,
            .vtable = self.reader_vtable,
        };
    }
    
    pub fn writer(self: ReadWriter) Writer {
        return .{
            .ptr = self.ptr,
            .vtable = self.writer_vtable,
        };
    }
};

// 实现文件 ReadWriter
const FileReadWriter = struct {
    file: std.fs.File,
    
    const reader_vtable = Reader.VTable{
        .read = read,
        .close = close,
    };
    
    const writer_vtable = Writer.VTable{
        .write = write,
        .close = close,
    };
    
    fn read(ptr: *anyopaque, buffer: []u8) anyerror!usize {
        const self: *FileReadWriter = @ptrCast(@alignCast(ptr));
        return self.file.read(buffer);
    }
    
    fn write(ptr: *anyopaque, data: []const u8) anyerror!usize {
        const self: *FileReadWriter = @ptrCast(@alignCast(ptr));
        return self.file.write(data);
    }
    
    fn close(ptr: *anyopaque) void {
        const self: *FileReadWriter = @ptrCast(@alignCast(ptr));
        self.file.close();
    }
    
    pub fn readWriter(self: *FileReadWriter) ReadWriter {
        return .{
            .ptr = self,
            .reader_vtable = &reader_vtable,
            .writer_vtable = &writer_vtable,
        };
    }
};

// 使用示例
pub fn main(_: std.process.Init.Minimal) !void {
    var file_rw = FileReadWriter{
        .file = try std.fs.cwd().createFile("test.txt", .{
            .read = true,
        }),
    };
    defer file_rw.file.close();
    
    const rw = file_rw.readWriter();
    
    // 写入
    _ = try rw.writer().write("Hello, World!\n");
    
    // 读取
    var buffer: [100]u8 = undefined;
    _ = try rw.reader().read(&buffer);
    
    std.debug.print("Read: {s}\n", .{buffer});
}
```

**接口组合要点**：
- 组合接口包含多个 vtable
- 同一个类型可以实现多个接口
- 接口之间可以相互转换

## 设计模式应用

# 策略模式

策略模式允许在运行时切换算法：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
// 定义排序策略接口
const SortStrategy = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        sort: *const fn (ptr: *anyopaque, items: []i32) void,
        name: *const fn (ptr: *anyopaque) []const u8,
    };
    
    pub fn sort(self: SortStrategy, items: []i32) void {
        self.vtable.sort(self.ptr, items);
    }
    
    pub fn name(self: SortStrategy) []const u8 {
        return self.vtable.name(self.ptr);
    }
};

// 实现快速排序
const QuickSort = struct {
    const vtable = SortStrategy.VTable{
        .sort = sort,
        .name = name,
    };
    
    fn sort(ptr: *anyopaque, items: []i32) void {
        _ = ptr;
        // 简化示例：实际应实现快速排序
        std.debug.print("QuickSort: sorting {} items\n", .{items.len});
    }
    
    fn name(ptr: *anyopaque) []const u8 {
        _ = ptr;
        return "QuickSort";
    }
    
    pub fn strategy(self: *QuickSort) SortStrategy {
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};

// 实现归并排序
const MergeSort = struct {
    const vtable = SortStrategy.VTable{
        .sort = sort,
        .name = name,
    };
    
    fn sort(ptr: *anyopaque, items: []i32) void {
        _ = ptr;
        // 简化示例：实际应实现归并排序
        std.debug.print("MergeSort: sorting {} items\n", .{items.len});
    }
    
    fn name(ptr: *anyopaque) []const u8 {
        _ = ptr;
        return "MergeSort";
    }
    
    pub fn strategy(self: *MergeSort) SortStrategy {
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};

// 使用示例
pub fn main(_: std.process.Init.Minimal) !void {
    var items = [_]i32{ 5, 2, 8, 1, 9 };
    
    var quick = QuickSort{};
    var merge = MergeSort{};
    
    // 运行时切换策略
    var strategy = quick.strategy();
    std.debug.print("Using: {s}\n", .{strategy.name()});
    strategy.sort(&items);
    
    strategy = merge.strategy();
    std.debug.print("Using: {s}\n", .{strategy.name()});
    strategy.sort(&items);
}
```

# 工厂模式

工厂模式用于创建多态对象：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
// 定义形状接口
const Shape = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        area: *const fn (ptr: *anyopaque) f64,
        perimeter: *const fn (ptr: *anyopaque) f64,
        deinit: *const fn (ptr: *anyopaque, allocator: std.mem.Allocator) void,
    };
    
    pub fn area(self: Shape) f64 {
        return self.vtable.area(self.ptr);
    }
    
    pub fn perimeter(self: Shape) f64 {
        return self.vtable.perimeter(self.ptr);
    }
    
    pub fn deinit(self: Shape, allocator: std.mem.Allocator) void {
        self.vtable.deinit(self.ptr, allocator);
    }
};

// 实现圆形
const Circle = struct {
    radius: f64,
    
    const vtable = Shape.VTable{
        .area = area,
        .perimeter = perimeter,
        .deinit = deinit,
    };
    
    fn area(ptr: *anyopaque) f64 {
        const self: *Circle = @ptrCast(@alignCast(ptr));
        return std.math.pi * self.radius * self.radius;
    }
    
    fn perimeter(ptr: *anyopaque) f64 {
        const self: *Circle = @ptrCast(@alignCast(ptr));
        return 2 * std.math.pi * self.radius;
    }
    
    fn deinit(ptr: *anyopaque, allocator: std.mem.Allocator) void {
        const self: *Circle = @ptrCast(@alignCast(ptr));
        allocator.destroy(self);
    }
    
    pub fn shape(self: *Circle) Shape {
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};

// 实现矩形
const Rectangle = struct {
    width: f64,
    height: f64,
    
    const vtable = Shape.VTable{
        .area = area,
        .perimeter = perimeter,
        .deinit = deinit,
    };
    
    fn area(ptr: *anyopaque) f64 {
        const self: *Rectangle = @ptrCast(@alignCast(ptr));
        return self.width * self.height;
    }
    
    fn perimeter(ptr: *anyopaque) f64 {
        const self: *Rectangle = @ptrCast(@alignCast(ptr));
        return 2 * (self.width + self.height);
    }
    
    fn deinit(ptr: *anyopaque, allocator: std.mem.Allocator) void {
        const self: *Rectangle = @ptrCast(@alignCast(ptr));
        allocator.destroy(self);
    }
    
    pub fn shape(self: *Rectangle) Shape {
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};

// 形状工厂
const ShapeType = enum {
    circle,
    rectangle,
};

fn createShape(allocator: std.mem.Allocator, shape_type: ShapeType, params: anytype) !Shape {
    return switch (shape_type) {
        .circle => {
            const circle = try allocator.create(Circle);
            circle.* = .{ .radius = params.radius };
            return circle.shape();
        },
        .rectangle => {
            const rect = try allocator.create(Rectangle);
            rect.* = .{ .width = params.width, .height = params.height };
            return rect.shape();
        },
    };
}

// 使用示例
pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 使用工厂创建形状
    const circle = try createShape(allocator, .circle, .{ .radius = 5.0 });
    defer circle.deinit(allocator);
    
    const rect = try createShape(allocator, .rectangle, .{ .width = 4.0, .height = 3.0 });
    defer rect.deinit(allocator);
    
    // 多态调用
    std.debug.print("Circle area: {:.2}\n", .{circle.area()});
    std.debug.print("Rectangle area: {:.2}\n", .{rect.area()});
}
```

## 复杂对象设计模式

> 💡 **核心概念**：Zig 没有类继承机制，**组合是构建复杂对象的核心策略**。本节将系统性地讲解组合模式及其应用。

### 组合优于继承

在面向对象编程中，"组合优于继承"（Composition over Inheritance）是一条重要的设计原则。在 Zig 中，由于没有继承机制，组合成为唯一的选择，这也带来了独特的设计优势：

**继承的问题**：
- 耦合度高：子类依赖父类实现细节
- 脆弱基类：父类修改影响所有子类
- 多重继承复杂：菱形继承等问题

**组合的优势**：
- 灵活性高：运行时可以替换组件
- 低耦合：组件之间相互独立
- 易于测试：组件可独立测试
- 符合 Zig 哲学：显式优于隐式

### 基本组合模式

通过将其他结构体作为字段嵌入来实现功能复用：

```zig
const std = @import("std");

// 组件1：位置信息
const Position = struct {
    x: f32,
    y: f32,
    
    fn move(self: *Position, dx: f32, dy: f32) void {
        self.x += dx;
        self.y += dy;
    }
    
    fn distanceFromOrigin(self: Position) f32 {
        return @sqrt(self.x * self.x + self.y * self.y);
    }
};

// 组件2：速度信息
const Velocity = struct {
    dx: f32,
    dy: f32,
    
    fn update(self: Velocity, pos: *Position, dt: f32) void {
        pos.move(self.dx * dt, self.dy * dt);
    }
};

// 组件3：渲染属性
const Renderable = struct {
    color: u32,
    width: f32,
    height: f32,
    
    fn render(self: Renderable, pos: Position) void {
        std.debug.print("Rendering at ({d}, {d}) with color #{x:0>6}\n", .{
            pos.x, pos.y, self.color,
        });
    }
};

// 复杂对象：通过组合构建
const GameObject = struct {
    name: []const u8,
    position: Position,      // 组合位置组件
    velocity: Velocity,      // 组合速度组件
    renderable: Renderable,  // 组合渲染组件
    
    fn update(self: *GameObject, dt: f32) void {
        self.velocity.update(&self.position, dt);
    }
    
    fn render(self: GameObject) void {
        self.renderable.render(self.position);
    }
};

pub fn main() void {
    var player = GameObject{
        .name = "Player",
        .position = .{ .x = 0.0, .y = 0.0 },
        .velocity = .{ .dx = 10.0, .dy = 5.0 },
        .renderable = .{ .color = 0xFF0000, .width = 32.0, .height = 32.0 },
    };
    
    player.update(1.0);
    player.render();
}
```

**组合的优势**：
- ✅ 清晰的所有权关系：父对象拥有子对象
- ✅ 组件可独立测试和复用
- ✅ 编译期确定内存布局
- ✅ 零运行时开销

### 委托模式

通过方法委托暴露组件功能，提供清晰的 API 边界：

```zig
const std = @import("std");

// 日志组件
const Logger = struct {
    prefix: []const u8,
    
    fn log(self: Logger, message: []const u8) void {
        std.debug.print("[{s}] {s}\n", .{ self.prefix, message });
    }
};

// 缓存组件
const Cache = struct {
    data: std.StringHashMap([]const u8),
    allocator: std.mem.Allocator,
    
    fn init(allocator: std.mem.Allocator) Cache {
        return .{
            .data = std.StringHashMap([]const u8).init(allocator),
            .allocator = allocator,
        };
    }
    
    fn deinit(self: *Cache) void {
        self.data.deinit();
    }
    
    fn get(self: *Cache, key: []const u8) ?[]const u8 {
        return self.data.get(key);
    }
    
    fn set(self: *Cache, key: []const u8, value: []const u8) !void {
        try self.data.put(key, value);
    }
};

// 复杂服务：组合日志和缓存
const DataService = struct {
    logger: Logger,
    cache: Cache,
    
    fn init(allocator: std.mem.Allocator, name: []const u8) DataService {
        return .{
            .logger = .{ .prefix = name },
            .cache = Cache.init(allocator),
        };
    }
    
    fn deinit(self: *DataService) void {
        self.cache.deinit();
    }
    
    // 委托方法：暴露缓存功能
    fn getData(self: *DataService, key: []const u8) ?[]const u8 {
        self.logger.log("Fetching data");
        return self.cache.get(key);
    }
    
    fn setData(self: *DataService, key: []const u8, value: []const u8) !void {
        self.logger.log("Storing data");
        try self.cache.set(key, value);
    }
    
    // 业务逻辑方法
    fn processRequest(self: *DataService, key: []const u8) ![]const u8 {
        if (self.getData(key)) |cached| {
            self.logger.log("Cache hit");
            return cached;
        }
        
        self.logger.log("Cache miss, computing...");
        const result = "computed_value";
        try self.setData(key, result);
        return result;
    }
};

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    
    var service = DataService.init(gpa.allocator(), "DataService");
    defer service.deinit();
    
    _ = try service.processRequest("key1");
    _ = try service.processRequest("key1");
}
```

**委托模式的优势**：
- 封装内部实现细节
- 提供清晰的 API 边界
- 易于重构和修改实现

### Mixin 模式

使用泛型实现跨类型的代码复用：

```zig
const std = @import("std");

// Mixin 1：计数器功能
fn CounterMixin(comptime T: type) type {
    return struct {
        counter: usize = 0,
        
        fn increment(self: *T) void {
            self.counter += 1;
        }
        
        fn decrement(self: *T) void {
            self.counter -= 1;
        }
        
        fn getCount(self: *const T) usize {
            return self.counter;
        }
    };
}

// Mixin 2：命名功能
fn NamedMixin(comptime T: type) type {
    return struct {
        name: []const u8 = "",
        
        fn setName(self: *T, new_name: []const u8) void {
            self.name = new_name;
        }
        
        fn getName(self: *const T) []const u8 {
            return self.name;
        }
    };
}

// 使用 Mixin 的复杂对象
const Entity = struct {
    const Self = @This();
    
    // 嵌入 Mixin 字段
    usingnamespace CounterMixin(Self);
    usingnamespace NamedMixin(Self);
    
    id: u32,
    
    fn init(id: u32) Self {
        return .{
            .id = id,
            .counter = 0,
            .name = "",
        };
    }
};

pub fn main() void {
    var entity = Entity.init(1);
    
    entity.setName("Entity1");
    entity.increment();
    entity.increment();
    
    std.debug.print("Entity: id={}, name={s}, count={}\n", .{
        entity.id,
        entity.getName(),
        entity.getCount(),
    });
}
```

**Mixin 模式的优势**：
- 跨类型共享行为
- 编译期代码生成
- 零运行时开销

### 策略对比与选择

| 策略           | 适用场景                 | 优势                         | 劣势                 | 性能开销         |
| -------------- | ------------------------ | ---------------------------- | -------------------- | ---------------- |
| **基本组合**   | 组件关系清晰、编译期确定 | 零开销、类型安全、编译期优化 | 缺乏灵活性、类型耦合 | 无               |
| **委托模式**   | 需要封装内部实现         | 清晰的API边界、易于重构      | 需要编写委托代码     | 无               |
| **接口组合**   | 运行时多态、插件系统     | 灵活性高、支持动态加载       | 运行时开销、代码复杂 | VTable查找       |
| **Mixin 模式** | 跨类型共享行为           | 代码复用、灵活组合           | 可能导致命名冲突     | 无（编译期展开） |

### 选择策略的决策树

```
需要运行时多态？
├─ 是 → 使用接口组合
└─ 否 → 需要跨类型共享行为？
         ├─ 是 → 使用 Mixin 模式
         └─ 否 → 组件关系是否复杂？
                  ├─ 是 → 使用委托模式封装
                  └─ 否 → 使用基本组合
```

### 最佳实践

**1. 优先使用组合而非继承**
```zig
// ❌ 其他语言的继承方式（Zig 不支持）
// class Player extends GameObject { ... }

// ✅ Zig 的组合方式
const Player = struct {
    game_object: GameObject,  // 组合
    health: u32,
    inventory: Inventory,
};
```

**2. 显式优于隐式**
```zig
// ❌ 避免过度使用 usingnamespace
const Player = struct {
    usingnamespace GameObject;  // 隐式混入所有字段和方法
};

// ✅ 显式组合更清晰
const Player = struct {
    game_object: GameObject,  // 显式字段
    
    fn move(self: *Player, dx: f32, dy: f32) void {
        self.game_object.move(dx, dy);  // 显式调用
    }
};
```

**3. 明确所有权**
```zig
// ✅ 清晰的所有权关系
const Server = struct {
    config: Config,        // 拥有配置
    logger: *Logger,       // 借用日志器（不拥有）
    connections: ArrayList, // 拥有连接列表
};
```

**4. 接口隔离**
```zig
// ❌ 接口过于庞大
const ReadWriteSeeker = struct {
    read: fn() void,
    write: fn() void,
    seek: fn() void,
    flush: fn() void,
    close: fn() void,
    // ... 太多方法
};

// ✅ 接口小而专注
const Reader = struct { read: fn() void };
const Writer = struct { write: fn() void };
const Seeker = struct { seek: fn() void };
```

**5. 性能优先**
```zig
// 编译期多态（优先）
fn process(comptime T: type, item: T) void {
    item.process();
}

// 运行时多态（必要时）
fn processInterface(item: Processor) void {
    item.process();  // 通过 vtable 调用
}
```

### 反模式警示

**过度嵌套**：
```zig
// ❌ 反模式：过度嵌套
const A = struct { b: B };
const B = struct { c: C };
const C = struct { d: D };
const D = struct { value: i32 };

// ✅ 推荐：扁平化设计
const Config = struct {
    network: NetworkConfig,
    database: DatabaseConfig,
    logging: LoggingConfig,
};
```

**循环依赖**：
```zig
// ❌ 反模式：循环依赖
const A = struct { b: *B };
const B = struct { a: *A };

// ✅ 推荐：使用接口解耦
const A = struct { b: BInterface };
const B = struct { a: AInterface };
```

## 接口与错误处理

接口方法可以返回错误：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
const Database = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        connect: *const fn (ptr: *anyopaque) anyerror!void,
        query: *const fn (ptr: *anyopaque, sql: []const u8) anyerror!QueryResult,
        close: *const fn (ptr: *anyopaque) void,
    };
    
    const QueryResult = struct {
        rows: usize,
        data: []const u8,
    };
    
    pub fn connect(self: Database) !void {
        return self.vtable.connect(self.ptr);
    }
    
    pub fn query(self: Database, sql: []const u8) !QueryResult {
        return self.vtable.query(self.ptr, sql);
    }
    
    pub fn close(self: Database) void {
        self.vtable.close(self.ptr);
    }
};

// 使用示例
fn executeQuery(db: Database, sql: []const u8) !void {
    try db.connect();
    defer db.close();
    
    const result = try db.query(sql);
    std.debug.print("Query returned {} rows\n", .{result.rows});
}
```

## 接口与内存管理

接口对象的生命周期管理：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
const Plugin = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        init: *const fn (ptr: *anyopaque, allocator: std.mem.Allocator) anyerror!void,
        process: *const fn (ptr: *anyopaque, data: []const u8) anyerror![]u8,
        deinit: *const fn (ptr: *anyopaque, allocator: std.mem.Allocator) void,
    };
    
    pub fn init(self: Plugin, allocator: std.mem.Allocator) !void {
        return self.vtable.init(self.ptr, allocator);
    }
    
    pub fn process(self: Plugin, allocator: std.mem.Allocator, data: []const u8) ![]u8 {
        return self.vtable.process(self.ptr, data);
    }
    
    pub fn deinit(self: Plugin, allocator: std.mem.Allocator) void {
        self.vtable.deinit(self.ptr, allocator);
    }
};

// 使用示例
fn usePlugin(allocator: std.mem.Allocator, plugin: Plugin, input: []const u8) !void {
    try plugin.init(allocator);
    defer plugin.deinit(allocator);
    
    const result = try plugin.process(allocator, input);
    defer allocator.free(result);
    
    std.debug.print("Result: {s}\n", .{result});
}
```

## 接口与测试

使用 Mock 对象进行测试：

```zig
const std = @import("std");

// 示例：Zig 0.16.0-dev
const Writer = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        write: *const fn (ptr: *anyopaque, data: []const u8) anyerror!usize,
    };
    
    pub fn write(self: Writer, data: []const u8) !usize {
        return self.vtable.write(self.ptr, data);
    }
};

// Mock 对象用于测试
const MockWriter = struct {
    written_data: []const u8,
    
    const vtable = Writer.VTable{
        .write = write,
    };
    
    fn write(ptr: *anyopaque, data: []const u8) anyerror!usize {
        const self: *MockWriter = @ptrCast(@alignCast(ptr));
        self.written_data = data;
        return data.len;
    }
    
    pub fn writer(self: *MockWriter) Writer {
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};

// 测试用例
test "write with mock" {
    var mock = MockWriter{ .written_data = "" };
    const w = mock.writer();
    
    const written = try w.write("test data");
    try std.testing.expectEqual(@as(usize, 9), written);
    try std.testing.expectEqualStrings("test data", mock.written_data);
}
```

## 实践练习

# 练习1：基础练习（难度：简单）

**练习目标**：掌握 trait 的基本实现

```zig
// 练习1.1：实现 Stringer trait
const Stringer = struct {
    ptr: *anyopaque,
    toStringFn: *const fn (ptr: *anyopaque, buffer: []u8) usize,
    
    pub fn toString(self: Stringer, buffer: []u8) usize {
        return self.toStringFn(self.ptr, buffer);
    }
};

// 为 Point 实现 Stringer
const Point = struct {
    x: i32,
    y: i32,
    
    // TODO: 实现 Stringer trait
};

// 练习1.2：实现 Equaler trait
const Equaler = struct {
    ptr: *anyopaque,
    equalsFn: *const fn (ptr: *anyopaque, other: *anyopaque) bool,
    
    pub fn equals(self: Equaler, other: Equaler) bool {
        return self.equalsFn(self.ptr, other.ptr);
    }
};

// 为 Point 实现 Equaler
// TODO: 实现 Equaler trait
```

# 练习2：进阶练习（难度：中等）

**练习目标**：掌握多方法接口和接口组合

```zig
// 练习2.1：实现完整的文件系统接口
const FileSystem = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        // TODO: 定义 open, close, read, write, seek 方法
    };
    
    // TODO: 实现所有方法
};

// 练习2.2：实现内存文件系统
const MemoryFileSystem = struct {
    // TODO: 实现所有方法
};

// 练习2.3：实现日志系统接口
const Logger = struct {
    // TODO: 定义 VTable 包含 debug, info, warn, error 方法
};
```

# 练习3：高级练习（难度：困难）

**练习目标**：掌握设计模式和高级用法

```zig
// 练习3.1：实现观察者模式
const Observer = struct {
    // TODO: 定义观察者接口
};

const Subject = struct {
    // TODO: 实现主题，支持注册/注销观察者
};

// 练习3.2：实现插件系统
const Plugin = struct {
    // TODO: 定义插件接口
};

const PluginManager = struct {
    // TODO: 实现插件管理器，支持动态加载
};
```

## 接口编程最佳实践

# 1. 明确接口边界

```zig
// ✅ 好的做法：接口职责单一
// ❌ 错误示例
const Reader = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        read: *const fn (ptr: *anyopaque, buffer: []u8) anyerror!usize,
    };
};

const Writer = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        write: *const fn (ptr: *anyopaque, data: []const u8) anyerror!usize,
    };
};

// ❌ 不好的做法：接口过于庞大
const ReadWriteSeeker = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        read: *const fn (...) anyerror!usize,
        write: *const fn (...) anyerror!usize,
        seek: *const fn (...) anyerror!void,
        flush: *const fn (...) anyerror!void,
        close: *const fn (...) void,
        // ... 太多方法
    };
};
```

# 2. 使用 VTable 模式

```zig
// ✅ 好的做法：使用 VTable 集中管理
// ❌ 错误示例
const Writer = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        write: *const fn (...) anyerror!usize,
        flush: *const fn (...) anyerror!void,
    };
};

// ❌ 不好的做法：分散的函数指针
const Writer = struct {
    ptr: *anyopaque,
    writeFn: *const fn (...) anyerror!usize,
    flushFn: *const fn (...) anyerror!void,
};
```

# 3. 明确生命周期

```zig
// ✅ 好的做法：明确资源管理
// 💡 最佳实践
const Resource = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    const VTable = struct {
        use: *const fn (ptr: *anyopaque) void,
        deinit: *const fn (ptr: *anyopaque, allocator: std.mem.Allocator) void,
    };
    
    pub fn deinit(self: Resource, allocator: std.mem.Allocator) void {
        self.vtable.deinit(self.ptr, allocator);
    }
};

// 使用示例
var resource = createResource(allocator);
defer resource.deinit(allocator);
```

# 4. 提供清晰的错误信息

```zig
// ✅ 好的做法：提供类型检查
// 💡 最佳实践
const Writer = struct {
    ptr: *anyopaque,
    vtable: *const VTable,
    
    pub fn write(self: Writer, data: []const u8) !usize {
        if (self.vtable == null or self.ptr == null) {
            return error.NullInterface;
        }
        return self.vtable.write(self.ptr, data);
    }
};
```

# 5. 编写测试

```zig
// ✅ 好的做法：为接口编写测试
// 💡 最佳实践
test "Writer interface" {
    var mock = MockWriter{};
    const w = mock.writer();
    
    const written = try w.write("test");
    try std.testing.expectEqual(@as(usize, 4), written);
}
```

## 小结

本章介绍了 Zig 的接口与多态，包括：

1. **接口基础概念**：
   - 什么是接口
   - 类型擦除与恢复
   - 接口 vs 泛型

2. **Trait 模式**：
   - 基本实现
   - VTable 模式
   - 多方法接口

3. **接口组合**：
   - 多接口实现
   - 接口转换

4. **设计模式应用**：
   - 策略模式
   - 工厂模式

5. **最佳实践**：
   - 明确接口边界
   - 使用 VTable 模式
   - 明确生命周期
   - 提供清晰的错误信息
   - 编写测试

**关键要点**：
- Zig 没有内置接口，通过 trait 和 VTable 实现
- `*anyopaque` 用于类型擦除，`@ptrCast/@alignCast` 用于类型恢复
- VTable 模式更适合多方法接口
- 接口提供运行时多态，但有小的性能开销
- 明确生命周期和资源管理责任

**下一步学习**：
- 第十章：内存管理模型 - 深入理解内存管理
- 第十一章：指针与引用类型 - 掌握指针操作
- 第十二章：并发编程模型 - 学习并发编程

---

> 💡 **章节过渡**：从接口与多态到内存管理模型
> 
> 在[接口与多态](chapter-interfaces.md)中，我们学习了接口与多态，掌握了如何使用 trait 和 VTable 模式设计灵活的系统架构。
> 现在，我们将学习内存管理模型，深入了解 Zig 如何实现内存安全和资源管理。
> 
> **为什么接口与多态是内存管理的基础？**
> 
> 1. **资源管理**：接口设计需要明确生命周期和资源所有权
> 2. **分配器接口**：内存分配器本身就是接口设计的重要案例
> 3. **安全抽象**：良好的接口设计可以防止内存错误
> 
> **学习建议**：
> - 回顾接口中的生命周期管理
> - 理解资源所有权的概念
> - 准备学习 Zig 的显式内存管理哲学
