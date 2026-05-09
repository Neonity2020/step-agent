// ============================================================
// Gateway Auth - 认证模块
// ============================================================

import { createHash, randomBytes } from "crypto"
import type { APIKeyConfig, Permission, RequestContext } from "./types"

// 简单的内存存储，实际应该用数据库
const apiKeys = new Map<string, APIKeyConfig>()

// 生成 API Key
export function generateAPIKey(): string {
  return `sk_${randomBytes(32).toString("hex")}`
}

// 生成 API Key ID
export function generateAPIKeyId(): string {
  return `key_${randomBytes(8).toString("hex")}`
}

// 创建 API Key
export function createAPIKey(
  name: string,
  permissions: Permission[] = ["chat:send", "chat:read"],
  rateLimit?: { requests: number; windowMs: number },
  expiresAt?: number
): APIKeyConfig {
  const id = generateAPIKeyId()
  const key = generateAPIKey()

  const apiKey: APIKeyConfig = {
    id,
    key,
    name,
    permissions,
    rateLimit: rateLimit || { requests: 100, windowMs: 60000 },
    createdAt: Date.now(),
    expiresAt,
    active: true,
  }

  apiKeys.set(key, apiKey)
  apiKeys.set(id, apiKey)

  return apiKey
}

// 验证 API Key
export function validateAPIKey(key: string): APIKeyConfig | null {
  const apiKey = apiKeys.get(key)

  if (!apiKey) {
    return null
  }

  if (!apiKey.active) {
    return null
  }

  if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
    return null
  }

  // 更新最后使用时间
  apiKey.lastUsed = Date.now()

  return apiKey
}

// 吊销 API Key
export function revokeAPIKey(keyOrId: string): boolean {
  const apiKey = apiKeys.get(keyOrId)
  
  if (!apiKey) {
    return false
  }

  apiKey.active = false
  return true
}

// 检查权限
export function hasPermission(apiKey: APIKeyConfig, permission: Permission): boolean {
  return apiKey.permissions.includes(permission) || apiKey.permissions.includes("admin")
}

// 加载 API Keys
export function loadAPIKeys(keys: APIKeyConfig[]): void {
  for (const key of keys) {
    apiKeys.set(key.key, key)
    apiKeys.set(key.id, key)
  }
}

// 获取所有 API Keys（不含密钥）
export function listAPIKeys(): Omit<APIKeyConfig, "key">[] {
  const keys: Omit<APIKeyConfig, "key">[] = []

  for (const [, key] of apiKeys) {
    if (!keys.some((k) => k.id === key.id)) {
      const { key: _, ...rest } = key
      keys.push(rest)
    }
  }

  return keys
}

// 从请求中提取 API Key
export function extractAPIKey(ctx: RequestContext): string | null {
  // 1. Authorization: Bearer <key>
  const authHeader = ctx.headers.authorization
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }

  // 2. X-API-Key header
  const apiKeyHeader = ctx.headers["x-api-key"]
  if (apiKeyHeader) {
    return apiKeyHeader
  }

  // 3. query.api_key
  const queryKey = ctx.query.api_key
  if (queryKey) {
    return queryKey
  }

  return null
}

// 认证中间件工厂
export function authMiddleware(requiredPermissions: Permission[] = []) {
  return async (ctx: RequestContext, next: () => Promise<void>): Promise<void> => {
    const key = extractAPIKey(ctx)

    if (!key) {
      throw new APIKeyError("Missing API key", "AUTH_MISSING_KEY")
    }

    const apiKey = validateAPIKey(key)

    if (!apiKey) {
      throw new APIKeyError("Invalid or expired API key", "AUTH_INVALID_KEY")
    }

    // 检查权限
    for (const permission of requiredPermissions) {
      if (!hasPermission(apiKey, permission)) {
        throw new APIKeyError(
          `Missing required permission: ${permission}`,
          "AUTH_FORBIDDEN"
        )
      }
    }

    ctx.apiKeyId = apiKey.id
    ctx.permissions = apiKey.permissions

    await next()
  }
}

// 自定义错误类
export class APIKeyError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = "APIKeyError"
    this.code = code
  }
}

// 简化实现：不使用复杂的 JWT
export const auth = {
  generateAPIKey,
  createAPIKey,
  validateAPIKey,
  revokeAPIKey,
  hasPermission,
  loadAPIKeys,
  listAPIKeys,
  extractAPIKey,
  authMiddleware,
  APIKeyError,
}
