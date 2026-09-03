import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  directorBriefJsonSchema,
  directorBriefSchema,
  directorInput,
  directorInstructions,
  type DirectorBriefResult,
  type DirectorProviderRequest,
} from "./ai-director.contract.js";
import { GeminiDirectorService } from "./gemini-director.service.js";
import { OpenAiDirectorService } from "./openai-director.service.js";

type AiProvider = "gemini" | "openai";

@Injectable()
export class AiDirectorService {
  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiDirectorService,
    private readonly openai: OpenAiDirectorService,
  ) {}

  async generate(projectData: Record<string, unknown>): Promise<{
    brief: DirectorBriefResult;
    model: string;
    responseId: string | null;
  }> {
    const request: DirectorProviderRequest = {
      input: directorInput(projectData),
      instructions: directorInstructions,
      schema: directorBriefJsonSchema,
    };
    const provider = this.resolveProvider();
    const generated =
      provider === "gemini"
        ? await this.gemini.generate(request)
        : await this.openai.generate(request);

    try {
      return {
        brief: directorBriefSchema.parse(JSON.parse(generated.outputText)),
        model: generated.model,
        responseId: generated.responseId,
      };
    } catch (error) {
      throw new ServiceUnavailableException(
        "The AI Director returned an invalid structured brief.",
        { cause: error },
      );
    }
  }

  private resolveProvider(): AiProvider {
    const configured = this.config.get<string>("AI_PROVIDER")?.trim().toLowerCase();
    if (configured === "gemini" || configured === "openai") return configured;
    if (configured) {
      throw new ServiceUnavailableException('AI_PROVIDER must be either "gemini" or "openai".');
    }

    return this.config.get<string>("NODE_ENV") === "production" ? "openai" : "gemini";
  }
}
