// ============================================================
// Agent Core - Agent 核心逻辑（支持流式输出）
// ============================================================

import type { Message, ExecutionContext, ToolCall } from "../types"
import type { Provider } from "../providers/base"
import type { Tool } from "../tools/base"
import type { SessionManager, Session, SessionEntry } from "../session/session"
import type { ExtensionManager } from "../extensions"
import { MessageQueue } from "../advanced/queue"
import { ContextCompactor } from "../advanced/compactor"
import type { StreamEvent } from "../providers/anthropic"

export interface AgentOptions {
  provider: Provider
  tools: Tool[]
  extensions?: ExtensionManager
  systemPrompt?: string
  maxIterations?: number
  verbose?: boolean
  enableCompaction?: boolean
  enableStreaming?: boolean
}

export interface AgentStats {
  iterations: number
  toolCalls: number
  totalTokens: number
  startTime: number
  endTime?: number
}

// 流式回调类型
export type StreamCallback = (event: {
  type: "text" | "thinking" | "tool_start" | "tool_input" | "tool_end" | "done"
  content?: string
  toolName?: string
  toolIndex?: number
}) => void

export class Agent {
  private provider: Provider
  private tools: Map<string, Tool>
  private extensions: ExtensionManager | null = null
  private systemPrompt: string
  private maxIterations: number
  private verbose: boolean
  private sessionManager: SessionManager | null = null
  private session: Session | null = null
  private iterationCount = 0
  
  // 高级功能
  private messageQueue: MessageQueue
  private compactor: ContextCompactor
  private enableCompaction: boolean
  private enableStreaming: boolean
  
  // 统计
  private stats: AgentStats

  constructor(options: AgentOptions) {
    this.provider = options.provider
    this.tools = new Map(options.tools.map(t => [t.name, t]))
    this.extensions = options.extensions ?? null
    this.systemPrompt = options.systemPrompt ?? this.defaultSystemPrompt()
    this.maxIterations = options.maxIterations ?? 20
    this.verbose = options.verbose ?? false
    
    // 高级功能初始化
    this.messageQueue = new MessageQueue()
    this.compactor = new ContextCompactor({
      maxMessages: 50,
      maxTokens: 30000,
      preserveCount: 10,
    })
    this.enableCompaction = options.enableCompaction ?? true
    this.enableStreaming = options.enableStreaming ?? true
    
    // 统计初始化
    this.stats = {
      iterations: 0,
      toolCalls: 0,
      totalTokens: 0,
      startTime: Date.now(),
    }

    // 注册扩展提供的工具
    if (this.extensions) {
      const extTools = this.extensions.getTools()
      for (const tool of extTools) {
        this.tools.set(tool.name, tool)
      }
    }
  }

  // 设置会话管理器
  setSessionManager(manager: SessionManager, session: Session): void {
    this.sessionManager = manager
    this.session = session
  }

  // 获取当前会话
  getSession(): Session | null {
    return this.session
  }

  // 设置扩展管理器
  setExtensions(extensions: ExtensionManager): void {
    this.extensions = extensions
    
    // 注册扩展提供的工具
    const extTools = extensions.getTools()
    for (const tool of extTools) {
      this.tools.set(tool.name, tool)
    }
  }

  // 获取消息队列
  getMessageQueue(): MessageQueue {
    return this.messageQueue
  }

  // 获取统计信息
  getStats(): AgentStats {
    return { ...this.stats, endTime: Date.now() }
  }

  // 获取压缩建议
  getCompactionAdvice() {
    const path = this.sessionManager?.getCurrentPath() ?? []
    const messages = this.pathToMessages(path)
    return this.compactor.getCompactionAdvice(messages)
  }

  // 执行压缩
  async compact(): Promise<{ success: boolean; message: string }> {
    const path = this.sessionManager?.getCurrentPath() ?? []
    const messages = this.pathToMessages(path)
    
    if (!this.compactor.needsCompaction(messages)) {
      return { success: true, message: "No compaction needed" }
    }

    const result = await this.compactor.compact(messages)
    
    return {
      success: true,
      message: `Compressed ${result.removedCount} messages. Summary: ${result.summary.slice(0, 100)}...`,
    }
  }

  // 运行对话（普通模式）
  async run(userMessage: string): Promise<string> {
    return this.runWithStream(userMessage, undefined)
  }

