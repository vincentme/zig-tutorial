# 实战案例 - TOML 解析器

TOML 是 Zig 项目配置的事实标准——`build.zig.zon` 本身就是 TOML。实现一个解析器既能深入理解配置文件的读写原理，也能将上一章的状态机思维直接落地：**同样的"当前状态 + 输入 → 新状态"模式，离开泛型表格同样能工作**。

## 设计思路

结构化文本解析的核心困境：同一个字符在不同上下文中含义完全不同。

以 TOML 为例——`=` 出现在 `[section]` 里只是普通字符，出现在 `port = 8080` 里却是键值分隔符。`#` 出现在双引号内部是字符串的一部分，出现在行首则意味着整行被注释掉。如果把所有判断逻辑用嵌套的 `if/else` 写在一起，代码很快就变成一堵不可维护的墙。

解决方式上一章已经讨论过——State / Event / Transition。这里的区别只是：不需要泛型表格。一个 `Parser` 结构体，几个跟踪上下文的字段，就够了。

`current_section` 记录"当前在哪个节里"（空串代表根表），`root` 和 `sections` 分别存储根表键值对和各节的 `Table`。把这几个字段看作一个状态机：`current_section` 的值定义了当前状态，每一行输入是事件，处理完一行后状态转移——或切换节名，或将键值对存入当前表。State / Event / Transition 不是某个库的功能，而是一种组织代码的方式。上一章讲的是"如何用表格表达它"，这一章讲的是"不依赖表格如何用同样的思路工作"。

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
    current_section: []const u8,
    gpa: std.mem.Allocator,
    sections: std.StringHashMap(Table),
    root: Table,

    pub const Error = error{
        InvalidSyntax,
        ValueExpected,
    };

    pub fn init(input: []const u8, gpa: std.mem.Allocator) Parser {
        return .{
            .input = input,
            .current_section = "",
            .gpa = gpa,
            .sections = std.StringHashMap(Table).init(gpa),
            .root = Table.init(gpa),
        };
    }
};
```

`current_section` 初始为空串，代表根表——在第一个 `[section]` 出现之前，所有键值对都写入 `root`。一旦遇到节头，`current_section` 切换为节名，后续键值对写入 `sections` 中对应的 `Table`。`gpa` 字段被存储下来，因为每次遇到新节名需要动态创建新的 `Table`。

这里使用的 `HashMap` 是托管（managed）版本的 API——`init(gpa)` 将分配器存入内部，`put`、`deinit` 不再接受显式分配器参数。0.16 对容器的整体方向是向非托管（unmanaged）迁移（如 `ArrayList` 已改为 `.empty` + 方法传 `gpa`），但 `StringHashMap` 的托管 API 仍可用且代码更简洁。

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

        if (findEq(line)) |eq_pos| {
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
```

四条分支覆盖了所有 TOML 行的类型：

1. **空行、注释**——跳过。
2. **节头**——提取 `[...]` 内的节名，若不存在则创建新表，切换 `current_section`。节名中的点号（如 `parent.child`）在这里只是普通字符，`StringHashMap` 按完整字符串做键。
3. **键值对**——用 `findEq` 逐字符扫描，跳过引号内的 `=`，在引号外第一个 `=` 处拆分。拆分后两边去空白，调用类型解析，存入当前节对应的 `Table`（`current_section` 为空时写入 `root`，否则写入 `sections` 中对应表）。
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

浮点与整数的分派用 `indexOfScalar` 检测 `.` 字符——这能正确处理 `3.14`、`-1.5` 和 `100` 等常见形式。

## 完整代码与测试

将上述各部分合并，加入 `findEq` 辅助函数和 `deinit` 清理逻辑，得到完整的 `Parser`。下面用一个典型的服务端配置文本验证所有路径——根表字符串、`[server]` 节、`[database]` 节，每条覆盖一种值类型：

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
    current_section: []const u8,
    gpa: std.mem.Allocator,
    sections: std.StringHashMap(Table),
    root: Table,

    pub const Error = error{
        InvalidSyntax,
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

这个解析器没有 `@import` 上一章的泛型状态机，但思想完全相同：`current_section` 定义当前状态，每一行输入是事件，主循环中的 `if` 分支是转移规则。对于几十行配置解析来说，手写几个分支比编译期表格更直观。上一章讲的是"如何用表格表达 State / Event / Transition"，这一章讲的是"不用表格如何用同样的心智模型组织代码"。

## 局限性

这个实现是一个有明确边界的教学原型：

- **不支持 `[[array]]`**——数组表需要存储 `[]Table` 而非单个 `Table`，数据结构需改动
- **不支持内联表**——`key = { a = 1, b = 2 }` 需要递归解析
- **不支持多行字符串和转义**——`"""..."""`、`'''...'''` 以及 `\n`、`\t` 均未实现
- **无行号追踪**——错误信息不报告具体行号
- **内存依赖输入生命周期**——`Value` 中的 `string` 直接指向原始输入切片，输入回收后引用悬垂
- **科学计数法不支持**——`1e10` 不含 `.`，会走整数解析路径而失败
- **不支持行内注释**——`key = "value" # comment` 中的 `# comment` 会被当成值的一部分

如果项目的 TOML 需求超出教学范围，直接选择成熟的解析库，不要在此原型上修补——它的价值在于展示"状态跟踪式解析器"的组织思路。
