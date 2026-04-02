# 【draft】构建系统

> 💡 **重要章节**：构建系统是 Zig 的核心特性之一，掌握它对于项目开发至关重要。

## 构建系统概述

# 为什么 Zig 内置构建系统？

与其他语言不同，Zig 将构建系统作为语言的核心特性：

1. **零依赖**：不需要 Make、CMake、npm 等外部工具
2. **跨平台**：统一的构建体验，无需处理平台差异
3. **类型安全**：构建脚本使用 Zig 编写，编译期检查
4. **与语言集成**：无缝支持交叉编译、测试、文档生成

# 构建系统的核心概念

- **构建步骤（Build Step）**：一个可执行的构建任务
- **构建图（Build Graph）**：步骤之间的依赖关系
- **构建器（Builder）**：管理构建过程的核心对象
- **模块（Module）**：编译单元，包含源文件和依赖

# 7.0.1 ⚠️ 构建系统重大变更（0.15.x+）

> ⚠️ **重要**：Zig 0.15.x 对构建系统 API 进行了重大重构。如果您从旧版本迁移，请仔细阅读本节。

# 核心变更：`root_module` API

**旧版本（0.14.x 及之前）- 已弃用：**

```zig
// 🚫 已废弃：0.15.x 已移除
// ⏪ 旧版本：0.14.x
const exe = b.addExecutable(.{
    .name = "app",
    .root_source_file = b.path("src/main.zig"),
    .target = target,
    .optimize = optimize,
});

// 🚫 已废弃：addModule 方法已移除
exe.addModule("helper", helper_mod);
```

**新版本（0.15.x+）- 正确用法：**

```zig
// 🚫 已废弃：0.15.x 已移除
// ✨ 新特性：root_module API
const exe = b.addExecutable(.{
    .name = "app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    }),
});

// 📌 Zig 0.15.x+
// 💡 最佳实践：使用 root_module.addImport
exe.root_module.addImport("helper", helper_mod);
```

# 为什么进行此变更？

1. **模块化设计**：`root_module` 提供了更清晰的模块系统
2. **统一接口**：所有编译单元都使用相同的模块接口
3. **更好的依赖管理**：模块可以独立配置和复用
4. **向前兼容**：为未来的包管理系统奠定基础

# 迁移检查清单

从旧版本迁移时，请检查以下内容：

| 旧 API                        | 新 API                                                        | 说明           |
| ----------------------------- | ------------------------------------------------------------- | -------------- |
| `.root_source_file = ...`     | `.root_module = b.createModule(.{ .root_source_file = ... })` | 可执行文件和库 |
| `exe.addModule(name, mod)`    | `exe.root_module.addImport(name, mod)`                        | 添加模块导入   |
| `exe.linkSystemLibrary(name)` | `exe.root_module.linkSystemLibrary(name, .{})`                | 链接系统库     |
| `exe.addCSourceFiles(files)`  | `exe.root_module.addCSourceFiles(.{ .files = files })`        | 添加 C 源文件  |
| `exe.addIncludePath(path)`    | `exe.root_module.addIncludePath(path)`                        | 添加头文件路径 |
| `exe.linkLibC()`              | `exe.root_module.linkLibC()`                                  | 链接 C 标准库  |

# 完整迁移示例

**旧版本代码：**

```zig
// 🚫 已废弃：0.15.x 已移除
// 🚫 已废弃：root_source_file 直接字段
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    const exe = b.addExecutable(.{
        .name = "app",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    
    exe.linkLibC();
    exe.addModule("helper", helper_mod);
    
    b.installArtifact(exe);
}
```

**新版本代码：**

```zig
// 🚫 已废弃：0.15.x 已移除
// ✨ 新特性：root_module 统一接口
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    const exe = b.addExecutable(.{
        .name = "app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    exe.root_module.linkLibC();
    exe.root_module.addImport("helper", helper_mod);
    
    b.installArtifact(exe);
}
```

# 常见编译错误及解决方案

