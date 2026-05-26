import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3CompatibleStorageService } from "./s3-compatible-storage.service.js";
import { StorageController } from "./storage.controller.js";
import { STORAGE_CLIENT } from "./storage.types.js";
import { SupabaseModule } from "../supabase/supabase.module.js";
import { SupabaseService } from "../supabase/supabase.service.js";

@Module({
  imports: [SupabaseModule],
  controllers: [StorageController],
  providers: [
    S3CompatibleStorageService,
    {
      provide: STORAGE_CLIENT,
      inject: [ConfigService, SupabaseService, S3CompatibleStorageService],
      useFactory: (
        config: ConfigService,
        supabase: SupabaseService,
        s3: S3CompatibleStorageService,
      ) => (config.get<string>("STORAGE_PROVIDER") === "supabase" ? supabase : s3),
    },
  ],
  exports: [STORAGE_CLIENT],
})
export class StorageModule {}
