import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPerformanceMotion,
  motionStride,
  performanceMotionVersion,
  performanceMotionSummary,
  samplePerformanceMotion,
  smoothPerformanceMotion,
  type PerformanceMotion,
} from "./performance-motion.js";
function track(duration = 1): PerformanceMotion {
  const times = Float32Array.from({ length: Math.ceil(duration * 24) + 1 }, (_, frame) =>
    Math.min(duration - 0.0001, frame / 24),
  );
  const samples = new Float32Array(times.length * motionStride);
  for (let frame = 0; frame < times.length; frame++) {
    samples[frame * motionStride] = times[frame]!;
    samples[frame * motionStride + 3] = 1;
    samples[frame * motionStride + 132] = times[frame]!;
  }
  return {
    version: performanceMotionVersion,
    sourceHash: "a".repeat(64),
    duration,
    fps: 24,
    width: 1280,
    height: 720,
    times,
    samples,
    coverage: { body: 1, hands: 0, face: 0, legs: 0 },
  };
}
test("motion cache rejects partial, obsolete, oversized and non-finite tracks", () => {
  const motion = track();
  assert.ok(isPerformanceMotion(motion));
  for (const patch of [
    { version: "old-model" },
    { sourceHash: "not-a-hash" },
    { duration: 121 },
    { width: Infinity },
    { width: 1280.5 },
    { times: motion.times.slice(1) },
    { samples: new Float32Array([NaN]) },
    { coverage: { body: 2, hands: 0, face: 0, legs: 0 } },
    { times: Float32Array.from(motion.times, () => 0.5) },
  ])
    assert.equal(isPerformanceMotion({ ...motion, ...patch }), false);
});
test("motion sampling follows original source time, interpolates and is independent of seek order", () => {
  const motion = track();
  const scratch = new Float32Array(motionStride);
  assert.ok(Math.abs(samplePerformanceMotion(motion, 0.135, scratch)[0]! - 0.135) < 1e-6);
  assert.equal(samplePerformanceMotion(motion, -4)[0], 0);
  assert.ok(Math.abs(samplePerformanceMotion(motion, 20)[0]! - 0.9999) < 1e-6);
  samplePerformanceMotion(motion, 0.9, scratch);
  assert.ok(Math.abs(samplePerformanceMotion(motion, 0.135, scratch)[0]! - 0.135) < 1e-6);
  assert.equal(scratch, samplePerformanceMotion(motion, 0.135, scratch));
});
test("smoothing preserves motion timing and source data while reducing isolated jitter", () => {
  const motion = track(),
    original = motion.samples.slice();
  const smooth = smoothPerformanceMotion(motion);
  assert.deepEqual(motion.samples, original);
  assert.ok(Math.abs(smooth.samples[12 * motionStride]! - 0.5) < 1e-6);
  motion.samples[12 * motionStride] = 0.55;
  assert.ok(smoothPerformanceMotion(motion).samples[12 * motionStride]! < 0.55);
  assert.equal(smooth.samples[12 * motionStride + 3], 1);
});
test("only short bounded tracking dropouts are interpolated; hidden limbs and long gaps stay untracked", () => {
  const motion = track();
  for (let frame = 8; frame <= 9; frame++) {
    motion.samples[frame * motionStride] = 0;
    motion.samples[frame * motionStride + 3] = 0;
    motion.samples[frame * motionStride + 132] = 0;
  }
  for (let frame = 14; frame <= 22; frame++) motion.samples[frame * motionStride + 3] = 0;
  const smooth = smoothPerformanceMotion(motion);
  assert.ok(smooth.samples[8 * motionStride + 3]! > 0.5);
  assert.ok(Math.abs(smooth.samples[8 * motionStride]! - 8 / 24) < 0.001);
  assert.ok(Math.abs(smooth.samples[8 * motionStride + 132]! - 8 / 24) < 0.001);
  assert.equal(smooth.samples[17 * motionStride + 3], 0);
  assert.equal(smooth.samples[17 * motionStride + 7], 0);
});
test("production plans explicitly distinguish estimated movement and fixed camera-only references", () => {
  assert.equal(performanceMotionSummary(track()).mode, "estimated-motion");
  assert.equal(performanceMotionSummary(null).mode, "camera-only");
  assert.match(performanceMotionSummary(track()).limitations, /Hidden.*neutral/);
  assert.ok(!("samples" in performanceMotionSummary(track())));
});
