# 接口、组合与设计模式

这一章回答一个贴近 Zig 风格的核心问题：

> **当需要抽象一组行为时，应该优先选择泛型、联合类型，还是手写 VTable？**

Zig 不把"接口"当默认起手式，而是强调：

- 先看问题能否在编译期解决
- 先用最简单、最清楚的抽象
- 只有在确实需要运行时切换实现时，才引入更动态的方案

本章围绕一条判断主线展开：**编译期还是运行时？封闭集合还是开放集合？**

---

## 先给结论：三种常见抽象手段怎么选？

| 方案 | 适合场景 | 成本与特点 |
| ---- | -------- | ---------- |
| 泛型 / `anytype` | 类型在编译期已知 | 零运行时开销，最符合 Zig 默认风格 |
| `union(enum)` | 变体集合有限且封闭 | 结构清楚，编译器可穷尽检查 |
| VTable / `*anyopaque` + 函数指针 | 需要运行时动态替换实现 | 最灵活，也最复杂 |

> **注意**：优先从泛型开始；只有在问题明确要求运行时抽象时，再考虑 VTable。

---

## 第一种方案：泛型是默认首选

如果具体类型在编译期已知，通常应优先使用泛型。

### 最小例子

```zig
const std = @import("std");

fn writeLine(writer: anytype, line: []const u8) !void {
    try writer.writeAll(line);
    try writer.writeAll("\n");
}
```

这个函数不要求先定义统一接口类型，只要求传入的对象具备 `writeAll` 方法。编译器在实例化时检查约束是否满足。

**优点**：无运行时分发开销、类型检查在编译期完成、代码更短更直接。

**局限**：不能把不同实现放进同一个运行时容器，不能在运行时决定使用哪种实现。

### 可运行示例

```zig
const std = @import("std");

fn writeLine(writer: anytype, line: []const u8) !void {
    try writer.writeAll(line);
    try writer.writeAll("\n");
}

test "泛型 writeLine" {
    var buf: [64]u8 = undefined;
    var stream = std.io.fixedBufferStream(&buf);
    const writer = stream.writer();

    writeLine(writer, "hello") catch unreachable;
    writeLine(writer, "world") catch unreachable;

    try std.testing.expectEqualStrings("hello\nworld\n", stream.getWritten());
}
```

---

## 第二种方案：tagged union 适合封闭变体

如果面对一个**有限且封闭**的实现集合，`union(enum)` 往往比 VTable 更清楚。

### 典型场景

比如固定的几种输出目标，不需要用户自由扩展：

```zig
const std = @import("std");

const Output = union(enum) {
    buffer: *std.ArrayList(u8),
    stderr,

    fn write(self: Output, msg: []const u8) !void {
        switch (self) {
            .buffer => |list| try list.appendSlice(msg),
            .stderr => std.debug.print("{s}", .{msg}),
        }
    }
};

test "union 分发" {
    var list = std.ArrayList(u8).init(std.testing.allocator);
    defer list.deinit();

    const out = Output{ .buffer = &list };
    try out.write("hello from union");

    try std.testing.expectEqualStrings("hello from union", list.items);
}
```

**优势**：分支可穷尽检查、结构明确、容易阅读和调试、不需要维护函数指针表。

**适用场景**：AST 节点、命令类型、有限状态机、项目内部固定的几种策略。

---

## 第三种方案：VTable 适合开放集合与运行时抽象

只有在需要以下能力时，VTable 才值得引入：

- 运行时动态替换实现
- 擦除具体类型，将不同实现统一存入容器
- 跨模块边界暴露稳定的运行时接口
- 插件式架构

### 最小 VTable 模式

```zig
const std = @import("std");

const Writer = struct {
    ptr: *anyopaque,
    vtable: *const VTable,

    const VTable = struct {
        writeAll: *const fn (ptr: *anyopaque, data: []const u8) anyerror!void,
    };

    pub fn writeAll(self: Writer, data: []const u8) !void {
        try self.vtable.writeAll(self.ptr, data);
    }
};
```

`Writer` 不知道具体实现类型，只持有一个被擦除后的指针和一张函数表。

### 具体实现

```zig
const BufferWriter = struct {
    list: *std.ArrayList(u8),

    fn writeAll(ptr: *anyopaque, data: []const u8) anyerror!void {
        const self: *BufferWriter = @ptrCast(@alignCast(ptr));
        try self.list.appendSlice(data);
    }

    const vtable = Writer.VTable{
        .writeAll = writeAll,
    };

    pub fn writer(self: *BufferWriter) Writer {
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};
```

模式核心有三步：**类型擦除**（具体实现装进 `*anyopaque`）→ **运行时分发**（调用走函数指针）→ **类型恢复**（实现函数内用 `@ptrCast(@alignCast(...))` 转回具体类型）。

### 完整可运行示例

```zig
const std = @import("std");

const Writer = struct {
    ptr: *anyopaque,
    vtable: *const VTable,

    const VTable = struct {
        writeAll: *const fn (ptr: *anyopaque, data: []const u8) anyerror!void,
    };

    pub fn writeAll(self: Writer, data: []const u8) !void {
        try self.vtable.writeAll(self.ptr, data);
    }
};

const BufferWriter = struct {
    list: *std.ArrayList(u8),

    fn writeAll(ptr: *anyopaque, data: []const u8) anyerror!void {
        const self: *BufferWriter = @ptrCast(@alignCast(ptr));
        try self.list.appendSlice(data);
    }

    const vtable = Writer.VTable{
        .writeAll = writeAll,
    };

    pub fn writer(self: *BufferWriter) Writer {
        return .{
            .ptr = self,
            .vtable = &vtable,
        };
    }
};

test "VTable Writer 端到端" {
    var list = std.ArrayList(u8).init(std.testing.allocator);
    defer list.deinit();

    var bw = BufferWriter{ .list = &list };
    const w = bw.writer();

    // 通过擦除后的接口写入
    try w.writeAll("hello ");
    try w.writeAll("vtable");

    try std.testing.expectEqualStrings("hello vtable", list.items);
}
```

