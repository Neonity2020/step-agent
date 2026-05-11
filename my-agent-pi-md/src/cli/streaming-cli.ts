// ============================================================
// Streaming CLI - 流式输出入口
// ============================================================

import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"
import { ExtensionManager } from "../extensions"
import { color, theme } from "../tui/colors"
import { renderMarkdown } from "../tui/markdown"
import { StreamingUI, AnimatedStreamingUI } from "../tui/streaming-ui"
import type { StreamCallback } from "../agent/agent"
import autoSavePlugin from "../extensions/plugins/auto-save"
import gitPlugin from "../extensions/plugins/git"
import fileSearchPlugin from "../extensions/plugins/file-search"
import statsPlugin from "../extensions/plugins/stats"

async function main() {
  // 检查 API Key
  const apiKey = Bun.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.error(`${color("Error: ANTHROPIC_API_KEY not set", theme.errorText)}`)
    console.error(`\nPlease set your API key:`)
    console.error(`  ${color("export ANTHROPIC_API_KEY=sk-ant-...", theme.assistantPrefix)}\n`)
    process.exit(1)
  }

  // 创建 Provider（启用流式）
  const provider = new AnthropicProvider({
    apiKey,
    model: "claude-sonnet-4-20250514",
  })

  // 创建扩展管理器
  const extManager = new ExtensionManager()

  // 加载内置扩展
  await extManager.load({
    plugins: [
      autoSavePlugin,
      gitPlugin,
      fileSearchPlugin,
      statsPlugin,
    ],
  })

  // 创建内置工具
  const builtInTools = [
    new ReadTool(),
    new WriteTool(),
    new EditTool(),
    new BashTool(),
  ]

  // 注册扩展工具
  const extTools = extManager.getTools()
  const allTools = [...builtInTools, ...extTools]

  // 创建会话管理器
  const sessionManager = new SessionManager()
  const session = await sessionManager.createSession()
  
  // 创建流式 UI
  const streamingUI = new AnimatedStreamingUI()

  // 流式回调
  const streamCallback: StreamCallback = (event) => {
    switch (event.type) {
      case "text":
        if (event.content) {
          streamingUI.addText(event.content)
        }
        break
      case "thinking":
        if (event.content) {
          streamingUI.addThinking(event.content)
        }
        break
      case "tool_start":
        streamingUI.startToolCall(event.toolName ?? "unknown")
        break
      case "tool_input":
        streamingUI.addToolInput(event.content ?? "")
        break
      case "tool_end":
        streamingUI.endToolCall()
        break
      case "done":
        streamingUI.done()
        break
    }
  }

  // 欢迎信息
  printWelcome()

  console.log(`${color("Session:", theme.statusBar)} ${color(session.meta.name, theme.statusBarHighlight)}`)
  console.log(`${color("Model:", theme.statusBar)} ${color("claude-sonnet-4-20250514", theme.statusBarHighlight)}`)
  console.log(color("─".repeat(60), theme.border))
  console.log()

  // 交互循环
  while (true) {
    // 读取用户输入
    const userInput = await readLine("❯ ")
    
    if (!userInput.trim()) continue

    // 命令处理
    if (userInput.startsWith("/")) {
      await handleCommand(userInput, sessionManager)
      continue
    }

    // 保存用户消息
    await sessionManager.addEntry("user", "user", userInput)

    // 显示用户消息
    console.log()
    console.log(color("👤 You", theme.userPrefix))
    console.log(color("─".repeat(40), theme.border))
    console.log(userInput)
    console.log()
    console.log(color("🤖 Assistant", theme.assistantPrefix))
    console.log(color("─".repeat(40), theme.border))

    // 开始流式响应
    streamingUI.start()

    try {
      // 调用 LLM
      const messages = buildMessages(sessionManager.getCurrentPath())
      
      const response = await provider.streamChat(
        messages,
        allTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
        (event) => {
          // 实时更新 UI
          switch (event.type) {
            case "text":
              if (event.content) {
                process.stdout.write(event.content)
                streamingUI.addText(event.content)
              }
              break
            case "thinking":
              if (event.content) {
                // 思考内容只显示在状态中
                streamingUI.addThinking(event.content)
              }
              break
            case "tool_call_start":
              console.log()
              console.log(color(`\n🔧 Tool: ${event.toolName}`, theme.toolPrefix))
              streamingUI.startToolCall(event.toolName ?? "unknown")
              break
            case "tool_call_delta":
              // 工具输入增量
              break
            case "tool_call_end":
              console.log(color(`✅ Tool complete`, theme.successText))
              streamingUI.endToolCall()
              break
            case "done":
              console.log()
              break
          }
        }
      )

      // 保存 assistant 响应
      await sessionManager.addEntry("assistant", "assistant", response.content)

      // 如果有工具调用，执行它们
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          console.log(color(`\n🔧 Executing tool: ${call.name}`, theme.toolPrefix))
          
          const tool = allTools.find(t => t.name === call.name)
          if (!tool) {
            console.log(color(`❌ Unknown tool: ${call.name}`, theme.errorText))
            await sessionManager.addEntry("tool", "tool", `Error: Unknown tool ${call.name}`, {
              toolName: call.name,
              toolInput: call.input,
              toolResult: `Error: Unknown tool ${call.name}`,
            })
            continue
          }

          const result = await tool.execute(call.input, {
            cwd: process.cwd(),
            homeDir: Bun.env.HOME ?? "/tmp",
            env: Bun.env as Record<string, string | undefined>,
          })

          const toolContent = result.success ? result.content : `Error: ${result.error}`
          console.log(color(`📄 Result: ${toolContent.slice(0, 200)}...`, theme.toolText))
          
          await sessionManager.addEntry("tool", "tool", toolContent, {
            toolName: call.name,
            toolInput: call.input,
            toolResult: result.content,
          })

          // 继续调用 LLM 处理工具结果
          console.log(color("\n🤖 Processing result...", theme.assistantPrefix))
          
          const updatedMessages = buildMessages(sessionManager.getCurrentPath())
          const followUp = await provider.chat(
            updatedMessages,
            allTools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            }))
          )

          await sessionManager.addEntry("assistant", "assistant", followUp.content)
          console.log(color("\n📝 Response:", theme.assistantPrefix))
          console.log(renderMarkdown(followUp.content))
        }
      }

    } catch (error) {
      console.error(color(`\n❌ Error: ${error instanceof Error ? error.message : error}`, theme.errorText))
    }

    console.log()
  }
}

