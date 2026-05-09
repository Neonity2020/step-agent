// ============================================================
// Skills - Agent Skills 支持
// ============================================================
// 
// 兼容 Claude Code 的 SKILL.md 格式
// ============================================================

export { SkillsManager } from "./manager"
export { SkillsLoader } from "./loader"
export { SkillMatcher, SkillRecommender } from "./matcher"
export { SkillParser } from "./parser"

export type {
  Skill,
  SkillMeta,
  SkillTrigger,
  SkillStep,
  SkillContext,
  SkillMatch,
  SkillOptions,
  SkillListing,
} from "./types"
