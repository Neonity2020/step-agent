// ============================================================
// Skills Parser - 解析 SKILL.md 文件
// ============================================================
// 
// 支持 Claude Code 的 SKILL.md 格式
// ============================================================

import type { Skill, SkillMeta, SkillTrigger, SkillStep } from "./types.ts"

export class SkillParser {
  // 解析 SKILL.md 内容
  parse(content: string, filePath?: string): Skill {
    const lines = content.split("\n")
    const skill: Skill = {
      meta: this.parseMeta(lines),
      raw: content,
    }

    // 解析各个部分
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // 元数据（YAML 风格）
      if (trimmed.startsWith("# ") && !trimmed.startsWith("# ") && i === 0) {
        skill.meta.name = trimmed.slice(2).trim()
        continue
      }

      // 触发条件
      if (trimmed.startsWith("## Trigger") || trimmed.startsWith("## trigger")) {
        skill.trigger = this.parseTrigger(lines.slice(i + 1))
        continue
      }

      // 使用说明
      if (trimmed.startsWith("## Usage") || trimmed.startsWith("## usage")) {
        skill.usage = this.parseSection(lines.slice(i + 1))
        continue
      }

      // 步骤
      if (trimmed.startsWith("## Steps") || trimmed.startsWith("## steps")) {
        skill.steps = this.parseSteps(lines.slice(i + 1))
        continue
      }

      // 系统提示
      if (trimmed.startsWith("## System Prompt") || trimmed.startsWith("## system")) {
        skill.systemPrompt = this.parseSection(lines.slice(i + 1))
        continue
      }

      // 工具
      if (trimmed.startsWith("## Tools") || trimmed.startsWith("## tools")) {
        skill.tools = this.parseList(lines.slice(i + 1))
        continue
      }

      // 约束
      if (trimmed.startsWith("## Constraints") || trimmed.startsWith("## constraints")) {
        skill.constraints = this.parseList(lines.slice(i + 1))
        continue
      }

      // 示例
      if (trimmed.startsWith("## Example") || trimmed.startsWith("## example")) {
        if (!skill.example) {
          skill.example = this.parseSection(lines.slice(i + 1))
        }
        continue
      }
    }

    // 如果没有名称，从文件路径推断
    if (!skill.meta.name && filePath) {
      const fileName = filePath.split("/").pop()?.replace(".md", "") ?? "unnamed"
      skill.meta.name = this.toSkillName(fileName)
    }

    // 如果没有描述，提取第一段
    if (!skill.meta.description) {
      skill.meta.description = this.extractDescription(content)
    }

