# 【draft】内存管理模型

## Zig内存安全哲学

> 📜 **Zig Zen 原则关联**
> 
> 本章内容直接体现了以下 Zig Zen 原则：
> - **"Memory is a resource."**（内存是一种资源）  
>   Zig 没有垃圾回收器，内存是珍贵的资源，需要显式管理。这赋予开发者完全的控制权，但也要求更严格的纪律。
> - **"Resource allocation may fail; resource deallocation must succeed."**（资源分配可能失败；资源释放必须成功）  
>   这是系统编程的核心原则。分配内存可能失败（返回错误），但释放内存必须成功（不能失败）。Zig 的 `defer` 和 `errdefer` 机制确保资源释放的健壮性。
> - **"Communicate intent precisely."**（精确表达意图）  
>   Zig 要求显式传递分配器参数，明确表达内存分配的意图和所有权关系。

# 为什么内存管理如此重要？

内存管理错误是软件中最常见的bug来源之一：
- **内存泄漏**: 分配后未释放，导致内存耗尽
- **悬空指针**: 访问已释放的内存
- **双重释放**: 同一内存释放两次
- **缓冲区溢出**: 访问数组边界外的内存

# Zig的内存安全策略

与Rust的借用检查器不同，Zig采用不同的方法：

| 策略           | Rust            | Zig                 |
| -------------- | --------------- | ------------------- |
| **核心机制**   | 所有权+借用检查 | 显式分配器+手动管理 |
| **学习曲线**   | 陡峭            | 平缓                |
| **编译时检查** | 严格            | 可选                |
| **运行时检查** | 最小            | Debug模式全面检查   |
| **灵活性**     | 受限            | 完全控制            |

# 所有权和生命周期

虽然Zig没有Rust的所有权系统，但理解所有权概念仍然重要：

**所有权原则**：
1. **分配者负责释放**: 谁分配，谁释放
2. **生命周期明确**: 知道内存何时有效
3. **传递所有权**: 明确所有权转移

**示例：清晰的所有权**
```zig
// 好的设计：所有权清晰
// ✨ 新特性：DebugAllocator
fn createBuffer(allocator: std.mem.Allocator) ![]u8 {
    const buffer = try allocator.alloc(u8, 1024);
    // 所有权转移给调用者
    return buffer;
}

fn useBuffer() !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    
    // 获得所有权
    const buffer = try createBuffer(gpa.allocator());
    // 负责释放
    defer gpa.allocator().free(buffer);
    
    // 使用buffer...
}
```

**示例：借用（不转移所有权）**
```zig
// 借用：不拥有，不负责释放
fn processBuffer(buffer: []const u8) void {
    // 只读取，不释放
    std.debug.print("Buffer length: {}\n", .{buffer.len});
}

fn main() !void {
    const buffer = try allocator.alloc(u8, 100);
    defer allocator.free(buffer);
    
    // 借用给processBuffer
    processBuffer(buffer);
    // buffer仍然有效，由main负责释放
}
```

# 内存安全最佳实践

**实践1：使用defer确保释放**
```zig
fn processFile() !void {
    const file = try std.fs.cwd().openFile("data.txt", .{});
    defer file.close();  // 确保文件关闭
    
    const buffer = try allocator.alloc(u8, 1024);
    defer allocator.free(buffer);  // 确保内存释放
    
    // 即使出错，资源也会被正确清理
}
```

**实践2：使用errdefer处理错误情况**
```zig
fn complexOperation() !void {
    const resource1 = try allocateResource1();
    errdefer freeResource1(resource1);  // 出错时释放
    
    const resource2 = try allocateResource2();
    errdefer freeResource2(resource2);  // 出错时释放
    
    // 成功时手动释放
    freeResource2(resource2);
    freeResource1(resource1);
}
```

