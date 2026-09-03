import type { PerformanceTake } from "@/lib/api/types";

export type WorkflowStep =
  | "company"
  | "project"
  | "review"
  | "director"
  | "brief"
  | "source"
  | "progress"
  | "qa";

export type CompanyDraft = {
  name: string;
  website: string;
  type: string;
  contactName: string;
  contactRole: string;
};

export type StructuredLocation = {
  label: string;
  provider: "remote" | "manual" | "google";
  isRemote: boolean;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
};

export type ProjectDraft = {
  title: string;
  type: string;
  objective: string;
  location: StructuredLocation;
  targetAiTool: string;
  language: string;
  notes: string;
};

export type SceneDraft = {
  id: string;
  title: string;
  duration: string;
  reference: string;
  dialogue: string;
  direction: string;
  bodyPosition: string;
  eyeline: string;
  gestures: string;
  framing: string;
  captureRequirements: string;
  take?: PerformanceTake;
};

export type BriefDraft = {
  globalDirection: string;
  talentRequirements: {
    performerProfile: string;
    apparentAge: string;
    genderPresentation: string;
    language: string;
    accent: string;
    wardrobe: string;
    notes: string;
  };
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
  qaCriteria: string[];
};

export const WORKFLOW_STEPS: Array<{ id: WorkflowStep; label: string }> = [
  { id: "company", label: "Company" },
  { id: "project", label: "Project" },
  { id: "review", label: "Review" },
  { id: "director", label: "AI Director" },
  { id: "brief", label: "Brief" },
  { id: "source", label: "Source" },
  { id: "progress", label: "Uploads" },
  { id: "qa", label: "QA" },
];

export function createEmptyCompanyDraft(): CompanyDraft {
  return {
    name: "",
    website: "",
    type: "",
    contactName: "",
    contactRole: "",
  };
}

export function createEmptyProjectDraft(): ProjectDraft {
  return {
    title: "",
    type: "",
    objective: "",
    location: {
      label: "Remote",
      provider: "remote",
      isRemote: true,
      placeId: null,
      latitude: null,
      longitude: null,
      countryCode: null,
    },
    targetAiTool: "",
    language: "",
    notes: "",
  };
}
