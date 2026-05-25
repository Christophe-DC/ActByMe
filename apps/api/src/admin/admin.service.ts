import { Injectable, NotFoundException } from "@nestjs/common";
import { ActorProfileStatus } from "@actbyme/shared";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";
import { AgencyAccessService } from "../agency-access/agency-access.service.js";
import type { RejectActorDto } from "./dto/admin-actor.dto.js";
import type { UpdateAgencyRequestStatusDto } from "../agency-access/dto/agency-access.dto.js";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  findActors(): Promise<unknown> {
    return this.prisma.client.actorProfile.findMany({
      include: {
        accents: true,
        consent: true,
        languages: true,
        skills: true,
        user: {
          select: {
            email: true,
            id: true,
            name: true,
            role: true,
          },
        },
        videos: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async approveActor(id: string, admin: AuthenticatedUser): Promise<unknown> {
    await this.requireActor(id);
    const actor = await this.prisma.client.actorProfile.update({
      data: {
        status: ActorProfileStatus.Approved,
      },
      where: {
        id,
      },
    });

    await this.prisma.audit({
      action: "ACTOR_APPROVED",
      actorProfileId: actor.id,
      entityId: actor.id,
      entityType: "ActorProfile",
      metadata: {
        status: actor.status,
      },
      userId: admin.id,
    });

    return actor;
  }

  async rejectActor(id: string, dto: RejectActorDto, admin: AuthenticatedUser): Promise<unknown> {
    await this.requireActor(id);
    const actor = await this.prisma.client.actorProfile.update({
      data: {
        status: ActorProfileStatus.Rejected,
      },
      where: {
        id,
      },
    });

    await this.prisma.audit({
      action: "ACTOR_REJECTED",
      actorProfileId: actor.id,
      entityId: actor.id,
      entityType: "ActorProfile",
      metadata: {
        reason: dto.reason,
        status: actor.status,
      },
      userId: admin.id,
    });

    return actor;
  }

  findAgencyRequests(): Promise<unknown> {
    return this.agencyAccess.findAll();
  }

  updateAgencyRequestStatus(id: string, dto: UpdateAgencyRequestStatusDto): Promise<unknown> {
    return this.agencyAccess.updateStatus(id, dto);
  }

  private async requireActor(id: string) {
    const actor = await this.prisma.client.actorProfile.findUnique({
      where: {
        id,
      },
    });

    if (!actor) {
      throw new NotFoundException("Actor profile not found.");
    }

    return actor;
  }
}
