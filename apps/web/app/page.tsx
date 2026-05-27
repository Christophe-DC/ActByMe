"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, Mic2, Shield, Video, Zap } from "lucide-react";
import { Button, Card, VideoPresentationModal } from "@actbyme/ui";
import { useState } from "react";
import {
  CinematicSection,
  FeaturedActorRail,
  SkillPill,
  TrustSecurityPanel,
  VideoHero,
  VideoGrid,
} from "../components/cinematic/video-platform";
import { MOCK_ACTORS } from "../lib/mock-actors";

const MOTION_SKILLS = [
  "Acting",
  "Dance",
  "Stunts",
  "Martial arts",
  "Accents",
  "Singing",
  "Voice",
  "Body movement",
];

const HOW_IT_WORKS = [
  {
    title: "Actors publish a video-first profile",
    description:
      "They show acting, motion, voice, language, and action skills in one shareable page.",
  },
  {
    title: "Creators discover human reference",
    description:
      "AI video teams browse performance styles, skills, languages, and consent-ready media.",
  },
  {
    title: "Access requires approval",
    description:
      "Public discovery never grants usage rights. Future work needs separate actor approval.",
  },
];

export default function HomePage() {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const featuredActors = MOCK_ACTORS.slice(0, 6);
  const actionActors = MOCK_ACTORS.filter((actor) =>
    actor.topSkills.some((skill) => /stunt|martial|fight|action|combat/i.test(skill)),
  ).slice(0, 5);

  return (
    <main className="min-h-screen bg-[#09090B] text-[#F9FAFB]">
      <VideoHero actors={featuredActors} onPreview={() => setVideoModalOpen(true)} />

      <VideoPresentationModal
        onClose={() => setVideoModalOpen(false)}
        open={videoModalOpen}
        title="ActByMe performance preview"
      >
        <div className="flex aspect-video items-center justify-center rounded-md bg-[#09090B] text-[#9CA3AF]">
          Demo video placeholder
        </div>
      </VideoPresentationModal>

      <CinematicSection
        eyebrow="Featured Performers"
        intro="A scrollable feed of demo performers showing the direction for actor-led AI video discovery."
        title="Browse actors like a creator video library"
      >
        <FeaturedActorRail actors={featuredActors} title="Featured performers" />
        <div className="mt-10">
          <VideoGrid actors={MOCK_ACTORS.slice(2, 8)} />
        </div>
      </CinematicSection>

      <CinematicSection
        eyebrow="Motion Skills"
        intro="ActByMe is built for performance data that is hard to fake: movement, emotion, timing, language, and presence."
        title="Find the human layer behind AI video"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MOTION_SKILLS.map((skill, index) => (
            <Card className="group overflow-hidden p-0" key={skill}>
              <div className="relative p-5">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,0.18),transparent_32%)] opacity-0 transition group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-8 flex size-12 items-center justify-center rounded-md bg-[#6366F1]/16 text-[#C7D2FE]">
                    {index % 3 === 0 ? (
                      <Zap className="size-6" />
                    ) : index % 3 === 1 ? (
                      <Video className="size-6" />
                    ) : (
                      <Mic2 className="size-6" />
                    )}
                  </div>
                  <h3 className="text-2xl font-semibold">{skill}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
                    Video samples, clear labels, and searchable profile metadata for AI creator
                    workflows.
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {["dance", "stunts", "martial arts", "accents", "singing", "voice", "action scenes"].map(
            (skill) => (
              <SkillPill key={skill}>{skill}</SkillPill>
            ),
          )}
        </div>
      </CinematicSection>

      <CinematicSection
        eyebrow="Action and Stunts"
        intro="A premium discovery experience should make motion talent feel immediate and visual."
        title="Performance cards built around video"
      >
        <FeaturedActorRail
          actors={actionActors.length > 0 ? actionActors : featuredActors}
          title="Motion and action performers"
        />
      </CinematicSection>

      <CinematicSection eyebrow="How It Works" title="A simple actor-first marketplace path">
        <div className="grid gap-5 md:grid-cols-3">
          {HOW_IT_WORKS.map((item, index) => (
            <Card className="p-6" key={item.title}>
              <span className="flex size-10 items-center justify-center rounded-full bg-[#6366F1] text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-6 text-2xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#9CA3AF]">{item.description}</p>
            </Card>
          ))}
        </div>
      </CinematicSection>

      <CinematicSection
        eyebrow="Security"
        intro="The product should feel exciting without making actor rights feel casual."
        title="Trust, consent, and identity protection"
      >
        <TrustSecurityPanel />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            "Public portfolios are explicitly published",
            "Private media stays private until access rules exist",
            "No usage, cloning, or training rights are implied",
          ].map((item) => (
            <div
              className="flex items-center gap-3 rounded-md border border-[#1F2937] bg-[#111827] p-4"
              key={item}
            >
              <CheckCircle className="size-5 shrink-0 text-[#14B8A6]" />
              <span className="text-sm text-[#D1D5DB]">{item}</span>
            </div>
          ))}
        </div>
      </CinematicSection>

      <section className="border-t border-[#1F2937] px-5 py-16 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 rounded-lg border border-[#1F2937] bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(17,24,39,0.96))] p-7 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm text-[#C7D2FE]">
              <Shield className="size-4" />
              Actor-first MVP
            </p>
            <h2 className="mt-3 text-4xl font-semibold leading-none tracking-normal md:text-5xl">
              Build a profile actors want to share.
            </h2>
          </div>
          <Button asChild size="lg">
            <Link href="/signup">
              Join as actor
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
