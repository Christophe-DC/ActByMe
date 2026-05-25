import { z } from "zod";
import {
  AgencyRequestStatus,
  ActorProfileStatus,
  SkillCategory,
  VideoType,
  Visibility,
} from "./enums.js";

export const actorProfileDraftSchema = z.object({
  bio: z.string().max(2000).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
  profileImageUrl: z.url().optional(),
  stageName: z.string().min(2).max(80),
});

export const actorSkillSchema = z.object({
  category: z.enum(SkillCategory),
  label: z.string().max(120).optional(),
  yearsExperience: z.number().int().min(0).max(80).optional(),
});

export const actorVideoSchema = z.object({
  description: z.string().max(600).optional(),
  durationSeconds: z.number().int().positive().optional(),
  skillCategory: z.enum(SkillCategory).optional(),
  thumbnailUrl: z.url().optional(),
  title: z.string().min(2).max(120),
  type: z.enum(VideoType),
  videoUrl: z.string().min(1),
  visibility: z.enum(Visibility).default(Visibility.Public),
});

export const agencyAccessRequestSchema = z.object({
  companyName: z.string().min(2).max(120),
  country: z.string().max(120).optional(),
  email: z.email(),
  expectedMonthlyVolume: z.string().max(80).optional(),
  interestedSkills: z.array(z.string().min(1).max(80)).default([]),
  message: z.string().max(1200).optional(),
  name: z.string().min(2).max(120),
  needs: z.string().min(10).max(2000),
  role: z.string().max(120).optional(),
  status: z.enum(AgencyRequestStatus).default(AgencyRequestStatus.New),
  website: z.url().optional(),
});

export const profileStatusSchema = z.enum(ActorProfileStatus);

export type ActorProfileDraft = z.infer<typeof actorProfileDraftSchema>;
export type ActorSkillInput = z.infer<typeof actorSkillSchema>;
export type ActorVideoInput = z.infer<typeof actorVideoSchema>;
export type AgencyAccessRequestInput = z.infer<typeof agencyAccessRequestSchema>;
