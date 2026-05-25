"use client";

import { ActorProfileExperience } from "../../../components/actor-profile-experience";
import { useActorDetail } from "../../../lib/api/hooks";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, Home } from "lucide-react";
import { Button } from "@actbyme/ui";
import Link from "next/link";

export default function ActorProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: actor, isLoading, error } = useActorDetail(slug);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#09090B]">
        <div className="text-center">
          <Loader2 className="size-8 text-[#6366F1] animate-spin mx-auto mb-4" />
          <p className="text-[#9CA3AF]">Loading actor profile...</p>
        </div>
      </main>
    );
  }

  if (error || !actor) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#09090B] px-6">
        <div className="text-center max-w-md">
          <AlertCircle className="size-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#F9FAFB] mb-2">Actor not found</h1>
          <p className="text-[#9CA3AF] mb-6">
            {error?.message || "We couldn't find the actor profile you're looking for."}
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

  // Convert API response to component format
  const mockActor: any = {
    id: actor.id,
    slug: actor.slug,
    name: actor.stageName,
    headline: "",
    bio: actor.bio || "",
    location: `${actor.city || ""}, ${actor.country || ""}`.trim() || "Location TBA",
    city: actor.city,
    country: actor.country,
    languages: actor.languages.map((l: any) => l.language),
    accents: actor.accents.map((a: any) => a.name),
    skills: actor.skills.map((s: any) => s.category),
    score: actor.actAiScore || 0,
    isDemo: actor.isDemo,
    isFeatured: !actor.isDemo,
    profileImageUrl: actor.profileImageUrl,
    videoThumbnail: actor.heroVideoUrl || "",
    topSkills: actor.skills.slice(0, 4).map((s: any) => s.category),
    videos: actor.videos.map((v: any) => ({
      id: v.id,
      title: v.title,
      description: v.description || "",
      type: v.type,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl || "",
      duration: v.durationSeconds || 0,
      visibility: v.visibility,
      createdAt: v.createdAt,
    })),
  };

  return <ActorProfileExperience actor={mockActor} />;
}
