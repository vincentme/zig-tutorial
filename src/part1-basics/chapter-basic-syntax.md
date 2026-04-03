# 【draft】基础语法

本章将介绍Zig的基本语法元素，包括变量声明、数据类型、数组、切片、枚举、联合和结构体。这些是构建Zig程序的基础。

## 变量声明

### 类型系统特点

Zig采用强类型系统，但支持类型推断。与C/C++不同，Zig明确区分：

- **常量（const）**: 编译期或运行期不可变值
- **变量（var）**: 可在运行期修改的值
- **编译期常量（comptime）**: 在编译期计算并内联的值

### 设计理念

1. **显式优于隐式**: 明确区分可变与不可变，减少意外修改
2. **编译期优化**: 编译期常量可以被完全优化
3. **内存安全**: 不可变性防止并发问题
4. **代码可读性**: 一眼就能看出变量是否会被修改

### 应用场景

- **配置参数**：使用`const`，防止意外修改
- **循环计数器**：使用`var`，允许递增
- **数学常量**：使用`comptime`，编译期计算

### 基本语法

Zig 是强类型语言，支持类型推断：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 常量声明（不可变）
    const constant: i32 = 42;
    const inferred_const = 100; // 类型推断为 comptime_int
    
    // 变量声明（可变）
    var mutable: i32 = 10;
    var inferred_var = 20; // 类型推断为 i32
    
    mutable = 30; // 合法
    // constant = 50; // 编译错误：常量不可修改
    
    std.debug.print("constant: {}, mutable: {}\n", .{ constant, mutable });
}
```

**预期输出：**
```
constant: 42, mutable: 30
```

## 命名规范

Zig 遵循明确的命名规范，确保代码风格一致且易于理解。

### 变量命名

**蛇形命名法（snake_case）**：用于变量名

```zig
// ✅ 正确示例
var user_name: []const u8 = undefined;
var current_score: i32 = 0;
var is_active: bool = false;

// ❌ 错误示例
var userName: []const u8 = undefined;
var CurrentScore: i32 = 0;
```

### 函数命名

**驼峰命名法（camelCase）**：用于函数名

```zig
// ✅ 正确示例
fn calculateTotal() i32 { }
fn processUserData(data: []const u8) void { }
fn isValidEmail(email: []const u8) bool { }

// ❌ 错误示例
fn calculate_total() i32 { }      // 错误：函数应使用驼峰命名
fn CalculateTotal() i32 { }       // 错误：首字母应小写
```

### 类型命名

- **结构体、枚举、联合的类型名**使用 PascalCase
- **枚举成员名**使用 PascalCase
- **结构体和联合的字段名**使用 snake_case
  - **私有字段和方法**使用下划线前缀

```zig
// ✅ 正确示例
const Person = struct {
    name: []const u8,
    age: u32,
};

const StudentRecord = struct {
    student_id: usize,
    grades: []f32,
};

const Status = enum {
    Pending,
    InProgress,
    Completed,
    Failed,
};

const Result = union {
    success: []const u8,
    error: ErrorType,
};

const Counter = struct {
    _count: usize,              // 私有字段
    
    pub fn init() Counter {
        return .{ ._count = 0 };
    }
    
    pub fn increment(self: *Counter) void {
        self._count += 1;
    }
    
    fn _validate(self: *const Counter) bool {  // 私有方法
        return self._count < 1000;
    }
};

// ❌ 错误示例
const person = struct { };         // 错误：类型名应首字母大写
const student_record = struct { }; // 错误：应使用帕斯卡命名

const Status = enum {
    pending,        // 错误：枚举成员应使用帕斯卡命名
    in_progress,    // 错误：枚举成员应使用帕斯卡命名
};
```

### 常量命名

**蛇形命名（snake_case）**：用于常量，遵循既有约定时使用全大写

```zig
// ✅ 正确示例 - 常量使用 snake_case
const max_size = 1024;
const default_timeout = 30;
const buffer_size = 4096;
const max_connections = 100;
const version = "1.0.0";

// ✅ 正确示例 - 遵循既有约定时使用 SCREAMING_SNAKE_CASE
const PI = 3.14159;              // 数学常量
const ENOENT = error.FileNotFound; // POSIX 约定
const SIGINT = 2;                // 信号常量

// ❌ 错误示例
const maxSize = 1024;            // 错误：应使用蛇形命名
const MAX_SIZE = 1024;           // 不推荐：普通常量不需要全大写
```

### 泛型类型参数命名

泛型参数使用**单个大写字母或描述性名称**。

```zig
// ✅ 正确示例 - 单个字母
fn Stack(comptime T: type) type {
    return struct {
        items: []T,
    };
}

fn HashMap(comptime K: type, comptime V: type) type {
    return struct {
        keys: []K,
        values: []V,
    };
}

// ✅ 正确示例 - 描述性名称
fn Queue(comptime Element: type) type {
    return struct {
        elements: []Element,
    };
}

// ❌ 错误示例
fn Stack(comptime t: type) type { }  // 错误：类型参数应大写
fn Stack(comptime TYPE: type) type { } // 错误：不应全大写
```

### 命名规范总结表

| 标识符类型               | 命名规范               | 示例                         | 说明                              |
| ------------------------ | ---------------------- | ---------------------------- | --------------------------------- |
| 变量                     | snake_case             | `user_name`, `current_score` | 单词间用下划线分隔，全小写        |
| 函数                     | camelCase              | `calculateTotal`, `isValid`  | 首字母小写，后续单词首字母大写    |
| 结构体、枚举、联合的类型 | PascalCase             | `Person`, `StudentRecord`    | 每个单词首字母大写                |
| 结构体和联合的字段       | snake_case             | `student_id`, `age`          | 单词间用下划线分隔，全小写        |
| 枚举成员                 | PascalCase             | `Red`, `InProgress`          | 每个单词首字母大写                |
| 常量                     | snake_case             | `max_size`, `buffer_size`    | 特殊约定可用 SCREAMING_SNAKE_CASE |
| 泛型参数                 | 单个大写字母           | `T`, `K`, `V`                | 或使用描述性名称如 `Element`      |
| 私有字段和方法           | _snake_case _camelCase | `_count`, `_validateInput`   | 下划线前缀                        |

### 命名最佳实践

1. **使用有意义的名称**：名称应清楚表达用途
   ```zig
   // ✅ 好的命名
   var user_count: usize = 0;
   fn calculateAverage(scores: []f32) f32 { }
   
   // ❌ 不好的命名
   var x: usize = 0;              // 含义不明确
   fn calc(s: []f32) f32 { }      // 名称过于简短
   ```

2. **避免缩写**：除非是广泛认可的缩写
   ```zig
   // ✅ 好的命名
   var error_message: []const u8 = undefined;
   var http_response: Response = undefined;
   
   // ❌ 不好的命名
   var err_msg: []const u8 = undefined;  // 不必要的缩写
   var resp: Response = undefined;       // 缩写不清晰
   ```

3. **布尔值使用 is/has/can 前缀**
   ```zig
   // ✅ 好的命名
   var is_valid: bool = false;
   var has_permission: bool = false;
   var can_write: bool = false;
   
   // ❌ 不好的命名
   var valid: bool = false;       // 缺少前缀
   var permission: bool = false;  // 含义不明确
   ```

4. **函数名使用动词或动词短语**
   ```zig
   // ✅ 好的命名
   fn getName() []const u8 { }
   fn setData(value: i32) void { }
   fn isValid() bool { }
   
   // ❌ 不好的命名
   fn name() []const u8 { }       // 缺少动词
   fn data(value: i32) void { }   // 含义不明确
   ```

## 变量遮蔽规则

Zig **完全禁止**变量遮蔽（Shadowing）。标识符永远不允许使用相同的名称来"隐藏"其他标识符。这意味着：

- **嵌套作用域不能声明同名变量**：内部作用域不能重新声明外部作用域已有的变量名
- **兄弟作用域可以同名**：不嵌套的独立作用域可以使用相同的变量名

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const pi = 3.14;

    {
        // 编译错误：嵌套块中的变量遮蔽了外层的 pi
        // var pi: i32 = 1234; // error: local variable shadows declaration of 'pi'
    }
}

// 兄弟作用域示例：这是合法的
test "separate scopes" {
    {
        const pi = 3.14;
        _ = pi;
    }
    {
        var pi: bool = true;
        _ = &pi; // 合法：这是不同的作用域，不构成遮蔽
    }
}
```

**设计理念**：
- 避免因变量遮蔽导致的逻辑错误
- 提高代码可读性和可维护性
- 编译器能够更早发现潜在的命名冲突
- 一个标识符在其定义的作用域内始终保持相同的含义

## 解包赋值

Zig 支持解包赋值，可以从元组、向量或数组中一次性提取多个值：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // 元组解包
    const tuple = .{ 1, 2, 3 };
    var x: i32 = undefined;
    var y: i32 = undefined;
    var z: i32 = undefined;
    x, y, z = tuple;
    std.debug.print("元组解包：x={}, y={}, z={}\n", .{ x, y, z });

    // 向量解包
    const vector: @Vector(3, u32) = .{ 7, 8, 9 };
    var a: u32 = undefined;
    var b: u32 = undefined;
    var c: u32 = undefined;
    a, b, c = vector;
    std.debug.print("向量解包：a={}, b={}, c={}\n", .{ a, b, c });

    // 数组解包
    const array = [_]u32{ 4, 5, 6 };
    var p: u32 = undefined;
    var q: u32 = undefined;
    var r: u32 = undefined;
    p, q, r = array;
    std.debug.print("数组解包：p={}, q={}, r={}\n", .{ p, q, r });

    // 混合声明：可以同时声明常量和变量
    const tuple2 = .{ 10, 20, 30 };
    const first, var second: i32, const third = tuple2; // 变量需要显示声明类型
    second = 25; // 可以修改
    std.debug.print("混合声明：{}, {}, {}\n", .{ first, second, third });
}
```

**预期输出：**
```
元组解包：x=1, y=2, z=3
向量解包：a=7, b=8, c=9
数组解包：p=4, q=5, r=6
混合声明：10, 25, 30
```

## 分配器传递模式

Zig 的内存管理遵循一个重要原则：**显式传递分配器**。这意味着：

1. **永远不要使用全局状态**：避免使用全局分配器
2. **总是将分配器作为参数传递**：让调用者决定内存分配策略
3. **明确所有权**：谁分配，谁释放

**为什么这样设计？**

1. **灵活性**：调用者可以选择最合适的分配器（栈分配器、堆分配器、竞技场分配器等）
2. **可测试性**：测试时可以使用自定义分配器跟踪内存使用
3. **可组合性**：函数可以轻松组合，不会因为全局状态产生冲突
4. **性能**：可以根据场景选择最优的分配策略

**正确示例**：

```zig
const std = @import("std");

// ✅ 正确：分配器作为参数传递
fn processData(allocator: std.mem.Allocator, data: []const u8) ![]u8 {
    // 使用传入的分配器
    const buffer = try allocator.alloc(u8, data.len);
    @memcpy(buffer, data);
    return buffer;
}

