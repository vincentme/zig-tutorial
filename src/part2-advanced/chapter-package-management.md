# 构建系统与包管理

> **进阶**：
>
> 本章不是基础部分"构建系统入门"的重复，而是把视角推进到更真实的工程场景：
>
> - 项目如何组织多个目标
> - `build.zig` 和 `build.zig.zon` 分别负责什么
> - 依赖如何接入和固定
> - 哪些构建相关写法更容易受版本影响
>
> 对 Zig 来说，构建系统和依赖管理是很重要的工程能力；但它们也恰好属于**版本敏感度相对更高**的区域。因此，本章会优先强调**原则、结构和阅读方法**，而不是把某个开发版快照下的每个 API 名字都当成长期稳定规范。

## 先建立整体心智模型

理解 Zig 构建系统时，最重要的不是先记命令，而是先看清：

- **构建脚本是代码**：通过 `build.zig` 来描述构建图
- **构建图由步骤组成**：编译、运行、测试、生成文件、安装，都可以是 step
- **依赖有独立清单**：项目元信息和远程/本地依赖通常写在 `build.zig.zon`
- **工程重点是"组织关系"**，而不是"背下所有字段名"

## `build.zig` 和 `build.zig.zon` 各负责什么？

这两个文件经常一起出现，但职责并不相同。

| 文件 | 主要职责 |
| ---- | -------- |
| `build.zig` | 描述如何构建：目标、步骤、模块关系、测试、运行、链接方式 |
| `build.zig.zon` | 描述项目清单：名称、版本、依赖来源、需要发布的路径 |

可以把它们理解为：

- `build.zig` 更像"构建逻辑"
- `build.zig.zon` 更像"项目清单和依赖声明"

## 一个最小项目通常长什么样？

```text
my-project/
├── build.zig
├── build.zig.zon
└── src/
    ├── main.zig
    └── root.zig
```

这并不是唯一组织方式，但对很多小型项目和教程项目来说已经足够。

## `build.zig`：从基础到依赖接入

基本的 `build.zig` 结构——定义目标、暴露 `run` / `test` 步骤、传入 `target` 和 `optimize` 参数——已在[《构建系统入门》](../part1-basics/chapter-build-system.md)中介绍。本章不再重复最小示例，而是聚焦于**在已有构建脚本中接入依赖**这一步。

典型的 `build.zig` 需要回答的进阶问题包括：

- 是否需要接入外部 Zig 依赖？
- 是否需要链接系统库？
- 模块之间的导入关系如何组织？
- 多个目标之间是否共享模块？

这些问题在项目规模增长后会逐渐出现。核心原则始终不变：

> **构建脚本在描述"目标之间如何组织"，而不是简单拼接编译命令。**

## `build.zig.zon`：项目清单与依赖来源

`build.zig.zon` 经常用于记录：

- 项目名称和版本
- 包的唯一标识（fingerprint）
- 最低 Zig 版本要求
- 远程依赖
- 本地路径依赖
- 发布时包含哪些路径

一个"最小但真实"的示意写法如下：

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

> **注意**：
>
> 上面 `hash` 字段里的内容是**占位说明**，不是可直接复制的真实哈希。真正项目里应当用本地工具得到的实际值填入。

### 各字段说明

- **`.name`**：包名称，也是其他项目通过 `zig fetch --save` 引入时默认使用的依赖键名。
- **`.version`**：语义化版本号。
- **`.fingerprint`**：由 `zig init` 自动生成的全局唯一标识。它用于区分同名但实质不同的包，**不应手动修改**。如果 fork 了一个仍在维护的上游项目，应删除此字段后重新运行 `zig build` 以重新生成。
- **`.minimum_zig_version`**：声明包所支持的最低 Zig 版本。
- **`.dependencies`**：依赖声明，每个依赖要么提供 `.url` + `.hash`（远程），要么提供 `.path`（本地）。
- **`.paths`**：列出需要纳入哈希计算和分发的文件集合。

