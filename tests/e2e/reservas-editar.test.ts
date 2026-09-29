import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  cleanupTestUsers,
  createPagoFixture,
  createReservaSinCuentaFixture,
  createTestUser,
  getFormHiddenInputs,
  loginJar,
  serviceClient,
  submitForm,
  sweepStaleTestUsers,
  TEST_PREFIX,
  type CookieJar,
  type TestUser,
} from "../helpers/fixtures";

const camposValidos = (nombre: string) => ({
  pagadorNombre: nombre,
  pagadorTelefono: "555-0100",
  pagadorEmail: "",
  esParaOtraPersona: "on",
  viajeroNombre: "Luis Pérez",
  viajeroTelefono: "555-0101",
  precio: "350",
  moneda: "USD",
  fechaImportante: "",
  estadoProveedor: "pendiente",
  notaProblema: "",
  "detalle.tipo": "pasaje",
  "detalle.aerolinea": "Laser",
  "detalle.origen": "CCS",
  "detalle.destino": "MIA",
  "detalle.fechaVuelo": "2026-12-15",
  "detalle.pnr": "ABC123",
  "detalle.cantidadPersonas": "1",
  "detalle.viajeros": "",
});

async function expectRedirectToAdmin(response: Response, baseUrl: string, aviso: string) {
  expect(response.status).toBeGreaterThanOrEqual(300);
  expect(response.status).toBeLessThan(400);
  const destino = new URL(response.headers.get("location")!, baseUrl);
  expect(destino.pathname).toBe("/admin");
  expect(destino.searchParams.get("aviso")).toBe(aviso);
}

async function cuerpoFinal(response: Response, jar: CookieJar, baseUrl: string) {
  if (response.status < 300 || response.status >= 400) return response.text();
  const location = response.headers.get("location");

  if (!location) return "";
  const final = await fetch(new URL(location, baseUrl), { headers: { Cookie: jar.header() } });

  return final.text();
}

function sinInputsOcultos(html: string) {
  return html.replace(/<input\b(?=[^>]*\btype="hidden")[^>]*>/gi, "");
}

