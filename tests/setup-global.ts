/**
 * Runs before the test worker boots: point Prisma at an isolated test database
 * and push the schema. DATABASE_URL must be set before @prisma/client is imported.
 *
 * The schema targets MySQL (production runs on the host's MySQL), and Prisma
 * cannot generate one client for two providers — so the suite needs a real
 * MySQL/MariaDB. Override the connection with TEST_DATABASE_URL; CI starts a
 * MySQL service container (see .github/workflows/ci.yml).
 */
export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? "mysql://root@127.0.0.1:3306/esifit_test";

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
        "The suite needs a running MySQL/MariaDB (the app's production engine).\n" +
        "Start one, e.g.:\n" +
        "  docker run --rm -d -p 3306:3306 -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 -e MARIADB_DATABASE=esifit_test mariadb:11\n" +
        "or set TEST_DATABASE_URL to an existing database.\n\n" +
        detail,
    );
  }
}
