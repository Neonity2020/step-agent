// ============================================================
// Gateway Response - 响应辅助
// ============================================================

import type { APIResponse, ResponseMeta, RateLimitInfo } from "./types"

// 创建成功响应
export function createAPIResponse<T = any>(
  data: T,
  meta?: Partial<ResponseMeta>
): APIResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      ...meta,
    },
  }
}

// 创建错误响应
export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  meta?: Partial<ResponseMeta>
): APIResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      requestId: `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      ...meta,
    },
  }
}

// 创建限流响应
export function createRateLimitResponse(
  info: RateLimitInfo,
  meta?: Partial<ResponseMeta>
): APIResponse {
  return createErrorResponse(
    "RATE_LIMIT_EXCEEDED",
    "Rate limit exceeded. Please try again later.",
    { retryAfter: Math.ceil((info.reset - Date.now()) / 1000) },
    { ...meta, rateLimit: info }
  )
}

// 常用错误响应
export const errors = {
  notFound: (resource?: string) =>
    createErrorResponse(
      "NOT_FOUND",
      resource ? `${resource} not found` : "Resource not found"
    ),

  unauthorized: (message = "Authentication required") =>
    createErrorResponse("UNAUTHORIZED", message),


  forbidden: (message = "Access denied") =>
    createErrorResponse("FORBIDDEN", message),

  badRequest: (message: string) =>
    createErrorResponse("BAD_REQUEST", message),

  invalidInput: (details: any) =>
    createErrorResponse("INVALID_INPUT", "Invalid input provided", details),

  internalError: (message = "Internal server error") =>
    createErrorResponse("INTERNAL_ERROR", message),

  serviceUnavailable: (message = "Service temporarily unavailable") =>
    createErrorResponse("SERVICE_UNAVAILABLE", message),
}

// 验证辅助
export function validateRequired(obj: Record<string, any>, fields: string[]): string[] {
  const missing: string[] = []
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") {
      missing.push(field)
    }
  }
  return missing
}

export function requireFields(obj: Record<string, any>, fields: string[]): void {
  const missing = validateRequired(obj, fields)
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`)
  }
}