**错误 1：`no field 'root_source_file'`**

```
error: struct 'Compile' has no member named 'root_source_file'
```

**解决方案**：使用 `root_module` 替代：

```zig
// 🚫 已废弃：0.15.x 已移除
.root_source_file = b.path("src/main.zig")

// 📌 Zig 0.15.x+
// ✨ 新特性：root_module API
.root_module = b.createModule(.{
    .root_source_file = b.path("src/main.zig"),
    // ... 其他选项
})
```

**错误 2：`no member named 'addModule'`**

```
error: no member named 'addModule' in struct 'Compile'
```

**解决方案**：使用 `root_module.addImport`：

```zig
// 🚫 已废弃：0.15.x 已移除，请使用 root_module.addImport
exe.addModule("lib", lib_mod);

// 📌 Zig 0.15.x+
// 💡 最佳实践：使用 root_module.addImport
exe.root_module.addImport("lib", lib_mod);
```

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

# build.zig.zon 文件

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

# 最小构建脚本

```zig
// 🚫 已废弃：0.15.x 已移除
// 💡 最佳实践：最小化构建脚本
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

# 构建选项

```zig
// 🚫 已废弃：0.15.x 已移除
// 💡 最佳实践：使用构建选项
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

# 项目结构

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

# 构建脚本

```zig
// 🚫 已废弃：0.15.x 已移除
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
// 🚫 已废弃：0.15.x 已移除
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

## 交叉编译

Zig 的强大特性之一是内置交叉编译支持：

```zig
// 🚫 已废弃：0.15.x 已移除
pub fn build(b: *std.Build) void {
    // 指定目标平台
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .aarch64,
        .os_tag = .linux,
    });
    
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = .ReleaseSmall,
        }),
    });
    
    b.installArtifact(exe);
}
```

常用交叉编译目标：

```bash
# Linux x86_64
zig build -Dtarget=x86_64-linux

# Windows
zig build -Dtarget=x86_64-windows

# macOS
zig build -Dtarget=aarch64-macos

# ARM Linux
zig build -Dtarget=aarch64-linux
```

## 外部依赖管理

# 添加依赖

在 `build.zig.zon` 中添加：

```zig
.{
    .name = "my-project",
    .version = "0.1.0",
    .dependencies = .{
        .@"zig-clap" = .{
            .url = "https://github.com/Hejsil/zig-clap/archive/refs/tags/0.0.1.tar.gz",
            .hash = "1220...",
        },
    },
}
```

在 `build.zig` 中使用：

```zig
// 📌 Zig 0.15.x+
// ✨ 新特性：root_module API
const clap = b.dependency("zig-clap", .{
    .target = target,
    .optimize = optimize,
});

exe.root_module.addImport("clap", clap.module("clap"));
```

# 更新依赖

```bash
# 更新所有依赖
zig build --fetch

# 添加新依赖
zig fetch --save https://github.com/user/repo
```

## 构建步骤进阶

# 自定义构建步骤

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 自定义命令
    const cmd = b.addSystemCommand(&.{
        "echo",
        "Building custom step...",
    });
    
    const custom_step = b.step("custom", "Run custom build step");
    custom_step.dependOn(&cmd.step);
}
```

# 文件生成

```zig
// 🚫 已废弃：0.15.x 已移除
pub fn build(b: *std.Build) void {
    // 生成代码文件
    const gen_cmd = b.addRunArtifact(b.addExecutable(.{
        .name = "generator",
        .root_module = b.createModule(.{
            .root_source_file = b.path("tools/generator.zig"),
            .target = b.host,
        }),
    }));
    
    const generated_file = gen_cmd.addOutputFileArg("generated.zig");
    
    // 使用生成的文件
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
        }),
    });
    
    exe.root_module.addAnonymousImport("generated", .{
        .root_source_file = generated_file,
    });
}
```

## 实用构建模式

# 开发模式配置

