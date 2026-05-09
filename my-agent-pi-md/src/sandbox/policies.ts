// ============================================================
// Security Policies - 安全策略定义
// ============================================================

import type { SecurityPolicy } from "./types"

// 预定义安全策略
export const POLICIES: Record<string, SecurityPolicy> = {
  // 严格模式 - 最安全
  strict: {
    id: "strict",
    name: "Strict",
    description: "Maximum security, minimal permissions",
    level: 1, // PermissionLevel.READ
    permissions: [
      {
        type: "file",
        path: "**/*.md",
        actions: ["read"],
        recursive: true,
      },
      {
        type: "file",
        path: "**/*.{json,txt}",
        actions: ["read"],
        recursive: true,
      },
      {
        type: "directory",
        path: "src/**",
        actions: ["read", "list"],
        recursive: true,
      },
      {
        type: "directory",
        path: "tests/**",
        actions: ["read", "list"],
        recursive: true,
      },
      {
        type: "directory",
        path: "docs/**",
        actions: ["read", "list"],
        recursive: true,
      },
    ],
    blockedCommands: [
      "rm -rf /",
      "rm -rf /*",
      ":(){:|:&};:",
      "mkfs",
      "dd if=",
      "> /dev/sda",
      "chmod -R 777 /",
      "wget .*curl.*|sh",
      "chown -R",
    ],
    allowedCommands: ["ls", "cat", "head", "tail", "grep", "find", "pwd", "cd"],
    maxFileSize: 1024 * 1024, // 1MB
    maxExecutionTime: 30000, // 30s
    envWhitelist: [],
    networkAllowed: false,
    dangerousFlags: ["--force", "-f", "-rf", "-r"],
  },

  // 平衡模式 - 推荐
  balanced: {
    id: "balanced",
    name: "Balanced",
    description: "Good security with reasonable flexibility",
    level: 2, // PermissionLevel.WRITE
    permissions: [
      {
        type: "file",
        path: "**/*",
        actions: ["read", "write"],
        recursive: true,
      },
      {
        type: "directory",
        path: "**/*",
        actions: ["read", "write", "list"],
        recursive: true,
      },
    ],
    blockedCommands: [
      // 系统破坏
      "rm -rf /",
      "rm -rf /*",
      "mkfs",
      "dd if=",
      "> /dev/sda",
      // 提权
      "sudo su",
      "sudo -i",
      "chmod 777 /",
      "chmod -R 777 /",
      "chown -R root /",
      // 网络下载执行
      "wget.*\\|sh",
      "curl.*\\|sh",
      "fetch.*\\|sh",
    ],
    allowedCommands: [], // 空表示允许所有（非黑名单）
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxExecutionTime: 60000, // 60s
    envWhitelist: [
      "PATH",
      "HOME",
      "USER",
      "SHELL",
      "TERM",
      "LANG",
      "LC_*",
      "npm_config_*",
      "bun_config_*",
    ],
    networkAllowed: true,
    dangerousFlags: ["--force", "-f", "-rf", "-r", "--no-preserve-root"],
  },

  // 开发模式
  development: {
    id: "development",
    name: "Development",
    description: "For development - allows most operations",
    level: 3, // PermissionLevel.EXECUTE
    permissions: [
      {
        type: "file",
        path: "**/*",
        actions: ["read", "write", "execute"],
        recursive: true,
      },
      {
        type: "directory",
        path: "**/*",
        actions: ["read", "write", "list", "execute"],
        recursive: true,
      },
      {
        type: "command",
        actions: ["execute"],
      },
    ],
    blockedCommands: [
      "rm -rf /",
      "rm -rf /*",
      "mkfs",
      "dd if=.*of=/dev/",
      "> /dev/sd",
      "sudo su",
      "sudo -i",
    ],
    allowedCommands: [],
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxExecutionTime: 120000, // 2min
    envWhitelist: ["*"], // 允许所有
    networkAllowed: true,
    dangerousFlags: [],
  },

  // 管理员模式 - 完全信任
  admin: {
    id: "admin",
    name: "Admin",
    description: "Full access - use with caution",
    level: 4, // PermissionLevel.ADMIN
    permissions: [
      {
        type: "file",
        path: "**/*",
        actions: ["read", "write", "execute"],
        recursive: true,
      },
      {
        type: "directory",
        path: "**/*",
        actions: ["read", "write", "list", "execute"],
        recursive: true,
      },
      {
        type: "command",
        actions: ["execute"],
      },
      {
        type: "network",
        actions: ["read", "write", "execute"],
      },
      {
        type: "env",
        actions: ["read", "write"],
      },
    ],
    blockedCommands: [], // 不阻止任何命令
    allowedCommands: [],
    networkAllowed: true,
    dangerousFlags: [],
  },

  // 只读模式
  readonly: {
    id: "readonly",
    name: "Read Only",
    description: "Cannot modify any files",
    level: 1,
    permissions: [
      {
        type: "file",
        path: "**/*",
        actions: ["read"],
        recursive: true,
      },
      {
        type: "directory",
        path: "**/*",
        actions: ["read", "list"],
        recursive: true,
      },
    ],
    blockedCommands: [
      "rm",
      "mv",
      "cp",
      "touch",
      "mkdir",
      "chmod",
      "chown",
      "echo.*>",
      "cat.>",
    ],
    allowedCommands: ["ls", "cat", "head", "tail", "grep", "find", "pwd", "cd", "tree"],
    maxFileSize: 1024 * 1024 * 100, // 100MB
    maxExecutionTime: 30000,
    envWhitelist: ["PATH", "HOME", "USER"],
    networkAllowed: false,
    dangerousFlags: [],
  },

  // Git 操作模式
  git: {
    id: "git",
    name: "Git Operations",
    description: "Safe git operations only",
    level: 2,
    permissions: [
      {
        type: "file",
        path: "**/*",
        actions: ["read", "write"],
        recursive: true,
      },
      {
        type: "directory",
        path: ".git/**",
        actions: ["read", "write", "list", "execute"],
        recursive: true,
      },
    ],
    blockedCommands: [
      "rm -rf .git",
      "git filter-branch",
      "git push --force",
      "git push --all",
    ],
    allowedCommands: [
      "git status",
      "git diff",
      "git log",
      "git show",
      "git add",
      "git commit",
      "git push",
      "git pull",
      "git branch",
      "git checkout",
      "git merge",
      "git stash",
      "git reset",
    ],
    maxFileSize: 10 * 1024 * 1024,
    maxExecutionTime: 60000,
    envWhitelist: ["PATH", "HOME", "USER", "GIT_*"],
    networkAllowed: true,
    dangerousFlags: ["--force", "-f"],
  },
}

// 获取策略
export function getPolicy(id: string): SecurityPolicy | undefined {
  return POLICIES[id]
}

// 获取所有策略
export function getAllPolicies(): SecurityPolicy[] {
  return Object.values(POLICIES)
}

// 列出策略名称
export function listPolicies(): { id: string; name: string; description: string }[] {
  return Object.values(POLICIES).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }))
}
