# 构建系统进阶与包管理

> **进阶**：
>
> 本章在基础部分[《构建系统入门》](../part1-basics/chapter-build-system.md)之上，把视角推进到更真实的工程场景：
>
> - 构建图的核心机制（DAG、惰性求值、并发与缓存）
> - 库目标：静态库与动态库
> - 文件生成与代码生成
> - 多目标构建与交叉编译发布
> - 依赖管理：声明、固定、接入
> - 系统库链接
>
> 构建 API 在 0.x 阶段仍会演进，本章优先强调**概念、结构和模式**，而不是把每个字段名当成长期稳定规范。

## 回顾：`build.zig` 与 `build.zig.zon` 的分工

这两个文件经常一起出现，但职责并不相同。

| 文件 | 主要职责 |
| ---- | -------- |
| `build.zig` | 描述如何构建：目标、步骤、模块关系、测试、运行、链接方式 |
| `build.zig.zon` | 描述项目清单：名称、版本、依赖来源、需要发布的路径 |

- `build.zig` 更像"构建逻辑"
- `build.zig.zon` 更像"项目清单和依赖声明"

本章将沿三个方向展开：

1. **更深入地理解构建图**——它不是"按顺序执行命令"，而是一张有向无环图
2. **更多样的目标类型**——静态库、动态库、生成文件、多目标交叉编译
3. **依赖管理**——如何在 `build.zig.zon` 中声明、固定、接入依赖

## 构建图的核心机制

构建系统基于有向无环图（DAG）组织步骤，步骤之间通过 `dependOn` 建立依赖关系。在此基础上，有两个值得深入理解的机制。

### 惰性求值示例

考虑这样一个模式：

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

注意：`addExecutable` 是无条件调用的，但 demo 可执行文件**不会被构建**——除非你传入 `-Denable-demo=true`。原因很简单：它没有被加入依赖图。

这个模式意味着你可以安全地在 `build.zig` 中定义许多目标，而不用担心浪费时间——只有被依赖图引用到的目标才会真正执行编译。

### 在构建脚本中检测目标平台

`build.zig` 中有时需要根据目标平台做条件判断——为不同平台链接不同库、添加不同源文件、或设置不同编译选项。这时可以检查解析后的 `target` 对象：

```zig
const target = b.standardTargetOptions(.{});
// ...创建目标后...

if (target.result.os.tag == .windows) {
    exe.root_module.linkSystemLibrary("user32", .{});
}
```

`target.result.os.tag` 反映的是用户通过 `-Dtarget` 指定的实际编译目标，而非构建主机的平台。这对于需要针对不同操作系统调整链接策略或源文件列表的项目很有用。

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

在其他目标中使用：

```zig
const exe = b.addExecutable(.{
    .name = "myapp",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    }),
});
exe.root_module.linkLibrary(lib);
b.installArtifact(exe);
```

静态库的输出文件是 `.a`（Linux/macOS）或 `.lib`（Windows），默认安装到 `zig-out/lib/`。

### 动态库

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

在 Linux 上，动态库的输出结构如下：

```text
zig-out/lib/
├── libmylib.so -> libmylib.so.1
├── libmylib.so.1 -> libmylib.so.1.0.0
└── libmylib.so.1.0.0
```

消费动态库的代码与静态库完全相同——同样使用 `exe.root_module.linkLibrary(lib)`。构建系统会自动处理两者的差异。

### 如何选择

| 场景 | 建议 |
| ---- | ---- |
| 只被项目内部使用 | 静态库更简单 |
| 需要作为独立组件分发 | 动态库 |
| 需要版本化 API | 动态库（带 `.version`） |
| 交叉编译 | 静态库更可控 |

## 文件生成与代码生成

构建过程中生成文件是常见需求——序列化格式、代码生成、资源配置等。Zig 构建系统为此提供了一组可组合的步骤。

### 运行项目自带的工具

最常见的模式：用 Zig 写一个工具，在构建时运行它，捕获输出。

