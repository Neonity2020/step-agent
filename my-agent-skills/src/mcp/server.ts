// ============================================================
// MCP Server Config - MCP 服务器配置
// ============================================================

export interface MCPServerConfig {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  description?: string
  enabled?: boolean
}

// 常用 MCP 服务器配置示例
export const COMMON_MCP_SERVERS: MCPServerConfig[] = [
  // 文件系统
  {
    name: "filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    description: "File system operations",
    enabled: false,
  },
  
  // Git
  {
    name: "git",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-git"],
    description: "Git operations",
    enabled: false,
  },
  
  // GitHub
  {
    name: "github",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: "",
    },
    description: "GitHub API operations",
    enabled: false,
  },
  
  // Slack
  {
    name: "slack",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    env: {
      SLACK_BOT_TOKEN: "",
      SLACK_TEAM_ID: "",
    },
    description: "Slack operations",
    enabled: false,
  },

  // Brave Search
  {
    name: "brave-search",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: {
      BRAVE_API_KEY: "",
    },
    description: "Web search",
    enabled: false,
  },

  // SQLite
  {
    name: "sqlite",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "./data.db"],
    description: "SQLite database",
    enabled: false,
  },

  // Sequential Thinking
  {
    name: "sequential-thinking",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    description: "Sequential thinking for complex reasoning",
    enabled: false,
  },

  // Memory
  {
    name: "memory",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    description: "Persistent memory for conversations",
    enabled: false,
  },
]

export interface MCPConfig {
  servers: MCPServerConfig[]
}

export async function loadMCPConfig(configPath?: string): Promise<MCPConfig> {
  const defaultConfig: MCPConfig = {
    servers: [],
  }

  if (!configPath) {
    const home = Bun.env.HOME ?? "/tmp"
    configPath = `${home}/.myagent/mcp-config.json`
  }

  try {
    const content = await Bun.file(configPath).text()
    return JSON.parse(content)
  } catch {
    return defaultConfig
  }
}

export function saveMCPConfig(config: MCPConfig, configPath?: string): void {
  if (!configPath) {
    const home = Bun.env.HOME ?? "/tmp"
    configPath = `${home}/.myagent/mcp-config.json`
  }

  // 确保目录存在（使用 Bun 的文件系统 API）
  const dir = configPath.substring(0, configPath.lastIndexOf("/"))
  try {
    // Bun.write 会自动创建父目录
  } catch {
    // 忽略
  }

  Bun.write(configPath, JSON.stringify(config, null, 2))
}
