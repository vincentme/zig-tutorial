# 常用标准库模块详解

这一章讲解标准库中最常用、也最容易在真实程序里一起出现的几个模块：

- `std.mem`
- `std.fmt`
- `std.debug`
- `std.testing`
- `std.fs`
- `std.process`
- `std.ArrayList`：动态数组
- `std.HashMap`：哈希表与键值存储
- `std.heap`

---

## `std.mem`

`std.mem` 是最基础、也最常用的标准库模块之一。

在 Zig 里，很多看起来像“字符串处理”的问题，本质上其实是：

- 处理 `[]const u8`
- 处理 `[]u8`
- 处理一段连续内存
- 在已有缓冲区上做查找、比较、裁剪、复制

所以 `std.mem` 的核心不是“高级文本功能”，而是：

> **把切片和内存当作程序中的基础数据视图来处理。**

常见入口包括：

- `std.mem.eql`
- `std.mem.startsWith`
- `std.mem.endsWith`
- `std.mem.indexOf`
- `std.mem.trim`
- `std.mem.splitScalar`
- `std.mem.copyForwards`

下面这个例子模拟一个很常见的任务：读取一行配置文本，判断格式、拆分键值、去掉空白，并把结果复制到固定缓冲区中。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    const line = "  mode = release-fast  ";

    // 先把首尾空白去掉，后续判断和拆分都基于规范化后的切片。
    const trimmed = std.mem.trim(u8, line, " \t\r\n");
    std.debug.print("trimmed = [{s}]\n", .{trimmed});

    // 先做一个最基本的格式检查，确认这一行至少像 key=value。
    if (!std.mem.containsAtLeast(u8, trimmed, 1, "=")) {
        std.debug.print("invalid config line\n", .{});
        return;
    }

    // 按分隔符拆开，再分别清理 key 和 value 两侧的空白。
    var parts = std.mem.splitScalar(u8, trimmed, '=');
    const raw_key = parts.next() orelse return;
    const raw_value = parts.next() orelse return;

    const key = std.mem.trim(u8, raw_key, " \t\r\n");
    const value = std.mem.trim(u8, raw_value, " \t\r\n");

    if (std.mem.eql(u8, key, "mode")) {
        std.debug.print("recognized key: {s}\n", .{key});
    }

    if (std.mem.startsWith(u8, value, "release")) {
        std.debug.print("release mode detected: {s}\n", .{value});
    }

    if (std.mem.endsWith(u8, value, "fast")) {
        std.debug.print("fast suffix detected\n", .{});
    }

    if (std.mem.indexOf(u8, value, "-")) |pos| {
        std.debug.print("separator '-' at index {}\n", .{pos});
    }

    // 已经有目标缓冲区时，可以把结果复制进去，供后续继续处理。
    var buffer: [32]u8 = undefined;
    @memset(&buffer, 0);
    std.mem.copyForwards(u8, buffer[0..value.len], value);

    std.debug.print("copied value = {s}\n", .{buffer[0..value.len]});
}
```

### `eql`：比较切片内容

切片比较最常见的需求是“内容是否相同”，这时通常用 `std.mem.eql`。

```zig-tutorial/src/part2-advanced/chapter-standard-library-detail.md#L82-93
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const a = "zig";
    const b = "zig";
    const c = "zag";

    // `eql` 比较的是切片内容，而不是“是不是同一个对象”。
    std.debug.print("a == b: {}\n", .{std.mem.eql(u8, a, b)});
    std.debug.print("a == c: {}\n", .{std.mem.eql(u8, a, c)});
}
```

这里的 `u8` 表示比较的是 `u8` 元素切片。对字符串字面量来说，这通常就是最常见的写法。

### `startsWith` / `endsWith`

判断前缀和后缀时，直接使用 `std.mem.startsWith` 和 `std.mem.endsWith`。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const name = "chapter-standard-library-detail.md";

    // 前缀和后缀判断常用于文件名、参数和协议头处理。
    std.debug.print("starts with chapter: {}\n", .{
        std.mem.startsWith(u8, name, "chapter"),
    });
    std.debug.print("ends with .md: {}\n", .{
        std.mem.endsWith(u8, name, ".md"),
    });
}
```

这类判断在下面这些场景里都很常见：

- 文件扩展名判断
- 命令行参数前缀判断
- 协议头判断
- 配置项前缀判断

### `find`

查找子串时，使用`std.mem.find`，它返回 `?usize`：

- 找到时返回位置
- 找不到时返回 `null`

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const text = "hello zig world";

    // `find` 返回可选值：找到时是位置，找不到时是 `null`。
    if (std.mem.find(u8, text, "zig")) |pos| {
        std.debug.print("found at: {}\n", .{pos});
    } else {
        std.debug.print("not found\n", .{});
    }
}
```

### `trim`

处理用户输入、配置文件、文本行时，`trim` 几乎是高频操作。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const raw = "  zig  ";
    const trimmed = std.mem.trim(u8, raw, " ");

    std.debug.print("trimmed: [{s}]\n", .{trimmed});
}
```

第三个参数不是“某一种空白模式”，而是“要裁掉的字符集合”。因此你经常会看到：

- `" "`
- `" \t\r\n"`

### `copyForwards`

当你已经有目标缓冲区时，`copyForwards` 是最直接的复制方式之一。

