# 错误处理

错误处理是 Zig 最核心、也是最具辨识度的语言特性之一。

许多语言把失败路径放在异常系统中，函数签名不直接体现失败可能，控制流可能在运行时离开当前路径。Zig 采用了不同的设计：**把失败纳入类型系统**，通过类型和控制流清楚表达操作是否可能失败、失败时返回什么、错误应当在何处处理。

本章围绕四个核心概念展开：

- **错误集合（error set）**：定义"可能出现哪些错误"
- **错误联合类型（error union）**：定义"结果要么是值，要么是错误"
- **`try` / `catch`**：用于传播或处理错误
- **`errdefer`**：用于失败路径上的资源清理

本章涵盖：

- 错误处理的设计出发点
- 错误联合类型 `!T`
- 错误传播与处理策略
- 失败路径清理：`defer` 与 `errdefer`

## 错误处理的设计出发点

Zig 将失败纳入类型系统，而非依赖异常机制。函数签名直接体现是否可能失败，调用点必须显式处理，控制流始终可见。这一设计使得接口更精确、资源管理更可靠，也更适合系统编程场景。语言设计层面的更多讨论见[认识 Zig](chapter-introduction.md)。

## 错误集合

错误集合用于定义一组命名错误值。

它可以理解为：函数失败时返回的不是任意字符串或整数，而是一组**受类型系统约束的错误值**。

### 为什么需要错误集合？

错误集合带来三方面好处：

- **类型安全**：错误不是随意拼接的文本
- **语义明确**：错误名本身就是接口语义的一部分
- **编译期检查**：函数签名与调用点都可以受到静态约束

例如，“文件不存在”和“权限不足”都表示操作失败，但它们含义不同，调用者也可能需要采用不同的恢复策略。将不同失败原因区分开来，是接口设计的一部分。

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

这里有几个基本要点：

- `error{ ... }` 用于定义错误集合
- 集合中的成员是命名错误值
- 错误值之间可以比较
- 在实际代码中，`error.NotFound` 往往比 `FileError.NotFound` 更常见

### 错误名的全局性

Zig 中的错误名是**全局共享**的。错误集合的作用是约束“当前上下文允许出现哪些错误名”，而不是为每个错误集合单独创建一套命名空间。

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

- `A` 与 `B` 是两个不同的错误集合类型
- 但它们都包含同一个全局错误名 `NotFound`
- 因此赋值时统一使用 `error.NotFound`

可以把错误集合理解为“允许的错误名单”：

- `error{NotFound}` 表示这里只允许 `NotFound`
- `error{NotFound, PermissionDenied}` 表示这里只允许这两个错误

因此，错误集合约束的是**可返回错误的范围**，而不是重新定义一套彼此隔离的错误名。

## 错误类型与错误值

### 错误联合类型：`!T`

错误集合说明了“可能有哪些错误”，但还没有说明“函数成功时返回什么”。这正是错误联合类型要解决的问题。

`ErrorSet!T` 表示：

- 成功时返回一个 `T`
- 失败时返回一个属于 `ErrorSet` 的错误

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

这里的 `ParseError!u32` 表示的不是“两个返回值”，而是“一个结果，其分支要么是 `u32`，要么是 `ParseError` 中的某个错误”。

### `!T` 和 `?T` 的区别

在进一步展开 `!T` 之前，有必要先把它和另一个容易混淆的类型做对比。`!T` 与 `?T` 都表示"不能直接当作普通 `T` 使用"，但它们解决的问题不同：

- `!T`：表示**操作可能失败**
- `?T`：表示**值可能不存在**

```zig
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

- `findUser` 的 `null` 表示“用户不存在”，这是正常业务结果
- `loadUserConfig` 的错误表示“读取操作失败”，这是错误路径

可以用如下经验法则区分：

- **缺席是正常业务状态** → 使用 `?T`
- **失败表示操作未完成** → 使用 `!T`

如果一个操作既可能失败，又可能成功但没有值，则可能出现组合类型；但在学习这一阶段，更重要的是先把 `?T` 与 `!T` 的职责区分清楚。

### 显式错误集与错误集推断

错误联合类型通常有两种写法：

- `SomeError!T`
- `!T`

二者的区别是：

- `SomeError!T`：在签名中显式写出错误集合
- `!T`：由编译器根据函数体推断错误集合

```zig
const std = @import("std");

fn explicit() error{NotFound, PermissionDenied}!void {
    return error.NotFound;
}

fn inferred() !void {
    return error.NotFound;
}

fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    if (a == std.math.minInt(i32) and b == -1) {
        return error.Overflow;
    }
    return @divTrunc(a, b);
}
```

对于 `divide`，编译器会推断出包含 `DivisionByZero` 和 `Overflow` 的错误集合。

可以用下面的原则来判断：

- **公共接口**：优先显式写出错误集合，使边界更清楚
- **内部实现**：可以适度使用推断，减少重复维护

初学阶段更重要的是先理解：`SomeError!T` 和 `!T` 都表示"可能失败"，区别只在于错误集合是**显式写出**，还是**交给编译器推断**。

`anyerror` 是包含所有可能错误名的全局错误集合。它主要用于需要接受任意错误的边界场景（如日志函数、通用错误处理器），但会降低接口精度，不适合作为常规函数签名的默认选择。

### 错误集合之间的关系与转换

这一节最需要掌握的是三件事：

1. 错误集合之间有**子集**与**超集**关系
2. 接口边界上常常需要做**显式映射**
3. `@errorCast` 只用于**已经证明安全**的局部收窄

**子集与超集**

如果一个错误集合是另一个的子集，那么：

- **子集可以隐式转换为超集**
- **超集不能隐式转换为子集**

```zig
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

可以把它理解为：把“更具体”的集合当成“更一般”的集合是安全的；反过来则不安全，因为较宽的错误集可能包含目标集合中不存在的错误。

**显式映射**

当底层错误集不适合直接暴露给上层接口时，应显式整理其语义，而不是直接把底层细节泄漏出去：

```zig
const LowLevelError = error{
    FileNotFound,
    PermissionDenied,
    DiskFull,
};

const PublicError = error{
    NotFound,
    Unavailable,
};

fn mapError(err: LowLevelError) PublicError {
    return switch (err) {
        error.FileNotFound => error.NotFound,
        error.PermissionDenied => error.Unavailable,
        error.DiskFull => error.Unavailable,
    };
}
```

这里的重点不是保留原始错误名，而是把多个底层错误重新组织为更适合对外暴露的接口语义。

**`@errorCast` 的使用边界**

`@errorCast` 适用于另一类情况：错误语义并不改变，只是当前错误值的静态类型过宽，而当前控制流已经证明它属于更小的目标错误集合。

```zig
const std = @import("std");

const BroadError = error{
    NotFound,
    PermissionDenied,
    DiskFull,
};

const NotFoundError = error{NotFound};

fn reportMissing(err: NotFoundError) void {
    std.debug.print("配置文件不存在：{s}\n", .{@errorName(err)});
}

fn handleError(err: BroadError) void {
    switch (err) {
        error.NotFound => reportMissing(@errorCast(err)),
        error.PermissionDenied, error.DiskFull => {
            std.debug.print("配置文件读取失败：{s}\n", .{@errorName(err)});
        },
    }
}
```

这里进入 `error.NotFound` 分支后，当前控制流已经证明 `err` 只能是 `error.NotFound`，因此可以安全地用 `@errorCast(err)` 收窄类型。

可以用下面的标准区分两种做法：

- **需要重新组织接口语义**：使用显式映射
- **不改变语义，只做局部且可证明安全的收窄**：使用 `@errorCast`

**补充：错误集合并**

如果一个函数可能整合多个来源的错误，也可以使用 `||` 合并错误集合：

```zig
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

这种写法常见于上层函数整合多个子系统错误的场景。初学阶段知道它的作用即可，更重要的是先掌握错误集的关系、映射与收窄。

## 错误传播与处理

当一个操作返回错误联合类型时，调用者需要决定如何处理失败路径。常见方式包括：

- 使用 `try` 将错误继续向上传播，适合当前层无法恢复、也不适合决定处理策略的场景
- 使用 `catch` 在当前层处理错误，适合提供默认值、记录日志、转换错误或终止当前分支
- 使用 `if` 分别处理成功值与错误值，适合在同一处同时展开两条控制流并保持表达式风格

选择哪一种方式，取决于当前层是否掌握足够的上下文来处理错误，以及是否需要保留清晰的接口边界。

### `try`：传播错误

`try` 用于传播错误。

它的行为可以概括为：

- 如果表达式成功，取出其中的值
- 如果表达式失败，立即将错误返回给当前函数的调用者

```zig
fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

