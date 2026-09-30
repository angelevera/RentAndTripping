import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  cleanupTestUsers,
  createTestUser,
  loginJar,
  serviceClient,
  submitForm,
  sweepStaleTestUsers,
  trackTestUserId,
  type CookieJar,
  type TestUser,
} from "../helpers/fixtures";

let admin: TestUser;
let clienteActivo: TestUser;
let clientePendienteId: string;
let jar: CookieJar;
let baseUrl: string;

beforeAll(async () => {
  await sweepStaleTestUsers();
  baseUrl = inject("baseUrl");
  admin = await createTestUser("admin");
  clienteActivo = await createTestUser("customer");
  const adminDb = serviceClient();
  await adminDb.from("profiles").update({ nombre: `${clienteActivo.id} Cliente activo`, telefono: "+1-555-0148" }).eq("id", clienteActivo.id);
  // generateLink(type "invite") deja invited_at real sin enviar correo;
  // adminConEnvioSimulado usa createUser, que lo deja en null y no pinta el badge.
  const { data: enlace, error: errorEnlace } = await adminDb.auth.admin.generateLink({
    type: "invite",
    email: `${Date.now()}-${admin.id}@${process.env.TEST_EMAIL_DOMAIN || "example.com"}`,
    options: { data: { nombre: "Cliente pendiente de prueba" } },
  });
  if (errorEnlace || !enlace.user) throw new Error("No se pudo preparar la cuenta pendiente para e2e");
  clientePendienteId = enlace.user.id;
  trackTestUserId(clientePendienteId);
  jar = await loginJar({ baseUrl, user: admin });
});

afterAll(async () => {
  await cleanupTestUsers();
});

// Estos dos casos pasan por la Server Action real, que llama a
// inviteUserByEmail de verdad; mientras rentntrippin.com no esté verificado en
// Resend el envío falla y el servidor de Next no se puede simular desde aquí
// (ver adminConEnvioSimulado en fixtures.ts). Se activan con
// RESEND_DOMINIO_VERIFICADO=1 en cuanto el dominio quede verificado.
const envioRealDisponible = process.env.RESEND_DOMINIO_VERIFICADO === "1";

describe("/admin/clientes", () => {
  it("muestra cuentas activas y pendientes en una sola lista con el badge y cero reservas", async () => {
    const response = await fetch(new URL("/admin/clientes", baseUrl), { headers: { Cookie: jar.header() } });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('data-testid="panel-clientes"');
    expect(html).toContain("Clientes");
    expect(html).toContain("Invitación pendiente");
    expect(html).toContain("0 reservas");
    expect(html).toContain(`data-cliente-id="${clientePendienteId}"`);
  });

  it("busca por nombre, correo y teléfono del cliente", async () => {
    for (const q of [`${clienteActivo.id} Cliente`, clienteActivo.email, "+1-555-0148"]) {
      const response = await fetch(new URL(`/admin/clientes?q=${encodeURIComponent(q)}`, baseUrl), { headers: { Cookie: jar.header() } });
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(html).toContain(`data-cliente-id="${clienteActivo.id}"`);
    }
  });

  it.skipIf(!envioRealDisponible)("invita un cliente nuevo aunque todavía no tenga reservas", async () => {
    const email = `rt-e2e-${Date.now()}-${admin.id}@${process.env.TEST_EMAIL_DOMAIN || "example.com"}`;
    const response = await submitForm({ baseUrl, path: "/admin/clientes", jar, formTestId: "form-invitar-cliente", fields: { nombre: "Cliente sin reserva previa", email } });
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(new URL(response.headers.get("location") as string, baseUrl).searchParams.get("aviso")).toBe("invitada");
    const { data } = await serviceClient().from("profiles").select("id").eq("email", email).single();
    expect(data?.id).toBeTruthy();
    if (data?.id) trackTestUserId(data.id);
    const page = await fetch(new URL(`/admin/clientes?q=${encodeURIComponent(email)}`, baseUrl), { headers: { Cookie: jar.header() } });
    expect(await page.text()).toContain("0 reservas");
  });

  it("muestra el mensaje exacto D-12 y no crea otra cuenta para un correo existente", async () => {
    const response = await submitForm({ baseUrl, path: "/admin/clientes", jar, formTestId: "form-invitar-cliente", fields: { nombre: "Duplicado", email: clienteActivo.email } });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Ese correo ya tiene una cuenta.");
    const { data } = await serviceClient().from("profiles").select("id").eq("email", clienteActivo.email);
    expect(data).toHaveLength(1);
  });

  it.skipIf(!envioRealDisponible)("reenviar actualiza el id de una invitación pendiente", async () => {
    const { data: actual } = await serviceClient().from("profiles").select("id, email, nombre").eq("id", clientePendienteId).single();
    expect(actual?.email).toBeTruthy();
    const response = await submitForm({ baseUrl, path: "/admin/clientes", jar, formTestId: `form-reenviar-${clientePendienteId}`, fields: {} });
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(new URL(response.headers.get("location") as string, baseUrl).searchParams.get("aviso")).toBe("reenviada");
    const { data: nuevo } = await serviceClient().from("profiles").select("id").eq("email", actual!.email!).single();
    expect(nuevo?.id).toBeTruthy();
    expect(nuevo?.id).not.toBe(clientePendienteId);
    if (nuevo?.id) {
      trackTestUserId(nuevo.id);
      clientePendienteId = nuevo.id;
    }
  });

  it("solo ofrece Reenviar para la invitación que sigue pendiente", async () => {
    const response = await fetch(new URL("/admin/clientes", baseUrl), { headers: { Cookie: jar.header() } });
    const html = await response.text();
    expect(html).toContain(`data-testid="form-reenviar-${clientePendienteId}"`);
    expect(html).not.toContain(`data-testid="form-reenviar-${clienteActivo.id}"`);
  });
});
