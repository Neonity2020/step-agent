// ============================================================
// MCP Types - Model Context Protocol 类型定义
// ============================================================

export interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: "object"
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export interface MCPToolResult {
  content: Array<{
    type: "text" | "image" | "resource"
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface MCPServerInfo {
  name: string
  version: string
  capabilities?: {
    tools?: Record<string, unknown>
    resources?: Record<string, unknown>
    prompts?: Record<string, unknown>
  }
}

export interface MCPClientStats {
  toolsCount: number
  resourcesCount: number
  promptsCount: number
  connected: boolean
}
