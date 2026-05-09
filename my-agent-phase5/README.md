# My Agent - Phase 5

> 高级功能：消息队列、上下文压缩、主题系统、流式输出

## 项目结构

```
my-agent-phase5/
├── src/
│   ├── cli/
│   │   └── cli.ts           # 主入口 (高级功能)
│   ├── advanced/            # 高级功能 (Phase 5 新增)
│   │   ├── queue.ts        # 消息队列
│   │   ├── stream.ts       # 流式输出
│   │   ├── compactor.ts    # 上下文压缩
│   │   ├── themes.ts       # 主题系统
│   │   └── index.ts        # 导出
│   ├── extensions/          # (复用 Phase 4)
│   ├── tui/                 # TUI (更新)
│   ├── session/              # (复用 Phase 3)
│   ├── agent/               # Agent (更新)
│   ├── providers/            # (复用 Phase 1)
│   ├── tools/               # (复用 Phase 1)
│   └── types/               # (复用 Phase 1)
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd my-agent-phase5
bun install
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. 运行

```bash
# 默认主题
bun run ./src/cli/cli.ts

# 指定主题
bun run ./src/cli/cli.ts --theme=monokai
```

## Phase 5 交付物

- [x] 消息队列（Steering/Follow-up）
- [x] 上下文压缩（自动摘要）
- [x] 主题系统（4 种预设主题）
- [x] 流式输出框架
- [x] 统计信息面板
- [x] Agent 集成

## 高级功能详解

### 1. 消息队列

```typescript
const queue = agent.getMessageQueue()

// 排队消息
queue.enqueue("轻推指令", "steering")   // 工具执行后立即交付
queue.enqueue("后续任务", "follow-up") // Agent 空闲后交付

// 查看队列状态
queue.getStats()
// { steering: 1, followUp: 1, total: 2 }
```

**工作原理：**
- `Steering` - Enter 发送，当前工具执行完成后立即交付给 LLM
- `Follow-up` - Alt+Enter 发送，等待 Agent 完全空闲后交付

### 2. 上下文压缩

```typescript
// 检查是否需要压缩
const advice = agent.getCompactionAdvice()
// { shouldCompact: false, estimatedTokens: 1234, reason: "..." }

// 手动触发压缩
await agent.compact()
// { success: true, message: "Compressed 20 messages..." }
```

**压缩策略：**
- 保留最新的 10 条消息
- 旧消息自动生成摘要
- 摘要包含：用户意图、助手回复数、使用的工具

### 3. 主题系统

```bash
# 可用主题
bun run ./src/cli/cli.ts --theme=dark     # 默认
bun run ./src/cli/cli.ts --theme=light
bun run ./src/cli/cli.ts --theme=monokai
bun run ./src/cli/cli.ts --theme=nord
```

**TUI 内切换：**
```
/theme monokai
/theme list
```

**预设主题：**

| 主题 | 风格 |
|------|------|
| `dark` | 深色（默认） |
| `light` | 浅色 |
| `monokai` | Monokai 风格 |
| `nord` | Nord 风格 |

### 4. 流式输出

```typescript
import { DefaultStreamHandler, AnthropicSSEParser } from "./advanced/stream"

const handler = new DefaultStreamHandler({
  onText: (text) => process.stdout.write(text),
  onThinking: (thinking) => console.log("💭", thinking),
  onToolCall: (call) => console.log("🔧", call.name),
  onDone: () => console.log("\n"),
})

handler.start()
handler.text("Hello")
handler.done()
```

## 新增命令

| 命令 | 说明 |
|------|------|
| `/theme <name>` | 切换主题 |
| `/compact` | 显示上下文压缩信息 |
| `/stats` | 显示会话统计面板 |
| `/queue` | 显示消息队列状态 |

## 统计面板

```
┌────────────────────────────────────────────────────────────┐
│                    Session Statistics                      │
├────────────────────────────────────────────────────────────┤
│  Session: my-session                                       │
│  Total entries: 45                                        │
│    User messages: 15                                       │
│    Assistant messages: 15                                  │
│    Tool calls: 15                                          │
├────────────────────────────────────────────────────────────┤
│                    Extensions & Tools                      │
├────────────────────────────────────────────────────────────┤
│  Extensions loaded: 4                                      │
│  Total tools: 11                                           │
│  Total commands: 5                                         │
├────────────────────────────────────────────────────────────┤
│                    Current Theme                            │
├────────────────────────────────────────────────────────────┤
│  Theme: dark                                               │
│  Available: dark, light, monokai, nord                     │
└────────────────────────────────────────────────────────────┘
```

## 架构升级

```
Agent (Phase 5)
├── MessageQueue      # 消息排队
├── ContextCompactor  # 上下文压缩
├── ThemeManager      # 主题管理
└── StreamHandler     # 流式输出

Extension Events (新增)
├── before_chat
├── after_chat
├── before_tool
├── after_tool
├── user_message
├── assistant_message
└── error
```

## 项目进度

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 核心骨架 | ✅ |
| Phase 2 | 交互式终端 (TUI) | ✅ |
| Phase 3 | 会话管理（持久化） | ✅ |
| Phase 4 | 扩展系统 | ✅ |
| Phase 5 | 高级功能 | ✅ |

---

## 总结

恭喜！你已经完成了一个完整的 Coding Agent 构建过程：

### 学到的内容

1. **Phase 1** - Agent 核心循环：Provider、Tool、Message
2. **Phase 2** - TUI 界面：ANSI 颜色、屏幕渲染、输入处理
3. **Phase 3** - 会话管理：JSONL 持久化、会话树、时间旅行
4. **Phase 4** - 扩展系统：Plugin 架构、事件钩子、自定义工具
5. **Phase 5** - 高级功能：消息队列、上下文压缩、主题系统、流式输出

### 下一步建议

- **流式输出 UI**：完善终端中的实时输出
- **MCP 集成**：添加 Model Context Protocol 支持
- **多会话管理**：内置 tmux 风格的分屏
- **Web UI**：添加 Web 界面版本
- **部署**：打包为 CLI 工具发布到 npm

### 参考项目

- [pi-agent](https://github.com/earendil-works/pi-mono) - 灵感来源
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) - 商业参考
- [Agent SDKs](https://docs.anthropic.com/en/docs/about-claude) - 模型 API
