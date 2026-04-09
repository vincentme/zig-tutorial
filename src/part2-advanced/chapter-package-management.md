# 【draft】构建系统与包管理

> 📖 **章节概述**：本章将全面介绍 Zig 的构建系统和包管理机制，帮助您掌握项目构建、依赖管理和发布流程。
> 
> **章节定位**：本章是高级特性部分，侧重于构建系统的高级特性和包管理机制。关于构建系统的基础命令和简单配置，请参见基础部分的[构建系统入门](../part1-basics/chapter-build-system.md)章节。

Zig 内置了强大的构建系统，这是 Zig 的核心优势之一。与 C/C++ 需要依赖 Make、CMake 等外部工具不同，Zig 将构建系统直接集成到编译器中，提供了统一的构建体验。同时，Zig 0.16.0-dev 引入了新的包管理系统，使用 `build.zig.zon` 文件管理依赖，让依赖管理变得更加简单和可靠。

## 构建系统基础概念

# 什么是构建系统？

构建系统是用于自动化源代码编译过程的工具。在低级语言（如 C、C++、Zig）中，源代码需要被编译成机器码才能执行。构建系统负责管理这个编译过程，包括：

- **编译源代码**：将源文件转换为二进制文件
- **链接库文件**：将编译产物与外部库链接
- **管理依赖**：处理项目之间的依赖关系
- **优化构建**：利用缓存和并发加速构建过程

# 为什么 Zig 需要构建系统？

Zig 构建系统的设计目标是解决传统构建工具的痛点：

1. **消除外部依赖**：不需要 Make、CMake、Python 等外部工具
2. **跨平台一致性**：在所有平台上提供相同的构建体验
3. **交叉编译支持**：内置 40+ 目标平台的交叉编译能力
4. **依赖管理**：统一的包管理和依赖解析机制
5. **可重复构建**：确保构建过程的确定性和可重复性

# 构建过程的核心组件

Zig 的构建过程涉及以下核心组件：

**1. Zig 模块（Modules）**
- 包含源代码的 `.zig` 文件
- 每个模块可以导出函数、类型和常量
- 模块之间可以相互导入

**2. 目标对象（Target Objects）**
构建系统可以生成四种类型的目标对象：

| 目标类型       | 说明               | 文件扩展名                        |
| -------------- | ------------------ | --------------------------------- |
| 可执行文件     | 可直接运行的程序   | `.exe` (Windows), 无扩展名 (Unix) |
| 静态库         | 编译时链接的库文件 | `.lib` (Windows), `.a` (Unix)     |
| 动态库         | 运行时链接的库文件 | `.dll` (Windows), `.so` (Unix)    |
| 测试可执行文件 | 运行单元测试的程序 | 同可执行文件                      |

**3. 构建步骤（Build Steps）**
构建过程由一系列步骤组成，形成一个有向无环图（DAG）：
- 每个步骤独立执行
- 支持并发构建
- 自动处理依赖关系

**4. 构建选项（Build Options）**
用户可以通过命令行或 `build.zig` 配置构建选项：
- 目标平台（target）
- 优化级别（optimize）
- 自定义选项

# 构建脚本：build.zig

每个 Zig 项目都有一个 `build.zig` 文件，这是构建脚本的入口点。构建脚本必须包含一个公共的 `build()` 函数：

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 构建逻辑在这里实现
}
```

**关键概念**：
- `std.Build`：构建系统的核心结构，提供构建 API
- `b` 参数：构建上下文，用于创建目标对象和配置选项
- 构建步骤：通过 `b.step()` 创建，形成依赖关系图

# 构建系统的工作流程

```
用户运行 zig build
    ↓
解析 build.zig 脚本
    ↓
创建构建步骤图（DAG）
    ↓
执行构建步骤（并发）
    ↓
生成目标文件
    ↓
安装构建产物
```

**示例：简单的构建脚本**

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 1. 创建可执行文件目标
    const exe = b.addExecutable(.{
        .name = "hello",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.graph.host,  // 使用主机目标
        }),
    });
    
    // 2. 安装构建产物
    b.installArtifact(exe);
    
    // 3. 创建运行步骤
    const run_cmd = b.addRunArtifact(exe);
    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_cmd.step);
}
```

**构建命令**：
```bash
# 构建项目
zig build

# 构建并运行
zig build run

# 查看构建摘要
zig build --summary all
```

## 项目初始化

```bash
# 创建新项目
mkdir my-project
cd my-project
zig init

# 项目结构
my-project/
├── build.zig           # 构建脚本
├── build.zig.zon       # 项目清单（依赖管理）
└── src/
    ├── main.zig        # 主程序
    └── root.zig        # 库根文件
```

