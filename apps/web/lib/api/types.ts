// API Response types matching backend models

export interface ActorSkill {
  id: string;
  category: string;
  label?: string;
  yearsExperience?: number;
}

export interface ActorLanguage {
  id: string;
  language: string;
  proficiency?: string;
}

export interface ActorAccent {
  id: string;
  accent?: string;
  name?: string;
}

export interface ActorVideo {
  id: string;
  title: string;
  description?: string;
  type: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  durationSeconds?: number;
  visibility: string;
  createdAt: string;
}

export interface ActorListItem {
  id: string;
  slug: string;
  stageName: string;
  profileImageUrl?: string;
  heroVideoUrl?: string;
  bio?: string;
  city?: string;
  country?: string;
  actAiScore?: number;
  isDemo: boolean;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  skills: ActorSkill[];
  languages: ActorLanguage[];
  accents: ActorAccent[];
  videos?: ActorVideo[];
}

export interface ActorDetail extends ActorListItem {
  videos: ActorVideo[];
  consent?: {
    id: string;
    agreedToTerms: boolean;
    agreedToDataProcessing: boolean;
  };
}

export interface ListActorsQuery {
  search?: string;
  language?: string;
  accent?: string;
  skill?: string;
  motionSkill?: string;
  sort?: "featured" | "score" | "newest";
  limit?: number;
  offset?: number;
}

export interface ListActorsResponse {
  data: ActorListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AgencyAccessRequest {
  companyName: string;
  country?: string;
  email: string;
  expectedMonthlyVolume?: string;
  interestedSkills: string[];
  message?: string;
  name: string;
  needs: string;
  role?: string;
  website?: string;
}

export interface AgencyAccessResponse {
  id: string;
  status: string;
  createdAt: string;
}

export interface UploadUrlResponse {
  assetUrl: string;
  bucket: string;
  key: string;
  method: "PUT" | "POST";
  path: string;
  token?: string;
  uploadUrl: string;
}

export type UploadNamespace =
  | "actor-profile-image"
  | "actor-video"
  | "actor-private-video"
  | "platform-asset"
  | "actor-delivery";
