"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Mail, Sparkles, Volume2, VolumeX } from "lucide-react";
import { Button } from "@actbyme/ui";
import { earlyAccessApi } from "../lib/api/client";
import {
  PRESENTATION_VIDEO_POSTER_SRC,
  PRESENTATION_VIDEO_SRC,
} from "../components/cinematic/video-platform";

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      await earlyAccessApi.signup({
        email,
        source: "homepage-under-construction",
      });
      setStatus("success");
      setMessage("You are on the early access list.");
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save your email.");
    }
  }

  async function handleToggleSound() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const nextSoundEnabled = video.muted;
    video.muted = !nextSoundEnabled;
    video.volume = 1;

    try {
      await video.play();
      setSoundEnabled(nextSoundEnabled);
    } catch {
      video.muted = true;
      setSoundEnabled(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#09090B] px-5 py-10 text-[#F9FAFB] md:px-8 lg:h-[calc(100dvh-101px)] lg:min-h-0 lg:py-6">
      <section className="mx-auto grid min-h-[calc(100vh-170px)] max-w-6xl items-center gap-10 lg:h-full lg:min-h-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#D1D5DB]">
            <Sparkles className="size-4 text-[#A7F3D0]" />
            ActByMe is under construction
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-none tracking-normal md:text-7xl">
            Real human performance for AI video is coming soon.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[#9CA3AF] md:text-lg">
            Join today to get early access when ActByMe opens for actors, creators, studios, and
            agencies.
          </p>

          <form className="mt-8 max-w-xl" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-2 backdrop-blur sm:flex-row">
              <label className="relative flex-1">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                <span className="sr-only">Email address</span>
                <input
                  className="h-12 w-full rounded-md border border-transparent bg-[#09090B] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[#6B7280] focus:border-[#6366F1]"
                  disabled={status === "submitting"}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <Button className="h-12 shrink-0" disabled={status === "submitting"} type="submit">
                {status === "submitting" ? "Joining..." : "Join early access"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
            {message ? (
              <p
                className={`mt-3 text-sm ${
                  status === "success" ? "text-[#A7F3D0]" : "text-[#FCA5A5]"
                }`}
              >
                {message}
              </p>
            ) : null}
          </form>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.22),transparent_62%)]" />
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#111827] shadow-2xl shadow-black/50">
            <video
              aria-label={
                soundEnabled ? "Presentation video with sound" : "Presentation video muted"
              }
              autoPlay
              className="aspect-video w-full cursor-pointer object-cover"
              loop
              muted={!soundEnabled}
              onClick={handleToggleSound}
              onVolumeChange={(event) => setSoundEnabled(!event.currentTarget.muted)}
              playsInline
              poster={PRESENTATION_VIDEO_POSTER_SRC}
              preload="metadata"
              ref={videoRef}
            >
              <source src={PRESENTATION_VIDEO_SRC} type="video/mp4" />
            </video>
            <div className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/62 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
              {soundEnabled ? (
                <Volume2 className="size-4 text-[#A7F3D0]" />
              ) : (
                <VolumeX className="size-4 text-[#D1D5DB]" />
              )}
              {soundEnabled ? "Sound on" : "Click video for sound"}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
