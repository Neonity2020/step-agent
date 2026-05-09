// ============================================================
// Sandbox Executor - 沙箱执行器
// ============================================================

import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from "fs"
import { dirname, join } from "path"
import { SandboxValidator } from "./validator"
import type { SecurityPolicy, ExecutionResult, FileOperationResult } from "./types"
import { color } from "../tui/colors"

export class SandboxExecutor {
  private validator: SandboxValidator
  private dryRun: boolean

  constructor(policy: SecurityPolicy, workspaceRoot: string, dryRun = false) {
    this.validator = new SandboxValidator(policy, workspaceRoot)
    this.dryRun = dryRun
  }

  // 执行命令
  async executeCommand(
    command: string,
    cwd?: string,
    env?: Record<string, string | undefined>
  ): Promise<ExecutionResult> {
    const startTime = Date.now()

    // 验证命令
    const validation = this.validator.validateCommand(command)

    if (!validation.allowed) {
      return {
        success: false,
        stdout: "",
        stderr: validation.reason || "Command blocked by security policy",
        exitCode: 126,
        duration: Date.now() - startTime,
        blocked: true,
        blockedReason: validation.reason,
        warnings: validation.warnings,
      }
    }

    // 试运行模式
    if (this.dryRun) {
      console.log(color(`[DRY RUN] Would execute: ${command}`, "yellow"))
      return {
        success: true,
        stdout: "[DRY RUN] Command would be executed",
        stderr: "",
        exitCode: 0,
        duration: 0,
        warnings: validation.warnings,
      }
    }

    // 过滤环境变量
    const filteredEnv = this.validator.filterEnvVars(env || process.env as Record<string, string>)
    const workingDir = cwd || this.validator.getWorkspaceRoot()

    // 执行命令
    try {
      // 使用 spawnSync 方式
      const proc = Bun.spawn([ "/bin/sh", "-c", command ], {
        cwd: workingDir,
        env: filteredEnv,
        stdout: "pipe",
        stderr: "pipe",
      })
      
      // 读取输出
      let stdout = ""
      let stderr = ""
      
      if (proc.stdout) {
        stdout = await new Response(proc.stdout).text()
      }
      if (proc.stderr) {
        stderr = await new Response(proc.stderr).text()
      }
      
      // 等待进程完成
      const exitCode = proc.exitCode

      return {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
        duration: Date.now() - startTime,
        warnings: validation.warnings,
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
    const validation = this.validator.validateFileOperation(path, "read")

    if (!validation.allowed) {
      return {
        success: false,
        path,
        operation: "read",
        blocked: true,
        blockedReason: validation.reason,
      }
    }

    if (this.dryRun) {
      console.log(color(`[DRY RUN] Would read: ${path}`, "yellow"))
      return { success: true, path, operation: "read" }
    }

    try {
      const content = readFileSync(validation.resolvedPath!, "utf-8")
      return {
        success: true,
        path: validation.resolvedPath!,
        operation: "read",
        content,
      }
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
    const validation = this.validator.validateFileOperation(path, "write")

    if (!validation.allowed) {
      return {
        success: false,
        path,
        operation: "write",
        blocked: true,
        blockedReason: validation.reason,
      }
    }

    if (this.dryRun) {
      console.log(color(`[DRY RUN] Would write to: ${path}`, "yellow"))
      return { success: true, path, operation: "write" }
    }

    try {
      // 确保目录存在
      const dir = dirname(validation.resolvedPath!)
      if (!existsSync(dir)) {
        return {
          success: false,
          path,
          operation: "write",
          error: `Directory does not exist: ${dir}`,
        }
      }

      writeFileSync(validation.resolvedPath!, content, "utf-8")
      return {
        success: true,
        path: validation.resolvedPath!,
        operation: "write",
      }
    } catch (error) {
      return {
        success: false,
        path,
        operation: "write",
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // 编辑文件（精确替换）
  editFile(path: string, oldText: string, newText: string): FileOperationResult {
    const validation = this.validator.validateFileOperation(path, "edit")

    if (!validation.allowed) {
      return {
        success: false,
        path,
        operation: "edit",
        blocked: true,
        blockedReason: validation.reason,
      }
    }

    if (this.dryRun) {
      console.log(color(`[DRY RUN] Would edit: ${path}`, "yellow"))
      return { success: true, path, operation: "edit" }
    }

    try {
      const currentContent = readFileSync(validation.resolvedPath!, "utf-8")

      if (!currentContent.includes(oldText)) {
        return {
          success: false,
          path,
          operation: "edit",
          error: `Text not found: "${oldText.slice(0, 50)}..."`,
        }
      }

      const newContent = currentContent.replace(oldText, newText)
      writeFileSync(validation.resolvedPath!, newContent, "utf-8")

      return {
        success: true,
        path: validation.resolvedPath!,
        operation: "edit",
      }
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
    const validation = this.validator.validatePath(path, "list")

    if (!validation.allowed) {
      return {
        success: false,
        path,
        operation: "list",
        blocked: true,
        blockedReason: validation.reason,
      }
    }

    if (this.dryRun) {
      console.log(color(`[DRY RUN] Would list: ${path}`, "yellow"))
      return { success: true, path, operation: "list" }
    }

    try {
      const entries = readdirSync(validation.resolvedPath!)
      return {
        success: true,
        path: validation.resolvedPath!,
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

  // 获取访问日志
  getAccessLogs() {
    return this.validator.getLogs()
  }

  // 获取警告
  getWarnings(): string[] {
    return this.validator.getWarnings()
  }

  // 启用/禁用试运行
  setDryRun(enabled: boolean): void {
    this.dryRun = enabled
  }

  // 获取验证器
  getValidator(): SandboxValidator {
    return this.validator
  }
}
