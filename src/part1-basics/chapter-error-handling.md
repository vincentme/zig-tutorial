# 【draft】错误处理基础

## Zig错误处理哲学

> 📜 **Zig Zen 原则关联**
> 
> 本章内容体现了以下 Zig Zen 原则：
> - **"Compile errors are better than runtime crashes."**（编译期错误优于运行时崩溃）  
>   Zig 的错误联合类型（`!T`）强制开发者显式处理错误，在编译期就能发现未处理的错误情况。
> - **"Edge cases matter."**（边界情况很重要）  
>   Zig 要求显式声明所有可能的错误类型，确保边界情况和异常情况得到妥善处理。
> - **"Runtime crashes are better than bugs."**（运行时崩溃优于潜在的 bug）  
>   Zig 的 fail-fast 哲学：与其让错误隐藏在代码中，不如让程序快速失败，便于及早发现问题。

# 为什么Zig不用异常？

Zig选择显式错误处理而非异常机制，原因如下：

1. **可预测性**: 控制流清晰可见，没有隐藏的跳转
2. **性能**: 无异常处理开销，错误处理代码只在需要时执行
3. **可读性**: 函数签名明确声明可能返回的错误
4. **可调试性**: 错误追踪完整，易于定位问题根源

# 错误处理的最佳实践

**实践1：定义清晰的错误类型**
```zig
// 好的做法：语义化的错误名称
const ConfigError = error{
    FileNotFound,
    InvalidFormat,
    MissingRequiredField,
    ValueOutOfRange,
};

// 不好的做法：模糊的错误名称
const Error = error{
    Failed,
    Error,
    Bad,
};
```

**实践2：错误传播策略**
```zig
// 策略1：使用try传播错误（让调用者处理）
fn readConfig(path: []const u8) !Config {
    const file = try std.fs.cwd().openFile(path, .{});
    defer file.close();
    // ...
}

// 策略2：使用catch处理错误（当前层级处理）
fn readConfigOrDefault(path: []const u8) Config {
    return readConfig(path) catch {
        return Config.default();
    };
}

// 策略3：错误转换（统一错误类型）
fn readConfigUnified(path: []const u8) UnifiedError!Config {
    return readConfig(path) catch |err| switch (err) {
        error.FileNotFound => UnifiedError.NotFound,
        else => UnifiedError.IOError,
    };
}
```

**实践3：使用errdefer确保资源清理**
```zig
fn processFile(path: []const u8) !void {
    const file = try std.fs.cwd().openFile(path, .{});
    errdefer file.close();  // 出错时关闭文件
    
    const buffer = try allocator.alloc(u8, 1024);
    errdefer allocator.free(buffer);  // 出错时释放内存
    
    // 如果这里出错，上面的errdefer会自动执行
    try processContent(buffer);
    
    // 成功时手动清理
    allocator.free(buffer);
    file.close();
}
```

# 错误调试技巧

# 错误处理流程图

**完整错误处理流程**：

```
┌─────────────────────────────────────────────────────────────┐
│                    错误处理完整流程                            │
└─────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   函数调用    │
                    └──────┬───────┘
                           │
                           ↓
                ┌─────────────────────┐
                │  执行函数体代码      │
                └──────────┬──────────┘
                           │
                  ┌────────┴────────┐
                  │                 │
                  ↓                 ↓
          ┌─────────────┐   ┌─────────────┐
          │   成功执行   │   │   发生错误   │
          └──────┬──────┘   └──────┬──────┘
                 │                 │
                 │                 ↓
                 │        ┌──────────────────┐
                 │        │  创建错误值       │
                 │        │  error.ErrorName │
                 │        └────────┬─────────┘
                 │                 │
                 │                 ↓
                 │        ┌──────────────────┐
                 │        │  执行 errdefer   │
                 │        │  清理资源        │
                 │        └────────┬─────────┘
                 │                 │
                 │                 ↓
                 │        ┌──────────────────┐
                 │        │  返回错误值       │
                 │        │  return err      │
                 │        └────────┬─────────┘
                 │                 │
                 ↓                 ↓
        ┌────────────────────────────────────┐
        │        调用者接收返回值              │
        └────────────┬───────────────────────┘
                     │
            ┌────────┴────────┐
            │                 │
            ↓                 ↓
    ┌─────────────┐   ┌─────────────┐
    │  正常值 T   │   │  错误值 !T  │
    └──────┬──────┘   └──────┬──────┘
           │                 │
           ↓                 ↓
    ┌─────────────┐   ┌─────────────────┐
    │  继续执行   │   │  错误处理分支    │
    │  正常逻辑   │   └────────┬────────┘
    └─────────────┘            │
                      ┌────────┼────────┐
                      │        │        │
                      ↓        ↓        ↓
              ┌─────────┐ ┌────────┐ ┌────────┐
              │  try    │ │ catch  │ │ if err │
              │  传播   │ │ 处理   │ │ 匹配   │
              └────┬────┘ └───┬────┘ └───┬────┘
                   │          │          │
                   ↓          ↓          ↓
              ┌─────────┐ ┌────────┐ ┌────────┐
              │继续传播 │ │恢复/默认│ │特定处理│
              └─────────┘ └────────┘ └────────┘
```

