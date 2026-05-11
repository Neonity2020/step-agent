// ============================================================
// Skills CLI - Skills 功能入口
// ============================================================

import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"
import { ExtensionManager } from "../extensions"
import { SkillsManager } from "../skills"
import { color, theme } from "../tui/colors"
import { renderMarkdown } from "../tui/markdown"
import { MCPClientManager, loadMCPConfig, COMMON_MCP_SERVERS } from "../mcp"
import { ThemeManager } from "../advanced/themes"
import autoSavePlugin from "../extensions/plugins/auto-save"
import gitPlugin from "../extensions/plugins/git"
import fileSearchPlugin from "../extensions/plugins/file-search"
import statsPlugin from "../extensions/plugins/stats"
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

  // 创建 Skills 管理器
  const skillsManager = new SkillsManager()

  // 加载 Skills
  console.log(color("\n📚 Loading skills...", theme.statusBar))
  await skillsManager.load()
  
  // 加载示例 skills（如果默认目录为空）
  const skills = skillsManager.getAllSkills()
  if (skills.length === 0) {
    await skillsManager.loadExamples()
  }

  // 加载 MCP 服务器
  const mcpManager = new MCPClientManager()
  const mcpConfig = await loadMCPConfig()
  const serversToLoad: MCPServerConfig[] = [
    ...mcpConfig.servers,
    ...COMMON_MCP_SERVERS.filter(s => s.enabled),
  ]

  console.log(color("\n🔌 Initializing MCP servers...", theme.statusBar))
  for (const serverConfig of serversToLoad) {
    if (!serverConfig.enabled) continue
    try {
      await mcpManager.addClient(serverConfig.name, {
        name: "my-agent",
        version: "0.8.0",
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      })
      const stats = mcpManager.getClient(serverConfig.name)?.getStats()
      console.log(
        color(`  ✓ ${serverConfig.name}`, theme.successText) +
        color(` (${stats?.toolsCount ?? 0} tools)`, theme.statusBar)
      )
    } catch (error) {
      console.error(
        color(`  ✗ ${serverConfig.name}: ${error instanceof Error ? error.message : error}`, theme.errorText)
      )
    }
  }

  // 获取 MCP 工具
  const mcpTools = mcpManager.getAllTools()

  // 创建内置工具
  const builtInTools = [
    new ReadTool(),
    new WriteTool(),
    new EditTool(),
    new BashTool(),
  ]

  // 合并所有工具
  const allTools = [...builtInTools, ...mcpTools]

  // 创建会话管理器
  const sessionManager = new SessionManager()
  const session = await sessionManager.createSession()

  // 主题管理器
  const themeManager = new ThemeManager("dark")

  // Skills 统计
  const skillsStats = skillsManager.getStats()

  // 欢迎信息
  printWelcome(skillsStats, mcpTools.length)

  console.log(`${color("Session:", theme.statusBar)} ${color(session.meta.name, theme.statusBarHighlight)}`)
  console.log(color("─".repeat(60), theme.border))
  console.log()

  // 交互循环
  while (true) {
    const userInput = await readLine("❯ ")
    
    if (!userInput.trim()) continue

    // 命令处理
    if (userInput.startsWith("/")) {
      await handleCommand(userInput, skillsManager, mcpManager, themeManager)
      continue
    }

    // 保存用户消息
    await sessionManager.addEntry("user", "user", userInput)

    // 显示用户消息
    console.log()
    console.log(color("👤 You", theme.userPrefix))
    console.log(color("─".repeat(40), theme.border))
    console.log(userInput)

    // 检查匹配的 Skills
    const matchedSkills = skillsManager.recommendSkills(userInput)
    if (matchedSkills.length > 0) {
      console.log(color("\n📚 Active skills:", theme.statusBar))
      for (const skill of matchedSkills) {
        console.log(color(`   • ${skill.meta.name}`, theme.statusBarHighlight))
        console.log(color(`     ${skill.meta.description}`, theme.dim))
      }
    }

    console.log()

    try {
      // 构建消息（包含匹配 skills 的提示）
      const skillPrompt = skillsManager.generateSystemPrompt(matchedSkills)
      const messages = buildMessages(sessionManager.getCurrentPath(), skillPrompt)
      
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
      console.log(renderMarkdown(response.content))

      // 保存响应
      await sessionManager.addEntry("assistant", "assistant", response.content)

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          console.log(color(`\n🔧 Tool: ${call.name}`, theme.toolPrefix))
          
          const tool = allTools.find(t => t.name === call.name)
          if (!tool) {
            console.log(color(`❌ Unknown tool: ${call.name}`, theme.errorText))
            continue
          }

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
          
          const updatedMessages = buildMessages(sessionManager.getCurrentPath(), skillPrompt)
          const followUp = await provider.chat(
            updatedMessages,
            allTools.map(t => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            }))
          )

          await sessionManager.addEntry("assistant", "assistant", followUp.content)
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
function buildMessages(path: any[], skillPrompt: string): any[] {
  const systemPrompt = skillPrompt || `You are a helpful coding assistant with access to tools.

Built-in tools:
- read: Read file contents
- write: Create or overwrite files
- edit: Edit files with precise text replacement
- bash: Execute shell commands

Be concise and practical. Use tools when needed to accomplish tasks.`

  const msgs: any[] = [{ role: "system", content: systemPrompt }]

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
  skillsManager: SkillsManager,
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

    case "skills":
    case "s":
      printSkills(skillsManager)
      break

    case "skill":
      if (args[0]) {
        showSkill(skillsManager, args[0])
      } else {
        printSkills(skillsManager)
      }
      break

    case "skill:enable":
      if (args[0]) {
        const enabled = skillsManager.enable(args[0])
        console.log(color(
          enabled ? `Enabled: ${args[0]}` : `Skill not found: ${args[0]}`,
          enabled ? theme.successText : theme.errorText
        ))
      }
      break

    case "skill:disable":
      if (args[0]) {
        skillsManager.disable(args[0])
        console.log(color(`Disabled: ${args[0]}`, theme.warningText))
      }
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

// 打印技能列表
function printSkills(skillsManager: SkillsManager): void {
  const listings = skillsManager.getSkillListings()
  const stats = skillsManager.getStats()

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
  console.log(color("│", theme.border) + color(" Skills".padEnd(60) + "│", theme.assistantPrefix))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(` Total: ${stats.total}  |  Enabled: ${stats.enabled}  |  Disabled: ${stats.disabled}`.padEnd(60) + "│", theme.statusBar))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))

  if (listings.length === 0) {
    console.log(color("│", theme.border) + color(" No skills loaded. Copy examples to ~/.myagent/skills/".padEnd(60) + "│", theme.statusBar))
  } else {
    for (const skill of listings.slice(0, 10)) {
      const status = skill.enabled ? color("✓", theme.successText) : color("✗", theme.dim)
      const name = skill.name.padEnd(20)
      const desc = (skill.description || "").slice(0, 35)
      console.log(color("│", theme.border) + color(` ${status} ${name} ${desc}`.padEnd(60) + "│", theme.statusBar))
    }
  }

  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 显示单个技能
