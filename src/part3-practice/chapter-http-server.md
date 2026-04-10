# 【draft】实战案例 - HTTP服务器开发

> ⚠️ **网络 API 稳定性警告**：本章使用的网络 API 正在快速演变。
> 
> - **模块迁移**：`std.net` → `std.Io.net` 迁移仍在进行中
> - **API 变化**：网络相关函数签名可能继续调整
> - **兼容性**：示例代码基于 0.16.0-dev，可能需要适配
> - **建议**：关注官方 issue #25770 和社区讨论获取最新信息

# 20.0.1 HTTP协议基础

# 什么是HTTP服务器？

HTTP服务器本质上是一个持续运行的程序，等待客户端连接并交换HTTP消息。可以将HTTP服务器想象成酒店的接待员：

**酒店接待员比喻**：
- 接待员在酒店前台等待客人到达
- 当客人到达时，接待员开始对话，询问住宿需求
- 接待员查找可用房间，处理入住手续，交付钥匙
- 完成后，接待员回到等待状态，等待下一位客人

HTTP服务器的工作流程与此类似：
1. **等待连接**：服务器在指定端口监听，等待客户端连接
2. **接受连接**：客户端发起连接，服务器接受
3. **处理请求**：服务器读取并解析HTTP请求
4. **发送响应**：服务器执行请求操作，返回HTTP响应
5. **关闭连接**：完成通信后关闭连接

# HTTP请求格式

HTTP请求由三部分组成：

```
请求行
请求头
请求体（可选）
```

**示例**：
```http
GET /index.html HTTP/1.1
Host: www.example.com
User-Agent: Mozilla/5.0
Accept: text/html

```

**请求行解析**：
- `GET`：请求方法（GET、POST、PUT、DELETE等）
- `/index.html`：请求路径
- `HTTP/1.1`：HTTP协议版本

# HTTP响应格式

HTTP响应也由三部分组成：

```
状态行
响应头
响应体
```

**示例**：
```http
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 1234

<html>
  <body>
    <h1>Hello, World!</h1>
  </body>
</html>
```

**状态行解析**：
- `HTTP/1.1`：HTTP协议版本
- `200`：状态码
- `OK`：状态描述

# 常见状态码

| 状态码 | 含义                  | 说明             |
| ------ | --------------------- | ---------------- |
| 200    | OK                    | 请求成功         |
| 404    | Not Found             | 请求的资源不存在 |
| 500    | Internal Server Error | 服务器内部错误   |
| 400    | Bad Request           | 请求格式错误     |
| 403    | Forbidden             | 禁止访问         |

# 20.0.2 Socket编程基础

# 什么是Socket？

Socket是网络通信的端点，可以理解为网络上的"插座"。就像电器通过插座连接电源一样，网络程序通过Socket连接网络。

**Socket的工作流程**：

```
服务器端：
1. 创建Socket → socket()
2. 绑定地址 → bind()
3. 开始监听 → listen()
4. 接受连接 → accept()
5. 读写数据 → read()/write()
6. 关闭连接 → close()

客户端：
1. 创建Socket → socket()
2. 连接服务器 → connect()
3. 读写数据 → read()/write()
4. 关闭连接 → close()
```

# Zig中的Socket API

在Zig 0.16.0-dev中，Socket相关的API位于`std.Io.net`模块：

**关键类型**：
- `std.Io.net.Ip4Address`：IPv4地址
- `std.Io.net.Ip6Address`：IPv6地址
- `std.Io.net.IpAddress`：IP地址联合类型
- `std.Io.net.Server`：TCP服务器
- `std.Io.net.Stream`：网络流

**关键函数**：
- `address.listen()`：开始监听
- `server.accept()`：接受连接
- `stream.read()`：读取数据
- `stream.write()`：写入数据

**注意**：在0.16.0-dev版本中，所有I/O操作需要传递`io`参数。

## 项目需求分析与设计思路

# 项目目标

构建一个简单的HTTP服务器，能够：
1. 监听指定端口，接受客户端连接
2. 解析HTTP请求（方法和路径）
3. 根据路径返回不同的响应
4. 支持HTML和JSON两种响应格式

# 技术选型

本项目使用Zig标准库的网络模块：
- `std.Io.net.Ip4Address`: IPv4网络地址处理（0.16.0-dev新API）
- `std.Io.net.IpAddress`: IP地址联合类型（支持IPv4和IPv6）
- `std.Io.net.listen`: TCP服务器监听函数
- `std.mem`: 字符串处理
- `std.fmt`: 格式化输出

**注意**: 在0.16.0-dev版本中，网络模块已从 `std.net` 迁移到 `std.Io.net`，且所有I/O操作需要通过 `init.io` 进行。

# 设计思路

**架构设计**：
```
Server (结构体)
├── init() - 初始化服务器
├── start() - 启动监听循环
├── handleConnection() - 处理单个连接
└── generateResponse() - 生成HTTP响应
```

