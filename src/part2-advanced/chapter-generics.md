# 泛型编程

> **进阶**：本章讨论 Zig 中泛型的**设计模式**。关于 `comptime` 的底层机制，参见[编译期计算与元编程](chapter-comptime.md)。

## 先建立正确心智模型

更贴近 Zig 的理解方式：

1. **类型本身可以作为编译期值传递**
2. **泛型函数本质上就是接收编译期类型参数的函数**
3. **泛型结构体本质上就是返回 `type` 的类型工厂**
4. **实例化发生在编译期，而不是运行时**
5. **约束通常不是写在一套独立"trait 语法"里，而是通过编译期检查显式表达**

所以，泛型本质上是 `comptime` 能力的延伸：把类型作为编译期参数传入，生成针对该类型的专门实现。

## 与 C++/Rust 泛型的差异

C++ 用 `template<typename T>`，Rust 用 `T: Trait` 约束。Zig 把类型参数显式写成编译期值：

```zig
fn add(comptime T: type, a: T, b: T) T {
    return a + b;
}
```

核心差异：Zig 不引入独立的模板/trait 语法——类型也是值，约束靠 `comptime` 检查显式表达。

## 为什么需要泛型？

没有泛型时，同一种逻辑需要为每种类型重复维护。泛型的价值在于复用实现、保持类型安全、把错误提前到编译期、不引入额外运行时分发成本。

## 最基本的泛型函数

```zig
const std = @import("std");

fn identity(comptime T: type, value: T) T {
    return value;
}

test "identity" {
    try std.testing.expectEqual(@as(i32, 42), identity(i32, 42));
    try std.testing.expectEqual(@as(f64, 3.14), identity(f64, 3.14));
}
```

要点：`T` 是编译期已知的类型参数，实例化发生在编译期。

## `anytype` 与显式类型参数

`anytype` 让参数类型由调用点决定，适合写短小、意图明确的通用函数：

```zig
fn printTwice(value: anytype) void {
    std.debug.print("{} {}\n", .{ value, value });
}
```

需要把类型入口写清楚、返回值与参数复用同一类型、或为类型写约束时，使用显式 `comptime T: type`。

---

有些语言的泛型喜欢尽量自动推断一切。
Zig 在这件事上的风格更保守，也更显式。

对于下面这种形式：

```zig
const std = @import("std");

fn double(comptime T: type, value: T) T {
    return value * 2;
}

test "double with explicit type argument" {
    try std.testing.expectEqual(@as(i32, 20), double(i32, 10));
    try std.testing.expectEqual(@as(f64, 6.0), double(f64, 3.0));
}
```

这里的重点不是"能不能省掉 `T`"，而是：

- **是否希望读者清楚地看到这个泛型的类型入口**
- **这个函数是否真的适合所有支持 `* 2` 的类型**
- **当约束不明显时，是否应该显式说明**

对 Zig 初学者来说，更好的习惯通常是：

> **优先把类型参数写清楚，而不是过早追求省略。**

## 多个类型参数：泛型不只是一种类型的复用

泛型不仅可以接收一个类型，也可以接收多个类型。

```zig
const std = @import("std");

fn Pair(comptime K: type, comptime V: type) type {
    return struct {
        key: K,
        value: V,
    };
}

fn makePair(comptime K: type, comptime V: type, key: K, value: V) Pair(K, V) {
    return .{
        .key = key,
        .value = value,
    };
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

这个例子里有两个值得记住的点：

1. `Pair(K, V)` 返回的是一个具体类型
2. `makePair(...)` 返回的是这个具体类型的实例

换句话说：

- `Pair` 是**类型工厂**
- `makePair` 是**值构造函数**

## 泛型结构体：把"返回类型"当成一种正常设计

这通常是 Zig 泛型里最需要尽快建立直觉的部分。

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

这段代码的核心认知：

> `Point(i32)` 不是"对象"，而是"类型"。

也就是说：

- `Point` 本身是一个接收类型参数的工厂
- `Point(i32)` 得到一个具体结构体类型
- 然后再在这个类型上调用 `init`

如果这个心智模型没建立好，后面读容器、接口工厂、类型驱动设计时会一直别扭。

## 泛型结构里常见的 `Self = @This()` 是什么？

在很多 Zig 泛型示例里会看到这一句：

```zig
const Self = @This();
```

它的作用很简单：

- 在结构体内部为"当前这个具体结构体类型"起一个名字
- 让方法签名更清晰
- 在泛型结构体里尤其方便，因为最终结构体类型是实例化后才具体确定的

例如：

```zig
const std = @import("std");

