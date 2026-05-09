// ============================================================
// File Search Extension - 文件搜索工具扩展
// ============================================================

import type { Extension, ExtensionAPI } from "../base"
import type { Tool } from "../../tools/base"
import type { ExecutionContext, ToolResult } from "../../types"
import { readdir, stat } from "fs/promises"
import { join, extname, basename } from "path"

// 文件搜索工具
const searchFilesTool: Tool = {
  name: "find_files",
  description: "递归搜索目录下的文件，支持按扩展名过滤",
  inputSchema: {
    type: "object",
    properties: {
      dir: {
        type: "string",
        description: "搜索目录（默认当前目录）",
      },
      pattern: {
        type: "string",
        description: "文件名匹配模式（支持 * 通配符）",
      },
      extension: {
        type: "string",
        description: "按扩展名过滤（如 .ts, .js）",
      },
      maxDepth: {
        type: "number",
        description: "最大递归深度（默认 3）",
        default: 3,
      },
    },
  },
  async execute(input, ctx): Promise<ToolResult> {
    const dir = (input.dir as string) || ctx.cwd
    const pattern = (input.pattern as string) || "*"
    const extension = input.extension as string | undefined
    const maxDepth = (input.maxDepth as number) || 3

    try {
      const results: string[] = []
      await searchDir(dir, dir, pattern, extension, 0, maxDepth, results)
      
      if (results.length === 0) {
        return { content: "(no files found)", success: true }
      }

      return {
        content: results.map(f => f.replace(dir + "/", "")).join("\n"),
        success: true,
      }
    } catch (err) {
      return {
        content: "",
        error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      }
    }
  },
}

// Grep 工具
const grepTool: Tool = {
  name: "grep",
  description: "在文件中搜索匹配的文本行",
  inputSchema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "要搜索的正则表达式或文本",
      },
      path: {
        type: "string",
        description: "搜索路径（文件或目录）",
      },
      extension: {
        type: "string",
        description: "只搜索特定扩展名的文件",
      },
      caseSensitive: {
        type: "boolean",
        description: "是否区分大小写",
        default: true,
      },
      maxResults: {
        type: "number",
        description: "最大结果数",
        default: 100,
      },
    },
    required: ["pattern", "path"],
  },
  async execute(input, ctx): Promise<ToolResult> {
    const pattern = input.pattern as string
    const path = (input.path as string) || ctx.cwd
    const extension = input.extension as string | undefined
    const caseSensitive = input.caseSensitive !== false
    const maxResults = (input.maxResults as number) || 100

    try {
      const results: string[] = []
      await grepDir(path, pattern, extension, caseSensitive, maxResults, results, 0)

      if (results.length === 0) {
        return { content: "(no matches found)", success: true }
      }

      return { content: results.join("\n"), success: true }
    } catch (err) {
      return {
        content: "",
        error: `Grep failed: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      }
    }
  },
}

// 目录树工具
const treeTool: Tool = {
  name: "tree",
  description: "显示目录树结构",
  inputSchema: {
    type: "object",
    properties: {
      dir: {
        type: "string",
        description: "目录路径（默认当前目录）",
      },
      maxDepth: {
        type: "number",
        description: "最大显示深度",
        default: 3,
      },
      exclude: {
        type: "string",
        description: "排除的目录（逗号分隔）",
      },
    },
  },
  async execute(input, ctx): Promise<ToolResult> {
    const dir = (input.dir as string) || ctx.cwd
    const maxDepth = (input.maxDepth as number) || 3
    const exclude = input.exclude ? (input.exclude as string).split(",").map(s => s.trim()) : ["node_modules", ".git"]

    try {
      const lines: string[] = [basename(dir) + "/"]
      await buildTree(dir, "", maxDepth, exclude, lines)
      return { content: lines.join("\n"), success: true }
    } catch (err) {
      return {
        content: "",
        error: `Tree failed: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
      }
    }
  },
}

// ===== 辅助函数 =====

async function searchDir(
  baseDir: string,
  currentDir: string,
  pattern: string,
  extension: string | undefined,
  depth: number,
  maxDepth: number,
  results: string[]
): Promise<void> {
  if (depth > maxDepth) return

  try {
    const entries = await readdir(currentDir)

    for (const entry of entries) {
      if (entry.startsWith(".")) continue

      const fullPath = join(currentDir, entry)

      try {
        const stats = await stat(fullPath)

        if (stats.isFile()) {
          const matchesPattern = pattern === "*" || 
            entry.includes(pattern.replace(/\*/g, ""))
          const matchesExt = !extension || extname(entry) === extension

          if (matchesPattern && matchesExt) {
            results.push(fullPath)
          }
        } else if (stats.isDirectory()) {
          await searchDir(baseDir, fullPath, pattern, extension, depth + 1, maxDepth, results)
        }
      } catch {
        // 跳过无法访问的文件
      }
    }
  } catch {
    // 跳过无法访问的目录
  }
}

async function grepDir(
  dir: string,
  pattern: string,
  extension: string | undefined,
  caseSensitive: boolean,
  maxResults: number,
  results: string[],
  depth: number
): Promise<void> {
  if (results.length >= maxResults || depth > 5) return

  try {
    const entries = await readdir(dir)
    const { readFile } = await import("fs/promises")

    for (const entry of entries) {
      if (entry.startsWith(".")) continue

      const fullPath = join(dir, entry)
      const stats = await stat(fullPath)

      if (stats.isFile()) {
        const matchesExt = !extension || extname(entry) === extension
        if (!matchesExt) continue

        try {
          const content = await readFile(fullPath, "utf-8")
          const lines = content.split("\n")
          const searchPattern = caseSensitive ? pattern : new RegExp(pattern, "i")

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(searchPattern)) {
              if (results.length >= maxResults) return
              results.push(`${fullPath}:${i + 1}: ${lines[i].trim()}`)
            }
          }
        } catch {
          // 跳过二进制或无法读取的文件
        }
      } else if (stats.isDirectory()) {
        if (entry !== "node_modules" && entry !== ".git") {
          await grepDir(fullPath, pattern, extension, caseSensitive, maxResults, results, depth + 1)
        }
      }
    }
  } catch {
    // 跳过无法访问的目录
  }
}

async function buildTree(
  dir: string,
  prefix: string,
  maxDepth: number,
  exclude: string[],
  lines: string[]
): Promise<void> {
  if (prefix.length / 2 > maxDepth) return

  try {
    const entries = await readdir(dir)
    const filtered = entries.filter(e => !e.startsWith(".") && !exclude.includes(e))

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i]
      const fullPath = join(dir, entry)
      const isLast = i === filtered.length - 1
      const stats = await stat(fullPath)

      const connector = isLast ? "└── " : "├── "
      const currentPrefix = prefix + (isLast ? "    " : "│   ")

      lines.push(prefix + connector + entry + (stats.isDirectory() ? "/" : ""))

      if (stats.isDirectory()) {
        await buildTree(fullPath, currentPrefix, maxDepth, exclude, lines)
      }
    }
  } catch {
    // 跳过无法访问的目录
  }
}

// 导出扩展
const extension: Extension = {
  meta: {
    name: "file-search",
    version: "1.0.0",
    description: "文件搜索工具扩展，提供 find_files, grep, tree 等工具",
    author: "My Agent",
  },

  register(api: ExtensionAPI) {
    api.registerTool(searchFilesTool)
    api.registerTool(grepTool)
    api.registerTool(treeTool)

    api.log("File search tools extension loaded")
  },
}

export default extension
