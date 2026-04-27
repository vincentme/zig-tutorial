# 测试与验证：从单元测试到基准测量

> **进阶**：这一章是第二部分中非常重要的一环。  
> 到了这里，测试已经不再只是“写完代码后顺手检查一下”，而是设计 API、验证错误路径、约束资源释放行为的基本工具。
>
> **进阶**：
> - 理解 Zig 中 `test` 块的基本使用方式
> - 学会用 `std.testing` 编写清晰的断言
> - 知道如何测试错误路径、边界条件和内存释放责任
> - 了解嵌套测试、测试过滤和简单基准测量的定位
> - 区分“稳定的测试主线”和“版本更敏感的构建/集成细节”
>
> **相关阅读**：
> - 如果还没有建立 `std.testing` 的模块入口直觉，可以先阅读[常用标准库模块详解](chapter-standard-library-detail.md)中的相关小节，再回到本章系统学习测试方法。
> - 如果刚读完[内存管理模型](chapter-memory-management.md)，可以重点关注本章中“错误路径”和“资源释放责任”的测试方式，这两章是直接连在一起的。
> - 如果准备继续阅读[构建系统与包管理](chapter-package-management.md)，可以把本章理解为“先把模块验证清楚，再把测试接入项目构建流程”的过渡章节。
> - 如果准备进入第三部分实战案例，那么本章最值得反复回看的部分通常是：测试命名、错误路径验证、`std.testing.allocator` 和简单测量方法。

## 为什么测试在 Zig 中很重要

Zig 强调显式错误处理、显式资源管理和显式分配器传递。测试直接验证这些约束是否被遵守。难以测试的函数往往说明设计本身需要改进。

## Zig 测试的基本形式

Zig 使用 `test` 块定义测试：

```zig
const std = @import("std");

fn add(a: i32, b: i32) i32 {
    return a + b;
}

test "add returns the sum of two integers" {
    try std.testing.expect(add(2, 3) == 5);
}
```

这段代码有几个关键点：

1. `test "..." { ... }` 是测试块
2. 测试名称应该描述行为，而不是只写一个模糊标签
3. 测试里通常使用 `try std.testing.*` 断言
4. 这些测试不会在普通构建里作为主程序入口运行，而是通过 `zig test` 执行

### 运行测试

最基本的运行方式是：

```bash
zig test src/main.zig
```

如果测试写在某个模块文件里，也可以直接测试那个文件：

```bash
zig test src/math.zig
```

## 把测试和代码放在一起

Zig 很常见的一种风格，是让测试与被测代码放在同一个文件中：

```zig
const std = @import("std");

pub fn clamp(value: i32, min: i32, max: i32) i32 {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

test "clamp returns min when value is below range" {
    try std.testing.expectEqual(@as(i32, 0), clamp(-5, 0, 10));
}

test "clamp returns max when value is above range" {
    try std.testing.expectEqual(@as(i32, 10), clamp(20, 0, 10));
}

test "clamp returns original value when already in range" {
    try std.testing.expectEqual(@as(i32, 7), clamp(7, 0, 10));
}
```

这种写法的优点是：

- 被测代码与测试距离近，阅读成本低
- 重构时更容易同步更新测试
- 测试本身也能起到“行为文档”的作用

当然，当模块很大、测试很多时，也可以把测试拆到单独文件中。  
但在本教程阶段，**理解“测试描述行为”这件事，比纠结文件布局更重要**。

## 最常用的断言函数

Zig 的测试辅助主要来自 `std.testing`。  
不需要把所有辅助函数都记住，掌握下面这些最常用的即可。

### `expect`

用于断言一个布尔表达式为真：

```zig
const std = @import("std");

test "expect checks boolean conditions" {
    try std.testing.expect(1 + 1 == 2);
    try std.testing.expect(true);
}
```

适合：

- 简单条件判断
- 不需要特别展示“期望值/实际值”的场景

### `expectEqual`

用于比较两个值是否相等：

```zig
const std = @import("std");

test "expectEqual compares values" {
    try std.testing.expectEqual(@as(i32, 42), @as(i32, 42));
}
```

