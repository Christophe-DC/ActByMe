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
  assert.equal(samplePose("sit", 1).height, -0.5);
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
