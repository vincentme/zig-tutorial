# 错误处理

错误处理是 Zig 最核心、也最有辨识度的语言特性之一。

很多语言把“失败”放在异常系统里：函数签名不写，调用点也不一定显式处理，控制流可能在运行时突然跳走。Zig 选择了另一条路线：**把失败纳入类型系统**。一个操作是否可能失败、失败后由谁处理、失败时资源如何清理，都应该直接体现在代码里。

本章围绕四个核心概念展开：

- **错误集合（error set）**：定义“可能出现哪些错误”
- **错误联合类型（error union）**：定义“结果要么是值，要么是错误”
- **`try` / `catch`**：传播或处理错误
- **`errdefer`**：只在失败路径上执行清理逻辑

目标不是罗列所有语法角落，而是建立一套稳定、统一的理解框架：

- 为什么 Zig 不用异常作为主线机制
- `!T` 到底表示什么
- 什么时候该传播错误，什么时候该就地处理
- `errdefer` 和 `defer` 的职责边界是什么
- `!T` 和 `?T` 分别解决什么问题

---

## 为什么 Zig 不用异常？

Zig 选择显式错误处理，主要是为了让代码在三个方面更好：

1. **控制流可见**
   - 函数签名会直接告诉你它可能失败
   - 调用点必须显式写出 `try`、`catch` 或其他处理方式
   - 不存在“看起来是普通调用，实际上可能抛异常跳走”的隐藏路径

2. **接口更精确**
   - 错误是类型的一部分
   - 调用者可以在编译期知道自己需要处理哪些失败情况
   - 错误处理不再只是约定，而是语言层面的约束

3. **系统编程更自然**
   - 资源清理、所有权转移、部分初始化失败等问题都能直接表达
   - `errdefer` 这类机制和显式返回错误天然配合

这里最重要的一点不是“异常不好”，而是：**Zig 希望失败路径和成功路径一样清楚。**

---

## 错误集合

错误集合用于定义一组命名错误值。

你可以把它理解为：函数可能失败，但失败不是随便返回一个字符串或整数，而是返回一个**受类型系统约束的错误值**。

### 为什么需要错误集合？

错误集合带来三件事：

- **类型安全**：错误不是随意拼出来的文本
- **语义清晰**：错误名本身就是接口文档的一部分
- **编译期约束**：函数签名和调用点都能被检查

例如，“文件不存在”和“权限不足”都叫失败，但它们不是同一类失败。把它们区分开，调用者才能做出不同处理。

### 定义错误集合

```zig
const std = @import("std");

const FileError = error{
    NotFound,
    PermissionDenied,
    OutOfMemory,
};

pub fn main(_: std.process.Init) void {
    const err: FileError = error.NotFound;

    if (err == error.NotFound) {
        std.debug.print("文件未找到\n", .{});
    }
}
```

这里有几个要点：

- `error{ ... }` 定义一个错误集合
- 集合中的成员是命名错误值
- 错误值可以比较
- 写成 `error.NotFound` 通常比 `FileError.NotFound` 更常见

### 错误名的全局性

Zig 的错误名是**全局共享**的；错误集合的作用是约束“这里允许出现哪些错误名”，而不是为每个错误集合创建彼此独立的命名空间。

```zig
const A = error{NotFound};
const B = error{NotFound};

comptime {
    const a: A = error.NotFound;
    const b: B = error.NotFound;
    _ = .{ a, b };
}
```

这个例子说明：

- `A` 和 `B` 是两个不同的错误集合类型
- 但它们都包含同一个全局错误名 `NotFound`
- 因此这里赋值时统一写成 `error.NotFound`，而不是 `A.NotFound` 或 `B.NotFound`

可以把错误集合理解为“允许的错误名单”：

- `error{NotFound}` 表示这里只允许 `NotFound`
- `error{NotFound, AccessDenied}` 表示这里允许 `NotFound` 和 `AccessDenied`

它约束的是**允许出现哪些错误**，而不是重新定义一套新的错误值。

初学时可以先记住一句话：**错误集合限制的是可返回错误的范围；同名错误在不同错误集合里，仍然是同一个全局错误名。**

