// ============================================================
// Knowledge Base CLI - 知识库入口
// ============================================================

import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"
import { ExtensionManager } from "../extensions"
import { SkillsManager } from "../skills"
import { KnowledgeBase } from "../kb"
import { color, theme } from "../tui/colors"
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

  // 显示知识库状态
  const kbStats = knowledgeBase.getStats()
  console.log(color(`\n📖 Knowledge Base: ${kbStats.totalEntries} entries`, theme.statusBar))
  console.log(color(`   Project: ${kbStats.byType.project} | Decisions: ${kbStats.byType.decision} | Patterns: ${kbStats.byType.pattern}`, theme.dim))

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
        version: "0.9.0",
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
      })
    } catch {
      // 忽略错误
    }
  }

  // 创建工具
  const mcpTools = mcpManager.getAllTools()
  const builtInTools = [new ReadTool(), new WriteTool(), new EditTool(), new BashTool()]
  const allTools = [...builtInTools, ...mcpTools]

  // 创建会话管理器
  const sessionManager = new SessionManager()
  const session = await sessionManager.createSession()

  // 欢迎信息
  printWelcome(kbStats, skillsManager.getStats())

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
      // 构建消息（包含知识库上下文）
      const contextPrompt = knowledgeBase.getContextForNewSession(userInput)
      const matchedSkills = skillsManager.recommendSkills(userInput)
      const skillPrompt = skillsManager.generateSystemPrompt(matchedSkills)
      
      const systemPrompt = `You are a helpful coding assistant with access to tools.

${contextPrompt}

${skillPrompt}

Built-in tools:
- read: Read file contents
- write: Create or overwrite files
- edit: Edit files with precise text replacement
- bash: Execute shell commands

Be concise and practical. Use tools when needed to accomplish tasks.

IMPORTANT: When you complete a significant task or make an important decision, summarize it so it can be saved to the knowledge base.`

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
      console.log(response.content)

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

    case "kb":
    case "knowledge":
      printKnowledgeBase(knowledgeBase)
      break

    case "kb:add":
      await kbAdd(knowledgeBase, args)
      break

    case "kb:search":
      kbSearch(knowledgeBase, args.join(" "))
      break

    case "kb:save":
      await kbSaveSession(knowledgeBase, sessionManager, args)
      break

    case "kb:export":
      kbExport(knowledgeBase)
      break

    case "kb:import":
      await kbImport(knowledgeBase)
      break

    case "kb:prune":
      kbPrune(knowledgeBase)
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

// 打印知识库状态
function printKnowledgeBase(kb: KnowledgeBase): void {
  const stats = kb.getStats()

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
  console.log(color("│", theme.border) + color(" Knowledge Base".padEnd(60) + "│", theme.assistantPrefix))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(` Total entries: ${stats.totalEntries}`.padEnd(60) + "│", theme.statusBar))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  
  const types = [
    `Project: ${stats.byType.project}`,
    `Decision: ${stats.byType.decision}`,
    `Pattern: ${stats.byType.pattern}`,
    `Task: ${stats.byType.task}`,
    `Context: ${stats.byType.context}`,
  ]
  
  for (const t of types) {
    console.log(color("│", theme.border) + color(` ${t}`.padEnd(60) + "│", theme.statusBar))
  }
  
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(" Commands: /kb:add, /kb:search, /kb:save, /kb:export".padEnd(60) + "│", theme.dim))
  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 添加知识条目
async function kbAdd(kb: KnowledgeBase, args: string[]): Promise<void> {
  if (args.length < 2) {
    console.log(color("Usage: /kb:add <type> <title>", theme.errorText))
    console.log(color("Types: project, decision, pattern, task, context, note, rule", theme.dim))
    return
  }

  const [type, ...titleParts] = args
  const title = titleParts.join(" ")

  console.log(color("\nEnter content (Ctrl+D to finish):", theme.statusBar))
  
  const lines: string[] = []
  
  // 简化：直接保存
  const entry = kb.add({
    type: type as any,
    title,
    content: "Content saved via CLI",
    tags: [],
    importance: 50,
  })

  console.log(color(`\n✅ Added: ${entry.id}`, theme.successText))
}

