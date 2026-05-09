// ============================================================
// MCP CLI - MCP 支持的 CLI 入口
// ============================================================

import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"
import { ExtensionManager } from "../extensions"
import { color, theme } from "../tui/colors"
import { MCPClientManager, loadMCPConfig, COMMON_MCP_SERVERS } from "../mcp"
import { ThemeManager } from "../advanced/themes"
import autoSavePlugin from "../extensions/plugins/auto-save"
import gitPlugin from "../extensions/plugins/git"
import fileSearchPlugin from "../extensions/plugins/file-search"
import statsPlugin from "../extensions/plugins/stats"
import type { Tool } from "../tools/base"
import type { MCPServerConfig } from "../mcp/server"

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

  // 创建 MCP 客户端管理器
  const mcpManager = new MCPClientManager()

  // 加载 MCP 配置
  const mcpConfig = await loadMCPConfig()
  
  // 合并配置
  const serversToLoad: MCPServerConfig[] = [
    ...mcpConfig.servers,
    ...COMMON_MCP_SERVERS.filter(s => s.enabled),
  ]

  // 初始化 MCP 服务器
  console.log(color("\n🔌 Initializing MCP servers...", theme.statusBar))
  
  for (const serverConfig of serversToLoad) {
    if (!serverConfig.enabled) continue
    
    try {
      const client = await mcpManager.addClient(serverConfig.name, {
        name: "my-agent",
        version: "0.6.0",
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        onLog: (level, msg) => {
          if (level === "error") {
            console.error(color(`[MCP ${serverConfig.name}] ${msg}`, theme.errorText))
          }
        },
        onError: (err) => {
          console.error(color(`[MCP ${serverConfig.name}] Error: ${err.message}`, theme.errorText))
        },
      })

      const stats = client.getStats()
      console.log(
        color(`  ✓ ${serverConfig.name}`, theme.successText) +
        color(` (${stats.toolsCount} tools, ${stats.resourcesCount} resources)`, theme.statusBar)
      )
    } catch (error) {
      console.error(
        color(`  ✗ ${serverConfig.name}: ${error instanceof Error ? error.message : error}`, theme.errorText)
      )
    }
  }

  // 获取 MCP 工具
  const mcpTools = mcpManager.getAllTools()
  console.log(color(`\n📦 Total MCP tools: ${mcpTools.length}`, theme.statusBar))

  // 创建内置工具
  const builtInTools = [
    new ReadTool(),
    new WriteTool(),
    new EditTool(),
    new BashTool(),
  ]

  // 注册 MCP 工具到扩展
  const mcpExtension = {
    meta: {
      name: "mcp",
      version: "1.0.0",
      description: "MCP tools",
    },
    register(api: any) {
      for (const tool of mcpTools) {
        api.registerTool(tool)
      }
      api.log(`Registered ${mcpTools.length} MCP tools`)
    },
  }

  await extManager.load({
    plugins: [mcpExtension as any],
  })

  // 合并所有工具
  const allTools = [...builtInTools, ...mcpTools]

  // 创建会话管理器
  const sessionManager = new SessionManager()
  const session = await sessionManager.createSession()

  // 创建主题管理器
  const themeManager = new ThemeManager("dark")

  // 欢迎信息
  printWelcome(mcpTools.length, mcpManager)

  console.log(`${color("Session:", theme.statusBar)} ${color(session.meta.name, theme.statusBarHighlight)}`)
  console.log(color("─".repeat(60), theme.border))
  console.log()

  // 交互循环
  while (true) {
    const userInput = await readLine("❯ ")
    
    if (!userInput.trim()) continue

    // 命令处理
    if (userInput.startsWith("/")) {
      await handleCommand(userInput, mcpManager, themeManager)
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

    try {
      // 构建消息
      const messages = buildMessages(sessionManager.getCurrentPath())
      
      // 调用 LLM
      const response = await provider.chat(
        messages,
        allTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }))
      )

      console.log(color("🤖 Assistant", theme.assistantPrefix))
      console.log(color("─".repeat(40), theme.border))
      console.log(response.content)

      // 保存响应
      await sessionManager.addEntry("assistant", "assistant", response.content)

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          console.log(color(`\n🔧 Tool: ${call.name}`, theme.toolPrefix))
          
          // 查找工具
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

          // 执行工具
          const result = await tool.execute(call.input, {
            cwd: process.cwd(),
            homeDir: Bun.env.HOME ?? "/tmp",
            env: Bun.env as Record<string, string | undefined>,
          })

          console.log(color(`📄 Result:`, theme.toolText))
          console.log(result.content.slice(0, 500) + (result.content.length > 500 ? "..." : ""))
          
          await sessionManager.addEntry("tool", "tool", result.content, {
            toolName: call.name,
            toolInput: call.input,
            toolResult: result.content,
          })

          // 继续调用 LLM
          console.log(color("\n🤖 Processing...", theme.assistantPrefix))
          
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
          console.log(followUp.content)
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

