import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient, Prisma } from "@actbyme/database";
import type { PrismaClient } from "@actbyme/database";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly database = createDatabaseClient();
  readonly client: PrismaClient = this.database.prisma;

  async onModuleDestroy() {
    await this.database.disconnect();
  }

  async audit(data: {
    action: string;
    actorProfileId?: string;
    entityId?: string;
    entityType: string;
    metadata?: Prisma.InputJsonValue;
    userId?: string;
  }) {
    await this.client.auditLog.create({
      data: data as Prisma.AuditLogUncheckedCreateInput,
    });
  }
}
