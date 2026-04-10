# 【draft】泛型编程

> 💡 **重要章节**：泛型编程是 Zig 的核心特性之一，掌握它对于编写可复用、类型安全的代码至关重要。

## 泛型编程概述

# 为什么需要泛型？

在实际编程中，我们经常遇到这样的问题：

```zig
// 为每种类型写专门的函数
fn maxI32(a: i32, b: i32) i32 {
    return if (a > b) a else b;
}

fn maxF64(a: f64, b: f64) f64 {
    return if (a > b) a else b;
}

fn maxU8(a: u8, b: u8) u8 {
    return if (a > b) a else b;
}
```

**问题**：
- 代码重复，维护困难
- 新增类型需要编写新函数
- 容易出错，难以保证一致性

**解决方案**：使用泛型编程，编写一次代码，适用于多种类型。

# Zig 泛型的独特性

Zig 的泛型编程基于**编译期计算**（comptime），具有以下特点：

1. **编译期实例化**：泛型在编译时为每种使用的类型生成专门代码
2. **零运行时开销**：没有虚函数表、没有运行时类型信息
3. **类型安全**：编译期完整检查，保证类型正确性
4. **显式优于隐式**：类型参数必须显式标注 `comptime`

# 与其他语言的对比

**C++ 模板**：
```cpp
// C++ 模板
template<typename T>
T max(T a, T b) {
    return a > b ? a : b;
}
```

**Zig 泛型**：
```zig
// Zig 泛型
fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}
```

**对比**：
| 特性       | C++ 模板 | Zig 泛型            |
| ---------- | -------- | ------------------- |
| 类型参数   | 隐式推断 | 显式标注 `comptime` |
| 实例化时机 | 编译期   | 编译期              |
| 错误诊断   | 复杂     | 清晰                |
| 代码膨胀   | 可能严重 | 可控                |

**Rust 泛型**：
```rust
// Rust 泛型
fn max<T: Ord>(a: T, b: T) -> T {
    if a > b { a } else { b }
}
```

**对比**：
| 特性     | Rust 泛型     | Zig 泛型   |
| -------- | ------------- | ---------- |
| 类型约束 | Trait 约束    | 编译期检查 |
| 单态化   | 是            | 是         |
| 灵活性   | 受 Trait 限制 | 完全自由   |

## 泛型基础概念

# 什么是泛型？

**泛型**（Generics）是一种参数化类型的编程技术，允许编写适用于多种类型的代码，而不需要为每种类型单独实现。

**核心思想**：
- **类型参数化**：将类型作为参数传递
- **代码复用**：一次编写，多种类型使用
- **类型安全**：编译期保证类型正确

# comptime 关键字

`comptime` 是 Zig 泛型的核心，表示"编译期"：

```zig
const std = @import("std");

// comptime T: type 表示 T 是编译期类型参数
fn identity(comptime T: type, value: T) T {
    return value;
}

pub fn main(_: std.process.Init.Minimal) void {
    // 显式指定类型
    const a = identity(i32, 42);
    std.debug.print("a = {}\n", .{a});
    
    // 类型推断
    const b = identity(f64, 3.14);
    std.debug.print("b = {}\n", .{b});
}
```

**要点**：
- `comptime T: type` 表示 T 是编译期类型参数
- 函数在编译期为每种使用的类型生成专门版本
- 类型推断让调用更简洁

# 编译期实例化

Zig 的泛型在编译时实例化，生成针对特定类型的代码：

```zig
fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

// 编译器生成的代码（概念上）：
fn max_i32(a: i32, b: i32) i32 {
    return if (a > b) a else b;
}

fn max_f64(a: f64, b: f64) f64 {
    return if (a > b) a else b;
}
```

**优势**：
- 零运行时开销
- 编译器可以针对特定类型优化
- 类型错误在编译期发现

## 泛型函数

# 基本语法

**最简单的泛型函数**：

