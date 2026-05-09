// ============================================================
// TUI Colors - ANSI 颜色和样式
// ============================================================

// ANSI 转义序列
const ESC = "\x1b"
const CSI = `${ESC}[`

// 颜色代码
export const colors = {
  // 重置
  reset: `${CSI}0m`,
  bold: `${CSI}1m`,
  dim: `${CSI}2m`,
  italic: `${CSI}3m`,
  underline: `${CSI}4m`,

  // 前景色
  black: `${CSI}30m`,
  red: `${CSI}31m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan: `${CSI}36m`,
  white: `${CSI}37m`,

  // 亮色
  brightRed: `${CSI}91m`,
  brightGreen: `${CSI}92m`,
  brightYellow: `${CSI}93m`,
  brightBlue: `${CSI}94m`,
  brightMagenta: `${CSI}95m`,
  brightCyan: `${CSI}96m`,

  // 背景色
  bgBlack: `${CSI}40m`,
  bgRed: `${CSI}41m`,
  bgGreen: `${CSI}42m`,
  bgYellow: `${CSI}43m`,
  bgBlue: `${CSI}44m`,
  bgMagenta: `${CSI}45m`,
  bgCyan: `${CSI}46m`,
  bgWhite: `${CSI}47m`,
}

// 便捷函数
export function color(text: string, color: string): string {
  return `${color}${text}${colors.reset}`
}

export function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`
}

// 主题颜色
export const theme = {
  // 消息颜色
  userPrefix: colors.cyan,
  userText: colors.white,
  assistantPrefix: colors.green,
  assistantText: colors.white,
  toolPrefix: colors.yellow,
  toolText: colors.dim,
  errorText: colors.red,

  // UI 颜色
  header: colors.dim,
  border: colors.dim,
  editor: colors.white,
  editorCursor: colors.brightGreen,
  statusBar: colors.dim,
  statusBarHighlight: colors.cyan,
  successText: colors.green,

  // 思考气泡
  thinking: colors.magenta,
}

// 移动光标
export const cursor = {
  hide: `${CSI}?25l`,
  show: `${CSI}?25h`,
  save: `${CSI}s`,
  restore: `${CSI}u`,
  up: (n = 1) => `${CSI}${n}A`,
  down: (n = 1) => `${CSI}${n}B`,
  right: (n = 1) => `${CSI}${n}C`,
  left: (n = 1) => `${CSI}${n}D`,
  nextLine: `${CSI}E`,
  prevLine: `${CSI}F`,
  column: (n: number) => `${CSI}${n}G`,
  position: (row: number, col: number) => `${CSI}${row};${col}H`,

  // 清除
  clear: `${CSI}2J`,
  clearLine: `${CSI}2K`,
  clearFromCursorToEnd: `${CSI}0J`,
  clearFromCursorToStart: `${CSI}1J`,
}

// 获取终端大小
export function getTerminalSize(): { rows: number; cols: number } {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  }
}
