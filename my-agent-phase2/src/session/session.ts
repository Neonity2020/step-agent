// ============================================================
// Session Manager - 会话管理（Phase 1: 内存版本）
// ============================================================

import type { Message } from "../types/index.ts"

export interface Session {
  id: string
  name: string
  createdAt: Date
  messages: Message[]
}

// 会话管理器（Phase 1 仅内存存储）
export class SessionManager {
  private sessions: Map<string, Session> = new Map()
  private currentSession: Session | null = null

  // 创建新会话
  createSession(name?: string): Session {
    const id = this.generateId()
    const session: Session = {
      id,
      name: name ?? `session-${id}`,
      createdAt: new Date(),
      messages: [],
    }

    this.sessions.set(id, session)
    this.currentSession = session

    return session
  }

  // 获取当前会话
  getCurrentSession(): Session | null {
    return this.currentSession
  }

  // 切换会话
  switchSession(id: string): Session | null {
    const session = this.sessions.get(id)
    if (session) {
      this.currentSession = session
    }
    return session ?? null
  }

  // 添加消息到当前会话
  addMessage(message: Message) {
    if (this.currentSession) {
      this.currentSession.messages.push(message)
    }
  }

  // 获取所有会话列表
  listSessions(): Array<{ id: string; name: string; createdAt: Date }> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
    }))
  }

  // 删除会话
  deleteSession(id: string): boolean {
    return this.sessions.delete(id)
  }

  // 生成唯一 ID
  private generateId(): string {
    return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}