// 搜索知识库
function kbSearch(kb: KnowledgeBase, query: string): void {
  if (!query) {
    console.log(color("Usage: /kb:search <query>", theme.errorText))
    return
  }

  const results = kb.search(query)

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
  console.log(color("│", theme.border) + color(` Search: "${query}"`.padEnd(60) + "│", theme.assistantPrefix))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))

  if (results.length === 0) {
    console.log(color("│", theme.border) + color(" No results".padEnd(60) + "│", theme.statusBar))
  } else {
    for (const r of results.slice(0, 10)) {
      const title = r.entry.title.slice(0, 30).padEnd(30)
      const score = `${r.score.toFixed(0)}%`
      console.log(color("│", theme.border) + color(` [${score}] ${title}`.padEnd(60) + "│", theme.statusBar))
    }
  }

  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 保存当前会话
async function kbSaveSession(kb: KnowledgeBase, sessionManager: SessionManager, args: string[]): Promise<void> {
  const topic = args.join(" ") || "Untitled Session"
  
  const session = sessionManager.getCurrentSession()
  if (!session) {
    console.log(color("No active session", theme.errorText))
    return
  }

  const entries = session.entries.filter(e => e.type === "user" || e.type === "assistant")
  const keyPoints = entries.slice(-10).map(e => 
    e.type === "user" ? `User asked: ${e.content.slice(0, 100)}...` : `Assistant responded`
  )

  kb.saveSessionSummary({
    sessionId: session.meta.id,
    topic,
    keyPoints,
    completed: true,
  })

  console.log(color(`\n✅ Session saved as: ${topic}`, theme.successText))
}

// 导出知识库
function kbExport(kb: KnowledgeBase): void {
  const export_ = kb.export()
  console.log(color("\n📄 Knowledge Base Export:", theme.header))
  console.log(export_.slice(0, 1000) + (export_.length > 1000 ? "\n..." : ""))
}

// 导入知识库
async function kbImport(kb: KnowledgeBase): Promise<void> {
  console.log(color("Paste JSON to import (Ctrl+D to finish):", theme.statusBar))
  console.log(color("(Not implemented in this version - use kb:export)", theme.dim))
}

// 清理低优先级条目
function kbPrune(kb: KnowledgeBase): void {
  const count = kb.pruneLowPriority()
  console.log(color(`\n🧹 Pruned ${count} low priority entries`, theme.successText))
}

// 打印帮助
function printHelp(): void {
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("Commands", theme.assistantPrefix)}                                                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("/help, /h", theme.statusBarHighlight)}       Show this help                               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/kb", theme.statusBarHighlight)}           Show knowledge base status                   ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/kb:add <type> <title>", theme.statusBarHighlight)} Add entry to knowledge base              ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/kb:search <query>", theme.statusBarHighlight)} Search knowledge base                   ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/kb:save [topic]", theme.statusBarHighlight)} Save current session to KB             ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/kb:export", theme.statusBarHighlight)}    Export knowledge base                     ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/kb:prune", theme.statusBarHighlight)}     Remove low priority entries               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/quit, /q", theme.statusBarHighlight)}       Exit                                        ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}

${color("Knowledge Types:", theme.statusBarHighlight)}
  project   - Project structure and config
  decision  - Architecture decisions
  pattern   - Code patterns/templates
  task      - Task summaries
  context   - Session summaries
  note      - General notes
  rule      - Rules/conventions
`)
}

// 打印欢迎
function printWelcome(kbStats: any, skillsStats: any): void {
  console.clear()
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent - Knowledge Base Mode", theme.assistantPrefix)}                          ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("📖 External Knowledge Base", theme.statusBarHighlight)}                                 ${color("│", theme.border)}
${color("│", theme.border)}  ${color("💾 Persistent context across sessions", theme.statusBarHighlight)}                       ${color("│", theme.border)}
${color("│", theme.border)}  ${color("🧠 Smart context loading", theme.statusBarHighlight)}                                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color(`Knowledge: ${kbStats.totalEntries} entries`, theme.statusBar)}                       ${color("│", theme.border)}
${color("│", theme.border)}  ${color(`Skills: ${skillsStats.total} loaded`, theme.statusBar)}                               ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Type /help for commands", theme.statusBar)}                                   ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
}

// 运行
main().catch(console.error)
