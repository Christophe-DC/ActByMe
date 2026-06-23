import type {
  ListActorsQuery,
  ListActorsResponse,
  ActorDetail,
  AgencyAccessRequest,
  AgencyAccessResponse,
  EarlyAccessSignupRequest,
  EarlyAccessSignupResponse,
  UploadNamespace,
  UploadUrlResponse,
} from "./types";
import { supabase } from "@/lib/supabase/client";

class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const url = `${API_URL}${endpoint}`;
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(options?.headers);

  headers.set("Content-Type", "application/json");

  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.statusText}`);
  }

  return response.json();
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

export const actorsApi = {
  /**
   * List actors with optional filters and search
   * Only returns APPROVED actors (and demo profiles marked with badge)
   */
  listActors: async (query?: ListActorsQuery): Promise<ListActorsResponse> => {
    const params = new URLSearchParams();
    if (query?.search) params.append("search", query.search);
    if (query?.language) params.append("language", query.language);
    if (query?.accent) params.append("accent", query.accent);
    if (query?.skill) params.append("skill", query.skill);
    if (query?.motionSkill) params.append("motionSkill", query.motionSkill);
    if (query?.sort) params.append("sort", query.sort);
    if (query?.limit) params.append("limit", String(query.limit));
    if (query?.offset) params.append("offset", String(query.offset));

    const qs = params.toString();
    const endpoint = `/actors${qs ? `?${qs}` : ""}`;

    return apiFetch<ListActorsResponse>(endpoint);
  },

  /**
   * Get a single actor by slug
   * Returns full actor profile with videos and skills
   */
  getActor: async (slug: string): Promise<ActorDetail> => {
    return apiFetch<ActorDetail>(`/actors/${slug}`);
  },

  /**
   * Submit agency access request
   */
  requestAgencyAccess: async (request: AgencyAccessRequest): Promise<AgencyAccessResponse> => {
    return apiFetch<AgencyAccessResponse>("/agency-access", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },

  createProfile: async (request: {
    bio?: string;
    city?: string;
    country?: string;
    heroVideoUrl?: string;
    profileImageUrl?: string;
    stageName: string;
  }) =>
    apiFetch("/actors/profile", {
      method: "POST",
      body: JSON.stringify(request),
    }),

  addLanguages: async (languages: Array<{ language: string; proficiency?: string }>) =>
    apiFetch("/actors/profile/languages", {
      method: "POST",
      body: JSON.stringify({ languages }),
    }),

  addAccents: async (accents: string[]) =>
    apiFetch("/actors/profile/accents", {
      method: "POST",
      body: JSON.stringify({ accents }),
    }),

  addSkills: async (
    skills: Array<{ category: string; label?: string; yearsExperience?: number }>,
  ) =>
    apiFetch("/actors/profile/skills", {
      method: "POST",
      body: JSON.stringify({ skills }),
    }),

  addVideo: async (video: {
    description?: string;
    durationSeconds?: number;
    skillCategory?: string;
    sortOrder?: number;
    thumbnailUrl?: string;
    title: string;
    type: string;
    videoUrl: string;
    visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED";
  }) =>
    apiFetch("/actors/profile/videos", {
      method: "POST",
      body: JSON.stringify(video),
    }),

  acceptConsent: async (consent: {
    futurePaidWorkRequiresSeparateApproval: boolean;
    marketingUsageConsent: boolean;
    ownsUploadedContentConfirmation: boolean;
    publicProfileConsent: boolean;
  }) =>
    apiFetch("/actors/profile/consent", {
      method: "POST",
      body: JSON.stringify(consent),
    }),
};

export const earlyAccessApi = {
  signup: async (request: EarlyAccessSignupRequest): Promise<EarlyAccessSignupResponse> => {
    return apiFetch<EarlyAccessSignupResponse>("/early-access", {
      method: "POST",
      body: JSON.stringify(request),
    });
  },
};

export const storageApi = {
  createUploadUrl: async (request: {
    contentType: string;
    fileName: string;
    namespace: UploadNamespace;
  }): Promise<UploadUrlResponse> =>
    apiFetch("/storage/upload-url", {
      method: "POST",
      body: JSON.stringify(request),
    }),

  uploadFile: async (
    file: File,
    namespace: "actor-profile-image" | "actor-video" | "actor-private-video",
  ) => {
    const upload = await storageApi.createUploadUrl({
      contentType: file.type || "application/octet-stream",
      fileName: file.name,
      namespace,
    });

    if (!upload.token) {
      throw new Error("The API did not return a Supabase upload token.");
    }

    const { error } = await supabase.storage
      .from(upload.bucket)
      .uploadToSignedUrl(upload.path, upload.token, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return upload;
  },
};

export { APIError };
