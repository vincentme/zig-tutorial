# 泛型编程

> **进阶**：本章讨论 Zig 中泛型的**设计模式**——何时使用泛型、如何设计类型参数、怎样表达约束。
> 关于 `comptime` 的底层机制（语法、内建函数、能力边界），参见[编译期计算与元编程](chapter-comptime.md)。
>
> **进阶**：
> - 阅读时抓住心智模型，不必急着记所有技巧
> - 重点理解"类型也是编译期值""泛型是类型工厂""约束要尽量写清楚"
> - 遇到复杂的 `@typeInfo` 示例时，优先看懂它在解决什么问题，而不是逐字背代码
>
> **相关阅读**：
> - 建议先读完[编译期计算与元编程](chapter-comptime.md)中的 `comptime` 心智模型，再看本章会更顺
> - 如果读到后半章开始频繁思考"这些抽象最后怎样落到真实数据访问上"，可以接着读[指针、切片与对齐](chapter-pointers.md)

---

## 先建立正确心智模型

很多语言把泛型讲成"一个模板，可以套很多类型"。
这个说法不算错，但在 Zig 里，如果只停留在这个层面，很快就会遇到困惑。

更贴近 Zig 的理解方式是：

1. **类型本身可以作为编译期值传递**
2. **泛型函数本质上就是接收编译期类型参数的函数**
3. **泛型结构体本质上就是返回 `type` 的类型工厂**
4. **实例化发生在编译期，而不是运行时**
5. **约束通常不是写在一套独立"trait 语法"里，而是通过编译期检查显式表达**

所以，本章真正要掌握的不是"怎么把函数写得更通用"，而是：

> **Zig 如何把"类型参数化"这件事，统一到 `comptime` 语义下，以及如何围绕这个能力做出清晰的设计。**

---

## 为什么需要泛型？

如果没有泛型，很容易写出大量重复代码：

```zig
const std = @import("std");

fn addI32(a: i32, b: i32) i32 {
    return a + b;
}

fn addF64(a: f64, b: f64) f64 {
    return a + b;
}

fn addU8(a: u8, b: u8) u8 {
    return a + b;
}

test "duplicated add functions" {
    try std.testing.expect(addI32(3, 5) == 8);
    try std.testing.expect(addF64(1.5, 0.5) == 2.0);
    try std.testing.expect(addU8(1, 9) == 10);
}
```

这样写的问题很直接：

- 同一种逻辑要重复维护
- 新增类型时要继续复制
- 如果逻辑稍微复杂一点，重复成本会迅速变高

泛型的价值就在于：

- **复用实现**
- **保持类型安全**
- **把错误尽量提前到编译期**
- **不引入额外运行时分发成本**

---

## 最基本的泛型函数

这是最典型的 Zig 泛型形式：

```zig
const std = @import("std");

fn identity(comptime T: type, value: T) T {
    return value;
}

test "identity keeps type and value" {
    try std.testing.expectEqual(@as(i32, 42), identity(i32, 42));
    try std.testing.expectEqual(@as(f64, 3.14), identity(f64, 3.14));
}
```

要点只有两个：

1. `T` 是一个编译期已知的类型参数
2. `value` 的类型由这个参数决定

可以这样理解：

> "在编译期把类型传进来，然后得到一份针对该类型专门成立的实现。"

关于编译期实例化的机制细节，参见[编译期计算与元编程](chapter-comptime.md)。

---

## `anytype` 与显式类型参数

初学者容易把 `anytype` 和 `comptime T: type` 混为一谈。两者确实都在编译期解析类型，但设计意图不同。

`anytype` 让参数的具体类型由调用点决定，函数体会基于实际类型进行编译期检查：

```zig
const std = @import("std");

fn printTwice(value: anytype) void {
    std.debug.print("{} {}\n", .{ value, value });
}

test "anytype example compiles" {
    printTwice(@as(i32, 42));
    printTwice(true);
}
```

### 可以把 `anytype` 看成什么？
- 一种方便的编译期参数推导方式
- 适合写很短、局部、意图明确的通用函数

### 什么时候更适合显式写 `comptime T: type`？
- 希望把"类型入口"写清楚
- 要在返回值或多个参数之间复用同一类型参数
- 要为类型写约束
- 要返回 `type`
- 想让读者更明确地看到这是一个真正的类型驱动抽象

一个简单判断方式是：

> 如果已经开始关心"这个函数到底支持哪些类型、返回什么类型、边界在哪"，通常就该考虑显式写出 `comptime T: type` 了。

---

## Zig 泛型和其他语言有什么不同？

有了上面两个基本形式，现在可以和其他语言做一个快速对比。

### 和 C++ 模板相比

C++ 模板：

```zig
// /dev/null/cpp-template.txt#L1-4
template<typename T>
T add(T a, T b) {
    return a + b;
}
```

Zig 泛型：

```zig
const std = @import("std");

fn add(comptime T: type, a: T, b: T) T {
    return a + b;
}

test "zig generic add" {
    try std.testing.expectEqual(@as(i32, 8), add(i32, 3, 5));
    try std.testing.expectEqual(@as(f64, 4.0), add(f64, 1.5, 2.5));
}
```

