import assert from "node:assert/strict";
import test from "node:test";
import {
  assignmentStatusForQaResult,
  assignmentStatusForReplacement,
  canAccessAssignedProject,
  canChangeActorAssignment,
  recommendActors,
  requiresRetakeBeforeResubmission,
} from "./actor-matching.js";
import { directorBriefSchema, directorInput } from "./ai-director.contract.js";
import { AiDirectorService } from "./ai-director.service.js";
import { PerformanceProjectsService } from "./performance-projects.service.js";
import { performanceOutputsInput, performanceOutputsSchema } from "./performance-outputs.js";
import { visualQaFailedCriteria, visualQaSchema } from "./visual-qa.contract.js";

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

const validOutputs = {
  actorGuide: {
    dialogue: "This is the supplied script.",
    duration: "22 seconds",
    finalChecklist: ["One continuous take", "Dialogue is clear"],
    overview: "Record one warm, confident performance.",
    steps: [
      { instruction: "Set the phone at eye level.", order: 1, title: "Set up" },
      { instruction: "Use soft front light.", order: 2, title: "Check the room" },
      { instruction: "Stand centred and look into the lens.", order: 3, title: "Get ready" },
      { instruction: "Perform the full script without cuts.", order: 4, title: "Record" },
    ],
  },
  aiEnginePrompt:
    "Runway: preserve the approved source performance, timing, lip sync, identity and continuity.",
};

test("performance output contract requires a plain 4–7 step actor guide", () => {
  assert.equal(
    performanceOutputsSchema.parse(validOutputs).actorGuide.dialogue,
    "This is the supplied script.",
  );
  assert.equal(
    performanceOutputsSchema.safeParse({
      ...validOutputs,
      actorGuide: { ...validOutputs.actorGuide, steps: validOutputs.actorGuide.steps.slice(0, 3) },
    }).success,
    false,
  );
  assert.match(performanceOutputsInput({ approvedBriefVersion: 3 }), /approvedBriefVersion/);
});

test("AI Director generates outputs through the configured provider and rejects malformed JSON", async () => {
  let capturedRequest: { input?: string; schemaName?: string } | undefined;
  const config = { get: (key: string) => (key === "AI_PROVIDER" ? "openai" : undefined) };
  const openai = {
    generate: async (request: { input: string; schemaName: string }) => {
      capturedRequest = request;
      return {
        model: "test-openai-model",
        outputText: JSON.stringify(validOutputs),
        responseId: "response-1",
      };
    },
  };
  const service = new AiDirectorService(config as never, {} as never, openai as never);
  const generated = await service.generateOutputs({
    approvedBriefVersion: 2,
    project: { targetAiTool: "Runway" },
  });

  assert.equal(generated.provider, "openai");
  assert.equal(generated.outputs.actorGuide.steps.length, 4);
  assert.equal(capturedRequest?.schemaName, "actbyme_performance_outputs");
  assert.match(capturedRequest?.input ?? "", /approvedBriefVersion/);

  const malformedService = new AiDirectorService(
    config as never,
    {} as never,
    {
      generate: async () => ({
        model: "test-openai-model",
        outputText: JSON.stringify({ ...validOutputs, actorGuide: { steps: [] } }),
        responseId: null,
      }),
    } as never,
  );
  await assert.rejects(
    () => malformedService.generateOutputs({ approvedBriefVersion: 2 }),
    /invalid structured performance outputs/,
  );
});

