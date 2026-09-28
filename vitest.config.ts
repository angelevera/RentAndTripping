import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Loads .env, .env.local, .env.admin and .env.admin.local (in that precedence
// order) into process.env for the test run — this is the only way Vitest sees
// SUPABASE_SECRET_KEY and friends. Next.js itself never loads .env.admin.local.
const adminEnv = loadEnv('admin', process.cwd(), "");

export default defineConfig({
  test: {
    env: adminEnv,
    environment: "node",
    // One shared hosted Supabase database — tests must not run concurrently
    // against it (namespaced rt-test- fixtures still need serialized runs to
    // keep sweeps/cleanup deterministic).
    fileParallelism: false,
    testTimeout: 30000,
    projects: [
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/rls/**/*.test.ts", "tests/auth/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["tests/e2e/**/*.test.ts"],
          globalSetup: ["tests/e2e/global-setup.ts"],
          testTimeout: 60000,
          hookTimeout: 180000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
