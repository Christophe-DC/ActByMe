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
  name: string;
}

export interface ActorVideo {
  id: string;
  title: string;
  description?: string;
  type: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  visibility: string;
  createdAt: string;
}

export interface ActorListItem {
  id: string;
  slug: string;
  stageName: string;
  profileImageUrl?: string;
  bio?: string;
  city?: string;
  country?: string;
  actAiScore?: number;
  isDemo: boolean;
  status: string;
  skills: ActorSkill[];
  languages: ActorLanguage[];
  accents: ActorAccent[];
}

export interface ActorDetail extends ActorListItem {
  heroVideoUrl?: string;
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
  actorProfileId: string;
  agencyName: string;
  message?: string;
}

export interface AgencyAccessResponse {
  id: string;
  status: string;
  createdAt: string;
}
