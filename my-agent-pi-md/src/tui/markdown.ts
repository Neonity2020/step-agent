// ============================================================
// Markdown Renderer - 终端 Markdown 渲染
// ============================================================

import { color, theme } from "./colors"

// 渲染 Markdown 文本为带颜色的终端输出
export function renderMarkdown(text: string): string {
  const lines = text.split("\n")
  const output: string[] = []

  let inCodeBlock = false
  let inList = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 代码块开始/结束
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        // 代码块结束
        output.push(color("─".repeat(40), theme.border))
        inCodeBlock = false
      } else {
        // 代码块开始
        output.push(color("─".repeat(40), theme.border))
        inCodeBlock = true
      }
      continue
    }

    // 代码块内容
    if (inCodeBlock) {
      output.push(color(line, theme.dim))
      continue
    }

    // 标题
    if (line.match(/^#{1,6}\s/)) {
      const level = line.match(/^(#+)/)?.[1].length || 1
      const content = line.replace(/^#+\s*/, "")
      
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
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      output.push(color("─".repeat(40), theme.border))
      continue
    }

    // 无序列表
    if (line.match(/^[\s]*[-*+]\s/)) {
      const content = line.replace(/^[\s]*[-*+]\s*/, "  • ")
      output.push(renderInlineMarkdown(content))
      inList = true
      continue
    }

    // 有序列表
    if (line.match(/^[\s]*\d+\.\s/)) {
      const match = line.match(/^[\s]*(\d+)\.\s(.*)/)
      if (match) {
        const num = match[1]
        const content = `  ${num}. ${renderInlineMarkdown(match[2])}`
        output.push(content)
      }
      inList = true
      continue
    }

    // 引用
    if (line.startsWith(">")) {
      const content = line.replace(/^>\s*/, "")
      output.push(color(`  │ ${content}`, theme.dim))
      continue
    }

    // 空行
    if (line.trim() === "") {
      output.push("")
      inList = false
      continue
    }

    // 普通文本行
    inList = false
    output.push(renderInlineMarkdown(line))
  }

  return output.join("\n")
}

// 处理行内 Markdown（粗体、斜体、代码、链接）
function renderInlineMarkdown(text: string): string {
  let result = text

  // 处理行内代码 `code`
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    return color(code, theme.dim)
  })

  // 处理加粗 **text** 或 __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, content) => {
    return color(content, theme.statusBarHighlight)
  })
  result = result.replace(/__([^_]+)__/g, (_, content) => {
    return color(content, theme.statusBarHighlight)
  })

  // 处理斜体 *text* 或 _text_
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, content) => {
    return color(content, theme.dim)
  })

  // 处理链接 [text](url) - 只显示文字
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")

  return result
}

// 快捷函数：渲染并打印
export function printMarkdown(text: string): void {
  console.log(renderMarkdown(text))
}

// 渲染代码块
export function renderCodeBlock(code: string, language?: string): string {
  const lines = [
    color("─".repeat(40), theme.border),
    color(`${language || "code"} │`, theme.dim),
    color("─".repeat(40), theme.border),
    color(code, theme.dim),
    color("─".repeat(40), theme.border),
  ]
  return lines.join("\n")
}