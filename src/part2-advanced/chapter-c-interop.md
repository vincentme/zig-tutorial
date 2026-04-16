# 与 C 语言的互操作性

这一章不把重点放在"罗列尽可能多的 C 互操作语法"，而是把重点放在几个真正决定成败的边界上：

> **ABI 边界、字符串表示、所有权责任、以及构建与链接。**

Zig 从设计一开始就非常重视与 C 的互操作。这让开发者可以：

- 直接调用现有的 C 库
- 导出 C ABI 兼容的函数给其他语言使用
- 逐步把现有 C 项目迁移到 Zig
- 在需要时仍然复用大量成熟的 C 生态

但"能互操作"不等于"可以无脑混用"。
真实项目里最容易踩坑的，通常不是 `@cImport` 这类入口本身，而是下面这些问题：

- 这段数据在 ABI 上是否真的兼容？
- 这是不是一个合法的 C 字符串？
- 这块内存到底该由谁释放？
- 我是在导入 Zig 模块，还是在链接系统库？

所以，本章最重要的目标不是让读者记住所有 API 名字，而是建立一套更稳定的判断方法。

---

## 先明确：C 互操作真正发生在什么边界上？

从工程角度看，Zig 与 C 的互操作主要发生在四类边界上：

1. **函数调用边界**
   - Zig 调 C
   - C 调 Zig

2. **数据表示边界**
   - 基本整数、浮点数
   - 结构体、枚举
   - 指针、缓冲区、字符串

3. **资源管理边界**
   - 谁分配
   - 谁释放
   - 能否跨语言混用分配器

4. **构建与链接边界**
   - 头文件如何导入
   - 库如何链接

可以把本章理解成：**不是教"怎么写几行 FFI 代码"，而是教"如何不在边界上犯错"。**

---

## 为什么 Zig 的 C 互操作值得重视？

Zig 对 C 互操作的重视，不只是"方便调用旧库"，而是因为它本身就是 Zig 工程实践的一部分。

### 1. 直接接入成熟生态
现实世界里，很多底层能力仍然来自 C：

- 操作系统接口
- 图形和窗口库
- 数据库驱动
- 网络与压缩库
- 音视频编解码
- 科学计算和加密库

如果 Zig 不能很好地和这些生态协作，它就很难成为实用语言。

### 2. 适合渐进式迁移
很多现有项目不是"推倒重写"的，而是：

- 保留现有 C 模块
- 用 Zig 写新模块
- 逐步替换旧组件

这种迁移方式的前提，就是互操作边界足够清楚。

### 3. C ABI 仍然是事实标准
即使最终不是和纯 C 程序交互，很多语言和运行时在底层也把 C ABI 当作通用边界。
因此，理解 C ABI，本质上也是在理解一种更普遍的系统接口边界。

---

## 这章最重要的主线：先理解 ABI，而不是先记语法

很多初学者一开始会把 C 互操作理解成：

- `@cImport` 怎么写
- `extern` 怎么写
- `export` 怎么写

这些当然重要，但更底层的问题其实是：

> **双方看到的函数签名、参数布局、返回值表示、结构体布局，是否真的一致？**

这就是 ABI（Application Binary Interface）层面的兼容性问题。

可以简单把 ABI 理解为：

- 函数参数如何传递
- 返回值如何传递
- 结构体内存布局如何组织
- 调用约定是什么
- 哪些类型在边界上是安全的

如果 ABI 不一致，那么代码即使"看起来能编译"，也可能在运行时出问题。

---

## Zig 与 C 在数据模型上的一个关键差异

### Zig 的很多类型更强调"语义清楚"
例如：

- 切片 `[]T` 包含指针和长度
- 可选类型 `?T` 有显式的空值语义
- 错误联合 `!T` 表达可能失败
- 更丰富的类型系统帮助在 Zig 内部写出更安全的代码

### C 更强调 ABI 简单和历史兼容
例如：

- 字符串通常只是 `char*`，靠 `'\0'` 结束
- 数组衰减为指针
- 很多 API 通过整数返回码表达错误
- 结构体布局更直接但也更脆弱

因此，**不要把"Zig 内部最舒服的类型"直接假设成"边界上也自然兼容的类型"。**

