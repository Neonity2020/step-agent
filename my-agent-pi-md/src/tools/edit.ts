// ============================================================
// Edit Tool - 编辑文件（精确替换）
// ============================================================

import { readFile, writeFile } from "fs/promises"
import type { Tool } from "./base.ts"
import type { ExecutionContext, ToolResult } from "../types/index.ts"

export class EditTool implements Tool {
  name = "edit"
  description = "对文件进行精确的文本替换。使用 oldText 指定要替换的原文（必须完全匹配），newText 指定替换后的内容。这是最安全的编辑方式。"

  inputSchema = {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "文件路径",
      },
      oldText: {
        type: "string",
        description: "要替换的原文（必须精确匹配，包括所有空格和换行）",
      },
      newText: {
        type: "string",
        description: "替换后的内容",
      },
    },
    required: ["path", "oldText", "newText"],
  }

  async execute(
    input: Record<string, unknown>,
    ctx: ExecutionContext
  ): Promise<ToolResult> {
    const path = input.path as string
    const oldText = input.oldText as string
    const newText = input.newText as string

    if (!path) {
      return {
        content: "",
        error: "Missing required parameter: path",
        success: false,
      }
    }

    if (oldText === undefined) {
      return {
        content: "",
        error: "Missing required parameter: oldText",
        success: false,
      }
    }

    if (newText === undefined) {
      return {
        content: "",
        error: "Missing required parameter: newText",
        success: false,
      }
    }

    try {
      const resolvedPath = this.resolvePath(path, ctx.cwd)

      // 读取原文件
      let content: string
      try {
        content = await readFile(resolvedPath, "utf-8")
      } catch {
        return {
          content: "",
          error: `File not found: ${resolvedPath}`,
          success: false,
        }
      }

      // 检查是否匹配
      if (!content.includes(oldText)) {
        return {
          content: "",
          error: `Could not find the specified oldText in the file.\n\nFile: ${resolvedPath}\n\nMake sure the oldText matches exactly, including all whitespace and newlines.`,
          success: false,
        }
      }

      // 执行替换
      const newContent = content.replace(oldText, newText)

      // 写入文件
      await writeFile(resolvedPath, newContent, "utf-8")

      return {
        content: `Successfully edited ${resolvedPath}`,
        success: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        content: "",
        error: `Error editing file: ${message}`,
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
