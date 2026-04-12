# 开发环境与第一个程序

本章的目标很简单：**把 Zig 装好、确认工具可用、写出并运行第一个程序**。  
先获得“能跑起来”的正反馈，再逐步理解语法和标准库，会比一开始就陷入版本细节更轻松。

> 💡 **版本说明**  
> 本教程面向 **Zig 0.16.0-dev**。由于开发版仍在持续演进，标准库和部分 API 可能发生变化。  
> 如果你使用的是稳定版或其他开发版，示例代码可能需要做少量调整。

---

## 本章你会学到什么

读完本章后，你应该可以：

- 安装并验证 Zig 编译器
- 为编辑器配置基本的 Zig 开发支持
- 运行一个最小的 `Hello, World!` 程序
- 理解 `zig run`、`zig test`、`zig fmt` 这几个最常用命令
- 对 Zig 0.16 中常见的 `main` 写法有一个清晰的初步认识

---

## 安装 Zig

### 官方下载（推荐）

最稳妥的方式是从官方页面下载与你的平台匹配的预编译版本：

- 访问 <https://ziglang.org/download/>
- 下载对应平台的压缩包
- 解压到合适的位置
- 将 Zig 可执行文件所在目录加入 `PATH`

这样做的好处是：

- 更容易拿到教程对应的开发版
- 不依赖系统包管理器的更新速度
- 避免“教程是新版本，系统装的是旧版本”的落差

### 包管理器安装

如果你更习惯使用包管理器，也可以这样安装。

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

> ⚠️ 包管理器提供的版本通常偏稳定，不一定和本教程使用的 `0.16.0-dev` 完全一致。  
> 如果后续示例出现差异，优先先确认版本。

---

## 验证安装

安装完成后，先确认 Zig 已经可用：

```bash
zig version
# 例如：0.16.0-dev.xxx+xxxxxxxx
```

如果终端能正确输出版本号，说明安装成功。

你还可以顺手确认几个最常用的命令是否存在：

```bash
zig help
zig env
zig version
zig fmt --help
```

这里不需要现在就理解所有输出内容，只要知道 Zig 工具链已经正常工作即可。

---

## 编辑器配置

你完全可以先用任意文本编辑器开始写 Zig。  
但如果想获得补全、跳转、错误提示等体验，建议配置语言服务器。

## VS Code 配置示例

安装 Zig 扩展：

```bash
# 安装 Zig 扩展
code --install-extension ziglang.vscode-zig
```

一个简单的 `settings.json` 示例：

```json
{
  "zig.zls.path": "zls",
  "zig.formatting.provider": "zig",
  "zig.checkForUpdate": false
}
```

## 安装 ZLS

ZLS 是 Zig Language Server，用于提供编辑器智能提示。

推荐安装方式：

- 访问 <https://zigtools.org/zls/install/>
- 下载与你的 Zig 版本相匹配的 ZLS
- 将其加入 `PATH`

> ⚠️ **版本兼容很重要**  
> ZLS 和 Zig 版本不匹配时，常见现象是补全异常、诊断错误或编辑器提示不准确。  
> 如果你使用的是开发版 Zig，也应尽量使用对应版本的 ZLS。

如果你确实需要从源码构建：

```bash
git clone https://github.com/zigtools/zls
cd zls
zig build -Doptimize=ReleaseFast
```

---

## 第一个 Zig 程序

先不要急着讨论构建系统、包管理或复杂项目结构。  
这一节的重点只有一件事：**把一个最小程序跑起来**。

在任意目录中新建文件 `hello.zig`：

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

你应该会看到输出：

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

到这里就够了。  
像 `@import`、函数、返回值类型、格式化输出等概念，后面都会正式展开。

---

## 关于 `std.debug.print` 的一个小提醒

`std.debug.print` 很适合写入门示例，因为它简单直接。  
但你需要知道一件事：

- `std.debug.print` 默认输出到 **stderr**
- 它很适合调试和教学中的最小示例
- 如果你想更明确地控制输出流，后面可以再学习 `stdout` 相关 API

对初学者来说，这个区别现在知道即可，不必一开始就背下所有 I/O 细节。

---

## Zig 0.16 中常见的 `main` 写法

在 Zig 0.16 中，你会看到不止一种 `main` 写法。  
本教程后续示例会根据需要使用不同形式，但你现在只需要先认识它们。

### 1. 最小写法

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

### 2. 需要错误传播时

```zig
const std = @import("std");

pub fn main() !void {
    try std.fs.cwd().access("build.zig", .{});
}
```

适合：

- 入口函数里要使用 `try`
- 你希望把错误直接向外返回
- 示例中已经开始接触显式错误处理

### 3. 使用 `std.process.Init` 的 0.16 风格写法

```zig
const std = @import("std");

pub fn main(_: std.process.Init) void {
    std.debug.print("Hello from Zig 0.16!\n", .{});
}
```

适合：

- 你想和 0.16 的新式入口风格保持一致
- 后续需要访问初始化上下文中的字段
- 教程统一采用这一风格来减少版本混淆

### 应该怎么选？

对于本章和你自己的第一个程序：

- **想最快跑起来**：用 `pub fn main() void`
- **马上要用 `try`**：用 `pub fn main() !void`
- **想和本教程后续多数 0.16 示例保持一致**：用 `pub fn main(_: std.process.Init) void` 或 `pub fn main(init: std.process.Init) !void`

> 💡 一个重要原则  
> `main` 是否接收 `std.process.Init`，和是否返回 `!void`，是两个不同维度的问题：  
> - 是否接收 `init`，取决于你是否需要那份初始化上下文  
> - 是否返回 `!void`，取决于你是否需要传播错误

---

## 一个更贴近 0.16 的输出示例

当你后面开始接触 0.16 的 I/O 风格时，可能会看到类似下面的写法：

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

所以本章建议你先用最小版本跑通，后续再逐步理解这个版本。

---

## 现在最值得记住的几个命令

在学习早期，你最常用的不是一大堆复杂命令，而是下面这几个：

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

对于刚入门的你，先掌握这四个命令，已经足够覆盖大多数单文件练习场景。

---

## 一个推荐的最小工作流

如果你刚开始学 Zig，可以把每次练习都控制在下面这个流程里：

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

这个节奏非常适合入门，因为它能帮助你快速建立三种感觉：

- Zig 代码长什么样
- Zig 编译器如何报错
- Zig 工具链在日常开发中怎么配合使用

---

## 关于项目结构：先认识，不急着展开

如果你运行过：

```bash
mkdir hello-zig
cd hello-zig
zig init
```

你会看到类似这样的结构：

```text
hello-zig/
├── build.zig
├── build.zig.zon
└── src/
    ├── main.zig
    └── root.zig
```

现在你只需要知道：

- `src/main.zig` 常作为程序入口
- `build.zig` 是构建脚本
- `build.zig.zon` 是项目清单文件

这些内容会在[构建系统入门](chapter-build-system.md)里专门讲。  
本章不展开，是为了避免你在还没熟悉语言基础之前就被工程化细节打断。

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

本章最重要的收获不是“背下所有命令”，而是建立一个可靠的起点：

- Zig 已经安装成功
- 你知道如何验证版本
- 你知道如何配置基础编辑器支持
- 你已经运行了第一个程序
- 你认识了 Zig 0.16 中几种常见的 `main` 写法
- 你知道了最常用的几个命令：`zig run`、`zig test`、`zig fmt`、`zig build-exe`

接下来，进入下一章：[变量、常量与基础类型](chapter-basic-types.md)。  
从这里开始，你会正式接触 Zig 的基本语法和类型系统。