差别在于：

- Zig 把"类型参数是编译期参数"写得更显式
- Zig 不额外引入一套模板语言
- Zig 更强调"统一语义"，而不是"语法糖很多但体系分裂"

### 和 Rust 泛型相比

Rust 更常见的写法是：

```zig
// /dev/null/rust-generic.txt#L1-5
use std::ops::Add;

fn add<T: Add<Output = T>>(a: T, b: T) -> T {
    a + b
}
```

而 Zig 更常见的思路是：

- 直接接收 `comptime T: type`
- 需要约束时，用编译期检查自己表达出来
- 不依赖一整套 trait 体系来统一所有抽象

这带来的结果是：

- Zig 的约束表达更自由
- 但也更要求把边界写清楚
- 如果约束没写清楚，读者容易误解"这个泛型到底适用于哪些类型"

---

## 关于"类型推断"：不要把它想复杂

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

## 为什么 Zig 里"泛型"和"接口"经常一起讨论？

因为它们经常解决的是相邻但不同的问题。

### 泛型更适合什么场景？

泛型更适合：

- 类型在编译期已知
- 希望保留静态类型信息
- 希望编译器做专门化优化
- 不需要在运行时切换不同实现

### 运行时接口更适合什么场景？

运行时接口更适合：

- 具体实现要到运行时才知道
- 需要在同一套调用逻辑下切换多种后端
- 需要做类型擦除或动态分发

所以，一个很实用的判断问题是：

> **"多态"需求，是发生在编译期，还是运行时？**

如果发生在编译期，泛型通常是更直接的答案。
如果发生在运行时，泛型往往就不够了。

---

## 什么时候泛型会开始变得"过度复杂"？

这是非常重要的工程判断题。

当开始大量写下面这些东西时，就该停下来想一想：

- 很多层 `@typeInfo`
- 很多分支式 `@compileError`
- 很复杂的类型工厂嵌套
- 大量"自动生成方法"
- 看起来很万能，但读起来很难解释的通用代码

这并不意味着这些写法一定不好。
而是说：

> **泛型真正的价值，在于让代码更清晰、更安全、更可复用。**
> 如果它让理解成本显著上升，就应该重新评估设计。

### 值得使用泛型的时候
- 重复逻辑确实存在
- 类型参数的边界清楚
- 调用方式自然
- 抽象后代码更短、更一致

### 暂时不值得使用泛型的时候
- 只是为了展示技巧
- 实际只会支持一两种类型
- 约束很难解释
- 引入后比直接写两份代码更难维护

---

## Zig 里的"零成本抽象"应该怎么理解？

很多人听到泛型时都会联想到"零成本抽象"。
这个说法在 Zig 里通常成立，但不要把它理解得过于机械。

更准确地说，它意味着：

- 可以用编译期抽象组织代码
- 同时仍然得到针对具体类型的静态实现
- 不一定需要为"通用性"付出动态分发成本

但这不代表：

- 编译时间没有成本
- 代码体积没有成本
- 抽象越多越好

所以更稳妥的理解是：

> **Zig 允许把很多抽象提前到编译期完成，从而避免不必要的运行时负担。**

这是一种强大的能力，
但依然需要配合"边界清楚"和"实现克制"。

---

## 测试泛型代码

泛型代码的一个常见问题是：只用一种类型测试，就以为所有类型都能正常工作。好的做法是用多种类型分别实例化并测试：

```zig
const std = @import("std");

fn isZero(comptime T: type, value: T) bool {
    return value == 0;
}

test "isZero with i32" {
    try std.testing.expect(isZero(i32, 0));
    try std.testing.expect(!isZero(i32, 1));
}

test "isZero with f64" {
    try std.testing.expect(isZero(f64, 0.0));
    try std.testing.expect(!isZero(f64, 1.5));
}

test "isZero with u8" {
    try std.testing.expect(isZero(u8, 0));
    try std.testing.expect(!isZero(u8, 42));
}
```

为每种目标类型写独立的 `test` 块有几个好处：

- 测试名称能标识出具体类型，失败时定位更快
- 不同类型可能触发不同的编译期分支，需要分别覆盖
- 边界值（如整数溢出、浮点精度）因类型而异，分开测试更清晰

> **注意**：如果泛型函数内部使用了 `@typeInfo` 做分支，那么每个分支对应的类型都应该至少有一个测试覆盖。

---

## 小结

**泛型设计的核心原则：**

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

**检验学习效果的几个问题：**

- 某个抽象发生在编译期还是运行时？
- 某处为什么适合用泛型？
- 某个泛型真正支持哪些类型？
- 约束有没有被清楚表达？
- 抽象之后，代码是否真的更清晰？

---

> **相关阅读**：
>
> 下一章将学习 [指针、切片与对齐](chapter-pointers.md)，进一步理解 Zig 中数据访问、借用视图、切片和底层内存表示之间的关系。