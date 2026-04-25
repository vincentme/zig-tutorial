# 构建系统入门

> **章节定位**：本章位于基础部分，主题是从"直接操作单个源文件"过渡到"组织一个项目的构建流程"。交叉编译、依赖管理、复杂构建配置等主题放在高级部分的[构建系统与包管理](../part2-advanced/chapter-package-management.md)章节展开。

前面的章节大量使用 `zig run`、`zig test` 等单文件命令。这些命令适合语法练习和临时验证，但项目开发通常需要统一的构建入口来组织工作流。

## 从单文件命令到项目构建

单文件命令直接作用于当前文件：

```bash
zig run hello.zig
zig test parse.zig
```

项目构建则围绕整个项目组织工作流：

```bash
zig build
zig build run
zig build test
```

两者的区别不在于"命令更多了"，而在于操作对象不同：

- `zig run hello.zig`：直接操作一个文件
- `zig build run`：执行项目定义好的 `run` 步骤

`zig build` 的作用不是替代手写的编译或运行命令，而是在项目层面组织工作流。当命令行变得冗长、需要构建多个目标、需要暴露配置选项、或者构建流程因平台不同而变化时，`zig build` 就变得很有价值。

## `zig init` 生成的最小项目

在一个空目录中执行下面的命令：

```bash
mkdir my-project
cd my-project
zig init
```

生成的结构如下：

```text
my-project/
├── build.zig
├── build.zig.zon
└── src/
    ├── main.zig
    └── root.zig
```

这些文件的职责如下

### `build.zig`

`build.zig` 是构建脚本，使用 Zig 语言编写。它描述项目的构建结构：要构建哪些目标、如何运行这些目标、如何暴露 `run`、`test` 等步骤，以及哪些参数可以从命令行传入。

`zig build`、`zig build run`、`zig build test` 的行为都由这里定义。

### `build.zig.zon`

`build.zig.zon` 是项目清单文件，用来描述项目的基础元信息，也参与依赖来源的声明。它属于项目配置的一部分，更完整的依赖管理会在高级章节展开。

一个最小的 `build.zig.zon` 往往类似这样：

```zig
.{
    .name = "my-project",
    .version = "0.0.0",
    .fingerprint = 0xa8b2f3e4c59d7061, // zig init 自动生成，请勿手动修改
    .minimum_zig_version = "0.16.0",
    .dependencies = .{},
    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
    },
}
```

> **版本说明**：Zig 0.16-dev 起，`build.zig.zon` 新增了 `.fingerprint`、`.minimum_zig_version` 和 `.paths` 字段。`.fingerprint` 由 `zig init` 自动生成，用于全局唯一标识一个包，不应手动修改。`.minimum_zig_version` 声明包所支持的最低 Zig 版本。`.paths` 列出包中需要纳入哈希计算和分发的文件集合。

### src/main.zig 与 src/root.zig

`src/main.zig` 通常是可执行程序入口所在的位置。`src/root.zig` 通常作为库的根模块入口使用。很多最小项目在前期主要关注可执行入口，因此 `root.zig` 可能暂时不会频繁使用。

## `build.zig` 在做什么

`build.zig` 的核心作用不是把几条命令改写成脚本，而是描述项目有哪些目标、这些目标如何构建，以及外部可以通过哪些步骤触发它们。

最小示例如下：

```zig
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

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    const run_step = b.step("run", "Run the application");
    run_step.dependOn(&run_cmd.step);
}
```

这段代码包含了一个最小项目的几个核心部分。

### `target` 和 `optimize`

```zig
const target = b.standardTargetOptions(.{});
const optimize = b.standardOptimizeOption(.{});
```

这两行给项目接入了标准构建参数：

- `target`：目标平台，即产物面向的运行环境。当前在 macOS 上开发但需要生成 Windows 或 Linux 产物时，就需要指定：
  ```bash
  zig build -Dtarget=x86_64-windows
  ```
- `optimize`：优化级别，即这次构建更偏向调试还是发布：
  ```bash
  zig build -Doptimize=ReleaseFast
  ```

Zig 提供四种优化模式，各有侧重：

| 模式 | 特点 | 典型场景 |
| ---- | ---- | -------- |
| `Debug` | 包含完整调试信息，启用所有安全检查，不优化性能 | 开发调试阶段（默认） |
| `ReleaseSafe` | 启用优化，同时保留运行时安全检查 | 对安全性要求高的发布（服务端、加密、金融） |
| `ReleaseFast` | 最大性能优化，移除安全检查 | 对性能要求极致的场景（游戏、高频计算） |
| `ReleaseSmall` | 优化二进制体积 | 嵌入式、资源受限环境 |

完整优化行为差异请参考 Zig 官方文档。

