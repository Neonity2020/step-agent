// ============================================================
// Soul CLI - Agent with SOUL.md Personality
// ============================================================

import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"
import { ExtensionManager } from "../extensions"
import { SkillsManager } from "../skills"
import { KnowledgeBase } from "../kb"
import { PiMDParser, ProjectAnalyzer } from "../pimd"
import { SoulMDParser, listPresets, generatePresetSoulMD } from "../soul"
import { color, theme } from "../tui/colors"
import { MCPClientManager, loadMCPConfig, COMMON_MCP_SERVERS } from "../mcp"
import autoSavePlugin from "../extensions/plugins/auto-save"
import gitPlugin from "../extensions/plugins/git"
import fileSearchPlugin from "../extensions/plugins/file-search"
import statsPlugin from "../extensions/plugins/stats"
import type { MCPServerConfig } from "../mcp/server"

async function main() {
  const apiKey = Bun.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error(`${color("Error: ANTHROPIC_API_KEY not set", theme.errorText)}`)
    process.exit(1)
  }

  const args = Bun.argv.slice(2)

  // /init 命令
  if (args[0] === "/init") {
    await initProject()
    return
  }

  // /soul 命令
  if (args[0] === "/soul" && args[1] === "init") {
    await initSoul(args[2])
    return
  }

  // /soul list 命令
  if (args[0] === "/soul" && args[1] === "list") {
    listSoulPresets()
    return
  }

  // 创建 Provider
  const provider = new AnthropicProvider({
    apiKey,
    model: "claude-sonnet-4-20250514",
  })

  // 创建扩展管理器
  const extManager = new ExtensionManager()
  await extManager.load({
    plugins: [autoSavePlugin, gitPlugin, fileSearchPlugin, statsPlugin],
  })

  // 创建 Skills 管理器
  const skillsManager = new SkillsManager()
  console.log(color("\n📚 Loading skills...", theme.statusBar))
  await skillsManager.load()

  // 创建知识库
  const knowledgeBase = new KnowledgeBase()

  // 创建项目分析器
  const analyzer = new ProjectAnalyzer(process.cwd())
  const projectAnalysis = await analyzer.analyze()

  // 查找 pi.md
  const piMDFiles = PiMDParser.findPiMD(process.cwd())
  const existingPiMD = piMDFiles.find((f) => f.exists)

  // 加载 pi.md
  let piMDPrompt = ""
  if (existingPiMD?.content) {
    const parsed = PiMDParser.parse(existingPiMD.content)
    piMDPrompt = PiMDParser.generateSystemPrompt(parsed)
    console.log(color(`\n📄 Loaded: ${existingPiMD.type}`, theme.successText))
  }

  // 查找 SOUL.md
  const soulMDFiles = SoulMDParser.findSoulMD(process.cwd())
  const existingSoulMD = soulMDFiles.find((f) => f.exists)

  // 加载 SOUL.md
  let soulPrompt = ""
  if (existingSoulMD?.content) {
    const parsed = SoulMDParser.parse(existingSoulMD.content)
    soulPrompt = SoulMDParser.generateSystemPrompt(parsed)
    const soulName = parsed.identity?.name || "Agent"
    console.log(color(`\n🎭 Loaded: ${soulName}'s soul (SOUL.md)`, theme.successText))
  } else {
    console.log(color("\n⚠️  No SOUL.md found (use /soul init <preset> to create)", theme.warningText))
  }

  // 加载 MCP
  const mcpManager = new MCPClientManager()
  const mcpConfig = await loadMCPConfig()
  const serversToLoad: MCPServerConfig[] = [
    ...mcpConfig.servers,
    ...COMMON_MCP_SERVERS.filter((s) => s.enabled),
  ]

  for (const serverConfig of serversToLoad) {
    if (!serverConfig.enabled) continue
    try {
      await mcpManager.addClient(serverConfig.name, {
        name: "my-agent",
        version: "1.0.0",
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      })
    } catch {}
  }

  // 创建工具
  const mcpTools = mcpManager.getAllTools()
  const builtInTools = [new ReadTool(), new WriteTool(), new EditTool(), new BashTool()]
  const allTools = [...builtInTools, ...mcpTools]

  // 创建会话管理器
  const sessionManager = new SessionManager()
  const session = await sessionManager.createSession()

  // 欢迎信息
  printWelcome(existingSoulMD, existingPiMD, projectAnalysis.projectConfig)

  console.log(`${color("Session:", theme.statusBar)} ${color(session.meta.name, theme.statusBarHighlight)}`)
  console.log(color("─".repeat(60), theme.border))
  console.log()

  // 交互循环
  while (true) {
    const userInput = await readLine("❯ ")

    if (!userInput.trim()) continue

    // 命令处理
    if (userInput.startsWith("/")) {
      await handleCommand(userInput, knowledgeBase, sessionManager)
      continue
    }

    // 保存用户消息
    await sessionManager.addEntry("user", "user", userInput)

    // 显示用户消息
    console.log()
    console.log(color("👤 You", theme.userPrefix))
    console.log(color("─".repeat(40), theme.border))
    console.log(userInput)

    try {
      // 构建系统提示
      const contextPrompt = knowledgeBase.getContextForNewSession(userInput)
      const matchedSkills = skillsManager.recommendSkills(userInput)
      const skillPrompt = skillsManager.generateSystemPrompt(matchedSkills)

      const systemPrompt = `${soulPrompt}

${piMDPrompt}

${contextPrompt}

${skillPrompt}

Built-in tools:
- read: Read file contents
- write: Create or overwrite files
- edit: Edit files with precise text replacement
- bash: Execute shell commands

Be ${existingSoulMD?.content ? SoulMDParser.parse(existingSoulMD.content).speakingStyle?.tone?.[0] || "helpful" : "helpful"} and practical.`

      const messages = buildMessages(sessionManager.getCurrentPath(), systemPrompt)

      // 调用 LLM
      const response = await provider.chat(
        messages,
        allTools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }))
      )

      console.log(color("\n🤖 Assistant", theme.assistantPrefix))
      console.log(color("─".repeat(40), theme.border))
      console.log(response.content)

      await sessionManager.addEntry("assistant", "assistant", response.content)

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          console.log(color(`\n🔧 Tool: ${call.name}`, theme.toolPrefix))

          const tool = allTools.find((t) => t.name === call.name)
          if (!tool) continue

          const result = await tool.execute(call.input, {
            cwd: process.cwd(),
            homeDir: Bun.env.HOME ?? "/tmp",
            env: Bun.env as Record<string, string | undefined>,
          })

          console.log(color(`📄 Result:`, theme.toolText))
          console.log(result.content.slice(0, 500))

          await sessionManager.addEntry("tool", "tool", result.content, {
            toolName: call.name,
            toolInput: call.input,
            toolResult: result.content,
          })
        }
      }
    } catch (error) {
      console.error(color(`\n❌ Error: ${error instanceof Error ? error.message : error}`, theme.errorText))
    }

    console.log()
  }
}

