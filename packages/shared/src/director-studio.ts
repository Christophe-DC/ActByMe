import { z } from "zod";

const identifier = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/);
const label = z.string().min(1).max(160);
const coordinate = z.number().finite().min(-50).max(50);
export const studioVectorSchema = z.object({ x: coordinate, y: coordinate, z: coordinate });
const time = z.number().finite().min(0).max(120);
export const studioActions = ["idle", "walk", "turn", "wave", "point", "sit"] as const;
const keyframe = z.object({
  time,
  position: studioVectorSchema,
  rotation: z.number().finite().min(-360).max(360),
  gaze: studioVectorSchema,
  action: z.enum(studioActions),
});
export const baseSceneSchema = z.object({
  title: label,
  duration: z.number().finite().min(1).max(120),
  characters: z
    .array(
      z.object({
        id: identifier,
        name: label,
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        keyframes: z.array(keyframe).min(1).max(120),
      }),
    )
    .min(1)
    .max(6),
  props: z
    .array(
      z.object({
        id: identifier,
        kind: z.enum(["box", "table", "chair"]),
        position: studioVectorSchema,
        size: z.object({
          x: z.number().min(0.1).max(20),
          y: z.number().min(0.1).max(20),
          z: z.number().min(0.1).max(20),
        }),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      }),
    )
    .max(20),
  shots: z
    .array(
      z.object({
        id: identifier,
        name: label,
        start: time,
        end: time,
        position: studioVectorSchema,
        endPosition: studioVectorSchema,
        target: studioVectorSchema,
        endTarget: studioVectorSchema,
        fov: z.number().finite().min(15).max(100),
      }),
    )
    .min(1)
    .max(24),
  cues: z
    .array(
      z.object({
        characterId: identifier,
        start: time,
        end: time,
        dialogue: z.string().max(4000),
        direction: z.string().max(1000),
      }),
    )
    .max(120),
});

// Keep the provider grammar compact; all bounds and cross-references are enforced
// by studioSceneSchema on the server, including after manual edits.
export function providerSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            "$schema",
            "minimum",
            "maximum",
            "minLength",
            "maxLength",
            "minItems",
            "maxItems",
            "pattern",
          ].includes(key),
      )
      .map(([key, nested]) => [key, providerSchema(nested)]),
  );
}
export const studioSceneJsonSchema = providerSchema(z.toJSONSchema(baseSceneSchema)) as Record<
  string,
  unknown
>;
export const studioSceneSchema = baseSceneSchema.superRefine((scene, context) => {
  const fail = (message: string) => context.addIssue({ code: "custom", message });
  const ids = scene.characters.map((character) => character.id);
  if (new Set(ids).size !== ids.length) fail("Character identifiers must be unique.");
  if (new Set(scene.shots.map((shot) => shot.id)).size !== scene.shots.length)
    fail("Shot identifiers must be unique.");
  if (new Set(scene.props.map((prop) => prop.id)).size !== scene.props.length)
    fail("Prop identifiers must be unique.");
  for (const character of scene.characters) {
    if (character.keyframes[0]?.time !== 0)
      fail("Every character needs an initial keyframe at zero.");
    character.keyframes.forEach((frame, index) => {
      if (
        frame.time > scene.duration ||
        (index > 0 && frame.time <= character.keyframes[index - 1]!.time)
      )
        fail("Keyframes must be strictly ordered within the duration.");
    });
  }
  let end = 0;
  for (const shot of scene.shots) {
    if (Math.abs(shot.start - end) > 0.001 || shot.end <= shot.start || shot.end > scene.duration)
      fail("Camera shots must cover the timeline without gaps or overlaps.");
    if (
      distance(shot.position, shot.target) < 0.1 ||
      distance(shot.endPosition, shot.endTarget) < 0.1
    )
      fail("Camera position and target must differ.");
    end = shot.end;
  }
  if (Math.abs(end - scene.duration) > 0.001) fail("Camera shots must cover the entire duration.");
  for (const cue of scene.cues) {
    if (!ids.includes(cue.characterId) || cue.end <= cue.start || cue.end > scene.duration)
      fail("Cues must reference a character and a valid time interval.");
  }
});

export type StudioScene = z.infer<typeof baseSceneSchema>;
export type StudioVector = z.infer<typeof studioVectorSchema>;
export type StudioCharacter = StudioScene["characters"][number];
export type StudioShot = StudioScene["shots"][number];
export type StudioRevision = {
  id: string;
  version: number;
  label?: string;
  createdAt?: string;
  scene: StudioScene;
  instructions: string;
  roleId: string | null;
  inputHash: string;
  approvedAt: string | null;
  model: string | null;
};
export type StudioState = {
  projectId: string;
  title: string;
  instructions: string;
  needsBrief: boolean;
  briefApproved: boolean;
  enabled: boolean;
  version: number;
  locked: boolean;
  stale: boolean;
  revision: StudioRevision | null;
  job: { id: string; status: string; error: string | null; instructions: string } | null;
};

function distance(first: StudioVector, second: StudioVector) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}
export function interpolateVector(
  first: StudioVector,
  second: StudioVector,
  fraction: number,
): StudioVector {
  return {
    x: first.x + (second.x - first.x) * fraction,
    y: first.y + (second.y - first.y) * fraction,
    z: first.z + (second.z - first.z) * fraction,
  };
}
export function sampleCharacter(character: StudioCharacter, seconds: number) {
  const frames = character.keyframes;
  const currentTime = Math.max(0, seconds);
  let index = 0;
  while (index < frames.length - 1 && frames[index + 1]!.time <= currentTime) index++;
  const first = frames[index]!;
  const second = frames[index + 1] ?? first;
  const fraction =
    second.time === first.time
      ? 0
      : Math.min(1, (currentTime - first.time) / (second.time - first.time));
  const rotationDelta = ((second.rotation - first.rotation + 540) % 360) - 180;
  return {
    ...first,
    position: interpolateVector(first.position, second.position, fraction),
    gaze: interpolateVector(first.gaze, second.gaze, fraction),
    rotation: first.rotation + rotationDelta * fraction,
  };
}
export function sampleCamera(scene: StudioScene, seconds: number, selectedId?: string) {
  const shot =
    scene.shots.find((item) => item.id === selectedId) ??
    scene.shots.find((item) => seconds >= item.start && seconds < item.end) ??
    scene.shots.at(-1)!;
  const fraction = Math.max(0, Math.min(1, (seconds - shot.start) / (shot.end - shot.start)));
  return {
    ...shot,
    position: interpolateVector(shot.position, shot.endPosition, fraction),
    target: interpolateVector(shot.target, shot.endTarget, fraction),
  };
}
export function samplePose(action: (typeof studioActions)[number], seconds: number) {
  const stride = action === "walk" ? Math.sin(seconds * 8) * 0.6 : 0;
  return {
    leftLeg: action === "sit" ? -Math.PI / 2 : stride,
    rightLeg: action === "sit" ? -Math.PI / 2 : -stride,
    leftArm: -stride * 0.6,
    rightArm:
      action === "wave"
        ? -2.4 + Math.sin(seconds * 7) * 0.25
        : action === "point"
          ? -Math.PI / 2
          : stride * 0.6,
    height: action === "sit" ? -0.5 : 0,
  };
}