**实践3：使用DebugAllocator检测泄漏**
```zig
pub fn main(init: std.process.Init.Minimal) !void {
#### 10.0.1 ⚠️ 容器初始化最佳实践（0.15.x+）

> **重要**：Zig 0.15.x 对容器初始化语法进行了规范化。错误的初始化方式会导致未定义行为。

##### 核心规则：使用 `.empty` 或 `.init`

**❌ 错误：使用 `.{}` 初始化容器（已弃用）**

```zig
// 错误：可能导致未定义行为
var list: std.ArrayList(u32) = .{};
var map: std.AutoHashMap(u32, u32) = .{};
var gpa: std.heap.DebugAllocator(.{}) = .{};
```

**✅ 正确：使用 `.empty` 初始化空容器**

```zig
// 正确：使用 .empty 初始化空容器
var list: std.ArrayList(u32) = .empty;
var map: std.AutoHashMapUnmanaged(u32, u32) = .empty;
var set: std.AutoArrayHashMapUnmanaged(u32, void) = .empty;
```

**✅ 正确：使用 `.init` 初始化有状态的类型**

```zig
// 正确：使用 .init 初始化有状态的类型
var gpa: std.heap.DebugAllocator(.{}) = .init;
var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
var list = std.ArrayList(u32).init(allocator);
```

##### 为什么这样设计？

1. **避免未定义行为**：`.empty` 和 `.init` 确保容器处于有效状态
2. **明确语义**：`.empty` 表示空容器，`.init` 表示需要初始化状态
3. **类型安全**：编译器可以检查初始化是否正确
4. **向前兼容**：为未来的改进预留空间

##### 何时使用 `.empty` vs `.init`？

| 场景           | 使用方式                             | 示例                                     |
| -------------- | ------------------------------------ | ---------------------------------------- |
| **空集合**     | `.empty`                             | `ArrayList`, `HashMap`, `HashSet`        |
| **需要分配器** | `.init(allocator)`                   | `ArrayList.init(allocator)`              |
| **有内部配置** | `.init`                              | `DebugAllocator(.{}).init`               |
| **预分配容量** | `.initCapacity(allocator, capacity)` | `ArrayList.initCapacity(allocator, 100)` |

##### 完整示例对比

**错误示例（旧方式）：**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .{};  // ❌ 错误
    defer _ = gpa.deinit();
    
    var list: std.ArrayList(u32) = .{};  // ❌ 错误
    defer list.deinit();
    
    try list.append(42);
}
```

**正确示例（新方式）：**

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;  // ✅ 正确
    defer _ = gpa.deinit();
    
    var list: std.ArrayList(u32) = .empty;  // ✅ 正确
    defer list.deinit();
    
    try list.append(42);
}
```

##### 常见容器初始化方式

**ArrayList 系列：**

```zig
// 方式1：空列表
var list1: std.ArrayList(u32) = .empty;
defer list1.deinit();

// 方式2：带分配器初始化
var list2 = std.ArrayList(u32).init(allocator);
defer list2.deinit();

// 方式3：预分配容量
var list3 = try std.ArrayList(u32).initCapacity(allocator, 100);
defer list3.deinit();

// 方式4：从栈缓冲区初始化（替代已移除的 BoundedArray）
var buffer: [100]u32 = undefined;
var list4 = std.ArrayList(u32).initBuffer(&buffer);
// 注意：initBuffer 创建的列表不需要 deinit
```

**HashMap 系列：**

```zig
// 方式1：空 HashMap
var map1: std.AutoHashMap(u32, u32) = .empty;
defer map1.deinit();

// 方式2：带分配器初始化
var map2 = std.AutoHashMap(u32, u32).init(allocator);
defer map2.deinit();

// 方式3：Unmanaged 版本（无分配器字段）
var map3: std.AutoHashMapUnmanaged(u32, u32) = .empty;
defer map3.deinit(allocator);
```

**其他容器：**

```zig
// 优先队列
var queue: std.PriorityQueue(u32) = .empty;
defer queue.deinit();

// 双端队列
var deque: std.DoublyLinkedList(u32) = .{};

// 位集合
var bitset: std.DynamicBitSet = .empty;
defer bitset.deinit();
```

##### 迁移指南

如果您的代码使用了旧的初始化方式，请按以下步骤迁移：

**步骤1：识别旧代码**

搜索以下模式：
- `= .{};` 用于容器类型
- `= .{};` 用于分配器类型

**步骤2：替换为正确方式**

```zig
// 查找
var list: std.ArrayList(T) = .{};