// 初始化项目
async function initProject(): Promise<void> {
  console.log(color("\n🚀 Initializing project...", theme.assistantPrefix))

  const analyzer = new ProjectAnalyzer(process.cwd())
  const analysis = await analyzer.analyze()

  console.log(color("\n📊 Analyzing project...", theme.statusBar))
  console.log(`   Name: ${analysis.projectConfig?.name || "unknown"}`)
  console.log(`   Language: ${analysis.projectConfig?.language || "unknown"}`)

  const template = analyzer.generatePiMDTemplate(analysis)
  const cwd = process.cwd()
  const piMDPath = join(cwd, "pi.md")

  if (existsSync(piMDPath)) {
    console.log(color(`\n⚠️  ${piMDPath} already exists`, theme.warningText))
    return
  }

  writeFileSync(piMDPath, template, "utf-8")
  console.log(color(`\n✅ Created: ${piMDPath}`, theme.successText))
}

// 初始化 SOUL.md
async function initSoul(presetId?: string): Promise<void> {
  console.log(color("\n🎭 Initializing SOUL.md...", theme.assistantPrefix))

  const presets = listPresets()

  if (!presetId) {
    console.log(color("\n📋 Available presets:", theme.header))
    for (const p of presets) {
      console.log(color(`   ${p.id.padEnd(20)} - ${p.name}: ${p.description}`, theme.statusBar))
    }
    console.log(color("\nUsage: /soul init <preset-id>", theme.dim))
    console.log(color("Example: /soul init creative-partner", theme.dim))
    return
  }

  const preset = presets.find((p) => p.id === presetId || p.name.toLowerCase() === presetId?.toLowerCase())

  if (!preset) {
    console.log(color(`\n❌ Unknown preset: ${presetId}`, theme.errorText))
    console.log(color("Run /soul list to see available presets", theme.dim))
    return
  }

  const fullPreset = await import("../soul/presets").then((m) => m.getPreset(preset.id))
  if (!fullPreset) return

  const content = generatePresetSoulMD(fullPreset)
  const cwd = process.cwd()
  const soulPath = join(cwd, "SOUL.md")

  if (existsSync(soulPath)) {
    console.log(color(`\n⚠️  ${soulPath} already exists`, theme.warningText))
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const answer = await new Promise<string>((resolve) => {
      rl.question(color("   Overwrite? (y/N): ", theme.warningText), resolve)
      rl.close()
    })

    if (answer.toLowerCase() !== "y") {
      console.log(color("\nCancelled.", theme.dim))
      return
    }
  }

  writeFileSync(soulPath, content, "utf-8")
  console.log(color(`\n✅ Created: ${soulPath}`, theme.successText))
  console.log(color(`\n🎭 Personality: ${preset.name}`, theme.statusBarHighlight))
  console.log(color("   " + preset.description, theme.statusBar))
}

