// ============================================================
// Evolution CLI - 带 Skills 自进化的 CLI
// ============================================================

import { existsSync, writeFileSync, readFileSync } from "fs"
import { join } from "path"

// 加载 .env 文件
function loadEnvFile() {
  const envPath = join(process.cwd(), ".env")
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const [key, ...valueParts] = trimmed.split("=")
      if (key && valueParts.length) {
        const value = valueParts.join("=").trim()
        if (!Bun.env[key]) {
          Bun.env[key] = value
        }
      }
    }
  }
}

loadEnvFile()

import { AnthropicProvider, OpenAIProvider, createMiniMaxProvider, createDeepSeekProvider, createZhipuProvider } from "../providers"
import { PROVIDER_CONFIGS, getAvailableProviders, getProvider, setCurrentProviderAndModel } from "../providers"
import {
  selectModelFull,
  selectModelQuick,
  showCurrentModel,
  listModels,
  getCurrentModel,
  setCurrentModel,
  getMaxIterations,
  setMaxIterations,
  resetToDefault,
} from "../providers"
import { ReadTool, WriteTool, EditTool, BashTool, SandboxedBashTool } from "../tools"
import { SessionManager } from "../session/session"
import { ExtensionManager } from "../extensions"
import { SkillsManager } from "../skills"
import { KnowledgeBase } from "../kb"
import { PiMDParser, ProjectAnalyzer } from "../pimd"
import { SoulMDParser } from "../soul"
import { EvolutionManager } from "../skills-evolution"
import { SandboxManager } from "../sandbox"
import { handleSandboxCommand, setSandboxManager } from "./sandbox-cli"
import { color, theme } from "../tui/colors"
import { renderMarkdown } from "../tui/markdown"
import { MCPClientManager, loadMCPConfig, COMMON_MCP_SERVERS } from "../mcp"
import autoSavePlugin from "../extensions/plugins/auto-save"
import gitPlugin from "../extensions/plugins/git"
import fileSearchPlugin from "../extensions/plugins/file-search"
import statsPlugin from "../extensions/plugins/stats"
import type { MCPServerConfig } from "../mcp/server"

