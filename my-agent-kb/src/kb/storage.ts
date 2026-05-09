// ============================================================
// Knowledge Base Storage - 知识库存储
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "fs"
import { join, basename } from "path"
import type { KBEntry, KBEntryType, KBConfig, KBStats } from "./types.ts"

export class KBStorage {
  private directory: string
  private entries: Map<string, KBEntry> = new Map()

  constructor(directory: string) {
    this.directory = directory
    this.ensureDirectory()
  }

  // 确保目录存在
  private ensureDirectory(): void {
    if (!existsSync(this.directory)) {
      mkdirSync(this.directory, { recursive: true })
    }
  }

  // 生成 ID
  private generateId(): string {
    return `kb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  // 获取条目文件路径
  private getEntryPath(id: string): string {
    return join(this.directory, `${id}.json`)
  }

  // 添加条目
  add(entry: Omit<KBEntry, "id" | "createdAt" | "updatedAt">): KBEntry {
    const now = new Date().toISOString()
    const fullEntry: KBEntry = {
      ...entry,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    }

    this.entries.set(fullEntry.id, fullEntry)
    this.saveEntry(fullEntry)

    return fullEntry
  }

  // 更新条目
  update(id: string, updates: Partial<KBEntry>): KBEntry | null {
    const entry = this.entries.get(id)
    if (!entry) return null

    const updated: KBEntry = {
      ...entry,
      ...updates,
      id: entry.id, // 保持 ID 不变
      createdAt: entry.createdAt, // 保持创建时间
      updatedAt: new Date().toISOString(),
    }

    this.entries.set(id, updated)
    this.saveEntry(updated)

    return updated
  }

  // 删除条目
  delete(id: string): boolean {
    const entry = this.entries.get(id)
    if (!entry) return false

    this.entries.delete(id)

    // 删除文件
    const filePath = this.getEntryPath(id)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }

    return true
  }

  // 获取单个条目
  get(id: string): KBEntry | undefined {
    return this.entries.get(id)
  }

  // 获取所有条目
  getAll(): KBEntry[] {
    return Array.from(this.entries.values())
  }

  // 按类型获取
  getByType(type: KBEntryType): KBEntry[] {
    return this.getAll().filter(e => e.type === type)
  }

  // 按标签获取
  getByTag(tag: string): KBEntry[] {
    return this.getAll().filter(e => e.tags.includes(tag))
  }

  // 搜索
  search(query: string): KBEntry[] {
    const q = query.toLowerCase()
    return this.getAll().filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      e.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  // 保存单个条目到文件
  private saveEntry(entry: KBEntry): void {
    const filePath = this.getEntryPath(entry.id)
    writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8")
  }

  // 从文件加载
  private loadEntry(filePath: string): KBEntry | null {
    try {
      const content = readFileSync(filePath, "utf-8")
      return JSON.parse(content) as KBEntry
    } catch {
      return null
    }
  }

  // 加载所有条目
  loadAll(): void {
    this.entries.clear()

    if (!existsSync(this.directory)) {
      return
    }

    const files = readdirSync(this.directory)

    for (const file of files) {
      if (!file.endsWith(".json")) continue

      const filePath = join(this.directory, file)
      const stats = statSync(filePath)

      // 跳过目录
      if (stats.isDirectory()) continue

      const entry = this.loadEntry(filePath)
      if (entry) {
        // 检查是否过期
        if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
          this.delete(entry.id)
        } else {
          this.entries.set(entry.id, entry)
        }
      }
    }
  }

  // 获取统计
  getStats(): KBStats {
    const entries = this.getAll()

    const byType: Record<KBEntryType, number> = {
      project: 0,
      decision: 0,
      pattern: 0,
      task: 0,
      context: 0,
      note: 0,
      rule: 0,
    }

    const byTag: Record<string, number> = {}

    for (const entry of entries) {
      byType[entry.type]++
      for (const tag of entry.tags) {
        byTag[tag] = (byTag[tag] ?? 0) + 1
      }
    }

    let totalSize = 0
    for (const entry of entries) {
      totalSize += entry.content.length
    }

    return {
      totalEntries: entries.length,
      byType,
      byTag,
      lastUpdated: entries.length > 0
        ? entries.reduce((a, b) => a.updatedAt > b.updatedAt ? a : b).updatedAt
        : new Date().toISOString(),
      totalSize,
    }
  }

  // 清理过期条目
  cleanup(): number {
    let count = 0
    const now = new Date()

    for (const entry of this.entries.values()) {
      if (entry.expiresAt && new Date(entry.expiresAt) < now) {
        this.delete(entry.id)
        count++
      }
    }

    return count
  }

  // 删除低优先级条目
  pruneLowPriority(minImportance: number): number {
    let count = 0

    for (const entry of this.entries.values()) {
      if (entry.importance < minImportance) {
        this.delete(entry.id)
        count++
      }
    }

    return count
  }

  // 导出所有条目
  export(): string {
    return JSON.stringify(this.getAll(), null, 2)
  }

  // 导入条目
  import(json: string): number {
    try {
      const entries = JSON.parse(json) as KBEntry[]
      let count = 0

      for (const entry of entries) {
        if (!this.entries.has(entry.id)) {
          this.entries.set(entry.id, entry)
          this.saveEntry(entry)
          count++
        }
      }

      return count
    } catch {
      return 0
    }
  }
}
