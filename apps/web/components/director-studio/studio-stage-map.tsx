"use client";
import { useRef } from "react";
import { sampleCharacter, type StudioScene, type StudioVector } from "@actbyme/shared";
export function StudioStageMap({
  scene,
  time,
  selectedId,
  onSelect,
  onMove,
  disabled,
  selectedPropId,
  onSelectProp,
  onMoveProp,
}: {
  scene: StudioScene;
  time: number;
  selectedId?: string;
  onSelect: (id: string) => void;
  onMove: (id: string, position: StudioVector) => void;
  disabled: boolean;
  selectedPropId?: string;
  onSelectProp?: (id: string) => void;
  onMoveProp?: (id: string, position: StudioVector) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ id: string; kind: "character" | "prop" } | null>(null);
  const move = (clientX: number, clientY: number) => {
    if (!dragging.current || !svg.current) return;
    const rect = svg.current.getBoundingClientRect();
    const callback = dragging.current.kind === "prop" ? onMoveProp : onMove;
    callback?.(dragging.current.id, {
      x: (((clientX - rect.left) / rect.width) * 600 - 300) / 30,
      y: 0,
      z: (((clientY - rect.top) / rect.height) * 360 - 180) / 30,
    });
  };
  return (
    <div className="rounded-xl border border-white/10 bg-[#15161a] p-3">
      <p className="mb-3 text-sm text-zinc-300">
        Drag people or objects to place them. Use the arrow keys for small moves.
      </p>
      <svg
        ref={svg}
        viewBox="0 0 600 360"
        preserveAspectRatio="none"
        className="h-[320px] w-full touch-none"
        aria-label="Scene arrangement"
        onPointerMove={(event) => move(event.clientX, event.clientY)}
        onPointerUp={() => {
          dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        <defs>
          <pattern id="studio-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#ffffff" strokeOpacity="0.06" />
          </pattern>
        </defs>
        <rect width="600" height="360" rx="16" fill="url(#studio-grid)" />
        <text x="300" y="28" textAnchor="middle" fill="#a1a1aa" fontSize="12">
          BACK OF THE SCENE
        </text>
        {scene.props.map((prop, index) => (
          <rect
            key={prop.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Move ${prop.kind} ${index + 1}`}
            stroke={selectedPropId === prop.id ? "#fde68a" : "none"}
            strokeWidth="3"
            onPointerDown={(event) => {
              if (disabled) return;
              onSelectProp?.(prop.id);
              dragging.current = { id: prop.id, kind: "prop" };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (disabled) return;
              const offsets: Record<string, [number, number]> = {
                ArrowLeft: [-0.2, 0],
                ArrowRight: [0.2, 0],
                ArrowUp: [0, -0.2],
                ArrowDown: [0, 0.2],
              };
              const offset = offsets[event.key];
              if (offset) {
                event.preventDefault();
                onSelectProp?.(prop.id);
                onMoveProp?.(prop.id, {
                  ...prop.position,
                  x: prop.position.x + offset[0],
                  z: prop.position.z + offset[1],
                });
              }
            }}
            x={300 + prop.position.x * 30 - prop.size.x * 15}
            y={180 + prop.position.z * 30 - prop.size.z * 15}
            width={prop.size.x * 30}
            height={prop.size.z * 30}
            rx="4"
            fill={prop.color}
            opacity="0.7"
            className="cursor-grab outline-none focus:stroke-amber-300 active:cursor-grabbing"
          />
        ))}
        {scene.characters.map((character) => {
          const pose = sampleCharacter(character, time);
          return (
            <g
              key={character.id}
              role="button"
              tabIndex={disabled ? -1 : 0}
              aria-label={`Move ${character.name}`}
              onPointerDown={(event) => {
                if (disabled) return;
                onSelect(character.id);
                dragging.current = { id: character.id, kind: "character" };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onKeyDown={(event) => {
                if (disabled) return;
                const offsets: Record<string, [number, number]> = {
                  ArrowLeft: [-0.2, 0],
                  ArrowRight: [0.2, 0],
                  ArrowUp: [0, -0.2],
                  ArrowDown: [0, 0.2],
                };
                const offset = offsets[event.key];
                if (offset) {
                  event.preventDefault();
                  onSelect(character.id);
                  onMove(character.id, {
                    ...pose.position,
                    x: pose.position.x + offset[0],
                    z: pose.position.z + offset[1],
                  });
                }
              }}
              className="cursor-grab outline-none focus:stroke-amber-300 active:cursor-grabbing"
            >
              {character.id === selectedId ? (
                <polyline
                  points={character.keyframes
                    .map((frame) => `${300 + frame.position.x * 30},${180 + frame.position.z * 30}`)
                    .join(" ")}
                  stroke={character.color}
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  fill="none"
                />
              ) : null}
              <circle
                cx={300 + pose.position.x * 30}
                cy={180 + pose.position.z * 30}
                r={character.id === selectedId ? 19 : 16}
                fill={character.color}
                stroke={character.id === selectedId ? "#fef3c7" : "#111214"}
                strokeWidth="3"
              />
              <text
                x={300 + pose.position.x * 30}
                y={184 + pose.position.z * 30}
                textAnchor="middle"
                fill="#111214"
                fontSize="13"
                fontWeight="bold"
              >
                {character.name.slice(0, 1)}
              </text>
              <text
                x={300 + pose.position.x * 30}
                y={215 + pose.position.z * 30}
                textAnchor="middle"
                fill="#fafafa"
                fontSize="12"
              >
                {character.name}
              </text>
            </g>
          );
        })}
        <text x="300" y="345" textAnchor="middle" fill="#a1a1aa" fontSize="12">
          FRONT OF THE SCENE
        </text>
      </svg>
    </div>
  );
}
