# 泛型编程

> **章节定位**：本章讨论 Zig 中最重要的编译期抽象能力之一：泛型。  
> 它不是“额外高级技巧”，而是你理解 `comptime`、类型工厂、零成本抽象和接口取舍的关键入口。
>
> **建议阅读方式**：
> - 第一次阅读时，先抓住心智模型，不要急着记所有技巧
> - 重点理解“类型也是编译期值”“泛型在编译期实例化”“约束要尽量写清楚”
> - 遇到复杂的 `@typeInfo` 示例时，优先看懂它在解决什么问题，而不是逐字背代码
>
> **相关阅读与衔接建议**：
> - 如果你刚读完上一章，建议先把[编译期计算与元编程](chapter-comptime.md)中的 `comptime` 心智模型带进来，再看这一章会更顺
> - 如果你读到后半章开始频繁思考“这些抽象最后怎样落到真实数据访问上”，可以接着读[指针、切片与对齐](chapter-pointers.md)

---

## 先建立正确心智模型

很多语言把泛型讲成“一个模板，可以套很多类型”。  
这个说法不算错，但在 Zig 里，如果只停留在这个层面，你会很快遇到困惑。

更贴近 Zig 的理解方式是：

1. **类型本身可以作为编译期值传递**
2. **泛型函数本质上就是接收编译期类型参数的函数**
3. **泛型结构体本质上就是返回 `type` 的类型工厂**
4. **实例化发生在编译期，而不是运行时**
5. **约束通常不是写在一套独立“trait 语法”里，而是通过编译期检查显式表达**

所以，本章真正要你掌握的不是“怎么把函数写得更通用”，而是：

> **Zig 如何把“类型参数化”这件事，统一到 `comptime` 语义下。**

---

## 为什么需要泛型？

如果没有泛型，你很容易写出大量重复代码：

```zig
const std = @import("std");

fn maxI32(a: i32, b: i32) i32 {
    return if (a > b) a else b;
}

fn maxF64(a: f64, b: f64) f64 {
    return if (a > b) a else b;
}

fn maxU8(a: u8, b: u8) u8 {
    return if (a > b) a else b;
}

test "duplicated max functions" {
    try std.testing.expect(maxI32(3, 5) == 5);
    try std.testing.expect(maxF64(1.5, 0.5) == 1.5);
    try std.testing.expect(maxU8(1, 9) == 9);
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

## Zig 泛型和其他语言有什么不同？

Zig 的泛型通常会让有其他语言经验的读者产生一种“似曾相识但又不太一样”的感觉。

### 和 C++ 模板相比

C++ 模板：

```zig
// /dev/null/cpp-template.txt#L1-4
template<typename T>
T max(T a, T b) {
    return a > b ? a : b;
}
```

Zig 泛型：

```zig
const std = @import("std");

