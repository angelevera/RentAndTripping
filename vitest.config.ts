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
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/validation/**/*.test.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Outside Next.js's bundler the real "server-only" package throws
      // unconditionally (it has no way to tell a Vitest/Node import apart
      // from a browser one) — aliased to an empty stub so db-project tests
      // can import server-only-guarded modules directly. See
      // tests/helpers/server-only-stub.ts for the full rationale.
      "server-only": fileURLToPath(new URL("./tests/helpers/server-only-stub.ts", import.meta.url)),
    },
  },
});
