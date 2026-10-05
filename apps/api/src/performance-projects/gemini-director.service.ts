import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { setTimeout as wait } from "node:timers/promises";
import type { DirectorProviderRequest, DirectorProviderResponse } from "./ai-director.contract.js";

const DEFAULT_GEMINI_DIRECTOR_MODEL = "gemini-3.8-flash";
const DEFAULT_GEMINI_FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
] as const;
const MAX_GEMINI_ATTEMPTS = 5;
const RETRYABLE_GEMINI_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

type GeminiInteraction = {
  error?: {
    code?: string;
    message?: string;
  };
  id?: string;
  model?: string;
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

@Injectable()
export class GeminiDirectorService {
  private readonly logger = new Logger(GeminiDirectorService.name);

  constructor(private readonly config: ConfigService) {}

  async generate(request: DirectorProviderRequest): Promise<DirectorProviderResponse> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "AI Director is not configured. Set GEMINI_API_KEY on the API server.",
      );
    }

    const primaryModel =
      this.config.get<string>("GEMINI_DIRECTOR_MODEL")?.trim() || DEFAULT_GEMINI_DIRECTOR_MODEL;
    const configuredFallbacks =
      this.config
        .get<string>("GEMINI_DIRECTOR_FALLBACK_MODELS")
        ?.split(",")
        .map((model) => model.trim())
        .filter(Boolean) ?? [];
    const legacyFallbacks = [
      this.config.get<string>("GEMINI_DIRECTOR_FALLBACK_MODEL")?.trim(),
      this.config.get<string>("GEMINI_DIRECTOR_FINAL_FALLBACK_MODEL")?.trim(),
    ].filter((model): model is string => Boolean(model));
    const uniqueModels = [
      ...new Set([
        primaryModel,
        ...configuredFallbacks,
        ...legacyFallbacks,
        ...DEFAULT_GEMINI_FALLBACK_MODELS,
      ]),
    ];
    const attemptModels = Array.from(
      { length: MAX_GEMINI_ATTEMPTS },
      (_, index) => uniqueModels[index] ?? uniqueModels.at(-1) ?? primaryModel,
    );

    for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
      const model = attemptModels[attempt - 1] ?? primaryModel;
      this.logger.log(
        `AI Director request provider=gemini model=${model} attempt=${attempt}/${MAX_GEMINI_ATTEMPTS}`,
      );

      let response: Response;
      try {
        response = await fetch("https://generativelanguage.googleapis.com/v1/interactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            model,
            store: false,
            system_instruction: request.instructions,
            input: request.input,
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: request.schema,
            },
          }),
          signal: AbortSignal.timeout(180_000),
        });
      } catch (error) {
        this.logger.error(
          `AI Director transport failure provider=gemini model=${model} attempt=${attempt}`,
          stackFrames(error),
        );
        if (attempt < MAX_GEMINI_ATTEMPTS) {
          await wait(retryDelayMilliseconds(attempt));
          continue;
        }
        throw new ServiceUnavailableException("The AI Director could not reach Gemini.", {
          cause: error,
        });
      }

      if (!response.ok) {
        const upstreamError = await readGeminiError(response);
        const retryable = RETRYABLE_GEMINI_STATUSES.has(response.status);
        this.logger.warn(
          `AI Director upstream failure provider=gemini model=${model} attempt=${attempt} httpStatus=${response.status} errorCode=${upstreamError.code ?? "unknown"} retryable=${retryable}`,
        );
        if (retryable && attempt < MAX_GEMINI_ATTEMPTS) {
          await wait(retryDelayMilliseconds(attempt, response.headers.get("retry-after")));
          continue;
        }
        throw new ServiceUnavailableException(
          geminiFailureMessage(response.status, upstreamError),
        );
      }

      let result: GeminiInteraction;
      try {
        result = (await response.json()) as GeminiInteraction;
      } catch (error) {
        this.logger.error(
          `AI Director response parsing failure provider=gemini model=${model} httpStatus=${response.status}`,
          stackFrames(error),
        );
        throw new ServiceUnavailableException("The AI Director returned an invalid response.", {
          cause: error,
        });
      }

      if (result.status !== "completed") {
        this.logger.warn(
          `AI Director incomplete response provider=gemini model=${result.model ?? model} httpStatus=${response.status} status=${result.status ?? "unknown"} errorCode=${result.error?.code ?? "unknown"}`,
        );
        throw new ServiceUnavailableException("The AI Director response was incomplete.");
      }

      const outputText = result.steps
        ?.filter((step) => step.type === "model_output")
        .flatMap((step) => step.content ?? [])
        .filter((content) => content.type === "text" && content.text)
        .at(-1)?.text;

      if (!outputText) {
        this.logger.error(
          `AI Director missing output provider=gemini model=${result.model ?? model} httpStatus=${response.status} stepTypes=${result.steps?.map((step) => step.type ?? "unknown").join(",") || "none"}`,
        );
        throw new ServiceUnavailableException("The AI Director returned no structured brief.");
      }

      this.logger.log(
        `AI Director response completed provider=gemini model=${result.model ?? model} httpStatus=${response.status}`,
      );
      return {
        model: result.model ?? model,
        outputText,
        responseId: result.id ?? null,
      };
    }

    throw new ServiceUnavailableException("Gemini is temporarily unavailable.");
  }
}

async function readGeminiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as GeminiInteraction | null;
  return {
    code: payload?.error?.code,
    message: payload?.error?.message,
  };
}

function retryDelayMilliseconds(attempt: number, retryAfter?: string | null) {
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(15_000, retryAfterSeconds * 1_000);
  }
  const baseDelay = Math.min(8_000, 1_000 * 2 ** (attempt - 1));
  return baseDelay + Math.floor(Math.random() * 250);
}

function geminiFailureMessage(
  status: number,
  error: { code?: string; message?: string },
) {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message ?? "";

  if (status === 429) {
    if (code === "quota_exceeded" || /quota|credit|billing/i.test(message)) {
      return "Gemini quota is exhausted. Check your Google AI quota or billing before retrying.";
    }
    return "Gemini rate limit was reached. Please retry in a moment.";
  }
  if (status === 503) {
    return "Gemini is temporarily overloaded. Please retry in a moment.";
  }
  if (status >= 500) {
    return "Gemini returned a temporary server error. Please retry in a moment.";
  }
  return `The AI Director request failed with status ${status}.`;
}

function stackFrames(error: unknown) {
  return error instanceof Error ? error.stack?.split("\n").slice(1).join("\n") : undefined;
}
