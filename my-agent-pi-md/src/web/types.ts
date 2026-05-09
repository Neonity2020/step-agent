// ============================================================
// Web UI Types - Web 界面类型定义
// ============================================================

// 消息类型
export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp: number
  toolName?: string
  toolInput?: Record<string, any>
  toolResult?: string
}

// 聊天会话
export interface ChatSession {
  id: string
  name: string
  createdAt: number
  messages: ChatMessage[]
}

// API 请求
export interface SendMessageRequest {
  content: string
  sessionId?: string
}

// API 响应（流式）
export interface StreamChunk {
  type: "content" | "tool_call" | "tool_result" | "done" | "error"
  content?: string
  toolName?: string
  toolInput?: Record<string, any>
  toolResult?: string
  error?: string
}

// Web 配置
export interface WebConfig {
  port: number
  host: string
  title: string
  theme?: "dark" | "light" | "auto"
}

// 主题配置
export interface ThemeConfig {
  name: string
  background: string
  surface: string
  surfaceHover: string
  border: string
  text: string
  textSecondary: string
  textMuted: string
  userBubble: string
  userText: string
  assistantBubble: string
  assistantText: string
  toolBubble: string
  toolText: string
  accent: string
  success: string
  warning: string
  error: string
}

// 可用主题
export const THEMES: Record<string, ThemeConfig> = {
  dark: {
    name: "Dark",
    background: "#0d1117",
    surface: "#161b22",
    surfaceHover: "#21262d",
    border: "#30363d",
    text: "#e6edf3",
    textSecondary: "#8b949e",
    textMuted: "#6e7681",
    userBubble: "#238636",
    userText: "#ffffff",
    assistantBubble: "#21262d",
    assistantText: "#e6edf3",
    toolBubble: "#1f1f1f",
    toolText: "#a5d6ff",
    accent: "#58a6ff",
    success: "#3fb950",
    warning: "#d29922",
    error: "#f85149",
  },
  light: {
    name: "Light",
    background: "#ffffff",
    surface: "#f6f8fa",
    surfaceHover: "#eaeef2",
    border: "#d0d7de",
    text: "#1f2328",
    textSecondary: "#656d76",
    textMuted: "#8c959f",
    userBubble: "#238636",
    userText: "#ffffff",
    assistantBubble: "#eaeef2",
    assistantText: "#1f2328",
    toolBubble: "#fff8c5",
    toolText: "#1f2328",
    accent: "#0969da",
    success: "#1a7f37",
    warning: "#9a6700",
    error: "#cf222e",
  },
  monokai: {
    name: "Monokai",
    background: "#272822",
    surface: "#3e3d32",
    surfaceHover: "#49483e",
    border: "#75715e",
    text: "#f8f8f2",
    textSecondary: "#a6e22e",
    textMuted: "#75715e",
    userBubble: "#e6db74",
    userText: "#272822",
    assistantBubble: "#49483e",
    assistantText: "#f8f8f2",
    toolBubble: "#66d9ef",
    toolText: "#272822",
    accent: "#ae81ff",
    success: "#a6e22e",
    warning: "#e6db74",
    error: "#f92672",
  },
  nord: {
    name: "Nord",
    background: "#2e3440",
    surface: "#3b4252",
    surfaceHover: "#434c5e",
    border: "#4c566a",
    text: "#eceff4",
    textSecondary: "#d8dee9",
    textMuted: "#4c566a",
    userBubble: "#5e81ac",
    userText: "#eceff4",
    assistantBubble: "#3b4252",
    assistantText: "#eceff4",
    toolBubble: "#4c566a",
    toolText: "#88c0d0",
    accent: "#81a1c1",
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
  },
}
