// ============================================================
// Knowledge Base Manager - 知识库管理器
// ============================================================

import { join } from "path"
import type { 
  KBEntry, 
  KBEntryType, 
  KBConfig, 
  KBStats,
  KBSearchResult,
} from "./types"
import { IMPORTANCE_LEVELS as LEVELS } from "./types"
import { KBStorage } from "./storage"

export class KnowledgeBase {
  private storage: KBStorage
  private config: KBConfig

  constructor(config?: Partial<KBConfig>) {
    const home = Bun.env.HOME ?? "/tmp"
    this.config = {
      directory: config?.directory ?? join(home, ".myagent", "knowledge"),
      maxEntries: config?.maxEntries ?? 1000,
      autoSave: config?.autoSave ?? true,
      compressionEnabled: config?.compressionEnabled ?? true,
    }

    this.storage = new KBStorage(this.config.directory)
    this.storage.loadAll()
  }

  // ===== 基础操作 =====

  // 添加知识条目
  add(options: {
    type: KBEntryType
    title: string
    content: string
    tags?: string[]
    importance?: number
    sessionId?: string
    expiresAt?: string
  }): KBEntry {
    return this.storage.add({
      type: options.type,
      title: options.title,
      content: options.content,
      tags: options.tags ?? [],
      importance: options.importance ?? LEVELS.MEDIUM,
      sessionId: options.sessionId,
      expiresAt: options.expiresAt,
    })
  }

  // 更新条目
  update(id: string, updates: Partial<KBEntry>): KBEntry | null {
    return this.storage.update(id, updates)
  }

  // 删除条目
  delete(id: string): boolean {
    return this.storage.delete(id)
  }

  // 获取条目
  get(id: string): KBEntry | undefined {
    return this.storage.get(id)
  }

  // 获取所有条目
  getAll(): KBEntry[] {
    return this.storage.getAll()
  }

  // ===== 快捷方法 =====

  // 保存项目信息
  saveProjectInfo(info: {
    name: string
    structure: string
    dependencies: string[]
    scripts: Record<string, string>
  }): KBEntry {
    return this.add({
      type: "project",
      title: info.name,
      content: JSON.stringify(info, null, 2),
      tags: ["project", "structure"],
      importance: LEVELS.CRITICAL,
    })
  }

  // 保存决策
  saveDecision(decision: {
    title: string
    rationale: string
    alternatives?: string[]
    outcome?: string
  }): KBEntry {
    return this.add({
      type: "decision",
      title: decision.title,
      content: [
        `## Decision: ${decision.title}`,
        "",
        "## Rationale",
        decision.rationale,
        decision.alternatives ? `\n## Alternatives Considered\n${decision.alternatives.join("\n")}` : "",
        decision.outcome ? `\n## Outcome\n${decision.outcome}` : "",
      ].filter(Boolean).join("\n"),
      tags: ["decision", "architecture"],
      importance: LEVELS.HIGH,
    })
  }

  // 保存代码模式
  savePattern(pattern: {
    name: string
    description: string
    code: string
    language: string
  }): KBEntry {
    return this.add({
      type: "pattern",
      title: pattern.name,
      content: [
        `## ${pattern.name}`,
        "",
        pattern.description,
        "",
        "```" + pattern.language,
        pattern.code,
        "```",
      ].join("\n"),
      tags: ["pattern", pattern.language],
      importance: LEVELS.MEDIUM,
    })
  }

  // 保存会话摘要
  saveSessionSummary(summary: {
    sessionId: string
    topic: string
    keyPoints: string[]
    completed: boolean
    nextSteps?: string[]
  }): KBEntry {
    return this.add({
      type: "context",
      title: `Session: ${summary.topic}`,
      content: [
        `## Session Summary: ${summary.topic}`,
        "",
        "## Key Points",
        ...summary.keyPoints.map(p => `- ${p}`),
        "",
        `**Status**: ${summary.completed ? "✅ Completed" : "⏳ In Progress"}`,
        summary.nextSteps ? `\n## Next Steps\n${summary.nextSteps.map(s => `- ${s}`).join("\n")}` : "",
      ].join("\n"),
      tags: ["session", summary.completed ? "completed" : "pending"],
      importance: LEVELS.MEDIUM,
      sessionId: summary.sessionId,
    })
  }

  // 保存规则
  saveRule(rule: {
    title: string
    description: string
    appliesTo?: string[]
  }): KBEntry {
    return this.add({
      type: "rule",
      title: rule.title,
      content: [
        `## ${rule.title}`,
        "",
        rule.description,
        rule.appliesTo ? `\n**Applies to**: ${rule.appliesTo.join(", ")}` : "",
      ].filter(Boolean).join("\n"),
      tags: ["rule", ...(rule.appliesTo ?? [])],
      importance: LEVELS.HIGH,
    })
  }