**错误处理路径详解**：

```
路径1：成功路径（正常流程）
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 函数调用 │ -> │ 成功执行 │ -> │ 返回值T │ -> │ 继续执行 │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
   无错误        无 errdefer     无错误处理     正常逻辑
   发生          执行           需要

路径2：错误传播路径（try）
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 函数调用 │ -> │ 发生错误 │ -> │ errdefer│ -> │  try    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
   错误发生      创建错误值      清理资源       传播错误
                error.E                      给上层

路径3：错误处理路径（catch）
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 函数调用 │ -> │ 发生错误 │ -> │ errdefer│ -> │  catch  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
   错误发生      创建错误值      清理资源       处理错误
                error.E                      恢复/默认

路径4：错误匹配路径（if catch）
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 函数调用 │ -> │ 发生错误 │ -> │ errdefer│ -> │ if err  │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
   错误发生      创建错误值      清理资源       匹配错误
                error.E                      特定处理
```

**错误处理关键节点**：

| 节点         | 作用                     | 示例                             |
| ------------ | ------------------------ | -------------------------------- |
| **错误创建** | 定义错误类型并创建错误值 | `return error.FileNotFound;`     |
| **errdefer** | 确保错误发生时资源被清理 | `errdefer file.close();`         |
| **错误传播** | 将错误传递给上层调用者   | `try openFile(path);`            |
| **错误捕获** | 在当前层级处理错误       | `catch { return default; }`      |
| **错误匹配** | 根据错误类型执行不同逻辑 | `if (err == error.NotFound) ...` |

**实际应用示例**：

```zig
const std = @import("std");

const FileError = error{
    NotFound,
    PermissionDenied,
    DiskFull,
};

fn saveData(path: []const u8, data: []const u8) FileError!void {
    std.debug.print("尝试保存数据到：{s}\n", .{path});
    
    // 模拟不同的错误情况
    if (std.mem.eql(u8, path, "/forbidden")) {
        return error.PermissionDenied;
    }
    if (std.mem.eql(u8, path, "/disk_full")) {
        return error.DiskFull;
    }
    if (std.mem.eql(u8, path, "/missing")) {
        return error.NotFound;
    }
    
    std.debug.print("数据保存成功！\n", .{});
}

fn handleSave() void {
    std.debug.print("\n=== 错误处理流程演示 ===\n\n", .{});
    
    // 路径1：成功路径
    std.debug.print("1. 成功路径：\n", .{});
    saveData("/valid", "data") catch |err| {
        std.debug.print("  错误：{}\n", .{err});
    };
    
    // 路径2：错误传播路径
    std.debug.print("\n2. 错误传播路径：\n", .{});
    saveData("/missing", "data") catch |err| {
        std.debug.print("  捕获错误：{}\n", .{err});
        std.debug.print("  使用默认值继续...\n", .{});
    };
    
    // 路径3：错误匹配路径
    std.debug.print("\n3. 错误匹配路径：\n", .{});
    saveData("/forbidden", "data") catch |err| switch (err) {
        error.NotFound => std.debug.print("  文件未找到，创建新文件\n", .{}),
        error.PermissionDenied => std.debug.print("  权限不足，请求管理员权限\n", .{}),
        error.DiskFull => std.debug.print("  磁盘已满，清理空间\n", .{}),
    };
}
```

