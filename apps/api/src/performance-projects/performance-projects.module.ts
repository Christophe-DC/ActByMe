import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { AiDirectorService } from "./ai-director.service.js";
import { PerformanceProjectsController } from "./performance-projects.controller.js";
import { PerformanceProjectsService } from "./performance-projects.service.js";
import { GeminiDirectorService } from "./gemini-director.service.js";
import { OpenAiDirectorService } from "./openai-director.service.js";
import { BriefContentExtractorService } from "./brief-content-extractor.service.js";
import { OpenAiTranscriptionService } from "./openai-transcription.service.js";
import { PerformanceTechnicalQaService } from "./performance-technical-qa.service.js";

@Module({
  imports: [StorageModule],
  controllers: [PerformanceProjectsController],
  providers: [
    AiDirectorService,
    BriefContentExtractorService,
    GeminiDirectorService,
    OpenAiDirectorService,
    OpenAiTranscriptionService,
    PerformanceProjectsService,
    PerformanceTechnicalQaService,
  ],
})
export class PerformanceProjectsModule {}