## 错误类型与错误值

### 错误联合类型：`!T`

错误集合只回答“可能有哪些错误”，但还没有回答“这个函数在成功时返回什么、失败时又可能出现哪些错误”。这就是错误联合类型的作用。

`ErrorSet!T` 表示：

- 要么得到一个 `T`
- 要么得到一个属于`ErrorSet`的错误

例如：

```zig
const ParseError = error{
    InvalidFormat,
    OutOfRange,
};

fn parseNumber(str: []const u8) ParseError!u32 {
    if (str.len == 0) return error.InvalidFormat;

    var result: u32 = 0;
    for (str) |c| {
        if (c < '0' or c > '9') return error.InvalidFormat;
        result = result * 10 + (c - '0');
    }

    return result;
}
```

这里的 `ParseError!u32` 不是“可能返回两个值”，而是“返回值是一个二选一的结果”：

- 成功分支：`u32`
- 失败分支：`ParseError`

### `!T` 的两种常见写法

你会看到两种形式：

- `SomeError!T`
- `!T`

区别是：

- `SomeError!T`：显式写出错误集合
- `!T`：让编译器推断错误集合

例如：

```/dev/null/chapter-error-handling.zig#L65-76
fn explicit() error{NotFound, PermissionDenied}!void {
    return error.NotFound;
}

fn inferred() !void {
    return error.NotFound;
}
```

对初学者来说，可以先记住这个经验法则：

- **公共 API**：优先显式写错误集合
- **内部实现**：可以让编译器推断，减少维护成本

这样做的原因很简单：公共接口更需要可读性和稳定性，内部实现更需要灵活性。

---

### 错误集推断

当函数返回 `!T` 时，编译器会根据函数体中可能返回的错误自动推断错误集合。

```/dev/null/chapter-error-handling.zig#L78-89
fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    if (a == std.math.minInt(i32) and b == -1) {
        return error.Overflow;
    }
    return @divTrunc(a, b);
}
```

这里编译器会推断出一个包含以下错误的集合：

- `DivisionByZero`
- `Overflow`

推断的优点：

- 少写重复代码
- 实现变化时，错误集会自动跟着变化
- 不容易出现“函数体已经会返回新错误，但签名忘了更新”的问题

但也要注意：

- 推断出来的错误集是实现细节的一部分
- 如果你在写库接口，过度依赖推断可能让接口边界不够清晰

---

### 错误集合并

如果一个函数可能返回多个来源的错误，可以把错误集合合并。

```/dev/null/chapter-error-handling.zig#L91-103
const FileError = error{
    NotFound,
    PermissionDenied,
};

const NetworkError = error{
    ConnectionFailed,
    Timeout,
};

const CombinedError = FileError || NetworkError;
```

`CombinedError` 包含这两个集合中的全部错误。

这在“上层函数整合多个子系统错误”时很常见。

---

### 子集与超集

错误集合之间存在子集关系。

如果一个错误集合是另一个的子集，那么：

- **子集可以隐式转换为超集**
- **超集不能隐式转换为子集**

```/dev/null/chapter-error-handling.zig#L105-117
const FileError = error{ NotFound, PermissionDenied };
const SpecificError = error{NotFound};

fn example() void {
    const specific: SpecificError = error.NotFound;

    const broad: FileError = specific;
    _ = broad;

    // const narrow: SpecificError = broad;
    // 上面这行会编译错误：超集不能隐式缩小为子集
}
```

原因也很直观：

- 把“更具体”的东西当成“更一般”的东西是安全的
- 反过来不安全，因为超集里可能含有子集没有的错误

---

### 错误集转换

当你确实需要把较大的错误集收窄到较小的错误集时，有两种思路：

1. **显式映射**
2. **`@errorCast`**

显式映射：

这是最稳妥、也最推荐的方式。

```/dev/null/chapter-error-handling.zig#L119-136
const LowLevelError = error{
    DiskError,
    NetworkError,
};

const HighLevelError = error{
    IOError,
    Timeout,
};

fn mapError(err: LowLevelError) HighLevelError {
    return switch (err) {
        error.DiskError => error.IOError,
        error.NetworkError => error.Timeout,
    };
}
```

