"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, BadgeCheck, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { Badge } from "@actbyme/ui";
import {
  CinematicSection,
  FeaturedActorRail,
  VIDEO_PLACEHOLDER_IMAGE,
  VideoGrid,
} from "../../components/cinematic/video-platform";
import { useActorsList } from "../../lib/api/hooks";
import type { ActorListItem, ActorVideo } from "../../lib/api/types";
import {
  filterActors,
  getFilterOptions,
  MOCK_ACTORS,
  searchActors,
  sortActors,
  type ActorFilters,
  type MockActor,
  type MotionGroup,
  type SortOption,
} from "../../lib/mock-actors";

const FILTERS: Array<{
  key: keyof ActorFilters;
  label: string;
  placeholder: string;
  optionsKey: keyof ReturnType<typeof getFilterOptions>;
}> = [
  { key: "language", label: "Language", placeholder: "Any language", optionsKey: "languages" },
  { key: "accent", label: "Accent", placeholder: "Any accent", optionsKey: "accents" },
  { key: "country", label: "Country", placeholder: "Any country", optionsKey: "countries" },
  {
    key: "actingStyle",
    label: "Acting style",
    placeholder: "Any style",
    optionsKey: "actingStyles",
  },
  {
    key: "motionSkill",
    label: "Motion skills",
    placeholder: "Any motion skill",
    optionsKey: "motionSkills",
  },
  {
    key: "voiceSkill",
    label: "Voice skills",
    placeholder: "Any voice skill",
    optionsKey: "voiceSkills",
  },
  { key: "dance", label: "Dance", placeholder: "Any dance", optionsKey: "dance" },
  {
    key: "martialArt",
    label: "Martial arts",
    placeholder: "Any martial art",
    optionsKey: "martialArts",
  },
  { key: "singing", label: "Singing", placeholder: "Any singing", optionsKey: "singing" },
  { key: "stunt", label: "Stunts", placeholder: "Any stunt", optionsKey: "stunts" },
  {
    key: "availability",
    label: "Availability",
    placeholder: "Any availability",
    optionsKey: "availability",
  },
];

const sortLabels: Record<SortOption, string> = {
  featured: "Featured",
  score: "Highest score",
  newest: "Newest",
};

