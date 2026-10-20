"use client";
import { useEffect, useRef, useState } from "react";
import { directorBrowserExportError, type DirectorState } from "@actbyme/shared";
import { directorApi } from "@/lib/api/client";
import { renderDirectorInBrowser } from "./director-browser-render";

export function useDirectorBrowserExport(
  id: string | undefined,
  onSave: () => Promise<DirectorState | null>,
  onRefresh: () => Promise<void>,
  onError: (message: string) => void,
) {
  const active = useRef<{ controller: AbortController; projectId: string; jobId?: string } | null>(
    null,
  );
  const download = useRef<string | null>(null);
  const [status, setStatus] = useState<{ progress: number; stage: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAt = useRef(0);
  const [localFile, setLocalFile] = useState<{ url: string; name: string } | null>(null);
  const cancel = () => {
    const task = active.current;
    task?.controller.abort();
    if (task?.jobId)
      void directorApi
        .mutate(task.projectId, `jobs/${task.jobId}/cancel`)
        .then(onRefresh)
        .catch(() => undefined);
  };
  useEffect(
    () => () => {
      const task = active.current;
      task?.controller.abort();
      if (task?.jobId)
        void directorApi.mutate(task.projectId, `jobs/${task.jobId}/cancel`).catch(() => undefined);
      if (download.current) URL.revokeObjectURL(download.current);
    },
    [],
  );
  const exporting = Boolean(status);
  useEffect(() => {
    if (!exporting) return;
    const timer = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [exporting]);
  const start = async () => {
    if (!id || active.current) return;
    const task = {
      controller: new AbortController(),
      projectId: id,
      jobId: undefined as string | undefined,
    };
    active.current = task;
    startedAt.current = Date.now();
    setElapsedSeconds(0);
    const signal = task.controller.signal;
    setStatus({ progress: 0, stage: "Saving the edit" });
    try {
      const saved = await onSave();
      signal.throwIfAborted();
      if (!saved) return;
      const error = directorBrowserExportError(saved.document, saved.assets);
      if (error) throw new Error(error);
      const started = await directorApi.mutate(id, "jobs", {
        version: saved.version,
        requestKey: crypto.randomUUID(),
        kind: "EXPORT",
        execution: "browser",
        maxCostCents: 0,
        confirmRights: true,
      });
      task.jobId = started.jobs.find(
        (job) =>
          job.kind === "EXPORT" &&
          job.status === "PROCESSING" &&
          !saved.jobs.some((old) => old.id === job.id),
      )?.id;
      if (!task.jobId) throw new Error("Unable to start the export.");
      signal.throwIfAborted();
      await onRefresh();
      const file = await renderDirectorInBrowser(id, saved, signal, (progress, stage) =>
        setStatus({ progress, stage }),
      );
      signal.throwIfAborted();
      if (download.current) URL.revokeObjectURL(download.current);
      download.current = URL.createObjectURL(file);
      setLocalFile({ url: download.current, name: file.name });
      setStatus({ progress: 88, stage: "Saving the private MP4" });
      const reserved = await directorApi.reserve(id, {
        name: file.name,
        kind: "clip",
        contentType: "video/mp4",
        sizeBytes: file.size,
        rightsBasis: `Authorized assembly of project ${id}, version ${saved.version}.`,
        rightsConfirmed: true,
        aiTransferAllowed: false,
      });
      signal.throwIfAborted();
      await directorApi.upload(
        reserved.upload,
        file,
        "video/mp4",
        (value) => setStatus({ progress: 88 + value * 0.06, stage: "Saving the private MP4" }),
        signal,
      );
      signal.throwIfAborted();
      let checked = await directorApi.mutate(id, `assets/${reserved.assetId}/complete`);
      const deadline = Date.now() + 90000;
      while (
        checked.assets.find((asset) => asset.id === reserved.assetId)?.status === "INSPECTING"
      ) {
        if (Date.now() > deadline)
          throw new Error(
            "MP4 verification is taking too long. You can still download the file here.",
          );
        setStatus({ progress: 95, stage: "Verifying the saved MP4" });
        await new Promise<void>((resolve, reject) => {
          const stop = () => {
            clearTimeout(timer);
            reject(new DOMException("Cancelled", "AbortError"));
          };
          const timer = setTimeout(() => {
            signal.removeEventListener("abort", stop);
            resolve();
          }, 1000);
          signal.addEventListener("abort", stop, { once: true });
          if (signal.aborted) stop();
        });
        checked = await directorApi.get(id);
      }
      const result = checked.assets.find((asset) => asset.id === reserved.assetId);
      if (result?.status !== "READY") throw new Error(result?.error ?? "MP4 verification failed.");
      signal.throwIfAborted();
      await directorApi.mutate(id, `jobs/${task.jobId}/browser-result`, {
        assetId: reserved.assetId,
      });
      task.jobId = undefined;
      await onRefresh();
    } catch (error) {
      if (task.jobId)
        await directorApi.mutate(id, `jobs/${task.jobId}/cancel`).catch(() => undefined);
      if (!signal.aborted)
        onError(
          error instanceof Error
            ? error.message
            : "Browser export failed. Try again on a recent desktop computer.",
        );
      await onRefresh().catch(() => undefined);
    } finally {
      if (active.current === task) active.current = null;
      setStatus(null);
    }
  };
  return { start, cancel, status, localFile, elapsedSeconds };
}
