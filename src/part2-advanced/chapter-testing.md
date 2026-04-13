# 测试与验证：从单元测试到基准测量

> **章节定位**：这一章是第二部分中非常重要的一环。  
> 到了这里，测试已经不再只是“写完代码后顺手检查一下”，而是你设计 API、验证错误路径、约束资源释放行为的基本工具。
>
> **阅读目标**：
> - 理解 Zig 中 `test` 块的基本使用方式
> - 学会用 `std.testing` 编写清晰的断言
> - 知道如何测试错误路径、边界条件和内存释放责任
> - 了解嵌套测试、测试过滤和简单基准测量的定位
> - 区分“稳定的测试主线”和“版本更敏感的构建/集成细节”
>
> **相关阅读与衔接建议**：
> - 如果你还没有建立 `std.testing` 的模块入口直觉，可以先阅读[常用标准库模块详解](chapter-standard-library-detail.md)中的相关小节，再回到本章系统学习测试方法。
> - 如果你刚读完[内存管理模型](chapter-memory-management.md)，可以重点关注本章中“错误路径”和“资源释放责任”的测试方式，这两章是直接连在一起的。
> - 如果你准备继续阅读[构建系统与包管理](chapter-package-management.md)，可以把本章理解为“先把模块验证清楚，再把测试接入项目构建流程”的过渡章节。
> - 如果你准备进入第三部分实战案例，那么本章最值得反复回看的部分通常是：测试命名、错误路径验证、`std.testing.allocator` 和简单测量方法。

---

## 为什么测试在 Zig 中尤其重要？

Zig 强调几件事：

- 显式错误处理
- 显式资源管理
- 显式分配器传递
- 尽量让失败模式清楚可见

这意味着很多代码的正确性，不只体现在“正常路径能跑通”，还体现在：

- 错误是否真的被正确返回
- 资源是否在失败时也能被释放
- 边界输入是否被正确处理
- 抽象接口是否足够清晰，容易验证

换句话说，在 Zig 里，**测试往往直接暴露设计是否清楚**。

例如，如果一个函数难以测试，常常说明它可能：

- 隐含了过多全局状态
- 混杂了太多职责
- 所有权边界不清楚
- 对失败路径缺乏明确约定

所以，测试不只是“质量保证”，也是一种**设计反馈机制**。

---

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

如果你的测试写在某个模块文件里，也可以直接测试那个文件：

```bash
zig test src/math.zig
```

---

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

当然，当模块很大、测试很多时，你也可以把测试拆到单独文件中。  
但在本教程阶段，**先理解“测试描述行为”这件事，比纠结文件布局更重要**。

---

## 最常用的断言函数

Zig 的测试辅助主要来自 `std.testing`。  
第一次学习时，不需要把所有辅助函数都记住，先掌握下面这些最常用的即可。

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

---

## 先测什么？优先级应该怎么排？

刚开始写测试时，最容易犯的错误是：

- 只测最顺利的“快乐路径”
- 试图一下子把所有细节都覆盖
- 写了很多测试，但没有抓住真正容易出错的点

更实用的顺序通常是：

### 1. 先测核心行为
也就是这个函数最主要的承诺是什么。

例如 `divide(a, b)`：

- 正常除法能否返回结果
- 除数为零时是否返回预期错误

### 2. 再测边界条件
例如：

- 空输入
- 最小值/最大值
- 长度为 0 或 1 的切片
- 极小/极大容量
- 容器空/满状态

### 3. 再测失败路径
尤其是涉及：

- 分配失败
- 输入无效
- 文件不存在
- 解析失败
- 资源初始化中途失败

### 4. 最后再补回归测试
如果你修过一个 bug，就应该尽量为那个 bug 增加一个测试，让它以后不会悄悄回来。

---

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

---

## 测试错误处理与失败路径

Zig 的很多函数都会返回错误联合类型，例如 `!T`。  
因此，测试时不能只验证“成功时结果对不对”，还要验证：

