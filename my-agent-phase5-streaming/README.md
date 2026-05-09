# My Agent - Streaming Mode

> 流式输出 UI：实时显示 LLM 响应

## 项目结构

```
my-agent-phase5-streaming/
├── src/
│   ├── cli/
│   │   ├── cli.ts            # 标准模式
│   │   └── streaming-cli.ts  # 流式模式 (新增)
│   ├── tui/
│   │   ├── streaming-ui.ts  # 流式 UI 组件 (新增)
│   │   └── ...
│   ├── providers/
│   │   └── anthropic.ts     # 更新：支持流式
│   ├── agent/agent.ts       # 更新：流式支持
│   └── ...
├── package.json
└── README.md
```

## 快速开始

```bash
cd my-agent-phase5-streaming
bun install
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# 流式模式（实时输出）
bun run ./src/cli/streaming-cli.ts

# 标准模式
bun run ./src/cli/cli.ts
```

## 流式输出特性

### 实时响应

```
❯ Write a hello world program in Python

👤 You
────────────────────────────────────────
Write a hello world program in Python

🤖 Assistant
────────────────────────────────────────
Here's a simple Hello World program in Python:

```python
print("Hello, World!")
```

You can run it with: python hello.py
```

### 工具执行可视化

```
❯ List files in current directory

🤖 Assistant
────────────────────────────────────────
I'll list the files for you.

🔧 Tool: bash
✅ Tool complete

📄 Result: src/  package.json  README.md  ...

The files in your current directory are:
- src/
- package.json  
- README.md
```

### 思考过程可见

```
❯ What's 2+2?

🤖 Assistant
────────────────────────────────────────
💭 Let me calculate...

4

That's 2 + 2 = 4.
```

## 技术实现

### 流式事件

```typescript
type StreamEvent = 
  | { type: "text"; content: string }        // 文本增量
  | { type: "thinking"; content: string }    // 思考增量
  | { type: "tool_call_start"; toolName: string }
  | { type: "tool_call_delta"; content: string }
  | { type: "tool_call_end" }
  | { type: "done" }
```

### Provider 流式接口

```typescript
interface StreamingProvider {
  streamChat(
    messages: Message[],
    tools?: Tool[],
    onEvent: (event: StreamEvent) => void
  ): Promise<LLMResponse>
}
```

### StreamingUI 组件

```typescript
const ui = new StreamingUI({
  showThinking: true,
  autoScroll: true,
})

ui.start()
ui.addText("Hello")
ui.startToolCall("bash")
ui.addToolInput('{"command": "ls"}')
ui.endToolCall()
ui.done()
```

## 与标准模式的区别

| 特性 | 标准模式 | 流式模式 |
|------|----------|----------|
| 响应方式 | 等待完整响应 | 实时显示 |
| 工具执行 | 完成后显示 | 实时可视化 |
| 思考过程 | 不可见 | 可选显示 |
| 用户体验 | 等待感强 | 即时反馈 |

## 命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/sessions` | 列出会话 |
| `/new` | 创建新会话 |
| `/quit` | 退出 |

## 下一步

- 添加更多动画效果
- 支持 ANSI 动画（打字机效果）
- 添加进度指示器
- 集成到完整 TUI
