import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestUsers, createPagoFixture, createReservaFixture, createTestUser, signInAs, sweepStaleTestUsers, type TestUser } from "../helpers/fixtures";
import { listarReservasDeCliente } from "@/lib/clientes/detalle";

let admin: TestUser;
let clienteA: TestUser;
let clienteB: TestUser;

beforeAll(async () => {
  await sweepStaleTestUsers();
  admin = await createTestUser("admin");
  clienteA = await createTestUser("customer");
  clienteB = await createTestUser("customer");
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe("historial de reservas por cliente", () => {
  it("deriva pagado de pagos confirmados", async () => {
    const reserva = await createReservaFixture({ clienteId: clienteA.id, adminId: admin.id });
    await createPagoFixture({ reservaId: reserva.reservaId, adminId: admin.id, estado: "confirmado" });
    const supabase = await signInAs(admin);

    const resultado = await listarReservasDeCliente(supabase, { clienteId: clienteA.id });
    expect(resultado.error).toBe(false);
    expect(resultado.filas).toContainEqual(expect.objectContaining({ id: reserva.reservaId, pagado: true }));
  });

  it("no devuelve reservas de otro cliente ni reservas huérfanas", async () => {
    // clienteA ya acumula una reserva del caso anterior; uno nuevo aísla este.
    const clienteC = await createTestUser("customer");
    const propia = await createReservaFixture({ clienteId: clienteC.id, adminId: admin.id });
    await createReservaFixture({ clienteId: clienteB.id, adminId: admin.id });
    const supabase = await signInAs(admin);

    const resultado = await listarReservasDeCliente(supabase, { clienteId: clienteC.id });
    expect(resultado.error).toBe(false);
    expect(resultado.filas.map((fila) => fila.id)).toEqual([propia.reservaId]);
  });
});
