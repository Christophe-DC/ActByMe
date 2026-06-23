import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import type { CreateEarlyAccessSignupDto } from "./dto/early-access.dto.js";

@Injectable()
export class EarlyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEarlyAccessSignupDto): Promise<unknown> {
    const email = dto.email.trim().toLowerCase();

    const signup = await this.prisma.client.earlyAccessSignup.upsert({
      create: {
        email,
        source: dto.source,
      },
      update: {
        ...(dto.source ? { source: dto.source } : {}),
      },
      where: {
        email,
      },
    });

    await this.prisma.audit({
      action: "EARLY_ACCESS_SIGNUP_SUBMITTED",
      entityId: signup.id,
      entityType: "EarlyAccessSignup",
      metadata: {
        email: signup.email,
        source: signup.source,
      },
    });

    return {
      createdAt: signup.createdAt,
      email: signup.email,
      id: signup.id,
    };
  }
}
