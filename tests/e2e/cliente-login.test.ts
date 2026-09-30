import { beforeAll, afterAll, describe, expect, inject, it } from "vitest";
import {
  CookieJar,
  createTestUser,
  createReservaFixture,
  cleanupTestUsers,
  sweepStaleTestUsers,
  submitForm,
  type TestUser,
} from "../helpers/fixtures";

/**
 * Lee el cuerpo final de una respuesta de submitForm, siguiendo como mucho
 * un redirect a la misma página — mismo patrón que admin-login.test.ts.
 */
async function finalBody(response: Response, jar: CookieJar, baseUrl: string): Promise<string> {
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");

    if (!location) return "";

    const followUp = await fetch(new URL(location, baseUrl), {
      headers: jar.header() ? { Cookie: jar.header() } : undefined,
    });

    jar.applySetCookie(followUp.headers.getSetCookie());

    return await followUp.text();
  }

  return await response.text();
}

describe("cliente login (/login -> /cliente, cierre de WR-01)", () => {
  let admin: TestUser;
  let clienteConReserva: TestUser;
  let clienteSinReserva: TestUser;

  beforeAll(async () => {
    await sweepStaleTestUsers();
    admin = await createTestUser("admin");
    clienteConReserva = await createTestUser("customer");
    await createReservaFixture({ clienteId: clienteConReserva.id, adminId: admin.id });
    clienteSinReserva = await createTestUser("customer");
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("signs a customer in through the real /login form and redirects straight to /cliente", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    const response = await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: clienteConReserva.email, password: clienteConReserva.password },
    });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);

    const location = response.headers.get("location");

    expect(location).toBeTruthy();
    // SAFETY: la aserción toBeTruthy() de arriba ya falló la prueba si location fuera null.
    expect(new URL(location as string, baseUrl).pathname).toBe("/cliente");
  });

  it("still sends the admin to /admin, unchanged (regression)", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    const response = await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: admin.email, password: admin.password },
    });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);

    const location = response.headers.get("location");

    expect(location).toBeTruthy();
    // SAFETY: la aserción toBeTruthy() de arriba ya falló la prueba si location fuera null.
    expect(new URL(location as string, baseUrl).pathname).toBe("/admin");
  });

  it("redirects an anonymous request to /cliente to /login before the page renders", async () => {
    const baseUrl = inject("baseUrl");

    const response = await fetch(new URL("/cliente", baseUrl), {
      redirect: "manual",
    });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);

    const location = response.headers.get("location");

    expect(location).toBeTruthy();
    // SAFETY: la aserción toBeTruthy() de arriba ya falló la prueba si location fuera null.
    expect(new URL(location as string, baseUrl).pathname).toBe("/login");
  });

  it("shows a signed-in customer at least one of their own real reservations", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: clienteConReserva.email, password: clienteConReserva.password },
    });

    const response = await fetch(new URL("/cliente", baseUrl), {
      headers: jar.header() ? { Cookie: jar.header() } : undefined,
    });

    expect(response.status).toBe(200);

    const body = await response.text();

    expect(body).toContain('data-testid="panel-cliente"');
    expect(body).toContain('data-testid="reserva-cliente"');
    expect(body).toContain("tour");
  });

  it("shows the same wrong-credentials message for admin and customer emails, and creates no session", async () => {
    const baseUrl = inject("baseUrl");
    const jarAdmin = new CookieJar();

    const respuestaAdmin = await submitForm({
      baseUrl,
      path: "/login",
      jar: jarAdmin,
      formTestId: "form-login",
      fields: { email: admin.email, password: "una-contraseña-que-no-es" },
    });

    const cuerpoAdmin = await finalBody(respuestaAdmin, jarAdmin, baseUrl);

    expect(cuerpoAdmin).toContain("Correo o contraseña incorrectos.");
    expect(jarAdmin.header().includes("-auth-token")).toBe(false);

    const jarCliente = new CookieJar();

    const respuestaCliente = await submitForm({
      baseUrl,
      path: "/login",
      jar: jarCliente,
      formTestId: "form-login",
      fields: { email: clienteConReserva.email, password: "una-contraseña-que-no-es" },
    });

    const cuerpoCliente = await finalBody(respuestaCliente, jarCliente, baseUrl);

    expect(cuerpoCliente).toContain("Correo o contraseña incorrectos.");
    expect(jarCliente.header().includes("-auth-token")).toBe(false);
  });

  it("a customer with no reservations of their own sees none of another customer's data", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: clienteSinReserva.email, password: clienteSinReserva.password },
    });

    const response = await fetch(new URL("/cliente", baseUrl), {
      headers: jar.header() ? { Cookie: jar.header() } : undefined,
    });

    expect(response.status).toBe(200);

    const body = await response.text();

    expect(body).toContain('data-testid="panel-cliente"');
    expect(body).not.toContain('data-testid="reserva-cliente"');
  });
});
