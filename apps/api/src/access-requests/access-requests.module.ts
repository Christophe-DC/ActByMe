import { Module } from "@nestjs/common";
import { AccessRequestsController } from "./access-requests.controller.js";

@Module({
  controllers: [AccessRequestsController],
})
export class AccessRequestsModule {}
