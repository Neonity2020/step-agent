// ============================================================
// Gateway Types - API 网关类型定义
// ============================================================

// API Key 配置
export interface APIKeyConfig {
  id: string
  key: string
  name: string
  permissions: Permission[]
  rateLimit: RateLimit
  createdAt: number
  lastUsed?: number
  expiresAt?: number
  active: boolean
}

// 权限
export type Permission = 
  | "chat:send"
  | "chat:read"
  | "session:create"
  | "session:read"
  | "session:list"
  | "session:delete"
  | "model:list"
  | "model:set"
  | "stats:read"
  | "admin"

// 限流配置
export interface RateLimit {
  requests: number // 每窗口请求数
  windowMs: number // 窗口大小（毫秒）
}

// 请求上下文
export interface RequestContext {
  id: string
  method: string
  path: string
  headers: Record<string, string>
  query: Record<string, string>
  body?: any
  ip?: string
  timestamp: number
  apiKeyId?: string
  permissions: Permission[]
}

// 响应
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: APIError
  meta?: ResponseMeta
}

export interface APIError {
  code: string
  message: string
  details?: any
}

export interface ResponseMeta {
  requestId: string
  timestamp: number
  rateLimit?: RateLimitInfo
  processingTime?: number
}

export interface RateLimitInfo {
  remaining: number
  limit: number
  reset: number
}

// 会话信息
export interface SessionInfo {
  id: string
  name: string
  messageCount: number
  createdAt: number
  lastActivity: number
}

// 网关配置
export interface GatewayConfig {
  port: number
  host: string
  apiKeys: APIKeyConfig[]
  rateLimit: RateLimit
  corsEnabled: boolean
  corsOrigins: string[]
  logging: boolean
  logPath?: string
}

// 路由配置
export interface Route {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  path: string
  handler: string
  permissions: Permission[]
  middleware?: string[]
}

// API 统计
export interface GatewayStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  activeSessions: number
  totalTokens: number
  requestsByEndpoint: Record<string, number>
  errorsByCode: Record<string, number>
}

// 中间件类型
export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<void>
) => Promise<void>

// Webhook 配置
export interface WebhookConfig {
  id: string
  url: string
  events: WebhookEvent[]
  secret?: string
  active: boolean
}

export type WebhookEvent = 
  | "chat.start"
  | "chat.end"
  | "chat.error"
  | "session.create"
  | "session.delete"

// 认证方式
export type AuthMethod = "apikey" | "bearer" | "both"
