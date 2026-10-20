"use client";
import { useEffect, useRef, useState } from "react";
import { type PerformanceMotion, type DirectorDocument } from "@actbyme/shared";
import { createPerformanceScene } from "./performance-scene";
export function PerformancePreview({
  document,
  time,
  motion,
}: {
  document: DirectorDocument;
  time: number;
  motion?: PerformanceMotion | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Awaited<ReturnType<typeof createPerformanceScene>> | null>(null);
  const latest = useRef({ document, time, motion });
  latest.current = { document, time, motion };
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const element = canvas.current!;
    const task = new AbortController();
    const size = () => {
      const width = Math.min(1280, Math.max(320, element.clientWidth));
      const ratio =
        latest.current.document.aspectRatio === "16:9"
          ? 16 / 9
          : latest.current.document.aspectRatio === "9:16"
            ? 9 / 16
            : 1;
      return { width, height: Math.round(width / ratio) };
    };
    const fail = (error: unknown) => {
      if (task.signal.aborted) return;
      setLoading(false);
      setError(
        error instanceof Error
          ? error.message
          : "3D is unavailable. Try a recent desktop browser with WebGL enabled.",
      );
    };
    const resize = () => {
      if (!scene.current) return;
      try {
        const { width, height } = size();
        scene.current.resize(width, height);
        scene.current.render(latest.current.document, latest.current.time, latest.current.motion);
      } catch (error) {
        fail(error);
      }
    };
    const { width, height } = size();
    void createPerformanceScene(element, width, height, task.signal)
      .then((loaded) => {
        if (task.signal.aborted) {
          loaded.dispose();
          return;
        }
        scene.current = loaded;
        resize();
        element.dataset.engine = "three-performance";
        setLoading(false);
      })
      .catch(fail);
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => {
      task.abort();
      observer.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    try {
      scene.current?.render(document, time, motion);
    } catch (error) {
      setError((error as Error).message);
    }
  }, [document, time, motion]);
  return (
    <div
      className="performance-canvas-wrap"
      style={{
        aspectRatio: document.aspectRatio.replace(":", "/"),
        width:
          document.aspectRatio === "9:16"
            ? "min(100%, 315px)"
            : document.aspectRatio === "1:1"
              ? "min(100%, 560px)"
              : "100%",
        marginInline: "auto",
      }}
    >
      <canvas ref={canvas} aria-label="Neutral stand-in camera preview" />
      {loading ? (
        <p className="performance-preview-loading" role="status">
          Loading studio figure…
        </p>
      ) : null}
      {error ? (
        <p className="performance-preview-error" role="alert">
          {error}
        </p>
      ) : null}
      <span className="performance-preview-caption">
        {motion ? "Movement estimated from video" : "Neutral stand-in · camera framing only"}
      </span>
    </div>
  );
}
