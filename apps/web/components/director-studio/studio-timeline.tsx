"use client";
import { memo } from "react";
import { type StudioScene, type StudioSelection } from "@actbyme/shared";
export const StudioTimeline = memo(function StudioTimeline({
  scene,
  time,
  onTime,
  onSelect,
}: {
  scene: StudioScene;
  time: number;
  onTime: (time: number) => void;
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <section
      className="rounded-xl border border-white/10 bg-black/20 p-4"
      aria-label="Visual timeline"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Scene moments</h3>
        <p className="text-xs text-zinc-300">Choose a moment to give context to the assistant.</p>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="ml-24 flex justify-between text-xs text-zinc-300">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index}>{((scene.duration * index) / 4).toFixed(0)}s</span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-21 shrink-0 text-xs text-zinc-300">Cameras</span>
            <div className="relative h-10 flex-1">
              {scene.shots.map((shot, index) => (
                <button
                  key={shot.id}
                  className="absolute h-10 truncate rounded border border-amber-300/30 bg-amber-300/15 px-2 text-xs text-amber-100"
                  style={{
                    left: (shot.start / scene.duration) * 100 + "%",
                    width: ((shot.end - shot.start) / scene.duration) * 100 + "%",
                  }}
                  onClick={() => {
                    onSelect({ kind: "shot", id: shot.id });
                    onTime(shot.start);
                  }}
                >
                  {index + 1} · {shot.name}
                </button>
              ))}
            </div>
          </div>
          {scene.characters.map((character) => (
            <div key={character.id} className="mt-3 flex items-center gap-3">
              <button
                className="w-21 shrink-0 truncate text-left text-xs text-zinc-200"
                onClick={() => onSelect({ kind: "character", id: character.id })}
              >
                {character.name}
              </button>
              <div className="relative h-10 flex-1 rounded bg-white/5">
                {character.keyframes.map((frame, index) => (
                  <button
                    key={index}
                    aria-label={character.name + " moment " + (index + 1)}
                    className="absolute top-1 size-8 -translate-x-1/2 rounded-full border-2 border-[#111214] focus:ring-2 focus:ring-white"
                    style={{
                      left: (frame.time / scene.duration) * 100 + "%",
                      background: character.color,
                    }}
                    onClick={() => {
                      onSelect({ kind: "character", id: character.id });
                      onTime(frame.time);
                    }}
                  />
                ))}
                <div
                  className="pointer-events-none absolute top-0 h-full w-px bg-white/50"
                  style={{ left: (time / scene.duration) * 100 + "%" }}
                />
              </div>
            </div>
          ))}
          {scene.cues.map((cue, index) => (
            <div key={index} className="mt-2 flex items-center gap-3">
              <span className="w-21 shrink-0 truncate text-xs text-zinc-300">
                {scene.characters.find((item) => item.id === cue.characterId)?.name}
              </span>
              <div className="relative h-9 flex-1">
                <button
                  aria-label={"Dialogue " + (index + 1)}
                  className="absolute h-9 truncate rounded bg-sky-300/20 px-2 text-xs text-sky-100"
                  style={{
                    left: (cue.start / scene.duration) * 100 + "%",
                    width: ((cue.end - cue.start) / scene.duration) * 100 + "%",
                  }}
                  onClick={() => {
                    onSelect({ kind: "cue", id: String(index) });
                    onTime(cue.start);
                  }}
                >
                  {cue.dialogue || cue.direction || "Silent moment"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
