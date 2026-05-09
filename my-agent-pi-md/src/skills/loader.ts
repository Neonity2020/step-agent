// ============================================================
// Skills Loader - 技能加载器
// ============================================================

import { existsSync, readdirSync, readFileSync, statSync } from "fs"
import { join, basename, dirname } from "path"
import type { Skill, SkillOptions, SkillListing } from "./types"
import { SkillParser } from "./parser"

export class SkillsLoader {
  private parser: SkillParser
  private skills: Map<string, Skill> = new Map()
  private enabledSkills: Set<string> = new Set()

  constructor() {
    this.parser = new SkillParser()
  }

  // 加载技能目录
  async load(options: SkillOptions = {}): Promise<Skill[]> {
    const dir = options.dir ?? this.getDefaultDir()
    
    if (!existsSync(dir)) {
      console.log(`Skills directory not found: ${dir}`)
      return []
    }

    const files = this.collectSkillFiles(dir)
    const skills: Skill[] = []

    for (const file of files) {
      const skill = await this.loadFile(file)
      if (skill?.meta?.name) {
        this.skills.set(skill.meta.name, skill)
        this.enabledSkills.add(skill.meta.name)
        skills.push(skill)
      }
    }

    console.log(`Loaded ${skills.length} skills from ${dir}`)
    return skills
  }

  // 加载单个文件
  async loadFile(filePath: string): Promise<Skill | null> {
    try {
      const content = readFileSync(filePath, "utf-8")
      const skill = this.parser.parse(content, filePath)
      
      if (!skill.meta.name) {
        console.warn(`Skill at ${filePath} missing name, skipping`)
        return null
      }

      return skill
    } catch (error) {
      console.error(`Failed to load skill from ${filePath}:`, error)
      return null
    }
  }

  // 收集技能文件
  private collectSkillFiles(dir: string): string[] {
    const files: string[] = []

    if (!existsSync(dir)) {
      return files
    }

    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // 检查目录中是否有 SKILL.md
        const skillMd = join(fullPath, "SKILL.md")
        if (existsSync(skillMd)) {
          files.push(skillMd)
        } else {
          // 递归搜索子目录
          files.push(...this.collectSkillFiles(fullPath))
        }
      } else if (entry.isFile() && entry.name.match(/^SKILL\.md$/i)) {
        files.push(fullPath)
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        // 检查文件名是否以 skill 结尾
        const baseName = basename(entry.name, ".md").toLowerCase()
        if (baseName.includes("skill")) {
          files.push(fullPath)
        }
      }
    }

    return files
  }

  // 获取默认目录
  private getDefaultDir(): string {
    const home = Bun.env.HOME ?? "/tmp"
    return join(home, ".myagent", "skills")
  }

  // 获取所有技能
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values())
  }

  // 获取启用的技能
  getEnabledSkills(): Skill[] {
    return Array.from(this.enabledSkills).map(name => this.skills.get(name)!).filter(Boolean)
  }

  // 获取单个技能
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  // 启用技能
  enable(name: string): boolean {
    if (this.skills.has(name)) {
      this.enabledSkills.add(name)
      return true
    }
    return false
  }

  // 禁用技能
  disable(name: string): boolean {
    return this.enabledSkills.delete(name)
  }

  // 切换技能状态
  toggle(name: string): boolean {
    if (this.enabledSkills.has(name)) {
      this.enabledSkills.delete(name)
      return false
    } else {
      this.enabledSkills.add(name)
      return true
    }
  }

  // 检查技能是否启用
  isEnabled(name: string): boolean {
    return this.enabledSkills.has(name)
  }

  // 获取技能列表（用于展示）
  getSkillListings(): SkillListing[] {
    return Array.from(this.skills.values()).map(skill => ({
      name: skill.meta.name ?? "unnamed",
      description: skill.meta.description ?? "",
      path: this.getSkillPath(skill),
      tags: skill.meta.tags ?? [],
      enabled: this.enabledSkills.has(skill.meta.name ?? ""),
    }))
  }

  // 获取技能路径
  private getSkillPath(skill: Skill): string {
    // 从原始内容推断路径
    return "unknown"
  }

  // 重新加载
  async reload(options: SkillOptions = {}): Promise<Skill[]> {
    this.skills.clear()
    this.enabledSkills.clear()
    return this.load(options)
  }

  // 添加技能（运行时）
  addSkill(skill: Skill): void {
    if (skill.meta.name) {
      this.skills.set(skill.meta.name, skill)
      this.enabledSkills.add(skill.meta.name)
    }
  }

  // 移除技能
  removeSkill(name: string): void {
    this.skills.delete(name)
    this.enabledSkills.delete(name)
  }
}
