import assert from "node:assert/strict";
import test from "node:test";
import {
  assignmentStatusForQaResult,
  assignmentStatusForReplacement,
  canAccessAssignedProject,
  recommendActors,
} from "./actor-matching.js";
import { directorBriefSchema, directorInput } from "./ai-director.contract.js";
import { buildPerformanceOutputs } from "./performance-outputs.js";

const validBrief = {
  globalDirection: "Begin warmly, then finish with quiet confidence.",
  castingRequirements: {
    performerProfile: "An emotionally precise drama performer",
    apparentAge: "Any adult",
    genderPresentation: "Any",
    language: "English",
    accent: "French",
    wardrobe: "Plain dark top",
    notes: "Natural delivery",
  },
  captureRequirements: {
    location: "Quiet room",
    camera: "Phone on a tripod",
    cameraPosition: "Two metres in front",
    cameraHeight: "Eye level",
    framing: "Medium shot",
    orientation: "Landscape",
    lighting: "Soft light from the front",
    audio: "Quiet room with clear voice",
    background: "Plain wall",
    continuity: "Keep wardrobe and setup unchanged",
    fileFormat: "MP4 or MOV",
    recordingRequirements: "Record one continuous take without cuts",
  },
  qaCriteria: ["Landscape orientation", "Clear dialogue"],
  scenes: [
    {
      title: "Complete performance",
      dialogue: "This is the supplied script.",
      actingIntent: "Speak directly and naturally.",
      emotionalProgression: "Warm to confident.",
      startingPosition: "Stand centred and still.",
      eyeDirection: "Look into the lens.",
      timing: "22 seconds",
      bodyMovement: "One small step forward near the end.",
      gestures: "One open-hand gesture.",
      framingCamera: "Medium landscape shot.",
      captureRequirements: "Keep the full take continuous.",
    },
  ],
};

test("AI Director contract accepts exactly one logical scene and retains the supplied script", () => {
  assert.equal(
    directorBriefSchema.parse(validBrief).scenes[0]?.dialogue,
    "This is the supplied script.",
  );
  assert.equal(
    directorBriefSchema.safeParse({
      ...validBrief,
      scenes: [...validBrief.scenes, ...validBrief.scenes],
    }).success,
    false,
  );
  assert.match(directorInput({ script: "Exact words" }), /Exact words/);
});

test("approved-plan outputs create a plain actor guide and separate engine prompt", () => {
  const outputs = buildPerformanceOutputs({
    capturePlan: validBrief.captureRequirements,
    globalDirection: validBrief.globalDirection,
    qaCriteria: validBrief.qaCriteria,
    scene: {
      bodyPosition: validBrief.scenes[0]!.bodyMovement,
      captureRequirements: validBrief.scenes[0]!.captureRequirements,
      dialogue: validBrief.scenes[0]!.dialogue,
      direction: validBrief.scenes[0]!.actingIntent,
      duration: validBrief.scenes[0]!.timing,
      emotionalProgression: validBrief.scenes[0]!.emotionalProgression,
      eyeline: validBrief.scenes[0]!.eyeDirection,
      framing: validBrief.scenes[0]!.framingCamera,
      gestures: validBrief.scenes[0]!.gestures,
      startingPosition: validBrief.scenes[0]!.startingPosition,
    },
    targetAiTool: "Runway",
    title: "Test performance",
  });
  assert.equal(outputs.actorGuide.dialogue, "This is the supplied script.");
  assert.equal(outputs.actorGuide.steps.length, 5);
  assert.match(outputs.aiEnginePrompt, /Target engine: Runway/);
  assert.match(outputs.aiEnginePrompt, /Do not introduce new/);
});

test("recommendations exclude demos, prefer language matches, and remain deterministic", () => {
  const actors = [
    {
      id: "b",
      actAiScore: 100,
      country: "FR",
      isDemo: true,
      status: "APPROVED",
      languages: [{ language: "English" }],
      accents: [],
      skills: [],
    },
    {
      id: "c",
      actAiScore: 90,
      country: "FR",
      isDemo: false,
      status: "APPROVED",
      languages: [{ language: "French" }],
      accents: [],
      skills: [],
    },
    {
      id: "a",
      actAiScore: 60,
      country: "GB",
      isDemo: false,
      status: "APPROVED",
      languages: [{ language: "English" }],
      accents: [{ accent: "French" }],
      skills: [{ category: "DRAMA", label: null }],
    },
  ];
  const first = recommendActors(actors, {
    accent: "French",
    language: "English",
    skills: ["Drama"],
  });
  const second = recommendActors(actors, {
    accent: "French",
    language: "English",
    skills: ["Drama"],
  });
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((item) => item.actorId),
    ["a", "c"],
  );
  assert.ok(first[0]!.score > first[1]!.score);
});

test("project access is limited to its creator or assigned actor", () => {
  assert.equal(canAccessAssignedProject({ ownerId: "creator", userId: "creator" }), true);
  assert.equal(
    canAccessAssignedProject({ ownerId: "creator", assignedActorUserId: "actor", userId: "actor" }),
    true,
  );
  assert.equal(
    canAccessAssignedProject({
      ownerId: "creator",
      assignedActorUserId: "actor",
      userId: "stranger",
    }),
    false,
  );
});

test("QA pass/fail and retake replacement produce the expected assignment states", () => {
  assert.equal(assignmentStatusForQaResult("PASS"), "QA_PASSED");
  assert.equal(assignmentStatusForQaResult("FAIL"), "QA_FAILED");
  assert.equal(assignmentStatusForReplacement("QA_FAILED"), "ACCEPTED");
});
