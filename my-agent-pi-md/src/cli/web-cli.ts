// ============================================================
// Web CLI - Web UI 启动器
// ============================================================

import { WebServer } from "../web/server"
import { color } from "../tui/colors"
import { AnthropicProvider } from "../providers/anthropic"
import { ReadTool, WriteTool, EditTool, BashTool } from "../tools"
import { SessionManager } from "../session/session"
import { ExtensionManager } from "../extensions"
import { SkillsManager } from "../skills"
import { KnowledgeBase } from "../kb"
import { PiMDParser, ProjectAnalyzer } from "../pimd"
import { SoulMDParser } from "../soul"
import { EvolutionManager } from "../skills-evolution"
import { getCurrentModel, selectModelFull, showCurrentModel, listModels } from "../providers"
import { MCPClientManager, loadMCPConfig, COMMON_MCP_SERVERS } from "../mcp"
import autoSavePlugin from "../extensions/plugins/auto-save"
import gitPlugin from "../extensions/plugins/git"
import fileSearchPlugin from "../extensions/plugins/file-search"
import statsPlugin from "../extensions/plugins/stats"
import type { MCPServerConfig } from "../mcp/server"

// Web 服务器实例
let webServer: WebServer | null = null

// 信号处理
function setupSignalHandlers() {
  process.on("SIGINT", () => {
    console.log(color("\n\nShutting down...", "yellow"))
    if (webServer) {
      webServer.stop()
    }
    process.exit(0)
  })

  process.on("SIGTERM", () => {
    if (webServer) {
      webServer.stop()
    }
    process.exit(0)
  })
}

async function main() {
  setupSignalHandlers()

  // 解析命令行参数
  const args = Bun.argv.slice(2)
  const port = parseInt(args.find((a) => a.startsWith("--port="))?.split("=")[1] || "3000", 10)
  const host = args.find((a) => a.startsWith("--host="))?.split("=")[1] || "localhost"
  const theme = (args.find((a) => a.startsWith("--theme="))?.split("=")[1] || "dark") as "dark" | "light"

  // 检查 API Key
  const apiKey = Bun.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.error(`${color("Error: ANTHROPIC_API_KEY not set", "red")}`)
    console.log(color("\nFor Web UI, you can still start the server without an API key.", "dim"))
    console.log(color("But you won't be able to chat without configuring a model.\n", "dim"))
  }

  // 创建 Web 服务器
  webServer = new WebServer({
    port,
    host,
    title: "My Agent",
    theme,
  })

  // 显示启动信息
  console.clear()
  printBanner()

  // 显示当前配置
  const currentModel = getCurrentModel()
  if (currentModel.providerId) {
    showCurrentModel(currentModel.providerId, currentModel.modelId, currentModel.maxTokens, currentModel.temperature)
  }

  // 启动服务器
  webServer.start()

  // 启动后可以交互式配置
  if (args.includes("--interactive") || args.includes("-i")) {
    await interactiveConfig()
  }
}

async function interactiveConfig() {
  console.log(color("\n📋 Interactive Configuration", "cyan"))
  console.log(color("─".repeat(50), "dim"))

  const readLine = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      const rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      rl.question(color(question + " ", "yellow"), (answer: string) => {
        rl.close()
        resolve(answer)
      })
    })
  }

  while (true) {
    console.log(color("\n┌────────────────────────────────────────┐", "cyan"))
    console.log(color("│", "cyan") + color(" Configuration Menu".padEnd(40) + "│", "cyan"))
    console.log(color("├────────────────────────────────────────┤", "cyan"))
    console.log(color("│", "cyan") + color(" 1. Configure Model".padEnd(40) + "│", "white"))
    console.log(color("│", "cyan") + color(" 2. List Available Models".padEnd(40) + "│", "white"))
    console.log(color("│", "cyan") + color(" 3. Show Current Config".padEnd(40) + "│", "white"))
    console.log(color("│", "cyan") + color(" 4. Start Chatting (exit this menu)".padEnd(40) + "│", "white"))
    console.log(color("└────────────────────────────────────────┘", "cyan"))

    const answer = await readLine("\nEnter choice (1-4): ")

    switch (answer) {
      case "1":
        const selection = await selectModelFull()
        if (selection) {
          console.log(color("\n✅ Model configured successfully!", "green"))
        }
        break

      case "2":
        listModels()
        break

      case "3":
        const current = getCurrentModel()
        showCurrentModel(current.providerId, current.modelId, current.maxTokens, current.temperature)
        break

      case "4":
        console.log(color("\n🚀 Open http://localhost:3000 in your browser to start chatting!\n", "green"))
        return

      default:
        console.log(color("Invalid choice", "red"))
    }
  }
}

function printBanner() {
  console.log(color(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗          ║
║   ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝          ║
║   ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗          ║
║   ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║          ║
║   ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║          ║
║   ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝          ║
║                                                           ║
║   Web UI + Skills Evolution + Pi.md + SOUL.md              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`, "cyan"))

  console.log(color("Features:", "yellow"))
  console.log(color("  • 🧬 Skills Evolution - Self-improving agent", "dim"))
  console.log(color("  • 📄 Pi.md - Project context", "dim"))
  console.log(color("  • 🎭 SOUL.md - Agent personality", "dim"))
  console.log(color("  • 💾 Knowledge Base - Persistent memory", "dim"))
  console.log(color("  • 🔌 MCP Support - Model Context Protocol", "dim"))
  console.log()
}

// 运行
main().catch(console.error)
