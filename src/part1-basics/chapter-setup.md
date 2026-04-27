# 开发环境与第一个程序

本章的目标是完成三件事：安装 Zig、确认工具链可用、写出并运行第一个程序。

> **版本说明**
> 本教程面向 **Zig 0.16**。开发版仍在持续演进，标准库和部分 API 可能发生变化。
> 如果使用的是稳定版或其他开发版，示例代码可能需要做少量调整。

## 安装 Zig

### 官方下载（推荐）

最稳妥的做法是从官网下载与当前平台匹配的预编译版本：

- 访问 <https://ziglang.org/download/>
- 下载对应平台的压缩包
- 解压到合适的目录
- 将 Zig 可执行文件所在目录加入 `PATH`

这样做的好处在于：

- 更容易拿到与教程匹配的开发版
- 不依赖系统包管理器的更新节奏
- 避免「教程是新版本，系统装的是旧版本」的落差

### 包管理器安装

也可以通过包管理器安装。

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
> 如果后续示例出现差异，优先确认版本。

## 验证安装

安装完成后，先确认 Zig 可以正常使用：

```bash
zig version
# 例如：0.16.0-dev.xxx+xxxxxxxx
```

终端能正确输出版本号，说明安装成功。

还可以顺便验证几个最常用的命令：

```bash
zig help
zig env
zig version
zig fmt --help
```

## 编辑器支持

编写 Zig 不挑编辑器，任意文本编辑器都可以。

如果希望获得补全、跳转、错误提示、格式化等更好的编辑体验，可以在常用编辑器中安装 Zig 相关扩展并启用语言服务器支持。
像 VS Code、Zed、Neovim 等编辑器通常都有对应的 Zig 开发插件或集成方案。

很多编辑器会自动提示安装或配置 ZLS（Zig Language Server）。
如果需要手动安装、更新或排查问题，建议参考 ZLS 官方说明：

- <https://zigtools.org/zls/install/>

> **注意**：版本兼容很关键。
> ZLS 应尽量与所使用的 Zig 版本匹配。
> 如果用的是开发版 Zig，也应尽量使用对应版本的 ZLS，否则可能出现补全异常、诊断不准确等问题。

## 第一个 Zig 程序

在任意目录创建文件 `hello.zig`：

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

### 这段代码现阶段只需理解三件事

1. `@import("std")`
   导入 Zig 标准库。

2. `pub fn main() void`
   定义程序入口函数。

3. `std.debug.print(...)`
   输出一段文本。

## 关于 `std.debug.print` 的提醒

`std.debug.print` 简单直接，很适合入门示例，但有两点值得留意：

- 它默认输出到 **stderr**，而不是 stdout
- 它非常适合调试和教学中的最小示例
- 后续需要更明确地控制输出流时，可以再学习 stdout 相关 API

## Zig 0.16 的 `main` 形式

| 形式                                     | 用途                                  |
| ---------------------------------------- | ------------------------------------- |
| `pub fn main() void`                     | 最简单的示例                          |
| `pub fn main() !void`                    | 需要 `try` 传播错误                   |
| `pub fn main(_: std.process.Init) !void` | 0.16 推荐：可访问 `io`、`gpa`、`args` |

是否接收 `std.process.Init`（访问初始化上下文）与是否返回 `!void`（错误传播）是两个独立的维度。

## 常用命令与工作流

```bash
zig run hello.zig       # 运行单文件
zig test hello.zig      # 运行测试
zig fmt hello.zig       # 格式化代码
zig build-exe hello.zig # 编译可执行文件
```

排查安装问题时，用 `zig env` 查看标准库路径和版本信息。

入门阶段的建议节奏：写一个很小的示例 → `zig fmt` → `zig run` → 修改再运行 → 读懂编译器报错。

## 关于项目结构：先认识，不急着深入

如果执行过：

```bash
mkdir hello-zig
cd hello-zig
zig init
```

会生成以下项目结构：

```text
hello-zig/
├── build.zig
├── build.zig.zon
└── src/
    ├── main.zig
    └── root.zig
```

现阶段只需知道：

- `src/main.zig` 常作为程序入口
- `build.zig` 是构建脚本
- `build.zig.zon` 是项目清单文件

这些内容会在[构建系统入门](chapter-build-system.md)中专门讲解。本章不展开，是为了避免在熟悉语言基础之前就被工程化细节打断。

## 常见问题

### 为什么复制示例后编不过？

优先检查以下几项：

1. Zig 版本是否和教程版本差异较大
2. 是否漏掉了结尾分号
3. 文件是否保存为 UTF-8 编码
4. `std.debug.print` 是否误写成了别的名字
5. 是否在 `void` 返回的函数里使用了 `try`

### 为什么编辑器提示和命令行编译结果不一致？

常见原因包括：

- 编辑器使用的 Zig 版本和终端里的 Zig 版本不同
- ZLS 版本和 Zig 版本不匹配
- 编辑器缓存了旧的诊断结果

### 是不是必须立刻学会 `std.process.Init` 和 `std.Io`？

不是。
现阶段只需知道：这是 Zig 0.16 中比较常见的新风格。
本章的目标是先把程序跑起来，而不是一开始就彻底理解新 I/O 体系。

## 本章小结

至此，读者应已建立一个可靠的起点：

- Zig 已经安装成功
- 掌握了验证版本的方法
- 了解了基础的编辑器支持配置
- 成功运行了第一个程序
- 认识了 Zig 0.16 中几种常见的 `main` 写法
- 熟悉了最常用的命令：`zig run`、`zig test`、`zig fmt`、`zig build-exe`
