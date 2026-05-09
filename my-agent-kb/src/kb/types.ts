// ============================================================
// Knowledge Base Types - 知识库类型定义
// ============================================================

// 知识条目类型
export type KBEntryType = 
  | "project"      // 项目信息
  | "decision"     // 重要决策
  | "pattern"      // 代码模式
  | "task"        // 任务摘要
  | "context"     // 上下文摘要
  | "note"        // 笔记
  | "rule"        // 规则/约定

// 知识条目
export interface KBEntry {
  id: string
  type: KBEntryType
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
  importance: number      // 0-100，重要性
  sessionId?: string     // 来源会话
  expiresAt?: string     // 过期时间（可选）
}

// 知识库配置
export interface KBConfig {
  directory: string
  maxEntries: number
  autoSave: boolean
  compressionEnabled: boolean
}

// 搜索结果
export interface KBSearchResult {
  entry: KBEntry
  score: number
  matchedOn: string[]
}

// 知识库统计
export interface KBStats {
  totalEntries: number
  byType: Record<KBEntryType, number>
  byTag: Record<string, number>
  lastUpdated: string
  totalSize: number
}

// 默认配置
export const DEFAULT_KB_CONFIG: KBConfig = {
  directory: "",
  maxEntries: 1000,
  autoSave: true,
  compressionEnabled: true,
}

// 重要性等级
export const IMPORTANCE_LEVELS = {
  CRITICAL: 90,   // 必须保留
  HIGH: 70,       // 重要
  MEDIUM: 50,     // 一般
  LOW: 30,        // 可丢弃
  TEMPORARY: 10,  // 临时
} as const