function showSkill(skillsManager: SkillsManager, name: string): void {
  const skill = skillsManager.getSkill(name)
  if (!skill) {
    console.log(color(`Skill not found: ${name}`, theme.errorText))
    return
  }

  console.log(color(`\n## ${skill.meta.name}`, theme.assistantPrefix))
  console.log(color(`Description: ${skill.meta.description || "N/A"}`, theme.statusBar))
  
  if (skill.meta.tags && skill.meta.tags.length > 0) {
    console.log(color(`Tags: ${skill.meta.tags.join(", ")}`, theme.dim))
  }

  if (skill.trigger) {
    console.log(color("\n### Trigger", theme.statusBarHighlight))
    if (skill.trigger.keywords) {
      console.log(`Keywords: ${skill.trigger.keywords.join(", ")}`)
    }
    if (skill.trigger.patterns) {
      console.log(`Patterns: ${skill.trigger.patterns.join(", ")}`)
    }
  }

  if (skill.steps && skill.steps.length > 0) {
    console.log(color("\n### Steps", theme.statusBarHighlight))
    for (const step of skill.steps) {
      const opt = step.optional ? " (optional)" : ""
      console.log(`  ${step.order}. ${step.description}${opt}`)
    }
  }

  if (skill.usage) {
    console.log(color("\n### Usage", theme.statusBarHighlight))
    console.log(skill.usage)
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
      console.log(
        color("│", theme.border) + 
        color(` ${status} ${server.padEnd(20)} ${s.toolsCount} tools  ${s.resourcesCount} resources`.padEnd(60) + "│", theme.statusBar)
      )
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
${color("│", theme.border)}  ${color("/skills, /s", theme.statusBarHighlight)}      List all skills                             ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/skill <name>", theme.statusBarHighlight)}     Show skill details                          ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/skill:enable <name>", theme.statusBarHighlight)} Enable a skill                            ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/skill:disable <name>", theme.statusBarHighlight)} Disable a skill                          ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/mcp, /servers", theme.statusBarHighlight)} Show MCP server status                      ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/theme <name>", theme.statusBarHighlight)} Change theme                                ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/quit, /q", theme.statusBarHighlight)}       Exit                                        ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
}

// 打印欢迎
function printWelcome(skillsStats: any, mcpToolCount: number): void {
  console.clear()
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent - Skills Mode", theme.assistantPrefix)}                                      ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("✨ Agent Skills (SKILL.md compatible)", theme.statusBarHighlight)}                     ${color("│", theme.border)}
${color("│", theme.border)}  ${color("📚 ${skillsStats.total} skills loaded (${skillsStats.enabled} enabled)", theme.statusBarHighlight)}                        ${color("│", theme.border)}
${color("│", theme.border)}  ${color("🔌 ${mcpToolCount} MCP tools available", theme.statusBarHighlight)}                            ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Skills auto-match based on your message", theme.statusBar)}                        ${color("│", theme.border)}
${color("│", theme.border)}  ${color("Type /help for commands", theme.statusBar)}                                   ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
}

// 运行
main().catch(console.error)
