// ============================================================
// Tool Base - 工具接口定义
// ============================================================

import type { ExecutionContext, ToolResult, ToolDefinition } from "../types/index.ts"

export interface Tool {
  // 工具元数据
  name: string
  description: string
  inputSchema: Record<string, unknown>

  // 执行逻辑
  execute(
    input: Record<string, unknown>,
    ctx: ExecutionContext
  ): Promise<ToolResult>
}

// 辅助函数：创建工具定义
export function toToolDefinition(tool: Tool): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }
}
