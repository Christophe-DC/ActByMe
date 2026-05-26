"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  BadgeCheck,
  ChevronRight,
  Clapperboard,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { Badge, Button, Card, DemoProfileBadge } from "@actbyme/ui";
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
      <section className="relative border-b border-[#1F2937] px-5 py-10 md:px-8 md:py-14">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(20,184,166,0.14),transparent_28%),linear-gradient(180deg,rgba(17,24,39,0.88),rgba(9,9,11,1))]" />
        <div className="relative mx-auto max-w-7xl">
          <nav className="mb-10 flex items-center justify-between">
            <Link className="flex items-center gap-3" href="/">
              <span className="flex size-10 items-center justify-center rounded-md bg-[#6366F1]">
                <Clapperboard className="size-5" />
              </span>
              <span className="text-lg font-semibold">ActByMe</span>
            </Link>
            <Button asChild variant="outline" size="sm">
              <Link href="/agency-access">Request agency access</Link>
            </Button>
          </nav>

          <div className="grid gap-8 lg:grid-cols-[1fr_0.42fr] lg:items-end">
            <div>
              <Badge className="mb-5 border-[#6366F1]/50 bg-[#6366F1]/10 text-[#C7D2FE]">
                Live discovery + demo profiles
              </Badge>
              <h1 className="max-w-4xl text-5xl font-semibold leading-none tracking-normal md:text-7xl">
                Discover AI-ready actor profiles.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#9CA3AF] md:text-lg">
                Search cinematic performer profiles across acting, voice, dance, martial arts,
                stunts, accents, motion capture, and action-scene capability.
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
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {actors.map((actor) => (
              <ActorDiscoveryCard actor={actor} key={actor.id} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-[#1F2937] bg-[#111827] p-10 text-center">
            <p className="text-lg font-semibold">No matching profiles</p>
            <p className="mt-2 text-sm text-[#9CA3AF]">
              Try a broader search or clear one of the filters.
            </p>
          </div>
        )}
      </section>
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
  const image =
    firstVideoThumbnail ||
    actor.profileImageUrl ||
    "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1200&auto=format&fit=crop";

  return {
    accents,
    actingStyles: topSkills.length > 0 ? topSkills.slice(0, 3) : ["AI-ready performance"],
    aiTransformation: {
      originalImage: image,
      originalLabel: "Original actor motion",
      resultImage: actor.profileImageUrl || image,
      resultLabel: "AI character result",
    },
    availability: statusLabel(actor.status),
    bio: actor.bio || "Actor profile created on ActByMe.",
    country: actor.country || "Country TBA",
    dance: skillsMatching(topSkills, ["dance", "movement"]),
    headline: actor.bio || "Actor profile with public media and skills stored in ActByMe.",
    heroImage: image,
    id: actor.id,
    isDemo: actor.isDemo,
    isFeatured: actor.status === "APPROVED" && !actor.isDemo,
    joinedAt: actor.createdAt ?? actor.status,
    languages,
    location: [actor.city, actor.country].filter(Boolean).join(", ") || "Location TBA",
    martialArts: skillsMatching(topSkills, ["martial", "combat", "fight"]),
    motionSkills: buildMotionGroups(topSkills),
    name: actor.stageName,
    profileImage: actor.profileImageUrl || image,
    score: actor.actAiScore ?? 0,
    singing: skillsMatching(topSkills, ["singing", "voice"]),
    slug: actor.slug,
    stunts: skillsMatching(topSkills, ["stunt", "action", "fall"]),
    topSkills: topSkills.length > 0 ? topSkills : ["Public actor profile"],
    videoThumbnail: image,
    videos:
      actor.videos && actor.videos.length > 0
        ? actor.videos.map((video) => mapVideoAsset(video, image))
        : [],
    voiceSkills: accents.length > 0 ? accents : skillsMatching(topSkills, ["voice", "accent"]),
  };
}

function mapVideoAsset(video: ActorVideo, fallbackImage: string) {
  return {
    category: titleCase(video.type),
    duration:
      typeof video.durationSeconds === "number"
        ? `${video.durationSeconds}s`
        : typeof video.duration === "number"
          ? `${video.duration}s`
          : "Uploaded sample",
    thumbnail: video.thumbnailUrl || fallbackImage,
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

function ActorDiscoveryCard({ actor }: { actor: MockActor }) {
  return (
    <Card className="group overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:border-[#6366F1]/70 hover:shadow-2xl hover:shadow-[#6366F1]/10">
      <div className="relative aspect-[16/11] overflow-hidden bg-[#111827]">
        <img
          alt={`${actor.name} profile thumbnail`}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          src={actor.videoThumbnail}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/20 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {actor.isDemo ? <DemoProfileBadge /> : null}
          {!actor.isDemo ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#6366F1]/40 bg-[#6366F1]/15 px-2 py-1 text-xs font-semibold text-[#C7D2FE]">
              <BadgeCheck className="size-3" />
              Actor profile
            </span>
          ) : null}
          {actor.isFeatured ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#14B8A6]/40 bg-[#14B8A6]/15 px-2 py-1 text-xs font-semibold text-[#A7F3D0]">
              <Star className="size-3" />
              Featured
            </span>
          ) : null}
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">{actor.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-sm text-[#D1D5DB]">
              <MapPin className="size-4 text-[#14B8A6]" />
              {actor.location}
            </p>
          </div>
          <div className="rounded-md border border-[#6366F1]/40 bg-[#6366F1]/20 px-3 py-2 text-right">
            <p className="text-[10px] uppercase text-[#C7D2FE]">Act AI</p>
            <p className="text-xl font-semibold text-white">{actor.score}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <p className="min-h-12 text-sm leading-6 text-[#9CA3AF]">{actor.headline}</p>
        <div className="flex flex-wrap gap-2">
          {actor.languages.slice(0, 3).map((language) => (
            <Badge className="normal-case" key={language}>
              {language}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {actor.topSkills.slice(0, 4).map((skill) => (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-[#6366F1]/12 px-2 py-1 text-xs text-[#C7D2FE]"
              key={skill}
            >
              <Zap className="size-3" />
              {skill}
            </span>
          ))}
        </div>
        <p className="text-xs uppercase tracking-normal text-[#9CA3AF]">{actor.availability}</p>
        <Button asChild className="w-full" variant="outline">
          <Link href={`/actors/${actor.slug}`}>
            View profile
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
