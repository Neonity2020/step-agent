# My Agent - Phase 4

> 扩展系统：插件机制 + 自定义工具/命令

## 项目结构

```
my-agent-phase4/
├── src/
│   ├── cli/
│   │   └── cli.ts           # 主入口 (更新以支持扩展)
│   ├── extensions/          # 扩展系统 (Phase 4 新增)
│   │   ├── base.ts          # 扩展接口定义
│   │   ├── loader.ts         # 扩展加载器
│   │   ├── index.ts          # 导出
│   │   └── plugins/          # 内置插件
│   │       ├── auto-save.ts # 自动保存
│   │       ├── git.ts        # Git 工具
│   │       ├── file-search.ts # 文件搜索
│   │       └── stats.ts      # 统计命令
│   ├── tui/tui.ts          # TUI 更新 (支持扩展命令)
│   ├── session/              # (复用 Phase 3)
│   ├── agent/agent.ts       # Agent 更新 (集成扩展)
│   ├── providers/            # (复用 Phase 1)
│   ├── tools/              # (复用 Phase 1)
│   └── types/              # (复用 Phase 1)
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd my-agent-phase4
bun install
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. 运行

```bash
bun run ./src/cli/cli.ts
```

## Phase 4 交付物

- [x] 扩展接口定义
- [x] 扩展加载器
- [x] 扩展 API (registerTool, registerCommand, on/off, etc.)
- [x] 事件钩子系统
- [x] 内置扩展
- [x] Agent 集成扩展

## 扩展系统架构

```
ExtensionManager
├── Extensions[]
│   ├── auto-save    (自动保存)
│   ├── git          (Git 工具)
│   ├── file-search  (搜索工具)
│   └── stats        (统计命令)
├── Tools[]
│   ├── Built-in: read, write, edit, bash
│   └── Extension: git_*, find_files, grep, tree
├── Commands[]
│   ├── Built-in: /help, /sessions, /new, etc.
│   └── Extension: /stats, /tools, /extensions, etc.
└── EventHandlers[]
    ├── before_chat / after_chat
    ├── before_tool / after_tool
    ├── user_message / assistant_message
    └── error
```

## 扩展 API

```typescript
interface ExtensionAPI {
  // 注册
  registerTool(tool: Tool): void
  registerCommand(command: Command): void
  registerProvider(provider: Provider): void

  // 事件
  on(event: string, handler: EventHandler): void
  off(event: string, handler: EventHandler): void
  emit(event: string, data: EventData): void

  // 配置
  getConfig(): AgentConfig
  setConfig(config: Partial<AgentConfig>): void
  getSettings(): Record<string, unknown>
  setSetting(key: string, value: unknown): void

  // 日志
  log(message: string, level?: "info" | "warn" | "error"): void
}
```

## 事件钩子

| 事件 | 触发时机 |
|------|----------|
| `before_chat` | 调用 LLM 之前 |
| `after_chat` | 调用 LLM 之后 |
| `before_tool` | 执行工具之前 |
| `after_tool` | 执行工具之后 |
| `user_message` | 用户发送消息时 |
| `assistant_message` | Assistant 响应时 |
| `error` | 发生错误时 |

## 内置扩展

### Git Tools
- `git_status` - 查看仓库状态
- `git_log` - 查看提交历史
- `git_commit` - 提交更改
- `git_branch` - 分支管理
- `git_diff` - 查看更改

### File Search
- `find_files` - 递归搜索文件
- `grep` - 文件内容搜索
- `tree` - 目录树显示

### Stats
- `/stats` - 会话统计
- `/tools` - 工具列表
- `/commands` - 命令列表
- `/extensions` - 扩展列表

## 命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/extensions` | 显示已加载的扩展 |
| `/tools` | 列出所有工具 |
| `/stats` | 会话统计 |

## 下一阶段

[Phase 5: 高级功能](../AGENT_ROADMAP.md#phase-5-高级功能)

## 创建自己的扩展

```typescript
// my-extension.ts
import type { Extension, ExtensionAPI } from "./extensions/base"

export default {
  meta: {
    name: "my-extension",
    version: "1.0.0",
    description: "My custom extension",
  },

  register(api: ExtensionAPI) {
    // 注册工具
    api.registerTool({
      name: "my_tool",
      description: "Does something cool",
      inputSchema: { type: "object" },
      async execute(input, ctx) {
        return { content: "Done!", success: true }
      },
    })

    // 注册命令
    api.registerCommand({
      name: "mycmd",
      description: "My custom command",
      execute: (args, api) => {
        console.log("Hello from my extension!")
      },
    })

    // 监听事件
    api.on("after_tool", (data) => {
      console.log(`Tool ${data.toolName} completed`)
    })

    api.log("My extension loaded!")
  },
} satisfies Extension
```