```zig-tutorial/src/part2-advanced/chapter-standard-library-detail.md#L153-164
const std = @import("std");

pub fn main(_: std.process.Init) void {
    var buffer: [8]u8 = undefined;
    const source = "zig";

    // 先把缓冲区清零，便于观察复制后的结果。
    @memset(&buffer, 0);
    std.mem.copyForwards(u8, buffer[0..source.len], source);

    std.debug.print("{s}\n", .{buffer[0..source.len]});
}
```

### 使用 `std.mem` 时要建立的直觉

1. 很多“字符串问题”在 Zig 里首先是“字节切片问题”
2. 先想清楚你手里的是数组、切片，还是固定缓冲区
3. `std.mem` 经常出现在输入处理、协议解析、配置解析、路径判断的第一步
4. 它通常不负责“拥有数据”，而是负责“处理已有数据视图”

> **相关阅读**：关于数组、切片和底层视图的关系，可以回看[复合类型](../part1-basics/chapter-compound-types.md)。

---

## `std.fmt`

`std.fmt` 负责格式化。

它解决的问题不是“打印到哪里”，而是：

- 如何把值格式化成文本
- 如何把格式化结果写入缓冲区
- 如何在需要时分配一段新的格式化结果

所以 `std.fmt` 的核心职责可以概括为：

> **把结构化数据变成文本表示。**

### 常见格式化占位符

最常用的四个：

- `{}`：默认格式
- `{d}`：十进制整数
- `{s}`：字符串切片
- `{any}`：调试输出任意值

这几个占位符的区别可以先这样理解：

- `{}` 表示“使用默认格式”，适合布尔值这类简单值的直接输出
- `{d}` 明确表示“按十进制输出整数”，比 `{}` 更适合计数、长度、端口号这类数值
- `{s}` 用于字符串切片，最常见的是 `[]const u8`
- `{any}` 更偏向调试用途，适合快速查看数组、元组、结构体等复合值

可以用一个很简单的顺序来判断：

1. 字符串切片优先用 `{s}`
2. 整数优先用 `{d}`
3. 简单值快速输出时可以用 `{}`
4. 复合值调试时优先想到 `{any}`

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const name = "zig";
    const count: u32 = 3;
    const enabled = true;
    const pair = .{ name, count };

    std.debug.print("name={s}, count={d}\n", .{ name, count });
    std.debug.print("enabled={}\n", .{enabled});
    std.debug.print("pair={any}\n", .{pair});
}
```

### 构造一条完整消息

下面这个例子模拟一个常见任务：程序先在固定缓冲区里构造一条消息，再在需要长期保存时分配一份完整文本。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    var stack_buffer: [128]u8 = undefined;

    // 已有固定缓冲区时，直接把格式化结果写进去。
    const short_message = try std.fmt.bufPrint(
        &stack_buffer,
        "user={s} id={} active={}",
        .{ "alice", 42, true },
    );

    std.debug.print("short message: {s}\n", .{short_message});

    // 需要独立拥有一段新文本时，再使用会分配内存的 `allocPrint`。
    const allocator = std.heap.page_allocator;
    const long_message = try std.fmt.allocPrint(
        allocator,
        "report: user={s}, score={d}, tags={any}",
        .{ "alice", 98, [_][]const u8{ "zig", "std", "fmt" } },
    );
    defer allocator.free(long_message);

    std.debug.print("long message: {s}\n", .{long_message});
}
```

这个例子体现了 `std.fmt` 最常见的两条主线：

- **短生命周期、固定大小**：优先 `bufPrint`
- **结果长度不方便预估，或者需要独立拥有结果**：使用 `allocPrint`

### `bufPrint`：把格式化结果写入缓冲区

`bufPrint` 的典型场景是：

- 你已经有一块栈上数组
- 你不想做堆分配
- 你只需要一段临时结果

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    var buffer: [64]u8 = undefined;

    // 返回值是“实际写入的那一段切片”，而不是整个数组。
    const result = try std.fmt.bufPrint(
        &buffer,
        "name={s}, version={d}",
        .{ "zig", 16 },
    );

    std.debug.print("{s}\n", .{result});
}
```

这里要注意：

- 返回值是切片，不是整个数组
- 它表示“实际写入的那一段”
- 如果缓冲区不够大，会返回错误

### `allocPrint`：分配并返回格式化结果

当你不想自己准备缓冲区，或者结果长度不容易预估时，`allocPrint` 更方便。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    const allocator = std.heap.page_allocator;

    // 这里会发生分配，因此结果的释放责任也落在调用者身上。
    const text = try std.fmt.allocPrint(
        allocator,
        "hello, {s}!",
        .{"zig"},
    );
    defer allocator.free(text);

    std.debug.print("{s}\n", .{text});
}
```

这里最重要的不是“会格式化”，而是：

- 它发生了分配
- 所以必须传入 allocator
- 返回结果由调用者负责释放

### 使用 `std.fmt` 时要建立的直觉

1. 先区分“格式化”与“输出”
2. 字符串切片优先想到 `{s}`，整数优先想到 `{d}`
3. 复合值调试时可以先用 `{any}`
4. 有固定缓冲区时，优先考虑 `bufPrint`
5. 需要独立拥有结果时，再考虑 `allocPrint`
6. 一旦用了 `allocPrint`，就要立刻想到 allocator 和释放责任

> **相关阅读**：allocator 的系统理解见[内存管理模型](chapter-memory-management.md)。