```zig
const std = @import("std");

// 泛型函数：返回两个值中的最大值
fn maxValue(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

// 泛型函数：返回两个值中的最小值
fn minValue(comptime T: type, a: T, b: T) T {
    return if (a < b) a else b;
}

pub fn main(_: std.process.Init.Minimal) void {
    // 整数类型
    std.debug.print("max(i32, 10, 20) = {}\n", .{maxValue(i32, 10, 20)});
    std.debug.print("min(i32, 10, 20) = {}\n", .{minValue(i32, 10, 20)});
    
    // 浮点类型
    std.debug.print("max(f64, 3.14, 2.71) = {}\n", .{maxValue(f64, 3.14, 2.71)});
    std.debug.print("min(f64, 3.14, 2.71) = {}\n", .{minValue(f64, 3.14, 2.71)});
}
```

**预期输出**：
```
max(i32, 10, 20) = 20
min(i32, 10, 20) = 10
max(f64, 3.14, 2.71) = 3.14
min(f64, 3.14, 2.71) = 2.71
```

# 类型推断

Zig 可以自动推断类型参数：

```zig
const std = @import("std");

fn double(comptime T: type, value: T) T {
    return value * 2;
}

pub fn main(_: std.process.Init.Minimal) void {
    // 显式指定类型
    const a = double(i32, 10);
    std.debug.print("double(i32, 10) = {}\n", .{a});
    
    // 类型推断（不推荐，可能导致意外行为）
    // const b = double(3.14);  // 编译错误：缺少类型参数
}
```

**建议**：对于泛型函数，建议显式指定类型参数，以提高代码可读性。

# 多类型参数

泛型函数可以有多个类型参数：

```zig
const std = @import("std");

// 创建键值对
fn Pair(comptime K: type, comptime V: type) type {
    return struct {
        key: K,
        value: V,
    };
}

// 泛型函数：创建键值对
fn makePair(comptime K: type, comptime V: type, key: K, value: V) Pair(K, V) {
    return .{ .key = key, .value = value };
}

pub fn main(_: std.process.Init.Minimal) void {
    // 字符串-整数对
    const p1 = makePair([]const u8, i32, "age", 25);
    std.debug.print("key: {s}, value: {}\n", .{ p1.key, p1.value });
    
    // 整数-浮点对
    const p2 = makePair(i32, f64, 1, 3.14);
    std.debug.print("key: {}, value: {}\n", .{ p2.key, p2.value });
}
```

# 类型约束

可以使用编译期检查来约束类型：

```zig
const std = @import("std");

// 数值类型约束
fn Numeric(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .int, .float => T,
        else => @compileError("Numeric type required, found " ++ @typeName(T)),
    };
}

// 绝对值函数（只接受数值类型）
fn abs(comptime T: type, x: Numeric(T)) Numeric(T) {
    const info = @typeInfo(T);
    return switch (info) {
        .int => |int_info| if (int_info.signedness == .signed and x < 0) -x else x,
        .float => if (x < 0) -x else x,
        else => unreachable,
    };
}

pub fn main(_: std.process.Init.Minimal) void {
    // 整数绝对值
    std.debug.print("abs(i32, -5) = {}\n", .{abs(i32, -5)});
    std.debug.print("abs(i32, 10) = {}\n", .{abs(i32, 10)});
    
    // 浮点绝对值
    std.debug.print("abs(f64, -3.14) = {}\n", .{abs(f64, -3.14)});
    
    // 编译期错误示例（取消注释查看）
    // std.debug.print("abs([]const u8, \"hello\") = {}\n", .{abs([]const u8, "hello")});
    // 错误：Numeric type required, found []const u8
}
```

**要点**：
- 使用 `@typeInfo` 进行类型反射
- 使用 `@compileError` 提供清晰的错误信息
- 约束可以是类型特征，不仅仅是类型本身

## 泛型数据结构

# 泛型结构体

**基本语法**：