跨边界时，经常需要主动问：

- 这里要传的是切片，还是裸指针？
- 这里要传的是长度，还是 NUL 结尾？
- 这里是否要求 C ABI 兼容结构体？
- 这里的错误该转换成什么表示？

---

## 导入 C：两种常见入口

### 1. `@cImport`
这是最常见、最直接的入口。

```zig
const c = @cImport({
    @cInclude("stdio.h");
});
```

它适合：

- 小型示例
- 直接接标准库或简单头文件
- 教学和快速验证

### 2. 把 C 头视为项目边界的一部分
在更真实的项目里，导入 C 头文件应被理解成：

- 项目依赖的一部分
- 构建与链接的一部分
- 版本与平台条件的一部分

真正复杂的地方往往不在 `@cImport` 这几行，而在：

- 头文件搜索路径
- 平台条件宏
- 系统库是否已安装
- 构建脚本如何链接

所以阅读和写作 C 互操作代码时，不要只盯着 Zig 源文件本身。

---

## `zig translate-c`：理解 C 到 Zig 的映射

在实际互操作中，经常需要知道某个 C 类型或函数签名在 Zig 里会变成什么样。`zig translate-c` 正是用来做这件事的工具——它把 C 头文件翻译成等价的 Zig 代码。

基本用法：

```sh
zig translate-c /usr/include/errno.h
```

例如，对于这样一段 C 头文件：

```c
// point.h
typedef struct {
    float x;
    float y;
} Point;

Point make_point(float x, float y);
```

`zig translate-c point.h` 会产生类似这样的输出：

```zig
pub const Point = extern struct {
    x: f32,
    y: f32,
};
pub extern fn make_point(x: f32, y: f32) Point;
```

这个工具在以下场景特别有用：

- 不确定某个 C 类型对应 Zig 的什么类型时，直接翻译看结果
- 遇到复杂的 C 宏或 `typedef`，用它来辅助理解
- 验证手写的 `extern` 声明是否和 C 头一致

> **注意**：`zig translate-c` 的输出是机器生成的，可读性有时不高。它更适合作为参考，而不是直接复制到项目里。

---

## 调用 C 函数：先看最小模式

一个最小例子通常会长这样：

```zig
const std = @import("std");

const c = @cImport({
    @cInclude("stdio.h");
});

pub fn main() void {
    _ = c.printf("hello from C\n");
}
```

这段代码的教学价值在于，它已经展示了最基本的边界：

- `printf` 来自导入的 C 头
- Zig 可以直接调用它
- 字符串字面量可以很自然地传给某些 C API

但这只是最容易的一种情况。
真正容易出错的，通常不是字面量，而是**自己构造的数据**。

---

## 字符串：C 互操作里最高频的坑

C 和 Zig 对字符串的表示方式有本质区别。下面这张表是所有后续讨论的基础：

| | C 字符串 (`char*`) | Zig `[]const u8` | Zig `[:0]const u8` |
|---|---|---|---|
| 结构 | 裸指针，以 `'\0'` 结尾 | 指针 + 长度 | 指针 + 长度 + 保证 NUL 结尾 |
| 获取长度 | 运行时扫描 `'\0'` | 直接读 `.len` | 直接读 `.len` |
| NUL 终止 | **必须** | **不保证** | **保证** |
| 直接传给 C | ✓ | ✗ | ✓（通过 `.ptr`） |

核心规则只有一条：

> **`[]const u8` 不是天然合法的 C 字符串。即使通过 `.ptr` 拿到指针，也不保证 NUL 终止。**

### 字面量为什么通常没问题？

Zig 字符串字面量的类型是 `*const [N:0]u8`——指向定长、NUL 终止数组的指针。它可以自动强转为 `[:0]const u8`，因此直接传给 C 函数是安全的：

```zig
// 字面量自动强转为 [:0]const u8，天然 NUL 终止
const file = c.fopen("config.txt", "rb");
```

### 运行时字符串怎么处理？

运行时得到的 `[]const u8` 不能直接传给 C。推荐使用 `allocator.dupeZ` 一步完成"复制 + NUL 终止"：

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

    // dupeZ：复制切片并追加 NUL 终止符，返回 [:0]u8
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

