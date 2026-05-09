// ============================================================
// Skill Generator - 技能生成器
// 根据工作流生成 SKILL.md 文件
// ============================================================

import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs"
import { join, basename, dirname } from "path"
import type { 
  DetectedWorkflow, 
  SkillCandidate, 
  GeneratedSkill,
  SkillVariable,
  WorkflowStep 
} from "./types.ts"

export class SkillGenerator {
  private skillsDir: string
  private candidateDir: string

  constructor(config?: { skillsDir?: string; candidateDir?: string }) {
    const home = Bun.env.HOME ?? "/tmp"
    this.skillsDir = config?.skillsDir ?? join(home, ".myagent", "skills")
    this.candidateDir = config?.candidateDir ?? join(home, ".myagent", "skill-candidates")

    // 确保目录存在
    if (!existsSync(this.skillsDir)) {
      mkdirSync(this.skillsDir, { recursive: true })
    }
    if (!existsSync(this.candidateDir)) {
      mkdirSync(this.candidateDir, { recursive: true })
    }
  }

  // 从工作流生成技能候选
  generateFromWorkflow(workflow: DetectedWorkflow): SkillCandidate {
    const candidate: SkillCandidate = {
      id: `skill-${Date.now()}`,
      name: this.generateSkillName(workflow),
      description: this.generateDescription(workflow),
      instruction: this.generateInstruction(workflow),
      examples: this.generateExamples(workflow),
      variables: this.extractVariables(workflow),
      category: this.categorizeWorkflow(workflow),
      tags: this.generateTags(workflow),
      confidence: this.calculateConfidence(workflow),
      sourceWorkflow: workflow.id,
      createdAt: new Date().toISOString(),
      status: "candidate",
    }

    return candidate
  }

  // 生成技能名称
  private generateSkillName(workflow: DetectedWorkflow): string {
    // 从工作流描述提取
    const desc = workflow.description.toLowerCase()

    // 常见模式映射
    const patterns: [RegExp, string][] = [
      [/bug\s*fix|debug|fix.*issue/i, "Bug Fix"],
      [/test|tdd|testing/i, "Test-Driven Development"],
      [/refactor|improve|restructure/i, "Code Refactoring"],
      [/review|analyze|audit/i, "Code Review"],
      [/create|new.*file|setup/i, "Project Setup"],
      [/document|doc|readme/i, "Documentation"],
      [/api|endpoint|route/i, "API Development"],
      [/auth|login|security/i, "Authentication"],
      [/deploy|production|release/i, "Deployment"],
      [/feature|implement|build/i, "Feature Implementation"],
    ]

    for (const [regex, name] of patterns) {
      if (regex.test(desc)) {
        return name
      }
    }

    // 从步骤提取
    const tools = workflow.steps
      .filter((s) => s.tool)
      .map((s) => s.tool)
      .slice(0, 3)

    return `${tools[0]?.replace(/-/g, " ") || "Custom"} Workflow`
  }

  // 生成描述
  private generateDescription(workflow: DetectedWorkflow): string {
    const steps = workflow.steps.length
    const tools = workflow.steps.filter((s) => s.tool).map((s) => s.tool).join(", ")

    return `This skill performs a ${workflow.name.toLowerCase()} workflow with ${steps} steps using: ${tools}. ${workflow.description}`
  }

  // 生成指令
  private generateInstruction(workflow: DetectedWorkflow): string {
    const instructions: string[] = []
    instructions.push(`# ${workflow.name}`)
    instructions.push("")
    instructions.push(workflow.description)
    instructions.push("")

    // When to use
    instructions.push("## When to Use")
    instructions.push(this.generateWhenToUse(workflow))
    instructions.push("")

    // How to use
    instructions.push("## How to Use")
    for (const step of workflow.steps) {
      if (step.reasoning) {
        instructions.push(`${step.stepNumber}. ${step.reasoning}`)
      } else if (step.tool) {
        instructions.push(`${step.stepNumber}. Use \`${step.tool}\` to ${step.action.toLowerCase()}`)
      } else {
        instructions.push(`${step.stepNumber}. ${step.action}`)
      }
    }
    instructions.push("")

    // Best practices
    instructions.push("## Best Practices")
    instructions.push(...this.generateBestPractices(workflow))

    return instructions.join("\n")
  }