```zig
const std = @import("std");

// 泛型结构体：点
fn Point(comptime T: type) type {
    return struct {
        x: T,
        y: T,
        
        const Self = @This();
        
        // 构造函数
        pub fn init(x: T, y: T) Self {
            return .{ .x = x, .y = y };
        }
        
        // 距离原点
        pub fn distance(self: Self) T {
            return @sqrt(self.x * self.x + self.y * self.y);
        }
        
        // 两点距离
        pub fn distanceTo(self: Self, other: Self) T {
            const dx = self.x - other.x;
            const dy = self.y - other.y;
            return @sqrt(dx * dx + dy * dy);
        }
    };
}

pub fn main(_: std.process.Init.Minimal) void {
    // 整数点
    const p1 = Point(i32).init(3, 4);
    std.debug.print("Point(i32) distance: {}\n", .{p1.distance()});
    
    // 浮点点
    const p2 = Point(f64).init(3.0, 4.0);
    std.debug.print("Point(f64) distance: {}\n", .{p2.distance()});
    
    // 两点距离
    const p3 = Point(f64).init(0.0, 0.0);
    const p4 = Point(f64).init(3.0, 4.0);
    std.debug.print("Distance between points: {}\n", .{p3.distanceTo(p4)});
}
```

**要点**：
- 泛型结构体返回 `type`，实现类型工厂模式
- `Self = @This()` 模式用于方法中引用自身类型
- 泛型实例化后是独立类型，互不干扰

# 泛型容器：栈

**完整实现**：

```zig
const std = @import("std");

// 泛型栈
fn Stack(comptime T: type) type {
    return struct {
        const Self = @This();
        
        items: []T,
        top: usize,
        allocator: std.mem.Allocator,
        
        // 初始化
        pub fn init(allocator: std.mem.Allocator) Self {
            return .{
                .items = &[_]T{},
                .top = 0,
                .allocator = allocator,
            };
        }
        
        // 清理
        pub fn deinit(self: *Self) void {
            if (self.items.len > 0) {
                self.allocator.free(self.items);
            }
        }
        
        // 压栈
        pub fn push(self: *Self, item: T) !void {
            if (self.top >= self.items.len) {
                const new_len = if (self.items.len == 0) 4 else self.items.len * 2;
                const new_items = try self.allocator.alloc(T, new_len);
                @memcpy(new_items[0..self.top], self.items[0..self.top]);
                if (self.items.len > 0) {
                    self.allocator.free(self.items);
                }
                self.items = new_items;
            }
            self.items[self.top] = item;
            self.top += 1;
        }
        
        // 弹栈
        pub fn pop(self: *Self) ?T {
            if (self.top == 0) return null;
            self.top -= 1;
            return self.items[self.top];
        }
        
        // 查看栈顶
        pub fn peek(self: Self) ?T {
            if (self.top == 0) return null;
            return self.items[self.top - 1];
        }
        
        // 获取大小
        pub fn len(self: Self) usize {
            return self.top;
        }
        
        // 是否为空
        pub fn isEmpty(self: Self) bool {
            return self.top == 0;
        }
    };
}

pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 整数栈
    var int_stack = Stack(i32).init(allocator);
    defer int_stack.deinit();
    
    try int_stack.push(10);
    try int_stack.push(20);
    try int_stack.push(30);
    
    std.debug.print("Stack size: {}\n", .{int_stack.len()});
    std.debug.print("Top: {}\n", .{int_stack.peek().?});
    
    while (int_stack.pop()) |item| {
        std.debug.print("Popped: {}\n", .{item});
    }
    
    // 字符串栈
    var str_stack = Stack([]const u8).init(allocator);
    defer str_stack.deinit();
    
    try str_stack.push("hello");
    try str_stack.push("world");
    
    while (str_stack.pop()) |item| {
        std.debug.print("Popped: {s}\n", .{item});
    }
}
```

**要点**：
- 内存管理遵循 Zig 最佳实践（显式分配器传递）
- 错误处理使用 `try` 和 `!` 语法
- 使用 `?T` 表示可选值

# 泛型容器：队列

**完整实现**：

