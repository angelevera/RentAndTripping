import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUsers,
  createPagoFixture,
  createReservaSinCuentaFixture,
  createTestUser,
  serviceClient,
  signInAs,
  sweepStaleTestUsers,
  TEST_PREFIX,
  type TestUser,
} from "../helpers/fixtures";
import { listarReservas } from "@/lib/reservas/listar";

// Fechas muy en el futuro para que R1/R2/R3 sean siempre las tres filas más
// nuevas de toda la tabla (created_at desc), sin importar qué más exista en
// esta base de datos compartida.
const CREATED_AT_R1 = "2099-01-03T00:00:00Z";

const CREATED_AT_R2 = "2099-01-02T00:00:00Z";

const CREATED_AT_R3 = "2099-01-01T00:00:00Z";

let admin: TestUser;

let cliente: TestUser;

let r1Id: string;

let r2Id: string;

let r3Id: string;

const paginasIds: string[] = [];

let porcentajeId: string;

let ceroId: string;

let filtroProblemaId: string;

let filtroHotelId: string;

let filtroCombinadoId: string;

beforeAll(async () => {
  await sweepStaleTestUsers();
  admin = await createTestUser("admin");
  cliente = await createTestUser("customer");

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

  for (let i = 1; i <= 21; i += 1) {
    const sufijo = String(i).padStart(2, "0");

    const resultado = await createReservaSinCuentaFixture({
      adminId: admin.id,
      pagadorNombre: `${TEST_PREFIX}-pag-${sufijo}`,
      createdAt: `2098-01-${String(i).padStart(2, "0")}T00:00:00Z`,
    });

    paginasIds.push(resultado.reservaId);
  }

  const porcentaje = await createReservaSinCuentaFixture({
    adminId: admin.id,
    pagadorNombre: `${TEST_PREFIX} desc 100%`,
  });

  porcentajeId = porcentaje.reservaId;
  const cero = await createReservaSinCuentaFixture({ adminId: admin.id, pagadorNombre: `${TEST_PREFIX} desc 1000` });
  ceroId = cero.reservaId;

  const problema = await createReservaSinCuentaFixture({
    adminId: admin.id, pagadorNombre: `${TEST_PREFIX} filtro problema`, estadoProveedor: "con_problema",
    notaProblema: "La aerolínea cambió el horario.",
  });

  filtroProblemaId = problema.reservaId;

  const hotel = await createReservaSinCuentaFixture({
    adminId: admin.id, pagadorNombre: `${TEST_PREFIX} filtro hotel`, tipo: "hotel",
  });

  filtroHotelId = hotel.reservaId;

  const combinado = await createReservaSinCuentaFixture({
    adminId: admin.id,
    pagadorNombre: `${TEST_PREFIX} filtro ambos`,
    estadoProveedor: "con_problema",
    notaProblema: "El hotel canceló la reserva.",
    tipo: "hotel",
  });

  filtroCombinadoId = combinado.reservaId;
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe("listarReservas", () => {
  it("el admin ve R1, R2, R3 como sus primeras tres filas, en ese orden, con pagado true/false/false", async () => {
    const clientAdmin = await signInAs(admin);

    const resultado = await listarReservas(clientAdmin, { pagina: 1 });

    expect(resultado.error).toBe(false);
    expect(resultado.total).toBeGreaterThanOrEqual(3);
    expect(resultado.filas.length).toBeLessThanOrEqual(20);
    expect(resultado.filas.slice(0, 3).map((f) => f.id)).toEqual([r1Id, r2Id, r3Id]);
    expect(resultado.filas.slice(0, 3).map((f) => f.pagado)).toEqual([true, false, false]);
  });

  it("un cliente firmado no ve ninguna de R1/R2/R3", async () => {
    const clientCustomer = await signInAs(cliente);

    const resultado = await listarReservas(clientCustomer, { pagina: 1 });

    expect(resultado.error).toBe(false);
    const idsVisibles = resultado.filas.map((f) => f.id);
    expect(idsVisibles).not.toContain(r1Id);
    expect(idsVisibles).not.toContain(r2Id);
    expect(idsVisibles).not.toContain(r3Id);
  });

  it("un cliente con una API key inválida recibe { error: true, filas: [] }", async () => {
    const clienteInvalido = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      "clave-invalida-para-esta-prueba",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const resultado = await listarReservas(clienteInvalido, { pagina: 1 });

    expect(resultado.error).toBe(true);
    expect(resultado.filas).toEqual([]);
  });

  it("busca por nombre sin distinguir mayúsculas y pagina/clampa resultados", async () => {
    const clientAdmin = await signInAs(admin);
    const q = `${TEST_PREFIX}-pag`;
    const primera = await listarReservas(clientAdmin, { pagina: 1, q });
    expect(primera.total).toBe(21);
    expect(primera.filas.map((f) => f.id)).toEqual(paginasIds.slice().reverse().slice(0, 20));
    expect(primera.totalPaginas).toBe(2);
    const segunda = await listarReservas(clientAdmin, { pagina: 2, q });
    expect(segunda.filas.map((f) => f.id)).toEqual([paginasIds[0]]);
    const fuera = await listarReservas(clientAdmin, { pagina: 99, q });
    expect(fuera.pagina).toBe(2);
    expect(fuera.filas.map((f) => f.id)).toEqual([paginasIds[0]]);
    expect((await listarReservas(clientAdmin, { pagina: 1, q: q.toUpperCase() })).total).toBe(21);
  });

  it("trata porcentaje como literal y combina estado/tipo con búsqueda", async () => {
    const clientAdmin = await signInAs(admin);
    const literal = await listarReservas(clientAdmin, { pagina: 1, q: "100%" });
    expect(literal.filas.map((f) => f.id)).toContain(porcentajeId);
    expect(literal.filas.map((f) => f.id)).not.toContain(ceroId);
    const estado = await listarReservas(clientAdmin, { pagina: 1, estado: "con_problema" });
    expect(estado.filas.map((f) => f.id)).toContain(filtroProblemaId);
    expect(estado.filas.map((f) => f.id)).not.toContain(filtroHotelId);
    const tipo = await listarReservas(clientAdmin, { pagina: 1, tipo: "hotel" });
    expect(tipo.filas.map((f) => f.id)).toContain(filtroHotelId);
    expect(tipo.filas.map((f) => f.id)).not.toContain(filtroProblemaId);

    const combinada = await listarReservas(clientAdmin, {
      pagina: 1, q: `${TEST_PREFIX} filtro`, estado: "con_problema", tipo: "hotel",
    });

    expect(combinada.filas.map((f) => f.id)).toEqual([filtroCombinadoId]);
  });
});

// Confirma con serviceClient que las tres filas realmente existen con los
// datos que la sección "populated"/"partial" del UI-SPEC espera de ellas —
// no es una prueba de listarReservas, sino de los fixtures que la respaldan.
describe("fixtures R1/R2/R3 (control)", () => {
  it("R1 tiene un pago confirmado de 350 USD y fecha_importante", async () => {
    const service = serviceClient();
    const { data } = await service.from("reservas").select("precio, moneda, fecha_importante").eq("id", r1Id).single();
    expect(data).toMatchObject({ precio: 350, moneda: "USD", fecha_importante: "2026-12-15" });
  });

  it("R3 es en VES y no tiene fecha_importante", async () => {
    const service = serviceClient();
    const { data } = await service.from("reservas").select("precio, moneda, fecha_importante").eq("id", r3Id).single();
    expect(data).toMatchObject({ precio: 5000, moneda: "VES", fecha_importante: null });
  });
});
