import { describe, expect, it } from "vitest";
import { publicClient, serviceClient } from "../helpers/fixtures";

const ADMIN_EMAIL = "gabbovera@gmail.com";

async function findAuthUserByEmail(email: string) {
  const admin = serviceClient();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) {
      throw new Error(`No se pudo listar usuarios: ${error?.message}`);
    }
    const users = data.users ?? [];
    const found = users.find((user) => user.email === email);
    if (found) return found;
    if (users.length < perPage) return undefined;
    page += 1;
  }
}

async function listAllAuthUsers() {
  const admin = serviceClient();
  const all: Array<{ id: string; email: string | undefined }> = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) {
      throw new Error(`No se pudo listar usuarios: ${error?.message}`);
    }
    const users = data.users ?? [];
    for (const user of users) {
      all.push({ id: user.id, email: user.email });
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

describe("registro público cerrado y admin único (D-03, AUTH-01)", () => {
  it("rechaza el registro público (signUp), y no crea ningún usuario para ese correo", async () => {
    const email = `rt-test-${Date.now()}-signup-rejected@example.com`;
    const { error } = await publicClient().auth.signUp({
      email,
      password: "Contrasena-De-Prueba-123!",
    });

    // Se exige el código específico 'signup_disabled' (no solo "cualquier
    // error") para no confundir esta prueba con un falso positivo por
    // rate-limiting del correo de confirmación, que también devuelve error.
    expect(error).toBeTruthy();
    expect(error?.code).toBe("signup_disabled");

    const created = await findAuthUserByEmail(email);
    expect(created).toBeUndefined();
  });

  it("gabbovera@gmail.com existe, está confirmado, y profiles.role es 'admin'", async () => {
    const authUser = await findAuthUserByEmail(ADMIN_EMAIL);
    expect(authUser).toBeTruthy();
    expect(authUser?.email_confirmed_at).toBeTruthy();

    const admin = serviceClient();
    const { data: perfil, error } = await admin
      .from("profiles")
      .select("role")
      .eq("id", authUser!.id)
      .single();

    expect(error).toBeFalsy();
    expect(perfil?.role).toBe("admin");
  });

  it("es el único admin real (excluyendo cuentas rt-test-)", async () => {
    const admin = serviceClient();
    const allUsers = await listAllAuthUsers();

    const { data: adminProfiles, error } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    expect(error).toBeFalsy();

    const adminIds = new Set((adminProfiles ?? []).map((row) => row.id));
    const realAdminEmails = allUsers
      .filter((user) => adminIds.has(user.id) && !user.email?.startsWith("rt-test-"))
      .map((user) => user.email);

    expect(realAdminEmails).toEqual([ADMIN_EMAIL]);
  });

  it("el registro está cerrado y no hay límites de sesión activos en la API de administración", async () => {
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    const projectRef = process.env.SUPABASE_PROJECT_REF;
    if (!accessToken || !projectRef) {
      throw new Error("Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF para este test");
    }

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(response.ok).toBe(true);
    const config = await response.json();

    expect(config.disable_signup).toBe(true);

    // El plan gratuito puede omitir estos campos por completo — ausente
    // cuenta como "apagado", igual que false.
    expect(config.sessions_timebox ?? 0).toBeFalsy();
    expect(config.sessions_inactivity_timeout ?? 0).toBeFalsy();
    expect(config.sessions_single_per_user ?? false).toBeFalsy();
  });
});
