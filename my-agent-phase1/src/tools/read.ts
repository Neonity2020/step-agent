// ============================================================
// Read Tool - 读取文件内容
// ============================================================

import { readFile } from "fs/promises"
import { stat } from "fs/promises"
import type { Tool } from "./base.ts"
import type { ExecutionContext, ToolResult } from "../types/index.ts"

export class ReadTool implements Tool {
  name = "read"
  description = "读取文件内容。用于查看项目文件、代码、配置等。只读操作，不会修改文件。"

  inputSchema = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "要读取的文件路径（绝对路径或相对于当前工作目录）",
      },
      offset: {
        type: "number",
        description: "从第几行开始读取（1-indexed，默认 1）",
        minimum: 1,
      },
      limit: {
        type: "number",
        description: "最多读取多少行（默认全部）",
        minimum: 1,
      },
    },
    required: ["path"],
  }

  async execute(
    input: Record<string, unknown>,
    ctx: ExecutionContext
  ): Promise<ToolResult> {
    const path = input.path as string

    if (!path) {
      return {
        content: "",
        error: "Missing required parameter: path",
        success: false,
      }
    }

    try {
      // 解析路径（支持相对路径）
      const resolvedPath = this.resolvePath(path, ctx.cwd)

      // 检查文件是否存在
      const stats = await stat(resolvedPath)
      if (stats.isDirectory()) {
        return {
          content: "",
          error: `Path is a directory, not a file: ${path}`,
          success: false,
        }
      }

      // 读取文件
      const content = await readFile(resolvedPath, "utf-8")
      const lines = content.split("\n")

      // 处理分页
      const offset = ((input.offset as number) ?? 1) - 1
      const limit = input.limit as number | undefined

      let resultLines = lines.slice(offset)
      if (limit) {
        resultLines = resultLines.slice(0, limit)
      }

      const result = resultLines.join("\n")
      const totalLines = lines.length

      return {
        content: `File: ${resolvedPath}\nLines: ${offset + 1}-${Math.min(offset + resultLines.length, totalLines)}/${totalLines}\n\n${result}`,
        success: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (message.includes("ENOENT") || message.includes("no such file")) {
        return {
          content: "",
          error: `File not found: ${path}`,
          success: false,
        }
      }

      return {
        content: "",
        error: `Error reading file: ${message}`,
        success: false,
      }
    }
  }

  private resolvePath(path: string, cwd: string): string {
    if (path.startsWith("/")) {
      return path
    }
    // 简单处理相对路径
    return `${cwd}/${path}`
  }
}
