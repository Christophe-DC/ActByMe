"use client";
import {
  characterMoment,
  retimeStudioScene,
  setStudioCameraPreset,
  studioActionLabels,
  studioActions,
  sampleCharacter,
  type StudioScene,
  type StudioSelection,
} from "@actbyme/shared";
const field =
  "mt-2 w-full rounded-xl border border-white/15 bg-[#17171b] px-3 py-2.5 text-sm text-white";
export function StudioInspector({
  scene,
  selected,
  time,
  onChange,
  disabled,
}: {
  scene: StudioScene;
  selected: StudioSelection;
  time: number;
  onChange: (scene: StudioScene, group?: string) => void;
  disabled: boolean;
}) {
  const character = scene.characters.find((item) => item.id === selected.id);
  const shot = scene.shots.find((item) => item.id === selected.id);
  const cue = scene.cues[Number(selected.id)];
  const prop = scene.props.find((item) => item.id === selected.id);
  const edit = (operation: (next: StudioScene) => void, group?: string) => {
    const next = structuredClone(scene);
    operation(next);
    onChange(next, group);
  };
  return (
    <fieldset disabled={disabled} className="space-y-4">
      {selected.kind === "scene" ? (
        <>
          <label className="block text-sm">
            Scene name
            <input
              className={field}
              value={scene.title}
              maxLength={160}
              onChange={(event) => {
                if (event.target.value.trim())
                  edit((next) => {
                    next.title = event.target.value;
                  }, "scene-name");
              }}
            />
          </label>
          <label className="block text-sm">
            Scene length · {scene.duration.toFixed(0)} seconds
            <input
              aria-label="Scene length"
              className="mt-3 w-full accent-amber-300"
              type="range"
              min="5"
              max="120"
              step="1"
              value={scene.duration}
              onChange={(event) =>
                onChange(retimeStudioScene(scene, Number(event.target.value)), "scene-length")
              }
            />
          </label>
          <p className="text-xs leading-5 text-zinc-300">
            Changing the length keeps all movements and dialogue in proportion.
          </p>
        </>
      ) : null}
      {selected.kind === "character" && character ? (
        <>
          <label className="block text-sm">
            Character name
            <input
              className={field}
              value={character.name}
              maxLength={160}
              onChange={(event) => {
                if (event.target.value.trim())
                  edit((next) => {
                    next.characters.find((item) => item.id === character.id)!.name =
                      event.target.value;
                  }, `name:${character.id}`);
              }}
            />
          </label>
          <div>
            <p className="text-sm">Character color</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["#e7ad52", "#76aee8", "#ad8fce", "#80c5aa", "#e992a6", "#ded4c3"].map((color) => (
                <button
                  key={color}
                  aria-label={`Choose ${{ "#e7ad52": "gold", "#76aee8": "blue", "#ad8fce": "lavender", "#80c5aa": "mint", "#e992a6": "rose", "#ded4c3": "ivory" }[color]} for ${character.name}`}
                  aria-pressed={character.color === color}
                  className="size-8 rounded-full border-2 border-white/30 aria-pressed:ring-2 aria-pressed:ring-amber-200"
                  style={{ background: color }}
                  onClick={() =>
                    edit((next) => {
                      next.characters.find((item) => item.id === character.id)!.color = color;
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm">
              At {time.toFixed(1)}s, {character.name} should…
            </p>
            <div className="grid grid-cols-2 gap-2">
              {studioActions.map((action) => (
                <button
                  key={action}
                  aria-pressed={sampleCharacter(character, time).action === action}
                  className="rounded-xl border border-white/15 px-3 py-2 text-left text-sm aria-pressed:border-amber-300 aria-pressed:bg-amber-300/10"
                  onClick={() => {
                    const next = characterMoment(scene, character.id, time);
                    next.frame.action = action;
                    onChange(next.scene);
                  }}
                >
                  {studioActionLabels[action]}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            Look towards
            <select
              className={field}
              value=""
              onChange={(event) => {
                const next = characterMoment(scene, character.id, time);
                const other = scene.characters.find((item) => item.id === event.target.value);
                next.frame.gaze = other
                  ? { ...sampleCharacter(other, time).position, y: 1.6 }
                  : { x: 0, y: 1.6, z: 5 };
                const position = next.frame.position;
                next.frame.rotation =
                  (Math.atan2(next.frame.gaze.x - position.x, next.frame.gaze.z - position.z) *
                    180) /
                  Math.PI;
                onChange(next.scene);
              }}
            >
              <option value="">Choose a person or the viewer</option>
              <option value="camera">The viewer</option>
              {scene.characters
                .filter((item) => item.id !== character.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-xs leading-5 text-zinc-300">
            Drag this character in the scene to create a movement at the current time.
          </p>
          <button
            className="text-sm text-red-200 disabled:opacity-40"
            disabled={scene.characters.length <= 1}
            onClick={() =>
              edit((next) => {
                next.characters = next.characters.filter((item) => item.id !== character.id);
                next.cues = next.cues.filter((item) => item.characterId !== character.id);
              })
            }
          >
            Remove character
          </button>
        </>
      ) : null}
      {selected.kind === "shot" && shot ? (
        <>
          <p className="text-sm text-zinc-300">Choose how this moment should feel.</p>
          <div className="grid grid-cols-2 gap-2">
            {(["wide", "medium", "close", "tracking"] as const).map((preset) => (
              <button
                key={preset}
                className="rounded-xl border border-white/15 px-3 py-3 text-left text-sm hover:border-amber-300"
                onClick={() =>
                  onChange(setStudioCameraPreset(scene, shot.id, preset, scene.characters[0]!.id))
                }
              >
                {
                  {
                    wide: "Show everyone",
                    medium: "Conversation",
                    close: "Close-up",
                    tracking: "Follow the action",
                  }[preset]
                }
              </button>
            ))}
          </div>
          <label className="block text-sm">
            Focus on
            <select
              className={field}
              defaultValue=""
              key={shot.id}
              onChange={(event) =>
                onChange(setStudioCameraPreset(scene, shot.id, "medium", event.target.value))
              }
            >
              <option value="" disabled>
                Choose a character
              </option>
              {scene.characters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-sm text-red-200 disabled:opacity-40"
            disabled={scene.shots.length <= 1}
            onClick={() =>
              edit((next) => {
                const index = next.shots.findIndex((item) => item.id === shot.id);
                if (index > 0) next.shots[index - 1]!.end = shot.end;
                else next.shots[1]!.start = 0;
                next.shots.splice(index, 1);
              })
            }
          >
            Remove camera view
          </button>
          <p className="text-xs leading-5 text-zinc-300">
            Adjust the camera’s duration by dragging its edge on the timeline. Describe any other
            camera move to the AI below.
          </p>
        </>
      ) : null}
      {selected.kind === "cue" && cue ? (
        <>
          <label className="block text-sm">
            Who speaks?
            <select
              className={field}
              value={cue.characterId}
              onChange={(event) =>
                edit((next) => {
                  next.cues[Number(selected.id)]!.characterId = event.target.value;
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
          <label className="block text-sm">
            What do they say?
            <textarea
              className={field}
              rows={3}
              maxLength={4000}
              value={cue.dialogue}
              onChange={(event) =>
                edit((next) => {
                  next.cues[Number(selected.id)]!.dialogue = event.target.value;
                }, `dialogue:${selected.id}`)
              }
            />
          </label>
          <label className="block text-sm">
            How should they perform it?
            <textarea
              className={field}
              rows={2}
              maxLength={1000}
              value={cue.direction}
              onChange={(event) =>
                edit((next) => {
                  next.cues[Number(selected.id)]!.direction = event.target.value;
                }, `direction:${selected.id}`)
              }
            />
          </label>
        </>
      ) : null}
      {selected.kind === "cue" && cue ? (
        <button
          className="text-sm text-red-200"
          onClick={() =>
            edit((next) => {
              next.cues.splice(Number(selected.id), 1);
            })
          }
        >
          Remove dialogue
        </button>
      ) : null}
      {selected.kind === "prop" && prop ? (
        <>
          <p className="text-sm capitalize">{prop.kind}</p>
          <label className="block text-sm">
            Place in the room
            <select
              className={field}
              value=""
              onChange={(event) =>
                edit((next) => {
                  const item = next.props.find((item) => item.id === prop.id)!;
                  item.position = {
                    x: event.target.value === "left" ? -2 : event.target.value === "right" ? 2 : 0,
                    y: item.position.y,
                    z: event.target.value === "back" ? -2 : 0,
                  };
                })
              }
            >
              <option value="">Choose a place</option>
              <option value="left">Left side</option>
              <option value="center">Center</option>
              <option value="right">Right side</option>
              <option value="back">Back</option>
            </select>
          </label>
          <button
            className="text-sm text-red-200"
            onClick={() =>
              edit((next) => {
                next.props = next.props.filter((item) => item.id !== prop.id);
              })
            }
          >
            Remove object
          </button>
        </>
      ) : null}
    </fieldset>
  );
}