// 替换为
var list: std.ArrayList(T) = .empty;
```

**步骤3：测试验证**

运行测试确保功能正常：
```bash
zig build test
```

##### 编译器警告

从 Zig 0.15.x 开始，使用 `.{}` 初始化容器会产生警告：

```
warning: use of undefined value
```

如果看到此警告，请立即修复为 `.empty` 或 `.init`。

##### 最佳实践总结

1. **优先使用 `.empty`**：对于空容器，使用 `.empty` 最清晰
2. **需要分配器时使用 `.init`**：明确传递分配器
3. **预分配容量**：如果知道大概大小，使用 `initCapacity` 提高性能
4. **使用 defer 释放**：确保资源正确释放
5. **避免 `.{}`**：永远不要用 `.{}` 初始化容器

##### 相关 API 变更

| 旧 API                             | 新 API                    | 说明                 |
| ---------------------------------- | ------------------------- | -------------------- |
| `std.ArrayListUnmanaged`           | `std.ArrayList`           | Unmanaged 现在是默认 |
| `std.BoundedArray(T, N)`           | `ArrayList.initBuffer`    | BoundedArray 已移除  |
| `std.heap.GeneralPurposeAllocator` | `std.heap.DebugAllocator` | 重命名，别名仍可用   |
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer {
        const leaked = gpa.deinit();
        if (leaked == .leak) {
            @panic("Memory leak detected!");
        }
    }
    
    // 开发时使用DebugAllocator
    // 生产环境可以切换到GeneralPurposeAllocator
}
```

## 内存空间

Zig 中有三种主要的内存空间：

1. **全局数据段**：存储编译期已知的常量
2. **栈**：存储局部变量，自动管理
3. **堆**：手动管理的动态内存

```zig
const std = @import("std");

// 全局数据段
const global_const: i32 = 42;

pub fn main(init: std.process.Init.Minimal) !void {
    // 栈内存
    var stack_var: i32 = 10;
    
    // 堆内存
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    const heap_var = try allocator.create(i32);
    defer allocator.destroy(heap_var);
    heap_var.* = 20;
    
    std.debug.print("全局：{}, 栈：{}, 堆：{}\n", .{ global_const, stack_var, heap_var.* });
}
```

## 内存分配器

Zig 标准库提供了多种内存分配器：

**1. DebugAllocator (GPA)：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 通用分配器，带内存泄漏检测
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer {
        const deinit_status = gpa.deinit();
        if (deinit_status == .leak) {
            std.debug.print("检测到内存泄漏！\n", .{});
        }
    }
    
    const allocator = gpa.allocator();
    
    // 分配内存
    const memory = try allocator.alloc(u8, 100);
    defer allocator.free(memory);
    
    std.debug.print("分配了 {} 字节\n", .{memory.len});
}
```

**2. ArenaAllocator：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    
    // Arena 分配器：一次性释放所有分配
    var arena = std.heap.ArenaAllocator.init(gpa.allocator());
    defer arena.deinit();
    
    const allocator = arena.allocator();
    
    // 多次分配
    const mem1 = try allocator.alloc(u8, 100);
    const mem2 = try allocator.alloc(u8, 200);
    const mem3 = try allocator.alloc(u8, 300);
    
    // 不需要单独释放，arena.deinit() 会一次性释放所有
    std.debug.print("分配了三块内存\n", .{});
}
```

**3. FixedBufferAllocator：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 固定大小的缓冲区分配器
    var buffer: [1000]u8 = undefined;
    var fba = std.heap.FixedBufferAllocator.init(&buffer);
    
    const allocator = fba.allocator();
    
    const memory = try allocator.alloc(u8, 100);
    defer allocator.free(memory);
    
    std.debug.print("从固定缓冲区分配了 {} 字节\n", .{memory.len});
}
```

**4. PageAllocator（系统分配器）：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    // 直接使用操作系统分配器
    // 适合大型内存分配，没有额外的内存跟踪开销
    const allocator = std.heap.page_allocator;

    const memory = try allocator.alloc(u8, 100);
    defer allocator.free(memory);

    std.debug.print("使用 page_allocator 分配了 {} 字节\n", .{memory.len});
}
```

