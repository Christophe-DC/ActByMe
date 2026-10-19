import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from "@nestjs/common";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { DirectorService } from "./director.service.js";

class PrivateDirectorResponse implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context.switchToHttp().getResponse().setHeader("Cache-Control", "private, no-store");
    return next.handle();
  }
}

@Controller("director-projects")
@UseGuards(RolesGuard)
@Roles(UserRole.Actor, UserRole.Client, UserRole.Agency)
@UseInterceptors(PrivateDirectorResponse)
export class DirectorController {
  constructor(private readonly director: DirectorService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.director.list(user.id);
  }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() input: Record<string, unknown>) {
    return this.director.create(user, input);
  }
  @Get("casting") casting(@CurrentUser() user: AuthenticatedUser) {
    return this.director.actors(user.id);
  }
  @Get("actor-requests") requests(@CurrentUser() user: AuthenticatedUser) {
    return this.director.actorRequests(user.id);
  }
  @Post("actor-requests/:grantId") accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param("grantId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.acceptGrant(user.id, id, input);
  }
  @Get(":id") get(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.director.get(user.id, id);
  }
  @Patch(":id") save(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.save(user.id, id, input);
  }
  @Get(":id/history") history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.director.history(user.id, id);
  }
  @Post(":id/restore") restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.restore(user.id, id, input);
  }
  @Get(":id/production-plan") plan(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.director.plan(user.id, id);
  }
  @Post(":id/assets") reserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.reserve(user.id, id, input);
  }
  @Post(":id/assets/:assetId/complete") complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("assetId", ParseUUIDPipe) assetId: string,
  ) {
    return this.director.completeUpload(user.id, id, assetId);
  }
  @Get(":id/assets/:assetId/media") media(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("assetId", ParseUUIDPipe) assetId: string,
    @Query("download") download?: string,
  ) {
    return this.director.media(user.id, id, assetId, download === "1");
  }
  @Delete(":id/assets/:assetId") remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("assetId", ParseUUIDPipe) assetId: string,
  ) {
    return this.director.removeAsset(user.id, id, assetId);
  }
  @Post(":id/import-take") take(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.importTake(user.id, id, input);
  }
  @Get(":id/grants") grants(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.director.grants(user.id, id);
  }
  @Post(":id/grants") grant(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.requestGrant(user.id, id, input);
  }
  @Post(":id/jobs") enqueue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.enqueue(user.id, id, input);
  }
  @Post(":id/jobs/:jobId/cancel") cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
  ) {
    return this.director.cancel(user.id, id, jobId);
  }
}
