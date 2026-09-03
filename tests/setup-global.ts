/**
 * Runs before the test worker boots: point Prisma at an isolated test database
 * and push the schema. DATABASE_URL must be set before @prisma/client is imported.
 *
 * Uses a SEPARATE database from development — the suite wipes every table
 * between tests. Override with TEST_DATABASE_URL.
 */
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/esifit_test";

export default async function globalSetup() {
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.SESSION_SECRET = "test-secret-esifit-0123456789abcdef0123456789abcdef";
  (process.env as { NODE_ENV?: string }).NODE_ENV = "test";

  const { execSync } = await import("node:child_process");
  try {
    execSync("bunx prisma db push --skip-generate --accept-data-loss", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: "pipe",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not prepare the test database at ${TEST_DB_URL}.\n` +
        "Create it once with:  createdb esifit_test\n" +
        "or point TEST_DATABASE_URL at an existing (throwaway) database.\n\n" +
        detail,
    );
  }
}
