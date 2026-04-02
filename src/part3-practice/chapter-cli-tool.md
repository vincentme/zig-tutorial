# 【draft】实战案例1 - CLI工具开发

本节将通过构建一个实用的文件搜索工具，展示 Zig 在 CLI 工具开发方面的完整流程和最佳实践。

## 项目概述

# 项目目标

构建一个类似 `find` 命令的文件搜索工具 `zfind`，具备以下功能：

1. **按文件名模式搜索**：支持通配符匹配
2. **按文件类型过滤**：文件、目录、符号链接
3. **按文件大小过滤**：大于、小于、等于指定大小
4. **递归搜索目录**：支持深度限制
5. **格式化输出**：支持不同输出格式

# 技术栈

- **标准库**：`std.fs`（文件系统）、`std.process`（命令行参数）、`std.mem`（字符串处理）
- **构建系统**：`zig build`
- **测试框架**：`zig test`

# 项目结构

```
zfind/
├── build.zig           # 构建脚本
├── build.zig.zon       # 项目清单
└── src/
    ├── main.zig        # 主程序入口
    ├── search.zig      # 搜索核心逻辑
    ├── filter.zig      # 文件过滤逻辑
    ├── cli.zig         # 命令行参数解析
    └── output.zig      # 输出格式化
```

## 项目初始化

# 创建项目

```bash
# 创建项目目录
mkdir zfind
cd zfind

# 初始化项目
zig init

# 查看项目结构
tree
```

# 配置 build.zig.zon

```zig
.{
    .name = "zfind",
    .version = "0.1.0",
    .dependencies = .{},
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
    },
}
```

