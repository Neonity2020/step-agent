# 构建你自己的 Coding Agent

> 基于 pi-agent 架构的学习与实现

## 📐 整体架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Agent                           │
├─────────────────────────────────────────────────────────────┤
│  CLI Entry (Bun)                                            │
├─────────────────────────────────────────────────────────────┤
│  TUI Layer (交互式终端界面)                                  │
├─────────────────────────────────────────────────────────────┤
│  Agent Core                                                 │
│  ├── Session Manager (会话树管理)                           │
│  ├── Context Manager (上下文/记忆)                          │
│  ├── Tool Executor (工具执行)                               │
│  └── Message Queue (消息队列)                               │
├─────────────────────────────────────────────────────────────┤
│  Provider Layer (多模型提供商)                               │
│  ├── Anthropic │ OpenAI │ DeepSeek │ Gemini │ ...          │
├─────────────────────────────────────────────────────────────┤
│  Extension System (扩展系统)                                │
│  ├── Tools │ Commands │ Hooks │ UI │ Themes                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗺️ 分阶段构建路线图

### Phase 1: 核心骨架 (MVP)

**目标**：运行最基本的多轮对话 Agent

| 顺序 | 任务 | 关键实现 |
|------|------|----------|
| 1.1 | CLI 入口 | 使用 Bun CLI + 命令行参数解析 |
| 1.2 | 基础 Provider | 抽象 Provider 接口 + Anthropic 实现 |
| 1.3 | 工具系统 | Tool 接口 + `read`/`bash`/`write`/`edit` 四个内置工具 |
| 1.4 | 消息循环 | User ↔ Agent ↔ Tools 循环 |
| 1.5 | 简单会话 | 内存中保存对话历史 |

#### 1.1 项目结构建议

```
my-agent/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── index.ts            # 主程序
│   ├── providers/
│   │   ├── base.ts         # Provider 接口
│   │   ├── anthropic.ts    # Anthropic 实现
│   │   └── openai.ts       # OpenAI 实现
│   ├── tools/
│   │   ├── base.ts         # Tool 接口
│   │   ├── read.ts
│   │   ├── write.ts
│   │   ├── edit.ts
│   │   └── bash.ts
│   ├── agent/
│   │   ├── agent.ts        # Agent 核心逻辑
│   │   ├── context.ts      # 上下文管理
│   │   └── executor.ts     # 工具执行器
│   └── types.ts            # 共享类型
├── package.json
└── tsconfig.json
```

#### 1.2 Provider 接口定义

```typescript
// src/providers/base.ts

export interface ToolCall {
  name: string
  input: Record<string, unknown>
}

export interface LLMResponse {
  content: string
  toolCalls?: ToolCall[]
  thinking?: string
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool"
  content: string
  name?: string
  toolCallId?: string
  toolName?: string
}

export interface Tool {
  name: string
  description: string
  inputSchema: object  // JSON Schema for validation
}

export interface Provider {
  name: string
  models: string[]

  chat(messages: Message[], tools?: Tool[]): Promise<LLMResponse>
  stream?(messages: Message[], tools?: Tool[]): AsyncIterable<LLMResponse>
}
```

#### 1.3 Tool 接口定义

```typescript
// src/tools/base.ts

export interface ToolResult {
  content: string
  error?: string
  success: boolean
}

export interface ExecutionContext {
  cwd: string
  homeDir: string
  env: Record<string, string>
  // 其他执行上下文信息
}

export interface Tool {
  name: string
  description: string
  inputSchema: object  // JSON Schema

  execute(
    input: Record<string, unknown>,
    ctx: ExecutionContext
  ): Promise<ToolResult>
}
```

#### 1.4 Agent 核心循环

