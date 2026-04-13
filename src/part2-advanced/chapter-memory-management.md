# 内存管理模型

> **章节定位**：本章属于第二部分的核心章节之一，重点不是教你“记住几个分配器名字”，而是帮助你建立 Zig 中最重要的一组工程直觉：
>
> - 内存是一种资源
> - 分配可能失败，释放必须可靠
> - 分配器是接口设计的一部分
> - 所有权、借用、生命周期和清理责任需要显式表达
>
> 如果说第一部分解决的是“代码怎么写”，那么本章更关注“资源责任怎么划分、失败路径怎么收口、接口为什么这样设计”。
>
> **相关阅读与衔接建议**：
> - 如果你刚读完[指针、切片与对齐](chapter-pointers.md)，这一章会把“如何访问数据”进一步推进到“谁拥有数据、谁负责释放”。
> - 如果你还没有建立 `std.heap` 中常见 allocator 的基础入口直觉，也可以先阅读[常用标准库模块详解](chapter-standard-library-detail.md)中对应的小节，再回到本章理解更完整的资源模型。
> - 如果你接下来准备阅读[接口、组合与设计模式](chapter-interfaces.md)，可以特别留意本章里“分配器是接口设计一部分”这一主线。
> - 如果你更想先看实践案例，也可以在读完本章后回到第三部分对照阅读[高级内存管理技巧（专题）](../part3-practice/chapter-advanced-memory.md)，观察这些原则在案例里的落地方式。

---

## 先建立一个总视角：Zig 的内存管理在解决什么问题？

在系统编程里，很多最难定位的问题都和内存有关。例如：

- 内存泄漏：分配后忘记释放
- 悬空指针：访问已经失效的内存
- 双重释放：同一块内存被释放两次
- 越界访问：读写超出合法范围
- 生命周期混乱：调用者和被调用者都以为“对方会负责”

Zig 没有垃圾回收器，也没有 Rust 那样的借用检查器来替你自动兜底。  
它选择的是另一条路线：

> **把资源责任表达得更明确，把分配行为放回接口层，把调试期检查交给工具和运行时防护。**

这意味着 Zig 给了你更高的自由度，也要求你建立更强的资源管理纪律。

---

## Zig 的内存管理哲学

> 📜 **Zig Zen 原则关联**
>
> 本章内容直接体现了以下几条 Zig Zen：
>
> - **"Memory is a resource."**
> - **"Resource allocation may fail; resource deallocation must succeed."**
> - **"Communicate intent precisely."**
> - **"Edge cases matter."**

这几条原则可以浓缩成下面四个判断：

1. **内存不是背景设施，而是需要被设计和管理的资源**
2. **分配失败是正常情况，不应假装它不会发生**
3. **释放逻辑必须可靠，不能把清理写成“碰运气”**
4. **接口应当明确表达：谁分配、谁拥有、谁释放**

---

## Zig 与其他语言在内存管理上的差异

可以把几种常见路线做一个粗略对比：

| 语言/模型 | 主要机制 | 优点 | 代价 |
| --- | --- | --- | --- |
| GC 语言 | 垃圾回收 | 使用方便，心智负担小 | 回收时机与性能开销较难精确控制 |
| Rust | 所有权 + 借用检查 | 编译期约束强，很多错误能提前发现 | 学习曲线较陡，某些场景表达较绕 |
| Zig | 显式分配器 + 手动管理 + 调试期检查 | 资源边界清楚，控制力强，接口灵活 | 需要开发者主动维护资源纪律 |

这也是为什么 Zig 的教程里，“内存管理”不能只讲语法。  
因为它本质上是**设计问题**，不是“几个 API 的记忆题”。

---

## 所有权、借用与生命周期

虽然 Zig 没有 Rust 式所有权系统，但你依然需要主动建立这套思维。

### 所有权最重要的三个问题

看到一段涉及资源的代码时，优先问自己：

1. **这块内存是谁分配的？**
2. **这块内存现在归谁负责？**
3. **它会在什么时候被释放？**

只要这三个问题答不清，后面迟早会出问题。

### 一个清晰的“所有权转移”示例