**5. 线程安全考虑：**
在 0.16.0+ 版本中，如果需要多线程安全的分配，可以使用 `std.heap.ThreadSafeAllocator` 包装其他分配器：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();

    // 包装为线程安全分配器
    var ts_allocator = std.heap.ThreadSafeAllocator{ .child_allocator = gpa.allocator() };
    const allocator = ts_allocator.allocator();

    const memory = try allocator.alloc(u8, 100);
    defer allocator.free(memory);

    std.debug.print("线程安全分配器分配了 {} 字节\n", .{memory.len});
}
```

## 分配器传递模式

Zig 的内存管理遵循一个重要原则：**显式传递分配器**。这是避免内存泄漏、提高代码可测试性和灵活性的关键。

### 核心原则

1. **永远不要使用全局状态**：避免使用全局分配器
2. **总是将分配器作为参数传递**：让调用者决定内存分配策略
3. **明确所有权**：谁分配，谁释放

### 为什么这样设计？

- **灵活性**：调用者可以选择最合适的分配器（栈分配器、堆分配器、竞技场分配器等）
- **可测试性**：测试时可以使用自定义分配器跟踪内存使用
- **可组合性**：函数可以轻松组合，不会因为全局状态产生冲突
- **性能**：可以根据场景选择最优的分配策略

### 正确示例

**方式1：函数参数传递**

```zig
const std = @import("std");

// ✅ 正确：分配器作为参数传递
fn processData(allocator: std.mem.Allocator, data: []const u8) ![]u8 {
    const buffer = try allocator.alloc(u8, data.len);
    @memcpy(buffer, data);
    return buffer;
}

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    
    const result = try processData(gpa.allocator(), "hello");
    defer gpa.allocator().free(result);
}
```

**方式2：结构体存储分配器**

```zig
const std = @import("std");

// ✅ 正确：结构体存储分配器
const DataProcessor = struct {
    allocator: std.mem.Allocator,
    
    fn init(allocator: std.mem.Allocator) DataProcessor {
        return .{ .allocator = allocator };
    }
    
    fn process(self: *DataProcessor, data: []const u8) ![]u8 {
        return try self.allocator.alloc(u8, data.len);
    }
};

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    
    var processor = DataProcessor.init(gpa.allocator());
    const result = try processor.process("world");
    defer gpa.allocator().free(result);
}
```

### 错误示例

**❌ 错误1：使用全局分配器**

```zig
const std = @import("std");

// ❌ 错误：使用全局分配器
fn processDataBad(data: []const u8) ![]u8 {
    var buffer = try std.heap.page_allocator.alloc(u8, data.len);
    @memcpy(buffer, data);
    return buffer;
}
```

**问题**：
- 调用者无法选择分配器
- 测试时无法跟踪内存使用
- 可能与其他使用 page_allocator 的代码冲突

**❌ 错误2：硬编码分配器**

```zig
// ❌ 错误：硬编码分配器
fn processDataAlsoBad(data: []const u8) ![]u8 {
    var gpa = std.heap.DebugAllocator(.{}){};
    var buffer = try gpa.allocator().alloc(u8, data.len);
    @memcpy(buffer, data);
    return buffer;
}
```

**问题**：
- 每次调用都创建新的分配器，效率低下
- 无法控制内存分配策略

**❌ 错误3：使用静态变量**

```zig
// ❌ 错误：使用静态变量存储分配器
var global_allocator: ?std.mem.Allocator = null;

fn setAllocator(allocator: std.mem.Allocator) void {
    global_allocator = allocator;
}

