# 实战案例 - 内存池实现

> **章节定位**：这一章属于第三部分中的“实现型案例”。  
> 它不是为了告诉你“内存池一定比通用分配器更高级”，而是借助一个足够小、足够清楚的实现，帮助你理解：
>
> - 为什么对象池会存在
> - 它依赖哪些核心不变量
> - `acquire` / `release` 这类接口真正承诺了什么
> - 为什么高性能实现通常也意味着更强的调用约束
>
> 本章的重点不是“记住一份代码”，而是学会判断：
>
> > **什么时候内存池值得引入，什么时候它只是在增加复杂度。**
>
> **相关阅读与衔接建议**
>
> - 如果你想先补齐资源所有权、分配器传递和失败路径清理的基础，请先回看第二部分的[内存管理模型](../part2-advanced/chapter-memory-management.md)。
> - 如果你更关心“对象池进一步优化之后会带来哪些额外约束”，可以在读完本章后继续阅读[高级内存管理技巧（专题）](chapter-advanced-memory.md)。
> - 如果你更关心“字段组织、默认值和接口建模”而不是对象复用，那么下一章的[实战案例 - 配置系统原型](chapter-config-system.md)会把注意力从资源复用切换到配置抽象。
>
> 这一组交叉阅读关系很重要，因为第三部分里的案例并不是彼此孤立的：
>
> - 内存池强调**固定形状对象的复用**
> - 配置系统强调**字段元信息与接口结构**
> - 高级内存专题强调**什么时候值得继续向更底层优化**
>
> 把这三章连起来读，会更容易建立“什么时候该优化资源获取、什么时候该先把抽象边界讲清楚”的判断。

---

## 先问一个更本质的问题：为什么要做内存池？

内存池适合解决一类非常具体的问题：

- 对象会被频繁创建和释放
- 对象大小固定，或至少形状非常稳定
- 你希望减少堆分配次数
- 你希望减轻内存碎片问题
- 你希望把“对象可复用”这件事表达得更明确

典型例子包括：

- 游戏中的粒子对象
- 任务调度器中的任务节点
- 服务器中的连接上下文槽位
- 编译器或解析器中的短生命周期节点
- 固定尺寸缓存块

但同样重要的是，内存池**并不适合所有场景**。  
如果你的对象：

- 大小变化很大
- 生命周期交错复杂
- 上界很难预测
- 当前瓶颈根本不在分配器上

那么直接使用通用分配器通常更简单，也更稳妥。

所以，内存池不是“默认更好”，而是一种**针对特定约束的优化性设计**。

---

## 这一章的实现目标

我们将实现一个教学用最小内存池，并围绕它讲清楚四件事：

1. **数据布局是什么**
2. **哪些不变量必须始终成立**
3. **接口契约是什么**
4. **哪些错误当前实现不主动防御，而是依赖调用者遵守前提**

这四件事比“代码逐行解释”更重要。  
因为真正理解内存池，不是看懂 `for` 循环和指针算术，而是知道：

- 什么状态可以信任
- 什么行为会破坏模型
- 什么约束是性能换来的代价

---

## 先给出实现

```zig
const std = @import("std");

fn MemoryPool(comptime T: type) type {
    comptime {
        if (@sizeOf(T) == 0) {
            @compileError("MemoryPool 不支持零大小类型");
        }
    }

    return struct {
        const Self = @This();

        items: []T,
        used: []bool,
        allocator: std.mem.Allocator,
        count: usize,

        pub fn init(allocator: std.mem.Allocator, capacity: usize) !Self {
            const items = try allocator.alloc(T, capacity);
            errdefer allocator.free(items);

            const used = try allocator.alloc(bool, capacity);
            errdefer allocator.free(used);

            @memset(used, false);

            return .{
                .items = items,
                .used = used,
                .allocator = allocator,
                .count = 0,
            };
        }

        pub fn deinit(self: *Self) void {
            self.allocator.free(self.items);
            self.allocator.free(self.used);
        }

        pub fn acquire(self: *Self) ?*T {
            for (self.used, 0..) |is_used, index| {
                if (!is_used) {
                    self.used[index] = true;
                    self.count += 1;
                    return &self.items[index];
                }
            }
            return null;
        }

        pub fn release(self: *Self, item: *T) void {
            const base_addr = @intFromPtr(self.items.ptr);
            const item_addr = @intFromPtr(item);
            const offset = item_addr - base_addr;
            const index = offset / @sizeOf(T);

            if (index < self.used.len and self.used[index]) {
                self.used[index] = false;
                self.count -= 1;
            }
        }

        pub fn getStats(self: *const Self) struct {
            total: usize,
            used: usize,
            free: usize,
        } {
            return .{
                .total = self.items.len,
                .used = self.count,
                .free = self.items.len - self.count,
            };
        }
    };
}

test "memory pool basic lifecycle" {
    var pool = try MemoryPool(i32).init(std.testing.allocator, 4);
    defer pool.deinit();

    const a = pool.acquire().?;
    const b = pool.acquire().?;

    a.* = 10;
    b.* = 20;

    try std.testing.expectEqual(@as(i32, 10), a.*);
    try std.testing.expectEqual(@as(i32, 20), b.*);

    var stats = pool.getStats();
    try std.testing.expectEqual(@as(usize, 4), stats.total);
    try std.testing.expectEqual(@as(usize, 2), stats.used);
    try std.testing.expectEqual(@as(usize, 2), stats.free);

    pool.release(a);
    pool.release(b);

    stats = pool.getStats();
    try std.testing.expectEqual(@as(usize, 0), stats.used);
    try std.testing.expectEqual(@as(usize, 4), stats.free);
}
```

