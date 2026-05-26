export type OnboardingStep = "basic" | "profile" | "skills" | "videos" | "consent" | "complete";

export type ActorOnboardingDraft = {
  stageName: string;
  email: string;
  country: string;
  city: string;
  languages: string[];
  accents: string[];
  bio: string;
  actingStyles: string[];
  experienceLevel: string;
  profilePhotoName: string;
  profilePhotoUrl: string;
  skills: string[];
  videos: Record<string, string>;
  videoUrls: Record<string, string>;
  consent: Record<string, boolean>;
};

export const defaultOnboardingDraft: ActorOnboardingDraft = {
  stageName: "",
  email: "",
  country: "",
  city: "",
  languages: [],
  accents: [],
  bio: "",
  actingStyles: [],
  experienceLevel: "",
  profilePhotoName: "",
  profilePhotoUrl: "",
  skills: [],
  videos: {
    intro: "",
    acting: "",
    motion: "",
    voice: "",
  },
  videoUrls: {
    intro: "",
    acting: "",
    motion: "",
    voice: "",
  },
  consent: {
    uploadRights: false,
    publicProfile: false,
    platformPromotion: false,
    separateTerms: false,
  },
};

export const onboardingSteps: Array<{
  href: string;
  id: OnboardingStep;
  label: string;
  shortLabel: string;
}> = [
  {
    href: "/onboarding/actor",
    id: "basic",
    label: "Basic info",
    shortLabel: "Info",
  },
  {
    href: "/onboarding/actor/profile",
    id: "profile",
    label: "Actor profile",
    shortLabel: "Profile",
  },
  {
    href: "/onboarding/actor/skills",
    id: "skills",
    label: "Skills",
    shortLabel: "Skills",
  },
  {
    href: "/onboarding/actor/videos",
    id: "videos",
    label: "Videos",
    shortLabel: "Videos",
  },
  {
    href: "/onboarding/actor/consent",
    id: "consent",
    label: "Consent",
    shortLabel: "Consent",
  },
  {
    href: "/onboarding/actor/complete",
    id: "complete",
    label: "Complete",
    shortLabel: "Done",
  },
];

export const languageOptions = [
  "English",
  "French",
  "Spanish",
  "German",
  "Arabic",
  "Mandarin",
  "Japanese",
  "Hindi",
  "Portuguese",
  "Yoruba",
];

export const accentOptions = [
  "General American",
  "British",
  "French",
  "Spanish",
  "German",
  "Arabic",
  "Indian English",
  "Australian",
  "Southern US",
  "Neutral English",
];

export const actingStyleOptions = [
  "Commercial",
  "Cinematic drama",
  "Comedy",
  "Action",
  "Sci-fi",
  "Horror",
  "Luxury brand",
  "UGC",
  "Corporate",
  "Documentary",
];

export const experienceLevels = [
  "New talent",
  "Student / training",
  "Emerging professional",
  "Working actor",
  "Experienced professional",
];

export const skillCategories = [
  "Acting",
  "Voice",
  "Singing",
  "Dancing",
  "Martial arts",
  "Stunts",
  "Sports",
  "Comedy",
  "Drama",
  "UGC ads",
  "Corporate",
  "Body movement",
  "Emotional performance",
];

export const videoSlots = [
  {
    description: "A short hello and presence check for agencies.",
    id: "intro",
    label: "Intro video",
  },
  {
    description: "A simple dramatic or commercial acting sample.",
    id: "acting",
    label: "Acting test video",
  },
  {
    description: "Movement, dance, stunts, sports, or action beats.",
    id: "motion",
    label: "Motion/action video",
  },
  {
    description: "Voice texture, languages, accents, or singing.",
    id: "voice",
    label: "Voice/accent sample",
  },
];

export const consentItems = [
  {
    id: "uploadRights",
    label: "I confirm I own or have the right to upload these videos.",
  },
  {
    id: "publicProfile",
    label: "I allow ActByMe to display my public profile.",
  },
  {
    id: "platformPromotion",
    label: "I allow ActByMe to use selected public profile materials to promote the platform.",
  },
  {
    id: "separateTerms",
    label: "I understand that future paid work will require separate approval and terms.",
  },
];
