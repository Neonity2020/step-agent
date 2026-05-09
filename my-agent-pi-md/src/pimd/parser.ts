// ============================================================
// Pi.md Parser - pi.md 文件解析器
// ============================================================

import { existsSync, readFileSync } from "fs"
import { join, basename, dirname } from "path"
import type { 
  PiMDContent, 
  PiMDFile, 
  ProjectAnalysis,
  ProjectConfig,
  Dependency,
  BuildCommand,
  Directory,
  File,
  CodingStandards,
  DeploymentConfig,
  ThirdPartyService
} from "./types.ts"

export class PiMDParser {
  // 检查存在的文件
  static findPiMD(cwd: string): PiMDFile[] {
    const files: PiMDFile[] = [
      { path: join(cwd, "pi.md"), type: "pi.md", exists: false },
      { path: join(cwd, "AGENTS.md"), type: "AGENTS.md", exists: false },
      { path: join(cwd, "CLAUDE.md"), type: "CLAUDE.md", exists: false },
    ]

    for (const file of files) {
      file.exists = existsSync(file.path)
      if (file.exists) {
        try {
          file.content = readFileSync(file.path, "utf-8")
        } catch {
          file.exists = false
        }
      }
    }

    // 向上查找父目录
    let parent = dirname(cwd)
    while (parent !== cwd && parent !== "/") {
      for (const file of files) {
        if (!file.exists) {
          const parentPath = join(parent, basename(file.path))
          if (existsSync(parentPath)) {
            file.path = parentPath
            file.exists = true
            try {
              file.content = readFileSync(parentPath, "utf-8")
            } catch {
              file.exists = false
            }
          }
        }
      }
      const newParent = dirname(parent)
      if (newParent === parent) break
      parent = newParent
    }

    return files
  }

  // 解析 pi.md 内容
  static parse(content: string): PiMDContent {
    const result: PiMDContent = { raw: content }
    const lines = content.split("\n")

    let currentSection = ""
    let currentSubsection = ""
    let inCodeBlock = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const rawLine = lines[i]

      // 代码块处理
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock
        continue
      }

      if (inCodeBlock) continue

      // 空行
      if (!line) continue

      // 标题检测
      if (line.startsWith("# ")) {
        currentSection = this.normalizeSection(line.slice(2))
        currentSubsection = ""
        continue
      }

      if (line.startsWith("## ")) {
        currentSubsection = this.normalizeSection(line.slice(3))
        continue
      }

