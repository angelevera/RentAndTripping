import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { cleanupTestUsers, createReservaHuerfanaConContactoFixture, createTestUser, loginJar, submitForm, sweepStaleTestUsers, type CookieJar, type TestUser } from "../helpers/fixtures";
import { vincularReserva } from "@/lib/clientes/vincular";
import { signInAs } from "../helpers/fixtures";

let admin: TestUser;
let cliente: TestUser;
let jar: CookieJar;
let baseUrl: string;

beforeAll(async () => {
  await sweepStaleTestUsers();
  baseUrl = inject("baseUrl");
  admin = await createTestUser("admin");
  cliente = await createTestUser("customer");
  jar = await loginJar({ baseUrl, user: admin });
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe("/admin/clientes/[id]", () => {
  it("muestra por separado Reservas vinculadas y Buscar reservas para vincular", async () => {
    const response = await fetch(new URL(`/admin/clientes/${cliente.id}`, baseUrl), { headers: { Cookie: jar.header() } });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Reservas vinculadas");
    expect(html).toContain("Buscar reservas para vincular");
    expect(html).toContain('data-slot="separator"');
  });

  it("explica el estado sin reservas vinculadas", async () => {
    const response = await fetch(new URL(`/admin/clientes/${cliente.id}`, baseUrl), { headers: { Cookie: jar.header() } });
    expect(await response.text()).toContain("Este cliente todavía no tiene reservas vinculadas. Búscalas abajo.");
  });

  it("busca una huérfana por texto parcial sin mezclarla con las vinculadas", async () => {
    const reserva = await createReservaHuerfanaConContactoFixture({ adminId: admin.id, pagadorNombre: `E2E huérfana ${Date.now()}`, pagadorEmail: cliente.email, pagadorTelefono: "(0414) 555-0264" });
    const q = "E2E huérfana";
    const response = await fetch(new URL(`/admin/clientes/${cliente.id}?q=${encodeURIComponent(q)}`, baseUrl), { headers: { Cookie: jar.header() } });
    const html = await response.text();
    expect(html).toContain(`data-testid="reserva-huerfana" data-reserva-id="${reserva.reservaId}"`);
    expect(html).not.toContain(`data-testid="reserva-vinculada" data-reserva-id="${reserva.reservaId}"`);
    expect(html).toContain(`data-testid="form-vincular-${reserva.reservaId}"`);
  });

  it("vincula desde la candidata y la muestra en el bloque vinculado", async () => {
    const reserva = await createReservaHuerfanaConContactoFixture({ adminId: admin.id, pagadorNombre: `E2E vincular ${Date.now()}`, pagadorEmail: cliente.email });
    const response = await submitForm({ baseUrl, path: `/admin/clientes/${cliente.id}?q=${encodeURIComponent("E2E vincular")}`, jar, formTestId: `form-vincular-${reserva.reservaId}`, fields: {} });
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(new URL(response.headers.get("location") as string, baseUrl).searchParams.get("aviso")).toBe("vinculada");
    const page = await fetch(new URL(`/admin/clientes/${cliente.id}?q=${encodeURIComponent("E2E vincular")}`, baseUrl), { headers: { Cookie: jar.header() } });
    const html = await page.text();
    expect(html).toContain(`data-testid="reserva-vinculada" data-reserva-id="${reserva.reservaId}"`);
    expect(html).not.toContain(`data-testid="reserva-huerfana" data-reserva-id="${reserva.reservaId}"`);
  });

  it("desvincula con un clic y la reserva vuelve a ser candidata", async () => {
    const reserva = await createReservaHuerfanaConContactoFixture({ adminId: admin.id, pagadorNombre: `E2E desvincular ${Date.now()}`, pagadorEmail: cliente.email });
    const supabase = await signInAs(admin);
    expect(await vincularReserva(supabase, { reservaId: reserva.reservaId, clienteId: cliente.id })).toEqual({ ok: true });
    const response = await submitForm({ baseUrl, path: `/admin/clientes/${cliente.id}`, jar, formTestId: `form-desvincular-${reserva.reservaId}`, fields: {} });
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(new URL(response.headers.get("location") as string, baseUrl).searchParams.get("aviso")).toBe("desvinculada");
    const page = await fetch(new URL(`/admin/clientes/${cliente.id}?q=${encodeURIComponent("E2E desvincular")}`, baseUrl), { headers: { Cookie: jar.header() } });
    const html = await page.text();
    expect(html).toContain(`data-testid="reserva-huerfana" data-reserva-id="${reserva.reservaId}"`);
    expect(html).not.toContain(`data-testid="reserva-vinculada" data-reserva-id="${reserva.reservaId}"`);
  });
});