# 配置 build.zig

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // 可执行文件
    const exe = b.addExecutable(.{
        .name = "zfind",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    b.installArtifact(exe);

    // 运行命令
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());

    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    // 测试
    const unit_tests = b.addTest(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
```

## 命令行参数解析

# 定义 CLI 结构

创建 `src/cli.zig`：

```zig
const std = @import("std");

pub const CliError = error{
    InvalidArgument,
    MissingValue,
    UnknownOption,
};

pub const FileType = enum {
    all,
    file,
    dir,
    symlink,
};

pub const SizeComparator = enum {
    greater,
    less,
    equal,
};

pub const SizeFilter = struct {
    comparator: SizeComparator,
    size: u64,
};

pub const OutputFormat = enum {
    simple,
    detailed,
    json,
};

pub const CliOptions = struct {
    search_path: []const u8,
    name_pattern: ?[]const u8 = null,
    file_type: FileType = .all,
    size_filter: ?SizeFilter = null,
    max_depth: ?u32 = null,
    output_format: OutputFormat = .simple,
    show_help: bool = false,
    show_version: bool = false,
};

pub fn parseArgs(allocator: std.mem.Allocator, args: [][:0]u8) CliError!CliOptions {
    var options = CliOptions{
        .search_path = ".",
    };

    var i: usize = 1;
    while (i < args.len) {
        const arg = std.mem.span(args[i]);

        if (std.mem.eql(u8, arg, "-h") or std.mem.eql(u8, arg, "--help")) {
            options.show_help = true;
        } else if (std.mem.eql(u8, arg, "-v") or std.mem.eql(u8, arg, "--version")) {
            options.show_version = true;
        } else if (std.mem.eql(u8, arg, "-n") or std.mem.eql(u8, arg, "--name")) {
            i += 1;
            if (i >= args.len) return error.MissingValue;
            options.name_pattern = std.mem.span(args[i]);
        } else if (std.mem.eql(u8, arg, "-t") or std.mem.eql(u8, arg, "--type")) {
            i += 1;
            if (i >= args.len) return error.MissingValue;
            const type_str = std.mem.span(args[i]);
            if (std.mem.eql(u8, type_str, "file")) {
                options.file_type = .file;
            } else if (std.mem.eql(u8, type_str, "dir")) {
                options.file_type = .dir;
            } else if (std.mem.eql(u8, type_str, "symlink")) {
                options.file_type = .symlink;
            } else {
                return error.InvalidArgument;
            }
        } else if (std.mem.eql(u8, arg, "-s") or std.mem.eql(u8, arg, "--size")) {
            i += 1;
            if (i >= args.len) return error.MissingValue;
            options.size_filter = try parseSizeFilter(std.mem.span(args[i]));
        } else if (std.mem.eql(u8, arg, "-d") or std.mem.eql(u8, arg, "--max-depth")) {
            i += 1;
            if (i >= args.len) return error.MissingValue;
            options.max_depth = std.fmt.parseInt(u32, std.mem.span(args[i]), 10) catch return error.InvalidArgument;
        } else if (std.mem.eql(u8, arg, "-f") or std.mem.eql(u8, arg, "--format")) {
            i += 1;
            if (i >= args.len) return error.MissingValue;
            const format_str = std.mem.span(args[i]);
            if (std.mem.eql(u8, format_str, "simple")) {
                options.output_format = .simple;
            } else if (std.mem.eql(u8, format_str, "detailed")) {
                options.output_format = .detailed;
            } else if (std.mem.eql(u8, format_str, "json")) {
                options.output_format = .json;
            } else {
                return error.InvalidArgument;
            }
        } else if (!std.mem.startsWith(u8, arg, "-")) {
            options.search_path = arg;
        } else {
            return error.UnknownOption;
        }

        i += 1;
    }

    return options;
}

fn parseSizeFilter(size_str: []const u8) CliError!SizeFilter {
    if (size_str.len < 2) return error.InvalidArgument;

    const comparator: SizeComparator = switch (size_str[0]) {
        '+' => .greater,
        '-' => .less,
        '=' => .equal,
        else => return error.InvalidArgument,
    };

    const size_part = size_str[1..];
    const size = std.fmt.parseInt(u64, size_part, 10) catch return error.InvalidArgument;

    return SizeFilter{
        .comparator = comparator,
        .size = size,
    };
}

pub fn printHelp() void {
    const help_text =
        \\zfind - 文件搜索工具
        \\
        \\用法:
        \\  zfind [选项] [搜索路径]
        \\
        \\选项:
        \\  -n, --name <pattern>    按文件名模式搜索（支持通配符）
        \\  -t, --type <type>       按文件类型过滤 (file|dir|symlink)
        \\  -s, --size <size>       按文件大小过滤 (+大于|-小于|=等于)
        \\  -d, --max-depth <n>     限制搜索深度
        \\  -f, --format <format>   输出格式 (simple|detailed|json)
        \\  -h, --help              显示帮助信息
        \\  -v, --version           显示版本信息
        \\
        \\示例:
        \\  zfind .                          # 搜索当前目录
        \\  zfind -n "*.zig" .               # 搜索所有 .zig 文件
        \\  zfind -t dir /usr/local          # 搜索所有目录
        \\  zfind -s +1M .                   # 搜索大于 1MB 的文件
        \\  zfind -d 3 -f detailed .         # 限制深度 3，详细输出
        \\
    ;

    std.debug.print("{s}", .{help_text});
}

pub fn printVersion() void {
    std.debug.print("zfind version 0.1.0\n", .{});
}
```

## 文件过滤逻辑

创建 `src/filter.zig`：

```zig
const std = @import("std");
const cli = @import("cli.zig");

pub const FilterError = error{
    PatternTooComplex,
};

pub fn matchesPattern(name: []const u8, pattern: []const u8) bool {
    if (std.mem.eql(u8, pattern, "*")) return true;

    if (std.mem.startsWith(u8, pattern, "*") and std.mem.endsWith(u8, pattern, "*")) {
        const middle = pattern[1 .. pattern.len - 1];
        return std.mem.indexOf(u8, name, middle) != null;
    } else if (std.mem.startsWith(u8, pattern, "*")) {
        const suffix = pattern[1..];
        return std.mem.endsWith(u8, name, suffix);
    } else if (std.mem.endsWith(u8, pattern, "*")) {
        const prefix = pattern[0 .. pattern.len - 1];
        return std.mem.startsWith(u8, name, prefix);
    } else {
        return std.mem.eql(u8, name, pattern);
    }
}

pub fn matchesFileType(stat: std.fs.File.Stat, file_type: cli.FileType) bool {
    return switch (file_type) {
        .all => true,
        .file => stat.kind == .file,
        .dir => stat.kind == .directory,
        .symlink => stat.kind == .sym_link,
    };
}

pub fn matchesSize(size: u64, size_filter: cli.SizeFilter) bool {
    return switch (size_filter.comparator) {
        .greater => size > size_filter.size,
        .less => size < size_filter.size,
        .equal => size == size_filter.size,
    };
}

test "matchesPattern" {
    try std.testing.expect(matchesPattern("test.zig", "*.zig"));
    try std.testing.expect(matchesPattern("main.zig", "*.zig"));
    try std.testing.expect(!matchesPattern("main.c", "*.zig"));

    try std.testing.expect(matchesPattern("test_file.zig", "*file*"));
    try std.testing.expect(matchesPattern("file_test.zig", "*file*"));
    try std.testing.expect(!matchesPattern("test.zig", "*file*"));

    try std.testing.expect(matchesPattern("main.zig", "main.*"));
    try std.testing.expect(!matchesPattern("test.zig", "main.*"));

    try std.testing.expect(matchesPattern("exact.zig", "exact.zig"));
    try std.testing.expect(!matchesPattern("other.zig", "exact.zig"));
}

test "matchesSize" {
    const filter_greater = cli.SizeFilter{ .comparator = .greater, .size = 100 };
    try std.testing.expect(matchesSize(200, filter_greater));
    try std.testing.expect(!matchesSize(50, filter_greater));

    const filter_less = cli.SizeFilter{ .comparator = .less, .size = 100 };
    try std.testing.expect(matchesSize(50, filter_less));
    try std.testing.expect(!matchesSize(200, filter_less));

    const filter_equal = cli.SizeFilter{ .comparator = .equal, .size = 100 };
    try std.testing.expect(matchesSize(100, filter_equal));
    try std.testing.expect(!matchesSize(99, filter_equal));
}
```

## 搜索核心逻辑

创建 `src/search.zig`：

```zig
const std = @import("std");
const cli = @import("cli.zig");
const filter = @import("filter.zig");

pub const SearchResult = struct {
    path: []const u8,
    stat: std.fs.File.Stat,
};

pub const SearchError = error{
    PermissionDenied,
    PathNotFound,
    TooManyOpenFiles,
};

pub fn search(
    allocator: std.mem.Allocator,
    options: cli.CliOptions,
    writer: anytype,
) SearchError!usize {
    var dir = std.fs.cwd().openDir(options.search_path, .{
        .iterate = true,
    }) catch |err| {
        return switch (err) {
            error.FileNotFound => error.PathNotFound,
            error.AccessDenied => error.PermissionDenied,
            else => err,
        };
    };
    defer dir.close();

    var count: usize = 0;
    try searchRecursive(allocator, dir, options, "", 0, &count, writer);

    return count;
}

fn searchRecursive(
    allocator: std.mem.Allocator,
    dir: std.fs.Dir,
    options: cli.CliOptions,
    current_path: []const u8,
    current_depth: u32,
    count: *usize,
    writer: anytype,
) SearchError!void {
    if (options.max_depth) |max_depth| {
        if (current_depth > max_depth) return;
    }

    var iter = dir.iterate();
    while (try iter.next()) |entry| {
        const entry_path = try std.fs.path.join(allocator, &.{
            if (current_path.len > 0) current_path else ".",
            entry.name,
        });
        defer allocator.free(entry_path);

        var matches = true;
        var stat: ?std.fs.File.Stat = null;

        if (options.name_pattern) |pattern| {
            if (!filter.matchesPattern(entry.name, pattern)) {
                matches = false;
            }
        }

        if (matches and options.file_type != .all) {
            const file = dir.openFile(entry.name, .{}) catch continue;
            defer file.close();
            stat = file.stat() catch continue;

            if (!filter.matchesFileType(stat.?, options.file_type)) {
                matches = false;
            }
        }

        if (matches and options.size_filter != null) {
            if (stat == null) {
                const file = dir.openFile(entry.name, .{}) catch continue;
                defer file.close();
                stat = file.stat() catch continue;
            }

            if (!filter.matchesSize(stat.?.size, options.size_filter.?)) {
                matches = false;
            }
        }

        if (matches) {
            count.* += 1;
            try printResult(writer, entry_path, stat, options.output_format);
        }

        if (entry.kind == .directory) {
            var subdir = dir.openDir(entry.name, .{
                .iterate = true,
            }) catch continue;
            defer subdir.close();

            try searchRecursive(
                allocator,
                subdir,
                options,
                entry_path,
                current_depth + 1,
                count,
                writer,
            );
        }
    }
}

fn printResult(
    writer: anytype,
    path: []const u8,
    stat: ?std.fs.File.Stat,
    format: cli.OutputFormat,
) !void {
    switch (format) {
        .simple => {
            try writer.print("{s}\n", .{path});
        },
        .detailed => {
            if (stat) |s| {
                const type_str = switch (s.kind) {
                    .file => "FILE",
                    .directory => "DIR ",
                    .sym_link => "LINK",
                    else => "????",
                };
                try writer.print("[{s}] {:>10} bytes  {s}\n", .{
                    type_str,
                    s.size,
                    path,
                });
            } else {
                try writer.print("[????] {:>10} bytes  {s}\n", .{
                    @as(u64, 0),
                    path,
                });
            }
        },
        .json => {
            if (stat) |s| {
                const type_str = switch (s.kind) {
                    .file => "file",
                    .directory => "directory",
                    .sym_link => "symlink",
                    else => "unknown",
                };
                try writer.print(
                    \\{{"path":"{s}","type":"{s}","size":{}}}
                    \\
                , .{
                    path,
                    type_str,
                    s.size,
                });
            } else {
                try writer.print(
                    \\{{"path":"{s}","type":"unknown","size":0}}
                    \\
                , .{path});
            }
        },
    }
}
```

## 主程序入口

创建 `src/main.zig`：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");
const cli = @import("cli.zig");
const search = @import("search.zig");

pub fn main(init: std.process.Init) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    const options = cli.parseArgs(allocator, args) catch |err| {
        switch (err) {
            cli.CliError.InvalidArgument => {
                std.debug.print("错误：无效的参数\n", .{});
            },
            cli.CliError.MissingValue => {
                std.debug.print("错误：缺少参数值\n", .{});
            },
            cli.CliError.UnknownOption => {
                std.debug.print("错误：未知的选项\n", .{});
            },
        }
        std.debug.print("使用 --help 查看帮助信息\n", .{});
        return;
    };

    if (options.show_help) {
        cli.printHelp();
        return;
    }

    if (options.show_version) {
        cli.printVersion();
        return;
    }

    const stdout = std.Io.File.stdout();
    var buffered_writer = std.io.bufferedWriter(stdout.writer(init.io));

    const count = search.search(allocator, options, buffered_writer.writer()) catch |err| {
        switch (err) {
            search.SearchError.PathNotFound => {
                std.debug.print("错误：路径不存在: {s}\n", .{options.search_path});
            },
            search.SearchError.PermissionDenied => {
                std.debug.print("错误：权限不足: {s}\n", .{options.search_path});
            },
            else => {
                std.debug.print("错误：搜索失败\n", .{});
            },
        }
        return;
    };

    try buffered_writer.flush();

    std.debug.print("\n找到 {} 个结果\n", .{count});
}

test "CLI argument parsing" {
    const allocator = std.testing.allocator;

    var args = [_][0]u8{};
    _ = args;

    const options = try cli.parseArgs(allocator, &args);
    try std.testing.expectEqualStrings(".", options.search_path);
    try std.testing.expect(options.name_pattern == null);
    try std.testing.expect(options.file_type == .all);
}

test "Pattern matching" {
    @import("filter.zig");
}
```

## 测试用例

# 单元测试

```zig
test "parseSizeFilter" {
    const filter1 = try cli.parseSizeFilter("+100");
    try std.testing.expectEqual(cli.SizeComparator.greater, filter1.comparator);
    try std.testing.expectEqual(@as(u64, 100), filter1.size);

    const filter2 = try cli.parseSizeFilter("-50");
    try std.testing.expectEqual(cli.SizeComparator.less, filter2.comparator);
    try std.testing.expectEqual(@as(u64, 50), filter2.size);

    const filter3 = try cli.parseSizeFilter("=200");
    try std.testing.expectEqual(cli.SizeComparator.equal, filter3.comparator);
    try std.testing.expectEqual(@as(u64, 200), filter3.size);
}

test "matchesFileType" {
    const file_stat = std.fs.File.Stat{
        .size = 100,
        .kind = .file,
        .inode = 0,
        .mtime = 0,
    };
    try std.testing.expect(filter.matchesFileType(file_stat, .file));
    try std.testing.expect(!filter.matchesFileType(file_stat, .dir));

    const dir_stat = std.fs.File.Stat{
        .size = 0,
        .kind = .directory,
        .inode = 0,
        .mtime = 0,
    };
    try std.testing.expect(filter.matchesFileType(dir_stat, .dir));
    try std.testing.expect(!filter.matchesFileType(dir_stat, .file));
}
```

# 集成测试

创建 `test/integration_test.zig`：

```zig
const std = @import("std");

test "搜索当前目录" {
    const allocator = std.testing.allocator;

    var args = [_][0]u8{};
    _ = args;

    const options = try @import("cli.zig").parseArgs(allocator, &args);
    var buffer: [1024]u8 = undefined;
    var fbs = std.io.fixedBufferStream(&buffer);

    const count = try @import("search.zig").search(
        allocator,
        options,
        fbs.writer(),
    );

    try std.testing.expect(count > 0);
}
```

## 构建和运行

# 构建项目

```bash
# 构建项目
zig build

# 运行程序
zig build run

# 运行测试
zig build test

# 安装到系统路径
zig build install
```

# 使用示例

```bash
# 搜索当前目录
./zig-out/bin/zfind .

# 搜索所有 .zig 文件
./zig-out/bin/zfind -n "*.zig" .

# 搜索所有目录
./zig-out/bin/zfind -t dir .

# 搜索大于 1MB 的文件
./zig-out/bin/zfind -s +1048576 .

# 限制搜索深度
./zig-out/bin/zfind -d 3 .

# 详细输出
./zig-out/bin/zfind -f detailed .

# JSON 格式输出
./zig-out/bin/zfind -f json .

# 组合使用
./zig-out/bin/zfind -n "*.zig" -t file -d 2 -f detailed .
```

## 最佳实践总结

# 1. 模块化设计

将功能拆分为独立模块：
- `cli.zig`：命令行参数解析
- `filter.zig`：文件过滤逻辑
- `search.zig`：搜索核心逻辑
- `main.zig`：主程序入口

**优点**：
- 代码职责清晰
- 易于测试
- 易于维护

# 2. 错误处理

使用 Zig 的错误联合类型：
```zig
pub const SearchError = error{
    PermissionDenied,
    PathNotFound,
    TooManyOpenFiles,
};

pub fn search(...) SearchError!usize {
    // ...
}
```

**优点**：
- 错误类型明确
- 编译期检查
- 易于传播

# 3. 测试驱动开发

为每个模块编写测试：
```zig
test "matchesPattern" {
    try std.testing.expect(matchesPattern("test.zig", "*.zig"));
    try std.testing.expect(!matchesPattern("main.c", "*.zig"));
}
```

**优点**：
- 确保代码质量
- 快速验证修改
- 文档化功能

# 4. 分配器传递模式

显式传递分配器：
```zig
pub fn search(
    allocator: std.mem.Allocator,
    options: cli.CliOptions,
    writer: anytype,
) SearchError!usize {
    // ...
}
```

**优点**：
- 灵活的内存管理
- 易于测试
- 无全局状态

# 5. 泛型编程

使用 `anytype` 实现泛型：
```zig
pub fn search(
    allocator: std.mem.Allocator,
    options: cli.CliOptions,
    writer: anytype,  // 泛型写入器
) SearchError!usize {
    // ...
}
```

**优点**：
- 代码复用
- 类型安全
- 零开销抽象

## 扩展方向

完成基础版本后，可以考虑以下扩展：

1. **性能优化**：
   - 并行搜索
   - 缓存文件信息
   - 使用更高效的数据结构

2. **功能增强**：
   - 正则表达式支持
   - 按时间过滤
   - 按权限过滤
   - 排除模式

3. **用户体验**：
   - 彩色输出
   - 进度显示
   - 交互式模式

4. **跨平台**：
   - Windows 支持
   - 平台特定优化

## 小结

本节通过构建一个完整的 CLI 工具，展示了：

1. **项目结构设计**：模块化、清晰的职责划分
2. **命令行参数解析**：完整的选项处理和帮助信息
3. **文件系统操作**：递归搜索、文件过滤
4. **错误处理**：友好的错误信息和恢复机制
5. **测试驱动开发**：单元测试和集成测试
6. **最佳实践**：分配器传递、泛型编程、模块化设计

这个案例展示了 Zig 在 CLI 工具开发方面的优势：
- **零开销抽象**：高性能
- **编译期检查**：减少运行时错误
- **显式内存管理**：可控的资源使用
- **强大的标准库**：丰富的文件系统 API

---

> 💡 **章节过渡**：从 CLI 工具到 HTTP 服务器
> 
> 在[实战案例2 - HTTP服务器开发](chapter-http-server.md)中，我们开发了文件搜索工具 `zfind`，掌握了 CLI 工具开发的完整流程。
> 现在，我们将学习 HTTP 服务器开发，了解网络编程的核心技术。
> 
> **为什么 CLI 工具是网络编程的基础？**
> 
> 1. **参数解析**：HTTP 服务器也需要解析命令行参数
> 2. **文件系统**：HTTP 服务器需要处理文件请求
> 3. **错误处理**：网络编程中的错误处理更加复杂
> 
> **学习建议**：
> - 回顾 CLI 工具中的错误处理和资源管理
> - 注意网络 API 的稳定性警告
> - 准备学习异步 I/O 和并发处理
