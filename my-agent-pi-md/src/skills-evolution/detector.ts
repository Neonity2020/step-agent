// ============================================================
// Workflow Detector - 工作流检测器
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join, dirname } from "path"
import type { WorkflowStep, DetectedWorkflow, WorkflowPattern } from "./types.ts"

export interface ToolCall {
  toolName: string
  input: Record<string, any>
  output?: string
  success: boolean
}

// 常见工作流模式
const KNOWN_PATTERNS = [
  {
    name: "File Creation",
    pattern: ["bash:mkdir", "write", "write"],
    description: "Create files with directory setup",
  },
  {
    name: "Code Review",
    pattern: ["read", "read", "bash"],
    description: "Review code and run tests",
  },
  {
    name: "Bug Fix",
    pattern: ["bash", "read", "read", "edit", "bash"],
    description: "Debug and fix issues",
  },
  {
    name: "Feature Development",
    pattern: ["read", "read", "write", "edit", "bash"],
    description: "Read, modify, and test code",
  },
  {
    name: "Documentation",
    pattern: ["read", "write", "bash"],
    description: "Create documentation",
  },
  {
    name: "Test Driven Development",
    pattern: ["write", "bash", "edit", "bash"],
    description: "Write test first, then code",
  },
  {
    name: "Refactoring",
    pattern: ["read", "read", "edit", "edit", "bash"],
    description: "Improve existing code structure",
  },
]

export class WorkflowDetector {
  private config: { workflowDir: string }
  private currentWorkflow: WorkflowStep[] = []
  private workflowCount = 0

  constructor(config?: { workflowDir: string }) {
    const home = Bun.env.HOME ?? "/tmp"
    this.config = {
      workflowDir: config?.workflowDir ?? join(home, ".myagent", "workflows"),
    }

    // 确保目录存在
    if (!existsSync(this.config.workflowDir)) {
      mkdirSync(this.config.workflowDir, { recursive: true })
    }
  }

  // 开始追踪工作流
  startWorkflow(name?: string): string {
    const id = `wf-${Date.now()}-${++this.workflowCount}`
    this.currentWorkflow = []
    return id
  }

  // 记录步骤
  recordStep(
    action: string,
    tool?: string,
    input?: Record<string, any>,
    output?: string,
    reasoning?: string
  ): void {
    this.currentWorkflow.push({
      stepNumber: this.currentWorkflow.length + 1,
      action,
      tool,
      input,
      output: output ? this.truncate(output, 200) : undefined,
      reasoning,
    })
  }

  // 记录工具调用
  recordToolCall(toolCall: ToolCall, reasoning?: string): void {
    this.recordStep(
      this.describeAction(toolCall.toolName, toolCall.input),
      toolCall.toolName,
      toolCall.input,
      toolCall.output,
      reasoning
    )
  }

  // 结束工作流并检测模式
  async finishWorkflow(): Promise<DetectedWorkflow | null> {
    if (this.currentWorkflow.length < 2) {
      this.currentWorkflow = []
      return null
    }

    // 检测模式
    const pattern = this.detectPattern()
    
    // 创建工作流
    const workflow: DetectedWorkflow = {
      id: `wf-${Date.now()}`,
      name: pattern?.name ?? this.summarizeWorkflow(),
      description: pattern?.description ?? this.describeWorkflow(),
      steps: [...this.currentWorkflow],
      confidence: pattern ? 80 : 50,
      usageCount: 1,
      createdAt: new Date().toISOString(),
      tags: pattern ? [pattern.name] : [],
    }

    // 保存工作流
    this.saveWorkflow(workflow)

    // 检测是否值得生成技能
    const worthGenerating = this.evaluateWorkflow(workflow)

    this.currentWorkflow = []
    return worthGenerating ? workflow : null
  }

  // 检测工作流模式
  private detectPattern(): { name: string; description: string } | null {
    const toolSequence = this.currentWorkflow
      .filter((s) => s.tool)
      .map((s) => s.tool)
      .join(",")

    for (const pattern of KNOWN_PATTERNS) {
      if (this.matchesPattern(toolSequence, pattern.pattern.join(","))) {
        return { name: pattern.name, description: pattern.description }
      }
    }

    return null
  }

