"use client";

import Link from "next/link";
import { ArrowRight, Play, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Button, Card, DemoProfileBadge } from "@actbyme/ui";
import type { MockActor } from "../../lib/mock-actors";

export const VIDEO_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1400&auto=format&fit=crop";
export const PRESENTATION_VIDEO_SRC = "/videos/actbyme-presentation-720.mp4";
export const PRESENTATION_VIDEO_POSTER_SRC = "/videos/actbyme-presentation-poster.jpg";

export function CinematicSection({
  children,
  eyebrow,
  intro,
  title,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  intro?: string;
  title: string;
}) {
  return (
    <section className="border-t border-[#1F2937] px-5 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 max-w-3xl">
          {eyebrow ? (
            <Badge className="mb-4 border-[#6366F1]/40 bg-[#6366F1]/12 text-[#C7D2FE]">
              {eyebrow}
            </Badge>
          ) : null}
          <h2 className="text-4xl font-semibold leading-none tracking-normal md:text-6xl">
            {title}
          </h2>
          {intro ? (
            <p className="mt-4 text-base leading-7 text-[#9CA3AF] md:text-lg">{intro}</p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function VideoHero({ actors, onPreview }: { actors: MockActor[]; onPreview?: () => void }) {
  const heroActors = actors.slice(0, 5);
  const previewActors = heroActors.slice(0, 3);

  return (
    <section className="relative min-h-[calc(100vh-73px)] overflow-hidden border-b border-[#1F2937] bg-[#09090B] px-5 py-10 text-[#F9FAFB] md:px-8">
      <video
        aria-hidden
        autoPlay
        className="absolute inset-0 h-full w-full object-cover opacity-72"
        loop
        playsInline
        poster={PRESENTATION_VIDEO_POSTER_SRC}
        preload="metadata"
      >
        <source src={PRESENTATION_VIDEO_SRC} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#09090B_0%,rgba(9,9,11,0.9)_38%,rgba(9,9,11,0.56)_68%,rgba(9,9,11,0.28)),linear-gradient(180deg,rgba(9,9,11,0.16),#09090B_94%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(99,102,241,0.28),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(20,184,166,0.18),transparent_24%)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-153px)] max-w-7xl items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="max-w-4xl">
          <Badge className="mb-5 border-[#14B8A6]/40 bg-[#14B8A6]/12 text-[#A7F3D0]">
            Human performance for AI video
          </Badge>
          <h1 className="max-w-5xl text-5xl font-semibold leading-none tracking-normal md:text-7xl xl:text-8xl">
            Real human performance for AI-generated video
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#D1D5DB]">
            Actors showcase acting, voice, motion, action, accents, singing, and dance skills so AI
            video creators can source expressive human reference with consent.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Join as actor
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signup">Request creator access</Link>
            </Button>
            {onPreview ? (
              <Button onClick={onPreview} size="lg" variant="ghost">
                <Play className="size-4" />
                Watch demo
              </Button>
            ) : null}
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3 border-y border-white/10 py-4">
            {[
              ["Video-first", "profiles"],
              ["Consent", "built in"],
              ["Motion", "ready"],
            ].map(([value, label]) => (
              <div key={value}>
                <p className="text-sm font-semibold text-white">{value}</p>
                <p className="mt-1 text-xs uppercase text-[#9CA3AF]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-lg border border-white/12 bg-[#111827]/70 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="relative aspect-[16/10] overflow-hidden">
              <video
                aria-label="ActByMe presentation video"
                autoPlay
                className="h-full w-full object-cover"
                loop
                playsInline
                poster={PRESENTATION_VIDEO_POSTER_SRC}
                preload="metadata"
              >
                <source src={PRESENTATION_VIDEO_SRC} type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-black/74 via-transparent to-black/18" />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <span className="rounded-md border border-white/15 bg-black/54 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                  Platform preview
                </span>
                <span className="rounded-md border border-[#14B8A6]/40 bg-[#14B8A6]/16 px-3 py-1.5 text-xs font-semibold text-[#A7F3D0] backdrop-blur">
                  Looping demo
                </span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold">Cinematic actor discovery</p>
                  <p className="mt-1 text-sm text-[#D1D5DB]">
                    Acting, motion, voice, action and consent in one visual profile.
                  </p>
                </div>
                {onPreview ? (
                  <button
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-[#09090B] transition hover:scale-105"
                    onClick={onPreview}
                    type="button"
                  >
                    <Play className="ml-0.5 size-5" fill="currentColor" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-px bg-white/10 sm:grid-cols-3">
              {previewActors.map((actor) => (
                <Link
                  className="group bg-[#09090B]/86 p-4 transition hover:bg-[#111827]"
                  href={`/actors/${actor.slug}`}
                  key={actor.id}
                >
                  <p className="text-sm font-semibold text-white">{actor.name}</p>
                  <p className="mt-1 truncate text-xs text-[#9CA3AF]">
                    {actor.topSkills.slice(0, 2).join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {previewActors.map((actor) => (
              <Link
                className="group relative overflow-hidden rounded-lg border border-white/10 bg-[#111827] shadow-xl shadow-black/20"
                href={`/actors/${actor.slug}`}
                key={actor.id}
              >
                <img
                  alt={`${actor.name} performance preview`}
                  className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-105"
                  src={actor.videoThumbnail || VIDEO_PLACEHOLDER_IMAGE}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/86 via-black/20 to-transparent" />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  {actor.isDemo ? <DemoProfileBadge /> : null}
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <span className="mb-2 inline-flex size-8 items-center justify-center rounded-full bg-[#6366F1] text-white">
                    <Play className="ml-0.5 size-4" fill="currentColor" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{actor.name}</p>
                    <p className="mt-1 text-xs text-[#D1D5DB]">{actor.country}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ActorVideoCard({ actor, large = false }: { actor: MockActor; large?: boolean }) {
  return (
    <Link
      className="group block min-w-[280px] overflow-hidden rounded-lg border border-[#1F2937] bg-[#111827] transition duration-300 hover:-translate-y-1 hover:border-[#6366F1]/70 hover:shadow-2xl hover:shadow-[#6366F1]/10 md:min-w-[360px]"
      href={`/actors/${actor.slug}`}
    >
      <div className="relative overflow-hidden">
        <img
          alt={`${actor.name} video card`}
          className={`w-full object-cover transition duration-700 group-hover:scale-105 ${
            large ? "aspect-[16/10]" : "aspect-[4/3]"
          }`}
          src={actor.videoThumbnail || VIDEO_PLACEHOLDER_IMAGE}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {actor.isDemo ? <DemoProfileBadge /> : null}
          {actor.isFeatured ? (
            <span className="rounded-md border border-[#14B8A6]/40 bg-[#14B8A6]/16 px-2 py-1 text-xs font-semibold text-[#A7F3D0]">
              Featured
            </span>
          ) : null}
        </div>
        <span className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/14 text-white backdrop-blur">
          <Play className="ml-0.5 size-5" fill="currentColor" />
        </span>
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-2xl font-semibold leading-tight">{actor.name}</h3>
          <p className="mt-1 text-sm text-[#D1D5DB]">
            {actor.country} · {actor.languages.slice(0, 2).join(", ")}
          </p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <p className="line-clamp-2 text-sm leading-6 text-[#9CA3AF]">{actor.headline}</p>
        <div className="flex flex-wrap gap-2">
          {actor.topSkills.slice(0, 3).map((skill) => (
            <SkillPill key={skill}>{skill}</SkillPill>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function FeaturedActorRail({ actors, title }: { actors: MockActor[]; title: string }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-2xl font-semibold">{title}</h3>
        <Button asChild size="sm" variant="ghost">
          <Link href="/actors">
            View all
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="flex snap-x gap-4 overflow-x-auto pb-4 [scrollbar-width:none]">
        {actors.map((actor, index) => (
          <div className="snap-start" key={`${title}-${actor.id}`}>
            <ActorVideoCard actor={actor} large={index === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkillPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[#1F2937] bg-[#09090B]/80 px-3 py-1.5 text-xs font-medium text-[#D1D5DB]">
      <Sparkles className="size-3 text-[#6366F1]" />
      {children}
    </span>
  );
}

export function VideoGrid({ actors }: { actors: MockActor[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {actors.map((actor, index) => (
        <ActorVideoCard actor={actor} key={actor.id} large={index % 5 === 0} />
      ))}
    </div>
  );
}

export function TrustSecurityPanel() {
  const items = [
    "Consent before usage",
    "Identity protection",
    "Private media controls",
    "No commercial use without approval",
  ];

  return (
    <Card className="border-[#14B8A6]/30 bg-[linear-gradient(135deg,rgba(20,184,166,0.12),rgba(17,24,39,0.96))] p-6 md:p-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-7 text-[#14B8A6]" />
        <h3 className="text-3xl font-semibold">Consent-first by design</h3>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[#D1D5DB]">
        ActByMe is built around actor control. Public discovery helps creators find talent, but
        private media, likeness, voice, and paid usage require actor approval and separate terms.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {items.map((item) => (
          <span
            className="inline-flex items-center gap-2 rounded-md border border-[#1F2937] bg-[#09090B] px-3 py-3 text-sm text-[#D1D5DB]"
            key={item}
          >
            <ShieldCheck className="size-4 text-[#14B8A6]" />
            {item}
          </span>
        ))}
      </div>
    </Card>
  );
}
