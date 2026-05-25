import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@actbyme/shared";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { ReadUrlRequestDto, UploadUrlRequestDto } from "./dto/storage.dto.js";
import { STORAGE_CLIENT, type StorageClient } from "./storage.types.js";

@ApiTags("storage")
@ApiSecurity("x-user-id")
@ApiSecurity("x-user-role")
@UseGuards(RolesGuard)
@Roles(UserRole.Actor, UserRole.Admin)
@Controller("storage")
export class StorageController {
  constructor(@Inject(STORAGE_CLIENT) private readonly storage: StorageClient) {}

  @Post("upload-url")
  @ApiOperation({ summary: "Create a placeholder S3-compatible upload URL" })
  createUploadUrl(@Body() dto: UploadUrlRequestDto) {
    return this.storage.createPresignedUpload(dto);
  }

  @Get("read-url")
  @ApiOperation({ summary: "Create a placeholder public/read URL for a stored object" })
  createReadUrl(@Query() dto: ReadUrlRequestDto) {
    return {
      key: dto.key,
      label: dto.label,
      readUrl: this.storage.getPublicUrl(dto.key),
    };
  }
}