// ✅ 正确：结构体存储分配器
const DataProcessor = struct {
    allocator: std.mem.Allocator,
    
    fn init(allocator: std.mem.Allocator) DataProcessor {
        return .{
            .allocator = allocator,
        };
    }
    
    fn process(self: *DataProcessor, data: []const u8) ![]u8 {
        // 使用存储的分配器
        return try self.allocator.alloc(u8, data.len);
    }
};

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 传递分配器
    const result = try processData(allocator, "hello");
    defer allocator.free(result);
    
    // 或者使用结构体
    var processor = DataProcessor.init(allocator);
    const result2 = try processor.process("world");
    defer allocator.free(result2);
}
```

**错误示例**：

```zig
const std = @import("std");

// ❌ 错误：使用全局分配器
fn processDataBad(data: []const u8) ![]u8 {
    // 不要这样做！
    var buffer = try std.heap.page_allocator.alloc(u8, data.len);
    @memcpy(buffer, data);
    return buffer;
}

// ❌ 错误：硬编码分配器
fn processDataAlsoBad(data: []const u8) ![]u8 {
    var gpa = std.heap.DebugAllocator(.{}){};
    // 每次调用都创建新的分配器，效率低下
    var buffer = try gpa.allocator().alloc(u8, data.len);
    @memcpy(buffer, data);
    return buffer;
}

// ❌ 错误：使用静态变量存储分配器
var global_allocator: ?std.mem.Allocator = null;

fn setAllocator(allocator: std.mem.Allocator) void {
    global_allocator = allocator;
}

fn processDataWithGlobal(data: []const u8) ![]u8 {
    // 全局状态会导致测试困难和并发问题
    const allocator = global_allocator orelse return error.NoAllocator;
    return try allocator.alloc(u8, data.len);
}
```

**分配器传递的标准模式**：

```zig
// 1. 函数参数传递
fn function(allocator: std.mem.Allocator, ...) !ReturnType {
    // 使用 allocator
}

// 2. 结构体存储
const MyStruct = struct {
    allocator: std.mem.Allocator,
    
    fn init(allocator: std.mem.Allocator) MyStruct {
        return .{ .allocator = allocator };
    }
};

// 3. 方法接收器
fn method(self: *MyStruct, ...) !ReturnType {
    // 使用 self.allocator
}
```

**常见分配器类型**：

| 分配器                 | 用途       | 特点                                 |
| ---------------------- | ---------- | ------------------------------------ |
| `DebugAllocator`       | 开发调试   | 检测内存泄漏、双重释放、捕获堆栈跟踪 |
| `page_allocator`       | 简单场景   | 直接使用操作系统页面分配             |
| `ArenaAllocator`       | 批量分配   | 一次性释放所有内存                   |
| `FixedBufferAllocator` | 固定缓冲区 | 使用预分配的缓冲区                   |

> 📖 **相关章节**：内存管理的详细讲解请参考[内存管理模型](../part2-advanced/chapter-memory-management.html)。

## 基本数据类型

**整数类型：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 有符号整数
    const signed_i8: i8 = -128;
    const signed_i16: i16 = -32768;
    const signed_i32: i32 = -2147483648;
    const signed_i64: i64 = -9223372036854775808;
    
    // 无符号整数
    const unsigned_u8: u8 = 255;
    const unsigned_u16: u16 = 65535;
    const unsigned_u32: u32 = 4294967295;
    const unsigned_u64: u64 = 18446744073709551615;
    
    // 平台相关大小
    const isize_val: isize = 100; // 指针大小
    const usize_val: usize = 200;
    
    // C ABI 兼容类型
    const c_int_val: c_int = 10;
    const c_long_val: c_long = 20;
}
```

**浮点类型：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const float_32: f32 = 3.14159;
    const float_64: f64 = 3.141592653589793;
    const float_128: f128 = 3.14159265358979323846264338327950288;

    std.debug.print("f32: {}, f64: {}, f128: {}\n", .{ float_32, float_64, float_128 });
}
```

**预期输出：**
```
f32: 3.14159, f64: 3.141592653589793, f128: 3.14159265358979323846264338327950288
```

**布尔和字符类型：**
```zig
const bool_val: bool = true;
const char_val: u8 = 'A'; // 字符字面量是 u8 类型
```

## 类型转换

### 为什么需要显式类型转换？

Zig 的设计哲学是"显式优于隐式"，因此不进行隐式类型转换。这带来以下好处：
1. **避免精度丢失**：所有类型转换都是明确的，不会意外丢失数据
2. **提高代码可读性**：类型转换意图清晰可见
3. **减少运行时错误**：编译期就能发现潜在的类型问题

### Zig 的类型转换策略

Zig 提供了多种类型转换方式，每种都有特定的用途和安全保证：

| 转换方式        | 用途           | 安全性                                                                                 | 示例          |
| --------------- | -------------- | -------------------------------------------------------------------------------------- | ------------- |
| `@intCast`      | 整数类型间转换 | **运行时安全检查**（Debug/ReleaseSafe模式panic，ReleaseFast/ReleaseSmall为未定义行为） | `u32` → `u8`  |
| `@floatFromInt` | 整数转浮点     | 安全，可能丢失精度                                                                     | `i32` → `f32` |
| `@intFromFloat` | 浮点转整数     | **运行时安全检查**（Debug/ReleaseSafe模式panic，ReleaseFast/ReleaseSmall为未定义行为） | `f64` → `i32` |
| `@truncate`     | 截断高位       | **不安全**，明确意图（不检查范围）                                                     | `i32` → `u8`  |
| `@bitCast`      | 位模式重解释   | **不安全**，保持位模式                                                                 | `f32` → `u32` |

**详细代码示例：**

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // ========================================
    // 1. @intCast - 安全的整数类型转换
    // ========================================
    std.debug.print("=== @intCast 示例 ===\n", .{});

    const small: i32 = 100;
    const small_u8: u8 = @intCast(small); // ✅ OK: 100 在 u8 范围内
    std.debug.print("i32({}) -> u8({})\n", .{ small, small_u8 });

    // ⚠️ 以下代码在 Debug/ReleaseSafe 模式下会 panic
    // const large: i32 = 300;
    // const large_u8: u8 = @intCast(large);  // ❌ panic: 300 超出 u8 范围

    // 在 ReleaseFast/ReleaseSmall 模式下，这是 UB（未定义行为）
    // 编译器不会检查，结果不可预测

    // ========================================
    // 2. @floatFromInt - 整数转浮点
    // ========================================
    std.debug.print("\n=== @floatFromInt 示例 ===\n", .{});

    const int_val: i32 = 42;
    const float_val: f32 = @floatFromInt(int_val); // ✅ OK: 42.0
    std.debug.print("i32({}) -> f32({})\n", .{ int_val, float_val });

    // 大整数转浮点可能丢失精度
    const large_int: i64 = 12345678901234567;
    const large_float: f64 = @floatFromInt(large_int);
    std.debug.print("i64({}) -> f64({d:.2})\n", .{ large_int, large_float });

    // ========================================
    // 3. @intFromFloat - 浮点转整数
    // ========================================
    std.debug.print("\n=== @intFromFloat 示例 ===\n", .{});

    const float_num: f32 = 42.7;
    const int_num: i32 = @intFromFloat(float_num); // ✅ OK: 42（截断小数）
    std.debug.print("f32({}) -> i32({})\n", .{ float_num, int_num });

    // ⚠️ 以下代码在 Debug/ReleaseSafe 模式下会 panic
    // const huge_float: f32 = 1e10;
    // const huge_int: i32 = @intFromFloat(huge_float);  // ❌ panic: 超出 i32 范围

    // ========================================
    // 4. @truncate - 截断高位（不安全）
    // ========================================
    std.debug.print("\n=== @truncate 示例 ===\n", .{});

    const value: u32 = 300;
    const truncated: u8 = @truncate(value); // ✅ OK: 300 % 256 = 44
    std.debug.print("u32({}) -> u8({}) [截断]\n", .{ value, truncated });

    // ========================================
    // 5. @bitCast - 位模式重解释（不安全）
    // ========================================
    std.debug.print("\n=== @bitCast 示例 ===\n", .{});

    const float_bits: f32 = 3.14159;
    const bits: u32 = @bitCast(float_bits); // ✅ OK: 保持位模式
    std.debug.print("f32({}) -> u32(0x{x})\n", .{ float_bits, bits });

    // 反向转换
    const back_to_float: f32 = @bitCast(bits);
    std.debug.print("u32(0x{x}) -> f32({})\n", .{ bits, back_to_float });

    // 注意：@bitCast 要求源类型和目标类型大小相同
    // const wrong: u64 = @bitCast(float_bits);  // ❌ 编译错误：大小不匹配
}
```

**重要区分**：
- `@intCast` 用于**安全转换**：值必须在目标类型范围内，否则 panic
- `@truncate` 用于**不安全的截断**：直接丢弃高位，不检查范围

### 最佳实践

1. **优先使用安全转换**：`@intCast`、`@floatFromInt` 等有运行时检查的转换
2. **明确不安全操作**：使用 `@truncate`、`@bitCast` 时添加注释说明意图
3. **处理可能的错误**：对于可能失败的转换，先检查范围再使用 `@intCast`，或使用 `std.math.cast`

```zig
const std = @import("std");

// 方式一：手动检查
fn safeConvert(value: i32) !u8 {
    if (value < 0 or value > 255) {
        return error.OutOfRange;
    }
    return @intCast(value);
}

// 方式二：使用 std.math.cast（返回 optional）
fn safeConvert2(value: i32) !u8 {
    return std.math.cast(u8, value) orelse error.OutOfRange;
}

pub fn main(_: std.process.Init.Minimal) !void {
    const value: i32 = 300;
    const safe: u8 = try safeConvert(value);
    std.debug.print("safeConvert({}) -> u8({}) [安全]\n", .{ value, safe });

    const value2: i32 = 300;
    const safe2: u8 = try safeConvert2(value2);
    std.debug.print("safeConvert2({}) -> u8({}) [安全]\n", .{ value2, safe2 });
}

```

## 数组和切片

### 数组 vs 切片：核心概念

在 Zig 中，数组和切片是两个重要但不同的概念：

- **数组**：固定大小，大小是类型的一部分。默认存储在栈上，也可通过分配器存储在堆上（此时返回切片类型）
- **切片**：包含指针和长度两个字段，是对连续内存区域的"视图"。切片本身大小固定，但可以在运行时引用不同长度的数据（而数组长度是编译期常量）。切片可以引用数组、堆分配的内存、字符串字面量等任何连续内存

> 📖 **相关章节**：切片的底层实现涉及指针操作，详细内容请参考[指针与引用类型](../part2-advanced/chapter-pointers.md)。

**为什么区分数组和切片？**

1. **性能**：数组大小编译期已知，可以进行更好的优化
2. **安全**：数组边界检查在编译期进行，切片在运行期检查
3. **灵活性**：切片可以引用数组的任意部分，更灵活

### 数组的核心特性

