import { Module } from "@nestjs/common";
import { ActorsController } from "./actors.controller.js";

@Module({
  controllers: [ActorsController],
})
export class ActorsModule {}
