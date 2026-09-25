import { z } from "zod";

const visualCriterionSchema = z
  .object({
    result: z.enum(["PASS", "FAIL", "NOT_OBSERVABLE"]),
    observation: z.string(),
    correction: z.string(),
  })
  .strict();

export const visualQaSchema = z
  .object({
    summary: z.string().min(1),
    framing: visualCriterionSchema,
    subjectPosition: visualCriterionSchema,
    eyeline: visualCriterionSchema,
    backgroundLighting: visualCriterionSchema,
    movementGesture: visualCriterionSchema,
  })
  .strict();

export type VisualQaResult = z.infer<typeof visualQaSchema>;
export type VisualQaCriterion = z.infer<typeof visualCriterionSchema>;

const criterionJsonSchema = {
  type: "object",
  properties: {
    result: { type: "string", enum: ["PASS", "FAIL", "NOT_OBSERVABLE"] },
    observation: { type: "string" },
    correction: { type: "string" },
  },
  required: ["result", "observation", "correction"],
  additionalProperties: false,
} as const;

export const visualQaJsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    framing: criterionJsonSchema,
    subjectPosition: criterionJsonSchema,
    eyeline: criterionJsonSchema,
    backgroundLighting: criterionJsonSchema,
    movementGesture: criterionJsonSchema,
  },
  required: [
    "summary",
    "framing",
    "subjectPosition",
    "eyeline",
    "backgroundLighting",
    "movementGesture",
  ],
  additionalProperties: false,
} as const;

export const visualQaInstructions = [
  "You are ActByMe's visual compliance checker.",
  "Compare only observable facts in the supplied sampled frames against the approved requirements.",
  "This is a production-compliance check, not a creative review.",
  "Never judge identity, attractiveness, age, ethnicity, gender, health, emotion quality, personality, or acting talent.",
  "Use FAIL only when the sampled frames clearly contradict an explicit approved visual requirement.",
  "Use NOT_OBSERVABLE when a requirement is absent, vague, hidden, or cannot be reliably determined from sampled still frames.",
  "NOT_OBSERVABLE must not be treated as failure.",
  "For movement or gestures, compare changes across frames only when they are clearly visible; otherwise use NOT_OBSERVABLE.",
  "Do not infer camera hardware, lens, off-screen setup, or intentions that are not visible.",
  "For PASS and NOT_OBSERVABLE, correction must be an empty string.",
  "For FAIL, correction must be one short, concrete instruction the actor can follow on the retake.",
].join(" ");

export function visualQaInput(requirements: Record<string, unknown>, frameCount: number) {
  return [
    `These are ${frameCount} ordered frames sampled from one continuous performance take.`,
    "Assess the five visual criteria using only the approved requirements below.",
    JSON.stringify(requirements),
  ].join("\n");
}

export function visualQaFailedCriteria(result: VisualQaResult) {
  return [
    ["framing", result.framing],
    ["subjectPosition", result.subjectPosition],
    ["eyeline", result.eyeline],
    ["backgroundLighting", result.backgroundLighting],
    ["movementGesture", result.movementGesture],
  ].filter((entry): entry is [string, VisualQaCriterion] => entry[1].result === "FAIL");
}