```zig
const std = @import("std");

// 泛型队列
fn Queue(comptime T: type) type {
    return struct {
        const Self = @This();
        
        items: []T,
        head: usize,
        tail: usize,
        count: usize,
        allocator: std.mem.Allocator,
        
        // 初始化
        pub fn init(allocator: std.mem.Allocator) Self {
            return .{
                .items = &[_]T{},
                .head = 0,
                .tail = 0,
                .count = 0,
                .allocator = allocator,
            };
        }
        
        // 清理
        pub fn deinit(self: *Self) void {
            if (self.items.len > 0) {
                self.allocator.free(self.items);
            }
        }
        
        // 入队
        pub fn enqueue(self: *Self, item: T) !void {
            if (self.count >= self.items.len) {
                const new_len = if (self.items.len == 0) 4 else self.items.len * 2;
                var new_items = try self.allocator.alloc(T, new_len);
                
                // 复制现有元素
                if (self.count > 0) {
                    for (0..self.count) |i| {
                        new_items[i] = self.items[(self.head + i) % self.items.len];
                    }
                }
                
                if (self.items.len > 0) {
                    self.allocator.free(self.items);
                }
                
                self.items = new_items;
                self.head = 0;
                self.tail = self.count;
            }
            
            self.items[self.tail] = item;
            self.tail = (self.tail + 1) % self.items.len;
            self.count += 1;
        }
        
        // 出队
        pub fn dequeue(self: *Self) ?T {
            if (self.count == 0) return null;
            
            const item = self.items[self.head];
            self.head = (self.head + 1) % self.items.len;
            self.count -= 1;
            
            return item;
        }
        
        // 查看队首
        pub fn peek(self: Self) ?T {
            if (self.count == 0) return null;
            return self.items[self.head];
        }
        
        // 获取大小
        pub fn len(self: Self) usize {
            return self.count;
        }
        
        // 是否为空
        pub fn isEmpty(self: Self) bool {
            return self.count == 0;
        }
    };
}

pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 整数队列
    var queue = Queue(i32).init(allocator);
    defer queue.deinit();
    
    try queue.enqueue(10);
    try queue.enqueue(20);
    try queue.enqueue(30);
    
    std.debug.print("Queue size: {}\n", .{queue.len()});
    std.debug.print("Front: {}\n", .{queue.peek().?});
    
    while (queue.dequeue()) |item| {
        std.debug.print("Dequeued: {}\n", .{item});
    }
}
```

## 编译期编程

# 类型反射

使用 `@typeInfo` 进行类型反射：

```zig
const std = @import("std");

// 打印类型信息
fn printTypeInfo(comptime T: type) void {
    const info = @typeInfo(T);
    
    switch (info) {
        .int => |int_info| {
            std.debug.print("Integer: bits={}, signed={}\n", .{
                int_info.bits,
                int_info.signedness == .signed,
            });
        },
        .float => |float_info| {
            std.debug.print("Float: bits={}\n", .{float_info.bits});
        },
        .bool => {
            std.debug.print("Boolean\n", .{});
        },
        .array => |array_info| {
            std.debug.print("Array: len={}, child={}\n", .{
                array_info.len,
                array_info.child,
            });
        },
        .pointer => |ptr_info| {
            std.debug.print("Pointer: size={}\n", .{ptr_info.size});
        },
        .struct => |struct_info| {
            std.debug.print("Struct: fields={}\n", .{struct_info.fields.len});
            inline for (struct_info.fields) |field| {
                std.debug.print("  field: {s}: {}\n", .{ field.name, field.type });
            }
        },
        else => {
            std.debug.print("Other type: {}\n", .{T});
        },
    }
}

pub fn main(_: std.process.Init.Minimal) void {
    printTypeInfo(i32);
    printTypeInfo(f64);
    printTypeInfo(bool);
    printTypeInfo([5]u8);
    
    const Person = struct {
        name: []const u8,
        age: u32,
    };
    printTypeInfo(Person);
}
```

**预期输出**：
```
Integer: bits=32, signed=true
Float: bits=64
Boolean
Array: len=5, child=u8
Struct: fields=2
  field: name: []const u8
  field: age: u32
```

# 编译期序列化

使用编译期信息实现序列化：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

