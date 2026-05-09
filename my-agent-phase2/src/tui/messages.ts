// ============================================================
// TUI Messages - 消息渲染
// ============================================================

import { color, theme, colors, cursor } from "./colors"
import type { Message } from "../types"

// 消息条目
export interface MessageEntry {
  id: string
  type: "user" | "assistant" | "tool" | "thinking" | "system"
  content: string
  toolName?: string
  timestamp: Date
}

// 渲染单条消息
export function renderMessage(msg: MessageEntry, maxWidth: number): string[] {
  const lines: string[] = []
  const padding = "  "
  const maxContentWidth = maxWidth - padding.length - 4

  switch (msg.type) {
    case "user":
      lines.push("")
      lines.push(color(`${padding}👤 You`, theme.userPrefix))
      lines.push(color(`${padding}${"─".repeat(Math.min(40, maxContentWidth))}`, theme.border))
      lines.push(...wrapText(msg.content, maxContentWidth, padding))
      lines.push("")

    case "assistant":
      lines.push("")
      lines.push(color(`${padding}🤖 Assistant`, theme.assistantPrefix))
      lines.push(color(`${padding}${"─".repeat(Math.min(40, maxContentWidth))}`, theme.border))
      lines.push(...wrapText(msg.content, maxContentWidth, padding))
      lines.push("")

    case "tool":
      lines.push("")
      lines.push(color(`${padding}🔧 Tool: ${msg.toolName ?? "unknown"}`, theme.toolPrefix))
      lines.push(color(`${padding}${"─".repeat(Math.min(40, maxContentWidth))}`, theme.border))
      const toolLines = msg.content.split("\n")
      for (const line of toolLines) {
        if (line.length > maxContentWidth) {
          lines.push(...wrapText(line, maxContentWidth, padding))
        } else {
          lines.push(color(`${padding}${line}`, theme.toolText))
        }
      }
      lines.push("")

    case "thinking":
      lines.push(color(`${padding}💭 Thinking: ${msg.content}`, theme.thinking))
      lines.push("")

    case "system":
      lines.push(color(`${padding}⚙️  ${msg.content}`, theme.statusBar))
      lines.push("")
  }

  return lines
}

// 文本自动换行
function wrapText(text: string, maxWidth: number, prefix: string): string[] {
  const lines: string[] = []
  const words = text.split(" ")

  let currentLine = prefix

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth) {
      if (currentLine.trim() !== prefix.trim()) {
        lines.push(color(currentLine, theme.assistantText))
      }
      currentLine = prefix + word
    } else {
      currentLine += (currentLine === prefix ? "" : " ") + word
    }
  }

  if (currentLine.trim() !== prefix.trim()) {
    lines.push(color(currentLine, theme.assistantText))
  }

  return lines.length > 0 ? lines : [prefix]
}

// 渲染消息列表
export function renderMessages(messages: MessageEntry[], maxWidth: number): string {
  const output: string[] = []

  for (const msg of messages) {
    output.push(...renderMessage(msg, maxWidth))
  }

  return output.join("\n")
}

// 将 Agent Message 转换为 MessageEntry
export function messageToEntry(msg: Message, id: string): MessageEntry {
  let type: MessageEntry["type"] = "system"
  let content = msg.content
  let toolName: string | undefined

  switch (msg.role) {
    case "user":
      type = "user"
      break
    case "assistant":
      type = "assistant"
      break
    case "tool":
      type = "tool"
      toolName = msg.toolName
      break
  }

  return {
    id,
    type,
    content,
    toolName,
    timestamp: new Date(),
  }
}
