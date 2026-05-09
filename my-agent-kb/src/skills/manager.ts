// ============================================================
// Skills Manager - 技能管理器
// ============================================================

import type { Skill, SkillMatch, SkillContext, SkillOptions, SkillListing } from "./types"
import { SkillsLoader } from "./loader"
import { SkillMatcher, SkillRecommender } from "./matcher"
import { SkillParser } from "./parser"

export class SkillsManager {
  private loader: SkillsLoader
  private matcher: SkillMatcher
  private recommender: SkillRecommender
  private parser: SkillParser

  constructor(options: SkillOptions = {}) {
    this.loader = new SkillsLoader()
    this.matcher = new SkillMatcher(options.minScore ?? 50)
    this.recommender = new SkillRecommender(30)
    this.parser = new SkillParser()
  }

  // 加载所有技能
  async load(options?: SkillOptions): Promise<void> {
    await this.loader.load(options)
  }

  // 从示例加载
  async loadExamples(): Promise<void> {
    const exampleDir = new URL(".", import.meta.url).pathname + "../skills/examples"
    
    // 示例已经在 examples 目录中，用户可以复制到 ~/.myagent/skills/
    console.log("Example skills are in: src/skills/examples/")
    console.log("Copy them to ~/.myagent/skills/ to enable")
  }

  // 获取所有技能
  getAllSkills(): Skill[] {
    return this.loader.getAllSkills()
  }

  // 获取启用的技能
  getEnabledSkills(): Skill[] {
    return this.loader.getEnabledSkills()
  }

  // 获取单个技能
  getSkill(name: string): Skill | undefined {
    return this.loader.getSkill(name)
  }

  // 匹配技能
  matchSkills(context: SkillContext): SkillMatch[] {
    const skills = this.loader.getEnabledSkills()
    return this.matcher.match(skills, context)
  }

  // 推荐技能
  recommendSkills(userMessage: string): Skill[] {
    const skills = this.loader.getEnabledSkills()
    return this.recommender.recommend(skills, userMessage)
  }

  // 获取推荐原因
  getRecommendationReason(matches: SkillMatch[]): string {
    return this.recommender.getRecommendationReason(matches)
  }

  // 获取匹配分数
  getMatchScore(skill: Skill, context: SkillContext): number {
    const match = this.matcher.matchSkill(skill, context)
    return match.score
  }

  // 为 Agent 生成系统提示
  generateSystemPrompt(matchedSkills: Skill[]): string {
    if (matchedSkills.length === 0) {
      return ""
    }

    const parts: string[] = [
      "\n\n## Active Skills",
    ]

    for (const skill of matchedSkills) {
      parts.push(this.parser.generateSystemPrompt(skill))
    }

    return parts.join("\n")
  }

  // 启用技能
  enable(name: string): boolean {
    return this.loader.enable(name)
  }

  // 禁用技能
  disable(name: string): boolean {
    return this.loader.disable(name)
  }

  // 切换技能
  toggle(name: string): boolean {
    return this.loader.toggle(name)
  }

  // 检查是否启用
  isEnabled(name: string): boolean {
    return this.loader.isEnabled(name)
  }

  // 添加技能
  addSkill(skill: Skill): void {
    this.loader.addSkill(skill)
  }

  // 从字符串添加技能
  addSkillFromString(name: string, content: string): Skill {
    const skill = this.parser.parse(content)
    if (!skill.meta.name) {
      skill.meta.name = name
    }
    this.addSkill(skill)
    return skill
  }

  // 移除技能
  removeSkill(name: string): void {
    this.loader.removeSkill(name)
  }

  // 获取技能列表
  getSkillListings(): SkillListing[] {
    return this.loader.getSkillListings()
  }

  // 获取统计信息
  getStats(): {
    total: number
    enabled: number
    disabled: number
    byTag: Record<string, number>
  } {
    const all = this.loader.getAllSkills()
    const enabled = this.loader.getEnabledSkills()
    const byTag: Record<string, number> = {}

    for (const skill of all) {
      if (skill.meta.tags) {
        for (const tag of skill.meta.tags) {
          byTag[tag] = (byTag[tag] ?? 0) + 1
        }
      }
    }

    return {
      total: all.length,
      enabled: enabled.length,
      disabled: all.length - enabled.length,
      byTag,
    }
  }

  // 重新加载
  async reload(options?: SkillOptions): Promise<void> {
    await this.loader.reload(options)
  }
}
