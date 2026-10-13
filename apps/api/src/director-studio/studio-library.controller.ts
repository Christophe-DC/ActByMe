import { Body, Controller, Get, Header, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { DirectorStudioService } from "./director-studio.service.js";

@Controller("director-studios")
@UseGuards(RolesGuard)
@Roles(UserRole.Actor, UserRole.Client, UserRole.Agency)
export class StudioLibraryController {
  constructor(private readonly studio: DirectorStudioService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.studio.list(user.id);
  }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() input: Record<string, unknown>) {
    return this.studio.create(user, input);
  }
}
@Controller("studio-shares")
export class StudioSharesController {
  constructor(private readonly studio: DirectorStudioService) {}
  @Get(":token")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Robots-Tag", "noindex, nofollow")
  get(@Param("token") token: string) {
    return this.studio.shared(token);
  }
}
