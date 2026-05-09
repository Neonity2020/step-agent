// ============================================================
// Streaming TUI - 流式输出 UI 组件
// ============================================================

import { color, theme } from "./colors"

// 流式渲染状态
export interface StreamState {
  text: string
  thinking: string
  toolCalls: Array<{
    name: string
    input: string
    status: "pending" | "input" | "done"
  }>
  currentToolCall: number
}

// 流式渲染器
export class StreamingUI {
  private state: StreamState
  private onUpdate?: () => void
  private showThinking: boolean
  private autoScroll: boolean
  private startY: number

  constructor(options?: {
    onUpdate?: () => void
    showThinking?: boolean
    autoScroll?: boolean
  }) {
    this.state = {
      text: "",
      thinking: "",
      toolCalls: [],
      currentToolCall: -1,
    }
    this.onUpdate = options?.onUpdate
    this.showThinking = options?.showThinking ?? true
    this.autoScroll = options?.autoScroll ?? true
    this.startY = 0
  }

  // 开始新的流
  start(): void {
    this.state = {
      text: "",
      thinking: "",
      toolCalls: [],
      currentToolCall: -1,
    }
    this.startY = this.getCurrentLine()
  }

  // 添加文本
  addText(text: string): void {
    this.state.text += text
    this.render()
  }

  // 添加思考
  addThinking(text: string): void {
    this.state.thinking += text
    if (this.showThinking) {
      this.render()
    }
  }

  // 工具调用开始
  startToolCall(name: string): void {
    this.state.toolCalls.push({
      name,
      input: "",
      status: "pending",
    })
    this.state.currentToolCall = this.state.toolCalls.length - 1
    this.render()
  }

  // 工具输入增量
  addToolInput(partialJson: string): void {
    if (this.state.currentToolCall >= 0) {
      const tool = this.state.toolCalls[this.state.currentToolCall]
      tool.input += partialJson
      tool.status = "input"
      this.render()
    }
  }

  // 工具调用完成
  endToolCall(): void {
    if (this.state.currentToolCall >= 0) {
      this.state.toolCalls[this.state.currentToolCall].status = "done"
      this.state.currentToolCall = -1
      this.render()
    }
  }

  // 获取状态
  getState(): StreamState {
    return { ...this.state }
  }

  // 获取最终文本
  getText(): string {
    return this.state.text
  }

  // 获取工具调用
  getToolCalls(): Array<{ name: string; input: Record<string, unknown> }> {
    return this.state.toolCalls.map(tc => {
      try {
        return {
          name: tc.name,
          input: tc.input ? JSON.parse(tc.input) : {},
        }
      } catch {
        return {
          name: tc.name,
          input: {},
        }
      }
    })
  }

  // 渲染
  render(): void {
    // 移动到起始行
    this.moveTo(this.startY)
    this.clearToEnd()

    const lines: string[] = []

    // Assistant 前缀
    lines.push(color("🤖 Assistant", theme.assistantPrefix))

    // 思考中
    if (this.state.thinking) {
      const thinkingPreview = this.state.thinking.slice(-200)
      lines.push(color(`💭 ${thinkingPreview}${this.state.thinking.length > 200 ? "..." : ""}`, theme.thinking))
    }

    // 文本内容
    if (this.state.text) {
      lines.push(this.state.text)
    }

    // 工具调用
    for (let i = 0; i < this.state.toolCalls.length; i++) {
      const tool = this.state.toolCalls[i]
      
      if (tool.status === "pending") {
        lines.push(color(`🔧 Tool: ${tool.name} (starting...)`, theme.toolPrefix))
      } else if (tool.status === "input") {
        lines.push(color(`🔧 Tool: ${tool.name}`, theme.toolPrefix))
        // 截断显示输入
        const inputPreview = tool.input.length > 100 
          ? tool.input.slice(0, 100) + "..." 
          : tool.input
        lines.push(color(`   Input: ${inputPreview}`, theme.toolText))
      } else {
        lines.push(color(`✅ Tool: ${tool.name} (complete)`, theme.toolPrefix))
      }
    }

    // 输出
    for (const line of lines) {
      console.log(line)
    }

    // 自动滚动
    if (this.autoScroll) {
      this.scrollToBottom()
    }

    this.onUpdate?.()
  }

  // 完成
  done(): void {
    this.render()
    console.log() // 空行
  }

  // 清除
  clear(): void {
    this.moveTo(this.startY)
    this.clearToEnd()
  }

  // 获取当前行号
  private getCurrentLine(): number {
    return 0 // 简化实现
  }

  // 移动到指定行
  private moveTo(line: number): void {
    if (line > 0) {
      process.stdout.write(`\x1b[${line};1H`)
    }
  }

  // 清除到行尾
  private clearToEnd(): void {
    process.stdout.write("\x1b[J")
  }

  // 滚动到底部
  private scrollToBottom(): void {
    process.stdout.write("\x1b[J") // 清除到屏幕结尾
  }
}

// 创建带动画的流式渲染器
export class AnimatedStreamingUI extends StreamingUI {
  private animationFrame: number = 0
  private dots: string = ""

  render(): void {
    this.animationFrame = (this.animationFrame + 1) % 4
    this.dots = ".".repeat(this.animationFrame) + " ".repeat(3 - this.animationFrame)
    
    // 调用父类渲染
    super.render()
  }

  // 显示等待动画
  renderWaiting(): void {
    const state = this.getState()
    console.clear()
    console.log(color("🤖 Assistant", theme.assistantPrefix))
    
    if (state.thinking) {
      console.log(color(`💭 Thinking${this.dots}`, theme.thinking))
    }
    
    if (state.toolCalls.length > 0) {
      const tool = state.toolCalls[state.toolCalls.length - 1]
      console.log(color(`🔧 Using tool: ${tool.name}${this.dots}`, theme.toolPrefix))
    }
  }
}

// 简单的状态栏渲染
export class StatusBar {
  private items: Map<string, string> = new Map()
  private onUpdate?: () => void

  constructor(onUpdate?: () => void) {
    this.onUpdate = onUpdate
  }

  set(key: string, value: string): void {
    this.items.set(key, value)
    this.render()
  }

  remove(key: string): void {
    this.items.delete(key)
    this.render()
  }

  render(): void {
    const width = process.stdout.columns || 80
    const parts: string[] = []

    for (const [key, value] of this.items) {
      parts.push(color(`${key}: ${value}`, theme.statusBar))
    }

    const bar = " │ ".replace("-", "─").repeat(1) + parts.join(" │ ")
    const truncated = bar.slice(0, width - 2)

    process.stdout.write(`\x1b[J`) // 清除到屏幕结尾
    console.log(color("─".repeat(width), theme.border))
    console.log(truncated)
    
    this.onUpdate?.()
  }
}