**预期输出**：
```
=== 错误处理流程演示 ===

1. 成功路径：
尝试保存数据到：/valid
数据保存成功！

2. 错误传播路径：
尝试保存数据到：/missing
  捕获错误：error.NotFound
  使用默认值继续...

3. 错误匹配路径：
尝试保存数据到：/forbidden
  权限不足，请求管理员权限
```

**错误处理最佳实践总结**：

1. **显式声明错误**：在函数签名中明确声明可能返回的错误类型
2. **及时清理资源**：使用 `errdefer` 确保错误发生时资源被正确释放
3. **合理传播错误**：让有能力处理错误的层级处理，不要过度捕获
4. **提供上下文信息**：错误消息应包含足够的调试信息
5. **统一错误类型**：在模块级别定义统一的错误类型，便于管理

**技巧1：打印错误追踪**
```zig
fn main() !void {
    const result = riskyOperation() catch |err| {
        std.debug.print("错误: {}\n", .{err});
        std.debug.print("错误追踪: {}\n", .{std.debug.getStackTrace()});
        return err;
    };
}
```

**技巧2：使用try和catch的组合**
```zig
// 带默认值的错误处理
const value = mightFail() catch 0;

// 带日志的错误处理
const value = mightFail() catch |err| {
    std.log.err("操作失败: {}", .{err});
    return err;
};

// 多错误类型处理
const value = mightFailMultiple() catch |err| switch (err) {
    error.NetworkError => handleNetworkError(err),
    error.Timeout => retry(),
    else => return err,
};
```

**技巧3：编译期错误检查**
```zig
const std = @import("std");

fn validateConfig(comptime config: Config) void {
    comptime {
        if (config.port == 0) {
            @compileError("Port cannot be 0");
        }
    }
}
```

## 错误集合

```zig
const std = @import("std");

// 定义错误集合
const FileError = error{
    NotFound,
    PermissionDenied,
    OutOfMemory,
};

const NetworkError = error{
    ConnectionFailed,
    Timeout,
};

// 错误集合合并
const CombinedError = FileError || NetworkError;

pub fn main(init: std.process.Init.Minimal) void {
    const err: FileError = FileError.NotFound;
    
    // 错误比较
    if (err == FileError.NotFound) {
        std.debug.print("文件未找到\n", .{});
    }
    
    // 错误转换
    const combined: CombinedError = err;
    std.debug.print("合并错误：{}\n", .{combined});
}
```

## 错误联合类型

```zig
const std = @import("std");

const ParseError = error{
    InvalidFormat,
    OutOfRange,
};

// 错误联合类型：可能返回 i32 或 ParseError
fn parseNumber(str: []const u8) ParseError!i32 {
    if (str.len == 0) return ParseError.InvalidFormat;
    
    var result: i32 = 0;
    for (str) |char| {
        if (char < '0' or char > '9') return ParseError.InvalidFormat;
        result = result * 10 + (char - '0');
    }
    
    return result;
}

pub fn main(init: std.process.Init.Minimal) !void {
    // 使用 try 传递错误
    const num1 = try parseNumber("123");
    std.debug.print("解析结果：{}\n", .{num1});
    
    // 使用 catch 处理错误
    const num2 = parseNumber("abc") catch |err| {
        std.debug.print("解析失败：{}\n", .{err});
        return;
    };
    std.debug.print("解析结果：{}\n", .{num2});
}
```

## try 和 catch

```zig
const std = @import("std");

fn mayFail() !i32 {
    return error.SomethingWrong;
}

pub fn main(init: std.process.Init.Minimal) !void {
    // try：传递错误给调用者
    // const result = try mayFail(); // 如果失败，main 返回错误
    
    // catch：捕获并处理错误
    const result1 = mayFail() catch 0;
    std.debug.print("结果 1: {}\n", .{result1});
    
    // catch with payload：获取错误值
    const result2 = mayFail() catch |err| {
        std.debug.print("捕获错误：{}\n", .{err});
        return;
    };
    std.debug.print("结果 2: {}\n", .{result2});
    
    // catch with else：成功时的处理
    const result3 = mayFail() catch |err| {
        std.debug.print("错误：{}\n", .{err});
        return;
    } else |value| {
        std.debug.print("成功：{}\n", .{value});
    };
}
```

## errdefer

`errdefer`用于在函数返回错误时执行清理：

