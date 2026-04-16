# 常用标准库模块详解

这一章不是标准库 API 手册，也不打算把所有函数逐条列出来。  
它的目标更实际一些：建立一组**独立写 Zig 程序时最值得先掌握的标准库模块直觉**。

如果上一章《标准库导航与阅读指南》主要回答的是：

- 某类能力大致分布在哪些模块里
- 遇到问题时应该先去哪里找
- 面对版本差异时应该如何核对

那么这一章主要回答的是：

- 哪些模块最值得先掌握
- 它们最常见的入口是什么
- 最小用法通常长什么样
- 什么时候应该转去别的章节继续深入

阅读这一章时，建议始终记住一个原则：

> **建立"模块职责 → 高频入口 → 最小示例 → 去哪里深入"的直觉，不要试图一次记住所有 API。**

---

## 为什么要单独学“常用标准库模块”？

学 Zig 时，语法和标准库几乎总是交织在一起出现。

刚学会变量、函数、切片和错误处理之后，很快就会遇到下面这些问题：

- 怎么比较两个字符串？
- 怎么把值格式化到缓冲区里？
- 怎么快速打印调试信息？
- 怎么写测试断言？
- 怎么读文件、遍历目录？
- 怎么拿到命令行参数？
- 怎么选择合适的 allocator？

这些问题都不是“高级专题”，却几乎一定会出现在真实代码里。  
如果没有一组稳定的标准库入口直觉，后续很多章节都会显得零散。

因此，本章的重点不是“知识覆盖率”，而是：

- **优先掌握最常见的入口**
- **优先理解它们解决什么问题**
- **优先知道什么时候该想到哪个模块**

---

## `std.mem`

`std.mem` 是 Zig 中最基础、也最高频的标准库模块之一。

很多初学者一开始会把“字符串处理”理解成某种单独的大主题，但在 Zig 里，更常见的现实是：  
手上的往往不是"神秘字符串对象"，而是 `[]const u8` 这样的**字节切片**。

这也是为什么很多看起来像“字符串问题”的操作，最终都会落到 `std.mem` 上。

### 这一节最值得先认识的入口

最值得优先熟悉这些函数：

- `eql`
- `startsWith`
- `endsWith`
- `indexOf`
- `trim`
- `copyForwards`

它们覆盖了最常见的几类需求：

- 比较两个切片是否相等
- 判断前缀和后缀
- 查找子串或字节
- 去掉前后空白
- 在缓冲区之间复制数据

### `eql`：比较切片内容

在 Zig 里，两个切片是否“相等”，通常不是直接用 `==`，而是显式比较内容：

```zig
const std = @import("std");

pub fn main() void {
    const a = "zig";
    const b = "zig";
    const c = "zag";

    std.debug.print("a == b: {}\n", .{std.mem.eql(u8, a, b)});
    std.debug.print("a == c: {}\n", .{std.mem.eql(u8, a, c)});
}
```

**预期输出：**

```shell
a == b: true
a == c: false
```

这里的 `u8` 表示比较的是 `u8` 元素切片。  
对字符串字面量来说，最常见的就是 `u8`。

### `startsWith` / `endsWith`

判断前缀和后缀时，`std.mem` 也提供了直接入口：

```zig
const std = @import("std");

pub fn main() void {
    const name = "chapter-standard-library-detail.md";

    std.debug.print("starts with chapter: {}\n", .{
        std.mem.startsWith(u8, name, "chapter"),
    });

    std.debug.print("ends with .md: {}\n", .{
        std.mem.endsWith(u8, name, ".md"),
    });
}
```

**预期输出：**
```shell
starts with chapter: true
ends with .md: true
```

这类函数在处理：

- 文件名
- 扩展名
- 协议前缀
- 命令行参数前缀

时非常常见。

### `indexOf`

在切片中查找子串时，可以用 `indexOf`：

```zig
const std = @import("std");

pub fn main() void {
    const text = "hello zig world";

    if (std.mem.indexOf(u8, text, "zig")) |pos| {
        std.debug.print("found at: {}\n", .{pos});
    } else {
        std.debug.print("not found\n", .{});
    }
}
```