fn Counter(comptime T: type) type {
    return struct {
        value: T,

        const Self = @This();

        pub fn init(value: T) Self {
            return .{ .value = value };
        }

        pub fn inc(self: *Self, delta: T) void {
            self.value += delta;
        }
    };
}

test "Self in generic struct" {
    var c = Counter(i32).init(10);
    c.inc(5);
    try std.testing.expectEqual(@as(i32, 15), c.value);
}
```

这里的 `Self` 不是额外魔法，
它只是让方法里引用"当前结构体类型"更方便。

## 非类型编译期参数

`comptime` 参数不仅可以是类型，也可以是编译期已知的数值。这是泛型另一个常用模式——用编译期常量控制数据结构的大小或行为。

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
    try std.testing.expectEqual(@as(usize, 3), buf.len);
}
```

注意 `FixedBuffer(8)` 和 `FixedBuffer(16)` 是**不同的类型**——数组大小被烙进了类型本身。这和类型参数一样，实例化发生在编译期。

也可以同时接收类型参数和数值参数：

```zig
const std = @import("std");

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

test "BoundedArray with type and size" {
    var arr = BoundedArray(i32, 4){};
    try arr.append(10);
    try arr.append(20);
    try std.testing.expectEqual(@as(usize, 2), arr.len);
    try std.testing.expectEqual(@as(i32, 10), arr.items()[0]);
}
```

> **注意**：标准库中的 `std.BoundedArray` 就是这种模式的工程级实现，可以参考其源码学习更多细节。

## 泛型不是"对所有类型都成立"

这是本章最重要的边界意识之一。

很多初学者看到泛型后，容易自然地产生一种误解：

> "既然写成泛型了，那应该适用于几乎所有类型吧？"

并不是。

泛型只是"类型参数化"，不代表"自动具备合理约束"。

看这个例子：

```zig
const std = @import("std");

fn abs(comptime T: type, value: T) T {
    return switch (@typeInfo(T)) {
        .int => |info| blk: {
            if (info.signedness == .unsigned) break :blk value;
            if (value < 0) break :blk -value;
            break :blk value;
        },
        .float => if (value < 0) -value else value,
        else => @compileError("abs 只接受整数或浮点类型，实际得到 " ++ @typeName(T)),
    };
}

test "abs works for supported numeric types" {
    try std.testing.expectEqual(@as(i32, 5), abs(i32, 5));
    try std.testing.expectEqual(@as(i32, 3), abs(i32, -3));
    try std.testing.expectEqual(@as(f64, 1.5), abs(f64, -1.5));
}
```

这个例子在教学上很有价值，因为它说明了三件事：

1. 可以在编译期检查类型信息
2. 泛型的"适用范围"需要自己定义
3. 如果类型不合适，应该尽早在编译期报错

> **注意**：对于有符号整数，最小值的绝对值可能无法表示。例如 `@as(i8, -128)` 取反会溢出。这个例子适合理解"类型约束"和"编译期分支"，但不应该误读成一个没有边界条件的完美通用 `abs`。

这正是 Zig 泛型常见的真实情况：

- 泛型可以很强大
- 但约束和边界要自己说清楚
- 说不清楚，就容易把示例写成"看起来很通用，实际上有前提"

## 用 `@typeInfo` 做约束：价值在"表达边界"，不在"炫技"

`@typeInfo` 很强，但也是最容易被滥用的部分之一。

对于初学者，更重要的不是记住所有分支名称，而是理解它解决的问题：

- 这个泛型到底接受什么类型？
- 这些类型为什么可以共用同一份实现？
- 如果不满足条件，应该什么时候失败？

看一个更小的例子：

```zig
const std = @import("std");

fn Numeric(comptime T: type) type {
    return switch (@typeInfo(T)) {
        .int, .float, .comptime_int, .comptime_float => T,
        else => @compileError("需要数值类型，实际得到 " ++ @typeName(T)),
    };
}

fn square(comptime T: type, value: Numeric(T)) T {
    return value * value;
}

test "Numeric constraint example" {
    try std.testing.expectEqual(@as(i32, 25), square(i32, 5));
    try std.testing.expectEqual(@as(f64, 6.25), square(f64, 2.5));
}
```

这类写法的价值在于：