这种写法的优点是语义明确：你不是“强行缩小”，而是在设计 API 边界。

`@errorCast`：

`@errorCast` 用于把错误值收窄到目标错误集合。

```/dev/null/chapter-error-handling.zig#L138-149
const BroadError = error{ NotFound, PermissionDenied };
const SpecificError = error{NotFound};

fn narrow() SpecificError!void {
    broad() catch |err| return @errorCast(err);
}

fn broad() BroadError!void {
    return error.NotFound;
}
```

但要非常清楚一点：

- `@errorCast` 只有在运行时错误值确实属于目标错误集合时才成立
- 如果实际错误不在目标集合中，会触发安全检查失败

所以它适合“你已经能证明这里只会出现某个子集错误”的场景，不适合拿来掩盖接口设计问题。

---

### `anyerror`

`anyerror` 是所有错误的超集。

```/dev/null/chapter-error-handling.zig#L151-154
fn flexibleFunction() anyerror!void {
    return error.SomethingWentWrong;
}
```

它的含义是：这个函数可能返回任意错误。

这听起来很方便，但代价也很明显：

- 接口不够精确
- 调用者很难知道应该处理哪些错误
- 编译器也无法像具体错误集那样帮你做更强的约束

因此建议是：

- **教学示例、原型代码、边界适配层**：可以偶尔使用
- **正式代码、公共 API**：优先使用具体错误集

一句话概括：**`anyerror` 是逃生门，不是默认选项。**

---

### 错误相关内建函数

Zig 提供了一些和错误相关的内建函数，最常见的是下面几个：

| 内建函数 | 作用 |
| --- | --- |
| `@errorName(err)` | 获取错误名对应的字符串 |
| `@errorCast(err)` | 将错误值收窄到更小的错误集 |
| `@intFromError(err)` | 获取错误值的整数表示 |
| `@errorFromInt(x)` | 从整数构造错误值 |

其中最常用的是 `@errorName`：

```/dev/null/chapter-error-handling.zig#L156-163
const std = @import("std");

fn logError() !void {
    return error.NotFound;
}

pub fn main(_: std.process.Init) void {
    logError() catch |err| std.debug.print("错误名：{s}\n", .{@errorName(err)});
}
```

关于 `@intFromError` 和 `@errorFromInt`，只需要知道两点：

- 它们主要用于底层场景
- 不应把错误的整数值当成稳定接口来依赖

对大多数应用代码来说，知道它们存在就够了。

---

## 错误传播与处理

### `try`：传播错误

`try` 的作用是：

- 如果表达式成功，取出其中的值
- 如果表达式失败，立即把错误返回给当前函数的调用者

看一个最基本的例子：

```/dev/null/chapter-error-handling.zig#L165-176
fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

fn calculate() !i32 {
    const result = try divide(10, 2);
    return result * 2;
}
```

这里 `try divide(10, 2)` 的意思是：

- 成功：把结果绑定给 `result`
- 失败：当前函数 `calculate` 直接返回那个错误

### `try` 的等价理解

你可以把它近似理解为下面这种写法：

```/dev/null/chapter-error-handling.zig#L178-182
const result = divide(10, 2) catch |err| {
    return err;
};
```

这不是说 `try` 只是语法糖那么简单，而是帮助你理解它的控制流：**失败就立刻返回，成功才继续往下执行。**

### `try` 的使用限制

`try` 只能出现在当前函数本身也允许返回错误的地方。

如果你想和本教程其余 Zig 0.16 示例保持一致，也可以让 `main` 接收 `std.process.Init`；这和是否返回 `!void` 是两个独立维度。

```/dev/null/chapter-error-handling.zig#L184-193
fn mightFail() !void {
    return error.Failed;
}

// ❌ 错误：返回类型不是错误联合
pub fn badMain(_: std.process.Init) void {
    // try mightFail();
}

// ✅ 正确：当前函数也返回错误联合
pub fn goodMain(_: std.process.Init) !void {
    try mightFail();
}
```

记忆方式很简单：

