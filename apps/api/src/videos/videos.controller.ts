import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { VideoType, Visibility } from "@actbyme/shared";

@ApiTags("videos")
@Controller("videos")
export class VideosController {
  @Get("types")
  findVideoTypes() {
    return Object.values(VideoType);
  }

  @Get("visibility")
  findVisibilityOptions() {
    return Object.values(Visibility);
  }
}
