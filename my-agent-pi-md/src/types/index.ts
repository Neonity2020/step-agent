// ============================================================
// Core Types - 共享类型定义
// ============================================================

// 消息角色
export type MessageRole = "user" | "assistant" | "system" | "tool"

// 消息结构
export interface Message {
  role: MessageRole
  content: string
  name?: string           // tool result 时使用
  toolCallId?: string      // tool result 时关联
  toolName?: string        // tool result 时记录工具名
  toolCalls?: ToolCall[]   // assistant 消息中的工具调用
}

// 工具调用 (LLM -> Agent)
export interface ToolCall {
  id?: string
  name: string
  input: Record<string, unknown>
}

// LLM 响应
export interface LLMResponse {
  content: string
  toolCalls?: ToolCall[]
  thinking?: string
}

// 工具定义 (Agent -> LLM)
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

// 工具执行结果
export interface ToolResult {
  content: string
  error?: string
  success: boolean
}

// 执行上下文
export interface ExecutionContext {
  cwd: string
  homeDir: string
  env: Record<string, string | undefined>
}

// Provider 配置
export interface ProviderConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

// Agent 配置
export interface AgentConfig {
  provider: ProviderConfig
  systemPrompt?: string
  maxIterations?: number
}