这个返回值是可选值 `?usize`：

- 找到时返回位置
- 找不到时返回 `null`

### `trim`

处理用户输入、文件内容或配置项时，经常需要先去掉首尾空白：

```zig
const std = @import("std");

pub fn main() void {
    const raw = "  zig  ";
    const trimmed = std.mem.trim(u8, raw, " ");

    std.debug.print("trimmed: [{s}]\n", .{trimmed});
}
```

注意这里第三个参数是“要去掉的字符集合”。  
最常见的例子是空格、制表符、换行符等。

### `copyForwards`

已经有一个目标缓冲区，想把内容复制进去时，可以用 `copyForwards`：

```zig
const std = @import("std");

pub fn main() void {
    var buffer: [8]u8 = undefined;
    const source = "zig";

    @memset(&buffer, 0);
    std.mem.copyForwards(u8, buffer[0..source.len], source);

    std.debug.print("{s}\n", .{buffer[0..source.len]});
}
```

它常用于：

- 手动管理缓冲区
- 处理字节数组
- 在已有内存区域中构造结果

### 使用 `std.mem` 时要建立的直觉

使用 `std.mem` 时，核心直觉是：

1. 处理的往往是切片，而不是"高级字符串对象"
2. 切片比较通常要比较内容，而不是依赖某种隐式相等语义
3. 很多文本问题，在 Zig 里首先是“字节序列问题”
4. 已经有一块缓冲区时，复制、查找、裁剪等操作往往都可以用 `std.mem` 完成

> **相关阅读**：关于切片、数组和底层数据视图的关系，可以回看[复合类型](../part1-basics/chapter-compound-types.md)。

---

## `std.fmt`

`std.fmt` 主要负责**格式化**。

它经常出现在两类场景中：

1. 把值格式化到某个输出目标
2. 在内存中构造一段格式化后的文本

很多初学者最先接触格式化，是通过 `std.debug.print`。  
但当需要把文本写进缓冲区、或分配出一个新的字符串时，就会更明显地接触到 `std.fmt`。

### 这一节最值得先认识的入口

建议优先理解：

- `bufPrint`
- `allocPrint`

它们分别对应两类非常常见的需求：

- 用**已有缓冲区**格式化文本
- 用**allocator 分配新字符串**并格式化文本

### `bufPrint`：把格式化结果写入缓冲区

已经有一块固定大小的缓冲区时，可以用 `bufPrint`：

```zig
const std = @import("std");

pub fn main() !void {
    var buffer: [64]u8 = undefined;

    const result = try std.fmt.bufPrint(
        &buffer,
        "name={s}, version={d}",
        .{ "zig", 16 },
    );

    std.debug.print("{s}\n", .{result});
}
```

这里要注意几点：

- `result` 是一个切片，表示**实际写入的那部分内容**
- 如果缓冲区不够大，`bufPrint` 会返回错误
- 这种方式特别适合：
  - 固定格式的小文本
  - 避免额外堆分配
  - 临时拼装日志或消息

### `allocPrint`：分配并返回格式化结果

不想自己先准备缓冲区，而是希望直接得到一段新分配的文本时，可以用 `allocPrint`：

```zig
const std = @import("std");

pub fn main() !void {
    const allocator = std.heap.page_allocator;

    const text = try std.fmt.allocPrint(
        allocator,
        "hello, {s}!",
        .{"zig"},
    );
    defer allocator.free(text);

    std.debug.print("{s}\n", .{text});
}
```

这里的关键语义是：

- `allocPrint` 会分配内存
- 所以要显式传入 allocator
- 返回的字符串需要由调用者负责释放

这也说明 `std.fmt` 很容易和 allocator 联系起来。

### `std.fmt` 和 `std.debug.print` 的关系

可以这样理解：

- `std.debug.print` 更像“直接输出”
- `std.fmt` 更像“负责格式化能力本身”

在实际代码中，它们经常一起出现：

- 可能先用 `std.fmt` 把文本构造好
- 再用别的方式写到文件、网络、缓冲区或调试输出中

### 使用 `std.fmt` 时要建立的直觉

