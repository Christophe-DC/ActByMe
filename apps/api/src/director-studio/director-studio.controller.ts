import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Patch,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
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
  @Post("edit")
  edit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.edit(user.id, id, input);
  }
  @Post("cancel")
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.cancel(user.id, id, input);
  }
  @Patch("draft")
  draft(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.draft(user.id, id, input);
  }
  @Get("history")
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Query("before") before?: string,
  ) {
    return this.studio.history(
      user.id,
      id,
      before && /^\d+$/.test(before) ? Number(before) : undefined,
    );
  }
  @Get("feedback")
  feedback(@CurrentUser() user: AuthenticatedUser, @Param("projectId", ParseUUIDPipe) id: string) {
    return this.studio.feedback(user.id, id);
  }
  @Patch("feedback/:commentId")
  resolveFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Param("commentId", ParseUUIDPipe) commentId: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.resolveFeedback(user.id, id, commentId, input);
  }
  @Post("restore")
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.restore(user.id, id, input);
  }
  @Get("shares")
  shares(@CurrentUser() user: AuthenticatedUser, @Param("projectId", ParseUUIDPipe) id: string) {
    return this.studio.shares(user.id, id);
  }
  @Post("shares")
  share(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.studio.share(user.id, id, input);
  }
  @Delete("shares/:shareId")
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Param("shareId", ParseUUIDPipe) shareId: string,
  ) {
    return this.studio.revokeShare(user.id, id, shareId);
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
