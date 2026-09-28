import { beforeAll, afterAll, describe, expect, inject, it } from "vitest";
import {
  CookieJar,
  createTestUser,
  cleanupTestUsers,
  sweepStaleTestUsers,
  submitForm,
  type TestUser,
} from "../helpers/fixtures";

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
});
