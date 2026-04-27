# 高级内存管理技巧

本章讨论两类进阶内存策略，它们分别回答不同的问题：

- **包装分配器**：在不修改业务逻辑的前提下，统计和观测分配行为
- **对象池优化**：用空闲索引表替代线性扫描，降低获取空闲对象的开销

核心前提是：这些技巧适合在已经确认优化必要时引入，不应作为默认起手式。基本的内存管理原则——显式传递 `Allocator`、用 `defer`/`errdefer` 收拢清理路径、明确所有权边界——在大多数项目中已经足够。

## 一、包装分配器：增加分配行为的可观测性

### 一个最小统计分配器

下面的实现包装了一个已有分配器，记录分配次数、释放次数和当前统计字节数。

```zig
const std = @import("std");

const TrackingAllocator = struct {
    backing_allocator: std.mem.Allocator,
    allocations: usize,
    deallocations: usize,
    bytes_allocated: usize,

    const Self = @This();

    fn init(backing: std.mem.Allocator) Self {
        return .{
            .backing_allocator = backing,
            .allocations = 0,
            .deallocations = 0,
            .bytes_allocated = 0,
        };
    }

    fn allocator(self: *Self) std.mem.Allocator {
        return .{
            .ptr = self,
            .vtable = &.{
                .alloc = alloc,
                .resize = resize,
                .remap = remap,
                .free = free,
            },
        };
    }

    fn alloc(
        ctx: *anyopaque,
        len: usize,
        alignment: std.mem.Alignment,
        ret_addr: usize,
    ) ?[*]u8 {
        const self: *Self = @ptrCast(@alignCast(ctx));
        const ptr = self.backing_allocator.vtable.alloc(
            self.backing_allocator.ptr,
            len,
            alignment,
            ret_addr,
        ) orelse return null;
        self.allocations += 1;
        self.bytes_allocated += len;
        return ptr;
    }

    fn resize(
        ctx: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        new_len: usize,
        ret_addr: usize,
    ) bool {
        const self: *Self = @ptrCast(@alignCast(ctx));
        return self.backing_allocator.vtable.resize(
            self.backing_allocator.ptr,
            memory,
            alignment,
            new_len,
            ret_addr,
        );
    }

    fn remap(
        ctx: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        new_len: usize,
        ret_addr: usize,
    ) ?[*]u8 {
        const self: *Self = @ptrCast(@alignCast(ctx));
        return self.backing_allocator.vtable.remap(
            self.backing_allocator.ptr,
            memory,
            alignment,
            new_len,
            ret_addr,
        );
    }

    fn free(
        ctx: *anyopaque,
        memory: []u8,
        alignment: std.mem.Alignment,
        ret_addr: usize,
    ) void {
        const self: *Self = @ptrCast(@alignCast(ctx));
        self.deallocations += 1;
        self.bytes_allocated -= memory.len;
        self.backing_allocator.vtable.free(
            self.backing_allocator.ptr,
            memory,
            alignment,
            ret_addr,
        );
    }

    fn printStats(self: *const Self) void {
        std.debug.print("分配次数：{}, 释放次数：{}, 当前字节数：{}\n", .{
            self.allocations,
            self.deallocations,
            self.bytes_allocated,
        });
    }
};

pub fn main(_: std.process.Init) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();

    var tracker = TrackingAllocator.init(gpa.allocator());
    const allocator = tracker.allocator();

    const mem1 = try allocator.alloc(u8, 100);
    const mem2 = try allocator.alloc(u8, 200);

    tracker.printStats();

    allocator.free(mem1);
    allocator.free(mem2);

    tracker.printStats();
}
```

### 设计要点

- Allocator 可以像其他接口一样被组合和包装，观测逻辑外挂到包装层，业务模块的签名和实现无需改动
- VTable 使用 `ptr` + `vtable` 模式构造（参见[接口章节](../part2-advanced/chapter-interfaces.md)），`@ptrCast(@alignCast(ctx))` 将类型擦除指针还原
- 将 `printStats` 替换为日志或条件编译选项，即可切换到统计模式

### 局限

`bytes_allocated` 只在 `alloc`/`free` 中更新，`resize` 和 `remap` 的变化未同步，因此该值只是近似观察值。此外，没有并发安全、没有记录调用来源，手动拼装 vtable 的方式也属于版本敏感的底层接口。

### 适用场景

- 定位某个模块的分配行为
- 怀疑分配次数过多是热点
- 在不改业务逻辑的前提下做局部实验

## 二、对象池：空闲索引表优化

