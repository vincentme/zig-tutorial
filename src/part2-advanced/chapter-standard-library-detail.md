# 常用标准库模块详解

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
- `std.mem.find`
- `std.mem.indexOfScalar`
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

    if (std.mem.find(u8, value, "-")) |pos| {
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

```zig
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

第三个参数是“要裁掉的字符集合”，常见值有：

- `" "`
- `" \t\r\n"`

### `copyForwards`

当你已经有目标缓冲区时，`copyForwards` 是最直接的复制方式之一。

```zig
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

- **短生命周期、固定大小**：优先 `bufPrint`。返回值是实际写入的切片，不是整个数组；缓冲区不够大会返回错误。
- **结果长度不方便预估，或者需要独立拥有结果**：使用 `allocPrint`。它会发生堆分配，因此必须传入 allocator，返回结果由调用者负责释放 (`defer allocator.free(...)`)。

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

这个例子体现了 `std.debug` 的两个核心用法：

- **`std.debug.print`**：开发时快速观察变量值、确认分支执行路径、理解程序行为。它不是完整日志系统的替代品，更适合「开发时看状态」。
- **`std.debug.assert`**：验证内部不变量——这里必须成立，如果不成立说明程序逻辑本身已出问题。它和错误处理（`try`/`catch`）的职责不同：`try`/`catch` 处理可预期的运行时失败，`assert` 暴露不应发生的逻辑错误。

## `std.testing`

| 函数                 | 用途                                             |
| -------------------- | ------------------------------------------------ |
| `expect`             | 验证布尔条件为真                                 |
| `expectEqual`        | 比较两个值是否相等（带类型推导，失败信息更清楚） |
| `expectEqualStrings` | 比较两个字符串内容                               |
| `expectEqualSlices`  | 比较两个切片的逐元素内容                         |
| `expectError`        | 验证错误联合体返回了特定错误                     |

测试代码中需要分配内存时，优先使用带有泄漏检测功能的 `std.testing.allocator`。

> 测试的完整写法、命名规范、错误路径验证和资源释放测试，见[测试章节](chapter-testing.md)。

## 文件操作：`std.Io.Dir` 与 `std.Io.File`

在 Zig 0.16 中，文件系统操作的核心是 `std.Io.Dir`（目录）和 `std.Io.File`（文件）。所有 I/O 操作都需要显式传入 `io: std.Io` 参数。

下面这个例子演示了最典型的文件操作流程：读取 → 处理 → 写入。

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    const io = init.io;
    const gpa = init.gpa;

    const content = try std.Io.Dir.cwd().readFileAlloc(io, "input.txt", gpa, .limited(1024 * 1024));
    defer gpa.free(content);

    const trimmed = std.mem.trim(u8, content, " \t\r\n");

    const output_file = try std.Io.Dir.cwd().createFile(io, "output.txt", .{ .truncate = true });
    defer output_file.close(io);

    try output_file.writeStreamingAll(io, "processed: ");
    try output_file.writeStreamingAll(io, trimmed);
    try output_file.writeStreamingAll(io, "\n");
}
```

几个关键习惯：

- `Io.Dir.cwd()` 获取当前目录句柄，`openFile` / `createFile` 从目录出发
- 打开的资源用 `defer xxx.close(io)` 确保释放
- 读取到堆内存后用 `defer gpa.free(...)` 配对释放

### 遍历目录项

`openDir` 配合 `.iterate = true` 打开一个目录，`iterate()` 返回迭代器，每次调用 `next(io)` 返回一个目录项。`entry.name` 是该项的文件名。

```zig
var dir = try std.Io.Dir.cwd().openDir(io, ".", .{ .iterate = true });
defer dir.close(io);

var it = dir.iterate();
while (try it.next(io)) |entry| {
    std.debug.print("{s}\n", .{entry.name});
}
```

## `std.process`

`std.process` 负责程序作为进程运行时的上下文：命令行参数、环境变量、进程级 allocator（`gpa`）和 I/O（`io`）。这些能力在 Zig 0.16 中通过 `main` 的 `init: std.process.Init` 参数显式传入，不复用全局状态。

下面这个例子演示了一个典型的 CLI 主线：读参数 → 读环境变量 → 打开文件 → 输出处理结果。

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    var args = init.minimal.args.iterate();
    _ = args.next(); // 第一个参数是程序自身路径

    const input_path = args.next() orelse {
        std.debug.print("usage: app <input-file>\n", .{});
        return;
    };

    const mode = init.environ_map.get("APP_MODE") orelse "default";

    const io = init.io;
    const file = try std.Io.Dir.cwd().openFile(io, input_path, .{});
    defer file.close(io);

    var read_buf: [1024]u8 = undefined;
    var file_reader = file.reader(io, &read_buf);
    const content = try file_reader.interface.allocRemaining(init.gpa, .limited(1024 * 1024));
    defer init.gpa.free(content);

    const trimmed = std.mem.trim(u8, content, " \t\r\n");
    std.debug.print("content = [{s}]\n", .{trimmed});
}
```

