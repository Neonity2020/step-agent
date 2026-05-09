// ============================================================
// Gateway Router - 路由系统
// ============================================================

import type { RequestContext, Middleware, APIResponse } from "./types"

// 路由处理函数类型
type Handler = (ctx: RequestContext) => Promise<APIResponse>

// 路由记录
interface RouteRecord {
  method: string
  path: string
  pattern: RegExp
  paramNames: string[]
  handler: Handler
  middleware: Middleware[]
}

// 全局限流中间件
let globalMiddleware: Middleware[] = []

// 设置全局中间件
export function setGlobalMiddleware(middleware: Middleware): void {
  globalMiddleware.push(middleware)
}

// 清除全局中间件
export function clearGlobalMiddleware(): void {
  globalMiddleware = []
}

// 路由类
export class Router {
  private routes: RouteRecord[] = []
  private notFoundHandler: Handler

  constructor(notFoundHandler?: Handler) {
    this.notFoundHandler =
      notFoundHandler ||
      (async () => ({
        success: false,
        error: { code: "NOT_FOUND", message: "Route not found" },
      }))
  }

  // 添加全局中间件
  addGlobalMiddleware(middleware: Middleware): void {
    globalMiddleware.push(middleware)
  }

  // 添加路由
  addRoute(
    method: string,
    path: string,
    handler: Handler,
    middleware: Middleware[] = []
  ): void {
    const { pattern, paramNames } = this.pathToRegex(path)

    this.routes.push({
      method: method.toUpperCase(),
      path,
      pattern,
      paramNames,
      handler,
      middleware,
    })
  }

  // GET 路由
  get(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.addRoute("GET", path, handler, middleware)
  }

  // POST 路由
  post(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.addRoute("POST", path, handler, middleware)
  }

  // PUT 路由
  put(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.addRoute("PUT", path, handler, middleware)
  }

  // DELETE 路由
  delete(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.addRoute("DELETE", path, handler, middleware)
  }

  // PATCH 路由
  patch(path: string, handler: Handler, middleware?: Middleware[]): void {
    this.addRoute("PATCH", path, handler, middleware)
  }

  // 匹配路由
  match(method: string, path: string): {
    route: RouteRecord | null
    params: Record<string, string>
  } {
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) {
        continue
      }

      const match = path.match(route.pattern)
      if (match) {
        const params: Record<string, string> = {}
        route.paramNames.forEach((name, index) => {
          params[name] = match[index + 1]
        })

        return { route, params }
      }
    }

    return { route: null, params: {} }
  }

  // 执行中间件链
  private async runMiddleware(
    ctx: RequestContext,
    middlewareList: Middleware[]
  ): Promise<void> {
    for (const middleware of middlewareList) {
      await middleware(ctx, async () => {})
    }
  }

  // 执行路由
  async handle(ctx: RequestContext): Promise<APIResponse> {
    const { route, params } = this.match(ctx.method, ctx.path)

    if (!route) {
      return this.notFoundHandler(ctx)
    }

    // 合并参数到上下文
    ;(ctx as any).params = params

    try {
      // 执行全局中间件
      await this.runMiddleware(ctx, globalMiddleware)

      // 执行路由中间件
      await this.runMiddleware(ctx, route.middleware)

      // 执行处理器
      return await route.handler(ctx)
    } catch (error) {
      // 重新抛出错误，让服务器处理
      throw error
    }
  }

  // 路径转正则
  private pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = []

    // 转义特殊字符，将 :param 转换为捕获组
    const regexStr = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      paramNames.push(name)
      return "([^/]+)"
    })

    return {
      pattern: new RegExp(`^${regexStr}$`),
      paramNames,
    }
  }

  // 获取所有路由
  getRoutes(): { method: string; path: string; middleware: number }[] {
    return this.routes.map((r) => ({
      method: r.method,
      path: r.path,
      middleware: r.middleware.length,
    }))
  }
}

// 创建默认路由器
export function createRouter(): Router {
  return new Router()
}

// 错误处理中间件
export function errorMiddleware(
  handler: (error: Error, ctx: RequestContext) => Promise<void>
): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    try {
      await next()
    } catch (error) {
      await handler(error as Error, ctx)
    }
  }
}

// 日志中间件
export function loggingMiddleware(
  logger?: (ctx: RequestContext, duration: number) => void
): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    const start = Date.now()

    await next()

    const duration = Date.now() - start

    if (logger) {
      logger(ctx, duration)
    } else {
      const method = ctx.method.padEnd(6)
      const path = ctx.path.padEnd(40)
      const status = (ctx as any).status || 200
      const durationStr = `${duration}ms`

      console.log(`${method} ${path} ${status} ${durationStr}`)
    }
  }
}

// CORS 中间件
export function corsMiddleware(origins: string[] = ["*"]): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    const origin = ctx.headers.origin

    if (origins.includes("*") || origins.includes(origin || "")) {
      ;(ctx as any).corsOrigin = origin || "*"
    }

    await next()
  }
}

// 请求 ID 中间件
export function requestIdMiddleware(): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    const id = ctx.headers["x-request-id"] || `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
    ;(ctx as any).requestId = id

    await next()
  }
}

// 超时中间件
export function timeoutMiddleware(timeoutMs: number): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    await Promise.race([
      next(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
      ),
    ])
  }
}

export const router = {
  Router,
  createRouter,
  errorMiddleware,
  loggingMiddleware,
  corsMiddleware,
  requestIdMiddleware,
  timeoutMiddleware,
  setGlobalMiddleware,
  clearGlobalMiddleware,
}
