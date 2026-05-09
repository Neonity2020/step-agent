// ============================================================
// Stats Extension - 统计信息扩展
// ============================================================

import type { Extension, ExtensionAPI } from "../base.ts"

// 统计信息命令
function createStatsCommand(api: ExtensionAPI) {
  return {
    name: "stats",
    description: "显示会话统计信息",
    usage: "/stats",
    execute: () => {
      const config = api.getConfig()
      const settings = api.getSettings()

      console.log(`
╔════════════════════════════════════════════════════════════╗
║                    Session Statistics                      ║
╠════════════════════════════════════════════════════════════╣
║  Extensions loaded: ${String(api.getSettings()["extensionsLoaded"] || 0).padEnd(42)}║
║  Tools registered:  ${String(api.getSettings()["toolsCount"] || 0).padEnd(42)}║
║  Commands registered: ${String(api.getSettings()["commandsCount"] || 0).padEnd(41)}║
║  Max iterations:     ${String(config.maxIterations || 20).padEnd(42)}║
║  Verbose mode:       ${String(config.verbose || false).padEnd(42)}║
╚════════════════════════════════════════════════════════════╝
      `)
    },
  }
}

// 列出所有工具命令
function createListToolsCommand(api: ExtensionAPI) {
  return {
    name: "tools",
    description: "列出所有可用的工具",
    usage: "/tools",
    execute: () => {
      const tools = api.getSettings()["toolsList"] as string[] || []
      const extTools = api.getSettings()["extensionTools"] as string[] || []

      console.log(`
╔════════════════════════════════════════════════════════════╗
║                    Available Tools                        ║
╠════════════════════════════════════════════════════════════╣
      `)

      if (tools.length > 0) {
        console.log("║  Built-in tools:                                           ║")
        for (const tool of tools) {
          console.log(`║    • ${tool.padEnd(53)}║`)
        }
      }

      if (extTools.length > 0) {
        console.log("║  Extension tools:                                         ║")
        for (const tool of extTools) {
          console.log(`║    • ${tool.padEnd(53)}║`)
        }
      }

      console.log("╚════════════════════════════════════════════════════════════╝")
    },
  }
}

// 列出所有命令命令
function createListCommandsCommand(api: ExtensionAPI) {
  return {
    name: "commands",
    description: "列出所有可用的命令",
    usage: "/commands",
    execute: () => {
      const commands = api.getSettings()["commandsList"] as Array<{name: string; desc: string}> || []

      console.log(`
╔════════════════════════════════════════════════════════════╗
║                    Available Commands                    ║
╠════════════════════════════════════════════════════════════╣
      `)

      for (const cmd of commands) {
        console.log(`║  /${cmd.name.padEnd(15)} ${cmd.desc.padEnd(35)}║`)
      }

      console.log("╚════════════════════════════════════════════════════════════╝")
    },
  }
}

// 扩展管理器视图命令
function createExtensionsCommand(api: ExtensionAPI) {
  return {
    name: "extensions",
    description: "列出已加载的扩展",
    usage: "/extensions",
    execute: () => {
      const extensions = api.getSettings()["extensionsList"] as Array<{name: string; version: string}> || []

      console.log(`
╔════════════════════════════════════════════════════════════╗
║                    Loaded Extensions                      ║
╠════════════════════════════════════════════════════════════╣
      `)

      if (extensions.length === 0) {
        console.log("║  No extensions loaded                                      ║")
      } else {
        for (const ext of extensions) {
          console.log(`║  ${ext.name.padEnd(20)} v${ext.version.padEnd(35)}║`)
        }
      }

      console.log("╚════════════════════════════════════════════════════════════╝")
    },
  }
}

// Echo 命令（调试用）
function createEchoCommand(api: ExtensionAPI) {
  return {
    name: "echo",
    description: "回显消息（调试用）",
    usage: "/echo <message>",
    execute: (args: string[]) => {
      console.log(args.join(" "))
    },
  }
}

// 导出扩展
const extension: Extension = {
  meta: {
    name: "stats",
    version: "1.0.0",
    description: "统计信息和调试命令扩展",
    author: "My Agent",
  },

  register(api: ExtensionAPI) {
    api.registerCommand(createStatsCommand(api))
    api.registerCommand(createListToolsCommand(api))
    api.registerCommand(createListCommandsCommand(api))
    api.registerCommand(createExtensionsCommand(api))
    api.registerCommand(createEchoCommand(api))

    api.log("Stats extension loaded")
  },
}

export default extension
