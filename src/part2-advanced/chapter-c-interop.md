# 【draft】与 C 语言的互操作性

> 📖 **章节概述**：本章将全面介绍 Zig 与 C 语言的互操作机制，帮助您掌握如何在 Zig 项目中调用 C 代码、导出 C ABI 兼容的函数，以及处理 Zig 与 C 之间的数据传递。

## 基础概念

# 什么是 C 互操作？

C 互操作（C Interoperability）是指 Zig 语言与 C 语言之间的无缝协作能力。Zig 在设计之初就将"与 C 的完美互操作"作为核心目标之一，这使得 Zig 能够：

1. **调用现有的 C 库**：直接使用数十年积累的 C 生态系统
2. **被 C 代码调用**：导出 C ABI 兼容的函数，供其他语言调用
3. **编译 C 代码**：使用 `zig cc` 编译 C 代码，享受交叉编译能力
4. **渐进式迁移**：逐步将 C 项目迁移到 Zig

# 为什么需要 C 互操作？

**1. 生态系统优势**
- C 语言拥有 40 多年的历史，积累了海量的库和工具
- 从操作系统 API 到数据库驱动，从图形库到科学计算，C 库无处不在
- Zig 可以直接使用这些成熟的库，无需重写

**2. 渐进式迁移**
- 现有的大型 C 项目可以逐步引入 Zig
- 可以先用 Zig 编写新模块，再逐步替换旧代码
- 降低迁移风险，保护现有投资

**3. 性能和兼容性**
- C ABI 是事实上的标准接口
- 几乎所有编程语言都支持调用 C 函数
- Zig 导出的 C ABI 函数可以被任何语言调用

# Zig 的 C 互操作优势

与其他语言相比，Zig 的 C 互操作具有独特优势：

| 特性                  | Zig             | Rust            | Python     | Go         |
| --------------------- | --------------- | --------------- | ---------- | ---------- |
| **直接导入 C 头文件** | ✅               | ❌ 需要工具生成  | ❌ 需要 FFI | ❌ 需要 cgo |
| **编译 C 代码**       | ✅ 内置          | ❌ 需要外部工具  | ❌          | ❌          |
| **交叉编译 C**        | ✅ 内置 40+ 平台 | ⚠️ 困难          | ❌          | ⚠️ 有限     |
| **零开销调用**        | ✅               | ✅               | ❌ 有开销   | ❌ 有开销   |
| **构建系统集成**      | ✅ 原生支持      | ⚠️ 需要 build.rs | ❌          | ⚠️ 需要 cgo |

# C 互操作的核心步骤

要在 Zig 中使用 C 代码，需要完成两个核心步骤：

**步骤 1：导入 C 头文件**

有两种方法：
- 使用 `@cImport()` 直接导入（推荐用于简单场景）
- 使用 `zig translate-c` 转换为 Zig 代码（推荐用于复杂项目）

**步骤 2：链接 C 库**

在 `build.zig` 中配置链接：
```zig
// 📌 Zig 0.15.x+
// ✨ 新特性：root_module API
exe.root_module.linkSystemLibrary("c", .{});
exe.root_module.link_libc = true;
```

# C ABI 与 Zig 类型系统

Zig 和 C 使用不同的类型系统，但 Zig 提供了完整的 C 类型支持：

**基本类型映射**：
| C 类型        | Zig 类型        | 说明       |
| ------------- | --------------- | ---------- |
| `char`        | `c_char`        | C 字符类型 |
| `short`       | `c_short`       | C 短整型   |
| `int`         | `c_int`         | C 整型     |
| `long`        | `c_long`        | C 长整型   |
| `void*`       | `?*anyopaque`   | C 通用指针 |
| `const char*` | `[*:0]const u8` | C 字符串   |

**关键概念**：
- `c_int`、`c_long` 等类型的大小随平台变化
- `[*:0]const u8` 表示以 null 结尾的字符串
- `?*anyopaque` 表示可能为 null 的通用指针

## 导入 C 头文件

