# 实战案例 - TOML 解析器

## 设计思路

结构化文本解析的核心困境：同一个字符在不同上下文中含义完全不同。

以 TOML 为例——`=` 出现在 `[section]` 里只是普通字符，出现在 `port = 8080` 里却是键值分隔符。`#` 出现在双引号内部是字符串的一部分，出现在行首则意味着整行被注释掉。如果把所有判断逻辑用嵌套的 `if/else` 写在一起，代码很快就变成一堵不可维护的墙。

解决方式上一章已经讨论过——State / Event / Transition。这里的区别只是：不需要泛型表格。一个 `Parser` 结构体，几个跟踪上下文的字段，就够了。

`pos` 推进输入光标，`current_section` 记录"当前在哪个节里"，`root` 和 `sections` 存储解析结果。把这几个字段看作一个状态机：`(pos, current_section)` 组合定义了当前状态，每一行输入是事件，处理完一行后状态向前转移——或者推进光标，或者切换节名，或者两者同时发生。

> 这个手写状态机的转移表就是主循环里那几个 `if` 分支。对于几十行配置规模来说足够了；对于规则持续膨胀的场景，表格化的优势才显现。

## 数据结构

解析结果需要存储四种字面量类型。`Value` 用标记联合表示，`Table` 是字符串到值的映射：

```zig
const Value = union(enum) {
    string: []const u8,
    integer: i64,
    float: f64,
    boolean: bool,
};

const Table = std.StringHashMap(Value);
```

`Table` 的键是字段名，值可能是指向原始输入切片的字符串，或是解析出的数值。对于教学原型来说，把键名和字符串值直接指向原始内存是可行的——只要输入数据在解析器生命周期内不被回收。

## 解析器状态

```zig
const Parser = struct {
    input: []const u8,
    pos: usize,
    current_section: []const u8,
    gpa: std.mem.Allocator,
    sections: std.StringHashMap(Table),
    root: Table,

    pub const Error = error{
        InvalidSyntax,
        UnexpectedChar,
        ValueExpected,
    };

    pub fn init(input: []const u8, gpa: std.mem.Allocator) Parser {
        return .{
            .input = input,
            .pos = 0,
            .current_section = "",
            .gpa = gpa,
            .sections = std.StringHashMap(Table).init(gpa),
            .root = Table.init(gpa),
        };
    }
};
```

`current_section` 初始为空串，代表根表——在第一个 `[section]` 出现之前，所有键值对都写入 `root`。一旦遇到节头，`current_section` 切换为节名，后续键值对写入 `sections` 中对应的 `Table`。`gpa` 字段被存储下来，因为每次遇到新节名需要动态创建新的 `Table`。

需注意 0.16 中 `HashMap` 的 API 设计：`init(gpa)` 将分配器存入内部，此后的 `put`、`deinit` 都不再接受显式的分配器参数。这一改动使得"持有 `Table` 值的 `HashMap`"——即 `sections`——的逐层释放变得清晰：外层 map 只管自己的内部数组，内层 `Table` 各自负责自己的内存。

清理逻辑：

```zig
pub fn deinit(self: *Parser) void {
    self.root.deinit();
    var it = self.sections.iterator();
    while (it.next()) |entry| {
        entry.value_ptr.deinit();
    }
    self.sections.deinit();
}
```

## 逐行解析主循环

面向行的 TOML 子集不需要逐字符扫描——按换行切分后逐行处理即可。