async function main() {
  // 获取所有可用的 Provider（自动跳过无效的）
  const availableProviders = getAvailableProviders()

  // 检查是否至少有一个有效的 Provider
  if (availableProviders.length === 0) {
    console.error(`${color("Error: No valid API key found!", theme.errorText)}`)
    console.log(color("\nPlease check your .env file. All API keys appear to be empty or invalid.", theme.dim))
    console.log(color("\nSupported providers:", theme.dim))
    for (const p of PROVIDER_CONFIGS) {
      console.log(color(`  ${p.name}: ${p.apiKeyEnvVar}`, theme.statusBar))
    }
    process.exit(1)
  }

  console.log(color("\nAvailable Providers:", theme.successText))
  for (const p of availableProviders) {
    console.log(color(`  ✓ ${p.name}`, theme.statusBar))
  }

  // 使用第一个可用的 Provider
  const defaultProvider = availableProviders[0]
  console.log(color(`\nUsing: ${defaultProvider.name} (${defaultProvider.defaultModel})`, theme.dim))

  const args = Bun.argv.slice(2)

  // 命令处理
  if (args[0] === "/init") {
    await initProject()
    return
  }

  if (args[0] === "/soul" && args[1] === "init") {
    await initSoul(args[2])
    return
  }

  if (args[0] === "/soul" && args[1] === "list") {
    listSoulPresets()
    return
  }

  // /model 命令
  if (args[0] === "/model") {
    await handleModelCommand(args.slice(1))
    return
  }

  // 进化命令
  if (args[0] === "/evolution" || args[0] === "/evolve") {
    handleEvolutionCommand(args.slice(1))
    return
  }

  if (args[0] === "/skills:review") {
    await reviewSkills()
    return
  }

  // 创建 Provider (使用第一个有效的)
  const currentModel = getCurrentModel()
  let provider: any
  let actualProviderName = defaultProvider.name
  let actualModelName = defaultProvider.defaultModel || "default"

  if (defaultProvider.id === "anthropic") {
    provider = new AnthropicProvider({
      apiKey: Bun.env.ANTHROPIC_API_KEY!,
      model: currentModel.modelId,
    })
    actualModelName = provider.model
  } else if (defaultProvider.id === "openai") {
    provider = new OpenAIProvider({
      apiKey: Bun.env.OPENAI_API_KEY!,
      model: currentModel.modelId,
    })
    actualModelName = provider.model
  } else if (defaultProvider.id === "minimax") {
    provider = createMiniMaxProvider()
    if (provider) {
      // 使用当前选择的模型
      if (currentModel.providerId === "minimax") {
        provider.setModel(currentModel.modelId)
      }
      actualModelName = provider.model
    }
  } else if (defaultProvider.id === "deepseek") {
    provider = createDeepSeekProvider()
    if (provider) {
      if (currentModel.providerId === "deepseek") {
        provider.setModel(currentModel.modelId)
      }
      actualModelName = provider.model
    }
  } else if (defaultProvider.id === "zhipu") {
    provider = createZhipuProvider()
    if (provider) {
      if (currentModel.providerId === "zhipu") {
        provider.setModel(currentModel.modelId)
      }
      actualModelName = provider.model
    }
  } else {
    // 回退到 Anthropic
    provider = new AnthropicProvider({
      apiKey: Bun.env.ANTHROPIC_API_KEY!,
      model: currentModel.modelId,
    })
    actualProviderName = "Anthropic"
    actualModelName = provider.model
  }

  // 更新全局模型上下文
  setCurrentProviderAndModel(actualProviderName, actualModelName)

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

  // 创建进化管理器
  const evolutionManager = new EvolutionManager()
  console.log(color("🧬 Initializing evolution system...", theme.statusBar))

  // 创建项目分析器
  const analyzer = new ProjectAnalyzer(process.cwd())
  const projectAnalysis = await analyzer.analyze()

  // 加载 pi.md
  const piMDFiles = PiMDParser.findPiMD(process.cwd())
  const existingPiMD = piMDFiles.find((f) => f.exists)
  let piMDPrompt = ""
  if (existingPiMD?.content) {
    const parsed = PiMDParser.parse(existingPiMD.content)
    piMDPrompt = PiMDParser.generateSystemPrompt(parsed)
    console.log(color(`📄 Loaded: ${existingPiMD.type}`, theme.successText))
  }

  // 加载 SOUL.md
  const soulMDFiles = SoulMDParser.findSoulMD(process.cwd())
  const existingSoulMD = soulMDFiles.find((f) => f.exists)
  let soulPrompt = ""
  if (existingSoulMD?.content) {
    console.log(color(`\n🎭 Found SOUL.md at: ${existingSoulMD.path}`, theme.dim))
    const parsed = SoulMDParser.parse(existingSoulMD.content)
    soulPrompt = SoulMDParser.generateSystemPrompt(parsed)
    const soulName = parsed.identity?.name || parsed.identity?.title || "Agent"
    console.log(color(`   Loaded identity: ${soulName}`, theme.successText))
    console.log(color(`   System prompt preview: ${soulPrompt.slice(0, 200)}...`, theme.dim))
  } else {
    console.log(color(`\n🎭 No SOUL.md found in ${process.cwd()}`, theme.dim))
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

  // 创建沙箱管理器
  const sandboxManager = new SandboxManager({
    enabled: true,
    defaultPolicy: "balanced",
    workspaceRoot: process.cwd(),
  })
  setSandboxManager(sandboxManager)

  // 创建带沙箱保护的 Bash 工具
  const sandboxedBash = new SandboxedBashTool(sandboxManager)

  // 创建工具
  const mcpTools = mcpManager.getAllTools()
  const builtInTools = [new ReadTool(), new WriteTool(), new EditTool(), sandboxedBash]
  const allTools = [...builtInTools, ...mcpTools]

  // 创建会话管理器
  const sessionManager = new SessionManager()
  const session = await sessionManager.createSession()

  // 启动工作流追踪
  evolutionManager.startWorkflow("main-session")

  // 显示欢迎信息
  printWelcome(existingSoulMD, existingPiMD, projectAnalysis.projectConfig, evolutionManager.getStats(), actualProviderName, actualModelName)

  console.log(`${color("Session:", theme.statusBar)} ${color(session.meta.name, theme.statusBarHighlight)}`)
  console.log(color("─".repeat(60), theme.border))
  console.log()

  // 交互循环
  while (true) {
    const userInput = await readLine("❯ ")

    if (!userInput.trim()) continue

    // 命令处理
    if (userInput.startsWith("/")) {
      await handleCommand(userInput, knowledgeBase, sessionManager, evolutionManager, skillsManager)
      continue
    }

    // 保存用户消息
    await sessionManager.addEntry("user", "user", userInput)

    // 显示用户消息
    console.log()
    console.log(color("👤 You", theme.userPrefix))
    console.log(color("─".repeat(40), theme.border))
    console.log(userInput)

    // 记录到进化系统
    evolutionManager.recordStep(`User: ${userInput.slice(0, 100)}`)

    try {
      // 构建系统提示
      const contextPrompt = knowledgeBase.getContextForNewSession(userInput)
      const matchedSkills = skillsManager.recommendSkills(userInput)
      const skillPrompt = skillsManager.generateSystemPrompt(matchedSkills)

      // 进化提示
      const evolvePrompt = evolutionManager.getConfig().enabled
        ? "\n\n## Evolution Instructions\nWhen you complete a useful workflow, summarize it so it can be saved as a skill."
        : ""

      const currentModelInfo = getCurrentModel()
      const currentProvider = getProvider(currentModelInfo.providerId)
      const currentModelName = currentProvider?.models.find(m => m.id === currentModelInfo.modelId)?.name || currentModelInfo.modelId

      const systemPrompt = `${soulPrompt}

${piMDPrompt}

${contextPrompt}

${skillPrompt}
${evolvePrompt}

## Current Configuration
- Provider: ${currentProvider?.name || actualProviderName}
- Model: ${currentModelName}

## Critical Rules
- ALWAYS run pwd command when asked about current directory
- NEVER answer questions about directories or files without first running verification commands
- NEVER fabricate file operations or directory listings
- Only describe actions that were actually performed
- NEVER say a file was opened/closed unless you actually did it
- If you ran a command, report the actual output
- Never invent paths like /Users/user/blog - report only real paths
- When asked about location/path, ALWAYS execute relevant commands to find out
- When asked about what model or provider you are using, say the current model name shown above

## Tools
- read: Read file contents (returns actual file content)
- write: Create or overwrite files
- edit: Edit files with precise text replacement
- bash: Execute shell commands (returns actual stdout/stderr)

Be ${existingSoulMD?.content ? SoulMDParser.parse(existingSoulMD.content).speakingStyle?.tone?.[0] || "helpful" : "helpful"}.`

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

      // 清理思考标签
      const thinkPattern = /<think>[\s\S]*?<\/think>/gi
      const cleanedContent = response.content.replace(thinkPattern, '').trim()

      console.log(color("\n🤖 Assistant", theme.assistantPrefix))
      console.log(color("─".repeat(40), theme.border))
      console.log(renderMarkdown(cleanedContent))

      await sessionManager.addEntry("assistant", "assistant", cleanedContent)

      // 记录到进化系统
      evolutionManager.recordStep(`Assistant: ${response.content.slice(0, 100)}...`)

      // 处理工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const call of response.toolCalls) {
          console.log(color(`\n🔧 Tool: ${call.name}`, theme.toolPrefix))

          // 记录到进化系统
          evolutionManager.recordToolCall(call.name, call.input, undefined, (call.input.description as string) || undefined)

          const tool = allTools.find((t) => t.name === call.name)
          if (!tool) {
            console.log(color(`  ❌ Tool not found: ${call.name}`, theme.errorText))
            continue
          }

          const result = await tool.execute(call.input, {
            cwd: process.cwd(),
            homeDir: Bun.env.HOME ?? "/tmp",
            env: Bun.env as Record<string, string | undefined>,
          })

          console.log(color(`📄 Result:`, theme.toolText))
          console.log(result.content)

          // 记录到进化系统
          evolutionManager.recordToolCall(call.name, call.input, result.content)

          // 添加工具结果到消息历史
          await sessionManager.addEntry("tool", "tool", result.content, {
            toolName: call.name,
            toolInput: call.input,
            toolResult: result.content,
          })

          // 将工具结果追加到响应内容，让模型可以继续回答
          const toolResultMessage = `\n[Tool ${call.name} result:]\n${result.content}`
          await sessionManager.addEntry("assistant", "assistant", response.content + toolResultMessage)

          // 重新获取消息并再次调用模型，让它根据工具结果继续回答
          const updatedMessages = buildMessages(sessionManager.getCurrentPath(), systemPrompt)
          const followUpResponse = await provider.chat(
            updatedMessages,
            allTools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            }))
          )

          // 清理思考标签
          const cleanedFollowUp = followUpResponse.content.replace(thinkPattern, '').trim()

          console.log(color("\n🤖 Assistant (continued)", theme.assistantPrefix))
          console.log(color("─".repeat(40), theme.border))
          console.log(renderMarkdown(cleanedFollowUp))

          await sessionManager.addEntry("assistant", "assistant", cleanedFollowUp)

          // 如果 follow-up 也有工具调用，继续处理
          if (followUpResponse.toolCalls && followUpResponse.toolCalls.length > 0) {
            for (const call2 of followUpResponse.toolCalls) {
              console.log(color(`\n🔧 Tool: ${call2.name}`, theme.toolPrefix))
              const tool2 = allTools.find((t) => t.name === call2.name)
              if (!tool2) continue
              const result2 = await tool2.execute(call2.input, {
                cwd: process.cwd(),
                homeDir: Bun.env.HOME ?? "/tmp",
                env: Bun.env as Record<string, string | undefined>,
              })
              console.log(color(`📄 Result:`, theme.toolText))
              console.log(result2.content)
              await sessionManager.addEntry("tool", "tool", result2.content, {
                toolName: call2.name,
                toolInput: call2.input,
                toolResult: result2.content,
              })
            }
          }
        }
      }

      // 检查是否生成新技能
      await checkForNewSkills(evolutionManager, skillsManager)

    } catch (error) {
      console.error(color(`\n❌ Error: ${error instanceof Error ? error.message : error}`, theme.errorText))
    }

    console.log()
  }
}

