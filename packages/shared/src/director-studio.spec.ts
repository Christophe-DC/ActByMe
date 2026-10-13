import assert from "node:assert/strict";
import test from "node:test";
import { studioSceneSchema, sampleCharacter, sampleCamera, samplePose } from "./director-studio.js";
import { studioDemoScene } from "./director-studio-demo.js";

test("demo is valid, bounded, and covers four angles with three characters", () => {
  assert.equal(studioSceneSchema.safeParse(studioDemoScene).success, true);
  assert.equal(studioDemoScene.characters.length, 3);
  assert.equal(studioDemoScene.shots.length, 4);
});
test("trajectory interpolation, clamps and shortest rotation are deterministic", () => {
  const character = structuredClone(studioDemoScene.characters[0]!);
  character.keyframes[0]!.rotation = 170;
  character.keyframes[1]!.rotation = -170;
  assert.equal(sampleCharacter(character, 3).position.x, -1.9);
  assert.equal(sampleCharacter(character, 3).rotation, 180);
  assert.equal(sampleCharacter(character, -1).position.x, -3);
  assert.equal(sampleCharacter(character, 1000).position.x, -0.8);
  assert.deepEqual(sampleCharacter(character, 3), sampleCharacter(character, 3));
});
test("camera cuts and tracking sample exact boundaries", () => {
  assert.equal(sampleCamera(studioDemoScene, 5.9).id, "wide");
  assert.equal(sampleCamera(studioDemoScene, 6).id, "lea-close");
  assert.equal(sampleCamera(studioDemoScene, 21).position.x, 0);
  assert.equal(sampleCamera(studioDemoScene, 24).position.x, 4);
  assert.equal(sampleCamera(studioDemoScene, 0, "marc-close").id, "marc-close");
});
test("poses distinguish walking, waving, pointing and sitting", () => {
  assert.notEqual(samplePose("walk", 1).leftLeg, 0);
  assert.notEqual(samplePose("wave", 1).rightArm, 0);
  assert.equal(samplePose("point", 1).rightArm, -Math.PI / 2);
  assert.equal(samplePose("sit", 1).height, -0.2);
  assert.equal(samplePose("idle", 1).height, 0);
});
test("invalid identifiers, non-finite positions and broken timelines are rejected", () => {
  const cases = [
    (scene: typeof studioDemoScene) => {
      scene.characters[1]!.id = scene.characters[0]!.id;
    },
    (scene: typeof studioDemoScene) => {
      scene.characters[0]!.keyframes[0]!.position.x = Infinity;
    },
    (scene: typeof studioDemoScene) => {
      scene.characters[0]!.keyframes[0]!.time = 1;
    },
    (scene: typeof studioDemoScene) => {
      scene.characters[0]!.keyframes[1]!.time = 0;
    },
    (scene: typeof studioDemoScene) => {
      scene.shots[1]!.start = 7;
    },
    (scene: typeof studioDemoScene) => {
      scene.cues[0]!.characterId = "missing";
    },
    (scene: typeof studioDemoScene) => {
      scene.cues[0]!.end = 121;
    },
    (scene: typeof studioDemoScene) => {
      scene.duration = 121;
    },
    (scene: typeof studioDemoScene) => {
      scene.shots[0]!.target = scene.shots[0]!.position;
    },
  ];
  for (const mutate of cases) {
    const scene = structuredClone(studioDemoScene);
    mutate(scene);
    assert.equal(studioSceneSchema.safeParse(scene).success, false);
  }
});

