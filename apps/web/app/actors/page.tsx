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
import {
  filterActors,
  getFilterOptions,
  MOCK_ACTORS,
  searchActors,
  sortActors,
  type ActorFilters,
  type MockActor,
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
  const options = useMemo(() => getFilterOptions(), []);

  const actors = useMemo(() => {
    const searched = searchActors(MOCK_ACTORS, query);
    const filtered = filterActors(searched, filters);
    return sortActors(filtered, sortBy);
  }, [filters, query, sortBy]);

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
                Mock discovery data
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
            Showing <span className="font-semibold text-[#F9FAFB]">{actors.length}</span> demo
            profile{actors.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <BadgeCheck className="size-4 text-[#14B8A6]" />
            Demo badges mark non-registered sample profiles.
          </div>
        </div>

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