  // 生成使用场景
  private generateWhenToUse(workflow: DetectedWorkflow): string {
    const desc = workflow.description.toLowerCase()

    if (/bug|fix|debug/i.test(desc)) {
      return "Use this when you encounter bugs or unexpected behavior that need to be fixed."
    }
    if (/test|tdd/i.test(desc)) {
      return "Use this when starting a new feature or fixing a bug to ensure code correctness."
    }
    if (/refactor|impro/i.test(desc)) {
      return "Use this when code needs to be cleaned up, made more maintainable, or optimized."
    }
    if (/review/i.test(desc)) {
      return "Use this when reviewing code changes or preparing for a merge."
    }
    if (/create|setup/i.test(desc)) {
      return "Use this when setting up a new project or adding new components."
    }

    return `Use this when you need to: ${workflow.description}`
  }

  // 生成最佳实践
  private generateBestPractices(workflow: DetectedWorkflow): string[] {
    const practices: string[] = []
    const tools = workflow.steps.filter((s) => s.tool).map((s) => s.tool)

    // 根据工具添加实践
    if (tools.includes("read")) {
      practices.push("- Always read existing code before making changes")
    }
    if (tools.includes("bash")) {
      practices.push("- Verify command safety before execution")
      practices.push("- Test in development environment first")
    }
    if (tools.includes("edit")) {
      practices.push("- Make small, focused changes")
      practices.push("- Review diffs before committing")
    }
    if (tools.includes("write")) {
      practices.push("- Follow project naming conventions")
      practices.push("- Add appropriate comments")
    }

    // 工作流特定实践
    const desc = workflow.description.toLowerCase()
    if (/bug|fix/i.test(desc)) {
      practices.push("- Reproduce the bug before fixing")
      practices.push("- Add tests to prevent regression")
    }
    if (/test/i.test(desc)) {
      practices.push("- Run full test suite after changes")
      practices.push("- Aim for meaningful test coverage")
    }

    return practices.length > 0 ? practices : ["- Follow project coding standards"]
  }

  // 生成示例
  private generateExamples(workflow: DetectedWorkflow): string[] {
    const examples: string[] = []

    // 从步骤生成示例
    const steps = workflow.steps.filter((s) => s.tool)
    if (steps.length > 0) {
      examples.push(
        `1. ${steps[0].action}${steps[0].input?.path ? ` (${steps[0].input.path})` : ""}`
      )
    }

    return examples
  }

  // 提取变量
  private extractVariables(workflow: DetectedWorkflow): SkillVariable[] {
    const variables: SkillVariable[] = []
    const seen = new Set<string>()

    for (const step of workflow.steps) {
      if (step.input) {
        for (const [key, value] of Object.entries(step.input)) {
          if (seen.has(key)) continue
          seen.add(key)

          const type = this.inferVariableType(value)
          variables.push({
            name: key,
            description: `The ${key} parameter`,
            type,
            required: false,
            default: typeof value === "string" ? value : JSON.stringify(value),
          })
        }
      }
    }

    return variables.slice(0, 5) // 最多 5 个变量
  }

  // 推断变量类型
  private inferVariableType(value: any): SkillVariable["type"] {
    if (typeof value === "boolean") return "boolean"
    if (typeof value === "number") return "number"
    if (typeof value === "string") {
      if (value.includes("/") || value.includes("\\")) return "path"
      if (value.includes("|") || value.includes(",")) return "selection"
    }
    return "string"
  }

  // 生成分类
  private categorizeWorkflow(workflow: DetectedWorkflow): string {
    const desc = workflow.description.toLowerCase()

    if (/bug|fix|debug/i.test(desc)) return "debugging"
    if (/test/i.test(desc)) return "testing"
    if (/refactor|clean/i.test(desc)) return "refactoring"
    if (/review/i.test(desc)) return "review"
    if (/create|setup|init/i.test(desc)) return "setup"
    if (/deploy|release/i.test(desc)) return "deployment"
    if (/document|doc/i.test(desc)) return "documentation"
    if (/api|endpoint/i.test(desc)) return "api"
    if (/security|auth/i.test(desc)) return "security"

    return workflow.category || "general"
  }

