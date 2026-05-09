// ============================================================
// TUI Screen - 核心 TUI 渲染
// ============================================================

import { color, theme, cursor, getTerminalSize } from "./colors"
import { MessageEntry, renderMessages, messageToEntry } from "./messages"
import type { Message } from "../types"

export interface TUIRenderer {
  // 渲染整个界面
  render(): void

  // 更新消息
  setMessages(messages: Message[]): void

  // 设置编辑器内容
  setEditorContent(content: string): void

  // 设置状态
  setStatus(status: string): void

  // 显示思考中
  setThinking(thinking: boolean): void

  // 清屏
  clear(): void
}

export class TerminalUI implements TUIRenderer {
  private messages: MessageEntry[] = []
  private editorContent: string = ""
  private status: string = "Ready"
  private thinking: boolean = false
  private modelName: string = ""
  private tokenCount: number = 0
  private sessionName: string = "new-session"
  private cursorPosition: number = 0
  private maxWidth: number

  constructor() {
    this.maxWidth = getTerminalSize().cols
  }

  render(): void {
    const { rows, cols } = getTerminalSize()
    this.maxWidth = cols

    // 清屏
    process.stdout.write(cursor.clear)

    // 绘制 Header
    this.renderHeader()

    // 绘制消息区域
    this.renderMessageArea()

    // 绘制分隔线
    this.renderDivider()

    // 绘制编辑器
    this.renderEditor()

    // 移动光标到编辑器
    this.moveCursorToEditor()
  }

  private renderHeader(): void {
    const header = [
      "",
      color("┌" + "─".repeat(this.maxWidth - 2) + "┐", theme.border),
      color("│", theme.border) +
        color(" My Agent ".padEnd(20) +
          color("•", theme.statusBarHighlight) +
          " Phase 2: Interactive TUI ".padEnd(this.maxWidth - 45), theme.header) +
        color("│", theme.border),
      color("└" + "─".repeat(this.maxWidth - 2) + "┘", theme.border),
      "",
    ]
    process.stdout.write(header.join("\n") + "\n")
  }

  private renderMessageArea(): void {
    if (this.messages.length === 0) {
      const emptyMsg = color("  Start typing to begin...", theme.statusBar)
      process.stdout.write(emptyMsg + "\n\n")
      return
    }

    const output = renderMessages(this.messages, this.maxWidth)
    process.stdout.write(output + "\n")
  }

  private renderDivider(): void {
    const divider = color("├" + "─".repeat(this.maxWidth - 2) + "┤", theme.border)
    process.stdout.write(divider + "\n")
  }

  private renderEditor(): void {
    const prompt = color("❯ ", theme.assistantPrefix)
    const promptWidth = 3

    if (this.thinking) {
      const thinkingText = color("  💭 Thinking...", theme.thinking)
      process.stdout.write(thinkingText + "\n")
      return
    }

    // 显示编辑器内容（带光标）
    const displayContent = this.editorContent || color("(empty)", theme.statusBar)
    const line = prompt + displayContent
    process.stdout.write(line + "\n")

    // 显示编辑器提示
    const hint = color("  Ctrl+C: Quit  •  Enter: Send  •  Ctrl+U: Clear", theme.statusBar)
    process.stdout.write(hint + "\n")
  }

  private moveCursorToEditor(): void {
    // 计算光标位置
    const editorRow = this.messages.length === 0 ? 7 : 7 + this.countMessageLines() + 4

    // 简化处理：直接移到编辑器行
    process.stdout.write(cursor.position(editorRow, this.cursorPosition + 3))
  }

  private countMessageLines(): number {
    // 粗略估算消息区域行数
    let count = 0
    for (const msg of this.messages) {
      count += Math.ceil(msg.content.length / this.maxWidth) + 3
    }
    return count
  }

  // Public methods

  setMessages(messages: Message[]): void {
    this.messages = messages.map((msg, i) => messageToEntry(msg, `msg-${i}`))
    this.render()
  }

  setEditorContent(content: string): void {
    this.editorContent = content
    this.cursorPosition = content.length
    this.render()
  }

  setStatus(status: string): void {
    this.status = status
    this.render()
  }

  setThinking(thinking: boolean): void {
    this.thinking = thinking
    this.render()
  }

  setModel(modelName: string): void {
    this.modelName = modelName
  }

  setSession(sessionName: string): void {
    this.sessionName = sessionName
  }

  setTokenCount(count: number): void {
    this.tokenCount = count
  }

  clear(): void {
    process.stdout.write(cursor.clear)
  }
}
