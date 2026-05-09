// ============================================================
// MCP - Model Context Protocol 支持
// ============================================================

export { MCPClient, MCPClientManager, type MCPClientOptions, type MCPToolInput } from "./client"
export { 
  MCPServerConfig, 
  loadMCPConfig, 
  saveMCPConfig, 
  COMMON_MCP_SERVERS,
  type MCPConfig 
} from "./server"
export * from "./types"
