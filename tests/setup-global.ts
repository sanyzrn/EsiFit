/**
 * Runs before the test worker boots: point Prisma at an isolated test DB and
 * push the schema. DATABASE_URL must be set before @prisma/client is imported.
 */
export const TEST_DB_PATH = "file:./db/test.db";

export default async function globalSetup() {
  process.env.DATABASE_URL = TEST_DB_PATH;
  process.env.SESSION_SECRET = "test-secret-esifit-0123456789abcdef0123456789abcdef";
  (process.env as { NODE_ENV?: string }).NODE_ENV = "test";

  const { execSync } = await import("node:child_process");
  execSync("bunx prisma db push --skip-generate --accept-data-loss", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB_PATH },
    stdio: "pipe",
  });
}