`dupeZ` 的优势：
1. **类型明确**——返回 `[:0]u8`，编译器层面保证 NUL 终止
2. **意图清晰**——名字直接表达"复制并加零"
3. **所有权清楚**——`allocator` 分配，`defer allocator.free` 释放

> **注意**：`dupeZ` 是 `dupeSentinel` 的快捷方式。如需非零的哨兵值，可用 `allocator.dupeSentinel(u8, slice, sentinel_value)`。

---

## 所有权：谁分配，谁释放？

这是 C 互操作里第二个核心主题。

如果只记一句话，那就是：

> **跨语言边界时，资源责任必须写得比平时更清楚。**

### 为什么这里更危险？
因为一旦责任不清楚，就会出现这些问题：

- Zig 分配，C 释放
- C 分配，Zig 释放
- 双重释放
- 忘记释放
- 生命周期比想象中更短

### 最稳妥的工程习惯
尽量保持下面这种规则：

- **谁分配，谁释放**
- **不要默认 Zig allocator 和 C allocator 可以混用**
- **在 API 边界上明确写出责任**

例如：

- 如果内存来自 `malloc`，通常就应由 `free` 释放
- 如果内存来自 Zig 分配器，通常就应由对应 Zig 分配器释放

不要因为"它们最终都向系统申请内存"就想当然地混用。

---

## 不要轻易混用 Zig 分配器和 C 分配器

这是一个非常常见的误区。

### 错误直觉
"我在 Zig 里分的，C 帮我 free 一下应该也行吧？"

或者：

"C 那边 malloc 的，我在 Zig 里 allocator.free 一下应该也差不多吧？"

### 更稳妥的结论
通常不要这样做。原因包括：

- 分配器实现可能不同
- 元数据布局可能不同
- 调试分配器会记录额外状态
- 释放路径必须和分配路径匹配

跨边界时应尽量坚持：Zig 分配 → Zig 释放，C 分配 → C 释放。除非某个库文档明确规定了不同的规则。

---

## 使用 C 构造函数通常比手工拼对象更稳妥

很多 C 库会提供自己的对象创建 / 销毁函数，例如：

- `xxx_create()`
- `xxx_init()`
- `xxx_destroy()`
- `xxx_free()`

如果库已经提供了这些入口，通常应优先使用它们，而不是自己手工拼内存布局。

### 原因
因为库作者往往还隐含了这些约束：

- 内部字段初始化顺序
- 额外状态位
- 平台相关设置
- 未来版本兼容策略

手工填结构体字段看起来"更底层"，但也更容易踩 ABI 和库内部约定的坑。

---

## `extern struct`：保证 C ABI 布局

如果某个结构体要跨 Zig/C 边界直接传递或共享布局，就应使用 `extern struct`。

它的核心意义是：明确告诉编译器，这个结构体要按 C ABI 兼容的布局来处理——字段顺序不会被重排，对齐规则与 C 一致。

下面是一个完整的例子，包含定义和验证：

```zig
const std = @import("std");

/// 匹配 C 端的 struct Pixel { uint8_t r, g, b, a; }
const Pixel = extern struct {
    r: u8,
    g: u8,
    b: u8,
    a: u8,

    fn isOpaque(self: Pixel) bool {
        return self.a == 0xFF;
    }
};

test "Pixel layout matches C expectations" {
    // extern struct 保证按声明顺序排列，无填充
    try std.testing.expectEqual(4, @sizeOf(Pixel));
    try std.testing.expectEqual(0, @offsetOf(Pixel, "r"));
    try std.testing.expectEqual(1, @offsetOf(Pixel, "g"));
    try std.testing.expectEqual(2, @offsetOf(Pixel, "b"));
    try std.testing.expectEqual(3, @offsetOf(Pixel, "a"));

    const px = Pixel{ .r = 255, .g = 128, .b = 0, .a = 255 };
    try std.testing.expect(px.isOpaque());
}
```

### 一个重要提醒
`extern struct` 不是"所有结构体都该默认使用"的标记。
它只适合那些确实要跨 ABI 边界的类型。

在纯 Zig 内部，普通 `struct` 更自然——编译器可以自由优化字段布局和对齐。

---

## 导出给 C：`export fn` 与对应的 C 头文件

