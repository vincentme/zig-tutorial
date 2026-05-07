# 实战案例 - 有限状态机

> **章节定位**：本章通过 `comptime` 泛型把状态、事件与转移规则集中到一张表格中，聚焦 State / Event / Transition 三层抽象的核心思路。主动放弃查找表优化、层次状态等生产级特性，保持教学原型的简洁。

## 设计思路

先用一段熟悉的代码看问题：分散的 `if/else` 做模式切换。

```zig
if (mode == .normal) {
    if (key == 'i') mode = .insert;
} else if (mode == .insert) {
    if (key == 27) mode = .normal;
} else if (mode == .visual) {
    // ...
}
```

分支嵌套越深，状态转移越难追踪。新增一个状态时，所有相关分支都要改动，遗漏就是 Bug。

根本原因：状态机的核心规则——"在某个状态下，收到某个事件，转移到哪个状态"——被分散在了各处的 `if` 里。把规则提取成一张表格，结构立刻清晰：

| 当前状态 | 事件 | 下一状态 |
| -------- | ---- | -------- |
| Normal   | i    | Insert   |
| Insert   | Esc  | Normal   |
| Normal   | v    | Visual   |

状态机的本质就是这张表的程序化表达：**在给定状态下，当某个事件到达时，确定下一个状态是什么**——以及是否需要前置检查（guard）和后置动作（action）。

## 从具体到泛型：为什么需要类型工厂

如果只为交通灯写一个状态机，可以直接用 struct + switch：

```zig
const TrafficLight = struct {
    state: enum { red, green, yellow } = .red,

    fn tick(self: *TrafficLight) void {
        self.state = switch (self.state) {
            .red => .green,
            .green => .yellow,
            .yellow => .red,
        };
    }
};
```

三行代码，清晰直观。但当有第二个、第三个场景（编辑器模式、网络协议状态、UI 页面栈）时，每个都要重写一遍近似的 struct——状态枚举不同、事件枚举不同、上下文字段不同，但`查表 → 检查 → 转移 → 回调` 这个逻辑完全一样。

Zig 的解决方式是 `comptime` 类型工厂：把 State（可到达状态的枚举）、Event（触发转移的事件枚举）、Context（guard 和 action 共享的可变数据）作为编译期参数传入，生成的结构体对所有场景复用同一套逻辑。

## 泛型实现

类型工厂接收三个编译期参数：

```zig
fn StateMachine(comptime State: type, comptime Event: type, comptime Context: type) type
```

返回的结构体包含四个关键成员：

- **`current`**：运行时当前状态值
- **`ctx`**：用户定义的可变上下文，guard 和 action 通过 `*Context` 读写
- **`transitions`**：`[]const Transition` 切片，每一条描述「从 A 状态 + E 事件 → 到 B 状态」
- **`init` / `processEvent` / `getCurrentState`**：创建实例、驱动转移、查询状态的三个公开方法

其中 `Transition` 的结构：

```zig
const Transition = struct {
    from: State,                                        // 起始状态
    to: State,                                          // 目标状态
    event: Event,                                       // 触发事件
    guard: ?*const fn (ctx: *Context) bool = null,      // 前置条件，返回 false 则跳过此规则
    action: ?*const fn (ctx: *Context) void = null,     // 转移成功后的回调
};
```

guard 和 action 都是可选的函数指针（`?*const fn`）。`if (t.guard) |g|` 是可选类型解包：`t.guard` 为 `null` 时跳过该块，非空时将函数指针绑定到 `g` 并调用。这一模式与 `while (reader.takeDelimiter(...)) |line|` 中的可选解包一致——详见[控制流章节](../part1-basics/chapter-control-flow.md)。`processEvent` 的核心逻辑：遍历转移表 → 匹配 `from == current && event == event` → 检查 guard → 执行 action → 更新 state → 返回。没有匹配的规则时返回 `error.NoTransition`。

## 完整代码

以下完整实现含一个红绿灯测试：Red → Green → Yellow → Red，每次 Tick 切换并打印。

