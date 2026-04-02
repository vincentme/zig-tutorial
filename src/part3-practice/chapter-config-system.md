# 【draft】实战案例 - 配置系统实现

展示编译期计算和元编程：

```zig
const std = @import("std");

// 配置字段定义
const ConfigField = struct {
    name: []const u8,
    type: type,
    default: ?[]const u8 = null,
    description: []const u8,
};

// 编译期生成配置结构
fn Config(comptime fields: []const ConfigField) type {
    // 构建结构体字段
    comptime var struct_fields: [fields.len]std.builtin.Type.StructField = undefined;
    
    inline for (fields, 0..) |field, i| {
        struct_fields[i] = .{
            .name = field.name,
            .type = ?field.type,
            .default_value = null,
            .is_comptime = false,
            .alignment = @alignOf(?field.type),
        };
    }
    
    return struct {
        const Self = @This();
        
        // 动态存储字段值
        values: [fields.len]?u64,
        
        fn init() Self {
            var self: Self = undefined;
            @memset(&self.values, null);
            return self;
        }
        
        fn set(self: *Self, comptime field_name: []const u8, value: anytype) void {
            inline for (fields, 0..) |field, i| {
                if (std.mem.eql(u8, field.name, field_name)) {
                    if (@TypeOf(value) == field.type) {
                        self.values[i] = @bitCast(@as(u64, @intCast(switch (@typeInfo(field.type)) {
                            .Int => |info| if (info.signedness == .signed)
                                @as(i64, @intCast(value))
                            else
                                @as(u64, @intCast(value)),
                            .Float => @as(u64, @bitCast(@as(f64, @floatCast(value)))),
                            .Bool => @as(u64, if (value) 1 else 0),
                            else => @compileError("Unsupported type"),
                        })));
                    } else {
                        @compileError("Type mismatch for field " ++ field_name);
                    }
                }
            }
        }
        
        fn get(self: *const Self, comptime field_name: []const u8, comptime T: type) ?T {
            inline for (fields, 0..) |field, i| {
                if (std.mem.eql(u8, field.name, field_name)) {
                    if (T == field.type) {
                        if (self.values[i]) |val| {
                            return switch (@typeInfo(T)) {
                                .Int => |info| if (info.signedness == .signed)
                                    @as(T, @intCast(@as(i64, @bitCast(val))))
                                else
                                    @as(T, @intCast(@as(u64, @bitCast(val)))),
                                .Float => @as(T, @floatCast(@as(f64, @bitCast(val)))),
                                .Bool => val != 0,
                                else => @compileError("Unsupported type"),
                            };
                        }
                    } else {
                        @compileError("Type mismatch for field " ++ field_name);
                    }
                }
            }
            return null;
        }
        
        fn printConfig(self: *const Self) void {
            inline for (fields) |field| {
                std.debug.print("{s} ({s}): ", .{ field.name, field.description });
                switch (@typeInfo(field.type)) {
                    .Int => {
                        if (self.get(field.name, field.type)) |val| {
                            std.debug.print("{}\n", .{val});
                        } else {
                            std.debug.print("（未设置）\n", .{});
                        }
                    },
                    .Float => {
                        if (self.get(field.name, field.type)) |val| {
                            std.debug.print("{d}\n", .{val});
                        } else {
                            std.debug.print("（未设置）\n", .{});
                        }
                    },
                    .Bool => {
                        if (self.get(field.name, field.type)) |val| {
                            std.debug.print("{}\n", .{val});
                        } else {
                            std.debug.print("（未设置）\n", .{});
                        }
                    },
                    else => {},
                }
            }
        }
    };
}

pub fn main(init: std.process.Init.Minimal) void {
    // 定义配置字段
    const config_fields = [_]ConfigField{
        .{ .name = "port", .type = u16, .description = "服务器端口" },
        .{ .name = "max_connections", .type = u32, .description = "最大连接数" },
        .{ .name = "timeout", .type = f32, .description = "超时时间（秒）" },
        .{ .name = "debug_mode", .type = bool, .description = "调试模式" },
    };
    
    // 创建配置实例
    var config = Config(&config_fields).init();
    
    // 设置值
    config.set("port", @as(u16, 8080));
    config.set("max_connections", @as(u32, 1000));
    config.set("timeout", @as(f32, 30.5));
    config.set("debug_mode", true);
    
    // 打印配置
    config.printConfig();
    
    // 获取值
    if (config.get("port", u16)) |port| {
        std.debug.print("\n 服务器将在端口 {} 启动\n", .{port});
    }
}
```

---
