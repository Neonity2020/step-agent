// ============================================================
// Gateway Rate Limit - 限流模块
// ============================================================

import type { RateLimit, RateLimitInfo, RequestContext, Middleware } from "./types"

// 内存存储（生产环境应该用 Redis）
interface RateLimitEntry {
  count: number
  reset: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// 清理过期条目
function cleanup(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.reset < now) {
      rateLimitStore.delete(key)
    }
  }
}

// 定时清理
setInterval(cleanup, 60000)

// 获取限流键
function getRateLimitKey(ctx: RequestContext, prefix: string): string {
  // 优先使用 API Key ID，否则使用 IP
  const identifier = ctx.apiKeyId || ctx.ip || "unknown"
  return `${prefix}:${identifier}`
}

// 检查限流
export function checkRateLimit(
  key: string,
  limit: RateLimit
): { allowed: boolean; info: RateLimitInfo } {
  const now = Date.now()
  let entry = rateLimitStore.get(key)

  // 如果过期，重置
  if (!entry || entry.reset < now) {
    entry = {
      count: 0,
      reset: now + limit.windowMs,
    }
    rateLimitStore.set(key, entry)
  }

  // 增加计数
  entry.count++

  const remaining = Math.max(0, limit.requests - entry.count)
  const allowed = entry.count <= limit.requests

  return {
    allowed,
    info: {
      remaining,
      limit: limit.requests,
      reset: entry.reset,
    },
  }
}

// 限流中间件
export function rateLimitMiddleware(
  defaultLimit: RateLimit
): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    const key = getRateLimitKey(ctx, "global")
    const result = checkRateLimit(key, defaultLimit)

    if (!result.allowed) {
      const error = new RateLimitExceededError(
        "Rate limit exceeded",
        result.info
      )
      throw error
    }

    // 将限流信息添加到上下文（可以在响应头中使用）
    ;(ctx as any).rateLimitInfo = result.info

    await next()
  }
}

// 自定义错误类
export class RateLimitExceededError extends Error {
  info: RateLimitInfo

  constructor(message: string, info: RateLimitInfo) {
    super(message)
    this.name = "RateLimitExceededError"
    this.info = info
  }
}

// 创建 API Key 级别的限流
export function createAPIKeyRateLimiter(getRateLimit: (ctx: RequestContext) => RateLimit): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    if (!ctx.apiKeyId) {
      await next()
      return
    }

    const key = getRateLimitKey(ctx, `apikey:${ctx.apiKeyId}`)
    const limit = getRateLimit(ctx)
    const result = checkRateLimit(key, limit)

    if (!result.allowed) {
      const error = new RateLimitExceededError(
        "API Key rate limit exceeded",
        result.info
      )
      throw error
    }

    ;(ctx as any).rateLimitInfo = result.info

    await next()
  }
}

// 端点级别限流
export function createEndpointRateLimiter(
  endpoint: string,
  limit: RateLimit
): Middleware {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    if (!ctx.path.includes(endpoint)) {
      await next()
      return
    }

    const key = getRateLimitKey(ctx, `endpoint:${endpoint}`)
    const result = checkRateLimit(key, limit)

    if (!result.allowed) {
      const error = new RateLimitExceededError(
        `Rate limit exceeded for ${endpoint}`,
        result.info
      )
      throw error
    }

    ;(ctx as any).rateLimitInfo = result.info

    await next()
  }
}

// 获取统计信息
export function getRateLimitStats(): {
  totalKeys: number
  entriesByPrefix: Record<string, number>
} {
  const prefixes: Record<string, number> = {}

  for (const key of rateLimitStore.keys()) {
    const prefix = key.split(":")[0]
    prefixes[prefix] = (prefixes[prefix] || 0) + 1
  }

  return {
    totalKeys: rateLimitStore.size,
    entriesByPrefix: prefixes,
  }
}

// 重置限流
export function resetRateLimit(identifier: string): void {
  for (const key of rateLimitStore.keys()) {
    if (key.includes(identifier)) {
      rateLimitStore.delete(key)
    }
  }
}

export const ratelimit = {
  checkRateLimit,
  rateLimitMiddleware,
  createAPIKeyRateLimiter,
  createEndpointRateLimiter,
  getRateLimitStats,
  resetRateLimit,
  RateLimitExceededError,
}
