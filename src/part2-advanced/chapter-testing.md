# 【draft】测试与基准测试

> 📖 **章节概述**：本章将全面介绍 Zig 的测试框架，包括单元测试、内存安全测试、基准测试以及测试与构建系统的集成。

## 单元测试基础

> 📖 **本节内容来源**：整合自 Pedro Park 的 Zig Book 和官方文档

# 为什么需要单元测试？

单元测试是软件质量保证的重要手段。在 Zig 中，单元测试具有特殊的重要性：

1. **内存安全验证**：检测内存泄漏、双重释放等问题
2. **错误处理验证**：确保错误路径正确处理
3. **边界条件测试**：验证边界情况的行为
4. **重构保障**：确保重构后功能不变

> 📜 **Zig Zen 原则关联**
> 
> 单元测试体现了以下 Zig Zen 原则：
> - **"Edge cases matter."**（边界情况很重要）  
>   单元测试帮助我们验证边界条件和异常情况，防止潜在 bug。
> - **"Runtime crashes are better than bugs."**（运行时崩溃优于潜在的 bug）  
>   测试可以及早发现问题，避免 bug 进入生产环境。
> - **"Compile errors are better than runtime crashes."**（编译期错误优于运行时崩溃）  
>   Zig 的测试框架可以在编译期捕获部分错误。

# 测试块语法

Zig 使用 `test` 关键字定义测试块：

```zig
test "测试名称" {
    // 测试代码
}
```

**关键特性**：
- 测试块在正常编译时被忽略
- 只有使用 `zig test` 命令时才会编译和执行
- 测试块可以与源代码混合编写
- 测试块具有隐式的返回值类型 `anyerror!void`

# 测试与源代码共存

Zig 标准库采用测试与源代码共存的方式：

```zig
// src/math.zig

/// 计算两个数的和
pub fn add(a: i32, b: i32) i32 {
    return a + b;
}

test "add function" {
    try std.testing.expect(add(2, 3) == 5);
}
```

**优势**：
- 测试代码紧邻被测试代码，易于维护
- 文档化代码的预期行为
- 便于重构时验证功能

**最佳实践**：
- 将测试块放在被测试函数之后
- 使用描述性的测试名称
- 每个测试块专注于一个功能点

# 基本测试示例

Zig 内置了测试框架：

```zig
const std = @import("std");

// 被测试的函数
fn add(a: i32, b: i32) i32 {
    return a + b;
}

fn divide(a: i32, b: i32) !i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

// 基本测试
test "add function" {
    try std.testing.expect(add(2, 3) == 5);
    try std.testing.expect(add(-1, 1) == 0);
    try std.testing.expect(add(0, 0) == 0);
}

// 测试错误处理
test "divide function" {
    const result = try divide(10, 2);
    try std.testing.expect(result == 5);
    
    const err = divide(10, 0);
    try std.testing.expectError(error.DivisionByZero, err);
}

// 测试相等性
test "expect equal" {
    const expected: i32 = 42;
    const actual: i32 = 42;
    try std.testing.expectEqual(expected, actual);
}

// 测试近似相等（浮点数）
test "expect approach" {
    const expected: f32 = 3.14159;
    const actual: f32 = 3.14160;
    try std.testing.expectApproxEqAbs(expected, actual, 0.001);
}
```

## 测试组织与嵌套测试

> 📖 **本节内容来源**：整合自 Zig Language Bible

# 嵌套测试机制

Zig 支持在结构体、枚举、联合等类型内部定义测试块：

```zig
const std = @import("std");

const Math = struct {
    fn add(a: i32, b: i32) i32 {
        return a + b;
    }
    
    fn subtract(a: i32, b: i32) i32 {
        return a - b;
    }
    
    // 嵌套测试
    test "Math operations" {
        try std.testing.expect(add(5, 3) == 8);
        try std.testing.expect(subtract(5, 3) == 2);
    }
};
```

**重要特性**：
- `zig test` 默认只执行顶级测试块
- 嵌套测试需要显式引用才会执行

# 运行嵌套测试

**方法 1：使用 refAllDecls**

```zig
const std = @import("std");

test "all tests" {
    // 引用所有声明，触发嵌套测试执行
    std.testing.refAllDecls(Math);
    _ = Math; // 确保类型被引用
}
```

**refAllDecls 实现原理**：

```zig
pub fn refAllDecls(comptime T: type) void {
    if (!builtin.is_test) return;
    inline for (comptime std.meta.declarations(T)) |decl| {
        _ = &@field(T, decl.name);
    }
}
```

**注意事项**：
- `refAllDecls` 只引用公共成员（pub 修饰）
- 非公共成员需要手动引用

**方法 2：手动引用**

```zig
test "all tests" {
    _ = Math.add; // 手动引用特定成员
    _ = Math.subtract;
}
```

# 测试过滤

使用 `--test-filter` 运行特定测试：

```bash
# 只运行名称包含 "add" 的测试
zig test src/main.zig --test-filter "add"

# 只运行特定模块的测试
zig test src/main.zig --test-filter "Math"
```