      // 解析各部分
      this.parseSection(result, currentSection, currentSubsection, line, rawLine, lines, i)
    }

    return result
  }

  // 归一化节名称
  private static normalizeSection(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  }

  // 解析各个部分
  private static parseSection(
    result: PiMDContent,
    section: string,
    subsection: string,
    line: string,
    rawLine: string,
    lines: string[],
    lineIndex: number
  ): void {
    // 项目配置
    if (section === "project" || section === "project-info") {
      this.parseProjectConfig(result, line)
      return
    }

    // 项目结构
    if (section === "project-structure" || section === "structure") {
      this.parseStructure(result, line)
      return
    }

    // 依赖
    if (section === "dependencies" || section === "packages") {
      this.parseDependency(result, line)
      return
    }

    // 命令
    if (section === "commands" || section === "scripts") {
      this.parseCommand(result, line)
      return
    }

    // 测试
    if (section === "testing" || section === "tests") {
      this.parseTesting(result, line)
      return
    }

    // 编码规范
    if (section === "coding-standards" || section === "standards") {
      this.parseStandards(result, line)
      return
    }

    // 部署
    if (section === "deployment" || section === "deploy") {
      this.parseDeployment(result, line)
      return
    }

    // 服务
    if (section === "services" || section === "external-services") {
      this.parseServices(result, line)
      return
    }

    // 规则
    if (section === "rules" || section === "guidelines") {
      if (!result.rules) result.rules = []
      if (line.startsWith("- ") || line.startsWith("* ")) {
        result.rules.push(line.slice(2).trim())
      }
      return
    }

    // 自定义说明
    if (section === "instructions" || section === "custom-instructions") {
      if (!result.customInstructions) result.customInstructions = ""
      result.customInstructions += rawLine + "\n"
      return
    }

    // 项目描述
    if (section === "description" && !result.description) {
      result.description = line
    }
  }

  // 解析项目配置
  private static parseProjectConfig(result: PiMDContent, line: string): void {
    if (!result.project) result.project = {}
    const config = result.project

    const match = line.match(/^([a-zA-Z]+):\s*(.+)$/)
    if (match) {
      const [, key, value] = match
      switch (key.toLowerCase()) {
        case "name":
          config.name = value.trim()
          break
        case "language":
        case "lang":
          config.language = value.trim()
          break
        case "framework":
        case "fw":
          config.framework = value.trim()
          break
        case "repository":
        case "repo":
          config.repository = value.trim()
          break
      }
    }
  }

  // 解析项目结构
  private static parseStructure(result: PiMDContent, line: string): void {
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const content = line.slice(2).trim()
      
      // 目录
      if (content.endsWith("/")) {
        if (!result.directories) result.directories = []
        const parts = content.split(/\s*-\s*/)
        result.directories.push({
          path: parts[0].replace(/\/$/, ""),
          description: parts[1]
        })
      }
      // 文件
      else {
        if (!result.files) result.files = []
        const parts = content.split(/\s*-\s*/)
        result.files.push({
          path: parts[0],
          description: parts[1],
          importance: parts[2] as "high" | "medium" | "low"
        })
      }
    }

    // 入口点
    if (line.toLowerCase().includes("entry") || line.toLowerCase().includes("main")) {
      if (!result.entryPoints) result.entryPoints = []
      const match = line.match(/`([^`]+)`/)
      if (match) {
        result.entryPoints.push({ path: match[1] })
      }
    }
  }

  // 解析依赖
  private static parseDependency(result: PiMDContent, line: string): void {
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!result.dependencies) result.dependencies = []
      
      const content = line.slice(2).trim()
      const match = content.match(/^([a-zA-Z@/-]+)(@[\d.]+)?\s*(-\s*(.+))?$/)
      
      if (match) {
        result.dependencies.push({
          name: match[1],
          version: match[2],
          description: match[4]
        })
      }
    }
  }

  // 解析命令
  private static parseCommand(result: PiMDContent, line: string): void {
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!result.commands) result.commands = []
      
      const content = line.slice(2).trim()
      const parts = content.split(/\s*-\s*/)
      const nameCmd = parts[0].split(/\s*:\s*/)
      
      result.commands.push({
        name: nameCmd[0],
        command: nameCmd[1] || nameCmd[0],
        description: parts[1]
      })
    }
  }

  // 解析测试配置
  private static parseTesting(result: PiMDContent, line: string): void {
    if (!result.tests) result.tests = { framework: "" }
    
    if (line.toLowerCase().startsWith("framework")) {
      const match = line.match(/framework:\s*(.+)/i)
      if (match) result.tests.framework = match[1].trim()
    }
    
    if (line.toLowerCase().includes("pattern")) {
      const match = line.match(/pattern:\s*(.+)/i)
      if (match && !result.tests.patterns) {
        result.tests.patterns = match[1].split(",").map(p => p.trim())
      }
    }
  }

  // 解析编码规范
  private static parseStandards(result: PiMDContent, line: string): void {
    if (!result.standards) result.standards = {}
    
    if (line.toLowerCase().startsWith("language") || line.toLowerCase().startsWith("style")) {
      const match = line.match(/:\s*(.+)/)
      if (match) {
        result.standards.language = match[1].trim()
      }
    }
    
    if (!result.standards.rules) result.standards.rules = []
    if (line.startsWith("- ") || line.startsWith("* ")) {
      result.standards.rules.push(line.slice(2).trim())
    }
  }

  // 解析部署配置
  private static parseDeployment(result: PiMDContent, line: string): void {
    if (!result.deployment) result.deployment = {}
    
    const match = line.match(/^([a-zA-Z]+):\s*(.+)$/)
    if (match) {
      const [, key, value] = match
      switch (key.toLowerCase()) {
        case "platform":
          result.deployment.platform = value.trim()
          break
        case "build":
          result.deployment.buildCommand = value.trim()
          break
        case "output":
        case "directory":
          result.deployment.outputDirectory = value.trim()
          break
      }
    }
  }

  // 解析第三方服务
  private static parseServices(result: PiMDContent, line: string): void {
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!result.services) result.services = []
      
      const content = line.slice(2).trim()
      const parts = content.split(/\s*-\s*/)
      
      result.services.push({
        name: parts[0],
        purpose: parts[1]
      })
    }
  }

  // 生成系统提示
  static generateSystemPrompt(parsed: PiMDContent): string {
    const parts: string[] = []

    // 项目信息
    if (parsed.project) {
      parts.push("# Project Information")
      if (parsed.project.name) parts.push(`**Name**: ${parsed.project.name}`)
      if (parsed.project.description) parts.push(`**Description**: ${parsed.project.description}`)
      if (parsed.project.language) parts.push(`**Language**: ${parsed.project.language}`)
      if (parsed.project.framework) parts.push(`**Framework**: ${parsed.project.framework}`)
      parts.push("")
    }

    // 项目描述
    if (parsed.description) {
      parts.push("# Description")
      parts.push(parsed.description)
      parts.push("")
    }

    // 目录结构
    if (parsed.directories?.length) {
      parts.push("# Project Structure")
      for (const dir of parsed.directories) {
        parts.push(`- \`${dir.path}/\` - ${dir.description || ""}`)
      }
      parts.push("")
    }

    // 入口点
    if (parsed.entryPoints?.length) {
      parts.push("# Entry Points")
      for (const ep of parsed.entryPoints) {
        parts.push(`- \`${ep.path}\` - ${ep.description || ""}`)
      }
      parts.push("")
    }

    // 依赖
    if (parsed.dependencies?.length) {
      parts.push("# Dependencies")
      for (const dep of parsed.dependencies) {
        const version = dep.version ? ` (${dep.version})` : ""
        const desc = dep.description ? ` - ${dep.description}` : ""
        parts.push(`- \`${dep.name}${version}\`${desc}`)
      }
      parts.push("")
    }

    // 构建命令
    if (parsed.commands?.length) {
      parts.push("# Available Commands")
      for (const cmd of parsed.commands) {
        parts.push(`- \`${cmd.name}\`: ${cmd.command} - ${cmd.description || ""}`)
      }
      parts.push("")
    }

    // 测试配置
    if (parsed.tests) {
      parts.push("# Testing")
      parts.push(`**Framework**: ${parsed.tests.framework}`)
      if (parsed.tests.patterns) {
        parts.push(`**Patterns**: ${parsed.tests.patterns.join(", ")}`)
      }
      parts.push("")
    }

    // 编码规范
    if (parsed.standards) {
      parts.push("# Coding Standards")
      if (parsed.standards.language) {
        parts.push(`**Language/Style**: ${parsed.standards.language}`)
      }
      if (parsed.standards.rules?.length) {
        parts.push("**Rules:**")
        for (const rule of parsed.standards.rules) {
          parts.push(`- ${rule}`)
        }
      }
      parts.push("")
    }

    // 部署
    if (parsed.deployment) {
      parts.push("# Deployment")
      if (parsed.deployment.platform) {
        parts.push(`**Platform**: ${parsed.deployment.platform}`)
      }
      if (parsed.deployment.buildCommand) {
        parts.push(`**Build**: \`${parsed.deployment.buildCommand}\``)
      }
      if (parsed.deployment.outputDirectory) {
        parts.push(`**Output**: ${parsed.deployment.outputDirectory}`)
      }
      parts.push("")
    }

    // 服务
    if (parsed.services?.length) {
      parts.push("# External Services")
      for (const svc of parsed.services) {
        parts.push(`- **${svc.name}** - ${svc.purpose || ""}`)
      }
      parts.push("")
    }

    // 规则
    if (parsed.rules?.length) {
      parts.push("# Project Rules")
      for (const rule of parsed.rules) {
        parts.push(`- ${rule}`)
      }
      parts.push("")
    }

    // 自定义说明
    if (parsed.customInstructions) {
      parts.push("# Additional Instructions")
      parts.push(parsed.customInstructions)
    }

    return parts.join("\n")
  }
}