## build.zig.zon 详解

`build.zig.zon` 是 Zig 项目的清单文件，用于声明项目信息和依赖：

```zig
.{
    // 项目名称
    .name = "my-project",
    
    // 项目版本
    .version = "0.1.0",
    
    // 依赖声明
    .dependencies = .{
        // 从 URL 添加依赖
        .zap = .{
            .url = "https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz",
            .hash = "1220...",  // 依赖包的哈希值
        },
        
        // 从 Git 仓库添加依赖
        .clap = .{
            .url = "https://github.com/Hejsil/zig-clap/archive/refs/heads/master.tar.gz",
            .hash = "1220...",
        },
        
        // 本地路径依赖
        .my_local_lib = .{
            .path = "../my-local-lib",
        },
    },
    
    // 项目路径配置
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
        "LICENSE",
        "README.md",
    },
}
```

# 依赖声明方式详解

**1. URL 依赖**

URL 依赖是最常用的依赖声明方式，支持从远程服务器下载依赖包：

```zig
.dependencies = .{
    .zap = .{
        // 依赖包的下载地址
        .url = "https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz",
        
        // 依赖包的哈希值（用于验证完整性）
        .hash = "1220fe3c8e4b3d7a8c9f1e2d3c4b5a6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4",
    },
},
```

**获取依赖哈希值**：
```bash
# 使用 zig fetch 命令获取哈希值
zig fetch https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz

# 输出示例：
# 1220fe3c8e4b3d7a8c9f1e2d3c4b5a6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4
```

**注意事项**：
- URL 必须指向一个 `.tar.gz` 或 `.tar.xz` 压缩包
- 哈希值确保依赖包的完整性和安全性
- 如果哈希值不匹配，构建会失败并提示正确的哈希值

**2. Git 依赖**

可以直接从 Git 仓库添加依赖：

```zig
.dependencies = .{
    .clap = .{
        // Git 仓库的 tarball 地址
        .url = "https://github.com/Hejsil/zig-clap/archive/refs/heads/master.tar.gz",
        .hash = "1220...",
    },
},
```

**指定分支或标签**：
```zig
// 使用特定标签
.url = "https://github.com/user/repo/archive/refs/tags/v1.0.0.tar.gz",

// 使用特定分支
.url = "https://github.com/user/repo/archive/refs/heads/main.tar.gz",

// 使用特定提交
.url = "https://github.com/user/repo/archive/abc123def456.tar.gz",
```

**3. 本地路径依赖**

本地路径依赖用于开发时的本地测试或内部库：

```zig
.dependencies = .{
    .my_local_lib = .{
        // 相对于 build.zig.zon 的路径
        .path = "../my-local-lib",
    },
},
```

**注意事项**：
- 路径可以是相对路径或绝对路径
- 本地依赖不会发布到远程仓库
- 适用于开发和测试阶段

**4. 版本范围依赖（未来特性）**

Zig 计划支持语义化版本范围：

```zig
// ⚠️ 注意
.dependencies = .{
    .zap = .{
        .version = "^0.8.0",  // 兼容 0.8.x 版本
    },
},
```

# 版本管理最佳实践

**1. 使用明确的版本标签**

```zig
// ✅ 推荐：使用明确的版本标签
// ❌ 错误示例
.zap = .{
    .url = "https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz",
    .hash = "1220...",
},

// ❌ 不推荐：使用 master 分支（不稳定）
.zap = .{
    .url = "https://github.com/zigzap/zap/archive/refs/heads/master.tar.gz",
    .hash = "1220...",
},
```

**2. 锁定依赖版本**

```zig
// ✅ 推荐：使用特定提交哈希
// ❌ 错误示例
.clap = .{
    .url = "https://github.com/Hejsil/zig-clap/archive/abc123def.tar.gz",
    .hash = "1220...",
},

// ❌ 不推荐：使用可变的分支名
.clap = .{
    .url = "https://github.com/Hejsil/zig-clap/archive/refs/heads/main.tar.gz",
    .hash = "1220...",
},
```

**3. 定期更新依赖**

```bash
# 更新依赖到最新版本
zig build --fetch

# 检查依赖更新
zig fetch <url>
```

# 依赖解析机制

Zig 的依赖解析遵循以下步骤：

```
1. 解析 build.zig.zon 文件
   ↓
2. 检查全局缓存（~/.cache/zig/）
   ↓
3. 如果缓存不存在，下载依赖包
   ↓
4. 验证哈希值
   ↓
5. 解压到缓存目录
   ↓
6. 解析依赖的 build.zig.zon（递归）
   ↓
7. 构建依赖图
```

