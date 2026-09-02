import { defineConfig } from "vitest/config";
import path from "node:path";

const rootDir = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup-global.ts"],
    setupFiles: ["tests/setup-env.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: "forks",
    // API tests share one SQLite file (db/test.db) and wipe it in ensureSeed(),
    // so test files must never run concurrently. Vitest 4 removed
    // `poolOptions.forks.singleFork`; the top-level equivalents are these two.
    fileParallelism: false,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      "server-only": path.resolve(rootDir, "./tests/helpers/empty.ts"),
      "client-only": path.resolve(rootDir, "./tests/helpers/empty.ts"),
    },
  },
});