// 检查并提示新技能
async function checkForNewSkills(evolutionManager: EvolutionManager, skillsManager: SkillsManager): Promise<void> {
  const stats = evolutionManager.getStats()

  if (stats.candidatesGenerated > 0) {
    const candidates = evolutionManager.getCandidates().filter((c) => c.status === "candidate")

    if (candidates.length > 0) {
      console.log(color("\n🧬 Evolution Alert!", theme.assistantPrefix))
      console.log(color("─".repeat(40), theme.border))
      console.log(color(`Found ${candidates.length} potential skill(s):`, theme.statusBar))

      for (const c of candidates.slice(0, 3)) {
        console.log(color(`  • ${c.name} (${c.confidence}% confidence)`, theme.statusBarHighlight))
        console.log(color(`    ${c.description.slice(0, 60)}...`, theme.dim))
      }

      console.log()
      console.log(color("  Run /evolution review to review them", theme.dim))
    }
  }
}

// 处理进化命令
function handleEvolutionCommand(args: string[]): void {
  const evolutionManager = new EvolutionManager()
  const cmd = args[0]?.toLowerCase()

  switch (cmd) {
    case "stats":
    case "status":
      printEvolutionStats(evolutionManager)
      break

    case "patterns":
      printPatterns(evolutionManager)
      break

    case "review":
    case "list":
      listCandidates(evolutionManager)
      break

    case "report":
      console.log(evolutionManager.generateReport())
      break

    case "enable":
      evolutionManager.enable()
      console.log(color("✅ Evolution enabled", theme.successText))
      break

    case "disable":
      evolutionManager.disable()
      console.log(color("⏸️  Evolution disabled", theme.warningText))
      break

    default:
      printEvolutionHelp()
  }
}

