// ============================================================
// Bash Tool - 执行 shell 命令
// ============================================================

import { spawn } from "child_process"
import type { Tool } from "./base.ts"
import type { ExecutionContext, ToolResult } from "../types/index.ts"

export class BashTool implements Tool {
  name = "bash"
  description = "执行 shell 命令。用于运行 npm、git、node 等命令行工具，以及任何系统命令。注意：破坏性命令需谨慎使用。"

  inputSchema = {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "要执行的命令",
      },
      timeout: {
        type: "number",
        description: "超时时间（毫秒，默认 30000）",
        minimum: 1000,
        maximum: 300000,
      },
    },
    required: ["command"],
  }

  async execute(
    input: Record<string, unknown>,
    ctx: ExecutionContext
  ): Promise<ToolResult> {
    const command = input.command as string
    const timeout = (input.timeout as number) ?? 30000

    if (!command) {
      return {
        content: "",
        error: "Missing required parameter: command",
        success: false,
      }
    }

    return new Promise((resolve) => {
      // 简单命令解析
      const trimmed = command.trim()
      const [cmd, ...args] = trimmed.split(/\s+/)

      const proc = spawn(cmd, args, {
        cwd: ctx.cwd,
        env: {
          ...process.env as Record<string, string>,
          ...ctx.env,
          HOME: ctx.homeDir,
        },
      })

      let stdout = ""
      let stderr = ""
      let killed = false

      // 设置超时
      const timer = setTimeout(() => {
        killed = true
        proc.kill("SIGTERM")
        resolve({
          content: stdout,
          error: `Command timed out after ${timeout}ms`,
          success: false,
        })
      }, timeout)

      proc.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString()
      })

      proc.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on("close", (code: number | null) => {
        clearTimeout(timer)
        if (killed) return

        if (code === 0) {
          resolve({
            content: stdout.trim() || "(no output)",
            success: true,
          })
        } else {
          resolve({
            content: stdout.trim(),
            error: stderr.trim() || `Command exited with code ${code}`,
            success: false,
          })
        }
      })

      proc.on("error", (error: Error) => {
        clearTimeout(timer)
        resolve({
          content: stdout.trim(),
          error: `Command error: ${error.message}`,
          success: false,
        })
      })
    })
  }
}
