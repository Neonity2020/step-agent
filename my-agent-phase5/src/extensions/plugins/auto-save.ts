// ============================================================
// Auto Save Extension - 自动保存扩展
// ============================================================
// 
// 这个扩展会在每次工具执行后自动保存会话
// ============================================================

import type { Extension, ExtensionAPI } from "../base.ts"

export default {
  meta: {
    name: "auto-save",
    version: "1.0.0",
    description: "Auto-save session after each tool execution",
  },

  register(api: ExtensionAPI) {
    // 在工具执行后保存会话
    api.on("after_tool", (data) => {
      console.log(`[auto-save] Tool ${data.toolName} completed`)
      // 这里可以添加实际的保存逻辑
      // 目前会话已经在 Agent 中自动保存
    })

    api.log("Auto-save extension loaded")
  },
} satisfies Extension