**缓存位置**：
- Linux/macOS: `~/.cache/zig/`
- Windows: `%LOCALAPPDATA%\zig\`

**清理缓存**：
```bash
# 清理特定依赖的缓存
rm -rf ~/.cache/zig/p/<dependency-hash>

# 清理所有缓存
rm -rf ~/.cache/zig/
```

# 项目路径配置

`paths` 字段定义了发布时包含的文件：

```zig
.paths = .{
    "build.zig",        // 构建脚本（必需）
    "build.zig.zon",    // 项目清单（必需）
    "src",              // 源代码目录
    "LICENSE",          // 许可证文件
    "README.md",        // 项目说明
    "examples",         // 示例代码（可选）
},
```

**注意事项**：
- 只包含必要的文件，减小包体积
- 不要包含构建产物（zig-out、zig-cache）
- 不要包含敏感信息（密钥、配置文件等）

# 完整示例：多依赖项目

```zig
.{
    .name = "web-server",
    .version = "1.0.0",
    
    .dependencies = .{
        // HTTP 框架
        .zap = .{
            .url = "https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz",
            .hash = "1220fe3c8e4b3d7a8c9f1e2d3c4b5a6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4",
        },
        
        // 命令行参数解析
        .clap = .{
            .url = "https://github.com/Hejsil/zig-clap/archive/refs/tags/v0.1.0.tar.gz",
            .hash = "1220a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6",
        },
        
        // JSON 解析
        .json = .{
            .url = "https://github.com/getty-zig/json/archive/refs/tags/v0.2.0.tar.gz",
            .hash = "1220z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4",
        },
        
        // 本地测试库
        .test_utils = .{
            .path = "../test-utils",
        },
    },
    
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
        "LICENSE",
        "README.md",
        "examples",
    },
}
```

## build.zig 基础

> 📖 **本节内容来源**：整合自 [Zig 官方构建系统文档](https://ziglang.org/learn/build-system/)

`build.zig` 是 Zig 项目的构建脚本，定义了项目的构建规则、依赖关系和构建步骤。本节将详细介绍 `build.zig` 的核心概念和常见用法。

### build() 函数

每个 `build.zig` 文件必须包含一个公共的 `build()` 函数，这是构建脚本的入口点：

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 构建逻辑在这里实现
}
```

**参数说明**：
- `b: *std.Build`：构建上下文，提供创建目标对象和配置选项的 API
- 函数返回 `void`，因为构建过程通过副作用完成（创建文件、运行命令等）

### 创建可执行文件

