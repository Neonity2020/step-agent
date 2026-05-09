// ============================================================
// Sandboxed BashTool - 带沙箱保护的 BashTool
// ============================================================

import type { Tool } from "./base"
import { SandboxManager } from "../sandbox"

interface SandboxedToolResult {
  success: boolean
  content: string
  blocked?: boolean
  reason?: string
  exitCode?: number
  duration?: number
}

export class SandboxedBashTool implements Tool {
  name = "bash"
  description = "Execute shell commands in a sandboxed environment"
  inputSchema = {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute",
      },
      cwd: {
        type: "string",
        description: "Working directory (optional)",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds (optional)",
      },
    },
    required: ["command"],
  }

  private sandbox: SandboxManager

  constructor(sandbox?: SandboxManager) {
    this.sandbox = sandbox || new SandboxManager({
      enabled: true,
      defaultPolicy: "balanced",
      workspaceRoot: process.cwd(),
    })
  }

  async execute(input: any, context?: any): Promise<SandboxedToolResult> {
    const { command, cwd } = input

    if (!command) {
      return {
        success: false,
        content: "Error: command is required",
      }
    }

    const startTime = Date.now()
    const result = await this.sandbox.executeCommand(command, cwd, context?.env)

    const duration = Date.now() - startTime

    // 构建输出
    let output = ""

    if (result.blocked) {
      output = `⛔ Command Blocked by Sandbox\n`
      output += `Reason: ${result.blockedReason || "Security policy violation"}\n`
      output += `\nThe command "${command}" was blocked for security reasons.\n`
      output += `Policy: ${this.sandbox.getPolicy().name}\n`

      if (result.warnings && result.warnings.length > 0) {
        output += `\nWarnings:\n`
        for (const warning of result.warnings) {
          output += `  ⚠️ ${warning}\n`
        }
      }

      return {
        success: false,
        content: output,
        blocked: true,
        reason: result.blockedReason,
      }
    }

    output = `Command: ${command}\n`
    output += `Exit Code: ${result.exitCode}\n`
    output += `Duration: ${duration}ms\n`
    output += `\n`

    if (result.stdout) {
      output += `─── STDOUT ───\n${result.stdout}\n`
    }

    if (result.stderr) {
      output += `─── STDERR ───\n${result.stderr}\n`
    }

    if (result.warnings && result.warnings.length > 0) {
      output += `\n─── WARNINGS ───\n`
      for (const warning of result.warnings) {
        output += `⚠️ ${warning}\n`
      }
    }

    if (!result.stdout && !result.stderr) {
      output += "(no output)\n"
    }

    return {
      success: result.success,
      content: output,
      exitCode: result.exitCode,
      duration: result.duration,
    }
  }

  // 获取沙箱管理器
  getSandbox(): SandboxManager {
    return this.sandbox
  }

  // 设置策略
  setPolicy(policyId: string): boolean {
    return this.sandbox.setPolicy(policyId)
  }

  // 获取当前策略
  getPolicy() {
    return this.sandbox.getPolicy()
  }
}
