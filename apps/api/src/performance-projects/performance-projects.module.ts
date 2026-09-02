import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { PerformanceProjectsController } from "./performance-projects.controller.js";
import { PerformanceProjectsService } from "./performance-projects.service.js";
import { OpenAiDirectorService } from "./openai-director.service.js";

@Module({
  imports: [StorageModule],
  controllers: [PerformanceProjectsController],
  providers: [OpenAiDirectorService, PerformanceProjectsService],
})
export class PerformanceProjectsModule {}