fn calculate() !i32 {
    const result = try divide(10, 2);
    return result * 2;
}
```

在这个例子中：

- 若 `divide(10, 2)` 成功，`result` 得到正常值
- 若其失败，`calculate` 直接返回对应错误

### `try` 的等价理解

可以把 `try` 近似理解为下面这种写法：

```zig
const result = divide(10, 2) catch |err| {
    return err;
};
```

这种写法并不意味着 `try` 只是简单的语法替换，而是用于说明它的控制流语义：**失败则立即返回，成功才继续执行后续逻辑。**

### `try` 的使用限制

`try` 只能出现在当前函数本身也允许返回错误的上下文中。

可以把下面这段理解为“说明性伪示例”：

```zig
fn mightFail() !void {
    return error.Failed;
}

// 下面这种写法会编译报错：bad 不能返回错误，却试图用 try 继续传播
fn bad() void {
    // try mightFail();
}

fn good() !void {
    try mightFail();
}
```

判断原则可以表述为：**只有当当前函数能够继续向上传播错误时，才可以使用 `try`。**

### `catch`：在当前层处理错误

如果不希望继续传播错误，而是希望在当前层将其处理掉，可以使用 `catch`。

**提供默认值**

```zig
fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

const result = divide(10, 0) catch 0;
```

这里表示：如果计算失败，就使用 `0` 作为替代值。

这种方式适用于“失败后存在合理默认值”的场景。

**捕获错误并执行逻辑**

```zig
const std = @import("std");

fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

fn example() void {
    const result = divide(10, 0) catch |err| {
        std.debug.print("错误：{s}\n", .{@errorName(err)});
        return;
    };

    std.debug.print("结果：{}\n", .{result});
}
```

这里的 `catch |err|` 会把错误值绑定到 `err`，以便执行进一步处理，例如：

- 记录日志
- 转换错误
- 返回默认值
- 提前结束当前函数

**`catch unreachable`**

如果能够严格证明某个操作不会失败，可以写成：

```zig
const value = parseNumber("42") catch unreachable;
```

它的含义不是“忽略错误”，而是断言这里不可能失败；一旦失败，就说明程序的逻辑假设不成立。

如果前面的表达式实际上返回了错误，程序就会执行到 `unreachable`：

- 开启安全检查时，通常会触发运行时安全检查失败
- 关闭安全检查时，属于未定义行为，不能依赖其结果

因此，它只适合用于**逻辑上确实可以证明不失败**的场景，不应用来省略本应存在的错误处理。

**匹配具体错误**

如果不同错误需要不同处理方式，可以在 `catch` 后配合 `switch` 使用。

```zig
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

这种写法适合以下场景：

- 根据错误类别给出不同提示
- 统计不同错误
- 将底层错误映射为更高层的语义

### 用 `if` 同时处理成功和失败

错误联合类型也可以使用 `if` 解包。

```zig
const std = @import("std");

fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

fn example() void {
    if (divide(10, 2)) |value| {
        std.debug.print("成功：{}\n", .{value});
    } else |err| {
        std.debug.print("失败：{s}\n", .{@errorName(err)});
    }
}
```

## 失败路径清理：`errdefer`

### `defer` 和 `errdefer` 的区别

`defer` 与 `errdefer` 都用于作用域结束时的清理，但两者的触发条件不同：

- **`defer`**：无论成功还是失败，作用域结束时都会执行
- **`errdefer`**：只有当前函数以错误返回时才执行

因此，`errdefer` 适合处理“成功时将资源交给调用者，失败时由当前函数回收资源”的场景。

```zig
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

在 `withErrdefer` 中，成功时 `memory` 要返回给调用者。如果这里误用 `defer`，那么函数返回时内存会被立即释放，调用者得到的将是无效内存。

可以用下面这个标准来判断：

- **资源生命周期在当前函数内结束** → 使用 `defer`
- **成功时资源所有权转移给调用者** → 使用 `errdefer`

### 基本用法：失败时回收，成功时转移所有权

`errdefer` 最常见的用途是：资源先由当前函数获取；如果后续失败，就由当前函数回收；如果成功返回，就把资源交给调用者继续管理。

```zig
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

这个例子体现了 `errdefer` 的典型模式：

- `config` 和 `items` 获取成功后，后续步骤仍可能失败
- 如果函数以错误返回，已经获取的资源会自动清理
- 如果函数成功返回，资源所有权转移给调用者，由调用者负责后续释放

这里故意把失败检查放在资源获取之后，是为了说明：当函数在“部分成功”之后出错时，`errdefer` 可以自动完成回滚。

如果 `count > 1000`，函数会以错误返回，此时会先释放 `items`，再销毁 `config`。这也说明多个 `errdefer` 与 `defer` 一样，都是按**后进先出（LIFO）**的顺序执行。

