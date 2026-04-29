# 接口、组合与设计模式

在 Zig 中抽象一组行为时，选择取决于两个维度：**编译期还是运行时？封闭集合还是开放集合？**

三种方案按推荐优先级：

| 方案                             | 适用场景           | 成本与特点       |
| -------------------------------- | ------------------ | ---------------- |
| 泛型 / `anytype`                 | 编译期已知类型     | 零运行时开销     |
| `union(enum)`                    | 封闭变体集合       | 编译器穷尽检查   |
| VTable / `*anyopaque` + 函数指针 | 运行时动态替换实现 | 最灵活，也最复杂 |

## 泛型：`anytype`

具体类型在编译期已知时，泛型是默认首选。

```zig
const std = @import("std");

fn writeLine(writer: anytype, line: []const u8) !void {
    try writer.writeAll(line);
    try writer.writeAll("\n");
}

test "泛型 writeLine" {
    var buf: [64]u8 = undefined;
    var writer: std.Io.Writer = .fixed(&buf);

    writeLine(writer, "hello") catch unreachable;
    writeLine(writer, "world") catch unreachable;

    try std.testing.expectEqualStrings("hello\nworld\n", writer.buffered());
}
```

函数不要求提前定义统一接口类型，只要求传入对象具备 `writeAll` 方法。编译器在实例化时检查约束。

**优点**：无运行时分发开销、编译期类型检查、代码简洁。

**局限**：不能把不同实现放进同一个运行时容器，不能在运行时切换实现类型。

## Tagged Union：`union(enum)`

实现集合有限且封闭时，`union(enum)` 比 VTable 更清楚。

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

**优势**：分支穷尽检查、结构明确、易阅读调试、无需维护函数指针表。

**适用场景**：AST 节点、命令类型、有限状态机、项目内部固定的几种策略。

## VTable：`*anyopaque` + 函数指针

VTable 是开放集合与运行时抽象的工具，核心三步：**类型擦除**（`*anyopaque`）→ **运行时分发**（函数指针）→ **类型恢复**（`@ptrCast(@alignCast(...))`，将 `*anyopaque` 还原为具体类型）。关于指针转换的安全前提，见[指针、切片与对齐](chapter-pointers.md)。

只有在需要以下能力时才引入：
- 运行时动态替换实现
- 擦除具体类型，将不同实现存入统一容器
- 跨模块边界暴露稳定的运行时接口
- 插件式架构

```zig
const std = @import("std");

const Writer = struct {
    ptr: *anyopaque,
    vtable: *const VTable,

    const VTable = struct {
        write: *const fn (ptr: *anyopaque, data: []const u8) anyerror!void,
    };
    pub fn write(self: Writer, data: []const u8) !void {
        try self.vtable.write(self.ptr, data);
    }
};

// 实现一：写入 ArrayList
const Buf = struct {
    list: *std.ArrayList(u8),
    fn write(ptr: *anyopaque, data: []const u8) anyerror!void {
        const self: *Buf = @ptrCast(@alignCast(ptr));
        try self.list.appendSlice(data);
    }
    const vtable = Writer.VTable{ .write = write };
    pub fn writer(self: *Buf) Writer {
        return .{ .ptr = self, .vtable = &vtable };
    }
};

// 实现二：只计数，不存储
const Count = struct {
    n: usize = 0,
    fn write(ptr: *anyopaque, data: []const u8) anyerror!void {
        const self: *Count = @ptrCast(@alignCast(ptr));
        self.n += data.len;
    }
    const vtable = Writer.VTable{ .write = write };
    pub fn writer(self: *Count) Writer {
        return .{ .ptr = self, .vtable = &vtable };
    }
};

test "VTable 多实现" {
    var list = std.ArrayList(u8).init(std.testing.allocator);
    defer list.deinit();

    var buf = Buf{ .list = &list };
    var cnt = Count{};

    // 同一个 Writer 类型，赋值为不同实现
    var w: Writer = buf.writer();
    try w.write("hello");       // 写入 list
    w = cnt.writer();
    try w.write("discarded");   // 只计数，不存储

    try std.testing.expectEqualStrings("hello", list.items);
    try std.testing.expectEqual(@as(usize, 9), cnt.n);
}
```

