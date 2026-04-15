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

## Zig 0.16 中常见的 `main` 写法

在 Zig 0.16 中，有不止一种 `main` 写法。
本教程后续示例会根据需要使用不同形式，现在只需要先认识它们。

### 最小写法

```zig
const std = @import("std");

pub fn main() void {
    std.debug.print("Hello, World!\n", .{});
}
```

适合：

- 最简单的示例
- 不需要向上传播错误
- 只做少量调试输出

### 需要错误传播时

```zig
const std = @import("std");

pub fn main() !void {
    try std.fs.cwd().access("build.zig", .{});
}
```

适合：

- 入口函数里要使用 `try`
- 希望把错误直接向外返回
- 示例中已经开始接触显式错误处理

### 使用 `std.process.Init` / `std.process.Init.Minimal` 的 0.16 风格写法

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) void {
    std.debug.print("Hello from Zig 0.16!\n", .{});
}
```

也可能看到更完整的形式：

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    std.debug.print("Hello from Zig 0.16!\n", .{});
}
```

可以先简单理解为：

- `std.process.Init.Minimal`：只接收最基本的初始化上下文
- `std.process.Init`：接收更完整的初始化上下文

适合：

- 想和 Zig 0.16 的新式入口风格保持一致
- 在示例或标准库代码里看到了这种写法
- 后续可能需要访问入口初始化信息

如果示例不需要使用上下文，可以将参数写成 `_`。

### 应该怎么选？

对于本章的第一个程序：

- **想最快跑起来**：用 `pub fn main() void`
- **马上要用 `try`**：用 `pub fn main() !void`
- **想和本教程后续多数 0.16 示例保持一致**：用 `pub fn main(_: std.process.Init.Minimal) void`、`pub fn main(_: std.process.Init) void`，或它们对应的 `!void` 版本

> **注意**
> `main` 是否接收 `std.process.Init`，和是否返回 `!void`，是两个不同维度的问题：
> - 是否接收 `init`，取决于是否需要那份初始化上下文
> - 是否返回 `!void`，取决于是否需要传播错误

---

## 一个更贴近 0.16 的输出示例

后面接触 0.16 的 I/O 风格时，可能会看到类似下面的写法：

```zig
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    try std.Io.File.stdout().writeStreamingAll(init.io, "Hello, World!\n");
}
```

这段代码的意义是：

- 使用 `std.process.Init`
- 通过 `init.io` 访问 I/O 上下文
- 明确写入标准输出
- 使用 `try` 传播潜在错误

不过请注意两点：

1. 这比最小版 `Hello, World!` 更贴近 0.16 的 I/O 思路
2. 它也更容易让初学者一开始就被细节绊住

所以本章建议先用最小版本跑通，后续再逐步理解这个版本。

---

## 现在最值得记住的几个命令

在学习早期，最常用的不是一大堆复杂命令，而是下面这几个：

### 运行单文件程序

```bash
zig run hello.zig
```

### 运行测试

```bash
zig test hello.zig
```

### 格式化代码

```bash
zig fmt hello.zig
```

### 构建可执行文件

```bash
zig build-exe hello.zig
```

入门阶段掌握这四个命令，已经足够覆盖大多数单文件练习场景。

---

## 一个推荐的最小工作流

刚开始学 Zig 时，可以把每次练习控制在以下流程中：

1. 新建一个 `.zig` 文件
2. 写一个很小的示例
3. 用 `zig fmt` 格式化
4. 用 `zig run` 运行
5. 修改一点点代码再运行
6. 看懂编译器报错在说什么

例如：

```bash
zig fmt hello.zig
zig run hello.zig
zig test hello.zig
```

这个节奏非常适合入门，因为它能帮助快速建立三种感觉：

- Zig 代码长什么样
- Zig 编译器如何报错
- Zig 工具链在日常开发中怎么配合使用

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
