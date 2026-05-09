// ============================================================
// Message Queue - 消息队列
// ============================================================
// 
// 支持两种排队模式：
// - Steering: 当前工具执行完成后立即交付
// - Follow-up: Agent 完全空闲后交付
// ============================================================

export interface QueuedMessage {
  id: string
  content: string
  type: "steering" | "follow-up"
  timestamp: number
}

export class MessageQueue {
  private queue: QueuedMessage[] = []
  private isProcessing: boolean = false

  // 入队消息
  enqueue(content: string, type: "steering" | "follow-up"): string {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    
    this.queue.push({
      id,
      content,
      type,
      timestamp: Date.now(),
    })

    return id
  }

  // 获取 Steering 消息（工具执行后交付）
  getSteeringMessages(): QueuedMessage[] {
    return this.queue.filter(m => m.type === "steering")
  }

  // 获取 Follow-up 消息（空闲时交付）
  getFollowUpMessages(): QueuedMessage[] {
    return this.queue.filter(m => m.type === "follow-up")
  }

  // 消费 Steering 消息（工具完成后调用）
  consumeSteering(): QueuedMessage[] {
    const messages = this.getSteeringMessages()
    this.queue = this.queue.filter(m => m.type !== "steering")
    return messages
  }

  // 消费 Follow-up 消息（Agent 空闲时调用）
  consumeFollowUp(): QueuedMessage[] {
    const messages = this.getFollowUpMessages()
    this.queue = this.queue.filter(m => m.type !== "follow-up")
    return messages
  }

  // 移除指定消息
  dequeue(id: string): boolean {
    const index = this.queue.findIndex(m => m.id === id)
    if (index !== -1) {
      this.queue.splice(index, 1)
      return true
    }
    return false
  }

  // 清空队列
  clear(): void {
    this.queue = []
  }

  // 清空指定类型
  clearType(type: "steering" | "follow-up"): void {
    this.queue = this.queue.filter(m => m.type !== type)
  }

  // 检查队列是否为空
  isEmpty(): boolean {
    return this.queue.length === 0
  }

  // 获取队列长度
  size(): number {
    return this.queue.length
  }

  // 获取所有消息
  getAll(): QueuedMessage[] {
    return [...this.queue]
  }

  // 设置处理状态
  setProcessing(processing: boolean): void {
    this.isProcessing = processing
  }

  // 是否正在处理
  isCurrentlyProcessing(): boolean {
    return this.isProcessing
  }

  // 获取统计
  getStats(): { steering: number; followUp: number; total: number } {
    const steering = this.queue.filter(m => m.type === "steering").length
    const followUp = this.queue.filter(m => m.type === "follow-up").length
    return { steering, followUp, total: this.queue.length }
  }
}
