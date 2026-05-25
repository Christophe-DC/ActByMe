import { SkillCategory } from "./enums.js";

export const ACTBYME_BRAND = {
  name: "ActByMe",
  tagline: "Actor-first profiles for AI-powered video production",
} as const;

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  [SkillCategory.Acting]: "Acting",
  [SkillCategory.Voice]: "Voice",
  [SkillCategory.Singing]: "Singing",
  [SkillCategory.Dance]: "Dance",
  [SkillCategory.MartialArts]: "Martial arts",
  [SkillCategory.Stunts]: "Stunts",
  [SkillCategory.Sports]: "Sports",
  [SkillCategory.Comedy]: "Comedy",
  [SkillCategory.Drama]: "Drama",
  [SkillCategory.UgcAds]: "UGC ads",
  [SkillCategory.Corporate]: "Corporate",
  [SkillCategory.BodyMovement]: "Body movement",
  [SkillCategory.EmotionalPerformance]: "Emotional performance",
} as const;

export const ACTOR_SKILL_LABELS = SKILL_CATEGORY_LABELS;
