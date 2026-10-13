"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import {
  studioActionLabels,
  describeStudioMoment,
  sampleCamera,
  type StudioScene,
  type StudioVector,
} from "@actbyme/shared";

const StudioCanvas = dynamic(() => import("./studio-canvas"), {
  ssr: false,
  loading: () => <p className="p-6">Loading 3D viewer…</p>,
});
class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="p-6 text-amber-200">
        3D playback is unavailable. Follow the timed directions below.
      </p>
    ) : (
      this.props.children
    );
  }
}
const control =
  "rounded-lg border border-white/20 bg-[#17171b] px-3 py-2 text-sm text-white disabled:opacity-40";

export function StudioPlayer({
  scene,
  roleId,
  selectedId,
  onSelect,
  onMove,
  timelineTime,
  onTimelineTimeChange,
}: {
  scene: StudioScene;
  roleId?: string | null;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onMove?: (position: StudioVector, time: number) => void;
  timelineTime?: number;
  onTimelineTimeChange?: (time: number) => void;
}) {
  const [time, setTime] = useState(0);
  const currentTime = timelineTime ?? time;
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  const updateTime = (next: number) => {
    timeRef.current = next;
    setTime(next);
    onTimelineTimeChange?.(next);
  };
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [shot, setShot] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    setAvailable(Boolean(context));
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = ((now - previous) / 1000) * speed;
      previous = now;
      const next = timeRef.current + elapsed;
      const value = next >= scene.duration ? (loop ? next % scene.duration : scene.duration) : next;
      timeRef.current = value;
      setTime(value);
      onTimelineTimeChange?.(value);
    }, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [playing, speed, loop, scene.duration, onTimelineTimeChange]);
  useEffect(() => {
    if (currentTime >= scene.duration && !loop) setPlaying(false);
  }, [currentTime, scene.duration, loop]);
  const safeTime = Math.min(currentTime, scene.duration);
  const activeCamera = sampleCamera(scene, safeTime, shot || undefined);
  const cues = scene.cues.filter((cue) => safeTime >= cue.start && safeTime < cue.end);
  return (
    <div className="space-y-4" data-testid="studio-player">
      <div
        className="h-[340px] overflow-hidden rounded-xl border border-white/10 sm:h-[460px]"
        aria-label="Animated 3D scene"
      >
        {available ? (
          <ViewerBoundary>
            <StudioCanvas
              scene={scene}
              time={safeTime}
              shot={shot}
              roleId={roleId}
              selectedId={selectedId}
              onSelect={
                onSelect
                  ? (id) => {
                      setPlaying(false);
                      onSelect(id);
                    }
                  : undefined
              }
              onMove={
                onMove
                  ? (position) => {
                      setPlaying(false);
                      onMove(position, safeTime);
                    }
                  : undefined
              }
              onFailure={() => setAvailable(false)}
            />
          </ViewerBoundary>
        ) : (
          <p className="p-6 text-amber-200">
            {available === null
              ? "Checking 3D support…"
              : "WebGL 2 is unavailable. Use the timeline and timed directions below."}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={control}
          onClick={() => {
            if (safeTime >= scene.duration) updateTime(0);
            setPlaying(!playing);
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          className={control}
          onClick={() => {
            setPlaying(false);
            updateTime(0);
          }}
        >
          Restart
        </button>
        <label className="text-sm">
          Speed{" "}
          <select
            className={control}
            aria-label="Playback speed"
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            {[0.25, 0.5, 1, 1.5, 2].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={loop}
            onChange={(event) => setLoop(event.target.checked)}
          />{" "}
          Loop
        </label>
        <label className="text-sm">
          Camera{" "}
          <select
            className={control}
            aria-label="Camera view"
            value={shot}
            onChange={(event) => setShot(event.target.value)}
          >
            <option value="">Automatic cuts</option>
            <option value="free">Free view</option>
            {scene.shots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Timeline ·{" "}
        <output data-testid="studio-time">
          {safeTime.toFixed(1)} / {scene.duration}s
        </output>
        <input
          aria-label="Timeline"
          className="mt-2 w-full accent-amber-300"
          type="range"
          min="0"
          max={scene.duration}
          step="0.1"
          value={safeTime}
          onChange={(event) => {
            setPlaying(false);
            updateTime(Number(event.target.value));
          }}
        />
      </label>
      <p className="text-sm text-zinc-300">
        Camera: {shot === "free" ? "Free view — drag to orbit, scroll to zoom" : activeCamera.name}
      </p>
      {cues.map((cue, index) => (
        <p key={`${cue.characterId}:${index}`} className="rounded-lg bg-amber-300/10 p-3 text-sm">
          <strong>
            {scene.characters.find((character) => character.id === cue.characterId)?.name}:
          </strong>{" "}
          {cue.dialogue} <span className="block text-amber-200">{cue.direction}</span>
        </p>
      ))}
      <details className="rounded-xl border border-white/10 p-4" open={!available || undefined}>
        <summary className="cursor-pointer font-medium">Your scene, step by step</summary>
        {scene.characters
          .filter((character) => !roleId || character.id === roleId)
          .map((character) => (
            <div key={character.id} className="mt-4 text-sm text-zinc-200">
              <strong className={character.id === roleId ? "text-amber-200" : ""}>
                {character.name}
                {character.id === roleId ? " · Your role" : ""}
              </strong>
              <ol className="mt-3 space-y-2">
                {character.keyframes.map((frame, index) => {
                  const direction = describeStudioMoment(scene, character.id, index);
                  return (
                    <li key={frame.time} className="rounded-lg bg-white/5 p-3">
                      <span className="font-medium text-amber-200">
                        {frame.time === 0 ? "At the start" : `${frame.time.toFixed(1)}s`}
                      </span>{" "}
                      · {studioActionLabels[frame.action]}
                      {` · ${direction.movement} · ${direction.gaze}`}
                    </li>
                  );
                })}
              </ol>
              {scene.cues
                .filter((cue) => cue.characterId === character.id)
                .map((cue, index) => (
                  <div key={index} className="mt-3 rounded-lg bg-amber-300/5 p-3">
                    <p className="text-xs text-amber-200">
                      {cue.start.toFixed(1)}–{cue.end.toFixed(1)}s
                    </p>
                    <p className="mt-1">{cue.dialogue}</p>
                    <p className="mt-1 text-zinc-300">{cue.direction}</p>
                  </div>
                ))}
            </div>
          ))}
      </details>
      <p className="text-xs leading-5 text-zinc-400">
        Camera cuts illustrate the director’s intention. Follow the recording guide for your
        continuous take.
      </p>
    </div>
  );
}