// 打印进化统计
function printEvolutionStats(evolutionManager: EvolutionManager): void {
  const stats = evolutionManager.getStats()

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
  console.log(color("│", theme.border) + color(" Skills Evolution Stats".padEnd(60) + "│", theme.assistantPrefix))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(` Workflows Detected: ${stats.workflowsDetected}`.padEnd(60) + "│", theme.statusBar))
  console.log(color("│", theme.border) + color(` Candidates Generated: ${stats.candidatesGenerated}`.padEnd(60) + "│", theme.statusBar))
  console.log(color("│", theme.border) + color(` Skills Published: ${stats.skillsPublished}`.padEnd(60) + "│", theme.successText))
  console.log(color("│", theme.border) + color(` Effectiveness: ${stats.totalEffectiveness}%`.padEnd(60) + "│", theme.statusBar))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(" /evolution stats | patterns | review | report".padEnd(60) + "│", theme.dim))
  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 打印模式
function printPatterns(evolutionManager: EvolutionManager): void {
  const patterns = evolutionManager.getPatternStats()

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
  console.log(color("│", theme.border) + color(" Common Workflow Patterns".padEnd(60) + "│", theme.assistantPrefix))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))

  if (patterns.length === 0) {
    console.log(color("│", theme.border) + color(" No patterns detected yet".padEnd(60) + "│", theme.dim))
  } else {
    for (const p of patterns.slice(0, 5)) {
      const line = ` ${p.pattern.slice(0, 40).padEnd(40)} (${p.frequency}x)`
      console.log(color("│", theme.border) + color(line.padEnd(60) + "│", theme.statusBar))
    }
  }

  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 列出候选
