import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DirectorProviderRequest, DirectorProviderResponse } from "./ai-director.contract.js";

const AI_DIRECTOR_MODEL = "gpt-5.6-terra";

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

  async generate(request: DirectorProviderRequest): Promise<DirectorProviderResponse> {
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
          instructions: request.instructions,
          input: [
            {
              role: "user",
              content: [{ type: "input_text", text: request.input }],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "actbyme_director_brief",
              strict: true,
              schema: request.schema,
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

    return {
      model: AI_DIRECTOR_MODEL,
      outputText,
      responseId: result.id ?? null,
    };
  }
}
