// ============================================================
// Theme System - 主题系统
// ============================================================
// 
// 支持自定义终端配色方案
// ============================================================

export interface ThemeColors {
  // 消息颜色
  userPrefix: string
  userText: string
  assistantPrefix: string
  assistantText: string
  toolPrefix: string
  toolText: string
  errorText: string
  thinkingText: string

  // UI 颜色
  header: string
  border: string
  editor: string
  editorCursor: string
  statusBar: string
  statusBarHighlight: string
  successText: string
  warningText: string
  infoText: string
}

// 内置主题
export const DARK_THEME: ThemeColors = {
  userPrefix: "\x1b[36m",        // cyan
  userText: "\x1b[37m",           // white
  assistantPrefix: "\x1b[32m",    // green
  assistantText: "\x1b[37m",      // white
  toolPrefix: "\x1b[33m",         // yellow
  toolText: "\x1b[2m",            // dim
  errorText: "\x1b[31m",          // red
  thinkingText: "\x1b[35m",       // magenta

  header: "\x1b[2m",              // dim
  border: "\x1b[2m",             // dim
  editor: "\x1b[37m",             // white
  editorCursor: "\x1b[92m",       // bright green
  statusBar: "\x1b[2m",           // dim
  statusBarHighlight: "\x1b[36m", // cyan
  successText: "\x1b[32m",       // green
  warningText: "\x1b[33m",        // yellow
  infoText: "\x1b[34m",          // blue
}

export const LIGHT_THEME: ThemeColors = {
  userPrefix: "\x1b[34m",        // blue
  userText: "\x1b[30m",           // black
  assistantPrefix: "\x1b[32m",    // green
  assistantText: "\x1b[30m",      // black
  toolPrefix: "\x1b[33m",         // yellow
  toolText: "\x1b[90m",           // bright black (dim)
  errorText: "\x1b[31m",          // red
  thinkingText: "\x1b[35m",       // magenta

  header: "\x1b[90m",            // bright black
  border: "\x1b[90m",            // bright black
  editor: "\x1b[30m",             // black
  editorCursor: "\x1b[32m",       // green
  statusBar: "\x1b[90m",         // bright black
  statusBarHighlight: "\x1b[34m", // blue
  successText: "\x1b[32m",       // green
  warningText: "\x1b[33m",        // yellow
  infoText: "\x1b[34m",          // blue
}

export const MONOKAI_THEME: ThemeColors = {
  userPrefix: "\x1b[38;5;141m",   // purple
  userText: "\x1b[38;5;231m",     // white
  assistantPrefix: "\x1b[38;5;114m", // green
  assistantText: "\x1b[38;5;231m", // white
  toolPrefix: "\x1b[38;5;186m",    // yellow
  toolText: "\x1b[38;5;245m",     // dim gray
  errorText: "\x1b[38;5;197m",    // red/pink
  thinkingText: "\x1b[38;5;139m",  // purple

  header: "\x1b[38;5;245m",      // dim gray
  border: "\x1b[38;5;240m",      // gray
  editor: "\x1b[38;5;231m",       // white
  editorCursor: "\x1b[38;5;114m", // green
  statusBar: "\x1b[38;5;245m",   // dim gray
  statusBarHighlight: "\x1b[38;5;114m", // green
  successText: "\x1b[38;5;114m", // green
  warningText: "\x1b[38;5;186m",  // yellow
  infoText: "\x1b[38;5;75m",     // blue
}

export const NORD_THEME: ThemeColors = {
  userPrefix: "\x1b[38;5;110m",   // cyan/blue
  userText: "\x1b[38;5;223m",     // light gray
  assistantPrefix: "\x1b[38;5;150m", // green
  assistantText: "\x1b[38;5;223m", // light gray
  toolPrefix: "\x1b[38;5;208m",    // orange
  toolText: "\x1b[38;5;109m",     // dim blue
  errorText: "\x1b[38;5;203m",    // red
  thinkingText: "\x1b[38;5;175m", // purple

  header: "\x1b[38;5;109m",      // dim blue
  border: "\x1b[38;5;59m",       // dark blue
  editor: "\x1b[38;5;223m",       // light gray
  editorCursor: "\x1b[38;5;150m", // green
  statusBar: "\x1b[38;5;109m",   // dim blue
  statusBarHighlight: "\x1b[38;5;110m", // cyan/blue
  successText: "\x1b[38;5;150m", // green
  warningText: "\x1b[38;5;208m",  // orange
  infoText: "\x1b[38;5;110m",     // cyan/blue
}

