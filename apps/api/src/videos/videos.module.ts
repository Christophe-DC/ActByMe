import { Module } from "@nestjs/common";
import { VideosController } from "./videos.controller.js";

@Module({
  controllers: [VideosController],
})
export class VideosModule {}