**注意**：未命名的测试块（`test { }`）始终会运行，不受过滤影响。

# 跳过测试

**方法 1：返回 error.SkipZigTest**

```zig
test "skip this test" {
    return error.SkipZigTest; // 标记为跳过
    // 后续代码不会执行
}
```

**方法 2：使用 --test-filter 过滤**

```bash
# 通过过滤排除特定测试
zig test src/main.zig --test-filter "其他测试"
```

# 条件编译测试

使用 `builtin.is_test` 检测测试模式：

```zig
const builtin = @import("builtin");

const config = if (builtin.is_test) struct {
    const debug_mode = true;
} else struct {
    const debug_mode = false;
};
```

**应用场景**：
- 测试时使用不同的配置
- 测试时跳过耗时的初始化
- 测试时使用模拟数据

# 测试组织最佳实践

**1. 按功能模块组织测试**

```zig
const std = @import("std");

const StringUtils = struct {
    fn isEmpty(s: []const u8) bool {
        return s.len == 0;
    }
    
    fn trim(s: []const u8) []const u8 {
        // 实现
    }
    
    test "StringUtils tests" {
        try std.testing.expect(isEmpty(""));
        try std.testing.expect(!isEmpty("hello"));
    }
};

const MathUtils = struct {
    fn add(a: i32, b: i32) i32 {
        return a + b;
    }
    
    test "MathUtils tests" {
        try std.testing.expect(add(2, 3) == 5);
    }
};

// 顶级测试块
test "all tests" {
    std.testing.refAllDecls(StringUtils);
    std.testing.refAllDecls(MathUtils);
}
```

**2. 使用命名约定**

```zig
test "StringUtils.isEmpty returns true for empty string" {
    // 测试描述清晰
}

test "StringUtils.isEmpty returns false for non-empty string" {
    // 测试描述清晰
}
```

**3. 分离测试文件（可选）**

如果偏好将测试分离到独立文件：

```
src/
├── utils.zig        # 源代码
└── utils_test.zig   # 测试代码
```

```zig
// src/utils_test.zig
const std = @import("std");
const utils = @import("utils.zig");

test "utils tests" {
    // 测试代码
}
```

## 测试辅助函数

Zig 标准库提供了丰富的测试辅助函数，位于 `std.testing` 模块：

# 核心断言函数

```zig
const std = @import("std");

test "core assertions" {
    // expect：断言布尔值为真
    try std.testing.expect(true);
    try std.testing.expect(1 + 1 == 2);
    
    // expectEqual：断言两个值相等（支持类型推断）
    try std.testing.expectEqual(@as(i32, 42), 42);
    try std.testing.expectEqual("hello", "hello");
    
    // expectEqualSlices：断言切片相等
    const expected = [_]i32{ 1, 2, 3 };
    const actual = [_]i32{ 1, 2, 3 };
    try std.testing.expectEqualSlices(i32, &expected, &actual);
    
    // expectEqualStrings：断言字符串相等
    try std.testing.expectEqualStrings("hello", "hello");
    
    // expectError：断言错误类型
    const err = error.TestError;
    try std.testing.expectError(err, error.TestError);
}
```

# 浮点数比较

```zig
const std = @import("std");

test "float comparisons" {
    // expectApproxEqAbs：绝对误差比较
    const expected: f32 = 3.14159;
    const actual: f32 = 3.14160;
    try std.testing.expectApproxEqAbs(expected, actual, 0.001);
    
    // expectApproxEqRel：相对误差比较
    // 适用于比较不同数量级的浮点数
    const large: f64 = 1000000.0;
    const large_approx: f64 = 1000001.0;
    try std.testing.expectApproxEqRel(large, large_approx, 0.0001);
}
```

# 字符串断言

```zig
const std = @import("std");

test "string assertions" {
    // expectStringStartsWith：断言字符串前缀
    try std.testing.expectStringStartsWith("hello world", "hello");
    
    // expectStringEndsWith：断言字符串后缀
    try std.testing.expectStringEndsWith("hello world", "world");
    
    // expectFmt：断言格式化输出
    try std.testing.expectFmt("42", "{}", .{@as(i32, 42)});
}
```

# 分配器测试

```zig
const std = @import("std");

test "allocator testing" {
    // testing.allocator：测试专用分配器
    // 会检测内存泄漏和双重释放
    const allocator = std.testing.allocator;
    
    const slice = try allocator.alloc(u8, 100);
    defer allocator.free(slice); // 必须释放，否则测试失败
    
    // FailingAllocator：模拟分配失败
    var failing = std.testing.FailingAllocator.init(
        std.heap.page_allocator,
        .{ .fail_index = 0 }, // 第 0 次分配失败
    );
    const fail_alloc = failing.allocator();
    
    const result = fail_alloc.alloc(u8, 10);
    try std.testing.expectError(error.OutOfMemory, result);
}
```

# 测试组织函数