`Buf` 和 `Count` 是两个不同实现，但 `var w: Writer` 可以先后指向两者——这就是 VTable 解决的核心问题：在运行时替换实现，无需修改调用代码。

注意：VTable 接口的定义（`Writer` 的 VTable 和 `write` 方法）只在声明接口时写一次。实现侧的 `const vtable = ...` 和 `pub fn writer(...)` 是机械的固定模式。工程中标准库已经把最常见接口（`Allocator`、`Io.Writer`/`Reader`）给出了成品，大多数场景下是**实现既有接口**而非创建新 VTable。

### 何时避免 VTable

以下场景通常不需要运行时接口：

- 只有两三个固定实现
- 调用点具体类型已知
- 只是想减少重复函数，并非需要运行时多态
- 项目规模小，抽象边界不稳定
- 仅仅因为"别的语言先定义接口"而引入

这类场景引入 VTable 只会增加样板代码、复杂调试路径和模糊的生命周期边界。

### 常见陷阱

1. **生命周期不清** — `ptr: *anyopaque` 指向的对象由谁拥有、谁负责释放？接口值是否可能比底层对象活得更久？
2. **类型恢复写错** — `@ptrCast(@alignCast(ptr))` 恢复时，类型与假设不一致会导致未定义行为。
3. **过度抽象** — 允许运行时多态不代表应该使用。
4. **错误边界过宽** — 所有函数返回 `anyerror` 让接口语义模糊。
5. **把泛型问题当成 VTable 问题** — 很多场景一个 `anytype` 函数就足够。

## 标准库中的 VTable

`std.mem.Allocator` 和 `std.Io.Writer` 是 Zig 标准库中两个最核心的 VTable 实例。它们的实现模式和前面的 `Writer` 完全一致，但规模更大、更工程化。

### `std.mem.Allocator`

`Allocator` 的结构与上面的 `Writer` 一致：

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

具体实现（如 `FixedBufferAllocator`）通过 `allocator()` 方法返回 `Allocator`，与前面 `BufferWriter.writer()` 的模式一致。

### `std.Io.Writer`

`std.Io.Writer` 也是 VTable 结构，增加了内置缓冲区：

```zig
// lib/std/Io/Writer.zig（简化）
vtable: *const VTable,
buffer: []u8,
end: usize = 0,
```

## 组合比继承更重要

在 Zig 中，组合比模拟继承体系更自然。依赖关系、模块边界和生命周期通过结构体字段显式表达：

```zig
const Service = struct {
    allocator: std.mem.Allocator,
    io: std.Io,

    pub fn process(self: *Service, path: []const u8) !void {
        const file = try std.Io.Dir.cwd().openFile(self.io, path, .{});
        defer file.close(self.io);

        var buf: [4096]u8 = undefined;
        var reader = file.reader(self.io, &buf);
        const content = try reader.interface.allocRemaining(self.allocator, .limited(1024 * 1024));
        defer self.allocator.free(content);

        // 业务逻辑...
    }
};
```

这里的 Service 不"继承"任何父类型，但通过持有 `allocator` 和 `io` 两个字段，自然获得了内存管理和文件 I/O 的能力。这与 VTable 模式互补：组合定义依赖关系，VTable 在需要运行时替换时才引入。

## 小结

- **泛型 / `anytype`** — 默认首选，编译期已知类型，零运行时开销。
- **`union(enum)`** — 封闭变体集合，编译器穷尽检查。
- **VTable** — 开放运行时抽象，最灵活也最复杂。`std.mem.Allocator` 和 `std.Io.Writer` 是成熟范例。

区分清楚三种方案的适用边界，就解决了大多数接口设计问题。

---

> **相关阅读**：[与 C 语言的互操作性](chapter-c-interop.md)
