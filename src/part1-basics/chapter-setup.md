# 开发环境搭建

## 安装 Zig

**macOS**
```bash
# 使用包管理器安装
# macOS
brew install zig
```

**Linux**
```bash
# Linux Arch
sudo pacman -S zig

# Ubuntu
sudo snap install zig --classic --beta
```

**Windows:**
```powershell
# 使用 scoop
scoop install zig

# 或使用 chocolatey
choco install zig
```

**验证安装：**
```bash
zig version
# 输出：0.16.0 或更高版本
```

## 编辑器配置

**VS Code:**
```bash
# 安装 Zig 扩展
code --install-extension ziglang.vscode-zig
```

**配置 settings.json:**
```json
{
  "zig.zls.path": "zls",
  "zig.formatting.provider": "zig",
  "zig.checkForUpdate": false
}
```

**安装 ZLS (Zig Language Server):**
```bash
# 从源码编译
git clone https://github.com/zigtools/zls
cd zls
zig build -Doptimize=ReleaseFast
```

## 第一个 Zig 程序

创建项目结构：
```bash
mkdir hello-zig
cd hello-zig
zig init
```

项目结构：
```
hello-zig/
├── build.zig           # 构建脚本
├── build.zig.zon       # 项目清单文件
└── src/
    ├── main.zig        # 主程序入口
    └── root.zig        # 库根文件
```

**Hello World 程序（0.16.0-dev 版本）：**

> ⚠️ **重要警告：I/O 系统稳定性**
> 
> Zig 0.16 的 I/O 系统正在快速演变中，以下 API 可能发生变化：
> 
> **可能变化的 API**：
> - `std.Io.File.writeStreamingAll` - 参数和返回值可能调整
> - `std.process.Init` - 结构可能扩展
> - `std.Io.Reader` / `std.Io.Writer` - 接口可能调整
> - `std.Io.net` - 网络 API 可能重构
> 
> **建议**：
> 1. **生产环境**：使用稳定版本（如 0.15.x）
> 2. **学习环境**：可以使用开发版本，但注意 API 可能变化
> 3. **定期查看**：官方更新日志 https://ziglang.org/download/
> 4. **关注公告**：Zig 官方公告和社区讨论
> 
> 本教程的示例代码基于当前开发版本，可能需要调整。

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

pub fn main(init: std.process.Init) !void {
    try std.Io.File.stdout().writeStreamingAll(init.io, "Hello, World!\n");
}
```

**代码解析：**
- `const std = @import("std")`：导入标准库
- `pub fn main(init: std.process.Init) !void`：主函数，接收初始化参数
  - `!void` 表示函数可能返回错误（**详见[错误处理机制](chapter-error-handling.md)**）
  - 这是 Zig 的错误联合类型（Error Union Type）语法
- `try`：错误传播操作符，如果操作失败则立即返回错误
- `init.io`：I/O系统接口，用于所有输入输出操作
- `std.Io.File.stdout()`：获取标准输出文件
- `writeStreamingAll`：写入字符串到输出流

**简化版本（Minimal）：**

如果不需要完整的I/O功能，可以使用简化签名：

```zig
const std = @import("std");

pub fn main(_: std.process.Init.Minimal) !void {
    // 使用 std.debug.print 进行简单输出
    std.debug.print("Hello, World!\n", .{});
}
```

**运行程序：**
```bash
# 直接运行
zig run src/main.zig

# 或构建后运行
zig build-exe src/main.zig
./main
```