```typescript
// src/agent/agent.ts

export class Agent {
  private provider: Provider
  private tools: Map<string, Tool>
  private messages: Message[] = []

  constructor(provider: Provider, tools: Tool[]) {
    this.provider = provider
    this.tools = new Map(tools.map(t => [t.name, t]))
  }

  async run(userMessage: string): Promise<string> {
    // 1. 添加用户消息
    this.messages.push({ role: "user", content: userMessage })

    // 2. 调用 LLM
    const response = await this.provider.chat(this.messages, this.getToolDefs())

    // 3. 处理响应
    if (response.toolCalls?.length) {
      this.messages.push({ role: "assistant", content: response.content })

      // 4. 执行工具
      for (const call of response.toolCalls) {
        const result = await this.executeTool(call.name, call.input)
        this.messages.push({
          role: "tool",
          content: result.content,
          name: call.name,
          toolCallId: call.name, // 简化处理
        })
      }

      // 5. 继续循环
      return this.run("") // 继续生成
    } else {
      // 6. 返回最终回复
      this.messages.push({ role: "assistant", content: response.content })
      return response.content
    }
  }

  private async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { content: "", error: `Unknown tool: ${name}`, success: false }
    }

    const ctx: ExecutionContext = {
      cwd: process.cwd(),
      homeDir: os.homedir(),
      env: process.env as Record<string, string>,
    }

    return tool.execute(input, ctx)
  }

  private getToolDefs(): Tool[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
  }
}
```

#### 1.5 简单实现示例

```typescript
// src/index.ts
import { Agent } from "./agent/agent"
import { AnthropicProvider } from "./providers/anthropic"
import { ReadTool } from "./tools/read"
import { WriteTool } from "./tools/write"
import { EditTool } from "./tools/edit"
import { BashTool } from "./tools/bash"

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: "claude-sonnet-4-20250514",
})

const agent = new Agent(provider, [
  new ReadTool(),
  new WriteTool(),
  new EditTool(),
  new BashTool(),
])

// CLI 入口
const message = Bun.argv.slice(2).join(" ")
if (message) {
  const response = await agent.run(message)
  console.log(response)
}
```

---

### Phase 2: 交互式终端 (TUI)

**目标**：实现类似 pi 的终端界面

#### 2.1 布局设计

```
┌─────────────────────────────────────────┐
│ Header: 模型 / Token 用量 / 快捷键提示  │
├─────────────────────────────────────────┤
│                                         │
│  Messages Area                          │
│  - User message                         │
│  - Assistant: ...                      │
│  - Tool: read → ...                    │
│                                         │
├─────────────────────────────────────────┤
│  Editor: 你的输入...                    │
└─────────────────────────────────────────┘
```

#### 2.2 技术选型

| 方案 | 说明 | 推荐度 |
|------|------|--------|
| ANSI 转义序列 | 自己封装，最灵活 | ⭐⭐⭐ |
| `chatty` | Bun 友好，React 风格 | ⭐⭐⭐⭐ |
| `ink` | React for CLI，需额外配置 | ⭐⭐⭐ |
| ` Blessed` | 功能强大，Node 生态 | ⭐⭐ |

#### 2.3 简单 TUI 实现

```typescript
// src/tui/simple-tui.ts

import * as readline from "readline"

const MESSAGES: string[] = []
let EDITOR_CONTENT = ""

function render() {
  console.clear()

  // Header
  console.log("┌" + "─".repeat(50) + "┐")
  console.log("│  Model: claude-sonnet-4-20250514    Tokens: 1234  │")
  console.log("│  Ctrl+C: Quit  │  Ctrl+G: Edit  │  Tab: Tools  │")
  console.log("└" + "─".repeat(50) + "┘")

  // Messages
  for (const msg of MESSAGES) {
    console.log(msg)
    console.log()
  }

  // Editor
  console.log("├" + "─".repeat(50) + "┤")
  console.log("│ > " + EDITOR_CONTENT)
  console.log("└" + "─".repeat(50) + "┘")
}

// 读取按键
readline.emitKeypressEvents(process.stdin)
process.stdin.setRawMode(true)

process.stdin.on("keypress", (str, key) => {
  if (key.ctrl && key.name === "c") {
    console.log("\nBye!")
    process.exit(0)
  }

  if (key.name === "return") {
    const msg = EDITOR_CONTENT.trim()
    if (msg) {
      MESSAGES.push(`[You] ${msg}`)
      EDITOR_CONTENT = ""
    }
  } else if (key.name === "backspace") {
    EDITOR_CONTENT = EDITOR_CONTENT.slice(0, -1)
  } else if (key.ctrl && key.name === "l") {
    // Ctrl+L: Switch model
  } else {
    EDITOR_CONTENT += str
  }

  render()
})

render()
```