**关键设计决策**：

1. **使用结构体封装**: 将服务器状态和行为封装在一起
2. **显式分配器传递**: 内存分配由调用者控制
3. **简单的请求解析**: 仅解析方法和路径，不处理请求体
4. **同步处理模型**: 一次处理一个连接（生产环境应使用异步）

# 实现步骤

1. **定义Server结构体**: 包含地址和分配器
2. **实现init方法**: 创建监听地址
3. **实现start方法**: 接受连接循环
4. **实现handleConnection**: 读取请求，发送响应
5. **实现generateResponse**: 根据路径生成响应

# 预期效果

运行服务器后：
- 访问 `http://localhost:8080/` 返回欢迎页面
- 访问 `http://localhost:8080/api` 返回JSON数据
- 其他路径返回404错误

# 扩展方向

完成基础版本后，可以考虑：
1. **多线程处理**: 使用线程池处理并发连接
2. **异步I/O**: 使用Zig的异步特性
3. **路由系统**: 实现更灵活的路由匹配
4. **中间件**: 添加日志、认证等中间件
5. **静态文件服务**: 支持文件系统访问

## 完整实现（0.16.0-dev 版本）

让我们综合运用所学知识，构建一个简单的 HTTP 服务器。注意使用新的 `std.Io` API：

```zig
// ✨ 新特性：std.Io 统一接口
const std = @import("std");

const Server = struct {
    address: std.Io.net.Ip4Address,  // 服务器监听地址
    allocator: std.mem.Allocator,     // 内存分配器（显式传递）
    io: std.Io,                       // I/O接口（0.16.0新增）

    const Self = @This();

    // 初始化服务器
    // 参数：
    //   - allocator: 内存分配器
    //   - io: I/O接口（用于所有I/O操作）
    //   - port: 监听端口号
    // 返回：初始化后的Server实例
    fn init(allocator: std.mem.Allocator, io: std.Io, port: u16) !Self {
        // 创建IPv4地址（0.0.0.0表示监听所有网络接口）
        const address = std.Io.net.Ip4Address{
            .bytes = [4]u8{ 0, 0, 0, 0 },
            .port = port,
        };
        return .{
            .address = address,
            .allocator = allocator,
            .io = io,
        };
    }

    // 启动服务器主循环
    fn start(self: *Self) !void {
        // 开始监听，启用端口重用
        var server = try self.address.listen(.{
            .reuse_port = true,
        });
        defer server.deinit();

        std.debug.print("服务器启动在端口 {}\n", .{self.address.getPort()});

        // 无限循环，持续接受连接
        while (true) {
            // 阻塞等待客户端连接
            const connection = try server.accept();
            // 处理连接（同步模式，一次处理一个连接）
            try self.handleConnection(connection);
        }
    }

    // 处理单个客户端连接
    fn handleConnection(self: *Self, connection: std.Io.net.Server.Connection) !void {
        // 确保连接在函数退出时关闭
        defer connection.stream.close();

        // 读取客户端请求
        var buffer: [4096]u8 = undefined;
        const bytes_read = try connection.stream.read(self.io, &buffer);

        // 如果没有数据，直接返回
        if (bytes_read == 0) return;

        const request = buffer[0..bytes_read];

        // 解析HTTP请求行
        // 格式：METHOD PATH HTTP/1.1
        const method_end = std.mem.indexOf(u8, request, " ") orelse return;
        const method = request[0..method_end];

        const path_start = method_end + 1;
        const path_end = std.mem.indexOf(u8, request[path_start..], " ") orelse return;
        const path = request[path_start .. path_start + path_end];

        // 生成HTTP响应
        const response = try self.generateResponse(path);
        defer self.allocator.free(response);

        // 发送响应给客户端
        _ = try connection.stream.write(self.io, response);
    }

    // 根据路径生成HTTP响应
    fn generateResponse(self: *Self, path: []const u8) ![]u8 {
        // 根据路径确定响应内容和状态码
        const content = if (std.mem.eql(u8, path, "/"))
            "<h1>Welcome to Zig HTTP Server!</h1>"
        else if (std.mem.eql(u8, path, "/api"))
            "{\"message\": \"Hello from Zig API\"}"
        else
            "<h1>404 Not Found</h1>";

        const status = if (std.mem.eql(u8, path, "/") or std.mem.eql(u8, path, "/api"))
            "200 OK"
        else
            "404 Not Found";

        const content_type = if (std.mem.eql(u8, path, "/api"))
            "application/json"
        else
            "text/html";

        // 构建完整的HTTP响应
        // 格式：HTTP/1.1 STATUS\r\nHeaders\r\n\r\nBody
        return std.fmt.allocPrint(
            self.allocator,
            "HTTP/1.1 {s}\r\n" ++
                "Content-Type: {s}\r\n" ++
                "Content-Length: {}\r\n" ++
                "Connection: close\r\n" ++
                "\r\n" ++
                "{s}",
            .{ status, content_type, content.len, content },
        );
    }
};

pub fn main(init: std.process.Init) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var server = try Server.init(allocator, init.io, 8080);
    try server.start();
}
```