如果不传 `-Dtarget` 和 `-Doptimize`，它们会使用合理的默认值：

- `target` 默认为当前主机的原生平台（native target）
- `optimize` 默认为 `Debug` 模式

这两个默认值恰好是本地开发时最常用的配置。Zig 的"显式"原则在这里体现为：`build.zig` 的作者**显式调用**了 `standardTargetOptions` 和 `standardOptimizeOption`，并**显式将结果传递**给 `addExecutable` 的 `.target` 和 `.optimize` 字段。命令行参数没有传入时使用默认值，这属于"有合理默认值的显式配置"，而不是"隐式行为"——运行 `zig build --help` 可以看到这些参数及其说明。

另外需要注意，`target` 和 `optimize` 传入 `addExecutable` 后控制的是**编译器行为**（生成什么平台的代码、启用哪些优化）。如果你的源代码需要读取这些信息（比如根据目标平台选择不同的代码路径），那是另一个层面的问题，需要通过后面讲到的 `addOptions` 机制把配置从构建脚本显式传入程序。

### `addExecutable`

```zig
const exe = b.addExecutable(.{
    .name = "my-app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    }),
});
```

这一段定义了一个可执行目标，包括：

- 目标名称：`my-app`
- 入口源文件：`src/main.zig`
- 构建参数：`target` 与 `optimize`

其中 `root_module` 表示这个编译目标的根模块配置，用来组织源文件和构建参数。

### `installArtifact`

```zig
b.installArtifact(exe);
```

这一行的作用是把构建产物纳入项目的安装流程，也就是默认输出的一部分。没有这一步，定义出来的目标不会自动进入默认构建流程。

对应关系如下：

- `addExecutable`：定义目标
- `installArtifact`：把目标纳入默认输出流程

### `addRunArtifact` 和 `step("run", ...)`

```zig
const run_cmd = b.addRunArtifact(exe);

const run_step = b.step("run", "Run the application");
run_step.dependOn(&run_cmd.step);
```

这里分成两个动作：

- `addRunArtifact(exe)`：定义"如何运行这个产物"
- `step("run", ...)`：把这个运行动作暴露成项目里的 `run` 步骤

这样项目里才会出现下面的命令入口：

```bash
zig build run
```

`zig build` 能执行哪些步骤，不是固定不变的，而是由当前项目的 `build.zig` 决定的。

### 构建图初步概念

Zig 的构建系统基于有向无环图（DAG）。`build.zig` 中定义的每一个编译目标、运行命令、安装动作都是一个"步骤"（Step），步骤之间通过依赖边连接。构建系统根据依赖关系确定执行顺序，没有依赖关系的步骤可以并发执行。

`install` 步骤是默认的主步骤——直接运行 `zig build` 时，构建系统会执行所有挂载到 `install` 下的步骤。`installArtifact` 就是把一个编译目标的输出挂载到 `install` 步骤上。

构建产物的输出涉及两个目录：

- `zig-out/`：安装前缀目录，存放最终产物。用户可以通过 `-p` 选项自定义路径。
- `.zig-cache/`：构建缓存目录，存放中间产物和增量编译所需的缓存信息，用于加速后续构建。它可以安全删除（下次构建会重新生成），通常不应纳入版本控制。

构建脚本应该通过构建系统提供的 API 来引用路径，而不是硬编码输出目录。硬编码路径会破坏缓存机制、并发安全性和构建图的可组合性。

## 一个最小可运行项目的闭环

把前面的内容串起来，一个最小项目的基本工作流就是这几个命令：

| 命令 | 作用 |
| ---- | ---- |
| `zig build` | 执行项目默认构建（即 `install` 步骤） |
| `zig build run` | 执行项目定义的 `run` 步骤 |
| `zig build run -- arg1 arg2` | 向程序传递命令行参数（`--` 分隔构建参数与程序参数） |
| `zig build test` | 执行项目定义的 `test` 步骤 |
| `zig build --help` | 查看当前项目定义了哪些步骤 |

其中 `zig build run` 和 `zig build test` 能否使用，取决于项目是否定义了对应步骤。接手新项目时，优先查看 `zig build --help`。

## 把配置从构建脚本传给程序

前面提到的 `target` 和 `optimize` 控制的是编译器行为，你的源代码通常不需要关心它们。但构建系统也可以把配置值传给你的**程序代码**，例如：

- 是否开启日志
- 是否启用某个实验特性
- 是否切换某种行为模式