```zig
const std = @import("std");

// ── 状态机：类型工厂 ──
fn StateMachine(comptime State: type, comptime Event: type, comptime Context: type) type {
    return struct {
        const Self = @This();

        // 单条转移规则
        const Transition = struct {
            from: State,                                    // 起始状态
            to: State,                                      // 目标状态
            event: Event,                                   // 触发事件
            guard: ?*const fn (ctx: *Context) bool = null,  // 前置条件（可选）
            action: ?*const fn (ctx: *Context) void = null, // 转移后动作（可选）
        };

        current: State,           // 运行时当前状态
        ctx: Context,             // 用户自定义上下文（guard 和 action 共享访问）
        transitions: []const Transition, // 转移规则表（编译期已知）

        // 创建状态机实例
        pub fn init(initial: State, ctx: Context, transitions: []const Transition) Self {
            return .{ .current = initial, .ctx = ctx, .transitions = transitions };
        }

        // 处理一个事件：查表 → 校验 guard → 执行 action → 更新状态
        pub fn processEvent(self: *Self, event: Event) !void {
            for (self.transitions) |t| {                     // 遍历所有转移规则
                if (t.from == self.current and t.event == event) { // 匹配当前状态和事件
                    if (t.guard) |g| {                       // 存在 guard 则先校验
                        if (!g(&self.ctx)) continue;         // guard 拒绝则跳过本条规则
                    }
                    self.current = t.to;                     // 更新为下一状态
                    if (t.action) |a| a(&self.ctx);          // 存在 action 则执行副作用
                    return;                                  // 命中第一条即返回（优先级）
                }
            }
            return error.NoTransition;                       // 无匹配规则
        }

        // 只读查询当前状态
        pub fn getCurrentState(self: *const Self) State {
            return self.current;
        }
    };
}

// ── 红绿灯示例：三种状态、一种事件 ──

const LightState = enum { red, green, yellow };
const LightEvent = enum { tick };
const LightCtx = struct {};            // 红绿灯不需要额外上下文

fn toGreen(_: *LightCtx) void { std.debug.print("→ Green\n",  .{}); }
fn toYellow(_: *LightCtx) void { std.debug.print("→ Yellow\n",  .{}); }
fn toRed(_: *LightCtx) void { std.debug.print("→ Red\n",  .{}); }

test "traffic light state machine" {
    // 编译期生成 Red → Green → Yellow → Red 的状态机类型
    const SM = StateMachine(LightState, LightEvent, LightCtx);

    // 声明转移规则表：每条规则描述 from + event → to，附带 action 回调
    const transitions = [_]SM.Transition{
        .{ .from = .red,    .to = .green,  .event = .tick, .action = toGreen },
        .{ .from = .green,  .to = .yellow, .event = .tick, .action = toYellow },
        .{ .from = .yellow, .to = .red,    .event = .tick, .action = toRed },
    };

    var sm = SM.init(.red, .{}, &transitions);   // 初始状态 Red，空上下文
    try std.testing.expectEqual(LightState.red, sm.getCurrentState());

    try sm.processEvent(.tick);                  // 输出 → Green
    try std.testing.expectEqual(LightState.green, sm.getCurrentState());

    try sm.processEvent(.tick);                  // 输出 → Yellow
    try std.testing.expectEqual(LightState.yellow, sm.getCurrentState());

    try sm.processEvent(.tick);                  // 输出 → Red（回到起点）
    try std.testing.expectEqual(LightState.red, sm.getCurrentState());
}
```

这段代码反映了泛型状态机的几个设计选择：

1. **转移表在编译期确定**——状态和事件都是枚举，拼写错误会在编译期暴露
2. **`processEvent` 做一次 O(n) 遍历**——对教学原型足够；实际场景中转移规则通常不超过几十条
3. **guard 和 action 是函数指针**——不持有状态，只通过 `*Context` 读写用户数据。Context 为空结构体时（如 `LightCtx`），它们退化为基础回调

## guard 与 action

