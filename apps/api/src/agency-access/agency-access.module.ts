import { Module } from "@nestjs/common";
import { AgencyAccessController } from "./agency-access.controller.js";
import { AgencyAccessService } from "./agency-access.service.js";

@Module({
  controllers: [AgencyAccessController],
  providers: [AgencyAccessService],
  exports: [AgencyAccessService],
})
export class AgencyAccessModule {}
