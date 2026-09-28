import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(user: AuthenticatedUser) {
    const persistedUser = await this.prisma.client.user.findUnique({
      select: {
        actorProfile: {
          select: { id: true, slug: true, stageName: true, status: true },
        },
        email: true,
        id: true,
        name: true,
        role: true,
      },
      where: { id: user.id },
    });

    return (
      persistedUser ?? {
        actorProfile: null,
        email: user.email ?? null,
        id: user.id,
        name: null,
        role: user.role,
      }
    );
  }
}
