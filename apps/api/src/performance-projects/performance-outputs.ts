import { z } from "zod";

const actorGuideStepSchema = z
  .object({
    order: z.number().int().min(1).max(7),
    title: z.string().min(1),
    instruction: z.string().min(1),
  })
  .strict();

export const performanceOutputsSchema = z
  .object({
    actorGuide: z
      .object({
        duration: z.string().min(1),
        overview: z.string().min(1),
        steps: z
          .array(actorGuideStepSchema)
          .min(4)
          .max(7)
          .refine((steps) => steps.every((step, index) => step.order === index + 1), {
            message: "Actor Guide steps must use consecutive order numbers starting at 1.",
          }),
        dialogue: z.string(),
        finalChecklist: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    aiEnginePrompt: z.string().min(1),
  })
  .strict();

export type PerformanceOutputsResult = z.infer<typeof performanceOutputsSchema>;
export type ActorGuide = PerformanceOutputsResult["actorGuide"];

const stringField = { type: "string" } as const;

export const performanceOutputsJsonSchema = {
  type: "object",
  properties: {
    actorGuide: {
      type: "object",
      properties: {
        duration: stringField,
        overview: stringField,
        steps: {
          type: "array",
          minItems: 4,
          maxItems: 7,
          items: {
            type: "object",
            properties: {
              order: { type: "integer", minimum: 1, maximum: 7 },
              title: stringField,
              instruction: stringField,
            },
            required: ["order", "title", "instruction"],
            additionalProperties: false,
          },
        },
        dialogue: stringField,
        finalChecklist: {
          type: "array",
          minItems: 1,
          items: stringField,
        },
      },
      required: ["duration", "overview", "steps", "dialogue", "finalChecklist"],
      additionalProperties: false,
    },
    aiEnginePrompt: stringField,
  },
  required: ["actorGuide", "aiEnginePrompt"],
  additionalProperties: false,
} as const;

export const performanceOutputsInstructions = [
  "You are ActByMe's AI Director producing two final outputs from a locked, approved shooting plan.",
  "Use only the supplied persisted approved plan. Do not invent or change dialogue, brand facts, people, claims, rights, pricing, or delivery promises.",
  "The Actor Guide must use short, plain, encouraging language that an actor can follow without production expertise.",
  "Give 4 to 7 numbered steps covering setup, starting position, performance direction, and one uninterrupted take.",
  "Keep all plan-critical camera, eyeline, movement, gesture, lighting, audio, background, wardrobe, duration, and continuity requirements, but simplify their wording.",
  "The final checklist must be observable and useful before upload.",
  "The AI Engine Prompt is creator-only. Make it detailed, production-ready, and explicitly tailored to the target engine named in the approved data.",
  "It must preserve the approved source performance, dialogue, timing, identity, lip sync, camera, framing, emotional arc, motion, lighting, audio, and continuity.",
  "It must also forbid new dialogue, logos, text, people, product claims, or brand facts absent from the approved plan and source performance.",
].join(" ");

export function performanceOutputsInput(approvedPlan: Record<string, unknown>) {
  return `Create the Actor Guide and AI Engine Prompt from this persisted, locked approved plan:\n${JSON.stringify(approvedPlan)}`;
}
