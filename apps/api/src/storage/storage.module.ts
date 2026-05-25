import { Module } from "@nestjs/common";
import { S3CompatibleStorageService } from "./s3-compatible-storage.service.js";
import { STORAGE_CLIENT } from "./storage.types.js";

@Module({
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