---

## `std.debug`

`std.debug` 是学习阶段和开发阶段都非常高频的模块。

它最重要的价值不是“功能多”，而是：

> **让你更快看见程序当前的状态，并尽早暴露不应该发生的逻辑错误。**

最常用的入口通常就是两个：

- `std.debug.print`
- `std.debug.assert`

下面这个例子模拟一个简单的解析流程：先打印中间状态，再用 `assert` 验证关键不变量。

```zig
const std = @import("std");

fn parsePort(text: []const u8) !u16 {
    std.debug.print("raw input = [{s}]\n", .{text});

    const trimmed = std.mem.trim(u8, text, " \t\r\n");
    std.debug.print("trimmed input = [{s}]\n", .{trimmed});

    // `assert` 用来表达内部假设：这里不应该再出现空输入。
    std.debug.assert(trimmed.len > 0);

    const port = try std.fmt.parseInt(u16, trimmed, 10);
    std.debug.assert(port > 0);

    std.debug.print("parsed port = {}\n", .{port});
    return port;
}

pub fn main(_: std.process.Init) !void {
    const port = try parsePort(" 8080 ");
    std.debug.print("final port = {}\n", .{port});
}
```

### `std.debug.print`

这是最常见的调试输出方式之一。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    const count = 3;
    const name = "zig";

    // 调试阶段最常见的用法就是直接把关键状态打印出来。
    std.debug.print("count={}, name={s}\n", .{ count, name });
}
```

它特别适合：

- 临时观察变量值
- 确认某条分支是否执行
- 学习阶段理解程序行为

但它不是完整日志系统的替代品。它更适合“开发时快速看状态”。

### `std.debug.assert`

`assert` 用来表达：

- 这里必须成立
- 如果不成立，说明程序内部逻辑已经出问题

```zig
const std = @import("std");

fn divide(a: i32, b: i32) i32 {
    // 这里不是处理用户错误，而是声明“调用者不应传入 0”。
    std.debug.assert(b != 0);
    return @divTrunc(a, b);
}

pub fn main(_: std.process.Init) void {
    const result = divide(10, 2);
    std.debug.print("result={}\n", .{result});
}
```

这里的重点不是“处理用户输入错误”，而是“验证内部不变量”。

### 使用 `std.debug` 时要建立的直觉

1. `print` 用来快速观察状态
2. `assert` 用来表达内部逻辑假设
3. 用户输入错误通常应该走正常错误处理，而不是只靠 `assert`
4. 调试输出越靠近问题发生点，越容易定位根因

> **相关阅读**：错误路径的系统处理见[错误处理](../part1-basics/chapter-error-handling.md)。

---

## `std.testing`

`std.testing` 是 Zig 测试代码最核心的入口。

它的重点不是“把测试写得很花”，而是：

> **把程序行为、边界条件和错误路径固定下来。**

最常用的入口包括：

- `std.testing.expect`
- `std.testing.expectEqual`
- `std.testing.expectError`
- `std.testing.allocator`

下面这个例子延续前面 `std.mem` 的思路，写一个简单解析函数，并用测试验证正常路径和错误路径。

```zig
const std = @import("std");

const ParseError = error{
    MissingSeparator,
    EmptyKey,
    EmptyValue,
};

fn parseAssignment(line: []const u8) ParseError!struct { key: []const u8, value: []const u8 } {
    // 先规范化输入，再做结构拆分和字段校验。
    const trimmed = std.mem.trim(u8, line, " \t\r\n");
    var parts = std.mem.splitScalar(u8, trimmed, '=');

    const raw_key = parts.next() orelse return error.MissingSeparator;
    const raw_value = parts.next() orelse return error.MissingSeparator;

    const key = std.mem.trim(u8, raw_key, " \t\r\n");
    const value = std.mem.trim(u8, raw_value, " \t\r\n");

    if (key.len == 0) return error.EmptyKey;
    if (value.len == 0) return error.EmptyValue;

    return .{ .key = key, .value = value };
}

test "parseAssignment parses key and value" {
    const result = try parseAssignment(" mode = debug ");

    // 正常路径测试：确认解析后的 key 和 value 都符合预期。
    try std.testing.expectEqualStrings("mode", result.key);
    try std.testing.expectEqualStrings("debug", result.value);
}

test "parseAssignment rejects missing separator" {
    // 错误路径测试：输入不合法时，应返回明确的错误。
    try std.testing.expectError(
        error.MissingSeparator,
        parseAssignment("mode debug"),
    );
}