> 你只有在“自己也能把错误继续往上交”的前提下，才能使用 `try`。

---

### `catch`：在当前层处理错误

如果你不想继续传播，而是想在当前层把错误处理掉，就用 `catch`。

### 提供默认值

```/dev/null/chapter-error-handling.zig#L195-201
fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

const result = divide(10, 0) catch 0;
```

这里的意思是：如果失败，就直接用 `0` 作为替代值。

这适合“失败后有合理默认值”的场景。

### 捕获错误并执行逻辑

```/dev/null/chapter-error-handling.zig#L203-214
const std = @import("std");

fn example() void {
    const result = divide(10, 0) catch |err| {
        std.debug.print("错误：{s}\n", .{@errorName(err)});
        return;
    };

    std.debug.print("结果：{}\n", .{result});
}
```

这里 `catch |err|` 会把错误值绑定到 `err`，你可以：

- 打日志
- 转换错误
- 返回默认值
- 提前结束当前函数

### `catch unreachable`

有时你在逻辑上可以证明某个操作不会失败，这时可以写：

```/dev/null/chapter-error-handling.zig#L216-217
const value = parseNumber("42") catch unreachable;
```

但这必须非常谨慎。

`catch unreachable` 的含义不是“帮我处理错误”，而是：

- 我断言这里绝不会失败
- 如果失败了，那就是程序逻辑错误

因此它只适合“你真的能证明不可能失败”的场景，而不是“我懒得处理”。

---

### 匹配具体错误

如果不同错误需要不同处理方式，可以在 `catch` 后面接 `switch`。

```/dev/null/chapter-error-handling.zig#L219-236
const std = @import("std");

const FileError = error{
    NotFound,
    PermissionDenied,
    DiskFull,
};

fn processFile() FileError!void {
    return error.NotFound;
}

fn handleFile() void {
    processFile() catch |err| switch (err) {
        error.NotFound => std.debug.print("文件未找到\n", .{}),
        error.PermissionDenied => std.debug.print("权限不足\n", .{}),
        error.DiskFull => std.debug.print("磁盘已满\n", .{}),
    };
}
```

这类写法很适合：

- 用户提示
- 错误分类统计
- 低层错误到高层语义的转换

如果你不想逐个列出，也可以使用 `else` 兜底，但前提是这确实符合你的接口设计。

---

### 用 `if` 同时处理成功和失败

错误联合类型也可以用 `if` 解包：

```/dev/null/chapter-error-handling.zig#L238-251
const std = @import("std");

fn example() void {
    if (divide(10, 2)) |value| {
        std.debug.print("成功：{}\n", .{value});
    } else |err| {
        std.debug.print("失败：{s}\n", .{@errorName(err)});
    }
}
```

这种写法适合“成功和失败两边都要写一段完整逻辑”的情况。

你可以这样区分：

- **`try`**：我只关心成功值，失败直接往上交
- **`catch`**：我主要想处理失败
- **`if (expr) |value| else |err|`**：成功和失败都要显式展开

---

### `!T` 和 `?T` 的区别

这是初学者最容易混淆的地方之一。

- `!T`：表示**操作失败**
- `?T`：表示**值可能不存在**

这两者不是同一个问题。

例如：

```/dev/null/chapter-error-handling.zig#L253-264
fn findUser(id: u32) ?[]const u8 {
    if (id == 1) return "alice";
    return null;
}

fn loadUserConfig(path: []const u8) ![]const u8 {
    if (path.len == 0) return error.NotFound;
    return "config";
}
```

这里：

- `findUser` 返回 `null` 不代表程序出错，只是“没找到”
- `loadUserConfig` 返回错误表示“操作失败了”

经验法则：

- **缺席是正常业务状态** → 用 `?T`
- **失败是异常业务路径或系统失败** → 用 `!T`

如果一个操作既可能失败，又可能成功但没有值，那么类型可能是 `!?T` 或 `? !T` 相关组合，但初学阶段先把 `?T` 和 `!T` 的职责分清最重要。

---

## 失败路径清理：`errdefer`

### `errdefer`

`defer` 你已经见过：作用域结束时执行。

