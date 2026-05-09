// ============================================================
// Model Context - 模型上下文（全局状态）
// ============================================================

import type { ModelSelection } from "./config"

// 默认配置
const DEFAULT_SELECTION: ModelSelection = {
  providerId: "anthropic",
  modelId: "claude-sonnet-4-20250514",
  maxTokens: 8192,
  temperature: 0.7,
}

// 全局模型配置
let currentSelection: ModelSelection = { ...DEFAULT_SELECTION }
let maxIterations = 3

// 获取当前配置
export function getCurrentModel(): ModelSelection {
  return { ...currentSelection }
}

// 设置当前使用的模型（由 CLI 调用）
export function setCurrentProviderAndModel(providerId: string, modelId: string): void {
  currentSelection = {
    providerId,
    modelId,
    maxTokens: 8192,
    temperature: 0.7,
  }
}

// 设置配置
export function setCurrentModel(selection: ModelSelection): void {
  currentSelection = { ...selection }
}

// 获取最大迭代次数
export function getMaxIterations(): number {
  return maxIterations
}

// 设置最大迭代次数
export function setMaxIterations(iterations: number): void {
  maxIterations = iterations
}

// 重置为默认
export function resetToDefault(): void {
  currentSelection = { ...DEFAULT_SELECTION }
  maxIterations = 3
}

// 检查配置是否改变
export function hasConfigChanged(newSelection: ModelSelection): boolean {
  return (
    newSelection.providerId !== currentSelection.providerId ||
    newSelection.modelId !== currentSelection.modelId ||
    newSelection.maxTokens !== currentSelection.maxTokens ||
    newSelection.temperature !== currentSelection.temperature
  )
}

// 创建 Provider 实例
export async function createProvider(
  selection?: ModelSelection
): Promise<{ provider: any; modelId: string }> {
  const config = selection || currentSelection

  switch (config.providerId) {
    case "anthropic":
      const { AnthropicProvider } = await import("./anthropic")
      return {
        provider: new AnthropicProvider({
          apiKey: Bun.env.ANTHROPIC_API_KEY!,
          model: config.modelId,
        }),
        modelId: config.modelId,
      }

    case "openai":
      const { OpenAIProvider } = await import("./openai")
      return {
        provider: new OpenAIProvider({
          apiKey: Bun.env.OPENAI_API_KEY!,
          model: config.modelId,
        }),
        modelId: config.modelId,
      }

    default:
      // 对于其他 Provider，使用 OpenAI 兼容格式
      const { getProvider } = await import("./config")
      const providerConfig = getProvider(config.providerId)

      if (!providerConfig) {
        throw new Error(`Unknown provider: ${config.providerId}`)
      }

      // 使用 OpenAI 兼容的 Provider
      const { OpenAIProvider: OpenAI } = await import("./openai")
      return {
        provider: new OpenAI({
          apiKey: Bun.env[providerConfig.apiKeyEnvVar!]!,
          model: config.modelId,
        }),
        modelId: config.modelId,
      }
  }
}