使用 `std.fmt` 时，核心要点是：

1. 先区分“输出到哪里”和“如何格式化”
2. 有固定缓冲区时，优先考虑 `bufPrint`
3. 需要动态分配文本时，再考虑 `allocPrint`
4. 一旦发生分配，就要立刻想到释放责任

> **相关阅读**：
> - 关于 allocator 与释放责任的系统理解，请继续阅读[内存管理模型](chapter-memory-management.md)。
> - 只是想快速打印调试信息的话，可以继续看下一节 `std.debug`。

---

## `std.debug`

`std.debug` 是学习和调试阶段最常用的标准库入口之一。

它的重要性并不在于“复杂”或“高级”，而在于：  
**它能更快看清程序状态。**

对初学者来说，最常见的用途通常就是：

- `std.debug.print`
- `std.debug.assert`

### `std.debug.print`

这是最常见的调试输出方式之一：

```zig
const std = @import("std");

pub fn main() void {
    const count = 3;
    const name = "zig";

    std.debug.print("count={d}, name={s}\n", .{ count, name });
}
```

它特别适合：

- 临时观察变量状态
- 学习阶段验证程序行为
- 快速确认某条路径是否执行到

但也要注意：  
它更适合“调试与学习阶段”，而不是把它理解成完整日志系统的替代品。

### `std.debug.assert`

想表达"这里必须满足某个条件，否则程序逻辑就不成立"时，可以用 `assert`：

```zig
const std = @import("std");

fn divide(a: i32, b: i32) i32 {
    std.debug.assert(b != 0);
    return @divTrunc(a, b);
}

pub fn main() void {
    const result = divide(10, 2);
    std.debug.print("result={d}\n", .{result});
}
```

`assert` 的使用重点不是“处理用户输入错误”，而是：

- 验证程序内部不变量
- 捕捉不应该发生的逻辑状态
- 在调试期尽早暴露问题

### 使用 `std.debug` 时要建立的直觉

1. `print` 很适合调试阶段快速观察状态
2. `assert` 适合表达“不应该被破坏的假设”
3. 调试输出能更快定位问题，但不能替代清晰的设计
4. 调试期工具越早介入，越容易发现问题的真实来源

> **相关阅读**：
> - 关于错误路径和失败处理的系统理解，请阅读[错误处理：!T、try 与 errdefer](../part1-basics/chapter-error-handling.md)。
> - 关于如何在测试中验证行为，请继续阅读后面的 `std.testing` 小节与[测试与验证：从单元测试到基准测量](chapter-testing.md)。

---

## `std.testing`

`std.testing` 是 Zig 标准库中最核心的测试辅助入口。它提供了一组断言函数和测试专用设施，用于在 `test` 块中验证代码行为。最常用的 API 包括：

- **`expect`** — 验证布尔表达式为真，适合简单条件判断。
- **`expectEqual`** — 比较两个值是否相等，失败时能清晰显示期望值与实际值的差异。
- **`expectError`** — 验证函数是否返回了预期的错误，用于测试错误路径。
- **`std.testing.allocator`** — 测试专用分配器，能自动检测内存泄漏和重复释放。

> **相关阅读**：断言函数的完整示例和测试方法论见[《测试与验证》（chapter-testing.md）](chapter-testing.md)。

### 使用 `std.testing` 时要建立的直觉

1. 测试不是额外装饰，而是接口设计的一部分
2. 错误路径、资源释放、边界条件都值得测试
3. `std.testing.allocator` 的价值不只是"能分配"，而是"更容易暴露泄漏和生命周期问题"

---

## `std.fs`

只要开始写真实程序，文件和目录几乎一定会出现。
这时，`std.fs` 往往就是最该先想到的模块。

它负责的典型问题包括：

- 打开文件
- 创建文件
- 读取文件内容
- 遍历目录
- 读取文件元信息

### 心智模型

初次接触 `std.fs` 时，不必急着记很多 API 名字。  
更重要的是建立下面这个直觉：

- **文件和目录相关问题，优先想到 `std.fs`**
- **很多操作都围绕“某个目录视角”或“某个文件句柄”展开**
- **真实工程里，`std.fs` 往往会和 `std.process`、`std.mem`、`std.fmt` 一起出现**

