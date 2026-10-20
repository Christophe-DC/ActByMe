"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { type DirectorDocument, type DirectorState } from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";

export function usePerformanceExport(
  id: string | undefined,
  document: DirectorDocument,
  source: Blob | null,
  save: () => Promise<DirectorState | null>,
  refresh: () => Promise<void>,
  onError: (message: string) => void,
) {
  const active = useRef<{ controller: AbortController; jobId?: string } | null>(null);
  const download = useRef<string | null>(null);
  const [status, setStatus] = useState<{ progress: number; stage: string } | null>(null);
  const [file, setFile] = useState<{ url: string; name: string; signature: string } | null>(null);
  const signature = useMemo(() => JSON.stringify(document), [document]);
  const cancel = () => active.current?.controller.abort();
  useEffect(
    () => () => {
      active.current?.controller.abort();
      if (download.current) URL.revokeObjectURL(download.current);
    },
    [],
  );
  useEffect(() => {
    if (!status) return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [status]);
  const start = async () => {
    if (active.current) return;
    const task = { controller: new AbortController(), jobId: undefined as string | undefined };
    active.current = task;
    const signal = task.controller.signal;
    setStatus({ progress: 0, stage: "Preparing the camera reference" });
    try {
      let snapshot = structuredClone(document),
        original = source;
      if (id) {
        const saved = await save();
        signal.throwIfAborted();
        if (!saved) throw new Error("Save the project before exporting.");
        snapshot = saved.document;
        if (!snapshot.performance?.sourceAssetId) throw new Error("Import a performance first.");
        const requestKey = crypto.randomUUID();
        const state = await directorApi.mutate(id, "jobs", {
          version: saved.version,
          requestKey,
          kind: "EXPORT",
          execution: "browser",
          exportType: "reference",
          maxCostCents: 0,
          confirmRights: true,
        });
        task.jobId = state.jobs.find(
          (job) =>
            job.kind === "EXPORT" &&
            job.status === "PROCESSING" &&
            !saved.jobs.some((previous) => previous.id === job.id),
        )?.id;
        if (!task.jobId) throw new Error("Unable to start the reference export.");
        const media = await directorApi.media(id, snapshot.performance.sourceAssetId);
        const response = await fetch(media.url, {
          signal,
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (!response.ok) throw new Error("Unable to load the private original performance.");
        original = await response.blob();
      }
      signal.throwIfAborted();
      const { renderPerformanceReference } = await import("./performance-reference-render");
      const result = await renderPerformanceReference(
        snapshot,
        original,
        signal,
        (progress, stage) => setStatus({ progress, stage }),
      );
      signal.throwIfAborted();
      if (download.current) URL.revokeObjectURL(download.current);
      download.current = URL.createObjectURL(result);
      setFile({ url: download.current, name: result.name, signature: JSON.stringify(snapshot) });
      if (id && task.jobId) {
        setStatus({ progress: 88, stage: "Saving the private reference MP4" });
        const reserved = await directorApi.reserve(id, {
          name: result.name,
          kind: "clip",
          contentType: "video/mp4",
          sizeBytes: result.size,
          rightsBasis:
            "Authorized camera reference with neutral stand-in and permitted original performance audio.",
          rightsConfirmed: true,
          aiTransferAllowed: false,
        });
        signal.throwIfAborted();
        await directorApi.upload(
          reserved.upload,
          result,
          "video/mp4",
          (value) =>
            setStatus({ progress: 88 + value * 0.06, stage: "Saving the private reference MP4" }),
          signal,
        );
        let checked = await directorApi.mutate(id, `assets/${reserved.assetId}/complete`);
        const deadline = Date.now() + 90000;
        while (
          checked.assets.find((asset) => asset.id === reserved.assetId)?.status === "INSPECTING"
        ) {
          signal.throwIfAborted();
          if (Date.now() > deadline)
            throw new Error(
              "Private verification is taking too long. Your MP4 can still be downloaded below.",
            );
          setStatus({ progress: 95, stage: "Verifying the reference MP4" });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          checked = await directorApi.get(id);
        }
        if (checked.assets.find((asset) => asset.id === reserved.assetId)?.status !== "READY")
          throw new Error("Private verification failed. Your local download remains available.");
        signal.throwIfAborted();
        await directorApi.mutate(id, `jobs/${task.jobId}/browser-result`, {
          assetId: reserved.assetId,
        });
        task.jobId = undefined;
        await refresh();
      }
    } catch (error) {
      if (!signal.aborted)
        onError(error instanceof Error ? error.message : "Reference export failed.");
    } finally {
      if (id && task.jobId)
        await directorApi
          .mutate(id, `jobs/${task.jobId}/cancel`)
          .then(refresh)
          .catch(() => undefined);
      active.current = null;
      setStatus(null);
    }
  };
  return { start, cancel, status, file: file?.signature === signature ? file : null };
}
