/**
 * Launcher for the standalone production server (`bun run start`).
 *
 * `.next/standalone/server.js` calls `process.chdir(__dirname)` on boot and the
 * build strips .env out of the artifact, so configuration has to arrive as real
 * environment variables. Checking them here turns a cryptic Prisma failure on
 * the first request into one clear line at startup.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const SERVER = path.join(process.cwd(), ".next", "standalone", "server.js");

const REQUIRED = ["DATABASE_URL", "SESSION_SECRET"] as const;
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[esifit] Refusing to start — missing environment variable(s): ${missing.join(", ")}.\n` +
      "Set them in .env (local) or in the host's environment, then start again.",
  );
  process.exit(1);
}

const child = spawn(process.execPath, [SERVER], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
