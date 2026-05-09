// ============================================================
// MCP - Model Context Protocol 支持
// ============================================================

export type { MCPToolInput } from "./client"
export { MCPClient, MCPClientManager } from "./client"

export type { MCPServerConfig, MCPConfig } from "./server"
export { loadMCPConfig, saveMCPConfig, COMMON_MCP_SERVERS } from "./server"

export type { 
  MCPServerInfo, 
  MCPTool, 
  MCPToolResult, 
  MCPResource,
  MCPPrompt,
  MCPClientStats,
} from "./types"