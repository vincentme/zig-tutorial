# 与 C 语言的互操作性

Zig 与 C 的互操作有两个方向：**调用 C 库**和**导出给 C 用**。本章围绕这两个端到端的例子展开——先完成一个完整的 C 库调用，再完成一个 Zig 库的 C 接口导出。

## 调用 C 库：以 zlib 为例

目标：用 Zig 写一个程序，调用 zlib 的 `compress` / `uncompress` 函数压缩和解压一段数据。

### 导入头文件

`@cImport` 将 C 头翻译为 Zig 声明。导入 `zlib.h` 后，所有公开函数和类型都通过 `c` 命名空间访问：

```zig
const c = @cImport({
    @cInclude("zlib.h");
});
```

> `@cImport` 在 0.16 中标记为废弃。新项目建议在 `build.zig` 中用 `addTranslateC` 翻译头文件，再 `@import("c")`。此处沿用 `@cImport` 是因为它只需一行代码，适合展示概念。

### C 类型在 Zig 中的对应

打开 `zlib.h` 能看到两个关键类型——`uLong` 和 `Bytef`。借助 `zig translate-c` 可以快速看到翻译后的 Zig 形态：

```sh
zig translate-c /usr/include/zlib.h | grep -A2 "uLong\|Bytef"
```

翻译结果大致为：

```zig
pub const uLong = c_ulong;
pub const Bytef = u8;
```

Zig 为所有 C 基本类型提供了对应名称：`c_int`、`c_uint`、`c_ulong`、`c_char` 等。它们的大小随目标平台变化——`c_long` 在 64 位 Linux 上是 8 字节，在 64 位 Windows 上是 4 字节。跨平台代码应使用这些类型而非直接假设位宽。

结构体用 `extern struct` 声明。`extern` 告诉编译器按 C 的规则排布字段——顺序不可重排，对齐与 C 一致：

```zig
const z_stream = extern struct {
    next_in: ?*u8,
    avail_in: c_uint,
    total_in: c_ulong,
    // ...
};
```

普通 Zig `struct` 不保证字段顺序和对齐与 C 匹配，跨 ABI 边界传递时必须用 `extern struct`。

### 字符串：跨边界的最大坑

`compress` 接收 `*const u8` 的输入缓冲区和长度——没有 NUL 终止的要求，字节切片 `[]const u8` 可以直接传。但如果 C 函数期望的是一个 C 字符串（比如文件路径），就必须做转换：

```zig
const path = "data.bin";                             // *const [8:0]u8
const c_path = try allocator.dupeZ(u8, path);        // 复制并追加 \0
defer allocator.free(c_path);
const file = c.fopen(c_path.ptr, "rb");              // C 侧收到合法的 char*
```

Zig 字符串字面量是 `*const [N:0]u8`——自动 NUL 终止，所以 `"rb"` 可以直接传。但运行时构造的 `[]const u8` 不保证 NUL，必须通过 `dupeZ` 显式转换。这张表是所有字符串讨论的基础：

|          | C 字符串 | Zig `[]const u8` | Zig `[:0]const u8` |
| -------- | -------- | ---------------- | ------------------ |
| NUL 终止 | 必须     | 不保证           | 保证               |
| 直接传 C | ✓        | ✗                | ✓（通过 `.ptr`）   |

### 资源所有权：谁分配谁释放

zlib 的 `compressBound` 返回压缩后大小的上界，`compress` 写入调用者提供的缓冲区。整个过程分配和释放都在 Zig 侧，不涉及跨语言所有权：

```zig
const src = "hello hello hello hello hello";
const bound = c.compressBound(src.len);
const dest = try allocator.alloc(u8, bound);
defer allocator.free(dest);

var dest_len: c_ulong = bound;
_ = c.compress(dest.ptr, &dest_len, src.ptr, src.len);
```

如果 C 库在内部分配了内存并期望调用者释放（比如某些库的 `xxx_free`），规则很简单：**谁分配谁释放**——C 的 `malloc` 对应 C 的 `free`，Zig 的 allocator 对应 Zig 的 `free`。混用会导致未定义行为。如果 C 库提供 `xxx_create` / `xxx_destroy` 构造析构函数，直接使用它们，不要手工拼结构体字段。

### 构建：链接系统库

代码写完，在 `build.zig` 中声明对 zlib 的依赖：

```zig
const exe = b.addExecutable(.{
    .name = "zlib-demo",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .link_libc = true,                  // 启用 libc（大部分 C 库需要）
    }),
});
exe.root_module.linkSystemLibrary("z", .{}); // 链接系统的 libz
b.installArtifact(exe);
```

