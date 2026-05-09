// ============================================================
// SOUL.md Types - Agent 人格化配置类型
// ============================================================

// Agent 身份
export interface AgentIdentity {
  name?: string
  title?: string
  avatar?: string
  description?: string
  tagline?: string
}

// 性格特征
export interface PersonalityTraits {
  // 主要特征
  openness?: number // 1-100: 开放程度
  conscientiousness?: number // 1-100: 责任感
  extraversion?: number // 1-100: 外向程度
  agreeableness?: number // 1-100: 随和程度
  stability?: number // 1-100: 情绪稳定

  // 自定义特征
  traits?: string[] // 如: "creative", "analytical", "empathetic"
}

// 说话风格
export interface SpeakingStyle {
  // 正式程度
  formality?: "formal" | "semi-formal" | "casual" | "very-casual"

  // 技术深度
  technicalDepth?: "beginner" | "intermediate" | "expert"

  // 响应长度
  verbosity?: "concise" | "moderate" | "detailed" | "comprehensive"

  // 语气
  tone?: string[] // 如: "friendly", "professional", "playful", "serious"

  // 语言特点
  languageStyle?: string[] // 如: "uses metaphors", "includes examples"
  phrases?: string[] // 常用短语

  // 格式偏好
  formatting?: {
    useEmoji?: boolean
    useMarkdown?: boolean
    useCodeBlocks?: boolean
    bulletPoints?: boolean
  }
}

// 专业领域
export interface Expertise {
  primary?: string[] // 主要领域
  secondary?: string[] // 次要领域
  languages?: string[] // 编程语言
  frameworks?: string[] // 框架
  tools?: string[] // 工具
}

// 价值观和原则
export interface Values {
  principles?: string[] // 核心原则
  codeOfConduct?: string[] // 行为准则
  doNotDo?: string[] // 不做的事
  alwaysDo?: string[] // 始终做的事
}

// 工作方式
export interface WorkStyle {
  communication?: string[] // 沟通方式
  problemSolving?: string[] // 解决问题的方式
  decisionMaking?: string[] // 决策方式
  creativity?: "low" | "medium" | "high"
  riskTolerance?: "conservative" | "balanced" | "adventurous"
}

// 偏好设置
export interface Preferences {
  // UI 偏好
  theme?: "dark" | "light" | "auto"
  colorScheme?: string

  // 工具偏好
  preferredTools?: string[]
  avoidedTools?: string[]

  // 代码风格
  preferredLanguage?: string
  codeStyle?: string

  // 其他
  timezone?: string
  language?: string
}

// 背景故事（用于角色扮演）
export interface Backstory {
  origin?: string // 来历
  experience?: string[] // 经验
  achievements?: string[] // 成就
  motivations?: string[] // 动机
  fears?: string[] // 担忧/恐惧
}

// 能力限制
export interface Capabilities {
  maxContextLength?: number
  maxToolCalls?: number
  canReadFiles?: boolean
  canWriteFiles?: boolean
  canExecuteCommands?: boolean
  canAccessInternet?: boolean
}

// 情绪响应
export interface EmotionalResponse {
  onSuccess?: string // 成功时的反应
  onFailure?: string // 失败时的反应
  onFrustration?: string // 沮丧时的反应
  onPraise?: string // 被表扬时的反应
  onQuestion?: string // 被质疑时的反应
}

// 解析后的 SOUL.md 内容
export interface SoulMDContent {
  // 身份
  identity?: AgentIdentity

  // 性格
  personality?: PersonalityTraits

  // 说话风格
  speakingStyle?: SpeakingStyle

  // 专业
  expertise?: Expertise

  // 价值观
  values?: Values

  // 工作方式
  workStyle?: WorkStyle

  // 偏好
  preferences?: Preferences

  // 背景
  backstory?: Backstory

  // 能力
  capabilities?: Capabilities

  // 情绪
  emotions?: EmotionalResponse

  // 自定义系统提示
  customSystemPrompt?: string

  // 原始内容
  raw?: string
}

// SOUL.md 文件信息
export interface SoulMDFile {
  path: string
  exists: boolean
  content?: string
}

// Agent 配置
export interface AgentConfig {
  soul: SoulMDContent
  systemPrompt: string
}

// 预设人格
export interface PresetPersonality {
  id: string
  name: string
  description: string
  soul: SoulMDContent
}