test "parseAssignment rejects empty value" {
    try std.testing.expectError(
        error.EmptyValue,
        parseAssignment("mode = "),
    );
}
```

这个例子里，测试的主线很清楚：

1. 先写一个小而明确的函数
2. 测正常输入
3. 测错误输入
4. 把边界条件固定下来

这比只在 `main` 里手动打印结果更可靠。

### 断言函数速查

| 函数 | 用途 |
| ---- | ---- |
| `expect` | 验证布尔条件为真 |
| `expectEqual` | 比较两个值是否相等（类型推导，失败信息更清楚） |
| `expectEqualStrings` | 比较两个字符串内容 |
| `expectEqualSlices` | 比较两个切片的逐元素内容 |
| `expectError` | 验证错误联合体返回的特定错误 |

> 各断言函数的详细用法和示例，见[测试章节](chapter-testing.md)。

### `std.testing.allocator`

当测试代码里需要分配内存时，优先考虑 `std.testing.allocator`。它的价值不只是“能分配”，更重要的是更容易暴露：

- 泄漏
- 重复释放
- 生命周期错误

### 使用 `std.testing` 时要建立的直觉

1. 测试应该覆盖正常路径、错误路径和边界条件
2. 小函数更容易写出清晰测试
3. 测试不是额外装饰，而是接口行为的一部分
4. 只靠手动运行和打印，通常不够稳定

> **相关阅读**：更完整的测试方法见[测试与验证：从单元测试到基准测量](chapter-testing.md)。

---

## `std.fs`

只要开始写真实程序，文件和目录几乎一定会出现。  
这时 `std.fs` 往往就是最该先想到的模块。

它负责的典型问题包括：

- 打开文件
- 创建文件
- 读取文件内容
- 写入文件内容
- 遍历目录
- 处理路径对应的文件系统对象

更常见的入口是：

- `std.fs.cwd()`
- 目录对象上的 `openFile`、`createFile`、`openDir`
- 文件对象上的 `readToEndAlloc`、`writeAll`、`close`
- 目录遍历的 `iterate`

下面这个例子模拟一个很常见的小工具流程：

1. 从当前目录打开输入文件
2. 读取全部内容
3. 做一点简单处理
4. 创建输出文件并写入结果

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const cwd = std.fs.cwd();

    const input_file = try cwd.openFile("input.txt", .{});
    defer input_file.close();

    // 把整个文件读入动态内存，后面就可以按普通切片继续处理。
    const content = try input_file.readToEndAlloc(init.gpa, 1024 * 1024);
    defer init.gpa.free(content);

    const trimmed = std.mem.trim(u8, content, " \t\r\n");

    const output_file = try cwd.createFile("output.txt", .{ .truncate = true });
    defer output_file.close();

    try output_file.writeAll("processed: ");
    try output_file.writeAll(trimmed);
    try output_file.writeAll("\n");

    std.debug.print("wrote output.txt\n", .{});
}
```

这个例子里，`std.fs` 的主线非常清楚：

- 目录对象负责“从哪里操作”
- 文件对象负责“读写什么”
- 打开后的资源要关闭
- 读取到动态内存后要释放

这也是为什么 `std.fs` 经常和 `std.mem`、`std.process`、`std.heap` 一起出现。

### 创建并写入文件

最小写文件示例如下：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    const cwd = std.fs.cwd();

    const file = try cwd.createFile("example.txt", .{});
    defer file.close();

    // 文件句柄打开后要记得关闭，写入则通过 `writeAll` 完成。
    try file.writeAll("hello from zig\n");
}
```

### 遍历目录项

目录遍历也是高频需求。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    const cwd = std.fs.cwd();
    var dir = try cwd.openDir(".", .{ .iterate = true });
    defer dir.close();

    // 目录遍历通过迭代器逐项产出目录项。
    var it = dir.iterate();
    while (try it.next()) |entry| {
        std.debug.print("{s}\n", .{entry.name});
    }
}
```

### 使用 `std.fs` 时要建立的直觉

1. 文件系统操作天然可能失败，所以错误处理是常态
2. 打开文件和目录意味着资源管理责任
3. 很多操作都从某个目录对象出发，而不是全局函数
4. `std.fs` 经常是 CLI 工具、配置系统、代码生成工具的核心模块

> **相关阅读**：更完整的工具型程序见[实战案例 - CLI 工具开发](../part3-practice/chapter-cli-tool.md)。

---

## `std.process`

`std.process` 负责处理程序作为一个进程运行时的上下文。

在 Zig 0.16-dev 中，这一点尤其重要，因为程序入口通常直接接收 `std.process.Init`，很多进程相关能力都从这里进入。

它最常解决的问题包括：

- 读取命令行参数
- 读取环境变量
- 使用进程级 allocator 和 I/O 上下文
- 在需要时启动子进程

最常先接触到的名字包括：

- `std.process.Init`
- `init.minimal.args`
- `init.environ_map`
- `init.gpa`

其中：

- `args` 负责命令行参数
- `environ_map` 负责环境变量
- `gpa` 提供一个默认可用的通用分配器

下面这个例子模拟一个很典型的 CLI 主线：

1. 从参数中读取输入文件名
2. 读取环境变量决定模式
3. 打开文件并输出处理结果

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    var args = init.minimal.args.iterate();

    // 第一个参数通常是程序自身路径，这里先跳过。
    _ = args.next();

    const input_path = args.next() orelse {
        std.debug.print("usage: app <input-file>\n", .{});
        return;
    };

    // 进程上下文里的环境变量和 allocator，常常会直接参与后续处理流程。
    const mode = init.environ_map.get("APP_MODE") orelse "default";
    std.debug.print("mode = {s}\n", .{mode});
    std.debug.print("input = {s}\n", .{input_path});

    const cwd = std.fs.cwd();
    const file = try cwd.openFile(input_path, .{});
    defer file.close();

    const content = try file.readToEndAlloc(init.gpa, 1024 * 1024);
    defer init.gpa.free(content);

    const trimmed = std.mem.trim(u8, content, " \t\r\n");
    std.debug.print("content = [{s}]\n", .{trimmed});
}
```

这个例子体现了 `std.process` 在真实程序里的位置：

- 它经常站在 `main` 的最前面
- 负责把“程序外部世界”带进来
- 然后再交给 `std.fs`、`std.mem`、`std.fmt` 去继续处理

### 读取命令行参数

在 0.16-dev 中，参数通过 `init.minimal.args` 获取。

```zig
const std = @import("std");