  // 保存任务摘要
  saveTaskSummary(summary: {
    task: string
    result: string
    files: string[]
    issues?: string[]
  }): KBEntry {
    return this.add({
      type: "task",
      title: summary.task,
      content: [
        `## Task: ${summary.task}`,
        "",
        "## Result",
        summary.result,
        "",
        "## Files Modified",
        ...summary.files.map(f => `- ${f}`),
        summary.issues ? `\n## Issues Found\n${summary.issues.map(i => `- ${i}`).join("\n")}` : "",
      ].join("\n"),
      tags: ["task", ...summary.files.map(f => f.split("/").pop()!.split(".").pop()!)],
      importance: LEVELS.MEDIUM,
    })
  }

  // ===== 搜索 =====

  // 搜索
  search(query: string): KBSearchResult[] {
    const q = query.toLowerCase()
    const results: KBSearchResult[] = []

    for (const entry of this.storage.getAll()) {
      let score = 0
      const matchedOn: string[] = []

      // 标题匹配（高权重）
      if (entry.title.toLowerCase().includes(q)) {
        score += 50
        matchedOn.push("title")
      }

      // 内容匹配
      if (entry.content.toLowerCase().includes(q)) {
        score += 30
        matchedOn.push("content")
      }

      // 标签匹配
      for (const tag of entry.tags) {
        if (tag.toLowerCase().includes(q)) {
          score += 20
          matchedOn.push(`tag: ${tag}`)
        }
      }

      // 重要性加成
      score += entry.importance * 0.1

      if (score > 0) {
        results.push({ entry, score, matchedOn })
      }
    }

    return results.sort((a, b) => b.score - a.score)
  }

  // 智能加载上下文
  getContextForNewSession(topic?: string): string {
    const entries = this.storage.getAll()

    // 优先获取高优先级条目
    const prioritized = entries
      .filter(e => e.importance >= LEVELS.HIGH)
      .sort((a, b) => b.importance - a.importance)

    // 获取最近的会话摘要
    const recentSessions = entries
      .filter(e => e.type === "context" || e.type === "task")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)

    // 获取相关项目信息
    const projectInfo = entries.filter(e => e.type === "project")

    // 获取决策
    const decisions = entries.filter(e => e.type === "decision")

    // 构建上下文
    const parts: string[] = [
      "# Knowledge Base Context",
      "",
    ]

    // 项目信息
    if (projectInfo.length > 0) {
      parts.push("## Project Information")
      for (const p of projectInfo) {
        parts.push(`### ${p.title}`)
        parts.push(p.content)
        parts.push("")
      }
    }

    // 决策
    if (decisions.length > 0) {
      parts.push("## Key Decisions")
      for (const d of decisions.slice(0, 5)) {
        parts.push(`- **${d.title}**: ${d.content.slice(0, 200)}...`)
      }
      parts.push("")
    }

    // 最近的会话
    if (recentSessions.length > 0) {
      parts.push("## Recent Work")
      for (const s of recentSessions) {
        parts.push(`### ${s.title}`)
        parts.push(s.content.slice(0, 500))
        parts.push("")
      }
    }

    // 特定主题搜索
    if (topic) {
      const topicResults = this.search(topic).slice(0, 5)
      if (topicResults.length > 0) {
        parts.push(`## Relevant to: ${topic}`)
        for (const r of topicResults) {
          parts.push(`### ${r.entry.title} (${r.score.toFixed(0)}%)`)
          parts.push(r.entry.content.slice(0, 300))
          parts.push("")
        }
      }
    }

    return parts.join("\n")
  }

  // ===== 维护 =====

  // 获取统计
  getStats(): KBStats {
    return this.storage.getStats()
  }

  // 清理过期条目
  cleanup(): number {
    return this.storage.cleanup()
  }

  // 清理低优先级条目
  pruneLowPriority(): number {
    return this.storage.pruneLowPriority(LEVELS.LOW)
  }

  // 导出
  export(): string {
    return this.storage.export()
  }

  // 导入
  import(json: string): number {
    return this.storage.import(json)
  }

  // 合并会话
  mergeSession(sessionId: string, summary: {
    topic: string
    keyPoints: string[]
    decisions: string[]
    patterns: string[]
  }): void {
    // 保存会话摘要
    this.saveSessionSummary({
      sessionId,
      topic: summary.topic,
      keyPoints: summary.keyPoints,
      completed: true,
    })

    // 保存决策
    for (const decision of summary.decisions) {
      this.saveDecision({
        title: decision,
        rationale: `From session: ${summary.topic}`,
      })
    }

    // 保存代码模式
    for (const pattern of summary.patterns) {
      try {
        const { name, language, code } = JSON.parse(pattern)
        this.savePattern({ name, description: "", language, code })
      } catch {
        // 忽略无效的模式
      }
    }
  }

  // 获取条目按类型
  getByType(type: KBEntryType): KBEntry[] {
    return this.storage.getByType(type)
  }

  // 获取条目按标签
  getByTag(tag: string): KBEntry[] {
    return this.storage.getByTag(tag)
  }
}