test("output generation uses the persisted approved version, replaces stale output, and is idempotent", async () => {
  const approvedAt = new Date("2026-09-24T08:00:00.000Z");
  let project = {
    actorGuide: { overview: "stale" },
    aiEnginePrompt: "stale prompt",
    assignment: null,
    brief: {
      approvedAt,
      approvedVersion: 2,
      capturePlan: validBrief.captureRequirements,
      globalDirection: validBrief.globalDirection,
      qaCriteria: validBrief.qaCriteria,
      talentRequirements: validBrief.castingRequirements,
      version: 2,
    },
    briefAttachment: null,
    consents: [],
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    language: "English",
    outputsBriefVersion: 1,
    ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    scenes: [
      {
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
        title: validBrief.scenes[0]!.title,
      },
    ],
    targetAiTool: "Runway",
    title: "Approved project",
  };
  const generatedInputs: Array<Record<string, unknown>> = [];
  const persistedUpdates: Array<Record<string, unknown>> = [];
  const prisma = {
    audit: async () => undefined,
    client: {
      performanceProject: {
        findFirst: async () => project,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          persistedUpdates.push(data);
          project = { ...project, ...data } as typeof project;
          return project;
        },
      },
    },
  };
  const aiDirector = {
    generateOutputs: async (input: Record<string, unknown>) => {
      generatedInputs.push(input);
      return {
        model: "test-model",
        outputs: validOutputs,
        provider: "openai",
        responseId: "output-response-2",
      };
    },
  };
  const service = new PerformanceProjectsService(
    prisma as never,
    {} as never,
    aiDirector as never,
    {} as never,
    {} as never,
  );
  const user = { id: project.ownerId, role: "CLIENT" } as never;

  await service.generateOutputs(user, project.id);
  assert.equal(generatedInputs.length, 1);
  assert.equal(generatedInputs[0]?.approvedBriefVersion, 2);
  assert.equal("script" in (generatedInputs[0] ?? {}), false);
  assert.equal(persistedUpdates[0]?.outputsBriefVersion, 2);
  assert.equal(persistedUpdates[0]?.outputsModel, "test-model");
  assert.equal(persistedUpdates[0]?.outputsProvider, "openai");
  assert.equal(persistedUpdates[0]?.outputsResponseId, "output-response-2");

  await service.generateOutputs(user, project.id);
  assert.equal(generatedInputs.length, 1, "same approved version must reuse persisted outputs");

  await service.generateOutputs(user, project.id, true);
  assert.equal(generatedInputs.length, 2, "explicit regeneration must call the provider again");
});