fn processDataWithGlobal(data: []const u8) ![]u8 {
    const allocator = global_allocator orelse return error.NoAllocator;
    return try allocator.alloc(u8, data.len);
}
```

**问题**：
- 全局状态导致测试困难
- 并发问题
- 隐式依赖，难以理解

### 分配器传递的标准模式

| 模式       | 使用场景       | 示例                                          |
| ---------- | -------------- | --------------------------------------------- |
| 函数参数   | 一次性操作     | `fn foo(allocator: Allocator) !void`          |
| 结构体字段 | 长期存在的对象 | `const Foo = struct { allocator: Allocator }` |
| 方法接收器 | 对象方法       | `fn method(self: *Self) !void`                |

**选择指南**：
- **函数参数**：适用于简单的、一次性的操作
- **结构体字段**：适用于需要多次分配的对象
- **方法接收器**：适用于对象的生命周期管理

### 实践建议

1. **始终显式传递分配器**：不要依赖全局状态
2. **在 init 函数中接收分配器**：对象创建时确定分配策略
3. **使用 defer 确保释放**：避免内存泄漏
4. **文档化所有权**：明确谁负责释放内存
5. **测试时使用跟踪分配器**：验证内存管理正确性

## 内存安全机制

Zig 提供了一些内存安全机制：

**边界检查：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    var array = [_]i32{ 1, 2, 3 };
    
    // 安全访问（运行时边界检查）
    const index: usize = 5;
    // const value = array[index]; // 运行时错误：索引越界
    
    // 使用 slice 避免边界检查
    if (index < array.len) {
        const value = array[index];
        std.debug.print("值：{}\n", .{value});
    }
}
```

**溢出检测：**
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const a: u8 = 255;
    
    // 检测溢出的加法
    const result = @addWithOverflow(a, 1);
    if (result[1] != 0) {
        std.debug.print("加法溢出！\n", .{});
    }
    
    // 使用饱和算术
    const saturated = a +| 1; // 结果为 255，不会溢出
    std.debug.print("饱和加法结果：{}\n", .{saturated});
}
```

---

# 章节练习题

# 基础题

**题目1**：使用 `GeneralPurposeAllocator` 分配和释放内存。

**要求**：
- 分配一个包含 10 个整数的切片
- 初始化切片元素
- 使用 `defer` 确保内存释放

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    var slice = try allocator.alloc(i32, 10);
    defer allocator.free(slice);
    
    for (slice, 0..) |*item, i| {
        item.* = @intCast(i);
    }
    
    std.debug.print("切片：{any}\n", .{slice});
}
```

**题目2**：使用 `ArenaAllocator` 管理临时内存。

**要求**：
- 创建 ArenaAllocator
- 进行多次分配
- 一次性释放所有内存

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    
    var slice1 = try allocator.alloc(i32, 10);
    var slice2 = try allocator.alloc(u8, 100);
    
    _ = slice1;
    _ = slice2;
    
    std.debug.print("Arena 分配成功\n", .{});
}
```

**题目3**：使用 `FixedBufferAllocator` 在栈上分配内存。

**要求**：
- 创建固定大小的缓冲区
- 使用 FixedBufferAllocator
- 分配并使用内存

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var buffer: [1024]u8 = undefined;
    var fba = std.heap.FixedBufferAllocator.init(&buffer);
    const allocator = fba.allocator();
    
    var slice = try allocator.alloc(u8, 100);
    @memset(slice, 0);
    
    std.debug.print("FixedBuffer 分配成功\n", .{});
}
```

# 进阶题

**题目1**：实现一个简单的内存池。

**要求**：
- 预分配固定大小的内存块
- 提供 alloc 和 free 方法
- 重用已释放的内存块

**参考答案**：
```zig
const std = @import("std");

const MemoryPool = struct {
    blocks: [][]u8,
    used: []bool,
    block_size: usize,
    
    fn init(allocator: std.mem.Allocator, count: usize, block_size: usize) !MemoryPool {
        var blocks = try allocator.alloc([]u8, count);
        var used = try allocator.alloc(bool, count);
        
        for (0..count) |i| {
            blocks[i] = try allocator.alloc(u8, block_size);
            used[i] = false;
        }
        
        return MemoryPool{
            .blocks = blocks,
            .used = used,
            .block_size = block_size,
        };
    }
    
    fn alloc(self: *MemoryPool) ?[]u8 {
        for (self.used, 0..) |*is_used, i| {
            if (!is_used.*) {
                is_used.* = true;
                return self.blocks[i];
            }
        }
        return null;
    }
    
    fn free(self: *MemoryPool, block: []u8) void {
        for (self.blocks, 0..) |b, i| {
            if (b.ptr == block.ptr) {
                self.used[i] = false;
                return;
            }
        }
    }
};
```