function listCandidates(evolutionManager: EvolutionManager): void {
  const candidates = evolutionManager.getCandidates().filter((c) => c.status === "candidate")

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
  console.log(color("│", theme.border) + color(" Skill Candidates".padEnd(60) + "│", theme.assistantPrefix))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))

  if (candidates.length === 0) {
    console.log(color("│", theme.border) + color(" No pending candidates".padEnd(60) + "│", theme.dim))
  } else {
    for (const c of candidates.slice(0, 10)) {
      console.log(color("│", theme.border) + color(` ${c.name}`.padEnd(60) + "│", theme.statusBarHighlight))
      console.log(color("│", theme.border) + color(`   ${c.confidence}% confidence | ${c.category}`.padEnd(60) + "│", theme.statusBar))
      console.log(color("│", theme.border) + color(`   ${c.description.slice(0, 55)}`.padEnd(60) + "│", theme.dim))
    }
  }

  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(" /evolution approve <id> | reject <id>".padEnd(60) + "│", theme.dim))
  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 打印进化帮助
function printEvolutionHelp(): void {
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("Evolution Commands", theme.assistantPrefix)}                                            ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("/evolution stats", theme.statusBarHighlight)}    Show evolution statistics                  ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/evolution patterns", theme.statusBarHighlight)} Show common workflow patterns            ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/evolution review", theme.statusBarHighlight)}   Review pending skill candidates          ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/evolution report", theme.statusBarHighlight)}   Generate evolution report               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/evolution enable", theme.statusBarHighlight)}    Enable auto-evolution                   ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/evolution disable", theme.statusBarHighlight)}   Disable auto-evolution                   ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
}

// 审查技能
async function reviewSkills(): Promise<void> {
  const evolutionManager = new EvolutionManager()
  const candidates = evolutionManager.getCandidates().filter((c) => c.status === "candidate")

  if (candidates.length === 0) {
    console.log(color("\n✅ No pending skills to review!", theme.successText))
    return
  }

  console.log(color("\n📋 Skill Review", theme.assistantPrefix))
  console.log(color("─".repeat(40), theme.border))

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    console.log(color(`\n[${i + 1}] ${c.name}`, theme.statusBarHighlight))
    console.log(`    ${c.description}`)
    console.log(color(`    Confidence: ${c.confidence}% | Category: ${c.category}`, theme.dim))
  }

  console.log(color("\n\nTo approve: /evolution approve <id>", theme.dim))
  console.log(color("To reject: /evolution reject <id>", theme.dim))
}