fn max(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

test "zig generic max" {
    try std.testing.expect(max(i32, 3, 5) == 5);
    try std.testing.expect(max(f64, 3.5, 2.5) == 3.5);
}
```

差别在于：

- Zig 把“类型参数是编译期参数”写得更显式
- Zig 不额外引入一套模板语言
- Zig 更强调“统一语义”，而不是“语法糖很多但体系分裂”

### 和 Rust 泛型相比

Rust 更常见的写法是：

```zig
// /dev/null/rust-generic.txt#L1-4
fn max<T: Ord>(a: T, b: T) -> T {
    if a > b { a } else { b }
}
```

而 Zig 更常见的思路是：

- 直接接收 `comptime T: type`
- 需要约束时，用编译期检查自己表达出来
- 不依赖一整套 trait 体系来统一所有抽象

这带来的结果是：

- Zig 的约束表达更自由
- 但也更要求你自己把边界写清楚
- 如果约束没写清楚，读者就很容易误解“这个泛型到底适用于哪些类型”

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

这里最关键的一行是：

```zig
const std = @import("std");

fn identity(comptime T: type, value: T) T {
    return value;
}
```

要点只有两个：

1. `T` 是一个编译期已知的类型参数
2. `value` 的类型由这个参数决定

你可以把它理解成：

> “我在编译期把类型传进来，然后得到一份针对该类型专门成立的实现。”

---

## “编译期实例化”到底是什么意思？

很多资料会说“泛型会在编译期实例化”，但如果没有直觉，这句话容易变成空话。

看这个例子：

```zig
const std = @import("std");

fn maxValue(comptime T: type, a: T, b: T) T {
    return if (a > b) a else b;
}

test "generic maxValue" {
    try std.testing.expectEqual(@as(i32, 20), maxValue(i32, 10, 20));
    try std.testing.expectEqual(@as(f64, 3.14), maxValue(f64, 3.14, 2.71));
}
```

概念上，你可以把它想成编译器分别为不同类型生成了专门版本：

- 一个处理 `i32`
- 一个处理 `f64`

当然，真实编译器内部不一定按你脑中“复制粘贴函数”的方式工作。  
但对学习者来说，这个心智模型已经足够有用：

- 每种用到的类型，都会得到适配后的实现
- 不需要在运行时再判断“现在到底是什么类型”
- 因此通常没有额外动态分发成本

---

## 关于“类型推断”：不要把它想复杂

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

这里的重点不是“能不能省掉 `T`”，而是：

- **你是否希望读者清楚地看到这个泛型的类型入口**
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

## 泛型结构体：把“返回类型”当成一种正常设计

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

这段代码最重要的不是会不会写，而是要建立这个认知：

> `Point(i32)` 不是“对象”，而是“类型”。

也就是说：

- `Point` 本身是一个接收类型参数的工厂
- `Point(i32)` 得到一个具体结构体类型
- 然后你再在这个类型上调用 `init`

如果这个心智模型没建立好，后面读容器、接口工厂、类型驱动设计时会一直别扭。

---

## 泛型不是“对所有类型都成立”

这是本章最重要的边界意识之一。

很多初学者看到泛型后，容易自然地产生一种误解：

> “既然写成泛型了，那应该适用于几乎所有类型吧？”

并不是。

泛型只是“类型参数化”，不代表“自动具备合理约束”。

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

1. 你可以在编译期检查类型信息
2. 泛型的“适用范围”需要你自己定义
3. 如果类型不合适，应该尽早在编译期报错

但这里也有一个必须明确提醒读者的边界：

> 对于有符号整数，最小值的绝对值可能无法表示。  
> 例如某些类型上的最小负数取反会溢出。

所以这个例子适合拿来理解“类型约束”和“编译期分支”，  
但它**不应该**被误读成“一个没有边界条件的完美通用 `abs`”。

这正是 Zig 泛型常见的真实情况：

- 泛型可以很强大
- 但约束和边界要你自己说清楚
- 说不清楚，就容易把示例写成“看起来很通用，实际上有前提”

---

## 用 `@typeInfo` 做约束：价值在“表达边界”，不在“炫技”

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

- 让“适用范围”更明确
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

### 1. 泛型类型本身并不神秘
`Stack(i32)` 就是一个具体类型。

### 2. 类型安全是自然得到的
如果你实例化的是 `Stack(i32)`，那你压进去的就必须是 `i32`。

### 3. 分配器责任仍然要显式
泛型不会替你隐藏资源边界。  
这里仍然要显式传入 allocator。

这点非常符合 Zig 的整体风格：

> **泛型帮助你复用逻辑，但不会替你偷偷做资源决策。**

---

## 为什么 Zig 里“泛型”和“接口”经常一起讨论？

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

> **你的“多态”需求，是发生在编译期，还是运行时？**

如果发生在编译期，泛型通常是更直接的答案。  
如果发生在运行时，泛型往往就不够了。

---

## 泛型不是 `anytype`

这也是初学者非常容易混淆的一点。

`anytype` 很方便，但它不是“更高级的泛型”，也不是所有场景的默认答案。

看一个简单例子：

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

这里的 `anytype` 表达的是：

- 这个参数的具体类型由调用点决定
- 函数体会基于实际类型进行编译期检查

它确实和泛型很接近，但学习上最好这样区分：

### 可以优先把 `anytype` 看成什么？
- 一种方便的编译期参数推导方式
- 适合写很短、局部、意图明确的通用函数

### 什么时候更适合显式写 `comptime T: type`？
- 你希望把“类型入口”写清楚
- 你要在返回值或多个参数之间复用同一类型参数
- 你要为类型写约束
- 你要返回 `type`
- 你想让读者更明确地看到这是一个真正的类型驱动抽象

一个简单判断方式是：

> 如果你已经开始关心“这个函数到底支持哪些类型、返回什么类型、边界在哪”，通常就该考虑显式写出 `comptime T: type` 了。

---

## 泛型结构里常见的 `Self = @This()` 是什么？

你会在很多 Zig 泛型示例里看到这一句：

```zig
const Self = @This();
```

它的作用很简单：

- 在结构体内部为“当前这个具体结构体类型”起一个名字
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
它只是让方法里引用“当前结构体类型”更方便。

---

## 什么时候泛型会开始变得“过度复杂”？

这是非常重要的工程判断题。

当你开始大量写下面这些东西时，就该停下来想一想：

- 很多层 `@typeInfo`
- 很多分支式 `@compileError`
- 很复杂的类型工厂嵌套
- 大量“自动生成方法”
- 看起来很万能，但读起来很难解释的通用代码

这并不意味着这些写法一定不好。  
而是说：

> **泛型真正的价值，在于让代码更清晰、更安全、更可复用。**  
> 如果它让理解成本显著上升，就应该重新评估设计。

一个很实用的经验是：

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

## Zig 里的“零成本抽象”应该怎么理解？

很多人听到泛型时都会联想到“零成本抽象”。  
这个说法在 Zig 里通常成立，但不要把它理解得过于机械。

更准确地说，它意味着：

- 你可以用编译期抽象组织代码
- 同时仍然得到针对具体类型的静态实现
- 不一定需要为“通用性”付出动态分发成本

但这不代表：

- 编译时间没有成本
- 代码体积没有成本
- 抽象越多越好

所以更稳妥的理解是：

> **Zig 允许你把很多抽象提前到编译期完成，从而避免不必要的运行时负担。**

这是一种强大的能力，  
但依然需要配合“边界清楚”和“实现克制”。

---

## 初学者最容易踩的几个坑

### 1. 把泛型当成“自动适配一切类型”
不是。  
泛型只是参数化，不是万能适配器。

### 2. 过早沉迷 `@typeInfo`
反射很强，但第一步应该先把简单泛型写清楚。  
不是每个通用函数都需要完整类型反射。

### 3. 用 `anytype` 逃避设计
`anytype` 很方便，但如果你已经需要明确约束、明确返回类型、明确边界，就应该把类型参数写出来。

### 4. 泛型容器里偷偷隐藏 allocator
这通常不符合 Zig 的风格。  
资源从哪里来、什么时候释放，最好显式表达。

### 5. 只追求“更通用”，不追求“更清晰”
一个真正好的泛型抽象，不只是支持更多类型，  
还应该更容易被解释和验证。

---

## 本章真正要记住的四句话

如果你读完本章，只记住下面四句，其实已经够用了：

1. **泛型在 Zig 中首先是 `comptime` 能力的延伸。**
2. **类型参数是编译期值，泛型实例化发生在编译期。**
3. **泛型不等于万能；边界和约束需要显式表达。**
4. **好的泛型抽象应该让代码更清楚，而不是更神秘。**

---

## 小结

这一章最核心的目标，不是让你掌握所有“高级技巧”，而是帮助你建立一个稳定的判断框架：

- 当类型在编译期已知时，泛型通常是很自然的抽象方式
- 当你需要复用同一逻辑到多种类型时，可以考虑用 `comptime T: type`
- 当你需要更明确的边界时，可以用编译期检查表达约束
- 当你开始写出非常复杂的反射和代码生成时，要回头问自己：这是否真的提升了设计质量

如果你已经能够回答下面这些问题，本章就达到目的了：

- 这个抽象发生在编译期还是运行时？
- 这里为什么适合用泛型？
- 这个泛型真正支持哪些类型？
- 这些约束有没有被清楚表达？
- 抽象之后，代码是否真的更清晰？

---

> 💡 **下一章预告**
>
> 下一章我们将学习 [指针、切片与对齐](chapter-pointers.md)，进一步理解 Zig 中数据访问、借用视图、切片和底层内存表示之间的关系。