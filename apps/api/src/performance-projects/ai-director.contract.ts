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
    framing: z.string(),
    lighting: z.string(),
    audio: z.string(),
    background: z.string(),
    continuity: z.string(),
    fileFormat: z.string(),
  }),
  qaCriteria: z.array(z.string()).min(1),
  scenes: z
    .array(
      z.object({
        title: z.string(),
        dialogue: z.string(),
        actingIntent: z.string(),
        eyeDirection: z.string(),
        timing: z.string(),
        bodyMovement: z.string(),
        gestures: z.string(),
        framingCamera: z.string(),
        captureRequirements: z.string(),
      }),
    )
    .min(1),
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
        framing: stringField,
        lighting: stringField,
        audio: stringField,
        background: stringField,
        continuity: stringField,
        fileFormat: stringField,
      },
      required: [
        "location",
        "camera",
        "framing",
        "lighting",
        "audio",
        "background",
        "continuity",
        "fileFormat",
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
      items: {
        type: "object",
        properties: {
          title: stringField,
          dialogue: stringField,
          actingIntent: stringField,
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
  "Build a practical, performer-ready director brief using only the supplied project facts.",
  "Do not invent brand facts, uploaded-file contents, rights, pricing, performers, or delivery promises.",
  "You may make clearly actionable creative and technical directing decisions needed to execute the performance.",
  "Write dialogue in the requested project language. If no exact script was supplied, write concise original dialogue that serves the stated objective.",
  "Make every field specific, editable, internally consistent, safe for remote video capture, and suitable for MP4 or MOV upload.",
].join(" ");

export function directorInput(projectData: Record<string, unknown>) {
  return `Create the Director Brief from this persisted project data:\n${JSON.stringify(projectData)}`;
}

export type DirectorProviderRequest = {
  input: string;
  instructions: string;
  schema: typeof directorBriefJsonSchema;
};

export type DirectorProviderResponse = {
  model: string;
  outputText: string;
  responseId: string | null;
};
