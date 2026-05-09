// ============================================================
// Anthropic Provider - Anthropic Claude API 实现
// ============================================================

import type { Message, ToolDefinition } from "../types/index.ts"
import type { Provider, LLMResponse } from "./base.ts"

// Anthropic API 配置
interface AnthropicConfig {
  apiKey: string
  model?: string
  baseUrl?: string
  maxTokens?: number
}

// Anthropic API 响应类型
interface AnthropicMessage {
  id: string
  type: "message"
  role: string
  content: Array<AnthropicContentBlock>
  model: string
  stop_reason: string | null
  stop_sequence: number | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "thinking"; thinking: string }

export class AnthropicProvider implements Provider {
  name = "anthropic"
  model: string
  private apiKey: string
  private baseUrl: string
  private maxTokens: number

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey
    this.model = config.model ?? "claude-sonnet-4-20250514"
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1"
    this.maxTokens = config.maxTokens ?? 8192
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    // 构建请求体
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: this.formatMessages(messages),
    }

    // 添加工具定义
    if (tools && tools.length > 0) {
      body.tools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }))
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    const data = await response.json() as AnthropicMessage
    return this.parseResponse(data)
  }

  private formatMessages(messages: Message[]): Array<Record<string, unknown>> {
    const formatted: Array<Record<string, unknown>> = []

    for (const msg of messages) {
      if (msg.role === "system") {
        // Anthropic 使用单独的 system 字段
        continue
      }

      if (msg.role === "tool") {
        formatted.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId,
              content: msg.content,
            },
          ],
        })
      } else {
        formatted.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    return formatted
  }

  private parseResponse(data: AnthropicMessage): LLMResponse {
    let content = ""
    let thinking: string | undefined
    const toolCalls: Array<{ name: string; input: Record<string, unknown> }> = []

    for (const block of data.content) {
      if (block.type === "text") {
        content += block.text
      } else if (block.type === "tool_use") {
        toolCalls.push({
          name: block.name,
          input: block.input,
        })
      } else if (block.type === "thinking") {
        thinking = block.thinking
      }
    }

    return {
      content: content.trim(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      thinking,
    }
  }
}