### `errdefer |err|`

`errdefer` 还可以捕获当前即将返回的错误值：

```zig
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

这种写法适合：

- 记录失败日志
- 在清理时附加错误上下文
- 按错误类型执行简单的收尾逻辑

但应当注意，`errdefer |err|` 的主要职责仍然是**失败路径上的收尾**，不宜在其中放入过多复杂业务逻辑。

## 一个完整示例

下面将 `!T`、`try`、`catch` 与 `errdefer` 放在同一个例子中：

```zig
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

**预期输出：**

```text
缓冲区 11 字节：Hello, Zig!
```

这个示例把前面的几个要点串在了一起：

- `createBuffer` 使用 `!Buffer` 表示“该操作可能失败”
- 资源分配成功后，用 `errdefer` 保证失败路径不会泄漏
- `main` 中的 `catch` 并不是为了吞掉错误，而是先补充一条日志，再把错误继续返回给上层
- 成功获得资源后，由调用者用 `defer` 管理资源生命周期

这也是 Zig 中较为典型的错误处理组织方式。

## 实践建议与常见问题

### 实践建议

1. **把错误处理当成接口设计的一部分。**  
   设计接口时，最好尽早想清楚三件事：函数会因为什么失败、哪些错误应暴露给调用者、成功与失败时资源分别由谁负责。边界越清楚，后续实现通常越稳定。

2. **公共接口优先使用清晰、具体的错误集。**

   ```zig
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

   错误名应尽量语义明确，并能帮助调用者决定处理策略。像 `Failed`、`Bad`、`Error` 这样的名称通常过于笼统。

3. **当前层不能处理时，就直接传播。**  
   没有恢复策略时，优先使用 `try`；只有在当前层确实知道如何恢复、转换或终止时，再使用 `catch`。为了“看起来处理过”而写的 `catch` 往往只会让控制流变得更模糊。

4. **谨慎使用 `catch unreachable`。**  
   只有在能够证明“这里不可能失败”时，才应使用 `catch unreachable`。它表达的是断言，而不是简写版的错误处理。

5. **避免把 `anyerror` 当作默认方案。**  
   `anyerror` 会降低接口精度。除非确实处于边界适配、原型验证或特殊抽象层中，否则应优先使用具体错误集。

### 常见问题

1. **错误集不能随意缩小。**  
   函数签名声明了哪些错误，就只能返回这些错误。需要把更宽的错误集变成更窄的错误集时，应显式映射；只有在能够证明安全时，才使用 `@errorCast`。

2. **不要把 `errdefer` 当成普通清理工具。**  
   资源生命周期在当前函数内结束时，应使用 `defer`；只有成功时资源要交给调用者、失败时当前函数负责回滚，才使用 `errdefer`。

3. **区分“没有值”和“操作失败”。**  
   `?T` 适合表示正常的“没有结果”，`!T` 适合表示操作失败。两者混用会削弱接口语义。

### 调试建议

- 使用 `@errorName(err)` 打印错误名，便于观察失败原因。
- 在 Debug 模式下，错误通过 `try` 传播时会自动记录栈追踪信息。当错误最终未被处理时，运行时会打印完整的传播路径，便于定位错误源头。
- 问题尚未定位时，避免过早用 `catch 0`、`catch return` 或 `catch unreachable` 吞掉错误。
- 对 `@errorCast`、`catch unreachable` 这类依赖逻辑前提的写法，应在带安全检查的模式下验证。

## 本章要点

本章核心要点：

1. **失败是显式的。**  
   Zig 不把错误隐藏在隐式机制里，而是要求通过类型和控制流明确表达“这里可能失败”。

2. **错误集合与错误联合类型分工明确。**  
   错误集合描述“可能因为什么失败”，错误联合类型 `!T` 描述“结果要么是值，要么是错误”。

3. **传播与处理要有边界。**  
   当前层不能处理时，用 `try` 继续传播；能够处理时，再用 `catch` 或 `if` 明确展开成功与失败两条路径。

4. **“没有值”与“操作失败”不是一回事。**  
   `?T` 表示值可能不存在，`!T` 表示操作可能失败；两者语义不同，不应混用。

5. **资源清理要与失败路径一起设计。**  
   `defer` 用于正常生命周期内的清理，`errdefer` 用于失败路径上的回滚，尤其适合成功时将资源交给调用者的场景。

6. **接口设计应兼顾错误语义与所有权边界。**  
   公共接口应优先使用清晰、具体的错误集，并尽量明确成功与失败时资源分别由谁负责。
