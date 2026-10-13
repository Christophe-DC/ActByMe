"use client";
import { useRef } from "react";
import {
  resizeStudioShot,
  studioSceneSchema,
  type StudioScene,
  type StudioSelection,
} from "@actbyme/shared";
export function StudioTimeline({
  scene,
  time,
  onTime,
  onChange,
  onSelect,
  disabled,
}: {
  scene: StudioScene;
  time: number;
  onTime: (time: number) => void;
  onChange: (scene: StudioScene, group?: string) => void;
  onSelect: (selection: StudioSelection) => void;
  disabled: boolean;
}) {
  const scale = useRef<HTMLDivElement>(null);
  const seconds = (clientX: number) => {
    const bounds = scale.current!.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(scene.duration, ((clientX - bounds.left) / bounds.width) * scene.duration),
    );
  };
  const drag = useRef<{
    kind: "frame" | "shot" | "cue" | "cue-end";
    id: string;
    index: number;
    origin: StudioScene;
    offset: number;
  } | null>(null);
  const move = (clientX: number) => {
    if (!drag.current || disabled) return;
    const current = drag.current;
    const next = structuredClone(current.origin);
    const at = Math.round(seconds(clientX) * 10) / 10;
    if (current.kind === "shot") {
      onChange(resizeStudioShot(next, current.id, at), `shot:${current.id}`);
      return;
    }
    if (current.kind === "frame") {
      const character = next.characters.find((item) => item.id === current.id)!;
      const frame = character.keyframes[current.index]!;
      const previous = character.keyframes[current.index - 1]!;
      const following = character.keyframes[current.index + 1];
      frame.time = Math.max(
        previous.time + 0.1,
        Math.min(following ? following.time - 0.1 : next.duration, at),
      );
      onTime(frame.time);
    } else {
      const cue = next.cues[current.index]!;
      if (current.kind === "cue-end") {
        cue.end = Math.max(cue.start + 0.1, Math.min(next.duration, at));
      } else {
        const length = cue.end - cue.start;
        cue.start = Math.max(0, Math.min(next.duration - length, at - current.offset));
        cue.end = cue.start + length;
      }
    }
    const valid = studioSceneSchema.safeParse(next);
    if (valid.success) onChange(valid.data, `${current.kind}:${current.id}:${current.index}`);
  };
  return (
    <section
      className="rounded-xl border border-white/10 bg-black/20 p-4"
      aria-label="Visual timeline"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Timeline</h3>
        <p className="text-xs text-zinc-300">
          Drag moments, dialogue or camera edges to change their timing.
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[580px]">
          <div className="ml-24">
            <div
              ref={scale}
              className="relative h-8 cursor-pointer"
              onPointerDown={(event) => onTime(seconds(event.clientX))}
            >
              {Array.from({ length: 7 }, (_, index) => (
                <span
                  key={index}
                  className="absolute text-xs text-zinc-400"
                  style={{
                    left: `${(index / 6) * 100}%`,
                    transform: index === 6 ? "translateX(-100%)" : "",
                  }}
                >
                  {((index / 6) * scene.duration).toFixed(0)}s
                </span>
              ))}
              <div className="absolute top-5 h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-300/60"
                  style={{ width: `${(time / scene.duration) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-21 shrink-0 text-xs text-zinc-300">Cameras</span>
            <div className="relative h-10 flex-1">
              {scene.shots.map((shot, index) => (
                <div
                  key={shot.id}
                  className="absolute top-1 h-8 rounded-md border border-amber-300/30 bg-amber-300/15"
                  style={{
                    left: `${(shot.start / scene.duration) * 100}%`,
                    width: `${((shot.end - shot.start) / scene.duration) * 100}%`,
                  }}
                >
                  <button
                    className="h-full w-full overflow-hidden px-1 text-xs text-amber-100"
                    onClick={() => {
                      onTime(shot.start);
                      onSelect({ kind: "shot", id: shot.id });
                    }}
                  >
                    {index + 1} · {shot.name}
                  </button>
                  {index < scene.shots.length - 1 ? (
                    <button
                      aria-label={`Resize ${shot.name}`}
                      disabled={disabled}
                      className="absolute -right-1 top-0 h-full w-3 touch-none cursor-ew-resize rounded bg-amber-200/60"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        drag.current = {
                          kind: "shot",
                          id: shot.id,
                          index,
                          origin: scene,
                          offset: 0,
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => move(event.clientX)}
                      onPointerUp={() => {
                        drag.current = null;
                      }}
                      onPointerCancel={() => {
                        drag.current = null;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                          event.preventDefault();
                          onChange(
                            resizeStudioShot(
                              scene,
                              shot.id,
                              shot.end + (event.key === "ArrowLeft" ? -0.5 : 0.5),
                            ),
                          );
                        }
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          {scene.characters.map((character) => (
            <div key={character.id} className="mt-2 flex items-center gap-3">
              <button
                className="w-21 shrink-0 truncate text-left text-xs text-zinc-200"
                onClick={() => onSelect({ kind: "character", id: character.id })}
              >
                {character.name}
              </button>
              <div className="relative h-9 flex-1 rounded bg-white/5">
                {character.keyframes.map((frame, index) => (
                  <button
                    key={index}
                    aria-label={`${character.name} moment ${index + 1}`}
                    className="absolute top-2 size-5 touch-none rounded-full border-2 border-[#111214] outline-none focus:ring-2 focus:ring-white"
                    style={{
                      left: `${(frame.time / scene.duration) * 100}%`,
                      background: character.color,
                      transform: "translateX(-50%)",
                    }}
                    onClick={() => {
                      onTime(frame.time);
                      onSelect({ kind: "character", id: character.id });
                    }}
                    onPointerDown={(event) => {
                      onTime(frame.time);
                      onSelect({ kind: "character", id: character.id });
                      if (!disabled && index > 0) {
                        drag.current = {
                          kind: "frame",
                          id: character.id,
                          index,
                          origin: scene,
                          offset: 0,
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }
                    }}
                    onPointerMove={(event) => move(event.clientX)}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    onKeyDown={(event) => {
                      if (disabled || index === 0) return;
                      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                        event.preventDefault();
                        const next = structuredClone(scene);
                        const frames = next.characters.find(
                          (item) => item.id === character.id,
                        )!.keyframes;
                        frames[index]!.time = Math.max(
                          frames[index - 1]!.time + 0.1,
                          Math.min(
                            frames[index + 1]?.time
                              ? frames[index + 1]!.time - 0.1
                              : scene.duration,
                            frame.time + (event.key === "ArrowLeft" ? -0.5 : 0.5),
                          ),
                        );
                        onChange(next);
                        onTime(frames[index]!.time);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-3">
            <span className="w-21 shrink-0 text-xs text-zinc-300">Dialogue</span>
            <div className="relative h-10 flex-1 rounded bg-white/5">
              {scene.cues.map((cue, index) => (
                <div
                  key={index}
                  className="absolute top-1 h-8 rounded bg-sky-300/20 text-xs text-sky-100"
                  style={{
                    left: `${(cue.start / scene.duration) * 100}%`,
                    width: `${((cue.end - cue.start) / scene.duration) * 100}%`,
                  }}
                >
                  <button
                    aria-label={`Dialogue ${index + 1}`}
                    disabled={disabled}
                    className="h-full w-full touch-none cursor-grab truncate px-2 text-left"
                    onClick={() => {
                      onTime(cue.start);
                      onSelect({ kind: "cue", id: String(index) });
                    }}
                    onPointerDown={(event) => {
                      onSelect({ kind: "cue", id: String(index) });
                      drag.current = {
                        kind: "cue",
                        id: String(index),
                        index,
                        origin: scene,
                        offset: seconds(event.clientX) - cue.start,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => move(event.clientX)}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                      event.preventDefault();
                      const next = structuredClone(scene);
                      const edited = next.cues[index]!;
                      const length = cue.end - cue.start;
                      edited.start = Math.max(
                        0,
                        Math.min(
                          scene.duration - length,
                          cue.start + (event.key === "ArrowLeft" ? -0.5 : 0.5),
                        ),
                      );
                      edited.end = edited.start + length;
                      onChange(next);
                      onTime(edited.start);
                    }}
                  >
                    {cue.dialogue || cue.direction}
                  </button>
                  <button
                    aria-label={`Resize dialogue ${index + 1}`}
                    disabled={disabled}
                    className="absolute -right-1 top-0 h-full w-3 touch-none cursor-ew-resize rounded bg-sky-200/60"
                    onPointerDown={(event) => {
                      drag.current = {
                        kind: "cue-end",
                        id: String(index),
                        index,
                        origin: scene,
                        offset: 0,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => move(event.clientX)}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                      event.preventDefault();
                      const next = structuredClone(scene);
                      next.cues[index]!.end = Math.max(
                        cue.start + 0.1,
                        Math.min(
                          scene.duration,
                          cue.end + (event.key === "ArrowLeft" ? -0.5 : 0.5),
                        ),
                      );
                      onChange(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