// 读取行
function readLine(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(color(prompt + " ", theme.assistantPrefix), (answer: string) => {
      rl.close()
      resolve(answer)
    })
  })
}

// 构建消息
function buildMessages(path: any[]): any[] {
  const msgs: any[] = [
    {
      role: "system",
      content: `You are a helpful coding assistant with access to tools.

Available tools:
- read: Read file contents
- write: Create or overwrite files
- edit: Edit files with precise text replacement
- bash: Execute shell commands

Be concise and practical. Use tools when needed to accomplish tasks.`
    }
  ]

  for (const entry of path) {
    if (entry.type === "user") {
      msgs.push({ role: "user", content: entry.content })
    } else if (entry.type === "assistant") {
      msgs.push({ role: "assistant", content: entry.content })
    } else if (entry.type === "tool") {
      msgs.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: entry.id,
          content: entry.toolResult ?? entry.content,
        }]
      })
    }
  }

  return msgs
}

// 处理命令
async function handleCommand(cmd: string, sessionManager: SessionManager): Promise<void> {
  const parts = cmd.slice(1).split(/\s+/)
  const command = parts[0].toLowerCase()
  const args = parts.slice(1)

  switch (command) {
    case "help":
    case "h":
      printHelp()
      break
    case "sessions":
    case "ls":
      await listSessions(sessionManager)
      break
    case "new":
      await sessionManager.createSession()
      console.log(color("New session created!", theme.successText))
      break
    case "quit":
    case "q":
      console.log("\nGoodbye!")
      process.exit(0)
      break
    default:
      console.log(color(`Unknown command: ${command}`, theme.errorText))
  }
}

// 列出会话
async function listSessions(sessionManager: SessionManager): Promise<void> {
  const sessions = await sessionManager.listSessions()
  console.log(color("\n📁 Sessions:", theme.header))
  for (const s of sessions.slice(0, 5)) {
    console.log(`  ${s.id.slice(-8)}  ${s.name}  (${s.entryCount} entries)`)
  }
}

// 打印帮助
function printHelp(): void {
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("Commands", theme.assistantPrefix)}                                                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("/help, /h", theme.statusBarHighlight)}       Show this help                               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/sessions, /ls", theme.statusBarHighlight)}   List sessions                                ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/new", theme.statusBarHighlight)}           Create new session                            ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/quit, /q", theme.statusBarHighlight)}       Exit                                        ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
}

// 打印欢迎
function printWelcome(): void {
  console.clear()
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent - Streaming Mode", theme.assistantPrefix)}                                  ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("✨ Real-time streaming output", theme.statusBarHighlight)}                              ${color("│", theme.border)}
${color("│", theme.border)}  ${color("🔧 Tool execution with live feedback", theme.statusBarHighlight)}                     ${color("│", theme.border)}
${color("│", theme.border)}  ${color("💭 Thinking visible in real-time", theme.statusBarHighlight)}                         ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Type /help for commands", theme.statusBar)}                                   ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
}

// 运行
main().catch(console.error)
