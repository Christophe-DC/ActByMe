import {
  ListActorsQuery,
  ListActorsResponse,
  ActorDetail,
  AgencyAccessRequest,
  AgencyAccessResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is not set");
}

class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any,
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      // Mock user header for development (will be replaced with real auth)
      "X-User-Id": process.env.NEXT_PUBLIC_MOCK_USER_ID || "dev-user",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      response.status,
      errorData.message || `API error: ${response.statusText}`,
      errorData,
    );
  }

  return response.json();
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
};

export { APIError };
