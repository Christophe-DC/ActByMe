import { Controller, Get, Param } from "@nestjs/common";

@Controller("actors")
export class ActorsController {
  @Get(":slug")
  findPublicProfile(@Param("slug") slug: string) {
    return {
      slug,
      status: "profile_not_implemented",
    };
  }
}
