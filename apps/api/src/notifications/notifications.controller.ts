import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { NotificationsService } from "./notifications.service.js";

@ApiBearerAuth()
@ApiTags("notifications")
@UseGuards(RolesGuard)
@Roles(UserRole.Admin, UserRole.Actor, UserRole.Client, UserRole.Agency)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List notifications belonging to the current user" })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.notifications.findAll(user);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Count unread notifications belonging to the current user" })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark one owned notification as read" })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post("read-all")
  @ApiOperation({ summary: "Mark all notifications belonging to the current user as read" })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user);
  }
}