```zig
const tool = b.addExecutable(.{
    .name = "my_tool",
    .root_module = b.createModule(.{
        .root_source_file = b.path("tools/my_tool.zig"),
        .target = b.graph.host,
    }),
});

const run_tool = b.addRunArtifact(tool);
run_tool.addArg("--input");
run_tool.addFileArg(b.path("data/input.json"));
run_tool.addArg("--output");
const output = run_tool.addOutputFileArg("generated.txt");
```

几个关键点：

- **`target` 设为 `b.graph.host`**：工具在构建机器上运行，所以目标是主机而非交叉编译目标。
- **`addFileArg`**：将文件路径作为参数传入，同时跟踪文件依赖——如果文件变更，步骤会重新执行。
- **`addOutputFileArg`**：声明输出文件，返回一个 `LazyPath`。后续步骤可以通过这个路径引用生成的文件。

### 为 `@embedFile` 生成资源

如果生成的文件需要在编译时通过 `@embedFile` 嵌入，可以使用 `addAnonymousImport`：

```zig
exe.root_module.addAnonymousImport("generated_data", .{
    .root_source_file = output,
});
```

在源代码中：

```zig
const data = @embedFile("generated_data");
```

`addAnonymousImport` 创建一个匿名模块，其名称与 `@embedFile` / `@import` 中的字符串匹配。

### 生成 Zig 源代码

同样的模式可以用来生成 `.zig` 源文件：

```zig
const tool = b.addExecutable(.{
    .name = "codegen",
    .root_module = b.createModule(.{
        .root_source_file = b.path("tools/codegen.zig"),
        .target = b.graph.host,
    }),
});

const run_codegen = b.addRunArtifact(tool);
const generated_zig = run_codegen.addOutputFileArg("person.zig");

exe.root_module.addAnonymousImport("person", .{
    .root_source_file = generated_zig,
});
```

源代码中通过 `const person = @import("person");` 引用。

### WriteFiles 步骤

当需要在同一个目录下生成多个文件时，`WriteFiles` 更方便：

```zig
const wf = b.addWriteFiles();
_ = wf.add("config.txt", "version=1.0.0\n");
_ = wf.addCopyFile(some_output, "data.bin");
```

`wf.getDirectory()` 获取父目录的 `LazyPath`。每个文件也可以单独获取 `LazyPath`。

### UpdateSourceFiles 步骤

`UpdateSourceFiles` 用于将生成的文件**写回源码树**。

> **警告**：这个步骤**不应在正常构建流程中使用**——它仅作为开发者工具，用于更新受版本控制的生成文件。在正常构建中使用会导致缓存失效和并发问题。

```zig
const wf = b.addUpdateSourceFiles();
wf.addCopyFileToSource(generated_file, "src/protocol.zig");

const update_step = b.step("update-protocol", "Update generated protocol file");
update_step.dependOn(&wf.step);
```

这样就可以通过 `zig build update-protocol` 手动触发文件更新，而不会干扰正常的构建流程。

### 运行系统工具

`b.addSystemCommand` 可以调用外部系统命令：

```zig
const run = b.addSystemCommand(&.{ "git", "describe", "--always" });
const output = run.captureStdOut();
run.addFileArg(b.path("some_file")); // 如果需要
```

但系统依赖会让项目更难跨平台构建。除非必要，优先使用项目内部的 Zig 工具。

## 多目标构建与交叉编译发布

### 多目标同时构建

Zig 的交叉编译是开箱即用的能力。在 `build.zig` 中为多个目标构建，只需遍历目标列表：

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

构建系统会自动并发处理不同目标的编译。

### 自定义安装目录

默认情况下，所有平台的产物安装到同一个 `zig-out/bin/`——不同平台的文件会互相覆盖。使用 `addInstallArtifact` 配合自定义 `dest_dir` 来分离：

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

为多个目标编译测试时，`skip_foreign_checks` 可以跳过在当前主机上无法执行的外来架构测试（但仍然会编译，确保代码在目标平台上能通过编译检查）：

