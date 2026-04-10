# 【draft】实战案例 - 内存池实现

展示内存管理和泛型编程：

```zig
const std = @import("std");

fn MemoryPool(comptime T: type) type {                       // ①
    return struct {
        const Self = @This();

        items: []T,                                          // ②
        used: []bool,                                        // ③
        allocator: std.mem.Allocator,                        // ④
        count: usize,                                        // ⑤

        fn init(allocator: std.mem.Allocator, capacity: usize) !Self {  // ⑥
            const items = try allocator.alloc(T, capacity);
            const used = try allocator.alloc(bool, capacity);

            @memset(used, false);                            // ⑦

            return .{
                .items = items,
                .used = used,
                .allocator = allocator,
                .count = 0,
            };
        }

        fn deinit(self: *Self) void {                        // ⑧
            self.allocator.free(self.items);
            self.allocator.free(self.used);
        }

        fn acquire(self: *Self) ?*T {                        // ⑨
            for (self.used, 0..) |is_used, index| {
                if (!is_used) {
                    self.used[index] = true;
                    self.count += 1;
                    return &self.items[index];               // ⑩
                }
            }
            return null;                                     // ⑪
        }

        fn release(self: *Self, item: *T) void {             // ⑫
            const ptr_offset = @intFromPtr(item) - @intFromPtr(self.items.ptr);  // ⑬
            const item_index = ptr_offset / @sizeOf(T);      // ⑭

            if (item_index < self.used.len and self.used[item_index]) {
                self.used[item_index] = false;
                self.count -= 1;
            }
        }

        fn getStats(self: *const Self) struct { total: usize, used: usize, free: usize } {  // ⑮
            return .{
                .total = self.items.len,
                .used = self.count,
                .free = self.items.len - self.count,
            };
        }
    };
}

pub fn main(_: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var pool = try MemoryPool(i32).init(allocator, 10);       // ⑯
    defer pool.deinit();

    const item1 = pool.acquire().?;                           // ⑰
    const item2 = pool.acquire().?;
    const item3 = pool.acquire().?;

    item1.* = 100;                                            // ⑱
    item2.* = 200;
    item3.* = 300;

    std.debug.print("item1: {}, item2: {}, item3: {}\n", .{ item1.*, item2.*, item3.* });

    const stats = pool.getStats();                            // ⑲
    std.debug.print("内存池统计 - 总数：{}, 已用：{}, 空闲：{}\n", .{ stats.total, stats.used, stats.free });

    pool.release(item2);                                      // ⑳

    const stats2 = pool.getStats();
    std.debug.print("释放后统计 - 总数：{}, 已用：{}, 空闲：{}\n", .{ stats2.total, stats2.used, stats2.free });
}
```

**代码解析**：

**① 泛型内存池定义**
- `fn MemoryPool(comptime T: type) type` 是泛型函数
- 返回一个结构体类型，实现类型安全的内存池
- `comptime` 确保类型在编译期确定

**② items: []T**
- 存储所有预分配的对象
- 类型为 T 的切片，连续内存布局
- 容量在初始化时确定，运行时不变

**③ used: []bool**
- 标记每个槽位是否被使用
- 与 items 一一对应
- `used[i] == true` 表示 `items[i]` 已被分配

**④ allocator: std.mem.Allocator**
- 存储分配器引用
- 用于分配 items 和 used 数组
- 遵循 Zig 的显式分配器传递模式

**⑤ count: usize**
- 当前已分配的对象数量
- 用于快速统计和验证
- 优化：避免每次遍历 used 数组

**⑥ init 函数**
- 初始化内存池，预分配所有内存
- 一次性分配 items 和 used 数组
- 返回初始化后的 MemoryPool 实例

**⑦ @memset(used, false)**
- 将所有槽位标记为未使用
- 使用内置函数高效初始化
- 确保内存池初始状态正确

**⑧ deinit 函数**
- 释放所有预分配的内存
- 只需两次 free 操作
- 遵循 RAII 模式（配合 defer）

**⑨ acquire 函数**
- 从内存池获取一个对象
- 返回 `?*T`，可能失败（内存池已满）
- 线性查找第一个空闲槽位

**⑩ 返回对象指针**
- `&self.items[index]` 返回槽位的指针
- 调用者可以直接使用该指针
- 无需额外分配内存

**⑪ 返回 null**
- 内存池已满，无法分配
- 调用者需要处理失败情况
- 避免 panic，提供优雅降级

**⑫ release 函数**
- 将对象归还到内存池
- 接收对象指针，计算索引
- 标记槽位为未使用

**⑬ 计算指针偏移量**
- `@intFromPtr` 获取指针的整数值
- 计算目标指针与数组起始指针的差值
- 这是指针运算的关键步骤

**⑭ 计算索引**
- `ptr_offset / @sizeOf(T)` 得到数组索引
- 利用指针算术实现 O(1) 释放
- 比遍历查找更高效

**⑮ getStats 函数**
- 返回内存池统计信息
- 匿名结构体作为返回类型
- 用于监控和调试

**⑯ 创建内存池**
- `MemoryPool(i32)` 实例化泛型
- 预分配 10 个 i32 对象
- 使用 DebugAllocator 管理内存

**⑰ 获取对象**
- `pool.acquire()` 返回 `?*i32`
- `.?` 解包可选值（假设不会失败）
- 返回的是指向内存池槽位的指针

**⑱ 使用对象**
- `item1.* = 100` 解引用指针并赋值
- 直接操作内存池中的对象
- 无需额外的内存分配

**⑲ 查看统计**
- 获取内存池使用情况
- 验证分配是否正确
- 用于调试和监控

**⑳ 释放对象**
- 将对象归还内存池
- 槽位标记为未使用
- 可以被后续 acquire 重用

**关键要点**：
1. **预分配策略**：一次性分配所有内存，避免频繁分配
2. **O(1) 释放**：通过指针算术实现快速释放
3. **类型安全**：泛型确保类型安全，编译期检查
4. **内存效率**：无碎片，连续内存布局
5. **显式管理**：清晰的获取/释放语义

**预期输出**：
```
item1: 100, item2: 200, item3: 300
内存池统计 - 总数：10, 已用：3, 空闲：7
释放后统计 - 总数：10, 已用：2, 空闲：8
```

**性能分析**：
- **分配复杂度**：O(n) 线性查找（可优化为 O(1) 使用空闲链表）
- **释放复杂度**：O(1) 指针算术
- **内存开销**：每个对象额外 1 字节（used 标记）
- **缓存友好**：连续内存布局，缓存命中率高

**下一步**：
- 实现空闲链表优化，将分配复杂度降至 O(1)
- 添加线程安全支持（使用互斥锁）
- 实现对象重置功能（release 时清零）
- 参考标准库的 `std.mem.Pool` 实现

---
