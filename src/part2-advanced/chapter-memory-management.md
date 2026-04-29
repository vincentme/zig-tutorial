# 内存管理模型

Zig 没有垃圾回收器，没有借用检查器。内存管理的核心原则只有一条：**需要分配内存的函数，显式接收 Allocator 参数**。谁分配、谁拥有、谁释放——全部由开发者显式决定。

## Allocator 接口

`std.mem.Allocator` 是所有分配器的统一接口，内部是 `ptr` + `vtable`（详见[接口与设计模式](chapter-interfaces.md)）。核心方法：

| 方法            | 用途                     | 用法                            |
| --------------- | ------------------------ | ------------------------------- |
| `create(T)`     | 分配单个 `T` 并返回 `*T` | `var p = try a.create(i32)`     |
| `destroy(ptr)`  | 释放 `create` 返回的指针 | `a.destroy(p)`                  |
| `alloc(T, n)`   | 分配 `n` 个 `T` 值的空间 | `var buf = try a.alloc(u8, 64)` |
| `free(slice)`   | 释放 `alloc` 返回的切片  | `a.free(buf)`                   |
| `realloc(s, n)` | 调整已有切片的大小       | `buf = try a.realloc(buf, 128)` |


`alloc` 和 `free` 配对，`create` 和 `destroy` 配对——混用会导致未定义行为。跨分配器混用（如 Arena 分配后用 page_allocator 释放）同样是未定义行为：不同分配器的内部布局、元数据和释放策略各不相同，常见的后果包括运行时崩溃、堆损坏或静默泄漏。

`realloc` 用于调整已有切片的大小——分配器会在原地尝试扩容，空间不够时自动分配新内存并复制数据、释放旧区域：

## 所有权

### 转移所有权：函数分配，调用者释放

```zig
const std = @import("std");

fn createBuffer(allocator: std.mem.Allocator, len: usize) ![]u8 {
    const buffer = try allocator.alloc(u8, len);
    return buffer; // 所有权转移给调用者
}

test "transfer ownership" {
    const a = std.testing.allocator;
    const buf = try createBuffer(a, 128);
    defer a.free(buf);
}
```

`createBuffer` 分配并返回内存——调用者接收所有权，负责释放。

### 借用：只读视图不拥有

```zig
fn countSpaces(text: []const u8) usize {
    var count: usize = 0;
    for (text) |ch| {
        if (ch == ' ') count += 1;
    }
    return count;
}
```

`[]const u8` 表示「借用一段只读数据」，不拥有、不释放。

### 栈 vs 堆

栈变量随作用域自动回收，不需要 allocator：

```zig
var value: i32 = 42; // 栈上
```

堆内存通过 allocator 申请，生命周期可超出作用域，必须手动释放：

```zig
const a = std.testing.allocator;
const ptr = try a.create(i32); // 堆上
defer a.destroy(ptr);
```

能用栈时优先用栈——需要动态大小或跨作用域生命周期时再引入堆分配。

## 常用分配器

Zig 0.16 中，`main` 函数通过 `std.process.Init` 直接提供 `gpa` 和 `io`。`gpa` 实际上是一个 `GeneralPurposeAllocator`，内部组合了多种分配策略，适合作为程序的通用分配器：

```zig
pub fn main(init: std.process.Init) !void {
    const gpa = init.gpa;
    const io = init.io;
    // ...
}
```

### `std.testing.allocator`

测试专用，自带泄漏检测。每个 `test` 块结束时自动检查，发现泄漏则测试失败：

```zig
test "testing allocator" {
    const a = std.testing.allocator;
    const buf = try a.alloc(u8, 32);
    defer a.free(buf);
}
```

### `std.heap.ArenaAllocator`

批量分配，统一释放。适合阶段性对象（解析配置、构造 AST、单次请求）：

```zig
var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
defer arena.deinit();
const a = arena.allocator();

const first = try a.alloc(u8, 10);
const second = try a.alloc(u8, 20);
// 不需要逐项 free——arena.deinit() 统一回收
```

0.16 中 ArenaAllocator 已是 lock-free 且线程安全，无需额外包装。代价是中间无法回收单个对象，arena 生命周期过长可能退化为慢性泄漏。

