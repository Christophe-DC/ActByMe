import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

const AI_DIRECTOR_MODEL = "gpt-5.6-terra";

const directorBriefSchema = z.object({
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

const directorBriefJsonSchema = {
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

type OpenAiResponse = {
  id?: string;
  status?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

@Injectable()
export class OpenAiDirectorService {
  constructor(private readonly config: ConfigService) {}

  async generate(projectData: Record<string, unknown>): Promise<{
    brief: DirectorBriefResult;
    model: string;
    responseId: string | null;
  }> {
    const apiKey = this.config.get<string>("OPENAI_API_KEY")?.trim();

    if (!apiKey) {
      throw new ServiceUnavailableException(
        "AI Director is not configured. Set OPENAI_API_KEY on the API server.",
      );
    }

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_DIRECTOR_MODEL,
          store: false,
          instructions: [
            "You are ActByMe's AI Director.",
            "Build a practical, performer-ready director brief using only the supplied project facts.",
            "Do not invent brand facts, uploaded-file contents, rights, pricing, performers, or delivery promises.",
            "You may make clearly actionable creative and technical directing decisions needed to execute the performance.",
            "Write dialogue in the requested project language. If no exact script was supplied, write concise original dialogue that serves the stated objective.",
            "Make every field specific, editable, internally consistent, safe for remote video capture, and suitable for MP4 or MOV upload.",
          ].join(" "),
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Create the Director Brief from this persisted project data:\n${JSON.stringify(projectData)}`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "actbyme_director_brief",
              strict: true,
              schema: directorBriefJsonSchema,
            },
          },
        }),
      });
    } catch (error) {
      throw new ServiceUnavailableException("The AI Director could not reach OpenAI.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `The AI Director request failed with status ${response.status}.`,
      );
    }

    const result = (await response.json()) as OpenAiResponse;
    const refusal = result.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "refusal")?.refusal;

    if (refusal) {
      throw new ServiceUnavailableException("The AI Director could not generate this brief.");
    }

    if (result.status !== "completed") {
      const reason = result.incomplete_details?.reason;
      throw new ServiceUnavailableException(
        reason
          ? `The AI Director response was incomplete (${reason}).`
          : "The AI Director response was incomplete.",
      );
    }

    const outputText = result.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;

    if (!outputText) {
      throw new ServiceUnavailableException("The AI Director returned no structured brief.");
    }

    try {
      return {
        brief: directorBriefSchema.parse(JSON.parse(outputText)),
        model: AI_DIRECTOR_MODEL,
        responseId: result.id ?? null,
      };
    } catch (error) {
      throw new ServiceUnavailableException(
        "The AI Director returned an invalid structured brief.",
        { cause: error },
      );
    }
  }
}