最常见的目标对象是可执行文件。以下是创建可执行文件的完整示例：

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 1. 获取标准构建选项
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 2. 创建可执行文件
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 3. 安装构建产物
    b.installArtifact(exe);
    
    // 4. 创建运行步骤
    const run_cmd = b.addRunArtifact(exe);
    
    // 5. 将运行步骤添加到默认构建步骤
    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_cmd.step);
}
```

**代码解析**：

**1. 标准构建选项**
```zig
const target = b.standardTargetOptions(.{});
const optimize = b.standardOptimizeOption(.{});
```
- `target`：目标平台（如 x86_64-linux、aarch64-macos 等）
- `optimize`：优化级别（Debug、ReleaseSmall、ReleaseFast、ReleaseSafe）

用户可以通过命令行覆盖这些选项：
```bash
zig build -Dtarget=aarch64-linux -Doptimize=ReleaseFast
```

**2. 创建可执行文件**
```zig
// 🚫 已废弃：0.15.x 已移除
const exe = b.addExecutable(.{
    .name = "my-app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    }),
});
```
- `name`：输出文件名（不含扩展名）
- `root_source_file`：主源文件路径
- `target` 和 `optimize`：传递标准选项

**3. 安装构建产物**
```zig
b.installArtifact(exe);
```
将构建产物复制到 `zig-out/bin/` 目录

**4. 创建运行步骤**
```zig
const run_cmd = b.addRunArtifact(exe);
const run_step = b.step("run", "Run the application");
run_step.dependOn(&run_cmd.step);
```
- `addRunArtifact()`：创建运行命令
- `b.step()`：创建命名步骤
- `dependOn()`：建立步骤依赖关系

### 创建库文件

Zig 支持创建静态库和动态库：

**静态库示例**：
```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 创建静态库
    const lib = b.addStaticLibrary(.{
        .name = "mylib",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/root.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    b.installArtifact(lib);
}
```

**动态库示例**：
```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 创建动态库
    const lib = b.addSharedLibrary(.{
        .name = "mylib",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/root.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    b.installArtifact(lib);
}
```

**库文件输出位置**：
- 静态库：`zig-out/lib/libmylib.a` (Unix) 或 `zig-out/lib/mylib.lib` (Windows)
- 动态库：`zig-out/lib/libmylib.so` (Linux) 或 `zig-out/lib/mylib.dll` (Windows)

### 添加测试

Zig 内置测试框架，可以在 `build.zig` 中配置测试：

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 创建可执行文件
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    b.installArtifact(exe);
    
    // 创建测试可执行文件
    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 创建运行测试步骤
    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
```

**运行测试**：
```bash
zig build test
```

### 链接系统库

Zig 可以链接系统安装的 C 库：

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

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
    
    // 链接系统库（如 zlib）
    exe.linkSystemLibrary("z");
    exe.linkLibC();
    
    b.installArtifact(exe);
}
```

**注意事项**：
- `linkSystemLibrary()` 会自动查找系统库路径
- `linkLibC()` 链接 C 标准库
- 确保系统已安装对应的开发包（如 `libz-dev`）

### 构建步骤和依赖关系

构建系统通过步骤（Step）和依赖关系组织构建过程：

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 创建自定义步骤
    const build_step = b.step("build", "Build the application");
    const test_step = b.step("test", "Run tests");
    const all_step = b.step("all", "Build and test");
    
    // 建立依赖关系
    all_step.dependOn(build_step);
    all_step.dependOn(test_step);
}
```

**步骤类型**：
- `CompileStep`：编译源代码
- `RunStep`：运行命令
- `WriteFileStep`：生成文件
- `InstallStep`：安装文件

### 完整示例：多目标项目

以下是一个包含可执行文件、库和测试的完整示例：

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 1. 创建库模块
    const lib_mod = b.createModule(.{
        .root_source_file = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
    });
    
    // 2. 创建库文件
    const lib = b.addLibrary(.{
        .name = "mylib",
        .root_module = lib_mod,
        .linkage = .static,
    });
    b.installArtifact(lib);
    
    // 3. 创建可执行文件
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 将库模块导入到可执行文件
    exe.root_module.addImport("mylib", lib_mod);
    b.installArtifact(exe);
    
    // 4. 创建测试
    const lib_tests = b.addTest(.{
        .root_module = lib_mod,
    });
    
    const exe_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 5. 创建运行步骤
    const run_exe = b.addRunArtifact(exe);
    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_exe.step);
    
    // 6. 创建测试步骤
    const run_lib_tests = b.addRunArtifact(lib_tests);
    const run_exe_tests = b.addRunArtifact(exe_tests);
    
    const test_step = b.step("test", "Run all tests");
    test_step.dependOn(&run_lib_tests.step);
    test_step.dependOn(&run_exe_tests.step);
}
```

**项目结构**：
```
my-project/
├── build.zig
├── build.zig.zon
└── src/
    ├── lib.zig      # 库源文件
    └── main.zig     # 主程序
```

**使用方法**：
```bash
# 构建所有目标
zig build

# 运行应用程序
zig build run

# 运行测试
zig build test

# 安装库和可执行文件
zig build install
```

## 在 build.zig 中使用依赖

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 获取依赖
    const zap_dep = b.dependency("zap", .{
        .target = target,
        .optimize = optimize,
    });
    
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 链接依赖模块
    exe.root_module.addImport("zap", zap_dep.module("zap"));
    
    b.installArtifact(exe);
}
```

## 在代码中使用依赖

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");
const zap = @import("zap");

pub fn main(init: std.process.Init) !void {
    // 使用 zap 库创建 HTTP 服务器
    var listener = zap.HttpListener.init(.{
        .port = 3000,
        .on_request = onRequest,
        .log = true,
    });
    
    try listener.listen();
    try std.Io.File.stdout().writeStreamingAll(init.io, "服务器运行在 http://localhost:3000\n");
    
    zap.start(.{
        .threads = 2,
        .workers = 2,
    });
}