上面红绿灯只用到了 `action`——每次 Tick 切换到下一盏灯并打印。guard 和 action 的典型组合场景是：guard 在转移前做条件校验，action 在转移成功后执行副作用。下面用编辑器模式切换的案例同时展示：

- 三种模式：Normal、Insert、Visual
- `i` 进入 Insert，`Esc` 回 Normal，`v` 进入 Visual
- **不允许从 Visual 直接跳到 Insert**——用 guard 拒绝
- 每次成功切换**用 action 记录次数并打印**

```zig
const EditorMode = enum { normal, insert, visual };
const EditorEvent = enum { press_i, press_esc, press_v };

const EditorCtx = struct {
    changes: usize = 0,          // 累计切换次数
};

fn reject(_: *EditorCtx) bool { return false; }  // 始终拒绝的 guard

fn logChange(ctx: *EditorCtx) void {
    ctx.changes += 1;
    std.debug.print("模式切换（共 {} 次）\n", .{ctx.changes});
}

test "editor mode with guard and action" {
    const SM = StateMachine(EditorMode, EditorEvent, EditorCtx);

    const transitions = [_]SM.Transition{
        .{ .from = .normal, .to = .insert, .event = .press_i,   .action = logChange },
        .{ .from = .insert, .to = .normal, .event = .press_esc, .action = logChange },
        .{ .from = .normal, .to = .visual, .event = .press_v,   .action = logChange },
        .{ .from = .visual, .to = .normal, .event = .press_esc, .action = logChange },
        .{ .from = .visual, .to = .insert, .event = .press_i,   .guard = reject }, // 被 guard 拒绝
    };

    var sm = SM.init(.normal, .{}, &transitions);

    // 1: normal → insert
    try sm.processEvent(.press_i);
    try std.testing.expectEqual(EditorMode.insert, sm.getCurrentState());

    // 2: insert → normal
    try sm.processEvent(.press_esc);
    try std.testing.expectEqual(EditorMode.normal, sm.getCurrentState());

    // 3: normal → visual
    try sm.processEvent(.press_v);
    try std.testing.expectEqual(EditorMode.visual, sm.getCurrentState());

    // 4: press_i 被 guard 拒绝——停留在 visual
    try std.testing.expectError(error.NoTransition, sm.processEvent(.press_i));
    try std.testing.expectEqual(EditorMode.visual, sm.getCurrentState());

    // 5: visual → normal
    try sm.processEvent(.press_esc);
    try std.testing.expectEqual(EditorMode.normal, sm.getCurrentState());

    // 共 4 次成功切换：1, 2, 3, 5 各一次
    try std.testing.expectEqual(@as(usize, 4), sm.ctx.changes);
}
```

规则 5 的 `reject` 始终返回 `false`——即使 `from` 和 `event` 都匹配，guard 也会强制跳过。当所有规则都被跳过，`processEvent` 落到函数末尾返回 `error.NoTransition`。

Context 在这里是跨转移共享状态的载体：`logChange` 每执行一次，`changes` 加 1。状态机只负责推进状态，副作用完全委托给 action——这是一种清晰的职责分离。

## 与完整实现的差距

本章原型解决了核心问题：**状态转移规则如何集中声明和遍历**。从原型走向生产级实现还需要几层：

| 原型（本章） | 完整实现 |
| ------------ | -------- |
| O(n) 遍历转移表 | 预编译查找表（`from+event → to` 的 O(1) 映射） |
| 单一当前状态 | 层次状态（父子嵌套），支持 OnEnter / OnExit 钩子 |
| 无历史记录 | 状态历史栈，支持回到上一状态 |
| guard 失败 = 无动作 | 对 guard 失败提供专门错误类型或 fallback 转移 |
| 纯 comptime 泛型 | 兼顾运行时动态添加转移规则 |

本章的价值不在于这份实现本身——而在理解 State / Event / Transition 三层抽象。一旦建立这个心智模型，所有优化都是围绕这张转移表展开的，而非推翻它。