pub fn main(init: std.process.Init) void {
    var args = init.minimal.args.iterate();
    // 参数通过迭代器逐个读取，而不是一次性隐式拿到。
    while (args.next()) |arg| {
        std.debug.print("{s}\n", .{arg});
    }
}
```

这里最重要的是理解：

- 参数不是通过某个全局函数隐式拿到
- 而是通过程序入口显式传入的上下文访问

### 读取环境变量

环境变量通过 `init.environ_map` 访问。

```zig
const std = @import("std");

pub fn main(init: std.process.Init) void {
    // 环境变量查找返回可选值，因此自然适合用 `if` 解包。
    if (init.environ_map.get("HOME")) |home| {
        std.debug.print("HOME={s}\n", .{home});
    } else {
        std.debug.print("HOME is not set\n", .{});
    }
}
```

这里返回的是可选值：

- 找到时得到值
- 找不到时得到 `null`

### 使用 `std.process` 时要建立的直觉

1. 参数、环境变量、默认 allocator 都属于进程上下文的一部分
2. 在 0.16-dev 中，这些上下文通过 `std.process.Init` 显式传入
3. `std.process` 经常位于程序入口层，而不是业务逻辑深处
4. CLI 工具通常会把 `std.process`、`std.fs`、`std.mem`、`std.fmt` 串成一条主线

> **相关阅读**：更完整的命令行工具设计见[实战案例 - CLI 工具开发](../part3-practice/chapter-cli-tool.md)。

---

## `std.ArrayList`

`std.ArrayList(T)` 是标准库提供的动态数组。它在运行时可以自动扩容，是处理"数量不确定的一组同类型元素"的首选结构。

大多数语言里的"列表"或"数组"默认就是动态的（Python 的 `list`、JavaScript 的 `Array`）。但 Zig 中 `[N]T` 是固定大小的——动态数组需要通过 `std.ArrayList` 显式创建。

在 Zig 0.16 中，`ArrayList` 采用**非托管（unmanaged）**设计：结构体内部不存储 allocator，而是由调用方在每个需要分配的方法上显式传入。这与前面各模块中 allocator 通过参数传递的模式一致。

### 容量与长度

动态数组有两个容易混淆的概念：

- **长度**（`items.len`）：当前实际存储了多少个元素
- **容量**（`capacity`）：当前已分配的空间能容纳多少个元素

容量总是 ≥ 长度。当 `items.len == capacity` 时，再追加元素会触发重新分配——分配一块更大的内存，将已有元素复制过去，释放旧内存。这个过程代价较高，所以如果能预估元素数量，应该用 `initCapacity` 预先分配足够空间。

### 创建与销毁

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    const allocator = std.heap.page_allocator;

    // 方式一：空列表，按需增长
    var list: std.ArrayList(u8) = .empty;

    // 方式二：预分配容量，避免后续重新分配（推荐）
    var buf = try std.ArrayList(u8).initCapacity(allocator, 100);

    // 使用完毕后释放内存
    list.deinit(allocator);
    buf.deinit(allocator);
}
```

初始化方式对比：

| 方式 | 写法 | 适用场景 |
| ---- | ---- | -------- |
| 空列表 | `var list: std.ArrayList(T) = .empty` | 不确定最终大小 |
| 预分配 | `try std.ArrayList(T).initCapacity(gpa, n)` | 能预估元素数量 |

`ArrayList` 的核心字段只有两个，都可以直接访问：

| 字段 | 类型 | 含义 |
| ---- | ---- | ---- |
| `items` | `[]T` | 当前所有元素组成的切片 |
| `capacity` | `usize` | 已分配空间能容纳的元素数 |

`items` 就是普通切片——所有切片操作（索引、`for` 遍历、传给函数）都适用。

### 追加元素

```zig
var list: std.ArrayList(u8) = .empty;
defer list.deinit(allocator);

try list.append(allocator, 'H');
try list.append(allocator, 'e');
try list.append(allocator, 'l');
try list.append(allocator, 'l');
try list.append(allocator, 'o');
try list.appendSlice(allocator, " World");

std.debug.print("{s}\n", .{list.items}); // Hello World
std.debug.print("len={}, capacity={}\n", .{list.items.len, list.capacity});
```

- `append` 添加单个元素
- `appendSlice` 添加一个切片的所有元素
- 两者都可能触发重新分配，返回 `Allocator.Error!void`

如果已经通过 `ensureTotalCapacity` 预留了足够空间，可以使用 `appendAssumeCapacity` 和 `appendSliceAssumeCapacity`——它们不会触发分配，也不返回 error，但如果容量不足会触发安全断言。

### 删除元素

```zig
// pop：移除并返回最后一个元素，列表为空时返回 null
const last = list.pop(); // ?T

// orderedRemove：按下标移除，保持剩余元素顺序，O(n)
// 返回被移除的值
const removed = list.orderedRemove(3);

// swapRemove：按下标移除，用末尾元素填补空位，O(1)
// 不保持顺序，但更快
const removed2 = list.swapRemove(0);
```

