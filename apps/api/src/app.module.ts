import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { resolve } from "node:path";
import { AdminModule } from "./admin/admin.module.js";
import { AgencyAccessModule } from "./agency-access/agency-access.module.js";
import { ActorsModule } from "./actors/actors.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { MockAuthMiddleware } from "./auth/mock-auth.middleware.js";
import { DatabaseModule } from "./database/database.module.js";
import { SkillsModule } from "./skills/skills.module.js";
import { StorageModule } from "./storage/storage.module.js";
import { UsersModule } from "./users/users.module.js";
import { VideosModule } from "./videos/videos.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")],
    }),
    AuthModule,
    DatabaseModule,
    ActorsModule,
    UsersModule,
    SkillsModule,
    VideosModule,
    AgencyAccessModule,
    AdminModule,
    StorageModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MockAuthMiddleware).forRoutes("*");
  }
}
