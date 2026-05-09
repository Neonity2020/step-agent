// ============================================================
// Advanced CLI - 高级功能入口
// ============================================================

import { TUI } from "../tui"
import { Agent } from "../agent/agent"
import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"
import { ExtensionManager } from "../extensions"
import { color, theme } from "../tui/colors"
import { ThemeManager, THEMES } from "../advanced/themes"
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

  // 创建主题管理器
  const themeManager = new ThemeManager("dark")
  
  // 检查命令行参数中的主题
  const args = Bun.argv.slice(2)
  const themeArg = args.find(arg => arg.startsWith("--theme="))
  if (themeArg) {
    const themeName = themeArg.split("=")[1]
    if (themeManager.setTheme(themeName)) {
      console.log(`${color(`Theme set to: ${themeName}`, themeManager.getTheme().infoText)}\n`)
    }
  }

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

  // 更新扩展设置
  const extTools = extManager.getTools()
  const builtInTools = ["read", "write", "edit", "bash"]
  const extensionTools = extTools.filter(t => !builtInTools.includes(t.name))

  extManager.getAPI().setSetting("extensionsLoaded", extManager.listExtensions().length)
  extManager.getAPI().setSetting("toolsCount", extTools.length)
  extManager.getAPI().setSetting("commandsCount", extManager.getCommands().length)
  extManager.getAPI().setSetting("extensionsList", extManager.listExtensions())
  extManager.getAPI().setSetting("toolsList", builtInTools)
  extManager.getAPI().setSetting("extensionTools", extensionTools.map(t => t.name))
  extManager.getAPI().setSetting("commandsList", extManager.getCommands().map(c => ({ name: c.name, desc: c.description })))

  // 创建 Provider
  const provider = new AnthropicProvider({
    apiKey,
    model: "claude-sonnet-4-20250514",
  })

  // 创建内置工具
  const builtInTools2 = [
    new ReadTool(),
    new WriteTool(),
    new EditTool(),
    new BashTool(),
  ]

  // 创建 Agent（启用高级功能）
  const agent = new Agent({
    provider,
    tools: builtInTools2,
    extensions: extManager,
    verbose: false,
    enableCompaction: true,
    enableStreaming: false, // 流式输出需要更多 UI 支持
  })

  // 创建会话管理器
  const sessionManager = new SessionManager()

  // 创建 TUI
  const tui = new TUI({
    sessionManager,
    extensionManager: extManager,
    themeManager,
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
        
        // 显示统计信息
        const stats = agent.getStats()
        tui.setStatus(`Tokens: ${stats.totalTokens} | Tools: ${stats.toolCalls} | Iterations: ${stats.iterations}`)
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