三种删除方式的对比：

| 方法 | 复杂度 | 顺序 | 返回值 |
| ---- | ------ | ---- | ------ |
| `pop()` | O(1) | 只删末尾 | `?T` |
| `orderedRemove(i)` | O(n) | 保持 | `T` |
| `swapRemove(i)` | O(1) | 不保持 | `T` |

这三种方法都不需要传入 allocator——它们只缩小列表，不涉及内存分配。

### 插入与其他操作

```zig
// 在指定位置插入单个元素
try list.insert(allocator, 0, 'X');

// 在指定位置插入一个切片
try list.insertSlice(allocator, 1, "YY");

// 预分配更多空间（不改变长度）
try list.ensureTotalCapacity(allocator, 200);

// 清空但保留已分配的内存（后续追加时可复用）
list.clearRetainingCapacity();

// 清空并释放内存
list.clearAndFree(allocator);

// 将内容转移为调用方拥有的切片，列表变为空
const owned = try list.toOwnedSlice(allocator);
defer allocator.free(owned);
```

### 使用 `std.ArrayList` 时要建立的直觉

1. 它是"数量不确定的同类型元素"的首选容器
2. 能预估大小时用 `initCapacity`，可以避免重新分配的开销
3. `items` 字段就是普通切片，所有切片操作都适用
4. 0.16 中 `ArrayList` 是非托管的——每个可能触发分配的方法都需要传入 allocator
5. `swapRemove` 比 `orderedRemove` 快，但会打乱元素顺序
6. 如果需要一个由调用方管理生命周期的缓冲区来逐步构建字节序列，`ArrayList(u8)` 是常用选择

---

## `std.HashMap`

`std.HashMap` 是基于哈希表的键值存储结构。给定一个 key，可以快速查找、插入或删除对应的 value。Zig 标准库提供了两个系列的实现：

| 类型 | 特点 | 适用场景 |
| ---- | ---- | -------- |
| `AutoHashMap(K, V)` | 开放寻址，通用哈希 | 整数、枚举、指针等基础类型作为 key |
| `StringHashMap(V)` | 同上，key 为 `[]const u8` | 字符串作为 key |
| `array_hash_map.Auto(K, V)` | 数组存储，保留插入顺序 | 需要有序遍历 |
| `array_hash_map.String(V)` | 同上，key 为 `[]const u8` | 字符串 key + 有序遍历 |

`AutoHashMap` 和 `StringHashMap` 是**托管的**——结构体内部存储 allocator，调用方法时不需要额外传入。`array_hash_map` 系列是**非托管的**——每个可能分配的方法都需要传入 allocator。

### 创建与基本操作

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    const allocator = std.heap.page_allocator;

    var scores = std.AutoHashMap(u32, u16).init(allocator);
    defer scores.deinit();

    // 插入
    try scores.put(1001, 89);
    try scores.put(1002, 55);
    try scores.put(1003, 41);

    // 查询
    std.debug.print("count={}\n", .{scores.count()});
    std.debug.print("score of 1002={}\n", .{scores.get(1002).?});
    std.debug.print("has 9999={}\n", .{scores.contains(9999)});

    // 删除
    if (scores.remove(1003)) {
        std.debug.print("removed 1003\n", .{});
    }
    std.debug.print("count after removal={}\n", .{scores.count()});
}
```

常用方法一览：

| 方法 | 返回值 | 说明 |
| ---- | ------ | ---- |
| `put(key, value)` | `!void` | 插入或覆盖已有值 |
| `get(key)` | `?V` | 按键查值，不存在返回 `null` |
| `getPtr(key)` | `?*V` | 返回值的指针（可就地修改） |
| `contains(key)` | `bool` | 是否存在该 key |
| `remove(key)` | `bool` | 删除，返回是否成功 |
| `fetchRemove(key)` | `?KV` | 删除并返回被删除的键值对 |
| `count()` | `u32` | 当前元素数量 |
| `getOrPut(key)` | `!GetOrPutResult` | 存在则返回指针，不存在则插入空位 |

`get` 返回 `?V`——使用前必须处理"不存在"的情况。这是 Zig 显式错误处理的体现：你不可能意外地访问一个不存在的值。

### 遍历

```zig
var iter = scores.iterator();
while (iter.next()) |entry| {
    std.debug.print("key={}, value={}\n", .{entry.key_ptr.*, entry.value_ptr.*});
}
```

迭代器返回的 `Entry` 包含 `key_ptr` 和 `value_ptr`（都是指针）。通过解引用可以读取值，也可以在遍历中修改值：

```zig
var iter = scores.iterator();
while (iter.next()) |entry| {
    if (entry.key_ptr.* == 1002) {
        entry.value_ptr.* = 99; // 就地修改
    }
}
```

也可以只遍历键或值：

```zig
var ki = scores.keyIterator();
while (ki.next()) |key| {
    std.debug.print("key={}\n", .{key.*});
}
```

> **注意**：`HashMap` 的迭代器在任何修改操作（`put`、`remove` 等）后会失效。如果需要边遍历边修改，应该先把要操作的键收集到一个列表中，遍历结束后再统一修改。

### 字符串作为 key

当 key 是字符串时，使用 `StringHashMap`：

```zig
var ages = std.StringHashMap(u8).init(allocator);
defer ages.deinit();