// 初始化项目
async function initProject(): Promise<void> {
  console.log(color("\n🚀 Initializing project...", theme.assistantPrefix))

  const analyzer = new ProjectAnalyzer(process.cwd())
  const analysis = await analyzer.analyze()

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
  const { listPresets, generatePresetSoulMD, getPreset } = await import("../soul/presets")
  const presets = listPresets()

  if (!presetId) {
    console.log(color("\n📋 Available presets:", theme.header))
    for (const p of presets) {
      console.log(color(`   ${p.id.padEnd(20)} - ${p.name}: ${p.description}`, theme.statusBar))
    }
    return
  }

  const preset = presets.find(
    (p) => p.id === presetId || p.name.toLowerCase() === presetId?.toLowerCase()
  )

  if (!preset) {
    console.log(color(`\n❌ Unknown preset: ${presetId}`, theme.errorText))
    return
  }

  const fullPreset = getPreset(preset.id)
  if (!fullPreset) return

  const content = generatePresetSoulMD(fullPreset)
  const cwd = process.cwd()
  const soulPath = join(cwd, "SOUL.md")

  if (existsSync(soulPath)) {
    console.log(color(`\n⚠️  ${soulPath} already exists`, theme.warningText))
    return
  }

  writeFileSync(soulPath, content, "utf-8")
  console.log(color(`\n✅ Created: ${soulPath}`, theme.successText))
}

// 列出预设
function listSoulPresets(): void {
  console.log(color("\n📋 Available Soul Presets:", theme.header))
  console.log("   professional-mentor - Alex, professional mentor")
  console.log("   creative-partner    - Nova, creative partner")
  console.log("   efficiency-expert   - Swift, efficiency expert")
  console.log("   friendly-assistant  - Buddy, friendly assistant")
  console.log(color("\n   Usage: /soul init <preset-id>", theme.dim))
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
async function handleCommand(
  cmd: string,
  knowledgeBase: KnowledgeBase,
  sessionManager: SessionManager,
  evolutionManager: EvolutionManager,
  skillsManager: SkillsManager
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

    case "soul":
      if (args[0] === "init") {
        await initSoul(args[1])
      } else if (args[0] === "list") {
        listSoulPresets()
      }
      break

    case "model":
      await handleModelCommand(args)
      break

    case "evolution":
    case "evolve":
      handleEvolutionCommand(args)
      break

    case "sandbox":
      handleSandboxCommand(args)
      break

    case "security":
      handleSandboxCommand(args)
      break

    case "kb":
      printKnowledgeBase(knowledgeBase)
      break

    case "skills:review":
      await reviewSkills()
      break

    case "quit":
    case "q":
      // 结束工作流追踪
      await evolutionManager.finishWorkflow()
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
  console.log(color("\n📖 Knowledge Base:", theme.header))
  console.log(`   Total entries: ${stats.totalEntries}`)
  console.log(`   Project: ${stats.byType.project} | Decisions: ${stats.byType.decision}`)
}

// /model 命令处理器
async function handleModelCommand(args: string[]): Promise<void> {
  const subcmd = args[0]?.toLowerCase()

  switch (subcmd) {
    case "list":
    case "ls":
      listModels()
      break

    case "show":
    case "status":
      {
        const current = getCurrentModel()
        const provider = getProvider(current.providerId)
        showCurrentModel(current.providerId, current.modelId, current.maxTokens, current.temperature)
        console.log(color(`   Iterations: ${getMaxIterations()}`, theme.statusBar))
      }
      break

    case "reset":
      resetToDefault()
      console.log(color("\n✅ Model reset to default (Anthropic Claude Sonnet 4)", theme.successText))
      break

    case "quick":
      {
        const selection = await selectModelQuick()
        if (selection) {
          setCurrentModel(selection)
          const provider = getProvider(selection.providerId)
          console.log(color(`\n✅ Model set to ${provider?.name} ${selection.modelId}`, theme.successText))
        }
      }
      break

    default:
      {
        const selection = await selectModelFull()
        if (selection) {
          setCurrentModel(selection)
          const provider = getProvider(selection.providerId)
          console.log(color(`\n✅ Model configuration updated!`, theme.successText))
          console.log(color(`   Provider: ${provider?.name}`, theme.statusBar))
          console.log(color(`   Model: ${selection.modelId}`, theme.statusBar))
          console.log(color(`\n   Restart the agent to apply changes.`, theme.dim))
        } else {
          console.log(color("\n❌ Model selection cancelled", theme.warningText))
        }
      }
  }
}

// 打印帮助
function printHelp(): void {
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("Commands", theme.assistantPrefix)}                                                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("/help, /h", theme.statusBarHighlight)}       Show this help                               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/init", theme.statusBarHighlight)}         Initialize project (pi.md)                  ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/model", theme.statusBarHighlight)}         Select provider/model/iterations            ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/soul init", theme.statusBarHighlight)}      Initialize SOUL.md                          ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/evolution", theme.statusBarHighlight)}      Skills evolution commands                  ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/sandbox", theme.statusBarHighlight)}       Sandbox security commands                  ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/kb", theme.statusBarHighlight)}           Show knowledge base                         ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/quit, /q", theme.statusBarHighlight)}       Exit                                         ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}