// 预设主题映射
export const THEMES: Record<string, ThemeColors> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
  monokai: MONOKAI_THEME,
  nord: NORD_THEME,
}

// 主题管理器
export class ThemeManager {
  private currentTheme: ThemeColors = DARK_THEME
  private customThemes: Map<string, ThemeColors> = new Map()
  private listeners: Array<(theme: ThemeColors) => void> = []

  constructor(defaultTheme: string = "dark") {
    this.setTheme(defaultTheme)
  }

  // 设置主题
  setTheme(name: string): boolean {
    // 检查内置主题
    if (THEMES[name]) {
      this.currentTheme = THEMES[name]
      this.notifyListeners()
      return true
    }

    // 检查自定义主题
    if (this.customThemes.has(name)) {
      this.currentTheme = this.customThemes.get(name)!
      this.notifyListeners()
      return true
    }

    return false
  }

  // 获取当前主题
  getTheme(): ThemeColors {
    return this.currentTheme
  }

  // 获取主题名称
  getThemeName(): string {
    for (const [name, theme] of Object.entries(THEMES)) {
      if (theme === this.currentTheme) {
        return name
      }
    }
    for (const [name, theme] of this.customThemes.entries()) {
      if (theme === this.currentTheme) {
        return name
      }
    }
    return "custom"
  }

  // 注册自定义主题
  registerTheme(name: string, theme: ThemeColors): void {
    this.customThemes.set(name, theme)
  }

  // 获取所有主题名称
  getAvailableThemes(): string[] {
    return [
      ...Object.keys(THEMES),
      ...Array.from(this.customThemes.keys()),
    ]
  }

  // 监听主题变化
  onThemeChange(listener: (theme: ThemeColors) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentTheme)
    }
  }

  // 重置到默认
  reset(): void {
    this.currentTheme = DARK_THEME
    this.notifyListeners()
  }
}

// 颜色工具函数
export function color(text: string, colorCode: string): string {
  return `${colorCode}${text}\x1b[0m`
}

export function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`
}

export function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`
}

// 创建带主题的输出函数
export function createThemedOutput(theme: ThemeColors) {
  return {
    // 用户消息
    user: (text: string) => color(text, theme.userText),
    userPrefix: () => color("👤 You", theme.userPrefix),

    // Assistant 消息
    assistant: (text: string) => color(text, theme.assistantText),
    assistantPrefix: () => color("🤖 Assistant", theme.assistantPrefix),

    // 工具消息
    tool: (text: string) => color(text, theme.toolText),
    toolPrefix: (name: string) => color(`🔧 ${name}`, theme.toolPrefix),

    // 错误
    error: (text: string) => color(text, theme.errorText),

    // 思考
    thinking: (text: string) => color(`💭 ${text}`, theme.thinkingText),

    // 边框
    border: () => color("─".repeat(60), theme.border),
    boxTop: () => color("┌" + "─".repeat(58) + "┐", theme.border),
    boxBottom: () => color("└" + "─".repeat(58) + "┘", theme.border),
    boxSide: () => color("│", theme.border),

    // 状态栏
    status: (text: string) => color(text, theme.statusBar),
    statusHighlight: (text: string) => color(text, theme.statusBarHighlight),

    // 通用
    success: (text: string) => color(text, theme.successText),
    warning: (text: string) => color(text, theme.warningText),
    info: (text: string) => color(text, theme.infoText),
    header: (text: string) => color(text, theme.header),
  }
}