先不要急着看细节。  
这份实现最重要的不是“它怎么写”，而是“它依赖什么成立”。

---

## 先理解数据布局

这个最小内存池由四部分核心状态组成：

- `items: []T`
- `used: []bool`
- `allocator: std.mem.Allocator`
- `count: usize`

### 1. `items`

`items` 是真正存放对象槽位的连续内存。

你可以把它理解成：

> “池里所有可复用对象的物理存储区。”

如果容量是 10，那么 `items[0]` 到 `items[9]` 就是 10 个可反复借出和归还的槽位。

### 2. `used`

`used` 和 `items` 一一对应：

- `used[i] == true` 表示 `items[i]` 当前已借出
- `used[i] == false` 表示 `items[i]` 当前空闲可用

因此，它本质上是一个“占用位图的最简单版本”。

### 3. `allocator`

它负责在初始化时分配 `items` 和 `used`，并在销毁时回收它们。

这延续了 Zig 的标准设计原则：

> **分配器要显式传入，而不是偷偷藏在全局状态里。**

### 4. `count`

`count` 表示当前已借出的对象数量。  
它的作用不是必需，但非常有用：

- 快速提供统计信息
- 避免每次都遍历 `used`
- 帮助我们检查池状态是否大致合理

---

## 这个实现依赖哪些不变量？

这是整章最重要的部分。

### 不变量 1：`items.len == used.len`

每个对象槽位必须对应一个使用标记。  
如果这两者长度不同，那么：

- `used` 就无法准确描述每个槽位状态
- `acquire` 和 `release` 的索引逻辑就会失去意义

在当前实现里，这个不变量由 `init` 保证：

- `items` 按 `capacity` 分配
- `used` 也按同样的 `capacity` 分配

### 不变量 2：`count` 必须等于 `used == true` 的数量

也就是说：

- `count` 不能大于总容量
- `count` 不能小于 0（对 `usize` 来说就是不能下溢）
- `count` 应该始终反映“实际已借出对象数”

当前实现通过这两个操作维护它：

- `acquire` 成功时 `count += 1`
- `release` 成功归还时 `count -= 1`

### 不变量 3：`used[i] == false` 的槽位才允许被 `acquire`

这听起来像废话，但它就是对象池正确性的核心：

- 一个槽位不能同时借给两个调用者
- 一个调用者归还后，槽位才再次变为空闲

### 不变量 4：`release` 传入的指针必须来自当前池中的某个槽位

这是最关键、也最容易被忽略的接口契约之一。

当前实现默认信任调用者：

- 传入的 `item` 是从本池 `acquire()` 得到的
- 它仍然指向本池中的有效槽位
- 它没有被重复释放

一旦这个前提被破坏，`release` 的行为就不再可靠。

---

## 初始化阶段：池在建立什么状态？

看 `init`：

```zig
const items = try allocator.alloc(T, capacity);
errdefer allocator.free(items);

const used = try allocator.alloc(bool, capacity);
errdefer allocator.free(used);

@memset(used, false);
```

这里做了三件事：

1. 分配对象槽位数组
2. 分配占用标记数组
3. 把所有槽位初始化为空闲状态

这里使用 `errdefer` 确保初始化中途失败时已分配的资源被回滚（`errdefer` 详见[错误处理](../part1-basics/chapter-error-handling.md)）。

---

## `acquire`：借出对象时到底发生了什么？

实现如下：

```zig
pub fn acquire(self: *Self) ?*T {
    for (self.used, 0..) |is_used, index| {
        if (!is_used) {
            self.used[index] = true;
            self.count += 1;
            return &self.items[index];
        }
    }
    return null;
}
```

它的行为可以拆成四步：

1. 线性扫描 `used`
2. 找到第一个空闲槽位
3. 将其标记为已使用
4. 返回该槽位的指针

