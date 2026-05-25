import { Module } from "@nestjs/common";
import { S3CompatibleStorageService } from "./s3-compatible-storage.service.js";
import { StorageController } from "./storage.controller.js";
import { STORAGE_CLIENT } from "./storage.types.js";

@Module({
  controllers: [StorageController],
  providers: [
    S3CompatibleStorageService,
    {
      provide: STORAGE_CLIENT,
      useExisting: S3CompatibleStorageService,
    },
  ],
  exports: [STORAGE_CLIENT],
})
export class StorageModule {}
