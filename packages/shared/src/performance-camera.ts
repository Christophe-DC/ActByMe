import { z } from "zod";

export const performancePresetIds = [
  "front",
  "profile",
  "close-up",
  "mouth",
  "hands",
  "overhead",
  "behind",
  "low-angle",
  "over-shoulder",
  "orbit",
] as const;
export const performanceCameraSchema = z
  .object({
    preset: z.enum(performancePresetIds),
    azimuth: z.number().finite().min(-180).max(180),
    elevation: z.number().finite().min(-30).max(85),
    distance: z.number().finite().min(0.2).max(10),
    lens: z.number().finite().min(20).max(100),
    focus: z.enum(["body", "face", "mouth", "hands"]),
    movement: z.enum(["static", "push-in", "pull-out", "orbit"]),
    arc: z.number().finite().min(-180).max(180),
  })
  .strict();
export const performanceReferenceSchema = z
  .object({
    sourceAssetId: z.uuid().nullable(),
    sourceDuration: z.number().finite().min(0.5).max(120).nullable(),
    originalAudio: z.boolean(),
  })
  .strict();
export type PerformanceCamera = z.infer<typeof performanceCameraSchema>;
export type PerformancePresetId = (typeof performancePresetIds)[number];
const camera = (
  preset: PerformancePresetId,
  values: Partial<PerformanceCamera>,
): PerformanceCamera => ({
  preset,
  azimuth: 0,
  elevation: 0,
  distance: 3.8,
  lens: 45,
  focus: "body",
  movement: "static",
  arc: 90,
  ...values,
});
export const performancePresets: {
  id: PerformancePresetId;
  name: string;
  description: string;
  camera: PerformanceCamera;
}[] = [
  {
    id: "front",
    name: "Front",
    description: "See the whole neutral figure from the front.",
    camera: camera("front", {}),
  },
  {
    id: "profile",
    name: "Profile",
    description: "A side view of the figure.",
    camera: camera("profile", { azimuth: 90, distance: 2.6, focus: "face" }),
  },
  {
    id: "close-up",
    name: "Close-up",
    description: "Frame the face. Facial expressions are not reproduced.",
    camera: camera("close-up", { distance: 0.9, lens: 50, focus: "face" }),
  },
  {
    id: "mouth",
    name: "Mouth",
    description: "Plan a mouth detail. No lip sync is simulated.",
    camera: camera("mouth", { distance: 0.38, lens: 55, focus: "mouth" }),
  },
  {
    id: "hands",
    name: "Hands",
    description: "Frame the stand-in's hands. Actual gestures remain in the original video.",
    camera: camera("hands", { distance: 1.6, lens: 45, focus: "hands", elevation: 12 }),
  },
  {
    id: "overhead",
    name: "Overhead",
    description: "Look down at the figure from above.",
    camera: camera("overhead", { elevation: 75, distance: 3.5 }),
  },
  {
    id: "behind",
    name: "Behind",
    description: "Frame the back of the figure.",
    camera: camera("behind", { azimuth: 180 }),
  },
  {
    id: "low-angle",
    name: "Low angle",
    description: "Look up toward the figure.",
    camera: camera("low-angle", { elevation: -18, distance: 3 }),
  },
  {
    id: "over-shoulder",
    name: "Over shoulder",
    description: "A view from behind one shoulder.",
    camera: camera("over-shoulder", { azimuth: 145, distance: 1.7, focus: "face" }),
  },
  {
    id: "orbit",
    name: "Orbit",
    description: "Move the camera in an arc around the neutral figure.",
    camera: camera("orbit", { movement: "orbit", distance: 2.8, focus: "face" }),
  },
];

export function samplePerformanceCamera(camera: PerformanceCamera, progress: number) {
  const time = Math.max(0, Math.min(1, progress));
  const smooth = time * time * (3 - 2 * time);
  const angle =
    ((camera.azimuth + (camera.movement === "orbit" ? camera.arc * smooth : 0)) * Math.PI) / 180;
  const elevation = (camera.elevation * Math.PI) / 180;
  const distance =
    camera.distance *
    (camera.movement === "push-in"
      ? 1 - 0.3 * smooth
      : camera.movement === "pull-out"
        ? 1 + 0.3 * smooth
        : 1);
  const target = {
    x: 0,
    y:
      camera.focus === "face"
        ? 1.56
        : camera.focus === "mouth"
          ? 1.48
          : camera.focus === "hands"
            ? 0.94
            : 0.9,
    z: camera.focus === "hands" ? 0.28 : 0.08,
  };
  return {
    position: {
      x: target.x + Math.sin(angle) * Math.cos(elevation) * distance,
      y: Math.max(0.1, target.y + Math.sin(elevation) * distance),
      z: target.z + Math.cos(angle) * Math.cos(elevation) * distance,
    },
    target,
    lens: camera.lens,
  };
}