几个要点：

- `init.minimal.args.iterate()` 返回迭代器，逐个读取命令行参数
- `init.environ_map.get(...)` 返回 `?[]const u8`，环境变量不存在时为 `null`
- `init.gpa` 和 `init.io` 分别提供进程级的通用 allocator 和 I/O 入口
- 这些值都不是全局状态，而是从 `main` 入口显式传入

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

| 方式   | 写法                                        | 适用场景       |
| ------ | ------------------------------------------- | -------------- |
| 空列表 | `var list: std.ArrayList(T) = .empty`       | 不确定最终大小 |
| 预分配 | `try std.ArrayList(T).initCapacity(gpa, n)` | 能预估元素数量 |

`ArrayList` 的核心字段只有两个，都可以直接访问：

| 字段       | 类型    | 含义                     |
| ---------- | ------- | ------------------------ |
| `items`    | `[]T`   | 当前所有元素组成的切片   |
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

| 方法               | 复杂度 | 顺序     | 返回值 |
| ------------------ | ------ | -------- | ------ |
| `pop()`            | O(1)   | 只删末尾 | `?T`   |
| `orderedRemove(i)` | O(n)   | 保持     | `T`    |
| `swapRemove(i)`    | O(1)   | 不保持   | `T`    |

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

## `std.HashMap`

`std.HashMap` 是基于哈希表的键值存储结构。给定一个 key，可以快速查找、插入或删除对应的 value。Zig 标准库提供了两个系列的实现：

| 类型                        | 特点                      | 适用场景                           |
| --------------------------- | ------------------------- | ---------------------------------- |
| `AutoHashMap(K, V)`         | 开放寻址，通用哈希        | 整数、枚举、指针等基础类型作为 key |
| `StringHashMap(V)`          | 同上，key 为 `[]const u8` | 字符串作为 key                     |
| `array_hash_map.Auto(K, V)` | 数组存储，保留插入顺序    | 需要有序遍历                       |
| `array_hash_map.String(V)`  | 同上，key 为 `[]const u8` | 字符串 key + 有序遍历              |

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

| 方法               | 返回值            | 说明                             |
| ------------------ | ----------------- | -------------------------------- |
| `put(key, value)`  | `!void`           | 插入或覆盖已有值                 |
| `get(key)`         | `?V`              | 按键查值，不存在返回 `null`      |
| `getPtr(key)`      | `?*V`             | 返回值的指针（可就地修改）       |
| `contains(key)`    | `bool`            | 是否存在该 key                   |
| `remove(key)`      | `bool`            | 删除，返回是否成功               |
| `fetchRemove(key)` | `?KV`             | 删除并返回被删除的键值对         |
| `count()`          | `u32`             | 当前元素数量                     |
| `getOrPut(key)`    | `!GetOrPutResult` | 存在则返回指针，不存在则插入空位 |

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

| 特性           | `AutoHashMap`    | `array_hash_map.Auto`                    |
| -------------- | ---------------- | ---------------------------------------- |
| allocator 传递 | 托管（内部存储） | 非托管（方法参数传入）                   |
| 遍历顺序       | 不确定           | 插入顺序                                 |
| 直接访问键/值  | 通过迭代器       | `.keys()` / `.values()` 返回切片         |
| 删除方法       | `remove(key)`    | `swapRemove(key)` / `orderedRemove(key)` |

`.keys()` 和 `.values()` 直接返回切片，这让 `array_hash_map` 在需要序列化、调试输出或批量处理时更方便。

## `std.heap`

`std.heap` 提供了一系列 allocator：`page_allocator`（最直接的分配方式）、`ArenaAllocator`（集中分配集中释放）、`FixedBufferAllocator`（在已有内存块上分配）等。

> 完整的 allocator 选择、使用和资源责任管理，见[内存管理模型](chapter-memory-management.md)。

## 本章小结

本章覆盖了标准库中最常用的模块。它们的分工可以这样记忆：

| 模块            | 定位                                                          |
| --------------- | ------------------------------------------------------------- |
| `std.process`   | 程序入口：参数、环境变量、gpa + io                            |
| `std.Io`        | 文件与目录读写                                                |
| `std.mem`       | 切片处理、字节级操作                                          |
| `std.fmt`       | 格式化文本（`bufPrint` 写缓冲区，`allocPrint` 分配新内存）    |
| `std.debug`     | `print` 观察状态，`assert` 验证不变量                         |
| `std.testing`   | 固定行为、覆盖边界和错误路径                                  |
| `std.ArrayList` | 动态数组（非托管，方法传 allocator）                          |
| `std.HashMap`   | 哈希表（`StringHashMap` 按值查找，`array_hash_map` 保持顺序） |
| `std.heap`      | allocator 的选择与资源组织策略                                |

> **相关阅读**：[内存管理模型](chapter-memory-management.md)、[测试与验证](chapter-testing.md)、[CLI 工具开发](../part3-practice/chapter-cli-tool.md)
