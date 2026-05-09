// ============================================================
// Gateway - API 网关模块
// ============================================================

export { GatewayServer, type ChatRequest, type ChatResponse } from "./server"
export { Router, createRouter, router } from "./router"
export {
  auth,
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
} from "./auth"
export {
  ratelimit,
  checkRateLimit,
  rateLimitMiddleware,
  createAPIKeyRateLimiter,
  createEndpointRateLimiter,
  getRateLimitStats,
  resetRateLimit,
  RateLimitExceededError,
} from "./ratelimit"
export {
  createAPIResponse,
  createErrorResponse,
  createRateLimitResponse,
  errors,
  validateRequired,
  requireFields,
} from "./response"

export type {
  GatewayConfig,
  APIKeyConfig,
  Permission,
  RateLimit,
  RequestContext,
  APIResponse,
  APIError,
  ResponseMeta,
  RateLimitInfo,
  SessionInfo,
  GatewayStats,
  Middleware,
  Route,
  WebhookConfig,
  WebhookEvent,
  AuthMethod,
} from "./types"