// 编译期结构体序列化
fn serialize(comptime T: type, item: T, writer: anytype) !void {
    const info = @typeInfo(T);
    
    switch (info) {
        .struct => |struct_info| {
            try writer.print("{{", .{});
            inline for (struct_info.fields, 0..) |field, i| {
                if (i > 0) try writer.print(", ", .{});
                try writer.print("{s}=", .{field.name});
                
                const value = @field(item, field.name);
                switch (@typeInfo(field.type)) {
                    .int, .float => try writer.print("{}", .{value}),
                    .pointer => |ptr_info| {
                        if (ptr_info.size == .slice and ptr_info.child == u8) {
                            try writer.print("\"{s}\"", .{value});
                        } else {
                            try writer.print("{any}", .{value});
                        }
                    },
                    else => try writer.print("{any}", .{value}),
                }
            }
            try writer.print("}}", .{});
        },
        else => {
            try writer.print("{any}", .{item});
        },
    }
}

pub fn main(_: std.process.Init.Minimal) !void {
    const Person = struct {
        name: []const u8,
        age: u32,
        score: f64,
    };
    
    const person = Person{
        .name = "Alice",
        .age = 25,
        .score = 95.5,
    };
    
    try serialize(Person, person, std.Io.File.stdout().writer());
    std.debug.print("\n", .{});
}
```

**预期输出**：
```
{name="Alice", age=25, score=95.5}
```

# 条件性方法生成

使用 `usingnamespace` 实现条件性方法生成：

```zig
const std = @import("std");

// 根据类型特性生成不同方法
fn Number(comptime T: type) type {
    return struct {
        value: T,
        
        const Self = @This();
        
        pub fn init(value: T) Self {
            return .{ .value = value };
        }
        
        // 通用方法
        pub fn add(self: Self, other: T) T {
            return self.value + other;
        }
        
        // 根据类型特性生成不同方法
        pub usingnamespace switch (@typeInfo(T)) {
            .int => struct {
                pub fn double(self: Self) T {
                    return self.value * 2;
                }
                
                pub fn isPositive(self: Self) bool {
                    return self.value > 0;
                }
            },
            .float => struct {
                pub fn square(self: Self) T {
                    return self.value * self.value;
                }
                
                pub fn sqrt(self: Self) T {
                    return @sqrt(self.value);
                }
            },
            else => struct {},
        };
    };
}

pub fn main(_: std.process.Init.Minimal) void {
    // 整数类型
    const int_num = Number(i32).init(10);
    std.debug.print("add: {}, double: {}, isPositive: {}\n", .{
        int_num.add(5),
        int_num.double(),
        int_num.isPositive(),
    });
    
    // 浮点类型
    const float_num = Number(f64).init(3.14);
    std.debug.print("add: {}, square: {}, sqrt: {}\n", .{
        float_num.add(2.71),
        float_num.square(),
        float_num.sqrt(),
    });
}
```

**要点**：
- `usingnamespace` 实现条件性方法注入
- 根据类型特性生成不同的方法集
- 编译期决定，零运行时开销

## 泛型与错误处理

# 泛型函数中的错误处理

```zig
const std = @import("std");

// 安全除法（泛型版本）
fn safeDivide(comptime T: type, a: T, b: T) !T {
    if (b == 0) return error.DivisionByZero;
    
    const info = @typeInfo(T);
    switch (info) {
        .int => return @divTrunc(a, b),
        .float => return a / b,
        else => @compileError("safeDivide only supports numeric types"),
    }
}

pub fn main(_: std.process.Init.Minimal) !void {
    // 整数除法
    const result1 = safeDivide(i32, 10, 3) catch |err| {
        std.debug.print("Error: {}\n", .{err});
        return;
    };
    std.debug.print("10 / 3 = {}\n", .{result1});
    
    // 浮点除法
    const result2 = safeDivide(f64, 10.0, 3.0) catch |err| {
        std.debug.print("Error: {}\n", .{err});
        return;
    };
    std.debug.print("10.0 / 3.0 = {}\n", .{result2});
    
    // 除零错误
    const result3 = safeDivide(i32, 10, 0) catch |err| {
        std.debug.print("Error: {}\n", .{err});
        return;
    };
    _ = result3;
}
```

# 泛型数据结构中的错误处理

```zig
const std = @import("std");

