// ============================================================
// Gateway Server - API 网关服务器
// ============================================================

import { Router, loggingMiddleware, requestIdMiddleware } from "./router"
import { auth, authMiddleware, createAPIKey, listAPIKeys } from "./auth"
import { rateLimitMiddleware, getRateLimitStats } from "./ratelimit"
import { createAPIResponse } from "./response"
import type {
  GatewayConfig,
  RequestContext,
  Permission,
  GatewayStats,
} from "./types"
import { color } from "../tui/colors"

export interface ChatRequest {
  message: string
  sessionId?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface ChatResponse {
  sessionId: string
  messageId: string
  content: string
  toolCalls?: any[]
}

// 统计
const stats: GatewayStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  activeSessions: 0,
  totalTokens: 0,
  requestsByEndpoint: {},
  errorsByCode: {},
}

export class GatewayServer {
  private router: Router
  private config: GatewayConfig
  private server: any = null

  constructor(config?: Partial<GatewayConfig>) {
    this.config = {
      port: config?.port || 8080,
      host: config?.host || "localhost",
      apiKeys: config?.apiKeys || [],
      rateLimit: config?.rateLimit || { requests: 100, windowMs: 60000 },
      corsEnabled: config?.corsEnabled ?? true,
      corsOrigins: config?.corsOrigins || ["*"],
      logging: config?.logging ?? true,
      logPath: config?.logPath,
    }

    this.router = new Router()
    this.setupRoutes()
  }

  // 权限检查中间件
  private requireAuth(permissions: Permission[]): any {
    return auth.authMiddleware(permissions)
  }