Built-in tools:
- read: Read file contents
- write: Create or overwrite files
- edit: Edit files with precise text replacement
- bash: Execute shell commands

You also have access to MCP (Model Context Protocol) tools provided by external servers.

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
async function handleCommand(
  cmd: string, 
  mcpManager: MCPClientManager,
  themeManager: ThemeManager
): Promise<void> {
  const parts = cmd.slice(1).split(/\s+/)
  const command = parts[0].toLowerCase()
  const args = parts.slice(1)

  switch (command) {
    case "help":
    case "h":
      printHelp()
      break

    case "mcp":
    case "servers":
      printMCPServers(mcpManager)
      break

    case "theme":
      if (args[0]) {
        if (themeManager.setTheme(args[0])) {
          console.log(color(`Theme changed to: ${args[0]}`, theme.successText))
        } else {
          console.log(color(`Unknown theme. Available: ${themeManager.getAvailableThemes().join(", ")}`, theme.errorText))
        }
      } else {
        console.log(color(`Current theme: ${themeManager.getThemeName()}`, theme.statusBar))
      }
      break

    case "new":
      console.log(color("Use /quit and restart to create a new session", theme.statusBar))
      break

    case "quit":
    case "q":
      mcpManager.disconnectAll()
      console.log("\nGoodbye!")
      process.exit(0)
      break

    default:
      console.log(color(`Unknown command: ${command}`, theme.errorText))
  }
}

// 打印 MCP 服务器状态
function printMCPServers(mcpManager: MCPClientManager): void {
  const stats = mcpManager.getStats()
  const servers = Object.keys(stats)

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
  console.log(color("│", theme.border) + color(" MCP Servers".padEnd(60) + "│", theme.assistantPrefix))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))

  if (servers.length === 0) {
    console.log(color("│", theme.border) + color(" No MCP servers connected".padEnd(60) + "│", theme.statusBar))
  } else {
    for (const server of servers) {
      const s = stats[server]
      const status = s.connected ? color("✓", theme.successText) : color("✗", theme.errorText)
      const tools = color(`${s.toolsCount} tools`, theme.statusBar)
      const resources = color(`${s.resourcesCount} resources`, theme.statusBar)
      
      console.log(color("│", theme.border) + color(` ${status} ${server.padEnd(20)} ${tools}  ${resources}`.padEnd(60) + "│", theme.statusBar))
    }
  }

  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 打印帮助
function printHelp(): void {
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("Commands", theme.assistantPrefix)}                                                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("/help, /h", theme.statusBarHighlight)}       Show this help                               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/mcp, /servers", theme.statusBarHighlight)} Show MCP server status                       ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/theme <name>", theme.statusBarHighlight)} Change theme (dark/light/monokai/nord)     ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/quit, /q", theme.statusBarHighlight)}       Exit                                        ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
}

// 打印欢迎
function printWelcome(mcpToolCount: number, mcpManager: MCPClientManager): void {
  console.clear()
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent - MCP Support", theme.assistantPrefix)}                                      ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("✨ Model Context Protocol support", theme.statusBarHighlight)}                            ${color("│", theme.border)}
${color("│", theme.border)}  ${color("🔌 Connect to MCP servers for tools", theme.statusBarHighlight)}                        ${color("│", theme.border)}
${color("│", theme.border)}  ${color("📦 ${mcpToolCount} MCP tools available", theme.statusBarHighlight)}                              ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Type /help for commands", theme.statusBar)}                                   ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
}

// 运行
main().catch(console.error)
