// ============================================================
// Anthropic Provider - Anthropic Claude API 实现（支持流式）
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

// 流式事件类型
export interface StreamEvent {
  type: "text" | "thinking" | "tool_call_start" | "tool_call_delta" | "tool_call_end" | "done" | "error"
  content?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  index?: number
}

// 流式回调类型
export type StreamCallback = (event: StreamEvent) => void

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
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: this.formatMessages(messages),
    }
    const system = this.getSystemPrompt(messages)
    if (system) {
      body.system = system
    }

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

  // 流式聊天
  async streamChat(messages: Message[], tools?: ToolDefinition[], onEvent?: StreamCallback): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: this.formatMessages(messages),
      stream: true,
    }
    const system = this.getSystemPrompt(messages)
    if (system) {
      body.system = system
    }

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

    if (!response.body) {
      throw new Error("Response body is null")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let content = ""
    let thinking = ""
    const toolCalls: Array<{ name: string; input: Record<string, unknown>; id: string }> = []
    let currentToolCall: { name: string; input: Record<string, unknown>; id: string; inputJson: string } | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue

          const data = line.slice(6).trim()
          if (!data || data === "[DONE]") continue

          try {
            const json = JSON.parse(data)

            // text delta
            if (json.type === "content_block_delta") {
              if (json.delta?.type === "text_delta") {
                const text = json.delta.text
                content += text
                onEvent?.({ type: "text", content: text })
              } else if (json.delta?.type === "thinking_delta") {
                const text = json.delta.thinking
                thinking += text
                onEvent?.({ type: "thinking", content: text })
              } else if (json.delta?.type === "input_json_delta") {
                // 工具输入增量
                if (currentToolCall) {
                  currentToolCall.inputJson += json.delta.partial_json ?? ""
                  try {
                    currentToolCall.input = JSON.parse(currentToolCall.inputJson)
                  } catch {
                    // 增量更新
                  }
                  onEvent?.({ 
                    type: "tool_call_delta", 
                    content: json.delta.partial_json,
                    toolName: currentToolCall.name,
                  })
                }
              }
            }

            // tool use start
            if (json.type === "content_block_start") {
              if (json.content_block?.type === "tool_use") {
                currentToolCall = {
                  id: json.content_block.id,
                  name: json.content_block.name,
                  input: {},
                  inputJson: "",
                }
                toolCalls.push(currentToolCall)
                onEvent?.({ 
                  type: "tool_call_start", 
                  toolName: currentToolCall.name,
                  index: toolCalls.length - 1,
                })
              }
            }

            if (json.type === "content_block_stop" && currentToolCall) {
              try {
                currentToolCall.input = currentToolCall.inputJson
                  ? JSON.parse(currentToolCall.inputJson)
                  : currentToolCall.input
              } catch {
                currentToolCall.input = {}
              }
              onEvent?.({ type: "tool_call_end", toolName: currentToolCall.name })
              currentToolCall = null
            }

            // message delta
            if (json.type === "message_delta") {
              onEvent?.({ type: "done" })
            }

          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      // 处理缓冲区中剩余的数据
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer.replace(/^data: /, ""))
          if (json.type === "message_stop") {
            onEvent?.({ type: "done" })
          }
        } catch {
          // 忽略
        }
      }

    } finally {
      reader.releaseLock()
    }

    return {
      content: content.trim(),
      toolCalls: toolCalls.map(tc => ({ id: tc.id, name: tc.name, input: tc.input })),
      thinking: thinking || undefined,
    }
  }

  private getSystemPrompt(messages: Message[]): string | undefined {
    const system = messages
      .filter((msg) => msg.role === "system")
      .map((msg) => msg.content)
      .join("\n\n")
      .trim()

    return system || undefined
  }

  private formatMessages(messages: Message[]): Array<Record<string, unknown>> {
    const formatted: Array<Record<string, unknown>> = []

    for (const msg of messages) {
      if (msg.role === "system") {
        continue
      }

      if (msg.role === "tool") {
        if (!msg.toolCallId) {
          formatted.push({
            role: "user",
            content: `[Tool ${msg.toolName ?? "unknown"} result]\n${msg.content}`,
          })
          continue
        }

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
      } else if (msg.role === "assistant" && msg.toolCalls?.length) {
        const content: Array<Record<string, unknown>> = []
        if (msg.content) {
          content.push({ type: "text", text: msg.content })
        }
        for (const call of msg.toolCalls) {
          content.push({
            type: "tool_use",
            id: call.id,
            name: call.name,
            input: call.input,
          })
        }
        formatted.push({
          role: msg.role,
          content,
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
    const toolCalls: Array<{ id?: string; name: string; input: Record<string, unknown> }> = []

    for (const block of data.content) {
      if (block.type === "text") {
        content += block.text
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
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
