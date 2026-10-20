"use client";
import { samplePerformanceMotion, type PerformanceMotion } from "@actbyme/shared";
const links = [
  [0, 7],
  [0, 8],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];
export function PerformanceMotionOverlay({
  motion,
  time,
}: {
  motion: PerformanceMotion;
  time: number;
}) {
  const sample = samplePerformanceMotion(motion, time);
  const visible = (index: number) => sample[index * 4 + 3]! > 0.5;
  const point = (index: number) => [
    sample[132 + index * 2]! * motion.width,
    sample[133 + index * 2]! * motion.height,
  ];
  return (
    <svg
      className="performance-motion-overlay"
      viewBox={`0 0 ${motion.width} ${motion.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {links
        .filter(([first, second]) => visible(first!) && visible(second!))
        .map(([first, second]) => {
          const start = point(first!),
            end = point(second!);
          return (
            <line
              key={`${first}-${second}`}
              x1={start[0]}
              y1={start[1]}
              x2={end[0]}
              y2={end[1]}
              stroke="#f6c476"
              strokeWidth={3}
            />
          );
        })}
      {[0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].filter(visible).map((index) => {
        const at = point(index);
        return (
          <circle
            key={index}
            cx={at[0]}
            cy={at[1]}
            r={5}
            fill="#111214"
            stroke="#f6c476"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
