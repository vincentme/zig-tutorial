/**
 * Zig Language Definition for Highlight.js
 * Based on Zig 0.16.0-dev
 */
hljs.registerLanguage("zig", function() {
    "use strict";
    
    // Zig keywords
    const KEYWORDS = {
        keyword: "const var extern packed export pub noalias inline noinline " +
                 "comptime volatile allowzero align linksection threadlocal " +
                 "fn usingnamespace struct enum union error set suspend resume " +
                 "await async defer errdefer try catch orelse and or not " +
                 "if else switch while for break continue return asm " +
                 "defer errdefer test",
        built_in: "true false null undefined " +
                  "i8 i16 i32 i64 i128 isize " +
                  "u8 u16 u32 u64 u128 usize " +
                  "f16 f32 f64 f80 f128 " +
                  "c_char c_short c_ushort c_int c_uint c_long c_ulong c_longlong c_ulonglong c_longdouble " +
                  "anyopaque anyframe anytype type void noreturn bool " +
                  "comptime_int comptime_float " +
                  "@addWithOverflow @as @atomicLoad @atomicStore @bitCast @bitOffsetOf @boolToInt @bitSizeOf " +
                  "@breakpoint @mulAdd @byteSwap @bitReverse @offsetOf @call @cDefine @cImport @cInclude " +
                  "@cUndef @canImplicitCast @clz @cmpxchgStrong @cmpxchgWeak @compileError @compileLog " +
                  "@ctz @popCount @divExact @divFloor @divTrunc @embedFile @enumToInt @errorName @errorReturnTrace " +
                  "@errorToInt @errSetCast @export @extern @fence @field @fieldParentPtr @floatCast @floatToInt " +
                  "@frame @Frame @frameAddress @frameSize @hasDecl @hasField @import @intCast @intToEnum " +
                  "@intToError @intToFloat @intToPtr @memcpy @memset @mod @mulWithOverflow @panic @ptrCast " +
                  "@ptrToInt @rem @returnAddress @setAlignStack @setCold @setRuntimeSafety @setEvalBranchQuota " +
                  "@shlExact @shlWithOverflow @shrExact @shuffle @sizeOf @splat @sqrt @sin @cos @exp @exp2 " +
                  "@log @log2 @log10 @fabs @floor @ceil @trunc @round @tagName @This @truncate @Type @typeInfo " +
                  "@typeName @TypeOf @unionInit",
        literal: "true false null undefined"
    };
    
    // Number patterns
    const NUMBERS = {
        className: "number",
        variants: [
            { begin: "\\b[0-9]+\\.[0-9]+([eE][+-]?[0-9]+)?([fF](16|32|64|80|128))?" },
            { begin: "\\b[0-9]+([eE][+-]?[0-9]+)?([fF](16|32|64|80|128))" },
            { begin: "\\b0x[0-9a-fA-F]+([pP][+-]?[0-9]+)?([fF](16|32|64|80|128))?" },
            { begin: "\\b0o[0-7]+" },
            { begin: "\\b0b[01]+" },
            { begin: "\\b[0-9]+" }
        ],
        relevance: 0
    };
    
    // String patterns
    const STRINGS = {
        className: "string",
        variants: [
            {
                begin: '"',
                end: '"',
                illegal: '\\n',
                contains: [
                    {
                        className: "escape",
                        begin: "\\\\([nrt\"'\\\\]|x[0-9a-fA-F]{2}|u\\{[0-9a-fA-F]+\\})"
                    }
                ]
            },
            {
                begin: "'",
                end: "'",
                illegal: '\\n',
                contains: [
                    {
                        className: "escape",
                        begin: "\\\\([nrt\"'\\\\]|x[0-9a-fA-F]{2}|u\\{[0-9a-fA-F]+\\})"
                    }
                ]
            },
            {
                begin: 'c"',
                end: '"',
                illegal: '\\n'
            },
            {
                begin: "\\\\",
                end: "$",
                contains: [
                    {
                        begin: "[^\\n]"
                    }
                ]
            }
        ]
    };
    
    // Comments
    const COMMENTS = {
        className: "comment",
        variants: [
            {
                begin: "//",
                end: "$",
                contains: [
                    {
                        begin: "\\b(TODO|FIXME|NOTE|XXX):",
                        end: "\\b",
                        className: "doctag"
                    }
                ]
            },
            {
                begin: "///",
                end: "$",
                className: "doctag",
                contains: [
                    {
                        begin: "[^\\n]"
                    }
                ]
            }
        ]
    };
    
    // Built-in types
    const BUILT_IN_TYPES = {
        className: "type",
        begin: "\\b(i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|" +
                "f16|f32|f64|f80|f128|bool|void|noreturn|type|anyerror|" +
                "anyopaque|anyframe|anytype|comptime_int|comptime_float)\\b"
    };
    
    // Function definition
    const FUNCTION = {
        className: "function",
        beginKeywords: "fn",
        end: "(?={)",
        excludeEnd: true,
        contains: [
            {
                className: "title",
                begin: "[a-zA-Z_][a-zA-Z0-9_]*"
            },
            {
                className: "params",
                begin: "\\(",
                end: "\\)",
                contains: [
                    NUMBERS,
                    STRINGS,
                    BUILT_IN_TYPES
                ]
            }
        ]
    };
    
    // Test definition
    const TEST = {
        className: "function",
        begin: "\\btest\\s+\"",
        end: "\"",
        excludeBegin: true,
        excludeEnd: true,
        contains: [
            {
                begin: "[^\"]+"
            }
        ]
    };
    
    // Operators
    const OPERATORS = {
        className: "operator",
        begin: "(\\+\\+|\\+%=|\\+|\\-\\-|\\-%=|\\-|\\*%=|\\*|\\*\\*|\\*\\*%=|/|/%=|%=|%|" +
                "<<%=|<<|<<|>>%=|>>|>>|&|&=|\\||\\|=|\\^|\\^=|==|!=|<|>|<=|>=|!|\\?|\\?\\?|" +
                "\\|\\||&&|\\.\\?\\.|\\.\\*|\\.[a-zA-Z_][a-zA-Z0-9_]*|->)",
        relevance: 0
    };
    
    return {
        name: "Zig",
        aliases: ["zig"],
        keywords: KEYWORDS,
        contains: [
            COMMENTS,
            STRINGS,
            NUMBERS,
            BUILT_IN_TYPES,
            FUNCTION,
            TEST,
            OPERATORS,
            {
                className: "symbol",
                begin: "@[a-zA-Z_][a-zA-Z0-9_]*"
            },
            {
                className: "variable",
                begin: "[a-zA-Z_][a-zA-Z0-9_]*\\s*:"
            }
        ],
        illegal: "</"
    };
});
