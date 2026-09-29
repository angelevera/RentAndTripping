import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import {
  cleanupTestUsers,
  createPagoFixture,
  createReservaSinCuentaFixture,
  createTestUser,
  loginJar,
  sweepStaleTestUsers,
  type TestUser,
} from "../helpers/fixtures";

// Fechas muy en el futuro para que R1/R2/R3 sean siempre las tres filas más
// nuevas de toda la lista (created_at desc), sin importar qué más exista en
// esta base de datos compartida.
const CREATED_AT_R1 = "2099-02-03T00:00:00Z";

const CREATED_AT_R2 = "2099-02-02T00:00:00Z";

const CREATED_AT_R3 = "2099-02-01T00:00:00Z";

const COLUMNAS = [
  "Estado proveedor",
  "Estado pago",
  "Cliente",
  "Tipo",
  "Fecha importante",
  "Monto (USD)",
];

/**
 * Corta el HTML entre el atributo `data-reserva-id="{id}"` dado y el
 * siguiente `data-testid="fila-reserva"` (o el final del documento si es la
 * última fila) — el mismo fragmento por fila que usa 02-01 para comparar
 * ids en vez de contar filas de una tabla compartida.
 */
function fragmentoDeFila(html: string, id: string): string {
  const marcador = `data-reserva-id="${id}"`;
  const inicio = html.indexOf(marcador);

  if (inicio === -1) {
    throw new Error(`No se encontró ${marcador} en la respuesta de /admin`);
  }

  const siguienteFila = html.indexOf('data-testid="fila-reserva"', inicio + marcador.length);

  return siguienteFila === -1 ? html.slice(inicio) : html.slice(inicio, siguienteFila);
}

describe("lista de reservas en /admin", () => {
  let admin: TestUser;
  let r1Id: string;
  let r2Id: string;
  let r3Id: string;

  beforeAll(async () => {
    await sweepStaleTestUsers();
    admin = await createTestUser("admin");

    const r1 = await createReservaSinCuentaFixture({
      adminId: admin.id,
      estadoProveedor: "confirmada",
      precio: 350,
      moneda: "USD",
      fechaImportante: "2026-12-15",
      createdAt: CREATED_AT_R1,
    });

    r1Id = r1.reservaId;

    await createPagoFixture({ reservaId: r1Id, adminId: admin.id, estado: "confirmado", monto: 350 });

    const r2 = await createReservaSinCuentaFixture({
      adminId: admin.id,
      estadoProveedor: "con_problema",
      notaProblema: "El vuelo se retrasó.",
      createdAt: CREATED_AT_R2,
    });

    r2Id = r2.reservaId;

    await createPagoFixture({ reservaId: r2Id, adminId: admin.id, estado: "pendiente_revision" });

    const r3 = await createReservaSinCuentaFixture({
      adminId: admin.id,
      precio: 5000,
      moneda: "VES",
      createdAt: CREATED_AT_R3,
    });

    r3Id = r3.reservaId;
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("200 con el panel, el contrato de Fase 1 y las seis columnas", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await fetch(new URL("/admin", baseUrl), { headers: { Cookie: jar.header() } });
    expect(response.status).toBe(200);

    const html = await response.text();

    expect(html).toContain('data-testid="panel-admin"');
    expect(html).toContain(admin.email);
    expect(html).toContain("form-cerrar-sesion");
    expect(html).toContain("Reservas");

    for (const columna of COLUMNAS) {
      expect(html).toContain(columna);
    }
  });

  it("R1 aparece antes que R2, y R2 antes que R3", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await fetch(new URL("/admin", baseUrl), { headers: { Cookie: jar.header() } });

    const html = await response.text();

    const indiceR1 = html.indexOf(`data-reserva-id="${r1Id}"`);

    const indiceR2 = html.indexOf(`data-reserva-id="${r2Id}"`);

    const indiceR3 = html.indexOf(`data-reserva-id="${r3Id}"`);

    expect(indiceR1).toBeGreaterThanOrEqual(0);
    expect(indiceR2).toBeGreaterThan(indiceR1);
    expect(indiceR3).toBeGreaterThan(indiceR2);
  });

  it("R1: confirmada, pagada y con la fecha en dd/mm/yyyy", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await fetch(new URL("/admin", baseUrl), { headers: { Cookie: jar.header() } });

    const html = await response.text();

    const fragmento = fragmentoDeFila(html, r1Id);

    expect(fragmento).toContain("Confirmada con el proveedor");
    expect(fragmento).toContain("Pagado");
    expect(fragmento).toContain("15/12/2026");
  });

  it("R2: con problema", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await fetch(new URL("/admin", baseUrl), { headers: { Cookie: jar.header() } });

    const html = await response.text();

    const fragmento = fragmentoDeFila(html, r2Id);

    expect(fragmento).toContain("Con problema");
  });

  it("R3: en bolívares, sin monto convertido y sin fecha_importante", async () => {
    const baseUrl = inject("baseUrl");
    const jar = await loginJar({ baseUrl, user: admin });

    const response = await fetch(new URL("/admin", baseUrl), { headers: { Cookie: jar.header() } });

    const html = await response.text();

    const fragmento = fragmentoDeFila(html, r3Id);

    expect(fragmento).toContain("En Bs · ver detalle");
    expect(fragmento).toContain("—");
    expect(fragmento).not.toContain("5000");
    expect(fragmento).not.toContain("5.000");
  });
});
