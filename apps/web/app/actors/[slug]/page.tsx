"use client";

import { ActorProfileExperience } from "../../../components/actor-profile-experience";
import { useActorDetail } from "../../../lib/api/hooks";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, Home } from "lucide-react";
import { Button } from "@actbyme/ui";
import Link from "next/link";
import type { ActorDetail, ActorVideo } from "../../../lib/api/types";
import { MOCK_ACTORS, type MockActor, type MotionGroup } from "../../../lib/mock-actors";

const VIDEO_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200&auto=format&fit=crop";
const AI_TRANSFORMATION_PLACEHOLDER =
  "https://images.unsplash.com/photo-1535223289827-42f1e9919769?q=80&w=1200&auto=format&fit=crop";

export default function ActorProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: actor, isLoading, error } = useActorDetail(slug);
  const fallbackActor = MOCK_ACTORS.find((item) => item.slug === slug);

  if (isLoading && !fallbackActor) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="text-center">
          <Loader2 className="size-8 text-[#6366F1] animate-spin mx-auto mb-4" />
          <p className="text-[#9CA3AF]">Loading actor profile...</p>
        </div>
      </main>
    );
  }

  if (!actor && !fallbackActor) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#09090B] px-6">
        <div className="text-center max-w-md">
          <AlertCircle className="size-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#F9FAFB] mb-2">Actor not found</h1>
          <p className="text-[#9CA3AF] mb-6">
            {error?.message || "We could not find the actor profile you are looking for."}
          </p>
          <Button asChild>
            <Link href="/actors" className="inline-flex items-center gap-2">
              <Home className="size-4" />
              Back to discovery
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const profileActor = actor ? mapApiActor(actor, fallbackActor) : fallbackActor;

  if (!profileActor) {
    return null;
  }

  return <ActorProfileExperience actor={profileActor} />;
}

function mapApiActor(actor: ActorDetail, fallback?: MockActor): MockActor {
  const languages = actor.languages.map((language) => language.language);
  const accents = actor.accents.map((accent) => accent.accent ?? accent.name ?? "").filter(Boolean);
  const topSkills = actor.skills
    .slice(0, 6)
    .map((skill) => skill.label ?? titleCase(skill.category));
  const firstVideoThumbnail = actor.videos.find((video) => video.thumbnailUrl)?.thumbnailUrl;
  const heroImage =
    actor.profileImageUrl ||
    firstVideoThumbnail ||
    fallback?.heroImage ||
    "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1800&auto=format&fit=crop";
  const profileImage =
    actor.profileImageUrl ||
    fallback?.profileImage ||
    "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?q=80&w=900&auto=format&fit=crop";

  return {
    accents,
    actingStyles: fallback?.actingStyles ?? ["Screen performance", "Commercial", "AI reference"],
    aiTransformation: fallback?.aiTransformation ?? {
      originalImage: firstVideoThumbnail || VIDEO_PLACEHOLDER_IMAGE,
      originalLabel: "Original actor motion",
      resultImage: AI_TRANSFORMATION_PLACEHOLDER,
      resultLabel: "AI character result",
    },
    availability: fallback?.availability ?? "Available for access requests",
    bio: actor.bio || fallback?.bio || "Actor profile prepared for AI-ready video discovery.",
    country: actor.country || fallback?.country || "Country TBA",
    dance: fallback?.dance ?? [],
    headline:
      fallback?.headline ??
      "AI-ready actor profile with public media, consent boundaries, and shareable reels.",
    heroImage,
    id: actor.id,
    isDemo: actor.isDemo,
    isFeatured: !actor.isDemo,
    joinedAt: fallback?.joinedAt ?? actor.createdAt ?? actor.status,
    languages,
    location: [actor.city, actor.country].filter(Boolean).join(", ") || "Location TBA",
    martialArts: fallback?.martialArts ?? [],
    motionSkills: fallback?.motionSkills ?? buildMotionGroups(topSkills),
    name: actor.stageName,
    profileImage,
    score: actor.actAiScore ?? fallback?.score ?? 0,
    singing: fallback?.singing ?? [],
    slug: actor.slug,
    stunts: fallback?.stunts ?? [],
    topSkills,
    videoThumbnail: firstVideoThumbnail || fallback?.videoThumbnail || VIDEO_PLACEHOLDER_IMAGE,
    videos:
      actor.videos.length > 0
        ? actor.videos.map((video) => mapVideoAsset(video))
        : (fallback?.videos ?? []),
    voiceSkills: fallback?.voiceSkills ?? accents,
  };
}

function mapVideoAsset(video: ActorVideo) {
  return {
    category: titleCase(video.type),
    duration:
      typeof video.durationSeconds === "number"
        ? `${video.durationSeconds}s`
        : typeof video.duration === "number"
          ? `${video.duration}s`
          : "Uploaded sample",
    thumbnail: video.thumbnailUrl || VIDEO_PLACEHOLDER_IMAGE,
    title: video.title,
  };
}

function buildMotionGroups(skills: string[]): MotionGroup[] {
  return [
    {
      category: "Action scenes",
      description: "Public profile motion and action capabilities.",
      items: skills.length > 0 ? skills : ["Performance sample", "Motion reference"],
    },
  ];
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