```zig
const std = @import("std");

fn createBuffer(allocator: std.mem.Allocator, len: usize) ![]u8 {
    const buffer = try allocator.alloc(u8, len);
    return buffer; // 所有权转移给调用者
}

test "caller owns returned buffer" {
    const allocator = std.testing.allocator;

    const buffer = try createBuffer(allocator, 128);
    defer allocator.free(buffer);

    try std.testing.expectEqual(@as(usize, 128), buffer.len);
}
```

这里的语义很清楚：

- `createBuffer` 负责分配
- 返回之后，调用者获得所有权
- 因此调用者必须释放

### 一个“借用但不转移所有权”的示例

```zig
const std = @import("std");

fn countSpaces(text: []const u8) usize {
    var count: usize = 0;
    for (text) |ch| {
        if (ch == ' ') count += 1;
    }
    return count;
}

test "borrowed slice does not transfer ownership" {
    const input = "hello zig world";
    try std.testing.expectEqual(@as(usize, 2), countSpaces(input));
}
```

这里传进去的是一个只读切片：

- 被调用者只“看见”数据
- 并不拥有这块数据
- 也不负责释放

> **经验法则**：  
> 返回新分配的数据，通常意味着把释放责任交给调用者；  
> 接收 `[]const T`、`*const T` 这类只读视图，通常意味着“只借用、不拥有”。

---

## 栈与堆：先区分两种最常见的内存来源

理解 Zig 内存管理时，最容易先混淆的是：哪些值在栈上，哪些值需要显式分配。

### 栈内存

栈上的值通常具有这些特点：

- 生命周期跟随作用域
- 不需要手动释放
- 分配和回收都很快
- 适合短生命周期、小体积、结构固定的数据

```zig
const std = @import("std");

test "stack values live within scope" {
    var value: i32 = 42;
    value += 1;
    try std.testing.expectEqual(@as(i32, 43), value);
}
```

### 堆内存

堆内存通常具有这些特点：

- 通过分配器显式申请
- 生命周期可以超出当前局部作用域
- 必须手动释放
- 适合运行时才知道大小或生命周期更灵活的数据

```zig
const std = @import("std");

test "heap allocation requires explicit cleanup" {
    const allocator = std.testing.allocator;

    const ptr = try allocator.create(i32);
    defer allocator.destroy(ptr);

    ptr.* = 123;
    try std.testing.expectEqual(@as(i32, 123), ptr.*);
}
```

### 不要把“堆”理解成“更高级”

很多新手刚开始会误以为：

- 栈是“简单情况”
- 堆是“更强大所以更高级”

其实更合理的理解是：

- **能用栈时，通常优先用栈**
- **只有当你确实需要动态生命周期或动态大小时，再引入堆分配**

因为一旦进入堆分配，你就必须额外处理：

- 分配失败
- 释放责任
- 生命周期协调
- 泄漏与悬空问题

---

## 分配器接口：为什么 Zig 要显式传 allocator？

这是 Zig 最有代表性的设计之一。

很多语言会把分配行为隐藏在运行时或容器内部，但 Zig 倾向于把它显式放到接口上：

```zig
fn buildSomething(allocator: std.mem.Allocator) !Result
```

### 这样设计的好处

#### 1. 调用者保留控制权

调用者可以根据场景决定用哪种分配器：

- 调试期用更容易发现错误的分配器
- 批量临时对象用 arena
- 小型嵌入式环境用固定缓冲区分配器
- 特定模块用自定义包装分配器做统计

#### 2. 接口更诚实

一个函数如果会分配内存，那么把 allocator 写进参数列表，本身就在告诉读者：

> “这个操作可能发生分配，可能失败，也会引入资源责任。”

这比偷偷分配、隐式依赖全局状态要清楚得多。

#### 3. 测试更容易做

显式传 allocator 也意味着：

- 你可以在测试里替换分配策略
- 你可以用测试分配器检测泄漏
- 你可以更容易地构造失败路径

---

## 常见分配器：先知道它们解决什么问题

本节不是让你背 API，而是先建立“这些分配器分别适合什么场景”。

## `std.testing.allocator`

这是测试里最值得优先熟悉的分配器。

特点：

- 适合写单元测试
- 能帮助发现泄漏和错误释放
- 最适合作为“调试期安全网”

```zig
const std = @import("std");

test "std.testing.allocator catches leaks when cleanup is missing" {
    const allocator = std.testing.allocator;

    const memory = try allocator.alloc(u8, 16);
    defer allocator.free(memory);

    try std.testing.expectEqual(@as(usize, 16), memory.len);
}
```

