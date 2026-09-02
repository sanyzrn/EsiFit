import { describe, it, expect } from "vitest";
import path from "node:path";

/**
 * Mirrors resolveDatabaseUrl() in scripts/start.ts. The standalone server
 * chdir()s into .next/standalone, so a relative SQLite URL must be made
 * absolute before launch or every query fails with
 * "Unable to open the database file".
 */
function resolveDatabaseUrl(url: string | undefined, projectRoot: string): string | undefined {
  if (!url?.startsWith("file:")) return url;
  const filePath = url.slice("file:".length);
  if (filePath === "" || path.isAbsolute(filePath)) return url;
  return `file:${path.resolve(projectRoot, "prisma", filePath)}`;
}

const ROOT = "/srv/esifit";

describe("standalone launcher database URL resolution", () => {
  it("anchors a relative sqlite path to <root>/prisma, matching the Prisma CLI", () => {
    expect(resolveDatabaseUrl("file:./db/dev.db", ROOT)).toBe("file:/srv/esifit/prisma/db/dev.db");
    expect(resolveDatabaseUrl("file:db/dev.db", ROOT)).toBe("file:/srv/esifit/prisma/db/dev.db");
  });

  it("leaves an already absolute sqlite path alone", () => {
    expect(resolveDatabaseUrl("file:/var/data/esifit.db", ROOT)).toBe("file:/var/data/esifit.db");
  });

  it("never rewrites a non-sqlite connection string", () => {
    const pg = "postgresql://user:pw@db.example.com:5432/esifit?schema=public";
    expect(resolveDatabaseUrl(pg, ROOT)).toBe(pg);
  });

  it("passes an unset url through untouched", () => {
    expect(resolveDatabaseUrl(undefined, ROOT)).toBeUndefined();
  });
});