try ages.put("Alice", 25);
try ages.put("Bob", 30);

std.debug.print("Alice's age={}\n", .{ages.get("Alice").?});
```

`StringHashMap` 按字符串**内容**进行哈希和比较，不是按指针地址。key 的内存由调用方管理——`StringHashMap` 不会复制或释放 key 字符串本身。这意味着如果 key 指向的内存在 map 使用期间被释放，会导致未定义行为。

### 有序哈希表：`array_hash_map`

`AutoHashMap` 不保证遍历顺序——每次插入或删除都可能改变内部布局。如果需要保持插入顺序或频繁遍历，应该使用 `array_hash_map`：

```zig
const ArrayMap = std.array_hash_map.Auto(u32, []const u8);

var map: ArrayMap = .empty;
defer map.deinit(allocator);

try map.put(allocator, 3, "three");
try map.put(allocator, 1, "one");
try map.put(allocator, 2, "two");

// 遍历顺序就是插入顺序：3, 1, 2
for (map.keys(), map.values()) |key, val| {
    std.debug.print("{} = {s}\n", .{key, val});
}

// 删除方式有两种：
_ = map.swapRemove(1);    // O(1)，不保持顺序
// 或
_ = map.orderedRemove(3); // O(n)，保持剩余元素的顺序
```

`array_hash_map` 与 `AutoHashMap` 的关键区别：

| 特性 | `AutoHashMap` | `array_hash_map.Auto` |
| ---- | ------------- | --------------------- |
| allocator 传递 | 托管（内部存储） | 非托管（方法参数传入） |
| 遍历顺序 | 不确定 | 插入顺序 |
| 直接访问键/值 | 通过迭代器 | `.keys()` / `.values()` 返回切片 |
| 删除方法 | `remove(key)` | `swapRemove(key)` / `orderedRemove(key)` |

`.keys()` 和 `.values()` 直接返回切片，这让 `array_hash_map` 在需要序列化、调试输出或批量处理时更方便。

### 使用 `std.HashMap` 时要建立的直觉

1. 需要按键快速查找值时，第一个想到的应该是 `AutoHashMap`
2. key 是字符串时用 `StringHashMap`——它按内容比较，不是按指针
3. 需要保持插入顺序或频繁遍历时用 `array_hash_map`
4. `AutoHashMap` / `StringHashMap` 是托管的；`array_hash_map` 是非托管的——注意方法签名差异
5. `get` 返回 `?V`——使用前必须处理"不存在"的情况
6. 迭代 `HashMap` 期间不要修改它，否则迭代器会失效

> **相关阅读**：关于 allocator 和内存管理策略的深入讨论，见[内存管理模型](chapter-memory-management.md)。

---

## `std.heap`

`std.heap` 是理解 allocator 的第一入口。

它的重要性不在于“会分配内存”这么简单，而在于：

> **Zig 把内存分配策略显式放进接口里。**

所以 `std.heap` 的核心不是某一个函数，而是几种常见 allocator 的角色差异。

最值得先认识的几个名字包括：

- `std.heap.page_allocator`
- `std.heap.ArenaAllocator`
- `std.heap.FixedBufferAllocator`

下面这个例子展示两种很常见的资源组织方式：

- 小而固定的临时分配：`FixedBufferAllocator`
- 一批对象一起释放：`ArenaAllocator`

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    var backing_buffer: [256]u8 = undefined;
    var fba = std.heap.FixedBufferAllocator.init(&backing_buffer);
    const fixed_allocator = fba.allocator();

    // 固定缓冲区分配器只在这块已有内存上工作，不再向系统申请新内存。
    const a = try fixed_allocator.dupe(u8, "alpha");
    const b = try fixed_allocator.dupe(u8, "beta");

    std.debug.print("fixed: {s}, {s}\n", .{ a, b });

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const arena_allocator = arena.allocator();

    // arena 适合一批对象一起创建、最后统一释放。
    const first = try arena_allocator.dupe(u8, "first item");
    const second = try arena_allocator.dupe(u8, "second item");
    const combined = try std.fmt.allocPrint(
        arena_allocator,
        "{s} + {s}",
        .{ first, second },
    );

    std.debug.print("arena combined: {s}\n", .{combined});
}
```

这个例子里最重要的不是记住所有细节，而是理解两种 allocator 的使用场景：

- `FixedBufferAllocator`：在一块已有内存上分配，不再向系统申请新内存
- `ArenaAllocator`：适合“分配很多对象，最后一起释放”

### `page_allocator`

`page_allocator` 是最容易直接拿来用的 allocator 之一。

```zig
const std = @import("std");

pub fn main(_: std.process.Init) !void {
    const allocator = std.heap.page_allocator;

    // 即使是最直接的 allocator，用完后也仍然要显式释放。
    const text = try allocator.dupe(u8, "hello");
    defer allocator.free(text);

    std.debug.print("{s}\n", .{text});
}
```

它适合示例和简单程序，但在工程里不一定总是最佳默认选择。

### `ArenaAllocator`

适合"集中分配、集中释放"的场景（如解析配置、构造语法树、请求级临时对象）。详见[内存管理模型](chapter-memory-management.md)。

### `FixedBufferAllocator`

在固定内存块上分配，不向系统申请新内存，适合已知上限、嵌入式或临时工作区。详见[内存管理模型](chapter-memory-management.md)。

