import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { AgencyAccessService } from "./agency-access.service.js";
import { CreateAgencyAccessRequestDto } from "./dto/agency-access.dto.js";

@ApiTags("agency access")
@Controller("agency-access")
export class AgencyAccessController {
  constructor(private readonly agencyAccess: AgencyAccessService) {}

  @Post()
  @ApiOperation({ summary: "Submit an early agency/client access request" })
  create(@Body() dto: CreateAgencyAccessRequestDto): Promise<unknown> {
    return this.agencyAccess.create(dto);
  }

  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.Admin)
  @ApiSecurity("x-user-id")
  @ApiSecurity("x-user-role")
  @ApiOperation({ summary: "Fetch one agency access request as an admin" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<unknown> {
    return this.agencyAccess.findOne(id);
  }
}
