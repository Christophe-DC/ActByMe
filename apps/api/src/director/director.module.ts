import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module.js";
import { DirectorController } from "./director.controller.js";
import { DirectorService } from "./director.service.js";
import { DirectorProviders } from "./director-providers.js";
@Module({
  imports: [StorageModule],
  controllers: [DirectorController],
  providers: [DirectorService, DirectorProviders],
  exports: [DirectorService, DirectorProviders],
})
export class DirectorModule {}
