import Link from "next/link";
import { ArrowRight, BadgeCheck, Clapperboard, Play, ShieldCheck, Sparkles } from "lucide-react";
import { Badge, Button, Card } from "@actbyme/ui";
import { FeaturedActorRail, TrustSecurityPanel } from "../../components/cinematic/video-platform";
import { MOCK_ACTORS } from "../../lib/mock-actors";

const benefits = [
  "Create a public actor profile for free",
  "Show acting, voice, dance, stunts, and motion skills",
  "Make your profile shareable for LinkedIn and agencies",
  "Keep future paid work subject to separate approval",
];

export default function JoinPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#09090B] text-[#F9FAFB]">
      <section className="relative min-h-screen px-5 py-8 md:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(99,102,241,0.2),transparent_32%),radial-gradient(circle_at_78%_20%,rgba(20,184,166,0.18),transparent_24%),linear-gradient(180deg,rgba(17,24,39,0.86),rgba(9,9,11,1))]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col">
          <nav className="flex items-center justify-between">
            <Link className="flex items-center gap-3" href="/">
              <span className="flex size-10 items-center justify-center rounded-md bg-[#6366F1]">
                <Clapperboard className="size-5" />
              </span>
              <span className="text-lg font-semibold">ActByMe</span>
            </Link>
            <Button asChild size="sm" variant="outline">
              <Link href="/actors">Explore actors</Link>
            </Button>
          </nav>

          <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_420px]">
            <div>
              <Badge className="border-[#6366F1]/50 bg-[#6366F1]/10 text-[#C7D2FE]">
                Actor creator profile
              </Badge>
              <h1 className="mt-6 max-w-4xl text-6xl font-semibold leading-none tracking-normal md:text-8xl">
                Build a cinematic profile for AI video creators.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#D1D5DB]">
                Showcase acting, voice, dance, stunts, martial arts, accents, singing, and motion
                skills in a video-first portfolio actors can proudly share.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Create account
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/actors/maya-laurent">Preview sample profile</Link>
                </Button>
              </div>
            </div>

            <Card className="p-5">
              <div className="relative overflow-hidden rounded-md">
                <div className="aspect-video bg-[linear-gradient(135deg,rgba(99,102,241,0.22),rgba(9,9,11,0.3)),url('https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-16 items-center justify-center rounded-full bg-[#6366F1] text-white shadow-2xl shadow-[#6366F1]/30">
                    <Play className="ml-1 size-7" fill="currentColor" />
                  </span>
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {benefits.map((benefit) => (
                  <div className="flex items-start gap-3" key={benefit}>
                    <BadgeCheck className="mt-0.5 size-5 shrink-0 text-[#14B8A6]" />
                    <p className="text-sm leading-6 text-[#D1D5DB]">{benefit}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-md border border-[#1F2937] bg-[#09090B] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-[#14B8A6]" />
                  Consent-first
                </div>
                <p className="mt-2 text-sm leading-6 text-[#9CA3AF]">
                  Registration does not authorize cloning, training, booking, or paid usage.
                </p>
              </div>
            </Card>
          </div>

          <div className="grid gap-3 border-t border-[#1F2937] py-6 md:grid-cols-3">
            {["Free registration", "Local mock onboarding", "Public profile preview"].map(
              (item) => (
                <div className="flex items-center gap-2 text-sm text-[#9CA3AF]" key={item}>
                  <Sparkles className="size-4 text-[#14B8A6]" />
                  {item}
                </div>
              ),
            )}
          </div>
          <div className="border-t border-[#1F2937] py-8">
            <FeaturedActorRail actors={MOCK_ACTORS.slice(0, 5)} title="Actor profile inspiration" />
          </div>
          <div className="pb-8">
            <TrustSecurityPanel />
          </div>
        </div>
      </section>
    </main>
  );
}
