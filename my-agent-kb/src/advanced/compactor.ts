// ============================================================
// Context Compactor - 上下文压缩
// ============================================================
// 
// 当对话历史过长时，自动压缩旧消息，保留关键信息
// ============================================================

import type { Message } from "../types/index.ts"

export interface CompactionOptions {
  // 最大消息数（超过此值触发压缩）
  maxMessages?: number
  // 最大 token 数估算
  maxTokens?: number
  // 压缩后保留的消息数
  preserveCount?: number
  // 是否使用 LLM 生成摘要
  useLLMSummary?: boolean
}

export interface CompactionResult {
  original: Message[]
  compressed: Message[]
  summary: string
  removedCount: number
}

// 默认选项
const DEFAULT_OPTIONS: Required<CompactionOptions> = {
  maxMessages: 50,
  maxTokens: 30000,
  preserveCount: 10,
  useLLMSummary: false,
}

// 上下文压缩器
export class ContextCompactor {
  private options: Required<CompactionOptions>

  constructor(options: CompactionOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // 检查是否需要压缩
  needsCompaction(messages: Message[]): boolean {
    if (messages.length > this.options.maxMessages) {
      return true
    }

    // 估算 token 数（简单估算：每 4 个字符约 1 token）
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
    const estimatedTokens = totalChars / 4

    return estimatedTokens > this.options.maxTokens
  }

  // 执行压缩
  async compact(
    messages: Message[],
    options?: { summaryProvider?: (text: string) => Promise<string> }
  ): Promise<CompactionResult> {
    if (messages.length <= this.options.preserveCount) {
      return {
        original: messages,
        compressed: messages,
        summary: "(No compaction needed)",
        removedCount: 0,
      }
    }

    // 保留最新的 N 条消息
    const preserved = messages.slice(-this.options.preserveCount)
    const toCompact = messages.slice(0, -this.options.preserveCount)

    // 生成摘要
    let summary: string
    if (options?.summaryProvider && this.options.useLLMSummary) {
      summary = await options.summaryProvider(toCompact.map(m => m.content).join("\n"))
    } else {
      summary = this.generateSimpleSummary(toCompact)
    }

    // 创建压缩后的消息
    const summaryMessage: Message = {
      role: "system",
      content: `[Previous conversation summary (${toCompact.length} messages summarized):\n${summary}]`,
    }

    const compressed = [summaryMessage, ...preserved]

    return {
      original: messages,
      compressed,
      summary,
      removedCount: toCompact.length,
    }
  }

  // 生成简单摘要（不需要 LLM）
  private generateSimpleSummary(messages: Message[]): string {
    const summaryParts: string[] = []

    // 统计各类消息
    const userMessages = messages.filter(m => m.role === "user")
    const assistantMessages = messages.filter(m => m.role === "assistant")
    const toolMessages = messages.filter(m => m.role === "tool")

    // 统计工具使用
    const toolUsage = new Map<string, number>()
    for (const msg of toolMessages) {
      if (msg.toolName) {
        toolUsage.set(msg.toolName, (toolUsage.get(msg.toolName) ?? 0) + 1)
      }
    }

    // 生成摘要
    if (userMessages.length > 0) {
      const lastUser = userMessages[userMessages.length - 1]
      summaryParts.push(`User asked about: "${lastUser.content.slice(0, 100)}${lastUser.content.length > 100 ? "..." : ""}"`)
    }

    if (assistantMessages.length > 0) {
      summaryParts.push(`Assistant responded ${assistantMessages.length} times`)
    }

    if (toolUsage.size > 0) {
      const tools = Array.from(toolUsage.entries())
        .slice(0, 5)
        .map(([name, count]) => `${name}(${count})`)
        .join(", ")
      summaryParts.push(`Tools used: ${tools}`)
    }

    return summaryParts.join("\n") || "(Empty conversation)"
  }

  // 获取压缩建议
  getCompactionAdvice(messages: Message[]): {
    shouldCompact: boolean
    estimatedTokens: number
    messagesToRemove: number
    reason: string
  } {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
    const estimatedTokens = Math.ceil(totalChars / 4)

    const shouldCompact = messages.length > this.options.maxMessages || 
                          estimatedTokens > this.options.maxTokens

    let reason = ""
    let messagesToRemove = 0

    if (messages.length > this.options.maxMessages) {
      messagesToRemove = messages.length - this.options.preserveCount
      reason = `Message count (${messages.length}) exceeds max (${this.options.maxMessages})`
    } else if (estimatedTokens > this.options.maxTokens) {
      messagesToRemove = Math.ceil((estimatedTokens - this.options.maxTokens * 0.7) / 100)
      reason = `Estimated tokens (${estimatedTokens}) exceeds max (${this.options.maxTokens})`
    }

    return {
      shouldCompact,
      estimatedTokens,
      messagesToRemove,
      reason,
    }
  }

  // 设置选项
  setOptions(options: Partial<CompactionOptions>): void {
    this.options = { ...this.options, ...options }
  }

  // 获取最大 token 数
  getMaxTokens(): number {
    return this.options.maxTokens
  }
}

// 主动式压缩器（在接近限制时提前压缩）
export class ProactiveCompactor {
  private compactor: ContextCompactor
  private warningThreshold: number

  constructor(compactor: ContextCompactor, warningThreshold = 0.8) {
    this.compactor = compactor
    this.warningThreshold = warningThreshold
  }

  // 检查是否接近限制
  checkThreshold(messages: Message[]): {
    isNearLimit: boolean
    percentUsed: number
    warning: string | null
  } {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
    const estimatedTokens = totalChars / 4

    const percentUsed = estimatedTokens / this.compactor.getMaxTokens()
    const isNearLimit = percentUsed >= this.warningThreshold

    let warning: string | null = null
    if (isNearLimit) {
      warning = `Context at ${Math.round(percentUsed * 100)}% capacity. Consider starting a new session or compacting.`
    }

    return { isNearLimit, percentUsed, warning }
  }
}