```zig
// 🚫 已废弃：0.15.x 已移除
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // Debug 模式添加额外检查
    if (optimize == .Debug) {
        exe.root_module.strip = false;
        exe.root_module.single_threaded = true;
    }
    
    b.installArtifact(exe);
}
```

# 多目标构建

```zig
// 🚫 已废弃：0.15.x 已移除
pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    
    // 构建多个可执行文件
    inline for (.{
        "server",
        "client",
        "tool",
    }) |name| {
        const exe = b.addExecutable(.{
            .name = name,
            .root_module = b.createModule(.{
                .root_source_file = b.path(b.fmt("src/{s}.zig", .{name})),
                .target = b.standardTargetOptions(.{}),
                .optimize = optimize,
            }),
        });
        b.installArtifact(exe);
    }
}
```

## 构建系统最佳实践

# 1. 组织构建脚本

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 构建可执行文件
    const exe = buildExe(b, target, optimize);
    b.installArtifact(exe);
    
    // 添加测试
    addTests(b, target, optimize);
    
    // 添加运行步骤
    addRunStep(b, exe);
}

fn buildExe(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
) *std.Build.Step.Compile {
    return b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
}

fn addTests(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
) void {
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

fn addRunStep(b: *std.Build, exe: *std.Build.Step.Compile) void {
    const run_cmd = b.addRunArtifact(exe);
    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_cmd.step);
}
```

# 2. 使用构建缓存

```zig
// 构建系统自动处理缓存
// 相同输入不会重新构建
// 🚫 已废弃：0.15.x 已移除
const exe = b.addExecutable(.{
    .name = "my-app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
    }),
});
```

# 3. 条件编译

```zig
// 🚫 已废弃：0.15.x 已移除
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
        }),
    });
    
    // 平台特定代码
    if (target.result.os.tag == .windows) {
        exe.root_module.linkSystemLibrary("ws2_32", .{});
    }
    
    b.installArtifact(exe);
}
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

# 章节练习题

# 基础题

**题目1**：创建一个简单的 build.zig 文件，构建一个可执行程序。

**要求**：
- 项目名称为 "hello-world"
- 主文件为 src/main.zig
- 支持运行命令 `zig build run`

**参考答案**：
```zig
// 🚫 已废弃：0.15.x 已移除
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

# 进阶题

**题目1**：配置项目依赖，添加一个外部库。

**要求**：
- 添加一个依赖项
- 配置依赖模块

**参考答案**：
```zig
// 🚫 已废弃：0.15.x 已移除
pub fn build(b: *std.Build) void {
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.standardTargetOptions(.{}),
            .optimize = b.standardOptimizeOption(.{}),
        }),
    });

    // 添加依赖（示例）
    const dep = b.dependency("my_dep", .{});
    exe.root_module.addImport("my_dep", dep.module("my_dep"));

    b.installArtifact(exe);
}
```

**题目2**：添加测试步骤，运行项目测试。

**要求**：
- 创建测试可执行文件
- 添加 `zig build test` 命令

**参考答案**：
```zig
// 🚫 已废弃：0.15.x 已移除
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    b.installArtifact(exe);

    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    const test_step = b.step("test", "Run tests");
    test_step.dependOn(&tests.step);
}
```

# 挑战题

**题目**：创建一个多目标构建配置，同时构建库和可执行程序。

**要求**：
- 构建一个静态库
- 构建一个可执行程序，链接该库
- 添加运行和测试步骤

**参考答案**：
```zig
// 🚫 已废弃：0.15.x 已移除
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // 构建静态库
    const lib = b.addStaticLibrary(.{
        .name = "mylib",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/lib.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    b.installArtifact(lib);

    // 构建可执行程序
    const exe = b.addExecutable(.{
        .name = "myapp",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    exe.linkLibrary(lib);
    b.installArtifact(exe);

    // 运行步骤
    const run_cmd = b.addRunArtifact(exe);
    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    // 测试步骤
    const tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    const test_step = b.step("test", "Run tests");
    test_step.dependOn(&tests.step);
}
```

---