export default function ActorsPage() {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [filters, setFilters] = useState<ActorFilters>({});
  const { data: liveActors, error, isLoading } = useActorsList({ sort: sortBy, limit: 100 });
  const options = useMemo(() => getFilterOptions(), []);

  const actorSource = useMemo(() => {
    const apiActors = (liveActors?.data ?? []).map(mapApiActorToDiscoveryActor);
    return mergeActors(apiActors, MOCK_ACTORS);
  }, [liveActors]);

  const actors = useMemo(() => {
    const searched = searchActors(actorSource, query);
    const filtered = filterActors(searched, filters);
    return sortActors(filtered, sortBy);
  }, [actorSource, filters, query, sortBy]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function updateFilter(key: keyof ActorFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#09090B] text-[#F9FAFB]">
      <section className="relative min-h-[68vh] border-b border-[#1F2937] px-5 py-12 md:px-8 md:py-16">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.22),transparent_34%),radial-gradient(circle_at_78%_20%,rgba(20,184,166,0.16),transparent_28%),linear-gradient(180deg,rgba(17,24,39,0.68),rgba(9,9,11,1))]" />
        <img
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-24"
          src={actors[0]?.heroImage ?? VIDEO_PLACEHOLDER_IMAGE}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#09090B_0%,rgba(9,9,11,0.74)_48%,rgba(9,9,11,0.35)),linear-gradient(180deg,rgba(9,9,11,0.12),#09090B)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid min-h-[52vh] gap-8 lg:grid-cols-[1fr_0.42fr] lg:items-end">
            <div>
              <Badge className="mb-5 border-[#6366F1]/50 bg-[#6366F1]/10 text-[#C7D2FE]">
                Video-first discovery
              </Badge>
              <h1 className="max-w-4xl text-5xl font-semibold leading-none tracking-normal md:text-7xl xl:text-8xl">
                Find human performers for AI video.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#9CA3AF] md:text-lg">
                Search cinematic profiles across acting, voice, dance, martial arts, stunts,
                accents, motion capture, and action-scene capability.
              </p>
            </div>
            <div className="rounded-lg border border-[#1F2937] bg-[#111827]/80 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#9CA3AF]">Act AI score range</span>
                <Sparkles className="size-5 text-[#14B8A6]" />
              </div>
              <div className="mt-5 text-5xl font-semibold">86-94</div>
              <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
                Placeholder score for discovery ranking. Real scoring is not implemented yet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              className="h-14 w-full rounded-md border border-[#1F2937] bg-[#111827] pl-12 pr-4 text-base text-[#F9FAFB] outline-none transition focus:border-[#6366F1]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, skill, accent, style, or country"
              type="search"
              value={query}
            />
          </label>
          <label className="relative block">
            <ArrowUpDown className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
            <select
              className="h-14 w-full appearance-none rounded-md border border-[#1F2937] bg-[#111827] pl-11 pr-4 text-sm text-[#F9FAFB] outline-none transition focus:border-[#6366F1]"
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              value={sortBy}
            >
              {Object.entries(sortLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-lg border border-[#1F2937] bg-[#111827]/72 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="size-4 text-[#6366F1]" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="rounded-md bg-[#6366F1]/20 px-2 py-1 text-xs text-[#C7D2FE]">
                  {activeFilterCount} active
                </span>
              ) : null}
            </div>
            <button
              className="text-sm text-[#9CA3AF] transition hover:text-[#F9FAFB]"
              onClick={() => setFilters({})}
              type="button"
            >
              Clear filters
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {FILTERS.map((filter) => (
              <label className="block" key={filter.key}>
                <span className="mb-2 block text-xs font-medium uppercase text-[#9CA3AF]">
                  {filter.label}
                </span>
                <select
                  className="h-11 w-full rounded-md border border-[#1F2937] bg-[#09090B] px-3 text-sm text-[#F9FAFB] outline-none transition focus:border-[#6366F1]"
                  onChange={(event) => updateFilter(filter.key, event.target.value)}
                  value={filters[filter.key] ?? ""}
                >
                  <option value="">{filter.placeholder}</option>
                  {options[filter.optionsKey].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#9CA3AF]">
            Showing <span className="font-semibold text-[#F9FAFB]">{actors.length}</span> profile
            {actors.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <BadgeCheck className="size-4 text-[#14B8A6]" />
            Demo badges mark sample profiles. Actor profiles come from the database.
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Live actor API is unavailable right now, so the page is showing demo profiles only.
          </div>
        ) : null}

        {isLoading ? (
          <div className="mt-5 text-sm text-[#9CA3AF]">
            Loading actor profiles from the database...
          </div>
        ) : null}

        {actors.length > 0 ? (
          <div className="mt-8 space-y-10">
            <FeaturedActorRail actors={actors.slice(0, 8)} title="Featured actors" />
            <FeaturedActorRail
              actors={actors.filter((actor) => actor.motionSkills.length > 0).slice(0, 8)}
              title="Motion performers"
            />
            <FeaturedActorRail
              actors={actors.filter((actor) => actor.voiceSkills.length > 0).slice(0, 8)}
              title="Voice and accents"
            />
            <FeaturedActorRail
              actors={actors
                .filter((actor) =>
                  [...actor.topSkills, ...actor.stunts, ...actor.martialArts].some((skill) =>
                    /stunt|martial|fight|action|combat/i.test(skill),
                  ),
                )
                .slice(0, 8)}
              title="Action and stunts"
            />
            <FeaturedActorRail
              actors={actors.filter((actor) => actor.languages.length > 1).slice(0, 8)}
              title="Multilingual talent"
            />
          </div>
        ) : null}
      </section>

      <CinematicSection
        eyebrow="All Profiles"
        intro="Demo profiles are visibly labelled. Real actor profiles come from the database."
        title="Visual discovery feed"
      >
        {actors.length > 0 ? (
          <VideoGrid actors={actors} />
        ) : (
          <div className="mt-8 rounded-lg border border-[#1F2937] bg-[#111827] p-10 text-center">
            <p className="text-lg font-semibold">No matching profiles</p>
            <p className="mt-2 text-sm text-[#9CA3AF]">
              Try a broader search or clear one of the filters.
            </p>
          </div>
        )}
      </CinematicSection>
    </main>
  );
}

function mergeActors(primaryActors: MockActor[], fallbackActors: MockActor[]) {
  const actorsBySlug = new Map<string, MockActor>();

  for (const actor of fallbackActors) {
    actorsBySlug.set(actor.slug, actor);
  }

  for (const actor of primaryActors) {
    actorsBySlug.set(actor.slug, actor);
  }

  return Array.from(actorsBySlug.values());
}

function mapApiActorToDiscoveryActor(actor: ActorListItem): MockActor {
  const languages = actor.languages.map((language) => language.language).filter(Boolean);
  const accents = actor.accents.map((accent) => accent.accent ?? accent.name ?? "").filter(Boolean);
  const topSkills = actor.skills
    .map((skill) => skill.label ?? titleCase(skill.category))
    .filter(Boolean)
    .slice(0, 8);
  const firstVideoThumbnail = actor.videos?.find((video) => video.thumbnailUrl)?.thumbnailUrl;
  const videoImage = firstVideoThumbnail || VIDEO_PLACEHOLDER_IMAGE;
  const profileImage = actor.profileImageUrl || videoImage;

  return {
    accents,
    actingStyles: topSkills.length > 0 ? topSkills.slice(0, 3) : ["AI-ready performance"],
    aiTransformation: {
      originalImage: videoImage,
      originalLabel: "Original actor motion",
      resultImage: VIDEO_PLACEHOLDER_IMAGE,
      resultLabel: "AI character result",
    },
    availability: statusLabel(actor.status),
    bio: actor.bio || "Actor profile created on ActByMe.",
    country: actor.country || "Country TBA",
    dance: skillsMatching(topSkills, ["dance", "movement"]),
    headline: actor.bio || "Actor profile with public media and skills stored in ActByMe.",
    heroImage: profileImage,
    heroVideoUrl: actor.heroVideoUrl,
    id: actor.id,
    isDemo: actor.isDemo,
    isFeatured: actor.status === "APPROVED" && !actor.isDemo,
    joinedAt: actor.createdAt ?? actor.status,
    languages,
    location: [actor.city, actor.country].filter(Boolean).join(", ") || "Location TBA",
    martialArts: skillsMatching(topSkills, ["martial", "combat", "fight"]),
    motionSkills: buildMotionGroups(topSkills),
    name: actor.stageName,
    profileImage,
    score: actor.actAiScore ?? 0,
    singing: skillsMatching(topSkills, ["singing", "voice"]),
    slug: actor.slug,
    stunts: skillsMatching(topSkills, ["stunt", "action", "fall"]),
    topSkills: topSkills.length > 0 ? topSkills : ["Public actor profile"],
    videoThumbnail: videoImage,
    videos:
      actor.videos && actor.videos.length > 0
        ? actor.videos.map((video) => mapVideoAsset(video))
        : [],
    voiceSkills: accents.length > 0 ? accents : skillsMatching(topSkills, ["voice", "accent"]),
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
      description: "Motion and performance skills stored on this actor profile.",
      items: skills.length > 0 ? skills : ["Performance sample"],
    },
  ];
}

function skillsMatching(skills: string[], terms: string[]) {
  return skills.filter((skill) =>
    terms.some((term) => skill.toLowerCase().includes(term.toLowerCase())),
  );
}

function statusLabel(status: string) {
  if (status === "APPROVED") return "Available now";
  if (status === "PENDING_REVIEW") return "Profile pending review";
  if (status === "DRAFT") return "Draft actor profile";
  return titleCase(status);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
