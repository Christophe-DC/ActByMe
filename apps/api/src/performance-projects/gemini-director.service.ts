import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DirectorProviderRequest, DirectorProviderResponse } from "./ai-director.contract.js";

const DEFAULT_GEMINI_DIRECTOR_MODEL = "gemini-3.8-flash";

type GeminiInteraction = {
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
  constructor(private readonly config: ConfigService) {}

  async generate(request: DirectorProviderRequest): Promise<DirectorProviderResponse> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "AI Director is not configured. Set GEMINI_API_KEY on the API server.",
      );
    }

    const model =
      this.config.get<string>("GEMINI_DIRECTOR_MODEL")?.trim() || DEFAULT_GEMINI_DIRECTOR_MODEL;

    let response: Response;
    try {
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
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
      });
    } catch (error) {
      throw new ServiceUnavailableException("The AI Director could not reach Gemini.", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `The AI Director request failed with status ${response.status}.`,
      );
    }

    const result = (await response.json()) as GeminiInteraction;
    if (result.status !== "completed") {
      throw new ServiceUnavailableException("The AI Director response was incomplete.");
    }

    const outputText = result.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((content) => content.type === "text" && content.text)
      .at(-1)?.text;

    if (!outputText) {
      throw new ServiceUnavailableException("The AI Director returned no structured brief.");
    }

    return {
      model: result.model ?? model,
      outputText,
      responseId: result.id ?? null,
    };
  }
}
