import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminConEnvioSimulado,
  cleanupTestUsers,
  createReservaHuerfanaConContactoFixture,
  createTestUser,
  serviceClient,
  signInAs,
  sweepStaleTestUsers,
  trackTestUserId,
  type TestUser,
} from "../helpers/fixtures";
import {
  buscarCoincidenciaExacta,
  buscarReservasHuerfanas,
  desvincularReserva,
  vincularReserva,
} from "@/lib/clientes/vincular";
import { invitarCliente } from "@/lib/clientes/invitar";

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

describe("vinculación de reservas huérfanas", () => {
  it("auto-vincula solo una coincidencia exacta de correo", async () => {
    const reserva = await createReservaHuerfanaConContactoFixture({
      adminId: admin.id,
      pagadorNombre: "María Exacta",
      pagadorEmail: `${admin.id}@example.com`,
    });

    const supabase = await signInAs(admin);

    expect(await buscarCoincidenciaExacta(supabase, { email: reserva.pagadorEmail })).toEqual({
      id: reserva.reservaId,
    });
    expect(
      await buscarCoincidenciaExacta(supabase, { email: `x${reserva.pagadorEmail}` }),
    ).toBeNull();
  });

  it("busca candidatas por nombre, correo o teléfono sin vincularlas", async () => {
    const reserva = await createReservaHuerfanaConContactoFixture({
      adminId: admin.id,
      pagadorNombre: "Contacto Buscable",
      pagadorEmail: `${clienteA.id}@example.com`,
      pagadorTelefono: "+1-555-0137",
    });

    const supabase = await signInAs(admin);

    for (const q of ["Buscable", `${clienteA.id}@example.com`, "555-0137"]) {
      const resultado = await buscarReservasHuerfanas(supabase, { q });

      expect(resultado.error).toBe(false);
      expect(resultado.filas.map((fila) => fila.id)).toContain(reserva.reservaId);
    }

    const { data } = await serviceClient()
      .from("reservas")
      .select("cliente_id")
      .eq("id", reserva.reservaId)
      .single();

    expect(data?.cliente_id).toBeNull();
  });

  it("busca sin romperse cuando el término trae coma o paréntesis (gramática de .or())", async () => {
    const reserva = await createReservaHuerfanaConContactoFixture({
      adminId: admin.id,
      pagadorNombre: "García, Luis",
      pagadorEmail: `${clienteA.id}-comillas@example.com`,
      pagadorTelefono: "(0414) 555-0199",
    });

    const supabase = await signInAs(admin);

    for (const q of ["García, Luis", "(0414) 555-0199"]) {
      const resultado = await buscarReservasHuerfanas(supabase, { q });

      expect(resultado.error).toBe(false);
      expect(resultado.filas.map((fila) => fila.id)).toContain(reserva.reservaId);
    }
  });

  it("vincula una reserva huérfana y rechaza pisar un vínculo existente", async () => {
    const reserva = await createReservaHuerfanaConContactoFixture({
      adminId: admin.id,
      pagadorNombre: "Vinculación",
      pagadorEmail: `${clienteA.id}@example.com`,
    });

    const supabase = await signInAs(admin);

    expect(await vincularReserva(supabase, { reservaId: reserva.reservaId, clienteId: clienteA.id })).toEqual({ ok: true });

    const { data: vinculada } = await serviceClient()
      .from("reservas")
      .select("cliente_id")
      .eq("id", reserva.reservaId)
      .single();

    expect(vinculada?.cliente_id).toBe(clienteA.id);

    expect(await vincularReserva(supabase, { reservaId: reserva.reservaId, clienteId: clienteB.id })).toEqual({ ok: false });

    const { data: sinPisar } = await serviceClient()
      .from("reservas")
      .select("cliente_id")
      .eq("id", reserva.reservaId)
      .single();

    expect(sinPisar?.cliente_id).toBe(clienteA.id);
  });

  it("desvincula la reserva y confirma cliente_id null con serviceClient", async () => {
    const reserva = await createReservaHuerfanaConContactoFixture({
      adminId: admin.id,
      pagadorNombre: "Desvinculación",
      pagadorEmail: `${clienteA.id}@example.com`,
    });

    const supabase = await signInAs(admin);

    await vincularReserva(supabase, { reservaId: reserva.reservaId, clienteId: clienteA.id });

    expect(await desvincularReserva(supabase, { reservaId: reserva.reservaId })).toEqual({ ok: true });

    const { data } = await serviceClient()
      .from("reservas")
      .select("cliente_id")
      .eq("id", reserva.reservaId)
      .single();

    expect(data?.cliente_id).toBeNull();
  });

  it("la invitación exacta vincula y RLS impide que otro cliente lea la reserva", async () => {
    const email = `${Date.now()}-${admin.id}@example.com`;

    const reserva = await createReservaHuerfanaConContactoFixture({
      adminId: admin.id,
      pagadorNombre: "Invitación exacta",
      pagadorEmail: email,
    });

    const invitacion = await invitarCliente(
      { email, nombre: "Cliente invitado", redirectTo: "http://localhost/cliente/completar-cuenta" },
      adminConEnvioSimulado(),
    );

    expect(invitacion.ok).toBe(true);

    if (!invitacion.ok) return;

    trackTestUserId(invitacion.userId);

    const supabase = await signInAs(admin);
    const coincidencia = await buscarCoincidenciaExacta(supabase, { email });

    expect(coincidencia).toEqual({ id: reserva.reservaId });
    expect(await vincularReserva(supabase, { reservaId: coincidencia!.id, clienteId: invitacion.userId })).toEqual({ ok: true });

    const clienteSinVinculo = await signInAs(clienteB);

    const { data, error } = await clienteSinVinculo
      .from("reservas")
      .select("id")
      .eq("id", reserva.reservaId);

    expect(error).toBeFalsy();
    expect(data).toEqual([]);
  });
});