# 运行和测试

**启动服务器**：
```bash
# 方式1：直接运行
zig run src/main.zig

# 方式2：构建后运行
zig build run
```

**测试服务器**：
```bash
# 使用curl测试
curl http://localhost:8080/
curl http://localhost:8080/api
curl http://localhost:8080/notfound

# 使用浏览器测试
# 在浏览器中打开 http://localhost:8080/
```

**预期输出**：
```
服务器启动在端口 8080
```

**测试结果**：
```
# 访问 http://localhost:8080/
<h1>Welcome to Zig HTTP Server!</h1>

# 访问 http://localhost:8080/api
{"message": "Hello from Zig API"}

# 访问 http://localhost:8080/notfound
<h1>404 Not Found</h1>
```

# 关键变更说明

1. **主函数签名**: 从 `pub fn main() !void` 变更为 `pub fn main(init: std.process.Init) !void`
2. **网络模块**: `std.net` → `std.Io.net`
3. **I/O 传递**: 所有I/O操作需要通过 `init.io` 传递
4. **Server 结构体**: 新增 `io` 字段存储 I/O 接口

# 旧版本兼容代码（0.15.x）

```zig
// 🚫 已废弃：0.16.0，请使用 std.Io.net
const std = @import("std");

const Server = struct {
    address: std.net.Address,  // 旧版本使用 std.net
    allocator: std.mem.Allocator,

    fn init(allocator: std.mem.Allocator, port: u16) !Self {
        const address = try std.net.Address.initIp4([4]u8{ 0, 0, 0, 0 }, port);
        // ...
    }

    fn handleConnection(self: *Self, connection: std.net.Server.Connection) !void {
        // 旧版本不需要 io 参数
        const bytes_read = try connection.stream.read(&buffer);
        _ = try connection.stream.write(response);
    }
};

pub fn main(_: std.process.Init.Minimal) !void {  // 旧版本主函数签名
    // ...
}
```

## 实践指导与调试技巧

# 常见问题排查

**问题1：端口被占用**
```
error: Address already in use
```
**解决方案**：
- 检查端口是否被其他程序占用：`lsof -i :8080`
- 更换端口号
- 使用 `reuse_port = true` 选项

**问题2：连接超时**
```
error: Connection timed out
```
**解决方案**：
- 检查防火墙设置
- 确认服务器正在运行
- 验证IP地址和端口是否正确

**问题3：请求解析错误**
```
error: Invalid request format
```
**解决方案**：
- 打印原始请求数据进行调试
- 检查HTTP请求格式是否正确
- 使用Wireshark抓包分析

# 性能优化建议

1. **使用线程池处理并发连接**：
```zig
// 创建线程池
const num_threads = 4;
var threads: [num_threads]std.Thread = undefined;

// 每个线程处理一个连接
for (0..num_threads) |i| {
    threads[i] = try std.Thread.spawn(.{}, handleConnection, .{connection});
}
```

2. **使用Arena Allocator减少内存碎片**：
```zig
var arena = std.heap.ArenaAllocator.init(allocator);
defer arena.deinit();
const arena_allocator = arena.allocator();
```

3. **添加请求日志**：
```zig
std.debug.print("[{s}] {s} {s}\n", .{ 
    @tagName(method), 
    path, 
    status 
});
```

# 扩展练习

1. **练习1：添加POST请求支持**
   - 解析请求体
   - 实现表单数据处理

2. **练习2：实现静态文件服务**
   - 读取文件系统
   - 根据文件扩展名设置Content-Type

3. **练习3：添加并发处理**
   - 使用线程池
   - 实现连接队列

4. **练习4：实现路由系统**
   - 支持路径参数
   - 支持中间件

---

> 💡 **章节过渡**：从 HTTP 服务器到内存池实现
> 
> 在[实战案例3 - 内存池实现](chapter-memory-pool.md)中，我们学习了 HTTP 服务器开发，了解了网络编程的基本概念。
> 现在，我们将实现一个内存池，深入理解内存管理和泛型编程。
> 
> **为什么 HTTP 服务器需要内存池？**
> 
> 1. **性能优化**：减少频繁的内存分配和释放
> 2. **内存碎片**：内存池可以减少内存碎片
> 3. **并发安全**：内存池可以实现线程安全的内存管理
> 
> **学习建议**：
> - 回顾[内存管理模型](../part2-advanced/chapter-memory-management.md)的内存管理知识
> - 理解[泛型编程](../part2-advanced/chapter-generics.md)的泛型编程概念
> - 准备实现高性能的内存管理组件
