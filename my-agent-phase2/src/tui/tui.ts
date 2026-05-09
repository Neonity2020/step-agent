// ============================================================
// TUI - 主 TUI 组件
// ============================================================

import { TerminalUI } from "./screen"
import { SimpleInput } from "./input"
import { color, theme, cursor } from "./colors"
import type { Message } from "../types"

export interface TUIOptions {
  modelName?: string
  sessionName?: string
  onSubmit: (message: string) => Promise<void>
}

export class TUI {
  private screen: TerminalUI
  private input: SimpleInput
  private options: TUIOptions
  private messages: Message[] = []
  private isProcessing: boolean = false

  constructor(options: TUIOptions) {
    this.options = options
    this.screen = new TerminalUI()
    this.input = new SimpleInput()

    this.screen.setModel(options.modelName ?? "claude")
    this.screen.setSession(options.sessionName ?? "new-session")
  }

  // 启动 TUI
  async start(): Promise<void> {
    this.welcome()
    this.render()

    // 主循环
    while (true) {
      try {
        const userInput = await this.input.readLine()

        if (!userInput.trim()) {
          continue
        }

        this.isProcessing = true
        this.addMessage({ role: "user", content: userInput })
        this.screen.setThinking(true)
        this.render()

        try {
          await this.options.onSubmit(userInput)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          this.addMessage({
            role: "assistant",
            content: `Error: ${errorMsg}`,
          })
        }

        this.isProcessing = false
        this.screen.setThinking(false)
        this.render()
      } catch (error) {
        this.isProcessing = false
        this.screen.setThinking(false)
        console.error(error)
        break
      }
    }
  }

  // 添加消息
  addMessage(message: Message): void {
    this.messages.push(message)
  }

  // 添加 Assistant 回复
  addAssistantMessage(content: string): void {
    this.addMessage({ role: "assistant", content })
  }

  // 添加工具调用
  addToolMessage(toolName: string, content: string): void {
    this.addMessage({
      role: "tool",
      content,
      toolName,
    })
  }

  // 设置 Token 计数
  setTokenCount(count: number): void {
    this.screen.setTokenCount(count)
  }

  // 设置状态
  setStatus(status: string): void {
    this.screen.setStatus(status)
  }

  // 渲染界面
  private render(): void {
    this.screen.setMessages(this.messages)
  }

  // 欢迎信息
  private welcome(): void {
    console.clear()
    console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent Phase 2 - Interactive TUI", theme.assistantPrefix)}                       ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Features:", theme.statusBarHighlight)}                                                   ${color("│", theme.border)}
${color("│", theme.border)}    • Interactive terminal interface                               ${color("│", theme.border)}
${color("│", theme.border)}    • Real-time message history                                     ${color("│", theme.border)}
${color("│", theme.border)}    • Tool execution display                                        ${color("│", theme.border)}
${color("│", theme.border)}    • Status bar with token count                                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Press Ctrl+C to exit", theme.statusBar)}                                     ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
  }
}
