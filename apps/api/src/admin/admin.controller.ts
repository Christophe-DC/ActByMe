import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { UpdateAgencyRequestStatusDto } from "../agency-access/dto/agency-access.dto.js";
import { AdminService } from "./admin.service.js";
import { RejectActorDto } from "./dto/admin-actor.dto.js";

@ApiTags("admin")
@ApiSecurity("x-user-id")
@ApiSecurity("x-user-role")
@UseGuards(RolesGuard)
@Roles(UserRole.Admin)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("actors")
  @ApiOperation({ summary: "List actor profiles for admin review" })
  findActors(): Promise<unknown> {
    return this.admin.findActors();
  }

  @Patch("actors/:id/approve")
  @ApiOperation({ summary: "Approve an actor profile" })
  approveActor(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.admin.approveActor(id, user);
  }

  @Patch("actors/:id/reject")
  @ApiOperation({ summary: "Reject an actor profile" })
  rejectActor(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectActorDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.admin.rejectActor(id, dto, user);
  }

  @Get("agency-requests")
  @ApiOperation({ summary: "List agency/client early access requests" })
  findAgencyRequests(): Promise<unknown> {
    return this.admin.findAgencyRequests();
  }

  @Patch("agency-requests/:id/status")
  @ApiOperation({ summary: "Update an agency/client early access request status" })
  updateAgencyRequestStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgencyRequestStatusDto,
  ): Promise<unknown> {
    return this.admin.updateAgencyRequestStatus(id, dto);
  }
}
