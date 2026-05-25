import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
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
import { AcceptActorConsentDto } from "./dto/actor-consent.dto.js";
import { AddActorAccentsDto, AddActorLanguagesDto } from "./dto/actor-language.dto.js";
import { UpsertActorProfileDto, UpdateActorProfileDto } from "./dto/actor-profile.dto.js";
import { AddActorSkillsDto } from "./dto/actor-skill.dto.js";
import { AddActorVideoDto } from "./dto/actor-video.dto.js";
import { ActorsService } from "./actors.service.js";

@ApiTags("actors")
@Controller("actors")
export class ActorsController {
  constructor(private readonly actors: ActorsService) {}

  @Get()
  @ApiOperation({ summary: "List public approved actor profiles" })
  findPublicActors(): Promise<unknown> {
    return this.actors.findPublicActors();
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Actor)
  @ApiOperation({ summary: "Get the current actor profile from mock auth headers" })
  findMe(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.actors.findCurrentActor(user);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Get a public actor profile by slug" })
  async findPublicProfile(@Param("slug") slug: string): Promise<unknown> {
    const actor = await this.actors.findPublicActorBySlug(slug);

    if (!actor) {
      throw new NotFoundException("Actor profile not found.");
    }

    return actor;
  }

  @Post("profile")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Actor)
  @ApiOperation({ summary: "Create or replace the current actor profile draft" })
  createProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertActorProfileDto,
  ): Promise<unknown> {
    return this.actors.createProfile(user, dto);
  }

  @Patch("profile")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Actor)
  @ApiOperation({ summary: "Update the current actor profile draft" })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateActorProfileDto,
  ): Promise<unknown> {
    return this.actors.updateProfile(user, dto);
  }

  @Post("profile/skills")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Actor)
  addSkills(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddActorSkillsDto,
  ): Promise<unknown> {
    return this.actors.addSkills(user, dto);
  }

  @Post("profile/languages")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Actor)
  addLanguages(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddActorLanguagesDto,
  ): Promise<unknown> {
    return this.actors.addLanguages(user, dto);
  }

  @Post("profile/accents")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Actor)
  addAccents(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddActorAccentsDto,
  ): Promise<unknown> {
    return this.actors.addAccents(user, dto);
  }

  @Post("profile/videos")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Actor)
  addVideo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddActorVideoDto,
  ): Promise<unknown> {
    return this.actors.addVideo(user, dto);
  }

  @Post("profile/consent")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.Actor)
  acceptConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptActorConsentDto,
  ): Promise<unknown> {
    return this.actors.acceptConsent(user, dto);
  }
}