// 泛型栈（带错误处理）
fn SafeStack(comptime T: type) type {
    return struct {
        const Self = @This();
        
        items: []T,
        top: usize,
        allocator: std.mem.Allocator,
        
        pub const Error = error{
            StackEmpty,
            OutOfMemory,
        };
        
        pub fn init(allocator: std.mem.Allocator) Self {
            return .{
                .items = &[_]T{},
                .top = 0,
                .allocator = allocator,
            };
        }
        
        pub fn deinit(self: *Self) void {
            if (self.items.len > 0) {
                self.allocator.free(self.items);
            }
        }
        
        pub fn push(self: *Self, item: T) Error!void {
            if (self.top >= self.items.len) {
                const new_len = if (self.items.len == 0) 4 else self.items.len * 2;
                const new_items = self.allocator.alloc(T, new_len) catch {
                    return error.OutOfMemory;
                };
                @memcpy(new_items[0..self.top], self.items[0..self.top]);
                if (self.items.len > 0) {
                    self.allocator.free(self.items);
                }
                self.items = new_items;
            }
            self.items[self.top] = item;
            self.top += 1;
        }
        
        pub fn pop(self: *Self) Error!T {
            if (self.top == 0) return error.StackEmpty;
            self.top -= 1;
            return self.items[self.top];
        }
    };
}

pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var stack = SafeStack(i32).init(allocator);
    defer stack.deinit();
    
    try stack.push(10);
    try stack.push(20);
    
    const item = try stack.pop();
    std.debug.print("Popped: {}\n", .{item});
}
```

## 泛型与内存管理

# 分配器传递模式

**最佳实践**：显式传递分配器

```zig
const std = @import("std");

// 泛型动态数组
fn ArrayList(comptime T: type) type {
    return struct {
        const Self = @This();
        
        items: []T,
        len: usize,
        allocator: std.mem.Allocator,
        
        // ✅ 正确：显式传递分配器
        pub fn init(allocator: std.mem.Allocator) Self {
            return .{
                .items = &[_]T{},
                .len = 0,
                .allocator = allocator,
            };
        }
        
        pub fn deinit(self: *Self) void {
            if (self.items.len > 0) {
                self.allocator.free(self.items);
            }
        }
        
        pub fn append(self: *Self, item: T) !void {
            if (self.len >= self.items.len) {
                const new_len = if (self.items.len == 0) 4 else self.items.len * 2;
                const new_items = try self.allocator.alloc(T, new_len);
                @memcpy(new_items[0..self.len], self.items[0..self.len]);
                if (self.items.len > 0) {
                    self.allocator.free(self.items);
                }
                self.items = new_items;
            }
            self.items[self.len] = item;
            self.len += 1;
        }
        
        pub fn get(self: Self, index: usize) ?T {
            if (index >= self.len) return null;
            return self.items[index];
        }
    };
}

pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var list = ArrayList(i32).init(allocator);
    defer list.deinit();
    
    try list.append(10);
    try list.append(20);
    try list.append(30);
    
    for (0..list.len) |i| {
        std.debug.print("list[{}] = {}\n", .{ i, list.get(i).? });
    }
}
```

**要点**：
- 分配器作为参数传递，不使用全局状态
- 易于测试（可以使用测试分配器）
- 内存管理清晰明确

## 泛型与测试

# 泛型测试

```zig
const std = @import("std");
const testing = std.testing;

// 泛型函数
fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

// 泛型数据结构
fn Stack(comptime T: type) type {
    return struct {
        items: []T,
        top: usize,
        allocator: std.mem.Allocator,
        
        pub fn init(allocator: std.mem.Allocator) @This() {
            return .{
                .items = &[_]T{},
                .top = 0,
                .allocator = allocator,
            };
        }
        
        pub fn deinit(self: *@This()) void {
            if (self.items.len > 0) {
                self.allocator.free(self.items);
            }
        }
        
        pub fn push(self: *@This(), item: T) !void {
            if (self.top >= self.items.len) {
                const new_len = if (self.items.len == 0) 4 else self.items.len * 2;
                const new_items = try self.allocator.alloc(T, new_len);
                @memcpy(new_items[0..self.top], self.items[0..self.top]);
                if (self.items.len > 0) {
                    self.allocator.free(self.items);
                }
                self.items = new_items;
            }
            self.items[self.top] = item;
            self.top += 1;
        }
        
        pub fn pop(self: *@This()) ?T {
            if (self.top == 0) return null;
            self.top -= 1;
            return self.items[self.top];
        }
    };
}