> 在教程和日常练习里，如果你正在写 `test`，优先考虑 `std.testing.allocator`。

---

## `std.heap.DebugAllocator`

这是调试期非常有价值的分配器包装器。

特点：

- 更适合开发阶段定位问题
- 可以帮助发现泄漏、重复释放等错误
- 适合需要手动管理生命周期的示例程序

```zig
const std = @import("std");

test "DebugAllocator can be used in development-style examples" {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();

    const allocator = gpa.allocator();

    const data = try allocator.alloc(u8, 32);
    defer allocator.free(data);

    try std.testing.expectEqual(@as(usize, 32), data.len);
}
```

### 一个容易混淆的点

有些资料会把不同版本里的“通用调试分配器”叫法混在一起。  
在本教程当前语境里，更稳妥的做法是：

- 直接按你本地版本的标准库名字来确认
- 不要把旧资料里的习惯叫法硬套进来
- 重点理解“调试期优先选容易发现问题的分配器”这个原则

---

## `std.heap.ArenaAllocator`

Arena 的核心思想是：

> **分配可以很多次，但释放往往集中在最后一次性完成。**

适合场景：

- 一批对象生命周期接近
- 中间不想单独逐个释放
- 更关心整体阶段结束时统一回收

```zig
const std = @import("std");

test "ArenaAllocator frees everything at once" {
    var debug_allocator: std.heap.DebugAllocator(.{}) = .init;
    defer _ = debug_allocator.deinit();

    var arena = std.heap.ArenaAllocator.init(debug_allocator.allocator());
    defer arena.deinit();

    const allocator = arena.allocator();

    const a = try allocator.alloc(u8, 10);
    const b = try allocator.alloc(u8, 20);
    const c = try allocator.alloc(u8, 30);

    try std.testing.expectEqual(@as(usize, 10), a.len);
    try std.testing.expectEqual(@as(usize, 20), b.len);
    try std.testing.expectEqual(@as(usize, 30), c.len);
}
```

### Arena 的代价

Arena 很方便，但不要把它理解成“万能方案”。

代价包括：

- 中间不能细粒度回收单个对象
- 如果一个 arena 生命周期拉得过长，可能变成“温柔版本的泄漏”
- 适合阶段性对象，不适合高度分散、长期交错的生命周期

---

## `std.heap.FixedBufferAllocator`

Fixed Buffer 的核心思想是：

> **在一块预先准备好的缓冲区里分配，不向系统继续扩张。**

适合场景：

- 已知上界的小型任务
- 嵌入式或资源受限环境
- 希望避免动态向系统申请更多内存

```zig
const std = @import("std");

test "FixedBufferAllocator allocates from caller-owned storage" {
    var buffer: [128]u8 = undefined;
    var fba = std.heap.FixedBufferAllocator.init(&buffer);

    const allocator = fba.allocator();

    const first = try allocator.alloc(u8, 32);
    const second = try allocator.alloc(u8, 48);

    try std.testing.expectEqual(@as(usize, 32), first.len);
    try std.testing.expectEqual(@as(usize, 48), second.len);
}
```

### Fixed Buffer 最重要的特点

它最大的价值不是“更快”这一个词，而是：

- 容量边界明确
- 资源来源明确
- 失败模式明确

也就是说，它特别适合那些“**我宁愿早点失败，也不想无限长大**”的场景。

---

## `std.heap.page_allocator`

这是更接近操作系统页面分配的方案。

适合场景通常包括：

- 较大的分配
- 更底层的内存控制
- 你明确知道自己为什么不用其他更高层的封装

```zig
const std = @import("std");

test "page_allocator can allocate memory directly from the system" {
    const allocator = std.heap.page_allocator;

    const data = try allocator.alloc(u8, 64);
    defer allocator.free(data);

    try std.testing.expectEqual(@as(usize, 64), data.len);
}
```

对大多数初学者来说，更重要的不是立刻使用它，而是知道：

- Zig 并不强迫你只通过一种固定策略分配
- 分配器本身就是工程权衡的一部分

---

## 资源清理：`defer` 和 `errdefer` 是本章最该掌握的实战工具

如果只从本章带走两个关键字，那应该是：

- `defer`
- `errdefer`

## `defer`：无论成功还是失败，离开作用域时都执行

