# 【draft】SIMD 向量编程

Zig 提供了对 SIMD（单指令多数据）的原生支持，允许进行高性能向量运算。

## 向量类型

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    // 定义向量类型：4 个 f32
    const Vec4 = @Vector(4, f32);
    
    // 创建向量
    const a: Vec4 = .{ 1.0, 2.0, 3.0, 4.0 };
    const b: Vec4 = .{ 5.0, 6.0, 7.0, 8.0 };
    
    // 向量运算（SIMD 优化）
    const sum = a + b;
    const diff = a - b;
    const prod = a * b;
    const quot = a / b;
    
    std.debug.print("sum: {any}\n", .{sum});
    std.debug.print("diff: {any}\n", .{diff});
    std.debug.print("prod: {any}\n", .{prod});
    std.debug.print("quot: {any}\n", .{quot});
    
    // 向量与标量运算
    const scaled = a * @as(f32, 2.0);
    std.debug.print("scaled: {any}\n", .{scaled});
}
```

## 向量操作

```zig
const std = @import("std");

pub fn main(init: std.process.Init.Minimal) void {
    const Vec8 = @Vector(8, i32);
    
    const a: Vec8 = .{ 1, 2, 3, 4, 5, 6, 7, 8 };
    const b: Vec8 = .{ 8, 7, 6, 5, 4, 3, 2, 1 };
    
    // 向量比较（返回布尔向量）
    const cmp = a < b;
    std.debug.print("a < b: {any}\n", .{cmp});
    
    // 向量混合（基于掩码）
    const mixed = @select(i32, cmp, a, b);
    std.debug.print("mixed: {any}\n", .{mixed});
    
    // 向量归约
    const sum = @reduce(.Add, a);
    const min = @reduce(.Min, a);
    const max = @reduce(.Max, a);
    
    std.debug.print("sum: {}, min: {}, max: {}\n", .{ sum, min, max });
    
    // 向量洗牌
    const shuffled = @shuffle(i32, a, b, [_]i32{ 0, 8, 2, 10, 4, 12, 6, 14 });
    std.debug.print("shuffled: {any}\n", .{shuffled});
}
```

## 实际应用：向量点积

```zig
const std = @import("std");

fn dotProduct(comptime N: usize, a: @Vector(N, f32), b: @Vector(N, f32)) f32 {
    const prod = a * b;
    return @reduce(.Add, prod);
}

pub fn main(init: std.process.Init.Minimal) void {
    const Vec4 = @Vector(4, f32);
    
    const v1: Vec4 = .{ 1.0, 2.0, 3.0, 4.0 };
    const v2: Vec4 = .{ 5.0, 6.0, 7.0, 8.0 };
    
    const dot = dotProduct(4, v1, v2);
    std.debug.print("点积：{}\n", .{dot}); // 1*5 + 2*6 + 3*7 + 4*8 = 70
}
```

---

> 💡 **章节过渡**：从 SIMD 到异步编程
> 
> 在[异步编程（未来规划）](chapter-async.md)中，我们学习了 SIMD 向量编程，掌握了如何利用硬件并行性提升性能。
> 现在，我们将了解异步编程的未来规划，理解 Zig 的并发编程发展方向。
> 
> **为什么 SIMD 是异步编程的基础？**
> 
> 1. **并行计算**：SIMD 提供数据级并行，异步提供任务级并行
> 2. **性能优化**：两者都是提升性能的重要手段
> 3. **硬件利用**：SIMD 利用向量单元，异步利用 I/O 等待时间
> 
> **学习建议**：
> - 理解 SIMD 和异步编程的区别
> - 关注 Zig 异步编程的最新进展
> - 当前使用线程进行并发编程
