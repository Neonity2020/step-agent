// ============================================================
// Model Selector - 交互式模型选择器
// ============================================================

import * as readline from "readline"
import {
  PROVIDER_CONFIGS,
  getAvailableProviders,
  getProvider,
  ITERATION_OPTIONS,
  MAX_TOKENS_OPTIONS,
  TEMPERATURE_OPTIONS,
} from "./config"
import type { ModelSelection, ProviderConfig, ModelInfo } from "./config"
import { color, theme } from "../tui/colors"

const PIPE = "│"
const BORDER = "─"
const CORNER_L = "┌"
const CORNER_R = "┐"
const CORNER_BL = "└"
const CORNER_BR = "┘"
const T_DOWN = "├"
const T_UP = "├"

function boxLine(content: string): string {
  return CORNER_L + content.padEnd(60) + CORNER_R
}

function boxLineMid(content: string): string {
  return T_DOWN + content.padEnd(60) + T_UP
}

function boxLineEnd(content: string): string {
  return CORNER_BL + content.padEnd(60) + CORNER_BR
}

function boxLineStartEnd(): string {
  return CORNER_L + BORDER.repeat(60) + CORNER_R
}

function boxLineMidEnd(): string {
  return T_DOWN + BORDER.repeat(60) + T_UP
}

