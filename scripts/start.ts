/**
 * Launcher for the standalone production server.
 *
 * `.next/standalone/server.js` calls `process.chdir(__dirname)` on boot and does
 * not read a .env file (the build deliberately strips .env out of the artifact so
 * local secrets never ship). Configuration therefore has to arrive as real
 * environment variables from the host — panel, systemd unit, pm2 ecosystem file
 * or docker run. Failing here with a clear message beats a cryptic Prisma error
 * on the first request.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const SERVER = path.join(process.cwd(), ".next", "standalone", "server.js");

const REQUIRED = ["DATABASE_URL", "SESSION_SECRET"] as const;
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[esifit] Refusing to start — missing required environment variable(s): ${missing.join(", ")}.\n` +
      "Set them in the host's environment (see .env.example), then start again.",
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