使用`@cImport`导入 C 头文件：

```zig
const std = @import("std");

const c = @cImport({
    @cDefine("_NO_CRT_STDIO_INLINE", "1");
    @cInclude("stdio.h");
    @cInclude("stdlib.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    // 调用 C 函数
    _ = c.printf("Hello from C!\n");
    
    // 使用 C 标准库
    const ptr = c.malloc(100);
    defer c.free(ptr);
    
    std.debug.print("分配了 100 字节内存\n", .{});
}

// 注意：C互操作示例使用 void 返回类型，不需要 init 参数
// 在实际项目中，如果需要 I/O 操作，请使用 std.process.Init
```

## 声明外部 C 函数

使用`extern`声明 C 函数：

```zig
const std = @import("std");

// 声明外部 C 函数
pub extern "c" fn printf(format: [*:0]const u8, ...) c_int;
pub extern "c" fn malloc(size: usize) ?*anyopaque;
pub extern "c" fn free(ptr: ?*anyopaque) void;

pub fn main(init: std.process.Init.Minimal) void {
    // 调用外部函数
    _ = printf("Hello from Zig calling C!\n");
    
    const memory = malloc(100);
    if (memory) |mem| {
        defer free(mem);
        std.debug.print("分配内存成功\n", .{});
    }
}
```

## 数据传递详解

> 📖 **本节内容来源**：整合自 Pedro Park 的 Zig Book

### Zig 值传递到 C 函数

在 Zig 中调用 C 函数时，数据传递是一个关键问题。Zig 对象与 C 对象之间存在一些本质差异，最明显的是字符串表示方式：

- **Zig 字符串**：包含字节数组和长度值
- **C 字符串**：以 null 结尾的字节数组指针

根据不同场景，Zig 编译器会采用不同的处理方式：

**场景一：自动转换**

在以下情况下，Zig 编译器会自动转换类型：

1. **字符串字面量**
2. **基本数据类型**（整数、浮点数等）

**示例：字符串字面量的自动转换**

```zig
const std = @import("std");
const c = @cImport({
    @cDefine("_NO_CRT_STDIO_INLINE", "1");
    @cInclude("stdio.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    // 字符串字面量自动转换为 C 字符串
    const file = c.fopen("foo.txt", "rb");
    if (file == null) {
        @panic("Could not open file!");
    }
    if (c.fclose(file) != 0) {
        @panic("Could not close file!");
    }
    
    std.debug.print("文件操作成功\n", .{});
}
```

**示例：基本类型的自动转换**

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");
const cmath = @cImport({
    @cInclude("math.h");
});