### 使用 `std.heap` 时要建立的直觉

1. allocator 是接口的一部分，不是隐藏背景设施
2. 选择 allocator，本质上是在选择资源组织方式
3. 一旦发生分配，就要立刻想到释放责任
4. `std.heap` 往往不是单独使用，而是作为其他模块的基础设施出现

> **相关阅读**：allocator 的完整模型见[内存管理模型](chapter-memory-management.md)。

---

## 一个稍完整的组合示例

前面每个模块都单独看过了。下面把它们串起来，写一个更接近真实程序的小例子。

这个程序做的事情是：

1. 从命令行参数读取输入文件名
2. 从环境变量读取模式
3. 读取文件内容
4. 按行查找 `name = value` 形式的配置
5. 生成一份格式化报告
6. 输出到终端并写入文件

这个例子会同时用到：

- `std.process`
- `std.fs`
- `std.mem`
- `std.fmt`
- `std.heap`
- `std.debug`

```zig
const std = @import("std");

const ParseError = error{
    InvalidLine,
};

fn parseLine(line: []const u8) ParseError!?struct { key: []const u8, value: []const u8 } {
    const trimmed = std.mem.trim(u8, line, " \t\r\n");
    // 空行和注释行不算错误，直接跳过即可。
    if (trimmed.len == 0) return null;
    if (std.mem.startsWith(u8, trimmed, "#")) return null;

    var parts = std.mem.splitScalar(u8, trimmed, '=');
    const raw_key = parts.next() orelse return error.InvalidLine;
    const raw_value = parts.next() orelse return error.InvalidLine;

    const key = std.mem.trim(u8, raw_key, " \t\r\n");
    const value = std.mem.trim(u8, raw_value, " \t\r\n");

    if (key.len == 0 or value.len == 0) return error.InvalidLine;
    return .{ .key = key, .value = value };
}

pub fn main(init: std.process.Init) !void {
    var args = init.minimal.args.iterate();
    _ = args.next();

    const input_path = args.next() orelse {
        std.debug.print("usage: app <config-file>\n", .{});
        return;
    };

    const mode = init.environ_map.get("APP_MODE") orelse "default";

    const cwd = std.fs.cwd();
    const input_file = try cwd.openFile(input_path, .{});
    defer input_file.close();

    const content = try input_file.readToEndAlloc(init.gpa, 1024 * 1024);
    defer init.gpa.free(content);

    // 先按行拆分输入，再逐行做配置解析。
    var lines = std.mem.splitScalar(u8, content, '\n');

    // `ArrayList` 适合逐步构造一段最终输出文本。
    var report = std.ArrayList(u8).init(init.gpa);
    defer report.deinit();

    try report.writer().print("mode: {s}\n", .{mode});
    try report.writer().writeAll("parsed entries:\n");

    while (lines.next()) |line| {
        const parsed = try parseLine(line) orelse continue;
        try report.writer().print("  {s} = {s}\n", .{ parsed.key, parsed.value });
    }

    const output_file = try cwd.createFile("report.txt", .{ .truncate = true });
    defer output_file.close();

    try output_file.writeAll(report.items);
    std.debug.print("{s}", .{report.items});
}
```

这个例子最值得观察的不是某一个 API，而是模块之间的职责分工：

- `std.process`：拿到参数和环境变量
- `std.fs`：读文件、写文件
- `std.mem`：按行拆分、裁剪、解析键值
- `std.heap`：通过 `init.gpa` 支持动态内存
- `std.fmt`：通过 writer 的 `print` 生成格式化文本
- `std.debug`：把结果输出到终端

这就是 Zig 标准库在真实程序里的常见样子：  
**不是单个模块孤立使用，而是围绕一条清晰的程序主线协作。**

---

## 本章小结

这一章的重点不是覆盖尽可能多的 API，而是建立面向实战的第一轮标准库直觉：

- `std.mem`：处理切片、字节和已有缓冲区
- `std.fmt`：把值格式化成文本
- `std.debug`：观察状态、验证不变量
- `std.testing`：固定行为、覆盖边界和错误路径
- `std.fs`：处理文件和目录
- `std.process`：处理参数、环境变量和进程上下文
- `std.ArrayList`：动态数组——数量不确定的同类型元素的首选容器
- `std.HashMap`：哈希表——按键快速查找值，注意选择合适的变体
- `std.heap`：显式选择 allocator 和资源组织方式

如果把真实程序看成一条主线，那么很常见的组合就是：

1. `std.process` 从程序入口拿到上下文
2. `std.fs` 读取外部数据
3. `std.mem` 解析和整理输入
4. `std.ArrayList` 和 `std.HashMap` 在处理过程中存储和组织数据
5. `std.fmt` 组织输出文本
6. `std.heap` 提供动态内存支持
7. `std.debug` 和 `std.testing` 分别负责开发期观察与验证

接下来继续学习时，可以按下面的方向深入：

- 想系统理解 allocator 与资源责任：读[内存管理模型](chapter-memory-management.md)
- 想系统学习测试：读[测试与验证：从单元测试到基准测量](chapter-testing.md)
- 想看这些模块在真实工具中的组合：读[实战案例 - CLI 工具开发](../part3-practice/chapter-cli-tool.md)

回到标准库本身，最重要的能力始终是：

> **看到一个实际问题时，能迅速判断这条程序主线应该由哪些标准库模块来承担。**
