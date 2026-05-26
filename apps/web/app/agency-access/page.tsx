import Link from "next/link";
import { ArrowLeft, BadgeCheck, Clapperboard, Sparkles } from "lucide-react";
import { Badge, Button } from "@actbyme/ui";
import { AgencyAccessForm } from "../../components/agency-access/agency-access-form";

export default function AgencyAccessPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#09090B] text-[#F9FAFB]">
      <section className="relative border-b border-[#1F2937] px-5 py-8 md:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_78%_16%,rgba(20,184,166,0.16),transparent_26%),linear-gradient(180deg,rgba(17,24,39,0.86),rgba(9,9,11,1))]" />
        <div className="relative mx-auto max-w-7xl">
          <nav className="flex items-center justify-between">
            <Link className="flex items-center gap-3" href="/">
              <span className="flex size-10 items-center justify-center rounded-md bg-[#6366F1]">
                <Clapperboard className="size-5" />
              </span>
              <span className="text-lg font-semibold">ActByMe</span>
            </Link>
            <Button asChild size="sm" variant="outline">
              <Link href="/actors">Browse demo profiles</Link>
            </Button>
          </nav>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <Badge className="border-[#6366F1]/50 bg-[#6366F1]/10 text-[#C7D2FE]">
                Agency early access
              </Badge>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-none tracking-normal md:text-7xl">
                Request access to actor-led AI video talent.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#9CA3AF] md:text-lg">
                For agencies, directors, and AI video studios exploring performer-led reference
                capture, motion skills, voice samples, and multilingual actor profiles.
              </p>
            </div>
            <div className="rounded-lg border border-[#1F2937] bg-[#111827]/80 p-5">
              <div className="flex items-center gap-3">
                <BadgeCheck className="size-5 text-[#14B8A6]" />
                <h2 className="font-semibold">Early access intake</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
                Submitting sends your request to the ActByMe API and keeps a local copy for this MVP
                preview.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-[#9CA3AF]">
          <Link className="inline-flex items-center gap-2 transition hover:text-[#F9FAFB]" href="/">
            <ArrowLeft className="size-4" />
            Home
          </Link>
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-[#14B8A6]" />
            No client dashboard required
          </span>
        </div>
        <AgencyAccessForm />
      </section>
    </main>
  );
}
