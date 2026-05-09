// ============================================================
// Session Manager - 会话管理器（持久化版）
// ============================================================

import { readFile, writeFile, appendFile, mkdir, readdir, stat } from "fs/promises"
import { join, dirname, basename } from "path"
import { existsSync } from "fs"
import type { Session, SessionEntry, SessionMeta, SessionInfo, SessionTreeNode, SessionPointer } from "./types.ts"

export class SessionManager {
  private sessionDir: string
  private currentSession: Session | null = null

  constructor(sessionDir?: string) {
    const home = Bun.env.HOME ?? "/tmp"
    this.sessionDir = sessionDir ?? join(home, ".myagent", "sessions")
  }

  // ==================== 会话创建 ====================

  async createSession(name?: string): Promise<Session> {
    const id = this.generateId()
    const now = new Date().toISOString()

    const meta: SessionMeta = {
      id,
      name: name ?? `session-${id.slice(-6)}`,
      createdAt: now,
      updatedAt: now,
      currentEntryId: id,
      version: 1,
    }

    // 创建根条目
    const rootEntry: SessionEntry = {
      id,
      parentId: null,
      type: "meta",
      role: "system",
      content: "Session created",
      timestamp: now,
    }

    const session: Session = {
      meta,
      path: join(this.sessionDir, `${id}.jsonl`),
      entries: [rootEntry],
    }

    // 确保目录存在
    await mkdir(this.sessionDir, { recursive: true })

    // 写入文件
    await writeFile(
      session.path,
      JSON.stringify(meta) + "\n" + JSON.stringify(rootEntry) + "\n",
      "utf-8"
    )

    this.currentSession = session
    return session
  }

  // ==================== 会话加载 ====================

  async loadSession(identifier: string): Promise<Session | null> {
    // identifier 可以是 ID 或路径
    const path = this.resolveSessionPath(identifier)
    if (!path || !existsSync(path)) {
      return null
    }

    try {
      const content = await readFile(path, "utf-8")
      const lines = content.trim().split("\n").filter(Boolean)

      if (lines.length < 1) {
        return null
      }

      // 第一行是元数据
      const meta = JSON.parse(lines[0]) as SessionMeta

      // 剩余行是条目
      const entries = lines.slice(1).map(line => JSON.parse(line) as SessionEntry)

      const session: Session = {
        meta,
        path,
        entries,
      }

      this.currentSession = session
      return session
    } catch (error) {
      console.error(`Failed to load session: ${error}`)
      return null
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    if (!existsSync(this.sessionDir)) {
      return []
    }

    const files = await readdir(this.sessionDir)
    const sessions: SessionInfo[] = []

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue

      try {
        const path = join(this.sessionDir, file)
        const content = await readFile(path, "utf-8")
        const lines = content.trim().split("\n").filter(Boolean)

        if (lines.length < 1) continue

        const meta = JSON.parse(lines[0])
        const stats = await stat(path)

        sessions.push({
          id: meta.id,
          name: meta.name,
          path,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt ?? stats.mtime.toISOString(),
          entryCount: lines.length - 1,
        })
      } catch {
        // 跳过无效文件
      }
    }

    // 按更新时间倒序
    return sessions.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }

  async getMostRecentSession(): Promise<Session | null> {
    const sessions = await this.listSessions()
    if (sessions.length === 0) return null
    return this.loadSession(sessions[0].id)
  }

  // ==================== 会话操作 ====================

  getCurrentSession(): Session | null {
    return this.currentSession
  }

  // 添加条目
  async addEntry(
    type: SessionEntry["type"],
    role: SessionEntry["role"],
    content: string,
    options?: Partial<Pick<SessionEntry, "toolName" | "toolInput" | "toolResult" | "label">>
  ): Promise<SessionEntry | null> {
    if (!this.currentSession) {
      console.error("No active session")
      return null
    }

    const parentId = this.currentSession.meta.currentEntryId
    const entry: SessionEntry = {
      id: this.generateId(),
      parentId,
      type,
      role,
      content,
      timestamp: new Date().toISOString(),
      ...options,
    }

    // 更新内存
    this.currentSession.entries.push(entry)
    this.currentSession.meta.currentEntryId = entry.id
    this.currentSession.meta.updatedAt = entry.timestamp

    // 写入文件
    await appendFile(
      this.currentSession.path,
      JSON.stringify(entry) + "\n",
      "utf-8"
    )

    // 更新元数据（追加到文件末尾）
    await this.updateMeta()

    return entry
  }

  // 更新会话元数据
  private async updateMeta(): Promise<void> {
    if (!this.currentSession) return

    // 读取现有内容
    const content = await readFile(this.currentSession.path, "utf-8")
    const lines = content.trim().split("\n").filter(Boolean)

    // 第一行是元数据，替换它
    lines[0] = JSON.stringify(this.currentSession.meta)

    await writeFile(this.currentSession.path, lines.join("\n") + "\n", "utf-8")
  }

