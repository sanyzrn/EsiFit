/**
 * Per-file environment: DATABASE_URL must exist before any prisma import —
 * vitest evaluates imports after setup files, so setting it here is early
 * enough for module-level PrismaClient instantiation in @/lib/db.
 * Keep this URL in sync with tests/setup-global.ts.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "mysql://root@127.0.0.1:3306/esifit_test";
process.env.SESSION_SECRET = "test-secret-esifit-0123456789abcdef0123456789abcdef";
(process.env as { NODE_ENV?: string }).NODE_ENV = "test";
