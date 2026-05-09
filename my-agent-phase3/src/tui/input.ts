// ============================================================
// TUI Input - 交互式输入处理
// ============================================================

import * as readline from "readline"

export interface InputHandler {
  // 开始监听输入
  start(): void

  // 停止监听
  stop(): void

  // 获取当前输入
  getInput(): string

  // 设置输入
  setInput(input: string): void

  // 清空输入
  clear(): void

  // 事件回调
  onSubmit(callback: (input: string) => void): void
  onKeypress(callback: (key: string, special: KeyInfo) => void): void
}

export interface KeyInfo {
  ctrl: boolean
  meta: boolean
  shift: boolean
  name: string
  sequence: string
}

// 输入处理器
export class InputHandlerImpl implements InputHandler {
  private input: string = ""
  private cursorPos: number = 0
  private listeners: {
    submit: Array<(input: string) => void>
    keypress: Array<(key: string, info: KeyInfo) => void>
  } = {
    submit: [],
    keypress: [],
  }

  private rl: readline.Interface | null = null
  private rawMode: boolean = false

  constructor() {
    this.setupReadline()
  }

  private setupReadline(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: undefined,
      terminal: false,
    })

    readline.emitKeypressEvents(process.stdin)

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
      this.rawMode = true
    }
  }

  start(): void {
    if (!this.rl) return

    this.rl.on("line", (line) => {
      // Enter 提交
      if (line.trim()) {
        this.submitInput(line)
      }
    })

    process.stdin.on("keypress", (str, key) => {
      this.handleKeypress(str, key)
    })
  }

  stop(): void {
    if (this.rawMode && process.stdin.isTTY) {
      process.stdin.setRawMode(false)
      this.rawMode = false
    }
    if (this.rl) {
      this.rl.close()
      this.rl = null
    }
  }

  private handleKeypress(str: string | undefined, key: readline.Key): void {
    const info: KeyInfo = {
      ctrl: key.ctrl ?? false,
      meta: key.meta ?? false,
      shift: key.shift ?? false,
      name: key.name ?? "",
      sequence: key.sequence ?? str ?? "",
    }

    // Ctrl+C - 退出
    if (info.ctrl && info.name === "c") {
      this.stop()
      console.log("\n" + "Goodbye!")
      process.exit(0)
    }

    // Ctrl+U - 清空输入
    if (info.ctrl && info.name === "u") {
      this.input = ""
      this.cursorPos = 0
      this.notifyKeypress("", info)
      return
    }

    // Ctrl+L - 清屏
    if (info.ctrl && info.name === "l") {
      console.clear()
      this.notifyKeypress("", info)
      return
    }

    // 退格
    if (key.name === "backspace") {
      if (this.cursorPos > 0) {
        this.input =
          this.input.slice(0, this.cursorPos - 1) +
          this.input.slice(this.cursorPos)
        this.cursorPos--
        this.notifyKeypress(str ?? "", info)
      }
      return
    }

    // 删除
    if (key.name === "delete") {
      if (this.cursorPos < this.input.length) {
        this.input =
          this.input.slice(0, this.cursorPos) +
          this.input.slice(this.cursorPos + 1)
        this.notifyKeypress(str ?? "", info)
      }
      return
    }

    // 左右箭头
    if (key.name === "left") {
      if (this.cursorPos > 0) {
        this.cursorPos--
        this.notifyKeypress("", info)
      }
      return
    }

    if (key.name === "right") {
      if (this.cursorPos < this.input.length) {
        this.cursorPos++
        this.notifyKeypress("", info)
      }
      return
    }

    // Home / End
    if (key.name === "home") {
      this.cursorPos = 0
      this.notifyKeypress("", info)
      return
    }

    if (key.name === "end") {
      this.cursorPos = this.input.length
      this.notifyKeypress("", info)
      return
    }

    // 普通字符
    if (str && !key.ctrl && !key.meta) {
      this.input =
        this.input.slice(0, this.cursorPos) +
        str +
        this.input.slice(this.cursorPos)
      this.cursorPos += str.length
      this.notifyKeypress(str, info)
    }
  }

  private submitInput(input: string): void {
    for (const callback of this.listeners.submit) {
      callback(input)
    }
  }

  private notifyKeypress(key: string, info: KeyInfo): void {
    for (const callback of this.listeners.keypress) {
      callback(key, info)
    }
  }

  getInput(): string {
    return this.input
  }

  setInput(input: string): void {
    this.input = input
    this.cursorPos = input.length
  }

  clear(): void {
    this.input = ""
    this.cursorPos = 0
  }

  getCursorPosition(): number {
    return this.cursorPos
  }

  onSubmit(callback: (input: string) => void): void {
    this.listeners.submit.push(callback)
  }

  onKeypress(callback: (key: string, info: KeyInfo) => void): void {
    this.listeners.keypress.push(callback)
  }
}

// 简单的逐行输入（无 raw mode）
export class SimpleInput {
  private input: string = ""

  async readLine(): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      rl.question("❯ ", (answer) => {
        rl.close()
        resolve(answer)
      })
    })
  }
}