```zig
const std = @import("std");

fn makeMessage(allocator: std.mem.Allocator) ![]u8 {
    const msg = try allocator.alloc(u8, 5);
    return msg;
}

test "defer guarantees cleanup at scope end" {
    const allocator = std.testing.allocator;

    const msg = try makeMessage(allocator);
    defer allocator.free(msg);

    try std.testing.expectEqual(@as(usize, 5), msg.len);
}
```

### `defer` 的典型用途

- 释放内存
- 关闭文件
- 解锁互斥锁
- 归还临时资源
- 记录作用域收尾逻辑

---

## `errdefer`：只有在出错返回时才执行

这是 Zig 里非常实用的失败路径收口工具。

```zig
const std = @import("std");

fn makePair(allocator: std.mem.Allocator) !struct { a: []u8, b: []u8 } {
    const a = try allocator.alloc(u8, 8);
    errdefer allocator.free(a);

    const b = try allocator.alloc(u8, 16);
    errdefer allocator.free(b);

    return .{ .a = a, .b = b };
}

test "caller frees successful result" {
    const allocator = std.testing.allocator;

    const pair = try makePair(allocator);
    defer allocator.free(pair.a);
    defer allocator.free(pair.b);

    try std.testing.expectEqual(@as(usize, 8), pair.a.len);
    try std.testing.expectEqual(@as(usize, 16), pair.b.len);
}
```

这里的逻辑很值得体会：

- 如果第二次分配失败，`a` 会被 `errdefer` 自动释放
- 如果函数整体成功返回，`errdefer` 不执行
- 成功路径上的资源责任，再转交给调用者

> **经验法则**：  
> `defer` 适合“无论如何都要做”；  
> `errdefer` 适合“只在失败回滚时做”。

---

## 分配器传递模式：什么才算“Zig 风格”的接口？

一个更符合 Zig 风格的接口，通常会体现以下几个原则。

## 原则 1：不要偷偷依赖全局分配器

不推荐的思路是：

- 在模块内部藏一个全局 allocator
- 所有函数默认都偷偷用它

因为这样会让：

- 分配行为不透明
- 测试替换困难
- 生命周期边界不清楚
- 模块之间耦合变重

## 原则 2：让会分配的函数显式接收 allocator

```zig
const std = @import("std");

fn duplicate(allocator: std.mem.Allocator, input: []const u8) ![]u8 {
    const output = try allocator.alloc(u8, input.len);
    @memcpy(output, input);
    return output;
}

test "allocator-passing keeps ownership explicit" {
    const allocator = std.testing.allocator;

    const copy = try duplicate(allocator, "zig");
    defer allocator.free(copy);

    try std.testing.expectEqualStrings("zig", copy);
}
```

## 原则 3：文档和命名要表达资源责任

例如函数名、注释和返回值设计应当帮助读者判断：

- 返回的是新分配副本，还是借用视图？
- 释放责任在调用者，还是仍在当前对象内部？
- 返回值是否可以长期保存？

如果接口语义不清楚，再漂亮的实现也很危险。

---

## 容器和分配器：哪些是稳定原则，哪些是版本敏感区域？

这一节非常重要，因为很多读者会同时接触：

- 官方文档
- 旧博客
- 不同 Zig 版本的代码片段
- 当前开发版标准库源码

于是就很容易问：

> “为什么同样是 `ArrayList`，不同资料里的写法长得完全不一样？”

答案通常不是“谁对谁错”，而是：

> **容器 API 属于比基础语法更容易随版本演进的区域。**

---

## 版本敏感说明：阅读容器 API 时的正确姿势

### 先记住：稳定的是原则，不一定是某个具体方法名

更值得长期记住的是这些原则：

1. **把容器理解成状态 + 分配行为**
2. **显式分配时要有 allocator 上下文**
3. **释放责任需要写清楚**
4. **当前版本的标准库源码比旧文章更可靠**

### 对当前教程语境更稳妥的理解方式

在较新的 Zig 版本语境里，很多容器 API 更强调：

- 空状态要明确
- 扩容时显式传入 allocator
- 销毁时明确给出释放所需上下文

因此你可能会看到这类风格：

