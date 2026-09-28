import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { loadEnv } from "vite";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
  }
}

const ADMIN_ONLY_VARS = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "ADMIN_INITIAL_PASSWORD",
];

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("No se pudo obtener un puerto libre")));
      }
    });
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(
    `El servidor de desarrollo no respondió en ${timeoutMs}ms en ${url}. ` +
      `Último error: ${String(lastError)}`,
  );
}

export default async function setup({ provide }: TestProject) {
  const explicitBaseUrl = process.env.E2E_BASE_URL;
  if (explicitBaseUrl) {
    provide("baseUrl", explicitBaseUrl);
    return async () => {
      // Nothing to tear down — an external server was used.
    };
  }

  const port = await findFreePort();
  const baseUrl = `http://localhost:${port}`;

  // globalSetup runs in its own process, separate from the test-file worker
  // that Vitest's `test.env` (vitest.config.ts's loadEnv('admin', ...))
  // populates — process.env here does NOT already carry NEXT_PUBLIC_* or the
  // admin-only vars, so load them directly from the same env files.
  const loadedEnv = loadEnv("admin", process.cwd(), "");

  // Strip admin-only secrets from the child's environment — the running app
  // must never be able to see them, even by accident.
  const childEnv: NodeJS.ProcessEnv = { ...process.env, ...loadedEnv };
  for (const key of ADMIN_ONLY_VARS) {
    delete childEnv[key];
  }
  childEnv.NEXT_TELEMETRY_DISABLED = "1";

  const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");

  const child = spawn(nextBin, ["dev", "--port", String(port)], {
    cwd: process.cwd(),
    env: childEnv,
    detached: true,
    stdio: "ignore",
  });

  child.on("error", (error: Error) => {
    throw new Error(
      `No se pudo iniciar 'next dev' para los tests e2e: ${String(error)}. ` +
        `Si otro servidor de desarrollo ya está usando el proyecto, define E2E_BASE_URL ` +
        `apuntando a esa instancia en vez de dejar que este harness levante la suya.`,
    );
  });

  try {
    await waitForServer(`${baseUrl}/login`, 120000);
  } catch (error) {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // process group may already be gone
      }
    }
    throw new Error(
      `${String(error)} Si otro 'next dev' ya está corriendo sobre este proyecto, ` +
        `define E2E_BASE_URL en .env.admin.local apuntando a esa URL en vez de dejar ` +
        `que este harness levante la suya.`,
    );
  }

  provide("baseUrl", baseUrl);

  return async () => {
    if (child.pid) {
      try {
        // Negative pid kills the whole detached process group.
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // already exited
      }
    }
  };
}
