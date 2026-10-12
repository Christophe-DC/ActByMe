import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  visualQaInput,
  visualQaInstructions,
  visualQaJsonSchema,
  visualQaSchema,
  type VisualQaResult,
} from "./visual-qa.contract.js";

const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;
const TOTAL_TIMEOUT_MS = 120_000;

type GeminiInteraction = {
  id?: string;
  model?: string;
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  output_text?: string;
  error?: { code?: string | number; message?: string };
};

@Injectable()
export class GeminiVisualQaService {
  private readonly logger = new Logger(GeminiVisualQaService.name);
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

    const primaryModel =
      this.config.get<string>("GEMINI_VISUAL_QA_MODEL")?.trim() ||
      this.config.get<string>("GEMINI_DIRECTOR_MODEL")?.trim() ||
      DEFAULT_MODEL;

    const { response, model } = await this.requestWithFallback(apiKey, primaryModel, {
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
    });

    const interaction = (await response.json()) as GeminiInteraction;
    if (interaction.status !== "completed") {
      throw new ServiceUnavailableException("Gemini visual QA returned an incomplete response.");
    }

    const outputText =
      interaction.output_text?.trim() ||
      interaction.steps
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
      throw new ServiceUnavailableException(
        "Gemini visual QA returned an invalid structured result.",
        {
          cause: error,
        },
      );
    }

    this.logger.log(`Visual QA completed model=${interaction.model ?? model}`);
    return {
      model: interaction.model ?? model,
      responseId: interaction.id ?? null,
      result: parsed,
    };
  }

  private async requestWithFallback(
    apiKey: string,
    primaryModel: string,
    body: Record<string, unknown>,
  ) {
    const configuredFallbacks =
      this.config
        .get<string>("GEMINI_VISUAL_QA_FALLBACK_MODELS")
        ?.split(",")
        .map((model) => model.trim())
        .filter(Boolean) ?? [];
    const models = [
      ...new Set([primaryModel, ...configuredFallbacks, ...DEFAULT_FALLBACK_MODELS]),
    ].slice(0, MAX_ATTEMPTS);
    const deadline = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
    let quotaExceeded = false;

    for (const [index, model] of models.entries()) {
      if (deadline.aborted) break;
      this.logger.log(`Visual QA request model=${model} attempt=${index + 1}/${models.length}`);
      let response: Response;
      try {
        response = await fetch("https://generativelanguage.googleapis.com/v1/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ ...body, model }),
          signal: AbortSignal.any([deadline, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
        });
      } catch {
        this.logger.warn(`Visual QA transport failure model=${model} attempt=${index + 1}`);
        continue;
      }
      if (response.ok) return { response, model };
      const payload = (await response.json().catch(() => null)) as GeminiInteraction | null;
      const retryable = RETRYABLE_STATUSES.has(response.status) || response.status === 404;
      this.logger.warn(
        `Visual QA upstream failure model=${model} httpStatus=${response.status} retryable=${retryable}`,
      );
      if (!retryable) {
        throw new ServiceUnavailableException(
          `Gemini visual QA request failed with status ${response.status}. Check the API configuration.`,
        );
      }
      if (response.status === 429 && /quota|billing|credit/i.test(payload?.error?.message ?? "")) {
        // Gemini quotas can be model-specific; another model may still have capacity.
        quotaExceeded = true;
      }
      // Each attempt uses a different model, so do not wait on the overloaded model.
    }
    throw new ServiceUnavailableException(
      quotaExceeded
        ? "Visual QA could not complete: Gemini reported quota exhaustion and no configured model was available. Check your Google AI quota or billing, then retry QA with the same video."
        : "Visual QA could not complete: all configured Gemini models are unavailable. Retry QA with the same video.",
    );
  }
}
