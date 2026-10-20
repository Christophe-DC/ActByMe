import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  createDirectorDocument,
  createDirectorShot,
  directorDocumentSchema,
  directorDuration,
  directorPrompt,
  directorProviderErrors,
  directorProductionPlan,
  directorShotAt,
  directorTemplates,
  directorUploadSchema,
  directorCastTimelinePosition,
  directorShotReferenceIds,
  sampleDirectorCamera,
  splitDirectorShot,
  type DirectorAsset,
} from "./director.js";
test("all cinematic templates create valid, continuous, editable paths", () => {
  for (const template of directorTemplates) {
    const document = createDirectorDocument();
    document.shots = [createDirectorShot(template.id, "shot")];
    assert.ok(directorDocumentSchema.safeParse(document).success, template.id);
    document.shots[0]!.waypoints.splice(1, 0, {
      id: "inserted",
      at: 0.1,
      position: { x: -1, y: 2, z: 3 },
      target: { x: 0, y: 1, z: 0 },
      lens: 35,
    });
    assert.equal(document.shots.length, 1);
    assert.ok(directorDocumentSchema.safeParse(document).success);
  }
});
test("non-uniform smooth paths hit every waypoint at its declared time, without position overshoots", () => {
  const shot = createDirectorShot("outside-inside", "path", 15);
  shot.waypoints[1]!.at = 0.12;
  shot.waypoints[2]!.at = 0.8;
  for (const point of shot.waypoints) {
    const sampled = sampleDirectorCamera(shot, point.at * 15);
    for (const axis of ["x", "y", "z"] as const)
      assert.ok(Math.abs(sampled.position[axis] - point.position[axis]) < 1e-9);
  }
  for (let index = 0; index < shot.waypoints.length - 1; index++) {
    const first = shot.waypoints[index]!,
      second = shot.waypoints[index + 1]!;
    for (let sample = 0; sample <= 30; sample++) {
      const result = sampleDirectorCamera(
        shot,
        (first.at + ((second.at - first.at) * sample) / 30) * 15,
      );
      for (const axis of ["x", "y", "z"] as const) {
        assert.ok(
          result.position[axis] >= Math.min(first.position[axis], second.position[axis]) - 1e-9,
        );
        assert.ok(
          result.position[axis] <= Math.max(first.position[axis], second.position[axis]) + 1e-9,
        );
      }
    }
  }
  const at = shot.waypoints[1]!.at * 15,
    epsilon = 0.0001;
  const left =
    (sampleDirectorCamera(shot, at).position.x -
      sampleDirectorCamera(shot, at - epsilon).position.x) /
    epsilon;
  const right =
    (sampleDirectorCamera(shot, at + epsilon).position.x -
      sampleDirectorCamera(shot, at).position.x) /
    epsilon;
  assert.ok(Math.abs(left - right) < 0.02);
});
test("cuts select the next shot and split preserves clip offset, duration and camera endpoints", () => {
  const document = createDirectorDocument("The Coastal House", true);
  assert.equal(directorShotAt(document, 15).shot.id, "shot_detail");
  document.shots[0]!.clipOffset = 2;
  const split = splitDirectorShot(document, "shot_arrival", 6, "second_half");
  assert.equal(directorDuration(split), directorDuration(document));
  assert.equal(split.shots.length, 4);
  assert.equal(split.shots[1]!.clipOffset, 8);
  assert.deepEqual(
    sampleDirectorCamera(split.shots[0]!, 6).position,
    sampleDirectorCamera(document.shots[0]!, 6).position,
  );
  assert.ok(directorDocumentSchema.safeParse(split).success);
});
test("invalid identifiers, duplicate timing, unknown cast and unauthorized virtual identities are rejected", () => {
  const document = createDirectorDocument("test", true);
  document.shots[0]!.waypoints[1]!.at = 0;
  assert.equal(directorDocumentSchema.safeParse(document).success, false);
  const invalidCast = createDirectorDocument("test", true);
  invalidCast.cast[0]!.kind = "virtual";
  assert.equal(directorDocumentSchema.safeParse(invalidCast).success, false);
  const overflow = createDirectorDocument();
  overflow.tracks.push({
    id: "music",
    track: "music",
    start: 7,
    duration: 3,
    offset: 0,
    volume: 1,
    label: "music",
    assetId: null,
    castId: null,
    instructions: "",
    fadeIn: 0,
    fadeOut: 0,
  });
  assert.equal(directorDocumentSchema.safeParse(overflow).success, false);
});
test("provider constraints and asset rights are validated before any payable operation", () => {
  const document = createDirectorDocument();
  document.shots = [createDirectorShot("dolly-in", "shot", 6)];
  const shot = document.shots[0]!;
  assert.deepEqual(directorProviderErrors(document, shot, "veo", []), []);
  const asset: DirectorAsset = {
    id: randomUUID(),
    name: "owned-image",
    kind: "property",
    contentType: "image/png",
    sizeBytes: 10,
    status: "READY",
    duration: null,
    width: 100,
    height: 100,
    hasAudio: false,
    error: null,
    aiTransferAllowed: false,
    createdAt: new Date().toISOString(),
  };
  shot.referenceIds = [asset.id];
  const errors = directorProviderErrors(document, shot, "veo", [asset]);
  assert.ok(errors.some((error) => error.includes("transfer")));
  assert.ok(errors.some((error) => error.includes("8 seconds")));
  shot.duration = 8;
  asset.aiTransferAllowed = true;
  assert.deepEqual(directorProviderErrors(document, shot, "veo", [asset]), []);
  shot.duration = 7.5;
  assert.ok(directorProviderErrors(document, shot, "higgsfield", [asset]).length);
});
test("uploads reject mismatched categories, oversize images and absent rights", () => {
  const valid = {
    name: "photo.png",
    kind: "property",
    contentType: "image/png",
    sizeBytes: 100,
    rightsBasis: "Original photograph owned by the creator",
    rightsConfirmed: true,
    aiTransferAllowed: false,
  };
  assert.ok(directorUploadSchema.safeParse(valid).success);
  for (const input of [
    { ...valid, contentType: "text/html" },
    { ...valid, rightsConfirmed: false },
    { ...valid, sizeBytes: 20 * 1024 ** 2 },
  ])
    assert.equal(directorUploadSchema.safeParse(input).success, false);
});
test("production plan contains exact timings, original structured paths and one continuous-shot prompt", () => {
  const document = createDirectorDocument("The Coastal House", true),
    plan = directorProductionPlan(document, [], 4);
  assert.equal(plan.shots[1]!.start, 15);
  assert.equal(plan.duration, 30);
  assert.equal(plan.version, 4);
  assert.deepEqual(plan.document.shots[0]!.waypoints, document.shots[0]!.waypoints);
  assert.match(directorPrompt(document, document.shots[0]!), /ONE continuous/);
  assert.ok(!JSON.stringify(plan).includes("storageKey"));
});

test("cast motion and camera tracking pause between performance cues", () => {
  const document = createDirectorDocument("The Coastal House", true);
  document.tracks[0]!.start = 5;
  document.tracks[0]!.duration = 5;
  const person = document.cast[0]!;
  assert.deepEqual(directorCastTimelinePosition(document, person, 2), person.position);
  assert.equal(
    directorCastTimelinePosition(document, person, 7.5).z,
    (person.position.z + person.endPosition.z) / 2,
  );
  assert.deepEqual(directorCastTimelinePosition(document, person, 12), person.endPosition);
  document.shots[0]!.followCastId = person.id;
  const camera = sampleDirectorCamera(document.shots[0]!, 7.5, document.cast, 7.5, 30, document);
  assert.equal(camera.target.z, directorCastTimelinePosition(document, person, 7.5).z);
});

test("cast references and performance assets join generation references without duplicates", () => {
  const document = createDirectorDocument("The Coastal House", true),
    image = randomUUID(),
    performance = randomUUID();
  document.cast[0]!.referenceAssetId = image;
  document.shots[0]!.referenceIds = [image];
  document.tracks[0]!.assetId = performance;
  assert.deepEqual(directorShotReferenceIds(document, document.shots[0]!), [image, performance]);
});