    return skill
  }

  // 解析文件名作为技能名
  private toSkillName(fileName: string): string {
    return fileName
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  // 解析元数据
  private parseMeta(lines: string[]): Partial<SkillMeta> {
    const meta: Partial<SkillMeta> = {}
    let inFrontmatter = false
    let inFrontmatterContent = ""

    for (const line of lines) {
      const trimmed = line.trim()

      // 检查 frontmatter
      if (trimmed === "---") {
        if (inFrontmatter) {
          // 解析 frontmatter
          this.parseFrontmatter(inFrontmatterContent).forEach(([key, value]) => {
            switch (key) {
              case "name":
                meta.name = value
                break
              case "description":
                meta.description = value
                break
              case "version":
                meta.version = value
                break
              case "author":
                meta.author = value
                break
              case "tags":
                meta.tags = value.split(",").map(t => t.trim())
                break
            }
          })
          inFrontmatter = false
          inFrontmatterContent = ""
        } else {
          inFrontmatter = true
        }
        continue
      }

      if (inFrontmatter) {
        inFrontmatterContent += line + "\n"
      }
    }

    return meta
  }

  // 解析 YAML frontmatter
  private parseFrontmatter(content: string): Array<[string, string]> {
    const pairs: Array<[string, string]> = []
    const lines = content.split("\n")

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        pairs.push([match[1], match[2]])
      }
    }

    return pairs
  }

  // 解析触发条件
  private parseTrigger(lines: string[]): SkillTrigger {
    const trigger: SkillTrigger = {}
    let currentSection = ""
    const content: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      // 遇到新标题结束
      if (trimmed.startsWith("##")) {
        break
      }

      // 子标题
      if (trimmed.startsWith("### ")) {
        currentSection = trimmed.slice(4).toLowerCase()
        continue
      }

      // 解析内容
      if (currentSection === "patterns" || currentSection === "pattern") {
        if (!trigger.patterns) trigger.patterns = []
        const pattern = this.extractCodeOrText(trimmed)
        if (pattern) trigger.patterns.push(pattern)
      } else if (currentSection === "keywords" || currentSection === "keyword") {
        if (!trigger.keywords) trigger.keywords = []
        const keyword = this.extractCodeOrText(trimmed)
        if (keyword) trigger.keywords.push(keyword)
      } else if (currentSection === "file types" || currentSection === "filetype") {
        if (!trigger.fileTypes) trigger.fileTypes = []
        const ft = this.extractCodeOrText(trimmed)
        if (ft) trigger.fileTypes.push(ft)
      }
    }

    // 如果没有明确的子标题，尝试提取列表
    if (!trigger.keywords && !trigger.patterns) {
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const item = trimmed.slice(2).trim()
          if (!trigger.keywords) trigger.keywords = []
          trigger.keywords.push(item)
        }
      }
    }

    return trigger
  }

  // 解析步骤
  private parseSteps(lines: string[]): SkillStep[] {
    const steps: SkillStep[] = []
    let stepNumber = 0

    for (const line of lines) {
      const trimmed = line.trim()

      // 遇到新标题结束
      if (trimmed.startsWith("##")) {
        break
      }

      // 解析步骤
      const stepMatch = trimmed.match(/^(\d+)[.)]\s*(.+)$/)
      if (stepMatch) {
        stepNumber++
        const step: SkillStep = {
          order: stepNumber,
          description: stepMatch[2],
        }

        // 检查是否可选
        if (stepMatch[2].includes("(optional)")) {
          step.optional = true
        }

        steps.push(step)
      }

      // 解析子项（工具使用）
      if (trimmed.startsWith("- Use `")) {
        const toolMatch = trimmed.match(/- Use `(\w+)`/)
        if (toolMatch && steps.length > 0) {
          steps[steps.length - 1].tool = toolMatch[1]
        }
      }
    }

    return steps
  }

  // 解析文本部分
  private parseSection(lines: string[]): string {
    const content: string[] = []
    let inCodeBlock = false

    for (const line of lines) {
      const trimmed = line.trim()

      // 遇到新标题结束
      if (trimmed.startsWith("##")) {
        break
      }

      // 代码块处理
      if (trimmed.startsWith("```")) {
        inCodeBlock = !inCodeBlock
      }

      if (inCodeBlock || trimmed) {
        content.push(line)
      }
    }

    return content.join("\n").trim()
  }

  // 解析列表
  private parseList(lines: string[]): string[] {
    const items: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      // 遇到新标题结束
      if (trimmed.startsWith("##")) {
        break
      }

      // 解析列表项
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const item = this.extractCodeOrText(trimmed.slice(2))
        if (item) items.push(item)
      }
    }

    return items
  }

  // 提取代码或文本
  private extractCodeOrText(text: string): string {
    // 移除代码标记
    text = text.replace(/`([^`]+)`/g, "$1")
    // 移除链接
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    return text.trim()
  }

  // 提取描述（从内容中获取第一段）
  private extractDescription(content: string): string {
    const lines = content.split("\n")
    let description = ""
    let collecting = false

    for (const line of lines) {
      const trimmed = line.trim()

      // 跳过标题
      if (trimmed.startsWith("#")) continue

      // 跳过空行
      if (!trimmed) {
        if (collecting) break
        continue
      }

      // 第一个非空行作为描述
      if (!collecting) {
        description = trimmed
        collecting = true
      }
    }

    // 限制长度
    if (description.length > 200) {
      description = description.slice(0, 197) + "..."
    }

    return description
  }

  // 生成系统提示
  generateSystemPrompt(skill: Skill): string {
    const parts: string[] = []

    if (skill.meta.description) {
      parts.push(`Skill: ${skill.meta.name}`)
      parts.push(`Description: ${skill.meta.description}`)
    }

    if (skill.usage) {
      parts.push(`\nUsage:\n${skill.usage}`)
    }

    if (skill.steps && skill.steps.length > 0) {
      parts.push("\nSteps:")
      for (const step of skill.steps) {
        const optional = step.optional ? " (optional)" : ""
        parts.push(`  ${step.order}. ${step.description}${optional}`)
      }
    }

    if (skill.constraints && skill.constraints.length > 0) {
      parts.push("\nConstraints:")
      for (const constraint of skill.constraints) {
        parts.push(`  - ${constraint}`)
      }
    }

    return parts.join("\n")
  }
}
