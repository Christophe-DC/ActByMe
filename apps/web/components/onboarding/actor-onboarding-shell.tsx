"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Clapperboard,
  FileVideo,
  Globe2,
  ImagePlus,
  LockKeyhole,
  Mic2,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserRound,
  WandSparkles,
  Zap,
} from "lucide-react";
import { Badge, Button, Card } from "@actbyme/ui";
import { actorsApi, storageApi } from "@/lib/api/client";
import {
  accentOptions,
  actingStyleOptions,
  consentItems,
  experienceLevels,
  languageOptions,
  onboardingSteps,
  skillCategories,
  type OnboardingStep,
  videoSlots,
} from "./onboarding-data";
import { useActorOnboarding } from "./use-actor-onboarding";

const stepCopy: Record<
  OnboardingStep,
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  basic: {
    eyebrow: "Step 1",
    title: "Start with the essentials.",
    description: "Create the foundation for your actor page with the details agencies need first.",
  },
  profile: {
    eyebrow: "Step 2",
    title: "Shape your public profile.",
    description:
      "Tell producers who you are, what kind of work fits you, and how your presence should feel.",
  },
  skills: {
    eyebrow: "Step 3",
    title: "Map your performance range.",
    description:
      "Choose the categories you want to be discovered for across acting, voice, motion, and branded content.",
  },
  videos: {
    eyebrow: "Step 4",
    title: "Prepare your reel placeholders.",
    description: "Upload intro, acting, motion, and voice samples to your actor media library.",
  },
  consent: {
    eyebrow: "Step 5",
    title: "Set clear permission boundaries.",
    description:
      "Keep the language simple: public display is separate from future paid work and separate legal terms.",
  },
  complete: {
    eyebrow: "Complete",
    title: "Your actor page is ready to preview.",
    description:
      "Your media and profile draft can now be saved to the API for review before publication.",
  },
};

const nextRoute: Record<OnboardingStep, string> = {
  basic: "/onboarding/actor/profile",
  profile: "/onboarding/actor/skills",
  skills: "/onboarding/actor/videos",
  videos: "/onboarding/actor/consent",
  consent: "/onboarding/actor/complete",
  complete: "/actors",
};

const previousRoute: Record<OnboardingStep, string> = {
  basic: "/join",
  profile: "/onboarding/actor",
  skills: "/onboarding/actor/profile",
  videos: "/onboarding/actor/skills",
  consent: "/onboarding/actor/videos",
  complete: "/onboarding/actor/consent",
};

