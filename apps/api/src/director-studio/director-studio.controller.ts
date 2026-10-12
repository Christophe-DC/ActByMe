import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { DirectorStudioService } from "./director-studio.service.js";

@ApiBearerAuth()
@ApiTags("Director Studio 3D")
@UseGuards(RolesGuard)
@Roles(UserRole.Actor, UserRole.Client, UserRole.Agency)
@Controller("performance-projects/:projectId/director-studio")
export class DirectorStudioController {
  constructor(private readonly studio: DirectorStudioService) {}
  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param("projectId", ParseUUIDPipe) id: string) {
    return this.studio.get(user.id, id);
  }
  @Post("activation")
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.activate(user.id, id, input);
  }
  @Post("generate")
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.generate(user.id, id, input);
  }
  @Put("revision")
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.save(user.id, id, input);
  }
  @Post("approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.approve(user.id, id, input);
  }
}
