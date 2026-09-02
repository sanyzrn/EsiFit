/**
 * Launcher for the standalone production server.
 *
 * `.next/standalone/server.js` calls `process.chdir(__dirname)` before booting,
 * so every relative path inside it resolves against `.next/standalone/` rather
 * than the project root. For the sandbox SQLite setup that means Prisma's
 * relative `file:` URL points at a directory that does not exist and every
 * query fails with "Unable to open the database file".
 *
 * Resolving the URL to an absolute path here — before the server starts — keeps
 * `bun run dev`, `bun run db:push`, `bun scripts/seed.ts` and `bun run start`
 * all pointing at the same database. Postgres/Supabase URLs pass through
 * untouched, as do paths that are already absolute.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const SERVER = path.join(projectRoot, ".next", "standalone", "server.js");

function resolveDatabaseUrl(url: string | undefined): string | undefined {
  if (!url?.startsWith("file:")) return url;
  const filePath = url.slice("file:".length);
  if (filePath === "" || path.isAbsolute(filePath)) return url;
  // Prisma resolves relative SQLite paths against the schema directory.
  return `file:${path.resolve(projectRoot, "prisma", filePath)}`;
}

const databaseUrl = resolveDatabaseUrl(process.env.DATABASE_URL);

const child = spawn(process.execPath, [SERVER], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
