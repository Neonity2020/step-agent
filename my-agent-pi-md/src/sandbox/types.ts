// ============================================================
// Sandbox Types - 沙箱安全类型
// ============================================================

// 权限级别
export enum PermissionLevel {
  NONE = 0,       // 无权限
  READ = 1,       // 只读
  WRITE = 2,      // 读写
  EXECUTE = 3,   // 可执行命令
  ADMIN = 4,      // 完全权限
}

// 资源类型
export type ResourceType = "file" | "directory" | "command" | "network" | "env"

// 资源权限
export interface ResourcePermission {
  type: ResourceType
  path?: string // 路径模式 (支持 glob)
  actions: ("read" | "write" | "execute" | "list")[]
  recursive?: boolean
}

// 安全策略
export interface SecurityPolicy {
  id: string
  name: string
  description: string
  level: PermissionLevel
  permissions: ResourcePermission[]
  blockedCommands: string[] // 命令黑名单
  allowedCommands: string[] // 命令白名单
  maxFileSize?: number // 最大文件大小 (bytes)
  maxExecutionTime?: number // 最大执行时间 (ms)
  envWhitelist?: string[] // 允许的环境变量
  networkAllowed?: boolean // 是否允许网络请求
  dangerousFlags?: string[] // 危险命令行标志
}

// 执行结果
export interface ExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  duration: number
  blocked?: boolean
  blockedReason?: string
  warnings?: string[]
}

// 文件操作结果
export interface FileOperationResult {
  success: boolean
  path: string
  operation: "read" | "write" | "edit" | "delete" | "list"
  blocked?: boolean
  blockedReason?: string
  content?: string
  error?: string
}

// 访问日志
export interface AccessLog {
  timestamp: number
  action: string
  resource: string
  allowed: boolean
  reason?: string
}

// 沙箱配置
export interface SandboxConfig {
  enabled: boolean
  defaultPolicy: string // 策略 ID
  policies: SecurityPolicy[]
  workspaceRoot: string // 工作区根目录
  homeAccess: boolean // 是否允许访问 home 目录
  allowedPaths: string[] // 允许的路径列表
  blockedPaths: string[] // 禁止的路径列表
  dryRun?: boolean // 试运行模式（只警告不阻止）
}

// 危险命令模式
export interface DangerousPattern {
  pattern: RegExp
  description: string
  severity: "high" | "medium" | "low"
}

// 安全事件
export interface SecurityEvent {
  type: "blocked" | "warning" | "allowed" | "policy_violation"
  timestamp: number
  action: string
  resource: string
  policy: string
  details: Record<string, any>
}
