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

const camposBase = (pagadorNombre: string) => ({
  pagadorNombre,
  pagadorTelefono: "0414-0000000",
  pagadorEmail: "",
  precio: "350",
  moneda: "USD",
  fechaImportante: "",
});

const camposPasaje = (pagadorNombre: string) => ({
  ...camposBase(pagadorNombre),
  "detalle.tipo": "pasaje",
  "detalle.aerolinea": "Laser",
  "detalle.origen": "CCS",
  "detalle.destino": "MIA",
  "detalle.fechaVuelo": "2026-12-15",
  "detalle.pnr": "ABC123",
});

async function crearYConsultar({
  baseUrl,
  jar,
  nombre,
  fields,
}: {
  baseUrl: string;
  jar: CookieJar;
  nombre: string;
  fields: Record<string, string>;
}) {
  const response = await submitForm({
    baseUrl,
    path: "/admin/reservas/nueva",
    jar,
    formTestId: "form-crear-reserva",
    fields,
  });

  expect(response.status).toBeGreaterThanOrEqual(300);
  expect(response.status).toBeLessThan(400);

  const db = serviceClient();
  const { data, error } = await db.from("reservas").select("*").eq("pagador_nombre", nombre).single();
  expect(error).toBeNull();
  expect(data).not.toBeNull();

  const { count, error: pagosError } = await db
    .from("pagos")
    .select("id", { count: "exact", head: true })
    .eq("reserva_id", data!.id);

  expect(pagosError).toBeNull();
  expect(count).toBe(0);

  return { reserva: data!, response };
}

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

    const { reserva, response } = await crearYConsultar({ baseUrl, jar, nombre, fields: camposPasaje(nombre) });
    expect(reserva).toMatchObject({
      cliente_id: null, created_by: admin.id, tipo: "pasaje", precio: 350, moneda: "USD",
      estado_proveedor: "pendiente", fecha_importante: null,
      detalle: { tipo: "pasaje", aerolinea: "Laser", origen: "CCS", destino: "MIA", fechaVuelo: "2026-12-15", pnr: "ABC123", cantidadPersonas: 1, viajeros: [] },
    });
    expect(new URL(response.headers.get("location")!, baseUrl).pathname).toBe("/admin");

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

  it("guarda un hotel con fechas y nota", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} hotel`;

    const { reserva } = await crearYConsultar({
      baseUrl, jar, nombre,
      fields: {
        ...camposBase(nombre),
        "detalle.tipo": "hotel",
        "detalle.nombre": "Hotel Central",
        "detalle.checkIn": "2026-12-15",
        "detalle.checkOut": "2026-12-18",
        "detalle.nota": "Habitación con desayuno",
      },
    });

    expect(reserva).toMatchObject({
      tipo: "hotel",
      detalle: {
        tipo: "hotel", nombre: "Hotel Central", checkIn: "2026-12-15",
        checkOut: "2026-12-18", nota: "Habitación con desayuno",
      },
    });
  });

  it("guarda un tour", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} tour`;

    const { reserva } = await crearYConsultar({
      baseUrl, jar, nombre,
      fields: {
        ...camposBase(nombre),
        "detalle.tipo": "tour",
        "detalle.nombre": "City tour",
        "detalle.fecha": "2026-12-15",
      },
    });

    expect(reserva).toMatchObject({ tipo: "tour", detalle: { tipo: "tour", nombre: "City tour", fecha: "2026-12-15" } });
  });

  it("guarda una entrada", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} entrada`;

    const { reserva } = await crearYConsultar({
      baseUrl, jar, nombre,
      fields: {
        ...camposBase(nombre),
        "detalle.tipo": "entrada",
        "detalle.evento": "Concierto",
        "detalle.fecha": "2026-12-15",
      },
    });

    expect(reserva).toMatchObject({ tipo: "entrada", detalle: { tipo: "entrada", evento: "Concierto", fecha: "2026-12-15" } });
  });

  it("guarda las columnas del viajero cuando la reserva es para otra persona", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} otro-viajero`;

    const { reserva } = await crearYConsultar({
      baseUrl, jar, nombre,
      fields: {
        ...camposPasaje(nombre),
        esParaOtraPersona: "on",
        viajeroNombre: "Luis Pérez",
        viajeroTelefono: "0414-1111111",
      },
    });

    expect(reserva).toMatchObject({ viajero_nombre: "Luis Pérez", viajero_telefono: "0414-1111111" });
  });

  it("rechaza un viajero sin teléfono sin crear una reserva", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} viajero-sin-telefono`;

    const response = await submitForm({
      baseUrl, path: "/admin/reservas/nueva", jar, formTestId: "form-crear-reserva",
      fields: { ...camposPasaje(nombre), esParaOtraPersona: "on", viajeroNombre: "Luis", viajeroTelefono: "" },
    });

    expect(await finalBody(response, jar, baseUrl)).toContain("Escribe el teléfono del viajero.");
    const { data } = await serviceClient().from("reservas").select("id").eq("pagador_nombre", nombre);
    expect(data).toHaveLength(0);
  });

  it("guarda la cantidad y lista simple de viajeros del grupo", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} grupo`;

    const { reserva } = await crearYConsultar({
      baseUrl, jar, nombre,
      fields: { ...camposPasaje(nombre), "detalle.cantidadPersonas": "2", "detalle.viajeros": "Ana\nLuis" },
    });

    expect(reserva.detalle).toMatchObject({ cantidadPersonas: 2, viajeros: ["Ana", "Luis"] });
  });

  it("guarda precio VES con coma decimal como número", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} ves-coma`;

    const { reserva } = await crearYConsultar({
      baseUrl, jar, nombre,
      fields: { ...camposPasaje(nombre), precio: "1500,50", moneda: "VES" },
    });

    expect(reserva).toMatchObject({ precio: 1500.5, moneda: "VES" });
  });

  it("elimina del detalle los campos de otro tipo enviados por el cliente", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} hotel-con-pnr-ajeno`;

    const { reserva } = await crearYConsultar({
      baseUrl, jar, nombre,
      fields: {
        ...camposBase(nombre),
        "detalle.tipo": "hotel",
        "detalle.nombre": "Hotel Central",
        "detalle.checkIn": "2026-12-15",
        "detalle.checkOut": "2026-12-18",
        "detalle.pnr": "X",
      },
    });

    expect(reserva.detalle).not.toHaveProperty("pnr");
  });

  it("rechaza un tipo de reserva desconocido sin crear una fila", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} tipo-desconocido`;

    const response = await submitForm({
      baseUrl, path: "/admin/reservas/nueva", jar, formTestId: "form-crear-reserva",
      fields: { ...camposPasaje(nombre), "detalle.tipo": "crucero" },
    });

    expect(await finalBody(response, jar, baseUrl)).toContain("Invalid discriminator value");
    const { data } = await serviceClient().from("reservas").select("id").eq("pagador_nombre", nombre);
    expect(data).toHaveLength(0);
  });

  it("no guarda el viajero si se envía su nombre sin marcar la casilla", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const nombre = `${TEST_PREFIX} viajero-ignorado`;

    const { reserva } = await crearYConsultar({
      baseUrl, jar, nombre,
      fields: { ...camposPasaje(nombre), viajeroNombre: "No debe guardarse", viajeroTelefono: "0414-1111111" },
    });

    expect(reserva).toMatchObject({ viajero_nombre: null, viajero_telefono: null });
  });
});
