// ============================================================
// Skills Matcher - 技能匹配器
// ============================================================

import type { Skill, SkillMatch, SkillContext, SkillTrigger } from "./types.ts"

export class SkillMatcher {
  private minScore: number

  constructor(minScore = 50) {
    this.minScore = minScore
  }

  // 匹配技能
  match(skills: Skill[], context: SkillContext): SkillMatch[] {
    const matches: SkillMatch[] = []

    for (const skill of skills) {
      const match = this.matchSkill(skill, context)
      if (match.score >= this.minScore) {
        matches.push(match)
      }
    }

    // 按分数排序
    return matches.sort((a, b) => b.score - a.score)
  }

  // 匹配单个技能
  matchSkill(skill: Skill, context: SkillContext): SkillMatch {
    const matchedOn: string[] = []
    let score = 0

    // 检查触发条件
    if (skill.trigger) {
      const triggerResult = this.matchTrigger(skill.trigger, context)
      score += triggerResult.score
      matchedOn.push(...triggerResult.matchedOn)
    }

    // 检查关键词（从名称和描述中）
    const keywordScore = this.matchKeywords(skill, context)
    score += keywordScore.score
    if (keywordScore.matchedOn.length > 0) {
      matchedOn.push(...keywordScore.matchedOn)
    }

    // 检查文件类型
    if (skill.trigger?.fileTypes && context.currentFiles) {
      const fileTypeScore = this.matchFileTypes(skill.trigger.fileTypes, context.currentFiles)
      score += fileTypeScore
    }

    // 归一化分数（最高100）
    score = Math.min(100, score)

    return {
      skill,
      score,
      matchedOn,
    }
  }

  // 匹配触发条件
  private matchTrigger(trigger: SkillTrigger, context: SkillContext): { score: number; matchedOn: string[] } {
    let score = 0
    const matchedOn: string[] = []

    // 匹配模式
    if (trigger.patterns && trigger.patterns.length > 0) {
      for (const pattern of trigger.patterns) {
        if (this.matchPattern(pattern, context.userMessage)) {
          score += 30
          matchedOn.push(`pattern: ${pattern}`)
        }
      }
    }

    // 匹配关键词
    if (trigger.keywords && trigger.keywords.length > 0) {
      const message = context.userMessage.toLowerCase()
      for (const keyword of trigger.keywords) {
        const kw = keyword.toLowerCase()
        if (message.includes(kw)) {
          score += 20
          matchedOn.push(`keyword: ${keyword}`)
        }
      }
    }

    return { score, matchedOn }
  }

  // 匹配模式（glob 或正则）
  private matchPattern(pattern: string, text: string): boolean {
    // 正则表达式
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      try {
        const regex = new RegExp(pattern.slice(1, -1), "i")
        return regex.test(text)
      } catch {
        return false
      }
    }

    // Glob 模式（简化实现）
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
        "i"
      )
      return regex.test(text)
    }

    // 普通字符串
    return text.toLowerCase().includes(pattern.toLowerCase())
  }

  // 匹配关键词
  private matchKeywords(skill: Skill, context: SkillContext): { score: number; matchedOn: string[] } {
    let score = 0
    const matchedOn: string[] = []
    const message = context.userMessage.toLowerCase()

    // 从技能名称匹配
    if (skill.meta.name) {
      const name = skill.meta.name.toLowerCase()
      if (message.includes(name)) {
        score += 25
        matchedOn.push(`name: ${skill.meta.name}`)
      }
    }

    // 从描述匹配
    if (skill.meta.description) {
      const words = skill.meta.description.toLowerCase().split(/\s+/)
      for (const word of words) {
        if (word.length > 3 && message.includes(word)) {
          score += 10
          matchedOn.push(`description: ${word}`)
          break
        }
      }
    }

    // 从标签匹配
    if (skill.meta.tags) {
      for (const tag of skill.meta.tags) {
        if (message.includes(tag.toLowerCase())) {
          score += 15
          matchedOn.push(`tag: ${tag}`)
        }
      }
    }

    return { score, matchedOn }
  }

  // 匹配文件类型
  private matchFileTypes(fileTypes: string[], files: string[]): number {
    let matches = 0

    for (const file of files) {
      const ext = file.split(".").pop()?.toLowerCase()
      if (ext && fileTypes.some(ft => ft.toLowerCase() === ext)) {
        matches++
      }
    }

    // 每匹配一个文件加 5 分，最高 20 分
    return Math.min(20, matches * 5)
  }

  // 设置最小分数
  setMinScore(minScore: number): void {
    this.minScore = minScore
  }
}

// 技能推荐器
export class SkillRecommender {
  private matcher: SkillMatcher

  constructor(minScore = 30) {
    this.matcher = new SkillMatcher(minScore)
  }

  // 为消息推荐技能
  recommend(skills: Skill[], userMessage: string): Skill[] {
    const context: SkillContext = {
      userMessage,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    }

    const matches = this.matcher.match(skills, context)

    // 返回前 3 个匹配
    return matches.slice(0, 3).map(m => m.skill)
  }

  // 获取推荐原因
  getRecommendationReason(matches: SkillMatch[]): string {
    if (matches.length === 0) {
      return ""
    }

    const top = matches[0]
    return `This matches the "${top.skill.meta.name}" skill (${top.score}% match: ${top.matchedOn.join(", ")})`
  }
}
