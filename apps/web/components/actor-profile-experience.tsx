"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Bot,
  Clapperboard,
  Copy,
  Crown,
  ExternalLink,
  Languages,
  MapPin,
  Mic2,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, DemoProfileBadge, type ButtonProps } from "@actbyme/ui";
import type { MockActor } from "../lib/mock-actors";

export function ActorProfileExperience({ actor }: { actor: MockActor }) {
  const [shareLabel, setShareLabel] = useState("Share profile");

  async function shareProfile() {
    const shareUrl = window.location.href;

    if (navigator.share) {
      await navigator.share({
        title: `${actor.name} on ActByMe`,
        text: actor.headline,
        url: shareUrl,
      });
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    setShareLabel("Link copied");
    window.setTimeout(() => setShareLabel("Share profile"), 1800);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#09090B] text-[#F9FAFB]">
      <section className="relative min-h-[92vh] border-b border-[#1F2937]">
        <img
          alt={`${actor.name} cinematic hero`}
          className="absolute inset-0 h-full w-full object-cover"
          src={actor.heroImage}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.94),rgba(9,9,11,0.68)_42%,rgba(9,9,11,0.22)),linear-gradient(180deg,rgba(9,9,11,0.18),rgba(9,9,11,1))]" />
        <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col px-5 py-7 md:px-8">
          <nav className="flex items-center justify-between">
            <Button asChild size="sm" variant="ghost">
              <Link href="/actors">
                <ArrowLeft className="size-4" />
                Actors
              </Link>
            </Button>
            <Button onClick={shareProfile} size="sm" variant="outline">
              <Copy className="size-4" />
              {shareLabel}
            </Button>
          </nav>

          <div className="grid flex-1 items-end gap-8 pb-10 pt-16 lg:grid-cols-[1fr_420px]">
            <div className="max-w-4xl">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {actor.isDemo ? <DemoProfileBadge /> : null}
                <Badge className="border-[#14B8A6]/40 bg-[#14B8A6]/15 text-[#A7F3D0]">
                  {actor.availability}
                </Badge>
                <Badge className="border-[#6366F1]/40 bg-[#6366F1]/15 text-[#C7D2FE]">
                  Act AI score placeholder
                </Badge>
              </div>
              <h1 className="text-6xl font-semibold leading-none tracking-normal md:text-8xl">
                {actor.name}
              </h1>
              <p className="mt-5 max-w-2xl text-xl leading-8 text-[#D1D5DB]">{actor.headline}</p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-[#D1D5DB]">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-4 text-[#14B8A6]" />
                  {actor.location}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Languages className="size-4 text-[#14B8A6]" />
                  {actor.languages.join(", ")}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Radio className="size-4 text-[#14B8A6]" />
                  {actor.accents.join(", ")}
                </span>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg">
                  Invite this actor
                  <ExternalLink className="size-4" />
                </Button>
                <Button size="lg" variant="outline">
                  Request agency access
                </Button>
              </div>
            </div>

            <Card className="bg-[#111827]/82 p-5 backdrop-blur">
              <div className="relative overflow-hidden rounded-md">
                <img
                  alt={`${actor.name} video thumbnail`}
                  className="aspect-video w-full object-cover"
                  src={actor.videoThumbnail}
                />
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/8"
                  type="button"
                >
                  <span className="flex size-16 items-center justify-center rounded-full bg-[#6366F1] text-white shadow-2xl shadow-[#6366F1]/30">
                    <Play className="ml-1 size-7" fill="currentColor" />
                  </span>
                </button>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <ScoreStat label="Act AI" value={String(actor.score)} />
                <ScoreStat label="Videos" value={String(actor.videos.length)} />
                <ScoreStat label="Skills" value={String(actor.topSkills.length)} />
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <img
                alt={`${actor.name} profile portrait`}
                className="size-20 rounded-md object-cover"
                src={actor.profileImage}
              />
              <div>
                <p className="text-sm text-[#9CA3AF]">Public demo profile</p>
                <h2 className="text-2xl font-semibold">{actor.name}</h2>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-[#9CA3AF]">{actor.bio}</p>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {actor.topSkills.map((skill, index) => (
              <Card
                className="group p-5 transition hover:border-[#6366F1]/70 hover:bg-[#111827]/78"
                key={skill}
              >
                <div className="mb-5 flex size-11 items-center justify-center rounded-md bg-[#6366F1]/16 text-[#C7D2FE]">
                  {index === 0 ? <Crown className="size-5" /> : <Zap className="size-5" />}
                </div>
                <h3 className="font-semibold">{skill}</h3>
                <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">Skill highlight placeholder</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <ProfileBand title="Video Portfolio" icon={<Video className="size-5" />}>
        <div className="grid gap-5 md:grid-cols-3">
          {actor.videos.map((video) => (
            <article className="group" key={video.title}>
              <div className="relative overflow-hidden rounded-md border border-[#1F2937] bg-[#111827]">
                <img
                  alt={`${video.title} thumbnail`}
                  className="aspect-video w-full object-cover transition duration-500 group-hover:scale-105"
                  src={video.thumbnail}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs">
                  {video.category}
                </span>
                <span className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-[#6366F1]">
                  <Play className="ml-0.5 size-4" fill="currentColor" />
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{video.title}</h3>
              <p className="text-sm text-[#9CA3AF]">{video.duration}</p>
            </article>
          ))}
        </div>
      </ProfileBand>

      <ProfileBand title="Motion Skills" icon={<Clapperboard className="size-5" />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actor.motionSkills.map((group) => (
            <Card className="p-5" key={group.category}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{group.category}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">{group.description}</p>
                </div>
                <Sparkles className="size-5 shrink-0 text-[#14B8A6]" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <span
                    className="rounded-md border border-[#1F2937] bg-[#09090B] px-3 py-2 text-sm text-[#D1D5DB]"
                    key={item}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </ProfileBand>

      <ProfileBand title="Voice And Accents" icon={<Mic2 className="size-5" />}>
        <div className="grid gap-5 lg:grid-cols-3">
          <VoicePanel title="Voice skills" values={actor.voiceSkills} />
          <VoicePanel title="Languages" values={actor.languages} />
          <VoicePanel title="Accents" values={actor.accents} />
        </div>
      </ProfileBand>

      <ProfileBand
        title="Before / After AI Transformation"
        icon={<WandSparkles className="size-5" />}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <TransformationFrame
            image={actor.aiTransformation.originalImage}
            label={actor.aiTransformation.originalLabel}
          />
          <TransformationFrame
            image={actor.aiTransformation.resultImage}
            label={actor.aiTransformation.resultLabel}
            result
          />
        </div>
      </ProfileBand>

      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-[#14B8A6]/30 bg-[#0F172A] p-7">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-6 text-[#14B8A6]" />
              <h2 className="text-2xl font-semibold">Consent and rights</h2>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-7 text-[#D1D5DB]">
              This is a labelled demo profile. In production, actor media, likeness, voice, and
              performance data must only be used after explicit approval and a written usage
              agreement. Public discovery does not grant permission to train, clone, generate, or
              commercially exploit an actor performance.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                "Actor approval required",
                "Usage terms negotiated",
                "No booking or payment yet",
              ].map((item) => (
                <span
                  className="inline-flex items-center gap-2 rounded-md border border-[#1F2937] bg-[#09090B] px-3 py-2 text-sm text-[#D1D5DB]"
                  key={item}
                >
                  <BadgeCheck className="size-4 text-[#14B8A6]" />
                  {item}
                </span>
              ))}
            </div>
          </Card>

          <Card className="bg-[linear-gradient(135deg,rgba(99,102,241,0.24),rgba(17,24,39,0.96))] p-7">
            <Bot className="size-8 text-[#C7D2FE]" />
            <h2 className="mt-5 text-3xl font-semibold">Start an access request</h2>
            <p className="mt-3 text-sm leading-7 text-[#D1D5DB]">
              These CTAs are placeholders for the future agency flow. No booking or payment is
              implemented.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <PlaceholderButton>Invite this actor</PlaceholderButton>
              <Button size="lg" variant="outline">
                Request agency access
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

function ScoreStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#1F2937] bg-[#09090B] p-3 text-center">
      <p className="text-xs uppercase text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ProfileBand({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-t border-[#1F2937] px-5 py-12 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-[#6366F1]/16 text-[#C7D2FE]">
            {icon}
          </span>
          <h2 className="text-3xl font-semibold">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function VoicePanel({ title, values }: { title: string; values: string[] }) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-5 flex flex-wrap gap-2">
        {values.map((value) => (
          <Badge className="normal-case" key={value}>
            {value}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

function TransformationFrame({
  image,
  label,
  result = false,
}: {
  image: string;
  label: string;
  result?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[#1F2937] bg-[#111827]">
      <img alt={label} className="aspect-video w-full object-cover" src={image} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/82 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-[#9CA3AF]">{result ? "AI output" : "Input"}</p>
          <h3 className="text-xl font-semibold">{label}</h3>
        </div>
        <span className="flex size-11 items-center justify-center rounded-full bg-[#6366F1]">
          <Play className="ml-0.5 size-4" fill="currentColor" />
        </span>
      </div>
    </div>
  );
}

function PlaceholderButton(props: ButtonProps) {
  return (
    <Button {...props} size="lg" type="button">
      {props.children}
    </Button>
  );
}