```zig
const std = @import("std");

test "current ArrayList style is explicit about allocation context" {
    const allocator = std.testing.allocator;

    var list: std.ArrayList(u32) = .empty;
    defer list.deinit(allocator);

    try list.append(allocator, 42);
    try list.append(allocator, 100);

    try std.testing.expectEqual(@as(usize, 2), list.items.len);
    try std.testing.expectEqual(@as(u32, 42), list.items[0]);
}
```

### 这一节真正想提醒你的是什么？

不是让你死记：

- “永远必须这样写”
- “旧文章一定都错了”
- “以后 Zig 永远不会再变”

而是提醒你：

- **基础语法通常比容器 API 更稳定**
- **容器、构建系统、I/O 等区域更容易随版本迭代**
- **看到不同写法时，优先确认本地 Zig 版本和当前标准库源码**

---

## 一个容易踩坑的误区：把版本快照当成永恒规范

在开发版语境下，尤其要避免这几种心态：

### 误区 1：看到一种写法，就把它当成“唯一正确答案”

更好的做法是：

- 先确认版本
- 再确认上下文
- 最后理解设计方向

### 误区 2：只记方法名，不理解资源责任

即使 API 名字变了，真正重要的问题仍然是：

- 什么时候发生分配？
- 谁拥有底层内存？
- 释放时需要什么上下文？

### 误区 3：用旧资料时不做版本核对

这在下面这些区域尤其危险：

- 容器
- 构建系统
- I/O
- 某些调试工具接口

---

## 线程安全不是“换一个分配器名字”就自动得到的

多线程场景下，分配器问题常常被误解。

更稳妥的理解方式是：

- 线程安全首先是**共享边界和同步策略**的问题
- 分配器只是整个资源共享模型的一部分
- 不是说“换个听起来线程安全的封装”就一切自动正确

因此，在并发场景下你应优先问：

1. 哪些对象真的需要跨线程共享？
2. 是否可以减少共享分配器的使用范围？
3. 是否能把分配限定在更局部的线程上下文里？
4. 当前版本标准库到底提供了什么能力？

本教程不把某个具体“线程安全分配器包装器”写成通用配方，原因正是：

> **API 可能变，真正稳定的是资源边界与同步责任的设计。**

---

## 内存管理中的常见设计建议

## 1. 能不分配就不分配

很多时候，最好的内存优化不是换分配器，而是根本不分配。

例如：

- 传切片而不是复制整块数据
- 复用缓冲区而不是不断新建
- 用栈对象而不是堆对象
- 推迟分配，直到确实需要

## 2. 让失败路径和成功路径一样清楚

如果你的代码只有“成功怎么走”很清楚，而“中途失败怎么回滚”很模糊，那么资源 bug 往往只是时间问题。

## 3. 优先写出责任边界清楚的代码

比起一开始就追求“最省一次分配”，更重要的是：

- 谁创建
- 谁拥有
- 谁释放
- 谁只借用

## 4. 先正确，再优化

很多内存技巧都能提性能，但越底层的优化越依赖正确前提。  
所以顺序通常应当是：

1. 先把生命周期和责任边界写清楚
2. 先用调试期工具验证没有明显泄漏
3. 再根据热点决定是否要进一步优化

---

## 本章小结

这一章最值得你真正带走的，不是某个分配器的名字，而是下面这些判断。

### 你应该优先记住的内容

- Zig 把内存视为需要显式管理的资源
- 分配器不是附属品，而是接口设计的一部分
- “谁分配，谁释放”是最重要的资源责任原则之一
- `defer` 和 `errdefer` 是收拢资源清理逻辑的关键工具
- 栈和堆不是“高级/低级”的关系，而是不同的生命周期选择
- 调试期优先选择更容易发现问题的分配策略
- 容器 API 比基础语法更容易随版本演进

### 读完这一章后，你应该能开始回答这些问题

- 这个函数是否会分配？
- 如果会分配，为什么 allocator 应该显式传入？
- 返回值的所有权属于谁？
- 清理逻辑是否能覆盖失败路径？
- 这里是在借用数据，还是在转移资源责任？
- 这段容器代码是稳定原则，还是版本敏感写法？

如果你已经能带着这些问题去阅读标准库和第三部分案例，那么这一章就达到目的了。

---

> 💡 **下一章预告**
>
> 下一章我们将进入[接口、组合与设计模式](chapter-interfaces.md)，继续讨论：当代码规模变大时，应该如何组织抽象、表达能力边界，以及在编译期抽象与运行时抽象之间做出选择。