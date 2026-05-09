// ============================================================
// Write Tool - 写入/创建文件
// ============================================================

import { writeFile, mkdir } from "fs/promises"
import { dirname } from "path"
import type { Tool } from "./base.ts"
import type { ExecutionContext, ToolResult } from "../types/index.ts"

export class WriteTool implements Tool {
  name = "write"
  description = "创建或覆盖文件。如果文件存在则覆盖，如果目录不存在则创建。注意：这会直接写入文件，请确认内容。"

  inputSchema = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "文件路径（绝对路径或相对于当前工作目录）",
      },
      content: {
        type: "string",
        description: "文件内容",
      },
    },
    required: ["path", "content"],
  }

  async execute(
    input: Record<string, unknown>,
    ctx: ExecutionContext
  ): Promise<ToolResult> {
    const path = input.path as string
    const content = input.content as string

    if (!path) {
      return {
        content: "",
        error: "Missing required parameter: path",
        success: false,
      }
    }

    if (content === undefined) {
      return {
        content: "",
        error: "Missing required parameter: content",
        success: false,
      }
    }

    try {
      const resolvedPath = this.resolvePath(path, ctx.cwd)

      // 确保目录存在
      const dir = dirname(resolvedPath)
      await mkdir(dir, { recursive: true })

      // 写入文件
      await writeFile(resolvedPath, content, "utf-8")

      return {
        content: `Successfully wrote to ${resolvedPath}`,
        success: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: "",
        error: `Error writing file: ${message}`,
        success: false,
      }
    }
  }

  private resolvePath(path: string, cwd: string): string {
    if (path.startsWith("/")) {
      return path
    }
    return `${cwd}/${path}`
  }
}
