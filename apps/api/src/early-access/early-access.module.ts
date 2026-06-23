import { Module } from "@nestjs/common";
import { EarlyAccessController } from "./early-access.controller.js";
import { EarlyAccessService } from "./early-access.service.js";

@Module({
  controllers: [EarlyAccessController],
  providers: [EarlyAccessService],
})
export class EarlyAccessModule {}
