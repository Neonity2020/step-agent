// ============================================================
// Evolution Manager - 自进化管理器
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { WorkflowDetector } from "./detector"
import { SkillGenerator } from "./generator"
import type {
  EvolutionConfig,
  EvolutionStats,
  EvolutionEvent,
  DetectedWorkflow,
  SkillCandidate,
} from "./types.ts"

export class EvolutionManager {
  private detector: WorkflowDetector
  private generator: SkillGenerator
  private config: EvolutionConfig
  private events: EvolutionEvent[] = []
  private currentWorkflowId: string | null = null

  constructor(config?: Partial<EvolutionConfig>) {
    const home = Bun.env.HOME ?? "/tmp"

    this.config = {
      enabled: config?.enabled ?? true,
      autoDetect: config?.autoDetect ?? true,
      autoSuggest: config?.autoSuggest ?? true,
      minConfidence: config?.minConfidence ?? 60,
      minUsageCount: config?.minUsageCount ?? 3,
      workflowDir: config?.workflowDir ?? join(home, ".myagent", "workflows"),
      candidateDir: config?.candidateDir ?? join(home, ".myagent", "skill-candidates"),
      skillsDir: config?.skillsDir ?? join(home, ".myagent", "skills"),
      maxCandidates: config?.maxCandidates ?? 50,
    }

    this.detector = new WorkflowDetector({
      workflowDir: this.config.workflowDir,
    })

    this.generator = new SkillGenerator({
      skillsDir: this.config.skillsDir,
      candidateDir: this.config.candidateDir,
    })

    // 确保目录存在
    for (const dir of [
      this.config.workflowDir,
      this.config.candidateDir,
      this.config.skillsDir,
    ]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
  }

  // 启动工作流追踪
  startWorkflow(name?: string): string {
    this.currentWorkflowId = this.detector.startWorkflow(name)
    return this.currentWorkflowId
  }

  // 记录步骤
  recordStep(
    action: string,
    tool?: string,
    input?: Record<string, any>,
    output?: string,
    reasoning?: string
  ): void {
    this.detector.recordStep(action, tool, input, output, reasoning)
  }

  // 记录工具调用
  recordToolCall(toolName: string, input: Record<string, any>, output?: string, reasoning?: string): void {
    this.detector.recordToolCall({
      toolName,
      input,
      output,
      success: true,
    }, reasoning)
  }

  // 结束工作流
  async finishWorkflow(): Promise<SkillCandidate | null> {
    if (!this.currentWorkflowId) return null

    const workflow = await this.detector.finishWorkflow()
    this.currentWorkflowId = null

    if (!workflow) return null

    this.emit("workflow_detected", { workflow })

    // 检查是否满足生成条件
    if (workflow.confidence < this.config.minConfidence) {
      return null
    }

    // 生成候选技能
    const candidate = this.generator.generateFromWorkflow(workflow)
    this.generator.saveCandidate(candidate)

    this.emit("candidate_generated", { candidate })

    return candidate
  }

  // 批准技能
  approveSkill(candidateId: string): string | null {
    const candidate = this.generator.getCandidate(candidateId)
    if (!candidate) return null

    candidate.status = "approved"
    const path = this.generator.publishSkill(candidate)

    this.emit("skill_published", { candidate, path })

    return path
  }

  // 拒绝技能
  rejectSkill(candidateId: string, reason?: string): void {
    this.generator.rejectCandidate(candidateId, reason)
    this.emit("skill_rejected", { candidateId, reason })
  }

  // 获取统计数据
  getStats(): EvolutionStats {
    const workflows = this.detector.getAllWorkflows()
    const candidates = this.generator.getCandidates()

    return {
      workflowsDetected: workflows.length,
      candidatesGenerated: candidates.filter((c) => c.status === "candidate").length,
      skillsApproved: candidates.filter((c) => c.status === "published").length,
      skillsPublished: candidates.filter((c) => c.status === "published").length,
      totalEffectiveness: Math.round(
        candidates.reduce((sum, c) => sum + (c.effectiveness || 0), 0) /
          (candidates.length || 1)
      ),
    }
  }

  // 获取候选列表
  getCandidates(): SkillCandidate[] {
    return this.generator.getCandidates()
  }

  // 获取候选详情
  getCandidate(id: string): SkillCandidate | null {
    return this.generator.getCandidate(id)
  }

  // 获取工作流列表
  getWorkflows(): DetectedWorkflow[] {
    return this.detector.getAllWorkflows()
  }

  // 获取模式统计
  getPatternStats() {
    return this.detector.getPatternStats()
  }

  // 获取配置
  getConfig(): EvolutionConfig {
    return { ...this.config }
  }

  // 更新配置
  updateConfig(config: Partial<EvolutionConfig>): void {
    Object.assign(this.config, config)
  }

  // 启用/禁用
  enable(): void {
    this.config.enabled = true
  }

  disable(): void {
    this.config.enabled = false
  }

  // 获取事件历史
  getEvents(): EvolutionEvent[] {
    return [...this.events]
  }

  // 发送事件
  private emit(type: EvolutionEvent["type"], data: Record<string, any>): void {
    this.events.push({
      type,
      timestamp: new Date().toISOString(),
      data,
    })

    // 限制事件数量
    if (this.events.length > 100) {
      this.events = this.events.slice(-100)
    }
  }

  // 分析对话提取技能
  async analyzeConversation(
    conversation: Array<{ role: string; content: string }>
  ): Promise<SkillCandidate[]> {
    const candidates: SkillCandidate[] = []

    // 简单的对话分析：检测重复模式
    const patterns: Map<string, number> = new Map()

    for (const msg of conversation) {
      if (msg.role === "user") {
        // 提取关键词
        const keywords = this.extractKeywords(msg.content)

        for (const keyword of keywords) {
          patterns.set(keyword, (patterns.get(keyword) || 0) + 1)
        }
      }
    }

    // 生成候选
    for (const [pattern, count] of patterns) {
      if (count >= 3) {
        // 出现 3 次以上的模式
        candidates.push({
          id: `skill-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: `${this.capitalizeFirst(pattern)} Workflow`,
          description: `Workflow related to ${pattern}`,
          instruction: `# ${this.capitalizeFirst(pattern)} Workflow\n\nThis workflow handles ${pattern}-related tasks.\n\n## When to Use\nUse this when working on ${pattern} tasks.\n\n## Steps\n1. Understand the requirements\n2. Plan the approach\n3. Implement\n4. Verify`,
          category: "general",
          tags: [pattern],
          confidence: Math.min(count * 20, 80),
          createdAt: new Date().toISOString(),
          status: "candidate",
        })
      }
    }

    return candidates
  }

  // 提取关键词
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "can", "this", "that", "these", "those",
      "i", "you", "we", "they", "he", "she", "it", "my", "your", "our",
    ])

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w))

    // 常见任务词
    const taskWords = words.filter((w) =>
      /^(fix|debug|test|create|add|remove|update|refactor|review|deploy|build|run|check|implement|setup)/.test(
        w
      )
    )

    return taskWords.length > 0 ? taskWords : words.slice(0, 5)
  }

  // 首字母大写
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  // 生成进化报告
  generateReport(): string {
    const stats = this.getStats()
    const patterns = this.detector.getPatternStats().slice(0, 5)
    const candidates = this.generator
      .getCandidates()
      .filter((c) => c.status === "candidate")

    const lines: string[] = []
    lines.push("# Skills Evolution Report")
    lines.push("")
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push("")
    lines.push("## Statistics")
    lines.push(`- Workflows Detected: ${stats.workflowsDetected}`)
    lines.push(`- Candidates Generated: ${stats.candidatesGenerated}`)
    lines.push(`- Skills Published: ${stats.skillsPublished}`)
    lines.push(`- Average Effectiveness: ${stats.totalEffectiveness}%`)
    lines.push("")

    if (patterns.length > 0) {
      lines.push("## Common Patterns")
      for (const p of patterns) {
        lines.push(`- \`${p.pattern}\` (${p.frequency} times)`)
      }
      lines.push("")
    }

    if (candidates.length > 0) {
      lines.push("## Pending Candidates")
      for (const c of candidates.slice(0, 5)) {
        lines.push(`- **${c.name}** (${c.confidence}% confidence)`)
        lines.push(`  ${c.description}`)
      }
      lines.push("")
    }

    lines.push("## Recommendations")
    if (candidates.length > 0) {
      lines.push("- Review and approve pending candidates")
    }
    if (patterns.length === 0) {
      lines.push("- More usage needed to detect patterns")
    }

    return lines.join("\n")
  }
}
