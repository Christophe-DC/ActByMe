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
  easing: z.enum(["linear", "smooth", "hold"]).optional(),
  gazeCharacterId: identifier.optional(),
  facing: z.enum(["fixed", "travel", "gaze"]).optional(),
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
        rotation: z.number().finite().min(-360).max(360).optional(),
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
        endFov: z.number().finite().min(15).max(100).optional(),
        easing: z.enum(["linear", "smooth"]).optional(),
        followCharacterId: identifier.optional(),
        lookAtCharacterId: identifier.optional(),
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
        frame.gazeCharacterId &&
        (!ids.includes(frame.gazeCharacterId) || frame.gazeCharacterId === character.id)
      )
        fail("Gaze must reference another character.");
      if (
        frame.time > scene.duration ||
        (index > 0 && frame.time <= character.keyframes[index - 1]!.time)
      )
        fail("Keyframes must be strictly ordered within the duration.");
    });
  }
  let end = 0;
  for (const shot of scene.shots) {
    if ([shot.followCharacterId, shot.lookAtCharacterId].some((id) => id && !ids.includes(id)))
      fail("Camera tracking must reference an existing character.");
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
  ownerId: string;
  projectId: string;
  title: string;
  instructions: string;
  needsBrief: boolean;
  briefApproved: boolean;
  guideSynchronized: boolean;
  capturePlan?: Record<string, unknown>;
  enabled: boolean;
  version: number;
  locked: boolean;
  stale: boolean;
  revision: StudioRevision | null;
  job: {
    id: string;
    status: string;
    error: string | null;
    instructions: string;
    target?: { kind: "scene" | "character" | "shot" | "prop" | "cue"; id: string };
    at?: number;
  } | null;
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
export function easingFraction(fraction: number, easing?: string) {
  return easing === "hold"
    ? 0
    : easing === "smooth"
      ? fraction * fraction * (3 - 2 * fraction)
      : fraction;
}
export function sampleCharacter(
  character: StudioCharacter,
  seconds: number,
  scene?: StudioScene,
): StudioCharacter["keyframes"][number] & { speed: number; travelled: number } {
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
  const eased = easingFraction(fraction, first.easing);
  const rotationDelta = ((((second.rotation - first.rotation) % 360) + 540) % 360) - 180;
  const position = interpolateVector(first.position, second.position, eased);
  const gazeCharacter = scene?.characters.find((item) => item.id === first.gazeCharacterId);
  const gazeState = gazeCharacter ? sampleCharacter(gazeCharacter, seconds) : null;
  const gaze = gazeState
    ? {
        ...gazeState.position,
        y: gazeState.position.y + 1.65 + (gazeState.action === "sit" ? -0.2 : 0),
      }
    : interpolateVector(first.gaze, second.gaze, eased);
  const moving =
    first.easing !== "hold" && first !== second && distance(first.position, second.position) > 0.05;
  const travelled =
    frames
      .slice(0, index)
      .reduce(
        (total, frame, frameIndex) =>
          total +
          (frame.easing === "hold"
            ? 0
            : distance(frame.position, frames[frameIndex + 1]!.position)),
        0,
      ) + distance(first.position, position);
  const speed = moving
    ? (distance(first.position, second.position) / (second.time - first.time)) *
      (first.easing === "smooth" ? 6 * fraction * (1 - fraction) : 1)
    : 0;
  return {
    ...first,
    position,
    gaze,
    speed,
    travelled,
    action:
      moving && (first.action === "idle" || first.action === "turn")
        ? ("walk" as const)
        : first.action,
    rotation:
      first.facing === "gaze"
        ? (Math.atan2(gaze.x - position.x, gaze.z - position.z) * 180) / Math.PI
        : moving && first.facing === "travel"
          ? (Math.atan2(
              second.position.x - first.position.x,
              second.position.z - first.position.z,
            ) *
              180) /
            Math.PI
          : first.rotation + rotationDelta * eased,
  };
}
export function sampleCamera(scene: StudioScene, seconds: number, selectedId?: string) {
  const shot =
    scene.shots.find((item) => item.id === selectedId) ??
    scene.shots.find((item) => seconds >= item.start && seconds < item.end) ??
    scene.shots.at(-1)!;
  const fraction = easingFraction(
    Math.max(0, Math.min(1, (seconds - shot.start) / (shot.end - shot.start))),
    shot.easing,
  );
  let position = interpolateVector(shot.position, shot.endPosition, fraction);
  let target = interpolateVector(shot.target, shot.endTarget, fraction);
  const focused = scene.characters.find(
    (item) => item.id === (shot.followCharacterId || shot.lookAtCharacterId),
  );
  if (focused) {
    const start = sampleCharacter(focused, shot.start).position;
    const live = sampleCharacter(focused, seconds).position;
    const delta = { x: live.x - start.x, y: live.y - start.y, z: live.z - start.z };
    target = {
      x: live.x,
      y: live.y + Math.max(0.5, Math.min(1.65, shot.target.y - start.y)),
      z: live.z,
    };
    if (shot.followCharacterId)
      position = { x: position.x + delta.x, y: position.y + delta.y, z: position.z + delta.z };
  }
  if (distance(position, target) < 0.1) position = { ...position, z: position.z + 0.2 };
  return {
    ...shot,
    position,
    target,
    fov: shot.fov + ((shot.endFov ?? shot.fov) - shot.fov) * fraction,
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
    height: action === "sit" ? -0.2 : 0,
  };
}

export function sampleCharacterPose(
  character: StudioCharacter,
  seconds: number,
  scene: StudioScene,
) {
  const state = sampleCharacter(character, seconds, scene);
  const frames = character.keyframes;
  const index = Math.max(
    0,
    frames.findIndex((frame) => frame.time === state.time),
  );
  const phase = [...character.id].reduce((total, letter) => total + letter.charCodeAt(0), 0) % 7;
  const pose = samplePose(state.action, seconds - state.time + phase);
  const previous = samplePose(frames[index - 1]?.action ?? "idle", seconds - state.time + phase);
  const blend = easingFraction(Math.min(1, Math.max(0, (seconds - state.time) / 0.3)), "smooth");
  const stride =
    state.speed > 0.02
      ? Math.sin(state.travelled * 10 + phase) *
        Math.min(0.55, state.speed * 0.5) *
        Math.min(
          1,
          Math.max(0, (seconds - state.time) / 0.15),
          Math.max(0, ((frames[index + 1]?.time ?? seconds) - seconds) / 0.15),
        )
      : 0;
  return {
    ...state,
    pose: {
      leftLeg:
        state.action === "sit"
          ? previous.leftLeg + (pose.leftLeg - previous.leftLeg) * blend
          : stride,
      rightLeg:
        state.action === "sit"
          ? previous.rightLeg + (pose.rightLeg - previous.rightLeg) * blend
          : -stride,
      leftArm: -stride * 0.6,
      rightArm:
        state.action === "wave" || state.action === "point"
          ? previous.rightArm + (pose.rightArm - previous.rightArm) * blend
          : stride * 0.6,
      height: previous.height + (pose.height - previous.height) * blend,
    },
  };
}