  // 设置路由
  private setupRoutes(): void {
    // 全局中间件
    this.router.addGlobalMiddleware(requestIdMiddleware())

    if (this.config.logging) {
      this.router.addGlobalMiddleware(loggingMiddleware())
    }

    this.router.addGlobalMiddleware(rateLimitMiddleware(this.config.rateLimit))

    // 健康检查
    this.router.get("/health", async () => 
      createAPIResponse({ status: "ok", uptime: process.uptime() })
    )

    // API Keys 管理
    this.router.get(
      "/api/keys",
      async () => createAPIResponse(listAPIKeys()),
      [this.requireAuth(["admin"])]
    )

    this.router.post(
      "/api/keys",
      async (ctx) => {
        const body = (ctx as any).body || {}
        const apiKey = createAPIKey(
          body.name || "Default",
          body.permissions,
          body.rateLimit,
          body.expiresAt
        )
        return createAPIResponse({
          id: apiKey.id,
          key: apiKey.key,
          name: apiKey.name,
          permissions: apiKey.permissions,
          rateLimit: apiKey.rateLimit,
          createdAt: apiKey.createdAt,
        })
      },
      [this.requireAuth(["admin"])]
    )

    // 聊天
    this.router.post(
      "/api/chat",
      async (ctx) => {
        stats.totalRequests++
        stats.requestsByEndpoint["/api/chat"] = (stats.requestsByEndpoint["/api/chat"] || 0) + 1

        const body = (ctx as any).body as ChatRequest
        if (!body?.message) {
          stats.failedRequests++
          stats.errorsByCode["INVALID_REQUEST"] = (stats.errorsByCode["INVALID_REQUEST"] || 0) + 1
          throw new Error("Message is required")
        }

        stats.successfulRequests++
        stats.activeSessions++

        return createAPIResponse({
          sessionId: body.sessionId || `sess_${Date.now()}`,
          messageId: `msg_${Date.now()}`,
          content: `Echo: ${body.message}`,
        } as ChatResponse)
      },
      [this.requireAuth(["chat:send"])]
    )

    // 获取聊天历史
    this.router.get(
      "/api/chat/:sessionId",
      async (ctx) => {
        const params = (ctx as any).params
        return createAPIResponse({
          sessionId: params.sessionId,
          messages: [],
        })
      },
      [this.requireAuth(["chat:read"])]
    )

    // 会话管理
    this.router.get(
      "/api/sessions",
      async () => createAPIResponse([]),
      [this.requireAuth(["session:list"])]
    )

    this.router.post(
      "/api/sessions",
      async () => createAPIResponse({
        id: `sess_${Date.now()}`,
        name: "New Session",
        createdAt: Date.now(),
      }),
      [this.requireAuth(["session:create"])]
    )

    this.router.delete(
      "/api/sessions/:sessionId",
      async (ctx) => {
        const params = (ctx as any).params
        return createAPIResponse({ deleted: params.sessionId })
      },
      [this.requireAuth(["session:delete"])]
    )

    // 模型列表
    this.router.get(
      "/api/models",
      async () => createAPIResponse([
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic" },
        { id: "claude-opus-4-20250514", name: "Claude Opus 4", provider: "anthropic" },
        { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
      ]),
      [this.requireAuth(["model:list"])]
    )

    // 统计
    this.router.get(
      "/api/stats",
      async () => createAPIResponse({
        ...stats,
        rateLimit: getRateLimitStats(),
      }),
      [this.requireAuth(["stats:read"])]
    )
  }

  // 添加全局中间件
  addGlobalMiddleware(middleware: any): void {
    this.router.addGlobalMiddleware(middleware)
  }

  // 添加路由
  addRoute(
    method: string,
    path: string,
    handler: any,
    middleware?: any[]
  ): void {
    this.router.addRoute(method, path, handler, middleware)
  }

  // 创建请求上下文
  private createContext(req: any): RequestContext {
    const url = new URL(req.url, `http://${req.headers.host}`)

    return {
      id: req.headers["x-request-id"] || `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      method: req.method,
      path: url.pathname,
      headers: req.headers,
      query: Object.fromEntries(url.searchParams),
      body: req.body,
      ip: req.headers["x-forwarded-for"]?.split(",")[0] || req.headers["x-real-ip"],
      timestamp: Date.now(),
      permissions: [],
    }
  }

  // 创建响应
  private createResponse(data: any, ctx: RequestContext, status = 200): Response {
    const meta: any = {
      requestId: (ctx as any).requestId || ctx.id,
      timestamp: Date.now(),
    }

    if ((ctx as any).rateLimitInfo) {
      meta.rateLimit = (ctx as any).rateLimitInfo
    }

    const body = {
      success: status < 400,
      data: status < 400 ? data : undefined,
      error: status >= 400 ? data : undefined,
      meta,
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-ID": meta.requestId,
    }

    // CORS
    if (this.config.corsEnabled) {
      const origin = (ctx as any).corsOrigin || this.config.corsOrigins[0]
      headers["Access-Control-Allow-Origin"] = origin
      headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
      headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-API-Key, X-Request-ID"
    }

    // 限流头
    if ((ctx as any).rateLimitInfo) {
      const rl = (ctx as any).rateLimitInfo
      headers["X-RateLimit-Remaining"] = String(rl.remaining)
      headers["X-RateLimit-Limit"] = String(rl.limit)
      headers["X-RateLimit-Reset"] = String(rl.reset)
    }

    return new Response(JSON.stringify(body), { status, headers })
  }

  // 启动服务器
  start(): void {
    const self = this

    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,

      async fetch(req) {
        // CORS 预检
        if (req.method === "OPTIONS") {
          return new Response(null, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-Request-ID",
            },
          })
        }

        // 读取 body
        let body: any = undefined
        const contentType = req.headers.get("content-type")
        if (contentType?.includes("application/json")) {
          try {
            body = await req.json()
          } catch {}
        }

        // 创建上下文
        const ctx = self.createContext({
          ...req,
          body,
        })

        try {
          const result = await self.router.handle(ctx)
          return self.createResponse(result.data, ctx)
        } catch (error: any) {
          stats.failedRequests++
          let status = 500
          let message = "Internal server error"

          if (error.name === "APIKeyError") {
            status = 401
            message = error.message
          } else if (error.name === "RateLimitExceededError") {
            status = 429
            message = error.message
          } else if (error.message) {
            message = error.message
          }

          return self.createResponse({ code: error.code || "ERROR", message }, ctx, status)
        }
      },
    })

    console.log(color(`\nGateway: http://${this.config.host}:${this.config.port}`, "cyan"))
    console.log(color(`   API: http://${this.config.host}:${this.config.port}/api/chat`, "dim"))
    console.log(color(`   Health: http://${this.config.host}:${this.config.port}/health\n`, "dim"))
  }

  // 停止服务器
  stop(): void {
    if (this.server) {
      this.server.stop()
      this.server = null
    }
  }

  // 获取统计
  getStats(): GatewayStats {
    return { ...stats }
  }

  // 获取配置
  getConfig(): GatewayConfig {
    return { ...this.config }
  }
}
