"use client";

import { ArrowRight, CheckCircle, Users, Shield, Zap, Play, MessageSquare } from "lucide-react";
import { Badge, Button, Card, VideoPresentationModal } from "@actbyme/ui";
import { useState } from "react";

const MOTION_SKILLS = [
  { title: "Acting", description: "Dramatic range, character work, emotional depth" },
  { title: "Voice Performance", description: "Accent variation, tone, emotional delivery" },
  { title: "Dance & Movement", description: "Contemporary, ballet, hip-hop, choreography" },
  { title: "Martial Arts", description: "Combat, stunts, fight choreography" },
  { title: "Stunts & Action", description: "Precision timing, safety-first performance" },
  { title: "Sports Skills", description: "Athletic movement, sports-specific actions" },
  { title: "Accents & Dialects", description: "Regional and international vocal variation" },
  { title: "Body Movement", description: "Physicality, posture, gait, gesture" },
  { title: "Emotional Performance", description: "Microexpressions, vulnerability, authenticity" },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Create your free profile",
    description: "Sign up in 5 minutes with your acting background and experience.",
  },
  {
    step: 2,
    title: "Upload your skills",
    description: "Record and upload videos of your acting, voice, movement, and action skills.",
  },
  {
    step: 3,
    title: "Get discovered",
    description: "Agencies and AI video directors can find and request access to your profile.",
  },
  {
    step: 4,
    title: "Future opportunities",
    description:
      "Earn potential income as agencies commission performances via AI video production.",
  },
];

