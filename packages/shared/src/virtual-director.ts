import { z } from "zod";
import {
  baseSceneSchema,
  studioSceneSchema,
  type StudioScene,
  type StudioShot,
} from "./director-studio.js";

export const virtualDirectorLimits = {
  maxUploadBytes: 200 * 1024 * 1024,
  minShotSeconds: 4,
  maxShotSeconds: 15,
  maxReferenceSeconds: 120,
} as const;
export const virtualRightsSchema = z
  .object({
    performerName: z.string().trim().min(2).max(160),
    rightsBasis: z.string().trim().min(10).max(2000),
    ownsOrLicensed: z.literal(true),
    aiTransformation: z.literal(true),
    providerTransfer: z.literal(true),
  })
  .strict();
export const virtualUploadSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    contentType: z.enum(["video/mp4", "video/quicktime"]),
    sizeBytes: z.number().int().positive().max(virtualDirectorLimits.maxUploadBytes),
    rights: virtualRightsSchema,
  })
  .strict();
export const virtualSaveSchema = z
  .object({ version: z.number().int().nonnegative(), scene: studioSceneSchema })
  .strict();
export const virtualGenerateSchema = z
  .object({
    version: z.number().int().nonnegative(),
    requestKey: z.uuid(),
    kind: z.enum(["PREVIEW", "GENERATE"]),
    shotId: z.string().min(1).max(40),
    referenceId: z.uuid().optional(),
    instructions: z.string().trim().max(3000).default(""),
    sourceStartSeconds: z.number().finite().min(0).max(120).optional(),
    maxCostCents: z.number().int().min(0).max(100000),
  })
  .strict();
export const virtualJobInputSchema = z.object({
  scene: studioSceneSchema,
  shot: baseSceneSchema.shape.shots.element,
  instructions: z.string(),
  sourceStartSeconds: z.number().finite().min(0).max(120),
  model: z.literal("bytedance/seedance-2.0/reference-to-video"),
  sourceConsentId: z.string().nullable(),
});
export type VirtualJobInput = z.infer<typeof virtualJobInputSchema>;
export const virtualActiveStatuses = ["QUEUED", "PROCESSING", "SUBMITTING", "WAITING_PROVIDER"];
export function virtualShotError(shot: StudioShot, referenceDuration?: number) {
  const duration = shot.end - shot.start;
  if (duration < 4 || duration > 15 || Math.abs(duration - Math.round(duration)) > 0.001)
    return "Seedance requires each shot to last a whole number of seconds, between 4 and 15. Split longer shots or adjust the cut times.";
  if (referenceDuration !== undefined && shot.end > referenceDuration + 0.05)
    return "This shot extends beyond the reference performance. Shorten the scene or upload a longer reference.";
  return null;
}
export function virtualCameraPrompt(input: VirtualJobInput) {
  const { shot, instructions } = input;
  const point = (value: { x: number; y: number; z: number }) =>
    `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`;
  return [
    "Reinterpret exactly the performance in @Video1 as ONE continuous cinematic take from a new camera angle.",
    "Preserve the same identifiable performer, facial appearance, clothing, environment, lighting, actions, emotional intent and action timing. No new dialogue, characters, props or cuts.",
    `Shot: ${shot.name}. Duration: ${shot.end - shot.start} seconds.`,
    "Camera coordinates are staging directions in metres, Y up; the performer is near the origin, looking towards positive Z. They describe the requested viewpoint, not recovered 3D geometry.",
    `Camera moves from ${point(shot.position)} to ${point(shot.endPosition)}; look-at from ${point(shot.target)} to ${point(shot.endTarget)}. Vertical field of view: ${shot.fov} to ${shot.endFov ?? shot.fov} degrees. Motion easing: ${shot.easing ?? "linear"}.`,
    shot.followCharacterId
      ? "Track the performer while maintaining the requested camera offset."
      : "",
    shot.lookAtCharacterId ? "Keep the performer in focus throughout their movement." : "",
    instructions ? `Director instructions: ${instructions}` : "",
    "Keep temporal continuity with the supplied reference clip. Do not render diagrams, mannequins or camera equipment.",
  ]
    .filter(Boolean)
    .join("\n");
}
export function defaultVirtualScene(title: string, framing?: string | null): StudioScene {
  const target = { x: 0, y: 1.3, z: 0 };
  return studioSceneSchema.parse({
    title,
    duration: 5,
    characters: [
      {
        id: "performer",
        name: "Performance reference",
        color: "#e9b85c",
        keyframes: [
          {
            time: 0,
            position: { x: 0, y: 0, z: 0 },
            rotation: 0,
            gaze: { x: 0, y: 1.6, z: 5 },
            action: "idle",
          },
        ],
      },
    ],
    props: [],
    cues: [],
    shots: [
      {
        id: "camera_1",
        name: framing?.slice(0, 160) || "Medium shot",
        start: 0,
        end: 5,
        position: { x: 0, y: 1.6, z: 4 },
        endPosition: { x: 0, y: 1.6, z: 4 },
        target,
        endTarget: target,
        fov: 45,
      },
    ],
  });
}
export type VirtualReference = {
  id: string;
  name: string;
  status: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
  error: string | null;
  rights: { performerName: string; rightsBasis: string };
  createdAt: string;
};
export type VirtualJob = {
  id: string;
  kind: string;
  shotId: string | null;
  shotName: string;
  status: string;
  stage: string;
  error: string | null;
  estimatedCostCents: number;
  approvedAt: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type VirtualDirectorState = {
  projectId: string;
  title: string;
  version: number;
  scene: StudioScene | null;
  references: VirtualReference[];
  jobs: VirtualJob[];
  takes: { id: string; name: string }[];
  capabilities: {
    workerReady: boolean;
    blenderReady: boolean;
    generationReady: boolean;
    pricePerSecondCents: number;
    monthlyBudgetCents: number;
    reservedCents: number;
    reason: string | null;
    model: string;
  };
};
