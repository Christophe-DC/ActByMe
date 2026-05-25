import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";

@ApiTags("users")
@ApiSecurity("x-user-id")
@ApiSecurity("x-user-role")
@Controller("users")
export class UsersController {
  @Get("me")
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Actor, UserRole.Client)
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