pub fn main(init: std.process.Init) !void {
    var buf: [1024]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buf);
    const stdout = &writer.interface;
    
    // 浮点数字面量自动转换为 C float
    const result = cmath.powf(15.68, 2.32);
    try stdout.print("powf(15.68, 2.32) = {d}\n", .{result});
    try stdout.flush();
}
```

**场景二：需要手动转换**

当传递 Zig 对象（而非字面量）到 C 函数时，可能需要手动转换。

**示例：Zig 字符串对象的转换**

```zig
const std = @import("std");
const c = @cImport({
    @cDefine("_NO_CRT_STDIO_INLINE", "1");
    @cInclude("stdio.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    // ❌ 错误：直接传递 Zig 字符串对象
    const path: []const u8 = "foo.txt";
    // const file = c.fopen(path, "rb");  // 编译错误！
    
    // ✅ 方法1：使用 .ptr 属性
    const file1 = c.fopen(path.ptr, "rb");
    _ = c.fclose(file1);
    
    // ✅ 方法2：使用 @ptrCast 显式转换
    const c_path: [*c]const u8 = @ptrCast(path);
    const file2 = c.fopen(c_path, "rb");
    _ = c.fclose(file2);
    
    std.debug.print("文件操作成功\n", .{});
}
```

**编译错误示例**：

```
error: expected type '[*c]const u8', found '[]const u8'
    const file = c.fopen(path, "rb");
                         ^~~~
```

**类型说明**：
- `[*c]const u8`：C 指针，指向常量字节数组
- `[]const u8`：Zig 切片，包含指针和长度

**转换方法对比**：

| 方法       | 优点       | 缺点                         | 推荐度 |
| ---------- | ---------- | ---------------------------- | ------ |
| `.ptr`     | 简单、安全 | 仅适用于以 null 结尾的字符串 | ⭐⭐⭐⭐⭐  |
| `@ptrCast` | 灵活       | 需要手动确保安全性           | ⭐⭐⭐    |
| 字面量     | 最简单     | 仅适用于字面量               | ⭐⭐⭐⭐⭐  |

### 在 Zig 中创建 C 对象

在 Zig 中创建 C 结构体实例有两种方式：

**方式一：手动初始化**

```zig
// ✨ 新特性：DebugAllocator
const std = @import("std");
const c = @cImport({
    @cInclude("stdint.h");
});

// 定义 C 结构体（假设在 user.h 中）
const User = extern struct {
    id: u64,
    name: [*c]u8,
};

pub fn main() !void {
    var debug_allocator = std.heap.DebugAllocator(.{}){};
    defer _ = debug_allocator.deinit();
    const allocator = debug_allocator.allocator();
    
    // 创建未初始化的 C 对象
    var new_user: User = undefined;
    
    // 手动初始化字段
    new_user.id = 1;
    
    // 分配并设置 name 字段（C 字符串）
    var user_name = try allocator.alloc(u8, 12);
    defer allocator.free(user_name);
    @memcpy(user_name[0..(user_name.len - 1)], "pedropark99");
    user_name[user_name.len - 1] = 0;  // null 终止符
    new_user.name = user_name.ptr;
    
    std.debug.print("User ID: {}, Name: {s}\n", .{ new_user.id, user_name[0..11] });
}
```

**方式二：使用 C 库的构造函数**

大多数 C 库提供构造函数来创建对象：

```zig
const std = @import("std");
const c = @cImport({
    @cInclude("hb.h");  // Harfbuzz 库
});

pub fn main(init: std.process.Init.Minimal) void {
    // 使用 C 库的构造函数创建对象
    var buf: c.hb_buffer_t = c.hb_buffer_create();
    
    // 使用对象...
    
    // 清理资源
    c.hb_buffer_destroy(buf);
    
    std.debug.print("Harfbuzz buffer 创建成功\n", .{});
}
```

**最佳实践**：
- ✅ 优先使用 C 库提供的构造函数
- ✅ 确保 C 字符串以 null 结尾
- ✅ 使用 `defer` 确保资源释放
- ⚠️ 注意内存管理责任（谁分配，谁释放）

### 传递 C 结构体给 Zig 函数

当需要在 Zig 函数之间传递 C 结构体时，需要使用 `extern` 关键字：

**示例：传递 C 结构体**

```zig
const std = @import("std");

// 定义 C 兼容的结构体
const Point = extern struct {
    x: f32,
    y: f32,
};

// Zig 函数接收 C 结构体
fn printPoint(p: *const Point) void {
    std.debug.print("Point({d}, {d})\n", .{ p.x, p.y });
}

// Zig 函数返回 C 结构体
fn createPoint(x: f32, y: f32) Point {
    return .{ .x = x, .y = y };
}

pub fn main(init: std.process.Init.Minimal) void {
    // 创建 C 结构体实例
    var p1: Point = .{ .x = 10.5, .y = 20.3 };
    
    // 传递给 Zig 函数
    printPoint(&p1);
    
    // 从 Zig 函数返回
    const p2 = createPoint(5.0, 7.5);
    printPoint(&p2);
}
```

**关键点**：
- 使用 `extern struct` 确保 C ABI 兼容
- 可以安全地在 Zig 函数间传递
- 可以直接传递给 C 函数

### 数据传递最佳实践

**1. 优先使用字面量**

```zig
// ✅ 推荐：使用字面量
// 💡 最佳实践
const file = c.fopen("config.txt", "r");

// ⚠️ 需要转换：使用变量
const path = "config.txt";
const file = c.fopen(path.ptr, "r");
```

**2. 注意字符串的 null 终止符**

```zig
// ✨ 新特性：DebugAllocator
const std = @import("std");

pub fn main() !void {
    var debug_allocator = std.heap.DebugAllocator(.{}){};
    defer _ = debug_allocator.deinit();
    const allocator = debug_allocator.allocator();
    
    // ✅ 正确：确保 null 终止符
    var buffer = try allocator.alloc(u8, 11);
    defer allocator.free(buffer);
    @memcpy(buffer[0..10], "hello");
    buffer[10] = 0;  // null 终止符
    
    // ❌ 错误：缺少 null 终止符
    // var buffer = try allocator.alloc(u8, 10);
    // @memcpy(buffer, "hello");  // 没有 null 终止符！
}
```

**3. 使用 defer 确保资源释放**

```zig
const std = @import("std");
const c = @cImport({
    @cInclude("stdlib.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    const ptr = c.malloc(100);
    if (ptr) |p| {
        defer c.free(p);  // 确保释放
        // 使用内存...
    }
}
```

**4. 检查返回值**

```zig
const std = @import("std");
const c = @cImport({
    @cInclude("stdio.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    const file = c.fopen("data.txt", "r");
    if (file) |f| {
        defer _ = c.fclose(f);
        // 处理文件...
    } else {
        std.debug.print("无法打开文件\n", .{});
    }
}
```

## 导出 C ABI 函数

使用`export`导出函数供 C 调用：

```zig
const std = @import("std");

// 导出函数供 C 调用
export fn add(a: i32, b: i32) i32 {
    return a + b;
}

export fn greet(name: [*:0]const u8) void {
    std.debug.print("Hello, {s}!\n", .{name});
}

// 导出结构体
export const Point = extern struct {
    x: f32,
    y: f32,
};

export fn createPoint(x: f32, y: f32) Point {
    return .{ .x = x, .y = y };
}
```

**对应的 C 头文件：**
```c
// mathtest.h
#ifndef MATHTEST_H
#define MATHTEST_H

int32_t add(int32_t a, int32_t b);
void greet(const char* name);

typedef struct {
    float x;
    float y;
} Point;

Point createPoint(float x, float y);

#endif
```

## C 和 Zig 类型映射

Zig 提供了完整的 C 类型支持，确保与 C 代码的无缝互操作。理解类型映射是正确使用 C 代码的关键。

### 基本类型映射

| C 类型               | Zig 类型      | 大小（字节） | 说明                             |
| -------------------- | ------------- | ------------ | -------------------------------- |
| `char`               | `c_char`      | 1            | C 字符类型（可能有符号或无符号） |
| `signed char`        | `i8`          | 1            | 有符号字符                       |
| `unsigned char`      | `u8`          | 1            | 无符号字符                       |
| `short`              | `c_short`     | 2            | C 短整型                         |
| `unsigned short`     | `c_ushort`    | 2            | C 无符号短整型                   |
| `int`                | `c_int`       | 4            | C 整型                           |
| `unsigned int`       | `c_uint`      | 4            | C 无符号整型                     |
| `long`               | `c_long`      | 4/8          | C 长整型（平台相关）             |
| `unsigned long`      | `c_ulong`     | 4/8          | C 无符号长整型                   |
| `long long`          | `c_longlong`  | 8            | C 长长整型                       |
| `unsigned long long` | `c_ulonglong` | 8            | C 无符号长长整型                 |
| `float`              | `f32`         | 4            | 单精度浮点数                     |
| `double`             | `f64`         | 8            | 双精度浮点数                     |
| `size_t`             | `usize`       | 4/8          | 大小类型（平台相关）             |
| `ptrdiff_t`          | `isize`       | 4/8          | 指针差值类型                     |

**示例：基本类型使用**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // C ABI 类型
    const c_int_val: c_int = 42;
    const c_long_val: c_long = 100;
    const c_char_val: c_char = 'A';
    
    // 平台相关类型
    const size: usize = 1024;
    const diff: isize = -10;
    
    std.debug.print("c_int: {}, c_long: {}, size: {}\n", .{ c_int_val, c_long_val, size });
}
```

### 指针类型映射

| C 类型        | Zig 类型            | 说明                    |
| ------------- | ------------------- | ----------------------- |
| `void*`       | `?*anyopaque`       | 通用指针（可能为 null） |
| `const void*` | `?*const anyopaque` | 常量通用指针            |
| `int*`        | `*c_int`            | C 整型指针              |
| `const int*`  | `*const c_int`      | 常量 C 整型指针         |
| `int**`       | `*?*c_int`          | 指向指针的指针          |
| `char*`       | `[*c]u8`            | C 字符串（可变）        |
| `const char*` | `[*c]const u8`      | C 字符串（常量）        |

**关键概念**：

1. **`?*anyopaque` vs `*anyopaque`**：
   - `?*anyopaque`：可能为 null 的指针（对应 C 的 `void*`）
   - `*anyopaque`：不能为 null 的指针

2. **`[*c]` vs `[*]` vs `[]`**：
   - `[*c]`：C 指针（可能为 null，无长度信息）
   - `[*]`：Zig 多项指针（不为 null，无长度信息）
   - `[]`：Zig 切片（不为 null，有长度信息）

**示例：指针类型使用**

```zig
const std = @import("std");
const c = @cImport({
    @cInclude("stdlib.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    // void* 对应 ?*anyopaque
    var ptr: ?*anyopaque = null;
    
    // 分配内存
    ptr = c.malloc(100);
    
    if (ptr) |p| {
        defer c.free(p);
        std.debug.print("分配内存成功\n", .{});
    }
}
```

### 字符串类型映射

C 字符串和 Zig 字符串有本质区别：

| 特性         | C 字符串                          | Zig 字符串   |
| ------------ | --------------------------------- | ------------ |
| **类型**     | `[*:0]const u8` 或 `[*c]const u8` | `[]const u8` |
| **终止方式** | null 终止符                       | 长度字段     |
| **长度信息** | 需要调用 `strlen()`               | 内置长度     |
| **安全性**   | 可能缓冲区溢出                    | 边界检查     |
| **可空性**   | 可能为 null                       | 不为 null    |

**示例：字符串类型转换**

```zig
// ✨ 新特性：DebugAllocator
const std = @import("std");

pub fn main() !void {
    var debug_allocator = std.heap.DebugAllocator(.{}){};
    defer _ = debug_allocator.deinit();
    const allocator = debug_allocator.allocator();
    
    // Zig 字符串
    const zig_str: []const u8 = "Hello, Zig!";
    
    // 转换为 C 字符串（需要 null 终止符）
    const c_str: [*:0]const u8 = "Hello, C!";
    
    // 从 Zig 字符串创建 C 字符串
    var buffer = try allocator.alloc(u8, zig_str.len + 1);
    defer allocator.free(buffer);
    @memcpy(buffer[0..zig_str.len], zig_str);
    buffer[zig_str.len] = 0;  // 添加 null 终止符
    
    const c_str_from_zig: [*:0]const u8 = @ptrCast(buffer.ptr);
    
    std.debug.print("Zig 字符串: {s}\n", .{zig_str});
    std.debug.print("C 字符串: {s}\n", .{c_str});
    std.debug.print("转换后: {s}\n", .{c_str_from_zig});
}
```

### 结构体类型映射

C 结构体在 Zig 中使用 `extern struct` 表示：

**C 代码**：
```c
struct Point {
    float x;
    float y;
};
```

**Zig 代码**：
```zig
const Point = extern struct {
    x: f32,
    y: f32,
};
```

**关键点**：
- 使用 `extern struct` 确保 C ABI 兼容
- 字段顺序和大小必须匹配
- 内存布局与 C 一致

**示例：结构体映射**

```zig
const std = @import("std");

// C 兼容的结构体
const User = extern struct {
    id: u64,
    age: u32,
    name: [32]u8,  // 固定大小数组
};

pub fn main(init: std.process.Init.Minimal) void {
    var user: User = .{
        .id = 1,
        .age = 25,
        .name = undefined,
    };
    
    // 初始化 name 字段
    @memcpy(user.name[0..5], "Alice");
    user.name[5] = 0;
    
    std.debug.print("User ID: {}, Age: {}\n", .{ user.id, user.age });
}
```

### 类型映射最佳实践

**1. 使用 Zig 的 C 类型别名**

```zig
// ✅ 推荐：使用 c_int、c_long 等
// ❌ 错误示例
const value: c_int = 42;

// ❌ 不推荐：假设 int 是 32 位
// const value: i32 = 42;  // 在某些平台可能不匹配
```

**2. 优先使用 Zig 类型**

```zig
// ✅ 推荐：在纯 Zig 代码中使用 Zig 类型
// 💡 最佳实践
const count: usize = 100;

// ⚠️ 仅在与 C 交互时使用 C 类型
const c_count: c_int = @intCast(count);
```

**3. 注意平台差异**

```zig
// 💡 最佳实践
const c_long_val: c_long = 100;

// ✅ 使用固定大小的类型
const fixed_val: i64 = 100;
```

**4. 正确处理指针可空性**

```zig
const std = @import("std");
const c = @cImport({
    @cInclude("stdlib.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    // ✅ 正确：检查指针是否为 null
    const ptr = c.malloc(100);
    if (ptr) |p| {
        defer c.free(p);
        // 使用内存...
    } else {
        std.debug.print("内存分配失败\n", .{});
    }
}
```

## 使用 C 库

**build.zig 配置：**
```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    const exe = b.addExecutable(.{
        .name = "zig_app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 链接 C 库
    exe.root_module.linkSystemLibrary("c", .{});
    exe.root_module.link_libc = true;
    
    // 添加 C 源文件
    exe.root_module.addCSourceFile(.{
        .file = b.path("src/helper.c"),
        .flags = &[_][]const u8{"-Wall"},
    });
    
    b.installArtifact(exe);
}
```

## translate-c 工具

使用`zig translate-c`将 C 代码转换为 Zig：

```bash
# 转换 C 头文件
zig translate-c header.h > header.zig

# 转换 C 源文件
zig translate-c source.c > source.zig
```

## 交叉编译实战

Zig 内置了强大的交叉编译能力，无需安装外部工具链：

**基本交叉编译：**

```bash
# 查看可用目标
zig targets

# 编译为 Windows (x86_64)
zig build-exe src/main.zig -target x86_64-windows-gnu

# 编译为 Linux (ARM64)
zig build-exe src/main.zig -target aarch64-linux-gnu

# 编译为 macOS (ARM64)
zig build-exe src/main.zig -target aarch64-macos-gnu
```

**使用 build.zig 进行交叉编译：**

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .aarch64,
        .os_tag = .linux,
        .abi = .gnu,
    });

    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "myapp",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    b.installArtifact(exe);
}
```

**编译为多个目标：**

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const targets = .{
        "x86_64-linux-gnu",
        "x86_64-windows-gnu",
        "aarch64-linux-gnu",
        "aarch64-macos-gnu",
        "riscv64-linux-gnu",
    };

    const optimize = b.standardOptimizeOption(.{});

    inline for (targets) |target_str| {
        const target = b.resolveTargetQuery(try std.zig.CrossTarget.parse(.{
            .query = target_str,
        }));

        const exe = b.addExecutable(.{
            .name = "myapp",
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main.zig"),
                .target = target,
                .optimize = optimize,
            }),
        });

        const install_step = b.getInstallStep();
        const artifact = b.addInstallArtifact(exe, .{
            .dest_dir = .{
                .override = b.cache_dir,
            },
        });
        install_step.dependOn(&artifact.step);
    }
}

---

### 章节练习题

#### 基础题

**题目1**：编写一个 Zig 程序，调用 C 标准库的 `printf` 函数。

**要求**：
- 使用 `@cImport` 导入 C 头文件
- 调用 `printf` 输出字符串
- 编译时链接 C 库

**参考答案**：
```zig
const std = @import("std");
const c = @cImport({
    @cInclude("stdio.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    _ = c.printf("Hello from C!\n");
}
```

**编译命令**：
```bash
zig build-exe main.zig -lc
```

**题目2**：编写一个 Zig 程序，调用 C 标准库的 `strlen` 函数。

**要求**：
- 导入 `string.h`
- 计算字符串长度
- 输出结果

**参考答案**：
```zig
const std = @import("std");
const c = @cImport({
    @cInclude("string.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    const str = "Hello, Zig!";
    const len = c.strlen(str.ptr);
    std.debug.print("字符串长度：{}\n", .{len});
}
```

**题目3**：编写一个 Zig 函数，导出给 C 调用。

**要求**：
- 使用 `export` 关键字
- 创建一个简单的加法函数
- 确保函数签名兼容 C

**参考答案**：
```zig
export fn add(a: i32, b: i32) i32 {
    return a + b;
}
```

**编译为库**：
```bash
zig build-lib add.zig -dynamic
```

#### 进阶题

**题目1**：编写一个 Zig 程序，使用 C 标准库的 `malloc` 和 `free`。

**要求**：
- 导入 `stdlib.h`
- 使用 `malloc` 分配内存
- 使用 `free` 释放内存
- 处理可能的空指针

**参考答案**：
```zig
const std = @import("std");
const c = @cImport({
    @cInclude("stdlib.h");
});

pub fn main(init: std.process.Init.Minimal) void {
    const size: usize = 100;
    const ptr = c.malloc(size);
    
    if (ptr) |p| {
        defer c.free(p);
        std.debug.print("成功分配 {} 字节内存\n", .{size});
    } else {
        std.debug.print("内存分配失败\n", .{});
    }
}
```

**题目2**：编写一个 Zig 程序，与 C 结构体交互。

**要求**：
- 定义一个与 C 兼容的结构体
- 使用 `extern` 声明 C 函数
- 传递结构体给 C 函数

**参考答案**：
```zig
const std = @import("std");

const Point = extern struct {
    x: f32,
    y: f32,
};

extern fn print_point(p: Point) void;

pub fn main(init: std.process.Init.Minimal) void {
    const p = Point{ .x = 10.5, .y = 20.3 };
    print_point(p);
}
```

#### 挑战题

**题目**：编写一个 Zig 程序，封装 C 库函数为 Zig 友好的 API。

**要求**：
- 封装 C 文件操作函数
- 提供 Zig 风格的错误处理
- 使用 `defer` 确保资源释放

**参考答案**：
```zig
const std = @import("std");
const c = @cImport({
    @cInclude("stdio.h");
    @cInclude("stdlib.h");
});

const FileError = error{
    OpenFailed,
    ReadFailed,
};

const File = struct {
    handle: ?*c.FILE,
    
    fn open(path: [*:0]const u8) FileError!File {
        const handle = c.fopen(path, "r");
        if (handle) |h| {
            return File{ .handle = h };
        }
        return error.OpenFailed;
    }
    
    fn close(self: *File) void {
        if (self.handle) |h| {
            _ = c.fclose(h);
            self.handle = null;
        }
    }
    
    fn read(self: *File, buffer: []u8) FileError!usize {
        if (self.handle) |h| {
            const count = c.fread(buffer.ptr, 1, buffer.len, h);
            return count;
        }
        return error.ReadFailed;
    }
};

pub fn main(init: std.process.Init.Minimal) !void {
    var file = try File.open("test.txt");
    defer file.close();
    
    var buffer: [1024]u8 = undefined;
    const bytes_read = try file.read(&buffer);
    
    std.debug.print("读取了 {} 字节\n", .{bytes_read});
}
```

---
