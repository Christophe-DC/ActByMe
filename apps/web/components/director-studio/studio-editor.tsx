"use client";

import { studioActions, type StudioScene, type StudioVector } from "@actbyme/shared";
const inputStyle =
  "mt-1 w-full rounded-lg border border-white/20 bg-black/25 p-2 text-sm text-white";

function NumberField({
  label,
  value,
  onChange,
  min = -50,
  max = 50,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block text-xs text-zinc-300">
      {label}
      <input
        className={inputStyle}
        type="number"
        step="0.1"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const value = event.target.valueAsNumber;
          if (Number.isFinite(value)) onChange(value);
        }}
      />
    </label>
  );
}
function VectorFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StudioVector;
  onChange: (value: StudioVector) => void;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="text-xs text-zinc-300">{label}</legend>
      <div className="grid grid-cols-3 gap-2">
        {(["x", "y", "z"] as const).map((axis) => (
          <NumberField
            key={axis}
            label={`${label} ${axis}`}
            value={value[axis]}
            onChange={(next) => onChange({ ...value, [axis]: next })}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function StudioEditor({
  scene,
  selectedId,
  onSelect,
  onChange,
}: {
  scene: StudioScene;
  selectedId: string;
  onSelect: (id: string) => void;
  onChange: (scene: StudioScene) => void;
}) {
  const character = scene.characters.find((item) => item.id === selectedId) ?? scene.characters[0]!;
  const edit = (operation: (next: StudioScene) => void) => {
    const next = structuredClone(scene);
    operation(next);
    onChange(next);
  };
  const index = scene.characters.findIndex((item) => item.id === character.id);
  return (
    <div className="space-y-5 rounded-xl border border-white/10 p-4">
      <p className="text-sm text-zinc-300">
        Select a character, then click the floor to move its nearest keyframe. Use the fields below
        for precise edits. Changes are saved explicitly.
      </p>
      <NumberField
        label="Scene duration (seconds)"
        min={1}
        max={120}
        value={scene.duration}
        onChange={(value) =>
          edit((next) => {
            next.duration = value;
          })
        }
      />
      <label className="block text-sm">
        Character
        <select
          className={inputStyle}
          value={character.id}
          onChange={(event) => onSelect(event.target.value)}
        >
          {scene.characters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Name
        <input
          className={inputStyle}
          value={character.name}
          maxLength={160}
          onChange={(event) =>
            edit((next) => {
              next.characters[index]!.name = event.target.value;
            })
          }
        />
      </label>
      <details open>
        <summary className="cursor-pointer font-medium">
          Character trajectory, poses and gaze
        </summary>
        <div className="mt-3 space-y-4">
          {character.keyframes.map((frame, frameIndex) => (
            <fieldset key={frameIndex} className="rounded-lg border border-white/10 p-3">
              <legend className="text-sm">Keyframe {frameIndex + 1}</legend>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Time (seconds)"
                  min={0}
                  max={scene.duration}
                  value={frame.time}
                  onChange={(value) =>
                    edit((next) => {
                      next.characters[index]!.keyframes[frameIndex]!.time = value;
                    })
                  }
                />
                <NumberField
                  label="Orientation (degrees)"
                  min={-360}
                  max={360}
                  value={frame.rotation}
                  onChange={(value) =>
                    edit((next) => {
                      next.characters[index]!.keyframes[frameIndex]!.rotation = value;
                    })
                  }
                />
              </div>
              <label className="mt-3 block text-xs">
                Action
                <select
                  className={inputStyle}
                  value={frame.action}
                  onChange={(event) =>
                    edit((next) => {
                      next.characters[index]!.keyframes[frameIndex]!.action = event.target
                        .value as typeof frame.action;
                    })
                  }
                >
                  {studioActions.map((action) => (
                    <option key={action}>{action}</option>
                  ))}
                </select>
              </label>
              <VectorFields
                label="Position (m)"
                value={frame.position}
                onChange={(value) =>
                  edit((next) => {
                    next.characters[index]!.keyframes[frameIndex]!.position = value;
                  })
                }
              />
              <VectorFields
                label="Gaze target (m)"
                value={frame.gaze}
                onChange={(value) =>
                  edit((next) => {
                    next.characters[index]!.keyframes[frameIndex]!.gaze = value;
                  })
                }
              />
              {frameIndex > 0 ? (
                <button
                  className="mt-3 text-sm text-red-200"
                  onClick={() =>
                    edit((next) => {
                      next.characters[index]!.keyframes.splice(frameIndex, 1);
                    })
                  }
                >
                  Remove keyframe
                </button>
              ) : null}
            </fieldset>
          ))}
          <button
            className="text-sm text-amber-200"
            disabled={
              character.keyframes.length >= 120 ||
              character.keyframes.at(-1)!.time >= scene.duration
            }
            onClick={() =>
              edit((next) => {
                const last = next.characters[index]!.keyframes.at(-1)!;
                next.characters[index]!.keyframes.push({
                  ...structuredClone(last),
                  time: Math.min(scene.duration, last.time + 1),
                });
              })
            }
          >
            Add keyframe
          </button>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-medium">Cameras and shot timings</summary>
        <div className="mt-3 space-y-4">
          {scene.shots.map((shot, shotIndex) => (
            <fieldset key={shot.id} className="rounded-lg border border-white/10 p-3">
              <legend className="text-sm">{shot.name}</legend>
              <div className="grid grid-cols-3 gap-2">
                <NumberField
                  label="Start (s)"
                  min={0}
                  max={scene.duration}
                  value={shot.start}
                  onChange={(value) =>
                    edit((next) => {
                      next.shots[shotIndex]!.start = value;
                    })
                  }
                />
                <NumberField
                  label="End (s)"
                  min={0}
                  max={scene.duration}
                  value={shot.end}
                  onChange={(value) =>
                    edit((next) => {
                      next.shots[shotIndex]!.end = value;
                    })
                  }
                />
                <NumberField
                  label="Field of view"
                  min={15}
                  max={100}
                  value={shot.fov}
                  onChange={(value) =>
                    edit((next) => {
                      next.shots[shotIndex]!.fov = value;
                    })
                  }
                />
              </div>
              {(["position", "endPosition", "target", "endTarget"] as const).map((field) => (
                <VectorFields
                  key={field}
                  label={field}
                  value={shot[field]}
                  onChange={(value) =>
                    edit((next) => {
                      next.shots[shotIndex]![field] = value;
                    })
                  }
                />
              ))}
            </fieldset>
          ))}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-medium">Dialogue and acting directions</summary>
        <div className="mt-3 space-y-4">
          {scene.cues.map((cue, cueIndex) => (
            <fieldset key={cueIndex} className="rounded-lg border border-white/10 p-3">
              <legend className="text-sm">Cue {cueIndex + 1}</legend>
              <label className="text-xs">
                Character
                <select
                  className={inputStyle}
                  value={cue.characterId}
                  onChange={(event) =>
                    edit((next) => {
                      next.cues[cueIndex]!.characterId = event.target.value;
                    })
                  }
                >
                  {scene.characters.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <NumberField
                  label="Start (s)"
                  min={0}
                  max={scene.duration}
                  value={cue.start}
                  onChange={(value) =>
                    edit((next) => {
                      next.cues[cueIndex]!.start = value;
                    })
                  }
                />
                <NumberField
                  label="End (s)"
                  min={0}
                  max={scene.duration}
                  value={cue.end}
                  onChange={(value) =>
                    edit((next) => {
                      next.cues[cueIndex]!.end = value;
                    })
                  }
                />
              </div>
              <label className="mt-3 block text-xs">
                Dialogue
                <textarea
                  className={inputStyle}
                  value={cue.dialogue}
                  maxLength={4000}
                  onChange={(event) =>
                    edit((next) => {
                      next.cues[cueIndex]!.dialogue = event.target.value;
                    })
                  }
                />
              </label>
              <label className="mt-3 block text-xs">
                Direction
                <textarea
                  className={inputStyle}
                  value={cue.direction}
                  maxLength={1000}
                  onChange={(event) =>
                    edit((next) => {
                      next.cues[cueIndex]!.direction = event.target.value;
                    })
                  }
                />
              </label>
            </fieldset>
          ))}
        </div>
      </details>
    </div>
  );
}
