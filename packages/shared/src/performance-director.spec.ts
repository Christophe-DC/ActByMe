import assert from "node:assert/strict";
import test from "node:test";
import { createDirectorDocument, directorDocumentSchema, directorDuration } from "./director.js";
import { performancePresets, samplePerformanceCamera } from "./performance-camera.js";
import {
  addPerformanceShot,
  createPerformanceDocument,
  createPerformanceShot,
  fitPerformanceDuration,
  performanceProductionPlan,
  removePerformanceShot,
  resizePerformanceShot,
  syncPerformanceWaypoints,
} from "./performance-director.js";

test("ten camera presets are valid, finite and keep a neutral subject in front of the camera", () => {
  assert.equal(performancePresets.length, 10);
  for (const preset of performancePresets) {
    const document = createPerformanceDocument();
    document.shots = [createPerformanceShot(preset.id, "selected", 15)];
    directorDocumentSchema.parse(document);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const sampled = samplePerformanceCamera(preset.camera, progress);
      assert.ok(Object.values(sampled.position).every(Number.isFinite));
      assert.ok(sampled.position.y >= 0.1);
      assert.ok(
        Math.hypot(
          sampled.position.x - sampled.target.x,
          sampled.position.y - sampled.target.y,
          sampled.position.z - sampled.target.z,
        ) >= 0.1,
      );
    }
  }
});
test("camera edits, splits, resizing, reordering and removal preserve the complete source timeline", () => {
  const document = createPerformanceDocument("Performance", true);
  fitPerformanceDuration(document, 17.43, null);
  resizePerformanceShot(document, document.shots[0]!.id, 6.1);
  const before = document.shots.map((shot) => shot.duration);
  fitPerformanceDuration(document, 17.43, null);
  assert.deepEqual(
    document.shots.map((shot) => shot.duration),
    before,
  );
  addPerformanceShot(document, document.shots[0]!.id, "new_angle");
  document.shots.reverse();
  removePerformanceShot(document, document.shots[2]!.id);
  assert.ok(Math.abs(directorDuration(document) - 17.43) < 0.000001);
  directorDocumentSchema.parse(document);
  fitPerformanceDuration(document, 1.1, null);
  assert.equal(document.shots.length, 2);
  assert.ok(document.shots.every((shot) => shot.duration >= 0.5));
  directorDocumentSchema.parse(document);
  document.shots[0]!.duration += 0.1;
  assert.equal(directorDocumentSchema.safeParse(document).success, false);
});
test("orbit and push-in cameras move deterministically; structured timing retains original chronological performance", () => {
  const document = createPerformanceDocument("Performance", true);
  const orbit = document.shots.at(-1)!;
  const start = samplePerformanceCamera(orbit.performanceCamera!, 0),
    end = samplePerformanceCamera(orbit.performanceCamera!, 1);
  assert.ok(Math.abs(start.position.x - end.position.x) > 1);
  orbit.performanceCamera!.movement = "push-in";
  syncPerformanceWaypoints(orbit);
  assert.ok(
    samplePerformanceCamera(orbit.performanceCamera!, 1).position.z <
      samplePerformanceCamera(orbit.performanceCamera!, 0).position.z,
  );
  const plan = performanceProductionPlan(document);
  assert.equal(plan.shots.at(-1)!.end, 15);
  for (let index = 0; index < plan.shots.length; index++) {
    const shot = plan.shots[index]!;
    assert.equal(shot.sourceIn, index ? plan.shots[index - 1]!.sourceOut : 0);
    assert.equal(shot.end - shot.start, shot.duration);
  }
  assert.match(plan.disclaimer, /does not reproduce/);
  assert.ok(!JSON.stringify(plan).includes("storageKey"));
});
test("legacy advertising documents remain unchanged and performance plans reject incompatible timelines", () => {
  const legacy = createDirectorDocument();
  assert.deepEqual(directorDocumentSchema.parse(legacy), legacy);
  const document = createPerformanceDocument();
  document.shots[0]!.performanceCamera = undefined;
  assert.equal(directorDocumentSchema.safeParse(document).success, false);
});
