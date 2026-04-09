# 【draft】构建系统入门

> 💡 **重要章节**：构建系统是 Zig 的核心特性之一，掌握基本的构建命令对于项目开发至关重要。
> 
> **章节定位**：本章是基础部分，只介绍基本的构建命令和简单配置。关于构建系统的高级特性（如交叉编译、包管理、复杂构建配置等），请参见高级部分的[构建系统与包管理](../part2-advanced/chapter-package-management.md)章节。

## 构建系统概述

### 为什么 Zig 内置构建系统？

与其他语言不同，Zig 将构建系统作为语言的核心特性：

1. **零依赖**：不需要 Make、CMake、npm 等外部工具
2. **跨平台**：统一的构建体验，无需处理平台差异
3. **类型安全**：构建脚本使用 Zig 编写，编译期检查
4. **与语言集成**：无缝支持交叉编译、测试、文档生成

### 构建系统的核心概念

- **构建步骤（Build Step）**：一个可执行的构建任务
- **构建图（Build Graph）**：步骤之间的依赖关系
- **构建器（Builder）**：管理构建过程的核心对象
- **模块（Module）**：编译单元，包含源文件和依赖

## 基础项目结构

使用 `zig init` 创建项目：

```bash
mkdir my-project
cd my-project
zig init
```

生成的文件结构：

```
my-project/
├── build.zig           # 构建脚本
├── build.zig.zon       # 依赖清单（Zig Object Notation）
└── src/
    ├── main.zig        # 主程序入口
    └── root.zig        # 库根文件
```

### build.zig.zon 文件

依赖清单文件，类似 package.json：

```zig
.{
    .name = "my-project",
    .version = "0.1.0",
    .dependencies = .{
        // 添加外部依赖
    },
}
```

## build.zig 脚本详解

### 最小构建脚本

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.standardTargetOptions(.{}),
            .optimize = b.standardOptimizeOption(.{}),
        }),
    });
    
    b.installArtifact(exe);
    
    const run_cmd = b.addRunArtifact(exe);
    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_cmd.step);
}
```

### 构建选项

```zig
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    const enable_logging = b.option(
        bool,
        "logging",
        "Enable logging"
    ) orelse false;
    
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    const options = b.addOptions();
    options.addOption(bool, "enable_logging", enable_logging);
    exe.root_module.addOptions("config", options);
    
    b.installArtifact(exe);
}
```

在代码中使用选项：

```zig
const config = @import("config");

pub fn main(init: std.process.Init.Minimal) void {
    if (config.enable_logging) {
        std.debug.print("Logging enabled\n", .{});
    }
}
```

## 多文件项目组织

### 项目结构

```
my-project/
├── build.zig
├── build.zig.zon
└── src/
    ├── main.zig        # 主程序
    ├── lib.zig         # 库代码
    └── utils/
        ├── math.zig    # 工具模块
        └── string.zig
```

### 构建脚本

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 创建库模块
    const lib_mod = b.createModule(.{
        .root_source_file = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
    });
    
    // 创建可执行文件
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{
                .{ .name = "lib", .module = lib_mod },
            },
        }),
    });
    
    b.installArtifact(exe);
    
    // 运行步骤
    const run_cmd = b.addRunArtifact(exe);
    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_cmd.step);
}
```

在 main.zig 中导入：

```zig
const std = @import("std");
const lib = @import("lib");

pub fn main(init: std.process.Init.Minimal) void {
    lib.someFunction();
}
```

## 测试集成

```zig
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 主程序
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    b.installArtifact(exe);
    
    // 测试
    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
```

运行测试：

```bash
zig build test
```

## 常见构建命令

```bash
# 构建项目
zig build

# 运行程序
zig build run

# 运行测试
zig build test

# 指定优化级别
zig build -Doptimize=ReleaseFast

# 指定目标平台
zig build -Dtarget=x86_64-windows

# 清理构建产物
zig build clean

# 查看所有可用步骤
zig build --help
```

## 构建系统参考资源

- **官方文档**：https://ziglang.org/learn/build-system/
- **标准库文档**：运行 `zig std` 查看 `std.Build` 模块
- **示例项目**：https://github.com/ziglang/zig/tree/master/build_examples

---

## 章节练习题

### 基础题

**题目1**：创建一个简单的 build.zig 文件，构建一个可执行程序。

**要求**：
- 项目名称为 "hello-world"
- 主文件为 src/main.zig
- 支持运行命令 `zig build run`

**参考答案**：
```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "hello-world",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);
}
```

**题目2**：配置构建选项，支持 Debug 和 Release 两种模式。

**要求**：
- 使用 `standardOptimizeOption`
- 输出当前优化级别

**参考答案**：
```zig
pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    
    // 输出优化级别（仅用于演示）
    std.debug.print("优化级别：{}\n", .{optimize});
}
```

**题目3**：添加一个自定义构建步骤，输出 "Building..." 消息。

**要求**：
- 创建名为 "greet" 的自定义步骤
- 执行时输出 "Building my project!"

**参考答案**：
```zig
pub fn build(b: *std.Build) void {
    const greet_step = b.step("greet", "Print greeting");
    
    const greet_cmd = b.addSystemCommand(&[_][]const u8{
        "echo", "Building my project!",
    });
    
    greet_step.dependOn(&greet_cmd.step);
}
```

---

## 下一步学习

恭喜您完成了构建系统入门！接下来您可以：

1. **实践练习**：完成章节练习题，巩固所学知识
2. **深入学习**：阅读[构建系统与包管理](../part2-advanced/chapter-package-management.md)章节，了解高级特性
3. **项目实战**：尝试构建一个多文件项目，体验完整的开发流程