fn onRequest(r: zap.Request) void {
    r.sendBody("Hello from Zig with Zap!\n") catch return;
}
```

## 高级构建主题

> 📖 **本节内容来源**：整合自 [Zig 官方构建系统文档](https://ziglang.org/learn/build-system/) 和 [Pedro Park 的 Zig Book](https://pedropark99.github.io/zig-book/Chapters/07-build-system.html)

本节将介绍 Zig 构建系统的高级特性，包括用户选项、交叉编译、条件编译和多目标构建等。

### 用户选项

构建脚本可以定义用户可配置的选项：

**布尔选项**：
```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 定义布尔选项
    const enable_logging = b.option(bool, "logging", "Enable logging") orelse false;
    const enable_debug = b.option(bool, "debug", "Enable debug mode") orelse false;
    
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.standardTargetOptions(.{}),
            .optimize = b.standardOptimizeOption(.{}),
        }),
    });
    
    // 将选项传递给编译器
    const options = b.addOptions();
    options.addOption(bool, "enable_logging", enable_logging);
    options.addOption(bool, "enable_debug", enable_debug);
    
    exe.root_module.addOptions("config", options);
    b.installArtifact(exe);
}
```

**使用方法**：
```bash
# 启用日志
zig build -Dlogging=true

# 启用调试模式
zig build -Ddebug=true

# 同时启用多个选项
zig build -Dlogging=true -Ddebug=true
```

**在代码中使用选项**：
```zig
const std = @import("std");
const config = @import("config");

pub fn main() void {
    if (config.enable_logging) {
        std.debug.print("Logging enabled\n", .{});
    }
    
    if (config.enable_debug) {
        std.debug.print("Debug mode enabled\n", .{});
    }
}
```

**字符串选项**：
```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const app_name = b.option([]const u8, "name", "Application name") orelse "my-app";
    const version = b.option([]const u8, "version", "Application version") orelse "0.1.0";
    
    const exe = b.addExecutable(.{
        .name = app_name,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.standardTargetOptions(.{}),
            .optimize = b.standardOptimizeOption(.{}),
        }),
    });
    
    const options = b.addOptions();
    options.addOption([]const u8, "app_name", app_name);
    options.addOption([]const u8, "version", version);
    
    exe.root_module.addOptions("config", options);
    b.installArtifact(exe);
}
```

### 交叉编译

Zig 的交叉编译能力是其核心优势之一。构建系统支持轻松配置交叉编译：

**指定目标平台**：
```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 允许用户通过命令行指定目标
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
}
```

**交叉编译命令**：
```bash
# 编译为 Linux x86_64
zig build -Dtarget=x86_64-linux

# 编译为 Windows x86_64
zig build -Dtarget=x86_64-windows

# 编译为 macOS aarch64 (Apple Silicon)
zig build -Dtarget=aarch64-macos

# 编译为 Linux ARM
zig build -Dtarget=arm-linux

# 编译为 WebAssembly
zig build -Dtarget=wasm32-freestanding
```

**多目标构建**：
```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    
    // 定义目标平台列表
    const targets = [_]std.Target.Query{
        .{ .cpu_arch = .x86_64, .os_tag = .linux },
        .{ .cpu_arch = .x86_64, .os_tag = .windows },
        .{ .cpu_arch = .aarch64, .os_tag = .macos },
        .{ .cpu_arch = .aarch64, .os_tag = .linux },
    };
    
    // 为每个目标创建构建步骤
    for (targets) |t| {
        const exe = b.addExecutable(.{
            .name = "my-app",
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main.zig"),
                .target = b.resolveTargetQuery(t),
                .optimize = optimize,
            }),
        });
        
        // 为每个目标创建安装步骤
        const target_name = b.fmt("{s}-{s}", .{
            @tagName(t.cpu_arch.?),
            @tagName(t.os_tag.?),
        });
        
        const install_step = b.addInstallArtifact(exe, .{
            .dest_dir = .{
                .override = .{
                    .custom = target_name,
                },
            },
        });
        
        b.getInstallStep().dependOn(&install_step.step);
    }
}
```

**构建输出**：
```
zig-out/
├── bin/
│   ├── x86_64-linux/
│   │   └── my-app
│   ├── x86_64-windows/
│   │   └── my-app.exe
│   ├── aarch64-macos/
│   │   └── my-app
│   └── aarch64-linux/
│       └── my-app
```

### 条件编译

使用构建选项实现条件编译：

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 定义条件编译选项
    const use_ssl = b.option(bool, "ssl", "Enable SSL support") orelse false;
    const backend = b.option(
        []const u8,
        "backend",
        "Backend implementation (epoll, kqueue, iocp)"
    ) orelse "auto";
    
    const exe = b.addExecutable(.{
        .name = "my-server",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 添加编译时选项
    const options = b.addOptions();
    options.addOption(bool, "use_ssl", use_ssl);
    options.addOption([]const u8, "backend", backend);
    exe.root_module.addOptions("build_options", options);
    
    // 根据条件链接库
    if (use_ssl) {
        exe.linkSystemLibrary("ssl");
        exe.linkSystemLibrary("crypto");
        exe.linkLibC();
    }
    
    b.installArtifact(exe);
}
```