```zig
const test_targets = [_]std.Target.Query{
    .{}, // native
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

这样即使你在 x86_64 Linux 上开发，也能确认代码在 aarch64 macOS 上至少可以编译通过。

## 项目清单与依赖管理

### `build.zig.zon` 字段说明

`build.zig.zon` 是项目的清单文件，用于记录项目元信息和依赖来源。一个"最小但真实"的示意写法：

```zig
.{
    .name = "my-project",
    .version = "0.1.0",
    .fingerprint = 0xa8b2f3e4c59d7061, // zig init 自动生成，请勿手动修改
    .minimum_zig_version = "0.16.0",
    .dependencies = .{
        .zap = .{
            .url = "https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz",
            .hash = "<实际由工具得到的哈希>",
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

> **注意**：上面 `hash` 字段里的内容是**占位说明**，不是可直接复制的真实哈希。真正项目里应当用工具得到的实际值填入。

各字段含义：

- **`.name`**：包名称，也是其他项目通过 `zig fetch --save` 引入时默认使用的依赖键名。
- **`.version`**：语义化版本号。
- **`.fingerprint`**：由 `zig init` 自动生成的全局唯一标识。它用于区分同名但实质不同的包，**不应手动修改**。如果 fork 了一个仍在维护的上游项目，应删除此字段后重新运行 `zig build` 以重新生成。
- **`.minimum_zig_version`**：声明包所支持的最低 Zig 版本。
- **`.dependencies`**：依赖声明，每个依赖要么提供 `.url` + `.hash`（远程），要么提供 `.path`（本地）。
- **`.paths`**：列出需要纳入哈希计算和分发的文件集合。

> 更基础的 `build.zig.zon` 介绍（不含依赖的最小清单）参见[《构建系统入门》](../part1-basics/chapter-build-system.md)。

### 依赖固定原则

依赖管理中最重要的四个习惯：

**1. 尽量固定具体来源**

优先使用具体版本标签或具体提交对应的归档。谨慎使用 `main`、`master` 或任何会不断漂移的分支 tarball。原因很简单：如果依赖来源会变，今天能构建不代表明天还能构建。

**2. 哈希是可重复构建的一部分**

哈希值不只是"防篡改"，它让开发者知道拿到的是同一份归档、构建可重现、某次更新是否真的发生了变化。Zig 的包管理器以哈希为核心——包的真正来源是哈希值，URL 只是获取该哈希对应内容的途径之一。因此 `.hash` 字段本身就承担了"锁定"版本的职责，其作用类似于其他语言生态中的 lockfile。

**3. 本地路径依赖适合开发，不适合假装稳定发布**

本地依赖在同时开发多个项目、教程实验、内部工具组合中很好用。但如果要分享项目或保证可复现，应当使用远程依赖加哈希锁定的方式。

**4. 一个项目固定一个 Zig 版本语境**

当构建系统、依赖管理和标准库 API 都在演进时，最稳妥的做法是选定一个版本、在其上维护稳定、升级时集中修一轮，而不是多版本混用。`.minimum_zig_version` 可以帮助明确这一边界。

### `zig fetch --save` 工作流

添加远程依赖的标准工作流：

1. 确认依赖归档的 URL（通常是某个 release tag 对应的 tarball）
2. 运行 `zig fetch --save <url>`
3. 工具自动下载归档、计算哈希，并把依赖条目写入 `build.zig.zon`

```bash
zig fetch --save https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz
```

如果需要指定不同于默认的依赖名：

```bash
zig fetch --save=my_zap https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz
```

`--save-exact` 变体会原样保存 URL 而不做规范化处理。

> 依赖哈希应该来自工具输出，而不是手写或猜测。省略 `--save` 只会打印哈希到标准输出。

当所有依赖都已声明后，可以用以下命令一次性拉取全部依赖到本地缓存：

```bash
zig build --fetch
```

后续构建就不再需要网络连接。

### 在 `build.zig` 中接入依赖

依赖写进 `build.zig.zon` 后，在 `build.zig` 中获取并接入：

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // 获取 build.zig.zon 中声明的依赖
    const dep = b.dependency("zap", .{
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

    // 把依赖的模块导入到可执行目标
    exe.root_module.addImport("zap", dep.module("zap"));
    b.installArtifact(exe);
}
```

核心要点：

- 依赖不会自动导入——需要在构建脚本中明确接入
- `b.dependency()` 的第一个参数对应 `build.zig.zon` 中 `.dependencies` 下的键名
- `dep.module()` 获取依赖暴露出的特定模块
- `addImport()` 让源代码中可以 `@import("zap")` 来使用该模块
- 目标平台和优化级别通常也会传递给依赖

### 系统库链接

系统库链接与 Zig 依赖是两类不同的事。一个更完整的示例：

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
b.installArtifact(exe);
```

这里链接的是系统提供的 zlib 库，不是 Zig 模块仓库。如果构建失败，问题可能来自系统环境——zlib 是否安装、是否在搜索路径中——而不是 Zig 语法。

可以通过 `--search-prefix` 指定额外的库搜索路径。

两类依赖的对比：

| 类型 | 来源 | 典型场景 |
| ---- | ---- | -------- |
| Zig 依赖 | 带 `build.zig.zon` / `build.zig` 的 Zig 项目 | 跨平台、版本可控 |
| 系统库 | 系统已安装的 C 库或平台库 | 打包发行、平台绑定 |

另外，如果链接的是 C++ 库而非 C 库，还需设置 `link_libcpp = true`（与 `link_libc` 对应）：

```zig
.root_module = b.createModule(.{
    .root_source_file = b.path("src/main.zig"),
    .target = target,
    .optimize = optimize,
    .link_libcpp = true,
}),
```

对于上游维护者来说，优先通过 Zig 构建系统提供依赖（更好的跨平台支持和可重复构建）。系统库链接主要用于系统级打包场景（Debian、Homebrew、Nix 等）。

## 常见问题与排查

### 构建系统里最容易踩的坑

**1. 把版本敏感 API 当成永久稳定写法**

尤其是在 `0.x` 阶段，构建 API 的字段名和函数签名可能会变化。关注概念和模式，而不是死记字段名。

**2. 复制教程里的占位哈希**

如果把示意用的占位符直接复制到项目里，构建当然会失败。应当通过 `zig fetch --save` 或 `zig fetch` 获取真实哈希。

**3. 使用漂移的依赖来源**

直接依赖某个仓库的主分支归档，最容易引入"昨天能用、今天突然坏掉"的问题。

**4. 把构建问题都当成代码问题**

很多构建失败其实来自 Zig 版本不一致、依赖版本漂移、系统库没装或目标平台配置不匹配。

**5. `build.zig` 写得过于炫技**

构建脚本也是给人维护的。比起堆很多 helper 和分支，更重要的是让意图清楚。

**6. 混淆库目标类型**

静态库和动态库的链接行为不同。如果项目期望动态加载却构建为静态库，运行时可能出现符号找不到等问题。

### 当构建失败时，按这个顺序排查

1. **先确认 Zig 版本**
2. **再确认项目依赖是否针对该版本维护**
3. **检查 `build.zig.zon` 里的 URL 和哈希是否一致**
4. **检查系统库是否真的已安装且可被链接**
5. **最后再看是否是 `build.zig` API 本身发生了版本差异**

这个顺序很重要，因为很多时候问题根本不在业务代码里。

## 本章小结

- 构建图的底层模型是 **DAG**：步骤之间通过 `dependOn` 建立关系，构建运行器自动确定执行顺序和并发
- **惰性求值**意味着你可以安全地定义很多目标，只有被依赖图引用到的才会真正构建
- **静态库**适合项目内部使用和交叉编译，**动态库**适合分发和版本化 API
- 文件生成的核心模式是 `addRunArtifact` + `addOutputFileArg` + `addAnonymousImport`——工具在构建机上运行，输出通过 `LazyPath` 传递给后续步骤
- **多目标构建**利用 Zig 的交叉编译能力，配合自定义安装目录分离各平台产物
- **依赖管理**的关键是固定来源、固定哈希、可重复构建；`zig fetch --save` 是标准工作流
- `build.zig` 负责构建逻辑，`build.zig.zon` 负责项目清单与依赖声明
- **系统库链接**与 Zig 依赖接入是两类不同问题——前者依赖系统环境，后者通过构建系统管理
- 构建失败时按"版本 → 依赖 → 系统环境 → 构建脚本"的顺序排查

建立了这些直觉之后，在真实项目里阅读 `build.zig`、接入依赖、组织测试和产物时，就会更容易看清"这段构建脚本到底在描述什么"。