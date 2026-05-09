// ============================================================
// Project Analyzer - 项目分析器（用于生成 pi.md）
// ============================================================

import { existsSync, readFileSync, readdirSync, statSync } from "fs"
import { join, basename, extname } from "path"
import type { 
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

export interface AnalyzeOptions {
  includeTests?: boolean
  includeDocs?: boolean
  maxDepth?: number
}

export class ProjectAnalyzer {
  private cwd: string
  private options: AnalyzeOptions

  constructor(cwd: string, options?: AnalyzeOptions) {
    this.cwd = cwd
    this.options = {
      includeTests: options?.includeTests ?? true,
      includeDocs: options?.includeDocs ?? true,
      maxDepth: options?.maxDepth ?? 3,
    }
  }

  // 分析项目
  async analyze(): Promise<ProjectAnalysis> {
    const result: ProjectAnalysis = {}

    // 检测项目配置
    result.projectConfig = this.detectProjectConfig()

    // 分析结构
    result.structure = this.analyzeStructure()

    // 检测依赖
    result.dependencies = this.detectDependencies()

    // 检测构建命令
    result.buildCommands = this.detectBuildCommands()

    return result
  }

  // 检测项目配置
  private detectProjectConfig(): ProjectConfig | undefined {
    const config: ProjectConfig = {}

    // package.json
    const pkgPath = join(this.cwd, "package.json")
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))
        config.name = pkg.name
        config.description = pkg.description
        config.repository = pkg.repository?.url || pkg.repository

        // 检测框架
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (deps.next) config.framework = "Next.js"
        else if (deps.nuxt) config.framework = "Nuxt"
        else if (deps.express) config.framework = "Express"
        else if (deps.fastify) config.framework = "Fastify"
        else if (deps.react) config.framework = "React"
        else if (deps.vue) config.framework = "Vue"
        else if (deps.angular) config.framework = "Angular"
        else if (deps.expo) config.framework = "Expo"

        // 检测语言
        if (existsSync("tsconfig.json")) config.language = "TypeScript"
        else if (existsSync("pyproject.toml") || existsSync("setup.py")) config.language = "Python"
        else if (existsSync("go.mod")) config.language = "Go"
        else if (existsSync("Cargo.toml")) config.language = "Rust"
        else if (existsSync("pom.xml")) config.language = "Java"
        else if (existsSync("build.gradle")) config.language = "Kotlin"
        else config.language = "JavaScript"
      } catch {}
    }

    // pyproject.toml / setup.py
    if (existsSync("pyproject.toml")) {
      config.language = "Python"
      try {
        const content = readFileSync("pyproject.toml", "utf-8")
        const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/)
        const descMatch = content.match(/description\s*=\s*["']([^"']+)["']/)
        if (nameMatch) config.name = nameMatch[1]
        if (descMatch) config.description = descMatch[1]
      } catch {}
    }

    // go.mod
    if (existsSync("go.mod")) {
      config.language = "Go"
      try {
        const content = readFileSync("go.mod", "utf-8")
        const nameMatch = content.match(/module\s+([^\s]+)/)
        if (nameMatch) config.name = nameMatch[1]
      } catch {}
    }

    // Cargo.toml
    if (existsSync("Cargo.toml")) {
      config.language = "Rust"
      try {
        const content = readFileSync("Cargo.toml", "utf-8")
        const nameMatch = content.match(/name\s*=\s*"([^"]+)"/)
        if (nameMatch) config.name = nameMatch[1]
      } catch {}
    }

    return config.name ? config : undefined
  }

  // 分析项目结构
  private analyzeStructure(): { directories: Directory[]; files: File[] } {
    const directories: Directory[] = []
    const files: File[] = []
    const skipDirs = new Set([
      "node_modules", ".git", "dist", "build", "target", 
      "__pycache__", ".venv", "venv", ".next", ".nuxt",
      ".cache", ".parcel-cache", ".turbo"
    ])

    const importantFiles = new Set([
      "README.md", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md",
      "package.json", "pyproject.toml", "go.mod", "Cargo.toml",
      "docker-compose.yml", "Dockerfile", ".env.example",
      "tsconfig.json", "jest.config.js", "vitest.config.ts",
      "vite.config.ts", "webpack.config.js", "next.config.js"
    ])

    this.scanDirectory(this.cwd, directories, files, skipDirs, importantFiles, 0)

    return { directories, files }
  }

  private scanDirectory(
    dir: string,
    directories: Directory[],
    files: File[],
    skipDirs: Set<string>,
    importantFiles: Set<string>,
    depth: number
  ): void {
    if (depth > (this.options.maxDepth ?? 3)) return

    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.startsWith(".")) continue

      const fullPath = join(dir, entry)

      let stat: ReturnType<typeof statSync>
      try {
        stat = statSync(fullPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        if (skipDirs.has(entry)) continue

        const description = this.getDirectoryDescription(entry)
        directories.push({ path: entry, description })

        this.scanDirectory(fullPath, directories, files, skipDirs, importantFiles, depth + 1)
      } else if (stat.isFile()) {
        const ext = extname(entry)
        const importance = this.getFileImportance(entry, ext)

        if (importantFiles.has(entry) || importance === "high") {
          files.push({
            path: entry,
            importance
          })
        }
      }
    }
  }

  private getDirectoryDescription(dir: string): string {
    const descriptions: Record<string, string> = {
      src: "Source code",
      lib: "Libraries",
      components: "React/Vue components",
      pages: "Pages/Routes",
      routes: "API routes",
      api: "API endpoints",
      models: "Data models",
      schemas: "Database schemas",
      services: "Business logic",
      utils: "Utility functions",
      hooks: "React hooks",
      store: "State management",
      config: "Configuration files",
      scripts: "Build/utility scripts",
      tests: "Test files",
      __tests__: "Test files",
      e2e: "End-to-end tests",
      docs: "Documentation",
      examples: "Example code",
      assets: "Static assets",
      public: "Public assets",
      static: "Static files",
      styles: "Stylesheets",
      css: "Stylesheets",
    }

    return descriptions[dir] || ""
  }

  private getFileImportance(file: string, ext: string): "high" | "medium" | "low" {
    const highImportance = [
      "package.json", "tsconfig.json", "pyproject.toml", "go.mod",
      "Dockerfile", "docker-compose.yml", "vite.config.ts"
    ]

    if (highImportance.includes(file)) return "high"

    const medImportance = [
      ".env.example", "jest.config.js", "vitest.config.ts",
      "next.config.js", "webpack.config.js"
    ]

    if (medImportance.includes(file)) return "medium"

    // 代码文件中等重要
    const codeExts = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java"]
    if (codeExts.includes(ext)) return "medium"

    return "low"
  }

  // 检测依赖
  private detectDependencies(): Dependency[] {
    const deps: Dependency[] = []

    // package.json
    const pkgPath = join(this.cwd, "package.json")
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))

        for (const [name, version] of Object.entries(pkg.dependencies || {})) {
          deps.push({ name, version: `@${version}`, isDev: false })
        }

        for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
          deps.push({ name, version: `@${version}`, isDev: true })
        }
      } catch {}
    }

    // go.mod
    const goModPath = join(this.cwd, "go.mod")
    if (existsSync(goModPath)) {
      try {
        const content = readFileSync(goModPath, "utf-8")
        const requireMatch = content.match(/require \(([\s\S]+)\)/)
        if (requireMatch) {
          for (const line of requireMatch[1].split("\n")) {
            const match = line.match(/^\s*([^\s]+)\s+v?([^\s]+)/)
            if (match) {
              deps.push({ name: match[1], version: match[2] })
            }
          }
        }
      } catch {}
    }

    return deps
  }

  // 检测构建命令
  private detectBuildCommands(): BuildCommand[] {
    const commands: BuildCommand[] = []

    // package.json scripts
    const pkgPath = join(this.cwd, "package.json")
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"))

        const commonScripts: Record<string, string> = {
          dev: "Start development server",
          build: "Build for production",
          start: "Start production server",
          test: "Run tests",
          lint: "Run linter",
          format: "Format code",
          "typecheck": "Type check",
        }

        for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
          const desc = commonScripts[name] || ""
          commands.push({ name, command: cmd as string, description: desc })
        }
      } catch {}
    }

    // Makefile
    const makePath = join(this.cwd, "Makefile")
    if (existsSync(makePath)) {
      try {
        const content = readFileSync(makePath, "utf-8")
        for (const line of content.split("\n")) {
          const match = line.match(/^([a-zA-Z_-]+):.*##\s*(.+)/)
          if (match) {
            commands.push({ name: match[1], command: `make ${match[1]}`, description: match[2] })
          }
        }
      } catch {}
    }

    return commands
  }

  // 生成 pi.md 模板
  generatePiMDTemplate(analysis: ProjectAnalysis): string {
    const lines: string[] = []

    // 标题
    lines.push(`# ${analysis.projectConfig?.name || "Project"}`)

    // 项目信息
    lines.push("")
    lines.push("## Project")
    if (analysis.projectConfig) {
      const p = analysis.projectConfig
      lines.push(`name: ${p.name || ""}`)
      if (p.description) lines.push(`description: ${p.description}`)
      if (p.language) lines.push(`language: ${p.language}`)
      if (p.framework) lines.push(`framework: ${p.framework}`)
      if (p.repository) lines.push(`repository: ${p.repository}`)
    }

    // 项目结构
    lines.push("")
    lines.push("## Project Structure")
    if (analysis.structure?.directories) {
      for (const dir of analysis.structure.directories.slice(0, 15)) {
        const desc = dir.description ? ` - ${dir.description}` : ""
        lines.push(`- ${dir.path}/${desc}`)
      }
    }

    // 依赖
    if (analysis.dependencies?.length) {
      lines.push("")
      lines.push("## Dependencies")
      lines.push("")
      lines.push("### Production")
      for (const dep of analysis.dependencies.filter(d => !d.isDev).slice(0, 20)) {
        const version = dep.version ? ` (${dep.version})` : ""
        lines.push(`- ${dep.name}${version}`)
      }
      
      if (this.options.includeTests && analysis.dependencies.some(d => d.isDev)) {
        lines.push("")
        lines.push("### Development")
        for (const dep of analysis.dependencies.filter(d => d.isDev).slice(0, 10)) {
          const version = dep.version ? ` (${dep.version})` : ""
          lines.push(`- ${dep.name}${version}`)
        }
      }
    }

    // 命令
    if (analysis.buildCommands?.length) {
      lines.push("")
      lines.push("## Commands")
      for (const cmd of analysis.buildCommands) {
        const desc = cmd.description ? ` - ${cmd.description}` : ""
        lines.push(`- ${cmd.name}: ${cmd.command}${desc}`)
      }
    }

    // 编码规范（空白模板）
    lines.push("")
    lines.push("## Coding Standards")
    lines.push("")
    lines.push("// TODO: Add coding standards for this project")
    lines.push("")

    // 规则（空白模板）
    lines.push("")
    lines.push("## Rules")
    lines.push("")
    lines.push("// TODO: Add project-specific rules")
    lines.push("- Follow existing code style")
    lines.push("- Write tests for new features")
    lines.push("")

    // 自定义说明（空白模板）
    lines.push("")
    lines.push("## Custom Instructions")
    lines.push("")
    lines.push("// TODO: Add any project-specific instructions or context")

    return lines.join("\n")
  }
}
