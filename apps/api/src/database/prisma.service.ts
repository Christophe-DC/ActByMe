import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createDatabaseClient, Prisma } from "@actbyme/database";
import type { PrismaClient } from "@actbyme/database";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly database: DatabaseClient;
  readonly client: PrismaClient;

  constructor() {
    this.database = createDatabaseClient();
    this.client = this.database.prisma;
  }

  async onModuleInit() {
    await this.client.$connect();
  }

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
