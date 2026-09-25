import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  visualQaInput,
  visualQaInstructions,
  visualQaJsonSchema,
  visualQaSchema,
  type VisualQaResult,
} from "./visual-qa.contract.js";

type OpenAiResponse = {
  id?: string;
  status?: string;
  incomplete_details?: { reason?: string };
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
};

@Injectable()
export class OpenAiVisualQaService {
  constructor(private readonly config: ConfigService) {}

  async evaluate(frames: Uint8Array[], requirements: Record<string, unknown>) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "Visual QA is not configured. Set OPENAI_API_KEY on the API server.",
      );
    }
    if (!frames.length) {
      throw new ServiceUnavailableException("Visual QA could not extract video frames.");
    }

    const model = this.config.get<string>("OPENAI_VISUAL_QA_MODEL")?.trim() || "gpt-6-luna";
    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: visualQaInput(requirements, frames.length) },
      ...frames.map((frame) => ({
        type: "input_image",
        image_url: `data:image/jpeg;base64,${Buffer.from(frame).toString("base64")}`,
        detail: "high",
      })),
    ];

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          store: false,
          reasoning: { effort: "none" },
          instructions: visualQaInstructions,
          input: [{ role: "user", content }],
          text: {
            format: {
              type: "json_schema",
              name: "actbyme_visual_qa",
              strict: true,
              schema: visualQaJsonSchema,
            },
          },
          max_output_tokens: 1800,
        }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      throw new ServiceUnavailableException("Visual QA could not reach OpenAI.", { cause: error });
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Visual QA request failed with status ${response.status}.`,
      );
    }

    const result = (await response.json()) as OpenAiResponse;
    const refusal = result.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "refusal")?.refusal;
    if (refusal) throw new ServiceUnavailableException("Visual QA could not assess this take.");
    if (result.status !== "completed") {
      const reason = result.incomplete_details?.reason;
      throw new ServiceUnavailableException(
        reason ? `Visual QA response was incomplete (${reason}).` : "Visual QA response was incomplete.",
      );
    }

    const outputText = result.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;
    if (!outputText) {
      throw new ServiceUnavailableException("Visual QA returned no structured result.");
    }

    let parsed: VisualQaResult;
    try {
      parsed = visualQaSchema.parse(JSON.parse(outputText));
    } catch (error) {
      throw new ServiceUnavailableException("Visual QA returned an invalid structured result.", {
        cause: error,
      });
    }
    return { model, responseId: result.id ?? null, result: parsed };
  }
}
