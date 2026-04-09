# 【draft】高级内存管理技巧

> **章节定位**：本章是实战案例部分，侧重于内存管理的实践技巧、优化和调试。关于内存管理的理论基础（如分配器原理、所有权模型、内存安全策略等），请参见高级部分的[内存管理模型](../part2-advanced/chapter-memory-management.md)章节。

## 自定义分配器

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
                .free = free,
            },
        };
    }

    fn alloc(
        ctx: *anyopaque,
        n: usize,
        alignment: std.mem.Alignment,
        return_address: usize,
    ) ?[*]u8 {
        const self: *Self = @ptrCast(@alignCast(ctx));
        const ptr = self.backing_allocator.rawAlloc(n, alignment, return_address) orelse return null;
        self.allocations += 1;
        self.bytes_allocated += n;
        return ptr;
    }

    fn resize(
        ctx: *anyopaque,
        buf: []u8,
        alignment: std.mem.Alignment,
        new_len: usize,
        return_address: usize,
    ) bool {
        const self: *Self = @ptrCast(@alignCast(ctx));
        return self.backing_allocator.rawResize(buf, alignment, new_len, return_address);
    }

    fn free(
        ctx: *anyopaque,
        buf: []u8,
        alignment: std.mem.Alignment,
        return_address: usize,
    ) void {
        const self: *Self = @ptrCast(@alignCast(ctx));
        self.deallocations += 1;
        self.bytes_allocated -= buf.len;
        self.backing_allocator.rawFree(buf, alignment, return_address);
    }

    fn printStats(self: *const Self) void {
        std.debug.print("分配次数：{}, 释放次数：{}, 当前字节数：{}\n", .{
            self.allocations,
            self.deallocations,
            self.bytes_allocated,
        });
    }
};

pub fn main(init: std.process.Init.Minimal) !void {
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

## 内存池优化

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

pub fn main(init: std.process.Init.Minimal) !void {
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

---

> 💡 **章节过渡**：从高级内存管理到性能优化与调试
> 
> 在[性能优化与调试](chapter-optimization.md)中，我们学习了高级内存管理技巧，掌握了自定义分配器和内存池的实现。
> 现在，我们将学习性能优化与调试，了解如何分析和优化程序性能。
> 
> **为什么高级内存管理是性能优化的基础？**
> 
> 1. **性能瓶颈**：内存管理往往是性能瓶颈所在
> 2. **优化手段**：自定义分配器是重要的性能优化手段
> 3. **调试技巧**：内存问题需要专门的调试工具和方法
> 
> **学习建议**：
> - 回顾前面章节学到的优化技巧
> - 学习使用性能分析工具
> - 掌握调试内存问题的方法