当希望 C 代码调用 Zig 函数时，使用 `export fn` 导出 C ABI 兼容函数。

### Zig 侧：导出函数

```zig
// mathlib.zig
const std = @import("std");

/// 两个整数相加，导出为 C ABI 函数
export fn add(a: c_int, b: c_int) c_int {
    return a + b;
}

/// 计算整数数组的总和
export fn sum_array(ptr: [*]const c_int, len: usize) c_int {
    const items = ptr[0..len];
    var total: c_int = 0;
    for (items) |v| {
        total += v;
    }
    return total;
}
```

### C 侧：对应的头文件

```c
/* mathlib.h — 手写或由工具生成 */
#ifndef MATHLIB_H
#define MATHLIB_H

#include <stddef.h>

int add(int a, int b);
int sum_array(const int *ptr, size_t len);

#endif
```

### C 侧：调用示例

```c
#include <stdio.h>
#include "mathlib.h"

int main(void) {
    printf("add: %d\n", add(3, 4));

    int nums[] = {10, 20, 30};
    printf("sum: %d\n", sum_array(nums, 3));
    return 0;
}
```

关键注意事项：

- 参数和返回值类型必须是 C 能理解的——基本整数、浮点、指针、`extern struct`
- 不要在导出边界上使用 `[]T`、`?T`、`!T` 等 Zig 特有类型
- 显式传长度（如 `ptr` + `len`）是跨 ABI 传递数组的标准模式
- 更稳妥的导出 API 往往比 Zig 内部 API 更朴素——这不是退步，而是边界设计本来就应该更保守

---

## 回调函数：把 Zig 函数指针传给 C

很多 C 库通过函数指针接受回调，例如排序、事件处理、线程入口等。在 Zig 中，只要函数声明了 `callconv(.c)`，就可以作为 C 回调使用。

### 经典例子：qsort 比较函数

```zig
const std = @import("std");

const c = @cImport({
    @cInclude("stdlib.h");
});

/// qsort 要求的比较函数签名：int (*)(const void*, const void*)
fn compareInts(a: ?*const anyopaque, b: ?*const anyopaque) callconv(.c) c_int {
    const val_a: *const i32 = @ptrCast(@alignCast(a));
    const val_b: *const i32 = @ptrCast(@alignCast(b));
    if (val_a.* < val_b.*) return -1;
    if (val_a.* > val_b.*) return 1;
    return 0;
}

test "qsort callback" {
    var data = [_]i32{ 42, 7, -3, 100, 0 };
    c.qsort(
        @ptrCast(&data),       // 数组基地址
        data.len,              // 元素个数
        @sizeOf(i32),          // 每个元素大小
        &compareInts,          // 比较函数
    );
    try std.testing.expectEqualSlices(i32, &.{ -3, 0, 7, 42, 100 }, &data);
}
```

关键要素：

1. **`callconv(.c)`**——告诉编译器这个函数使用 C 调用约定，这样 C 库才能正确调用它
2. **参数类型是 `?*const anyopaque`**——对应 C 的 `const void*`，需要 `@ptrCast` + `@alignCast` 转换为具体类型
3. **返回 `c_int`**——匹配 C 的 `int` 返回类型

这个模式适用于所有 C 回调场景：信号处理器、线程函数（`pthread_create`）、自定义分配器钩子等。

---

## 不要把 Zig 特有语义直接暴露给 C

### 在 Zig 内部很好用的类型
例如：

- `[]const u8`
- `?*T`
- `!T`
- tagged union

这些在 Zig 内部都很有表达力。

### 但对 C 边界来说，不一定合适
更稳妥的导出 API 往往会退回更基础的表示方式，例如：

- `[*]const u8` + `len`
- 返回 `c_int` 错误码
- 输出参数写回结果
- 使用 `extern struct`

> **对外 ABI 设计通常比 Zig 内部 API 设计更朴素。这不是退步，而是边界设计本来就应该更保守。**

---

## 构建与链接

调用 C 不只是在 Zig 源文件里写几行导入，还包括构建和链接。

### 最小链接示例

在 `build.zig` 中，链接 C 库的核心意图通常只有几行：

