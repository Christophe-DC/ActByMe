"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, FolderOpen, Loader2, Plus } from "lucide-react";
import { performanceProjectsApi } from "@/lib/api/client";
import type { PerformanceProjectResponse } from "@/lib/api/types";

function statusLabel(project: PerformanceProjectResponse) {
  if (project.deliveryCompletedAt || project.workflowStatus === "APPROVED_DELIVERY") {
    return "Completed";
  }
  if (project.assignment) return "Performance in progress";
  if (project.brief?.approvedAt) return "Ready for actor";
  if (project.brief) return "Shooting plan ready";
  return "Draft";
}

function updatedLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ProjectsList() {
  const [projects, setProjects] = useState<PerformanceProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void performanceProjectsApi
      .list()
      .then(setProjects)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load projects."),
      )
      .finally(() => setLoading(false));
  }, []);

  const inProgress = useMemo(
    () => projects.filter((project) => !project.deliveryCompletedAt),
    [projects],
  );
  const completed = useMemo(
    () => projects.filter((project) => Boolean(project.deliveryCompletedAt)),
    [projects],
  );

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
              Workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">My Projects</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Resume work in progress, reopen previous projects, or start a new performance.
            </p>
          </div>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-200"
            href="/create-performance?new=1"
          >
            <Plus className="size-4" />
            New Project
          </Link>
        </div>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="size-4 animate-spin" />
            Loading projects…
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {!loading && !error && projects.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#111214] p-8 text-center">
            <FolderOpen className="mx-auto size-8 text-zinc-500" />
            <h2 className="mt-4 text-lg font-semibold">No projects yet</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Create your first performance project to get started.
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-black"
              href="/create-performance?new=1"
            >
              <Plus className="size-4" />
              New Project
            </Link>
          </div>
        ) : null}

        {inProgress.length ? (
          <ProjectSection title="In progress" projects={inProgress} />
        ) : null}

        {completed.length ? (
          <ProjectSection title="Previous projects" projects={completed} />
        ) : null}
      </div>
    </main>
  );
}

function ProjectSection({
  projects,
  title,
}: {
  projects: PerformanceProjectResponse[];
  title: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Link
            className="group rounded-2xl border border-white/10 bg-[#111214] p-5 transition hover:border-amber-300/35 hover:bg-[#151619]"
            href={`/create-performance?project=${project.id}`}
            key={project.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white group-hover:text-amber-100">
                  {project.title || "Untitled performance"}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">{statusLabel(project)}</p>
              </div>
              <FolderOpen className="size-5 shrink-0 text-zinc-600 group-hover:text-amber-300" />
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
              <Clock3 className="size-3.5" />
              Updated {updatedLabel(project.updatedAt)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