  // 运行对话（流式模式）
  async runWithStream(userMessage: string, onStream?: StreamCallback): Promise<string> {
    this.iterationCount = 0
    this.stats.startTime = Date.now()

    // 触发 before_chat 事件
    this.extensions?.triggerEvent("before_chat", { messages: [] })

    // 添加用户消息
    await this.saveToSession("user", "user", userMessage)

    // 触发 user_message 事件
    this.extensions?.triggerEvent("user_message", { 
      messages: [{ role: "user", content: userMessage }] 
    })

    // 检查是否需要压缩
    if (this.enableCompaction) {
      const advice = this.getCompactionAdvice()
      if (advice.shouldCompact && this.iterationCount === 0) {
        console.log(`[Agent] ${advice.reason}`)
      }
    }

    // 主循环
    while (this.iterationCount < this.maxIterations) {
      this.iterationCount++
      this.stats.iterations++

      if (this.verbose) {
        console.error(`[Agent] Iteration ${this.iterationCount}`)
      }

      // 调用 LLM（流式或普通）
      if (onStream && this.enableStreaming && "streamChat" in this.provider) {
        await this.callLLMStream(onStream)
      } else {
        await this.callLLM()
      }

      // 获取响应（从会话中）
      const path = this.sessionManager?.getCurrentPath() ?? []
      const assistantEntry = path[path.length - 1]
      
      if (!assistantEntry || assistantEntry.role !== "assistant") {
        continue
      }

      // 检查是否有工具调用
      const toolCalls = this.extractToolCalls(assistantEntry)

      if (toolCalls.length === 0) {
        // 没有工具调用，返回内容
        this.extensions?.triggerEvent("after_chat", { response: assistantEntry.content })
        await this.processFollowUpMessages()
        onStream?.({ type: "done" })
        return assistantEntry.content
      }

      // 有工具调用，先发送工具信息
      for (let i = 0; i < toolCalls.length; i++) {
        onStream?.({ type: "tool_start", toolName: toolCalls[i].name, toolIndex: i })
      }

      // 消费 steering 消息
      this.consumeSteeringMessages()

      // 执行工具
      for (const call of toolCalls) {
        this.stats.toolCalls++

        this.extensions?.triggerEvent("before_tool", {
          toolName: call.name,
          toolInput: call.input,
        })

        const result = await this.executeTool(call.name, call.input)

        if (this.verbose) {
          console.error(`[Agent] Tool ${call.name}: ${result.success ? "OK" : "ERROR"}`)
        }

        const toolContent = result.success ? result.content : `Error: ${result.error}`

        // 保存工具结果
        await this.sessionManager?.addEntry("tool", "tool", toolContent, {
          toolName: call.name,
          toolCallId: call.id,
          toolInput: call.input,
          toolResult: toolContent,
        })

        this.extensions?.triggerEvent("after_tool", {
          toolName: call.name,
          toolInput: call.input,
          toolResult: result.content,
        })

        // 发送工具完成事件
        onStream?.({ type: "tool_end", toolName: call.name })
        
        // 工具执行后，发送 steering 消息
        this.consumeSteeringMessages()
      }
    }

    return "Max iterations reached. Please try a more specific request."
  }

  // 流式调用 LLM
  private async callLLMStream(onStream: StreamCallback): Promise<void> {
    const allMessages = this.getAllMessages()
    const toolDefs = this.getToolDefinitions()

    // 检查 provider 是否支持流式
    const anthropicProvider = this.provider as any
    if (!anthropicProvider.streamChat) {
      // 不支持流式，降级到普通模式
      const response = await this.provider.chat(allMessages, toolDefs)
      response.toolCalls = this.normalizeToolCalls(response.toolCalls)
      await this.saveToSession("assistant", "assistant", response.content, {
        toolCalls: response.toolCalls,
        thinking: response.thinking,
      })
      onStream({ type: "text", content: response.content })
      return
    }

    // 监听流式事件
    const handleEvent = (event: StreamEvent) => {
      switch (event.type) {
        case "text":
          if (event.content) {
            onStream({ type: "text", content: event.content })
          }
          break
        case "thinking":
          if (event.content) {
            onStream({ type: "thinking", content: event.content })
          }
          break
        case "tool_call_start":
          onStream({ type: "tool_start", toolName: event.toolName, toolIndex: event.index })
          break
        case "tool_call_delta":
          onStream({ type: "tool_input", content: event.content })
          break
        case "tool_call_end":
          onStream({ type: "tool_end", toolName: event.toolName })
          break
        case "done":
          onStream({ type: "done" })
          break
      }
    }

    const response = await anthropicProvider.streamChat(allMessages, toolDefs, handleEvent)
    response.toolCalls = this.normalizeToolCalls(response.toolCalls)

    // 保存 assistant 响应到会话
    await this.saveToSession("assistant", "assistant", response.content, {
      toolCalls: response.toolCalls,
      thinking: response.thinking,
    })
  }

  // 调用 LLM（普通模式）
  private async callLLM() {
    const allMessages = this.getAllMessages()
    const toolDefs = this.getToolDefinitions()

    if (this.verbose) {
      console.error(`[Agent] Sending ${allMessages.length} messages, ${toolDefs.length} tools`)
    }

    const response = await this.provider.chat(allMessages, toolDefs)
    response.toolCalls = this.normalizeToolCalls(response.toolCalls)
    
    // 保存到会话
    await this.saveToSession("assistant", "assistant", response.content, {
      toolCalls: response.toolCalls,
      thinking: response.thinking,
    })
    
    return response
  }

  // 从会话条目提取工具调用
  private extractToolCalls(entry: SessionEntry): ToolCall[] {
    return entry.toolCalls ?? []
  }