  // 生成标签
  private generateTags(workflow: DetectedWorkflow): string[] {
    const tags: string[] = workflow.category ? [workflow.category] : []

    const tools = workflow.steps.filter((s) => s.tool).map((s) => s.tool)
    tags.push(...tools.filter((t) => !tags.includes(t!)).slice(0, 3) as string[])

    if (workflow.description.toLowerCase().includes("typescript")) {
      tags.push("typescript")
    }
    if (workflow.description.toLowerCase().includes("react")) {
      tags.push("react")
    }

    return [...new Set(tags)]
  }

  // 计算置信度
  private calculateConfidence(workflow: DetectedWorkflow): number {
    let confidence = 50

    // 步骤数量
    if (workflow.steps.length >= 3) confidence += 10
    if (workflow.steps.length >= 5) confidence += 10

    // 有工具调用
    const toolCount = workflow.steps.filter((s) => s.tool).length
    if (toolCount >= 2) confidence += 10

    // 有推理说明
    const hasReasoning = workflow.steps.some((s) => s.reasoning)
    if (hasReasoning) confidence += 15

    return Math.min(confidence, 95)
  }

  // 保存候选技能
  saveCandidate(candidate: SkillCandidate): void {
    const path = join(this.candidateDir, `${candidate.id}.json`)
    writeFileSync(path, JSON.stringify(candidate, null, 2), "utf-8")
  }

  // 生成 SKILL.md 内容
  generateSkillMarkdown(candidate: SkillCandidate): string {
    const lines: string[] = []

    // Frontmatter
    lines.push("---")
    lines.push(`name: ${candidate.name}`)
    lines.push(`description: ${candidate.description}`)
    lines.push(`tags: [${candidate.tags.join(", ")}]`)
    lines.push(`version: 1.0.0`)
    lines.push(`confidence: ${candidate.confidence}`)
    lines.push(`category: ${candidate.category}`)
    lines.push(`generated: ${candidate.createdAt}`)
    lines.push(`source: ${candidate.sourceWorkflow || "manual"}`)
    lines.push("---")
    lines.push("")

    // Content
    lines.push(candidate.instruction)

    // Variables
    if (candidate.variables && candidate.variables.length > 0) {
      lines.push("")
      lines.push("## Variables")
      for (const v of candidate.variables) {
        const required = v.required ? "(required)" : "(optional)"
        lines.push(`- \`${v.name}\` ${required}: ${v.description}`)
        if (v.default) {
          lines.push(`  - Default: \`${v.default}\``)
        }
      }
    }

    // Examples
    if (candidate.examples && candidate.examples.length > 0) {
      lines.push("")
      lines.push("## Examples")
      for (const ex of candidate.examples) {
        lines.push(`1. ${ex}`)
      }
    }

    return lines.join("\n")
  }

  // 批准并发布技能
  publishSkill(candidate: SkillCandidate): string {
    const markdown = this.generateSkillMarkdown(candidate)

    // 生成文件名
    const safeName = candidate.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")

    const filename = `${safeName}.SKILL.md`
    const path = join(this.skillsDir, filename)

    writeFileSync(path, markdown, "utf-8")

    // 更新候选状态
    candidate.status = "published"
    this.saveCandidate(candidate)

    return path
  }

  // 拒绝候选
  rejectCandidate(candidateId: string, reason?: string): void {
    const path = join(this.candidateDir, `${candidateId}.json`)
    if (!existsSync(path)) return

    const candidate: SkillCandidate = JSON.parse(
      readFileSync(path, "utf-8")
    )
    candidate.status = "rejected"
    this.saveCandidate(candidate)
  }

  // 获取所有候选
  getCandidates(): SkillCandidate[] {
    const candidates: SkillCandidate[] = []

    try {
      const { readdirSync } = require("fs")
      const files = readdirSync(this.candidateDir).filter(
        (f: string) => f.endsWith(".json")
      )

      for (const file of files) {
        try {
          const candidate = JSON.parse(
            readFileSync(join(this.candidateDir, file), "utf-8")
          )
          candidates.push(candidate)
        } catch {}
      }
    } catch {}

    return candidates.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  // 获取候选
  getCandidate(id: string): SkillCandidate | null {
    const path = join(this.candidateDir, `${id}.json`)
    if (!existsSync(path)) return null

    try {
      return JSON.parse(readFileSync(path, "utf-8"))
    } catch {
      return null
    }
  }
}