  // 匹配模式
  private matchesPattern(sequence: string, pattern: string): boolean {
    const seqParts = sequence.split(",")
    const patParts = pattern.split(",")

    // 简单匹配：检查是否以模式开头
    if (patParts.every((p, i) => seqParts[i]?.includes(p) || p === "*")) {
      return true
    }

    return false
  }

  // 评估工作流是否值得生成技能
  private evaluateWorkflow(workflow: DetectedWorkflow): boolean {
    // 至少 3 个步骤
    if (workflow.steps.length < 3) return false

    // 有工具调用
    const hasTools = workflow.steps.some((s) => s.tool)
    if (!hasTools) return false

    // 有意义的描述
    if (workflow.description.length < 10) return false

    return true
  }

  // 总结工作流
  private summarizeWorkflow(): string {
    if (this.currentWorkflow.length === 0) return "Empty Workflow"

    const tools = this.currentWorkflow
      .filter((s) => s.tool)
      .map((s) => s.tool)
      .slice(0, 3)

    return tools.join(" → ") || "Custom Workflow"
  }

  // 描述工作流
  private describeWorkflow(): string {
    const actions = this.currentWorkflow.map((s) => s.action).slice(0, 5)
    return actions.join(" → ")
  }

  // 描述动作
  private describeAction(tool: string, input: Record<string, any>): string {
    switch (tool) {
      case "read":
        return `Read ${input.path || "file"}`
      case "write":
        return `Write ${input.path || "file"}`
      case "edit":
        return `Edit ${input.path || "file"}`
      case "bash":
        if (input.command?.includes("git")) return "Git operation"
        if (input.command?.includes("npm") || input.command?.includes("bun")) return "Package operation"
        if (input.command?.includes("test")) return "Run tests"
        if (input.command?.includes("build")) return "Build project"
        return `Execute: ${(input.command as string)?.slice(0, 30) || "command"}`
      default:
        return `Use ${tool}`
    }
  }

  // 截断文本
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + "..."
  }

  // 保存工作流
  private saveWorkflow(workflow: DetectedWorkflow): void {
    const path = join(this.config.workflowDir, `${workflow.id}.json`)
    writeFileSync(path, JSON.stringify(workflow, null, 2), "utf-8")
  }

  // 加载工作流
  loadWorkflow(id: string): DetectedWorkflow | null {
    const path = join(this.config.workflowDir, `${id}.json`)
    if (!existsSync(path)) return null

    try {
      return JSON.parse(readFileSync(path, "utf-8"))
    } catch {
      return null
    }
  }

  // 获取所有工作流
  getAllWorkflows(): DetectedWorkflow[] {
    const workflows: DetectedWorkflow[] = []

    try {
      const files = (Bun as any).globbySync
        ? (Bun as any).globbySync(join(this.config.workflowDir, "*.json"))
        : []

      for (const file of files) {
        try {
          const workflow = JSON.parse(readFileSync(file, "utf-8"))
          workflows.push(workflow)
        } catch {}
      }
    } catch {}

    return workflows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  // 统计模式
  getPatternStats(): WorkflowPattern[] {
    const workflows = this.getAllWorkflows()
    const patterns: Map<string, WorkflowPattern> = new Map()

    for (const wf of workflows) {
      const key = wf.steps.map((s) => s.tool || "user").join("→")
      const existing = patterns.get(key)

      if (existing) {
        existing.frequency++
        existing.lastSeen = wf.createdAt
      } else {
        patterns.set(key, {
          pattern: key,
          steps: wf.steps.map((s) => s.action),
          frequency: 1,
          lastSeen: wf.createdAt,
        })
      }
    }

    return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency)
  }

  // 更新工作流统计
  updateWorkflowStats(id: string): void {
    const workflow = this.loadWorkflow(id)
    if (!workflow) return

    workflow.usageCount++
    workflow.lastUsed = new Date().toISOString()
    this.saveWorkflow(workflow)
  }
}
