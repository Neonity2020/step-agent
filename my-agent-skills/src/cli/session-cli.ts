// ============================================================
// Session CLI - 会话管理入口
// ============================================================

import { TUI } from "../tui"
import { Agent } from "../agent/agent"
import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"
import { color, theme } from "../tui/colors"

async function main() {
  // 检查 API Key
  const apiKey = Bun.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.error(`${color("Error: ANTHROPIC_API_KEY not set", theme.errorText)}`)
    console.error(`\nPlease set your API key:`)
    console.error(`  ${color("export ANTHROPIC_API_KEY=sk-ant-...", theme.assistantPrefix)}\n`)
    process.exit(1)
  }

  // 创建 Provider
  const provider = new AnthropicProvider({
    apiKey,
    model: "claude-sonnet-4-20250514",
  })

  // 创建工具
  const tools = [
    new ReadTool(),
    new WriteTool(),
    new EditTool(),
    new BashTool(),
  ]

  // 创建 Agent
  const agent = new Agent({
    provider,
    tools,
    verbose: false,
  })

  // 创建会话管理器
  const sessionManager = new SessionManager()

  // 创建 TUI
  const tui = new TUI({
    sessionManager,
    modelName: "claude-sonnet-4-20250514",
    onSubmit: async (userMessage: string) => {
      // 确保 Agent 关联当前会话
      const session = sessionManager.getCurrentSession()
      if (session) {
        agent.setSessionManager(sessionManager, session)
      }

      try {
        const response = await agent.run(userMessage)
        tui.addMessage({
          role: "assistant",
          content: response,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        tui.addMessage({
          role: "assistant",
          content: `Error: ${errorMsg}`,
        })
      }
    },
  })

  // 启动 TUI
  await tui.start()
}

// 运行
main().catch(console.error)
