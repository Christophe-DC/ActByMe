import { z } from "zod";
import { ActorSkillCategory } from "./enums.js";

export const actorProfileDraftSchema = z.object({
  displayName: z.string().min(2).max(80),
  email: z.email(),
  headline: z.string().min(8).max(140),
  location: z.string().max(120).optional(),
  bio: z.string().max(1200).optional(),
  skillCategories: z.array(z.enum(ActorSkillCategory)).default([]),
});

export const actorVideoSchema = z.object({
  title: z.string().min(2).max(120),
  category: z.enum(ActorSkillCategory),
  description: z.string().max(400).optional(),
  storageKey: z.string().min(1),
  thumbnailKey: z.string().optional(),
});

export const accessRequestSchema = z.object({
  companyName: z.string().min(2).max(120),
  contactName: z.string().min(2).max(120),
  email: z.email(),
  role: z.string().max(120).optional(),
  useCase: z.string().min(10).max(1200),
});

export type ActorProfileDraft = z.infer<typeof actorProfileDraftSchema>;
export type ActorVideoInput = z.infer<typeof actorVideoSchema>;
export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
