// ============================================================
// Extension Base - 扩展接口定义
// ============================================================

import type { Message } from "../types/index.ts"
import type { Tool } from "../tools/base.ts"
import type { Provider } from "../providers/base.ts"

// 扩展元数据
export interface ExtensionMeta {
  name: string
  version: string
  description?: string
  author?: string
}

// 扩展接口
export interface Extension {
  // 元数据
  meta: ExtensionMeta

  // 注册扩展
  register(api: ExtensionAPI): void | Promise<void>

  // 卸载扩展（可选）
  unregister?(): void
}

// 扩展 API（扩展可以调用的接口）
export interface ExtensionAPI {
  // ===== 注册 =====
  
  // 注册工具
  registerTool(tool: Tool): void
  
  // 注销工具
  unregisterTool(name: string): void
  
  // 注册命令
  registerCommand(command: Command): void
  
  // 注销命令
  unregisterCommand(name: string): void
  
  // 注册 Provider
  registerProvider(provider: Provider): void

  // ===== 事件钩子 =====
  
  // 监听事件
  on(event: ExtensionEvent, handler: EventHandler): void
  
  // 移除监听
  off(event: ExtensionEvent, handler: EventHandler): void
  
  // 发送事件
  emit(event: ExtensionEvent, data: EventData): void

  // ===== 配置 =====
  
  // 获取配置
  getConfig(): AgentConfig
  
  // 设置配置
  setConfig(config: Partial<AgentConfig>): void
  
  // 获取设置
  getSettings(): Record<string, unknown>
  
  // 设置
  setSetting(key: string, value: unknown): void

  // ===== 日志 =====
  
  log(message: string, level?: "info" | "warn" | "error"): void
}

// 事件类型
export type ExtensionEvent = 
  | "before_chat"
  | "after_chat"
  | "before_tool"
  | "after_tool"
  | "user_message"
  | "assistant_message"
  | "error"

// 事件数据
export interface EventData {
  event: ExtensionEvent
  messages?: Message[]
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  response?: string
  error?: Error
}

// 事件处理器
export type EventHandler = (data: EventData, api: ExtensionAPI) => void | Promise<void>

// 命令
export interface Command {
  name: string
  description: string
  usage?: string
  execute(args: string[], api: ExtensionAPI): void | Promise<void>
}

// Agent 配置
export interface AgentConfig {
  systemPrompt?: string
  maxIterations?: number
  verbose?: boolean
  extensions?: string[]
}

// 扩展加载选项
export interface ExtensionOptions {
  dir?: string          // 扩展目录
  plugins?: Extension[]  // 直接传入的扩展
  autoLoad?: boolean    // 是否自动加载
}
