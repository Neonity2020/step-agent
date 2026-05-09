// ============================================================
// Skills Types - 技能类型定义
// ============================================================
// 
// 兼容 Claude Code 的 SKILL.md 格式
// 参考: https://docs.anthropic.com/en/docs/claude-code/skills
// ============================================================

// 技能元数据
export interface SkillMeta {
  name?: string
  description?: string
  version?: string
  author?: string
  tags?: string[]
  trigger?: SkillTrigger
}

// 触发条件
export interface SkillTrigger {
  // 匹配模式（支持 glob 和正则）
  patterns?: string[]
  // 关键词匹配
  keywords?: string[]
  // 文件类型
  fileTypes?: string[]
  // 命令匹配
  commands?: string[]
}

// 技能步骤
export interface SkillStep {
  // 步骤编号
  order: number
  // 步骤描述
  description: string
  // 使用的工具
  tool?: string
  // 工具参数
  toolArgs?: Record<string, unknown>
  // 是否可选
  optional?: boolean
  // 条件执行
  condition?: string
}

// 技能定义
export interface Skill {
  // 元数据
  meta: SkillMeta
  
  // 使用说明
  usage?: string
  example?: string
  examples?: string[]
  
  // 触发条件
  trigger?: SkillTrigger
  
  // 执行步骤
  steps?: SkillStep[]
  
  // 系统提示（追加到 Agent）
  systemPrompt?: string
  
  // 工具列表
  tools?: string[]
  
  // 约束条件
  constraints?: string[]
  
  // 原始内容（从文件解析）
  raw?: string
}

// 技能执行上下文
export interface SkillContext {
  userMessage: string
  currentFiles?: string[]
  cwd: string
  env: Record<string, string>
}

// 技能执行结果
export interface SkillMatch {
  skill: Skill
  score: number // 匹配分数 0-100
  matchedOn: string[] // 匹配原因
}

// 技能加载选项
export interface SkillOptions {
  dir?: string
  autoLoad?: boolean
  minScore?: number // 最小匹配分数
}

// 技能市场条目（用于展示）
export interface SkillListing {
  name: string
  description: string
  path: string
  tags: string[]
  enabled: boolean
}

// 默认触发阈值
export const DEFAULT_MIN_SCORE = 50

// 常见触发模式
export const COMMON_PATTERNS = {
  // 代码审查
  codeReview: ["review", "audit", "check", "lint"],
  
  // 测试
  testing: ["test", "spec", "unit", "integration"],
  
  // 文档
  documentation: ["docs", "readme", "document"],
  
  // 重构
  refactoring: ["refactor", "restructure", "improve"],
  
  // 调试
  debugging: ["debug", "fix", "error", "bug"],
  
  // 部署
  deployment: ["deploy", "release", "publish"],
  
  // 安全
  security: ["security", "vulnerability", "audit"],
  
  // 性能
  performance: ["performance", "optimize", "fast"],
} as const
