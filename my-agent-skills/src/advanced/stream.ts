// ============================================================
// Stream Handler - 流式输出处理
// ============================================================
// 
// 处理 LLM 流式响应，支持：
// - 文本块
// - 工具调用块
// - 思考块 (Anthropic)
// ============================================================

import type { Message, ToolCall } from "../types/index.ts"

export interface StreamChunk {
  type: "text" | "tool_call" | "thinking" | "done" | "error"
  content: string
  toolCall?: ToolCall
}

export interface StreamHandler {
  // 开始处理流
  start(): void

  // 处理文本块
  text(text: string): void

  // 处理工具调用
  toolCall(call: ToolCall): void

  // 处理思考块
  onThinking(callback: (text: string) => void): void

  // 完成处理
  done(): void

  // 处理错误
  error(err: Error): void

  // 获取累积结果
  getResult(): StreamingResult
}

export interface StreamingResult {
  content: string
  toolCalls: ToolCall[]
  thinking?: string
  hasThinking: boolean
}

// 流式处理器实现
export class DefaultStreamHandler implements StreamHandler {
  private content: string = ""
  private toolCalls: ToolCall[] = []
  private thinkingContent: string = ""
  private hasThinking: boolean = false
  private onText?: (text: string) => void
  private onToolCall?: (call: ToolCall) => void
  private thinkingCallback?: (text: string) => void
  private onDone?: () => void

  constructor(options?: {
    onText?: (text: string) => void
    onToolCall?: (call: ToolCall) => void
    onThinking?: (text: string) => void
    onDone?: () => void
  }) {
    this.onText = options?.onText
    this.onToolCall = options?.onToolCall
    this.thinkingCallback = options?.onThinking
    this.onDone = options?.onDone
  }

  start(): void {
    this.content = ""
    this.toolCalls = []
    this.thinkingContent = ""
    this.hasThinking = false
  }

  text(text: string): void {
    this.content += text
    this.onText?.(text)
  }

  toolCall(call: ToolCall): void {
    this.toolCalls.push(call)
    this.onToolCall?.(call)
  }

  onThinking(callback: (text: string) => void): void {
    this.thinkingCallback = callback
  }

  done(): void {
    this.onDone?.()
  }

  error(err: Error): void {
    console.error("Stream error:", err)
  }

  getResult(): StreamingResult {
    return {
      content: this.content,
      toolCalls: this.toolCalls,
      thinking: this.thinkingContent || undefined,
      hasThinking: this.hasThinking,
    }
  }
}

// Anthropic SSE 解析器
export class AnthropicSSEParser {
  private buffer: string = ""

  // 解析 SSE 行
  parseLine(line: string): StreamChunk | null {
    // 跳过空行和注释
    if (!line || line.startsWith(":")) {
      return null
    }

    // 解析事件行
    if (line.startsWith("event:")) {
      const event = line.slice(6).trim()
      return { type: this.eventToType(event), content: "" } as StreamChunk
    }

    // 解析数据行
    if (line.startsWith("data:")) {
      const data = line.slice(5).trim()
      return this.parseData(data)
    }

    return null
  }

  // 解析数据
  private parseData(data: string): StreamChunk | null {
    try {
      const json = JSON.parse(data)

      // text delta
      if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
        return { type: "text", content: json.delta.text }
      }

      // tool use
      if (json.type === "content_block_delta" && json.delta?.type === "input_json_delta") {
        return {
          type: "tool_call",
          content: json.delta.partial_json,
          toolCall: this.parseToolCallFragment(json.delta.partial_json),
        }
      }

      // thinking
      if (json.type === "content_block_delta" && json.delta?.type === "thinking_delta") {
        return { type: "thinking", content: json.delta.thinking }
      }

      // message complete
      if (json.type === "message_stop") {
        return { type: "done", content: "" }
      }

      return null
    } catch {
      return null
    }
  }

  // 事件类型转换
  private eventToType(event: string): StreamChunk["type"] {
    switch (event) {
      case "text":
        return "text"
      case "tool_use":
        return "tool_call"
      case "message_delta":
        return "done"
      default:
        return "text"
    }
  }

  // 解析工具调用片段
  private parseToolCallFragment(partialJson: string): ToolCall | undefined {
    try {
      const match = partialJson.match(/"name"\s*:\s*"([^"]+)"/)
      if (match) {
        return {
          name: match[1],
          input: {},
        }
      }
      return undefined
    } catch {
      return undefined
    }
  }

  // 添加到缓冲区并解析
  addToBuffer(chunk: string): StreamChunk[] {
    this.buffer += chunk
    const chunks: StreamChunk[] = []
    const lines = this.buffer.split("\n")

    // 保留最后一行（可能不完整）
    this.buffer = lines.pop() ?? ""

    for (const line of lines) {
      const parsed = this.parseLine(line)
      if (parsed) {
        chunks.push(parsed)
      }
    }

    return chunks
  }

  // 获取剩余缓冲区
  flush(): StreamChunk[] {
    if (!this.buffer) return []
    const chunks = this.addToBuffer("\n")
    this.buffer = ""
    return chunks
  }
}

// OpenAI SSE 解析器
export class OpenAISSEParser {
  private buffer: string = ""

  parseLine(line: string): { type: string; content: string } | null {
    if (!line || line.startsWith(":")) return null

    if (line.startsWith("data:")) {
      const data = line.slice(5).trim()
      if (data === "[DONE]") {
        return { type: "done", content: "" }
      }

      try {
        const json = JSON.parse(data)
        
        // text delta
        if (json.choices?.[0]?.delta?.content) {
          return {
            type: "text",
            content: json.choices[0].delta.content,
          }
        }

        // tool call
        if (json.choices?.[0]?.delta?.tool_calls?.[0]) {
          const tc = json.choices[0].delta.tool_calls[0]
          return {
            type: "tool_call",
            content: JSON.stringify(tc.function),
          }
        }

        return null
      } catch {
        return null
      }
    }

    return null
  }

  addToBuffer(chunk: string): { type: string; content: string }[] {
    this.buffer += chunk
    const items: { type: string; content: string }[] = []
    const lines = this.buffer.split("\n")
    this.buffer = lines.pop() ?? ""

    for (const line of lines) {
      const parsed = this.parseLine(line)
      if (parsed) {
        items.push(parsed)
      }
    }

    return items
  }

  flush(): { type: string; content: string }[] {
    if (!this.buffer) return []
    const items = this.addToBuffer("\n")
    this.buffer = ""
    return items
  }
}