`link_libc = true` 告诉 Zig 链接器引入 C 标准库。`linkSystemLibrary("z")` 搜索系统路径中的 `libz.so` / `libz.a`。头文件搜索路径可以用 `addIncludePath` 补充。

构建脚本的核心意图只有几类：

| 需求                | 写法                             |
| ------------------- | -------------------------------- |
| 启用 C 标准库       | `.link_libc = true`              |
| 链接系统库          | `linkSystemLibrary("name", .{})` |
| 添加头文件路径      | `addIncludePath(b.path("..."))`  |
| 编译额外的 C 源文件 | `addCSourceFiles`                |

---

## 回调：把 Zig 函数传给 C

很多 C 库通过函数指针接受回调。经典例子是用 C 标准库的 `qsort` 排序一个 i32 数组——Zig 侧写比较函数，传给 C：

```zig
const c = @cImport({ @cInclude("stdlib.h"); });

fn compareInts(a: ?*const anyopaque, b: ?*const anyopaque) callconv(.c) c_int {
    const va: *const i32 = @ptrCast(@alignCast(a));
    const vb: *const i32 = @ptrCast(@alignCast(b));
    if (va.* < vb.*) return -1;
    if (va.* > vb.*) return 1;
    return 0;
}

test "qsort" {
    var data = [_]i32{ 42, 7, -3, 100, 0 };
    c.qsort(@ptrCast(&data), data.len, @sizeOf(i32), &compareInts);
    try std.testing.expectEqualSlices(i32, &.{ -3, 0, 7, 42, 100 }, &data);
}
```

三个关键点：

- **`callconv(.c)`** — 使用 C 调用约定，C 库才能正确调用
- **`?*const anyopaque`** — `const void*` 的 Zig 对应，需要 `@ptrCast(@alignCast(...))` 恢复具体类型。`anyopaque` 的对齐是 1，而 `*const i32` 的对齐是 4，所以必须同时做对齐转换
- **`c_int`** — 返回类型和 C 的 `int` 一致

---

## 导出给 C：Zig 库的 C 接口

换一个方向：用 Zig 写一个数学库，暴露 C ABI 函数给 C 程序调用。

### Zig 侧：`export fn`

```zig
// mathlib.zig
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

`export` 关键字自动使用 C 调用约定。边界上的类型必须收缩到 C 可理解的范围——`c_int`、`usize`（C 的 `size_t`）、`[*]const T`（C 的 `const T*`）。不能出现 `[]T`（胖指针）、`!T`（错误联合）、`?T`（可选类型）。

### C 侧：头文件与调用

C 程序需要一个对应的头文件来声明这些导出函数：

```c
// mathlib.h
#ifndef MATHLIB_H
#define MATHLIB_H
#include <stddef.h>
int add(int a, int b);
int sum_array(const int *ptr, size_t len);
#endif
```

```c
// main.c
#include <stdio.h>
#include "mathlib.h"
int main(void) {
    printf("%d\n", add(3, 4));           // 7
    int nums[] = {10, 20, 30};
    printf("%d\n", sum_array(nums, 3));  // 60
}
```

编译时把 Zig 编译为静态库或动态库，C 侧链接即可。传递数组的标准模式是 `ptr + len`——Zig 的切片在 ABI 上等价于一个指针和一个长度，分开传就是合法的 C 接口。

---

## 常见陷阱

1. **把 `[]const u8` 直接传给 C** — 只保证长度，不保证 NUL 终止。用 `dupeZ` 显式转换。
2. **所有权不清** — C 分配 → C 释放，Zig 分配 → Zig 释放。不混用。
3. **手工拼 C 结构体** — 优先使用 C 库的 `xxx_create` / `xxx_destroy`。
4. **导出 Zig 特有类型** — `[]T`、`!T`、`?T` 在 ABI 上没有稳定表示，用裸指针和错误码替代。
5. **认为 `c_int` / `c_long` 跨平台一致** — C 类型随目标平台变化。
6. **构建失败误判为语法问题** — 先检查 `link_libc` 是否启用、系统库是否安装、头文件路径是否正确。

---

## 小结

C 互操作的本质是 **ABI 边界**——确保双方看到的类型、布局、调用约定一致。核心工具只有几样：

- **调用 C**：`@cImport`（或 `addTranslateC`）导入头文件，`extern struct` 匹配布局，`dupeZ` 处理字符串，`linkSystemLibrary` 链接
- **导出 Zig**：`export fn` 暴露 C ABI，`c_int` / `[*]const T` / `ptr + len` 替代 Zig 特有类型
- **回调**：`callconv(.c)` + `?*const anyopaque` + `@ptrCast(@alignCast(...))`
- **资源**：谁分配谁释放，不混用，优先用库的构造析构函数

> **相关阅读**：[并发编程概述](chapter-concurrency.md)
