export type DatabaseConnectionSettings = {
  connectionString?: string;
};

export function resolveDatabaseUrl(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  return connectionString;
}
