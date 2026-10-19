import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { VirtualDirectorController } from "./virtual-director.controller.js";
import { VirtualDirectorService } from "./virtual-director.service.js";
@Module({
  imports: [AuthModule, StorageModule],
  controllers: [VirtualDirectorController],
  providers: [VirtualDirectorService],
})
export class VirtualDirectorModule {}
