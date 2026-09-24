"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Loader2, Upload, Video } from "lucide-react";
import { performanceRequestsApi, performanceTakesApi } from "@/lib/api/client";
import type { PerformanceRequest } from "@/lib/api/types";

export function PerformanceRequestDetail({ id }: { id: string }) {
  const [request, setRequest] = useState<PerformanceRequest | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void performanceRequestsApi
      .get(id)
      .then(setRequest)
      .catch((loadError: unknown) => setError(message(loadError)));
  }, [id]);

  async function accept() {
    setBusy("accept");
    setError("");
    try {
      setRequest(await performanceRequestsApi.accept(id));
    } catch (actionError) {
      setError(message(actionError));
    } finally {
      setBusy("");
    }
  }

  async function upload() {
    if (!request?.scene || !file) return;
    const contentType = file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4";
    setBusy("upload");
    setError("");
    try {
      const reservation = await performanceTakesApi.createUpload(
        request.project.id,
        request.scene.id,
        { contentType, fileName: file.name, sizeBytes: file.size },
      );
      await performanceTakesApi.uploadFile(reservation.upload, file, contentType, setProgress);
      await performanceTakesApi.completeUpload(
        request.project.id,
        request.scene.id,
        reservation.take.id,
        reservation.take.uploadAttemptId,
      );
      setRequest(await performanceRequestsApi.get(id));
      setFile(null);
    } catch (uploadError) {
      setError(message(uploadError));
    } finally {
      setBusy("");
      setProgress(0);
    }
  }

  async function submit() {
    setBusy("submit");
    setError("");
    try {
      setRequest(await performanceRequestsApi.submit(id));
    } catch (submitError) {
      setError(message(submitError));
      setRequest(await performanceRequestsApi.get(id).catch(() => request));
    } finally {
      setBusy("");
    }
  }

  if (!request)
    return (
      <main className="min-h-screen bg-[#0b0b0d] px-4 py-12 text-white">
        <div className="mx-auto max-w-3xl">
          {error ? (
            <p className="text-red-200">{error}</p>
          ) : (
            <p className="flex items-center gap-2 text-zinc-400">
              <Loader2 className="size-4 animate-spin" /> Loading performance…
            </p>
          )}
        </div>
      </main>
    );
  const guide = request.actorGuide;
  const latestQa = request.scene?.take?.qaRuns?.[0];
  const canUpload = request.status === "ACCEPTED" || request.status === "QA_FAILED";

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          href="/performances"
        >
          <ArrowLeft className="size-4" /> All requests
        </Link>
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
            Performance request
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{request.project.title}</h1>
          <p className="mt-2 text-sm text-zinc-400">One continuous take · {guide.duration}</p>
        </div>
        {error ? (
          <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        {request.status === "SELECTED" ? (
          <section className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
            <h2 className="font-semibold">Ready to take this performance?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Accepting simply opens the private guide and upload. It does not simulate an email or
              external contract.
            </p>
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-semibold text-black disabled:opacity-50"
              disabled={Boolean(busy)}
              onClick={() => void accept()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{" "}
              Accept request
            </button>
          </section>
        ) : null}
        {request.status !== "SELECTED" ? (
          <>
            <section className="mt-8 rounded-2xl border border-white/10 bg-[#111214] p-5 sm:p-7">
              <h2 className="text-xl font-semibold">Your recording guide</h2>
              <p className="mt-3 leading-7 text-zinc-300">{guide.overview}</p>
              <ol className="mt-6 space-y-4">
                {guide.steps.map((step) => (
                  <li className="flex gap-4" key={step.order}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-300 font-semibold text-black">
                      {step.order}
                    </span>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">{step.instruction}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-6 rounded-xl bg-black/25 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Dialogue
                </p>
                <p className="mt-2 whitespace-pre-wrap leading-7 text-white">{guide.dialogue}</p>
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-semibold">Final checklist</h3>
                <ul className="mt-3 space-y-2">
                  {guide.finalChecklist.map((item) => (
                    <li className="flex gap-2 text-sm text-zinc-300" key={item}>
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            <section className="mt-6 rounded-2xl border border-white/10 bg-[#111214] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <Video className="size-5 text-amber-300" />
                <h2 className="text-xl font-semibold">Upload performance</h2>
              </div>
              {canUpload ? (
                <>
                  <label className="mt-5 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/20 bg-black/20 p-4 text-sm text-zinc-300">
                    <span>{file?.name ?? "Choose an MP4 or MOV file"}</span>
                    <Upload className="size-4" />
                    <input
                      className="sr-only"
                      type="file"
                      accept=".mp4,.mov,video/mp4,video/quicktime"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {progress ? (
                    <p className="mt-2 text-xs text-zinc-400">Uploading {progress}%</p>
                  ) : null}
                  <button
                    className="mt-4 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold disabled:opacity-50"
                    disabled={!file || Boolean(busy)}
                    onClick={() => void upload()}
                  >
                    {busy === "upload"
                      ? "Uploading…"
                      : request.scene?.take
                        ? "Replace performance"
                        : "Upload performance"}
                  </button>
                </>
              ) : null}
              {request.scene?.take?.uploadStatus === "UPLOADED" && canUpload ? (
                <button
                  className="ml-3 mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                  disabled={Boolean(busy)}
                  onClick={() => void submit()}
                >
                  {busy === "submit" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}{" "}
                  Submit Performance
                </button>
              ) : null}
              <ActorStatus status={request.status} />
              {latestQa ? (
                <div className="mt-4 space-y-2">
                  {latestQa.processingError ? (
                    <p className="rounded-lg bg-red-400/10 p-3 text-sm leading-6 text-red-100">
                      {latestQa.processingError}
                    </p>
                  ) : null}
                  {latestQa.checks
                    .filter((check) => check.result === "FAIL")
                    .map((check) => (
                      <p
                        className="rounded-lg bg-red-400/10 p-3 text-sm leading-6 text-red-100"
                        key={check.id}
                      >
                        {check.correctionInstruction}
                      </p>
                    ))}
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function ActorStatus({ status }: { status: PerformanceRequest["status"] }) {
  if (["ACCEPTED", "SELECTED"].includes(status)) return null;
  const label =
    status === "QA_PASSED"
      ? "Performance Approved"
      : status === "QA_FAILED"
        ? "Retake required — follow the corrections below and replace your video."
        : status === "QA_RUNNING"
          ? "Quality checks are running…"
          : "Performance uploaded.";
  return (
    <div
      className={`mt-5 flex items-start gap-3 rounded-xl border p-4 ${status === "QA_PASSED" ? "border-emerald-400/30 bg-emerald-400/10" : status === "QA_FAILED" ? "border-red-400/30 bg-red-400/10" : "border-amber-300/20 bg-amber-300/[0.06]"}`}
    >
      {status === "QA_PASSED" ? (
        <CheckCircle2 className="size-5 text-emerald-300" />
      ) : status === "QA_RUNNING" ? (
        <Loader2 className="size-5 animate-spin text-amber-300" />
      ) : (
        <Video className="size-5 text-amber-300" />
      )}
      <p className="text-sm font-semibold">{label}</p>
    </div>
  );
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
