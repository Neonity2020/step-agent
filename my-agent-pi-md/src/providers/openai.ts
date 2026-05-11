// ============================================================
// OpenAI Provider - OpenAI API 实现
// ============================================================

import type { Message, ToolDefinition } from "../types/index.ts"
import type { Provider, LLMResponse } from "./base.ts"

// OpenAI API 配置
interface OpenAIConfig {
  apiKey: string
  model?: string
  baseUrl?: string
}

// OpenAI API 响应类型
interface OpenAIMessage {
  role: string
  content: string | Array<OpenAIContentBlock> | null
  tool_calls?: Array<{
    id: string
    type: string
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

interface OpenAIFunctionCall {
  name: string
  arguments: Record<string, unknown>
}

type OpenAIContentBlock =
  | { type: "text"; text: string }
  | { type: "function_call"; id: string; name: string; arguments: string }

export class OpenAIProvider implements Provider {
  name = "openai"
  model: string
  private apiKey: string
  private baseUrl: string

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey
    this.model = config.model ?? "gpt-4o"
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1"
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const formattedMessages = this.formatMessages(messages)

    const body: Record<string, unknown> = {
      model: this.model,
      messages: formattedMessages,
    }

    if (tools && tools.length > 0) {
      body.tools = tools.map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }))
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json() as Record<string, unknown>
    return this.parseResponse(data)
  }

  private formatMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map(msg => {
      if (msg.role === "tool") {
        if (!msg.toolCallId) {
          return {
            role: "user" as const,
            content: `[Tool ${msg.toolName ?? "unknown"} result]\n${msg.content}`,
          }
        }

        return {
          role: "tool" as const,
          content: msg.content,
          tool_call_id: msg.toolCallId,
        }
      }

      if (msg.role === "assistant" && msg.toolCalls?.length) {
        return {
          role: msg.role,
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((call) => ({
            id: call.id ?? "",
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.input),
            },
          })),
        }
      }

      return {
        role: msg.role,
        content: msg.content,
      }
    })
  }

  private parseResponse(data: Record<string, unknown>): LLMResponse {
    const choices = data.choices as Array<{ message: Record<string, unknown> }>
    const choice = choices?.[0]
    if (!choice) {
      return { content: "" }
    }
    
    const message = choice.message
    const content = message?.content as string | null
    const toolCalls = message?.tool_calls as Array<{ id?: string; function: { name: string; arguments: string } }> | undefined

    let parsedToolCalls: LLMResponse["toolCalls"] = []

    if (toolCalls) {
      parsedToolCalls = toolCalls.map((tc) => {
        const fn = tc.function
        return {
          id: tc.id,
          name: fn.name,
          input: JSON.parse(fn.arguments),
        }
      })
    }

    return {
      content: content?.trim() ?? "",
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined,
    }
  }
}
