// ============================================================
// Zhipu Provider - 智谱 GLM 模型
// ============================================================

import type { Provider, LLMResponse } from "./base"
import type { Message, ToolDefinition } from "../types/index.ts"
import { getModel } from "./config"

export class ZhipuProvider implements Provider {
  name = "zhipu"
  model = "glm-5.1"
  
  private apiKey: string
  private baseURL = "https://open.bigmodel.cn/api/paas/v4"

  constructor(apiKey: string, model = "glm-5.1") {
    this.apiKey = apiKey
    this.model = model
  }

  async chat(messages: Message[], _tools?: ToolDefinition[]): Promise<LLMResponse> {
    const modelInfo = getModel("zhipu", this.model)
    const maxTokens = modelInfo?.maxOutputTokens || 8192

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Zhipu API error: ${response.status} - ${error}`)
    }

    const data = await response.json() as any
    return {
      content: data.choices?.[0]?.message?.content || "",
    }
  }

  async *stream(messages: Message[], _tools?: ToolDefinition[]): AsyncIterable<LLMResponse> {
    const modelInfo = getModel("zhipu", this.model)
    const maxTokens = modelInfo?.maxOutputTokens || 8192

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: maxTokens,
        stream: true,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Zhipu API error: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (reader === undefined) throw new Error("No response body")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const content = line.slice(6)
          if (content === "[DONE]") return
          try {
            const json = JSON.parse(content)
            const text = json.choices?.[0]?.delta?.content
            if (text) {
              yield { content: text }
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

// 创建 Zhipu Provider
export function createZhipuProvider(): ZhipuProvider | null {
  const apiKey = Bun.env.ZHIPU_API_KEY
  if (apiKey === undefined || apiKey === "") return null

  const defaultModel = "glm-5.1"
  return new ZhipuProvider(apiKey, defaultModel)
}