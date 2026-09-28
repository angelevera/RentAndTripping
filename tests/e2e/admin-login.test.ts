import { beforeAll, afterAll, describe, expect, inject, it } from "vitest";
import {
  CookieJar,
  createTestUser,
  cleanupTestUsers,
  sweepStaleTestUsers,
  submitForm,
  type TestUser,
} from "../helpers/fixtures";

/**
 * Lee el cuerpo final de una respuesta de submitForm, siguiendo como mucho
 * un redirect a la misma página (así es como Next.js re-renderiza un
 * useActionState con estado de error cuando el formulario se envía sin
 * JavaScript, y así lo describe el plan: "at most one same-page redirect").
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

describe("admin login skeleton (/login -> /admin)", () => {
  let admin: TestUser;

  beforeAll(async () => {
    await sweepStaleTestUsers();
    admin = await createTestUser("admin");
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("signs the admin in through the real /login form and redirects to /admin", async () => {
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
    expect(new URL(location as string, baseUrl).pathname).toBe("/admin");

    const hasAuthCookie = jar.header().includes("-auth-token");
    expect(hasAuthCookie).toBe(true);
  });

  it("shows the panel and the admin's email when visiting /admin with a valid session", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: admin.email, password: admin.password },
    });

    const response = await fetch(new URL("/admin", baseUrl), {
      headers: { Cookie: jar.header() },
      redirect: "manual",
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('data-testid="panel-admin"');
    expect(body).toContain(admin.email);
  });

  it("redirects an anonymous visitor of /admin to /login", async () => {
    const baseUrl = inject("baseUrl");

    const response = await fetch(new URL("/admin", baseUrl), {
      redirect: "manual",
    });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(new URL(location as string, baseUrl).pathname).toBe("/login");
  });

  it("la raíz / lleva a /admin", async () => {
    const baseUrl = inject("baseUrl");

    const response = await fetch(new URL("/", baseUrl), {
      redirect: "manual",
    });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(new URL(location as string, baseUrl).pathname).toBe("/admin");
  });

  it("muestra el mismo mensaje para contraseña incorrecta y correo desconocido, sin crear sesión", async () => {
    const baseUrl = inject("baseUrl");

    const jarContrasenaIncorrecta = new CookieJar();
    const respuestaContrasenaIncorrecta = await submitForm({
      baseUrl,
      path: "/login",
      jar: jarContrasenaIncorrecta,
      formTestId: "form-login",
      fields: { email: admin.email, password: "una-contraseña-que-no-es" },
    });
    const cuerpoContrasenaIncorrecta = await finalBody(
      respuestaContrasenaIncorrecta,
      jarContrasenaIncorrecta,
      baseUrl,
    );
    expect(cuerpoContrasenaIncorrecta).toContain("Correo o contraseña incorrectos.");
    expect(jarContrasenaIncorrecta.header().includes("-auth-token")).toBe(false);

    const jarCorreoDesconocido = new CookieJar();
    const correoDesconocido = `rt-test-${Math.random().toString(36).slice(2, 8)}-no-existe@example.com`;
    const respuestaCorreoDesconocido = await submitForm({
      baseUrl,
      path: "/login",
      jar: jarCorreoDesconocido,
      formTestId: "form-login",
      fields: { email: correoDesconocido, password: "cualquier-cosa-123" },
    });
    const cuerpoCorreoDesconocido = await finalBody(
      respuestaCorreoDesconocido,
      jarCorreoDesconocido,
      baseUrl,
    );
    expect(cuerpoCorreoDesconocido).toContain("Correo o contraseña incorrectos.");
    expect(jarCorreoDesconocido.header().includes("-auth-token")).toBe(false);
  });

  it("rechaza un correo mal formado en el servidor aunque el navegador no valide (sin JS)", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    const response = await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: "no-es-un-correo", password: "cualquier-cosa-123" },
    });

    const body = await finalBody(response, jar, baseUrl);
    expect(body).toContain("Escribe un correo válido.");
    expect(jar.header().includes("-auth-token")).toBe(false);
  });

  it("GET /login?motivo=sin-acceso muestra el aviso de acceso denegado", async () => {
    const baseUrl = inject("baseUrl");

    const response = await fetch(new URL("/login?motivo=sin-acceso", baseUrl));

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Esta cuenta no tiene acceso al panel de administración.");
  });

  it("un admin que ya inició sesión y abre /login va directo a /admin", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: admin.email, password: admin.password },
    });

    const response = await fetch(new URL("/login", baseUrl), {
      headers: { Cookie: jar.header() },
      redirect: "manual",
    });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(new URL(location as string, baseUrl).pathname).toBe("/admin");
  });
});
