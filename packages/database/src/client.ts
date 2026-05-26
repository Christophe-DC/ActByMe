import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export type DatabaseConnectionSettings = {
  connectionString?: string;
};

export function resolveDatabaseUrl(connectionString = process.env.DATABASE_URL) {
  if (connectionString) {
    return connectionString;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseDatabasePassword = process.env.SUPABASE_DATABASE_PASSWORD;

  if (supabaseUrl && supabaseDatabasePassword) {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const password = encodeURIComponent(supabaseDatabasePassword);

    return `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
  }

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }
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