```zig
const std = @import("std");

const MyModule = struct {
    fn add(a: i32, b: i32) i32 {
        return a + b;
    }
    
    fn multiply(a: i32, b: i32) i32 {
        return a * b;
    }
    
    // 嵌套测试
    test "Math operations" {
        try std.testing.expect(add(5, 3) == 8);
        try std.testing.expect(multiply(5, 3) == 15);
    }
};

// refAllDecls：引用所有声明以运行嵌套测试
test "all tests" {
    std.testing.refAllDecls(MyModule);
}
```

# 测试辅助函数一览表

| 函数                     | 用途           | 示例                                        |
| ------------------------ | -------------- | ------------------------------------------- |
| `expect`                 | 断言布尔值为真 | `try expect(true)`                          |
| `expectEqual`            | 断言两个值相等 | `try expectEqual(42, 42)`                   |
| `expectEqualSlices`      | 断言切片相等   | `try expectEqualSlices(u8, "a", "a")`       |
| `expectEqualStrings`     | 断言字符串相等 | `try expectEqualStrings("a", "a")`          |
| `expectError`            | 断言错误类型   | `try expectError(err, result)`              |
| `expectApproxEqAbs`      | 绝对误差比较   | `try expectApproxEqAbs(1.0, 1.1, 0.2)`      |
| `expectApproxEqRel`      | 相对误差比较   | `try expectApproxEqRel(100.0, 101.0, 0.02)` |
| `expectStringStartsWith` | 断言前缀       | `try expectStringStartsWith("abc", "ab")`   |
| `expectStringEndsWith`   | 断言后缀       | `try expectStringEndsWith("abc", "bc")`     |
| `expectFmt`              | 断言格式化输出 | `try expectFmt("42", "{}", .{42})`          |
| `refAllDecls`            | 运行嵌套测试   | `refAllDecls(MyStruct)`                     |

## 内存安全测试

> 📖 **本节内容来源**：整合自 Pedro Park 的 Zig Book

# 为什么需要内存安全测试？

Zig 没有垃圾回收器，需要手动管理内存。内存安全测试可以检测：

1. **内存泄漏**：分配但未释放的内存
2. **双重释放**：同一内存被释放多次
3. **使用后释放**：释放后继续使用内存
4. **缓冲区溢出**：访问超出分配范围的内存

# 使用 std.testing.allocator

`std.testing.allocator` 是一个特殊的分配器，会在测试结束时自动检测内存问题：

```zig
// ❌ 错误示例
const std = @import("std");

test "memory leak detection" {
    const allocator = std.testing.allocator;
    
    // 正确的内存管理
    const slice = try allocator.alloc(u8, 100);
    defer allocator.free(slice); // 必须释放
    
    // 使用内存
    @memset(slice, 0xAA);
}

test "detect memory leak" {
    const allocator = std.testing.allocator;
    
    // ❌ 错误示例：忘记释放内存
    const slice = try allocator.alloc(u8, 100);
    // 没有 defer allocator.free(slice);
    
    // 测试结束时，testing.allocator 会检测到内存泄漏并报告错误
    // Error: memory leak detected
}
```

**测试输出示例**：

```
Test [1/2] test "memory leak detection"... OK
Test [2/2] test "detect memory leak"... FAIL (MemoryLeakDetected)
error: memory leak detected
```

# 测试内存分配函数

当测试需要分配内存的函数时，使用 `std.testing.allocator`：

```zig
const std = @import("std");

fn createString(allocator: std.mem.Allocator, content: []const u8) ![]u8 {
    const buffer = try allocator.alloc(u8, content.len);
    @memcpy(buffer, content);
    return buffer;
}

test "createString" {
    const allocator = std.testing.allocator;
    
    const str = try createString(allocator, "hello");
    defer allocator.free(str); // 必须释放
    
    try std.testing.expectEqualSlices(u8, "hello", str);
}
```

# 测试需要分配器的结构体

对于需要分配器的结构体，测试时传入 `std.testing.allocator`：

```zig
const std = @import("std");

const ArrayList = struct {
    items: []i32,
    allocator: std.mem.Allocator,
    
    fn init(allocator: std.mem.Allocator) ArrayList {
        return .{
            .items = &[_]i32{},
            .allocator = allocator,
        };
    }
    
    fn deinit(self: *ArrayList) void {
        if (self.items.len > 0) {
            self.allocator.free(self.items);
        }
    }
    
    fn append(self: *ArrayList, item: i32) !void {
        const new_items = try self.allocator.alloc(i32, self.items.len + 1);
        @memcpy(new_items[0..self.items.len], self.items);
        new_items[self.items.len] = item;
        if (self.items.len > 0) {
            self.allocator.free(self.items);
        }
        self.items = new_items;
    }
};

test "ArrayList" {
    const allocator = std.testing.allocator;
    var list = ArrayList.init(allocator);
    defer list.deinit(); // 必须调用 deinit
    
    try list.append(1);
    try list.append(2);
    try list.append(3);
    
    try std.testing.expectEqual(@as(usize, 3), list.items.len);
    try std.testing.expectEqual(@as(i32, 1), list.items[0]);
}
```

# 模拟分配失败

使用 `FailingAllocator` 测试内存不足的情况：

