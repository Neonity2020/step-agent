// ============================================================
// Sandbox Manager - 沙箱管理器
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs"
import { join } from "path"
import { SandboxExecutor } from "./executor"
import { POLICIES, getPolicy, listPolicies } from "./policies"
import type { SecurityPolicy, SandboxConfig, ExecutionResult, FileOperationResult, SecurityEvent } from "./types"

export class SandboxManager {
  private config: SandboxConfig
  private executor: SandboxExecutor | null = null
  private currentPolicy: SecurityPolicy
  private events: SecurityEvent[] = []
  private enabled: boolean = true

  constructor(config?: Partial<SandboxConfig>) {
    // 默认配置
    this.config = {
      enabled: config?.enabled ?? true,
      defaultPolicy: config?.defaultPolicy || "balanced",
      policies: config?.policies || [],
      workspaceRoot: config?.workspaceRoot || process.cwd(),
      homeAccess: config?.homeAccess ?? false,
      allowedPaths: config?.allowedPaths || [],
      blockedPaths: config?.blockedPaths || [],
      dryRun: config?.dryRun ?? false,
    }

    // 加载策略
    const defaultPolicy = getPolicy(this.config.defaultPolicy)
    this.currentPolicy = defaultPolicy || POLICIES.balanced

    // 创建执行器
    this.recreateExecutor()
  }

  // 重新创建执行器
  private recreateExecutor(): void {
    this.executor = new SandboxExecutor(
      this.currentPolicy,
      this.config.workspaceRoot,
      this.config.dryRun
    )
  }

  // 启用/禁用沙箱
  enable(): void {
    this.enabled = true
    this.logEvent("allowed", "sandbox", "Sandbox enabled")
  }

  disable(): void {
    this.enabled = false
    this.logEvent("blocked", "sandbox", "Sandbox disabled")
  }

  isEnabled(): boolean {
    return this.enabled
  }

  // 设置策略
  setPolicy(policyId: string): boolean {
    const policy = getPolicy(policyId)
    if (!policy) {
      return false
    }

    this.currentPolicy = policy
    this.recreateExecutor()
    this.logEvent("allowed", "policy", `Policy changed to: ${policy.name}`)
    return true
  }

  // 获取当前策略
  getPolicy(): SecurityPolicy {
    return { ...this.currentPolicy }
  }

  // 获取所有策略
  getPolicies() {
    return listPolicies()
  }

  // 执行命令
  async executeCommand(command: string, cwd?: string, env?: Record<string, string | undefined>): Promise<ExecutionResult> {
    if (!this.enabled) {
      // 沙箱禁用，直接执行
      return this.executeUnprotected(command, cwd, env)
    }

    const result = await this.executor!.executeCommand(command, cwd, env)

    this.logEvent(result.blocked ? "blocked" : result.success ? "allowed" : "warning", "command", command, {
      exitCode: result.exitCode,
      blocked: result.blocked,
    })

    return result
  }

  // 执行命令（无保护）
  private async executeUnprotected(
    command: string,
    cwd?: string,
    env?: Record<string, string | undefined>
  ): Promise<ExecutionResult> {
    const startTime = Date.now()

    try {
      const proc = Bun.spawn(["/bin/sh", "-c", command], {
        cwd: cwd || this.config.workspaceRoot,
        env: env || process.env as Record<string, string>,
        stdout: "pipe",
        stderr: "pipe",
      })

      let stdout = ""
      let stderr = ""

      if (proc.stdout) {
        stdout = await new Response(proc.stdout).text()
      }
      if (proc.stderr) {
        stderr = await new Response(proc.stderr).text()
      }

      const exitCode = proc.exitCode ?? 1

      return {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        duration: Date.now() - startTime,
      }
    }
  }

  // 读取文件
  readFile(path: string): FileOperationResult {
    if (!this.enabled) {
      return this.readFileUnprotected(path)
    }

    const result = this.executor!.readFile(path)
    this.logEvent(result.blocked ? "blocked" : "allowed", "file:read", path)
    return result
  }

