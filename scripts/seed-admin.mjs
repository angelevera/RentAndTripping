#!/usr/bin/env node
// Crea o verifica la única cuenta real de administrador del MVP
// (gabbovera@gmail.com, D-03). Idempotente: correrlo dos veces da el mismo
// resultado, y nunca cambia una contraseña ya existente.
//
// Uso: npm run seed:admin

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
process.loadEnvFile(".env.admin.local");

const ADMIN_EMAIL = "gabbovera@gmail.com";

function fail(mensaje) {
  console.error(`Error: ${mensaje}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;

if (!supabaseUrl || !secretKey) {
  fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.");
}

if (!initialPassword || initialPassword.length < 12) {
  fail("ADMIN_INITIAL_PASSWORD debe existir y tener al menos 12 caracteres.");
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      fail(`No se pudo listar usuarios: ${error.message}`);
    }
    const users = data?.users ?? [];
    const found = users.find((u) => u.email === email);
    if (found) return found;
    if (users.length < perPage) return undefined;
    page += 1;
  }
}

async function main() {
  let authUser = await findUserByEmail(ADMIN_EMAIL);

  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: initialPassword,
      email_confirm: true,
      user_metadata: { nombre: "Administrador" },
    });
    if (error || !data?.user) {
      fail(`No se pudo crear la cuenta de administrador: ${error?.message}`);
    }
    authUser = data.user;
    console.log("Cuenta de administrador creada.");
  } else {
    // La cuenta ya existe — NUNCA se sobreescribe la contraseña aquí.
    console.log("La cuenta de administrador ya existía; no se tocó la contraseña.");
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", authUser.id);
  if (updateError) {
    fail(`No se pudo poner role='admin' en profiles: ${updateError.message}`);
  }

  const { data: perfil, error: readError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", authUser.id)
    .single();
  if (readError || perfil?.role !== "admin") {
    fail(`No se pudo verificar profiles.role='admin' para ${ADMIN_EMAIL}.`);
  }

  console.log(`Admin listo: ${ADMIN_EMAIL} (rol: admin)`);

  // Advertir sobre cualquier otro admin real (no rt-test-) que pudiera
  // haber quedado de una prueba o un error anterior.
  let page = 1;
  const perPage = 200;
  const otherAdmins = [];
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.id === authUser.id) continue;
      if (user.email?.startsWith("rt-test-")) continue;
      const { data: p } = await admin.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role === "admin") {
        otherAdmins.push(user.email);
      }
    }
    if (users.length < perPage) break;
    page += 1;
  }

  if (otherAdmins.length > 0) {
    console.warn(
      `ADVERTENCIA: hay otras cuentas con role='admin' además de ${ADMIN_EMAIL}: ${otherAdmins.join(", ")}`,
    );
  }
}

main().catch((error) => {
  fail(`Error inesperado: ${error?.message ?? String(error)}`);
});