- 什么时候会失败
- 失败时返回的是哪个错误
- 失败后资源是否仍然被正确清理

### 测试错误值

```zig
const std = @import("std");

fn parsePort(text: []const u8) !u16 {
    const port = std.fmt.parseInt(u16, text, 10) catch {
        return error.InvalidPort;
    };

    if (port == 0) return error.InvalidPort;
    return port;
}

test "parsePort accepts a valid port number" {
    try std.testing.expectEqual(@as(u16, 8080), try parsePort("8080"));
}

test "parsePort rejects non-numeric input" {
    try std.testing.expectError(error.InvalidPort, parsePort("abc"));
}

test "parsePort rejects zero" {
    try std.testing.expectError(error.InvalidPort, parsePort("0"));
}
```

### 测试失败路径的价值

这一类测试很重要，因为很多 bug 恰恰不是“正常情况写错了”，而是：

- 出错时忘记返回正确错误
- 对无效输入处理不完整
- 中途失败后状态被破坏
- 调用者无法据此做正确恢复

---

## 用测试验证资源释放责任

在 Zig 中，资源释放责任需要说清楚。  
测试也应该帮助你验证这件事。

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

因为它迫使你把接口说清楚：

- 是借用现有切片，还是返回新分配结果？
- 谁负责释放？
- 分配失败时会发生什么？

如果这些问题在测试里说不清楚，通常说明接口本身也还不够清楚。

---

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

这里你可以看到：

- 临时容器 `list` 自己负责内部释放
- 返回值 `msg` 的所有权转移给调用者
- 测试里也因此必须显式 `free`

这类结构很符合 Zig 的风格：  
**资源边界清楚，因此也更容易测试。**

---

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

### 你第一次学习时要记住什么？

最重要的是：

- 这是 Zig 支持的一种测试组织方式
- 它适合把小范围行为测试放在声明附近
- 但它不是你一开始必须依赖的主线能力

很多时候，**顶层测试块已经足够**。

### 关于 `refAllDecls`

你在一些资料中可能会看到 `std.testing.refAllDecls(...)`。  
它的作用通常是帮助引用声明，从而让某些嵌套测试也被纳入测试流程。

但对本教程阶段来说，更值得记住的是这条原则：

> **先把顶层测试写清楚，再把嵌套测试当作组织手段，而不是核心能力。**

也就是说，`refAllDecls` 是“知道它存在即可”的高级补充，第一次阅读不必深究其内部机制。

---

## 测试过滤与选择性运行

当测试数量变多时，你通常不会每次都想跑全部测试。  
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

---

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

---

## 什么是“好测试”？

好测试通常有这些特征：

### 1. 关注一个明确行为
不要在一个测试里同时验证十件事。  
否则一旦失败，很难快速定位原因。

### 2. 输入和预期都清楚
不要让读者猜这个测试到底在验证什么。

### 3. 命名像一句行为描述
测试名本身应该能帮助理解代码。

### 4. 对失败路径同样重视
尤其是在 Zig 中，这一点非常关键。

### 5. 不依赖隐式全局状态
如果测试必须依赖复杂外部状态，通常说明设计可以继续改进。

---

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

---

## 基准测试：先把定位说清楚

很多人第一次接触“基准测试”时，会下意识把它理解成：

- 复杂性能平台
- 非常精密的测量框架
- 一套必须标准化的流程

但在教程阶段，更重要的是先建立正确认识：

> **基准测试的目标，不是“看起来很专业地测一个数字”，而是帮助你比较实现差异，并验证优化是否真的有效。**

### 先记住三条原则

1. **先保证正确，再谈快**
2. **先测量，再优化**
3. **对结果保持怀疑，避免过度解读一次测量**

---

## 用 `std.time.Timer` 做简单测量

在本教程里，我们先用最轻量的方式理解基准测量：

