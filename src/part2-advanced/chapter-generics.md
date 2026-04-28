# 泛型编程

泛型本质上是 `comptime` 能力的延伸：把类型作为编译期值传入函数或结构体，编译器为每个具体类型生成一份特化实现。没有独立的 template/trait 语法——类型即值，约束靠编译期检查显式表达。

## 泛型函数

```zig
const std = @import("std");

fn add(comptime T: type, a: T, b: T) T {
    return a + b;
}

test "add" {
    try std.testing.expectEqual(@as(i32, 7), add(i32, 3, 4));
    try std.testing.expectEqual(@as(f64, 5.5), add(f64, 2.0, 3.5));
}
```

`T` 是编译期已知的类型参数，每个调用点生成一份特化函数。

`anytype` 可以省略显式类型参数，适合"接受任意值并原样返回同一类型"的简短函数：

```zig
fn double(value: anytype) @TypeOf(value) {
    return value * 2;
}
```

需要类型反射、类型约束或返回该类型的指针时，使用 `comptime T: type`。更多对比见[编译期计算](chapter-comptime.md)中的 `comptime T: type` vs `anytype` 小节。

## 多个类型参数

```zig
const std = @import("std");

fn Pair(comptime K: type, comptime V: type) type {
    return struct {
        key: K,
        value: V,
    };
}

fn makePair(comptime K: type, comptime V: type, key: K, value: V) Pair(K, V) {
    return .{ .key = key, .value = value };
}

test "pair with two type parameters" {
    const p1 = makePair([]const u8, u32, "port", 8080);
    try std.testing.expectEqualStrings("port", p1.key);
    try std.testing.expectEqual(@as(u32, 8080), p1.value);

    const p2 = makePair(u8, bool, 1, true);
    try std.testing.expectEqual(@as(u8, 1), p2.key);
    try std.testing.expectEqual(true, p2.value);
}
```

- `Pair(K, V)` 是类型工厂——返回一个具体类型
- `makePair(...)` 是值构造函数——返回该类型的实例

## 泛型结构体

泛型结构体的本质是返回 `type` 的函数：

```zig
const std = @import("std");

fn Point(comptime T: type) type {
    return struct {
        x: T,
        y: T,

        const Self = @This();

        pub fn init(x: T, y: T) Self {
            return .{ .x = x, .y = y };
        }

        pub fn add(self: Self, other: Self) Self {
            return .{
                .x = self.x + other.x,
                .y = self.y + other.y,
            };
        }
    };
}

test "generic Point type" {
    const P2i = Point(i32);
    const a = P2i.init(1, 2);
    const b = P2i.init(3, 4);
    const c = a.add(b);

    try std.testing.expectEqual(@as(i32, 4), c.x);
    try std.testing.expectEqual(@as(i32, 6), c.y);
}
```

`Point` 本身是类型工厂，`Point(i32)` 得到一个具体结构体类型。`@This()` 让方法内引用"当前这个具体结构体类型"更方便。

## 非类型编译期参数

`comptime` 参数不限于类型，也可以是编译期已知的数值：

```zig
const std = @import("std");

fn FixedBuffer(comptime N: usize) type {
    return struct {
        data: [N]u8 = .{0} ** N,
        len: usize = 0,

        const Self = @This();

        pub fn append(self: *Self, byte: u8) error{BufferFull}!void {
            if (self.len >= N) return error.BufferFull;
            self.data[self.len] = byte;
            self.len += 1;
        }

        pub fn slice(self: *const Self) []const u8 {
            return self.data[0..self.len];
        }
    };
}

test "FixedBuffer with comptime size" {
    var buf = FixedBuffer(8){};
    try buf.append('Z');
    try buf.append('i');
    try buf.append('g');
    try std.testing.expectEqualStrings("Zig", buf.slice());
}
```

`FixedBuffer(8)` 和 `FixedBuffer(16)` 是**不同的类型**——数组大小烙进类型，实例化发生在编译期。

也可以同时接收类型参数和数值参数：