${color("Model: ", theme.statusBarHighlight)}Anthropic (Claude), OpenAI (GPT-4), Google (Gemini)
${color("Security: ", theme.statusBarHighlight)}Strict, Balanced, Development, Admin modes

${color("Run /sandbox for security options", theme.dim)}
`)
}

// 打印欢迎
function printWelcome(soulMD: any, piMD: any, projectConfig: any, evoStats: any, providerName: string, modelName: string): void {
  const currentModel = getCurrentModel()
  const provider = getProvider(currentModel.providerId)
  const displayProvider = provider?.name || providerName || "Unknown"
  const displayModel = provider?.models.find(m => m.id === currentModel.modelId)?.name || modelName || "Unknown"

  console.clear()
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent - Skills Evolution", theme.assistantPrefix)}                             ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("🧬 Skills Evolution - Self-improving Agent", theme.statusBarHighlight)}                   ${color("│", theme.border)}
${color("│", theme.border)}  ${color("🎭 SOUL.md - Agent Personality", theme.statusBarHighlight)}                               ${color("│", theme.border)}
${color("│", theme.border)}  ${color("📄 pi.md - Project Context", theme.statusBarHighlight)}                                 ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}`)

  // 显示当前模型
  console.log(color("│", theme.border) + color(` 🤖 Model: ${displayProvider} / ${displayModel}`.padEnd(60) + "│", theme.statusBarHighlight))

  if (soulMD?.exists) {
    console.log(color("│", theme.border) + color(` ✓ SOUL.md loaded`.padEnd(60) + "│", theme.statusBar))
  } else {
    console.log(color("│", theme.border) + color(" ⚠ No SOUL.md (use /soul init)".padEnd(60) + "│", theme.warningText))
  }

  if (piMD?.exists) {
    console.log(color("│", theme.border) + color(` ✓ ${piMD.type} loaded`.padEnd(60) + "│", theme.statusBar))
  } else {
    console.log(color("│", theme.border) + color(" ⚠ No pi.md (use /init)".padEnd(60) + "│", theme.warningText))
  }

  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(` 🧬 Evolution: ${evoStats.workflowsDetected} workflows | ${evoStats.skillsPublished} skills`.padEnd(60) + "│", theme.statusBar))
  console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))
  console.log(color("│", theme.border) + color(" Type /help or /model for commands".padEnd(60) + "│", theme.dim))
  console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
}

// 运行
main().catch(console.error)