`acquire()` 返回 `?*T`：池满时返回 `null`，调用者必须显式处理。当前实现使用线性扫描，`acquire` 的时间复杂度为 `O(n)`。

---

## `release`：归还对象时真正困难的是什么？

实现如下：

```zig
pub fn release(self: *Self, item: *T) void {
    const base_addr = @intFromPtr(self.items.ptr);
    const item_addr = @intFromPtr(item);
    const offset = item_addr - base_addr;
    const index = offset / @sizeOf(T);

    if (index < self.used.len and self.used[index]) {
        self.used[index] = false;
        self.count -= 1;
    }
}
```

这是本章里最“危险但有代表性”的部分。

### 它在做什么？

因为 `release` 收到的是一个 `*T`，而不是槽位索引。  
所以它要先回答一个问题：

> 这个指针对应的是 `items` 里的第几个槽位？

于是代码通过指针地址做反推：

1. 取出池起始地址 `base_addr`
2. 取出目标对象地址 `item_addr`
3. 做地址差值得到偏移
4. 用元素大小除出索引

如果这个索引合法，并且当前槽位确实处于已使用状态，就把它改回空闲。

### 为什么这很高效？

因为它避免了“释放时再扫描整个池找这个对象”的成本。  
一旦前提成立，索引推导就是常数时间。

所以它的优点是：

- `release` 可以做到接近 `O(1)`
- 不需要维护额外查找结构
- 很符合固定槽位池的设计思路

### 但为什么它也危险？

因为它几乎完全依赖调用者守约。

当前实现没有完整防御以下情况：

- 传入的指针并不来自当前池
- 传入的指针不是槽位起始地址
- 同一个对象被重复释放
- 某个指针已经悬空
- 某个指针来自别的池，但地址碰巧落入某种危险区间

也就是说：

> **当前 `release` 更像“高信任契约接口”，而不是“强防御式接口”。**

这并不是教学实现的错误，  
但必须被明确写出来，不能让读者误以为它天然安全。

---

## 这个接口契约到底是什么？

可以把当前内存池的接口契约写得非常明确。

### `init(allocator, capacity)`

调用者承诺：

- 提供有效的分配器
- 容量表达的是池的固定上限

内存池承诺：

- 成功后，所有槽位都处于空闲状态
- 失败时不会泄漏初始化过程中已获取的资源

### `acquire()`

调用者承诺：

- 正常处理返回 `null` 的情况

内存池承诺：

- 如果返回非空指针，该指针对应一个独占槽位
- 在被释放前，这个槽位不会再次被借出

### `release(item)`

调用者承诺：

- `item` 确实来自当前池
- `item` 对应的是一个当前仍处于“已借出”状态的槽位
- 不会重复释放同一对象
- 不会传入伪造或失效指针

内存池承诺：

- 在这些前提成立时，槽位会重新变为空闲
- 后续 `acquire` 可以再次复用它

把这段契约看清楚，比记住代码本身更重要。  
因为很多高性能数据结构本质上都在做类似的交易：

- **更少的运行时防御**
- 换来更低的额外成本
- 前提是调用者必须更守规矩**

---

## 一个最容易被忽略的问题：复用意味着旧状态仍然存在

很多初学者第一次看对象池时，会潜意识觉得：

> “释放后，这个对象应该自动变回干净状态吧？”

但当前实现**没有**这么做。

例如：

```zig
const item = pool.acquire().?;
item.* = 123;
pool.release(item);

const reused = pool.acquire().?;
```

这里 `reused` 很可能就是刚才那个槽位。  
而如果没有额外清理，它里面可能仍然保留旧值 `123`。

这不是 bug，而是对象池模型的自然结果：

- 释放只是“归还槽位”
- 不等于“自动重置对象内容”

所以你必须显式考虑：

- 是由调用者在重新使用前覆盖全部字段？
- 还是在 `release` 时统一重置？
- 还是在 `acquire` 后做初始化？

这属于设计决策的一部分，不应默认含糊过去。

---

## 为什么这里不用“更聪明”的设计？

你可能会问：

- 为什么不用空闲链表？
- 为什么不用位图压缩？
- 为什么不做重复释放检测？
- 为什么不验证指针来源？

答案是：

> 因为本章当前目标是**先讲清楚模型和契约**。

如果一开始就把实现升级成：

- 空闲链表
- 调试断言
- 指针合法性检查
- 对象清零
- 线程同步
- 更复杂的统计字段

那么读者很容易在第一轮阅读中丢失重点。

教学上的更合理顺序通常是：

1. 先用最小版本理解模型
2. 再明确指出局限
3. 最后讨论如何增强

这比一开始就堆上“完整版”更适合学习。

---