```zig
const std = @import("std");

fn allocateAndProcess(allocator: std.mem.Allocator) !void {
    const memory = try allocator.alloc(u8, 100);
    
    // 如果函数返回错误，释放内存
    errdefer allocator.free(memory);
    
    // 可能失败的操作
    const success = false;
    if (!success) {
        return error.ProcessingFailed;
    }
    
    // 成功时的清理
    allocator.free(memory);
}

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    allocateAndProcess(allocator) catch |err| {
        std.debug.print("错误：{}\n", .{err});
    };
}
```

# 完整的错误处理示例

在实际项目中，经常需要管理多个资源。以下是完整的错误处理模式：

```zig
const std = @import("std");

// 示例：处理文件和内存资源
fn processFile(allocator: std.mem.Allocator, path: []const u8) !void {
    // 资源获取顺序：按依赖关系获取
    const file = try std.fs.cwd().openFile(path, .{});
    errdefer file.close();  // 出错时关闭文件
    
    const buffer = try allocator.alloc(u8, 1024);
    errdefer allocator.free(buffer);  // 出错时释放内存
    
    // 处理内容
    const bytes_read = try file.read(buffer);
    try processContent(buffer[0..bytes_read]);
    
    // 成功时的清理（按相反顺序）
    allocator.free(buffer);
    file.close();
}

fn processContent(content: []const u8) !void {
    if (content.len == 0) {
        return error.EmptyContent;
    }
    std.debug.print("处理内容：{s}\n", .{content});
}

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    processFile(allocator, "data.txt") catch |err| {
        std.debug.print("处理失败: {}\n", .{err});
        return err;
    };
    
    std.debug.print("处理成功\n", .{});
}
```

**错误处理最佳实践**：

1. **资源获取顺序**：按依赖关系获取资源
2. **清理顺序**：按相反顺序清理资源（LIFO - 后进先出）
3. **errdefer 位置**：紧跟在资源获取之后
4. **错误传播**：使用 `try` 或 `catch` 明确处理

**错误处理流程图**：

```
┌─────────────────────────────────────────────────────────┐
│              资源获取与错误处理流程                        │
└─────────────────────────────────────────────────────────┘

函数开始
    │
    ├─ 获取资源1（文件）
    │   └─ errdefer: 资源1.close()
    │
    ├─ 获取资源2（内存）
    │   └─ errdefer: 资源2.free()
    │
    ├─ 获取资源3（网络连接）
    │   └─ errdefer: 资源3.close()
    │
    ├─ 处理数据
    │   │
    │   ├─ 成功 ──┐
    │   │         │
    │   └─ 失败 ──┤
    │             │
    └─────────────┤
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
成功路径                    错误路径
    │                           │
    ├─ 清理资源3                ├─ 执行 errdefer 3
    ├─ 清理资源2                ├─ 执行 errdefer 2
    ├─ 清理资源1                ├─ 执行 errdefer 1
    │                           │
    ▼                           ▼
  返回成功                    返回错误
```

**关键要点**：
- `errdefer` 只在函数返回错误时执行
- 成功路径需要手动清理资源
- 多个 `errdefer` 按相反顺序执行（LIFO）
- 每个资源获取后立即添加对应的 `errdefer`

## 常见错误与调试指南

# 常见编译错误

**1. "use of undefined value"**

```zig
// ❌ 错误示例
var x: i32 = undefined;
const y = x + 1;  // 错误：使用未定义的值

// ✅ 正确做法
var x: i32 = 0;
const y = x + 1;
```

**原因**：Zig 0.11+ 禁止对 `undefined` 值进行算术运算。

**2. "expected type 'X', found 'Y'"**

```zig
// ❌ 错误示例
fn foo(x: i32) void { _ = x; }
foo(42.0);  // 错误：期望 i32，找到 comptime_float

// ✅ 正确做法
foo(@as(i32, 42));
// 或
foo(@intFromFloat(42.0));
```

**原因**：Zig 不进行隐式类型转换。

**3. "unable to resolve comptime value"**

```zig
// ❌ 错误示例
var runtime_value: i32 = 42;
const array: [runtime_value]u8 = undefined;  // 错误

// ✅ 正确做法
const comptime_value = 42;
const array: [comptime_value]u8 = undefined;
```

**原因**：数组大小必须是编译期常量。

**4. "variable of type 'X' must be const or comptime"**