`errdefer` 则更专门：**只有当前函数以错误返回时才执行。**

这使它特别适合一种场景：

> 成功时把资源交给调用者，失败时由当前函数负责回收。

### `defer` 和 `errdefer` 的区别

- **`defer`**：成功、失败都会执行
- **`errdefer`**：只有失败时执行

看对比：

```/dev/null/chapter-error-handling.zig#L266-279
const std = @import("std");

fn withDefer(allocator: std.mem.Allocator) !void {
    const memory = try allocator.alloc(u8, 100);
    defer allocator.free(memory);

    _ = memory;
}

fn withErrdefer(allocator: std.mem.Allocator) ![]u8 {
    const memory = try allocator.alloc(u8, 100);
    errdefer allocator.free(memory);

    return memory;
}
```

为什么第二个例子必须用 `errdefer`？

因为成功时 `memory` 要返回给调用者。如果这里写成 `defer allocator.free(memory)`，那么函数一返回，内存就被释放了，调用者拿到的是无效内存。

所以判断标准非常明确：

- **资源生命周期在函数内结束** → 用 `defer`
- **成功时资源所有权转移给调用者** → 用 `errdefer`

---

### `errdefer` 的基本用法

```/dev/null/chapter-error-handling.zig#L281-300
const std = @import("std");

const User = struct {
    id: usize,
    name: []const u8,
};

fn createUser(allocator: std.mem.Allocator, id: usize, name: []const u8) !*User {
    const user = try allocator.create(User);
    errdefer allocator.destroy(user);

    user.* = .{
        .id = id,
        .name = name,
    };

    if (id == 0) return error.InvalidUserId;

    return user;
}
```

这里的控制流是：

- 分配 `user`
- 注册失败清理：如果后面出错，就销毁 `user`
- 如果 `id == 0`，函数返回错误，`errdefer` 自动执行
- 如果成功返回 `user`，`errdefer` 不执行，调用者接管所有权

这正是 `errdefer` 最典型的用途。

---

### 多资源管理

当一个函数分配多个资源时，`errdefer` 可以把“部分成功、后续失败”的清理逻辑写得非常自然。

```/dev/null/chapter-error-handling.zig#L302-326
const std = @import("std");

const Config = struct {
    name: []const u8,
    items: []u32,
};

fn loadConfig(allocator: std.mem.Allocator, name: []const u8, count: usize) !*Config {
    const config = try allocator.create(Config);
    errdefer allocator.destroy(config);

    const items = try allocator.alloc(u32, count);
    errdefer allocator.free(items);

    config.* = .{
        .name = name,
        .items = items,
    };

    if (count > 1000) return error.TooManyItems;

    return config;
}
```

如果 `count > 1000`：

- 先执行 `allocator.free(items)`
- 再执行 `allocator.destroy(config)`

这说明多个 `errdefer` 的执行顺序是 **LIFO**（后进先出），和 `defer` 一样。

这很合理，因为资源通常也是按“先拿外层、再拿内层”的顺序获取的，清理时正好反过来。

---

### `errdefer` 的执行顺序

```/dev/null/chapter-error-handling.zig#L328-339
fn example() !void {
    const resource1 = try acquire1();
    errdefer release1(resource1);

    const resource2 = try acquire2();
    errdefer release2(resource2);

    const resource3 = try acquire3();
    errdefer release3(resource3);

    return error.Failed;
}
```

如果最后返回错误，执行顺序是：

1. `release3(resource3)`
2. `release2(resource2)`
3. `release1(resource1)`

记住一句话就够了：

> `errdefer` 和 `defer` 一样，都是倒序执行。

---

### `errdefer |err|`

`errdefer` 还可以捕获当前返回的错误值：

```/dev/null/chapter-error-handling.zig#L341-356
const std = @import("std");

fn sendRequest(url: []const u8) !void {
    errdefer |err| {
        std.debug.print("请求失败：{s}\n", .{@errorName(err)});
    }

    if (!std.mem.startsWith(u8, url, "https://")) {
        return error.InvalidUrl;
    }

    return error.Timeout;
}
```

