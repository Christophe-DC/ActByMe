"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Video } from "lucide-react";
import { performanceRequestsApi } from "@/lib/api/client";
import type { PerformanceRequest } from "@/lib/api/types";

export function PerformanceRequestsList() {
  const [requests, setRequests] = useState<PerformanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void performanceRequestsApi
      .list()
      .then(setRequests)
      .catch((loadError: unknown) =>
        setError(loadError instanceof Error ? loadError.message : "Could not load requests."),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
          Actor workspace
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Performance requests</h1>
        <p className="mt-2 text-sm text-zinc-400">Your private briefs and uploads appear here.</p>
        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-zinc-400">
            <Loader2 className="size-4 animate-spin" /> Loading requests…
          </div>
        ) : null}
        {error ? (
          <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        <div className="mt-8 space-y-3">
          {requests.map((request) => (
            <Link
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#111214] p-5 transition hover:border-amber-300/30"
              href={`/performances/${request.id}`}
              key={request.id}
            >
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-amber-300/10 p-3">
                  <Video className="size-5 text-amber-200" />
                </div>
                <div>
                  <h2 className="font-semibold">{request.project.title}</h2>
                  <p className="mt-1 text-sm text-zinc-400">{statusLabel(request.status)}</p>
                </div>
              </div>
              <ChevronRight className="size-5 text-zinc-500" />
            </Link>
          ))}
        </div>
        {!loading && !requests.length ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-400">
            No performance requests have been assigned to you yet.
          </div>
        ) : null}
      </div>
    </main>
  );
}

function statusLabel(status: PerformanceRequest["status"]) {
  return (
    {
      SELECTED: "Ready to accept",
      ACCEPTED: "Ready to record",
      SUBMITTED: "Submitted",
      QA_RUNNING: "QA running",
      QA_FAILED: "Retake required",
      QA_PASSED: "Performance approved",
    } as const
  )[status];
}
