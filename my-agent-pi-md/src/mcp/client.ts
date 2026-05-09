// ============================================================
// MCP Client - MCP 客户端实现（简化版）
// ============================================================

import type { 
  MCPServerInfo, 
  MCPTool, 
  MCPToolResult, 
  MCPResource,
  MCPPrompt,
  MCPClientStats,
} from "./types.ts"

export interface MCPClientOptions {
  name: string
  version: string
  command: string
  args?: string[]
  env?: Record<string, string>
  onLog?: (level: string, message: string) => void
  onError?: (error: Error) => void
}

export interface MCPToolInput {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: Record<string, unknown>) => Promise<{ content: string; success: boolean; error?: string }>
}

// MCP 客户端
export class MCPClient {
  private process: any = null
  private options: MCPClientOptions
  private pendingRequests: Map<string, {
    resolve: (result: unknown) => void
    reject: (error: Error) => void
  }> = new Map()
  private messageId = 0
  private tools: Map<string, MCPTool> = new Map()
  private resources: Map<string, MCPResource> = new Map()
  private prompts: Map<string, MCPPrompt> = new Map()
  private serverInfo: MCPServerInfo | null = null
  private connected = false
  private initialized = false
  private initializedPromise: Promise<void> | null = null

  constructor(options: MCPClientOptions) {
    this.options = options
  }

  // 连接并初始化
  async connect(): Promise<void> {
    if (this.connected) {
      return
    }

    if (this.initializedPromise) {
      return this.initializedPromise
    }

    this.initializedPromise = this.doConnect()
    return this.initializedPromise
  }

  private async doConnect(): Promise<void> {
    const { command, args = [], env = {} } = this.options

    try {
      this.process = Bun.spawn({
        cmd: [command, ...args],
        env: {
          ...process.env,
          ...env,
        },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "pipe",
      })

      // 设置 stdout 读取
      this.readStdout()

      // 初始化 MCP
      await this.initialize()
      this.connected = true

    } catch (error) {
      this.initializedPromise = null
      throw new Error(`Failed to start MCP server: ${error instanceof Error ? error.message : error}`)
    }
  }