**题目2**：使用 `std.heap.LoggingAllocator` 跟踪内存分配。

**要求**：
- 包装现有分配器
- 记录所有分配和释放操作
- 输出日志信息

**参考答案**：
```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    
    var logging = std.heap.LoggingAllocator(
        .debug,
        .debug,
    ).init(gpa.allocator());
    const allocator = logging.allocator();
    
    var slice = try allocator.alloc(u8, 100);
    defer allocator.free(slice);
    
    std.debug.print("Logging 分配器测试完成\n", .{});
}
```

# 挑战题

**题目**：实现一个自定义分配器，统计内存使用情况。

**要求**：
- 包装现有分配器
- 统计总分配次数、总释放次数、当前使用量
- 提供查询接口

**参考答案**：
```zig
const std = @import("std");

const StatsAllocator = struct {
    parent: std.mem.Allocator,
    alloc_count: usize,
    free_count: usize,
    current_bytes: usize,
    
    fn init(parent: std.mem.Allocator) StatsAllocator {
        return StatsAllocator{
            .parent = parent,
            .alloc_count = 0,
            .free_count = 0,
            .current_bytes = 0,
        };
    }
    
    fn allocator(self: *StatsAllocator) std.mem.Allocator {
        return std.mem.Allocator{
            .ptr = self,
            .vtable = &.{
                .alloc = alloc,
                .resize = resize,
                .free = free,
            },
        };
    }
    
    fn alloc(ctx: *anyopaque, len: usize, ptr_align: u8, ret_addr: usize) ?[*]u8 {
        const self: *StatsAllocator = @ptrCast(@alignCast(ctx));
        const result = self.parent.rawAlloc(len, ptr_align, ret_addr);
        if (result) |_| {
            self.alloc_count += 1;
            self.current_bytes += len;
        }
        return result;
    }
    
    fn resize(ctx: *anyopaque, buf: []u8, buf_align: u8, new_len: usize, ret_addr: usize) bool {
        const self: *StatsAllocator = @ptrCast(@alignCast(ctx));
        return self.parent.rawResize(buf, buf_align, new_len, ret_addr);
    }
    
    fn free(ctx: *anyopaque, buf: []u8, buf_align: u8, ret_addr: usize) void {
        const self: *StatsAllocator = @ptrCast(@alignCast(ctx));
        self.parent.rawFree(buf, buf_align, ret_addr);
        self.free_count += 1;
        self.current_bytes -= buf.len;
    }
    
    fn printStats(self: *StatsAllocator) void {
        std.debug.print("分配次数：{}\n", .{self.alloc_count});
        std.debug.print("释放次数：{}\n", .{self.free_count});
        std.debug.print("当前使用：{} 字节\n", .{self.current_bytes});
    }
};
```

---

> 💡 **章节过渡**：从内存管理到并发编程
> 
> 在[内存管理模型](chapter-memory-management.md)中，我们学习了内存管理模型，掌握了 Zig 的显式内存管理哲学和各种分配器的使用。
> 现在，我们将学习并发编程，了解如何在多线程环境下安全地管理资源。
> 
> **为什么内存管理是并发编程的基础？**
> 
> 1. **共享资源**：多线程访问共享内存需要同步机制
> 2. **线程安全**：理解内存所有权是避免数据竞争的关键
> 3. **资源生命周期**：并发环境下资源管理更加复杂
> 
> **学习建议**：
> - 回顾分配器的使用和内存所有权概念
> - 理解 `defer` 和 `errdefer` 的资源管理作用
> - 准备学习线程安全和同步机制
