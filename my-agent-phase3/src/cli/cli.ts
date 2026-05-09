// ============================================================
// CLI Entry - 基础命令行入口
// ============================================================

import { Agent } from "../agent/agent"
import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"

// 颜色输出
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
}

function printWelcome() {
  console.log(`
${colors.cyan}${colors.bright}
╔════════════════════════════════════════════╗
║     My Agent Phase 3 - Session CLI        ║
╚════════════════════════════════════════════╝
${colors.reset}
`)
}

function printUsage() {
  console.log(`
${colors.dim}Usage:${colors.reset}
  ${colors.green}bun run ./src/cli/cli.ts <message>${colors.reset}    Send a single message
  ${colors.green}bun run ./src/cli/cli.ts${colors.reset}              Interactive mode

${colors.dim}Examples:${colors.reset}
  ${colors.yellow}bun run ./src/cli/cli.ts "Hello, how are you?"${colors.reset}
  ${colors.yellow}bun run ./src/cli/cli.ts "List files in current directory"${colors.reset}

${colors.dim}For full session management, use:${colors.reset}
  ${colors.green}bun run ./src/cli/session-cli.ts${colors.reset}
`)
}

async function main() {
  printWelcome()

  // 检查 API Key
  const apiKey = Bun.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.error(`${colors.red}Error: ANTHROPIC_API_KEY not set${colors.reset}`)
    console.error(`\nPlease set your API key:`)
    console.error(`  ${colors.green}export ANTHROPIC_API_KEY=sk-ant-...${colors.reset}\n`)
    printUsage()
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
  const session = await sessionManager.createSession()
  console.log(`${colors.dim}Session: ${session.meta.name}${colors.reset}\n`)

  // 设置 Agent 的会话
  agent.setSessionManager(sessionManager, session)

  // 检查命令行参数
  const args = Bun.argv.slice(2)

  if (args.length > 0) {
    // 单次命令模式
    const message = args.join(" ")
    console.log(`${colors.cyan}You:${colors.reset} ${message}\n`)

    try {
      const response = await agent.run(message)
      console.log(`${colors.green}Agent:${colors.reset} ${response}`)
    } catch (error) {
      console.error(`${colors.red}Error:${colors.reset}`, error)
      process.exit(1)
    }
  } else {
    // 交互模式
    console.log(`${colors.dim}Interactive mode - Type your message and press Enter${colors.reset}`)
    console.log(`${colors.dim}Press Ctrl+C to exit${colors.reset}\n`)

    // 简单的交互循环
    for await (const line of console) {
      const message = line.trim()
      if (!message) continue

      console.log(`\n${colors.cyan}You:${colors.reset} ${message}\n`)

      try {
        const response = await agent.run(message)
        console.log(`${colors.green}Agent:${colors.reset} ${response}\n`)
      } catch (error) {
        console.error(`${colors.red}Error:${colors.reset}`, error)
      }
    }
  }
}

// 运行
main().catch(console.error)
