# 构建系统与包管理

本章在[构建系统入门](../part1-basics/chapter-build-system.md)的基础上深入构建图的内部机制，并覆盖库目标、文件生成、交叉编译发布和依赖管理。

构建 API 在 0.x 阶段仍会演进，本章优先强调概念、结构和模式。

## 构建图的核心机制

构建系统基于有向无环图（DAG）组织步骤，步骤之间通过 `dependOn` 建立依赖关系。

### 惰性求值

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const lib = b.addLibrary(.{
        .name = "mylib",
        .linkage = .static,
        .root_module = b.createModule(.{
            .root_source_file = b.path("lib.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    b.installArtifact(lib);

    const exe = b.addExecutable(.{
        .name = "demo",
        .root_module = b.createModule(.{
            .root_source_file = b.path("demo.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });
    exe.root_module.linkLibrary(lib);

    if (b.option(bool, "enable-demo", "install the demo too") orelse false) {
        b.installArtifact(exe);
    }
}
```

`addExecutable` 无条件调用，但 demo 可执行文件不会被构建——除非传入 `-Denable-demo=true`，因为只有 `installArtifact(exe)` 执行时才会把它加入依赖图。这意味着在 `build.zig` 中定义大量目标只会消耗构建脚本的运行时间（几毫秒），不会触发编译。

### 检测目标平台

```zig
const target = b.standardTargetOptions(.{});

if (target.result.os.tag == .windows) {
    exe.root_module.linkSystemLibrary("user32", .{});
}
```

`target.result.os.tag` 反映的是通过 `-Dtarget` 指定的编译目标，而非构建主机平台。

## 库目标：静态库与动态库

### 静态库

```zig
const lib = b.addLibrary(.{
    .name = "mylib",
    .linkage = .static,
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
    }),
});
b.installArtifact(lib);
```

消费端使用相同 API：

```zig
exe.root_module.linkLibrary(lib);
```

静态库输出为 `.a`（Linux/macOS）或 `.lib`（Windows），默认安装到 `zig-out/lib/`。

`addLibrary` 和 `createModule` 的核心字段：

**`addLibrary`：**

| 字段           | 含义                                             | 默认值    |
| -------------- | ------------------------------------------------ | --------- |
| `.name`        | 库名称，决定输出文件名（`mylib` → `libmylib.a`） | 必填      |
| `.linkage`     | 链接方式：`.static` / `.dynamic`                 | `.static` |
| `.version`     | 语义化版本，仅动态库使用                         | `null`    |
| `.root_module` | 根编译单元                                       | 必填      |

**`createModule`：**

| 字段                | 含义           | 默认值                |
| ------------------- | -------------- | --------------------- |
| `.root_source_file` | 入口源文件路径 | `null`（可选）        |
| `.target`           | 编译目标平台   | `null`（默认 native） |
| `.optimize`         | 优化级别       | `null`（默认 Debug）  |

### 动态库

`.linkage` 改为 `.dynamic`，附加 `.version`：

```zig
const lib = b.addLibrary(.{
    .name = "mylib",
    .linkage = .dynamic,
    .version = .{ .major = 1, .minor = 0, .patch = 0 },
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
    }),
});
b.installArtifact(lib);
```

构建系统根据 `.version` 生成平台惯例的版本化文件结构：

```text
zig-out/lib/
├── libmylib.so -> libmylib.so.1
├── libmylib.so.1 -> libmylib.so.1.0.0
└── libmylib.so.1.0.0
```

消费端代码不变——同样使用 `exe.root_module.linkLibrary(lib)`，构建系统自动处理静态/动态差异。

### 选择

| 场景           | 建议                    |
| -------------- | ----------------------- |
| 仅项目内部使用 | 静态库                  |
| 独立分发       | 动态库                  |
| 版本化 API     | 动态库（带 `.version`） |
| 交叉编译       | 静态库更可控            |

## 文件生成与代码生成

构建过程中生成文件是常见需求——代码生成、构建时信息嵌入、资源预处理。构建系统提供可组合的步骤来支持这些场景。

### 运行项目工具

核心模式：用 Zig 写工具，构建时通过 `addRunArtifact` 运行，输出通过 `addOutputFileArg` 捕获。

以代码生成器为例。假设存在协议定义文件 `protocol.txt`：

```text
MSG_LOGIN 1
MSG_LOGOUT 2
MSG_DATA 3
```

构建脚本中配置工具运行：

```zig
const tool = b.addExecutable(.{
    .name = "protocol_gen",
    .root_module = b.createModule(.{
        .root_source_file = b.path("tools/protocol_gen.zig"),
        .target = b.graph.host,
    }),
});

const run_gen = b.addRunArtifact(tool);
run_gen.addFileArg(b.path("protocol.txt"));
const generated = run_gen.addOutputFileArg("protocol.zig");
```

实际执行的命令等价于：

```bash
protocol_gen /path/to/protocol.txt /path/to/.zig-cache/.../protocol.zig
```

工具生成的 `protocol.zig` 内容类似：

```zig
pub const MSG_LOGIN: u8 = 1;
pub const MSG_LOGOUT: u8 = 2;
pub const MSG_DATA: u8 = 3;
```

几个关键点：

- **`target` 设为 `b.graph.host`**：工具在构建机器上运行，目标是主机平台。
- **`addFileArg`**：将文件路径追加到命令行，同时注册依赖追踪——输入变化时自动重新执行。
- **`addOutputFileArg`**：声明输出文件，返回 `LazyPath`。
- **`addArg`**：追加普通字符串。如果需要带标志的参数，在合适位置插入 `addArg("--verbose")`。
- **`addPrefixedFileArg`**：将前缀和文件路径合并成单个参数（如 `-F/path/to/file`）。

### 将生成文件导入源码

通过 `addAnonymousImport` 接入主程序：

```zig
exe.root_module.addAnonymousImport("protocol", .{
    .root_source_file = generated,
});
```

源码中通过名称引用：

```zig
const protocol = @import("protocol");
```

`addAnonymousImport` 创建匿名模块，其名称与 `@import` / `@embedFile` 中的字符串匹配。

### WriteFiles

当需要多个生成文件放在同一目录下时，使用 `WriteFiles`：

```zig
const wf = b.addWriteFiles();
_ = wf.add("config.txt", "version=1.0.0\nmode=release\n");
_ = wf.addCopyFile(some_output, "data.bin");
```

两个方法都返回对应文件的 `LazyPath`。`wf.getDirectory()` 返回整个目录的 `LazyPath`。

### UpdateSourceFiles

`UpdateSourceFiles` 用于将生成文件写回源码树，仅作开发者工具，不应在正常构建流程中使用：

```zig
const wf = b.addUpdateSourceFiles();
wf.addCopyFileToSource(generated_file, "src/protocol.zig");

const update_step = b.step("update-protocol", "Update generated protocol file");
update_step.dependOn(&wf.step);
```

通过 `zig build update-protocol` 手动触发。

### 运行系统命令

```zig
const run = b.addSystemCommand(&.{ "git", "describe", "--always" });
const output = run.captureStdOut();
```

系统依赖会降低跨平台能力，优先使用项目内部 Zig 工具。

## 多目标构建与交叉编译发布

### 多目标同时构建

```zig
const targets: []const std.Target.Query = &.{
    .{ .cpu_arch = .aarch64, .os_tag = .macos },
    .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .musl },
    .{ .cpu_arch = .x86_64, .os_tag = .windows },
};

for (targets) |t| {
    const exe = b.addExecutable(.{
        .name = "myapp",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.resolveTargetQuery(t),
            .optimize = .ReleaseSafe,
        }),
    });
    b.installArtifact(exe);
}
```

`std.Target.Query` 的常用字段：

| 字段                                  | 含义         | 省略时               |
| ------------------------------------- | ------------ | -------------------- |
| `.cpu_arch`                           | CPU 架构     | 当前主机架构         |
| `.os_tag`                             | 操作系统     | 当前主机系统         |
| `.abi`                                | 二进制接口   | 系统默认             |
| `.cpu_model`                          | CPU 型号     | 由架构和系统自动决定 |
| `.os_version_min` / `.os_version_max` | 系统版本范围 | 当前平台默认         |
| `.ofmt`                               | 目标文件格式 | 由 OS 决定           |

`.{}` 表示全部默认（native），`.{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .musl }` 明确指定三个维度。

### 自定义安装目录

默认所有平台产物安装到同一目录会互相覆盖，使用 `addInstallArtifact` 配合 `dest_dir` 分离：

```zig
for (targets) |t| {
    const exe = b.addExecutable(.{
        .name = "myapp",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.resolveTargetQuery(t),
            .optimize = .ReleaseSafe,
        }),
    });

    const install = b.addInstallArtifact(exe, .{
        .dest_dir = .{
            .override = .{
                .custom = t.zigTriple(b.allocator) catch unreachable,
            },
        },
    });
    b.getInstallStep().dependOn(&install.step);
}
```

`dest_dir` 的三层结构：`.default`（按类型放 `bin/` 或 `lib/`）、`.disabled`（不安装）、`.override`（自定义子目录）。

输出结构：

```text
zig-out/
├── aarch64-macos/
│   └── myapp
├── x86_64-linux-musl/
│   └── myapp
└── x86_64-windows/
    └── myapp.exe
