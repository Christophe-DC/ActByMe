"use client";
import { type StudioScene, type StudioShot } from "@actbyme/shared";
export const directorControl =
  "w-full rounded-lg border border-white/20 bg-[#191a1e] px-3 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-amber-300";
export const directorButton =
  "rounded-lg border border-white/20 px-3 py-2 text-sm text-white transition hover:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-40";
export function CameraControls({
  scene,
  shot,
  onChange,
}: {
  scene: StudioScene;
  shot: StudioShot;
  onChange: (scene: StudioScene) => void;
}) {
  function update(patch: Partial<StudioShot>) {
    onChange({
      ...scene,
      shots: scene.shots.map((item) => (item.id === shot.id ? { ...item, ...patch } : item)),
    });
  }
  function preset(kind: string) {
    const target = { ...shot.target };
    const positions: Record<string, { x: number; y: number; z: number }> = {
      Front: { x: target.x, y: target.y + 0.3, z: target.z + 4 },
      Left: { x: target.x - 4, y: target.y + 0.3, z: target.z + 1 },
      Right: { x: target.x + 4, y: target.y + 0.3, z: target.z + 1 },
      High: { x: target.x, y: target.y + 3, z: target.z + 4 },
      Close: { x: target.x, y: target.y + 0.2, z: target.z + 2 },
      Wide: { x: target.x, y: target.y + 0.4, z: target.z + 7 },
    };
    update({ position: positions[kind], endPosition: positions[kind], fov: 45, endFov: 45 });
  }
  function move(kind: string) {
    const start = shot.position;
    const end =
      kind === "Push in"
        ? {
            x: (start.x + shot.target.x) / 2,
            y: (start.y + shot.target.y) / 2,
            z: (start.z + shot.target.z) / 2,
          }
        : kind === "Slide"
          ? { ...start, x: start.x + 2 }
          : { ...start };
    update({ endPosition: end, easing: "smooth" });
  }
  return (
    <div className="space-y-4">
      <label className="block text-sm">
        Shot name
        <input
          className={`${directorControl} mt-2`}
          value={shot.name}
          maxLength={160}
          onChange={(event) => update({ name: event.target.value })}
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm text-zinc-300">Choose a viewpoint</legend>
        <div className="grid grid-cols-3 gap-2">
          {["Front", "Left", "Right", "High", "Close", "Wide"].map((kind) => (
            <button
              type="button"
              className={directorButton}
              key={kind}
              onClick={() => preset(kind)}
            >
              {kind}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm text-zinc-300">Camera movement</legend>
        <div className="flex flex-wrap gap-2">
          {["Static", "Push in", "Slide"].map((kind) => (
            <button type="button" className={directorButton} key={kind} onClick={() => move(kind)}>
              {kind}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm">
        Framing · {Math.round(shot.fov)}°
        <input
          aria-label="Camera framing"
          className="mt-3 w-full accent-amber-300"
          type="range"
          min={15}
          max={100}
          value={shot.fov}
          onChange={(event) =>
            update({ fov: Number(event.target.value), endFov: Number(event.target.value) })
          }
        />
        <span className="flex justify-between text-xs text-zinc-400">
          <span>Close</span>
          <span>Wide</span>
        </span>
      </label>
      <label className="block text-sm">
        Follow performer
        <select
          className={`${directorControl} mt-2`}
          value={shot.followCharacterId ?? ""}
          onChange={(event) => update({ followCharacterId: event.target.value || undefined })}
        >
          <option value="">Fixed camera path</option>
          {scene.characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </label>
      {scene.shots.indexOf(shot) < scene.shots.length - 1 ? (
        <label className="block text-sm">
          Cut to next shot at (seconds)
          <input
            className={`${directorControl} mt-2`}
            type="number"
            step={1}
            min={shot.start + 1}
            max={scene.shots[scene.shots.indexOf(shot) + 1]!.end - 1}
            value={shot.end}
            onChange={(event) => {
              const end = Number(event.target.value);
              const next = scene.shots[scene.shots.indexOf(shot) + 1]!;
              if (end <= shot.start || end >= next.end) return;
              onChange({
                ...scene,
                shots: scene.shots.map((item) =>
                  item.id === shot.id
                    ? { ...item, end }
                    : item.id === next.id
                      ? { ...item, start: end }
                      : item,
                ),
              });
            }}
          />
        </label>
      ) : (
        <label className="block text-sm">
          Scene end (seconds)
          <input
            className={`${directorControl} mt-2`}
            type="number"
            step={1}
            min={Math.max(
              shot.start + 1,
              ...scene.characters.flatMap((character) =>
                character.keyframes.map((frame) => frame.time),
              ),
              ...scene.cues.map((cue) => cue.end),
            )}
            max={120}
            value={scene.duration}
            onChange={(event) => {
              const duration = Number(event.target.value);
              if (duration <= shot.start || duration > 120) return;
              onChange({
                ...scene,
                duration,
                shots: scene.shots.map((item) =>
                  item.id === shot.id ? { ...item, end: duration } : item,
                ),
              });
            }}
          />
        </label>
      )}
      <details className="rounded-lg border border-white/10 p-3">
        <summary className="cursor-pointer text-sm text-zinc-300">Fine camera adjustments</summary>
        <div className="mt-3 space-y-3">
          {(["position", "endPosition", "target", "endTarget"] as const).map((key) => (
            <fieldset key={key}>
              <legend className="text-xs text-zinc-400">
                {
                  {
                    position: "Start position",
                    endPosition: "End position",
                    target: "Start focus",
                    endTarget: "End focus",
                  }[key]
                }{" "}
                (metres)
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["x", "y", "z"] as const).map((axis) => (
                  <label key={axis} className="text-xs">
                    {axis.toUpperCase()}
                    <input
                      className={`${directorControl} mt-1`}
                      type="number"
                      step={0.1}
                      min={-50}
                      max={50}
                      value={shot[key][axis]}
                      onChange={(event) =>
                        update({ [key]: { ...shot[key], [axis]: Number(event.target.value) } })
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </details>
    </div>
  );
}