1. **大小固定**：数组大小在编译期确定，不可改变
2. **类型包含大小**：`[5]i32` 和 `[10]i32` 是不同的类型
3. **值语义**：数组赋值会复制所有元素
4. **内存连续**：元素在内存中连续存储，访问高效

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    // 固定大小数组
    // 类型 [5]i32 表示：5个 i32 元素的数组
    const array: [5]i32 = [_]i32{ 1, 2, 3, 4, 5 };

    // 数组长度：编译期已知
    const len = array.len;

    // 访问元素：边界检查在编译期或运行期进行
    const first = array[0];
    const last = array[array.len - 1];

    // 数组遍历
    for (array, 0..) |item, index| {
        std.debug.print("array[{}] = {}\n", .{ index, item });
    }

    std.debug.print("array length: {}, first: {}, last: {}\n", .{ len, first, last });

    // 多维数组：数组的数组
    const matrix: [3][3]i32 = [_][3]i32{
        [_]i32{ 1, 2, 3 },
        [_]i32{ 4, 5, 6 },
        [_]i32{ 7, 8, 9 },
    };
    // 多维数组遍历
    for (matrix, 0..) |row, row_index| {
        for (row, 0..) |item, col_index| {
            std.debug.print("matrix[{}][{}] = {}\n", .{ row_index, col_index, item });
        }
    }
}
```

**预期输出：**
```
array[0] = 1
array[1] = 2
array[2] = 3
array[3] = 4
array[4] = 5
array length: 5, first: 1, last: 5
matrix[0][0] = 1
matrix[0][1] = 2
matrix[0][2] = 3
matrix[1][0] = 4
matrix[1][1] = 5
matrix[1][2] = 6
matrix[2][0] = 7
matrix[2][1] = 8
matrix[2][2] = 9
```

### 数组的实际应用

```zig
// 场景1：编译期已知大小的数据
const BUFFER_SIZE = 1024;
var buffer: [BUFFER_SIZE]u8 = undefined;

// 场景2：固定大小的查找表
const fibonacci = [_]u32{ 1, 1, 2, 3, 5, 8, 13, 21, 34, 55 };