```zig
const std = @import("std");

fn sum(items: []const u64) u64 {
    var total: u64 = 0;
    for (items) |item| {
        total += item;
    }
    return total;
}

test "simple timing example" {
    var data: [1000]u64 = undefined;
    for (&data, 0..) |*item, i| {
        item.* = i;
    }

    var timer = try std.time.Timer.start();
    const result = sum(&data);
    const elapsed_ns = timer.read();

    try std.testing.expect(result > 0);

    std.debug.print("sum elapsed: {} ns\n", .{elapsed_ns});
}
```

### 这类测量要怎么理解？

它适合：

- 粗略观察某段逻辑耗时
- 对比两个实现的大致差异
- 作为“是否值得继续分析”的第一步

它不适合：

- 得出非常精确、可移植、可复现的性能结论
- 忽略环境因素后直接宣布“实现 A 一定比实现 B 快”
- 代替更严谨的性能分析工具

---

## 为什么基准测试容易误导？

因为性能受很多因素影响：

- 编译优化级别
- 输入规模
- 数据分布
- 缓存状态
- 机器负载
- 操作系统调度
- 是否包含 I/O
- 是否包含内存分配

所以，看到一次测量结果后，更成熟的做法是问：

- 这个输入是否具有代表性？
- 测到的是目标逻辑，还是别的开销？
- 是否需要多次重复？
- 是否需要换一个更贴近实际的数据集？

---

## 测试与基准测试不要混在一起理解

虽然测试和基准都用于“验证”，但它们关注的问题不同。

| 类型 | 主要问题 | 典型输出 |
| ---- | -------- | -------- |
| 测试 | 对不对 | 通过 / 失败 |
| 基准 | 快不快 | 时间、吞吐、分配次数等 |

所以更合理的顺序是：

1. 先确认逻辑正确
2. 再确认错误路径可靠
3. 最后才讨论性能表现

---

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
你更应该先掌握的是：

> **如何把一个 Zig 接口拆成可验证的行为，并为这些行为写出清楚的小测试。**

至于更复杂的构建集成，可以结合后续构建系统章节再看。

---

## 常见误区

### 1. 只测快乐路径
这是最常见的问题。  
尤其在 Zig 中，失败路径常常更值得测。

### 2. 一个测试塞太多断言
这样失败时难以定位问题。

### 3. 不清楚谁负责释放资源
如果测试里说不清楚所有权，接口设计往往也还不够清楚。

### 4. 测试名太模糊
模糊的测试名会让失败日志失去价值。

### 5. 把一次简单计时当成最终性能结论
基准测量应该帮助你提出更好的问题，而不是让你过早下结论。

---

## 推荐的写测试顺序

当你写一个新模块时，可以参考下面这个顺序：

1. 先写一个最小成功案例
2. 再写一个最小失败案例
3. 再补边界输入
4. 如果涉及分配，加入资源释放检查
5. 如果未来可能优化，再补简单计时比较

这套顺序很适合 Zig，因为它天然贴合：

- 显式错误处理
- 显式资源管理
- 小步验证
- 先正确再优化

---

## 小结

这一章最重要的，不是记住一长串测试 API，而是建立下面这些习惯：

- 把测试当成接口设计的一部分
- 优先验证行为、边界和错误路径
- 用 `std.testing` 写小而清楚的断言
- 用 `std.testing.allocator` 帮助检查资源释放责任
- 把基准测试当成“测量与比较工具”，而不是装饰性的性能数字

如果你在读完本章后，已经能自然地问自己：

- 这个函数最重要的行为是什么？
- 它失败时应该怎么表现？
- 谁拥有返回的资源？
- 我能不能用一个小测试把这些契约说清楚？

那么这一章就达到目的了。

---

> 💡 **下一章预告**
>
> 下一章我们将进入 [构建系统与包管理](chapter-package-management.md)，继续把“代码能写对”推进到“项目能组织、能构建、能复用”。