```zig
const std = @import("std");

test "allocation failure" {
    // 创建一个会在第 N 次分配时失败的分配器
    var failing = std.testing.FailingAllocator.init(
        std.heap.page_allocator,
        .{ .fail_index = 2 }, // 第 2 次分配时失败
    );
    const allocator = failing.allocator();
    
    // 第 1 次分配成功
    const ptr1 = try allocator.alloc(u8, 10);
    defer allocator.free(ptr1);
    
    // 第 2 次分配失败
    const result = allocator.alloc(u8, 10);
    try std.testing.expectError(error.OutOfMemory, result);
}
```

**应用场景**：
- 测试错误处理路径
- 验证资源清理逻辑
- 确保程序在内存不足时优雅降级

# 检测未初始化内存

使用 `undefined` 标记未初始化变量，配合安全检查：

```zig
// 💡 最佳实践
const std = @import("std");

test "undefined detection" {
    // Debug 模式下，Zig 会用 0xAA 填充未初始化内存
    var buffer: [10]u8 = undefined;
    
    // 在 Debug 模式下，读取未初始化的内存可能触发运行时错误
    // 但在 Release 模式下，这是未定义行为
    
    // 正确做法：先初始化再使用
    @memset(&buffer, 0);
    try std.testing.expectEqual(@as(u8, 0), buffer[0]);
}
```

# 内存安全测试最佳实践

**1. 总是使用 std.testing.allocator**

```zig
// 🚫 已废弃：0.16.0，请使用 DebugAllocator
test "correct pattern" {
    const allocator = std.testing.allocator;
    // 测试代码
}

// ❌ 错误示例
test "incorrect pattern" {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    // 这样无法自动检测内存泄漏
}
```

**2. 确保所有分配都有对应的释放**

```zig
test "proper cleanup" {
    const allocator = std.testing.allocator;
    
    const ptr1 = try allocator.alloc(u8, 10);
    defer allocator.free(ptr1); // 使用 defer 确保释放
    
    const ptr2 = try allocator.create(i32);
    defer allocator.destroy(ptr2); // 使用 defer 确保释放
    
    // 即使测试失败，defer 也会执行
}
```

**3. 测试错误路径的内存清理**

```zig
// ❌ 错误示例
const std = @import("std");

fn complexOperation(allocator: std.mem.Allocator) !void {
    const ptr1 = try allocator.alloc(u8, 100);
    errdefer allocator.free(ptr1); // 错误时释放
    
    const ptr2 = try allocator.alloc(u8, 200);
    errdefer allocator.free(ptr2); // 错误时释放
    
    // 如果这里失败，ptr1 和 ptr2 都会被正确释放
    return error.SomeError;
}

test "error path cleanup" {
    const allocator = std.testing.allocator;
    
    try std.testing.expectError(error.SomeError, complexOperation(allocator));
    // testing.allocator 会验证所有内存都已释放
}
```

**4. 测试边界条件**

```zig
test "boundary conditions" {
    const allocator = std.testing.allocator;
    
    // 测试零长度分配
    const empty = try allocator.alloc(u8, 0);
    defer allocator.free(empty);
    
    // 测试大块分配
    const large = try allocator.alloc(u8, 1024 * 1024);
    defer allocator.free(large);
}
```

# 内存安全检测工具

**GeneralPurposeAllocator 的泄漏检测**

在非测试代码中，使用 `GeneralPurposeAllocator` 检测内存泄漏：

```zig
// 🚫 已废弃：0.16.0，请使用 DebugAllocator
const std = @import("std");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer {
        const leaked = gpa.deinit();
        if (leaked == .leak) {
            std.debug.print("Memory leak detected!\n", .{});
        }
    }
    const allocator = gpa.allocator();
    
    // 程序代码
}
```

**安全检查编译选项**

```bash
# Debug 模式：启用所有安全检查
zig build -Doptimize=Debug

# ReleaseSafe 模式：优化但保留安全检查
zig build -Doptimize=ReleaseSafe

# ReleaseFast 模式：完全优化，禁用安全检查
zig build -Doptimize=ReleaseFast
```

## 基准测试

```zig
const std = @import("std");

fn fibonacci(n: usize) usize {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

pub fn main(init: std.process.Init.Minimal) !void {
    const iterations = 10_000;
    
    // 计时开始
    const start = std.time.nanoTimestamp();
    
    // 运行基准测试
    var i: usize = 0;
    while (i < iterations) : (i += 1) {
        const result = fibonacci(20);
        std.mem.doNotOptimizeAway(result);
    }
    
    // 计时结束
    const end = std.time.nanoTimestamp();
    
    // 计算耗时
    const elapsed_ns = end - start;
    const elapsed_ms = @as(f64, @floatFromInt(elapsed_ns)) / std.time.ns_per_ms;
    const avg_ns = @as(f64, @floatFromInt(elapsed_ns)) / @as(f64, @floatFromInt(iterations));
    
    std.debug.print("总耗时：{d:.2} ms\n", .{elapsed_ms});
    std.debug.print("平均耗时：{d:.2} ns/次\n", .{avg_ns});
    std.debug.print("吞吐量：{d:.0} 次/秒\n", .{1_000_000_000.0 / avg_ns});
}
```

