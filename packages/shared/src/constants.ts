import { ActorSkillCategory } from "./enums.js";

export const ACTBYME_BRAND = {
  name: "ActByMe",
  tagline: "Actor-first profiles for AI-powered video production",
} as const;

export const ACTOR_SKILL_LABELS: Record<ActorSkillCategory, string> = {
  [ActorSkillCategory.Acting]: "Acting",
  [ActorSkillCategory.Voice]: "Voice",
  [ActorSkillCategory.Dance]: "Dance",
  [ActorSkillCategory.MartialArts]: "Martial arts",
  [ActorSkillCategory.Stunts]: "Stunts",
  [ActorSkillCategory.Singing]: "Singing",
  [ActorSkillCategory.Accents]: "Accents",
  [ActorSkillCategory.Motion]: "Motion skills",
} as const;