test("actor-facing assignment response includes the guide but never the creator AI prompt", () => {
  const service = new PerformanceProjectsService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const actorRequestResponse = (
    service as unknown as {
      actorRequestResponse: (assignment: Record<string, unknown>) => Record<string, unknown>;
    }
  ).actorRequestResponse.bind(service);
  const response = actorRequestResponse({
    acceptedAt: null,
    createdAt: new Date(),
    id: "assignment-1",
    project: {
      actorGuide: validOutputs.actorGuide,
      aiEnginePrompt: validOutputs.aiEnginePrompt,
      id: "project-1",
      language: "English",
      scenes: [],
      title: "Creator-only prompt test",
    },
    status: "SELECTED",
    submittedAt: null,
    updatedAt: new Date(),
  });

  assert.deepEqual(response.actorGuide, validOutputs.actorGuide);
  assert.equal("aiEnginePrompt" in response, false);
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

test("completing an already uploaded take is idempotent and preserves its QA state", async () => {
  const take = {
    id: "take-1",
    storageBucket: "private",
    storagePath: "performance-take/actor/project/scene/take.mp4",
    takeStatus: "QA_PASSED",
    uploadAttemptId: "attempt-1",
    uploadStatus: "UPLOADED",
  };
  const service = new PerformanceProjectsService(
    {} as never,
    {
      createSignedReadUrl: async () => "https://signed.example/performance",
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  (
    service as unknown as {
      requireAccessibleTake: () => Promise<typeof take>;
    }
  ).requireAccessibleTake = async () => take;

  const result = (await service.completeTakeUpload(
    { id: "actor" } as never,
    "project-1",
    "scene-1",
    take.id,
    { uploadAttemptId: take.uploadAttemptId } as never,
  )) as { readUrl?: string; takeStatus: string; uploadStatus: string };

  assert.equal(result.uploadStatus, "UPLOADED");
  assert.equal(result.takeStatus, "QA_PASSED");
  assert.equal(result.readUrl, "https://signed.example/performance");
});


test("actor assignment can change only before acceptance and before upload starts", () => {
  assert.equal(
    canChangeActorAssignment({
      assignmentStatus: "SELECTED",
      currentActorProfileId: "actor-a",
      nextActorProfileId: "actor-b",
      hasTake: false,
    }),
    true,
  );
  assert.equal(
    canChangeActorAssignment({
      assignmentStatus: "ACCEPTED",
      currentActorProfileId: "actor-a",
      nextActorProfileId: "actor-b",
      hasTake: false,
    }),
    false,
  );
  assert.equal(
    canChangeActorAssignment({
      assignmentStatus: "SELECTED",
      currentActorProfileId: "actor-a",
      nextActorProfileId: "actor-b",
      hasTake: true,
    }),
    false,
  );
  assert.equal(
    canChangeActorAssignment({
      assignmentStatus: "QA_PASSED",
      currentActorProfileId: "actor-a",
      nextActorProfileId: "actor-a",
      hasTake: true,
    }),
    true,
    "re-selecting the same actor remains idempotent",
  );
});

test("failed QA requires a new retake but technical QA errors can retry the same upload", () => {
  assert.equal(
    requiresRetakeBeforeResubmission({
      assignmentStatus: "QA_FAILED",
      currentUploadAttemptId: "attempt-1",
      latestQaRun: {
        result: "FAIL",
        status: "COMPLETED",
        uploadAttemptId: "attempt-1",
      },
    }),
    true,
  );
  assert.equal(
    requiresRetakeBeforeResubmission({
      assignmentStatus: "QA_FAILED",
      currentUploadAttemptId: "attempt-1",
      latestQaRun: {
        result: null,
        status: "ERROR",
        uploadAttemptId: "attempt-1",
      },
    }),
    false,
  );
  assert.equal(
    requiresRetakeBeforeResubmission({
      assignmentStatus: "QA_FAILED",
      currentUploadAttemptId: "attempt-2",
      latestQaRun: {
        result: "FAIL",
        status: "COMPLETED",
        uploadAttemptId: "attempt-1",
      },
    }),
    false,
    "a replacement upload may be submitted",
  );
});


test("visual QA contract is conservative about sampled-frame uncertainty", () => {
  const parsed = visualQaSchema.parse({
    summary: "Framing matches; movement cannot be confirmed from still frames.",
    framing: { result: "PASS", observation: "Medium framing is consistent.", correction: "" },
    subjectPosition: { result: "PASS", observation: "Performer remains centered.", correction: "" },
    eyeline: {
      result: "NOT_OBSERVABLE",
      observation: "Eye direction is not clear enough in the sampled frames.",
      correction: "",
    },
    backgroundLighting: {
      result: "PASS",
      observation: "Background and front lighting remain consistent.",
      correction: "",
    },
    movementGesture: {
      result: "NOT_OBSERVABLE",
      observation: "The requested gesture cannot be reliably inferred from still samples.",
      correction: "",
    },
  });
  assert.equal(visualQaFailedCriteria(parsed).length, 0);
});

test("visual QA exposes only explicit visible failures as retake blockers", () => {
  const parsed = visualQaSchema.parse({
    summary: "The framing is visibly too tight.",
    framing: {
      result: "FAIL",
      observation: "Only head and shoulders are visible instead of the approved medium shot.",
      correction: "Move the camera back until the approved medium framing is visible.",
    },
    subjectPosition: { result: "PASS", observation: "Centered.", correction: "" },
    eyeline: { result: "PASS", observation: "Looking toward the lens.", correction: "" },
    backgroundLighting: {
      result: "NOT_OBSERVABLE",
      observation: "The exact approved lighting source is not verifiable.",
      correction: "",
    },
    movementGesture: {
      result: "NOT_OBSERVABLE",
      observation: "Motion cannot be confirmed.",
      correction: "",
    },
  });
  assert.deepEqual(visualQaFailedCriteria(parsed).map(([name]) => name), ["framing"]);
});
