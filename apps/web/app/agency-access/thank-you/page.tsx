import Link from "next/link";
import { ArrowRight, BadgeCheck, Clapperboard, MailCheck, Sparkles } from "lucide-react";
import { Badge, Button, Card } from "@actbyme/ui";

export default function AgencyAccessThankYouPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#09090B] text-[#F9FAFB]">
      <section className="relative min-h-screen px-5 py-8 md:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_74%_22%,rgba(20,184,166,0.18),transparent_24%),linear-gradient(180deg,rgba(17,24,39,0.86),rgba(9,9,11,1))]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col">
          <nav className="flex items-center justify-between">
            <Link className="flex items-center gap-3" href="/">
              <span className="flex size-10 items-center justify-center rounded-md bg-[#6366F1]">
                <Clapperboard className="size-5" />
              </span>
              <span className="text-lg font-semibold">ActByMe</span>
            </Link>
            <Button asChild size="sm" variant="outline">
              <Link href="/agency-access">Back to form</Link>
            </Button>
          </nav>

          <div className="grid flex-1 place-items-center py-12">
            <Card className="max-w-3xl p-7 text-center md:p-10">
              <div className="mx-auto flex size-16 items-center justify-center rounded-md bg-[#14B8A6]/16 text-[#A7F3D0]">
                <MailCheck className="size-8" />
              </div>
              <Badge className="mt-6 border-[#14B8A6]/40 bg-[#14B8A6]/15 text-[#A7F3D0]">
                Request received
              </Badge>
              <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-6xl">
                Thanks, we&apos;ll contact you when agency access opens.
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#9CA3AF]">
                The full client dashboard is not live yet. For now, you can explore demo actor
                profiles and see how public talent pages will feel.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/actors">
                    Browse demo actor profiles
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/">Return home</Link>
                </Button>
              </div>
              <div className="mt-8 grid gap-3 border-t border-[#1F2937] pt-6 text-left md:grid-cols-3">
                {["Early access only", "No booking yet", "No payments yet"].map((item) => (
                  <span className="flex items-center gap-2 text-sm text-[#9CA3AF]" key={item}>
                    <BadgeCheck className="size-4 text-[#14B8A6]" />
                    {item}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          <div className="border-t border-[#1F2937] py-5 text-sm text-[#9CA3AF]">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="size-4 text-[#14B8A6]" />
              Demo actor profiles are clearly marked and are not real registered users.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
