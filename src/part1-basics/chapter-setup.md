# 开发环境与第一个程序

本章目标：安装 Zig、确认工具可用、写出并运行第一个程序。

> **版本说明**
> 本教程面向 **Zig 0.16.0-dev**。由于开发版仍在持续演进，标准库和部分 API 可能发生变化。
> 如果使用的是稳定版或其他开发版，示例代码可能需要做少量调整。

---

## 本章你会学到什么

本章涵盖：

- 安装并验证 Zig 编译器
- 为编辑器配置基本的 Zig 开发支持
- 运行一个最小的 `Hello, World!` 程序
- 理解 `zig run`、`zig test`、`zig fmt` 这几个最常用命令
- 对 Zig 0.16 中常见的 `main` 写法有一个清晰的初步认识

---

## 安装 Zig

### 官方下载（推荐）

最稳妥的方式是从官方页面下载与当前平台匹配的预编译版本：

- 访问 <https://ziglang.org/download/>
- 下载对应平台的压缩包
- 解压到合适的位置
- 将 Zig 可执行文件所在目录加入 `PATH`

这样做的好处是：

- 更容易拿到教程对应的开发版
- 不依赖系统包管理器的更新速度
- 避免"教程是新版本，系统装的是旧版本"的落差

### 包管理器安装

也可以使用包管理器安装。

**macOS**

```bash
brew install zig
```

**Linux**

```bash
# Arch Linux
sudo pacman -S zig

# Ubuntu（通常不是最新版）
sudo snap install zig --classic --beta
```

**Windows**

```powershell
# 使用 scoop
scoop install zig

# 或使用 chocolatey
choco install zig
```

> **注意**：包管理器提供的版本通常偏稳定，不一定和本教程使用的 `0.16.0-dev` 完全一致。
> 如果后续示例出现差异，优先先确认版本。

---

## 验证安装

安装完成后，先确认 Zig 已经可用：

```bash
zig version
# 例如：0.16.0-dev.xxx+xxxxxxxx
```

如果终端能正确输出版本号，说明安装成功。

还可以确认几个最常用的命令是否存在：

```bash
zig help
zig env
zig version
zig fmt --help
```

---

## 编辑器支持

任意文本编辑器均可编写 Zig。

如果想获得补全、跳转、错误提示、格式化等体验，可以在常见编辑器中安装 Zig 相关扩展，并启用语言服务器支持。
例如 `VS Code`、`Zed`、`Neovim` 等编辑器通常都有对应的 Zig 开发插件或集成方案。

很多编辑器会自动提示安装或配置 `ZLS`（Zig Language Server）。
如果需要手动安装、更新或排查问题，建议参考 ZLS 官方安装说明：

- <https://zigtools.org/zls/install/>

> **注意**：版本兼容很重要
> `ZLS` 应尽量与所使用的 Zig 版本匹配。
> 如果使用的是开发版 Zig，也应尽量使用对应版本的 `ZLS`，否则可能出现补全异常、诊断不准确等问题。

---

## 第一个 Zig 程序

在任意目录中创建文件 `hello.zig`：

```zig
const std = @import("std");

pub fn main() void {
    std.debug.print("Hello, World!\n", .{});
}
```

运行它：

```bash
zig run hello.zig
```

预期输出：

```text
Hello, World!
```

### 这段代码先只理解三件事

1. `@import("std")`
   导入 Zig 标准库。

2. `pub fn main() void`
   定义程序入口函数。

3. `std.debug.print(...)`
   输出一段文本。

---

## 关于 `std.debug.print` 的一个小提醒

`std.debug.print` 很适合写入门示例，因为它简单直接。
但需要注意：

- `std.debug.print` 默认输出到 **stderr**
- 它很适合调试和教学中的最小示例
- 如果想更明确地控制输出流，后面可以再学习 `stdout` 相关 API

---

## Zig 0.16 的 `main` 形式

| 形式 | 用途 |
| ---- | ---- |
| `pub fn main() void` | 最简单的示例 |
| `pub fn main() !void` | 需要 `try` 传播错误 |
| `pub fn main(_: std.process.Init) !void` | 0.16 推荐：可访问 `io`、`gpa`、`args` |

是否接收 `std.process.Init`（访问初始化上下文）与是否返回 `!void`（错误传播）是两个独立维度。

---

## 常用命令与工作流

```bash
zig run hello.zig      # 运行单文件
zig test hello.zig     # 运行测试
zig fmt hello.zig      # 格式化代码
zig build-exe hello.zig # 编译可执行文件
```

排查安装问题时使用 `zig env` 查看标准库路径和版本信息。

入门建议的节奏：写一个很小的示例 → `zig fmt` → `zig run` → 修改再运行 → 看懂编译器报错。

---

## 关于项目结构：先认识，不急着展开

如果运行过：

```bash
mkdir hello-zig
cd hello-zig
zig init
```

生成的项目结构如下：

```text
hello-zig/
├── build.zig
├── build.zig.zon
└── src/
    ├── main.zig
    └── root.zig
```

现在只需要知道：

- `src/main.zig` 常作为程序入口
- `build.zig` 是构建脚本
- `build.zig.zon` 是项目清单文件

这些内容会在[构建系统入门](chapter-build-system.md)里专门讲。本章不展开讲解，是为了避免在还没熟悉语言基础之前被工程化细节打断。

---

## 常见问题

### 为什么我复制示例后编不过？

优先检查这几件事：

1. 你的 Zig 版本是不是和教程差异较大
2. 是否漏掉了结尾分号
3. 文件是不是保存为 UTF-8 编码
4. 是否把 `std.debug.print` 写成了别的名字
5. 是否在 `void` 返回的函数里使用了 `try`

### 为什么编辑器提示和命令行编译结果不一致？

通常是因为：

- 编辑器使用的 Zig 版本和终端里的 Zig 版本不同
- ZLS 版本和 Zig 版本不匹配
- 编辑器缓存了旧的诊断结果

### 我是不是必须立刻学会 `std.process.Init` 和 `std.Io`？

不是。
你只需要先知道：这是 Zig 0.16 中比较常见的新风格。
本章目标是先让你把程序跑起来，而不是要求你一开始就彻底理解新 I/O 体系。

---

## 本章小结

本章建立了一个可靠的起点：

- Zig 已经安装成功
- 知道如何验证版本
- 知道如何配置基础编辑器支持
- 已经运行了第一个程序
- 认识了 Zig 0.16 中几种常见的 `main` 写法
- 知道了最常用的几个命令：`zig run`、`zig test`、`zig fmt`、`zig build-exe`