最小示例如下：

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const enable_logging = b.option(
        bool,
        "logging",
        "Enable logging output",
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

这个过程包含三个动作：用 `b.option(...)` 从构建命令读取参数，用 `b.addOptions()` 组织这些配置，再把它们作为一个模块加到程序里。

这样，代码中就可以通过 `@import("config")` 读取配置：

```zig
const std = @import("std");
const config = @import("config");

pub fn main() void {
    if (config.enable_logging) {
        std.debug.print("logging enabled\n", .{});
    }
}
```

运行时可以这样传入参数：

```bash
zig build -Dlogging=true
```

`build.zig` 不只决定如何构建，也可以决定程序在构建时拿到哪些配置。

## 如何把测试接入 `zig build test`

单文件测试前面已经出现过：

```bash
zig test math.zig
```

项目阶段更常见的做法，是把测试接入项目工作流，使测试也成为统一入口的一部分：

```bash
zig build test
```

最小示例如下：

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

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

这一段和前面的 `run` 逻辑对应关系很直接：

- `addTest(...)`：定义测试目标
- `addRunArtifact(...)`：定义如何运行测试产物
- `step("test", ...)`：给项目提供 `zig build test` 入口

`zig build test` 能否使用，取决于项目是否定义了对应的 `test` 步骤。

两种测试方式的区别如下：

- `zig test file.zig`：直接对一个文件或目标执行测试
- `zig build test`：执行项目定义好的测试工作流

两者都很常见，只是面向的层级不同。

## 更复杂的工程组织

以下主题在更复杂的项目中会逐步出现。

### 模块拆分

项目变大以后，代码通常会拆分成多个模块，而不是把所有逻辑都放进 `main.zig`。这时 `build.zig` 会承担更多职责，例如创建额外模块、管理导入关系、为不同目标复用模块配置。

### 多目标项目

一个项目不一定只有一个可执行程序。它还可能同时包含：

- 多个可执行目标
- 库目标
- 示例程序
- 测试目标
- 文档或其他辅助步骤

这会让 `build.zig` 的结构更丰富，但核心思想不变：用步骤组织项目工作流。

### 库目标

项目除了构建可执行文件，还可以构建库目标——静态库和动态库。静态库在链接时被完整嵌入最终产物，动态库则在运行时加载。构建脚本中通过 `b.addLibrary` 创建库目标，其他目标通过 `linkLibrary` 消费它。详见[高级章节](../part2-advanced/chapter-package-management.md)。

### 外部依赖与系统库

随着项目复杂度上升，还会遇到：

- 外部依赖接入
- 系统库链接
- C 代码集成
- 文件生成与代码生成（构建期运行工具、生成 Zig 源码、为 `@embedFile` 生成资源）
- 多平台发布策略
- 更复杂的平台差异处理

这些主题都放在高级部分系统展开。

## 最常用的几个构建命令

本章提到的命令有：

```bash
# 构建项目
zig build

# 运行项目中定义的 run 步骤
zig build run

# 运行项目中定义的 test 步骤
zig build test

# 指定优化级别
zig build -Doptimize=ReleaseFast

# 指定目标平台
zig build -Dtarget=x86_64-windows

# 查看当前项目定义了哪些步骤
zig build --help
```

比命令本身更重要的是下面两点：

1. `zig build run`、`zig build test` 的前提是项目里定义了对应步骤。
2. 不清楚一个项目支持什么时，优先看 `zig build --help`。

## 本章要点

1. 单文件命令适合练习和最小实验，项目开发更需要统一的构建入口。
2. `build.zig` 的核心作用不是"写几条命令"，而是描述项目的构建、运行和测试工作流。
3. `zig init` 生成的最小项目中，`build.zig` 负责构建流程，`build.zig.zon` 是项目清单，`src/main.zig` 和 `src/root.zig` 分别对应常见的可执行入口和库入口。
4. `addExecutable` 用于定义目标，`installArtifact` 用于把产物纳入默认安装或输出流程。
5. `addRunArtifact` 定义"如何运行这个产物"，而 `step("run", ...)`、`step("test", ...)` 则是在项目里显式提供命令入口。
6. `zig build run`、`zig build test` 是否可用，取决于项目是否定义了对应步骤。
7. `target` 和 `optimize` 是最常见的构建参数，分别对应目标平台和优化级别。
8. `build.zig` 也可以把构建期配置传给程序代码。
9. 构建系统基于有向无环图（DAG），步骤之间通过依赖边连接。`zig-out/` 存放最终产物，`.zig-cache/` 存放构建缓存。

→ 以下主题将在[高级章节](../part2-advanced/chapter-package-management.md)展开：

- `build.zig.zon` 的依赖声明细节
- 构建图的核心机制（DAG、惰性求值、并发与缓存）
- 库目标：静态库与动态库
- 文件生成与代码生成
- 多目标构建与交叉编译发布
- 外部依赖接入
- 哈希获取与固定
- 系统库与 C 代码集成