// 场景3：多维矩阵运算
fn matrixMultiply(a: [3][3]f32, b: [3][3]f32) [3][3]f32 {
    var result: [3][3]f32 = undefined;
    for (0..3) |i| {
        for (0..3) |j| {
            var sum: f32 = 0;
            for (0..3) |k| {
                sum += a[i][k] * b[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
}
```

### 切片的核心特性

1. **动态大小**：切片大小在运行期确定
2. **胖指针**：包含指针和长度两个字段
> 📖 **深入学习**：胖指针是 Zig 指针系统的重要组成部分，[指针与引用类型](../part2-advanced/chapter-pointers.md)将详细讲解各种指针类型及其应用场景。
3. **引用语义**：切片是对底层内存的引用，不拥有数据
4. **边界检查**：运行期进行边界检查，更安全

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    var array = [_]i32{ 1, 2, 3, 4, 5 };

    // 创建切片：从数组中"切出"一部分
    // 切片类型 []i32 包含：指针 + 长度
    const slice: []i32 = array[1..4]; // 包含元素 2, 3, 4

    // 切片长度：运行期可知
    std.debug.print("slice length: {}, first: {}\n", .{ slice.len, slice[0] });

    // 切片指针：指向底层内存
    const ptr = slice.ptr;
    std.debug.print("slice pointer: {any}\n", .{ptr});

    // 修改切片会影响原数组
    slice[0] = 99;
    std.debug.print("array[1] after modification: {}\n", .{array[1]});

    // 切片可以重新切片
    const subslice = slice[0..2]; // 从切片中再切出
    std.debug.print("subslice length: {}\n", .{subslice.len});
}
```

**预期输出：**
```
slice length: 3, first: 2
slice pointer: i32@16f6f24c4
array[1] after modification: 99
subslice length: 2
```

**注意**：`slice pointer` 的输出会因运行环境不同而变化，显示实际的内存地址。

### 切片的内存布局

```mermaid
graph LR
    classDef ptrStyle fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef lenStyle fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    classDef container fill:#fafafa,stroke:#666,stroke-width:1px
    
    subgraph Slice["切片结构（胖指针）"]
        direction LR
        Ptr["ptr<br/>(指针)<br/>8 字节"]:::ptrStyle
        Len["len<br/>(长度)<br/>8 字节"]:::lenStyle
    end
    
    class Slice container
```

**64位系统下切片占用 16 字节**（指针 8 字节 + 长度 8 字节）

### 数组 vs 切片：内存布局对比图

**数组的内存布局**：

声明：`var array: [5]i32 = .{ 1, 2, 3, 4, 5 };`

```mermaid
graph TB
    classDef ptrStyle fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef arrayElement fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef inactive fill:#f5f5f5,stroke:#999,stroke-dasharray: 5 5
    classDef container fill:#fafafa,stroke:#666,stroke-width:1px
    
    subgraph Memory["栈内存或静态内存区"]
        direction LR
        A0["[0]<br/>值: 1"]:::arrayElement
        A1["[1]<br/>值: 2"]:::arrayElement
        A2["[2]<br/>值: 3"]:::arrayElement
        A3["[3]<br/>值: 4"]:::arrayElement
        A4["[4]<br/>值: 5"]:::arrayElement
        Other["其他数据"]:::inactive
    end
    
    Start["数组起始地址<br/>(编译期已知)"]:::ptrStyle -.-> A0
    
    class Memory container
```

**特点**：
- ✓ 大小固定：编译期确定，类型的一部分
- ✓ 内存连续：所有元素在内存中连续存储
- ✓ 栈分配：通常在栈上分配（除非使用 const 或 static）
- ✓ 直接访问：通过索引直接访问，无间接寻址
- ✓ 无元数据：不存储长度信息（编译期已知）

**切片的内存布局**：

声明：`const slice: []i32 = array[1..4];`

```mermaid
graph TB
    classDef ptrStyle fill:#fff9c4,stroke:#f57f17,stroke-width:2px
    classDef lenStyle fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    classDef arrayElement fill:#e1f5ff,stroke:#01579b,stroke-width:3px
    classDef inactive fill:#f5f5f5,stroke:#999,stroke-dasharray: 5 5
    classDef container fill:#fafafa,stroke:#666,stroke-width:1px
    
    subgraph SliceVar["切片变量（栈上）- 胖指针结构"]
        direction LR
        Ptr["ptr (指针)<br/>8 字节<br/>指向 array[1]"]:::ptrStyle
        Len["len (长度)<br/>8 字节<br/>值: 3"]:::lenStyle
    end
    
    subgraph Array["底层数组（array）"]
        direction LR
        A0["[0]<br/>值: 1"]:::inactive
        A1["[1]<br/>值: 2"]:::arrayElement
        A2["[2]<br/>值: 3"]:::arrayElement
        A3["[3]<br/>值: 4"]:::arrayElement
        A4["[4]<br/>值: 5"]:::inactive
        Other["其他数据"]:::inactive
    end
    
    Ptr -.->|指向| A1
    
    class SliceVar container
    class Array container
```

**特点**：
- ✓ 大小动态：运行期确定，存储在 len 字段中
- ✓ 胖指针：包含指针和长度两个部分（共 16 字节）
- ✓ 引用语义：不拥有数据，只是对底层数组的引用
- ✓ 灵活性：可以指向数组的任意子区间
- ✓ 边界检查：运行期进行边界检查，更安全

**内存布局关键差异**：

| 特性           | 数组                     | 切片                    |
| -------------- | ------------------------ | ----------------------- |
| **大小信息**   | 编译期已知，类型的一部分 | 运行期存储在 len 字段中 |
| **内存占用**   | 元素大小 × 元素数量      | 16 字节（指针 + 长度）  |
| **存储位置**   | 栈或静态内存             | 栈上（胖指针）          |
| **数据所有权** | 拥有数据                 | 引用数据（不拥有）      |
| **访问方式**   | 直接访问                 | 间接访问（通过指针）    |
| **边界检查**   | 编译期检查               | 运行期检查              |
| **灵活性**     | 固定大小                 | 动态大小                |

**实际应用示例**：
```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    var array: [5]i32 = .{ 1, 2, 3, 4, 5 };

    std.debug.print("=== 数组 vs 切片内存布局 ===\n\n", .{});

    std.debug.print("数组信息：\n", .{});
    std.debug.print("  类型：[5]i32\n", .{});
    std.debug.print("  大小：{} 字节\n", .{@sizeOf(@TypeOf(array))});
    std.debug.print("  元素数量：{}\n", .{array.len});
    std.debug.print("  地址：{any}\n\n", .{&array});

    const slice: []i32 = array[1..4];

    std.debug.print("切片信息：\n", .{});
    std.debug.print("  类型：[]i32\n", .{});
    std.debug.print("  大小：{} 字节（胖指针）\n", .{@sizeOf(@TypeOf(slice))});
    std.debug.print("  长度：{}\n", .{slice.len});
    std.debug.print("  指针：{any}\n", .{slice.ptr});
    std.debug.print("  数据地址：{any}\n\n", .{&slice[0]});

    std.debug.print("内存关系：\n", .{});
    std.debug.print("  数组起始地址：{any}\n", .{&array[0]});
    std.debug.print("  切片起始地址：{any}（偏移 1 个元素）\n", .{&slice[0]});
    std.debug.print("  地址差：{} 字节 = {} 个元素\n", .{
        @intFromPtr(&slice[0]) - @intFromPtr(&array[0]),
        (@intFromPtr(&slice[0]) - @intFromPtr(&array[0])) / @sizeOf(i32),
    });
}
```

**预期输出**：
```
=== 数组 vs 切片内存布局 ===

数组信息：
  类型：[5]i32
  大小：20 字节
  元素数量：5
  地址：{ 1, 2, 3, 4, 5 }

切片信息：
  类型：[]i32
  大小：16 字节（胖指针）
  长度：3
  指针：i32@16fc124d8
  数据地址：i32@16fc124d8

内存关系：
  数组起始地址：i32@16fc124d4
  切片起始地址：i32@16fc124d8（偏移 1 个元素）
  地址差：4 字节 = 1 个元素
```

**关键要点**：
1. **数组是值类型**：整个数组存储在栈上，大小固定
2. **切片是引用类型**：只存储指针和长度，引用底层数组
3. **切片更灵活**：可以动态创建、传递，不受固定大小限制
4. **数组更高效**：直接访问，无间接寻址开销
5. **选择建议**：函数参数用切片，局部变量用数组（如果大小已知）

##### 切片的实际应用

```zig
// 场景1：函数参数（避免复制大数组）
fn sumSlice(numbers: []const i32) i32 {
    var total: i32 = 0;
    for (numbers) |num| {
        total += num;
    }
    return total;
}

// 场景2：动态数据处理
fn processData(data: []u8) void {
    // 处理任意长度的数据
    for (data) |*byte| {
        byte.* = byte.* ^ 0xFF; // 简单的异或加密
    }
}

// 场景3：字符串处理
fn findSubstring(text: []const u8, pattern: []const u8) ?usize {
    if (pattern.len > text.len) return null;
    
    for (0..text.len - pattern.len + 1) |i| {
        if (std.mem.eql(u8, text[i..i+pattern.len], pattern)) {
            return i;
        }
    }
    return null;
}
```

##### 数组 vs 切片：选择指南

| 场景           | 推荐使用 | 原因                 |
| -------------- | -------- | -------------------- |
| 编译期已知大小 | 数组     | 性能更好，编译期检查 |
| 函数参数       | 切片     | 灵活，避免复制       |
| 返回值         | 切片     | 可以返回部分数据     |
| 全局常量       | 数组     | 存储在静态内存       |
| 动态大小       | 切片     | 唯一选择             |

##### 哨兵终止数组（Sentinel-Terminated Array）

###### 什么是哨兵终止数组？

哨兵终止数组是一种特殊的数组类型，它在数组末尾添加一个特殊的"哨兵值"（sentinel value）来标记数组的结束。这是 C 语言字符串的经典实现方式。

###### 为什么需要哨兵终止数组？

1. **C 语言兼容性**：C 字符串以 null（0）结尾，哨兵数组可以直接与 C 代码互操作
2. **无需存储长度**：通过哨兵值判断结束，不需要单独存储长度信息
3. **历史兼容**：许多系统 API 使用哨兵终止字符串

###### 语法说明

- `[N:T]`：长度为 N，哨兵值为 T 的数组
- `[:T]`：未知长度，哨兵值为 T 的切片
- 最常见的：`[:0]const u8` - C 风格字符串

Zig 支持一种特殊的数组类型，以哨兵值结尾，常用于 C 字符串兼容：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 哨兵终止数组：以 0 结尾的数组
    // 类型 [5:0]u8 表示：5个元素，哨兵值为0
    const message: [5:0]u8 = "hello".*;

    std.debug.print("消息：{s}\n", .{&message});
    std.debug.print("长度（不含哨兵）：{}\n", .{message.len});
    std.debug.print("哨兵位置：{}\n", .{message.len}); // 哨兵在 index 5

    // 遍历：注意哨兵值不包含在 len 中
    for (message, 0..) |byte, index| {
        std.debug.print("[{}] = {c} ({})\n", .{ index, byte, byte });
    }

    // 转换为字符串切片（自动识别哨兵）
    const str: [:0]const u8 = &message;
    std.debug.print("字符串切片长度：{}\n", .{str.len});
    
    // 实际应用：与 C 函数互操作
    // 可以直接传递给期望 const char* 的 C 函数
    // c_printf("%s\n", message.ptr);
}
```

###### 哨兵终止数组 vs 普通数组

| 特性     | 普通数组 `[N]T` | 哨兵数组 `[N:S]T`    |
| -------- | --------------- | -------------------- |
| 长度信息 | 编译期已知      | 编译期已知           |
| 内存布局 | N 个元素        | N+1 个元素（含哨兵） |
| C 兼容性 | 需要转换        | 直接兼容             |
| 安全性   | 更安全          | 需要确保哨兵存在     |

###### 实际应用场景

```zig
// 场景1：调用 C 标准库函数
extern "c" fn puts(s: [*:0]const u8) c_int;

pub fn callCFunction() void {
    const message = "Hello from Zig";
    _ = puts(message.ptr); // 直接传递
}

// 场景2：系统调用
const std = @import("std");

pub fn openFile(path: [:0]const u8) !std.fs.File {
    // 许多系统 API 需要哨兵终止字符串
    return std.fs.cwd().openFile(path, .{});
}
```

###### 注意事项

1. **哨兵值不在 `len` 中**：`message.len` 返回 5，但实际占用 6 字节
2. **访问哨兵**：`message[message.len]` 返回哨兵值 0
3. **编译期检查**：Zig 会确保哨兵值正确设置

**多维数组与哨兵结合：**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 字符串数组（每个字符串以 0 结尾）
    const names: [3][:0]const u8 = .{ "Alice", "Bob", "Charlie" };

    for (names, 0..) |name, i| {
        std.debug.print("名字 {}：{s}\n", .{ i, name });
    }
}
```

#### 枚举（enum）

##### 什么是枚举？

枚举（Enumeration）是一种用户定义的类型，它由一组命名的整数值组成。枚举用于表示一组相关的常量值，使代码更具可读性和类型安全性。

##### 为什么使用枚举？

1. **类型安全**：编译器确保只使用有效的枚举值
2. **代码可读性**：使用有意义的名称代替魔法数字
3. **穷尽性检查**：switch 语句必须处理所有枚举值
4. **命名空间**：枚举值在枚举类型的命名空间内，避免冲突

##### Zig 枚举的独特之处

与其他语言不同，Zig 的枚举：
- 可以指定底层整数类型
- 可以包含方法
- 支持编译期计算
- 与 C 枚举完全兼容

枚举用于定义一组命名的整数值：

```zig
const std = @import("std");

// 基本枚举
// 默认情况下，枚举值从 0 开始自动编号
const Color = enum {
    red,    // 值为 0
    green,  // 值为 1
    blue,   // 值为 2
};

pub fn main(init: std.process.Init.Minimal) void {
    // 枚举字面量：使用 .语法
    const color: Color = .red;

    // switch 处理枚举：必须穷尽所有情况
    const color_name = switch (color) {
        .red => "红色",
        .green => "绿色",
        .blue => "蓝色",
    };
    std.debug.print("颜色：{s}\n", .{color_name});

    // 获取枚举的序数值（整数表示）
    std.debug.print("序值：{}\n", .{@intFromEnum(color)});
    
    // 从整数创建枚举
    const green_value: Color = @enumFromInt(1);
    std.debug.print("从整数创建：{}\n", .{green_value});
}
```

**带整数类型的枚举：**

##### 为什么指定整数类型？

1. **与 C 互操作**：匹配 C 枚举的大小
2. **内存优化**：使用更小的整数类型节省空间
3. **协议兼容**：匹配特定的协议或文件格式
4. **明确值**：为枚举值指定明确的数字

```zig
const std = @import("std");

// 指定底层类型为 u8
const Priority = enum(u8) {
    low = 1,      // 明确指定值
    medium = 5,
    high = 10,
    critical = 20,
};

pub fn main(init: std.process.Init.Minimal) void {
    const p: Priority = .high;
    
    // 获取枚举名称（字符串）
    std.debug.print("优先级：{s}，值：{}\n", .{ @tagName(p), @intFromEnum(p) });

    // 枚举字面量
    const default_priority: Priority = .medium;
    std.debug.print("默认优先级值：{}\n", .{@intFromEnum(default_priority)});
    
    // 实际应用：与 C 代码互操作
    // C 代码：enum { LOW = 1, MEDIUM = 5, HIGH = 10, CRITICAL = 20 };
    // Zig 可以直接使用相同的值
}
```

**枚举方法：**

##### 枚举方法的强大之处

Zig 允许在枚举中定义方法，这使得枚举不仅是数据，还包含行为：

```zig
const std = @import("std");

// 带方法的枚举：封装数据和行为
const Direction = enum(u4) {
    north = 0,
    east = 1,
    south = 2,
    west = 3,

    // 实例方法：第一个参数是 self
    fn toString(self: Direction) []const u8 {
        return switch (self) {
            .north => "北",
            .east => "东",
            .south => "南",
            .west => "西",
        };
    }

    // 方法可以返回枚举类型
    fn opposite(self: Direction) Direction {
        return switch (self) {
            .north => .south,
            .east => .west,
            .south => .north,
            .west => .east,
        };
    }
    
    // 关联函数：无 self 参数
    fn allDirections() [4]Direction {
        return .{ .north, .east, .south, .west };
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    const dir: Direction = .north;
    
    // 调用枚举方法
    std.debug.print("方向：{s}\n", .{dir.toString()});
    std.debug.print("相反方向：{s}\n", .{dir.opposite().toString()});
    
    // 调用关联函数
    const all = Direction.allDirections();
    std.debug.print("所有方向数量：{}\n", .{all.len});
}
```

##### 枚举的实际应用场景

```zig
// 场景1：状态机
const State = enum {
    idle,
    running,
    paused,
    stopped,
    
    fn canTransitionTo(self: State, next: State) bool {
        return switch (self) {
            .idle => next == .running,
            .running => next == .paused or next == .stopped,
            .paused => next == .running or next == .stopped,
            .stopped => next == .idle,
        };
    }
}

// 场景2：配置选项
const Config = enum {
    debug,
    release,
    release_safe,
    release_small,
    
    fn optimizeLevel(self: Config) u8 {
        return switch (self) {
            .debug => 0,
            .release, .release_safe => 3,
            .release_small => 2,
        };
    }
}

// 场景3：错误类型
const NetworkError = enum {
    timeout,
    connection_refused,
    dns_failure,
    
    fn description(self: NetworkError) []const u8 {
        return switch (self) {
            .timeout => "连接超时",
            .connection_refused => "连接被拒绝",
            .dns_failure => "DNS 解析失败",
        };
    }
}
```

##### 枚举最佳实践

1. **使用有意义的名称**：`user_active` 而不是 `state1`
2. **添加方法**：将相关逻辑封装在枚举中
3. **穷尽 switch**：利用编译器检查所有情况
4. **文档注释**：为枚举和枚举值添加说明
```

## 联合（union）和带标签联合（tagged union）

## 什么是联合（Union）？

联合（Union）是一种特殊的数据类型，它允许在同一内存位置存储不同类型的数据。联合的所有成员共享同一块内存，因此联合的大小等于其最大成员的大小。

## 为什么需要联合？

1. **内存效率**：多个数据类型共享同一内存空间，节省内存
2. **类型转换**：可以安全地在不同类型之间重解释内存
3. **多态实现**：带标签联合是实现多态的基础
4. **C 兼容性**：与 C 语言的 union 完全兼容

## Zig 联合的安全性

与 C 语言不同，Zig 的联合设计注重安全性：

| 特性       | C 语言               | Zig                  |
| ---------- | -------------------- | -------------------- |
| 类型安全   | 无（可访问任何成员） | 有（带标签联合）     |
| 内存布局   | 未定义               | 明确（extern union） |
| 运行时检查 | 无                   | 有（带标签联合）     |
| 初始化     | 可能不安全           | 必须初始化一个成员   |

**普通联合：**

## 普通联合的核心概念

普通联合（untagged union）是最基础的联合类型，所有成员共享同一内存：

- **内存共享**：所有成员占用同一块内存
- **大小计算**：联合大小 = max(成员大小)
- **访问规则**：只能访问最后写入的成员（否则是未定义行为）

```zig
const std = @import("std");

// extern union：与 C 语言兼容的内存布局
const Data = extern union {
    as_i32: i32,
    as_f32: f32,
    as_bytes: [4]u8,
};

pub fn main(init: std.process.Init.Minimal) void {
    // 初始化联合：必须指定一个成员
    var data: Data = .{ .as_i32 = 0x41424344 }; // "DCBA" in little-endian

    // 访问不同成员：它们共享同一内存
    std.debug.print("as_i32: {}\n", .{data.as_i32});
    std.debug.print("as_f32: {}\n", .{data.as_f32});
    std.debug.print("as_bytes: {s}\n", .{data.as_bytes});
    
    // 内存布局演示
    std.debug.print("联合大小: {} 字节\n", .{@sizeOf(Data)});
    // 输出: 4 字节（所有成员都是 4 字节）
}
```

## 普通联合的实际应用

```zig
// 场景1：网络协议解析
const Packet = extern union {
    header: struct { version: u8, type: u8, length: u16 },
    raw: [4]u8,
};

// 场景2：硬件寄存器访问
const Register = extern union {
    value: u32,
    bits: packed struct {
        bit0: u1,
        bit1: u1,
        bit2: u1,
        bit3: u1,
        reserved: u4,
        high_bits: u24,
    },
};
```

**带标签联合（Tagged Union）：**

## 什么是带标签联合？

带标签联合（Tagged Union）是联合和枚举的结合体。它在联合中添加一个"标签"（tag），用于标识当前存储的是哪种类型的值。这是 Zig 中实现安全多态的核心机制。

## 为什么使用带标签联合？

1. **类型安全**：编译器和运行时都知道当前存储的类型
2. **模式匹配**：switch 可以穷尽所有可能的情况
3. **多态实现**：实现类似面向对象的"多态"
4. **内存效率**：比接口/继承更高效

带标签联合结合了枚举和联合的功能，是 Zig 中实现多态的重要方式：

```zig
const std = @import("std");

// 带标签联合：值可以是多种类型之一
const Shape = union(enum) {
    circle: struct { radius: f32 },
    rectangle: struct { width: f32, height: f32 },
    triangle: struct { base: f32, height: f32 },

    fn area(self: Shape) f32 {
        return switch (self) {
            .circle => |c| std.math.pi * c.radius * c.radius,
            .rectangle => |r| r.width * r.height,
            .triangle => |t| t.base * t.height * 0.5,
        };
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    var shapes: [3]Shape = .{
        Shape{ .circle = .{ .radius = 1.0 } },
        Shape{ .rectangle = .{ .width = 3.0, .height = 4.0 } },
        Shape{ .triangle = .{ .base = 6.0, .height = 4.0 } },
    };

    for (shapes, 0..) |shape, i| {
        std.debug.print("形状 {} 面积：{:.2}\n", .{ i, shape.area() });
    }
}
```

**带标签联合的方法：**

## 为什么带标签联合可以有方法？

带标签联合可以包含方法，这使其不仅是数据容器，还包含行为。方法内部通过 switch 来处理不同的变体，实现类型安全的操作。

```zig
const std = @import("std");

// 带标签联合：实现动态类型的值
const Value = union(enum) {
    integer: i64,
    float: f64,
    boolean: bool,
    string: []const u8,

    // 方法：根据当前类型返回描述
    fn describe(self: Value) []const u8 {
        // switch 自动匹配当前变体
        return switch (self) {
            .integer => "整数",
            .float => "浮点数",
            .boolean => "布尔值",
            .string => "字符串",
        };
    }
    
    // 方法：类型转换
    fn toInt(self: Value) ?i64 {
        return switch (self) {
            .integer => |v| v,
            .float => |v| @intFromFloat(v),
            .boolean => |v| if (v) 1 else 0,
            .string => null,
        };
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    // 创建不同类型的值
    const values: [4]Value = .{
        Value{ .integer = 42 },
        Value{ .float = 3.14 },
        Value{ .boolean = true },
        Value{ .string = "hello" },
    };

    // 遍历并处理每个值
    for (values) |val| {
        std.debug.print("{s} = ", .{val.describe()});
        // 使用 switch 处理不同类型
        switch (val) {
            .integer => |v| std.debug.print("{}\n", .{v}),
            .float => |v| std.debug.print("{}\n", .{v}),
            .boolean => |v| std.debug.print("{}\n", .{v}),
            .string => |v| std.debug.print("{s}\n", .{v}),
        }
    }
}
```

## 带标签联合的实际应用场景

```zig
// 场景1：JSON 值类型
const JsonValue = union(enum) {
    null: void,
    boolean: bool,
    number: f64,
    string: []const u8,
    array: []JsonValue,
    object: std.StringHashMap(JsonValue),
};

// 场景2：AST 节点
const AstNode = union(enum) {
    number: struct { value: f64 },
    binary_op: struct { op: Op, left: *AstNode, right: *AstNode },
    variable: []const u8,
};

// 场景3：网络消息
const Message = union(enum) {
    connect: struct { client_id: u32 },
    disconnect: struct { reason: []const u8 },
    data: []const u8,
    heartbeat: void,
};
```

**可空枚举和 switch：**

## 可空枚举的使用场景

可空枚举（`?Enum`）用于表示枚举值可能不存在的情况，这在处理可选状态时非常有用：

```zig
const std = @import("std");

const Status = enum {
    pending,
    running,
    completed,
    failed,
};

// 返回可选枚举值的函数
fn getStatus() ?Status {
    // 可能返回 null，表示状态未知
    return .running;
}

pub fn main(init: std.process.Init.Minimal) void {
    const status = getStatus();

    // 处理可空枚举：先解包，再 switch
    if (status) |s| {
        // s 是 Status 类型，不是 ?Status
        switch (s) {
            .pending => std.debug.print("待处理\n", .{}),
            .running => std.debug.print("运行中\n", .{}),
            .completed => std.debug.print("已完成\n", .{}),
            .failed => std.debug.print("失败\n", .{}),
        }
    } else {
        std.debug.print("状态未知\n", .{});
    }
    
    // 使用 orelse 提供默认值
    const s = status orelse .pending;
}
```

## 最佳实践

1. **优先使用带标签联合**：比普通联合更安全
2. **穷尽 switch**：让编译器帮助检查所有情况
3. **添加方法**：将相关逻辑封装在联合中
4. **文档注释**：说明每个变体的用途

## 联合的高级特性

**编译时初始化联合**：

## 什么是 @unionInit？

`@unionInit` 是一个编译时内置函数，用于在编译期初始化联合。它比普通的初始化语法更灵活，特别是在泛型代码中。

> 📖 **相关章节**：更多编译期技巧请参考[编译期计算与元编程](../part2-advanced/chapter-comptime.md)和[泛型编程](../part2-advanced/chapter-generics.md)。

## 为什么使用 @unionInit？

1. **编译期初始化**：在编译时确定联合的值
2. **泛型代码**：字段名可以是编译期变量
3. **动态选择**：根据条件选择不同的变体

使用 `@unionInit` 可以在编译时初始化联合：

```zig
const std = @import("std");

// 普通联合（非带标签）
const MyUnion = union {
    int: i32,
    float: f64,
    string: []const u8,
};

pub fn main(init: std.process.Init.Minimal) void {
    // 普通语法初始化
    const u1 = MyUnion{ .int = 42 };
    
    // 使用 @unionInit 初始化
    // 参数：联合类型、字段名（编译期字符串）、值
    const u2 = @unionInit(MyUnion, "float", 3.14);
    const u3 = @unionInit(MyUnion, "string", "hello");
    
    std.debug.print("u1: {}\n", .{u1.int});
    std.debug.print("u2: {}\n", .{u2.float});
    std.debug.print("u3: {s}\n", .{u3.string});
}
```

## @unionInit 的实际应用

```zig
// 在泛型代码中使用
fn initUnion(comptime T: type, comptime field: []const u8, value: anytype) MyUnion {
    return @unionInit(MyUnion, field, value);
}

// 根据运行时条件选择编译期字段
fn createValue(is_int: bool) MyUnion {
    if (is_int) {
        return @unionInit(MyUnion, "int", 42);
    } else {
        return @unionInit(MyUnion, "float", 3.14);
    }
}
```

**匿名标记联合**：

## 什么是匿名标记联合？

匿名标记联合使用 `union(enum)` 语法定义，枚举标签由编译器自动生成。这是定义带标签联合最简洁的方式。

定义联合时直接使用 `union(enum)` 创建匿名标记联合：

```zig
const std = @import("std");

// 匿名标记联合：编译器自动生成枚举标签
const Value = union(enum) {
    int: i32,
    float: f64,
    string: []const u8,
    none, // 无数据的变体（void 类型）
    
    fn describe(self: Value) []const u8 {
        return switch (self) {
            .int => "整数",
            .float => "浮点数",
            .string => "字符串",
            .none => "无值",
        };
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    // 创建不同类型的值
    const v1 = Value{ .int = 42 };
    const v2 = Value{ .float = 3.14 };
    const v3 = Value{ .string = "hello" };
    const v4 = Value.none;  // 无数据变体直接使用
    
    std.debug.print("v1: {s}\n", .{v1.describe()});
    std.debug.print("v2: {s}\n", .{v2.describe()});
    std.debug.print("v3: {s}\n", .{v3.describe()});
    std.debug.print("v4: {s}\n", .{v4.describe()});
}
```

**获取联合的标签名**：

## 什么是 @tagName？

`@tagName` 是一个内置函数，用于获取带标签联合当前变体的名称字符串。这在日志记录、调试和序列化时非常有用。

使用 `@tagName` 获取当前联合变体的名称：

```zig
const std = @import("std");

const Result = union(enum) {
    success: i32,
    failure: []const u8,
};

pub fn main(init: std.process.Init.Minimal) void {
    const r1 = Result{ .success = 100 };
    const r2 = Result{ .failure = "连接失败" };
    
    // 获取标签名：返回编译期字符串
    std.debug.print("r1 标签: {s}\n", .{@tagName(r1)}); // 输出: success
    std.debug.print("r2 标签: {s}\n", .{@tagName(r2)}); // 输出: failure
    
    // 在 switch 中使用
    switch (r1) {
        .success => |value| std.debug.print("成功: {}\n", .{value}),
        .failure => |msg| std.debug.print("失败: {s}\n", .{msg}),
    }
}
```

## @tagName 的实际应用

```zig
// 场景1：日志记录
fn logResult(result: Result) void {
    std.log.info("Result type: {s}", .{@tagName(result)});
}

// 场景2：序列化
fn serialize(result: Result, writer: anytype) !void {
    try writer.print("{{\"type\":\"{s}\",", .{@tagName(result)});
    switch (result) {
        .success => |v| try writer.print("\"value\":{}}}", .{v}),
        .failure => |m| try writer.print("\"message\":\"{s}\"}}", .{m}),
    }
}

// 场景3：调试输出
fn debugValue(val: Value) void {
    std.debug.print("Value({s}): ", .{@tagName(val)});
    switch (val) {
        .int => |v| std.debug.print("{}\n", .{v}),
        .float => |v| std.debug.print("{}\n", .{v}),
        .string => |v| std.debug.print("{s}\n", .{v}),
        .none => std.debug.print("(none)\n", .{}),
    }
}
```

---

## 结构体（struct）

## 什么是结构体？

结构体（Struct）是 Zig 中定义复合类型的主要方式，它将多个相关的数据字段组合成一个单一的逻辑单元。结构体可以包含字段（数据）和方法（行为），是 Zig 程序组织代码的基础构建块。

## 为什么需要结构体？

1. **数据封装**：将相关的数据组合在一起，提高代码可读性
2. **类型抽象**：创建自定义类型，表达业务领域概念
3. **代码复用**：通过方法实现行为的复用
4. **内存控制**：精确控制数据的内存布局

## Zig 结构体的特点

| 特性           | 说明                                   |
| -------------- | -------------------------------------- |
| 字段默认不可变 | 字段默认是 `const`，需要修改时使用指针 |
| 支持方法       | 可以定义实例方法和关联函数             |
| 编译期泛型     | 使用 `comptime` 参数实现泛型           |
| 多种布局       | 支持 `packed`、`extern` 等布局方式     |
| 零成本抽象     | 编译期展开，无运行时开销               |

**基本结构体：**

## 结构体的核心概念

结构体由字段和方法组成：

- **字段**：存储数据的变量，可以有默认值
- **方法**：带有 `self` 参数的函数
- **关联函数**：不带 `self` 参数的函数（类似静态方法）

```zig
const std = @import("std");

// 定义结构体：使用 struct 关键字
const Point = struct {
    x: f32,
    y: f32,
};

// 带方法的结构体
const Rectangle = struct {
    width: f32,
    height: f32,

    // 实例方法：第一个参数是 self
    // self 是值类型，方法内不能修改
    fn area(self: Rectangle) f32 {
        return self.width * self.height;
    }

    // 修改自身的方法：需要指针参数
    // 使用 *Rectangle 表示可变指针
    fn scale(self: *Rectangle, factor: f32) void {
        self.width *= factor;
        self.height *= factor;
    }

    // 关联函数（无 self 参数）
    // 类似其他语言的静态方法/构造函数
    fn square(size: f32) Rectangle {
        return Rectangle{
            .width = size,
            .height = size,
        };
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    // 创建结构体实例：使用 .{} 语法
    var rect = Rectangle{
        .width = 10.0,
        .height = 5.0,
    };

    // 调用方法
    std.debug.print("面积: {d:.2}\n", .{rect.area()});

    // 修改结构体：通过指针方法
    rect.scale(2.0);
    std.debug.print("放大后面积: {d:.2}\n", .{rect.area()});

    // 使用关联函数创建实例
    const sq = Rectangle.square(4.0);
    std.debug.print("正方形面积: {d:.2}\n", .{sq.area()});
}
```

## 结构体的实际应用场景

```zig
// 场景1：配置管理
const Config = struct {
    host: []const u8 = "localhost",
    port: u16 = 8080,
    max_connections: usize = 100,
    
    fn loadFromFile(path: []const u8) !Config {
        // 从文件加载配置
        return Config{};
    }
};

// 场景2：状态机
const StateMachine = struct {
    state: State,
    data: []u8,
    
    const State = enum { idle, running, paused };
    
    fn transition(self: *StateMachine, new_state: State) void {
        self.state = new_state;
    }
};

// 场景3：资源管理
const File = struct {
    handle: ?std.fs.File,
    path: []const u8,
    
    fn open(path: []const u8) !File {
        return File{
            .handle = try std.fs.cwd().openFile(path, .{}),
            .path = path,
        };
    }
    
    fn close(self: *File) void {
        if (self.handle) |h| {
            h.close();
            self.handle = null;
        }
    }
};
```

**泛型结构体：**

## 什么是泛型结构体？

泛型结构体允许创建类型参数化的结构体，在编译时生成具体类型。Zig 使用 `comptime` 参数实现泛型，这是一种编译期多态。

> 📖 **相关章节**：更多泛型编程技巧请参考[泛型编程](../part2-advanced/chapter-generics.md)，编译期计算的深入讲解请参考[编译期计算与元编程](../part2-advanced/chapter-comptime.md)。

## 为什么使用泛型？

1. **代码复用**：同一套代码适用于多种类型
2. **类型安全**：编译期检查，避免运行时错误
3. **性能优化**：编译期特化，无运行时开销

```zig
const std = @import("std");

// 使用 comptime 参数创建泛型结构体
// 这是一个返回结构体类型的函数
fn Vector(comptime T: type) type {
    return struct {
        x: T,
        y: T,
        z: T,

        // 使用 @This() 获取当前类型
        const Self = @This();

        // 泛型方法
        fn add(self: Self, other: Self) Self {
            return Self{
                .x = self.x + other.x,
                .y = self.y + other.y,
                .z = self.z + other.z,
            };
        }

        fn dot(self: Self, other: Self) T {
            return self.x * other.x + self.y * other.y + self.z * other.z;
        }
    };
}

pub fn main(init: std.process.Init.Minimal) void {
    // 创建 f32 类型的向量
    // Vector(f32) 在编译时生成具体类型
    const Vec3f = Vector(f32);
    const v1 = Vec3f{ .x = 1.0, .y = 2.0, .z = 3.0 };
    const v2 = Vec3f{ .x = 4.0, .y = 5.0, .z = 6.0 };

    const v3 = v1.add(v2);
    std.debug.print("v1 + v2 = ({d:.1}, {d:.1}, {d:.1})\n", .{ v3.x, v3.y, v3.z });
    std.debug.print("v1 · v2 = {d:.1}\n", .{v1.dot(v2)});

    // 创建 i32 类型的向量
    // Vector(i32) 生成另一个具体类型
    const Vec3i = Vector(i32);
    const vi1 = Vec3i{ .x = 1, .y = 2, .z = 3 };
    const vi2 = Vec3i{ .x = 4, .y = 5, .z = 6 };
    std.debug.print("整数向量点积: {d}\n", .{vi1.dot(vi2)});
}
```

**嵌套结构体：**

## 什么是嵌套结构体？

嵌套结构体是指一个结构体包含另一个结构体作为字段，用于表达复杂的数据层次关系。

```zig
const std = @import("std");

// 内层结构体
const Address = struct {
    street: []const u8,
    city: []const u8,
    zip_code: []const u8,
};

// 外层结构体：包含 Address 类型的字段
const Person = struct {
    name: []const u8,
    age: u32,
    address: Address,  // 嵌套结构体

    fn describe(self: Person) void {
        std.debug.print("{s}, {d} 岁\n", .{ self.name, self.age });
        std.debug.print("地址: {s}, {s}, {s}\n", .{
            self.address.street,
            self.address.city,
            self.address.zip_code,
        });
    }
};

pub fn main(init: std.process.Init.Minimal) void {
    // 创建嵌套结构体实例
    const person = Person{
        .name = "张三",
        .age = 30,
        .address = Address{
            .street = "中山路 123 号",
            .city = "北京",
            .zip_code = "100000",
        },
    };

    person.describe();
}
```

**结构体布局：**

## 为什么需要控制结构体布局？

不同的布局方式影响：
- **内存大小**：packed 结构体更紧凑
- **对齐方式**：影响访问效率和兼容性
- **C 兼容性**：extern 布局与 C 语言兼容

```zig
const std = @import("std");

// 默认布局（自动优化）
// 编译器会重新排列字段以优化对齐
const AutoLayout = struct {
    a: u8,   // 1 字节
    b: u32,  // 4 字节（需要 4 字节对齐）
    c: u16,  // 2 字节
    // 编译器可能会插入填充字节
};

// packed 布局：紧凑存储，无填充
// 字段按声明顺序紧密排列
const PackedStruct = packed struct {
    a: u8,   // 8 位
    b: u32,  // 32 位
    c: u16,  // 16 位
    // 总共 56 位 = 7 字节
};

// extern 布局：与 C 语言兼容
// 遵循 C 的 ABI 规则
const ExternStruct = extern struct {
    a: u8,
    b: u32,
    c: u16,
};

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("AutoLayout 大小: {} 字节\n", .{@sizeOf(AutoLayout)});
    std.debug.print("PackedStruct 大小: {} 字节\n", .{@sizeOf(PackedStruct)});
    std.debug.print("ExternStruct 大小: {} 字节\n", .{@sizeOf(ExternStruct)});
}
```

## 布局选择指南

| 布局类型 | 使用场景         | 特点                     |
| -------- | ---------------- | ------------------------ |
| 默认     | 大多数情况       | 编译器优化，可能重排字段 |
| packed   | 位操作、协议解析 | 紧凑存储，无填充         |
| extern   | 与 C 互操作      | 遵循 C ABI               |

## 匿名结构体与 @This

在泛型结构体中，可以使用 `@This()` 获取当前类型：

```zig
const std = @import("std");

// 泛型链表
fn List(comptime T: type) type {
    return struct {
        const Self = @This(); // 获取当前结构体类型
        
        items: []T,
        allocator: std.mem.Allocator,
        
        fn init(allocator: std.mem.Allocator) Self {
            return .{
                .items = &[_]T{},
                .allocator = allocator,
            };
        }
        
        fn deinit(self: *Self) void {
            self.allocator.free(self.items);
        }
        
        fn length(self: Self) usize {
            return self.items.len;
        }
        
        fn append(self: *Self, item: T) !void {
            const new_items = try self.allocator.realloc(self.items, self.items.len + 1);
            new_items[new_items.len - 1] = item;
            self.items = new_items;
        }
    };
}

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    
    var int_list = List(i32).init(gpa.allocator());
    defer int_list.deinit();
    
    try int_list.append(10);
    try int_list.append(20);
    
    std.debug.print("列表长度: {}\n", .{int_list.length()});
}
```

## 结果位置语义

Zig 的"结果位置语义"允许在类型可推断时简写结构体初始化：

```zig
const std = @import("std");

const Point = struct {
    x: f32,
    y: f32,
};

const Rectangle = struct {
    top_left: Point,
    bottom_right: Point,
};

pub fn main(init: std.process.Init.Minimal) void {
    // 完整写法
    const p1 = Point{ .x = 1.0, .y = 2.0 };
    
    // 结果位置语义：类型已知时可以省略类型名
    const p2: Point = .{ .x = 3.0, .y = 4.0 };
    
    // 函数参数中的简写
    fn printPoint(p: Point) void {
        std.debug.print("Point({}, {})\n", .{ p.x, p.y });
    }
    
    printPoint(.{ .x = 5.0, .y = 6.0 });
    
    // 嵌套结构体的简写
    const rect: Rectangle = .{
        .top_left = .{ .x = 0.0, .y = 0.0 },
        .bottom_right = .{ .x = 10.0, .y = 10.0 },
    };
    
    std.debug.print("矩形: ({}, {}) 到 ({}, {})\n", .{
        rect.top_left.x,
        rect.top_left.y,
        rect.bottom_right.x,
        rect.bottom_right.y,
    });
}
```

## 字段默认值

结构体字段可以定义默认值：

```zig
const std = @import("std");

const Config = struct {
    host: []const u8 = "localhost",
    port: u16 = 8080,
    timeout: u32 = 30,
    debug: bool = false,
};

// 默认值常量模式
const Threshold = struct {
    minimum: f32,
    maximum: f32,
    
    // 定义默认实例
    const default: Threshold = .{
        .minimum = 0.25,
        .maximum = 0.75,
    };
};

pub fn main(init: std.process.Init.Minimal) void {
    // 使用部分默认值
    const cfg1 = Config{
        .host = "example.com",
        // port, timeout, debug 使用默认值
    };
    
    std.debug.print("配置: {s}:{}\n", .{ cfg1.host, cfg1.port });
    
    // 全部使用默认值
    const cfg2 = Config{};
    std.debug.print("默认端口: {}\n", .{cfg2.port});
    
    // 使用默认实例
    const threshold: Threshold = .default;
    std.debug.print("阈值范围: {} - {}\n", .{ threshold.minimum, threshold.maximum });
}
```

## 从字段指针获取结构体指针

使用 `@fieldParentPtr` 可以从字段的指针反推出整个结构体的指针：

> 📖 **深入学习**：这是指针操作的高级技巧，[指针与引用类型](../part2-advanced/chapter-pointers.md)将详细讲解指针的各种操作和安全使用方法。

```zig
const std = @import("std");

const Creature = struct {
    health: f32,
    mana: u32,
    stamina: u32,
};

fn boostMana(mana_ptr: *u32, amount: u32) void {
    // 从 mana 字段的指针，反推出整个 Creature 的指针
    const creature_ptr: *Creature = @fieldParentPtr("mana", mana_ptr);
    creature_ptr.mana += amount;
    
    // 也可以修改其他字段
    creature_ptr.health -= 1.0;
}

pub fn main(init: std.process.Init.Minimal) void {
    var elf = Creature{
        .health = 150.0,
        .mana = 10,
        .stamina = 100,
    };
    
    std.debug.print("强化前 - 生命: {}, 法力: {}\n", .{ elf.health, elf.mana });
    
    boostMana(&elf.mana, 40);
    
    std.debug.print("强化后 - 生命: {}, 法力: {}\n", .{ elf.health, elf.mana });
}
```

**应用场景**：
- 实现侵入式数据结构（如链表、树）
- 回调函数中获取上下文
- 内存池管理

## 元组（Tuple）

## 什么是元组？

元组（Tuple）是一种特殊的匿名结构体，其字段没有名称，而是使用数字索引（0, 1, 2...）访问。元组可以包含不同类型的元素，是 Zig 中处理异构数据集合的轻量级方式。

## 为什么使用元组？

1. **临时数据组合**：不需要定义专门的结构体
2. **多返回值**：函数可以返回多个值
3. **类型安全**：编译期检查每个位置的元素类型
4. **简洁语法**：使用 `.{}` 快速创建

## 元组 vs 结构体 vs 数组

| 特性     | 元组               | 结构体         | 数组         |
| -------- | ------------------ | -------------- | ------------ |
| 字段访问 | 索引（0, 1, 2...） | 名称           | 索引         |
| 元素类型 | 可以不同           | 可以不同       | 必须相同     |
| 定义方式 | 匿名               | 命名类型       | 命名类型     |
| 适用场景 | 临时数据、多返回值 | 长期存储、复用 | 同类数据集合 |

## 基本用法

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 创建元组：使用 .{} 语法
    // 元组可以包含不同类型的元素
    const tuple = .{ 1, "hello", 3.14, true };
    
    // 访问元素（从 0 开始索引）
    std.debug.print("第一个元素: {}\n", .{tuple[0]});
    std.debug.print("第二个元素: {s}\n", .{tuple[1]});
    std.debug.print("第三个元素: {}\n", .{tuple[2]});
    
    // 获取元组长度：编译期已知
    std.debug.print("元组长度: {}\n", .{tuple.len});
    
    // 遍历元组：必须使用 inline for
    // 因为每个元素的类型可能不同
    inline for (tuple, 0..) |item, index| {
        std.debug.print("tuple[{}] = {}\n", .{ index, item });
    }
    
    // 元组类型：显示每个字段的类型
    const TupleType = @TypeOf(tuple);
    std.debug.print("元组类型: {}\n", .{TupleType});
}
```

## 元组的高级用法

```zig
const std = @import("std");

// 场景1：函数返回多个值
fn divide(a: i32, b: i32) ?struct { i32, i32 } {
    if (b == 0) return null;
    return .{ @divTrunc(a, b), @rem(a, b) };
}

pub fn main(init: std.process.Init.Minimal) void {
    // 场景2：解包赋值
    const coords = .{ 10, 20, 30 };
    const x, const y, const z = coords;
    std.debug.print("坐标: x={}, y={}, z={}\n", .{ x, y, z });
    
    // 场景3：元组作为函数参数
    const data = .{ "Alice", 30, true };
    printPerson(data);
}

// 元组作为函数参数
fn printPerson(person: anytype) void {
    const info = @typeInfo(@TypeOf(person));
    inline for (info.@"struct".fields, 0..) |field, i| {
        std.debug.print("[{}]: {}\n", .{ i, @field(person, field.name) });
    }
}
```

## 元组的特点

- 字段名是数字索引（0, 1, 2...）
- 可以包含不同类型的元素
- 常用于函数返回多个值
- 支持解包赋值
- 与结构体共享底层实现，只是字段名为数字

## 块表达式

在 Zig 中，块（Block）不仅是作用域，还可以作为表达式返回值。

## 基本概念

- **块是花括号包起来的作用域**
- **块可以是表达式**：可以返回值
- **块标签**：块开始处可以有标签，内部用 `break` 返回值

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 块作为表达式
    const result = blk: {
        const a = 10;
        const b = 20;
        break :blk a + b; // 使用 break 返回值
    };
    
    std.debug.print("块表达式结果: {}\n", .{result});
    
    // 带条件的块表达式
    const value: i32 = 15;
    const category = blk: {
        if (value < 10) {
            break :blk "小";
        } else if (value < 20) {
            break :blk "中";
        } else {
            break :blk "大";
        }
    };
    
    std.debug.print("值 {} 的类别: {s}\n", .{ value, category });
    
    // 嵌套块
    const nested = outer: {
        const inner = inner: {
            break :inner 5;
        };
        break :outer inner * 2;
    };
    
    std.debug.print("嵌套块结果: {}\n", .{nested});
}
```

**应用场景**：
- 复杂的初始化逻辑
- 避免创建临时变量
- 提高代码可读性

## 线程局部变量

Zig 支持线程局部存储（Thread-Local Storage, TLS），使用 `threadlocal` 关键字声明。

```zig
const std = @import("std");

// 线程局部变量：每个线程有独立的副本
threadlocal var counter: i32 = 0;

fn incrementCounter() void {
    counter += 1;
    std.debug.print("计数器值: {}\n", .{counter});
}

pub fn main(init: std.process.Init.Minimal) void {
    // 主线程
    incrementCounter(); // 输出: 1
    incrementCounter(); // 输出: 2
    
    // 注意：在多线程环境中，每个线程都有自己的 counter 副本
    // 这里仅演示语法，实际多线程示例见[并发编程模型](../part2-advanced/chapter-c-interop.md)
}
```

**特点**：
- 每个线程拥有独立的变量副本
- 避免多线程竞争
- 适用于线程特定的状态管理

**注意事项**：
- 线程局部变量的初始化在第一次访问时发生
- 需要平台支持 TLS
- 在单线程程序中，行为与普通全局变量相同

## 字符和字符串详解

## Unicode 码位字面量

单引号用于字符字面量，得到 Unicode 码位：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // ASCII 字符
    const letter = 'A';
    std.debug.print("字符: {c}, 码位: {}\n", .{ letter, letter });
    
    // Unicode 字符（中文）
    const me_zh = '我';
    std.debug.print("字符: {0u} = 码位: 0x{0x}\n", .{me_zh});
    // 输出: 我 = 0x6211
    
    // 表情符号
    const emoji = '☔';
    std.debug.print("表情: {0u}, 码位: 0x{0x}\n", .{emoji});
    
    // 类型是 comptime_int
    const char_value: comptime_int = 'Z';
    std.debug.print("comptime_int 值: {}\n", .{char_value});
}
```

## 字符串字面量

双引号用于字符串字面量，类型是 `*const [N:0]u8`（以 null 结尾的数组指针）：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const str = "Hello, Zig!";
    
    // 类型是 *const [12:0]u8
    std.debug.print("字符串: {s}\n", .{str});
    std.debug.print("长度（不含哨兵）: {}\n", .{str.len});
    
    // 字符串以 null 结尾（哨兵值）
    std.debug.print("哨兵值: {}\n", .{str[str.len]}); // 输出: 0
}
```

## 多行字符串字面量

多行字符串以 `\\` 开头，不执行任何转义，不包含最后一行的换行符：

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const multi_line =
        \\第一行
        \\第二行
        \\第三行
    ;
    
    std.debug.print("多行字符串:\n{s}\n", .{multi_line});
    
    // 包含特殊字符（无需转义）
    const code =
        \\fn main() void {
        \\    const x = "字符串";
        \\    std.debug.print("{s}\n", .{x});
        \\}
    ;
    
    std.debug.print("代码:\n{s}\n", .{code});
}
```

**特点**：
- 不处理转义序列
- 不包含最后的换行符
- 适合嵌入代码、JSON、XML 等文本

## 可选类型操作符

Zig 的可选类型（Optional）使用 `?T` 表示，提供了多种操作方式。

## 基本操作

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const maybe_number: ?i32 = 42;
    
    // 方式1：使用 if 解包
    if (maybe_number) |number| {
        std.debug.print("值: {}\n", .{number});
    } else {
        std.debug.print("null\n", .{});
    }
    
    // 方式2：使用 .? 操作符（如果是 null 则 panic）
    const value1 = maybe_number.?;
    std.debug.print(".? 操作符: {}\n", .{value1});
    
    // 方式3：使用 orelse 提供默认值
    const maybe_null: ?i32 = null;
    const value2 = maybe_null orelse 0;
    std.debug.print("orelse 默认值: {}\n", .{value2});
    
    // orelse 可以接表达式
    const value3 = maybe_null orelse {
        std.debug.print("遇到 null，计算默认值\n", .{});
        break :blk 100;
    };
    std.debug.print("orelse 表达式: {}\n", .{value3});
}
```

## orelse 与 .? 的区别

```zig
const std = @import("std");

fn riskyOperation() ?i32 {
    return null;
}

pub fn main(init: std.process.Init.Minimal) void {
    // 使用 .? - 如果为 null 会 panic
    // const bad = riskyOperation().?; // 运行时错误：attempt to use null value
    
    // 使用 orelse - 安全地处理 null
    const safe = riskyOperation() orelse {
        std.debug.print("操作返回 null，使用默认值\n", .{});
        return;
    };
    
    std.debug.print("值: {}\n", .{safe});
}
```

**最佳实践**：
- **使用 `if`**：需要区分 null 和非 null 的逻辑
- **使用 `.?`**：确定值不为 null，否则是编程错误
- **使用 `orelse`**：需要为 null 提供合理的默认值

## 可选类型与错误联合类型的关联

可选类型 `?T` 和错误联合类型 `!T` 都用于表示"可能失败"的值，但用途不同：

| 类型 | 含义               | 使用场景           |
| ---- | ------------------ | ------------------ |
| `?T` | 值可能存在或不存在 | 查找操作、可选配置 |
| `!T` | 操作可能成功或失败 | 可能出错的操作     |

```zig
// 可选类型：查找操作可能找不到结果
// ❌ 错误示例
fn findUser(id: u32) ?User {
    if (database.has(id)) {
        return database.get(id);
    }
    return null; // 找不到是正常情况
}

// 错误联合类型：操作可能失败
fn readFile(path: []const u8) ![]u8 {
    if (!fileExists(path)) {
        return error.FileNotFound; // 失败是错误情况
    }
    // ...
}
```

> 📖 **深入学习**：错误联合类型的详细用法将在[错误处理基础](chapter-error-handling.md)中讲解。

---

## 章节练习题

## 基础题

**题目1**：编写一个程序，计算 1 到 100 的和。

**要求**：
- 使用变量声明和基本运算
- 输出最终结果
- 预期输出：5050

**解题思路**：
1. 使用 `var` 声明可变变量 `sum` 存储累加结果
2. 使用循环遍历 1 到 100
3. 在循环中累加每个数字
4. 最后输出结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var sum: u32 = 0;
    var i: u32 = 1;
    
    while (i <= 100) : (i += 1) {
        sum += i;
    }
    
    std.debug.print("1 到 100 的和：{}\n", .{sum});
}
```

**预期输出**：
```
1 到 100 的和：5050
```

**题目2**：编写一个程序，演示不同整数类型的范围和溢出行为。

**要求**：
- 声明 `u8`、`i8`、`u16`、`i16` 类型的变量
- 输出每种类型的最大值和最小值
- 演示溢出时的行为（使用 `@wrappingAdd` 等操作）

**解题思路**：
1. 使用 `std.math.maxInt` 和 `std.math.minInt` 获取范围
2. 使用 `@wrappingAdd` 进行溢出安全的加法
3. 观察溢出后的结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("=== 整数类型范围演示 ===\n\n", .{});
    
    std.debug.print("u8 范围：{} 到 {}\n", .{
        std.math.minInt(u8),
        std.math.maxInt(u8),
    });
    
    std.debug.print("i8 范围：{} 到 {}\n", .{
        std.math.minInt(i8),
        std.math.maxInt(i8),
    });
    
    std.debug.print("u16 范围：{} 到 {}\n", .{
        std.math.minInt(u16),
        std.math.maxInt(u16),
    });
    
    std.debug.print("i16 范围：{} 到 {}\n\n", .{
        std.math.minInt(i16),
        std.math.maxInt(i16),
    });
    
    std.debug.print("=== 溢出行为演示 ===\n", .{});
    var a: u8 = 255;
    std.debug.print("u8 最大值：{}\n", .{a});
    const overflow_result = @addWithOverflow(a, 1);
    std.debug.print("255 + 1 (溢出) = {}\n", .{overflow_result});
}
```

**预期输出**：
```
=== 整数类型范围演示 ===

u8 范围：0 到 255
i8 范围：-128 到 127
u16 范围：0 到 65535
i16 范围：-32768 到 32767

=== 溢出行为演示 ===
u8 最大值：255
255 + 1 (溢出) = 0
```

**题目3**：编写一个程序，创建并操作多维数组。

**要求**：
- 创建一个 3x3 的二维数组
- 初始化数组元素
- 计算对角线元素的和
- 输出数组和计算结果

**解题思路**：
1. 声明 `[3][3]i32` 类型的二维数组
2. 使用嵌套循环初始化元素
3. 计算对角线元素（`[0][0]`、`[1][1]`、`[2][2]`）的和
4. 输出结果

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var matrix: [3][3]i32 = [_][3]i32{
        [_]i32{ 1, 2, 3 },
        [_]i32{ 4, 5, 6 },
        [_]i32{ 7, 8, 9 },
    };
    
    std.debug.print("=== 3x3 矩阵 ===\n", .{});
    for (matrix, 0..) |row, i| {
        std.debug.print("行 {}：", .{i});
        for (row) |elem| {
            std.debug.print("{:3} ", .{elem});
        }
        std.debug.print("\n", .{});
    }
    
    var diagonal_sum: i32 = 0;
    var i: usize = 0;
    while (i < 3) : (i += 1) {
        diagonal_sum += matrix[i][i];
    }
    
    std.debug.print("\n对角线元素和：{}\n", .{diagonal_sum});
}
```

**预期输出**：
```
=== 3x3 矩阵 ===
行 0：  1   2   3 
行 1：  4   5   6 
行 2：  7   8   9 

对角线元素和：15
```

## 进阶题

**题目1**：实现一个程序，演示数组与切片的区别和联系。

**要求**：
- 创建一个固定大小的数组
- 从数组创建多个切片
- 修改切片元素，观察对原数组的影响
- 输出内存地址，验证切片是指向数组的视图

**解题思路**：
1. 声明数组并初始化
2. 使用 `[start..end]` 语法创建切片
3. 修改切片元素
4. 输出数组和切片的地址和内容

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    std.debug.print("=== 数组与切片演示 ===\n\n", .{});
    
    var array: [5]i32 = [_]i32{ 10, 20, 30, 40, 50 };
    
    std.debug.print("原始数组：", .{});
    for (array) |elem| {
        std.debug.print("{} ", .{elem});
    }
    std.debug.print("\n", .{});
    std.debug.print("数组地址：{}\n\n", .{&array});
    
    var slice1: []i32 = array[1..4];
    std.debug.print("切片1 (array[1..4])：", .{});
    for (slice1) |elem| {
        std.debug.print("{} ", .{elem});
    }
    std.debug.print("\n", .{});
    std.debug.print("切片1 地址：{}\n", .{slice1.ptr});
    std.debug.print("切片1 长度：{}\n\n", .{slice1.len});
    
    std.debug.print("修改切片1[0] = 99\n", .{});
    slice1[0] = 99;
    
    std.debug.print("修改后的数组：", .{});
    for (array) |elem| {
        std.debug.print("{} ", .{elem});
    }
    std.debug.print("\n\n", .{});
    
    var slice2: []i32 = array[0..2];
    std.debug.print("切片2 (array[0..2])：", .{});
    for (slice2) |elem| {
        std.debug.print("{} ", .{elem});
    }
    std.debug.print("\n", .{});
    std.debug.print("切片2 地址：{}\n", .{slice2.ptr});
}
```

**预期输出**：
```
=== 数组与切片演示 ===