对象池的核心思路是提前准备一批对象槽位，获取和归还都在这批存储上完成。前一章的[内存池](chapter-memory-pool.md)使用线性扫描寻找空闲槽位（O(n)），本节使用空闲索引表（free list）优化为 O(1)。

### 空闲列表对象池

```zig
const std = @import("std");

fn ObjectPool(comptime T: type) type {
    return struct {
        const Self = @This();

        items: []T,
        free_list: []usize,
        free_count: usize,
        allocator: std.mem.Allocator,

        fn init(allocator: std.mem.Allocator, capacity: usize) !Self {
            const items = try allocator.alloc(T, capacity);
            const free_list = try allocator.alloc(usize, capacity);

            for (0..capacity) |i| {
                free_list[i] = i;
            }

            return .{
                .items = items,
                .free_list = free_list,
                .free_count = capacity,
                .allocator = allocator,
            };
        }

        fn deinit(self: *Self) void {
            self.allocator.free(self.items);
            self.allocator.free(self.free_list);
        }

        fn acquire(self: *Self) ?*T {
            if (self.free_count == 0) return null;

            self.free_count -= 1;
            const index = self.free_list[self.free_count];
            return &self.items[index];
        }

        fn release(self: *Self, item: *T) void {
            const ptr_offset = @intFromPtr(item) - @intFromPtr(self.items.ptr);
            const item_index = ptr_offset / @sizeOf(T);

            if (item_index < self.items.len) {
                self.free_list[self.free_count] = item_index;
                self.free_count += 1;
            }
        }
    };
}

pub fn main(_: std.process.Init) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();

    var pool = try ObjectPool(i32).init(gpa.allocator(), 100);
    defer pool.deinit();

    const obj1 = pool.acquire().?;
    const obj2 = pool.acquire().?;

    obj1.* = 42;
    obj2.* = 100;

    std.debug.print("obj1: {}, obj2: {}\n", .{ obj1.*, obj2.* });

    pool.release(obj1);
    pool.release(obj2);
}
```

### 设计要点

- `free_list` 充当"空闲槽位索引栈"：`acquire` 直接从栈顶取索引，无需遍历整个槽位数组
- `release` 通过指针算术反推索引，开销接近 O(1)
- 容量在初始化后固定，池满时 `acquire` 返回 `null`

### 代价

- `release` 正确性依赖调用者守约：指针必须来自当前池、未重复释放。`if (item_index < self.items.len)` 只做边界检查，不能防御外来指针或重复归还
- 复用对象可能携带上次使用后的旧状态，需在重新使用前显式覆盖或重置
- 非线程安全，并发获取/归还需要额外同步

### 适用场景

对象大小固定、创建和释放频繁、容量上界已知的场景，如任务节点、事件对象、固定尺寸消息块。不适合大小变化大、容量不可预测或并发共享无同步保护的情况。

## 三、两种策略对比

| 维度 | 包装分配器 | 对象池（free list） |
| ---- | ---------- | ------------------ |
| 主要目标 | 观测和统计分配行为 | 降低重复分配成本 |
| 是否改变资源获取方式 | 否 | 是 |
| 对业务接口侵入性 | 低 | 高 |
| 适合问题阶段 | 诊断、排查、实验 | 确认需要优化后 |
| 主要风险 | 统计不精确、接口版本敏感 | 容量限制、错误释放、旧状态残留 |

核心判断：先区分"观察问题"还是"分配策略问题"。

## 四、版本敏感说明

本章中相对稳定的内容是设计原则：所有权与释放责任、`Allocator` 作为显式接口、对象池适合固定形状频繁复用对象、高级优化意味着更强的正确性约束。

更可能随版本变化的是：手动拼装 allocator vtable 的方式、底层 `rawAlloc`/`rawResize`/`rawRemap`/`rawFree` 接口的签名。阅读时应结合本地标准库源码确认，优先掌握设计判断和责任边界。

## 五、进一步演进方向

**包装分配器**：补全 `resize`/`remap` 的统计一致性、添加并发安全（`std.Io.Mutex` 等）、记录调用来源和堆栈、增加测试覆盖。

**对象池**：合法性检查（指针范围、对齐验证）、重复释放检测、对象重置策略、线程安全、容量耗尽时的策略选择（阻塞等待/自动扩容/返回错误）。

## 小结

本章的核心不是记住两段代码，而是建立以下判断：

- 何时需要引入高级内存技巧，而不是直接使用通用分配器
- 包装分配器解决观测问题，对象池解决复用策略问题
- 性能提升往往伴随更高的正确性成本和更强的接口契约
- 稳定的设计原则比易变的 API 形状更值得投入理解

如果已经能区分"观察问题"和"分配策略问题"，并根据收益和代价做出选择，这一章就达到了目的。