### `std.heap.FixedBufferAllocator`

在已有内存块上分配，不向系统扩张。适合已知大小上限或嵌入式场景：

```zig
var buf: [4096]u8 = undefined;
var fba = std.heap.FixedBufferAllocator.init(&buf);
const a = fba.allocator();

const slice = try a.alloc(u8, 256); // 从 buf 中分配
```

超量分配直接报错——「宁可早点失败，不无限增长」。

### `std.heap.DebugAllocator`

任何程序中启用泄漏检测和双重释放检测。非测试环境下最实用的调试工具：

```zig
var debug_alloc: std.heap.DebugAllocator(.{}) = .init;
const a = debug_alloc.allocator();

const buf = try a.alloc(u8, 1024);
a.free(buf);

_ = try a.alloc(u8, 512); // 故意不释放

const check = debug_alloc.deinit(); // 打印泄漏回溯到 stderr
if (check == .leak) @panic("memory leak");
```

> `std.testing.allocator` 底层就是 `DebugAllocator`。

### `std.heap.page_allocator`

直接向操作系统申请内存，常用作 Arena 或 DebugAllocator 的后端：

```zig
const a = std.heap.page_allocator;
const buf = try a.alloc(u8, 4096);
defer a.free(buf);
```

## 资源清理：`defer` 与 `errdefer`

### 正常路径

```zig
const buf = try a.alloc(u8, 64);
defer a.free(buf);
// 函数结束时 buf 自动释放
```

### 半初始化资源清理

多次分配时，任何一次失败都必须回收已分配的资源。`errdefer` 只在函数以错误返回时执行：

```zig
fn makePair(a: std.mem.Allocator) !struct { x: []u8, y: []u8 } {
    const x = try a.alloc(u8, 8);
    errdefer a.free(x); // 后续失败时回收 x

    const y = try a.alloc(u8, 16);
    errdefer a.free(y); // 后续失败时回收 y

    return .{ .x = x, .y = y };
}

test "makePair" {
    const a = std.testing.allocator;
    const pair = try makePair(a);
    defer a.free(pair.x);
    defer a.free(pair.y);
}
```

模式：每次成功分配后紧跟 `errdefer`。成功返回时 `errdefer` 不执行，失败时按 LIFO 逆序回收。多个 `defer` / `errdefer` 混用时，执行顺序也是 LIFO——最后注册的最先执行。

## 0.16 容器与 Allocator

0.16 中 `ArrayList` 和大部分容器采用非托管设计——内部不存 allocator，每个需要分配的方法都显式传入：

```zig
test "ArrayList in 0.16" {
    const a = std.testing.allocator;
    var list: std.ArrayList(u32) = .empty;       // 零初始化，无需 allocator
    defer list.deinit(a);                         // 释放时传入

    try list.append(a, 42);                       // 每个操作传 allocator
    try list.appendSlice(a, &.{ 10, 20, 30 });

    try std.testing.expectEqual(@as(usize, 4), list.items.len);
}
```

这个设计与 allocator 显式传递一脉相承：容器的内存策略完全由调用方控制，不会有隐藏分配。

> `HashMap` 系列中，`AutoHashMap` 和 `StringHashMap` 仍是托管类型（结构体内存 allocator），这是为了保持 key/value 查询 API 的简洁性。详见[常用标准库模块详解](chapter-standard-library-detail.md)。

## 要点

- **显式传递 allocator**——不依赖全局状态，分配策略由调用方决定
- **所有权清楚**——函数分配 → 调用者释放；接收 `[]const T` → 只借用
- **`errdefer` 是安全网**——半初始化资源必须回收
- **能用栈先用栈**——堆分配引入生命周期和释放责任
- **选对分配器**——测试用 `testing.allocator`，批量对象用 Arena，调试用 `DebugAllocator`
- **0.16 容器不存 allocator**——`.empty` 初始化，方法传 allocator

> **相关阅读**：[接口与设计模式](chapter-interfaces.md)、[指针、切片与对齐](chapter-pointers.md)、[常用标准库模块详解](chapter-standard-library-detail.md)
