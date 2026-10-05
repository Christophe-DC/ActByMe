import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AiDirectorService } from "./ai-director.service.js";
import { PerformanceProjectsController } from "./performance-projects.controller.js";
import { PerformanceProjectsService } from "./performance-projects.service.js";
import { GeminiDirectorService } from "./gemini-director.service.js";
import { BriefContentExtractorService } from "./brief-content-extractor.service.js";
import { GeminiTranscriptionService } from "./gemini-transcription.service.js";
import { GeminiVisualQaService } from "./gemini-visual-qa.service.js";
import { PerformanceTechnicalQaService } from "./performance-technical-qa.service.js";
import { PerformanceRequestsController } from "./performance-requests.controller.js";

@Module({
  imports: [NotificationsModule, StorageModule],
  controllers: [PerformanceProjectsController, PerformanceRequestsController],
  providers: [
    AiDirectorService,
    BriefContentExtractorService,
    GeminiDirectorService,
    GeminiTranscriptionService,
    GeminiVisualQaService,
    PerformanceProjectsService,
    PerformanceTechnicalQaService,
  ],
})
export class PerformanceProjectsModule {}
