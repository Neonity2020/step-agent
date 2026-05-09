// ============================================================
// TUI - 主 TUI 组件（支持会话）
// ============================================================

import { TerminalUI } from "./screen"
import { SimpleInput } from "./input"
import { color, theme, cursor } from "./colors"
import type { Message } from "../types"
import { SessionManager } from "../session/manager"
import type { Session, SessionTreeNode } from "../session/types"

export interface TUIOptions {
  sessionManager: SessionManager
  modelName?: string
  onSubmit: (message: string) => Promise<void>
}

export class TUI {
  private screen: TerminalUI
  private input: SimpleInput
  private options: TUIOptions
  private session: Session | null = null
  private isProcessing: boolean = false
  private history: Message[] = []
  private showTree: boolean = false

  constructor(options: TUIOptions) {
    this.options = options
    this.screen = new TerminalUI()
    this.input = new SimpleInput()

    this.screen.setModel(options.modelName ?? "claude")
  }

  // 启动 TUI
  async start(): Promise<void> {
    this.welcome()
    await this.loadOrCreateSession()
    this.render()

    // 主循环
    while (true) {
      try {
        // 显示命令提示或输入提示
        if (this.showTree) {
          await this.handleTreeCommand()
        } else {
          const userInput = await this.input.readLine()
          await this.handleInput(userInput)
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ERR_IFACE_RT_ASS_INUSE') {
          console.error(error)
        }
        break
      }
    }
  }

  // 处理输入
  private async handleInput(userInput: string): Promise<void> {
    const trimmed = userInput.trim()

    if (!trimmed) {
      return
    }

    // 命令处理
    if (trimmed.startsWith("/")) {
      await this.handleCommand(trimmed)
      return
    }

    // 正常消息
    this.isProcessing = true
    this.addMessage({ role: "user", content: trimmed })
    this.screen.setThinking(true)
    this.render()

    try {
      await this.options.onSubmit(trimmed)
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
  }

  // 处理命令
  private async handleCommand(cmd: string): Promise<void> {
    const parts = cmd.slice(1).split(/\s+/)
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)

    switch (command) {
      case "help":
      case "h":
        this.showHelp()
        break

      case "sessions":
      case "ls":
        await this.listSessions()
        break

      case "new":
        await this.newSession()
        break

      case "tree":
      case "t":
        this.toggleTree()
        break

      case "switch":
      case "sw":
        if (args.length > 0) {
          await this.switchToSession(args[0])
        } else {
          await this.listSessions()
        }
        break

      case "branch":
      case "b":
        await this.createBranch(args.join(" "))
        break

      case "export":
        await this.exportSession(args[0])
        break

      case "quit":
      case "q":
        console.log("\nGoodbye!")
        process.exit(0)
        break

      default:
        this.addMessage({
          role: "assistant",
          content: `Unknown command: ${command}. Type /help for available commands.`,
        })
        this.render()
    }
  }

  // 显示帮助
  private async showHelp(): Promise<void> {
    console.clear()
    console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("Commands", theme.assistantPrefix)}                                                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("/sessions, /ls", theme.statusBarHighlight)}     List all sessions                           ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/new", theme.statusBarHighlight)}           Create a new session                         ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/switch <id>", theme.statusBarHighlight)}   Switch to a session                          ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/branch [name]", theme.statusBarHighlight)} Create a branch from current position        ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/tree, /t", theme.statusBarHighlight)}       Toggle session tree view                    ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/export [file]", theme.statusBarHighlight)} Export session to JSON                      ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/help, /h", theme.statusBarHighlight)}       Show this help                              ${color("│", theme.border)}
