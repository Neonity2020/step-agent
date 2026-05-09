// ============================================================
// Extension Loader - 扩展加载器
// ============================================================

import { existsSync, readdirSync, statSync } from "fs"
import { join, extname, basename } from "path"
import type { Extension, ExtensionAPI, ExtensionOptions, AgentConfig } from "./base"
import type { Tool } from "../tools/base"
import type { Command } from "./base"
import type { Provider } from "../providers/base"

// 扩展管理器
export class ExtensionManager {
  private extensions: Map<string, Extension> = new Map()
  private tools: Map<string, Tool> = new Map()
  private commands: Map<string, Command> = new Map()
  private providers: Map<string, Provider> = new Map()
  private eventHandlers: Map<string, Set<Function>> = new Map()
  private api: ExtensionAPI
  private config: AgentConfig = {}
  private settings: Record<string, unknown> = {}
  private loaded: boolean = false

  constructor(api?: Partial<ExtensionAPI>) {
    this.api = this.createAPI()
  }

  // 创建 API
  private createAPI(): ExtensionAPI {
    return {
      // 注册工具
      registerTool: (tool: Tool) => {
        this.tools.set(tool.name, tool)
        this.log(`Registered tool: ${tool.name}`)
      },
      
      // 注销工具
      unregisterTool: (name: string) => {
        this.tools.delete(name)
        this.log(`Unregistered tool: ${name}`)
      },
      
      // 注册命令
      registerCommand: (cmd: Command) => {
        this.commands.set(cmd.name, cmd)
        this.log(`Registered command: ${cmd.name}`)
      },
      
      // 注销命令
      unregisterCommand: (name: string) => {
        this.commands.delete(name)
        this.log(`Unregistered command: ${name}`)
      },
      
      // 注册 Provider
      registerProvider: (provider: Provider) => {
        this.providers.set(provider.name, provider)
        this.log(`Registered provider: ${provider.name}`)
      },

      // 事件监听
      on: (event, handler) => {
        if (!this.eventHandlers.has(event)) {
          this.eventHandlers.set(event, new Set())
        }
        this.eventHandlers.get(event)!.add(handler)
      },
      
      // 移除监听
      off: (event, handler) => {
        this.eventHandlers.get(event)?.delete(handler)
      },
      
      // 发送事件
      emit: (event, data) => {
        const handlers = this.eventHandlers.get(event)
        if (handlers) {
          for (const handler of handlers) {
            try {
              Promise.resolve(handler(data, this.api))
            } catch (err) {
              console.error(`Error in event handler for ${event}:`, err)
            }
          }
        }
      },

      // 配置
      getConfig: () => this.config,
      setConfig: (config) => {
        this.config = { ...this.config, ...config }
      },
      
      // 设置
      getSettings: () => this.settings,
      setSetting: (key, value) => {
        this.settings[key] = value
      },

      // 日志
      log: (message, level = "info") => {
        const prefix = `[${level.toUpperCase()}]`
        console.log(`${prefix} Extension: ${message}`)
      },
    }
  }

  // 加载扩展
  async load(options: ExtensionOptions = {}): Promise<void> {
    if (this.loaded) {
      console.warn("Extensions already loaded")
      return
    }

    this.loaded = true

    // 加载直接传入的扩展
    if (options.plugins) {
      for (const plugin of options.plugins) {
        await this.loadExtension(plugin)
      }
    }

    // 从目录加载
    if (options.autoLoad !== false && options.dir) {
      await this.loadFromDir(options.dir)
    }
  }

  // 从目录加载扩展
  private async loadFromDir(dir: string): Promise<void> {
    if (!existsSync(dir)) {
      console.log(`Extension directory not found: ${dir}`)
      return
    }

    const files = readdirSync(dir, { withFileTypes: true })

    for (const file of files) {
      const fullPath = join(dir, file.name)

      if (file.isDirectory()) {
        // 检查目录中是否有 index.ts 或主文件
        const indexPath = join(fullPath, "index.ts")
        if (existsSync(indexPath)) {
          await this.loadFile(indexPath)
        }
      } else if (extname(file.name) === ".ts") {
        await this.loadFile(fullPath)
      }
    }
  }

  // 加载单个文件
  private async loadFile(path: string): Promise<void> {
    try {
      const module = await import(path)
      const extension = module.default as Extension

      if (!extension?.meta?.name) {
        console.warn(`Extension at ${path} missing meta.name, skipping`)
        return
      }

      await this.loadExtension(extension)
    } catch (err) {
      console.error(`Failed to load extension from ${path}:`, err)
    }
  }

  // 加载扩展实例
  private async loadExtension(extension: Extension): Promise<void> {
    try {
      await extension.register(this.api)
      this.extensions.set(extension.meta.name, extension)
      console.log(`Loaded extension: ${extension.meta.name} (${extension.meta.version})`)
    } catch (err) {
      console.error(`Failed to register extension ${extension.meta.name}:`, err)
    }
  }

  // 卸载扩展
  unload(name: string): boolean {
    const ext = this.extensions.get(name)
    if (ext) {
      if (ext.unregister) {
        ext.unregister()
      }
      this.extensions.delete(name)
      return true
    }
    return false
  }

  // 获取所有工具
  getTools(): Tool[] {
    return Array.from(this.tools.values())
  }

  // 获取所有命令
  getCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  // 获取所有 Provider
  getProviders(): Provider[] {
    return Array.from(this.providers.values())
  }

  // 触发事件
  triggerEvent(event: string, data: Record<string, unknown>): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          Promise.resolve(handler(data, this.api))
        } catch (err) {
          console.error(`Error in event handler for ${event}:`, err)
        }
      }
    }
  }

  // 列出已加载的扩展
  listExtensions(): Array<{ name: string; version: string; description?: string }> {
    return Array.from(this.extensions.values()).map(ext => ({
      name: ext.meta.name,
      version: ext.meta.version,
      description: ext.meta.description,
    }))
  }

  // 获取 API（供 Agent 使用）
  getAPI(): ExtensionAPI {
    return this.api
  }

  // 私有日志方法
  private log(message: string): void {
    console.log(`[EXT] ${message}`)
  }
}