  // ==================== 会话树导航 ====================

  // 获取当前分支路径
  getCurrentPath(): SessionEntry[] {
    if (!this.currentSession) return []

    const path: SessionEntry[] = []
    const map = new Map(this.currentSession.entries.map(e => [e.id, e]))

    let current = map.get(this.currentSession.meta.currentEntryId)
    while (current) {
      path.unshift(current)
      current = current.parentId ? map.get(current.parentId) : undefined
    }

    return path
  }

  // 移动指针到指定条目
  async moveTo(entryId: string): Promise<boolean> {
    if (!this.currentSession) return false

    const entry = this.currentSession.entries.find(e => e.id === entryId)
    if (!entry) return false

    this.currentSession.meta.currentEntryId = entryId
    this.currentSession.meta.updatedAt = new Date().toISOString()

    await this.updateMeta()
    return true
  }

  // 获取指定条目后的分支
  getBranchesFrom(entryId: string): SessionEntry[] {
    if (!this.currentSession) return []

    const entry = this.currentSession.entries.find(e => e.id === entryId)
    if (!entry) return []

    // 找到 entryId 之后的同分支条目
    const path: SessionEntry[] = []
    let current = entry

    for (const e of this.currentSession.entries) {
      if (e.parentId === current.id) {
        path.push(e)
        current = e
      }
    }

    return path
  }

  // 构建完整树结构
  buildTree(): SessionTreeNode[] {
    if (!this.currentSession) return []

    const entries = this.currentSession.entries
    const currentId = this.currentSession.meta.currentEntryId

    // 按 parentId 分组
    const childrenMap = new Map<string | null, SessionEntry[]>()
    for (const entry of entries) {
      const parentId = entry.parentId ?? "root"
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, [])
      }
      childrenMap.get(parentId)!.push(entry)
    }

    // 递归构建树
    const buildNodes = (parentId: string | null, depth: number): SessionTreeNode[] => {
      const children = childrenMap.get(parentId ?? "root") ?? []
      return children.map(entry => ({
        entry,
        children: buildNodes(entry.id, depth + 1),
        depth,
        isActive: entry.id === currentId,
      }))
    }

    return buildNodes(null, 0)
  }

  // ==================== 会话分支 ====================

  // 创建分支（从指定条目开始）
  async createBranch(fromEntryId: string, newSessionName?: string): Promise<Session | null> {
    if (!this.currentSession) return null

    const fromEntry = this.currentSession.entries.find(e => e.id === fromEntryId)
    if (!fromEntry) return null

    // 获取到该条目的路径
    const path = this.getPathTo(fromEntryId)

    // 创建新会话
    const newSession = await this.createSession(
      newSessionName ?? `${this.currentSession.meta.name}-branch`
    )

    // 复制路径上的所有条目（除了根）
    for (const entry of path.slice(1)) {
      await this.addEntry(entry.type, entry.role, entry.content, {
        toolName: entry.toolName,
        toolInput: entry.toolInput,
        toolResult: entry.toolResult,
      })
    }

    return newSession
  }

  // 获取到指定条目的路径
  getPathTo(entryId: string): SessionEntry[] {
    if (!this.currentSession) return []

    const map = new Map(this.currentSession.entries.map(e => [e.id, e]))
    const path: SessionEntry[] = []

    let current = map.get(entryId)
    while (current) {
      path.unshift(current)
      current = current.parentId ? map.get(current.parentId) : undefined
    }

    return path
  }

  // ==================== 工具方法 ====================

  // 删除会话
  async deleteSession(identifier: string): Promise<boolean> {
    const path = this.resolveSessionPath(identifier)
    if (!path) return false

    const { unlink } = await import("fs/promises")
    try {
      await unlink(path)
      if (this.currentSession?.path === path) {
        this.currentSession = null
      }
      return true
    } catch {
      return false
    }
  }

  // 重命名会话
  async renameSession(identifier: string, newName: string): Promise<boolean> {
    const session = await this.loadSession(identifier)
    if (!session) return false

    session.meta.name = newName
    session.meta.updatedAt = new Date().toISOString()

    await this.updateMeta()
    return true
  }

  // 导出会话
  async exportSession(identifier: string): Promise<string | null> {
    const session = await this.loadSession(identifier)
    if (!session) return null

    return JSON.stringify(session, null, 2)
  }

  // ==================== 私有方法 ====================

  private resolveSessionPath(identifier: string): string | null {
    // 如果是完整路径
    if (existsSync(identifier)) {
      return identifier
    }

    // 如果是 ID，构造路径
    const path = join(this.sessionDir, `${identifier}.jsonl`)
    if (existsSync(path)) {
      return path
    }

    // 模糊匹配
    return null
  }

  private generateId(): string {
    return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }
}