这适合做：

- 失败日志
- 附加上下文
- 按错误类型做不同清理

但要注意：`errdefer |err|` 的主要职责仍然是**失败路径上的收尾**，不要把它变成复杂业务逻辑的主战场。

---

## 一个完整示例

下面把 `!T`、`try`、`catch`、`errdefer` 放到同一个例子里。

```/dev/null/chapter-error-handling.zig#L358-395
const std = @import("std");

const Buffer = struct {
    data: []u8,
    len: usize,
};

fn createBuffer(allocator: std.mem.Allocator, content: []const u8, max_size: usize) !Buffer {
    if (content.len == 0) return error.EmptyContent;
    if (content.len > max_size) return error.ContentTooLarge;

    const data = try allocator.alloc(u8, max_size);
    errdefer allocator.free(data);

    @memcpy(data[0..content.len], content);

    return .{
        .data = data,
        .len = content.len,
    };
}

pub fn main(_: std.process.Init) !void {
    var gpa = std.heap.DebugAllocator(.{}).init;
    defer _ = gpa.deinit();

    const allocator = gpa.allocator();

    const buffer = createBuffer(allocator, "Hello, Zig!", 1024) catch |err| {
        std.debug.print("创建缓冲区失败：{s}\n", .{@errorName(err)});
        return err;
    };
    defer allocator.free(buffer.data);

    std.debug.print(
        "缓冲区 {} 字节：{s}\n",
        .{ buffer.len, buffer.data[0..buffer.len] },
    );
}
```

这个例子里：

- `createBuffer` 用 `!Buffer` 表示“可能失败”
- 参数检查失败时直接 `return error...`
- 分配内存后用 `errdefer` 保证失败路径不泄漏
- `main` 用 `catch` 打印错误并继续向上返回
- 成功拿到 `buffer` 后，用 `defer` 在函数结束时释放资源

这正是 Zig 错误处理最常见、也最推荐的组织方式。

---

## 最佳实践

### 把错误处理当成接口设计的一部分

不要把错误处理看成“最后补上的边角料”。

更好的思路是：

- 这个函数会因为什么失败？
- 哪些失败应该暴露给调用者？
- 哪些失败应该在当前层转换或吸收？
- 成功和失败时资源分别由谁负责？

这些问题越早想清楚，代码越整洁。

### 公共接口优先使用清晰的错误集

```/dev/null/chapter-error-handling.zig#L397-408
const ConfigError = error{
    FileNotFound,
    InvalidFormat,
    MissingRequiredField,
    ValueOutOfRange,
};

// 不推荐
const BadError = error{
    Failed,
    Bad,
    Error,
};
```

好的错误名应该：

- 语义明确
- 能帮助调用者决定处理策略
- 尽量避免模糊词，如 `Failed`、`Bad`、`Error`

### 能传播就先传播，能处理再处理

一般原则是：

- 当前层没有恢复策略 → `try`
- 当前层知道如何恢复或转换 → `catch`

不要为了“显得处理过了”而到处写无意义的 `catch`。

### `defer` 管函数内生命周期，`errdefer` 管失败回滚

这是最重要的实践规则之一：

- **函数内自己用完的资源** → `defer`
- **成功时交给调用者的资源** → `errdefer`

如果这条规则混乱，资源管理通常也会跟着混乱。

### 谨慎使用 `catch unreachable`

只有在你能证明“不可能失败”时才使用。

如果只是“我觉得应该不会出错”，那通常不够。

### 避免把 `anyerror` 当默认方案

`anyerror` 会让接口边界变模糊。除非你确实在做边界适配或原型验证，否则优先写具体错误集。

---

## 常见问题与调试

### 常见错误

错误 1：在不能返回错误的函数里使用 `try`

```/dev/null/chapter-error-handling.zig#L410-421
fn mightFail() !void {
    return error.Failed;
}

// ❌ 错误
fn bad() void {
    // try mightFail();
}

// ✅ 正确
fn good() !void {
    try mightFail();
}
```

根本原因不是“语法不允许”，而是：`try` 需要一个地方把错误继续交出去。

---

错误 2：错误集不兼容

