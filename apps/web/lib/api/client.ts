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
  PerformanceBriefAttachment,
  PerformanceBriefAttachmentUploadReservation,
  PerformanceBriefContentType,
  PerformanceConsentDraft,
  PerformancePath,
  ActorRecommendation,
  PerformanceRequest,
  Notification,
  CurrentUserProfile,
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
    if (options?.signal?.aborted) throw error;
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

async function uploadToSignedUrl(
  upload: { uploadUrl: string },
  file: File,
  contentType: string,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uploadFile =
    file.type === contentType
      ? file
      : new File([file], file.name, { lastModified: file.lastModified, type: contentType });

  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const stop = () => request.abort();
    signal?.addEventListener("abort", stop, { once: true });
    request.addEventListener("loadend", () => signal?.removeEventListener("abort", stop), {
      once: true,
    });
    request.timeout = 120000;
    request.addEventListener("timeout", () =>
      reject(new Error("The upload exceeded two minutes. Please try again.")),
    );
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
  list: async (): Promise<PerformanceProjectResponse[]> =>
    apiFetch<PerformanceProjectResponse[]>("/performance-projects"),

  getCurrent: async (): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>("/performance-projects/current"),

  get: async (id: string): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}`),

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

  approveBrief: async (id: string): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}/approve-brief`, {
      method: "POST",
    }),

  generateOutputs: async (id: string, force = false): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}/generate-outputs`, {
      body: JSON.stringify({ force }),
      method: "POST",
    }),

  recommendActors: async (id: string): Promise<ActorRecommendation[]> =>
    apiFetch<ActorRecommendation[]>(`/performance-projects/${id}/actor-recommendations`),

  assignActor: async (id: string, actorProfileId: string): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}/assignment`, {
      body: JSON.stringify({ actorProfileId }),
      method: "POST",
    }),

  selectPerformerPath: async (
    id: string,
    performerPath: PerformancePath,
  ): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}/performer-path`, {
      body: JSON.stringify({ performerPath }),
      method: "POST",
    }),

  completeDelivery: async (id: string): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}/complete-delivery`, {
      method: "POST",
    }),

  saveConsent: async (
    id: string,
    consent: PerformanceConsentDraft,
  ): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}/consent`, {
      body: JSON.stringify(consent),
      method: "PATCH",
    }),

  acceptConsent: async (id: string): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(`/performance-projects/${id}/consent/accept`, {
      method: "POST",
    }),
};

export const performanceRequestsApi = {
  list: async (): Promise<PerformanceRequest[]> => apiFetch<PerformanceRequest[]>("/performances"),

  get: async (id: string): Promise<PerformanceRequest> =>
    apiFetch<PerformanceRequest>(`/performances/${id}`),

  accept: async (id: string): Promise<PerformanceRequest> =>
    apiFetch<PerformanceRequest>(`/performances/${id}/accept`, { method: "POST" }),

  submit: async (id: string): Promise<PerformanceRequest> =>
    apiFetch<PerformanceRequest>(`/performances/${id}/submit`, { method: "POST" }),
};

export const notificationsApi = {
  list: async (): Promise<Notification[]> => apiFetch<Notification[]>("/notifications"),

  unreadCount: async (): Promise<{ count: number }> =>
    apiFetch<{ count: number }>("/notifications/unread-count"),

  markRead: async (id: string): Promise<Notification> =>
    apiFetch<Notification>(`/notifications/${id}/read`, { method: "PATCH" }),

  markAllRead: async (): Promise<{ count: number }> =>
    apiFetch<{ count: number }>("/notifications/read-all", { method: "POST" }),
};

export const usersApi = {
  me: async (): Promise<CurrentUserProfile> => apiFetch<CurrentUserProfile>("/users/me"),
};

export const performanceBriefAttachmentsApi = {
  createUpload: async (
    projectId: string,
    request: { contentType: PerformanceBriefContentType; fileName: string; sizeBytes: number },
  ): Promise<PerformanceBriefAttachmentUploadReservation> =>
    apiFetch<PerformanceBriefAttachmentUploadReservation>(
      `/performance-projects/${projectId}/brief-attachment/upload-url`,
      { body: JSON.stringify(request), method: "POST" },
    ),

  uploadFile: uploadToSignedUrl,

  completeUpload: async (
    projectId: string,
    attachmentId: string,
    uploadAttemptId: string,
  ): Promise<PerformanceBriefAttachment> =>
    apiFetch<PerformanceBriefAttachment>(
      `/performance-projects/${projectId}/brief-attachment/${attachmentId}/complete`,
      { body: JSON.stringify({ uploadAttemptId }), method: "POST" },
    ),

  failUpload: async (
    projectId: string,
    attachmentId: string,
    uploadAttemptId: string,
    message: string,
  ): Promise<PerformanceBriefAttachment> =>
    apiFetch<PerformanceBriefAttachment>(
      `/performance-projects/${projectId}/brief-attachment/${attachmentId}/fail`,
      { body: JSON.stringify({ message, uploadAttemptId }), method: "POST" },
    ),

  delete: async (projectId: string, attachmentId: string) =>
    apiFetch<{ deleted: boolean }>(
      `/performance-projects/${projectId}/brief-attachment/${attachmentId}`,
      { method: "DELETE" },
    ),
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
  ): Promise<void> => uploadToSignedUrl(upload, file, contentType, onProgress),

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

  runQa: async (
    projectId: string,
    sceneId: string,
    takeId: string,
  ): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(
      `/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}/qa-runs`,
      { method: "POST" },
    ),

  approve: async (
    projectId: string,
    sceneId: string,
    takeId: string,
  ): Promise<PerformanceProjectResponse> =>
    apiFetch<PerformanceProjectResponse>(
      `/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}/approve`,
      { method: "POST" },
    ),

  getReadUrl: async (
    projectId: string,
    sceneId: string,
    takeId: string,
  ): Promise<{ expiresInSeconds: number; readUrl: string }> =>
    apiFetch(`/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}/read-url`),

  getDeliveryUrls: async (
    projectId: string,
    sceneId: string,
    takeId: string,
  ): Promise<{
    downloadUrl: string;
    expiresInSeconds: number;
    playbackUrl: string;
  }> =>
    apiFetch(`/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}/delivery-urls`),

  delete: async (projectId: string, sceneId: string, takeId: string) =>
    apiFetch<{ deleted: boolean }>(
      `/performance-projects/${projectId}/scenes/${sceneId}/take/${takeId}`,
      { method: "DELETE" },
    ),
};

export { APIError };

export const directorStudioApi = {
  get: (id: string) =>
    apiFetch<import("@actbyme/shared").StudioState>(`/performance-projects/${id}/director-studio`),
  activate: (id: string, version: number, enabled: boolean) =>
    apiFetch<import("@actbyme/shared").StudioState>(
      `/performance-projects/${id}/director-studio/activation`,
      { method: "POST", body: JSON.stringify({ version, enabled }) },
    ),
  generate: (id: string, version: number, instructions: string) =>
    apiFetch<import("@actbyme/shared").StudioState>(
      `/performance-projects/${id}/director-studio/generate`,
      { method: "POST", body: JSON.stringify({ version, instructions }) },
    ),
  save: (
    id: string,
    version: number,
    scene: import("@actbyme/shared").StudioScene,
    instructions: string,
    roleId: string | null,
  ) =>
    apiFetch<import("@actbyme/shared").StudioState>(
      `/performance-projects/${id}/director-studio/revision`,
      { method: "PUT", body: JSON.stringify({ version, scene, instructions, roleId }) },
    ),
  approve: (id: string, version: number, roleId: string) =>
    apiFetch<import("@actbyme/shared").StudioState>(
      `/performance-projects/${id}/director-studio/approve`,
      { method: "POST", body: JSON.stringify({ version, roleId }) },
    ),
};

export type StudioHistory = {
  version: number;
  revisions: { id: string; version: number; label: string; createdAt: string; approved: boolean }[];
  next: number | null;
};
export type StudioShare = {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
  revision: { version: number };
};
export type StudioFeedback = {
  id: string;
  authorName: string;
  body: string;
  time: number;
  target: import("@actbyme/shared").StudioSelection;
  resolved: boolean;
  createdAt: string;
  revision?: { version: number };
};
export const studioWorkspaceApi = {
  create: (input: { title: string; script: string; instructions: string; templateId?: string }) =>
    apiFetch<import("@actbyme/shared").StudioState>("/director-studios", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  list: () =>
    apiFetch<{ id: string; title: string; updatedAt: string; duration: number | null }[]>(
      "/director-studios",
    ),
  draft: (id: string, version: number, instructions: string) =>
    apiFetch<import("@actbyme/shared").StudioState>(
      `/performance-projects/${id}/director-studio/draft`,
      { method: "PATCH", body: JSON.stringify({ version, instructions }) },
    ),
  edit: (
    id: string,
    version: number,
    instructions: string,
    target: import("@actbyme/shared").StudioSelection,
    at?: number,
    destination?: import("@actbyme/shared").StudioVector,
  ) =>
    apiFetch<import("@actbyme/shared").StudioState>(
      `/performance-projects/${id}/director-studio/edit`,
      { method: "POST", body: JSON.stringify({ version, instructions, target, at, destination }) },
    ),
  cancel: (id: string, version: number) =>
    apiFetch<import("@actbyme/shared").StudioState>(
      `/performance-projects/${id}/director-studio/cancel`,
      { method: "POST", body: JSON.stringify({ version }) },
    ),
  feedback: (id: string) =>
    apiFetch<StudioFeedback[]>(`/performance-projects/${id}/director-studio/feedback`),
  resolveFeedback: (id: string, commentId: string, resolved: boolean) =>
    apiFetch(`/performance-projects/${id}/director-studio/feedback/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify({ resolved }),
    }),
  comment: (
    token: string,
    input: {
      authorName: string;
      body: string;
      time: number;
      target: import("@actbyme/shared").StudioSelection;
    },
  ) =>
    apiFetch<StudioFeedback>(`/studio-shares/${encodeURIComponent(token)}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  history: (id: string, before?: number) =>
    apiFetch<StudioHistory>(
      `/performance-projects/${id}/director-studio/history${before ? `?before=${before}` : ""}`,
    ),
  restore: (id: string, version: number, revisionId: string) =>
    apiFetch<import("@actbyme/shared").StudioState>(
      `/performance-projects/${id}/director-studio/restore`,
      { method: "POST", body: JSON.stringify({ version, revisionId }) },
    ),
  share: (id: string, version: number, allowComments = false) =>
    apiFetch<{ id: string; token: string; expiresAt: string }>(
      `/performance-projects/${id}/director-studio/shares`,
      { method: "POST", body: JSON.stringify({ version, allowComments }) },
    ),
  shares: (id: string) =>
    apiFetch<StudioShare[]>(`/performance-projects/${id}/director-studio/shares`),
  revoke: (id: string, shareId: string) =>
    apiFetch(`/performance-projects/${id}/director-studio/shares/${shareId}`, { method: "DELETE" }),
  shared: (token: string) =>
    apiFetch<{
      title: string;
      scene: import("@actbyme/shared").StudioScene;
      roleId: string | null;
      expiresAt: string;
      allowComments: boolean;
      comments: StudioFeedback[];
    }>(`/studio-shares/${encodeURIComponent(token)}`, { cache: "no-store" }),
};

export const virtualDirectorApi = {
  get: (id: string) =>
    apiFetch<import("@actbyme/shared").VirtualDirectorState>(
      `/performance-projects/${id}/virtual-director`,
    ),
  mutate: (id: string, path: string, input?: unknown, method = "POST") =>
    apiFetch<import("@actbyme/shared").VirtualDirectorState>(
      `/performance-projects/${id}/virtual-director/${path}`,
      { method, ...(input !== undefined ? { body: JSON.stringify(input) } : {}) },
    ),
  reserve: (id: string, input: unknown) =>
    apiFetch<{
      referenceId: string;
      upload: { uploadUrl: string; method: string; token?: string };
    }>(`/performance-projects/${id}/virtual-director/references`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  upload: uploadToSignedUrl,
  media: (id: string, kind: "jobs" | "references", assetId: string, download = false) =>
    apiFetch<{ url: string; expiresInSeconds: number }>(
      `/performance-projects/${id}/virtual-director/${kind}/${assetId}/media${download ? "?download=1" : ""}`,
    ),
};

export type DirectorCasting = {
  actors: { id: string; stageName: string; slug: string; city: string | null }[];
  performances: {
    id: string;
    title: string;
    assignment: { actorProfileId: string; status: string } | null;
    takes: { id: string; originalFileName: string }[];
  }[];
};
export type DirectorGrant = {
  id: string;
  actorProfileId: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  terms: string;
};
export type DirectorActorRequest = {
  id: string;
  title: string;
  terms: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  current: boolean;
  plan: ReturnType<typeof import("@actbyme/shared").directorProductionPlan>;
};
// Retry only idempotent reads when a sleeping service or a temporary gateway
// error interrupts the connection. Mutations are never submitted a second time.
async function directorRead<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    const requestSignal = AbortSignal.any([
      AbortSignal.timeout(45000),
      ...(signal ? [signal] : []),
    ]);
    try {
      return await apiFetch<T>(endpoint, { cache: "no-store", signal: requestSignal });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof APIError && ![502, 503, 504].includes(error.status)) throw error;
      if (attempt === 1)
        throw new Error("The studio is not responding right now. Try loading again.", {
          cause: error,
        });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("Unable to connect to the studio.");
}

export const directorApi = {
  list: (signal?: AbortSignal) =>
    directorRead<{ id: string; title: string; version: number; updatedAt: string }[]>(
      "/director-projects",
      signal,
    ),
  create: (title: string, demo: boolean) =>
    apiFetch<import("@actbyme/shared").DirectorState>("/director-projects", {
      method: "POST",
      body: JSON.stringify({ title, demo }),
    }),
  get: (id: string, signal?: AbortSignal) =>
    directorRead<import("@actbyme/shared").DirectorState>(`/director-projects/${id}`, signal),
  save: (id: string, version: number, document: import("@actbyme/shared").DirectorDocument) =>
    apiFetch<import("@actbyme/shared").DirectorState>(`/director-projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ version, document }),
    }),
  mutate: <T = import("@actbyme/shared").DirectorState>(
    id: string,
    path: string,
    input?: unknown,
    method = "POST",
  ) =>
    apiFetch<T>(`/director-projects/${id}/${path}`, {
      method,
      ...(input !== undefined ? { body: JSON.stringify(input) } : {}),
    }),
  read: <T>(id: string, path: string) =>
    apiFetch<T>(`/director-projects/${id}/${path}`, { cache: "no-store" }),
  media: (id: string, assetId: string, download = false) =>
    apiFetch<{ url: string; expiresInSeconds: number }>(
      `/director-projects/${id}/assets/${assetId}/media${download ? "?download=1" : ""}`,
      { cache: "no-store" },
    ),
  reserve: (id: string, input: unknown) =>
    apiFetch<{
      assetId: string;
      upload: { uploadUrl: string; method: "PUT" | "POST"; token?: string };
    }>(`/director-projects/${id}/assets`, { method: "POST", body: JSON.stringify(input) }),
  casting: () => apiFetch<DirectorCasting>("/director-projects/casting", { cache: "no-store" }),
  actorRequests: (signal?: AbortSignal) =>
    directorRead<DirectorActorRequest[]>("/director-projects/actor-requests", signal),
  acceptGrant: (id: string, accept: boolean) =>
    apiFetch<DirectorActorRequest[]>(`/director-projects/actor-requests/${id}`, {
      method: "POST",
      body: JSON.stringify({
        accept,
        commercialUse: true,
        aiTransformation: true,
        providerTransfer: true,
      }),
    }),
  upload: uploadToSignedUrl,
};
