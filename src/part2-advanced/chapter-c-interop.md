# 与 C 语言的互操作性

Zig 与 C 的互操作核心是 **ABI 边界**：函数签名、数据布局、字符串表示、所有权责任、构建与链接。真正的难点不在 `@cImport` 语法本身，而在于确保边界两侧的类型和对齐一致。

四类边界决定了互操作的成败：

1. **函数调用边界** — Zig ↔ C 的函数调用约定
2. **数据表示边界** — 基本类型、结构体、指针、字符串在 ABI 上是否匹配
3. **资源管理边界** — 分配与释放的归属
4. **构建与链接边界** — 头文件、系统库的路径与链接

---

## ABI 与类型差异

ABI（Application Binary Interface）决定了函数参数如何传递、返回值如何传回、结构体如何布局。Zig 的切片 `[]T`（指针+长度）、可选类型 `?T`、错误联合 `!T` 等在 Zig 内部很有表达力，但跨 ABI 边界时应退回到更基础的表示：裸指针、显式长度、整数错误码、`extern struct`。

跨边界时需明确：
- 传的是切片还是裸指针？是否需要传长度？
- 是否要求 NUL 终止？
- 是否要求 `extern struct` 保证 C ABI 布局？
- 错误该转换成什么？

---

## 导入 C

### `@cImport`

```zig
const c = @cImport({
    @cInclude("stdio.h");
});

pub fn main() void {
    _ = c.printf("hello from C\n");
}
```

字符串字面量是 `*const [N:0]u8`，自动强转为 `[:0]const u8`，NUL 终止，传给 C 是安全的。但运行时构造的 `[]const u8` 并不保证 NUL 终止——这是最常见的坑。

### `zig translate-c`

`zig translate-c` 将 C 头文件翻译为等价的 Zig 声明，用于了解 C 类型在 Zig 中的对应关系：

```sh
zig translate-c point.h
```

对于 C 端的 `typedef struct { float x, y; } Point;`，输出大致为：

```zig
pub const Point = extern struct { x: f32, y: f32 };
pub extern fn make_point(x: f32, y: f32) Point;
```

翻译结果是机器生成的参考，不适合直接复制到项目中。

---

## 字符串

C 和 Zig 对字符串的表示有本质区别：

| | C 字符串 (`char*`) | Zig `[]const u8` | Zig `[:0]const u8` |
|---|---|---|---|
| 结构 | 裸指针 + `'\0'` 结尾 | 指针 + 长度 | 指针 + 长度 + 保证 NUL |
| NUL 终止 | 必须 | 不保证 | 保证 |
| 直接传 C | ✓ | ✗ | ✓（通过 `.ptr`） |

核心规则：`[]const u8` 不是合法的 C 字符串。使用 `allocator.dupeZ` 复制并追加 NUL：

```zig
const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn main() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const zig_path: []const u8 = "example.txt";

    // dupeZ 复制切片并追加 NUL，返回 [:0]u8
    const c_path = try allocator.dupeZ(u8, zig_path);
    defer allocator.free(c_path);

    const file = c.fopen(c_path.ptr, "rb");
    if (file == null) {
        std.debug.print("failed to open file\n", .{});
        return;
    }
    defer _ = c.fclose(file);
}
```

`dupeZ` 返回 `[:0]u8`，编译器层面保证 NUL 终止。非零哨兵值可用 `allocator.dupeSentinel(u8, slice, sentinel_value)`。

---

## 资源与所有权

跨语言边界的资源管理遵循三条原则：

1. **谁分配，谁释放** — Zig 分配 → Zig 释放，C 分配（`malloc`）→ C 释放（`free`）。
2. **不混用分配器** — Zig allocator 和 C allocator 的实现、元数据布局、调试状态都可能不同，混用会导致未定义行为。
3. **优先使用 C 库提供的构造函数** — 如果 C 库提供了 `xxx_create()` / `xxx_destroy()` 等入口，应优先使用它们，因为库作者往往隐含了字段初始化顺序、额外状态位、平台相关设置等约束。手工填结构体字段容易被库内部约定所困。

---

## extern struct

跨 ABI 边界传递或共享布局的结构体应使用 `extern struct`，保证字段顺序与 C 一致、对齐规则匹配 C ABI：

```zig
const std = @import("std");

const Pixel = extern struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8,

    fn isOpaque(self: Pixel) bool {
        return self.a == 0xFF;
    }
};

test "Pixel layout" {
    try std.testing.expectEqual(4, @sizeOf(Pixel));
    try std.testing.expectEqual(0, @offsetOf(Pixel, "r"));
    try std.testing.expectEqual(1, @offsetOf(Pixel, "g"));
    try std.testing.expectEqual(2, @offsetOf(Pixel, "b"));
    try std.testing.expectEqual(3, @offsetOf(Pixel, "a"));

    const px = Pixel{ .r = 255, .g = 128, .b = 0, .a = 255 };
    try std.testing.expect(px.isOpaque());
}
```