  // 读取文件（无保护）
  private readFileUnprotected(path: string): FileOperationResult {
    try {
      if (!existsSync(path)) {
        return { success: false, path, operation: "read", error: "File not found" }
      }
      const content = readFileSync(path, "utf-8")
      return { success: true, path, operation: "read", content }
    } catch (error) {
      return {
        success: false,
        path,
        operation: "read",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 写入文件
  writeFile(path: string, content: string): FileOperationResult {
    if (!this.enabled) {
      return this.writeFileUnprotected(path, content)
    }

    const result = this.executor!.writeFile(path, content)
    this.logEvent(result.blocked ? "blocked" : "allowed", "file:write", path)
    return result
  }

  // 写入文件（无保护）
  private writeFileUnprotected(path: string, content: string): FileOperationResult {
    try {
      const dir = join(path, "..")
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(path, content, "utf-8")
      return { success: true, path, operation: "write" }
    } catch (error) {
      return {
        success: false,
        path,
        operation: "write",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 编辑文件
  editFile(path: string, oldText: string, newText: string): FileOperationResult {
    if (!this.enabled) {
      return this.editFileUnprotected(path, oldText, newText)
    }

    const result = this.executor!.editFile(path, oldText, newText)
    this.logEvent(result.blocked ? "blocked" : "allowed", "file:edit", path)
    return result
  }

  // 编辑文件（无保护）
  private editFileUnprotected(path: string, oldText: string, newText: string): FileOperationResult {
    try {
      if (!existsSync(path)) {
        return { success: false, path, operation: "edit", error: "File not found" }
      }
      const content = readFileSync(path, "utf-8")
      if (!content.includes(oldText)) {
        return { success: false, path, operation: "edit", error: "Text not found" }
      }
      const newContent = content.replace(oldText, newText)
      writeFileSync(path, newContent, "utf-8")
      return { success: true, path, operation: "edit" }
    } catch (error) {
      return {
        success: false,
        path,
        operation: "edit",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 列出目录
  listDirectory(path: string): FileOperationResult {
    if (!this.enabled) {
      return this.listDirectoryUnprotected(path)
    }

    const result = this.executor!.listDirectory(path)
    this.logEvent(result.blocked ? "blocked" : "allowed", "directory:list", path)
    return result
  }

  // 列出目录（无保护）
  private listDirectoryUnprotected(path: string): FileOperationResult {
    try {
      const entries = readdirSync(path)
      return {
        success: true,
        path,
        operation: "list",
        content: entries.join("\n"),
      }
    } catch (error) {
      return {
        success: false,
        path,
        operation: "list",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 启用/禁用试运行模式
  setDryRun(enabled: boolean): void {
    this.config.dryRun = enabled
    this.executor?.setDryRun(enabled)
  }

  // 获取配置
  getConfig(): SandboxConfig {
    return { ...this.config }
  }

  // 更新配置
  updateConfig(config: Partial<SandboxConfig>): void {
    Object.assign(this.config, config)
    if (config.defaultPolicy) {
      const policy = getPolicy(config.defaultPolicy)
      if (policy) {
        this.currentPolicy = policy
        this.recreateExecutor()
      }
    }
  }

  // 获取事件日志
  getEvents(): SecurityEvent[] {
    return [...this.events]
  }

  // 获取访问日志
  getAccessLogs() {
    return this.executor?.getAccessLogs() || []
  }

  // 清空日志
  clearLogs(): void {
    this.events = []
    this.executor?.getValidator().clearLogs()
  }

  // 记录安全事件
  private logEvent(type: SecurityEvent["type"], action: string, resource: string, details?: Record<string, any>): void {
    this.events.push({
      type,
      timestamp: Date.now(),
      action,
      resource,
      policy: this.currentPolicy.id,
      details: details || {},
    })

    // 限制事件数量
    if (this.events.length > 500) {
      this.events = this.events.slice(-250)
    }
  }

  // 打印安全报告
  printReport(): void {
    const events = this.getEvents()

    const blocked = events.filter(e => e.type === "blocked").length
    const warnings = events.filter(e => e.type === "warning").length

    console.log("\n" + "─".repeat(50))
    console.log("🔒 Security Report")
    console.log("─".repeat(50))
    console.log(`Policy: ${this.currentPolicy.name} (${this.currentPolicy.id})`)
    console.log(`Status: ${this.enabled ? "🟢 Enabled" : "🔴 Disabled"}`)
    console.log(`Mode: ${this.config.dryRun ? "🔵 Dry Run" : "⚫ Live"}`)
    console.log("─".repeat(50))
    console.log(`Total Events: ${events.length}`)
    console.log(`Blocked: ${blocked}`)
    console.log(`Warnings: ${warnings}`)
    console.log("─".repeat(50))

    // 最近被阻止的操作
    const recentBlocked = events.filter(e => e.type === "blocked").slice(-5)
    if (recentBlocked.length > 0) {
      console.log("\nRecently Blocked:")
      for (const event of recentBlocked) {
        const time = new Date(event.timestamp).toLocaleTimeString()
        console.log(`  [${time}] ${event.action}: ${event.resource.slice(0, 50)}...`)
      }
    }
  }
}
