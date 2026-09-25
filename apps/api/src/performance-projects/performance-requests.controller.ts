import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { PerformanceProjectsService } from "./performance-projects.service.js";

@ApiBearerAuth()
@ApiTags("performances")
@UseGuards(RolesGuard)
@Roles(UserRole.Actor, UserRole.Client, UserRole.Agency)
@Controller("performances")
export class PerformanceRequestsController {
  constructor(private readonly projects: PerformanceProjectsService) {}

  @Get()
  @ApiOperation({ summary: "List performance requests assigned to the current actor" })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projects.findActorRequests(user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one performance request assigned to the current actor" })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.projects.findActorRequest(user, id);
  }

  @Post(":id/accept")
  @ApiOperation({ summary: "Accept an assigned performance request" })
  accept(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.projects.acceptActorRequest(user, id);
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Submit an uploaded performance and automatically run QA" })
  submit(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.projects.submitActorPerformance(user, id);
  }
}
