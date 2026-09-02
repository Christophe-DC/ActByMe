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
  PerformanceProjectResponse,
  PerformanceProjectSaveRequest,
  PerformanceTake,
  PerformanceTakeUploadReservation,
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

const LOCAL_API_URL = "http://localhost:4000";
const PRODUCTION_API_URL = "https://api.actbyme.com";

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const API_URL = resolveApiUrl();
  const url = `${API_URL}${endpoint}`;
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(options?.headers);

  headers.set("Content-Type", "application/json");

  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new Error(
      error instanceof TypeError
        ? `Unable to reach the ActByMe API at ${API_URL}.`
        : "Unable to reach the ActByMe API.",
      { cause: error },
    );
  }

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message = Array.isArray(errorData.message)
      ? errorData.message.join(", ")
      : errorData.message || `API error: ${response.statusText}`;
    throw new APIError(response.status, message, errorData);
  }

  return response.json();
}

function resolveApiUrl() {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window === "undefined") {
    return configuredApiUrl || LOCAL_API_URL;
  }

  const isLocalPage = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const configuredApiUrlIsLocal =
    !configuredApiUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredApiUrl);

  if (!isLocalPage && configuredApiUrlIsLocal) {
    return PRODUCTION_API_URL;
  }

  return configuredApiUrl || LOCAL_API_URL;
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

export const performanceProjectsApi = {
  getCurrent: async (): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>("/performance-projects/current"),

  create: async (request: PerformanceProjectSaveRequest): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>("/performance-projects", {
      body: JSON.stringify(request),
      method: "POST",
    }),

  update: async (
    id: string,
    request: PerformanceProjectSaveRequest,
  ): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}`, {
      body: JSON.stringify(request),
      method: "PATCH",
    }),

  generateBrief: async (id: string): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}/generate-brief`, {
      method: "POST",
    }),
};

export const performanceTakesApi = {
  createUpload: async (
    projectId: string,
    sceneId: string,
    request: { contentType: "video/mp4" | "video/quicktime"; fileName: string; sizeBytes: number },
  ): Promise<PerformanceTakeUploadReservation> =>
    apiFetch<PerformanceTakeUploadReservation>(
      `/performance-projects/${projectId}/scenes/${sceneId}/take/upload-url`,
      {
        body: JSON.stringify(request),
        method: "POST",
      },
    ),

  uploadFile: async (
    upload: PerformanceTakeUploadReservation["upload"],
    file: File,
    contentType: "video/mp4" | "video/quicktime",
    onProgress: (progress: number) => void,
  ): Promise<void> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uploadFile =
      file.type === contentType
        ? file
        : new File([file], file.name, { lastModified: file.lastModified, type: contentType });

    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("cacheControl", "3600");
      formData.append("", uploadFile);

      request.open("PUT", upload.uploadUrl);
      request.setRequestHeader("x-upsert", "false");

      const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (publishableKey) request.setRequestHeader("apikey", publishableKey);
      if (session?.access_token) {
        request.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      }

      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      request.addEventListener("load", () => {
        if (request.status >= 200 && request.status < 300) {
          onProgress(100);
          resolve();
          return;
        }
        reject(new Error(`Storage upload failed with status ${request.status}.`));
      });
      request.addEventListener("error", () => reject(new Error("Storage upload failed.")));
      request.addEventListener("abort", () => reject(new Error("Storage upload was cancelled.")));
      request.send(formData);
    });
  },

  completeUpload: async (
    projectId: string,
    sceneId: string,
    takeId: string,
    uploadAttemptId: string,
  ): Promise<PerformanceTake> =>
    apiFetch<PerformanceTake>(
      `/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}/complete`,
      {
        body: JSON.stringify({ uploadAttemptId }),
        method: "POST",
      },
    ),

  failUpload: async (
    projectId: string,
    sceneId: string,
    takeId: string,
    uploadAttemptId: string,
    message: string,
  ): Promise<PerformanceTake> =>
    apiFetch<PerformanceTake>(
      `/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}/fail`,
      {
        body: JSON.stringify({ message, uploadAttemptId }),
        method: "POST",
      },
    ),

  getReadUrl: async (
    projectId: string,
    sceneId: string,
    takeId: string,
  ): Promise<{ expiresInSeconds: number; readUrl: string }> =>
    apiFetch(`/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}/read-url`),

  delete: async (projectId: string, sceneId: string, takeId: string) =>
    apiFetch<{ deleted: boolean }>(
      `/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}`,
      { method: "DELETE" },
    ),
};

export { APIError };