相比直接写 `expect(a == b)`，`expectEqual` 的优点是：  
**当失败时，通常更容易看出“期望值”和“实际值”分别是什么。**

### `expectEqualStrings`

用于比较字符串：

```zig
const std = @import("std");

fn greet(name: []const u8) []const u8 {
    if (std.mem.eql(u8, name, "zig")) return "hello, zig";
    return "hello, world";
}

test "expectEqualStrings compares text content" {
    try std.testing.expectEqualStrings("hello, zig", greet("zig"));
}
```

### `expectEqualSlices`

用于比较切片内容：

```zig
const std = @import("std");

test "expectEqualSlices compares slice contents" {
    const expected = [_]u8{ 1, 2, 3 };
    const actual = [_]u8{ 1, 2, 3 };

    try std.testing.expectEqualSlices(u8, &expected, &actual);
}
```

### `expectError`

用于验证错误路径是否返回了预期错误：

```zig
const std = @import("std");

fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

test "divide returns DivisionByZero when divisor is zero" {
    try std.testing.expectError(error.DivisionByZero, divide(10, 0));
}
```

这类测试在 Zig 中尤其重要，因为错误不是“例外情况可以不测”，而是接口契约的一部分。

### 浮点比较

浮点数通常不适合直接用 `==`。  
更稳妥的写法是使用近似比较：

```zig
const std = @import("std");

test "floating-point values should use approximate comparison" {
    const expected: f64 = 3.14159;
    const actual: f64 = 3.14160;

    try std.testing.expectApproxEqAbs(expected, actual, 0.001);
}
```

## 先测什么？优先级应该怎么排？

刚开始写测试时，最容易犯的错误是：

- 只测最顺利的“快乐路径”
- 试图一下子把所有细节都覆盖
- 写了很多测试，但没有抓住真正容易出错的点

更实用的顺序通常是：

1. **先测核心行为** — 函数最主要的承诺：正常输入能否返回正确结果？失败时是否返回预期错误？
2. **再测边界条件** — 空输入、最小值/最大值、长度为 0 的切片、容器空/满状态
3. **再测失败路径** — 分配失败、输入无效、文件不存在、解析失败、资源初始化中途失败
4. **再补资源释放检查** — 如果涉及分配，验证 `defer` 和 `errdefer` 的执行
5. **最后补回归测试** — 修过的 bug 应增加测试，防止悄悄回归

## 一个更完整的测试示例

下面这个例子展示了正常路径、边界条件和错误路径如何组合：

```zig
const std = @import("std");

fn firstOrError(items: []const i32) !i32 {
    if (items.len == 0) return error.EmptyInput;
    return items[0];
}

test "firstOrError returns the first item for non-empty slices" {
    const items = [_]i32{ 10, 20, 30 };
    try std.testing.expectEqual(@as(i32, 10), try firstOrError(&items));
}

test "firstOrError returns error.EmptyInput for empty slices" {
    const items = [_]i32{};
    try std.testing.expectError(error.EmptyInput, firstOrError(&items));
}
```

这种结构很适合教程中的大多数模块：

- 一个小函数
- 两到三个行为测试
- 明确区分正常路径和失败路径

## 用测试验证资源释放责任

在 Zig 中，资源释放责任需要说清楚。  
测试也应该帮助验证这件事。

最常见的方式之一，是在测试中使用 `std.testing.allocator`。

### `std.testing.allocator` 的作用

它是测试环境中的专用分配器，适合用来帮助发现：

- 内存泄漏
- 重复释放
- 一些资源使用不当的问题

示例：

```zig
const std = @import("std");

fn duplicate(allocator: std.mem.Allocator, input: []const u8) ![]u8 {
    const copy = try allocator.alloc(u8, input.len);
    @memcpy(copy, input);
    return copy;
}

test "duplicate allocates and returns a copy" {
    const allocator = std.testing.allocator;

    const result = try duplicate(allocator, "zig");
    defer allocator.free(result);

    try std.testing.expectEqualStrings("zig", result);
}
```

这个测试除了检查功能，还隐含验证了一个重要契约：

