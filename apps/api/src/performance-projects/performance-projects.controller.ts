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
import {
  SavePerformanceProjectDto,
  SelectPerformancePathDto,
} from "./dto/performance-project.dto.js";
import {
  CompletePerformanceBriefAttachmentUploadDto,
  CreatePerformanceBriefAttachmentUploadDto,
  FailPerformanceBriefAttachmentUploadDto,
} from "./dto/performance-brief-attachment.dto.js";
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

  @Post(":id/approve-brief")
  @ApiOperation({ summary: "Approve and version an owned Director Brief" })
  approveBrief(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<unknown> {
    return this.projects.approveBrief(user, id);
  }

  @Post(":id/performer-path")
  @ApiOperation({ summary: "Select the performer path for an approved Director Brief" })
  selectPerformerPath(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SelectPerformancePathDto,
  ): Promise<unknown> {
    return this.projects.selectPerformerPath(user, id, dto.performerPath);
  }

  @Post(":projectId/brief-attachment/upload-url")
  @ApiOperation({ summary: "Start or replace a private production-brief upload" })
  createBriefAttachmentUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreatePerformanceBriefAttachmentUploadDto,
  ) {
    return this.projects.createBriefAttachmentUpload(user, projectId, dto);
  }

  @Post(":projectId/brief-attachment/:attachmentId/complete")
  @ApiOperation({ summary: "Confirm and extract a private production brief" })
  completeBriefAttachmentUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Body() dto: CompletePerformanceBriefAttachmentUploadDto,
  ) {
    return this.projects.completeBriefAttachmentUpload(user, projectId, attachmentId, dto);
  }

  @Post(":projectId/brief-attachment/:attachmentId/fail")
  @ApiOperation({ summary: "Record a failed private production-brief upload" })
  failBriefAttachmentUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Body() dto: FailPerformanceBriefAttachmentUploadDto,
  ) {
    return this.projects.failBriefAttachmentUpload(user, projectId, attachmentId, dto);
  }

  @Delete(":projectId/brief-attachment/:attachmentId")
  @ApiOperation({ summary: "Remove an owned private production brief" })
  deleteBriefAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
  ) {
    return this.projects.deleteBriefAttachment(user, projectId, attachmentId);
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

  @Post(":projectId/scenes/:sceneId/take/:takeId/qa-runs")
  @ApiOperation({ summary: "Run owner-only technical QA on an uploaded performance take" })
  runTakeQa(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Param("takeId", ParseUUIDPipe) takeId: string,
  ) {
    return this.projects.runTakeQa(user, projectId, sceneId, takeId);
  }

  @Post(":projectId/scenes/:sceneId/take/:takeId/approve")
  @ApiOperation({ summary: "Approve an owned performance take after passing technical QA" })
  approveTake(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("sceneId", ParseUUIDPipe) sceneId: string,
    @Param("takeId", ParseUUIDPipe) takeId: string,
  ) {
    return this.projects.approveTake(user, projectId, sceneId, takeId);
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
