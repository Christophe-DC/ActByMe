import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  visualQaInput,
  visualQaInstructions,
  visualQaJsonSchema,
  visualQaSchema,
  type VisualQaResult,
} from "./visual-qa.contract.js";

const DEFAULT_MODEL = "gemini-3.8-flash";

type GeminiInteraction = {
  id?: string;
  model?: string;
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
};

@Injectable()
export class GeminiVisualQaService {
  constructor(private readonly config: ConfigService) {}

  async evaluate(frames: Uint8Array[], requirements: Record<string, unknown>) {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "Visual QA is not configured. Set GEMINI_API_KEY on the API server.",
      );
    }
    if (!frames.length) {
      throw new ServiceUnavailableException("Visual QA could not extract video frames.");
    }

    const model =
      this.config.get<string>("GEMINI_VISUAL_QA_MODEL")?.trim() ||
      this.config.get<string>("GEMINI_DIRECTOR_MODEL")?.trim() ||
      DEFAULT_MODEL;

    const response = await fetch("https://generativelanguage.googleapis.com/v1/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model,
        store: false,
        system_instruction: visualQaInstructions,
        input: [
          {
            type: "user_input",
            content: [
              { type: "text", text: visualQaInput(requirements, frames.length) },
              ...frames.map((frame) => ({
                type: "image",
                data: Buffer.from(frame).toString("base64"),
                mime_type: "image/jpeg",
                resolution: "high",
              })),
            ],
          },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: visualQaJsonSchema,
        },
      }),
      signal: AbortSignal.timeout(180_000),
    }).catch((error: unknown) => {
      throw new ServiceUnavailableException("Visual QA could not reach Gemini.", { cause: error });
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as GeminiInteraction | null;
      throw new ServiceUnavailableException(
        payload?.error?.message || `Gemini visual QA failed with status ${response.status}.`,
      );
    }

    const interaction = (await response.json()) as GeminiInteraction;
    if (interaction.status !== "completed") {
      throw new ServiceUnavailableException("Gemini visual QA returned an incomplete response.");
    }

    const outputText = interaction.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((content) => content.type === "text" && content.text)
      .at(-1)?.text;

    if (!outputText) {
      throw new ServiceUnavailableException("Gemini visual QA returned no structured result.");
    }

    let parsed: VisualQaResult;
    try {
      parsed = visualQaSchema.parse(JSON.parse(outputText));
    } catch (error) {
      throw new ServiceUnavailableException("Gemini visual QA returned an invalid structured result.", {
        cause: error,
      });
    }

    return {
      model: interaction.model ?? model,
      responseId: interaction.id ?? null,
      result: parsed,
    };
  }
}