> 更基础的 `build.zig.zon` 介绍（不含依赖的最小清单）参见[《构建系统入门》](../part1-basics/chapter-build-system.md)。

## 依赖应该如何固定？

对于教程读者来说，依赖管理里最值得建立的习惯有四个。

### 1. 尽量固定具体来源
优先使用：

- 具体版本标签
- 具体提交对应的归档

谨慎使用：

- `main`
- `master`
- 任何会不断漂移的分支 tarball

原因很简单：如果依赖来源会变，那么今天能构建，不代表明天还能构建。

### 2. 哈希不是装饰，它是可重复构建的一部分
哈希值的作用，不只是"防篡改"，也是让开发者知道：

- 拿到的是不是同一份归档
- 构建是否可重现
- 某次依赖更新是否真的发生了变化

Zig 的包管理器以哈希为核心——包的真正来源是哈希值，URL 只是获取该哈希对应内容的途径之一。因此 `build.zig.zon` 中的 `.hash` 字段本身就承担了"锁定"依赖版本的职责，其作用类似于其他语言生态中的 lockfile。

### 3. 本地路径依赖适合开发，不适合假装发布稳定版本
本地依赖在这些场景里很好用：

- 同时开发多个本地项目
- 教程实验
- 内部工具组合

但如果要分享项目或保证其他人可复现，就应当清楚说明这种依赖关系。

### 4. 一个项目尽量固定一个 Zig 版本语境
当构建系统、依赖管理和标准库 API 都处于演进中时，最稳妥的做法通常是：

- 选定一个 Zig 版本
- 在这个版本上把项目维护稳定
- 升级时集中修一轮

而不是在多个版本写法之间长期混用。`.minimum_zig_version` 字段可以帮助明确这一边界。

## 如何获取依赖哈希？——`zig fetch --save`

添加一个远程依赖的典型工作流是：

1. 确认依赖归档的 URL（通常是某个 release tag 对应的 tarball）
2. 运行 `zig fetch --save <url>`
3. 工具会自动下载归档、计算哈希，并把依赖条目写入 `build.zig.zon`

例如：

```bash
zig fetch --save https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz
```

执行后，`build.zig.zon` 的 `.dependencies` 中会自动出现对应条目，包括 `.url` 和 `.hash`。

如果需要指定不同于默认的依赖名，可以使用：

```bash
zig fetch --save=my_zap https://github.com/zigzap/zap/archive/refs/tags/v0.8.0.tar.gz
```

还有一个 `--save-exact` 变体，它会原样保存 URL 而不做规范化处理。

> **注意**：依赖哈希应该来自工具输出，而不是手写、猜写或随便复制。

如果只想获取哈希而不自动写入 `build.zig.zon`，可以省略 `--save`，工具会把哈希打印到标准输出。

当所有依赖都已声明完毕后，还可以用以下命令一次性拉取全部依赖到本地缓存：

```bash
zig build --fetch
```

这样后续构建就不再需要网络连接。

## 在 `build.zig` 中接入依赖

当某个依赖已经写进 `build.zig.zon` 之后，下一步是在 `build.zig` 中获取它，并把模块接入自己的目标。

在[《构建系统入门》](../part1-basics/chapter-build-system.md)介绍过的基础构建脚本之上，接入依赖只需增加两步——获取依赖、导入模块：

```zig
// 1. 获取依赖（名称对应 build.zig.zon 中 .dependencies 的键名）
const dep = b.dependency("zap", .{
    .target = target,
    .optimize = optimize,
});

// 2. 把依赖提供的模块导入到自己的目标中
exe.root_module.addImport("zap", dep.module("zap"));
```

完整写法放在上下文中就是：

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

### 这里要抓住什么？

- 依赖不是"自动魔法导入"的——仍然需要在构建脚本中明确接入
- `b.dependency()` 的第一个参数对应 `build.zig.zon` 中 `.dependencies` 下的键名
- `dep.module()` 获取依赖暴露出的特定模块
- `addImport()` 让源代码中可以 `@import("zap")` 来使用该模块
- 目标平台和优化级别往往也会传递给依赖

