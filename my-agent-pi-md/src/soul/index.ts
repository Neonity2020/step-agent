// ============================================================
// SOUL.md - Agent 人格化模块
// ============================================================

export { SoulMDParser } from "./parser"
export {
  ALL_PRESETS,
  PROFESSIONAL_MENTOR,
  CREATIVE_PARTNER,
  EFFICIENCY_EXPERT,
  FRIENDLY_ASSISTANT,
  getPreset,
  listPresets,
  generatePresetSoulMD,
} from "./presets"
export type {
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
  EmotionalResponse,
  PresetPersonality,
} from "./types"
