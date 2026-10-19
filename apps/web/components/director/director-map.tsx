"use client";
import { useRef, useState } from "react";
import {
  directorCastTimelinePosition,
  directorDuration,
  directorShotAt,
  sampleDirectorCamera,
  type DirectorDocument,
  type DirectorShot,
  type DirectorVector,
} from "@actbyme/shared";
const project = (position: DirectorVector) => ({
  x: 300 + position.x * 16,
  y: 140 + position.z * 10,
});
export function DirectorMap({
  document,
  shot,
  time,
  selectedWaypoint,
  onSelect,
  onMove,
  onSeek,
}: {
  document: DirectorDocument;
  shot: DirectorShot;
  time: number;
  selectedWaypoint: string;
  onSelect: (id: string) => void;
  onMove: (id: string, position: DirectorVector) => void;
  onSeek: (time: number) => void;
}) {
  const root = useRef<SVGSVGElement>(null),
    [drag, setDrag] = useState<{ id: string; x: number; z: number } | null>(null);
  const points = Array.from({ length: 90 }, (_, index) =>
    project(sampleDirectorCamera(shot, (index / 89) * shot.duration).position),
  );
  const minimumX = Math.min(0, ...points.map((point) => point.x - 30)),
    maximumX = Math.max(600, ...points.map((point) => point.x + 30));
  const minimumY = Math.min(0, ...points.map((point) => point.y - 30)),
    maximumY = Math.max(280, ...points.map((point) => point.y + 30));
  const current = directorShotAt(document, time),
    camera = project(
      sampleDirectorCamera(
        current.shot,
        current.localTime,
        document.cast,
        time,
        directorDuration(document),
        document,
      ).position,
    );
  let start = 0;
  for (const item of document.shots) {
    if (item.id === shot.id) break;
    start += item.duration;
  }
  return (
    <svg
      ref={root}
      className="director-map"
      viewBox={`${minimumX} ${minimumY} ${maximumX - minimumX} ${maximumY - minimumY}`}
      role="group"
      aria-label="Vue du dessus et trajectoire de caméra"
      onPointerMove={(event) => {
        if (!drag || !root.current) return;
        const matrix = root.current.getScreenCTM();
        if (!matrix) return;
        const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        const x = Math.max(-100, Math.min(100, (at.x - 300) / 16));
        const z = Math.max(-100, Math.min(100, (at.y - 140) / 10));
        setDrag({ id: drag.id, x, z });
      }}
      onPointerUp={() => {
        if (drag) {
          const point = shot.waypoints.find((point) => point.id === drag.id)!;
          onMove(drag.id, {
            ...point.position,
            x: Math.round(drag.x * 10) / 10,
            z: Math.round(drag.z * 10) / 10,
          });
          setDrag(null);
        }
      }}
      onPointerCancel={() => setDrag(null)}
    >
      <defs>
        <pattern id="director-grid" width="16" height="10" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 10" fill="none" stroke="#ffffff" strokeOpacity="0.045" />
        </pattern>
        <linearGradient id="director-sea">
          <stop stopColor="#243f45" />
          <stop offset="1" stopColor="#23353b" />
        </linearGradient>
      </defs>
      <rect width="600" height="280" fill="#1b2523" />
      <rect width="600" height="50" fill="url(#director-sea)" />
      <rect width="600" height="280" fill="url(#director-grid)" />
      {document.environment === "coastal" ? (
        <g>
          <path d="M190 65 H405 V211 H190Z" fill="#555346" stroke="#a5a08c" strokeWidth="3" />
          <path d="M190 130 H247 M343 130 H405 M330 65 V130" stroke="#a5a08c" strokeWidth="3" />
          <rect x="203" y="85" width="60" height="21" rx="4" fill="#8c8776" />
          <rect x="212" y="112" width="44" height="23" rx="9" fill="#766e59" />
          <rect x="356" y="85" width="34" height="49" rx="2" fill="#a49b82" />
          <rect x="186" y="214" width="223" height="27" fill="#5f604a" />
          <rect x="135" y="145" width="45" height="72" rx="3" fill="#395b60" />
          <text x="214" y="167">
            Living room
          </text>
          <text x="342" y="166">
            Kitchen
          </text>
          <text x="268" y="228">
            Garden
          </text>
          <text x="270" y="45">
            Coastal terrace
          </text>
          {[
            [145, 100],
            [434, 94],
            [178, 248],
            [426, 235],
            [132, 238],
          ].map(([x, y], index) => (
            <circle key={index} cx={x} cy={y} r="13" fill="#4b5e46" opacity="0.9" />
          ))}
        </g>
      ) : (
        <g>
          <rect x="190" y="70" width="220" height="155" fill="#373b38" stroke="#83877e" />
          <circle cx="300" cy="140" r="17" fill="#8c826d" />
          <text x="266" y="208">
            Product stage
          </text>
        </g>
      )}
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke="#edbd72"
        strokeWidth="2.5"
      />
      {document.cast.map((person) => {
        const at = project(directorCastTimelinePosition(document, person, time));
        return (
          <g key={person.id}>
            <circle cx={at.x} cy={at.y} r="6" fill="#bb9ae2" />
            <text x={at.x + 10} y={at.y - 8}>
              {person.name.slice(0, 20)}
            </text>
          </g>
        );
      })}
      {shot.waypoints.map((point, index) => {
        const position =
          drag?.id === point.id
            ? project({ ...point.position, x: drag.x, z: drag.z })
            : project(point.position);
        return (
          <g
            key={point.id}
            tabIndex={0}
            role="button"
            aria-label={`Waypoint ${index + 1}`}
            onKeyDown={(event) => {
              if (["Enter", " "].includes(event.key)) {
                event.preventDefault();
                onSelect(point.id);
                onSeek(start + point.at * shot.duration);
              }
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                event.preventDefault();
                onSelect(point.id);
                onMove(point.id, {
                  ...point.position,
                  x:
                    point.position.x +
                    (event.key === "ArrowLeft" ? -0.25 : event.key === "ArrowRight" ? 0.25 : 0),
                  z:
                    point.position.z +
                    (event.key === "ArrowUp" ? -0.25 : event.key === "ArrowDown" ? 0.25 : 0),
                });
              }
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              onSelect(point.id);
              onSeek(start + point.at * shot.duration);
              event.currentTarget.setPointerCapture(event.pointerId);
              setDrag({ id: point.id, x: point.position.x, z: point.position.z });
            }}
            style={{ cursor: "grab" }}
          >
            <circle cx={position.x} cy={position.y} r="22" fill="transparent" />
            <circle
              cx={position.x}
              cy={position.y}
              r={selectedWaypoint === point.id ? 12 : 10}
              fill={selectedWaypoint === point.id ? "#edbd72" : "#263434"}
              stroke="#edbd72"
              strokeWidth="1.5"
            />
            <text
              x={position.x}
              y={position.y + 4}
              textAnchor="middle"
              fill={selectedWaypoint === point.id ? "#121212" : "#fff"}
            >
              {index + 1}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${camera.x},${camera.y})`} pointerEvents="none">
        <circle r="5" fill="#fff" />
        <circle r="9" fill="none" stroke="white" opacity="0.5" />
      </g>
    </svg>
  );
}