- `duplicate` 返回一段新分配的内存
- 调用者拿到所有权
- 因此调用者必须负责 `free`

### 为什么这类测试很有价值？

因为它迫使接口说清楚：

- 是借用现有切片，还是返回新分配结果？
- 谁负责释放？
- 分配失败时会发生什么？

如果这些问题在测试里说不清楚，通常说明接口本身也还不够清楚。

## 使用 `defer` 和 `errdefer` 设计可测试代码

可测试的资源管理代码，往往也更容易写对。

例如：

```zig
const std = @import("std");

fn buildMessage(allocator: std.mem.Allocator, name: []const u8) ![]u8 {
    var list = std.ArrayList(u8).empty;
    defer list.deinit(allocator);

    try list.appendSlice(allocator, "hello, ");
    try list.appendSlice(allocator, name);

    return try allocator.dupe(u8, list.items);
}

test "buildMessage returns allocated greeting text" {
    const allocator = std.testing.allocator;

    const msg = try buildMessage(allocator, "zig");
    defer allocator.free(msg);

    try std.testing.expectEqualStrings("hello, zig", msg);
}
```

这里可以看到：

- 临时容器 `list` 自己负责内部释放
- 返回值 `msg` 的所有权转移给调用者
- 测试里也因此必须显式 `free`

这类结构很符合 Zig 的风格：  
**资源边界清楚，因此也更容易测试。**

## 嵌套测试：它是什么，什么时候关心？

Zig 支持把 `test` 写在结构体等声明内部。  
这通常被称为“嵌套测试”：

```zig
const std = @import("std");

const Counter = struct {
    value: i32,

    fn inc(self: *Counter) void {
        self.value += 1;
    }

    test "Counter.inc increases value by one" {
        var c = Counter{ .value = 0 };
        c.inc();
        try std.testing.expectEqual(@as(i32, 1), c.value);
    }
};
```

### 关键要点

最重要的是：

- 这是 Zig 支持的一种测试组织方式
- 它适合把小范围行为测试放在声明附近
- 但它不是一开始必须依赖的主线能力

很多时候，**顶层测试块已经足够**。

## 测试过滤与选择性运行

当测试数量变多时，通常不需要每次都跑全部测试。  
这时可以使用测试过滤。

例如：

```bash
zig test src/math.zig --test-filter "divide"
```

这个命令的意义是：

- 运行测试文件
- 只执行名称匹配 `"divide"` 的测试块

所以，测试名称写得清楚就会很有帮助。  
例如：

- `divide returns DivisionByZero when divisor is zero`
- `divide truncates integer division toward zero`

都比简单写成 `test1`、`divide test` 更好。

## 怎样给测试命名更清楚？

推荐的命名风格是：

- 描述**对象**
- 描述**条件**
- 描述**预期行为**

例如：

- `parsePort rejects zero`
- `Stack.pop returns null when the stack is empty`
- `Config.get returns default value when field is unset`

这种风格有两个好处：

1. 读测试列表时就能大致知道覆盖了什么
2. 测试失败时，日志本身就像一句行为说明

## 什么是好测试

1. 关注一个明确行为
2. 输入和预期都清楚
3. 命名像一句行为描述
4. 同样重视失败路径
5. 不依赖隐式全局状态
6. 把基准测量当作提问工具
基准测量应该帮助提出更好的问题，而不是导致过早下结论。

## 一个简单容器测试示例

下面是一个更贴近第二部分后续章节的例子：