- 让"适用范围"更明确
- 让错误信息更靠近问题本身
- 让调用者知道这是有边界的抽象

但也要注意：

- 如果只是为了做一个简单的演示，不一定非要引入 `Numeric(...)`
- 不要把每个泛型都包装得层层嵌套
- 约束应该服务于可读性，而不是制造神秘感

## 泛型容器：类型安全的工厂模式

泛型在实际工程里最常见的用途之一，就是做类型安全容器。

下面是一个最小栈实现：

```zig
const std = @import("std");

fn Stack(comptime T: type) type {
    return struct {
        const Self = @This();

        items: std.ArrayList(T),

        pub fn init() Self {
            return .{
                .items = .empty,
            };
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

        pub fn len(self: Self) usize {
            return self.items.items.len;
        }
    };
}

test "generic stack of i32" {
    var list = Stack(i32).init();
    defer list.deinit(std.testing.allocator);

    try list.push(std.testing.allocator, 10);
    try list.push(std.testing.allocator, 20);

    try std.testing.expectEqual(@as(usize, 2), list.len());
    try std.testing.expectEqual(@as(i32, 20), list.pop().?);
    try std.testing.expectEqual(@as(i32, 10), list.pop().?);
    try std.testing.expect(list.pop() == null);
}
```

这个例子有几个很重要的现实意义：

**1. 泛型类型本身并不神秘。** `Stack(i32)` 就是一个具体类型。

**2. 类型安全是自然得到的。** 如果实例化的是 `Stack(i32)`，那压进去的就必须是 `i32`。

**3. 分配器责任仍然要显式。** 泛型不会自动隐藏资源边界。这里仍然要显式传入 allocator。

这点非常符合 Zig 的整体风格：

> **泛型帮助复用逻辑，但不会偷偷做资源决策。**

## 泛型与错误联合

泛型函数可以返回错误联合 `!T`，类型参数同时参与正常返回路径和错误路径。这在实际代码中非常常见——容器操作、解析函数、IO 包装等几乎都会涉及。

```zig
const std = @import("std");

fn firstOrError(comptime T: type, items: []const T) !T {
    if (items.len == 0) return error.EmptySlice;
    return items[0];
}

test "generic error union return" {
    const ints = [_]i32{ 10, 20, 30 };
    const first_int = try firstOrError(i32, &ints);
    try std.testing.expectEqual(@as(i32, 10), first_int);

    const bytes = [_]u8{ 'a', 'b' };
    const first_byte = try firstOrError(u8, &bytes);
    try std.testing.expectEqual(@as(u8, 'a'), first_byte);

    const empty: []const f64 = &.{};
    try std.testing.expectError(error.EmptySlice, firstOrError(f64, empty));
}
```

这里 `!T` 的含义是"要么返回一个 `T` 类型的值，要么返回一个错误"。类型参数 `T` 完全不影响错误联合的语义——`try`、`catch`、`errdefer` 照常使用。

这个模式的要点：

- 泛型和错误处理是正交的，可以自由组合
- 返回 `!T` 时，Zig 会自动推断具体的错误集
- 调用方用 `try` 或 `catch` 处理即可，不需要关心泛型细节

## 测试泛型代码

泛型代码需用多种类型分别测试，因为不同类型可能触发不同的编译期分支。为每种目标类型写独立 `test` 块，失败时定位更快。如果泛型函数使用了 `@typeInfo` 做分支，每个分支至少覆盖一类。

## 小结

泛型设计的核心原则：

1. **泛型是 `comptime` 能力的延伸。** 类型参数是编译期值，实例化发生在编译期。
2. **泛型不等于万能。** 边界和约束需要显式表达。
3. **好的泛型抽象让代码更清楚，而不是更神秘。**
4. **选择正确的抽象粒度。** 如果只支持一两种类型，直接写两份可能更清晰。

**常见陷阱：**

- **把泛型当成"自动适配一切类型"**——泛型只是参数化，不是万能适配器
- **过早沉迷 `@typeInfo`**——先把简单泛型写清楚，不是每个通用函数都需要完整类型反射
- **用 `anytype` 逃避设计**——需要明确约束、返回类型或边界时，应该写出 `comptime T: type`
- **泛型容器里隐藏 allocator**——资源从哪里来、什么时候释放，最好显式表达
- **只追求"更通用"而忽略"更清晰"**——一个真正好的泛型抽象，应该更容易被解释和验证

---

> **相关阅读**：[指针、切片与对齐](chapter-pointers.md)