```zig
// ❌ 错误示例
var list: std.ArrayList(u32) = .{};  // 错误：需要初始化

// ✅ 正确做法
var list: std.ArrayList(u32) = .empty;
// 或
var list = std.ArrayList(u32).init(allocator);
```

**原因**：容器类型必须正确初始化。

**5. "no field 'root_source_file'"**

```zig
// 🚫 已废弃：0.15.x 已移除
const exe = b.addExecutable(.{
    .name = "app",
    .root_source_file = b.path("src/main.zig"),  // 错误
});

// ✅ 正确做法（0.15.x+）
const exe = b.addExecutable(.{
    .name = "app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    }),
});
```

**原因**：构建系统 API 在 0.15.x 中已变更。

# 常见运行时错误

**1. "integer overflow"**

```zig
// ❌ 错误示例
const x: u8 = 255;
const y = x + 1;  // Debug 模式下 panic

// ✅ 安全处理
const y = std.math.add(u8, x, 1) catch overflowHandler;
// 或使用溢出检测
const result = @addWithOverflow(u8, x, 1);
if (result[1] != 0) {
    // 处理溢出
}
```

**2. "index out of bounds"**

```zig
// ❌ 错误示例
const array = [_]i32{ 1, 2, 3 };
const value = array[5];  // panic

// ✅ 安全访问
if (index < array.len) {
    const value = array[index];
} else {
    // 处理错误
}
```

**3. "attempt to use null value"**

```zig
// ❌ 错误示例
const maybe: ?i32 = null;
const value = maybe.?;  // panic

// ✅ 安全解包
if (maybe) |value| {
    // 使用 value
} else {
    // 处理 null
}
```

# 调试技巧

**1. 使用 std.debug.print**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const value = 42;
    std.debug.print("调试：value = {}\n", .{value});
    
    // 打印类型
    std.debug.print("类型：{}\n", .{@TypeOf(value)});
    
    // 打印完整结构
    const data = .{ 1, 2, 3 };
    std.debug.print("完整结构：{any}\n", .{data});
}
```

**2. 使用 std.debug.assert**

```zig
const std = @import("std");

fn process(value: i32) i32 {
    // 在 Debug 模式下检查条件
    std.debug.assert(value >= 0);
    return value * 2;
}
```

**3. 使用错误追踪**

```zig
const std = @import("std");

fn deepFunction() !void {
    return error.DeepError;
}

fn middleFunction() !void {
    try deepFunction();
}

pub fn main(init: std.process.Init.Minimal) void {
    middleFunction() catch |err| {
        std.debug.print("错误：{}\n", .{err});
        // 打印堆栈追踪
        std.debug.dumpCurrentStackTrace(null);
    };
}
```

**4. 使用安全检查模式**

```bash
# Debug 模式：启用所有安全检查
zig build-exe app.zig

# ReleaseSafe 模式：启用优化但保留安全检查
zig build-exe app.zig -O ReleaseSafe

# ReleaseFast 模式：最大优化，禁用安全检查
zig build-exe app.zig -O ReleaseFast
```

# 错误处理最佳实践

**1. 使用语义化的错误名称**

```zig
// ✅ 好的做法
// ❌ 错误示例
const FileError = error{
    NotFound,
    PermissionDenied,
    InvalidFormat,
};

// ❌ 不好的做法
const Error = error{
    Failed,
    Error,
};
```

**2. 在函数签名中声明具体错误**

```zig
// ✅ 好的做法：明确声明可能的错误
// ❌ 错误示例
fn readFile(path: []const u8) FileError![]u8 {
    // ...
}

// ❌ 不好的做法：使用 anyerror
fn readFile(path: []const u8) anyerror![]u8 {
    // ...
}
```

**3. 使用 errdefer 确保资源清理**

```zig
// ❌ 错误示例
fn processFile(path: []const u8) !void {
    const file = try std.fs.cwd().openFile(path, .{});
    errdefer file.close();  // 错误时关闭文件
    
    // 可能失败的操作...
}
```

**4. 记录错误上下文**

```zig
fn loadData(path: []const u8) !Data {
    return readFile(path) catch |err| {
        std.log.err("无法加载 {s}: {}", .{ path, err });
        return err;
    };
}
```

---

# 章节练习题

# 基础题

**题目1**：编写一个函数，实现安全的整数除法，使用错误处理。

**要求**：
- 函数签名为 `fn safeDivide(a: i32, b: i32) !i32`
- 除数为 0 时返回错误 `error.DivisionByZero`
- 正常情况返回商

**参考答案**：
```zig
const std = @import("std");

