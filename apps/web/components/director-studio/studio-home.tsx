"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Clapperboard, Loader2 } from "lucide-react";
import { studioTemplates } from "@actbyme/shared";
import { studioWorkspaceApi } from "@/lib/api/client";
import { DirectorStudioPanel } from "./director-studio-panel";
import { message } from "./use-studio-document";
export function StudioHome({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof studioWorkspaceApi.list>>>([]);
  useEffect(() => {
    if (!projectId)
      void studioWorkspaceApi
        .list()
        .then(setProjects)
        .catch((error: unknown) => setError(message(error)));
  }, [projectId]);
  async function create(templateId?: string) {
    setBusy(true);
    setError("");
    try {
      const template = studioTemplates.find((item) => item.id === templateId);
      const created = await studioWorkspaceApi.create({
        title: template?.name || title,
        script: template?.script || script,
        instructions: template
          ? "Start with this template."
          : direction ||
            "Bring this script to life. Show clear character movements and useful camera views.",
        ...(templateId ? { templateId } : {}),
      });
      router.push(`/studio?project=${created.projectId}`);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#0b0b0d] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {projectId ? (
          <>
            <Link href="/studio" className="text-sm text-amber-200">
              ← Your scenes
            </Link>
            <DirectorStudioPanel key={projectId} projectId={projectId} briefApproved={false} />
          </>
        ) : (
          <>
            <header>
              <p className="text-xs uppercase tracking-[.22em] text-amber-200">
                Director Studio 3D
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                From words to a scene.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
                Write your story, see it come to life, and shape it with a few simple gestures. No
                3D skills needed.
              </p>
            </header>
            {error ? (
              <p role="alert" className="rounded-xl bg-red-400/10 p-4 text-red-100">
                {error}
              </p>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void create();
                }}
                className="rounded-2xl border border-white/10 bg-[#111214] p-6"
              >
                <h2 className="text-xl font-semibold">Start with your story</h2>
                <label className="mt-5 block text-sm">
                  Scene name
                  <input
                    required
                    maxLength={160}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-base"
                    placeholder="A second chance"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <label className="mt-5 block text-sm">
                  Your script
                  <textarea
                    required
                    maxLength={24000}
                    rows={6}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-base"
                    placeholder="Two friends meet after a long time. Lea walks towards Marc, pauses and says…"
                    value={script}
                    onChange={(event) => setScript(event.target.value)}
                  />
                </label>
                <label className="mt-5 block text-sm">
                  Anything special? <span className="text-zinc-400">Optional</span>
                  <textarea
                    maxLength={12000}
                    rows={2}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-base"
                    placeholder="A quiet mood, a slow camera move, a surprised reaction…"
                    value={direction}
                    onChange={(event) => setDirection(event.target.value)}
                  />
                </label>
                <button
                  disabled={busy || !title.trim() || !script.trim()}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-semibold text-black disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Create my scene
                </button>
              </form>
              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Or start with a ready-made scene</h2>
                <p className="text-sm leading-6 text-zinc-300">
                  Use a fictional sample, then make it your own.
                </p>
                {studioTemplates.map((template) => (
                  <button
                    key={template.id}
                    disabled={busy}
                    onClick={() => void create(template.id)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#111214] p-5 text-left transition hover:border-amber-300/50 disabled:opacity-40"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200">
                      <Clapperboard className="size-6" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold">{template.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-300">{template.description}</p>
                      <p className="mt-2 text-xs text-amber-200">
                        Sample scene · {template.scene.duration}s ·{" "}
                        {template.scene.characters.length}{" "}
                        {template.scene.characters.length === 1 ? "person" : "people"}
                      </p>
                    </div>
                    <ArrowRight className="ml-auto size-4 shrink-0 text-zinc-400" />
                  </button>
                ))}
                <Link
                  href="/director-studio/demo"
                  className="inline-block pt-2 text-sm text-amber-200"
                >
                  Watch the demonstration →
                </Link>
              </section>
            </div>
            {projects.length ? (
              <section>
                <h2 className="mb-4 text-xl font-semibold">Your saved scenes</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/studio?project=${project.id}`}
                      className="rounded-xl border border-white/10 bg-[#111214] p-5 hover:border-amber-300/50"
                    >
                      <h3 className="font-semibold">{project.title}</h3>
                      <p className="mt-2 text-xs text-zinc-300">
                        {project.duration ? `${project.duration}s · ` : ""}Continue editing
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