纯 Zig 内部用普通 `struct` 即可，编译器可自由优化布局。`extern struct` 仅用于确实要跨 ABI 边界的类型。

---

## 导出给 C

`export fn` 导出 C ABI 兼容的函数。边界上的类型必须收缩到 C 可理解的范围——基本类型、指针、`extern struct`，不应暴露 `[]T`、`?T`、`!T` 等 Zig 特有类型。传递数组的标准模式是 `ptr + len`：

```zig
// mathlib.zig
const std = @import("std");

export fn add(a: c_int, b: c_int) c_int {
    return a + b;
}

export fn sum_array(ptr: [*]const c_int, len: usize) c_int {
    const items = ptr[0..len];
    var total: c_int = 0;
    for (items) |v| total += v;
    return total;
}
```

对应的 C 头文件：

```c
#ifndef MATHLIB_H
#define MATHLIB_H

#include <stddef.h>

int add(int a, int b);
int sum_array(const int *ptr, size_t len);

#endif
```

对外 ABI 设计通常比 Zig 内部 API 更朴素——这不是退步，而是边界设计本来就更保守。

---

## 回调函数

C 库通过函数指针接受回调时（排序、事件、线程入口等），Zig 侧需声明 `callconv(.c)`：

```zig
const std = @import("std");

const c = @cImport({
    @cInclude("stdlib.h");
});

fn compareInts(a: ?*const anyopaque, b: ?*const anyopaque) callconv(.c) c_int {
    const val_a: *const i32 = @ptrCast(@alignCast(a));
    const val_b: *const i32 = @ptrCast(@alignCast(b));
    if (val_a.* < val_b.*) return -1;
    if (val_a.* > val_b.*) return 1;
    return 0;
}

test "qsort callback" {
    var data = [_]i32{ 42, 7, -3, 100, 0 };
    c.qsort(@ptrCast(&data), data.len, @sizeOf(i32), &compareInts);
    try std.testing.expectEqualSlices(i32, &.{ -3, 0, 7, 42, 100 }, &data);
}
```

关键要素：`callconv(.c)` 匹配 C 调用约定；`?*const anyopaque` 对应 `const void*`，需 `@ptrCast(@alignCast(...))` 恢复具体类型；返回 `c_int` 匹配 C 的 `int`。

---

## 构建与链接

在 `build.zig` 中链接 C 库：

```zig
// build.zig 片段
const exe = b.addExecutable(.{
    .name = "my_app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .link_libc = true,
    }),
});

exe.root_module.linkSystemLibrary("z", .{});
exe.root_module.addIncludePath(b.path("vendor/include"));

b.installArtifact(exe);
```

构建脚本的核心意图只有几类：链接系统库（`linkSystemLibrary`）、启用 libc（`link_libc = true`）、添加头文件路径（`addIncludePath`）、添加 C 源文件（`addCSourceFiles`）。遇到不确定的写法时，先理解目标再核对本地 Zig 版本的 API。

---

## 常见陷阱

1. **把 `[]const u8` 直接传给 C** — 只保证长度，不保证 NUL 终止。
2. **所有权不清** — 跨语言边界不明确分配/释放责任，导致泄漏或双重释放。
3. **手工拼 C 对象** — 忽略库的内部约定（字段顺序、状态位、平台设置）。
4. **把 Zig 类型直接暴露给 C** — 导出边界应使用基本类型和 `extern struct`。
5. **构建失败误判为语法问题** — 先检查头文件是否可见、系统库是否安装、链接路径是否正确。
6. **认为 `c_int`/`c_long` 跨平台一致** — 这些是 ABI 类型，大小随平台变化。

排查顺序：先查边界类型（是否要求 NUL 终止？是否需 `extern struct`？），再查所有权（谁分配？谁释放？混用了分配器？），再查构建（头文件路径、系统库安装、版本 API 匹配），最后再怀疑 API 细节。

---

## 小结

- **C 互操作首先是 ABI 问题**：类型匹配、布局一致、调用约定正确。
- **字符串**：`[]const u8` 不等于 C 字符串，`[:0]const u8` 才是桥梁。`dupeZ` 是最常用的转换方式。
- **所有权**：谁分配谁释放，不混用分配器，优先使用 C 库的构造/析构函数。
- **`extern struct`** 保证 C ABI 布局，`export fn` 导出 C 可调用函数，`callconv(.c)` 让 Zig 函数可作为 C 回调。
- **构建**：`link_libc = true`、`linkSystemLibrary`、`addIncludePath` 覆盖大多数场景。
- **排查**：边界类型 → 所有权 → 构建与链接 → API 细节，按此顺序避免方向性错误。

---

> **相关阅读**：下一章 [并发编程概述](chapter-concurrency.md)
