import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AdminModule } from "./admin/admin.module.js";
import { AgencyAccessModule } from "./agency-access/agency-access.module.js";
import { ActorsModule } from "./actors/actors.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { MockAuthMiddleware } from "./auth/mock-auth.middleware.js";
import { DatabaseModule } from "./database/database.module.js";
import { EarlyAccessModule } from "./early-access/early-access.module.js";
import { SkillsModule } from "./skills/skills.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { SupabaseModule } from "./supabase/supabase.module.js";
import { UsersModule } from "./users/users.module.js";
import { VideosModule } from "./videos/videos.module.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(repositoryRoot, ".env"), resolve(repositoryRoot, "apps/api/.env")],
    }),
    AuthModule,
    SupabaseModule,
    DatabaseModule,
    ActorsModule,
    UsersModule,
    SkillsModule,
    VideosModule,
    AgencyAccessModule,
    EarlyAccessModule,
    AdminModule,
    StorageModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    if (process.env.ENABLE_MOCK_AUTH === "true") {
      consumer.apply(MockAuthMiddleware).forRoutes("*");
    }
  }
}