  // 读取 stdout
  private async readStdout(): Promise<void> {
    const reader = this.process.stdout?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        this.handleMessage(text)
      }
    } catch (error) {
      this.options.onError?.(error as Error)
    }
  }

  // 断开连接
  disconnect(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.connected = false
    this.initialized = false
    this.initializedPromise = null
    this.pendingRequests.clear()
  }

  // 是否已连接
  isConnected(): boolean {
    return this.connected && this.initialized
  }

  // 获取服务器信息
  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo
  }

  // 获取统计
  getStats(): MCPClientStats {
    return {
      toolsCount: this.tools.size,
      resourcesCount: this.resources.size,
      promptsCount: this.prompts.size,
      connected: this.connected,
    }
  }

  // 获取所有工具
  getTools(): MCPTool[] {
    return Array.from(this.tools.values())
  }

  // 获取所有资源
  getResources(): MCPResource[] {
    return Array.from(this.resources.values())
  }

  // 列出可用工具
  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest("tools/list", {})
    
    if (response && typeof response === "object" && "tools" in response) {
      const tools = (response as { tools: MCPTool[] }).tools
      this.tools.clear()
      for (const tool of tools) {
        this.tools.set(tool.name, tool)
      }
      return tools
    }
    
    return []
  }

  // 调用工具
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.sendRequest("tools/call", {
      name,
      arguments: args,
    })

    return result as MCPToolResult
  }

  // 列出资源
  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest("resources/list", {})
    
    if (response && typeof response === "object" && "resources" in response) {
      const resources = (response as { resources: MCPResource[] }).resources
      this.resources.clear()
      for (const resource of resources) {
        this.resources.set(resource.uri, resource)
      }
      return resources
    }
    
    return []
  }

  // 列出提示词
  async listPrompts(): Promise<MCPPrompt[]> {
    const response = await this.sendRequest("prompts/list", {})
    
    if (response && typeof response === "object" && "prompts" in response) {
      const prompts = (response as { prompts: MCPPrompt[] }).prompts
      this.prompts.clear()
      for (const prompt of prompts) {
        this.prompts.set(prompt.name, prompt)
      }
      return prompts
    }
    
    return []
  }

  // 转换为 Agent 工具
  toAgentTools(): MCPToolInput[] {
    const clientName = this.options.name
    return Array.from(this.tools.values()).map(tool => ({
      name: `mcp_${clientName}_${tool.name}`,
      description: tool.description ?? `MCP tool: ${tool.name}`,
      inputSchema: tool.inputSchema,
      execute: async (input) => {
        return this.executeTool(tool.name, input)
      },
    }))
  }

  // 执行 MCP 工具
  async executeTool(name: string, input: Record<string, unknown>): Promise<{ content: string; success: boolean; error?: string }> {
    try {
      const result = await this.callTool(name, input)
      
      const content = result.content
        .map(c => c.text ?? JSON.stringify(c))
        .join("\n")

      return {
        content,
        success: !result.isError,
        error: result.isError ? content : undefined,
      }
    } catch (error) {
      return {
        content: "",
        error: error instanceof Error ? error.message : String(error),
        success: false,
      }
    }
  }

  // ============ 私有方法 ============

  // 初始化
  private async initialize(): Promise<void> {
    const response = await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      clientInfo: {
        name: this.options.name,
        version: this.options.version,
      },
    })

    this.serverInfo = response as MCPServerInfo

    // 发送初始化完成通知
    this.sendNotification("initialized", {})

    // 获取工具列表
    await this.listTools()

    this.initialized = true
  }

  // 发送请求
  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error("MCP process not running"))
        return
      }

      const id = ++this.messageId
      const request = {
        jsonrpc: "2.0",
        id,
        method,
        params: params ?? {},
      }

      this.pendingRequests.set(String(id), { resolve, reject })

      try {
        this.process.stdin.write(JSON.stringify(request) + "\n")
      } catch (error) {
        this.pendingRequests.delete(String(id))
        reject(error)
        return
      }

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(String(id))) {
          this.pendingRequests.delete(String(id))
          reject(new Error(`Request ${method} timed out`))
        }
      }, 30000)
    })
  }

  // 发送通知
  private sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.process?.stdin) {
      return
    }

    const notification = {
      jsonrpc: "2.0",
      method,
      params: params ?? {},
    }

    try {
      this.process.stdin.write(JSON.stringify(notification) + "\n")
    } catch (error) {
      // 忽略
    }
  }

  // 处理消息
  private handleMessage(data: string): void {
    const lines = data.split("\n").filter(Boolean)

    for (const line of lines) {
      try {
        const message = JSON.parse(line)

        // 响应消息
        if ("id" in message) {
          const pending = this.pendingRequests.get(String(message.id))
          if (pending) {
            this.pendingRequests.delete(String(message.id))
            if (message.error) {
              pending.reject(new Error(message.error.message))
            } else {
              pending.resolve(message.result)
            }
          }
        }
      } catch (error) {
        // 忽略解析错误
      }
    }
  }
}

// MCP 客户端管理器
export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map()

  // 添加客户端
  async addClient(name: string, options: MCPClientOptions): Promise<MCPClient> {
    const client = new MCPClient(options)
    
    try {
      await client.connect()
      this.clients.set(name, client)
      return client
    } catch (error) {
      client.disconnect()
      throw error
    }
  }

  // 移除客户端
  removeClient(name: string): boolean {
    const client = this.clients.get(name)
    if (client) {
      client.disconnect()
      return this.clients.delete(name)
    }
    return false
  }

  // 获取客户端
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name)
  }

  // 获取所有客户端
  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values())
  }

  // 获取所有工具
  getAllTools(): MCPToolInput[] {
    const tools: MCPToolInput[] = []
    for (const client of this.clients.values()) {
      tools.push(...client.toAgentTools())
    }
    return tools
  }

  // 获取统计
  getStats(): Record<string, MCPClientStats> {
    const stats: Record<string, MCPClientStats> = {}
    for (const [name, client] of this.clients) {
      stats[name] = client.getStats()
    }
    return stats
  }

  // 断开所有
  disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect()
    }
    this.clients.clear()
  }
}
