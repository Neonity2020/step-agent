// ============================================================
// Provider Base - Provider 接口定义
// ============================================================

import type { Message, ToolDefinition } from "../types/index.ts"

export interface LLMResponse {
  content: string
  toolCalls?: Array<{
    name: string
    input: Record<string, unknown>
  }>
  thinking?: string
}

export interface Provider {
  name: string
  model: string

  // 发送消息并获取响应
  chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>

  // 可选：流式响应
  stream?(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<LLMResponse>
}

// Provider 创建器类型
export type ProviderCreator = (config: Record<string, unknown>) => Provider

// 聊天选项
export interface ChatOptions {
  maxTokens?: number
  temperature?: number
  tools?: ToolDefinition[]
}