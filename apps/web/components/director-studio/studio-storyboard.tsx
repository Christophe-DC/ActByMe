"use client";
import { useState } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import {
  sampleCharacter,
  reorderStudioShots,
  type StudioScene,
  type StudioSelection,
  type StudioShot,
} from "@actbyme/shared";

function cameraPreview(scene: StudioScene, shot: StudioShot) {
  const camera = new PerspectiveCamera(shot.fov, 176 / 90, 0.1, 1000);
  camera.position.set(shot.position.x, shot.position.y, shot.position.z);
  camera.lookAt(shot.target.x, shot.target.y, shot.target.z);
  camera.updateMatrixWorld();
  return scene.characters.flatMap((character) => {
    const pose = sampleCharacter(character, shot.start);
    const feet = new Vector3(pose.position.x, pose.position.y, pose.position.z).project(camera);
    const head = new Vector3(pose.position.x, pose.position.y + 1.8, pose.position.z).project(
      camera,
    );
    if (head.z < -1 || head.z > 1) return [];
    const height = Math.max(4, (head.y - feet.y) * 45);
    return [
      {
        id: character.id,
        color: character.color,
        x: (head.x + 1) * 88,
        y: (1 - head.y) * 45,
        height,
      },
    ];
  });
}
export function StudioStoryboard({
  scene,
  selected,
  onSelect,
  onTime,
  onChange,
  disabled,
}: {
  scene: StudioScene;
  selected: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
  onTime: (time: number) => void;
  onChange: (scene: StudioScene) => void;
  disabled: boolean;
}) {
  const [dragged, setDragged] = useState("");
  return (
    <section aria-label="Storyboard">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Storyboard</h3>
        <span className="text-xs text-zinc-300">Drag cards to rearrange camera views</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {scene.shots.map((shot, index) => (
          <article
            key={shot.id}
            draggable={!disabled}
            onDragStart={() => setDragged(shot.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragged && !disabled) onChange(reorderStudioShots(scene, dragged, shot.id));
              setDragged("");
            }}
            className={`w-44 shrink-0 overflow-hidden rounded-xl border ${selected.kind === "shot" && selected.id === shot.id ? "border-amber-300" : "border-white/10"}`}
          >
            <button
              className="w-full text-left"
              onClick={() => {
                onSelect({ kind: "shot", id: shot.id });
                onTime(shot.start);
              }}
            >
              <svg viewBox="0 0 176 90" className="w-full bg-gradient-to-b from-zinc-800 to-black">
                <path
                  d="M0 75H176M30 90L75 40M146 90L101 40"
                  stroke="#ffffff"
                  strokeOpacity=".08"
                />
                {cameraPreview(scene, shot).map((character) => {
                  const radius = character.height / 8;
                  return (
                    <g key={character.id}>
                      <circle
                        cx={character.x}
                        cy={character.y + radius}
                        r={radius}
                        fill={character.color}
                      />
                      <rect
                        x={character.x - radius}
                        y={character.y + radius * 2.3}
                        width={radius * 2}
                        height={character.height * 0.7}
                        rx="3"
                        fill={character.color}
                      />
                    </g>
                  );
                })}
                <text x="10" y="16" fill="#fde68a" fontSize="10">
                  VIEW {index + 1}
                </text>
              </svg>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{shot.name}</p>
                <p className="mt-1 text-xs text-zinc-300">
                  {shot.start.toFixed(1)}–{shot.end.toFixed(1)}s
                </p>
              </div>
            </button>
            <div className="flex border-t border-white/10">
              <button
                aria-label={`Move view ${index + 1} earlier`}
                className="flex-1 py-1 text-sm text-zinc-300 disabled:opacity-30"
                disabled={disabled || index === 0}
                onClick={() =>
                  onChange(reorderStudioShots(scene, shot.id, scene.shots[index - 1]!.id))
                }
              >
                ←
              </button>
              <button
                aria-label={`Move view ${index + 1} later`}
                className="flex-1 py-1 text-sm text-zinc-300 disabled:opacity-30"
                disabled={disabled || index === scene.shots.length - 1}
                onClick={() =>
                  onChange(reorderStudioShots(scene, shot.id, scene.shots[index + 1]!.id))
                }
              >
                →
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
