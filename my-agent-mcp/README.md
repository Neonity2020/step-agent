# My Agent - MCP Support

> Model Context Protocol (MCP) 支持：连接外部工具和数据源

## 项目结构

```
my-agent-mcp/
├── src/
│   ├── cli/
│   │   ├── cli.ts              # 标准模式
│   │   ├── mcp-cli.ts          # MCP 模式 (新增)
│   │   └── streaming-cli.ts    # 流式模式
│   ├── mcp/                    # MCP 模块 (新增)
│   │   ├── types.ts           # MCP 类型定义
│   │   ├── client.ts          # MCP 客户端
│   │   ├── server.ts          # 服务器配置
│   │   └── index.ts          # 导出
│   └── ...
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd my-agent-mcp
bun install
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. 运行

```bash
# MCP 模式（连接 MCP 服务器）
bun run ./src/cli/mcp-cli.ts

# 标准模式
bun run ./src/cli/cli.ts

# 流式模式
bun run ./src/cli/streaming-cli.ts
```

## MCP 支持

### 什么是 MCP？

Model Context Protocol (MCP) 是一个开放协议，允许 AI 模型连接到外部数据源和工具。

### 支持的 MCP 服务器

```typescript
// 内置支持的服务器
const COMMON_MCP_SERVERS = [
  { name: "filesystem", command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] },
  { name: "git", command: "npx", args: ["-y", "@modelcontextprotocol/server-git"] },
  { name: "github", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
  { name: "slack", command: "npx", args: ["-y", "@modelcontextprotocol/server-slack"] },
  { name: "brave-search", command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"] },
  { name: "sqlite", command: "npx", args: ["-y", "@modelcontextprotocol/server-sqlite", "./data.db"] },
  { name: "sequential-thinking", command: "npx", args: ["-y", "@modelcontextprotocol/server-sequential-thinking"] },
  { name: "memory", command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"] },
]
```

### 配置文件

创建 `~/.myagent/mcp-config.json`:

```json
{
  "servers": [
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
      "enabled": true
    },
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token-here"
      },
      "enabled": true
    }
  ]
}
```

## MCP 命令

| 命令 | 说明 |
|------|------|
| `/mcp` | 显示 MCP 服务器状态 |
| `/servers` | 同上，列出所有连接的服务器 |
| `/theme <name>` | 切换主题 |

## MCP 客户端 API

```typescript
import { MCPClientManager, MCPServerConfig } from "./mcp"

// 创建管理器
const manager = new MCPClientManager()

// 添加服务器
const client = await manager.addClient("my-server", {
  name: "my-agent",
  version: "1.0.0",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
})

// 获取工具
const tools = client.toAgentTools()

// 调用工具
const result = await client.callTool("read_file", { path: "./README.md" })

// 查看状态
console.log(client.getStats())
// { toolsCount: 5, resourcesCount: 10, connected: true }

// 断开连接
client.disconnect()
```

## MCP 工具命名

MCP 工具会自动前缀：

```
mcp_<server_name>_<tool_name>

例如：
- mcp_filesystem_read_file
- mcp_github_create_issue
- mcp_memory_save
```

## 启动界面

```
┌────────────────────────────────────────────────────────────┐
│  My Agent - MCP Support                                    │
├────────────────────────────────────────────────────────────┤
│  ✨ Model Context Protocol support                         │
│  🔌 Connect to MCP servers for tools                       │
│  📦 15 MCP tools available                                 │
├────────────────────────────────────────────────────────────┤
│  Type /help for commands                                   │
└────────────────────────────────────────────────────────────┘

🔌 Initializing MCP servers...
  ✓ filesystem (5 tools, 0 resources)
  ✓ github (12 tools, 3 resources)

📦 Total MCP tools: 17
```

## MCP 协议

### JSON-RPC 消息

```typescript
// 请求
{
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list",
  params: {}
}

// 响应
{
  jsonrpc: "2.0",
  id: 1,
  result: {
    tools: [
      { name: "read_file", description: "...", inputSchema: {...} }
    ]
  }
}
```

### 工具调用

```typescript
// 请求
{
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "read_file",
    arguments: { path: "./README.md" }
  }
}

// 响应
{
  jsonrpc: "2.0",
  id: 2,
  result: {
    content: [
      { type: "text", text: "# My Agent..." }
    ]
  }
}
```

## 下一步

- 添加更多 MCP 服务器支持
- 实现 MCP 服务器功能（让 Agent 作为 MCP 服务器）
- MCP 资源订阅
- MCP 提示词模板