---

### Phase 3: 会话管理系统

**目标**：持久化 + 会话树 + 分支

#### 3.1 JSONL 文件格式

```jsonl
{"id":"msg-1","parentId":null,"type":"user","role":"user","content":"Hello","timestamp":"2025-01-01T10:00:00Z"}
{"id":"msg-2","parentId":"msg-1","type":"assistant","role":"assistant","content":"Hi!","timestamp":"2025-01-01T10:00:01Z"}
{"id":"msg-3","parentId":"msg-2","type":"tool","role":"tool","tool":"read","input":{},"result":"...","timestamp":"2025-01-01T10:00:02Z"}
```

#### 3.2 会话类型定义

```typescript
// src/session/types.ts

export interface SessionEntry {
  id: string
  parentId: string | null
  type: "user" | "assistant" | "tool"
  role: string
  content: string
  timestamp: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
}

export interface Session {
  id: string
  name: string
  path: string
  createdAt: string
  updatedAt: string
  entries: SessionEntry[]
  currentEntryId: string  // 指针：当前活跃位置
}
```

#### 3.3 会话存储实现

```typescript
// src/session/manager.ts

import { mkdir, appendFile, readFile, writeFile } from "fs/promises"
import { join } from "path"
import { Session, SessionEntry } from "./types"

export class SessionManager {
  private sessionDir: string
  private currentSession: Session | null = null

  constructor(sessionDir: string = "~/.myagent/sessions/") {
    this.sessionDir = sessionDir
  }

  async createSession(name: string): Promise<Session> {
    const id = this.generateId()
    const session: Session = {
      id,
      name,
      path: join(this.sessionDir, `${id}.jsonl`),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entries: [],
      currentEntryId: id,
    }

    await mkdir(this.sessionDir, { recursive: true })
    await writeFile(session.path, JSON.stringify(session) + "\n", "utf-8")

    this.currentSession = session
    return session
  }

  async appendEntry(entry: Omit<SessionEntry, "id" | "timestamp">): Promise<SessionEntry> {
    if (!this.currentSession) {
      throw new Error("No active session")
    }

    const fullEntry: SessionEntry = {
      ...entry,
      id: this.generateId(),
      parentId: this.currentSession.currentEntryId,
      timestamp: new Date().toISOString(),
    }

    await appendFile(
      this.currentSession.path,
      JSON.stringify(fullEntry) + "\n",
      "utf-8"
    )

    this.currentSession.entries.push(fullEntry)
    this.currentSession.currentEntryId = fullEntry.id
    this.currentSession.updatedAt = fullEntry.timestamp

    return fullEntry
  }

  async loadSession(path: string): Promise<Session> {
    const content = await readFile(path, "utf-8")
    const lines = content.trim().split("\n").filter(Boolean)

    // 第一行是 session 元数据
    const meta = JSON.parse(lines[0]) as Session

    // 剩余行是 entries
    const entries = lines.slice(1).map(line => JSON.parse(line) as SessionEntry)

    return {
      ...meta,
      entries,
      currentEntryId: entries[entries.length - 1]?.id ?? meta.id,
    }
  }

  async getActivePath(): Promise<SessionEntry[]> {
    if (!this.currentSession) return []

    // 从根到 currentEntryId 的路径
    const path: SessionEntry[] = []
    const map = new Map(this.currentSession.entries.map(e => [e.id, e]))

    let current = map.get(this.currentSession.currentEntryId)
    while (current) {
      path.unshift(current)
      current = current.parentId ? map.get(current.parentId) : undefined
    }

    return path
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}
```

#### 3.4 分支与回溯

