import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module.js";
import { RolesGuard } from "./roles.guard.js";

@Module({
  imports: [SupabaseModule],
  providers: [RolesGuard],
  exports: [RolesGuard],
})
export class AuthModule {}