**在代码中使用条件编译**：
```zig
const std = @import("std");
const build_options = @import("build_options");

pub fn main() !void {
    if (build_options.use_ssl) {
        std.debug.print("SSL support enabled\n", .{});
    }
    
    // 根据后端选择不同的实现
    const backend = build_options.backend;
    if (std.mem.eql(u8, backend, "epoll")) {
        // Linux epoll 实现
    } else if (std.mem.eql(u8, backend, "kqueue")) {
        // macOS/BSD kqueue 实现
    } else if (std.mem.eql(u8, backend, "iocp")) {
        // Windows IOCP 实现
    }
}
```

### 生成文件

构建系统可以在构建过程中生成源代码文件：

**生成配置文件**：
```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 生成 config.zig 文件
    const config_file = b.addWriteFile("config.zig", b.fmt(
        \\pub const APP_NAME = "{s}";
        \\pub const VERSION = "{s}";
        \\pub const BUILD_TIME = "{s}";
    , .{
        "my-app",
        "1.0.0",
        "2024-01-01",
    }));
    
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.standardTargetOptions(.{}),
            .optimize = b.standardOptimizeOption(.{}),
        }),
    });
    
    // 将生成的文件添加到模块
    exe.root_module.addAnonymousImport("config", .{
        .root_source_file = config_file.get(),
    });
    
    b.installArtifact(exe);
}
```

**使用生成的文件**：
```zig
const std = @import("std");
const config = @import("config");

pub fn main() void {
    std.debug.print("App: {s}\n", .{config.APP_NAME});
    std.debug.print("Version: {s}\n", .{config.VERSION});
    std.debug.print("Build time: {s}\n", .{config.BUILD_TIME});
}
```

### 运行外部命令

构建系统可以在构建过程中运行外部命令：

```zig
// 🚫 已废弃：0.15.x 已移除
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});
    
    // 运行 Git 命令获取版本信息
    const git_version = b.addSystemCommand(&.{
        "git",
        "describe",
        "--tags",
        "--always",
    });
    
    // 捕获命令输出
    const version_output = git_version.captureStdOut();
    
    const exe = b.addExecutable(.{
        .name = "my-app",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    
    // 将版本信息传递给编译器
    const options = b.addOptions();
    options.addOption([]const u8, "version", version_output);
    exe.root_module.addOptions("build_config", options);
    
    b.installArtifact(exe);
}
```

### 安装和发布

构建系统支持灵活的安装配置：

**自定义安装路径**：
```zig
// 🚫 已废弃：0.15.x 已移除
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
    
    // 自定义安装路径
    const install_exe = b.addInstallArtifact(exe, .{
        .dest_dir = .{
            .override = .{
                .custom = "bin",
            },
        },
    });
    
    // 安装配置文件
    const install_config = b.addInstallFile(
        b.path("config/default.conf"),
        "etc/my-app.conf",
    );
    
    // 安装文档
    const install_docs = b.addInstallFile(
        b.path("README.md"),
        "share/doc/my-app/README.md",
    );
    
    b.getInstallStep().dependOn(&install_exe.step);
    b.getInstallStep().dependOn(&install_config.step);
    b.getInstallStep().dependOn(&install_docs.step);
}
```

**安装目录结构**：
```
zig-out/
├── bin/
│   └── my-app
├── etc/
│   └── my-app.conf
└── share/
    └── doc/
        └── my-app/
            └── README.md
```

### 最佳实践

**1. 使用标准选项**：
```zig
// ✅ 推荐：使用标准选项
// ❌ 错误示例
const target = b.standardTargetOptions(.{});
const optimize = b.standardOptimizeOption(.{});

// ❌ 不推荐：硬编码目标
const target = b.resolveTargetQuery(.{
    .cpu_arch = .x86_64,
    .os_tag = .linux,
});
```

**2. 提供合理的默认值**：
```zig
// ✅ 推荐：提供默认值
// ❌ 错误示例
const enable_logging = b.option(bool, "logging", "Enable logging") orelse false;

// ❌ 不推荐：强制用户指定
const enable_logging = b.option(bool, "logging", "Enable logging").?;
```

**3. 模块化构建脚本**：
```zig
// 将复杂逻辑提取为函数
// 🚫 已废弃：0.15.x 已移除
fn buildExe(b: *std.Build, name: []const u8, target: std.Build.ResolvedTarget, optimize: std.builtin.OptimizeMode) *std.Build.Step.Compile {
    return b.addExecutable(.{
        .name = name,
        .root_module = b.createModule(.{
            .root_source_file = b.path(b.fmt("src/{s}.zig", .{name})),
            .target = target,
            .optimize = optimize,
        }),
    });
}
```

