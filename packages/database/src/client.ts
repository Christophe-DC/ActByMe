import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export type DatabaseConnectionSettings = {
  connectionString?: string;
};

export function resolveDatabaseUrl(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  return connectionString;
}

export function createDatabaseClient(settings: DatabaseConnectionSettings = {}) {
  const connectionString = resolveDatabaseUrl(settings.connectionString);
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return {
    pool,
    prisma,
    async disconnect() {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}
