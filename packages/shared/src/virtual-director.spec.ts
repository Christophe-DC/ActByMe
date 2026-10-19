import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultVirtualScene,
  virtualCameraPrompt,
  virtualGenerateSchema,
  virtualJobInputSchema,
  virtualRightsSchema,
  virtualShotError,
} from "./virtual-director.js";
test("rights declarations require every authorization and reject injected fields", () => {
  const declaration = {
    performerName: "Test performer",
    rightsBasis: "Isolated test authorization",
    ownsOrLicensed: true,
    aiTransformation: true,
    providerTransfer: true,
  };
  assert.equal(virtualRightsSchema.safeParse(declaration).success, true);
  for (const key of ["ownsOrLicensed", "aiTransformation", "providerTransfer"])
    assert.equal(virtualRightsSchema.safeParse({ ...declaration, [key]: false }).success, false);
  assert.equal(
    virtualRightsSchema.safeParse({ ...declaration, acceptedBy: "forged" }).success,
    false,
  );
});
test("provider limits enforce exact segment duration and available performance", () => {
  const shot = defaultVirtualScene("Test staging").shots[0]!;
  assert.equal(virtualShotError(shot, 5), null);
  assert.match(virtualShotError({ ...shot, end: 16 }, 30)!, /4 and 15/);
  assert.match(virtualShotError({ ...shot, end: 4.5 }, 30)!, /whole number/);
  assert.match(virtualShotError(shot, 4)!, /beyond/);
});
test("camera prompt requests a single referenced performance without claiming reconstruction", () => {
  const scene = defaultVirtualScene("Test staging");
  const input = virtualJobInputSchema.parse({
    scene,
    shot: scene.shots[0],
    instructions: "Slow push in",
    sourceStartSeconds: 0,
    model: "bytedance/seedance-2.0/reference-to-video",
    sourceConsentId: null,
  });
  const prompt = virtualCameraPrompt(input);
  assert.match(prompt, /@Video1/);
  assert.match(prompt, /ONE continuous/);
  assert.match(prompt, /not recovered 3D geometry/);
  assert.match(prompt, /Slow push in/);
  assert.equal(
    virtualGenerateSchema.safeParse({
      version: 1,
      requestKey: crypto.randomUUID(),
      kind: "GENERATE",
      shotId: "camera_1",
      maxCostCents: -1,
    }).success,
    false,
  );
});