```

### 跨平台测试

```zig
const test_targets = [_]std.Target.Query{
    .{},
    .{ .cpu_arch = .x86_64, .os_tag = .linux },
    .{ .cpu_arch = .aarch64, .os_tag = .macos },
};

for (test_targets) |t| {
    const unit_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.resolveTargetQuery(t),
        }),
    });

    const run_tests = b.addRunArtifact(unit_tests);
    run_tests.skip_foreign_checks = true;
    test_step.dependOn(&run_tests.step);
}
```

`skip_foreign_checks` 跳过外来架构测试的执行，但仍然编译，确保代码在目标平台上能通过编译检查。

## 依赖管理

### `build.zig.zon` 完整示例

```zig
.{
    .name = "my-project",
    .version = "0.1.0",
    .fingerprint = 0xa8b2f3e4c59d7061, // zig init 自动生成
    .minimum_zig_version = "0.16.0",
    .dependencies = .{
        .zap = .{
            .url = "https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz",
            .hash = "1220...", // zig fetch --save 生成
        },
        .my_local_lib = .{
            .path = "../my-local-lib",
        },
    },
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
    },
}
```

字段说明：

- **`.name`**：包名称，也是其他项目用 `zig fetch --save` 引入时的依赖键名。
- **`.version`**：语义化版本号。
- **`.fingerprint`**：`zig init` 生成的全局唯一标识，区分同名但实质不同的包。不应手动修改。fork 后应删除并重新运行 `zig build`。
- **`.minimum_zig_version`**：最低 Zig 版本。
- **`.dependencies`**：每个依赖提供 `.url` + `.hash`（远程）或 `.path`（本地）。
- **`.paths`**：纳入哈希计算和分发的文件集合。

### 依赖固定原则

1. **固定具体来源**：使用版本标签或具体提交的归档，避免 `main`/`master` 等漂移分支。
2. **哈希锁定版本**：`.hash` 承担了 lockfile 的角色——包的真实来源是哈希，URL 只是获取途径。因此不必单独维护 lockfile。
3. **本地路径依赖适合开发，不适合发布**：分享或稳定发布应使用远程依赖加哈希锁定。
4. **一个项目固定一个 Zig 版本**：`.minimum_zig_version` 明确版本边界，避免多版本混用。

### `zig fetch --save` 工作流

```bash
zig fetch --save https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz
```

工具自动下载归档、计算哈希、写入 `build.zig.zon`。

指定自定义依赖名：

```bash
zig fetch --save=my_zap <url>
```

`--save-exact` 原样保存 URL，不做规范化。省略 `--save` 只打印哈希到 stdout。

依赖声明完成后，一次性拉取全部依赖：

```bash
zig build --fetch
```

之后构建不再需要网络。

### 在 `build.zig` 中接入依赖

```zig
const dep = b.dependency("zap", .{
    .target = target,
    .optimize = optimize,
});
exe.root_module.addImport("zap", dep.module("zap"));
```

三步数据流：

1. **`b.dependency("zap", args)`**：从 `build.zig.zon` 查找依赖，执行其 `build.zig`，传递 `target`/`optimize` 确保编译选项一致。
2. **`dep.module("zap")`**：获取依赖通过 `b.addModule` 暴露的模块。名称不一定和依赖键名相同，需要查看依赖的 `build.zig`。
3. **`addImport("zap", module)`**：挂载模块，第一个参数是源码中 `@import("zap")` 使用的名称，可自定义。

### 惰性依赖（Lazy Dependency）

对于大型依赖或可选依赖，在 `build.zig.zon` 中标记为惰性，直到首次使用时才下载：

```zig
.dependencies = .{
    .heavy_lib = .{
        .url = "...",
        .hash = "...",
        .lazy = true,
    },
}
```

在 `build.zig` 中使用 `lazyDependency` 代替 `dependency`：

```zig
if (b.lazyDependency("heavy_lib", .{
    .target = target,
    .optimize = optimize,
})) |dep| {
    exe.root_module.addImport("heavy", dep.module("heavy_lib"));
}
```

惰性依赖的特性：未下载时 `lazyDependency` 返回 `null`，触发后台下载，下次构建时可用；适合条件功能或超大依赖，避免 `zig build --fetch` 时必须下载全部内容。

## 系统库链接

```zig
const exe = b.addExecutable(.{
    .name = "zip-tool",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .link_libc = true,
    }),
});
exe.root_module.linkSystemLibrary("z", .{});
```

链接的是系统已安装的 zlib，而非 Zig 模块。构建失败可能来自系统环境问题（库未安装或不在搜索路径），而非 Zig 语法。可通过 `--search-prefix` 指定额外搜索路径。

两类依赖对比：

| 类型     | 来源                           | 典型场景           |
| -------- | ------------------------------ | ------------------ |
| Zig 依赖 | 带 `build.zig.zon` 的 Zig 项目 | 跨平台、版本可控   |
| 系统库   | 系统 C 库或平台库              | 系统打包、平台绑定 |

C++ 库需设置 `link_libcpp = true`（与 `link_libc` 对应）。

上游 Zig 包优先通过 Zig 构建系统提供依赖；系统库链接主要用于系统级打包场景（Debian、Homebrew、Nix）。

## 排查指南

构建失败时按以下顺序排查：

1. Zig 版本——是否与项目的 `.minimum_zig_version` 兼容
2. 依赖——`build.zig.zon` 中的 URL 和哈希是否一致，依赖是否已下载
3. 系统库——是否已安装且可被链接
4. 构建 API——API 是否在 Zig 版本间发生了变更

常见误区：

- 把构建 API 字段名当作永久稳定写法（0.x 阶段字段会变化）
- 复制占位哈希而非使用 `zig fetch --save` 生成
- 使用漂移的依赖来源（主分支 tarball）
- 把构建问题都当成代码问题（实际可能是版本/环境/依赖）
- 静态库和动态库混用导致符号找不到

## 本章小结

- 构建图底层是 **DAG**，步骤通过 `dependOn` 建立关系，构建运行器确定执行顺序和并发
- **惰性求值**意味着只有被依赖图引用的目标才会编译
- **静态库**适合内部使用和交叉编译，**动态库**适合分发和版本化 API
- 文件生成的核心模式：`addRunArtifact` + `addOutputFileArg` + `addAnonymousImport`
- **多目标构建**配合自定义安装目录分离各平台产物
- 依赖管理要求固定来源和哈希；`zig fetch --save` 是标准工作流
- **惰性依赖**（`lazy: true` + `lazyDependency`）用于可选或大型依赖，按需下载
- 系统库链接受系统环境影响，与 Zig 依赖管理是独立的两条路径
- 构建失败按"版本 → 依赖 → 系统环境 → 构建 API"顺序排查