### 一个最小示例：创建并写入文件

下面这个例子展示一个最小文件写入过程：

```zig
const std = @import("std");

pub fn main() !void {
    const cwd = std.fs.cwd();

    const file = try cwd.createFile("example.txt", .{});
    defer file.close();

    try file.writeAll("hello from zig\n");
}
```

这里有几个关键点：

- `std.fs.cwd()` 表示当前工作目录
- 通过目录对象去创建文件
- 文件句柄用完后要关闭

### 一个最小示例：遍历目录项

目录遍历也是很常见的需求：

```zig
const std = @import("std");

pub fn main() !void {
    const cwd = std.fs.cwd();
    var dir = try cwd.openDir(".", .{ .iterate = true });
    defer dir.close();

    var it = dir.iterate();
    while (try it.next()) |entry| {
        std.debug.print("{s}\n", .{entry.name});
    }
}
```

这个例子的核心在于理解：

- 目录遍历通常需要显式打开目录
- 遍历器逐项产出条目
- 文件系统操作天然更接近“资源操作”，所以常伴随错误处理和关闭逻辑

### 使用 `std.fs` 时要建立的直觉

1. 文件系统操作通常会失败，所以错误处理是常态
2. 打开文件和目录往往意味着资源管理责任
3. 很多能力都从某个目录对象出发，而不是全局“神奇函数”
4. `std.fs` 往往是 CLI 工具、配置读取、代码生成等场景的核心模块

> **相关阅读**：关于 `std.fs` 在更真实工具中的使用方式，可以继续阅读[实战案例 - CLI 工具开发](../part3-practice/chapter-cli-tool.md)。

---

## `std.process`

`std.process` 主要和“程序作为一个进程运行时能接触到的上下文”有关。

可以把它和下面几类需求联系起来：

- 读取命令行参数
- 读取环境变量
- 处理退出状态
- 理解程序运行时的外部上下文

### 心智模型

核心要点是：

- **只要问题和参数、环境变量、进程上下文有关，就先想到 `std.process`**
- 这类能力天然更接近“程序入口”与“操作系统环境”

### 一个最小示例：读取参数

在 Zig 0.16-dev 中，程序入口通过 `std.process.Init` 参数显式传递进程上下文，命令行参数就是其中的一部分。核心思路是：

- 参数来自进程启动时传入的上下文，通过 `init.minimal.args` 获取
- 使用 `.iterate()` 或 `.iterateAllocator()` 创建迭代器，逐个读取参数
- 不再需要手动分配和释放内存来收集参数

下面给出一个示例：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) void {
    var args = init.minimal.args.iterate();
    while (args.next()) |arg| {
        std.debug.print("{s}\n", .{arg});
    }
}
```

这个例子最重要的重点是：

- 参数通过程序入口的 `Init` 参数显式传入，而非调用全局函数获取
- `.iterate()` 返回一个迭代器，用 `while` + `.next()` 逐个遍历
- 进程相关 API 比 `std.mem`、`std.debug` 这类模块更容易受版本变化影响

### 一个最小示例：读取环境变量

环境变量也是常见入口之一。在 0.16-dev 中，`Init` 参数提供了预初始化的 `environ_map`，可以直接按名称查找：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) void {
    if (init.environ_map.get("HOME")) |home| {
        std.debug.print("HOME={s}\n", .{home});
    } else {
        std.debug.print("HOME is not set\n", .{});
    }
}
```

这里体现了 0.16-dev 的一个重要设计特点：

- 环境变量已经由运行时预先解析到 `environ_map` 中，直接用 `.get()` 查询即可
- 不再需要手动分配内存或处理 `EnvironmentVariableNotFound` 错误——找不到时返回 `null`

### 使用 `std.process` 时要建立的直觉

1. 参数与环境变量都属于"进程上下文"的一部分
2. 在 0.16-dev 中，这些上下文通过 `std.process.Init` 参数在程序入口**显式传入**，而非通过全局函数获取
3. 这种设计让依赖关系更清晰：函数签名本身就说明了"我需要进程上下文"
4. 遇到版本差异时，优先抓住"程序上下文由谁提供、怎样访问"这一层稳定思路