const MathError = error{
    DivisionByZero,
};

fn safeDivide(a: i32, b: i32) MathError!i32 {
    if (b == 0) return error.DivisionByZero;
    return @divTrunc(a, b);
}

pub fn main(init: std.process.Init.Minimal) void {
    const result = safeDivide(10, 2) catch |err| {
        std.debug.print("错误：{}\n", .{err});
        return;
    };
    std.debug.print("结果：{}\n", .{result});
}
```

**题目2**：编写一个函数，解析字符串为整数，处理可能的错误。

**要求**：
- 函数签名为 `fn parseInt(str: []const u8) !i32`
- 无效输入返回错误 `error.InvalidInput`
- 使用 `std.fmt.parseInt`

**参考答案**：
```zig
fn parseInt(str: []const u8) !i32 {
    return std.fmt.parseInt(i32, str, 10) catch |err| {
        return error.InvalidInput;
    };
}
```

**题目3**：编写一个函数，演示 `try` 和 `catch` 的使用。

**要求**：
- 定义错误集 `FileError`
- 实现文件读取函数（模拟）
- 使用 `try` 和 `catch` 处理错误

**参考答案**：
```zig
const FileError = error{
    FileNotFound,
    PermissionDenied,
};

fn openFile(path: []const u8) FileError!void {
    if (std.mem.eql(u8, path, "secret.txt")) {
        return error.PermissionDenied;
    }
    std.debug.print("文件已打开：{s}\n", .{path});
}

pub fn main(init: std.process.Init.Minimal) void {
    openFile("test.txt") catch |err| {
        std.debug.print("错误：{}\n", .{err});
    };
}
```

# 进阶题

**题目1**：实现一个函数，使用 `errdefer` 进行资源清理。

**要求**：
- 模拟资源分配
- 错误时自动清理资源
- 成功时手动清理

**参考答案**：
```zig
const ResourceError = error{
    AllocationFailed,
    InitializationFailed,
};

fn createResource() ResourceError!void {
    std.debug.print("分配资源...\n", .{});
    errdefer std.debug.print("清理资源（错误）\n", .{});
    
    // 模拟初始化失败
    return error.InitializationFailed;
}

pub fn main(init: std.process.Init.Minimal) void {
    createResource() catch |err| {
        std.debug.print("错误：{}\n", .{err});
    };
}
```

**题目2**：实现一个函数，使用 `catch |err| switch` 处理多种错误。

**要求**：
- 定义包含至少 3 种错误的错误集
- 对每种错误提供不同的处理方式
- 使用 switch 处理错误

**参考答案**：
```zig
const NetworkError = error{
    ConnectionFailed,
    Timeout,
    InvalidResponse,
};

fn fetchData() NetworkError![]const u8 {
    return error.Timeout;
}

pub fn main(init: std.process.Init.Minimal) void {
    const data = fetchData() catch |err| switch (err) {
        error.ConnectionFailed => {
            std.debug.print("连接失败，重试中...\n", .{});
            return;
        },
        error.Timeout => {
            std.debug.print("超时，使用缓存数据\n", .{});
            return;
        },
        error.InvalidResponse => {
            std.debug.print("无效响应，记录日志\n", .{});
            return;
        },
    };
    _ = data;
}
```

# 挑战题

**题目**：实现一个简单的错误传播链，演示多层函数的错误处理。

**要求**：
- 实现至少 3 层函数调用
- 每层函数都可能返回错误
- 使用 `try` 传播错误
- 在顶层统一处理错误

**参考答案**：
```zig
const AppError = error{
    ConfigLoadFailed,
    DatabaseConnectFailed,
    QueryFailed,
};

fn loadConfig() AppError!void {
    std.debug.print("加载配置...\n", .{});
}

fn connectDatabase() AppError!void {
    try loadConfig();
    std.debug.print("连接数据库...\n", .{});
}

fn queryData() AppError!void {
    try connectDatabase();
    std.debug.print("查询数据...\n", .{});
}

pub fn main(init: std.process.Init.Minimal) void {
    queryData() catch |err| {
        std.debug.print("应用错误：{}\n", .{err});
        return;
    };
    std.debug.print("操作成功！\n", .{});
}
```

---