```typescript
// src/session/branch.ts

export class SessionTree {
  // 构建树结构用于 /tree 视图
  static buildTree(entries: SessionEntry[]): TreeNode {
    const map = new Map<string | null, SessionEntry[]>()
    
    for (const entry of entries) {
      const parentId = entry.parentId ?? "root"
      if (!map.has(parentId)) map.set(parentId, [])
      map.get(parentId)!.push(entry)
    }

    return this.buildNode("root", map)
  }

  private static buildNode(
    id: string,
    children: Map<string | null, SessionEntry[]>
  ): TreeNode {
    return {
      id,
      children: (children.get(id) ?? []).map(child => ({
        entry: child,
        children: this.buildNode(child.id, children),
      })),
    }
  }

  // 回溯到指定节点（用于 /tree 导航）
  static getPathTo(entries: SessionEntry[], targetId: string): SessionEntry[] {
    const map = new Map(entries.map(e => [e.id, e]))
    const path: SessionEntry[] = []

    let current = map.get(targetId)
    while (current) {
      path.unshift(current)
      current = current.parentId ? map.get(current.parentId) : undefined
    }

    return path
  }
}

export interface TreeNode {
  id: string
  entry?: SessionEntry
  children: TreeNode[]
}
```

---

### Phase 4: 扩展系统 (Plugin)

**目标**：让用户能自定义工具/命令/主题

#### 4.1 插件接口定义

```typescript
// src/extensions/base.ts

export interface Extension {
  name: string
  version: string
  description?: string

  // 注册钩子
  register(agent: AgentAPI): void | Promise<void>

  // 可选：清理函数
  unregister?(): void
}

export interface AgentAPI {
  // 注册 API
  registerTool(tool: Tool): void
  unregisterTool(name: string): void

  registerCommand(cmd: Command): void
  unregisterCommand(name: string): void

  registerProvider(provider: Provider): void

  // 生命周期钩子
  on(event: "user_message" | "assistant_message" | "tool_call" | "tool_result", handler: EventHandler): void
  off(event: string, handler: EventHandler): void

  // 配置访问
  config: AgentConfig
  settings: Settings
}

export interface Command {
  name: string
  description: string
  execute(args: string[], api: AgentAPI): void | Promise<void>
}

export type EventHandler = (event: Event, api: AgentAPI) => void | Promise<void>
```

#### 4.2 插件加载器

```typescript
// src/extensions/loader.ts

import { existsSync, readdirSync } from "fs"
import { join, extname } from "path"
import { Extension } from "./base"

export class ExtensionLoader {
  private extensions: Map<string, Extension> = new Map()
  private api: AgentAPI

  constructor(api: AgentAPI) {
    this.api = api
  }

  async loadFromDir(dir: string): Promise<void> {
    if (!existsSync(dir)) return

    const files = readdirSync(dir, { withFileTypes: true })

    for (const file of files) {
      const fullPath = join(dir, file.name)

      if (file.isDirectory()) {
        await this.loadFromDir(fullPath)
      } else if (extname(file.name) === ".ts") {
        await this.loadFile(fullPath)
      }
    }
  }

  async loadFile(path: string): Promise<void> {
    try {
      // Bun 动态导入
      const module = await import(path)
      const extension = module.default as Extension

      if (!extension.name) {
        console.warn(`Extension at ${path} missing name, skipping`)
        return
      }

      await extension.register(this.api)
      this.extensions.set(extension.name, extension)

      console.log(`Loaded extension: ${extension.name} (${extension.version})`)
    } catch (err) {
      console.error(`Failed to load extension from ${path}:`, err)
    }
  }

  unload(name: string): void {
    const ext = this.extensions.get(name)
    if (ext?.unregister) {
      ext.unregister()
    }
    this.extensions.delete(name)
  }

  list(): Extension[] {
    return Array.from(this.extensions.values())
  }
}
```

#### 4.3 示例插件：Git 自动提交