```zig
const std = @import("std");

const Stack = struct {
    items: [4]i32 = undefined,
    len: usize = 0,

    fn push(self: *Stack, value: i32) !void {
        if (self.len >= self.items.len) return error.Full;
        self.items[self.len] = value;
        self.len += 1;
    }

    fn pop(self: *Stack) ?i32 {
        if (self.len == 0) return null;
        self.len -= 1;
        return self.items[self.len];
    }
};

test "Stack.pop returns null when empty" {
    var stack = Stack{};
    try std.testing.expectEqual(@as(?i32, null), stack.pop());
}

test "Stack.push and Stack.pop follow LIFO order" {
    var stack = Stack{};

    try stack.push(10);
    try stack.push(20);

    try std.testing.expectEqual(@as(?i32, 20), stack.pop());
    try std.testing.expectEqual(@as(?i32, 10), stack.pop());
    try std.testing.expectEqual(@as(?i32, null), stack.pop());
}

test "Stack.push returns error.Full when capacity is exceeded" {
    var stack = Stack{};

    try stack.push(1);
    try stack.push(2);
    try stack.push(3);
    try stack.push(4);

    try std.testing.expectError(error.Full, stack.push(5));
}
```

这个例子很适合观察几个测试设计要点：

- 空容器行为单独测
- 正常顺序行为单独测
- 容量溢出错误单独测

而不是把这三件事塞进一个超长测试里。

## 基准测试

> **基准测试的目标，是帮助比较实现差异，并验证优化是否真的有效。**

三条核心原则：**先保证正确，再谈快**；**先测量，再优化**；**对结果保持怀疑，避免过度解读一次测量**。

下面用概念性的方式展示基本计时思路：

```zig
const std = @import("std");

fn sum(items: []const u64) u64 {
    var total: u64 = 0;
    for (items) |item| {
        total += item;
    }
    return total;
}

// 注意：Zig 0.16-dev 中尚无 std.time.Timer 或 std.time.Instant 等
// 高层计时 API。具体的计时方式取决于目标平台和 I/O 模型。
// 以下为概念示意，展示计时测量的基本思路：
//
// 1. 记录起始时间
// 2. 执行待测逻辑（如 sum(&data)）
// 3. 记录结束时间
// 4. 计算差值，得到耗时
```

> **版本说明**：Zig 0.16-dev 中 `std.time` 仅包含时间单位常量和 `epoch` 模块，不提供 `Timer` 或 `Instant` 等高层计时接口。
> 进行性能测量时，建议使用 `zig build` 的 `-Doptimize=ReleaseFast` 选项，并结合外部工具（如 `hyperfine`、`perf`）获得更可靠的数据。

粗略计时适合观察耗时量级、对比两个实现的大致差异、判断是否值得深入分析。但它**不适合**得出精确的、可复现的性能结论——性能受编译优化级别、输入规模、缓存状态、机器负载等众多因素影响，一次测量结果应始终被审慎对待。

测试和基准关注的问题不同：测试回答"对不对"（输出：通过/失败），基准回答"快不快"（输出：时间、吞吐等）。更合理的顺序是：先确认逻辑正确，再确认错误路径可靠，最后才讨论性能表现。

## 版本敏感说明：哪些内容值得小心？

这一章里，真正稳定、应优先掌握的主线是：

- `test` 块
- `std.testing.expect*`
- `expectError`
- `std.testing.allocator`
- 测试过滤
- 用小而清楚的案例验证行为

而下面这些内容，相对更容易受到版本、构建方式或工程结构影响：

- 更复杂的构建系统集成方式
- CI 配置细节
- 某些基准脚手架或命令行习惯
- 标准库内部辅助工具的具体接口形式

因此，本章刻意不把重点放在“记很多构建细节”上。  
更值得掌握的是：

> **如何把一个 Zig 接口拆成可验证的行为，并为这些行为写出清楚的小测试。**

至于更复杂的构建集成，可以结合后续构建系统章节再看。

## 小结

这一章最重要的，不是记住一长串测试 API，而是建立下面这些习惯：

- 把测试当成接口设计的一部分
- 优先验证行为、边界和错误路径
- 用 `std.testing` 写小而清楚的断言
- 用 `std.testing.allocator` 帮助检查资源释放责任
- 把基准测试当成“测量与比较工具”，而不是装饰性的性能数字

如果在读完本章后，已经能自然地问自己：

- 这个函数最重要的行为是什么？
- 它失败时应该怎么表现？
- 谁拥有返回的资源？
- 我能不能用一个小测试把这些契约说清楚？

那么这一章就达到目的了。

---

> **相关阅读**：[构建系统与包管理](chapter-package-management.md)
