// ============================================================
// SOUL.md Parser - SOUL.md 文件解析器
// ============================================================

import { existsSync, readFileSync } from "fs"
import { join, dirname } from "path"
import type {
  SoulMDContent,
  SoulMDFile,
  AgentIdentity,
  PersonalityTraits,
  SpeakingStyle,
  Expertise,
  Values,
  WorkStyle,
  Preferences,
  Backstory,
  Capabilities,
  EmotionalResponse
} from "./types.ts"

export class SoulMDParser {
  // 查找 SOUL.md
  static findSoulMD(cwd: string): SoulMDFile[] {
    const files: SoulMDFile[] = [
      { path: join(cwd, "SOUL.md"), exists: false },
      { path: join(cwd, ".soul.md"), exists: false },
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

    // 向上查找
    let parent = dirname(cwd)
    while (parent !== cwd && parent !== "/") {
      for (const file of files) {
        if (!file.exists) {
          const parentPath = join(parent, "SOUL.md")
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

  // 解析 SOUL.md
  static parse(content: string): SoulMDContent {
    const result: SoulMDContent = { raw: content }
    const lines = content.split("\n")

    let currentSection = ""
    let inCodeBlock = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const rawLine = lines[i]

      // 代码块
      if (line.startsWith("```")) {
        inCodeBlock = !inCodeBlock
        continue
      }
      if (inCodeBlock) continue

      if (!line) continue

      // 标题检测
      if (line.startsWith("# ")) {
        currentSection = this.normalizeSection(line.slice(2))
        continue
      }

      if (line.startsWith("## ")) {
        currentSection = this.normalizeSection(line.slice(3))
        continue
      }

      // 解析各部分
      this.parseSection(result, currentSection, line, rawLine, lines, i)
    }

    return result
  }

  // 归一化节名称
  private static normalizeSection(name: string): string {
    return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  }

  // 解析各个部分
  private static parseSection(
    result: SoulMDContent,
    section: string,
    line: string,
    rawLine: string,
    lines: string[],
    lineIndex: number
  ): void {
    switch (section) {
      // 身份
      case "identity":
      case "who-you-are":
        this.parseIdentity(result, line)
        break

      // 性格
      case "personality":
      case "traits":
        this.parsePersonality(result, line)
        break

      // 说话风格
      case "speaking-style":
      case "communication":
      case "style":
        this.parseSpeakingStyle(result, line)
        break

      // 专业
      case "expertise":
      case "skills":
        this.parseExpertise(result, line)
        break

      // 价值观
      case "values":
      case "principles":
        this.parseValues(result, line)
        break

      // 工作方式
      case "work-style":
      case "approach":
        this.parseWorkStyle(result, line)
        break

      // 偏好
      case "preferences":
      case "settings":
        this.parsePreferences(result, line)
        break

      // 背景
      case "backstory":
      case "background":
        this.parseBackstory(result, line)
        break

      // 能力
      case "capabilities":
      case "limits":
        this.parseCapabilities(result, line)
        break

      // 情绪
      case "emotions":
      case "responses":
        this.parseEmotions(result, line)
        break

      // 自定义系统提示
      case "system-prompt":
      case "custom-instructions":
        if (!result.customSystemPrompt) result.customSystemPrompt = ""
        if (line && !line.startsWith("#")) {
          result.customSystemPrompt += rawLine + "\n"
        }
        break
    }
  }

  // 解析身份
  private static parseIdentity(result: SoulMDContent, line: string): void {
    if (!result.identity) result.identity = {}

    const match = line.match(/^([a-zA-Z]+):\s*(.+)$/)
    if (match) {
      const [, key, value] = match
      switch (key.toLowerCase()) {
        case "name":
        case "title":
        case "avatar":
        case "description":
        case "tagline":
          if (result.identity) {
            (result.identity as any)[key] = value.trim()
          }
      }
    }
  }

  // 解析性格
  private static parsePersonality(result: SoulMDContent, line: string): void {
    if (!result.personality) result.personality = {}

    // Big Five 特征
    const traits: Record<string, keyof PersonalityTraits> = {
      openness: "openness",
      conscientiousness: "conscientiousness",
      extraversion: "extraversion",
      agreeableness: "agreeableness",
      stability: "stability",
      "big_five/openness": "openness",
      "big_five/conscientiousness": "conscientiousness",
      "big_five/extraversion": "extraversion",
      "big_five/agreeableness": "agreeableness",
      "big_five/stability": "stability",
    }

    const match = line.match(/^([a-zA-Z/_-]+):\s*(\d+)/)
    if (match) {
      const [, key, value] = match
      const traitKey = traits[key.toLowerCase()]
      if (traitKey && result.personality) {
        (result.personality as any)[traitKey] = parseInt(value, 10)
      }
    }

    // 自定义特征
    if (
      result.personality &&
      !result.personality.traits &&
      (line.startsWith("- ") || line.startsWith("* "))
    ) {
      ;(result.personality as PersonalityTraits).traits = []
      ;(result.personality as PersonalityTraits).traits!.push(line.slice(2).trim())
    } else if (
      result.personality &&
      result.personality.traits &&
      (line.startsWith("- ") || line.startsWith("* "))
    ) {
      result.personality.traits.push(line.slice(2).trim())
    }
  }

  // 解析说话风格
  private static parseSpeakingStyle(result: SoulMDContent, line: string): void {
    if (!result.speakingStyle) result.speakingStyle = {}

    const style = result.speakingStyle as SpeakingStyle

    // 正式程度
    if (line.match(/^formality:\s*(.+)/i)) {
      const m = line.match(/^formality:\s*(.+)/i)
      if (m) style.formality = m[1].trim() as SpeakingStyle["formality"]
    }

    // 技术深度
    if (line.match(/^technical_depth:\s*(.+)/i) || line.match(/^depth:\s*(.+)/i)) {
      const m = line.match(/^technical_depth:\s*(.+)/i) || line.match(/^depth:\s*(.+)/i)
      if (m) style.technicalDepth = m[1].trim() as SpeakingStyle["technicalDepth"]
    }

    // 响应长度
    if (line.match(/^verbosity:\s*(.+)/i) || line.match(/^length:\s*(.+)/i)) {
      const m = line.match(/^verbosity:\s*(.+)/i) || line.match(/^length:\s*(.+)/i)
      if (m) style.verbosity = m[1].trim() as SpeakingStyle["verbosity"]
    }

    // 语气
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const content = line.slice(2).trim()

      if (!style.tone) style.tone = []
      if (!style.languageStyle) style.languageStyle = []
      if (!style.phrases) style.phrases = []

      if (content.includes("tone:") || content.includes("tone")) {
        const toneMatch = content.match(/tone:\s*(.+)/i)
        if (toneMatch) {
          style.tone.push(...toneMatch[1].split(",").map((t) => t.trim()))
        } else if (!content.includes(":")) {
          style.tone.push(content.replace(/tone\s*/i, ""))
        }
      } else if (content.includes("phrase:")) {
        const phraseMatch = content.match(/phrase:\s*(.+)/i)
        if (phraseMatch) style.phrases.push(phraseMatch[1].trim())
      } else if (content.startsWith("uses") || content.startsWith("includes")) {
        style.languageStyle.push(content)
      }
    }
  }

  // 解析专业
  private static parseExpertise(result: SoulMDContent, line: string): void {
    if (!result.expertise) result.expertise = {}

    const expertise = result.expertise as Expertise
    const match = line.match(/^(primary|secondary|languages|frameworks|tools):\s*(.+)/i)

    if (match) {
      const [, key, value] = match
      const values = value.split(",").map((v) => v.trim())
      switch (key.toLowerCase()) {
        case "primary":
          expertise.primary = values
          break
        case "secondary":
          expertise.secondary = values
          break
        case "languages":
          expertise.languages = values
          break
        case "frameworks":
          expertise.frameworks = values
          break
        case "tools":
          expertise.tools = values
          break
      }
    }

    if (!match && (line.startsWith("- ") || line.startsWith("* "))) {
      const content = line.slice(2).trim()
      if (!expertise.primary) expertise.primary = []
      expertise.primary.push(content)
    }
  }

  // 解析价值观
  private static parseValues(result: SoulMDContent, line: string): void {
    if (!result.values) result.values = {}

    const values = result.values as Values
    const content = line.startsWith("- ") || line.startsWith("* ") ? line.slice(2).trim() : line

    if (!values.principles) values.principles = []
    if (!values.codeOfConduct) values.codeOfConduct = []
    if (!values.doNotDo) values.doNotDo = []
    if (!values.alwaysDo) values.alwaysDo = []

    if (content.toLowerCase().includes("always")) {
      values.alwaysDo.push(content.replace(/always\s*/i, ""))
    } else if (content.toLowerCase().includes("never")) {
      values.doNotDo.push(content.replace(/never\s*/i, ""))
    } else if (content) {
      values.principles.push(content)
    }
  }

  // 解析工作方式
  private static parseWorkStyle(result: SoulMDContent, line: string): void {
    if (!result.workStyle) result.workStyle = {}

    const style = result.workStyle as WorkStyle

    if (line.match(/^creativity:\s*(.+)/i)) {
      const m = line.match(/^creativity:\s*(.+)/i)
      if (m) style.creativity = m[1].trim() as WorkStyle["creativity"]
    }

    if (line.match(/^risk_tolerance:\s*(.+)/i) || line.match(/^risk:\s*(.+)/i)) {
      const m = line.match(/^risk_tolerance:\s*(.+)/i) || line.match(/^risk:\s*(.+)/i)
      if (m) style.riskTolerance = m[1].trim() as WorkStyle["riskTolerance"]
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const content = line.slice(2).trim()

      if (!style.communication) style.communication = []
      if (!style.problemSolving) style.problemSolving = []
      if (!style.decisionMaking) style.decisionMaking = []

      if (content.includes("communicate") || content.includes("Communication")) {
        style.communication.push(content)
      } else if (content.includes("solve") || content.includes("problem")) {
        style.problemSolving.push(content)
      } else if (content.includes("decide") || content.includes("decision")) {
        style.decisionMaking.push(content)
      } else {
        style.communication.push(content)
      }
    }
  }

  // 解析偏好
  private static parsePreferences(result: SoulMDContent, line: string): void {
    if (!result.preferences) result.preferences = {}

    const prefs = result.preferences as Preferences
    const match = line.match(/^([a-zA-Z_]+):\s*(.+)/)

    if (match) {
      const [, key, value] = match
      switch (key.toLowerCase()) {
        case "theme":
          prefs.theme = value.trim() as Preferences["theme"]
          break
        case "preferred_language":
        case "language":
          prefs.preferredLanguage = value.trim()
          break
        case "code_style":
        case "codestyle":
          prefs.codeStyle = value.trim()
          break
        case "timezone":
        case "tz":
          prefs.timezone = value.trim()
          break
        default:
          ;(prefs as any)[key] = value.trim()
      }
    }
  }

  // 解析背景
  private static parseBackstory(result: SoulMDContent, line: string): void {
    if (!result.backstory) result.backstory = {}

    const story = result.backstory as Backstory
    const match = line.match(/^(origin|experience|achievements|motivations|fears):\s*(.+)/i)

    if (match) {
      const [, key, value] = match
      switch (key.toLowerCase()) {
        case "origin":
          story.origin = value.trim()
          break
        case "experience":
          if (!story.experience) story.experience = []
          story.experience.push(value.trim())
          break
        case "achievements":
          if (!story.achievements) story.achievements = []
          story.achievements.push(value.trim())
          break
        case "motivations":
          if (!story.motivations) story.motivations = []
          story.motivations.push(value.trim())
          break
        case "fears":
          if (!story.fears) story.fears = []
          story.fears.push(value.trim())
          break
      }
    }

    if (!match && (line.startsWith("- ") || line.startsWith("* "))) {
      if (!story.experience) story.experience = []
      story.experience.push(line.slice(2).trim())
    }
  }

  // 解析能力
  private static parseCapabilities(result: SoulMDContent, line: string): void {
    if (!result.capabilities) result.capabilities = {}

    const caps = result.capabilities as Capabilities
    const match = line.match(/^([a-zA-Z_]+):\s*(.+)/)

    if (match) {
      const [, key, value] = match
      const boolValue = value.toLowerCase() === "true" || value === "1"

      switch (key.toLowerCase()) {
        case "max_context_length":
        case "context":
          caps.maxContextLength = parseInt(value, 10)
          break
        case "max_tool_calls":
        case "tool_calls":
          caps.maxToolCalls = parseInt(value, 10)
          break
        case "can_read_files":
        case "read":
          caps.canReadFiles = boolValue
          break
        case "can_write_files":
        case "write":
          caps.canWriteFiles = boolValue
          break
        case "can_execute_commands":
        case "execute":
          caps.canExecuteCommands = boolValue
          break
        case "can_access_internet":
        case "internet":
          caps.canAccessInternet = boolValue
          break
      }
    }
  }

  // 解析情绪
  private static parseEmotions(result: SoulMDContent, line: string): void {
    if (!result.emotions) result.emotions = {}

    const emotions = result.emotions as EmotionalResponse
    const match = line.match(/^(on_success|on_failure|on_frustration|on_praise|on_question):\s*(.+)/i)

    if (match) {
      const [, key, value] = match
      switch (key.toLowerCase()) {
        case "on_success":
          emotions.onSuccess = value.trim()
          break
        case "on_failure":
        case "on_error":
          emotions.onFailure = value.trim()
          break
        case "on_frustration":
        case "on_frustrated":
          emotions.onFrustration = value.trim()
          break
        case "on_praise":
        case "on_compliment":
          emotions.onPraise = value.trim()
          break
        case "on_question":
        case "on_skepticism":
          emotions.onQuestion = value.trim()
          break
      }
    }
  }

  // 生成系统提示
  static generateSystemPrompt(soul: SoulMDContent): string {
    const parts: string[] = []

    // 身份
    if (soul.identity) {
      parts.push("# Identity")
      if (soul.identity.name) parts.push(`You are **${soul.identity.name}**.`)
      if (soul.identity.title) parts.push(`Title: ${soul.identity.title}`)
      if (soul.identity.tagline) parts.push(soul.identity.tagline)
      if (soul.identity.description) parts.push(soul.identity.description)
      parts.push("")
    }

    // 性格特征
    if (soul.personality?.traits?.length) {
      parts.push("# Personality")
      parts.push("You are characterized by:")
      for (const trait of soul.personality.traits) {
        parts.push(`- ${trait}`)
      }
      parts.push("")
    }

    // 说话风格
    if (soul.speakingStyle) {
      parts.push("# Communication Style")
      const s = soul.speakingStyle

      if (s.formality) parts.push(`**Formality**: ${s.formality}`)
      if (s.technicalDepth) parts.push(`**Technical Depth**: ${s.technicalDepth}`)
      if (s.verbosity) parts.push(`**Response Length**: ${s.verbosity}`)
      if (s.tone?.length) parts.push(`**Tone**: ${s.tone.join(", ")}`)
      if (s.languageStyle?.length) {
        parts.push("**Language Style**:")
        for (const style of s.languageStyle) {
          parts.push(`- ${style}`)
        }
      }
      if (s.phrases?.length) {
        parts.push("**Signature Phrases**:")
        for (const phrase of s.phrases) {
          parts.push(`- "${phrase}"`)
        }
      }
      parts.push("")
    }

    // 专业
    if (soul.expertise) {
      const e = soul.expertise
      parts.push("# Expertise")
      if (e.primary?.length) parts.push(`**Primary**: ${e.primary.join(", ")}`)
      if (e.secondary?.length) parts.push(`**Secondary**: ${e.secondary.join(", ")}`)
      if (e.languages?.length) parts.push(`**Languages**: ${e.languages.join(", ")}`)
      if (e.frameworks?.length) parts.push(`**Frameworks**: ${e.frameworks.join(", ")}`)
      parts.push("")
    }

    // 价值观
    if (soul.values) {
      const v = soul.values
      parts.push("# Values & Principles")

      if (v.principles?.length) {
        parts.push("**Core Principles**:")
        for (const p of v.principles) {
          parts.push(`- ${p}`)
        }
      }

      if (v.alwaysDo?.length) {
        parts.push("**Always**:")
        for (const a of v.alwaysDo) {
          parts.push(`- ${a}`)
        }
      }

      if (v.doNotDo?.length) {
        parts.push("**Never**:")
        for (const n of v.doNotDo) {
          parts.push(`- ${n}`)
        }
      }

      parts.push("")
    }

    // 工作方式
    if (soul.workStyle) {
      const w = soul.workStyle
      parts.push("# Work Style")

      if (w.creativity) parts.push(`**Creativity**: ${w.creativity}`)
      if (w.riskTolerance) parts.push(`**Risk Tolerance**: ${w.riskTolerance}`)
      if (w.communication?.length) {
        parts.push("**Communication**:")
        for (const c of w.communication) {
          parts.push(`- ${c}`)
        }
      }
      parts.push("")
    }

    // 背景故事
    if (soul.backstory) {
      const b = soul.backstory
      parts.push("# Background")

      if (b.origin) parts.push(`**Origin**: ${b.origin}`)
      if (b.experience?.length) {
        parts.push("**Experience**:")
        for (const e of b.experience) {
          parts.push(`- ${e}`)
        }
      }
      if (b.achievements?.length) {
        parts.push("**Achievements**:")
        for (const a of b.achievements) {
          parts.push(`- ${a}`)
        }
      }
      parts.push("")
    }

    // 情绪响应
    if (soul.emotions) {
      const e = soul.emotions
      parts.push("# Emotional Responses")

      if (e.onSuccess) parts.push(`**On Success**: ${e.onSuccess}`)
      if (e.onFailure) parts.push(`**On Failure**: ${e.onFailure}`)
      if (e.onFrustration) parts.push(`**On Frustration**: ${e.onFrustration}`)
      if (e.onPraise) parts.push(`**On Praise**: ${e.onPraise}`)
      if (e.onQuestion) parts.push(`**On Question**: ${e.onQuestion}`)
      parts.push("")
    }

    // 自定义提示
    if (soul.customSystemPrompt) {
      parts.push("# Custom Instructions")
      parts.push(soul.customSystemPrompt)
    }

    return parts.join("\n")
  }
}
