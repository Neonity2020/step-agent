// ============================================================
// Pi.md CLI - Project Context CLI
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
    process.exit(1)
  }

  // 检查命令行参数
  const args = Bun.argv.slice(2)

  // /init 命令
  if (args[0] === "/init") {
    await initProject()
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
  const kbStats = knowledgeBase.getStats()

  // 创建项目分析器
  const analyzer = new ProjectAnalyzer(process.cwd())
  const projectAnalysis = await analyzer.analyze()

  // 查找 pi.md
  const piMDFiles = PiMDParser.findPiMD(process.cwd())
  const existingPiMD = piMDFiles.find(f => f.exists)

  // 加载 pi.md 内容
  let piMDPrompt = ""
  if (existingPiMD?.content) {
    const parsed = PiMDParser.parse(existingPiMD.content)
    piMDPrompt = PiMDParser.generateSystemPrompt(parsed)
    console.log(color(`\n📄 Loaded: ${existingPiMD.type}`, theme.successText))
  } else {
    console.log(color("\n⚠️  No pi.md/AGENTS.md/CLAUDE.md found", theme.warningText))
    console.log(color("   Run /init to create one", theme.dim))
  }

  // 加载 MCP
  const mcpManager = new MCPClientManager()
  const mcpConfig = await loadMCPConfig()
  const serversToLoad: MCPServerConfig[] = [
    ...mcpConfig.servers,
    ...COMMON_MCP_SERVERS.filter(s => s.enabled),
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
  printWelcome(existingPiMD?.type, projectAnalysis.projectConfig)

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
      // 构建消息（包含 pi.md 上下文）
      const contextPrompt = knowledgeBase.getContextForNewSession(userInput)
      const matchedSkills = skillsManager.recommendSkills(userInput)
      const skillPrompt = skillsManager.generateSystemPrompt(matchedSkills)
      
      const systemPrompt = `You are a helpful coding assistant.

${piMDPrompt}

${contextPrompt}

${skillPrompt}

Built-in tools:
- read: Read file contents
- write: Create or overwrite files
- edit: Edit files with precise text replacement
- bash: Execute shell commands

Be concise and practical. Use tools when needed.`

      const messages = buildMessages(sessionManager.getCurrentPath(), systemPrompt)
      
      // 调用 LLM
      const response = await provider.chat(
        messages,
        allTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }))
      )

      console.log(color("\n🤖 Assistant", theme.assistantPrefix))
      console.log(color("─".repeat(40), theme.border))
      console.log(renderMarkdown(response.content))

      await sessionManager.addEntry("assistant", "assistant", response.content)

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          console.log(color(`\n🔧 Tool: ${call.name}`, theme.toolPrefix))
          
          const tool = allTools.find(t => t.name === call.name)
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

// /init 命令
async function initProject(): Promise<void> {
  console.log(color("\n🚀 Initializing project...", theme.assistantPrefix))

  const analyzer = new ProjectAnalyzer(process.cwd())
  const analysis = await analyzer.analyze()

  console.log(color("\n📊 Analyzing project...", theme.statusBar))
  console.log(`   Name: ${analysis.projectConfig?.name || "unknown"}`)
  console.log(`   Language: ${analysis.projectConfig?.language || "unknown"}`)
  console.log(`   Framework: ${analysis.projectConfig?.framework || "none"}`)
  console.log(`   Directories: ${analysis.structure?.directories?.length || 0}`)
  console.log(`   Dependencies: ${analysis.dependencies?.length || 0}`)
  console.log(`   Commands: ${analysis.buildCommands?.length || 0}`)

  // 生成 pi.md
  const template = analyzer.generatePiMDTemplate(analysis)

  // 询问用户
  console.log(color("\n📝 Generated template:", theme.header))

  // 简化：直接写入文件
  const cwd = process.cwd()
  const piMDPath = join(cwd, "pi.md")

  if (existsSync(piMDPath)) {
    console.log(color(`\n⚠️  ${piMDPath} already exists`, theme.warningText))
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

  writeFileSync(piMDPath, template, "utf-8")
  console.log(color(`\n✅ Created: ${piMDPath}`, theme.successText))
  console.log(color("\n📄 You can edit this file to add more context", theme.statusBar))
  console.log(color("   The agent will automatically load it on startup", theme.dim))
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
  knowledgeBase: KnowledgeBase,
  sessionManager: SessionManager
): Promise<void> {
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
${color("│", theme.border)}  ${color("/kb", theme.statusBarHighlight)}           Show knowledge base status                 ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/quit, /q", theme.statusBarHighlight)}       Exit                                        ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}

${color("Pi.md Files:", theme.statusBarHighlight)}
  pi.md, AGENTS.md, CLAUDE.md
  Automatically loaded from project root or parent directories

${color("Commands:", theme.statusBarHighlight)}
  Run ${color("/init", theme.statusBar)} to auto-generate a pi.md file
`)
}

// 打印欢迎
function printWelcome(loadedFile: string | undefined, projectConfig: any): void {
  console.clear()
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent - Pi.md Support", theme.assistantPrefix)}                                 ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("📄 Pi.md / AGENTS.md / CLAUDE.md support", theme.statusBarHighlight)}                         ${color("│", theme.border)}
${color("│", theme.border)}  ${color("🔍 Auto-detect and load project context", theme.statusBarHighlight)}                       ${color("│", theme.border)}
${color("│", theme.border)}  ${color("🤖 AI-powered project analysis", theme.statusBarHighlight)}                                  ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}`)

  if (loadedFile) {
    console.log(color("│", theme.border) + color(` ${color("✓", theme.successText)} Loaded: ${loadedFile}`.padEnd(60) + "│", theme.statusBar))
  } else {
    console.log(color("│", theme.border) + color(" ⚠️ No pi.md found (run /init)".padEnd(60) + "│", theme.warningText))
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