```zig
pub fn parse(self: *Parser) !void {
    var lines = std.mem.splitScalar(u8, self.input, '\n');
    while (lines.next()) |raw_line| {
        var line = std.mem.trim(u8, raw_line, " \t\r");
        if (line.len == 0) continue;
        if (line[0] == '#') continue;

        if (line[0] == '[') {
            // 节头：提取节名，切换上下文
            if (line[line.len - 1] != ']') return error.InvalidSyntax;
            const section_name = line[1 .. line.len - 1];
            self.current_section = section_name;
            if (!self.sections.contains(section_name)) {
                try self.sections.put(section_name, Table.init(self.gpa));
            }
            continue;
        }

        if (self.findEq(line)) |eq_pos| {
            // 键值对：拆分并解析。findEq 会跳过引号内的 '='
            const key = std.mem.trim(u8, line[0..eq_pos], " \t");
            const raw_value = std.mem.trim(u8, line[eq_pos + 1 ..], " \t");
            const value = try parseValue(raw_value);
            var table = if (self.current_section.len == 0)
                &self.root
            else
                self.sections.getPtr(self.current_section).?;
            try table.put(key, value);
            continue;
        }

        return error.InvalidSyntax;
    }
}

fn findEq(line: []const u8) ?usize {
    var in_string = false;
    for (line, 0..) |ch, i| {
        if (ch == '"') in_string = !in_string;
        if (ch == '=' and !in_string) return i;
    }
    return null;
}

四条分支覆盖了所有 TOML 行的类型：

1. **空行、注释**——跳过。
2. **节头**——提取 `[...]` 内的节名，若不存在则创建新表，切换 `current_section`。节名中的点号（如 `parent.child`）在这里只是普通字符，`StringHashMap` 按完整字符串做键。
3. **键值对**——用 `findEq` 查找引号外的第一个 `=` 做拆分，避免字符串内部等号误判。拆分后两边去空白，调用类型解析，存入当前节对应的 `Table`。根节的表存在 `root` 中，其余在 `sections` 里。
4. **无法识别的行**——返回 `InvalidSyntax`。

注意 `sections.getPtr(self.current_section)` 依赖 `StringHashMap` 对字符串内容做比较而非指针相等——`current_section` 指向原始输入，`sections` 内部存着 `put` 时刻复制的键副本，但内容相同就能匹配。

## 类型解析

`parseValue` 根据右侧文本的特征判定类型。判定顺序有讲究：引号优先，避免 `"true"` 被当成布尔、`"3.14"` 被当成浮点。

```zig
fn parseValue(raw: []const u8) Parser.Error!Value {
    if (raw.len == 0) return error.ValueExpected;

    if (raw[0] == '"') {
        if (raw.len < 2 or raw[raw.len - 1] != '"')
            return error.InvalidSyntax;
        return .{ .string = raw[1 .. raw.len - 1] };
    }

    if (std.mem.eql(u8, raw, "true")) return .{ .boolean = true };
    if (std.mem.eql(u8, raw, "false")) return .{ .boolean = false };

    if (std.mem.indexOfScalar(u8, raw, '.') != null) {
        const f = std.fmt.parseFloat(f64, raw) catch
            return error.InvalidSyntax;
        return .{ .float = f };
    }

    const i = std.fmt.parseInt(i64, raw, 10) catch
        return error.InvalidSyntax;
    return .{ .integer = i };
}
```

浮点与整数的分派用 `indexOfScalar` 检测 `.` 字符——这能正确处理 `3.14`、`-1.5` 和 `100` 等常见形式，但对科学计数法（如 `1e10`）会误判为整数解析。这个子集不考虑。

## 完整代码与测试

下面用一个典型的服务端配置文本验证所有路径——根表字符串、`[server]` 节、`[database]` 节，每条覆盖一种值类型。

```zig
const std = @import("std");

const Value = union(enum) {
    string: []const u8,
    integer: i64,
    float: f64,
    boolean: bool,
};

const Table = std.StringHashMap(Value);

const Parser = struct {
    input: []const u8,
    pos: usize,
    current_section: []const u8,
    gpa: std.mem.Allocator,
    sections: std.StringHashMap(Table),
    root: Table,

    pub const Error = error{
        InvalidSyntax,
        UnexpectedChar,
        ValueExpected,
    };

    /// 查找行中第一个引号外的 '='——跳过字符串内部的等号。
    fn findEq(line: []const u8) ?usize {
        var in_string = false;
        for (line, 0..) |ch, i| {
            if (ch == '"') in_string = !in_string;
            if (ch == '=' and !in_string) return i;
        }
        return null;
    }

    pub fn init(input: []const u8, gpa: std.mem.Allocator) Parser {
        return .{
            .input = input,
            .pos = 0,
            .current_section = "",
            .gpa = gpa,
            .sections = std.StringHashMap(Table).init(gpa),
            .root = Table.init(gpa),
        };
    }

    pub fn deinit(self: *Parser) void {
        self.root.deinit();
        var it = self.sections.iterator();
        while (it.next()) |entry| {
            entry.value_ptr.deinit();
        }
        self.sections.deinit();
    }

    fn parseValue(raw: []const u8) Error!Value {
        if (raw.len == 0) return error.ValueExpected;
        if (raw[0] == '"') {
            if (raw.len < 2 or raw[raw.len - 1] != '"')
                return error.InvalidSyntax;
            return .{ .string = raw[1 .. raw.len - 1] };
        }
        if (std.mem.eql(u8, raw, "true")) return .{ .boolean = true };
        if (std.mem.eql(u8, raw, "false")) return .{ .boolean = false };
        if (std.mem.indexOfScalar(u8, raw, '.') != null) {
            const f = std.fmt.parseFloat(f64, raw) catch
                return error.InvalidSyntax;
            return .{ .float = f };
        }
        const i = std.fmt.parseInt(i64, raw, 10) catch
            return error.InvalidSyntax;
        return .{ .integer = i };
    }

    pub fn parse(self: *Parser) !void {
        var lines = std.mem.splitScalar(u8, self.input, '\n');
        while (lines.next()) |raw_line| {
            var line = std.mem.trim(u8, raw_line, " \t\r");
            if (line.len == 0) continue;
            if (line[0] == '#') continue;
            if (line[0] == '[') {
                if (line[line.len - 1] != ']')
                    return error.InvalidSyntax;
                const section_name = line[1 .. line.len - 1];
                self.current_section = section_name;
                if (!self.sections.contains(section_name)) {
                    try self.sections.put(
                        section_name,
                        Table.init(self.gpa),
                    );
                }
                continue;
            }
            if (findEq(line)) |eq_pos| {
                const key = std.mem.trim(u8, line[0..eq_pos], " \t");
                const raw_value = std.mem.trim(
                    u8,
                    line[eq_pos + 1 ..],
                    " \t",
                );
                const value = try parseValue(raw_value);
                var table = if (self.current_section.len == 0)
                    &self.root
                else
                    self.sections.getPtr(self.current_section).?;
                try table.put(key, value);
                continue;
            }
            return error.InvalidSyntax;
        }
    }
};

