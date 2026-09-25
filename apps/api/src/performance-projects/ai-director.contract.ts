import { z } from "zod";

export const directorBriefSchema = z.object({
  globalDirection: z.string(),
  castingRequirements: z.object({
    performerProfile: z.string(),
    apparentAge: z.string(),
    genderPresentation: z.string(),
    language: z.string(),
    accent: z.string(),
    wardrobe: z.string(),
    notes: z.string(),
  }),
  captureRequirements: z.object({
    location: z.string(),
    camera: z.string(),
    cameraPosition: z.string(),
    cameraHeight: z.string(),
    framing: z.string(),
    orientation: z.string(),
    lighting: z.string(),
    audio: z.string(),
    background: z.string(),
    continuity: z.string(),
    fileFormat: z.string(),
    recordingRequirements: z.string(),
  }),
  qaCriteria: z.array(z.string()).min(1),
  scenes: z
    .array(
      z.object({
        title: z.string(),
        dialogue: z.string(),
        actingIntent: z.string(),
        emotionalProgression: z.string(),
        startingPosition: z.string(),
        eyeDirection: z.string(),
        timing: z.string(),
        bodyMovement: z.string(),
        gestures: z.string(),
        framingCamera: z.string(),
        captureRequirements: z.string(),
      }),
    )
    .min(1)
    .max(1),
});

export type DirectorBriefResult = z.infer<typeof directorBriefSchema>;

const stringField = { type: "string" } as const;

export const directorBriefJsonSchema = {
  type: "object",
  properties: {
    globalDirection: stringField,
    castingRequirements: {
      type: "object",
      properties: {
        performerProfile: stringField,
        apparentAge: stringField,
        genderPresentation: stringField,
        language: stringField,
        accent: stringField,
        wardrobe: stringField,
        notes: stringField,
      },
      required: [
        "performerProfile",
        "apparentAge",
        "genderPresentation",
        "language",
        "accent",
        "wardrobe",
        "notes",
      ],
      additionalProperties: false,
    },
    captureRequirements: {
      type: "object",
      properties: {
        location: stringField,
        camera: stringField,
        cameraPosition: stringField,
        cameraHeight: stringField,
        framing: stringField,
        orientation: stringField,
        lighting: stringField,
        audio: stringField,
        background: stringField,
        continuity: stringField,
        fileFormat: stringField,
        recordingRequirements: stringField,
      },
      required: [
        "location",
        "camera",
        "cameraPosition",
        "cameraHeight",
        "framing",
        "orientation",
        "lighting",
        "audio",
        "background",
        "continuity",
        "fileFormat",
        "recordingRequirements",
      ],
      additionalProperties: false,
    },
    qaCriteria: {
      type: "array",
      items: stringField,
      minItems: 1,
    },
    scenes: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: {
        type: "object",
        properties: {
          title: stringField,
          dialogue: stringField,
          actingIntent: stringField,
          emotionalProgression: stringField,
          startingPosition: stringField,
          eyeDirection: stringField,
          timing: stringField,
          bodyMovement: stringField,
          gestures: stringField,
          framingCamera: stringField,
          captureRequirements: stringField,
        },
        required: [
          "title",
          "dialogue",
          "actingIntent",
          "emotionalProgression",
          "startingPosition",
          "eyeDirection",
          "timing",
          "bodyMovement",
          "gestures",
          "framingCamera",
          "captureRequirements",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "globalDirection",
    "castingRequirements",
    "captureRequirements",
    "qaCriteria",
    "scenes",
  ],
  additionalProperties: false,
} as const;

export const directorInstructions = [
  "You are ActByMe's AI Director.",
  "Build a practical shooting plan for exactly one continuous 15–30 second performance using only the supplied script and project facts.",
  "Do not invent brand facts, uploaded-file contents, rights, pricing, performers, or delivery promises.",
  "You may make clearly actionable creative and technical directing decisions needed to execute the performance.",
  "Return exactly one scene and preserve the supplied script as the dialogue; do not add, rewrite, or omit factual claims.",
  "Specify emotional progression, starting position, movement, eyeline, gestures, camera position and height, framing, orientation, lighting, audio, background, wardrobe continuity, recording requirements, and objective QA criteria.",
  "Make every field specific, editable, internally consistent, safe for remote video capture, and suitable for MP4 or MOV upload.",
].join(" ");

export function directorInput(projectData: Record<string, unknown>) {
  return `Create the Director Brief from this persisted project data:\n${JSON.stringify(projectData)}`;
}

export type DirectorProviderRequest = {
  input: string;
  instructions: string;
  schema: Record<string, unknown>;
  schemaName: string;
};

export type DirectorProviderResponse = {
  model: string;
  outputText: string;
  responseId: string | null;
};