```zig
// build.zig 片段
const exe = b.addExecutable(.{
    .name = "my_app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .link_libc = true,  // 启用 libc
    }),
});

// 链接系统已安装的库（如 zlib）
exe.root_module.linkSystemLibrary("z", .{});

// 如果需要额外的头文件搜索路径
exe.root_module.addIncludePath(b.path("vendor/include"));

b.installArtifact(exe);
```

### 阅读构建示例时的思路

无论具体 API 名字如何随版本演进，构建脚本里的意图通常只有这几类：

- **链接系统库**——`linkSystemLibrary`
- **启用 libc**——`link_libc = true`
- **添加头文件路径**——`addIncludePath`
- **添加 C 源文件**——`addCSourceFiles`
- **关联 Zig 目标和 C 依赖**

遇到不确定的构建写法时，先理解目标（到底在链接什么），再根据本地 Zig 版本核对具体 API。

---

## C 互操作里最常见的几个坑

### 1. 把普通切片当成 C 字符串
错误直觉是"反正都是字节数组，拿 `.ptr` 不就行了"。但 C 还要求 NUL 终止，Zig 切片只保证长度，不保证结尾语义。

### 2. 不清楚谁负责释放内存
一旦责任不清楚，就很容易出现泄漏或双重释放。

### 3. 手工拼 C 对象时忽略库约定
有些库对象不能只靠"字段看起来对"就算正确初始化。

### 4. 把 Zig 内部舒服的类型直接暴露给 C
边界上应尽量使用更朴素、更稳定的 ABI 表示。

### 5. 把构建失败误判为语法问题
很多 C 互操作错误其实来自：

- 头文件找不到
- 系统库没装
- 链接顺序或路径不对

### 6. 以为 `c_int`、`c_long` 永远等于固定宽度整数
这些类型是 ABI 类型，大小可能依平台变化。
跨边界时，平台相关性必须被认真对待。

---

## 当 C 互操作出问题时，先怎么排查？

建议按下面顺序看，而不是一上来就怀疑"语言坏了"。

### 1. 先看边界类型
- 这里传的是切片还是裸指针？
- 这里是否需要 NUL 终止？
- 这里是否要求 `extern struct`？

### 2. 再看所有权
- 这块内存是谁分配的？
- 应该由谁释放？
- 是否跨语言混用了不同分配器？

### 3. 再看头文件与链接
- 头文件是否真的可见？
- 系统库是否真的已安装？
- 构建脚本是否匹配当前 Zig 版本？

### 4. 最后再看 API 细节
- 当前 Zig 版本是否调整了构建风格？
- 参考的示例是不是旧版本资料？

这个顺序很重要，因为很多问题根本不在"函数声明"那一层。

---

## 一条更实用的经验法则

写完一段 C 互操作代码后，如果能明确回答下面四个问题，通常就已经比大多数"能跑但不稳"的代码强很多：

1. **这段边界上的数据表示是什么？**
2. **这里是不是合法的 C ABI / C 字符串？**
3. **这块内存到底由谁释放？**
4. **这段构建与链接写法是否已针对本地版本核对？**

如果答不出来，就说明这段边界还不够稳。

---

## 本章小结

这一章最重要的目标，不是让读者背下多少互操作语法，而是建立一套更可靠的边界意识：

- **C 互操作首先是 ABI 问题，不只是语法问题**
- **字符串是最高频坑点：`[]const u8` ≠ C 字符串，`[:0]const u8` 才是桥梁**
- **`zig translate-c` 可以帮助理解 C 类型在 Zig 中的对应**
- **回调函数需要 `callconv(.c)` 和正确的类型转换**
- **`extern struct` 保证 C ABI 布局，`export fn` 导出 C 可调用函数**
- **跨边界时必须把所有权写清楚：谁分配，谁释放**
- **不要轻易混用 Zig 分配器和 C 分配器**
- **构建与链接应优先理解意图，再核对本地写法**

带着这些判断去读标准库源码、第三方库示例，或者去做 C 项目的渐进迁移，就更容易分辨：

- 哪些写法是真正安全稳妥的
- 哪些写法只是"碰巧能跑"
- 哪些问题属于 ABI 边界，哪些只是构建细节

这正是 Zig 做 C 互操作时最重要的工程能力。