## 系统库链接与 Zig 依赖不是一回事

教程里很容易把"拉一个 Zig 依赖"和"链接一个系统库"混成同一件事，但它们其实不同。

### Zig 依赖
通常指：

- 一个带 `build.zig.zon` / `build.zig` 的 Zig 项目
- 通过清单和构建脚本把它加入当前项目

### 系统库
通常指：

- 系统已经安装好的 C 库或平台库
- 在构建脚本中显式声明链接需求

示意写法通常类似：

```zig
exe.root_module.linkSystemLibrary("z", .{});
exe.root_module.link_libc = true;
```

这类写法也可能随着版本演进出现细节调整，但至少应当先理解：

- 这是在链接系统提供的库
- 不是在导入一个 Zig 模块仓库
- 构建失败时，问题可能来自系统环境而不是 Zig 语法

## 真实项目里常见的几个构建步骤

随着项目变大，`build.zig` 通常会逐步组织成几个常见 step：

- 构建主程序
- 构建并运行测试
- 运行示例
- 生成文件或代码
- 安装构建产物

最重要的不是"step 越多越高级"，而是：

- 每个 step 的职责清楚
- 依赖关系明确
- 团队成员和未来维护者能一眼看懂工作流

## 什么时候该继续拆分模块和目标？

一开始不需要做复杂构建图。

通常在出现这些信号时，再考虑拆分会更合适：

- 同一份代码既要做库，又要做可执行文件
- 项目有多个二进制目标
- 测试、示例、代码生成之间已经有明显分工
- 某些模块需要被多个目标共享

如果项目还很小，保持 `build.zig` 简洁通常比"为了工程感而过度设计"更重要。

## 构建系统里最容易踩的坑

### 1. 把版本敏感 API 当成永久稳定写法
尤其是在 `0.x` 阶段，这是非常常见的误区。

### 2. 复制教程里的占位哈希
如果把示意用的占位符直接复制到项目里，构建当然会失败。应当通过 `zig fetch --save` 或 `zig fetch` 获取真实哈希。

### 3. 使用漂移的依赖来源
例如直接依赖某个仓库的主分支归档。这样最容易引入"昨天能用、今天突然坏掉"的问题。

### 4. 把构建问题都当成代码问题
很多构建失败其实来自：

- Zig 版本不一致
- 依赖版本漂移
- 系统库没装
- 目标平台配置不匹配

### 5. `build.zig` 写得过于炫技
构建脚本也是给人维护的。比起堆很多 helper 和分支，更重要的是让意图清楚。

## 当构建失败时，可以先这样排查

1. **先确认 Zig 版本**
2. **再确认项目依赖是否针对该版本维护**
3. **检查 `build.zig.zon` 里的 URL 和哈希是否一致**
4. **检查系统库是否真的已安装且可被链接**
5. **最后再看是否是 `build.zig` API 本身发生了版本差异**

这个顺序很重要，因为很多时候问题根本不在业务代码里。

## 本章小结

对 Zig 的构建系统与包管理来说，最重要的不是记住多少字段名，而是建立这几层判断：

- `build.zig` 负责构建逻辑，`build.zig.zon` 负责项目清单与依赖来源
- `build.zig.zon` 中的 `.fingerprint` 用于全局唯一标识包，`.minimum_zig_version` 用于声明版本下限
- 依赖管理的关键是**固定来源、固定哈希、可重复构建**
- `zig fetch --save` 是添加依赖的标准工作流，哈希字段本身承担了版本锁定的职责
- 系统库链接和 Zig 依赖接入是两类不同问题
- 构建 API 可能会演进，但"构建图、目标、模块关系、步骤依赖"这些概念更稳定
- 构建失败时，应优先按"版本 → 依赖 → 系统环境 → 构建脚本"的顺序排查

建立了这些直觉之后，在真实项目里阅读 `build.zig`、接入依赖、组织测试和产物时，就会更容易看清"这段构建脚本到底在描述什么"。