"use client";

import { Share2, Star, Video, Music, Play } from "lucide-react";
import { Badge, Button } from "@actbyme/ui";
import { Card } from "../../../../packages/ui/src/components/card";
import { DemoProfileBadge } from "../../../../packages/ui/src/components/demo-profile-badge";
import { ShareProfileButton } from "../../../../packages/ui/src/components/share-profile-button";
import { VideoCard } from "../../../../packages/ui/src/components/video-card";
import { useState } from "react";
import { getActorBySlug } from "../../../lib/mock-actors";
import { notFound } from "next/navigation";

export default function ActorProfilePage({ params }: { params: { slug: string } }) {
  const actor = getActorBySlug(params.slug);
  const [shareOpen, setShareOpen] = useState(false);

  if (!actor) {
    notFound();
  }

  return (
    <main className="w-full">
      {/* 1. Hero Section */}
      <section className="relative h-80 md:h-96 bg-gradient-to-br from-[#6366F1]/20 via-[#0b0b0d] to-[#111827] border-b border-[#1F2937] flex items-center px-6">
        <div className="mx-auto max-w-7xl w-full flex items-center gap-8">
          <div className="h-32 w-32 rounded-full bg-[#111827] border-2 border-[#6366F1] flex items-center justify-center flex-shrink-0">
            <div className="text-center">
              <p className="text-lg font-semibold text-[#F9FAFB]">{actor.name.split(" ")[0]}</p>
              <p className="text-xs text-[#9CA3AF]">Actor</p>
            </div>
          </div>
          <div className="flex-1">
            {/* 2. Actor Name, Location, Languages */}
            <h1 className="text-4xl md:text-5xl font-bold text-[#F9FAFB] mb-2">{actor.name}</h1>
            <p className="text-lg text-[#9CA3AF] mb-4">{actor.headline}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {actor.languages.map((lang: string) => (
                <Badge key={lang}>{lang}</Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Header Actions */}
      <section className="sticky top-0 z-40 bg-[#0b0b0d]/95 backdrop-blur border-b border-[#1F2937] px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 4. Demo Profile Badge */}
            {actor.isDemo && <DemoProfileBadge />}
            {/* 5. Act AI Score Placeholder */}
            <div className="flex items-center gap-2">
              <Star className="size-5 text-[#6366F1]" fill="#6366F1" />
              <span className="font-semibold text-[#F9FAFB]">Act AI Score: {actor.score}</span>
            </div>
          </div>
          {/* 3. Share Profile Button */}
          <ShareProfileButton onClick={() => setShareOpen(true)} />
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-12 space-y-16">
        {/* Actor Bio */}
        <section>
          <p className="text-lg text-[#9CA3AF] leading-relaxed">{actor.bio}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-[#9CA3AF]">
              <strong>Location:</strong> {actor.location}
            </span>
            <span className="text-sm text-[#9CA3AF]">
              <strong>Accents:</strong> {actor.accents.join(", ")}
            </span>
          </div>
        </section>

        {/* 6. Skill Highlights */}
        <section>
          <h2 className="text-3xl font-bold text-[#F9FAFB] mb-6">Core Skills</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {actor.skills.map((skill: string) => (
              <Card key={skill} className="flex items-center gap-3">
                <Star className="size-6 text-[#6366F1] flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-[#F9FAFB]">{skill}</h3>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* 7. Video Portfolio */}
        <section>
          <h2 className="text-3xl font-bold text-[#F9FAFB] mb-6">Portfolio</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {actor.videos.map((video: any) => (
              <VideoCard key={video.title} title={video.title} duration={video.duration} />
            ))}
          </div>
        </section>

        {/* 8. Motion Skills Section */}
        <section>
          <h2 className="text-3xl font-bold text-[#F9FAFB] mb-6">Motion & Action Skills</h2>
          <div className="space-y-6">
            {actor.motionSkills.map((motion: any) => (
              <div key={motion.category}>
                <h3 className="text-xl font-semibold text-[#F9FAFB] mb-3">{motion.category}</h3>
                <div className="flex flex-wrap gap-2">
                  {motion.items.map((item: string) => (
                    <Badge key={item} className="bg-[#6366F1]/20 text-[#6366F1] border-[#6366F1]">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 9. Voice and Accent Section */}
        <section>
          <h2 className="text-3xl font-bold text-[#F9FAFB] mb-6">Voice & Performance</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <h3 className="text-lg font-semibold text-[#F9FAFB] mb-3 flex items-center gap-2">
                <Music className="size-5 text-[#6366F1]" />
                Voice Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {actor.voiceSkills.map((skill: string) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </Card>
            <Card>
              <h3 className="text-lg font-semibold text-[#F9FAFB] mb-3">Languages & Accents</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-[#9CA3AF] font-medium mb-1">Languages:</p>
                  <p className="text-[#F9FAFB]">{actor.languages.join(", ")}</p>
                </div>
                <div>
                  <p className="text-sm text-[#9CA3AF] font-medium mb-1">Accents:</p>
                  <p className="text-[#F9FAFB]">{actor.accents.join(", ")}</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* 10. Before/After AI Transformation */}
        <section className="bg-[#111827] border border-[#1F2937] rounded-lg p-8">
          <h2 className="text-3xl font-bold text-[#F9FAFB] mb-6">AI Transformation Preview</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-sm text-[#9CA3AF] font-semibold mb-4">Original Actor Motion</p>
              <div className="aspect-video rounded-lg bg-gradient-to-br from-[#0b0b0d] to-[#1F2937] flex items-center justify-center border border-[#1F2937]">
                <button className="flex items-center justify-center h-16 w-16 rounded-full bg-[#6366F1]/20 text-[#6366F1] hover:bg-[#6366F1]/30 transition-colors">
                  <Play className="size-6 ml-0.5" fill="currentColor" />
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-[#9CA3AF] font-semibold mb-4">AI Character Result</p>
              <div className="aspect-video rounded-lg bg-gradient-to-br from-[#6366F1]/10 to-[#111827] flex items-center justify-center border border-[#6366F1]/30">
                <button className="flex items-center justify-center h-16 w-16 rounded-full bg-[#6366F1] text-white hover:bg-[#5558E8] transition-colors">
                  <Play className="size-6 ml-0.5" fill="currentColor" />
                </button>
              </div>
            </div>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-6">
            AI video production transforms actor performances into digital characters while
            preserving unique motion, voice, and emotional nuances.
          </p>
        </section>

        {/* 11. Consent & Rights Explanation */}
        <section className="bg-gradient-to-r from-[#6366F1]/10 to-transparent border border-[#1F2937] rounded-lg p-8">
          <h2 className="text-2xl font-bold text-[#F9FAFB] mb-4">Consent & Rights</h2>
          <div className="space-y-4 text-[#9CA3AF]">
            <p>
              This actor has shared their profile publicly on ActByMe. Any agency or director
              interested in their work must:
            </p>
            <ul className="space-y-2 ml-4">
              <li>✓ Submit a formal access request</li>
              <li>✓ Wait for explicit approval before any collaboration</li>
              <li>✓ Respect the actor's usage rights and performance agreements</li>
              <li>✓ Negotiate terms transparently before any commission</li>
            </ul>
            <p>
              The actor retains full ownership of their likeness, voice, and performance rights. All
              usage must be agreed upon in writing.
            </p>
          </div>
        </section>

        {/* 12. CTA Section */}
        <section className="bg-gradient-to-r from-[#6366F1]/20 to-[#111827] border border-[#1F2937] rounded-lg p-8">
          <h2 className="text-2xl font-bold text-[#F9FAFB] mb-6">
            Interested in working with {actor.name}?
          </h2>
          <p className="text-[#9CA3AF] mb-8">
            Submit an access request to {actor.name}'s profile. They will review and respond to
            agency inquiries.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg">Invite this actor</Button>
            <Button variant="outline" size="lg">
              Request agency access
            </Button>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-6">
            This action will send a request to the actor. They will be notified and can approve or
            decline your inquiry.
          </p>
        </section>
      </div>
    </main>
  );
}