原始数组：10 20 30 40 50 
数组地址：*const [5]i32@...

切片1 (array[1..4])：20 30 40 
切片1 地址：*i32@...
切片1 长度：3

修改切片1[0] = 99
修改后的数组：10 99 30 40 50 

切片2 (array[0..2])：10 99 
切片2 地址：*i32@...
```

**题目2**：实现一个简单的学生成绩管理系统，使用结构体和数组。

**要求**：
- 定义 `Student` 结构体，包含姓名和成绩
- 创建学生数组
- 计算平均成绩、最高分和最低分
- 输出统计结果

**解题思路**：
1. 定义 `Student` 结构体
2. 创建学生数组并初始化
3. 遍历数组计算统计数据
4. 输出结果

**参考答案**：
```zig
const std = @import("std");

const Student = struct {
    name: []const u8,
    score: u32,
};

pub fn main(init: std.process.Init.Minimal) void {
    const students: [5]Student = [_]Student{
        .{ .name = "张三", .score = 85 },
        .{ .name = "李四", .score = 92 },
        .{ .name = "王五", .score = 78 },
        .{ .name = "赵六", .score = 95 },
        .{ .name = "钱七", .score = 88 },
    };
    
    std.debug.print("=== 学生成绩管理系统 ===\n\n", .{});
    
    std.debug.print("学生列表：\n", .{});
    for (students) |student| {
        std.debug.print("  {s}: {} 分\n", .{ student.name, student.score });
    }
    
    var total: u32 = 0;
    var max_score: u32 = 0;
    var min_score: u32 = 100;
    var max_name: []const u8 = "";
    var min_name: []const u8 = "";
    
    for (students) |student| {
        total += student.score;
        if (student.score > max_score) {
            max_score = student.score;
            max_name = student.name;
        }
        if (student.score < min_score) {
            min_score = student.score;
            min_name = student.name;
        }
    }
    
    const average = @as(f32, @floatFromInt(total)) / @as(f32, @floatFromInt(students.len));
    
    std.debug.print("\n统计结果：\n", .{});
    std.debug.print("  平均分：{d:.2}\n", .{average});
    std.debug.print("  最高分：{s} ({} 分)\n", .{ max_name, max_score });
    std.debug.print("  最低分：{s} ({} 分)\n", .{ min_name, min_score });
}
```

**预期输出**：
```
=== 学生成绩管理系统 ===

