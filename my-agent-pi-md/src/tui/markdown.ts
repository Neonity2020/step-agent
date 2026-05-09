// ============================================================
// Markdown Renderer - 终端 Markdown 渲染
// ============================================================

import { color, theme } from "./colors"

// 检测是否是表格分隔行（如 |---|）
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  
  // 必须包含 |
  if (!trimmed.includes("|")) return false
  
  // 移除所有 | 后检查是否只剩 - 和空格
  const content = trimmed.replace(/\|/g, "").trim()
  return /^[-:\s]+$/.test(content) && content.length > 0
}

// 检测是否是表格数据行
function isMarkdownTableRow(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0) return false
  
  if (!trimmed.includes("|")) return false
  
  // 排除分隔行
  if (isTableSeparator(trimmed)) return false
  
  // 需要至少 2 个单元格
  const cells = trimmed.split("|").filter(c => c.trim())
  return cells.length >= 2
}

// 解析表格单元格
function parseTableCells(line: string): string[] {
  // 移除首尾边框字符
  const trimmed = line.trim()
  const firstChar = trimmed[0]
  const lastChar = trimmed[trimmed.length - 1]
  
  // 检查首尾是否是边框字符
  const isFirstBorder = /[│|┃║├┬┴┼╔╗╚╝╠╬╣║┌└]/.test(firstChar)
  const isLastBorder = /[│|┃║├┬┴┼╔╗╚╝╠╬╣║┐┘]/.test(lastChar)
  
  // 获取内部内容
  const inner = trimmed.slice(isFirstBorder ? 1 : 0, isLastBorder ? -1 : undefined)
  
  // 分割内部内容
  if (/[├┬┴┼╔╗╚╝╠╬╣║]/.test(inner)) {
    return inner.split(/[│|┃║├┬┴┼╔╗╚╝╠╬╣║]/).filter(c => c.trim())
  }
  return inner.split("|").filter(c => c.trim())
}

// 渲染表格行
function renderTableRow(cells: string[]): string {
  const renderedCells = cells.map(cell => {
    const content = renderInlineMarkdown(cell)
    return content.padEnd(Math.max(cell.length, 4))
  })
  return "│ " + renderedCells.join(" │ ") + " │"
}

// 渲染表格分隔线
function renderTableSeparator(cells: string[]): string {
  const widths = cells.map(cell => Math.max(cell.length, 4))
  const separators = widths.map(w => "─".repeat(w))
  return "├─" + separators.join("─┼─") + "─┤"
}

// 渲染 Markdown 文本为带颜色的终端输出
export function renderMarkdown(text: string): string {
  const lines = text.split("\n")
  const output: string[] = []
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // 代码块
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        output.push(color("─".repeat(40), theme.border))
        inCodeBlock = false
      } else {
        output.push(color("─".repeat(40), theme.border))
        inCodeBlock = true
      }
      continue
    }
    if (inCodeBlock) {
      output.push(color(line, theme.dim))
      continue
    }

    // 表格分隔行
    if (isTableSeparator(trimmed)) {
      const cells = parseTableCells(line)
      output.push(renderTableSeparator(cells))
      continue
    }

    // 表格数据行
    if (isMarkdownTableRow(trimmed)) {
      const cells = parseTableCells(line)
      output.push(renderTableRow(cells))
      continue
    }

    // 标题
    if (trimmed.match(/^#{1,6}\s/)) {
      const level = trimmed.match(/^(#+)/)?.[1].length || 1
      const content = trimmed.replace(/^#+\s*/, "")
      
      if (level === 1) {
        output.push("")
        output.push(color(content, theme.header))
        output.push(color("─".repeat(Math.min(content.length, 40)), theme.border))
      } else if (level === 2) {
        output.push("")
        output.push(color(content, theme.statusBarHighlight))
      } else {
        output.push(color(content, theme.statusBar))
      }
      continue
    }

    // 分隔线
    if (trimmed.match(/^---+$/) || trimmed.match(/^\*\*\*+$/)) {
      output.push(color("─".repeat(40), theme.border))
      continue
    }

    // 无序列表
    if (trimmed.match(/^[-*+]\s/)) {
      const content = trimmed.replace(/^[-*+]\s*/, "  • ")
      output.push(renderInlineMarkdown(content))
      continue
    }

    // 有序列表
    if (trimmed.match(/^\d+\.\s/)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)/)
      if (match) {
        const content = `  ${match[1]}. ${renderInlineMarkdown(match[2])}`
        output.push(content)
      }
      continue
    }

    // 引用
    if (trimmed.startsWith(">")) {
      const content = trimmed.replace(/^>\s*/, "")
      output.push(color(`  │ ${content}`, theme.dim))
      continue
    }

    // 空行
    if (trimmed === "") {
      output.push("")
      continue
    }

    // 普通文本行
    output.push(renderInlineMarkdown(line))
  }

  return output.join("\n")
}

// 处理行内 Markdown
function renderInlineMarkdown(text: string): string {
  let result = text

  result = result.replace(/`([^`]+)`/g, (_, code) => color(code, theme.dim))
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, c) => color(c, theme.statusBarHighlight))
  result = result.replace(/__([^_]+)__/g, (_, c) => color(c, theme.statusBarHighlight))
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, c) => color(c, theme.dim))
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

  return result
}

// 快捷函数
export function printMarkdown(text: string): void {
  console.log(renderMarkdown(text))
}

// 渲染代码块
export function renderCodeBlock(code: string, language?: string): string {
  return [
    color("─".repeat(40), theme.border),
    color(`${language || "code"} │`, theme.dim),
    color("─".repeat(40), theme.border),
    color(code, theme.dim),
    color("─".repeat(40), theme.border),
  ].join("\n")
}