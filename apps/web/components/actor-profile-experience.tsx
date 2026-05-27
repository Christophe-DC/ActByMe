"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Bot,
  Clapperboard,
  Copy,
  Crown,
  Mail,
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
import { Badge, Button, Card, DemoProfileBadge, VideoPresentationModal } from "@actbyme/ui";
import type { MockActor } from "../lib/mock-actors";

const VIDEO_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1200&auto=format&fit=crop";
const AI_TRANSFORMATION_PLACEHOLDER =
  "https://images.unsplash.com/photo-1535223289827-42f1e9919769?q=80&w=1200&auto=format&fit=crop";

export function ActorProfileExperience({ actor }: { actor: MockActor }) {
  const [shareLabel, setShareLabel] = useState("Share profile");
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);

  const aiTransformation = actor.aiTransformation ?? {
    originalImage: actor.videoThumbnail ?? VIDEO_PLACEHOLDER_IMAGE,
    originalLabel: "Original performance",
    resultImage: AI_TRANSFORMATION_PLACEHOLDER,
    resultLabel: "AI character result",
  };

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

  function copyProfileLink() {
    void navigator.clipboard.writeText(window.location.href);
    setShareLabel("Link copied");
    window.setTimeout(() => setShareLabel("Share profile"), 1800);
  }

  const agencyAccessHref = `/agency-access?actor=${encodeURIComponent(actor.slug)}`;
  const canRenderHeroVideo = actor.heroVideoUrl?.startsWith("http");

  return (
    <main className="min-h-screen overflow-hidden bg-[#09090B] text-[#F9FAFB]">
      <section className="relative min-h-[92vh] border-b border-[#1F2937]">
        {canRenderHeroVideo ? (
          <video
            aria-label={`${actor.name} hero video`}
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
            loop
            muted
            playsInline
            poster={actor.heroImage}
            src={actor.heroVideoUrl}
          />
        ) : (
          <img
            alt={`${actor.name} cinematic hero`}
            className="absolute inset-0 h-full w-full object-cover"
            src={actor.heroImage}
          />
        )}
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
                  AI-ready performance
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
                <Button asChild size="lg">
                  <Link href={agencyAccessHref}>
                    Invite this actor
                    <ExternalLink className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={agencyAccessHref}>Request agency access</Link>
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
                  onClick={() => setActiveVideoTitle(`${actor.name} intro reel`)}
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

      <section className="mx-auto max-w-7xl px-5 py-14 md:px-8">
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
            {(actor.topSkills ?? []).map((skill, index) => (
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

      <ProfileBand title="Acting" icon={<Clapperboard className="size-5" />}>
        <div className="grid gap-4 md:grid-cols-3">
          {actor.actingStyles.map((style) => (
            <Card className="p-5" key={style}>
              <h3 className="text-lg font-semibold">{style}</h3>
              <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
                Acting range and screen presence prepared for creator review.
              </p>
            </Card>
          ))}
        </div>
      </ProfileBand>

      <ProfileBand title="Actor Videos" icon={<Video className="size-5" />}>
        {actor.videos.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-3">
            {(actor.videos ?? []).map((video) => (
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
                    <button
                      aria-label={`Play ${video.title}`}
                      className="flex size-10 items-center justify-center rounded-full"
                      onClick={() => setActiveVideoTitle(video.title)}
                      type="button"
                    >
                      <Play className="ml-0.5 size-4" fill="currentColor" />
                    </button>
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{video.title}</h3>
                <p className="text-sm text-[#9CA3AF]">{video.duration}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-lg border border-[#1F2937] bg-[#111827]">
            <img
              alt="Video portfolio placeholder"
              className="aspect-[16/7] w-full object-cover opacity-70"
              src={VIDEO_PLACEHOLDER_IMAGE}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/48 to-transparent" />
            <div className="absolute bottom-6 left-6 max-w-xl">
              <p className="text-sm uppercase text-[#C7D2FE]">Video portfolio</p>
              <h3 className="mt-2 text-3xl font-semibold">Performance videos coming soon</h3>
              <p className="mt-3 text-sm leading-6 text-[#D1D5DB]">
                This profile has no public video thumbnails yet. ActByMe uses a cinematic
                placeholder instead of reusing the profile photo as a video preview.
              </p>
            </div>
          </div>
        )}
      </ProfileBand>

      <ProfileBand title="Motion" icon={<Sparkles className="size-5" />}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(actor.motionSkills ?? []).map((group) => (
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

      <ProfileBand title="Voice" icon={<Mic2 className="size-5" />}>
        <div className="grid gap-5 lg:grid-cols-3">
          <VoicePanel title="Voice skills" values={actor.voiceSkills ?? []} />
          <VoicePanel title="Languages" values={actor.languages ?? []} />
          <VoicePanel title="Accents" values={actor.accents ?? []} />
        </div>
      </ProfileBand>

      <ProfileBand title="Accents" icon={<Radio className="size-5" />}>
        <div className="flex flex-wrap gap-3">
          {actor.accents.map((accent) => (
            <span
              className="rounded-md border border-[#1F2937] bg-[#111827] px-4 py-3 text-sm text-[#D1D5DB]"
              key={accent}
            >
              {accent}
            </span>
          ))}
        </div>
      </ProfileBand>

      <ProfileBand
        title="Before / After AI Transformation"
        icon={<WandSparkles className="size-5" />}
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <TransformationFrame
            image={aiTransformation.originalImage}
            label={aiTransformation.originalLabel}
          />
          <TransformationFrame
            image={aiTransformation.resultImage}
            label={aiTransformation.resultLabel}
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
              <Button asChild size="lg">
                <Link href={agencyAccessHref}>Invite this actor</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={agencyAccessHref}>Request agency access</Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <ProfileBand title="Share This Profile" icon={<Copy className="size-5" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ShareAction onClick={copyProfileLink} icon={<Copy className="size-4" />}>
            Copy profile link
          </ShareAction>
          <ShareAction
            icon={<ExternalLink className="size-4" />}
            onClick={() =>
              openShareUrl(
                `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`,
              )
            }
          >
            Share on LinkedIn
          </ShareAction>
          <ShareAction
            icon={<ExternalLink className="size-4" />}
            onClick={() =>
              openShareUrl(
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`${actor.name} on ActByMe - ${actor.headline}`)}`,
              )
            }
          >
            Share on X
          </ShareAction>
          <ShareAction
            icon={<Mail className="size-4" />}
            onClick={() => {
              window.location.href = `mailto:?subject=${encodeURIComponent(`${actor.name} on ActByMe`)}&body=${encodeURIComponent(`${actor.name} on ActByMe - ${actor.headline}`)}%0A${encodeURIComponent(window.location.href)}`;
            }}
          >
            Share by email
          </ShareAction>
        </div>
      </ProfileBand>

      <VideoPresentationModal
        onClose={() => setActiveVideoTitle(null)}
        open={Boolean(activeVideoTitle)}
        title={activeVideoTitle ?? "Actor video"}
      >
        <div className="flex aspect-video items-center justify-center rounded-md bg-[#09090B] text-[#9CA3AF]">
          Video playback placeholder
        </div>
      </VideoPresentationModal>
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
  const safeValues = Array.from(new Set((values ?? []).filter(Boolean)));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-5 flex flex-wrap gap-2">
        {safeValues.map((value, index) => (
          <Badge className="normal-case" key={`${title}-${value}-${index}`}>
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

function openShareUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function ShareAction({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  const className =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#1F2937] bg-[#111827] px-4 py-3 text-sm font-medium text-[#F9FAFB] transition hover:border-[#6366F1] hover:bg-[#151F32]";

  return (
    <button className={className} onClick={onClick} type="button">
      {icon}
      {children}
    </button>
  );
}