test("targeted patches preserve every unrelated item and reject changes outside the selection", async () => {
  const { applyStudioPatch } = await import("./studio-editing.js");
  const character = structuredClone(studioDemoScene.characters[0]!);
  character.color = "#80c5aa";
  const patch = {
    summary: "New color",
    characters: [character],
    shots: [],
    props: [],
    cues: [],
    removeCharacters: [],
    removeShots: [],
    removeProps: [],
    removeCues: [],
    title: null,
    duration: null,
  };
  const next = applyStudioPatch(studioDemoScene, patch, { kind: "character", id: "lea" });
  assert.deepEqual(next.characters[1], studioDemoScene.characters[1]);
  assert.deepEqual(next.shots, studioDemoScene.shots);
  assert.deepEqual(next.cues, studioDemoScene.cues);
  assert.equal(next.characters[0]!.color, "#80c5aa");
  assert.throws(
    () =>
      applyStudioPatch(
        studioDemoScene,
        { ...patch, shots: [studioDemoScene.shots[0]] },
        { kind: "character", id: "lea" },
      ),
    /outside/,
  );
});
test("visual timing, camera presets and storyboard edits keep a valid complete scene", async () => {
  const {
    retimeStudioScene,
    resizeStudioShot,
    reorderStudioShots,
    setStudioCameraPreset,
    moveStudioCharacter,
  } = await import("./studio-editing.js");
  const longer = retimeStudioScene(studioDemoScene, 48);
  assert.equal(longer.shots[0]!.end, 12);
  assert.equal(longer.cues[0]!.start, 12);
  const resized = resizeStudioShot(studioDemoScene, "wide", 8);
  assert.equal(resized.shots[1]!.start, 8);
  const reordered = reorderStudioShots(studioDemoScene, "tracking", "wide");
  assert.equal(reordered.shots[0]!.id, "tracking");
  assert.equal(reordered.shots[0]!.start, 0);
  assert.equal(
    studioSceneSchema.safeParse(setStudioCameraPreset(studioDemoScene, "wide", "close", "lea"))
      .success,
    true,
  );
  const moved = moveStudioCharacter(studioDemoScene, "lea", 3, { x: 2, y: 0, z: 1 });
  assert.equal(moved.characters[0]!.keyframes.find((frame) => frame.time === 3)!.position.x, 2);
  assert.equal(studioDemoScene.characters[0]!.keyframes.length, 4);
});
test("accessible actor directions describe positions and gaze without 3D coordinates", async () => {
  const { describeStudioMoment } = await import("./studio-editing.js");
  const scene = structuredClone(studioDemoScene);
  const character = scene.characters[0]!;
  character.keyframes[0] = {
    time: 0,
    position: { x: -2, y: 0, z: 0 },
    rotation: 0,
    gaze: { x: -2, y: 1.6, z: 10 },
    action: "idle",
  };
  character.keyframes[1] = {
    ...character.keyframes[0],
    time: 4,
    position: { x: -2, y: 0, z: 2 },
    gaze: { x: -5, y: 1.6, z: 2 },
  };
  assert.deepEqual(describeStudioMoment(scene, character.id, 0), {
    movement: "Move towards the front of the scene",
    gaze: "Look straight ahead",
  });
  assert.deepEqual(describeStudioMoment(scene, character.id, 1), {
    movement: "Move towards the back of the scene",
    gaze: "Look to your left",
  });
});
test("a scoped camera timing patch adjusts adjoining cuts without replacing other cameras", async () => {
  const { applyStudioPatch } = await import("./studio-editing.js");
  const patch = {
    summary: "A longer opening view",
    characters: [],
    props: [],
    cues: [],
    shots: [{ ...studioDemoScene.shots[0]!, end: 8 }],
    removeCharacters: [],
    removeShots: [],
    removeProps: [],
    removeCues: [],
    title: null,
    duration: null,
  };
  const next = applyStudioPatch(studioDemoScene, patch, { kind: "shot", id: "wide" });
  assert.equal(next.shots[1]!.start, 8);
  assert.deepEqual(next.shots[1]!.position, studioDemoScene.shots[1]!.position);
  assert.deepEqual(next.characters, studioDemoScene.characters);
  assert.deepEqual(next.cues, studioDemoScene.cues);
  const removed = applyStudioPatch(
    studioDemoScene,
    { ...patch, shots: [], removeShots: ["wide"] },
    { kind: "shot", id: "wide" },
  );
  assert.equal(removed.shots[0]!.start, 0);
  assert.equal(removed.shots.length, studioDemoScene.shots.length - 1);
});
