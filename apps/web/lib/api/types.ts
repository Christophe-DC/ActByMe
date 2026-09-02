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

export interface EarlyAccessSignupRequest {
  email: string;
  source?: string;
}

export interface EarlyAccessSignupResponse {
  createdAt: string;
  email: string;
  id: string;
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

export type PerformancePath = "MATCHED_ACTOR" | "INVITED_ACTOR" | "SELF_UPLOAD";

export type PerformanceTakeUploadStatus = "UPLOADING" | "UPLOADED" | "FAILED";

export type PerformanceTakeStatus = "DRAFT" | "SUBMITTED";

export interface PerformanceTake {
  contentType: string;
  createdAt: string;
  id: string;
  originalFileName: string;
  projectId: string;
  readUrl?: string;
  sceneId: string;
  sizeBytes: number;
  storageBucket: string;
  storagePath: string;
  takeStatus: PerformanceTakeStatus;
  updatedAt: string;
  uploadAttemptId: string;
  uploadError: string | null;
  uploadedAt: string | null;
  uploadStatus: PerformanceTakeUploadStatus;
}

export interface PerformanceTakeUploadReservation {
  take: PerformanceTake;
  upload: {
    bucket: string;
    path: string;
    token: string;
    uploadUrl: string;
  };
}

export type PerformanceWorkflowStatus =
  | "DRAFT"
  | "READY_FOR_BRIEF"
  | "GENERATING_BRIEF"
  | "BRIEF_REVIEW"
  | "COMPANY_DETAILS"
  | "PROJECT_DETAILS"
  | "SETUP_REVIEW"
  | "BRIEF_PROCESSING"
  | "BRIEF_READY"
  | "PERFORMANCE_SOURCE"
  | "ACTOR_SELECTION"
  | "REQUEST_SUMMARY"
  | "PERFORMANCE_PROGRESS"
  | "QA_PENDING"
  | "CLIENT_REVIEW"
  | "APPROVED_DELIVERY";

export interface PerformanceLocation {
  label: string;
  provider: "remote" | "manual" | "google";
  isRemote: boolean;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
}

export interface PerformanceProjectSaveRequest {
  brief?: {
    globalDirection: string;
    capturePlan: {
      location: string;
      camera: string;
      framing: string;
      lighting: string;
      audio: string;
      background: string;
      continuity: string;
      fileFormat: string;
    };
    talentRequirements: {
      performerProfile: string;
      apparentAge: string;
      genderPresentation: string;
      language: string;
      accent: string;
      wardrobe: string;
      notes: string;
    };
    qaCriteria: string[];
  };
  company: {
    contactName: string;
    contactRole: string;
    name: string;
    type: string;
    website: string;
  };
  performerPath: PerformancePath | null;
  project: {
    language: string;
    location: PerformanceLocation;
    notes: string;
    objective: string;
    targetAiTool: string;
    title: string;
    type: string;
    uploadFile: string;
  };
  scenes: Array<{
    bodyPosition: string;
    dialogue: string;
    direction: string;
    duration: string;
    eyeline: string;
    framing: string;
    gestures: string;
    captureRequirements: string;
    id?: string;
    reference: string;
    title: string;
  }>;
  currentStep: string;
  workflowStatus: PerformanceWorkflowStatus;
}

export interface PerformanceProjectResponse {
  brief: {
    globalDirection: string;
    capturePlan: {
      location: string;
      camera: string;
      framing: string;
      lighting: string;
      audio: string;
      background: string;
      continuity: string;
      fileFormat: string;
    };
    talentRequirements: {
      performerProfile: string;
      apparentAge: string;
      genderPresentation: string;
      language: string;
      accent: string;
      wardrobe: string;
      notes: string;
    };
    qaCriteria: string[];
    model: string;
    openaiResponseId: string | null;
    generatedAt: string;
  } | null;
  companyName: string;
  companyWebsite: string | null;
  contactName: string | null;
  contactRole: string | null;
  createdAt: string;
  id: string;
  currentStep: string;
  language: string | null;
  location: string | null;
  locationData: PerformanceLocation | null;
  notes: string | null;
  objective: string | null;
  organizationType: string | null;
  ownerId: string;
  performerPath: PerformancePath | null;
  scenes: Array<{
    bodyPosition: string | null;
    dialogue: string | null;
    direction: string | null;
    duration: string | null;
    eyeline: string | null;
    framing: string | null;
    gestures: string | null;
    captureRequirements: string | null;
    id: string;
    position: number;
    referenceUrl: string | null;
    take: PerformanceTake | null;
    title: string;
  }>;
  sourceFileName: string | null;
  targetAiTool: string | null;
  title: string;
  type: string;
  updatedAt: string;
  workflowStatus: PerformanceWorkflowStatus;
}