describe("editar reserva", () => {
  let admin: TestUser;
  let customer: TestUser;
  let reservaId: string;
  let legadoId: string;
  let sinPagoId: string;
  let conPagoId: string;
  let problemaId: string;

  beforeAll(async () => {
    await sweepStaleTestUsers();
    admin = await createTestUser("admin");
    customer = await createTestUser("customer");

    const reserva = await createReservaSinCuentaFixture({
      adminId: admin.id,
      pagadorNombre: `${TEST_PREFIX} editar`,
      tipo: "pasaje",
      detalle: {
        tipo: "pasaje", aerolinea: "Laser", origen: "CCS", destino: "MIA",
        fechaVuelo: "2026-12-15", pnr: "ABC123", cantidadPersonas: 1, viajeros: [],
      },
      viajeroNombre: "Luis Pérez",
      viajeroTelefono: "555-0101",
      estadoProveedor: "confirmada",
    });

    reservaId = reserva.reservaId;
    await createPagoFixture({ reservaId, adminId: admin.id, estado: "confirmado", monto: 350 });
    const legado = await createReservaSinCuentaFixture({ adminId: admin.id, detalle: {} });
    legadoId = legado.reservaId;
    const sinPago = await createReservaSinCuentaFixture({ adminId: admin.id, estadoProveedor: "pendiente" });
    sinPagoId = sinPago.reservaId;
    const conPago = await createReservaSinCuentaFixture({ adminId: admin.id, estadoProveedor: "confirmada" });
    conPagoId = conPago.reservaId;
    await createPagoFixture({ reservaId: conPagoId, adminId: admin.id, estado: "confirmado", monto: 100 });
    const problema = await createReservaSinCuentaFixture({ adminId: admin.id, estadoProveedor: "pendiente" });
    problemaId = problema.reservaId;
  });

  afterAll(async () => cleanupTestUsers());

  it("carga el formulario con los datos guardados y lo protege", async () => {
    const baseUrl = inject("baseUrl");
    const adminJar = await loginJar({ baseUrl, user: admin });

    const response = await fetch(new URL(`/admin/reservas/${reservaId}/editar`, baseUrl), {
      headers: { Cookie: adminJar.header() },
    });

    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('data-testid="form-editar-reserva"');
    expect(body).toContain("Editar reserva");
    expect(body).toContain(`${TEST_PREFIX} editar`);
    expect(body).toContain("ABC123");

    const customerJar = await loginJar({ baseUrl, user: customer });

    const denied = await fetch(new URL(`/admin/reservas/${reservaId}/editar`, baseUrl), {
      headers: { Cookie: customerJar.header() }, redirect: "manual",
    });

    expect(new URL(denied.headers.get("location")!, baseUrl).pathname).toBe("/login");
  });

  it("edita los datos sin cambiar ownership, creación ni pagos", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const db = serviceClient();
    const { data: before } = await db.from("reservas").select("created_by, created_at, cliente_id").eq("id", reservaId).single();
    const { data: pagoAntes } = await db.from("pagos").select("*").eq("reserva_id", reservaId).single();

    const response = await submitForm({
      baseUrl, path: `/admin/reservas/${reservaId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: { ...camposValidos(`${TEST_PREFIX} editar`), pagadorTelefono: "555-9999", precio: "425", "detalle.pnr": "XYZ789" },
    });

    await expectRedirectToAdmin(response, baseUrl, "guardada");
    const { data: after } = await db.from("reservas").select("*").eq("id", reservaId).single();
    const { data: pagoDespues } = await db.from("pagos").select("*").eq("reserva_id", reservaId).single();
    expect(after).toMatchObject({ pagador_telefono: "555-9999", precio: 425, detalle: { pnr: "XYZ789" } });
    expect(after).toMatchObject({ created_by: before!.created_by, created_at: before!.created_at, cliente_id: before!.cliente_id });
    expect(pagoDespues).toEqual(pagoAntes);
  });

  it("reemplaza el detalle completo al cambiar tipo", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await submitForm({
      baseUrl, path: `/admin/reservas/${reservaId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: {
        ...camposValidos(`${TEST_PREFIX} editar`), "detalle.tipo": "hotel", "detalle.nombre": "Hotel Central",
        "detalle.checkIn": "2026-12-15", "detalle.checkOut": "2026-12-18",
      },
    });

    await expectRedirectToAdmin(response, baseUrl, "guardada");
    const { data } = await serviceClient().from("reservas").select("tipo, detalle").eq("id", reservaId).single();
    expect(data?.tipo).toBe("hotel");
    expect(data?.detalle).not.toHaveProperty("pnr");
  });

  it("muestra errores de validación y conserva la fila", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const { data: before } = await serviceClient().from("reservas").select("*").eq("id", reservaId).single();

    const response = await submitForm({
      baseUrl, path: `/admin/reservas/${reservaId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: { ...camposValidos(`${TEST_PREFIX} editar`), precio: "0" },
    });

    expect(await cuerpoFinal(response, jar, baseUrl)).toContain("El precio tiene que ser mayor a cero.");
    const { data: after } = await serviceClient().from("reservas").select("*").eq("id", reservaId).single();
    expect(after).toEqual(before);
  });

  it("devuelve 404 para UUID inexistente, id malformado y detalle legacy vacío", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const missing = await fetch(new URL("/admin/reservas/00000000-0000-4000-8000-000000000001/editar", baseUrl), { headers: { Cookie: jar.header() } });
    const malformed = await fetch(new URL("/admin/reservas/no-es-uuid/editar", baseUrl), { headers: { Cookie: jar.header() } });
    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(404);
    const legacy = await fetch(new URL(`/admin/reservas/${legadoId}/editar`, baseUrl), { headers: { Cookie: jar.header() } });
    expect(legacy.status).toBe(200);
    expect(await legacy.text()).toContain('data-testid="form-editar-reserva"');
  });

  it("ignora un POST sin sesión incluso con los hidden inputs válidos", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const path = `/admin/reservas/${reservaId}/editar`;
    const hidden = await getFormHiddenInputs({ baseUrl, path, jar, formTestId: "form-editar-reserva" });
    const anonForm = new FormData();
    Object.entries(hidden).forEach(([key, value]) => anonForm.append(key, value));
    Object.entries(camposValidos(`${TEST_PREFIX} anónimo`)).forEach(([key, value]) => anonForm.append(key, value));

    const response = await fetch(new URL(path, baseUrl), {
      method: "POST", body: anonForm, redirect: "manual", headers: { Origin: baseUrl },
    });

    expect(new URL(response.headers.get("location")!, baseUrl).pathname).toBe("/login");
    const { data } = await serviceClient().from("reservas").select("pagador_nombre").eq("id", reservaId).single();
    expect(data?.pagador_nombre).toBe(`${TEST_PREFIX} editar`);
  });

  it("marca confirmada sin pago y no crea pagos", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await submitForm({
      baseUrl, path: `/admin/reservas/${sinPagoId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: { ...camposValidos(`${TEST_PREFIX} estado-confirmada`), estadoProveedor: "confirmada" },
    });

    await expectRedirectToAdmin(response, baseUrl, "confirmada");
    const db = serviceClient();
    const { data } = await db.from("reservas").select("estado_proveedor").eq("id", sinPagoId).single();
    const { count } = await db.from("pagos").select("id", { count: "exact", head: true }).eq("reserva_id", sinPagoId);
    expect(data?.estado_proveedor).toBe("confirmada");
    expect(count).toBe(0);
  });

  it("rechaza una edición sin estado de proveedor y deja la reserva intacta", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const { data: before } = await serviceClient().from("reservas").select("*").eq("id", sinPagoId).single();
    const fields = camposValidos(`${TEST_PREFIX} sin-estado`);
    Reflect.deleteProperty(fields, "estadoProveedor");
    Reflect.deleteProperty(fields, "notaProblema");

    const response = await submitForm({
      baseUrl, path: `/admin/reservas/${sinPagoId}/editar`, jar, formTestId: "form-editar-reserva", fields,
    });

    expect(await cuerpoFinal(response, jar, baseUrl)).toContain("Invalid option");
    const { data: after } = await serviceClient().from("reservas").select("*").eq("id", sinPagoId).single();
    expect(after).toEqual(before);
  });

  it("vuelve a pendiente sin cambiar el pago existente", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const db = serviceClient();
    const { data: pagoAntes } = await db.from("pagos").select("estado, monto, moneda").eq("reserva_id", conPagoId).single();

    const response = await submitForm({
      baseUrl, path: `/admin/reservas/${conPagoId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: { ...camposValidos(`${TEST_PREFIX} estado-pendiente`), estadoProveedor: "pendiente" },
    });

    await expectRedirectToAdmin(response, baseUrl, "guardada");
    const { data } = await db.from("reservas").select("estado_proveedor").eq("id", conPagoId).single();
    const { data: pagoDespues } = await db.from("pagos").select("estado, monto, moneda").eq("reserva_id", conPagoId).single();
    expect(data?.estado_proveedor).toBe("pendiente");
    expect(pagoDespues).toEqual(pagoAntes);
  });

  it("rechaza con problema sin nota y no cambia la reserva", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });
    const db = serviceClient();
    const { data: before } = await db.from("reservas").select("*").eq("id", conPagoId).single();

    const response = await submitForm({
      baseUrl, path: `/admin/reservas/${conPagoId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: { ...camposValidos(`${TEST_PREFIX} estado-pendiente`), estadoProveedor: "con_problema", notaProblema: "   " },
    });

    const html = sinInputsOcultos(await cuerpoFinal(response, jar, baseUrl));
    expect(html).toContain('data-slot="field-error"');
    expect(html).toContain(
      "Para marcar la reserva como 'con problema' hace falta explicar qué pasó, así no se te olvida el detalle después.",
    );
    const { data: after } = await db.from("reservas").select("*").eq("id", conPagoId).single();
    expect(after).toEqual(before);
  });

  it("guarda el motivo del problema con el aviso correspondiente", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await submitForm({
      baseUrl, path: `/admin/reservas/${problemaId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: { ...camposValidos(`${TEST_PREFIX} problema`), estadoProveedor: "con_problema", notaProblema: "La aerolínea cambió el horario" },
    });

    await expectRedirectToAdmin(response, baseUrl, "problema");
    const { data } = await serviceClient().from("reservas").select("estado_proveedor, nota_problema").eq("id", problemaId).single();
    expect(data).toEqual({ estado_proveedor: "con_problema", nota_problema: "La aerolínea cambió el horario" });
  });

  it("borra la nota al cambiar de estado", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const marcado = await submitForm({
      baseUrl, path: `/admin/reservas/${problemaId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: { ...camposValidos(`${TEST_PREFIX} problema`), estadoProveedor: "con_problema", notaProblema: "La aerolínea cambió el horario" },
    });

    await expectRedirectToAdmin(marcado, baseUrl, "guardada");

    const confirmado = await submitForm({
      baseUrl, path: `/admin/reservas/${problemaId}/editar`, jar, formTestId: "form-editar-reserva",
      fields: { ...camposValidos(`${TEST_PREFIX} problema`), estadoProveedor: "confirmada", notaProblema: "La aerolínea cambió el horario" },
    });

    await expectRedirectToAdmin(confirmado, baseUrl, "confirmada");
    const { data } = await serviceClient().from("reservas").select("estado_proveedor, nota_problema").eq("id", problemaId).single();
    expect(data).toEqual({ estado_proveedor: "confirmada", nota_problema: null });
  });
});
