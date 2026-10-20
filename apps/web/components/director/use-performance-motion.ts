"use client";
import { useEffect, useRef, useState } from "react";
import type { PerformanceMotion } from "@actbyme/shared";
import {
  analyzePerformanceMotion,
  clearPerformanceMotionCache,
} from "./performance-motion-analysis";
export function usePerformanceMotion(
  file: File | null,
  sourceId: string | null | undefined,
  sourceUrl: string | null,
) {
  const [enabled, setEnabled] = useState(true),
    [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ input: File | string; motion: PerformanceMotion } | null>(
    null,
  );
  const [status, setStatus] = useState<{ progress: number; stage: string } | null>(null),
    [error, setError] = useState<string | null>(null);
  const url = useRef(sourceUrl);
  url.current = sourceUrl;
  const currentInput = file ?? sourceId ?? null,
    hasUrl = Boolean(sourceUrl);
  const task = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!enabled || !currentInput || !hasUrl) {
      setStatus(null);
      setError(null);
      return;
    }
    const controller = new AbortController();
    task.current = controller;
    setStatus({ progress: 0, stage: "Preparing movement analysis" });
    setError(null);
    void (async () => {
      const response = file
        ? null
        : await fetch(url.current!, {
            signal: controller.signal,
            credentials: "omit",
            referrerPolicy: "no-referrer",
          });
      if (response && !response.ok)
        throw new Error(
          "The private performance is unavailable. Reopen the project or import the video again.",
        );
      const blob = file ?? (await response!.blob());
      controller.signal.throwIfAborted();
      const motion = await analyzePerformanceMotion(
        blob,
        controller.signal,
        (progress, stage) => {
          if (!controller.signal.aborted) setStatus({ progress, stage });
        },
        attempt > 0,
      );
      if (!controller.signal.aborted) setResult({ input: currentInput, motion });
    })()
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Movement analysis failed.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatus(null);
      });
    return () => {
      controller.abort();
      task.current = null;
    };
  }, [file, currentInput, hasUrl, attempt, enabled]);
  const motion = enabled && result?.input === currentInput ? result.motion : null;
  return {
    motion,
    enabled,
    setEnabled,
    status,
    error,
    hasSource: Boolean(currentInput),
    retry: () => {
      setResult(null);
      setAttempt((value) => value + 1);
      setEnabled(true);
    },
    cancel: () => {
      task.current?.abort();
      setEnabled(false);
      setStatus(null);
    },
    clear: () => {
      if (result) void clearPerformanceMotionCache(result.motion.sourceHash).catch(() => undefined);
      setResult(null);
      setEnabled(false);
      setError(null);
      setStatus(null);
    },
  };
}
