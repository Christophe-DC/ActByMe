import { z } from "zod";
import {
  baseSceneSchema,
  providerSchema,
  studioSceneSchema,
  sampleCharacter,
  type StudioScene,
  type StudioVector,
} from "./director-studio.js";

export const studioSelectionSchema = z.object({
  kind: z.enum(["scene", "character", "shot", "prop", "cue"]),
  id: z.string().max(40),
});
export type StudioSelection = z.infer<typeof studioSelectionSchema>;
export const studioPatchSchema = z.object({
  summary: z.string().min(1).max(160),
  characters: z
    .array(baseSceneSchema.shape.characters.element.partial().required({ id: true }))
    .max(6),
  shots: z.array(baseSceneSchema.shape.shots.element.partial().required({ id: true })).max(24),
  props: z.array(baseSceneSchema.shape.props.element.partial().required({ id: true })).max(20),
  cues: z
    .array(
      z.object({
        index: z.number().int().min(0).max(119),
        cue: baseSceneSchema.shape.cues.element.partial(),
      }),
    )
    .max(120),
  removeCharacters: z.array(z.string()).max(6),
  removeShots: z.array(z.string()).max(24),
  removeProps: z.array(z.string()).max(20),
  removeCues: z.array(z.number().int().min(0).max(119)).max(120),
  title: z.string().min(1).max(160).nullable(),
  duration: z.number().min(1).max(120).nullable(),
});
export const studioPatchJsonSchema = providerSchema(z.toJSONSchema(studioPatchSchema)) as Record<
  string,
  unknown
>;
export type StudioPatch = z.infer<typeof studioPatchSchema>;
export function selectionExists(scene: StudioScene, selection: StudioSelection) {
  return (
    selection.kind === "scene" ||
    (selection.kind === "cue"
      ? /^\d+$/.test(selection.id) && Boolean(scene.cues[Number(selection.id)])
      : selection.kind === "character"
        ? scene.characters.some((item) => item.id === selection.id)
        : selection.kind === "shot"
          ? scene.shots.some((item) => item.id === selection.id)
          : scene.props.some((item) => item.id === selection.id))
  );
}
export function applyStudioPatch(
  original: StudioScene,
  rawPatch: unknown,
  selection: StudioSelection,
): StudioScene {
  const patch = studioPatchSchema.parse(rawPatch);
  if (!selectionExists(original, selection)) throw new Error("The selected item no longer exists.");
  if (selection.kind !== "scene") {
    const allowed = (kind: string, id: string) => selection.kind === kind && selection.id === id;
    const cueAllowed = (index: number, characterId: string) =>
      allowed("cue", String(index)) || allowed("character", characterId);
    if (
      patch.title !== null ||
      patch.duration !== null ||
      patch.characters.some((item) => !allowed("character", item.id)) ||
      patch.shots.some((item) => !allowed("shot", item.id)) ||
      patch.props.some((item) => !allowed("prop", item.id)) ||
      patch.cues.some(
        (item) =>
          !cueAllowed(
            item.index,
            item.cue.characterId ?? original.cues[item.index]?.characterId ?? "",
          ) ||
          (original.cues[item.index] &&
            !cueAllowed(item.index, original.cues[item.index]!.characterId)),
      ) ||
      patch.removeCharacters.some((id) => !allowed("character", id)) ||
      patch.removeShots.some((id) => !allowed("shot", id)) ||
      patch.removeProps.some((id) => !allowed("prop", id)) ||
      patch.removeCues.some(
        (index) => !original.cues[index] || !cueAllowed(index, original.cues[index]!.characterId),
      )
    )
      throw new Error(
        "The AI tried to change items outside your selection. Your scene was kept unchanged.",
      );
  }
  const next = structuredClone(original);
  const merge = <Item extends { id: string }>(
    items: Item[],
    edits: Array<Partial<Item> & { id: string }>,
    removed: string[],
  ) => {
    if (new Set(edits.map((item) => item.id)).size !== edits.length)
      throw new Error("Duplicate edits.");
    for (const id of removed)
      if (!items.some((item) => item.id === id)) throw new Error("Unknown item removal.");
    return [
      ...items
        .filter((item) => !removed.includes(item.id))
        .map((item) => ({ ...item, ...edits.find((edit) => edit.id === item.id) })),
      ...(edits.filter(
        (item) => !items.some((original) => original.id === item.id) && !removed.includes(item.id),
      ) as Item[]),
    ];
  };
  next.characters = merge(next.characters, patch.characters, patch.removeCharacters);
  next.shots = merge(next.shots, patch.shots, patch.removeShots);
  // A local camera timing change moves its neighbouring cut boundaries only.
  // Camera positions and every other scene element remain untouched.
  if (selection.kind === "shot") {
    const originalIndex = original.shots.findIndex((item) => item.id === selection.id);
    const changed = next.shots.find((item) => item.id === selection.id);
    if (!changed) {
      const removed = original.shots[originalIndex]!;
      if (originalIndex > 0) next.shots[originalIndex - 1]!.end = removed.end;
      else if (next.shots[0]) next.shots[0].start = 0;
    } else {
      if (originalIndex > 0) next.shots[originalIndex - 1]!.end = changed.start;
      if (originalIndex < next.shots.length - 1) next.shots[originalIndex + 1]!.start = changed.end;
    }
  }
  next.props = merge(next.props, patch.props, patch.removeProps);
  if (new Set(patch.cues.map((edit) => edit.index)).size !== patch.cues.length)
    throw new Error("Duplicate cue edits.");
  for (const edit of patch.cues) {
    if (edit.index > next.cues.length) throw new Error("Unknown cue.");
    next.cues[edit.index] = {
      ...next.cues[edit.index],
      ...edit.cue,
    } as StudioScene["cues"][number];
  }
  next.cues = next.cues.filter(
    (cue, index) =>
      !patch.removeCues.includes(index) && !patch.removeCharacters.includes(cue.characterId),
  );
  for (const character of next.characters)
    for (const frame of character.keyframes)
      if (frame.gazeCharacterId && patch.removeCharacters.includes(frame.gazeCharacterId))
        delete frame.gazeCharacterId;
  for (const shot of next.shots) {
    if (shot.followCharacterId && patch.removeCharacters.includes(shot.followCharacterId))
      delete shot.followCharacterId;
    if (shot.lookAtCharacterId && patch.removeCharacters.includes(shot.lookAtCharacterId))
      delete shot.lookAtCharacterId;
  }
  if (patch.title !== null) next.title = patch.title;
  if (patch.duration !== null) next.duration = patch.duration;
  return studioSceneSchema.parse(next);
}