```typescript
// extensions/auto-commit.ts

import type { Extension, AgentAPI } from "../extensions/base"

export default {
  name: "auto-commit",
  version: "1.0.0",
  description: "Auto commit after successful tool execution",

  async register(api: AgentAPI) {
    let lastCommit = ""

    api.on("tool_result", async (event) => {
      if (event.toolName === "bash" && event.result?.success) {
        // 检查是否涉及 git 操作
        const cmd = event.input?.command as string
        if (cmd?.includes("git commit")) {
          lastCommit = cmd
          // 可以在这里触发自动 push 等
        }
      }
    })
  },

  unregister() {
    // 清理
  },
} satisfies Extension
```

---

### Phase 5: 高级功能

| 顺序 | 功能 | 说明 |
|------|------|------|
| 5.1 | 思考模式 | 支持 thinking budgets (Anthropic) |
| 5.2 | 消息队列 | Enter 排队 + Alt+Enter follow-up |
| 5.3 | 流式输出 | Server-Sent Events |
| 5.4 | 上下文压缩 | 自动摘要旧消息 |
| 5.5 | MCP 集成 | 作为扩展实现 |
| 5.6 | SSH/远程执行 | 扩展实现 |
| 5.7 | 多会话管理 | tmux 集成或内置 |

#### 5.1 消息队列示例

```typescript
// src/agent/message-queue.ts

export interface QueuedMessage {
  id: string
  content: string
  type: "steering" | "follow-up"
  timestamp: number
}

export class MessageQueue {
  private queue: QueuedMessage[] = []

  enqueue(content: string, type: "steering" | "follow-up"): void {
    this.queue.push({
      id: crypto.randomUUID(),
      content,
      type,
      timestamp: Date.now(),
    })
  }

  // steering 消息在当前工具执行完成后交付
  // follow-up 消息在 agent 完全空闲后交付
  getSteeringMessages(): QueuedMessage[] {
    return this.queue.filter(m => m.type === "steering")
  }

  getFollowUpMessages(): QueuedMessage[] {
    return this.queue.filter(m => m.type === "follow-up")
  }

  // Agent 空闲时调用
  flushFollowUp(): QueuedMessage[] {
    const messages = this.getFollowUpMessages()
    this.queue = this.queue.filter(m => m.type !== "follow-up")
    return messages
  }

  clear(): void {
    this.queue = []
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }
}
```

---

## 📚 技术栈建议

```json
{
  "runtime": "bun",
  "lang": "typescript",
  "cli": "bun CLI 内置",
  "ui": {
    "simple": "kleur + readline",
    "advanced": "chatty 或 ink"
  },
  "llm": {
    "client": "bun 的内置 fetch + 自封装",
    "可选": "@ai-sdk/* 包"
  },
  "storage": {
    "session": "文件系统 (JSONL)",
    "config": "~/.myagent/"
  }
}
```

### 核心依赖

```json
{
  "dependencies": {
    "kleur": "^4.1.4",
    "picocolors": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "bun-types": "^1.0.0"
  }
}
```

---

## 🎯 推荐顺序

```
Phase 1 (核心) → Phase 2 (TUI) → Phase 3 (会话) → Phase 4 (扩展) → Phase 5 (高级)
```

### 每阶段交付物

| Phase | 交付物 | 可运行状态 |
|-------|--------|-----------|
| 1 | Agent 核心逻辑 | ✅ 能跑命令行对话 |
| 2 | 终端界面 | ✅ 有漂亮的 TUI |
| 3 | 会话持久化 | ✅ 可保存/回溯 |
| 4 | 插件系统 | ✅ 能装插件 |
| 5 | 高级功能 | 🔄 按需实现 |

---

## 🔧 下一步建议

1. **先搭建 Phase 1** - 核心逻辑最重要
2. **选一个 Provider 开始** - 推荐 Anthropic Claude API（最强大）
3. **先实现 `read` + `bash` 两个工具** - 足够测试 Agent 循环

---

## 📖 参考资源

- [pi-agent GitHub](https://github.com/earendil-works/pi-mono)
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Bun 文档](https://bun.sh/docs)
- [Agent Skills Standard](https://agentskills.io)