// 读取单行输入
function readLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(color(question + " ", theme.assistantPrefix), (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

// 选择 Provider
export async function selectProvider(): Promise<ProviderConfig | null> {
  const available = getAvailableProviders()
  const all = PROVIDER_CONFIGS

  console.log(color("\n" + boxLineStartEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Select Provider".padEnd(60) + PIPE, theme.assistantPrefix))
  console.log(color(boxLineMidEnd(), theme.border))

  // 显示所有 Provider，带标记
  for (let i = 0; i < all.length; i++) {
    const p = all[i]
    const isAvailable = available.some((a) => a.id === p.id)
    const mark = isAvailable ? color("●", theme.successText) : color("○", theme.dim)
    const name = p.name.padEnd(15)
    const desc = p.description?.slice(0, 35) || ""
    const key = color("[" + (i + 1) + "]", theme.statusBarHighlight)

    console.log(color(PIPE, theme.border) + color(" " + key + " " + mark + " " + name + " " + desc.padEnd(60 - name.length - 4 - key.length - 2) + PIPE, theme.statusBar))
  }

  if (available.length < all.length) {
    console.log(color(PIPE, theme.border) + color(" ○ = Requires API key".padEnd(60) + PIPE, theme.dim))
  }

  console.log(color(PIPE, theme.border) + color(" [q] Quit selection".padEnd(60) + PIPE, theme.dim))
  console.log(color(boxLineEnd(""), theme.border))

  const answer = await readLine("\nEnter number: ")

  if (answer.toLowerCase() === "q") {
    return null
  }

  const index = parseInt(answer, 10) - 1
  if (isNaN(index) || index < 0 || index >= all.length) {
    console.log(color("\n❌ Invalid selection", theme.errorText))
    return selectProvider()
  }

  const selected = all[index]

  // 检查 API Key
  if (selected.apiKeyEnvVar && !Bun.env[selected.apiKeyEnvVar]) {
    console.log(color("\n⚠️  " + selected.name + " requires " + selected.apiKeyEnvVar, theme.warningText))
    console.log(color("    Set it with: export " + selected.apiKeyEnvVar + "=your-key", theme.dim))

    const retry = await readLine("\nTry another provider? (y/N): ")
    if (retry.toLowerCase() === "y") {
      return selectProvider()
    }
    return null
  }

  return selected
}

// 选择模型
export async function selectModel(provider: ProviderConfig): Promise<ModelInfo | null> {
  console.log(color("\n" + boxLineStartEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Select Model for " + provider.name.padEnd(60 - 17) + PIPE, theme.assistantPrefix))
  console.log(color(boxLineMidEnd(), theme.border))

  for (let i = 0; i < provider.models.length; i++) {
    const m = provider.models[i]
    const key = color("[" + (i + 1) + "]", theme.statusBarHighlight)
    const name = m.name.padEnd(22)
    const id = m.id.slice(0, 22).padEnd(22)
    const deprecated = m.deprecated ? color(" [deprecated]", theme.warningText) : ""

    const line = " " + key + " " + name + " " + id + deprecated
    console.log(color(PIPE, theme.border) + color(line.padEnd(60) + PIPE, theme.statusBar))
    if (m.description) {
      const descLine = "     " + m.description.slice(0, 55)
      console.log(color(PIPE, theme.border) + color(descLine.padEnd(60) + PIPE, theme.dim))
    }
  }

  console.log(color(PIPE, theme.border) + color(" [q] Quit selection".padEnd(60) + PIPE, theme.dim))
  console.log(color(boxLineEnd(""), theme.border))

  // 显示默认模型
  if (provider.defaultModel) {
    console.log(color("\nDefault: " + provider.defaultModel, theme.dim))
  }

  const answer = await readLine("\nEnter number: ")

  if (answer.toLowerCase() === "q") {
    return null
  }

  const index = parseInt(answer, 10) - 1
  if (isNaN(index) || index < 0 || index >= provider.models.length) {
    console.log(color("\n❌ Invalid selection", theme.errorText))
    return selectModel(provider)
  }

  const selected = provider.models[index]

  if (selected.deprecated) {
    console.log(color("\n⚠️  This model is deprecated", theme.warningText))
    const confirm = await readLine("Continue anyway? (y/N): ")
    if (confirm.toLowerCase() !== "y") {
      return selectModel(provider)
    }
  }

  return selected
}

// 选择迭代次数
export async function selectIterations(): Promise<number> {
  console.log(color("\n" + boxLineStartEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Select Iteration Count".padEnd(60) + PIPE, theme.assistantPrefix))
  console.log(color(PIPE, theme.border) + color(" (Max tool calling rounds per turn)".padEnd(60) + PIPE, theme.dim))
  console.log(color(boxLineMidEnd(), theme.border))

  for (let i = 0; i < ITERATION_OPTIONS.length; i++) {
    const opt = ITERATION_OPTIONS[i]
    const key = color("[" + (i + 1) + "]", theme.statusBarHighlight)
    console.log(color(PIPE, theme.border) + color(" " + key + " " + opt.label.padEnd(60 - key.length - 2) + PIPE, theme.statusBar))
  }

  console.log(color(PIPE, theme.border) + color(" [q] Quit selection".padEnd(60) + PIPE, theme.dim))
  console.log(color(boxLineEnd(""), theme.border))

  const answer = await readLine("\nEnter number (default: 3): ")

  if (answer.toLowerCase() === "q") {
    return 3
  }

  if (!answer.trim()) {
    return 3
  }

  const index = parseInt(answer, 10) - 1
  if (isNaN(index) || index < 0 || index >= ITERATION_OPTIONS.length) {
    console.log(color("\n❌ Invalid selection, using default (3)", theme.warningText))
    return 3
  }

  return ITERATION_OPTIONS[index].value
}

// 选择 Max Tokens
export async function selectMaxTokens(defaultValue?: number): Promise<number> {
  console.log(color("\n" + boxLineStartEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Select Max Output Tokens".padEnd(60) + PIPE, theme.assistantPrefix))
  console.log(color(boxLineMidEnd(), theme.border))

  for (let i = 0; i < MAX_TOKENS_OPTIONS.length; i++) {
    const opt = MAX_TOKENS_OPTIONS[i]
    const key = color("[" + (i + 1) + "]", theme.statusBarHighlight)
    const defaultMark = defaultValue === opt.value ? color(" ◄", theme.successText) : ""
    console.log(color(PIPE, theme.border) + color(" " + key + " " + opt.label + defaultMark + "".padEnd(60 - key.length - 2 - opt.label.length - defaultMark.length) + PIPE, theme.statusBar))
  }

  console.log(color(PIPE, theme.border) + color(" [q] Quit selection".padEnd(60) + PIPE, theme.dim))
  console.log(color(boxLineEnd(""), theme.border))

  const answer = await readLine("\nEnter number: ")

  if (answer.toLowerCase() === "q") {
    return defaultValue || 8192
  }

  if (!answer.trim()) {
    return defaultValue || 8192
  }

  const index = parseInt(answer, 10) - 1
  if (isNaN(index) || index < 0 || index >= MAX_TOKENS_OPTIONS.length) {
    console.log(color("\n❌ Invalid selection", theme.errorText))
    return selectMaxTokens(defaultValue)
  }

  return MAX_TOKENS_OPTIONS[index].value
}

// 选择 Temperature
export async function selectTemperature(): Promise<number> {
  console.log(color("\n" + boxLineStartEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Select Temperature (Creativity)".padEnd(60) + PIPE, theme.assistantPrefix))
  console.log(color(boxLineMidEnd(), theme.border))

  for (let i = 0; i < TEMPERATURE_OPTIONS.length; i++) {
    const opt = TEMPERATURE_OPTIONS[i]
    const key = color("[" + (i + 1) + "]", theme.statusBarHighlight)
    console.log(color(PIPE, theme.border) + color(" " + key + " " + opt.label.padEnd(60 - key.length - 2) + PIPE, theme.statusBar))
  }

  console.log(color(PIPE, theme.border) + color(" [q] Quit selection".padEnd(60) + PIPE, theme.dim))
  console.log(color(boxLineEnd(""), theme.border))

  const answer = await readLine("\nEnter number (default: 0.7): ")

  if (answer.toLowerCase() === "q") {
    return 0.7
  }

  if (!answer.trim()) {
    return 0.7
  }

  const index = parseInt(answer, 10) - 1
  if (isNaN(index) || index < 0 || index >= TEMPERATURE_OPTIONS.length) {
    console.log(color("\n❌ Invalid selection, using default (0.7)", theme.warningText))
    return 0.7
  }

  return TEMPERATURE_OPTIONS[index].value
}

// 完整的选择流程
export async function selectModelFull(): Promise<ModelSelection | null> {
  console.log(color("\n" + "=".repeat(62), theme.header))
  console.log(color(PIPE, theme.header) + color(" Model Selection".padEnd(60) + PIPE, theme.header))
  console.log(color("=".repeat(62), theme.header))

  // 1. 选择 Provider
  console.log(color("\n[Step 1/4] Choose Provider", theme.statusBarHighlight))
  const provider = await selectProvider()
  if (!provider) {
    console.log(color("\n❌ Model selection cancelled", theme.warningText))
    return null
  }
  console.log(color("✓ Selected: " + provider.name, theme.successText))

  // 2. 选择 Model
  console.log(color("\n[Step 2/4] Choose Model", theme.statusBarHighlight))
  const model = await selectModel(provider)
  if (!model) {
    console.log(color("\n❌ Model selection cancelled", theme.warningText))
    return null
  }
  console.log(color("✓ Selected: " + model.name, theme.successText))

  // 3. 选择 Max Tokens
  console.log(color("\n[Step 3/4] Choose Max Output Tokens", theme.statusBarHighlight))
  const maxTokens = await selectMaxTokens(model.maxOutputTokens)
  console.log(color("✓ Selected: " + maxTokens + " tokens", theme.successText))

  // 4. 选择 Temperature
  console.log(color("\n[Step 4/4] Choose Temperature", theme.statusBarHighlight))
  const temperature = await selectTemperature()
  console.log(color("✓ Selected: " + temperature, theme.successText))

  // 5. 选择迭代次数
  console.log(color("\n[Bonus] Choose Iteration Count", theme.statusBarHighlight))
  const iterations = await selectIterations()
  console.log(color("✓ Selected: " + iterations + " iterations", theme.successText))

  // 汇总
  console.log(color("\n" + boxLineMidEnd().replace(/[├┤]/g, "─").replace(/^\s*/, ""), theme.border))
  console.log(color(PIPE, theme.border) + color(" Model Selection Summary".padEnd(60) + PIPE, theme.assistantPrefix))
  console.log(color(boxLineMidEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Provider: " + provider.name.padEnd(60 - 12) + PIPE, theme.statusBar))
  console.log(color(PIPE, theme.border) + color(" Model: " + model.name.padEnd(60 - 10) + PIPE, theme.statusBarHighlight))
  console.log(color(PIPE, theme.border) + color(" Model ID: " + model.id.slice(0, 40).padEnd(60 - 12) + PIPE, theme.dim))
  console.log(color(PIPE, theme.border) + color(" Max Tokens: " + maxTokens + "".padEnd(60 - 15) + PIPE, theme.statusBar))
  console.log(color(PIPE, theme.border) + color(" Temperature: " + temperature + "".padEnd(60 - 15) + PIPE, theme.statusBar))
  console.log(color(PIPE, theme.border) + color(" Iterations: " + iterations + "".padEnd(60 - 15) + PIPE, theme.statusBar))
  console.log(color(boxLineEnd(""), theme.border))

  return {
    providerId: provider.id,
    modelId: model.id,
    maxTokens,
    temperature,
  }
}

// 快速选择（只选模型，使用默认配置）
export async function selectModelQuick(): Promise<ModelSelection | null> {
  console.log(color("\n" + boxLineStartEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Quick Model Selection".padEnd(60) + PIPE, theme.assistantPrefix))
  console.log(color(boxLineMidEnd(), theme.border))

  const available = getAvailableProviders()
  const all = PROVIDER_CONFIGS

  // 只显示可用的 Provider
  for (let i = 0; i < all.length; i++) {
    const p = all[i]
    const isAvailable = available.some((a) => a.id === p.id)
    const status = isAvailable ? color("●", theme.successText) : color("○", theme.dim)
    const key = color("[" + (i + 1) + "]", theme.statusBarHighlight)

    if (isAvailable) {
      const line = " " + key + " " + status + " " + p.name.padEnd(15) + (p.description?.slice(0, 30) || "")
      console.log(color(PIPE, theme.border) + color(line.padEnd(60) + PIPE, theme.statusBar))
    }
  }

  console.log(color(PIPE, theme.border) + color(" [q] Quit".padEnd(60) + PIPE, theme.dim))
  console.log(color(boxLineEnd(""), theme.border))

  const answer = await readLine("\nEnter number (default: 1 for Anthropic): ")

  if (answer.toLowerCase() === "q") {
    return null
  }

  const index = parseInt(answer || "1", 10) - 1
  if (isNaN(index) || index < 0 || index >= all.length) {
    console.log(color("\n❌ Invalid selection", theme.errorText))
    return selectModelQuick()
  }

  const selected = all[index]

  if (!available.some((a) => a.id === selected.id)) {
    console.log(color("\n⚠️  " + selected.name + " requires " + selected.apiKeyEnvVar, theme.warningText))
    return selectModelQuick()
  }

  // 直接使用默认模型
  const defaultModelId = selected.defaultModel || selected.models[0]?.id

  return {
    providerId: selected.id,
    modelId: defaultModelId,
    maxTokens: selected.models[0]?.maxOutputTokens || 8192,
    temperature: 0.7,
  }
}

// 显示当前配置
export function showCurrentModel(
  providerId: string,
  modelId: string,
  maxTokens?: number,
  temperature?: number
): void {
  const provider = getProvider(providerId)
  const model = provider?.models.find((m) => m.id === modelId)

  console.log(color("\n" + boxLineStartEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Current Model Configuration".padEnd(60) + PIPE, theme.assistantPrefix))
  console.log(color(boxLineMidEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Provider: " + (provider?.name || providerId).padEnd(60 - 12) + PIPE, theme.statusBar))
  console.log(color(PIPE, theme.border) + color(" Model: " + (model?.name || modelId).padEnd(60 - 10) + PIPE, theme.statusBarHighlight))
  if (maxTokens) {
    console.log(color(PIPE, theme.border) + color(" Max Tokens: " + maxTokens + "".padEnd(60 - 15) + PIPE, theme.statusBar))
  }
  if (temperature !== undefined) {
    console.log(color(PIPE, theme.border) + color(" Temperature: " + temperature + "".padEnd(60 - 15) + PIPE, theme.statusBar))
  }
  console.log(color(boxLineEnd(""), theme.border))
}

// 列出所有可用模型
export function listModels(): void {
  const available = getAvailableProviders()

  console.log(color("\n" + boxLineStartEnd(), theme.border))
  console.log(color(PIPE, theme.border) + color(" Available Models".padEnd(60) + PIPE, theme.assistantPrefix))
  console.log(color(boxLineMidEnd(), theme.border))

  for (const provider of available) {
    console.log(color(PIPE, theme.border) + color(" " + color("●", theme.successText) + " " + provider.name.padEnd(60 - 4) + PIPE, theme.statusBarHighlight))

    for (const model of provider.models.slice(0, 3)) {
      const deprecated = model.deprecated ? color(" [d]", theme.warningText) : ""
      const line = "   " + model.name + "".padEnd(30) + deprecated
      console.log(color(PIPE, theme.border) + color(line.padEnd(60) + PIPE, theme.statusBar))
    }

    if (provider.models.length > 3) {
      console.log(color(PIPE, theme.border) + color("   ... and " + (provider.models.length - 3) + " more".padEnd(60) + PIPE, theme.dim))
    }
  }

  console.log(color(PIPE, theme.border) + color(" ○ = Not configured (missing API key)".padEnd(60) + PIPE, theme.dim))
  console.log(color(boxLineEnd(""), theme.border))
}
