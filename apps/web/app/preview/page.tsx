"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Search,
  Shield,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import {
  PRESENTATION_VIDEO_POSTER_SRC,
  PRESENTATION_VIDEO_SRC,
} from "../components/cinematic/video-platform";
import { earlyAccessApi } from "../lib/api/client";
import { MOCK_ACTORS } from "../lib/mock-actors";

const featuredActors = MOCK_ACTORS.slice(0, 3);

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function joinEarlyAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      await earlyAccessApi.signup({ email, source: "prototype-landing" });
      setStatus("success");
      setMessage("You are on the early access list.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save your email.");
    }
  }

  return (
    <main className="overflow-hidden bg-[#070A12] text-[#e8e8f0]">
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        <div className="pointer-events-none absolute -top-40 left-1/4 size-[500px] rounded-full bg-[#6C4DFF]/10 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-1/3 size-[400px] rounded-full bg-[#66E0C2]/[0.06] blur-[100px]" />

        <div className="relative mx-auto max-w-[1400px] px-5 py-12 md:px-8 lg:px-10 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
            <div className="animate-fade-up">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#66E0C2]/20 bg-[#66E0C2]/[0.06] px-3 py-1.5">
                <Sparkles className="size-3.5 text-[#66E0C2]" />
                <span className="text-xs font-semibold tracking-wide text-[#66E0C2]">
                  Human performance for AI video
                </span>
              </div>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Real human performance for{" "}
                <span className="text-gradient-violet">AI-generated video</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#a3a3b8]">
                Turn a script into precise, AI-ready human performance. ActByMe builds the direction
                and capture plan, helps you choose who performs it, validates every take, and keeps
                consent and rights clear throughout the workflow.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Link
                  className="group rounded-2xl border border-[#6C4DFF]/30 bg-gradient-to-br from-[#6C4DFF]/[0.12] to-[#6C4DFF]/[0.03] p-5 transition hover:border-[#6C4DFF]/50 hover:from-[#6C4DFF]/[0.18]"
                  href="/create-performance"
                >
                  <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#6C4DFF]/20">
                    <UsersRound className="size-5 text-[#a78bfa]" />
                  </span>
                  <span className="block font-semibold text-white">I Need a Performance</span>
                  <span className="mt-1 block text-sm leading-6 text-[#a3a3b8]">
                    Create a persisted, editable Director Brief and upload performance takes.
                  </span>
                  <span className="mt-3 flex items-center gap-1 text-sm font-medium text-[#a78bfa]">
                    Start a performance
                    <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>

                <Link
                  className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20"
                  href="/onboarding/actor"
                >
                  <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-white/5">
                    <UserRound className="size-5 text-[#a3a3b8]" />
                  </span>
                  <span className="block font-semibold text-white">I&apos;m an Actor</span>
                  <span className="mt-1 block text-sm leading-6 text-[#a3a3b8]">
                    Join as a performer and showcase your craft to AI video creators.
                  </span>
                  <span className="mt-3 flex items-center gap-1 text-sm font-medium text-[#a3a3b8]">
                    Explore the actor experience
                    <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/[0.06] pt-6">
                <FeatureStat
                  icon={<Video className="size-4" />}
                  label="Profiles"
                  value="Video-first"
                />
                <FeatureStat
                  icon={<Shield className="size-4" />}
                  label="Built in"
                  value="Consent"
                />
                <FeatureStat icon={<Sparkles className="size-4" />} label="Ready" value="Motion" />
              </div>
            </div>

            <div className="animate-fade-up [animation-delay:100ms]">
              <div className="glow-violet rounded-2xl border border-white/[0.08] bg-[#0F1422]/80 p-2 shadow-2xl">
                <div className="mb-2 flex items-center justify-between px-3 py-1.5">
                  <span className="flex items-center gap-2 text-xs font-medium text-[#a3a3b8]">
                    <span className="size-2 rounded-full bg-[#66E0C2]" /> Platform preview
                  </span>
                  <span className="text-xs text-[#5a5a72]">Performance workflow</span>
                </div>
                <div className="relative overflow-hidden rounded-xl">
                  <video
                    autoPlay
                    className="aspect-video w-full object-cover"
                    loop
                    muted
                    playsInline
                    poster={PRESENTATION_VIDEO_POSTER_SRC}
                    preload="metadata"
                  >
                    <source src={PRESENTATION_VIDEO_SRC} type="video/mp4" />
                  </video>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070A12]/70 via-transparent to-transparent" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {featuredActors.map((actor) => (
                  <Link
                    className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-white/[0.06] bg-[#0F1422]/60"
                    href={`/actors/${actor.slug}`}
                    key={actor.id}
                  >
                    <img
                      alt={actor.name}
                      className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
                      src={actor.profileImage}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 to-transparent p-2.5">
                      <span className="mb-1 inline-flex rounded-full bg-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                        Demo profile
                      </span>
                      <p className="text-xs font-semibold text-white">{actor.name}</p>
                      <p className="truncate text-[10px] text-[#a3a3b8]">{actor.location}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-t border-white/[0.06] bg-[#0A0E1A]/50 px-5 py-16 md:px-8"
        id="how-it-works"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#66E0C2]">
              Creator workspace
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
              From script to <span className="text-gradient-violet">AI-ready performance</span>
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#a3a3b8]">
              A guided workflow that keeps performance direction, consent, QA, and approval in one
              place.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <ValueCard
              icon={<Sparkles className="size-5" />}
              intro="Turn a production brief into editable scene, talent, and capture instructions."
              title="AI Director brief"
            />
            <ValueCard
              icon={<Upload className="size-5" />}
              intro="Performance videos enter the MVP through file upload only — no camera recording."
              title="Upload-only takes"
            />
            <ValueCard
              icon={<CheckCircle2 className="size-5" />}
              intro="Review simulated quality checks, corrections, approval, and delivery state."
              title="QA and approval"
            />
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#6C4DFF] px-5 text-sm font-semibold text-white shadow-lg shadow-[#6C4DFF]/25 hover:bg-[#7a5eff]"
              href="/create-performance"
            >
              Create Performance <ArrowRight className="size-4" />
            </Link>
            <Link
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 px-5 text-sm font-semibold text-[#a3a3b8] hover:border-white/20 hover:text-white"
              href="/actors"
            >
              <Search className="size-4" /> Discover Actors
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Featured Performers</h2>
              <p className="mt-2 text-sm text-[#a3a3b8]">
                Sample profiles are clearly labelled and never presented as real users.
              </p>
            </div>
            <Link
              className="flex items-center gap-1 text-sm font-semibold text-[#a78bfa]"
              href="/actors"
            >
              Browse all actors <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredActors.map((actor) => (
              <Link
                className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0F1422]/60 transition hover:border-white/15"
                href={`/actors/${actor.slug}`}
                key={actor.id}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    alt={actor.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    src={actor.heroImage}
                  />
                  <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/65 px-2.5 py-1 text-[10px] font-bold uppercase text-white backdrop-blur">
                    Demo profile
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-white">{actor.name}</h3>
                  <p className="text-sm text-[#a3a3b8]">{actor.location}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {actor.topSkills.slice(0, 3).map((skill) => (
                      <span
                        className="rounded-md bg-white/[0.04] px-2 py-1 text-xs text-[#a3a3b8]"
                        key={skill}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-5 py-16 md:px-8">
        <div className="mx-auto grid max-w-[1200px] gap-8 rounded-2xl border border-[#6C4DFF]/20 bg-gradient-to-br from-[#6C4DFF]/[0.1] to-[#0F1422] p-6 md:p-10 lg:grid-cols-[1fr_480px] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#66E0C2]">
              Early access
            </p>
            <h2 className="mt-3 text-3xl font-bold text-white">Ready to start?</h2>
            <p className="mt-3 max-w-xl leading-7 text-[#a3a3b8]">
              Join the early-access list for production updates, or explore the full UI workflow
              now.
            </p>
          </div>
          <form onSubmit={joinEarlyAccess}>
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#070A12]/60 p-2 sm:flex-row">
              <label className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#5a5a72]" />
                <span className="sr-only">Email address</span>
                <input
                  className="h-12 w-full rounded-lg border border-transparent bg-[#070A12] pl-11 pr-4 text-sm text-white outline-none placeholder:text-[#5a5a72] focus:border-[#6C4DFF]"
                  disabled={status === "submitting"}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#6C4DFF] px-5 text-sm font-semibold text-white hover:bg-[#7a5eff] disabled:opacity-50"
                disabled={status === "submitting"}
                type="submit"
              >
                {status === "submitting" ? "Joining..." : "Join early access"}
                <ArrowRight className="size-4" />
              </button>
            </div>
            {message ? (
              <p
                className={`mt-3 text-sm ${status === "success" ? "text-[#66E0C2]" : "text-[#FF9A44]"}`}
              >
                {message}
              </p>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}

function FeatureStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[#66E0C2]">
        {icon}
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
      <p className="mt-0.5 text-xs uppercase text-[#5a5a72]">{label}</p>
    </div>
  );
}

function ValueCard({
  icon,
  intro,
  title,
}: {
  icon: React.ReactNode;
  intro: string;
  title: string;
}) {
  return (
    <article className="rounded-xl border border-white/[0.06] bg-[#0F1422]/60 p-5">
      <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#6C4DFF]/15 text-[#a78bfa]">
        {icon}
      </span>
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#a3a3b8]">{intro}</p>
    </article>
  );
}