> **相关阅读**：关于参数处理与进程上下文在更真实工具程序中的使用方式，可以继续阅读[实战案例 - CLI 工具开发](../part3-practice/chapter-cli-tool.md)。

---

## `std.heap`

`std.heap` 是系统接触 allocator 分类时最常见的标准库入口之一。这一节只建立**第一轮 allocator 直觉**，认识几个常见名字即可。

常见的分配器：

- **`page_allocator`** — 直接向操作系统申请整页内存。随手可用，适合入门示例，但不是所有工程场景的最佳默认选择。
- **`ArenaAllocator`** — 适合"集中分配、集中释放"的场景，减少逐个释放的负担，所有对象共享同一个释放时机。
- **`FixedBufferAllocator`** — 在一块已有的固定内存上做分配，不需要向操作系统再要内存。
- **`std.testing.allocator`** — 测试专用分配器，能自动检测泄漏（详见 `std.testing` 一节）。

> **相关阅读**：完整的分配器示例和使用指南见[《内存管理模型》（chapter-memory-management.md）](chapter-memory-management.md)。

### 使用 `std.heap` 时要建立的直觉

1. Zig 的 allocator 不是背景设施，而是显式接口的一部分
2. 不同 allocator 解决的是不同资源组织问题
3. 一旦发生分配，就要立即想到：谁负责释放？什么时候释放？

---

## 模块如何组合使用？

真正的 Zig 代码，很少只使用单独一个标准库模块。  
更常见的情况是：几个模块以很小的颗粒度频繁组合。

### `std.mem` + `std.fmt`

很常见于：

- 先处理输入切片
- 再把结果格式化输出

例如：

- 先 `trim`
- 再 `startsWith`
- 然后 `bufPrint` 拼装消息

### `std.debug` + `std.testing`

很常见于：

- 调试阶段快速观察状态
- 再写测试把行为固定下来

也就是说：

- `std.debug` 用于快速“看见”
- `std.testing` 用于长期“验证”

### `std.fs` + `std.process`

这是 CLI、小工具和工程脚本里非常常见的组合：

- 从 `std.process` 读取参数
- 用 `std.fs` 处理文件和目录
- 再结合 `std.mem`、`std.fmt` 组织输出

### `std.heap` + 其他模块

只要问题进入“动态内存”领域，`std.heap` 很快就会参与进来：

- `std.fmt.allocPrint`
- 参数收集
- 文件读取到动态缓冲区
- 更复杂的数据结构构造

所以在真实代码里，`std.heap` 往往不是单独使用，而是以“allocator 提供者”的身份参与其他模块。

---

## 本章小结

这一章的核心目标是建立下面这些第一轮直觉：

1. 处理切片、字节和很多“字符串问题”时，优先想到 `std.mem`
2. 处理格式化时，优先想到 `std.fmt`
3. 观察程序状态和验证不变量时，优先想到 `std.debug`
4. 写测试与断言时，优先想到 `std.testing`
5. 文件和目录相关需求，优先想到 `std.fs`
6. 参数、环境变量、进程上下文相关需求，优先想到 `std.process`
7. 动态分配和 allocator 相关入口，优先想到 `std.heap`

如果已经建立了这张“高频模块入口地图”，这一章的目标就达成了。  
接下来的深入学习中，无需背完整 API，可以按下面的思路继续推进：

- 想系统理解 allocator 和资源责任 → 读[内存管理模型](chapter-memory-management.md)
- 想系统学习测试方法 → 读[测试与验证：从单元测试到基准测量](chapter-testing.md)
- 想看文件系统与参数处理在真实工具中的组合 → 读[实战案例 - CLI 工具开发](../part3-practice/chapter-cli-tool.md)

回到 Zig 标准库本身，最稳定、也最值得反复建立的能力始终是：

- 知道遇到问题时先想到哪个模块
- 知道自己要找的是“模块职责”还是“具体 API”
- 知道什么时候该继续读源码和当前版本文档确认细节
