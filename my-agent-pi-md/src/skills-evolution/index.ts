// ============================================================
// Skills Evolution - 自进化系统
// ============================================================

export { EvolutionManager } from "./manager"
export { WorkflowDetector } from "./detector"
export { SkillGenerator } from "./generator"
export type {
  EvolutionConfig,
  EvolutionStats,
  EvolutionEvent,
  DetectedWorkflow,
  WorkflowStep,
  SkillCandidate,
  SkillVariable,
  GeneratedSkill,
  WorkflowPattern,
} from "./types"

// Re-export ToolCall from detector
export type { ToolCall } from "./detector"