```zig
fn BoundedArray(comptime T: type, comptime capacity: usize) type {
    return struct {
        data: [capacity]T = undefined,
        len: usize = 0,

        const Self = @This();

        pub fn append(self: *Self, value: T) error{AtCapacity}!void {
            if (self.len >= capacity) return error.AtCapacity;
            self.data[self.len] = value;
            self.len += 1;
        }

        pub fn items(self: *const Self) []const T {
            return self.data[0..self.len];
        }
    };
}
```

> 标准库中的 `std.BoundedArray` 是这种模式的工程级实现。

## 泛型约束：`@typeInfo` + `@compileError`

泛型不等于对任意类型都成立——接受哪种类型、不接受哪种类型，需要自己表达。

```zig
const std = @import("std");

fn abs(comptime T: type, value: T) T {
    return switch (@typeInfo(T)) {
        .int => |info| if (info.signedness == .unsigned) value else if (value < 0) -value else value,
        .float => if (value < 0) -value else value,
        else => @compileError("abs 只接受整数或浮点类型，实际得到 " ++ @typeName(T)),
    };
}

test "abs for numeric types" {
    try std.testing.expectEqual(@as(i32, 5), abs(i32, 5));
    try std.testing.expectEqual(@as(i32, 3), abs(i32, -3));
    try std.testing.expectEqual(@as(f64, 1.5), abs(f64, -1.5));
}
```

> 有符号整数的最小值取反可能溢出（如 `@as(i8, -128)`），这个例子用于演示类型约束而非完整的边界处理。

约束也可以抽成独立的类型校验函数：

```zig
fn Numeric(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .int, .float, .comptime_int, .comptime_float => T,
        else => @compileError("需要数值类型，实际得到 " ++ @typeName(T)),
    };
}

fn square(comptime T: type, value: Numeric(T)) T {
    return value * value;
}
```

`Numeric(T)` 把"适用范围"前置到类型层面，调用方在传参时就受到约束，错误信息也更明确。

## 泛型与错误联合

泛型和错误处理是正交的，可以自由组合：

```zig
fn firstOrError(comptime T: type, items: []const T) !T {
    if (items.len == 0) return error.EmptySlice;
    return items[0];
}

test "generic error union" {
    const ints = [_]i32{ 10, 20, 30 };
    try std.testing.expectEqual(@as(i32, 10), try firstOrError(i32, &ints));

    const empty: []const f64 = &.{};
    try std.testing.expectError(error.EmptySlice, firstOrError(f64, empty));
}
```

`!T` 的含义不受类型参数影响——`try`、`catch`、`errdefer` 照常使用，调用方不需要关心泛型细节。

## 泛型容器

泛型在实际工程中最常见的用途是做类型安全的容器。下面是一个最小栈实现：

```zig
fn Stack(comptime T: type) type {
    return struct {
        const Self = @This();
        items: std.ArrayList(T),

        pub fn init() Self {
            return .{ .items = .empty };
        }

        pub fn deinit(self: *Self, allocator: std.mem.Allocator) void {
            self.items.deinit(allocator);
        }

        pub fn push(self: *Self, allocator: std.mem.Allocator, value: T) !void {
            try self.items.append(allocator, value);
        }

        pub fn pop(self: *Self) ?T {
            return self.items.pop();
        }
    };
}

test "generic stack" {
    var list = Stack(i32).init();
    defer list.deinit(std.testing.allocator);

    try list.push(std.testing.allocator, 10);
    try list.push(std.testing.allocator, 20);

    try std.testing.expectEqual(@as(i32, 20), list.pop().?);
    try std.testing.expectEqual(@as(i32, 10), list.pop().?);
    try std.testing.expect(list.pop() == null);
}
```

注意泛型不会隐藏资源决策——allocator 仍需在方法中显式传入。

## 测试泛型代码

泛型代码需用多种类型分别测试。不同类型可能触发不同的编译期分支，每个分支至少覆盖一种类型。为每种目标写独立 `test` 块，失败时定位更快。

## 注意事项

- **泛型不等于万能适配器**——边界和约束需要显式表达，不适合的类型应在编译期报错
- **`anytype` 不是 `comptime T: type` 的替代**——需要类型反射、显式约束或返回类型时，使用 `comptime T: type`
- **约束服务于可读性**——不要为小事引入复杂的类型校验层

> **相关阅读**：[编译期计算](chapter-comptime.md)、[指针与内存](chapter-pointers.md)
