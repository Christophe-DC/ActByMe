import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccessRequestsModule } from "./access-requests/access-requests.module.js";
import { ActorsModule } from "./actors/actors.module.js";
import { StorageModule } from "./storage/storage.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ActorsModule,
    AccessRequestsModule,
    StorageModule,
  ],
})
export class AppModule {}