export const studioActionLabels = {
  idle: "Stay still",
  walk: "Walk",
  turn: "Turn",
  wave: "Wave",
  point: "Point",
  sit: "Sit down",
};
export function describeStudioMoment(scene: StudioScene, characterId: string, index: number) {
  const character = scene.characters.find((item) => item.id === characterId)!;
  const frame = character.keyframes[index]!;
  const following = character.keyframes[index + 1];
  const sampled = sampleCharacter(character, frame.time, scene);
  let movement = "Stay in the same place";
  if (following && frame.easing !== "hold") {
    const deltaX = following.position.x - frame.position.x;
    const deltaZ = following.position.z - frame.position.z;
    movement =
      Math.hypot(deltaX, deltaZ) < 0.1
        ? "Stay in the same place"
        : Math.abs(deltaX) > Math.abs(deltaZ)
          ? `Move towards the ${deltaX > 0 ? "right" : "left"} of the scene`
          : `Move towards the ${deltaZ > 0 ? "front" : "back"} of the scene`;
  }
  const lookingAt = scene.characters
    .filter((other) => other.id !== character.id)
    .find((other) => {
      const position = sampleCharacter(other, frame.time).position;
      return (
        other.id === frame.gazeCharacterId ||
        Math.hypot(position.x - sampled.gaze.x, position.z - sampled.gaze.z) < 0.4
      );
    });
  const gazeAngle =
    (Math.atan2(sampled.gaze.x - sampled.position.x, sampled.gaze.z - sampled.position.z) * 180) /
    Math.PI;
  const relativeAngle = ((gazeAngle - sampled.rotation + 540) % 360) - 180;
  const gaze = lookingAt
    ? `Look towards ${lookingAt.name}`
    : Math.abs(relativeAngle) < 30
      ? "Look straight ahead"
      : Math.abs(relativeAngle) > 150
        ? "Look behind you"
        : `Look to your ${relativeAngle > 0 ? "right" : "left"}`;
  return { movement, gaze };
}
export function assertStudioDialogueOnly(original: StudioScene, edited: StudioScene) {
  const withoutText = (scene: StudioScene) => ({
    ...scene,
    cues: scene.cues.map((cue) => ({ ...cue, dialogue: "" })),
  });
  if (JSON.stringify(withoutText(original)) !== JSON.stringify(withoutText(edited)))
    throw new Error("Use the assistant to change the scene. Only dialogue can be edited directly.");
}
export function characterMoment(scene: StudioScene, id: string, seconds: number) {
  const character = scene.characters.find((item) => item.id === id);
  if (!character) throw new Error("Choose a character first.");
  const next = structuredClone(scene);
  const selected = next.characters.find((item) => item.id === id)!;
  const time = Math.max(0, Math.min(scene.duration, Math.round(seconds * 10) / 10));
  let frame = selected.keyframes.find((item) => item.time === time);
  if (!frame) {
    const sampled = sampleCharacter(character, time, scene);
    frame = {
      time,
      position: sampled.position,
      rotation: sampled.rotation,
      gaze: sampled.gaze,
      action: sampled.action,
    };
    selected.keyframes.push(frame);
    selected.keyframes.sort((first, second) => first.time - second.time);
  }
  return { scene: next, frame };
}
export function moveStudioCharacter(
  scene: StudioScene,
  id: string,
  time: number,
  position: StudioVector,
) {
  const next = characterMoment(scene, id, time);
  next.frame.position = {
    x: Math.max(-15, Math.min(15, position.x)),
    y: 0,
    z: Math.max(-15, Math.min(15, position.z)),
  };
  return studioSceneSchema.parse(next.scene);
}
export function retimeStudioScene(scene: StudioScene, duration: number) {
  const next = structuredClone(scene);
  const scale = duration / scene.duration;
  next.duration = duration;
  for (const character of next.characters)
    for (const frame of character.keyframes) frame.time *= scale;
  for (const shot of next.shots) {
    shot.start *= scale;
    shot.end *= scale;
  }
  for (const cue of next.cues) {
    cue.start *= scale;
    cue.end *= scale;
  }
  return studioSceneSchema.parse(next);
}
export function resizeStudioShot(scene: StudioScene, id: string, end: number) {
  const next = structuredClone(scene);
  const index = next.shots.findIndex((shot) => shot.id === id);
  if (index < 0 || index === next.shots.length - 1) return scene;
  const shot = next.shots[index]!;
  const following = next.shots[index + 1]!;
  const minimum = Math.min(0.5, (following.end - shot.start) / 3);
  const boundary = Math.max(shot.start + minimum, Math.min(following.end - minimum, end));
  shot.end = boundary;
  following.start = boundary;
  return studioSceneSchema.parse(next);
}
export function reorderStudioShots(scene: StudioScene, source: string, destination: string) {
  const next = structuredClone(scene);
  const start = next.shots.findIndex((shot) => shot.id === source);
  const end = next.shots.findIndex((shot) => shot.id === destination);
  if (start < 0 || end < 0) return scene;
  const durations = new Map(next.shots.map((shot) => [shot.id, shot.end - shot.start]));
  const [shot] = next.shots.splice(start, 1);
  next.shots.splice(end, 0, shot!);
  let cursor = 0;
  for (const shot of next.shots) {
    shot.start = cursor;
    cursor += durations.get(shot.id)!;
    shot.end = cursor;
  }
  next.shots.at(-1)!.end = next.duration;
  return studioSceneSchema.parse(next);
}
export function setStudioCameraPreset(
  scene: StudioScene,
  id: string,
  preset: "wide" | "medium" | "close" | "tracking",
  characterId: string,
) {
  const next = structuredClone(scene);
  const shot = next.shots.find((item) => item.id === id);
  const character = next.characters.find((item) => item.id === characterId) ?? next.characters[0]!;
  if (!shot) return scene;
  const position = sampleCharacter(character, shot.start).position;
  const distance = preset === "wide" ? 7 : preset === "close" ? 2 : 4;
  shot.target = { x: position.x, y: 1.35, z: position.z };
  shot.endTarget = { ...shot.target };
  shot.position = { x: position.x, y: preset === "wide" ? 3 : 1.7, z: position.z + distance };
  shot.endPosition = { ...shot.position, x: shot.position.x + (preset === "tracking" ? 3 : 0) };
  if (preset === "tracking") {
    shot.followCharacterId = character.id;
    shot.endPosition = { ...shot.position };
  } else delete shot.followCharacterId;
  shot.lookAtCharacterId = character.id;
  shot.fov = preset === "close" ? 35 : 50;
  shot.name = {
    wide: "Wide view",
    medium: "Conversation",
    close: "Close-up",
    tracking: "Follow the action",
  }[preset];
  return studioSceneSchema.parse(next);
}
