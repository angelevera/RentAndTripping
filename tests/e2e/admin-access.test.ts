import { beforeAll, afterAll, describe, expect, inject, it } from "vitest";
import {
  CookieJar,
  createTestUser,
  cleanupTestUsers,
  sweepStaleTestUsers,
  submitForm,
  type TestUser,
} from "../helpers/fixtures";

describe("admin-only access to /admin (D-01, D-02)", () => {
  let admin: TestUser;
  let customer: TestUser;

  beforeAll(async () => {
    await sweepStaleTestUsers();
    admin = await createTestUser("admin");
    customer = await createTestUser("customer");
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("redirects a signed-in customer requesting /admin to /login?motivo=sin-acceso", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: customer.email, password: customer.password },
    });

    const response = await fetch(new URL("/admin", baseUrl), {
      headers: jar.header() ? { Cookie: jar.header() } : undefined,
      redirect: "manual",
    });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const url = new URL(location as string, baseUrl);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("motivo")).toBe("sin-acceso");
  });

  it("redirects an anonymous request to /admin to /login before the page renders", async () => {
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

  it("allows the same admin to be signed in on two devices at once (D-02)", async () => {
    const baseUrl = inject("baseUrl");
    const jarA = new CookieJar();
    const jarB = new CookieJar();

    await submitForm({
      baseUrl,
      path: "/login",
      jar: jarA,
      formTestId: "form-login",
      fields: { email: admin.email, password: admin.password },
    });
    await submitForm({
      baseUrl,
      path: "/login",
      jar: jarB,
      formTestId: "form-login",
      fields: { email: admin.email, password: admin.password },
    });

    const responseA = await fetch(new URL("/admin", baseUrl), {
      headers: { Cookie: jarA.header() },
      redirect: "manual",
    });
    const responseB = await fetch(new URL("/admin", baseUrl), {
      headers: { Cookie: jarB.header() },
      redirect: "manual",
    });

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    const bodyA = await responseA.text();
    const bodyB = await responseB.text();
    expect(bodyA).toContain('data-testid="panel-admin"');
    expect(bodyB).toContain('data-testid="panel-admin"');
  });

  it("sets the auth cookie with Max-Age of at least 30 days at login (D-01)", async () => {
    const baseUrl = inject("baseUrl");
    const jar = new CookieJar();

    const response = await submitForm({
      baseUrl,
      path: "/login",
      jar,
      formTestId: "form-login",
      fields: { email: admin.email, password: admin.password },
    });

    const setCookieHeaders = response.headers.getSetCookie();
    const authCookieHeader = setCookieHeaders.find(
      (header) => header.includes("-auth-token") && !header.includes("-auth-token.1="),
    );
    expect(authCookieHeader).toBeTruthy();

    const maxAgeMatch = authCookieHeader?.match(/max-age=(\d+)/i);
    expect(maxAgeMatch).toBeTruthy();
    const maxAge = Number(maxAgeMatch?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(2592000);
  });

  it("logs out only the device that submits form-cerrar-sesion, leaving other devices signed in (D-02)", async () => {
    const baseUrl = inject("baseUrl");
    const jarA = new CookieJar();
    const jarB = new CookieJar();

    await submitForm({
      baseUrl,
      path: "/login",
      jar: jarA,
      formTestId: "form-login",
      fields: { email: admin.email, password: admin.password },
    });
    await submitForm({
      baseUrl,
      path: "/login",
      jar: jarB,
      formTestId: "form-login",
      fields: { email: admin.email, password: admin.password },
    });

    const logoutResponse = await submitForm({
      baseUrl,
      path: "/admin",
      jar: jarA,
      formTestId: "form-cerrar-sesion",
      fields: {},
    });

    expect(logoutResponse.status).toBeGreaterThanOrEqual(300);
    expect(logoutResponse.status).toBeLessThan(400);
    const location = logoutResponse.headers.get("location");
    expect(location).toBeTruthy();
    expect(new URL(location as string, baseUrl).pathname).toBe("/login");
    expect(jarA.header().includes("-auth-token")).toBe(false);

    const responseA = await fetch(new URL("/admin", baseUrl), {
      headers: jarA.header() ? { Cookie: jarA.header() } : undefined,
      redirect: "manual",
    });
    expect(responseA.status).toBeGreaterThanOrEqual(300);
    expect(responseA.status).toBeLessThan(400);
    expect(new URL(responseA.headers.get("location") as string, baseUrl).pathname).toBe("/login");

    const responseB = await fetch(new URL("/admin", baseUrl), {
      headers: { Cookie: jarB.header() },
      redirect: "manual",
    });
    expect(responseB.status).toBe(200);
  });
});