学生列表：
  张三: 85 分
  李四: 92 分
  王五: 78 分
  赵六: 95 分
  钱七: 88 分

统计结果：
  平均分：87.60
  最高分：赵六 (95 分)
  最低分：王五 (78 分)
```

## 挑战题

**题目**：实现一个简单的位图（BitMap）数据结构，使用数组和位操作。

**要求**：
- 使用 `[]u8` 存储位数据
- 实现设置位、清除位、检查位的函数
- 演示位图的使用场景（如标记已使用/未使用的状态）
- 输出操作过程和结果

**解题思路**：
1. 计算需要的字节数（bits / 8）
2. 使用位操作设置、清除和检查位
3. 使用 `|` 运算符设置位
4. 使用 `& ~` 运算符清除位
5. 使用 `&` 运算符检查位

**参考答案**：
```zig
const std = @import("std");

const BitMap = struct {
    data: []u8,
    
    fn init(allocator: std.mem.Allocator, num_bits: usize) !BitMap {
        const num_bytes = (num_bits + 7) / 8;
        const data = try allocator.alloc(u8, num_bytes);
        @memset(data, 0);
        return BitMap{ .data = data };
    }
    
    fn deinit(self: *BitMap, allocator: std.mem.Allocator) void {
        allocator.free(self.data);
    }
    
    fn set(self: *BitMap, bit_index: usize) void {
        const byte_index = bit_index / 8;
        const bit_offset = @as(u3, @intCast(bit_index % 8));
        self.data[byte_index] |= (@as(u8, 1) << bit_offset);
    }
    
    fn clear(self: *BitMap, bit_index: usize) void {
        const byte_index = bit_index / 8;
        const bit_offset = @as(u3, @intCast(bit_index % 8));
        self.data[byte_index] &= ~(@as(u8, 1) << bit_offset);
    }
    
    fn isSet(self: *const BitMap, bit_index: usize) bool {
        const byte_index = bit_index / 8;
        const bit_offset = @as(u3, @intCast(bit_index % 8));
        return (self.data[byte_index] & (@as(u8, 1) << bit_offset)) != 0;
    }
};

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var bitmap = try BitMap.init(allocator, 16);
    defer bitmap.deinit(allocator);
    
    std.debug.print("=== 位图演示 ===\n\n", .{});
    
    std.debug.print("初始状态（所有位为 0）：\n", .{});
    for (0..16) |i| {
        std.debug.print("位 {}：{}  ", .{ i, bitmap.isSet(i) });
        if ((i + 1) % 4 == 0) std.debug.print("\n", .{});
    }
    
    std.debug.print("\n设置位 0, 3, 7, 15：\n", .{});
    bitmap.set(0);
    bitmap.set(3);
    bitmap.set(7);
    bitmap.set(15);
    
    for (0..16) |i| {
        std.debug.print("位 {}：{}  ", .{ i, bitmap.isSet(i) });
        if ((i + 1) % 4 == 0) std.debug.print("\n", .{});
    }
    
    std.debug.print("\n清除位 3：\n", .{});
    bitmap.clear(3);
    
    for (0..16) |i| {
        std.debug.print("位 {}：{}  ", .{ i, bitmap.isSet(i) });
        if ((i + 1) % 4 == 0) std.debug.print("\n", .{});
    }
    
    std.debug.print("\n字节表示：", .{});
    for (bitmap.data) |byte| {
        std.debug.print("{b:0>8} ", .{byte});
    }
    std.debug.print("\n", .{});
}
```

**预期输出**：
```
=== 位图演示 ===

