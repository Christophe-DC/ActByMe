import assert from "node:assert/strict";
import test from "node:test";
import {
  sampleCamera,
  sampleCharacter,
  sampleCharacterPose,
  studioSceneSchema,
} from "./director-studio.js";
import { studioDemoScene } from "./director-studio-demo.js";
import { assertStudioDialogueOnly, applyStudioPatch } from "./studio-editing.js";
import { studioRecordingPlan } from "./studio-recording.js";
test("moving people walk even when the starting pose was idle; holds and stopped feet stay still", () => {
  const scene = structuredClone(studioDemoScene);
  const character = scene.characters[0]!;
  character.keyframes[0]!.action = "idle";
  const moving = sampleCharacterPose(character, 3, scene);
  assert.equal(moving.action, "walk");
  assert.ok(moving.speed > 0);
  assert.notEqual(moving.pose.leftLeg, 0);
  character.keyframes[0]!.easing = "hold";
  assert.deepEqual(sampleCharacter(character, 3).position, character.keyframes[0]!.position);
  assert.equal(sampleCharacterPose(character, 3, scene).pose.leftLeg, 0);
  character.keyframes[0]!.easing = "smooth";
  assert.equal(sampleCharacter(character, 0).speed, 0);
  assert.ok(sampleCharacter(character, 3).speed > 0);
  const stop = sampleCharacterPose(character, scene.duration, scene);
  assert.equal(stop.pose.leftLeg, 0);
});
test("gaze, following cameras and zoom remain tied to moving people at exact timestamps", () => {
  const scene = structuredClone(studioDemoScene);
  scene.characters[0]!.keyframes[0]!.gazeCharacterId = "sam";
  const target = sampleCharacter(scene.characters[2]!, 3).position;
  assert.deepEqual(sampleCharacter(scene.characters[0]!, 3, scene).gaze, { ...target, y: 1.65 });
  const shot = scene.shots[0]!;
  shot.followCharacterId = "lea";
  shot.endPosition = { ...shot.position };
  shot.endTarget = { ...shot.target };
  shot.endFov = 30;
  const delta =
    sampleCharacter(scene.characters[0]!, 3).position.x -
    scene.characters[0]!.keyframes[0]!.position.x;
  assert.equal(sampleCamera(scene, 3).position.x, shot.position.x + delta);
  assert.equal(
    sampleCamera(scene, 3).target.x,
    sampleCharacter(scene.characters[0]!, 3).position.x,
  );
  assert.equal(sampleCamera(scene, 0).fov, shot.fov);
  assert.equal(sampleCamera(scene, 6, shot.id).fov, 30);
  shot.lookAtCharacterId = "missing";
  assert.equal(studioSceneSchema.safeParse(scene).success, false);
});
test("direct edits can change dialogue only; actors get their role's exact lines and animation timings", () => {
  const scene = structuredClone(studioDemoScene);
  scene.cues[0]!.dialogue = "I'm glad you came.";
  assert.doesNotThrow(() => assertStudioDialogueOnly(studioDemoScene, scene));
  const changed = structuredClone(scene);
  changed.characters[0]!.keyframes[0]!.position.x++;
  assert.throws(() => assertStudioDialogueOnly(studioDemoScene, changed), /assistant/);
  changed.characters = structuredClone(studioDemoScene.characters);
  changed.cues[0]!.start++;
  assert.throws(() => assertStudioDialogueOnly(studioDemoScene, changed), /assistant/);
  const plan = studioRecordingPlan(scene, "lea", {
    orientation: "Portrait",
    lighting: "Window light",
  });
  assert.equal(plan.actorGuide.dialogue, "I'm glad you came.");
  assert.equal(plan.sceneFields.dialogue, plan.actorGuide.dialogue);
  assert.equal(plan.actorGuide.duration, "24 seconds");
  assert.match(plan.sceneFields.direction, /0.0–6.0s/);
  assert.equal(plan.capturePlan.orientation, "Portrait");
  assert.equal(plan.capturePlan.lighting, "Window light");
  assert.match(plan.capturePlan.camera, /Fixed camera/);
  assert.ok(!plan.actorGuide.dialogue.includes(scene.cues[1]!.dialogue));
});
test("duration-only assistant edits retime movements, camera cuts and dialogue together", () => {
  const scene = structuredClone(studioDemoScene);
  const longer = applyStudioPatch(
    scene,
    {
      summary: "Slow down the scene",
      duration: 48,
      title: null,
      characters: [],
      shots: [],
      props: [],
      cues: [],
      removeCharacters: [],
      removeShots: [],
      removeProps: [],
      removeCues: [],
    },
    { kind: "scene", id: "scene" },
  );
  assert.equal(longer.shots[0]!.end, scene.shots[0]!.end * 2);
  assert.equal(longer.cues[0]!.start, scene.cues[0]!.start * 2);
  assert.equal(
    longer.characters[0]!.keyframes[1]!.time,
    scene.characters[0]!.keyframes[1]!.time * 2,
  );
  assert.deepEqual(
    longer.characters[0]!.keyframes[1]!.position,
    scene.characters[0]!.keyframes[1]!.position,
  );
  assert.equal(longer.cues[0]!.dialogue, scene.cues[0]!.dialogue);
});
