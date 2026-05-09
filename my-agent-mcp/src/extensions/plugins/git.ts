// ============================================================
// Git Extension - Git 工具扩展
// ============================================================

import type { Extension, ExtensionAPI } from "../base"
import type { Tool } from "../../tools/base"
import type { ExecutionContext, ToolResult } from "../../types"
import { spawn } from "child_process"

// Git 状态工具
const gitStatusTool: Tool = {
  name: "git_status",
  description: "查看 Git 仓库状态，显示已修改、已暂存、待提交的文件",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Git 仓库路径（默认当前目录）",
      },
    },
  },
  async execute(input, ctx): Promise<ToolResult> {
    const path = (input.path as string) || ctx.cwd
    return runGit(["status", "--porcelain"], path)
  },
}

// Git 日志工具
const gitLogTool: Tool = {
  name: "git_log",
  description: "查看 Git 提交历史",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Git 仓库路径",
      },
      limit: {
        type: "number",
        description: "显示最近 N 条记录（默认 10）",
        default: 10,
      },
    },
  },
  async execute(input, ctx): Promise<ToolResult> {
    const path = (input.path as string) || ctx.cwd
    const limit = (input.limit as number) || 10
    return runGit(["log", `--oneline`, `-n`, String(limit)], path)
  },
}

// Git 提交工具
const gitCommitTool: Tool = {
  name: "git_commit",
  description: "提交暂存的更改",
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "提交信息",
      },
      path: {
        type: "string",
        description: "Git 仓库路径",
      },
      all: {
        type: "boolean",
        description: "是否自动暂存所有更改",
        default: false,
      },
    },
    required: ["message"],
  },
  async execute(input, ctx): Promise<ToolResult> {
    const path = (input.path as string) || ctx.cwd
    const message = input.message as string
    const all = input.all as boolean

    const args = ["commit"]
    if (all) args.push("-a")
    args.push("-m", message)

    return runGit(args, path)
  },
}

// Git 分支工具
const gitBranchTool: Tool = {
  name: "git_branch",
  description: "列出、创建或删除分支",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "分支名（不提供则列出所有分支）",
      },
      delete: {
        type: "boolean",
        description: "是否删除分支",
        default: false,
      },
      path: {
        type: "string",
        description: "Git 仓库路径",
      },
    },
  },
  async execute(input, ctx): Promise<ToolResult> {
    const path = (input.path as string) || ctx.cwd

    if (input.name) {
      if (input.delete) {
        return runGit(["branch", "-d", input.name as string], path)
      }
      return runGit(["branch", input.name as string], path)
    }

    return runGit(["branch", "-a"], path)
  },
}

// Git 检查工具
const gitDiffTool: Tool = {
  name: "git_diff",
  description: "查看文件更改",
  inputSchema: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "指定文件（不提供则显示所有更改）",
      },
      staged: {
        type: "boolean",
        description: "是否显示暂存区更改",
        default: false,
      },
      path: {
        type: "string",
        description: "Git 仓库路径",
      },
    },
  },
  async execute(input, ctx): Promise<ToolResult> {
    const path = (input.path as string) || ctx.cwd
    const args = ["diff"]
    
    if (input.staged) args.push("--cached")
    if (input.file) args.push(input.file as string)

    return runGit(args, path)
  },
}

// 执行 Git 命令的辅助函数
function runGit(args: string[], cwd: string): Promise<ToolResult> {
  return new Promise((resolve) => {
    const proc = spawn("git", args, { cwd })

    let stdout = ""
    let stderr = ""

    proc.stdout?.on("data", (data) => { stdout += data.toString() })
    proc.stderr?.on("data", (data) => { stderr += data.toString() })

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ content: stdout.trim() || "(no output)", success: true })
      } else {
        resolve({
          content: stdout.trim(),
          error: stderr.trim() || `git exited with code ${code}`,
          success: false,
        })
      }
    })

    proc.on("error", (err) => {
      resolve({
        content: "",
        error: `Failed to run git: ${err.message}`,
        success: false,
      })
    })
  })
}

// 导出扩展
const extension: Extension = {
  meta: {
    name: "git-tools",
    version: "1.0.0",
    description: "Git 工具扩展，提供 git_status, git_log, git_commit, git_branch, git_diff 等工具",
    author: "My Agent",
  },

  register(api: ExtensionAPI) {
    // 注册 Git 工具
    api.registerTool(gitStatusTool)
    api.registerTool(gitLogTool)
    api.registerTool(gitCommitTool)
    api.registerTool(gitBranchTool)
    api.registerTool(gitDiffTool)

    api.log("Git tools extension loaded")
  },
}

export default extension