```/dev/null/chapter-error-handling.zig#L423-446
const SpecificError = error{NotFound};
const BroadError = error{NotFound, PermissionDenied};

fn broad() BroadError!void {
    return error.PermissionDenied;
}

// ❌ 错误：BroadError 不能隐式缩小为 SpecificError
fn narrowBad() SpecificError!void {
    return broad();
}

// ✅ 方式 1：显式映射
fn narrowMapped() SpecificError!void {
    broad() catch |err| switch (err) {
        error.NotFound => return error.NotFound,
        error.PermissionDenied => return error.NotFound,
    };
}

// ✅ 方式 2：只有在你能证明安全时才用 @errorCast
fn narrowCast() SpecificError!void {
    broad() catch |err| return @errorCast(err);
}
```

这里真正要理解的是：

> 函数签名写了什么，你就只能返回那个集合允许的错误。

---

错误 3：该用 `defer` 时误用了 `errdefer`

```/dev/null/chapter-error-handling.zig#L448-474
fn allocateAndProcess(allocator: std.mem.Allocator) !void {
    const memory = try allocator.alloc(u8, 100);
    errdefer allocator.free(memory);

    try process(memory);

    // 成功返回时没有释放，也没有转移所有权：泄漏
}
```

正确写法应该是：

```/dev/null/chapter-error-handling.zig#L476-483
fn allocateAndProcess(allocator: std.mem.Allocator) !void {
    const memory = try allocator.alloc(u8, 100);
    defer allocator.free(memory);

    try process(memory);
}
```

如果资源成功时要交给调用者，那才应该写成：

```/dev/null/chapter-error-handling.zig#L485-493
fn allocateForCaller(allocator: std.mem.Allocator) ![]u8 {
    const memory = try allocator.alloc(u8, 100);
    errdefer allocator.free(memory);

    try initialize(memory);
    return memory;
}
```

---

错误 4：把“没有值”误写成错误

如果“没找到”是正常业务结果，就不该强行设计成错误。

```/dev/null/chapter-error-handling.zig#L495-506
fn findUser(id: u32) ?[]const u8 {
    if (id == 1) return "alice";
    return null;
}

fn openConfig(path: []const u8) ![]const u8 {
    if (path.len == 0) return error.NotFound;
    return "config";
}
```

这里：

- `findUser` 的 `null` 是正常结果
- `openConfig` 的错误是失败结果

把这两者混在一起，会让接口语义变差。

---

### 调试建议

**打印错误名**

最直接、最常用的方法是 `@errorName`：

```/dev/null/chapter-error-handling.zig#L508-519
const std = @import("std");

fn riskyOperation() !u32 {
    return error.Timeout;
}

pub fn main(_: std.process.Init) void {
    _ = riskyOperation() catch |err| {
        std.debug.print("错误：{s}\n", .{@errorName(err)});
        return;
    };
}
```

这通常比直接打印错误值更适合教学和日志输出。

**优先保留错误传播链**

调试时，一个常见坏习惯是过早把错误吞掉，例如：

- 直接 `catch 0`
- 直接 `catch return`
- 直接 `catch unreachable`

如果你还没确定问题在哪，先让错误继续传播，通常更容易定位根因。

**在安全检查模式下验证假设**

像 `@errorCast`、`catch unreachable` 这类写法都依赖你的逻辑判断。

因此在开发阶段，应该优先在带安全检查的模式下运行和验证，尽早暴露错误假设。

---

## 本章要点

把整章压缩成几句话，就是：

1. **错误集合**定义“可能有哪些错误”
2. **错误联合类型 `!T`** 定义“结果要么是值，要么是错误”
3. **`try`** 用于把错误继续传播给调用者
4. **`catch`** 用于在当前层处理错误
5. **`errdefer`** 用于失败路径上的清理，尤其适合所有权转移
6. **`?T` 不是错误**，而是“值可能不存在”

如果你已经真正理解了这六点，那么 Zig 的错误处理模型就已经建立起来了。后面无论遇到文件 I/O、分配器、网络请求还是自定义库接口，本质上都还是这套规则的展开。
