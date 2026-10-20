"use client";
import { useEffect, useRef, useState } from "react";
import { type DirectorDocument } from "@actbyme/shared";
import { createPerformanceScene } from "./performance-scene";
export function PerformancePreview({
  document,
  time,
}: {
  document: DirectorDocument;
  time: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createPerformanceScene> | null>(null);
  const latest = useRef({ document, time });
  latest.current = { document, time };
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const element = canvas.current!;
    const resize = () => {
      try {
        const width = Math.min(1280, Math.max(320, element.clientWidth));
        const ratio =
          latest.current.document.aspectRatio === "16:9"
            ? 16 / 9
            : latest.current.document.aspectRatio === "9:16"
              ? 9 / 16
              : 1;
        if (!scene.current)
          scene.current = createPerformanceScene(element, width, Math.round(width / ratio));
        else scene.current.resize(width, Math.round(width / ratio));
        scene.current.render(latest.current.document, latest.current.time);
        element.dataset.engine = "three-performance";
        setError(null);
      } catch {
        setError(
          "3D is unavailable in this browser. Try a recent desktop browser with WebGL enabled. Your camera plan is still saved.",
        );
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      observer.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    try {
      scene.current?.render(document, time);
    } catch (error) {
      setError((error as Error).message);
    }
  }, [document, time]);
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
      {error ? (
        <p className="performance-preview-error" role="alert">
          {error}
        </p>
      ) : null}
      <span className="performance-preview-caption">Neutral stand-in · camera framing only</span>
    </div>
  );
}
