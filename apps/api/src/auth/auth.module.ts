import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { SupabaseModule } from "../supabase/supabase.module.js";
import { RolesGuard } from "./roles.guard.js";

@Module({
  imports: [DatabaseModule, SupabaseModule],
  providers: [RolesGuard],
  exports: [RolesGuard],
})
export class AuthModule {}