初始状态（所有位为 0）：
位 0：false  位 1：false  位 2：false  位 3：false  
位 4：false  位 5：false  位 6：false  位 7：false  
位 8：false  位 9：false  位 10：false  位 11：false  
位 12：false  位 13：false  位 14：false  位 15：false  

设置位 0, 3, 7, 15：
位 0：true  位 1：false  位 2：false  位 3：true  
位 4：false  位 5：false  位 6：false  位 7：true  
位 8：false  位 9：false  位 10：false  位 11：false  
位 12：false  位 13：false  位 14：false  位 15：true  

清除位 3：
位 0：true  位 1：false  位 2：false  位 3：false  
位 4：false  位 5：false  位 6：false  位 7：true  
位 8：false  位 9：false  位 10：false  位 11：false  
位 12：false  位 13：false  位 14：false  位 15：true  

字节表示：10001001 10000000 
```

---

> 💡 **章节过渡**：从基本语法到控制流语句
> 
> 在[基本语法结构](chapter-basic-syntax.md)中，我们学习了 Zig 的基本语法结构，包括变量、数据类型、数组、切片、枚举、联合和结构体。
> 现在，我们将学习控制流语句，掌握如何控制程序的执行流程。
> 
> **为什么基本语法是控制流的基础？**
> 
> 1. **数据与逻辑**：基本语法提供了数据结构，控制流提供逻辑处理
> 2. **类型系统**：控制流语句（如 if）可以处理可选类型和错误联合类型
> 3. **表达式特性**：Zig 的控制流语句是表达式，可以返回值
> 
> **学习建议**：
> - 回顾可选类型（?T）和错误联合类型（!T）的用法
> - 理解 Zig 的显式设计哲学
> - 准备学习 Zig 独特的控制流特性
