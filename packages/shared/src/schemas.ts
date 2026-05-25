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

// API Response DTOs
export const actorSkillResponseSchema = z.object({
  id: z.string(),
  category: z.enum(SkillCategory),
  label: z.string().nullable(),
  yearsExperience: z.number().nullable(),
});

export const actorLanguageResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  proficiency: z.string().nullable(),
});

export const actorAccentResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const actorVideoResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.enum(VideoType),
  videoUrl: z.string(),
  thumbnailUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  visibility: z.enum(Visibility),
  createdAt: z.string().datetime(),
});

export const actorListItemResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  stageName: z.string(),
  profileImageUrl: z.string().nullable(),
  bio: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  actAiScore: z.number().nullable(),
  isDemo: z.boolean(),
  status: z.enum(ActorProfileStatus),
  skills: z.array(actorSkillResponseSchema),
  languages: z.array(actorLanguageResponseSchema),
  accents: z.array(actorAccentResponseSchema),
});

export const actorDetailResponseSchema = actorListItemResponseSchema.extend({
  heroVideoUrl: z.string().nullable(),
  videos: z.array(actorVideoResponseSchema),
});

export const listActorsResponseSchema = z.object({
  data: z.array(actorListItemResponseSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type ActorSkillResponse = z.infer<typeof actorSkillResponseSchema>;
export type ActorLanguageResponse = z.infer<typeof actorLanguageResponseSchema>;
export type ActorAccentResponse = z.infer<typeof actorAccentResponseSchema>;
export type ActorVideoResponse = z.infer<typeof actorVideoResponseSchema>;
export type ActorListItemResponse = z.infer<typeof actorListItemResponseSchema>;
export type ActorDetailResponse = z.infer<typeof actorDetailResponseSchema>;
export type ListActorsResponse = z.infer<typeof listActorsResponseSchema>;
