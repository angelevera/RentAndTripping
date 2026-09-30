import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  CookieJar,
  publicClient,
  serviceClient,
  sweepStaleTestUsers,
  submitForm,
  TEST_PREFIX,
} from "../helpers/fixtures";

const idsDeUsuarios: string[] = [];

let secuencia = 0;

async function crearInvitacion() {
  const admin = serviceClient();
  const email = `${TEST_PREFIX}-completar-${++secuencia}@${process.env.TEST_EMAIL_DOMAIN || "example.com"}`;
  const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email });

  if (error || !data?.properties.hashed_token || !data.user?.id) {
    throw new Error(`No se pudo generar el enlace de prueba: ${error?.message ?? "sin token"}`);
  }

  idsDeUsuarios.push(data.user.id);

  return { email, tokenHash: data.properties.hashed_token };
}

async function confirmarInvitacion(tokenHash: string, next?: string) {
  const baseUrl = inject("baseUrl");
  const jar = new CookieJar();
  const query = new URLSearchParams({ token_hash: tokenHash, type: "invite" });

  if (next) query.set("next", next);

  const response = await fetch(new URL(`/auth/confirm?${query}`, baseUrl), {
    redirect: "manual",
  });

  jar.applySetCookie(response.headers.getSetCookie());

  return { response, jar, baseUrl };
}

async function cuerpoFinal(response: Response, jar: CookieJar, baseUrl: string) {
  if (response.status < 300 || response.status >= 400) return response.text();

  const location = response.headers.get("location");

  if (!location) return "";

  const followUp = await fetch(new URL(location, baseUrl), {
    headers: jar.header() ? { Cookie: jar.header() } : undefined,
    redirect: "manual",
  });

  jar.applySetCookie(followUp.headers.getSetCookie());

  return followUp.text();
}

describe("completar cuenta por invitación", () => {
  beforeAll(async () => {
    await sweepStaleTestUsers();
  });

  afterAll(async () => {
    const admin = serviceClient();

    for (const id of idsDeUsuarios) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("intercambia una invitación real por sesión y redirige al panel de contraseña", async () => {
    const { tokenHash } = await crearInvitacion();
    const { response, jar, baseUrl } = await confirmarInvitacion(tokenHash, "/cliente/completar-cuenta");

    expect(response.status).toBeGreaterThanOrEqual(300);

    expect(response.status).toBeLessThan(400);
    expect(new URL(response.headers.get("location") ?? "", baseUrl).pathname).toBe(
      "/cliente/completar-cuenta",
    );
    expect(jar.header()).toContain("-auth-token");
  });

  it("envía un token inventado al mismo destino y sin sesión", async () => {
    const { response, jar, baseUrl } = await confirmarInvitacion("token-inventado-que-no-existe");

    expect(response.status).toBeGreaterThanOrEqual(300);

    expect(response.status).toBeLessThan(400);
    expect(new URL(response.headers.get("location") ?? "", baseUrl).pathname).toBe(
      "/cliente/completar-cuenta",
    );
    expect(jar.header()).not.toContain("-auth-token");
  });

  it("envía una solicitud sin parámetros al mismo destino y sin sesión", async () => {
    const baseUrl = inject("baseUrl");
    const response = await fetch(new URL("/auth/confirm", baseUrl), { redirect: "manual" });

    expect(response.status).toBeGreaterThanOrEqual(300);

    expect(response.status).toBeLessThan(400);
    expect(new URL(response.headers.get("location") ?? "", baseUrl).pathname).toBe(
      "/cliente/completar-cuenta",
    );
    expect(response.headers.getSetCookie().join(";")).not.toContain("-auth-token");
  });

  it.each([
    "https://ejemplo-externo.test",
    "//ejemplo-externo.test",
    "/\\ejemplo-externo.test",
    "/\t/ejemplo-externo.test",
  ])("rechaza el destino externo %j incluso cuando el token sí es válido", async (destino) => {
    const { tokenHash } = await crearInvitacion();
    const { response, baseUrl } = await confirmarInvitacion(tokenHash, destino);

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = new URL(response.headers.get("location") ?? "", baseUrl);
    expect(location.origin).toBe(new URL(baseUrl).origin);
    expect(location.pathname).toBe("/cliente/completar-cuenta");
  });

  it("muestra el aviso cálido cuando alguien abre la página sin sesión", async () => {
    const baseUrl = inject("baseUrl");

    const response = await fetch(new URL("/cliente/completar-cuenta", baseUrl), {
      redirect: "manual",
    });

    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain(
      "Este enlace ya venció. Pídele al operador que te mande la invitación de nuevo.",
    );
    expect(body).not.toContain('data-testid="form-completar-cuenta"');
  });

  it("marca la confirmación distinta y no cambia la contraseña", async () => {
    const { email, tokenHash } = await crearInvitacion();
    const { jar, baseUrl } = await confirmarInvitacion(tokenHash);

    const response = await submitForm({
      baseUrl,
      path: "/cliente/completar-cuenta",
      jar,
      formTestId: "form-completar-cuenta",
      fields: { password: "Clave-nueva-2026", confirmarPassword: "Otra-clave-2026" },
    });

    const body = await cuerpoFinal(response, jar, baseUrl);

    expect(body).toContain("Las contraseñas no coinciden.");

    const { error } = await publicClient().auth.signInWithPassword({
      email,
      password: "Clave-nueva-2026",
    });

    expect(error).toBeTruthy();
  });

  it("rechaza contraseñas de menos de seis caracteres", async () => {
    const { tokenHash } = await crearInvitacion();
    const { jar, baseUrl } = await confirmarInvitacion(tokenHash);

    const response = await submitForm({
      baseUrl,
      path: "/cliente/completar-cuenta",
      jar,
      formTestId: "form-completar-cuenta",
      fields: { password: "abc12", confirmarPassword: "abc12" },
    });

    expect(await cuerpoFinal(response, jar, baseUrl)).toContain(
      "La contraseña debe tener al menos 6 caracteres.",
    );
  });

  it("guarda la contraseña, permite iniciar sesión y conserva la sesión invitada", async () => {
    const { email, tokenHash } = await crearInvitacion();
    const { jar, baseUrl } = await confirmarInvitacion(tokenHash);
    const password = "Clave-segura-2026";

    const response = await submitForm({
      baseUrl,
      path: "/cliente/completar-cuenta",
      jar,
      formTestId: "form-completar-cuenta",
      fields: { password, confirmarPassword: password },
    });

    const body = await cuerpoFinal(response, jar, baseUrl);

    expect(response.status).toBe(200);
    expect(body).toContain("¡Listo! Ya puedes ver tus reservas.");
    expect(body).toContain('href="/cliente"');

    const { error } = await publicClient().auth.signInWithPassword({ email, password });

    expect(error).toBeNull();

    const panel = await fetch(new URL("/cliente", baseUrl), {
      headers: { Cookie: jar.header() },
      redirect: "manual",
    });

    expect(panel.status).toBe(200);
    expect(await panel.text()).toContain('data-testid="panel-cliente"');
  });
});
