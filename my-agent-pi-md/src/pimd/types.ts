// ============================================================
// Pi.md Types - 项目说明文件类型
// ============================================================

// 项目配置
export interface ProjectConfig {
  name?: string
  description?: string
  language?: string
  framework?: string
  repository?: string
}

// 依赖项
export interface Dependency {
  name: string
  version?: string
  description?: string
  isDev?: boolean
}

// 项目结构
export interface ProjectStructure {
  root?: string
  directories: Directory[]
  files: File[]
}

export interface Directory {
  path: string
  description?: string
}

export interface File {
  path: string
  description?: string
  importance?: "high" | "medium" | "low"
}

// 构建命令
export interface BuildCommand {
  name: string
  command: string
  description?: string
}

// 测试配置
export interface TestConfig {
  framework: string
  patterns?: string[]
  directory?: string
}

// 编码规范
export interface CodingStandards {
  language?: string
  style?: string
  rules?: string[]
}

// 主要入口点
export interface EntryPoint {
  path: string
  description?: string
}

// 部署配置
export interface DeploymentConfig {
  platform?: string
  buildCommand?: string
  outputDirectory?: string
  envVars?: EnvVar[]
}

export interface EnvVar {
  name: string
  description?: string
  required?: boolean
}

// 第三方服务
export interface ThirdPartyService {
  name: string
  purpose?: string
  apiKey?: string
}

// 解析后的 pi.md 内容
export interface PiMDContent {
  // 基本信息
  project?: ProjectConfig
  description?: string

  // 结构
  directories?: Directory[]
  files?: File[]
  entryPoints?: EntryPoint[]

  // 依赖
  dependencies?: Dependency[]

  // 命令
  commands?: BuildCommand[]
  tests?: TestConfig

  // 规范
  standards?: CodingStandards

  // 部署
  deployment?: DeploymentConfig

  // 服务
  services?: ThirdPartyService[]

  // 自定义规则
  rules?: string[]
  guidelines?: string[]

  // 自定义提示
  customInstructions?: string

  // 原始内容
  raw?: string
}

// 发现的文件
export interface PiMDFile {
  path: string
  type: "pi.md" | "AGENTS.md" | "CLAUDE.md"
  exists: boolean
  content?: string
}

// 分析结果
export interface ProjectAnalysis {
  projectConfig?: ProjectConfig
  structure?: ProjectStructure
  dependencies?: Dependency[]
  buildCommands?: BuildCommand[]
  errors?: string[]
  warnings?: string[]
}
