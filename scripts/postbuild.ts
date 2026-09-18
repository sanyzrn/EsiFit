/**
 * Post-build packaging for the Next.js standalone output.
 * Cross-platform (Windows/macOS/Linux): copies static assets + public/
 * into the standalone folder, then strips any local .env files so
 * development secrets never ship with the production bundle.
 */
import { cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dist = process.env.NEXT_DIST_DIR ?? ".next";
const standalone = join(dist, "standalone");
const standaloneDist = join(standalone, dist);

if (!existsSync(standalone)) {
  console.error(`[postbuild] standalone output missing at ${standalone}`);
  process.exit(1);
}

const staticSrc = join(dist, "static");
if (existsSync(staticSrc)) {
  mkdirSync(standaloneDist, { recursive: true });
  cpSync(staticSrc, join(standaloneDist, "static"), { recursive: true });
}

if (existsSync("public")) {
  cpSync("public", join(standalone, "public"), { recursive: true });
}

for (const envFile of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const p = join(standalone, envFile);
  if (existsSync(p)) rmSync(p);
}

console.log("[postbuild] standalone package ready:", standalone);
