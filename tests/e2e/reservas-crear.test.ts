import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  cleanupTestUsers,
  createTestUser,
  getFormHiddenInputs,
  loginJar,
  serviceClient,
  submitForm,
  sweepStaleTestUsers,
  TEST_PREFIX,
  CookieJar,
  type TestUser,
} from "../helpers/fixtures";

async function finalBody(response: Response, jar: CookieJar, baseUrl: string): Promise<string> {
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");

    if (!location) return "";

    const followUp = await fetch(new URL(location, baseUrl), {
      headers: jar.header() ? { Cookie: jar.header() } : undefined,
    });

    jar.applySetCookie(followUp.headers.getSetCookie());

    return followUp.text();
  }

  return response.text();
}

const camposPasaje = (pagadorNombre: string) => ({
  pagadorNombre,
  pagadorTelefono: "0414-0000000",
  pagadorEmail: "",
  "detalle.tipo": "pasaje",
  "detalle.aerolinea": "Laser",
  "detalle.origen": "CCS",
  "detalle.destino": "MIA",
  "detalle.fechaVuelo": "2026-12-15",
  "detalle.pnr": "ABC123",
  precio: "350",
  moneda: "USD",
  fechaImportante: "",
});

describe("crear reserva pasaje sin cuenta", () => {
  let admin: TestUser;
  let customer: TestUser;

  beforeAll(async () => {
    await sweepStaleTestUsers();
    admin = await createTestUser("admin");
    customer = await createTestUser("customer");
  });

  afterAll(async () => cleanupTestUsers());

  it("permite que el admin abra el formulario y redirige al anónimo al login", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await fetch(new URL("/admin/reservas/nueva", baseUrl), {
      headers: { Cookie: jar.header() },
      redirect: "manual",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('data-testid="form-crear-reserva"');

    const anonymous = await fetch(new URL("/admin/reservas/nueva", baseUrl), { redirect: "manual" });
    expect(anonymous.status).toBeGreaterThanOrEqual(300);
    expect(new URL(anonymous.headers.get("location")!, baseUrl).pathname).toBe("/login");
  });

  it("guarda un pasaje sin cuenta con los campos y valores esperados y lo lista en /admin", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} pasaje`;

    const response = await submitForm({
      baseUrl, path: "/admin/reservas/nueva", jar, formTestId: "form-crear-reserva",
      fields: camposPasaje(nombre),
    });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(new URL(response.headers.get("location")!, baseUrl).pathname).toBe("/admin");

    const db = serviceClient();
    const { data, error } = await db.from("reservas").select("*").eq("pagador_nombre", nombre);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      cliente_id: null, created_by: admin.id, tipo: "pasaje", precio: 350, moneda: "USD",
      estado_proveedor: "pendiente", fecha_importante: null,
      detalle: { tipo: "pasaje", aerolinea: "Laser", origen: "CCS", destino: "MIA", fechaVuelo: "2026-12-15", pnr: "ABC123" },
    });

    const listado = await fetch(new URL("/admin", baseUrl), { headers: { Cookie: jar.header() } });
    expect(await listado.text()).toContain(nombre);
  });

  it("rechaza un PNR vacío sin crear una fila", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} pnr-vacio`;

    const response = await submitForm({
      baseUrl, path: "/admin/reservas/nueva", jar, formTestId: "form-crear-reserva",
      fields: { ...camposPasaje(nombre), "detalle.pnr": "" },
    });

    expect(await finalBody(response, jar, baseUrl)).toContain(
      "Falta el número de reserva de la aerolínea (PNR). Anótalo tal como te lo dio la aerolínea.",
    );
    const { data } = await serviceClient().from("reservas").select("id").eq("pagador_nombre", nombre);
    expect(data).toHaveLength(0);
  });

  it("rechaza precio cero sin crear una fila", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} precio-cero`;

    const response = await submitForm({
      baseUrl, path: "/admin/reservas/nueva", jar, formTestId: "form-crear-reserva",
      fields: { ...camposPasaje(nombre), precio: "0" },
    });

    expect(await finalBody(response, jar, baseUrl)).toContain("El precio tiene que ser mayor a cero.");
    const { data } = await serviceClient().from("reservas").select("id").eq("pagador_nombre", nombre);
    expect(data).toHaveLength(0);
  });

  it("rechaza el POST sin cookies y el POST autenticado como cliente", async () => {
    const baseUrl = inject("baseUrl");
    const adminJar = await loginJar({ baseUrl, user: admin });

    const hidden = await getFormHiddenInputs({
      baseUrl, path: "/admin/reservas/nueva", jar: adminJar, formTestId: "form-crear-reserva",
    });

    const nombreAnonimo = `${TEST_PREFIX} post-anonimo`;
    const anonForm = new FormData();
    Object.entries(hidden).forEach(([key, value]) => anonForm.append(key, value));
    Object.entries(camposPasaje(nombreAnonimo)).forEach(([key, value]) => anonForm.append(key, value));

    const anonResponse = await fetch(new URL("/admin/reservas/nueva", baseUrl), {
      method: "POST", body: anonForm, redirect: "manual", headers: { Origin: baseUrl },
    });

    expect(anonResponse.status).toBeGreaterThanOrEqual(300);
    expect(new URL(anonResponse.headers.get("location")!, baseUrl).pathname).toBe("/login");

    const customerJar = await loginJar({ baseUrl, user: customer });
    const nombreCliente = `${TEST_PREFIX} post-cliente`;
    const customerForm = new FormData();
    Object.entries(hidden).forEach(([key, value]) => customerForm.append(key, value));
    Object.entries(camposPasaje(nombreCliente)).forEach(([key, value]) => customerForm.append(key, value));

    const customerResponse = await fetch(new URL("/admin/reservas/nueva", baseUrl), {
      method: "POST", body: customerForm, redirect: "manual",
      headers: { Origin: baseUrl, Cookie: customerJar.header() },
    });

    expect(customerResponse.status).toBeGreaterThanOrEqual(300);
    expect(new URL(customerResponse.headers.get("location")!, baseUrl).pathname).toBe("/login");
    const { data } = await serviceClient().from("reservas").select("id").in("pagador_nombre", [nombreAnonimo, nombreCliente]);
    expect(data).toHaveLength(0);
  });
});