**4. 文档化构建选项**：
```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    // 清晰的选项描述
    const enable_ssl = b.option(
        bool,
        "ssl",
        "Enable SSL/TLS support (default: false)"
    ) orelse false;
    
    const backend = b.option(
        []const u8,
        "backend",
        "Select backend: 'epoll' (Linux), 'kqueue' (macOS/BSD), 'iocp' (Windows), or 'auto' (default: auto)"
    ) orelse "auto";
}
```

**5. 使用构建缓存**：
```zig
// 利用构建缓存加速构建
// 🚫 已废弃：0.15.x 已移除
const exe = b.addExecutable(.{
    .name = "my-app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = b.standardTargetOptions(.{}),
        .optimize = b.standardOptimizeOption(.{}),
    }),
});

// 构建系统会自动缓存编译结果
// 只有源文件改变时才会重新编译
```

## 常用构建命令

```bash
# 获取依赖（根据 build.zig.zon）
zig build --fetch

# 构建项目
zig build

# 运行项目
zig build run

# 运行测试
zig build test

# 清理构建缓存
zig build --clean

# 查看所有可用构建步骤
zig build --help
```

## 发布自己的包

> 📖 **本节内容来源**：整合自 [Zig 官方构建系统文档](https://ziglang.org/learn/build-system/) 和社区最佳实践

本节将详细介绍如何发布 Zig 包，让其他开发者可以使用您的代码。

# 发布流程

**1. 准备项目**

在发布之前，确保项目满足以下条件：

**项目结构**：
```
my-project/
├── build.zig           # 构建脚本
├── build.zig.zon       # 项目清单
├── src/
│   ├── root.zig        # 库根文件（导出公共 API）
│   └── internal.zig    # 内部实现
├── README.md           # 项目说明
├── LICENSE             # 许可证文件
└── examples/           # 示例代码（可选）
    └── example.zig
```

**README.md 内容建议**：
```markdown
# my-project

简短的项目描述

## 功能特性

- 功能 1
- 功能 2
- 功能 3

## 安装

在 `build.zig.zon` 中添加依赖：

```zig
.dependencies = .{
    .my_project = .{
        .url = "https://github.com/username/my-project/archive/refs/tags/v1.0.0.tar.gz",
        .hash = "1220...",
    },
},
```

## 使用方法

```zig
const my_project = @import("my-project");

pub fn main() !void {
    // 使用示例
}
```

## API 文档

（详细说明公共 API）

## 许可证

MIT
```

**2. 配置 build.zig.zon**

确保 `build.zig.zon` 配置正确：

```zig
.{
    .name = "my-project",
    .version = "1.0.0",
    
    // 不要包含开发依赖
    .dependencies = .{
        // 只包含库用户需要的依赖
    },
    
    // 明确指定包含的文件
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
        "LICENSE",
        "README.md",
    },
}
```

**3. 创建 Git 标签**

使用语义化版本号创建 Git 标签：

```bash
# 创建带注释的标签
git tag -a v1.0.0 -m "Release version 1.0.0"

# 推送标签到远程仓库
git push origin v1.0.0
```

**语义化版本号规范**：
- `MAJOR.MINOR.PATCH`（如 1.0.0）
- `MAJOR`：不兼容的 API 变更
- `MINOR`：向后兼容的功能新增
- `PATCH`：向后兼容的问题修复

**4. 创建 GitHub Release**

在 GitHub 上创建 Release：

1. 进入仓库的 "Releases" 页面
2. 点击 "Draft a new release"
3. 选择刚创建的标签（v1.0.0）
4. 填写 Release 标题和说明
5. 点击 "Publish release"

**Release 说明模板**：
```markdown
## v1.0.0

### 新增功能
- 功能 1
- 功能 2

### 变更
- 变更 1

### 修复
- 修复 1

### 安装

在 `build.zig.zon` 中添加：

```zig
.my_project = .{
    .url = "https://github.com/username/my-project/archive/refs/tags/v1.0.0.tar.gz",
    .hash = "1220...",
},
```

获取哈希值：
```bash
zig fetch https://github.com/username/my-project/archive/refs/tags/v1.0.0.tar.gz
```
```

**5. 获取并分享哈希值**

```bash
# 获取依赖的哈希值
zig fetch https://github.com/username/my-project/archive/refs/tags/v1.0.0.tar.gz

# 输出示例：
# 1220fe3c8e4b3d7a8c9f1e2d3c4b5a6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4
```

将哈希值添加到 README 和 Release 说明中。

# 最佳实践

**1. API 稳定性**

```zig
// src/root.zig

// ✅ 导出稳定的公共 API
// ❌ 错误示例
pub const Server = @import("server.zig").Server;
pub const Config = @import("config.zig").Config;

// ❌ 不要导出内部实现
// pub const internal = @import("internal.zig");
```

**2. 版本兼容性**

```zig
// ✅ 保持向后兼容
// 💡 最佳实践
pub fn init(config: Config) !Server {
    // 新实现
}

// 保留旧 API（标记为废弃）
pub const initLegacy = init;
```

**3. 文档化 API**

```zig
/// 创建新的服务器实例
/// 
/// 参数：
///   - config: 服务器配置
/// 
/// 返回：
///   - 成功：Server 实例
///   - 失败：错误
/// 
/// 示例：
///   ```zig
///   var server = try Server.init(.{
///       .port = 8080,
///   });
///   ```
pub fn init(config: Config) !Server {
    // 实现
}
```

**4. 提供示例**

在 `examples/` 目录中提供使用示例：

```zig
// examples/basic.zig
const std = @import("std");
const my_project = @import("my-project");

pub fn main() !void {
    var server = try my_project.Server.init(.{
        .port = 8080,
    });
    defer server.deinit();
    
    try server.start();
}
```

**5. 测试覆盖**

确保代码有充分的测试：

```zig
// src/root.zig

test "Server.init" {
    const server = try Server.init(.{
        .port = 8080,
    });
    defer server.deinit();
    
    try std.testing.expect(server.port == 8080);
}
```

**6. 持续集成**

使用 GitHub Actions 自动化测试：

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Zig
        uses: goto-bus-stop/setup-zig@v2
        with:
          version: master
      
      - name: Run tests
        run: zig build test
```

# 发布检查清单

发布前检查以下项目：

**项目结构**：
- [ ] `build.zig` 存在且正确
- [ ] `build.zig.zon` 存在且正确
- [ ] `src/root.zig` 导出公共 API
- [ ] `README.md` 包含安装和使用说明
- [ ] `LICENSE` 文件存在
- [ ] 示例代码可运行

**代码质量**：
- [ ] 所有测试通过
- [ ] 代码格式化（`zig fmt`）
- [ ] 无编译警告
- [ ] 文档完整

**发布准备**：
- [ ] 更新版本号
- [ ] 更新 CHANGELOG
- [ ] 创建 Git 标签
- [ ] 创建 GitHub Release
- [ ] 获取并分享哈希值

**发布后**：
- [ ] 在社区分享（Zig Discord、Reddit 等）
- [ ] 回复用户问题
- [ ] 收集反馈并改进

# 常见问题

**Q: 如何更新已发布的包？**

A: 创建新的版本标签并发布：

```bash
# 更新版本号
# build.zig.zon: .version = "1.1.0"

# 创建新标签
git tag -a v1.1.0 -m "Release version 1.1.0"
git push origin v1.1.0

# 创建 GitHub Release
# 获取新的哈希值
zig fetch https://github.com/username/my-project/archive/refs/tags/v1.1.0.tar.gz
```

**Q: 如何处理破坏性变更？**

A: 遵循语义化版本：

```bash
# 破坏性变更：增加 MAJOR 版本
v1.0.0 → v2.0.0

# 新功能：增加 MINOR 版本
v1.0.0 → v1.1.0

# Bug 修复：增加 PATCH 版本
v1.0.0 → v1.0.1
```

**Q: 如何废弃旧的 API？**

A: 使用文档标记废弃：

```zig
/// 已废弃：请使用 `newFunction` 代替
/// 将在 v2.0.0 中移除
pub const oldFunction = newFunction;
```

# 示例：完整的发布流程

```bash
# 1. 准备发布
git checkout main
git pull origin main

# 2. 更新版本号
# 编辑 build.zig.zon: .version = "1.0.0"

# 3. 更新 CHANGELOG
# 编辑 CHANGELOG.md

# 4. 提交变更
git add .
git commit -m "chore: release v1.0.0"

# 5. 创建标签
git tag -a v1.0.0 -m "Release version 1.0.0"

# 6. 推送
git push origin main
git push origin v1.0.0

# 7. 获取哈希值
zig fetch https://github.com/username/my-project/archive/refs/tags/v1.0.0.tar.gz

# 8. 在 GitHub 上创建 Release
# 填写 Release 说明，包含哈希值

# 9. 在社区分享
# Discord、Reddit、Twitter 等
```
