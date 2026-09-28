import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { PerformanceRequestEmailService } from "./performance-request-email.service.js";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, PerformanceRequestEmailService],
  exports: [PerformanceRequestEmailService],
})
export class NotificationsModule {}
