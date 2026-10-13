"use client";
import {
  sampleCharacter,
  type StudioScene,
  type StudioSelection,
  type StudioVector,
} from "@actbyme/shared";
export function StudioStageMap({
  scene,
  time,
  selected,
  onSelect,
  destination,
  onDestination,
}: {
  scene: StudioScene;
  time: number;
  selected: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
  destination: StudioVector | null;
  onDestination: (position: StudioVector) => void;
}) {
  const coordinates = [
    ...scene.characters.flatMap((item) => item.keyframes.map((frame) => frame.position)),
    ...scene.props.map((item) => item.position),
  ];
  const scale = Math.min(
    40,
    250 / Math.max(1, ...coordinates.map((item) => Math.abs(item.x))),
    130 / Math.max(1, ...coordinates.map((item) => Math.abs(item.z))),
  );
  return (
    <div className="rounded-xl border border-white/10 bg-[#15161a] p-4">
      <p className="mb-3 text-sm leading-6 text-zinc-300">
        Select a person or object. Tap an empty place to show the assistant a destination. Nothing
        moves until you ask the assistant.
      </p>
      <svg
        viewBox="0 0 600 360"
        className="aspect-[5/3] w-full"
        aria-label="Scene arrangement"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          onDestination({
            x: Math.max(
              -50,
              Math.min(50, (((event.clientX - bounds.left) / bounds.width) * 600 - 300) / scale),
            ),
            y: 0,
            z: Math.max(
              -50,
              Math.min(50, (((event.clientY - bounds.top) / bounds.height) * 360 - 180) / scale),
            ),
          });
        }}
      >
        <defs>
          <pattern id="studio-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeOpacity="0.08" />
          </pattern>
        </defs>
        <rect width="600" height="360" rx="16" fill="url(#studio-grid)" />
        <text x="300" y="24" textAnchor="middle" fill="#a1a1aa" fontSize="14">
          BACK OF THE SCENE
        </text>
        {scene.props.map((prop, index) => (
          <g
            key={prop.id}
            role="button"
            tabIndex={0}
            aria-label={"Select " + prop.kind + " " + (index + 1)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect({ kind: "prop", id: prop.id });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect({ kind: "prop", id: prop.id });
              }
            }}
            className="cursor-pointer outline-none focus:stroke-amber-300"
          >
            <rect
              x={300 + prop.position.x * scale - (prop.size.x * scale) / 2}
              y={180 + prop.position.z * scale - (prop.size.z * scale) / 2}
              width={Math.max(30, prop.size.x * scale)}
              height={Math.max(30, prop.size.z * scale)}
              rx="5"
              fill={prop.color}
              stroke={selected.kind === "prop" && selected.id === prop.id ? "#fde68a" : "#ffffff40"}
              strokeWidth="3"
            />
          </g>
        ))}
        {scene.characters.map((character) => {
          const pose = sampleCharacter(character, time, scene);
          const active = selected.kind === "character" && selected.id === character.id;
          return (
            <g
              key={character.id}
              role="button"
              tabIndex={0}
              aria-label={"Select " + character.name}
              onClick={(event) => {
                event.stopPropagation();
                onSelect({ kind: "character", id: character.id });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect({ kind: "character", id: character.id });
                }
              }}
              className="cursor-pointer outline-none focus:stroke-amber-300"
            >
              {active ? (
                <polyline
                  points={character.keyframes
                    .map(
                      (frame) =>
                        300 + frame.position.x * scale + "," + (180 + frame.position.z * scale),
                    )
                    .join(" ")}
                  stroke={character.color}
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  fill="none"
                />
              ) : null}
              <circle
                cx={300 + pose.position.x * scale}
                cy={180 + pose.position.z * scale}
                r="24"
                fill={character.color}
                stroke={active ? "#fef3c7" : "#111214"}
                strokeWidth="3"
              />
              <text
                x={300 + pose.position.x * scale}
                y={185 + pose.position.z * scale}
                textAnchor="middle"
                fill="#111214"
                fontSize="18"
                fontWeight="bold"
              >
                {character.name.slice(0, 1)}
              </text>
              <text
                x={300 + pose.position.x * scale}
                y={220 + pose.position.z * scale}
                textAnchor="middle"
                fill="#fafafa"
                fontSize="15"
              >
                {character.name}
              </text>
            </g>
          );
        })}
        {destination ? (
          <g
            aria-label="Selected destination"
            transform={
              "translate(" +
              (300 + destination.x * scale) +
              " " +
              (180 + destination.z * scale) +
              ")"
            }
          >
            <circle r="18" fill="none" stroke="#fde68a" strokeWidth="3" strokeDasharray="4 3" />
            <path d="M-8 0H8M0-8V8" stroke="#fde68a" strokeWidth="3" />
          </g>
        ) : null}
        <text x="300" y="345" textAnchor="middle" fill="#a1a1aa" fontSize="14">
          FRONT OF THE SCENE
        </text>
      </svg>
    </div>
  );
}