export function ActorOnboardingShell({ step }: { step: OnboardingStep }) {
  const router = useRouter();
  const { draft, toggleArrayValue, updateConsent, updateDraft, updateVideo } = useActorOnboarding();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const currentIndex = onboardingSteps.findIndex((item) => item.id === step);
  const progress = Math.max(((currentIndex + 1) / onboardingSteps.length) * 100, 12);

  return (
    <main className="min-h-screen overflow-hidden bg-[#09090B] text-[#F9FAFB]">
      <section className="relative border-b border-[#1F2937] px-5 py-8 md:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(20,184,166,0.14),transparent_26%),linear-gradient(180deg,rgba(17,24,39,0.86),rgba(9,9,11,1))]" />
        <div className="relative mx-auto max-w-7xl">
          <nav className="flex items-center justify-between">
            <Link className="flex items-center gap-3" href="/">
              <span className="flex size-10 items-center justify-center rounded-md bg-[#6366F1]">
                <Clapperboard className="size-5" />
              </span>
              <span className="text-lg font-semibold">ActByMe</span>
            </Link>
            <Button asChild size="sm" variant="outline">
              <Link href="/actors">Preview actors</Link>
            </Button>
          </nav>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
            <div>
              <Badge className="border-[#6366F1]/50 bg-[#6366F1]/10 text-[#C7D2FE]">
                {stepCopy[step].eyebrow}
              </Badge>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-none tracking-normal md:text-7xl">
                {stepCopy[step].title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#9CA3AF] md:text-lg">
                {stepCopy[step].description}
              </p>
            </div>

            <Card className="p-5">
              <div className="flex items-center justify-between text-sm text-[#9CA3AF]">
                <span>Onboarding progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#09090B]">
                <div
                  className="h-full rounded-full bg-[#6366F1]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {onboardingSteps.map((item, index) => (
                  <Link
                    className={`rounded-md border px-2 py-2 text-center text-xs transition ${
                      index <= currentIndex
                        ? "border-[#6366F1]/60 bg-[#6366F1]/14 text-[#C7D2FE]"
                        : "border-[#1F2937] bg-[#09090B] text-[#9CA3AF]"
                    }`}
                    href={item.href}
                    key={item.id}
                  >
                    {item.shortLabel}
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:px-8 lg:grid-cols-[1fr_360px]">
        <Card className="p-5 md:p-7">{renderStep()}</Card>
        <aside className="space-y-5">
          <DraftPreview
            accents={draft.accents}
            city={draft.city}
            country={draft.country}
            languages={draft.languages}
            skills={draft.skills}
            stageName={draft.stageName}
          />
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="size-5 text-[#14B8A6]" />
              <h2 className="font-semibold">Premium profile promise</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
              The public actor page will stay focused on craft, consent, range, and shareability. No
              booking or payment is active in this onboarding draft.
            </p>
          </Card>
        </aside>
      </section>
    </main>
  );

  function renderStep() {
    if (step === "basic") {
      return (
        <StepLayout icon={<UserRound className="size-6" />} title="Basic info">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="Stage name"
              onChange={(value) => updateDraft({ stageName: value })}
              placeholder="Maya Laurent"
              value={draft.stageName}
            />
            <TextField
              label="Email"
              onChange={(value) => updateDraft({ email: value })}
              placeholder="you@example.com"
              type="email"
              value={draft.email}
            />
            <TextField
              label="Country"
              onChange={(value) => updateDraft({ country: value })}
              placeholder="France"
              value={draft.country}
            />
            <TextField
              label="City"
              onChange={(value) => updateDraft({ city: value })}
              placeholder="Paris"
              value={draft.city}
            />
          </div>
          <OptionGrid
            label="Languages"
            onToggle={(value) => toggleArrayValue("languages", value)}
            options={languageOptions}
            selected={draft.languages}
          />
          <OptionGrid
            label="Accents"
            onToggle={(value) => toggleArrayValue("accents", value)}
            options={accentOptions}
            selected={draft.accents}
          />
          <StepActions step={step} />
        </StepLayout>
      );
    }

    if (step === "profile") {
      return (
        <StepLayout icon={<Camera className="size-6" />} title="Actor profile">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#D1D5DB]">Bio</span>
            <textarea
              className="min-h-36 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-4 py-3 text-sm leading-6 text-[#F9FAFB] outline-none transition placeholder:text-[#6B7280] focus:border-[#6366F1]"
              onChange={(event) => updateDraft({ bio: event.target.value })}
              placeholder="Describe your screen energy, performance range, training, and what producers should know."
              value={draft.bio}
            />
          </label>
          <OptionGrid
            label="Acting styles"
            onToggle={(value) => toggleArrayValue("actingStyles", value)}
            options={actingStyleOptions}
            selected={draft.actingStyles}
          />
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#D1D5DB]">Experience level</span>
            <select
              className="h-12 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-4 text-sm text-[#F9FAFB] outline-none transition focus:border-[#6366F1]"
              onChange={(event) => updateDraft({ experienceLevel: event.target.value })}
              value={draft.experienceLevel}
            >
              <option value="">Select experience level</option>
              {experienceLevels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-dashed border-[#374151] bg-[#09090B] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-md bg-[#6366F1]/16 text-[#C7D2FE]">
                  <ImagePlus className="size-6" />
                </span>
                <div>
                  <h3 className="font-semibold">Profile photo placeholder</h3>
                  <p className="text-sm text-[#9CA3AF]">
                    Upload a public profile image to the actor-public bucket.
                  </p>
                </div>
              </div>
              <input
                accept="image/*"
                className="max-w-full text-sm text-[#9CA3AF] file:mr-4 file:rounded-md file:border-0 file:bg-[#6366F1] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                disabled={uploadingId === "profile-photo"}
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    void uploadProfilePhoto(file);
                  }
                }}
                type="file"
              />
            </div>
            {draft.profilePhotoName ? (
              <p className="mt-3 text-sm text-[#C7D2FE]">
                {uploadingId === "profile-photo" ? "Uploading..." : draft.profilePhotoName}
              </p>
            ) : null}
            {draft.profilePhotoUrl ? (
              <p className="mt-2 break-all text-xs text-[#9CA3AF]">{draft.profilePhotoUrl}</p>
            ) : null}
          </div>
          <UploadErrorMessage message={uploadError} />
          <StepActions step={step} />
        </StepLayout>
      );
    }

    if (step === "skills") {
      return (
        <StepLayout icon={<WandSparkles className="size-6" />} title="Skills">
          <OptionGrid
            label="Select every category that fits your actor profile"
            onToggle={(value) => toggleArrayValue("skills", value)}
            options={skillCategories}
            selected={draft.skills}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <MiniMetric
              icon={<Mic2 className="size-4" />}
              label="Voice"
              value="accents, narration"
            />
            <MiniMetric icon={<Zap className="size-4" />} label="Motion" value="dance, action" />
            <MiniMetric icon={<Star className="size-4" />} label="Screen" value="acting range" />
          </div>
          <StepActions step={step} />
        </StepLayout>
      );
    }

    if (step === "videos") {
      return (
        <StepLayout icon={<FileVideo className="size-6" />} title="Video uploads placeholder">
          <div className="rounded-lg border border-[#14B8A6]/30 bg-[#0F172A] p-4 text-sm leading-6 text-[#D1D5DB]">
            Uploads are stored in Supabase Storage under <strong>actor-public</strong> for public
            actor profile media. Private review and delivery buckets are reserved for later
            production flows.
          </div>
          <div className="grid gap-4">
            {videoSlots.map((slot) => (
              <div className="rounded-lg border border-[#1F2937] bg-[#09090B] p-5" key={slot.id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 items-center justify-center rounded-md bg-[#6366F1]/16 text-[#C7D2FE]">
                      <Upload className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{slot.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#9CA3AF]">{slot.description}</p>
                    </div>
                  </div>
                  <input
                    accept="video/*,audio/*"
                    className="max-w-full text-sm text-[#9CA3AF] file:mr-4 file:rounded-md file:border-0 file:bg-[#111827] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#F9FAFB]"
                    disabled={uploadingId === slot.id}
                    onChange={(event) => {
                      const file = event.target.files?.[0];

                      if (file) {
                        void uploadVideo(slot.id, file);
                      }
                    }}
                    type="file"
                  />
                </div>
                {draft.videos[slot.id] ? (
                  <p className="mt-3 text-sm text-[#C7D2FE]">
                    {uploadingId === slot.id ? "Uploading..." : draft.videos[slot.id]}
                  </p>
                ) : null}
                {draft.videoUrls[slot.id] ? (
                  <p className="mt-2 break-all text-xs text-[#9CA3AF]">
                    {draft.videoUrls[slot.id]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <UploadErrorMessage message={uploadError} />
          <StepActions step={step} />
        </StepLayout>
      );
    }

    if (step === "consent") {
      return (
        <StepLayout icon={<ShieldCheck className="size-6" />} title="Consent">
          <div className="rounded-lg border border-[#14B8A6]/30 bg-[#0F172A] p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-1 size-5 shrink-0 text-[#14B8A6]" />
              <p className="text-sm leading-7 text-[#D1D5DB]">
                These permissions are intentionally simple for the MVP. This is not legal advice,
                and final legal terms will be added later before any paid work or production usage.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {consentItems.map((item) => (
              <label
                className="flex gap-3 rounded-lg border border-[#1F2937] bg-[#09090B] p-4 text-sm leading-6 text-[#D1D5DB]"
                key={item.id}
              >
                <input
                  checked={Boolean(draft.consent[item.id])}
                  className="mt-1 size-4 accent-[#6366F1]"
                  onChange={(event) => updateConsent(item.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          <UploadErrorMessage message={submitError} />
          <StepActions step={step} />
        </StepLayout>
      );
    }

    return (
      <StepLayout
        icon={<BadgeCheck className="size-6" />}
        title="Your actor page is ready to preview."
      >
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-[#1F2937] bg-[#09090B] p-5">
            <div className="flex items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-md bg-[#6366F1]/16 text-2xl font-semibold text-[#C7D2FE]">
                {(draft.stageName || "A").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-[#9CA3AF]">Actor draft</p>
                <h2 className="text-2xl font-semibold">{draft.stageName || "Your stage name"}</h2>
                <p className="mt-1 text-sm text-[#9CA3AF]">
                  {[draft.city, draft.country].filter(Boolean).join(", ") || "Location pending"}
                </p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-[#D1D5DB]">
              {draft.bio ||
                "Your bio will appear here once you write it. Keep it direct, confident, and specific to your performance range."}
            </p>
          </div>
          <div className="grid gap-3">
            <SummaryRow label="Languages" values={draft.languages} />
            <SummaryRow label="Accents" values={draft.accents} />
            <SummaryRow label="Styles" values={draft.actingStyles} />
            <SummaryRow label="Skills" values={draft.skills} />
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/actors/maya-laurent">
              Preview sample actor page
              <ChevronRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/actors">Open discovery</Link>
          </Button>
        </div>
      </StepLayout>
    );
  }

  function StepActions({ step: currentStep }: { step: OnboardingStep }) {
    const isFinalStep = currentStep === "consent";

    return (
      <div className="flex flex-col-reverse gap-3 border-t border-[#1F2937] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="ghost">
          <Link href={previousRoute[currentStep]}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <Button
          disabled={isSubmittingProfile}
          onClick={() => {
            if (isFinalStep) {
              void submitActorProfile();
              return;
            }

            router.push(nextRoute[currentStep]);
          }}
          size="lg"
        >
          {isSubmittingProfile ? "Saving..." : isFinalStep ? "Finish onboarding" : "Continue"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  async function submitActorProfile() {
    setSubmitError("");
    setIsSubmittingProfile(true);

    try {
      await actorsApi.createProfile({
        bio: draft.bio || undefined,
        city: draft.city || undefined,
        country: draft.country || undefined,
        heroVideoUrl: firstUploadedVideoUrl(draft.videoUrls),
        profileImageUrl: draft.profilePhotoUrl || undefined,
        stageName: draft.stageName || "Untitled actor",
      });

      if (draft.languages.length > 0) {
        await actorsApi.addLanguages(
          draft.languages.map((language) => ({
            language,
            proficiency: "Listed",
          })),
        );
      }

      if (draft.accents.length > 0) {
        await actorsApi.addAccents(draft.accents);
      }

      if (draft.skills.length > 0) {
        await actorsApi.addSkills(
          draft.skills.map((skill) => ({
            category: skillToCategory(skill),
            label: skill,
          })),
        );
      }

      for (const slot of videoSlots) {
        const videoUrl = draft.videoUrls[slot.id];

        if (!videoUrl) {
          continue;
        }

        await actorsApi.addVideo({
          description: slot.description,
          skillCategory: videoSlotSkillCategory(slot.id),
          sortOrder: videoSlots.findIndex((item) => item.id === slot.id),
          title: slot.label,
          type: videoSlotType(slot.id),
          videoUrl,
          visibility: "PUBLIC",
        });
      }

      await actorsApi.acceptConsent({
        futurePaidWorkRequiresSeparateApproval: Boolean(draft.consent.separateTerms),
        marketingUsageConsent: Boolean(draft.consent.platformPromotion),
        ownsUploadedContentConfirmation: Boolean(draft.consent.uploadRights),
        publicProfileConsent: Boolean(draft.consent.publicProfile),
      });

      router.push(nextRoute.consent);
    } catch (error) {
      setSubmitError(getUploadErrorMessage(error));
    } finally {
      setIsSubmittingProfile(false);
    }
  }

  async function uploadProfilePhoto(file: File) {
    setUploadError("");
    setUploadingId("profile-photo");
    updateDraft({ profilePhotoName: file.name });

    try {
      const upload = await storageApi.uploadFile(file, "actor-profile-image");
      updateDraft({
        profilePhotoName: file.name,
        profilePhotoUrl: upload.assetUrl,
      });
    } catch (error) {
      setUploadError(getUploadErrorMessage(error));
    } finally {
      setUploadingId(null);
    }
  }

  async function uploadVideo(slotId: string, file: File) {
    setUploadError("");
    setUploadingId(slotId);
    updateVideo(slotId, file.name);

    try {
      const upload = await storageApi.uploadFile(file, "actor-video");
      updateVideo(slotId, file.name, upload.assetUrl);
    } catch (error) {
      setUploadError(getUploadErrorMessage(error));
    } finally {
      setUploadingId(null);
    }
  }
}

function firstUploadedVideoUrl(videoUrls: Record<string, string>) {
  return Object.values(videoUrls).find(Boolean);
}

function skillToCategory(skill: string) {
  const map: Record<string, string> = {
    Acting: "ACTING",
    "Body movement": "BODY_MOVEMENT",
    Comedy: "COMEDY",
    Corporate: "CORPORATE",
    Dancing: "DANCE",
    Drama: "DRAMA",
    "Emotional performance": "EMOTIONAL_PERFORMANCE",
    "Martial arts": "MARTIAL_ARTS",
    Singing: "SINGING",
    Sports: "SPORTS",
    Stunts: "STUNTS",
    "UGC ads": "UGC_ADS",
    Voice: "VOICE",
  };

  return map[skill] ?? "ACTING";
}

function videoSlotType(slotId: string) {
  const map: Record<string, string> = {
    acting: "ACTING_TEST",
    intro: "INTRO",
    motion: "MOTION_TEST",
    voice: "VOICE_SAMPLE",
  };

  return map[slotId] ?? "PORTFOLIO";
}

function videoSlotSkillCategory(slotId: string) {
  const map: Record<string, string> = {
    acting: "ACTING",
    intro: "ACTING",
    motion: "BODY_MOVEMENT",
    voice: "VOICE",
  };

  return map[slotId] ?? "ACTING";
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Upload failed. Sign in again and retry.";
}

function UploadErrorMessage({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
      {message}
    </div>
  );
}

function StepLayout({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-md bg-[#6366F1]/16 text-[#C7D2FE]">
          {icon}
        </span>
        <h2 className="text-2xl font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function TextField({
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#D1D5DB]">{label}</span>
      <input
        className="h-12 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-4 text-sm text-[#F9FAFB] outline-none transition placeholder:text-[#6B7280] focus:border-[#6366F1]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function OptionGrid({
  label,
  onToggle,
  options,
  selected,
}: {
  label: string;
  onToggle: (value: string) => void;
  options: string[];
  selected: string[];
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-[#D1D5DB]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option);

          return (
            <button
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                isSelected
                  ? "border-[#6366F1] bg-[#6366F1]/18 text-[#F9FAFB]"
                  : "border-[#1F2937] bg-[#09090B] text-[#9CA3AF] hover:border-[#6366F1]/60 hover:text-[#F9FAFB]"
              }`}
              key={option}
              onClick={() => onToggle(option)}
              type="button"
            >
              {isSelected ? <Check className="size-4 text-[#14B8A6]" /> : null}
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DraftPreview({
  accents,
  city,
  country,
  languages,
  skills,
  stageName,
}: {
  accents: string[];
  city: string;
  country: string;
  languages: string[];
  skills: string[];
  stageName: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-[linear-gradient(135deg,rgba(99,102,241,0.28),rgba(20,184,166,0.14)),url('https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center p-5">
        <div className="flex min-h-56 flex-col justify-end">
          <Badge className="w-fit border-[#14B8A6]/40 bg-black/40 text-[#A7F3D0]">
            Draft preview
          </Badge>
          <h2 className="mt-4 text-3xl font-semibold">{stageName || "Your stage name"}</h2>
          <p className="mt-2 text-sm text-[#D1D5DB]">
            {[city, country].filter(Boolean).join(", ") || "City, country"}
          </p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <PreviewLine icon={<Globe2 className="size-4" />} label="Languages" values={languages} />
        <PreviewLine icon={<Mic2 className="size-4" />} label="Accents" values={accents} />
        <PreviewLine icon={<Sparkles className="size-4" />} label="Skills" values={skills} />
      </div>
    </Card>
  );
}

function PreviewLine({
  icon,
  label,
  values,
}: {
  icon: React.ReactNode;
  label: string;
  values: string[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#D1D5DB]">
        <span className="text-[#14B8A6]">{icon}</span>
        {label}
      </div>
      <p className="text-sm leading-6 text-[#9CA3AF]">
        {values.length > 0 ? values.join(", ") : "Not selected yet"}
      </p>
    </div>
  );
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#1F2937] bg-[#09090B] p-4">
      <div className="flex items-center gap-2 text-[#C7D2FE]">
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-sm text-[#9CA3AF]">{value}</p>
    </div>
  );
}

function SummaryRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg border border-[#1F2937] bg-[#09090B] p-4">
      <p className="text-sm font-medium text-[#D1D5DB]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
        {values.length > 0 ? values.join(", ") : "Not selected yet"}
      </p>
    </div>
  );
}
