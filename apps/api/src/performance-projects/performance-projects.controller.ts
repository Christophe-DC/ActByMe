import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SavePerformanceProjectDto } from "./dto/performance-project.dto.js";
import {
  CompletePerformanceTakeUploadDto,
  CreatePerformanceTakeUploadDto,
  FailPerformanceTakeUploadDto,
} from "./dto/performance-take.dto.js";
import { PerformanceProjectsService } from "./performance-projects.service.js";

@ApiBearerAuth()
@ApiTags("performance projects")
@UseGuards(RolesGuard)
@Roles(UserRole.Actor, UserRole.Client, UserRole.Agency)
@Controller("performance-projects")
export class PerformanceProjectsController {
  constructor(private readonly projects: PerformanceProjectsService) {}

  @Get("current")
  @ApiOperation({ summary: "Get the current user's most recently updated performance project" })
  findCurrent(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.projects.findCurrent(user);
  }

  @Post()
  @ApiOperation({ summary: "Create a performance workflow project" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SavePerformanceProjectDto,
  ): Promise<unknown> {
    return this.projects.create(user, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Save an owned performance workflow project" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SavePerformanceProjectDto,
  ): Promise<unknown> {
    return this.projects.update(user, id, dto);
  }

  @Post(":id/generate-brief")
  @ApiOperation({ summary: "Generate and persist an owned project's Director Brief" })
  generateBrief(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.projects.generateBrief(user, id);
  }

  @Post(":projectId/scenes/:sceneId/take/upload-url")
  @ApiOperation({ summary: "Start or replace a private performance-take upload" })
  createTakeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Body() dto: CreatePerformanceTakeUploadDto,
  ) {
    return this.projects.createTakeUpload(user, projectId, sceneId, dto);
  }

  @Post(":projectId/scenes/:sceneId/take/:takeId/complete")
  @ApiOperation({ summary: "Confirm a private performance-take upload" })
  completeTakeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Param("takeId", ParseUUIDPipe) takeId: string,
    @Body() dto: CompletePerformanceTakeUploadDto,
  ) {
    return this.projects.completeTakeUpload(user, projectId, sceneId, takeId, dto);
  }

  @Post(":projectId/scenes/:sceneId/take/:takeId/fail")
  @ApiOperation({ summary: "Record a failed private performance-take upload" })
  failTakeUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Param("takeId", ParseUUIDPipe) takeId: string,
    @Body() dto: FailPerformanceTakeUploadDto,
  ) {
    return this.projects.failTakeUpload(user, projectId, sceneId, takeId, dto);
  }

  @Get(":projectId/scenes/:sceneId/take/:takeId/read-url")
  @ApiOperation({ summary: "Create an owner-only signed playback URL for a performance take" })
  getTakeReadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Param("takeId", ParseUUIDPipe) takeId: string,
  ) {
    return this.projects.getTakeReadUrl(user, projectId, sceneId, takeId);
  }

  @Delete(":projectId/scenes/:sceneId/take/:takeId")
  @ApiOperation({ summary: "Delete an owned private performance take" })
  deleteTake(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Param("takeId", ParseUUIDPipe) takeId: string,
  ) {
    return this.projects.deleteTake(user, projectId, sceneId, takeId);
  }
}