---

## 标准库中的真实案例

Zig 标准库大量使用上述三种模式，值得对照学习：

### `std.mem.Allocator` — 经典 VTable 模式

`Allocator` 的结构与上面的 `Writer` 如出一辙：

```zig
// lib/std/mem/Allocator.zig（简化）
ptr: *anyopaque,
vtable: *const VTable,

pub const VTable = struct {
    alloc: *const fn (*anyopaque, len: usize, alignment: Alignment, ret_addr: usize) ?[*]u8,
    resize: *const fn (*anyopaque, memory: []u8, alignment: Alignment, new_len: usize, ret_addr: usize) bool,
    remap: *const fn (*anyopaque, memory: []u8, alignment: Alignment, new_len: usize, ret_addr: usize) ?[*]u8,
    free: *const fn (*anyopaque, memory: []u8, alignment: Alignment, ret_addr: usize) void,
};
```

具体实现（如 `FixedBufferAllocator`）通过 `allocator()` 方法返回 `Allocator`，内部将 `self` 作为 `ptr`、把静态 VTable 取地址作为 `vtable`——和前面 `BufferWriter.writer()` 的模式完全一致。

### `std.Io.Writer` — VTable 模式的完整形态

0.16-dev 中 `std.Io.Writer` 也是 VTable 结构，增加了内置缓冲区：

```zig
// lib/std/Io/Writer.zig（简化）
vtable: *const VTable,
buffer: []u8,
end: usize = 0,
```

这说明 VTable 模式在标准库中已经是成熟的基础设施，而非"教学用的玩具"。

### `@ptrCast(@alignCast(...))` — VTable 实现的标准写法

VTable 实现函数中，通过 `@ptrCast(@alignCast(ptr))` 将 `*anyopaque` 恢复为具体类型：

```zig
// lib/std/heap/FixedBufferAllocator.zig
fn alloc(ctx: *anyopaque, n: usize, alignment: mem.Alignment, ra: usize) ?[*]u8 {
    const self: *FixedBufferAllocator = @ptrCast(@alignCast(ctx));
    // ...
}
```

关于 `@ptrCast` 和 `@alignCast` 的安全前提和完整说明，见[指针类型](../part2-advanced/chapter-pointers.md)章节。

---

## 组合比继承更重要

对 Zig 来说，**组合**往往比"模拟继承体系"更重要。

组合的意思是：一个结构体持有另一个结构体、一个模块调用另一个模块、功能通过显式依赖组装出来。

```zig
const Service = struct {
    allocator: std.mem.Allocator,
    cache: Cache,
    logger: Logger,
};
```

这里表达的不是"Service 继承了什么"，而是 Service 依赖哪些能力、这些能力如何被显式传入、模块边界在哪里。

**好处**：依赖关系更清楚、生命周期更容易追踪、更适合显式资源管理、测试时更容易替换部件。

---

## 什么时候不要用运行时接口？

这个问题比"什么时候该用"还重要。以下场景通常不需要 VTable：

- 只有两三个固定实现
- 调用点的具体类型本来就已知
- 只是想少写几遍相似函数
- 只是因为"别的语言会先定义接口"
- 项目规模还很小，抽象边界并不稳定

这类场景里，运行时接口只会带来更多样板代码、更复杂的调试路径和更模糊的生命周期边界。

---

## VTable 模式最容易踩的坑

如果确实要用 VTable，至少注意以下风险：

1. **生命周期不清楚** — `ptr: *anyopaque` 指向的对象由谁拥有？谁负责释放？接口值是否可能比底层对象活得更久？
2. **类型恢复写错** — `@ptrCast(@alignCast(ptr))` 在恢复具体类型，如果对象类型和假设不一致，后果严重。
3. **把简单问题抽象复杂了** — 很多时候只需要一个泛型函数，却提前上了整套 VTable。
4. **错误边界过于宽泛** — 所有函数都返回 `anyerror` 会让接口语义变得模糊。
5. **混淆"能做"和"应该做"** — 能做运行时多态不代表应该做，这是最常见的设计误区。

---

## 本章小结

在 Zig 中，接口问题本质上是**抽象层次选择问题**：

- **泛型 / `anytype`** — 默认首选，适合编译期已知类型，零运行时开销。
- **`union(enum)`** — 适合封闭变体集合，编译器保证穷尽检查。
- **VTable** — 适合真正需要运行时开放抽象的场景，最灵活也最复杂。标准库的 `std.mem.Allocator` 和 `std.Io.Writer` 都是成熟范例。

把这三种方案的适用边界区分清楚，大多数"接口设计问题"就已经解决了一大半。

---

> **相关阅读**：
>
> 下一章将学习 [与 C 语言的互操作性](chapter-c-interop.md)，从"如何在 Zig 中组织抽象边界"推进到"如何跨 ABI 边界与 C 世界协作"。