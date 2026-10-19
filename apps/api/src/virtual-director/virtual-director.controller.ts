import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { VirtualDirectorService } from "./virtual-director.service.js";

@Injectable()
class PrivateVideoResponse implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context.switchToHttp().getResponse().setHeader("Cache-Control", "private, no-store");
    return next.handle();
  }
}
@ApiBearerAuth()
@ApiTags("AI Virtual Director")
@UseGuards(RolesGuard)
@Roles(UserRole.Actor, UserRole.Client, UserRole.Agency)
@UseInterceptors(PrivateVideoResponse)
@Controller("performance-projects/:projectId/virtual-director")
export class VirtualDirectorController {
  constructor(private readonly director: VirtualDirectorService) {}
  @Get() get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
  ) {
    return this.director.get(user.id, id);
  }
  @Post("initialize") initialize(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.initialize(user.id, id, input);
  }
  @Put("scene") save(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.save(user.id, id, input);
  }
  @Post("references") reserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.reserve(user.id, id, input);
  }
  @Post("references/import") importTake(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.importTake(user.id, id, input);
  }
  @Post("references/:referenceId/complete") complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Param("referenceId", ParseUUIDPipe) referenceId: string,
  ) {
    return this.director.completeUpload(user.id, id, referenceId);
  }
  @Delete("references/:referenceId") remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Param("referenceId", ParseUUIDPipe) referenceId: string,
  ) {
    return this.director.removeReference(user.id, id, referenceId);
  }
  @Get("references/:referenceId/media") referenceMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Param("referenceId", ParseUUIDPipe) referenceId: string,
  ) {
    return this.director.media(user.id, id, referenceId, "reference");
  }
  @Post("jobs") enqueue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.director.enqueue(user.id, id, input);
  }
  @Post("jobs/:jobId/cancel") cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
  ) {
    return this.director.cancel(user.id, id, jobId);
  }
  @Post("jobs/:jobId/approve") approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
  ) {
    return this.director.approve(user.id, id, jobId);
  }
  @Get("jobs/:jobId/media") media(
    @CurrentUser() user: AuthenticatedUser,
    @Param("projectId", ParseUUIDPipe) id: string,
    @Param("jobId", ParseUUIDPipe) jobId: string,
    @Query("download") download?: string,
  ) {
    return this.director.media(user.id, id, jobId, "job", download === "1");
  }
}