export default function HomePage() {
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  return (
    <main className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* Left: Copy */}
            <div>
              <Badge className="mb-6">AI Video Production for Actors</Badge>
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-[#F9FAFB] mb-6 leading-tight">
                Turn your acting skills into AI-ready income.
              </h1>
              <p className="text-lg text-[#9CA3AF] mb-8 leading-relaxed">
                Create a cinematic profile, showcase your acting, voice, motion and action skills,
                and get discovered by agencies building the next generation of AI video.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="w-full sm:w-auto">
                  Join as actor — free
                  <ArrowRight className="size-4" />
                </Button>
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Request agency access
                </Button>
              </div>
            </div>

            {/* Right: Video Preview */}
            <div className="relative">
              <div className="aspect-video rounded-lg border border-[#1F2937] bg-gradient-to-br from-[#0b0b0d] to-[#111827] flex items-center justify-center overflow-hidden">
                <button
                  onClick={() => setVideoModalOpen(true)}
                  className="group relative flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#6366F1]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center justify-center h-16 w-16 rounded-full bg-[#6366F1] text-white group-hover:scale-110 transition-transform">
                    <Play className="size-6 ml-0.5" fill="currentColor" />
                  </div>
                </button>
              </div>
              <p className="text-sm text-[#9CA3AF] text-center mt-3">
                Watch how actors use ActByMe
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Video Presentation Modal */}
      <VideoPresentationModal
        open={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        title="How ActByMe Works"
      >
        <div className="aspect-video bg-[#0b0b0d] rounded-md flex items-center justify-center">
          <p className="text-[#9CA3AF]">[Demo video placeholder]</p>
        </div>
      </VideoPresentationModal>

      {/* How It Works Section */}
      <section className="py-24 px-6 border-t border-[#1F2937]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#F9FAFB] mb-4">
              How it works for actors
            </h2>
            <p className="text-lg text-[#9CA3AF]">
              Four simple steps to build your AI-ready profile
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="group">
                <Card className="h-full hover:border-[#6366F1] transition-colors">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366F1] text-white font-bold">
                      {item.step}
                    </div>
                    <h3 className="font-semibold text-[#F9FAFB]">{item.title}</h3>
                  </div>
                  <p className="text-sm text-[#9CA3AF]">{item.description}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Motion Skills Section */}
      <section className="py-24 px-6 border-t border-[#1F2937] bg-[#0f0f12]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#F9FAFB] mb-4">
              Showcase your motion skills
            </h2>
            <p className="text-lg text-[#9CA3AF]">
              Upload videos demonstrating your unique talents and experience
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {MOTION_SKILLS.map((skill) => (
              <Card key={skill.title}>
                <div className="flex items-start gap-3 mb-2">
                  <Zap className="size-5 text-[#6366F1] flex-shrink-0 mt-1" />
                  <h3 className="font-semibold text-[#F9FAFB]">{skill.title}</h3>
                </div>
                <p className="text-sm text-[#9CA3AF]">{skill.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Public Profile Showcase */}
      <section className="py-24 px-6 border-t border-[#1F2937]">
        <div className="mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#F9FAFB] mb-6">
                Your beautiful, shareable profile
              </h2>
              <p className="text-lg text-[#9CA3AF] mb-6 leading-relaxed">
                Every actor gets a unique, cinematic profile page. Share your profile link on social
                media, in emails, or with industry contacts. Control exactly what's visible to the
                public.
              </p>
              <ul className="space-y-3">
                {[
                  "Customizable profile with photo and headline",
                  "Showcase your best videos and reel highlights",
                  "Public portfolio for industry sharing",
                  "View analytics on profile visits",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <CheckCircle className="size-5 text-[#6366F1] flex-shrink-0" />
                    <span className="text-[#F9FAFB]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[#1F2937] bg-[#111827] aspect-square flex items-center justify-center">
              <div className="text-center">
                <div className="h-24 w-24 rounded-full bg-[#0b0b0d] mx-auto mb-4" />
                <p className="text-[#9CA3AF] text-sm">Sample profile preview</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agency Early Access Section */}
      <section className="py-24 px-6 border-t border-[#1F2937] bg-[#0f0f12]">
        <div className="mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="rounded-lg border border-[#1F2937] bg-[#111827] aspect-square flex items-center justify-center">
              <Users className="size-16 text-[#6366F1]/40" />
            </div>
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-[#F9FAFB] mb-6">
                For agencies & directors
              </h2>
              <p className="text-lg text-[#9CA3AF] mb-6 leading-relaxed">
                AI video production studios and agencies can request early access to discover and
                commission actor performances. Build relationships with talented performers
                directly.
              </p>
              <Button variant="outline" size="lg">
                <MessageSquare className="size-4" />
                Request agency access
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Rights Section */}
      <section className="py-24 px-6 border-t border-[#1F2937]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#F9FAFB] mb-4">
              Privacy, rights, and control
            </h2>
            <p className="text-lg text-[#9CA3AF]">Your profile, your rules</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "You control visibility",
                description:
                  "Choose which videos and profile details are public. Update privacy settings anytime.",
              },
              {
                icon: CheckCircle,
                title: "Explicit consent required",
                description:
                  "Agencies must request access. You approve every collaboration before it happens.",
              },
              {
                icon: Users,
                title: "Ownership remains yours",
                description:
                  "You own your content, likeness, and performance rights. Review usage agreements carefully.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <item.icon className="size-8 text-[#6366F1] mb-4" />
                <h3 className="font-semibold text-[#F9FAFB] mb-2">{item.title}</h3>
                <p className="text-sm text-[#9CA3AF]">{item.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-6 border-t border-[#1F2937] bg-gradient-to-b from-[#0b0b0d] to-[#111827]">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-5xl md:text-6xl font-bold text-[#F9FAFB] mb-6">
            Ready to get discovered?
          </h2>
          <p className="text-xl text-[#9CA3AF] mb-10 leading-relaxed">
            Join hundreds of actors building their AI-ready profiles. It takes 5 minutes to sign up
            and start uploading your skills.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg">
              Join as actor — free
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" size="lg">
              Learn more
            </Button>
          </div>
          <p className="text-sm text-[#9CA3AF] mt-8">No credit card required. Cancel anytime.</p>
        </div>
      </section>
    </main>
  );
}
