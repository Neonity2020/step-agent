// ============================================================
// Sandbox Validator - 沙箱验证器
// ============================================================

import { existsSync } from "fs"
import { join, resolve, relative, isAbsolute } from "path"
import { statSync } from "fs"
import type { SecurityPolicy, AccessLog } from "./types"

// 危险命令检测
const DANGEROUS_PATTERNS = [
  { pattern: /rm\s+-rf\s+\//, message: "Attempting to delete root directory", severity: "high" },
  { pattern: /rm\s+-rf\s+\*\s*$/, message: "Recursive delete all files", severity: "high" },
  { pattern: /:\(\)\{:\|:&\};:/, message: "Fork bomb detected", severity: "high" },
  { pattern: /dd\s+if=.*of=\/dev\//, message: "Direct disk write", severity: "high" },
  { pattern: /sudo\s+su/, message: "Privilege escalation attempt", severity: "high" },
  { pattern: /wget.*\|.*sh/, message: "Download and execute", severity: "high" },
  { pattern: /curl.*\|.*sh/, message: "Download and execute", severity: "high" },
  { pattern: /chmod\s+-R?\s*777\s+\//, message: "Making system files world-writable", severity: "high" },
  { pattern: /chmod\s+-R?\s*777\s+\./, message: "Recursive chmod 777", severity: "medium" },
  { pattern: /mkfs/, message: "Filesystem format attempt", severity: "high" },
  { pattern: />\s*\/dev\/sda/, message: "Direct device write", severity: "high" },
  { pattern: /git\s+filter-branch/, message: "Git history rewrite", severity: "medium" },
  { pattern: /git\s+push\s+--force/, message: "Force push (may overwrite history)", severity: "medium" },
  { pattern: /git\s+push\s+--all/, message: "Push all branches", severity: "low" },
  { pattern: /rm\s+-rf\s+\.git/, message: "Delete .git directory", severity: "high" },
  { pattern: /exec\s+>/, message: "File descriptor manipulation", severity: "medium" },
  { pattern: /eval\s+\`/, message: "Eval with command substitution", severity: "high" },
  { pattern: /source\s+\/dev\/null/, message: "Strange source pattern", severity: "medium" },
]

// 路径遍历模式
const PATH_TRAVERSAL_PATTERNS = [
  "..",
  "../..",
  "../../..",
  "../../../..",
  "%2e%2e%2f",
  "%2e%2e/",
  "..%2f",
  "..%2f..%2f",
  "....//",
]

export class SandboxValidator {
  private policy: SecurityPolicy
  private workspaceRoot: string
  private accessLogs: AccessLog[] = []
  private warnings: string[] = []

  constructor(policy: SecurityPolicy, workspaceRoot: string) {
    this.policy = policy
    this.workspaceRoot = resolve(workspaceRoot)
  }

  // 验证命令
  validateCommand(command: string): { allowed: boolean; reason?: string; warnings?: string[] } {
    const warnings: string[] = []

    // 检查危险模式
    for (const p of DANGEROUS_PATTERNS) {
      if (p.pattern.test(command)) {
        this.log("command", command, false, p.message)
        return { allowed: false, reason: p.message, warnings }
      }
    }

    // 检查策略黑名单
    for (const blocked of this.policy.blockedCommands) {
      if (this.matchPattern(command, blocked)) {
        const reason = `Command matches blocked pattern: ${blocked}`
        this.log("command", command, false, reason)
        return { allowed: false, reason, warnings }
      }
    }

    // 检查策略白名单
    if (this.policy.allowedCommands.length > 0) {
      const cmdName = command.trim().split(/\s+/)[0]
      if (!this.policy.allowedCommands.some((c) => command.startsWith(c))) {
        const reason = `Command not in allowed list: ${cmdName}`
        this.log("command", command, false, reason)
        return { allowed: false, reason, warnings }
      }
    }

    // 检查危险标志
    if (this.policy.dangerousFlags && this.policy.dangerousFlags.length > 0) {
      for (const flag of this.policy.dangerousFlags) {
        if (command.includes(flag)) {
          warnings.push(`Command contains flag: ${flag}`)
        }
      }
    }

    this.log("command", command, true)
    return { allowed: true, warnings }
  }

  // 验证文件路径
  validatePath(path: string, action: "read" | "write" | "execute" | "list"): { 
    allowed: boolean; 
    reason?: string; 
    resolvedPath?: string 
  } {
    const resolved = isAbsolute(path) ? path : join(this.workspaceRoot, path)

    // 检查路径遍历
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (path.includes(pattern)) {
        return {
          allowed: false,
          reason: "Path traversal attempt detected",
          resolvedPath: resolved,
        }
      }
    }

    // 检查是否在允许的路径内
    const relativePath = relative(this.workspaceRoot, resolved)

    // 允许工作区内的文件
    if (!relativePath.startsWith("..") && !isAbsolute(relativePath)) {
      return { allowed: true, resolvedPath: resolved }
    }

    // 检查 home 目录访问
    if (path.startsWith("~") || path.startsWith(Bun.env.HOME || "/home")) {
      if (this.policy.level < 3) {
        return { allowed: false, reason: "Home directory access not allowed in this policy" }
      }
      return { allowed: true, resolvedPath: resolved }
    }

    // 检查绝对路径
    if (isAbsolute(path)) {
      if (this.policy.level < 3) {
        return { allowed: false, reason: "Absolute paths not allowed in this policy" }
      }
      return { allowed: true, resolvedPath: resolved }
    }

    // 检查危险路径
    const dangerousPaths = ["/etc/passwd", "/etc/shadow", "/etc/sudoers", "/.ssh", "/.aws"]
    for (const dp of dangerousPaths) {
      if (resolved.startsWith(dp)) {
        return { allowed: false, reason: `Access to sensitive path not allowed: ${dp}` }
      }
    }

    return { allowed: true, resolvedPath: resolved }
  }

  // 验证文件操作
  validateFileOperation(
    path: string,
    operation: "read" | "write" | "edit" | "delete"
  ): { allowed: boolean; reason?: string; resolvedPath?: string } {
    // 只读策略不允许写操作
    if (this.policy.level <= 1 && (operation === "write" || operation === "edit" || operation === "delete")) {
      return { allowed: false, reason: "Read-only policy: file modification not allowed" }
    }

    // 验证路径
    const pathValidation = this.validatePath(path, operation === "read" ? "read" : "write")
    if (!pathValidation.allowed) {
      return pathValidation
    }

    // 检查文件大小（写操作时）
    if ((operation === "write" || operation === "edit") && this.policy.maxFileSize) {
      if (existsSync(pathValidation.resolvedPath!)) {
        try {
          const stats = statSync(pathValidation.resolvedPath!)
          if (stats.size > this.policy.maxFileSize) {
            return {
              allowed: false,
              reason: `File too large: ${stats.size} bytes (max: ${this.policy.maxFileSize})`,
            }
          }
        } catch {}
      }
    }

    // 禁止删除敏感文件
    if (operation === "delete") {
      const sensitive = ["package.json", "tsconfig.json", ".gitignore", ".env", ".npmrc"]
      for (const s of sensitive) {
        if (path.endsWith(s)) {
          return {
            allowed: false,
            reason: `Deleting sensitive file not allowed: ${s}`,
          }
        }
      }
    }

    return pathValidation
  }

  // 验证环境变量
  validateEnvVar(name: string): boolean {
    if (this.policy.level >= 4) return true // ADMIN 级别允许所有
    if (!this.policy.envWhitelist) return false

    if (this.policy.envWhitelist.includes("*")) return true
    if (this.policy.envWhitelist.includes(name)) return true
    if (name.startsWith("npm_config_") && this.policy.envWhitelist.includes("npm_config_*")) return true
    if (name.startsWith("bun_") && this.policy.envWhitelist.includes("bun_*")) return true

    return false
  }

  // 获取所有环境变量
  filterEnvVars(env: Record<string, string | undefined>): Record<string, string | undefined> {
    const filtered: Record<string, string | undefined> = {}

    for (const [key, value] of Object.entries(env)) {
      if (this.validateEnvVar(key)) {
        filtered[key] = value
      }
    }

    return filtered
  }

  // 获取访问日志
  getLogs(): AccessLog[] {
    return [...this.accessLogs]
  }

  // 获取警告
  getWarnings(): string[] {
    return [...this.warnings]
  }

  // 清除日志
  clearLogs(): void {
    this.accessLogs = []
    this.warnings = []
  }

  // 记录访问
  private log(action: string, resource: string, allowed: boolean, reason?: string): void {
    this.accessLogs.push({
      timestamp: Date.now(),
      action,
      resource: resource.slice(0, 200), // 截断长资源路径
      allowed,
      reason,
    })

    // 限制日志大小
    if (this.accessLogs.length > 1000) {
      this.accessLogs = this.accessLogs.slice(-500)
    }
  }

  // 模式匹配
  private matchPattern(text: string, pattern: string): boolean {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\//g, "\\/"))
      return regex.test(text)
    }
    return text.includes(pattern)
  }

  // 获取当前策略
  getPolicy(): SecurityPolicy {
    return { ...this.policy }
  }

  // 获取工作区根目录
  getWorkspaceRoot(): string {
    return this.workspaceRoot
  }
}