## 测试运行与构建集成

> 📖 **本节内容来源**：整合自 Pedro Park 的 Zig Book 和 Zig Language Bible

# 基本测试命令

```bash
# 运行所有测试
zig test src/main.zig

# 运行特定测试
zig test src/main.zig --test-filter "add function"

# 运行测试并显示详细输出
zig test src/main.zig --verbose

# 在构建系统中运行测试
zig build test
```

# 测试命令选项详解

**1. --test-filter：过滤测试**

```bash
# 只运行名称包含 "add" 的测试
zig test src/main.zig --test-filter "add"

# 支持部分匹配
zig test src/main.zig --test-filter "Math"
```

**注意事项**：
- 未命名的测试块（`test { }`）始终会运行
- 过滤器区分大小写
- 支持正则表达式模式

**2. --test-cmd：自定义测试运行器**

```bash
# 使用自定义测试运行器
zig test src/main.zig --test-cmd "path/to/test_runner"

# 在特定环境下运行测试
zig test src/main.zig --test-cmd "wine" --test-cmd-bin
```

**3. --test-name-prefix：测试名称前缀**

```bash
# 为测试名称添加前缀（用于区分不同模块）
zig test src/main.zig --test-name-prefix "module1."
```

# 构建系统集成

**基本 build.zig 测试配置：**

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 主程序
    const exe = b.addExecutable(.{
        .name = "myapp",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    b.installArtifact(exe);
    
    // 单元测试
    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    const run_unit_tests = b.addRunArtifact(unit_tests);
    
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
```

**高级测试配置：**

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 1. 单元测试
    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
        .filters = &[_][]const u8{}, // 可选：测试过滤器
    });
    
    // 2. 集成测试
    const integration_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("test/integration.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 添加依赖
    const my_module = b.createModule(.{
        .root_source_file = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
    });
    integration_tests.root_module.addImport("mylib", my_module);
    
    // 3. 测试步骤
    const unit_test_step = b.step("test-unit", "Run unit tests");
    unit_test_step.dependOn(&b.addRunArtifact(unit_tests).step);
    
    const integration_test_step = b.step("test-integration", "Run integration tests");
    integration_test_step.dependOn(&b.addRunArtifact(integration_tests).step);
    
    // 4. 运行所有测试
    const all_tests_step = b.step("test-all", "Run all tests");
    all_tests_step.dependOn(unit_test_step);
    all_tests_step.dependOn(integration_test_step);
    
    // 默认测试步骤
    const test_step = b.step("test", "Run tests");
    test_step.dependOn(unit_test_step);
}
```

**运行构建系统的测试：**

```bash
# 运行默认测试
zig build test

# 运行单元测试
zig build test-unit

# 运行集成测试
zig build test-integration

# 运行所有测试
zig build test-all

# 指定优化级别
zig build test -Doptimize=ReleaseSafe

# 指定目标平台
zig build test -Dtarget=x86_64-linux
```

# 测试输出格式

**默认输出：**

```
Test [1/3] test "add function"... OK
Test [2/3] test "divide function"... OK
Test [3/3] test "expect equal"... OK
All 3 tests passed.
```

**详细输出（--verbose）：**

```
Test [1/3] test "add function"... OK
  try std.testing.expect(add(2, 3) == 5);
  try std.testing.expect(add(-1, 1) == 0);
  try std.testing.expect(add(0, 0) == 0);
Test [2/3] test "divide function"... OK
  const result = try divide(10, 2);
  try std.testing.expect(result == 5);
  const err = divide(10, 0);
  try std.testing.expectError(error.DivisionByZero, err);
...
```

**失败输出：**

```
Test [1/2] test "add function"... OK
Test [2/2] test "divide function"... FAIL (DivisionByZero)
/home/user/src/main.zig:10:5: error: DivisionByZero
    return error.DivisionByZero;
    ^~~~~~~~~~~~~~~~~~~~~~~~~~
```

# 测试最佳实践

**1. 测试命名规范**

```zig
// ✅ 好的命名：描述性强
// ❌ 错误示例
test "StringUtils.isEmpty returns true for empty string" { }
test "MathUtils.add handles negative numbers" { }
test "ArrayList.append increases length" { }

// ❌ 不好的命名：模糊
test "test1" { }
test "my test" { }
```

**2. 测试组织结构**

```
src/
├── main.zig
├── utils.zig
└── math.zig

test/
├── integration.zig    # 集成测试
└── benchmark.zig      # 性能测试
```

**3. 测试覆盖率**

```bash
# 使用 Debug 模式确保所有安全检查启用
zig test src/main.zig -Doptimize=Debug

# 使用 ReleaseSafe 模式测试优化后的行为
zig test src/main.zig -Doptimize=ReleaseSafe
```

**4. 持续集成配置**

**GitHub Actions 示例：**

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Zig
        uses: goto-bus-stop/setup-zig@v2
        with:
          version: master
      
      - name: Run tests
        run: zig build test
      
      - name: Run all tests
        run: zig build test-all
```

# 测试调试技巧

**1. 使用 std.debug.print 调试**

```zig
test "debug example" {
    const value = calculateSomething();
    std.debug.print("Debug: value = {}\n", .{value});
    try std.testing.expect(value > 0);
}
```

**2. 使用断点调试**

```zig
test "breakpoint example" {
    const value = calculateSomething();
    
    // 在这里设置断点
    std.debug.breakpoint();
    
    try std.testing.expect(value > 0);
}
```

**3. 测试隔离**

```zig
// 每个测试应该独立，不依赖其他测试的状态
test "independent test 1" {
    // 独立的测试环境
    const allocator = std.testing.allocator;
    // ...
}

test "independent test 2" {
    // 另一个独立的测试环境
    const allocator = std.testing.allocator;
    // ...
}
```

# 测试性能优化

**1. 并行测试**

Zig 默认并行运行测试，可以通过环境变量控制：

```bash
# 设置并行线程数
ZIG_TEST_THREADS=4 zig test src/main.zig

# 串行运行测试
ZIG_TEST_THREADS=1 zig test src/main.zig
```

**2. 测试过滤加速**

```bash
# 只运行修改相关的测试
zig test src/main.zig --test-filter "modified_module"
```

**3. 增量测试**

```bash
# 使用构建系统的增量编译
zig build test
```

# 测试命令速查表

| 命令                                     | 说明                 |
| ---------------------------------------- | -------------------- |
| `zig test file.zig`                      | 运行单个文件的测试   |
| `zig test file.zig --test-filter "name"` | 运行匹配的测试       |
| `zig test file.zig --verbose`            | 显示详细输出         |
| `zig build test`                         | 运行构建系统的测试   |
| `zig build test-all`                     | 运行所有测试         |
| `zig build test -Doptimize=Debug`        | Debug 模式测试       |
| `zig build test -Doptimize=ReleaseSafe`  | ReleaseSafe 模式测试 |

---

# 章节练习题

# 基础题

**题目1**：编写一个函数，使用指针交换两个变量的值。

**要求**：
- 函数签名为 `fn swap(a: *i32, b: *i32) void`
- 使用指针参数
- 交换两个变量的值

**参考答案**：
```zig
const std = @import("std");

fn swap(a: *i32, b: *i32) void {
    const temp = a.*;
    a.* = b.*;
    b.* = temp;
}

pub fn main(init: std.process.Init.Minimal) void {
    var x: i32 = 10;
    var y: i32 = 20;
    
    std.debug.print("交换前：x={}, y={}\n", .{ x, y });
    swap(&x, &y);
    std.debug.print("交换后：x={}, y={}\n", .{ x, y });
}
```

**题目2**：编写一个函数，使用指针修改数组元素。

**要求**：
- 函数签名为 `fn doubleAll(arr: []i32) void`
- 将数组中所有元素乘以 2
- 使用指针访问元素

**参考答案**：
```zig
fn doubleAll(arr: []i32) void {
    for (arr) |*item| {
        item.* *= 2;
    }
}

pub fn main(init: std.process.Init.Minimal) void {
    var arr = [_]i32{ 1, 2, 3, 4, 5 };
    doubleAll(&arr);
    std.debug.print("结果：{any}\n", .{arr});
}
```

**题目3**：编写一个函数，使用 const 指针读取数据。

**要求**：
- 函数签名为 `fn sum(arr: *const [5]i32) i32`
- 使用 const 指针参数
- 计算数组元素之和

**参考答案**：
```zig
fn sum(arr: *const [5]i32) i32 {
    var total: i32 = 0;
    for (arr.*) |item| {
        total += item;
    }
    return total;
}

pub fn main(init: std.process.Init.Minimal) void {
    const arr = [_]i32{ 1, 2, 3, 4, 5 };
    const result = sum(&arr);
    std.debug.print("总和：{}\n", .{result});
}
```

# 进阶题

**题目1**：实现一个简单的链表节点结构，使用指针链接。

**要求**：
- 定义链表节点结构
- 实现插入和遍历功能
- 使用指针管理节点

**参考答案**：
```zig
const std = @import("std");

const Node = struct {
    value: i32,
    next: ?*Node,
    
    fn init(value: i32) Node {
        return Node{
            .value = value,
            .next = null,
        };
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    var node1 = Node.init(1);
    var node2 = Node.init(2);
    var node3 = Node.init(3);
    
    node1.next = &node2;
    node2.next = &node3;
    
    var current: ?*Node = &node1;
    while (current) |node| {
        std.debug.print("{} -> ", .{node.value});
        current = node.next;
    }
    std.debug.print("null\n", .{});
}
```

**题目2**：使用多级指针实现二维数组的动态分配。

**要求**：
- 使用二级指针
- 分配 3x3 的二维数组
- 初始化并输出数组

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    const rows: usize = 3;
    const cols: usize = 3;
    
    var matrix = try allocator.alloc([]i32, rows);
    defer allocator.free(matrix);
    
    for (0..rows) |i| {
        matrix[i] = try allocator.alloc(i32, cols);
        for (0..cols) |j| {
            matrix[i][j] = @intCast(i * cols + j);
        }
    }
    
    defer {
        for (matrix) |row| {
            allocator.free(row);
        }
    }
    
    for (matrix, 0..) |row, i| {
        std.debug.print("行 {}: {any}\n", .{ i, row });
    }
}
```

# 挑战题

**题目**：实现一个简单的二叉树结构，使用指针管理节点。

**要求**：
- 定义二叉树节点结构
- 实现插入和遍历功能
- 使用递归遍历

**参考答案**：
```zig
const std = @import("std");

const TreeNode = struct {
    value: i32,
    left: ?*TreeNode,
    right: ?*TreeNode,
    
    fn init(value: i32) TreeNode {
        return TreeNode{
            .value = value,
            .left = null,
            .right = null,
        };
    }
    
    fn insert(node: *TreeNode, value: i32) void {
        if (value < node.value) {
            if (node.left) |left| {
                left.insert(value);
            } else {
                // 需要分配器来创建新节点
                // 这里简化处理
            }
        } else {
            if (node.right) |right| {
                right.insert(value);
            } else {
                // 需要分配器来创建新节点
                // 这里简化处理
            }
        }
    }
    
    fn inorder(node: *const TreeNode) void {
        if (node.left) |left| {
            left.inorder();
        }
        std.debug.print("{} ", .{node.value});
        if (node.right) |right| {
            right.inorder();
        }
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    var root = TreeNode.init(5);
    var left = TreeNode.init(3);
    var right = TreeNode.init(7);
    
    root.left = &left;
    root.right = &right;
    
    std.debug.print("中序遍历：", .{});
    root.inorder();
    std.debug.print("\n", .{});
}
```

---

# 章节练习题

# 基础题

**题目1**：编写一个简单的单元测试，验证加法函数。

**要求**：
- 创建一个 `add` 函数
- 使用 `test` 块编写测试
- 使用 `std.testing.expect` 断言

**参考答案**：
```zig
const std = @import("std");

fn add(a: i32, b: i32) i32 {
    return a + b;
}

test "add function" {
    try std.testing.expect(add(2, 3) == 5);
    try std.testing.expect(add(-1, 1) == 0);
    try std.testing.expect(add(0, 0) == 0);
}
```

**运行测试**：
```bash
zig test main.zig
```

**题目2**：编写测试验证错误处理函数。

**要求**：
- 创建一个可能失败的函数
- 测试成功和失败情况
- 使用 `std.testing.expectError`

**参考答案**：
```zig
const std = @import("std");

const MathError = error{
    DivisionByZero,
};

fn divide(a: i32, b: i32) MathError!i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

test "divide success" {
    const result = try divide(10, 2);
    try std.testing.expect(result == 5);
}

test "divide by zero" {
    try std.testing.expectError(error.DivisionByZero, divide(10, 0));
}
```

**题目3**：编写表格驱动测试。

**要求**：
- 使用结构体数组定义测试用例
- 遍历测试用例进行验证
- 输出失败的测试用例

**参考答案**：
```zig
const std = @import("std");

fn isEven(n: i32) bool {
    return n % 2 == 0;
}

test "isEven table driven" {
    const cases = [_]struct {
        input: i32,
        expected: bool,
    }{
        .{ .input = 2, .expected = true },
        .{ .input = 3, .expected = false },
        .{ .input = 0, .expected = true },
        .{ .input = -4, .expected = true },
        .{ .input = -5, .expected = false },
    };

    for (cases) |c| {
        try std.testing.expectEqual(c.expected, isEven(c.input));
    }
}
```

# 进阶题

**题目1**：编写基准测试，比较不同算法的性能。

**要求**：
- 实现两个不同的排序算法
- 使用 `std.time` 测量执行时间
- 输出性能对比结果

**参考答案**：
```zig
// ✨ 新特性：DebugAllocator
const std = @import("std");

fn bubbleSort(arr: []i32) void {
    var swapped = true;
    while (swapped) {
        swapped = false;
        for (arr[0 .. arr.len - 1], 0..) |*item, i| {
            if (item.* > arr[i + 1]) {
                const temp = item.*;
                item.* = arr[i + 1];
                arr[i + 1] = temp;
                swapped = true;
            }
        }
    }
}

fn quickSort(arr: []i32, low: usize, high: usize) void {
    if (low < high) {
        const pivot = arr[high];
        var i = low;
        for (low..high) |j| {
            if (arr[j] < pivot) {
                const temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
                i += 1;
            }
        }
        const temp = arr[i];
        arr[i] = arr[high];
        arr[high] = temp;

        quickSort(arr, low, i - 1);
        quickSort(arr, i + 1, high);
    }
}

test "sort performance comparison" {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const size: usize = 1000;
    var arr1 = try allocator.alloc(i32, size);
    defer allocator.free(arr1);
    var arr2 = try allocator.alloc(i32, size);
    defer allocator.free(arr2);

    // 初始化数组
    for (0..size) |i| {
        arr1[i] = @intCast(size - i);
        arr2[i] = @intCast(size - i);
    }

    // 测量冒泡排序
    const start1 = std.time.nanoTimestamp();
    bubbleSort(arr1);
    const end1 = std.time.nanoTimestamp();

    // 测量快速排序
    const start2 = std.time.nanoTimestamp();
    quickSort(arr2, 0, arr2.len - 1);
    const end2 = std.time.nanoTimestamp();

    std.debug.print("冒泡排序：{} ns\n", .{end1 - start1});
    std.debug.print("快速排序：{} ns\n", .{end2 - start2});
}
```

**题目2**：编写测试辅助函数，简化测试代码。

**要求**：
- 创建自定义断言函数
- 提供更详细的错误信息
- 支持多种数据类型

**参考答案**：
```zig
const std = @import("std");

fn assertEqual(comptime T: type, expected: T, actual: T, message: []const u8) !void {
    if (expected != actual) {
        std.debug.print("断言失败：{s}\n", .{message});
        std.debug.print("  期望：{}\n", .{expected});
        std.debug.print("  实际：{}\n", .{actual});
        return error.TestFailed;
    }
}

fn assertSliceEqual(comptime T: type, expected: []const T, actual: []const T) !void {
    if (expected.len != actual.len) {
        std.debug.print("切片长度不匹配：{} != {}\n", .{ expected.len, actual.len });
        return error.TestFailed;
    }

    for (expected, actual, 0..) |e, a, i| {
        if (e != a) {
            std.debug.print("切片元素不匹配，索引 {}：{} != {}\n", .{ i, e, a });
            return error.TestFailed;
        }
    }
}

test "custom assertions" {
    try assertEqual(i32, 42, 42, "数值应该相等");
    try assertSliceEqual(u8, "hello", "hello");
}
```

# 挑战题

**题目**：实现一个完整的测试框架，支持测试套件和测试报告。

**要求**：
- 支持测试套件组织
- 提供测试报告生成
- 支持测试过滤

**参考答案**：
```zig
const std = @import("std");

const TestResult = struct {
    name: []const u8,
    passed: bool,
    duration_ns: i64,
    error_msg: ?[]const u8,
};

const TestSuite = struct {
    name: []const u8,
    tests: std.ArrayList(TestResult),
    
    fn init(allocator: std.mem.Allocator, name: []const u8) TestSuite {
        return .{
            .name = name,
            .tests = std.ArrayList(TestResult).init(allocator),
        };
    }
    
    fn deinit(self: *TestSuite) void {
        self.tests.deinit();
    }
    
    fn addTest(self: *TestSuite, name: []const u8, test_fn: fn () anyerror!void) void {
        const start = std.time.nanoTimestamp();
        var result = TestResult{
            .name = name,
            .passed = false,
            .duration_ns = 0,
            .error_msg = null,
        };
        
        test_fn() catch |err| {
            result.error_msg = @errorName(err);
        };
        
        const end = std.time.nanoTimestamp();
        result.duration_ns = end - start;
        result.passed = result.error_msg == null;
        
        self.tests.append(result) catch {};
    }
    
    fn printReport(self: *TestSuite) void {
        std.debug.print("\n=== 测试报告：{s} ===\n\n", .{self.name});
        
        var passed: usize = 0;
        var failed: usize = 0;
        
        for (self.tests.items) |test_result| {
            if (test_result.passed) {
                passed += 1;
                std.debug.print("✓ {s} ({} ns)\n", .{ test_result.name, test_result.duration_ns });
            } else {
                failed += 1;
                std.debug.print("✗ {s} - {s}\n", .{ test_result.name, test_result.error_msg.? });
            }
        }
        
        std.debug.print("\n总计：{} 通过，{} 失败\n", .{ passed, failed });
    }
};

test "test framework" {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var suite = TestSuite.init(allocator, "数学函数测试");
    defer suite.deinit();
    
    suite.addTest("加法测试", struct {
        fn test() anyerror!void {
            try std.testing.expect(2 + 2 == 4);
        }
    }.test);
    
    suite.addTest("减法测试", struct {
        fn test() anyerror!void {
            try std.testing.expect(5 - 3 == 2);
        }
    }.test);
    
    suite.printReport();
}

---

## 第三部分：实战案例

> 💡 **章节过渡**：从测试到实战案例
> 
> 在[实战案例1 - CLI工具开发](../part3-practice/chapter-cli-tool.md)中，我们学习了测试与基准测试，掌握了如何验证代码的正确性和性能。
> 现在，我们将通过实战案例巩固所学知识，从 CLI 工具开发开始。
> 
> **为什么测试是实战开发的基础？**
> 
> 1. **质量保证**：测试驱动开发（TDD）确保代码质量
> 2. **重构信心**：有测试覆盖的代码更容易重构
> 3. **文档作用**：测试用例本身就是最好的文档
> 
> **学习建议**：
> - 在开发实战案例时，养成编写测试的习惯
> - 使用基准测试验证性能优化效果
> - 将测试作为开发流程的一部分