// 列出预设
function listSoulPresets(): void {
  const presets = listPresets()

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
  console.log(color("│", theme.border) + color(" Available Soul Presets".padEnd(60) + "│", theme.assistantPrefix))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))

  for (const p of presets) {
    const line = ` ${p.id.padEnd(18)} ${p.description}`.slice(0, 58)
    console.log(color("│", theme.border) + color(line.padEnd(60) + "│", theme.statusBar))
  }

  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(" Usage: /soul init <preset-id>".padEnd(60) + "│", theme.dim))
  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
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
function buildMessages(path: any[], systemPrompt: string): any[] {
  const msgs: any[] = [{ role: "system", content: systemPrompt }]

  for (const entry of path) {
    if (entry.type === "user") {
      msgs.push({ role: "user", content: entry.content })
    } else if (entry.type === "assistant") {
      msgs.push({ role: "assistant", content: entry.content })
    } else if (entry.type === "tool") {
      msgs.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: entry.id,
            content: entry.toolResult ?? entry.content,
          },
        ],
      })
    }
  }

  return msgs
}

// 处理命令
async function handleCommand(cmd: string, knowledgeBase: KnowledgeBase, sessionManager: SessionManager): Promise<void> {
  const parts = cmd.slice(1).split(/\s+/)
  const command = parts[0].toLowerCase()
  const args = parts.slice(1)

  switch (command) {
    case "help":
    case "h":
      printHelp()
      break

    case "init":
      await initProject()
      break

    case "soul":
      if (args[0] === "init") {
        await initSoul(args[1])
      } else if (args[0] === "list") {
        listSoulPresets()
      } else {
        console.log(color("Usage: /soul init <preset> | /soul list", theme.dim))
      }
      break

    case "kb":
      printKnowledgeBase(knowledgeBase)
      break

    case "quit":
    case "q":
      console.log("\nGoodbye!")
      process.exit(0)
      break

    default:
      console.log(color(`Unknown command: ${command}`, theme.errorText))
      console.log(color("Type /help for available commands", theme.dim))
  }
}

// 打印知识库状态
function printKnowledgeBase(kb: KnowledgeBase): void {
  const stats = kb.getStats()
  console.log(color("\n📖 Knowledge Base:", theme.header))
  console.log(`   Total entries: ${stats.totalEntries}`)
  console.log(`   Project: ${stats.byType.project} | Decisions: ${stats.byType.decision}`)
}

// 打印帮助
function printHelp(): void {
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("Commands", theme.assistantPrefix)}                                                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("/help, /h", theme.statusBarHighlight)}       Show this help                               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/init", theme.statusBarHighlight)}         Initialize project (create pi.md)             ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/soul init", theme.statusBarHighlight)}    Initialize SOUL.md (agent personality)       ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/soul list", theme.statusBarHighlight)}     List available soul presets               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/kb", theme.statusBarHighlight)}           Show knowledge base status                 ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/quit, /q", theme.statusBarHighlight)}       Exit                                        ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}

${color("Files:", theme.statusBarHighlight)}
  pi.md / AGENTS.md / CLAUDE.md  - Project context
  SOUL.md                        - Agent personality
`)
}

// 打印欢迎
function printWelcome(soulMD: any, piMD: any, projectConfig: any): void {
  console.clear()
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent - SOUL.md + Pi.md", theme.assistantPrefix)}                                 ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("🎭 SOUL.md - Agent Personality", theme.statusBarHighlight)}                             ${color("│", theme.border)}
${color("│", theme.border)}  ${color("📄 pi.md - Project Context", theme.statusBarHighlight)}                                    ${color("│", theme.border)}
${color("│", theme.border)}  ${color("💾 Knowledge Base", theme.statusBarHighlight)}                                           ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}`)

  if (soulMD?.exists) {
    console.log(color("│", theme.border) + color(` ${color("✓", theme.successText)} SOUL.md loaded`.padEnd(60) + "│", theme.statusBar))
  } else {
    console.log(color("│", theme.border) + color(" ⚠️ No SOUL.md (run /soul init)".padEnd(60) + "│", theme.warningText))
  }

  if (piMD?.exists) {
    console.log(color("│", theme.border) + color(` ${color("✓", theme.successText)} ${piMD.type} loaded`.padEnd(60) + "│", theme.statusBar))
  } else {
    console.log(color("│", theme.border) + color(" ⚠️ No pi.md (run /init)".padEnd(60) + "│", theme.warningText))
  }

  if (projectConfig?.name) {
    console.log(color("│", theme.border) + color(` Project: ${projectConfig.name}`.padEnd(60) + "│", theme.statusBar))
  }

  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(" Type /help for commands".padEnd(60) + "│", theme.dim))
  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 运行
main().catch(console.error)
