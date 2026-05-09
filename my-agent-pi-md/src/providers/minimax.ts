// ============================================================
// MiniMax Provider - MiniMax M2.7 模型
// ============================================================

import type { Provider, LLMResponse } from "./base"
import type { Message, ToolDefinition } from "../types/index.ts"
import { getModel } from "./config"

export class MiniMaxProvider implements Provider {
  name = "minimax"
  model = "MiniMax-M2.7"
  
  private apiKey: string
  private baseURL = "https://api.minimax.chat/v1"

  constructor(apiKey: string, model = "MiniMax-M2.7") {
    this.apiKey = apiKey
    this.model = model
  }

  async chat(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const modelInfo = getModel("minimax", this.model)
    const maxTokens = modelInfo?.maxOutputTokens || 8192

    // 构建请求
    const requestBody: any = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: maxTokens,
      stream: false,
    }

    // 添加 tools 支持
    if (tools && tools.length > 0) {
      requestBody.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }))
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MiniMax API error: ${response.status} - ${error}`)
    }

    const data = await response.json() as any
    
    // 处理 tool_calls
    const assistantMessage = data.choices?.[0]?.message
    let toolCalls: LLMResponse["toolCalls"] = undefined
    
    if (assistantMessage?.tool_calls) {
      toolCalls = assistantMessage.tool_calls.map((tc: any) => ({
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments || "{}"),
      }))
    }

    return {
      content: assistantMessage?.content || "",
      toolCalls,
    }
  }

  async *stream(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<LLMResponse> {
    const modelInfo = getModel("minimax", this.model)
    const maxTokens = modelInfo?.maxOutputTokens || 8192

    // 构建请求
    const requestBody: any = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: maxTokens,
      stream: true,
    }

    // 添加 tools 支持
    if (tools && tools.length > 0) {
      requestBody.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }))
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MiniMax API error: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (reader === undefined) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""
    let currentToolCall: any = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const content = line.slice(6)
          if (content === "[DONE]") {
            if (currentToolCall) {
              yield {
                content: "",
                toolCalls: [{
                  name: currentToolCall.name,
                  input: JSON.parse(currentToolCall.arguments || "{}"),
                }],
              }
            }
            return
          }
          try {
            const json = JSON.parse(content)
            const delta = json.choices?.[0]?.delta
            
            if (delta?.content) {
              yield { content: delta.content }
            }
            
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (!currentToolCall) {
                  currentToolCall = { name: tc.function.name, arguments: "" }
                }
                currentToolCall.arguments += tc.function.arguments || ""
              }
            }
          } catch {}
        }
      }
    }
  }

  setModel(model: string): void {
    this.model = model
  }
}

// 创建 MiniMax Provider
export function createMiniMaxProvider(): MiniMaxProvider | null {
  const apiKey = Bun.env.MINIMAX_API_KEY
  if (apiKey === undefined || apiKey === "") return null

  const defaultModel = "MiniMax-M2.7"
  return new MiniMaxProvider(apiKey, defaultModel)
}