## 这个实现适合什么场景？

当前版本更适合作为：

### 1. 教学型原型

你想先验证：

- 对象池模型是否适合这个问题
- 资源复用语义是否清楚
- 接口是否容易被调用方接受

### 2. 固定容量、单线程、小规模对象池

如果：

- 对象大小固定
- 容量上界明确
- 没有跨线程共享
- 可以接受线性扫描获取

那么这个版本已经足够说明思路。

### 3. 高频短生命周期对象

例如：

- 临时任务节点
- 事件对象
- 粒子对象
- 固定尺寸消息块

---

## 这个实现不适合什么场景？

当前版本**不适合直接拿去当生产组件**，尤其是这些情况：

### 1. 多线程共享访问

因为没有任何同步保护：

- `used` 会发生竞争
- `count` 会发生竞争
- 同一槽位可能被并发错误借出/归还

### 2. 调用方不可信

如果你不能保证调用方一定正确传入来自本池的指针，  
那当前 `release` 就不够安全。

### 3. 需要强防御式诊断

如果你希望组件主动检测：

- 重复释放
- 外来指针
- 非槽位边界指针
- 使用后释放

那当前实现还远远不够。

### 4. 容量不可预测

当前容量在初始化后固定，池满时只能返回 `null`。  
如果业务上界不清晰，或需要弹性扩容，这个模型就要继续演进。

### 5. 对象需要复杂清理逻辑

如果对象内部持有其他资源，例如：

- 其他堆内存
- 文件句柄
- 网络连接
- 锁或句柄

那么“释放槽位”不等于“完成对象析构”。  
这种场景必须更小心设计对象生命周期。

---

## 如果继续演进，下一步通常会怎么改？

在真正工程里，最常见的增强方向通常有下面几类。

## 1. 用空闲链表替代线性扫描

这样可以把 `acquire()` 从 `O(n)` 改进为更稳定的接近 `O(1)`。

代价是：

- 结构更复杂
- 需要维护额外状态
- 更难讲清楚第一次实现

## 2. 增加 Debug 模式下的合法性检查

例如验证：

- 指针是否落在池范围内
- 偏移是否对齐到对象边界
- 是否发生重复释放

这会让教学实现更安全，也更适合调试。

## 3. 在 `release()` 时重置对象

例如：

- 清零对象
- 调用显式 `reset`
- 清除敏感状态

这样可以减少“旧状态残留”问题，  
但也会增加额外开销，并引入“重置策略属于谁”的设计问题。

## 4. 增加线程安全

通过：

- 互斥锁
- 原子操作
- 分段池
- 线程局部池

让对象池适应并发环境。

但这已经不再是“最小内存池”，而是另一个工程主题。

## 5. 分离调试模式和发布模式

例如：

- Debug 模式做更强检查
- Release 模式保留更轻量逻辑

这通常是高性能组件很常见的做法。

---

## 从这章真正应该学到什么？

如果你只把这章理解成“一个泛型数据结构示例”，那其实还不够。

这章真正要教你的，是下面这些判断。

### 1. 内存池的价值来自“复用”和“边界清楚”

不是所有分配器问题都需要对象池。  
对象池只对一类约束明确的问题有效。

### 2. 高性能设计经常依赖接口契约

很多时候，速度不是白来的。  
它往往来自：

- 更少的抽象层
- 更少的检查
- 更明确的前提
- 更强的调用方责任

### 3. 不变量比逐行代码更值得先理解

只要你能始终抓住：

- `items` 和 `used` 一一对应
- `count` 反映借出数量
- 每个槽位同一时刻只能被一个调用者持有
- `release` 只能处理来自本池的有效指针

那你对这个实现就已经抓住了核心。

### 4. 教学实现和生产实现不是一回事

一个教学实现可以故意保留简化：

- 它的目标是让结构变清楚
- 不是一次性变成“可上线组件”

能区分这点，是阅读第三部分案例时非常重要的能力。

---

## 小结

这一章最重要的，不是“你会不会手写一个对象池”，而是你是否已经开始形成这些工程判断：

- 什么时候对象池值得引入？
- 它依赖哪些不变量？
- `acquire` 和 `release` 的接口契约是什么？
- 为什么 `release` 的高效实现也意味着更强前提？
- 为什么对象复用不等于对象自动重置？
- 为什么教学代码必须明确写出它**没有**防御哪些错误？

如果你读完这一章后，已经能自然地问出这些问题，那么这一章就达到目的了。

---

> 💡 **下一章预告**
>
> 下一章我们将进入 [实战案例 - 配置系统原型](chapter-config-system.md)，继续讨论：当你把若干字段、默认值、类型信息和校验逻辑组织起来时，应该怎样区分“教学原型”和“工程化设计”。