test "toml parser" {
    const toml_input =
        \\title = "My App Config"
        \\
        \\[server]
        \\host = "0.0.0.0"
        \\port = 8080
        \\
        \\[database]
        \\url = "postgres://localhost:5432"
        \\max_connections = 100
    ;

    const allocator = std.testing.allocator;

    var parser = Parser.init(toml_input, allocator);
    defer parser.deinit();

    try parser.parse();

    try std.testing.expectEqualStrings(
        "My App Config",
        parser.root.get("title").?.string,
    );

    const server = parser.sections.get("server").?;
    try std.testing.expectEqualStrings(
        "0.0.0.0",
        server.get("host").?.string,
    );
    try std.testing.expectEqual(
        @as(i64, 8080),
        server.get("port").?.integer,
    );

    const database = parser.sections.get("database").?;
    try std.testing.expectEqualStrings(
        "postgres://localhost:5432",
        database.get("url").?.string,
    );
    try std.testing.expectEqual(
        @as(i64, 100),
        database.get("max_connections").?.integer,
    );
}
```

运行 `zig test <file>.zig`，三个节、六条键值全部通过断言。

## 与状态机章的关系

这个解析器没有 `@import` 上一章的泛型状态机，但思想完全相同。

把 `Parser` 结构体拆开看：`current_section` 和 `pos` 联合定义"当前状态"，每一行输入是"事件"，处理完一行后两个字段都可能更新——这正是 State + Event → NewState 的模式。转移规则没有用编译期表格，而是用主循环里的几个 `if` 分支手动组织。对于几十行配置解析来说，这比表格更直观。

> State / Event / Transition 不是某个库的功能，而是一种组织代码的方式。学会这个心智模型，比记住某个 API 重要得多。上一章讲的是"如何用表格表达它"，这一章讲的是"不依赖表格如何用同样的思路工作"。

## 局限性

这个实现是一个有明确边界的教学原型：

- **不支持 `[[array]]`**——数组表需要存储 `[]Table` 而非单个 `Table`，数据结构需改动
- **不支持内联表**——`key = { a = 1, b = 2 }` 需要递归解析
- **不支持多行字符串和转义**——`"""..."""`、`'''...'''` 以及 `\n`、`\t` 均未实现
- **无行号追踪**——错误信息不报告具体行号
- **内存依赖输入生命周期**——`Value` 中的 `string` 直接指向原始输入切片。输入回收后引用悬垂
- **科学计数法不支持**——`1e10` 会当整数解析并失败

已修复的常见问题：

- **字符串内 `=` 误判**——`findEq()` 用字符扫描跳过往引号内的等号，不再用 `indexOfScalar` 一刀切
- **键值对分行**——`###` 转义仅限行首注释；值中的 `#` 不会被误判

如果项目的 TOML 需求超出教学范围，直接选择成熟的解析库，不要在此原型上修补——它的价值在于展示"状态跟踪式解析器"的组织思路。
