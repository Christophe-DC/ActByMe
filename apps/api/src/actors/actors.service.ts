import { Injectable, NotFoundException } from "@nestjs/common";
import { ActorProfileStatus, UserRole, Visibility } from "@actbyme/shared";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";
import type { AcceptActorConsentDto } from "./dto/actor-consent.dto.js";
import type { AddActorAccentsDto, AddActorLanguagesDto } from "./dto/actor-language.dto.js";
import type { UpsertActorProfileDto, UpdateActorProfileDto } from "./dto/actor-profile.dto.js";
import type { AddActorSkillsDto } from "./dto/actor-skill.dto.js";
import type { AddActorVideoDto } from "./dto/actor-video.dto.js";

const publicActorInclude = {
  accents: true,
  consent: false,
  demoProfile: true,
  languages: true,
  skills: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  videos: {
    orderBy: {
      sortOrder: "asc" as const,
    },
    where: {
      visibility: Visibility.Public,
    },
  },
};

@Injectable()
export class ActorsService {
  constructor(private readonly prisma: PrismaService) {}

  findPublicActors(): Promise<unknown> {
    return this.prisma.client.actorProfile.findMany({
      include: publicActorInclude,
      orderBy: [{ isDemo: "desc" }, { actAiScore: "desc" }, { createdAt: "desc" }],
      where: {
        status: ActorProfileStatus.Approved,
      },
    });
  }

  findPublicActorBySlug(slug: string): Promise<unknown> {
    return this.prisma.client.actorProfile.findFirst({
      include: publicActorInclude,
      where: {
        slug,
        status: ActorProfileStatus.Approved,
      },
    });
  }

