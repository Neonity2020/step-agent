// ============================================================
// Agent Core - Agent 核心逻辑（支持扩展）
// ============================================================

import type { Message, ExecutionContext } from "../types/index.ts"
import type { Provider } from "../providers/base.ts"
import type { Tool } from "../tools/base.ts"
import type { SessionManager, Session, SessionEntry } from "../session/session.ts"
import type { ExtensionManager, AgentConfig } from "../extensions/index.ts"

export interface AgentOptions {
  provider: Provider
  tools: Tool[]
  extensions?: ExtensionManager
  systemPrompt?: string
  maxIterations?: number
  verbose?: boolean
}

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

  constructor(options: AgentOptions) {
    this.provider = options.provider
    this.tools = new Map(options.tools.map(t => [t.name, t]))
    this.extensions = options.extensions ?? null
    this.systemPrompt = options.systemPrompt ?? this.defaultSystemPrompt()
    this.maxIterations = options.maxIterations ?? 20
    this.verbose = options.verbose ?? false

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

  // 运行对话
  async run(userMessage: string): Promise<string> {
    this.iterationCount = 0

    // 触发 before_chat 事件
    this.extensions?.triggerEvent("before_chat", { messages: [] })

    // 添加用户消息
    this.addMessage({ role: "user", content: userMessage })
    await this.saveToSession("user", "user", userMessage)

    // 触发 user_message 事件
    this.extensions?.triggerEvent("user_message", { messages: [{ role: "user", content: userMessage }] })

    // 主循环
    while (this.iterationCount < this.maxIterations) {
      this.iterationCount++

      if (this.verbose) {
        console.error(`[Agent] Iteration ${this.iterationCount}`)
      }

      // 调用 LLM
      const response = await this.callLLM()

      // 如果没有工具调用，返回内容
      if (!response.toolCalls || response.toolCalls.length === 0) {
        this.addMessage({ role: "assistant", content: response.content })
        await this.saveToSession("assistant", "assistant", response.content)

        // 触发 after_chat 事件
        this.extensions?.triggerEvent("after_chat", { response: response.content })

        return response.content
      }

      // 有工具调用，先记录 assistant 消息
      const assistantContent = response.content + this.formatToolCalls(response.toolCalls)
      this.addMessage({ role: "assistant", content: assistantContent })
      await this.saveToSession("assistant", "assistant", assistantContent)

      // 触发 assistant_message 事件
      this.extensions?.triggerEvent("assistant_message", { response: assistantContent })

      // 执行工具
      for (const call of response.toolCalls) {
        // 触发 before_tool 事件
        this.extensions?.triggerEvent("before_tool", {
          toolName: call.name,
          toolInput: call.input,
        })

        const result = await this.executeTool(call.name, call.input)

        if (this.verbose) {
          console.error(`[Agent] Tool ${call.name}: ${result.success ? "OK" : "ERROR"}`)
        }

        const toolContent = result.success ? result.content : `Error: ${result.error}`
        this.addMessage({
          role: "tool",
          content: toolContent,
          name: call.name,
          toolCallId: call.name,
          toolName: call.name,
        })

        // 保存工具调用和结果
        await this.sessionManager?.addEntry("tool", "tool", toolContent, {
          toolName: call.name,
          toolInput: call.input,
          toolResult: result.content,
        })

        // 触发 after_tool 事件
        this.extensions?.triggerEvent("after_tool", {
          toolName: call.name,
          toolInput: call.input,
          toolResult: result.content,
        })
      }
    }

    return "Max iterations reached. Please try a more specific request."
  }

  // 调用 LLM
  private async callLLM() {
    const allMessages = this.getAllMessages()
    const toolDefs = this.getToolDefinitions()

    if (this.verbose) {
      console.error(`[Agent] Sending ${allMessages.length} messages, ${toolDefs.length} tools`)
    }

    return this.provider.chat(allMessages, toolDefs)
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
        })
      } else if (entry.type === "tool") {
        msgs.push({
          role: "tool",
          content: entry.toolResult ?? entry.content,
          toolName: entry.toolName,
        })
      }
    }

    return msgs
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

  // 添加消息（内存）
  private addMessage(msg: Message) {
    // 内存中不再保存，由 SessionManager 管理
  }

  // 保存到会话
  private async saveToSession(type: SessionEntry["type"], role: SessionEntry["role"], content: string): Promise<void> {
    if (!this.sessionManager) return

    await this.sessionManager.addEntry(type, role, content)
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
