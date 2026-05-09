// ============================================================
// Provider & Model Config - Provider 和模型配置
// ============================================================

// .env 配置示例：
// MINIMAX_API_KEY=your-api-key-here
//
// 模型名称：
// MiniMax-M2.7 (推荐)

// 模型信息
export interface ModelInfo {
  id: string
  name: string
  description?: string
  contextWindow?: number
  maxOutputTokens?: number
  supportedModes?: ("chat" | "completion" | "embedding")[]
  deprecated?: boolean
}

// Provider 配置
export interface ProviderConfig {
  id: string
  name: string
  description?: string
  baseURL?: string
  apiKeyEnvVar?: string
  models: ModelInfo[]
  defaultModel?: string
}

// 所有 Provider 配置
export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models by Anthropic",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        description: "Most capable model for complex tasks",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        description: "Balanced model for everyday tasks",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "claude-haiku-4-20250711",
        name: "Claude Haiku 4",
        description: "Fast, efficient model",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "claude-3-5-sonnet-latest",
        name: "Claude 3.5 Sonnet",
        description: "Previous generation Sonnet",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
        deprecated: true,
      },
      {
        id: "claude-3-opus-latest",
        name: "Claude 3 Opus",
        description: "Previous generation Opus",
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
        deprecated: true,
      },
      {
        id: "claude-3-sonnet-latest",
        name: "Claude 3 Sonnet",
        description: "Previous generation Sonnet",
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
        deprecated: true,
      },
      {
        id: "claude-3-haiku-latest",
        name: "Claude 3 Haiku",
        description: "Previous generation Haiku",
        contextWindow: 200000,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
        deprecated: true,
      },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models by OpenAI",
    apiKeyEnvVar: "OPENAI_API_KEY",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Most capable, fastest GPT-4 model",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportedModes: ["chat"],
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Fast, affordable GPT-4o variant",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportedModes: ["chat"],
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        description: "Previous generation GPT-4",
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
        deprecated: true,
      },
      {
        id: "gpt-4",
        name: "GPT-4",
        description: "Original GPT-4",
        contextWindow: 8192,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
        deprecated: true,
      },
      {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        description: "Fast, affordable",
        contextWindow: 16385,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
        deprecated: true,
      },
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini models by Google AI",
    apiKeyEnvVar: "GOOGLE_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-2.0-flash",
    models: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Fast and capable",
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "gemini-2.0-flash-thinking",
        name: "Gemini 2.0 Flash Thinking",
        description: "Extended thinking capabilities",
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Long context, high intelligence",
        contextWindow: 2000000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        description: "Fast with long context",
        contextWindow: 1000000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "gemini-pro",
        name: "Gemini Pro",
        description: "Standard Gemini model",
        contextWindow: 32768,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
        deprecated: true,
      },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Mistral and Mixtral models",
    apiKeyEnvVar: "MISTRAL_API_KEY",
    baseURL: "https://api.mistral.ai/v1",
    defaultModel: "mistral-large-latest",
    models: [
      {
        id: "mistral-large-latest",
        name: "Mistral Large",
        description: "Most capable Mistral model",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportedModes: ["chat"],
      },
      {
        id: "mistral-small-latest",
        name: "Mistral Small",
        description: "Fast, efficient",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportedModes: ["chat"],
      },
      {
        id: "mistral-nemo",
        name: "Mistral Nemo",
        description: "12B model, good balance",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportedModes: ["chat"],
      },
      {
        id: "codestral-latest",
        name: "Codestral",
        description: "Code-specialized model",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportedModes: ["chat"],
      },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    description: "Fast inference with Groq",
    apiKeyEnvVar: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.1-70b-versatile",
    models: [
      {
        id: "llama-3.1-70b-versatile",
        name: "Llama 3.1 70B",
        description: "Fast inference, versatile",
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B",
        description: "Fastest, good for simple tasks",
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        description: "Mixture of experts",
        contextWindow: 32768,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
      },
      {
        id: "gemma2-9b-it",
        name: "Gemma 2 9B",
        description: "Google's efficient model",
        contextWindow: 8192,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek V4 models",
    apiKeyEnvVar: "DEEPSEEK_API_KEY",
    baseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-v4-pro",
    models: [
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        description: "Most capable DeepSeek model",
        contextWindow: 640000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        description: "Fast inference variant",
        contextWindow: 640000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    description: "Grok models by xAI",
    apiKeyEnvVar: "XAI_API_KEY",
    baseURL: "https://api.x.ai/v1",
    defaultModel: "grok-2-1212",
    models: [
      {
        id: "grok-2-1212",
        name: "Grok 2",
        description: "Latest Grok model",
        contextWindow: 131072,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "grok-2-mini-1212",
        name: "Grok 2 Mini",
        description: "Fast Grok variant",
        contextWindow: 131072,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "grok-beta",
        name: "Grok Beta",
        description: "Beta Grok model",
        contextWindow: 131072,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
    ],
  },
  {
    id: "cohere",
    name: "Cohere",
    description: "Command R models by Cohere",
    apiKeyEnvVar: "COHERE_API_KEY",
    baseURL: "https://api.cohere.ai/v2",
    defaultModel: "command-r-plus",
    models: [
      {
        id: "command-r-plus",
        name: "Command R+",
        description: "Most capable, long context",
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
      },
      {
        id: "command-r",
        name: "Command R",
        description: "Balanced performance",
        contextWindow: 128000,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
      },
      {
        id: "command",
        name: "Command",
        description: "Fast, efficient",
        contextWindow: 4096,
        maxOutputTokens: 4096,
        supportedModes: ["chat"],
        deprecated: true,
      },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax M2.7 models",
    apiKeyEnvVar: "MINIMAX_API_KEY",
    baseURL: "https://api.minimax.chat/v1",
    defaultModel: "MiniMax-M2.7",
    models: [
      {
        id: "MiniMax-M2.7",
        name: "MiniMax-M2.7",
        description: "MiniMax M2.7, high intelligence",
        contextWindow: 256000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
    ],
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    description: "智谱大模型 GLM 系列",
    apiKeyEnvVar: "ZHIPU_API_KEY",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-5.1",
    models: [
      {
        id: "glm-5.1",
        name: "GLM-5.1",
        description: "最新一代智谱大模型",
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
      {
        id: "glm-4.7",
        name: "GLM-4.7",
        description: "稳定版智谱大模型",
        contextWindow: 128000,
        maxOutputTokens: 8192,
        supportedModes: ["chat"],
      },
    ],
  },
]

// 获取 Provider
export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS.find((p) => p.id === id)
}

// 获取所有 Provider（过滤没有 API Key 的）
export function getAvailableProviders(): ProviderConfig[] {
  return PROVIDER_CONFIGS.filter((p) => {
    if (!p.apiKeyEnvVar) return true
    const key = Bun.env[p.apiKeyEnvVar]
    return key && key.length > 10 // 简单验证：key 不能太短
  })
}

// 验证 API Key 是否有效（异步测试）
export async function validateAPIKey(providerId: string, apiKey: string): Promise<boolean> {
  try {
    const provider = getProvider(providerId)
    if (!provider) return false

    // 简单的测试请求
    const response = await fetch(`${provider.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.defaultModel,
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      }),
    })

    return response.ok
  } catch {
    return false
  }
}

// 获取所有有效的 Provider（带验证）
export async function getValidProviders(): Promise<ProviderConfig[]> {
  const validProviders: ProviderConfig[] = []

  for (const provider of PROVIDER_CONFIGS) {
    if (!provider.apiKeyEnvVar) continue
    const apiKey = Bun.env[provider.apiKeyEnvVar]
    if (!apiKey || apiKey.length < 10) continue

    // 测试 API Key
    const isValid = await validateAPIKey(provider.id, apiKey)
    if (isValid) {
      validProviders.push(provider)
    }
  }

  return validProviders
}

// 获取模型
export function getModel(providerId: string, modelId: string): ModelInfo | undefined {
  const provider = getProvider(providerId)
  return provider?.models.find((m) => m.id === modelId)
}

// 列出所有模型（按 Provider 分组）
export function listAllModels(): Map<string, ModelInfo[]> {
  const result = new Map<string, ModelInfo[]>()
  for (const provider of PROVIDER_CONFIGS) {
    result.set(provider.id, provider.models)
  }
  return result
}

// 模型选择配置
export interface ModelSelection {
  providerId: string
  modelId: string
  maxTokens?: number
  temperature?: number
}

// 迭代次数配置
export const ITERATION_OPTIONS = [
  { value: 1, label: "1 - Single response" },
  { value: 3, label: "3 - Quick iteration" },
  { value: 5, label: "5 - Standard iteration" },
  { value: 10, label: "10 - Deep iteration" },
  { value: 20, label: "20 - Extensive iteration" },
  { value: 50, label: "50 - Maximum iteration" },
]

// 最大输出 Token 配置
export const MAX_TOKENS_OPTIONS = [
  { value: 1024, label: "1K - Concise" },
  { value: 2048, label: "2K - Standard" },
  { value: 4096, label: "4K - Detailed" },
  { value: 8192, label: "8K - Extended" },
  { value: 16384, label: "16K - Long" },
  { value: 32768, label: "32K - Very Long" },
  { value: 65536, label: "64K - Maximum" },
]

// Temperature 配置
export const TEMPERATURE_OPTIONS = [
  { value: 0, label: "0.0 - Deterministic" },
  { value: 0.3, label: "0.3 - Focused" },
  { value: 0.5, label: "0.5 - Balanced" },
  { value: 0.7, label: "0.7 - Creative" },
  { value: 1.0, label: "1.0 - Very Creative" },
  { value: 1.5, label: "1.5 - Maximum Creativity" },
]
