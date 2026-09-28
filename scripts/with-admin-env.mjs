#!/usr/bin/env node
// Carga .env.admin.local con process.loadEnvFile() (parser seguro
// clave=valor, nunca un shell) y ejecuta el comando dado heredando ese
// entorno. Reemplaza el patrón anterior de los scripts db:* del
// package.json, `set -a && . ./.env.admin.local && set +a`, que ejecutaba
// el archivo como script de shell: un valor con backticks, $(...) o una
// comilla sin cerrar (ej. en SUPABASE_DB_PASSWORD, que el desarrollador
// puede pegar de un generador de contraseñas) podía ejecutar comandos
// arbitrarios al "sourcearlo" (WR-05, code review de Fase 1).
//
// Uso: node scripts/with-admin-env.mjs <comando> [...args]
//
// La contraseña de Postgres nunca se pasa por línea de comandos (donde
// quedaría visible en `ps`/el historial de procesos): el CLI de Supabase ya
// lee SUPABASE_DB_PASSWORD directamente del entorno cuando no se le da
// --password explícitamente, así que basta con heredar el entorno cargado.

import { spawnSync } from "node:child_process";

function fail(mensaje) {
  console.error(`Error: ${mensaje}`);
  process.exit(1);
}

try {
  process.loadEnvFile(".env.admin.local");
} catch (error) {
  if (error.code === "ENOENT") {
    fail("Falta .env.admin.local. Copia .env.example y complétalo antes de correr este script.");
  }
  throw error;
}

const [comando, ...args] = process.argv.slice(2);

if (!comando) {
  fail("Uso: node scripts/with-admin-env.mjs <comando> [...args]");
}

const resultado = spawnSync(comando, args, { stdio: "inherit", env: process.env });

if (resultado.error) {
  fail(`No se pudo ejecutar '${comando}': ${resultado.error.message}`);
}

process.exit(resultado.status ?? 1);
