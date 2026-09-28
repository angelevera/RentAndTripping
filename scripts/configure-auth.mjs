#!/usr/bin/env node
// Cierra el registro público y verifica los ajustes de sesión del proyecto
// vía la Management API de Supabase — responde la Open Question 1 de
// RESEARCH automáticamente en vez de depender de una revisión manual del
// dashboard.
//
// Uso: npm run auth:configure

process.loadEnvFile(".env.local");
process.loadEnvFile(".env.admin.local");

function fail(mensaje) {
  console.error(`Error: ${mensaje}`);
  process.exit(1);
}

const projectRef = process.env.SUPABASE_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !accessToken) {
  fail("Faltan SUPABASE_PROJECT_REF o SUPABASE_ACCESS_TOKEN.");
}

const configUrl = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;

async function getConfig() {
  const response = await fetch(configUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    fail(`GET a la Management API falló con estado ${response.status}.`);
  }
  return response.json();
}

async function main() {
  const before = await getConfig();

  // Confirmamos el nombre del campo que cierra el registro antes de hacer
  // PATCH — en este proyecto es 'disable_signup'.
  if (!("disable_signup" in before)) {
    fail(
      "La Management API no expone el campo 'disable_signup' esperado; revisar el nombre real del campo.",
    );
  }

  if (before.disable_signup !== true) {
    const patchResponse = await fetch(configUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ disable_signup: true }),
    });
    if (!patchResponse.ok) {
      fail(`PATCH a la Management API falló con estado ${patchResponse.status}.`);
    }
  }

  const after = await getConfig();

  const registroCerrado = after.disable_signup === true;
  // El plan gratuito puede omitir estos campos por completo; ausente cuenta
  // como "apagado", igual que false/0.
  const sinLimiteDeSesion = !after.sessions_timebox;
  const sinCierrePorInactividad = !after.sessions_inactivity_timeout;
  const sinSesionUnica = !after.sessions_single_per_user;

  console.log("Resumen de configuración de Auth:");
  console.log(`- Registro público: ${registroCerrado ? "cerrado" : "ABIERTO"}`);
  console.log(
    `- Límite de duración de sesión: ${sinLimiteDeSesion ? "sin límite" : "ACTIVO"}`,
  );
  console.log(
    `- Cierre por inactividad: ${sinCierrePorInactividad ? "sin límite" : "ACTIVO"}`,
  );
  console.log(`- Una sola sesión por usuario: ${sinSesionUnica ? "no forzada" : "ACTIVA"}`);

  if (!registroCerrado) {
    fail("El registro público sigue abierto tras el PATCH.");
  }
  if (!sinLimiteDeSesion || !sinCierrePorInactividad || !sinSesionUnica) {
    fail(
      "Uno de los límites de sesión (D-01/D-02) está activo — el admin podría perder su sesión larga o multi-dispositivo.",
    );
  }
}

main().catch((error) => {
  fail(`Error inesperado: ${error?.message ?? String(error)}`);
});
