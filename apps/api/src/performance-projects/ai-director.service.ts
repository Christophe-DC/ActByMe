import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import {
  directorBriefJsonSchema,
  directorBriefSchema,
  directorInput,
  directorInstructions,
  type DirectorBriefResult,
  type DirectorProviderRequest,
} from "./ai-director.contract.js";
import {
  performanceOutputsInput,
  performanceOutputsInstructions,
  performanceOutputsJsonSchema,
  performanceOutputsSchema,
  type PerformanceOutputsResult,
} from "./performance-outputs.js";
import { GeminiDirectorService } from "./gemini-director.service.js";

type AiProvider = "gemini";

@Injectable()
export class AiDirectorService {
  private readonly logger = new Logger(AiDirectorService.name);

  constructor(private readonly gemini: GeminiDirectorService) {}

  async generate(projectData: Record<string, unknown>): Promise<{
    brief: DirectorBriefResult;
    model: string;
    provider: AiProvider;
    responseId: string | null;
  }> {
    const request: DirectorProviderRequest = {
      input: directorInput(projectData),
      instructions: directorInstructions,
      schema: directorBriefJsonSchema,
      schemaName: "actbyme_director_brief",
    };
    const provider: AiProvider = "gemini";
    this.logger.log(`AI Director generation started provider=${provider}`);
    const generated = await this.gemini.generate(request);

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(generated.outputText);
    } catch (error) {
      this.logger.error(
        `AI Director JSON parsing failed provider=${provider} model=${generated.model}`,
        stackFrames(error),
      );
      throw new ServiceUnavailableException(
        "The AI Director returned an invalid structured brief.",
        { cause: error },
      );
    }

    const validated = directorBriefSchema.safeParse(parsedOutput);
    if (!validated.success) {
      const issues = validated.error.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        path: issue.path.join("."),
      }));
      this.logger.error(
        `AI Director validation failed provider=${provider} model=${generated.model} issues=${JSON.stringify(issues)}`,
        stackFrames(validated.error),
      );
      throw new ServiceUnavailableException(
        "The AI Director returned an invalid structured brief.",
        { cause: validated.error },
      );
    }

    this.logger.log(
      `AI Director validation completed provider=${provider} model=${generated.model} scenes=${validated.data.scenes.length} qaCriteria=${validated.data.qaCriteria.length}`,
    );
    return {
      brief: validated.data,
      model: generated.model,
      provider,
      responseId: generated.responseId,
    };
  }

  async generateOutputs(approvedPlan: Record<string, unknown>): Promise<{
    outputs: PerformanceOutputsResult;
    model: string;
    provider: AiProvider;
    responseId: string | null;
  }> {
    const request: DirectorProviderRequest = {
      input: performanceOutputsInput(approvedPlan),
      instructions: performanceOutputsInstructions,
      schema: performanceOutputsJsonSchema,
      schemaName: "actbyme_performance_outputs",
    };
    const provider: AiProvider = "gemini";
    this.logger.log(`AI Director output generation started provider=${provider}`);
    const generated = await this.gemini.generate(request);

    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(generated.outputText);
    } catch (error) {
      this.logger.error(
        `AI Director output JSON parsing failed provider=${provider} model=${generated.model}`,
        stackFrames(error),
      );
      throw new ServiceUnavailableException(
        "The AI Director returned invalid structured performance outputs.",
        { cause: error },
      );
    }

    const validated = performanceOutputsSchema.safeParse(parsedOutput);
    if (!validated.success) {
      const issues = validated.error.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        path: issue.path.join("."),
      }));
      this.logger.error(
        `AI Director output validation failed provider=${provider} model=${generated.model} issues=${JSON.stringify(issues)}`,
        stackFrames(validated.error),
      );
      throw new ServiceUnavailableException(
        "The AI Director returned invalid structured performance outputs.",
        { cause: validated.error },
      );
    }

    this.logger.log(
      `AI Director output validation completed provider=${provider} model=${generated.model} steps=${validated.data.actorGuide.steps.length}`,
    );
    return {
      outputs: validated.data,
      model: generated.model,
      provider,
      responseId: generated.responseId,
    };
  }

}

function stackFrames(error: unknown) {
  return error instanceof Error ? error.stack?.split("\n").slice(1).join("\n") : undefined;
}