  // 获取所有消息（包含 system prompt）
  private getAllMessages(): Message[] {
    const msgs: Message[] = []

    // System prompt
    if (this.systemPrompt) {
      msgs.push({ role: "system", content: this.systemPrompt })
    }

    // 历史消息（从当前分支）
    const currentPath = this.sessionManager?.getCurrentPath() ?? []

    // 将路径上的条目转换为消息
    for (const entry of currentPath) {
      if (entry.type === "user" || entry.type === "assistant") {
        msgs.push({
          role: entry.role,
          content: entry.content,
          toolCalls: entry.toolCalls,
        })
      } else if (entry.type === "tool") {
        msgs.push({
          role: "tool",
          content: entry.toolResult ?? entry.content,
          toolName: entry.toolName,
          toolCallId: entry.toolCallId,
        })
      }
    }

    return msgs
  }

  // 将路径转换为消息数组
  private pathToMessages(path: SessionEntry[]): Message[] {
    return path
      .filter(e => e.type === "user" || e.type === "assistant" || e.type === "tool")
      .map(e => ({
        role: e.role,
        content: e.content,
        name: e.toolName,
        toolName: e.toolName,
        toolCallId: e.toolCallId,
        toolCalls: e.toolCalls,
      } as Message))
  }

  // 获取工具定义
  private getToolDefinitions() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
  }

  // 执行工具
  private async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<{ content: string; error?: string; success: boolean }> {
    const tool = this.tools.get(name)

    if (!tool) {
      return {
        content: "",
        error: `Unknown tool: ${name}. Available tools: ${Array.from(this.tools.keys()).join(", ")}`,
        success: false,
      }
    }

    const ctx: ExecutionContext = {
      cwd: process.cwd(),
      homeDir: Bun.env.HOME ?? "/tmp",
      env: Bun.env as Record<string, string | undefined>,
    }

    try {
      return await tool.execute(input, ctx)
    } catch (error) {
      return {
        content: "",
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      }
    }
  }

  // 保存到会话
  private async saveToSession(
    type: SessionEntry["type"],
    role: SessionEntry["role"],
    content: string,
    options?: Partial<Pick<SessionEntry, "toolCalls" | "thinking">>
  ): Promise<void> {
    if (!this.sessionManager) return

    await this.sessionManager.addEntry(type, role, content, options)
  }

  private normalizeToolCalls(toolCalls?: ToolCall[]): ToolCall[] | undefined {
    if (!toolCalls?.length) return undefined

    return toolCalls.map((call, index) => ({
      ...call,
      id: call.id ?? `tool_${Date.now()}_${this.iterationCount}_${index}`,
    }))
  }

  // 消费 steering 消息
  private consumeSteeringMessages(): void {
    const steeringMessages = this.messageQueue.consumeSteering()
    for (const msg of steeringMessages) {
      this.extensions?.triggerEvent("user_message", {
        messages: [{ role: "user", content: `[Steering] ${msg.content}` }],
      })
    }
  }

  // 处理 follow-up 消息
  private async processFollowUpMessages(): Promise<void> {
    const followUpMessages = this.messageQueue.consumeFollowUp()
    for (const msg of followUpMessages) {
      await this.saveToSession("user", "user", `[Follow-up] ${msg.content}`)
    }
  }

  // 格式化工具调用说明
  private formatToolCalls(calls: Array<{ name: string; input: Record<string, unknown> }>): string {
    if (!calls.length) return ""
    return "\n\n[Using tools: " + calls.map(c => c.name).join(", ") + "]"
  }

  // 默认系统提示
  private defaultSystemPrompt(): string {
    const extTools = this.extensions?.getTools() ?? []
    const extToolsDesc = extTools.length > 0 
      ? "\n\nExtension tools:\n" + extTools.map(t => `- ${t.name}: ${t.description}`).join("\n")
      : ""

    return `You are a helpful coding assistant with access to tools.

Built-in tools:
- read: Read file contents
- write: Create or overwrite files
- edit: Edit files with precise text replacement
- bash: Execute shell commands${extToolsDesc}

Be concise and practical. Use tools when needed to accomplish tasks.`
  }

  // 获取当前分支的历史（用于 TUI 显示）
  getCurrentHistory(): Message[] {
    const path = this.sessionManager?.getCurrentPath() ?? []

    return path
      .filter(e => e.type === "user" || e.type === "assistant" || e.type === "tool")
      .map(e => ({
        role: e.role,
        content: e.content,
        name: e.toolName,
        toolName: e.toolName,
        toolCallId: e.toolCallId,
        toolCalls: e.toolCalls,
      } as Message))
  }

  // 切换到指定分支
  async switchBranch(entryId: string): Promise<boolean> {
    if (!this.sessionManager) return false
    return this.sessionManager.moveTo(entryId)
  }

  // 获取所有可用工具列表
  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  // 获取扩展注册的工具
  getExtensionToolNames(): string[] {
    const builtIn = ["read", "write", "edit", "bash"]
    return this.getToolNames().filter(name => !builtIn.includes(name))
  }
}