// 测试泛型函数
test "max function" {
    // 整数
    try testing.expectEqual(@as(i32, 20), max(i32, 10, 20));
    try testing.expectEqual(@as(i32, 10), max(i32, 10, -20));
    
    // 浮点数
    try testing.expectEqual(@as(f64, 3.14), max(f64, 3.14, 2.71));
    
    // 无符号整数
    try testing.expectEqual(@as(u8, 200), max(u8, 100, 200));
}

// 测试泛型数据结构
test "Stack operations" {
    var stack = Stack(i32).init(testing.allocator);
    defer stack.deinit();
    
    try stack.push(10);
    try stack.push(20);
    try stack.push(30);
    
    try testing.expectEqual(@as(i32, 30), stack.pop().?);
    try testing.expectEqual(@as(i32, 20), stack.pop().?);
    try testing.expectEqual(@as(i32, 10), stack.pop().?);
    try testing.expect(stack.pop() == null);
}

// 编译期测试
test "Type validation" {
    comptime {
        // 编译期验证
        const info = @typeInfo(i32);
        try testing.expect(info == .int);
        
        const info2 = @typeInfo(f64);
        try testing.expect(info2 == .float);
    }
}
```

## 实践练习

# 练习1：基础练习（难度：简单）

**练习目标**：掌握泛型函数的基本使用

**练习1.1：实现泛型交换函数**

```zig
// TODO: 实现泛型交换函数
fn swap(comptime T: type, a: *T, b: *T) void {
    // 提示：使用临时变量
}

// 测试
test "swap" {
    var x: i32 = 10;
    var y: i32 = 20;
    swap(i32, &x, &y);
    try std.testing.expectEqual(@as(i32, 20), x);
    try std.testing.expectEqual(@as(i32, 10), y);
}
```

**练习1.2：实现泛型数组查找**

```zig
// TODO: 实现泛型数组查找
fn indexOf(comptime T: type, items: []const T, target: T) ?usize {
    // 提示：遍历数组，比较元素
}

// 测试
test "indexOf" {
    const items = [_]i32{ 10, 20, 30, 40, 50 };
    try std.testing.expectEqual(@as(usize, 2), indexOf(i32, &items, 30).?);
    try std.testing.expect(indexOf(i32, &items, 60) == null);
}
```

**练习1.3：实现泛型数组反转**

```zig
// TODO: 实现泛型数组反转
fn reverse(comptime T: type, items: []T) void {
    // 提示：使用双指针
}

// 测试
test "reverse" {
    var items = [_]i32{ 1, 2, 3, 4, 5 };
    reverse(i32, &items);
    try std.testing.expectEqualSlices(i32, &[_]i32{ 5, 4, 3, 2, 1 }, &items);
}
```

# 练习2：进阶练习（难度：中等）

**练习目标**：掌握泛型数据结构的设计

**练习2.1：实现泛型链表**

```zig
// TODO: 实现泛型链表
fn LinkedList(comptime T: type) type {
    return struct {
        // 提示：定义节点结构体
        // 提示：实现 init, deinit, append, prepend, remove, iterator
    };
}
```

**练习2.2：实现泛型二叉树**

```zig
// TODO: 实现泛型二叉树
fn BinaryTree(comptime T: type) type {
    return struct {
        // 提示：定义节点结构体
        // 提示：实现 insert, search, traverse
    };
}
```

# 练习3：高级练习（难度：困难）

**练习目标**：掌握编译期编程技术

**练习3.1：实现编译期类型验证器**

```zig
// TODO: 实现编译期类型验证器
fn validateType(comptime T: type) void {
    // 验证类型是否满足特定要求
    // 例如：是否是数值类型、是否有特定方法等
}
```

**练习3.2：实现编译期结构体构建器**

```zig
// TODO: 实现编译期结构体构建器
fn StructBuilder(comptime T: type) type {
    // 生成一个构建器类型，提供流式 API
    // 例如：Person.builder().name("Alice").age(30).build()
}
```

## 泛型编程最佳实践

# 1. 显式优于隐式

```zig
// ✅ 好的做法：显式指定类型参数
// ❌ 错误示例
const result = max(i32, 10, 20);

