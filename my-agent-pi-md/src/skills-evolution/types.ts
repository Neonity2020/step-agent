// ============================================================
// Skills Evolution Types - 自进化系统类型
// ============================================================

// 工作流步骤
export interface WorkflowStep {
  stepNumber: number
  action: string // 动作描述
  tool?: string // 使用的工具
  input?: Record<string, any> // 输入参数
  output?: string // 输出摘要
  reasoning?: string // 为什么这么做
}

// 检测到的工作流
export interface DetectedWorkflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  category?: string // 分类
  tags?: string[]
  confidence: number // 0-100 置信度
  usageCount: number // 使用次数
  createdAt: string
  lastUsed?: string
  effectiveness?: number // 效果评分
  errorCount?: number // 错误次数
}

// 工作流模式
export interface WorkflowPattern {
  pattern: string // 模式描述
  steps: string[] // 步骤描述
  frequency: number // 出现频率
  lastSeen?: string
}

// 候选技能
export interface SkillCandidate {
  id: string
  name: string
  description: string
  
  // 内容
  instruction: string
  examples?: string[]
  variables?: SkillVariable[]
  
  // 元数据
  category: string
  tags: string[]
  confidence: number
  
  // 来源
  sourceWorkflow?: string // 来源工作流 ID
  extractedFrom?: string // 从哪个对话提取
  createdAt: string
  
  // 状态
  status: "candidate" | "approved" | "rejected" | "published"
  
  // 评估
  effectiveness?: number
  usageStats?: {
    total: number
    success: number
    failure: number
  }
}

// 技能变量
export interface SkillVariable {
  name: string
  description: string
  type: "string" | "number" | "boolean" | "path" | "selection"
  required?: boolean
  default?: any
  options?: string[] // for selection type
}

// 自进化配置
export interface EvolutionConfig {
  enabled: boolean
  autoDetect: boolean // 自动检测工作流
  autoSuggest: boolean // 自动建议生成
  minConfidence: number // 最小置信度
  minUsageCount: number // 最小使用次数
  workflowDir: string // 工作流存储目录
  candidateDir: string // 候选技能目录
  skillsDir: string // 最终技能目录
  maxCandidates: number // 最大候选数
}

// 自进化统计
export interface EvolutionStats {
  workflowsDetected: number
  candidatesGenerated: number
  skillsApproved: number
  skillsPublished: number
  totalEffectiveness: number
}

// 进化事件
export interface EvolutionEvent {
  type: "workflow_detected" | "candidate_generated" | "skill_approved" | "skill_rejected" | "skill_published"
  timestamp: string
  data: Record<string, any>
}

// 工作流评估
export interface WorkflowEvaluation {
  workflowId: string
  effectiveness: number // 1-10
  efficiency: number // 1-10
  reusability: number // 1-10
  overallScore: number
  improvements?: string[]
  notes?: string
}

// 生成的 SKILL.md 内容
export interface GeneratedSkill {
  name: string
  description: string
  category: string
  tags: string[]
  instruction: string
  examples?: string[]
  variables?: SkillVariable[]
  metadata?: {
    generated: string
    source: string
    confidence: number
    version: string
  }
}
