import { Module } from "@nestjs/common";
import { AgencyAccessModule } from "../agency-access/agency-access.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  imports: [AgencyAccessModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