// ❌ 不好的做法：依赖类型推断（可能导致意外行为）
// const result = max(10, 20);  // 编译错误
```

# 2. 使用类型约束

```zig
// ✅ 好的做法：使用类型约束提供清晰错误信息
// 💡 最佳实践
fn Numeric(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .int, .float => T,
        else => @compileError("Numeric type required"),
    };
}

fn abs(comptime T: type, x: Numeric(T)) Numeric(T) {
    return if (x < 0) -x else x;
}
```

# 3. 遵循分配器传递模式

```zig
// ✅ 好的做法：显式传递分配器
// ❌ 错误示例
fn processData(allocator: std.mem.Allocator, data: []const u8) !void {
    var list = std.ArrayList(u8).init(allocator);
    defer list.deinit();
    // ...
}

// ❌ 不好的做法：使用全局分配器
fn processDataBad(data: []const u8) !void {
    var list = std.ArrayList(u8).init(std.heap.page_allocator);
    defer list.deinit();
    // ...
}
```

# 4. 编写测试

```zig
// ✅ 好的做法：为泛型代码编写测试
// 💡 最佳实践
test "max function" {
    try std.testing.expectEqual(@as(i32, 20), max(i32, 10, 20));
    try std.testing.expectEqual(@as(f64, 3.14), max(f64, 3.14, 2.71));
}
```

# 5. 文档注释

```zig
/// 返回两个值中的最大值
/// 参数：
///   T: 类型参数（必须支持 > 操作符）
///   a: 第一个值
///   b: 第二个值
/// 返回：较大的值
fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}
```

## 小结

本章介绍了 Zig 的泛型编程，包括：

1. **泛型基础概念**：
   - 什么是泛型
   - `comptime` 关键字
   - 编译期实例化

2. **泛型函数**：
   - 基本语法
   - 类型推断
   - 多类型参数
   - 类型约束

3. **泛型数据结构**：
   - 泛型结构体
   - 泛型容器（栈、队列）
   - 内存管理

4. **编译期编程**：
   - 类型反射
   - 编译期序列化
   - 条件性方法生成

5. **最佳实践**：
   - 显式优于隐式
   - 使用类型约束
   - 分配器传递模式
   - 编写测试
   - 文档注释

**关键要点**：
- Zig 的泛型基于编译期计算，零运行时开销
- `comptime` 是泛型的核心，必须显式标注
- 类型约束使用 `@typeInfo` 和 `@compileError`
- 内存管理遵循显式分配器传递模式
- 泛型代码需要充分测试

**下一步学习**：
- 第十章：内存管理模型 - 深入理解内存管理
- 第十一章：指针与引用类型 - 掌握指针操作
- 第十二章：并发编程模型 - 学习并发编程

---

> 💡 **章节过渡**：从泛型编程到接口与多态
> 
> 在[泛型编程](chapter-generics.md)中，我们学习了泛型编程，掌握了如何使用 `comptime` 实现类型参数化的代码复用。
> 现在，我们将学习接口与多态，了解如何设计灵活、可扩展的系统架构。
> 
> **为什么泛型编程是接口与多态的基础？**
> 
> 1. **Trait模式**：接口使用泛型实现编译期多态
> 2. **代码复用**：泛型提供了类型安全的代码复用机制
> 3. **零成本抽象**：编译期接口没有虚函数表的开销
> 
> **学习建议**：
> - 理解泛型的类型参数化机制
> - 掌握编译期类型检查的概念
> - 准备学习如何设计灵活的接口
