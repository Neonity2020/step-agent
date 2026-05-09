// ============================================================
// Web Server - HTTP 服务器
// ============================================================

import { existsSync, readFileSync, readdirSync } from "fs"
import { join, extname } from "path"
import type { WebConfig, ChatSession, ChatMessage, StreamChunk } from "./types"
import { color } from "../tui/colors"

// MIME 类型
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
}

// 活跃的聊天会话
const sessions: Map<string, ChatSession> = new Map()
let currentSessionId = "default"

// 当前消息缓冲（用于流式输出）
let currentStreamBuffer: ((chunk: StreamChunk) => void)[] = []

export class WebServer {
  private config: WebConfig
  private publicDir: string
  private server: any

  constructor(config?: Partial<WebConfig>) {
    this.config = {
      port: config?.port || 3000,
      host: config?.host || "localhost",
      title: config?.title || "My Agent",
      theme: config?.theme || "dark",
    }

    this.publicDir = join(import.meta.dir, "..", "..", "public")
  }

  // 获取配置
  getConfig(): WebConfig {
    return { ...this.config }
  }

  // 设置主题
  setTheme(theme: "dark" | "light" | "auto"): void {
    this.config.theme = theme
  }

  // 创建服务器
  createServer(): any {
    const self = this

    return Bun.serve({
      port: this.config.port,
      hostname: this.config.host,

      async fetch(req) {
        const url = new URL(req.url)
        const pathname = url.pathname

        // CORS 头
        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }

        // 处理 OPTIONS 请求
        if (req.method === "OPTIONS") {
          return new Response(null, { headers: corsHeaders })
        }

        // API 路由
        if (pathname === "/api/chat") {
          return self.handleChat(req, corsHeaders)
        }

        if (pathname === "/api/sessions") {
          return self.handleSessions(req, corsHeaders)
        }

        if (pathname === "/api/config") {
          return self.handleConfig(req, corsHeaders)
        }

        if (pathname === "/api/stream") {
          return self.handleStream(req, corsHeaders)
        }

        // SSE 事件流
        if (pathname === "/api/events") {
          return self.handleSSE(req, corsHeaders)
        }

        // 静态文件
        return self.serveStatic(pathname, corsHeaders)
      },
    })
  }

  // 处理聊天请求
  private handleChat(req: Request, headers: Record<string, string>): Response {
    // POST: 发送消息
    if (req.method === "POST") {
      try {
        const body = req.body as any
        // 异步处理
        this.processMessage(body).catch(console.error)
        return new Response(JSON.stringify({ status: "processing" }), {
          headers: { ...headers, "Content-Type": "application/json" },
        })
      } catch (error) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
    }

    // GET: 获取当前会话消息
    const session = sessions.get(currentSessionId) || this.createSession()
    return new Response(JSON.stringify(session), {
      headers: { ...headers, "Content-Type": "application/json" },
    })
  }

  // 处理会话请求
  private handleSessions(req: Request, headers: Record<string, string>): Response {
    if (req.method === "GET") {
      const sessionList = Array.from(sessions.values()).map((s) => ({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        messageCount: s.messages.length,
      }))
      return new Response(JSON.stringify(sessionList), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }

    if (req.method === "POST") {
      const session = this.createSession()
      return new Response(JSON.stringify(session), {
        status: 201,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }

    return new Response("Method not allowed", { status: 405 })
  }

  // 处理配置请求
  private handleConfig(req: Request, headers: Record<string, string>): Response {
    if (req.method === "GET") {
      return new Response(JSON.stringify(this.config), {
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }

    if (req.method === "POST") {
      try {
        // 读取请求体
        // 这里简化处理
        return new Response(JSON.stringify(this.config), {
          headers: { ...headers, "Content-Type": "application/json" },
        })
      } catch {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { ...headers, "Content-Type": "application/json" },
        })
      }
    }

    return new Response("Method not allowed", { status: 405 })
  }

  // 处理流式响应
  private handleStream(req: Request, headers: Record<string, string>): Response {
    // 返回一个 ReadableStream
    const stream = new ReadableStream({
      start(controller) {
        currentStreamBuffer.push((chunk: StreamChunk) => {
          const data = `data: ${JSON.stringify(chunk)}\n\n`
          controller.enqueue(new TextEncoder().encode(data))
        })
      },
      cancel() {
        currentStreamBuffer = currentStreamBuffer.filter(
          (cb) => cb !== currentStreamBuffer[0]
        )
      },
    })

    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }

  // 处理 SSE 事件
  private handleSSE(req: Request, headers: Record<string, string>): Response {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()

        // 发送连接成功
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`))

        // 心跳
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`))
          } catch {
            clearInterval(heartbeat)
          }
        }, 30000)

        // 保存清理函数
        req.signal.addEventListener("abort", () => {
          clearInterval(heartbeat)
        })
      },
    })

    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }

  // 处理静态文件
  private serveStatic(pathname: string, headers: Record<string, string>): Response {
    let filePath = pathname === "/" ? "/index.html" : pathname

    // 安全检查
    if (filePath.includes("..")) {
      return new Response("Forbidden", { status: 403 })
    }

    const fullPath = join(this.publicDir, filePath)

    // 检查文件是否存在
    if (!existsSync(fullPath)) {
      return new Response("Not found", { status: 404 })
    }

    // 读取文件
    try {
      const content = readFileSync(fullPath)
      const ext = extname(fullPath)
      const contentType = MIME_TYPES[ext] || "application/octet-stream"

      return new Response(content, {
        headers: { ...headers, "Content-Type": contentType },
      })
    } catch {
      return new Response("Internal server error", { status: 500 })
    }
  }

  // 创建新会话
  private createSession(): ChatSession {
    const session: ChatSession = {
      id: `session-${Date.now()}`,
      name: `Chat ${sessions.size + 1}`,
      createdAt: Date.now(),
      messages: [],
    }
    sessions.set(session.id, session)
    currentSessionId = session.id
    return session
  }

  // 处理消息
  private async processMessage(body: any): Promise<void> {
    const { content } = body
    if (!content) return

    const session = sessions.get(currentSessionId) || this.createSession()

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    }
    session.messages.push(userMessage)

    // 广播用户消息
    this.broadcast({ type: "message", message: userMessage })

    // TODO: 调用 LLM 处理
    // 这里先模拟一个响应
    await this.simulateResponse(session, content)
  }

  // 模拟 LLM 响应（实际项目中替换为真正的 LLM 调用）
  private async simulateResponse(
    session: ChatSession,
    userMessage: string
  ): Promise<void> {
    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    }
    session.messages.push(assistantMessage)

    // 模拟打字效果
    const response = `I received your message: "${userMessage}"

This is a demo response. In the actual implementation, this would be replaced with a real LLM call using the provider configuration.

You can configure:
- Provider (Anthropic, OpenAI, etc.)
- Model (Claude Sonnet, GPT-4, etc.)
- Temperature
- Max tokens

Use /model in the CLI to configure these settings.`

    for (let i = 0; i < response.length; i += 5) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      assistantMessage.content += response.slice(i, i + 5)
      this.broadcast({
        type: "update",
        messageId: assistantMessage.id,
        content: assistantMessage.content,
      })
    }

    this.broadcast({ type: "done", messageId: assistantMessage.id })
  }

  // 广播消息到所有客户端
  private broadcast(data: any): void {
    const message = `data: ${JSON.stringify(data)}\n\n`
    // 实际项目中需要维护客户端连接列表
    console.log("Broadcast:", data.type)
  }

  // 启动服务器
  start(): void {
    this.server = this.createServer()
    console.log(color(`\n🌐 Web UI: http://${this.config.host}:${this.config.port}`, "cyan"))
    console.log(color("   Press Ctrl+C to stop\n", "dim"))
  }

  // 停止服务器
  stop(): void {
    if (this.server) {
      this.server.stop()
      this.server = null
    }
  }
}