${color("│", theme.border)}  ${color("/quit, /q", theme.statusBarHighlight)}       Exit                                        ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Press Enter to continue...", theme.statusBar)}                           ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
    await this.input.readLine()
    this.render()
  }

  // 列出会话
  private async listSessions(): Promise<void> {
    const sessions = await this.options.sessionManager.listSessions()

    console.clear()
    console.log(color("\n┌────────────────────────────────────────────────────────────┐", theme.border))
    console.log(color("│", theme.border) + color(" Sessions".padEnd(60) + "│", theme.assistantPrefix))
    console.log(color("├────────────────────────────────────────────────────────────┤", theme.border))

    if (sessions.length === 0) {
      console.log(color("│", theme.border) + color(" No sessions found".padEnd(60) + "│", theme.statusBar))
    } else {
      for (const s of sessions.slice(0, 10)) {
        const name = s.name.slice(0, 25).padEnd(25)
        const date = new Date(s.updatedAt).toLocaleDateString()
        const current = this.session?.meta.id === s.id ? " ◀" : ""
        console.log(
          color("│", theme.border) +
          color(` ${s.id.slice(-8)}  ${name}${date} (${s.entryCount} msgs)${current}`.padEnd(60) + "│",
            this.session?.meta.id === s.id ? theme.assistantPrefix : theme.statusBar)
        )
      }
    }

    console.log(color("└────────────────────────────────────────────────────────────┘", theme.border))
    await this.input.readLine()
    this.render()
  }

  // 创建新会话
  private async newSession(): Promise<void> {
    const session = await this.options.sessionManager.createSession()
    this.session = session
    this.history = []
    this.screen.setSession(session.meta.name)
    this.addMessage({
      role: "assistant",
      content: "New session created. How can I help you?",
    })
    this.render()
  }

  // 切换到指定会话
  private async switchToSession(id: string): Promise<void> {
    const session = await this.options.sessionManager.loadSession(id)
    if (session) {
      this.session = session
      this.history = []
      this.screen.setSession(session.meta.name)
      this.addMessage({
        role: "assistant",
        content: `Switched to session: ${session.meta.name}`,
      })
    } else {
      this.addMessage({
        role: "assistant",
        content: `Session not found: ${id}`,
      })
    }
    this.render()
  }

  // 创建分支
  private async createBranch(name?: string): Promise<void> {
    if (!this.session) {
      this.addMessage({
        role: "assistant",
        content: "No active session",
      })
      this.render()
      return
    }

    const currentEntryId = this.session.meta.currentEntryId
    const branch = await this.options.sessionManager.createBranch(currentEntryId, name || undefined)

    if (branch) {
      this.session = branch
      this.history = []
      this.screen.setSession(branch.meta.name)
      this.addMessage({
        role: "assistant",
        content: `Created branch: ${branch.meta.name}`,
      })
    } else {
      this.addMessage({
        role: "assistant",
        content: "Failed to create branch",
      })
    }
    this.render()
  }

  // 切换树视图
  private toggleTree(): void {
    this.showTree = !this.showTree
    this.render()
  }

  // 导出会话
  private async exportSession(filename?: string): Promise<void> {
    if (!this.session) return

    const json = await this.options.sessionManager.exportSession(this.session?.meta.id ?? "")
    if (json) {
      const name = filename ?? `${this.session.meta.name}.json`
      const { writeFile } = await import("fs/promises")
      await writeFile(name, json, "utf-8")
      this.addMessage({
        role: "assistant",
        content: `Session exported to: ${name}`,
      })
    }
    this.render()
  }

  // 树视图命令处理
  private async handleTreeCommand(): Promise<void> {
    const tree = this.options.sessionManager.buildTree()
    this.renderTree(tree)

    console.log(color("\n❯ ", theme.assistantPrefix) + color("Type entry ID to jump, /back to return, /quit to exit", theme.statusBar))

    const input = await this.input.readLine()
    const trimmed = input.trim()

    if (trimmed === "/back" || trimmed === "/q") {
      this.showTree = false
      this.render()
      return
    }

    // 尝试跳转到指定条目
    const success = await this.options.sessionManager.moveTo(trimmed)
    if (success) {
      this.history = []
      this.showTree = false
      this.addMessage({
        role: "assistant",
        content: `Jumped to: ${trimmed}`,
      })
    }

    this.render()
  }

  // 渲染树
  private renderTree(nodes: SessionTreeNode[], output: string[] = [], depth = 0): void {
    for (const node of nodes) {
      const prefix = "  ".repeat(depth) + (depth > 0 ? "└─ " : "")
      const active = node.entry.id === this.session?.meta.currentEntryId
      const marker = active ? color("◀", theme.assistantPrefix) : " "

      const typeIcon = node.entry.type === "user" ? "👤" :
        node.entry.type === "assistant" ? "🤖" :
        node.entry.type === "tool" ? "🔧" : "•"

      const content = node.entry.content.slice(0, 50) + (node.entry.content.length > 50 ? "..." : "")

      output.push(
        color(`${prefix}${marker}${typeIcon} `, active ? theme.assistantPrefix : theme.statusBar) +
        color(`${node.entry.id.slice(-8)}  ${content}`, active ? theme.assistantText : theme.statusBar)
      )

      if (node.children.length > 0) {
        this.renderTree(node.children, output, depth + 1)
      }
    }
  }

  // 加载或创建会话
  private async loadOrCreateSession(): Promise<void> {
    // 尝试加载最近的会话
    let session = await this.options.sessionManager.getMostRecentSession()

    if (!session) {
      session = await this.options.sessionManager.createSession()
    }

    this.session = session
    this.screen.setSession(session.meta.name)
    this.screen.setStatus(`Session: ${session.meta.name}`)
  }

  // 添加消息
  addMessage(message: Message): void {
    this.history.push(message)
  }

  // 设置消息历史
  setHistory(messages: Message[]): void {
    this.history = messages
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
    this.screen.setMessages(this.history)
    if (this.session) {
      this.screen.setSession(this.session.meta.name)
    }
  }

  // 欢迎信息
  private welcome(): void {
    console.clear()
    console.log(`
${color("┌────────────────────────────────────────────────────────────┐", theme.border)}
${color("│", theme.border)}  ${color("My Agent Phase 3 - Session Management", theme.assistantPrefix)}                   ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Features:", theme.statusBarHighlight)}                                                   ${color("│", theme.border)}
${color("│", theme.border)}    • Persistent sessions (JSONL)                               ${color("│", theme.border)}
${color("│", theme.border)}    • Session tree and branching                                 ${color("│", theme.border)}
${color("│", theme.border)}    • Time travel (jump to any point)                           ${color("│", theme.border)}
${color("│", theme.border)}    • Session export                                             ${color("│", theme.border)}
${color("├────────────────────────────────────────────────────────────┤", theme.border)}
${color("│", theme.border)}  ${color("Type /help for commands", theme.statusBar)}                                   ${color("│", theme.border)}
${color("└────────────────────────────────────────────────────────────┘", theme.border)}
`)
  }
}
