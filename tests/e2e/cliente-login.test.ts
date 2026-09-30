import { beforeAll, afterAll, describe, expect, inject, it } from "vitest";
import {
  CookieJar,
  createTestUser,
  createReservaFixture,
  createPagoFixture,
  cleanupTestUsers,
  sweepStaleTestUsers,
  serviceClient,
  loginJar,
  submitForm,
  TEST_PREFIX,
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

interface ReservaClienteFixtureParams {
  clienteId: string;
  adminId: string;
  estadoProveedor?: "pendiente" | "confirmada" | "con_problema";
  fechaImportante?: string;
  viajeroNombre?: string;
  pagoEstado?: "pendiente_revision" | "confirmado";
  notaProblema?: string;
  moneda?: "USD" | "VES";
  precio?: number;
}

interface FilaReservaClienteInsert {
  tipo: string;
  precio: number;
  moneda: string;
  pagador_nombre: string;
  pagador_telefono: string;
  cliente_id: string;
  created_by: string;
  estado_proveedor?: string;
  fecha_importante?: string;
  viajero_nombre?: string;
  nota_problema?: string;
}

async function crearReservaClienteFixture({
  clienteId,
  adminId,
  estadoProveedor,
  fechaImportante,
  viajeroNombre,
  pagoEstado,
  notaProblema,
  moneda = "USD",
  precio = 100,
}: ReservaClienteFixtureParams): Promise<string> {
  const admin = serviceClient();

  const fila: FilaReservaClienteInsert = {
    tipo: "tour",
    precio,
    moneda,
    pagador_nombre: `${TEST_PREFIX} cliente`,
    pagador_telefono: "0000-0000000",
    cliente_id: clienteId,
    created_by: adminId,
  };

  if (estadoProveedor !== undefined) fila.estado_proveedor = estadoProveedor;

  if (fechaImportante !== undefined) fila.fecha_importante = fechaImportante;

  if (viajeroNombre !== undefined) fila.viajero_nombre = viajeroNombre;

  if (notaProblema !== undefined) fila.nota_problema = notaProblema;

  const { data, error } = await admin.from("reservas").insert(fila).select("id").single();

  if (error || !data) throw new Error(`No se pudo crear la reserva de cliente: ${error?.message}`);

  if (pagoEstado !== undefined) {
    await createPagoFixture({ reservaId: data.id, adminId, estado: pagoEstado });
  }

  return data.id;
}

describe("cliente login (/login -> /cliente, cierre de WR-01)", () => {
  let admin: TestUser;
  let clienteConReserva: TestUser;
  let clienteSinReserva: TestUser;
  let reservaTrazadoraId: string;
  let reservaConfirmadaId: string;
  let reservaViajeroId: string;
  let reservaPasadaId: string;

  beforeAll(async () => {
    await sweepStaleTestUsers();
    admin = await createTestUser("admin");
    clienteConReserva = await createTestUser("customer");
    ({ reservaId: reservaTrazadoraId } = await createReservaFixture({
      clienteId: clienteConReserva.id,
      adminId: admin.id,
    }));
    reservaConfirmadaId = await crearReservaClienteFixture({
      clienteId: clienteConReserva.id, adminId: admin.id, estadoProveedor: "confirmada",
      pagoEstado: "confirmado", fechaImportante: "2099-06-01",
    });
    reservaViajeroId = await crearReservaClienteFixture({
      clienteId: clienteConReserva.id, adminId: admin.id, viajeroNombre: `${TEST_PREFIX} viajero`,
    });
    reservaPasadaId = await crearReservaClienteFixture({
      clienteId: clienteConReserva.id, adminId: admin.id, fechaImportante: "2020-01-01",
    });
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
    expect(body).toContain('data-testid="whatsapp-cta-flotante"');
    expect(body).toContain(encodeURIComponent("Hola, quiero pedir una cotización para un nuevo viaje"));
    // "Tour" (capitalizado): desde 03-02 el tipo se muestra vía la etiqueta
    // traducida (etiquetaDesde/ETIQUETAS_TIPO), no el valor crudo de la BD.
    expect(body).toContain("Tour");
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

  it("shows the undated pending reservation under Próximas with two separate pending badges", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: clienteConReserva });
    const body = await (await fetch(new URL("/cliente", baseUrl), { headers: { Cookie: jar.header() } })).text();

    expect(body).toContain("Próximas");
    const fragmento = fragmentoDeReservaCliente(body, reservaTrazadoraId);
    expect(fragmento.match(/Pendiente/g)).toHaveLength(2);
    expect(fragmento).not.toContain("Para:");
  });

  it("shows provider and payment status separately for a confirmed paid reservation", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: clienteConReserva });
    const body = await (await fetch(new URL("/cliente", baseUrl), { headers: { Cookie: jar.header() } })).text();
    const fragmento = fragmentoDeReservaCliente(body, reservaConfirmadaId);

    expect(fragmento).toContain("Confirmada con el proveedor");
    expect(fragmento).toContain("Pagado");
  });

  it("shows Para with the traveler's name", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: clienteConReserva });
    const body = await (await fetch(new URL("/cliente", baseUrl), { headers: { Cookie: jar.header() } })).text();

    expect(fragmentoDeReservaCliente(body, reservaViajeroId)).toContain(`Para: ${TEST_PREFIX} viajero`);
  });

  it("places a past reservation under Historial", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: clienteConReserva });
    const body = await (await fetch(new URL("/cliente", baseUrl), { headers: { Cookie: jar.header() } })).text();
    const indiceHistorial = body.indexOf("Historial");

    expect(indiceHistorial).toBeGreaterThanOrEqual(0);
    expect(body.indexOf(`data-reserva-id="${reservaPasadaId}"`)).toBeGreaterThan(indiceHistorial);
  });

  it("shows the branded empty state with the isolated WhatsApp CTA", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: clienteSinReserva });
    const body = await (await fetch(new URL("/cliente", baseUrl), { headers: { Cookie: jar.header() } })).text();

    expect(body).toContain("¿Para dónde vamos ahora?");
    expect(body).not.toContain("Próximas");
    expect(body).not.toContain("Historial");
    expect(body).toContain('data-testid="whatsapp-cta"');
    expect(body).not.toContain("whatsapp-cta-flotante");
    expect(body).toContain("wa.me/");
    expect(body).toContain(encodeURIComponent("Hola, quiero planificar un viaje"));
  });

  it("lets the customer sign out from their own panel", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: clienteConReserva });
    const response = await submitForm({ baseUrl, path: "/cliente", jar, formTestId: "form-cerrar-sesion", fields: {} });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(new URL(response.headers.get("location")!, baseUrl).pathname).toBe("/login");
  });

  it("shows a VES reservation's actual formatted amount without a detail link", async () => {
    const vesId = await crearReservaClienteFixture({
      clienteId: clienteConReserva.id, adminId: admin.id, moneda: "VES", precio: 5000,
    });

    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: clienteConReserva });
    const body = await (await fetch(new URL("/cliente", baseUrl), { headers: { Cookie: jar.header() } })).text();
    const fragmento = fragmentoDeReservaCliente(body, vesId);
    const monto = new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES" }).format(5000);

    expect(fragmento).toContain(monto);
    expect(fragmento).not.toContain("ver detalle");
  });

  it("never includes the provider's internal problem note in the client page", async () => {
    const nota = `${TEST_PREFIX} nota interna confidencial`;
    await crearReservaClienteFixture({
      clienteId: clienteConReserva.id, adminId: admin.id,
      estadoProveedor: "con_problema", notaProblema: nota,
    });
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: clienteConReserva });
    const body = await (await fetch(new URL("/cliente", baseUrl), { headers: { Cookie: jar.header() } })).text();

    expect(body).not.toContain(nota);
  });
});

function fragmentoDeReservaCliente(html: string, id: string): string {
  const marker = `data-reserva-id="${id}"`;
  const start = html.indexOf(marker);

  if (start === -1) throw new Error(`No se encontró ${marker} en /cliente`);

  const next = html.indexOf('data-testid="reserva-cliente"', start + marker.length);

  return next === -1 ? html.slice(start) : html.slice(start, next);
}