  async findCurrentActor(user: AuthenticatedUser): Promise<unknown> {
    const profile = await this.prisma.client.actorProfile.findUnique({
      include: {
        accents: true,
        consent: true,
        languages: true,
        skills: true,
        videos: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      where: {
        userId: user.id,
      },
    });

    if (!profile) {
      throw new NotFoundException("Actor profile not found for this user.");
    }

    return profile;
  }

  async createProfile(user: AuthenticatedUser, dto: UpsertActorProfileDto): Promise<unknown> {
    await this.ensureUser(user);
    const existing = await this.prisma.client.actorProfile.findUnique({
      where: {
        userId: user.id,
      },
    });
    const slug = existing?.slug ?? `${slugify(dto.stageName)}-${user.id.slice(0, 8)}`;

    const profile = await this.prisma.client.actorProfile.upsert({
      create: {
        ...dto,
        slug,
        status: ActorProfileStatus.Draft,
        userId: user.id,
      },
      update: {
        ...dto,
        status: ActorProfileStatus.Draft,
      },
      where: {
        userId: user.id,
      },
    });

    if (!existing) {
      await this.prisma.audit({
        action: "ACTOR_PROFILE_CREATED",
        actorProfileId: profile.id,
        entityId: profile.id,
        entityType: "ActorProfile",
        metadata: { slug: profile.slug },
        userId: user.id,
      });
    }

    return profile;
  }

  async updateProfile(user: AuthenticatedUser, dto: UpdateActorProfileDto): Promise<unknown> {
    const profile = await this.requireProfile(user);

    return this.prisma.client.actorProfile.update({
      data: dto,
      where: {
        id: profile.id,
      },
    });
  }

  async addSkills(user: AuthenticatedUser, dto: AddActorSkillsDto): Promise<unknown> {
    const profile = await this.requireProfile(user);

    await this.prisma.client.actorSkill.createMany({
      data: dto.skills.map((skill) => ({
        ...skill,
        actorProfileId: profile.id,
      })),
      skipDuplicates: true,
    });

    return this.findCurrentActor(user);
  }

  async addLanguages(user: AuthenticatedUser, dto: AddActorLanguagesDto): Promise<unknown> {
    const profile = await this.requireProfile(user);

    await this.prisma.client.actorLanguage.createMany({
      data: dto.languages.map((language) => ({
        ...language,
        actorProfileId: profile.id,
      })),
      skipDuplicates: true,
    });

    return this.findCurrentActor(user);
  }

  async addAccents(user: AuthenticatedUser, dto: AddActorAccentsDto): Promise<unknown> {
    const profile = await this.requireProfile(user);

    await this.prisma.client.actorAccent.createMany({
      data: dto.accents.map((accent) => ({
        accent,
        actorProfileId: profile.id,
      })),
      skipDuplicates: true,
    });

    return this.findCurrentActor(user);
  }

  async addVideo(user: AuthenticatedUser, dto: AddActorVideoDto): Promise<unknown> {
    const profile = await this.requireProfile(user);
    const video = await this.prisma.client.actorVideo.create({
      data: {
        ...dto,
        actorProfileId: profile.id,
        visibility: dto.visibility ?? Visibility.Public,
      },
    });

    await this.prisma.audit({
      action: "ACTOR_VIDEO_ADDED",
      actorProfileId: profile.id,
      entityId: video.id,
      entityType: "ActorVideo",
      metadata: {
        title: video.title,
        type: video.type,
      },
      userId: user.id,
    });

    return video;
  }

  async acceptConsent(user: AuthenticatedUser, dto: AcceptActorConsentDto): Promise<unknown> {
    const profile = await this.requireProfile(user);
    const consent = await this.prisma.client.actorConsent.upsert({
      create: {
        ...dto,
        acceptedAt: new Date(),
        actorProfileId: profile.id,
      },
      update: {
        ...dto,
        acceptedAt: new Date(),
      },
      where: {
        actorProfileId: profile.id,
      },
    });

    await this.prisma.audit({
      action: "ACTOR_CONSENT_ACCEPTED",
      actorProfileId: profile.id,
      entityId: consent.id,
      entityType: "ActorConsent",
      metadata: { ...dto },
      userId: user.id,
    });

    return consent;
  }

  async listPublicActorsWithFilters(filters: {
    search?: string;
    language?: string;
    accent?: string;
    skill?: string;
    motionSkill?: string;
    sort?: "featured" | "score" | "newest";
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    let where: any = {
      status: ActorProfileStatus.Approved,
    };

    // Search by name or bio
    if (filters.search) {
      where = {
        ...where,
        OR: [
          { stageName: { contains: filters.search, mode: "insensitive" } },
          { bio: { contains: filters.search, mode: "insensitive" } },
        ],
      };
    }

    // Filter by language
    if (filters.language) {
      where = {
        ...where,
        languages: {
          some: {
            code: filters.language,
          },
        },
      };
    }

    // Filter by accent
    if (filters.accent) {
      where = {
        ...where,
        accents: {
          some: {
            name: filters.accent,
          },
        },
      };
    }

    // Filter by skill
    if (filters.skill) {
      where = {
        ...where,
        skills: {
          some: {
            category: filters.skill,
          },
        },
      };
    }

    // Determine sort order
    let orderBy: any = { createdAt: "desc" };
    if (filters.sort === "score") {
      orderBy = { actAiScore: "desc" };
    } else if (filters.sort === "newest") {
      orderBy = { createdAt: "desc" };
    } else if (filters.sort === "featured") {
      orderBy = [{ isDemo: "asc" }, { actAiScore: "desc" }, { createdAt: "desc" }];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.actorProfile.findMany({
        where,
        include: publicActorInclude,
        orderBy,
        skip: offset,
        take: limit,
      }),
      this.prisma.client.actorProfile.count({ where }),
    ]);

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  private async ensureUser(user: AuthenticatedUser) {
    return this.prisma.client.user.upsert({
      create: {
        email: user.email ?? `${user.id}@mock.actbyme.test`,
        id: user.id,
        role: UserRole.Actor,
      },
      update: {
        ...(user.email ? { email: user.email } : {}),
        role: user.role,
      },
      where: {
        id: user.id,
      },
    });
  }

  private async requireProfile(user: AuthenticatedUser) {
    const profile = await this.prisma.client.actorProfile.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!profile) {
      throw new NotFoundException("Create an actor profile before adding onboarding data.");
    }

    return profile;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
