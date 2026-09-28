import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@ApiSecurity("x-user-id")
@ApiSecurity("x-user-role")
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin, UserRole.Actor, UserRole.Client, UserRole.Agency)
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findMe(user);
  }
}
