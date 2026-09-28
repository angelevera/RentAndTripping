import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUsers,
  createReservaFixture,
  createTestUser,
  serviceClient,
  signInAs,
  sweepStaleTestUsers,
  type TestUser,
} from "../helpers/fixtures";

// Aislamiento entre clientes sobre reservas/pagos/recordatorios: A y B nunca
// pueden verse ni tocarse entre sí, y solo el admin ve/gestiona todo. Cada
// "no cambia nada" se verifica releyendo la fila con serviceClient, porque
// RLS filtra en silencio (sin error) y confiar solo en "no hubo excepción"
// sería un falso positivo.

let clienteA: TestUser;
let clienteB: TestUser;
let admin: TestUser;
let fixtureA: { reservaId: string; pagoId: string; recordatorioId: string };
let fixtureB: { reservaId: string; pagoId: string; recordatorioId: string };

beforeAll(async () => {
  await sweepStaleTestUsers();
  clienteA = await createTestUser("customer");
  clienteB = await createTestUser("customer");
  admin = await createTestUser("admin");
  fixtureA = await createReservaFixture({ clienteId: clienteA.id, adminId: admin.id });
  fixtureB = await createReservaFixture({ clienteId: clienteB.id, adminId: admin.id });
});

afterAll(async () => {
  await cleanupTestUsers();

  const service = serviceClient();
  for (const id of [clienteA.id, clienteB.id, admin.id]) {
    const { data, error } = await service.auth.admin.getUserById(id);
    expect(error).toBeTruthy();
    expect(data?.user).toBeFalsy();
  }
});

describe("aislamiento entre clientes (reservas/pagos/recordatorios)", () => {
  it("A lee solo su reserva y solo su pago, y 0 recordatorios", async () => {
    const clientA = await signInAs(clienteA);

    const { data: reservas, error: reservasError } = await clientA.from("reservas").select("id");
    expect(reservasError).toBeFalsy();
    expect((reservas ?? []).map((r) => r.id)).toEqual([fixtureA.reservaId]);

    const { data: pagos, error: pagosError } = await clientA.from("pagos").select("id");
    expect(pagosError).toBeFalsy();
    expect((pagos ?? []).map((p) => p.id)).toEqual([fixtureA.pagoId]);

    const { data: recordatorios, error: recordatoriosError } = await clientA
      .from("recordatorios")
      .select("id");
    expect(recordatoriosError).toBeFalsy();
    expect(recordatorios ?? []).toHaveLength(0);
  });

  it("las inserciones de A en reservas y pagos fallan", async () => {
    const clientA = await signInAs(clienteA);

    const { error: reservaError } = await clientA.from("reservas").insert({
      cliente_id: clienteA.id,
      tipo: "tour",
      precio: 50,
      moneda: "USD",
    });
    expect(reservaError).toBeTruthy();

    const { error: pagoError } = await clientA.from("pagos").insert({
      reserva_id: fixtureA.reservaId,
      monto: 50,
      moneda: "USD",
      metodo: "efectivo",
    });
    expect(pagoError).toBeTruthy();
  });

  it("la actualización de A a su propio estado_proveedor y a su propio pago no cambia nada", async () => {
    const clientA = await signInAs(clienteA);
    const service = serviceClient();

    await clientA
      .from("reservas")
      .update({ estado_proveedor: "confirmada" })
      .eq("id", fixtureA.reservaId);

    const { data: reservaTrasIntento } = await service
      .from("reservas")
      .select("estado_proveedor")
      .eq("id", fixtureA.reservaId)
      .single();
    expect(reservaTrasIntento?.estado_proveedor).toBe("pendiente");

    await clientA.from("pagos").update({ estado: "confirmado" }).eq("id", fixtureA.pagoId);

    const { data: pagoTrasIntento } = await service
      .from("pagos")
      .select("estado")
      .eq("id", fixtureA.pagoId)
      .single();
    expect(pagoTrasIntento?.estado).toBe("pendiente_revision");
  });

  it("los borrados de A no cambian nada", async () => {
    const clientA = await signInAs(clienteA);
    const service = serviceClient();

    await clientA.from("reservas").delete().eq("id", fixtureA.reservaId);
    await clientA.from("pagos").delete().eq("id", fixtureA.pagoId);

    const { data: reservaTrasIntento } = await service
      .from("reservas")
      .select("id")
      .eq("id", fixtureA.reservaId)
      .maybeSingle();
    expect(reservaTrasIntento?.id).toBe(fixtureA.reservaId);

    const { data: pagoTrasIntento } = await service
      .from("pagos")
      .select("id")
      .eq("id", fixtureA.pagoId)
      .maybeSingle();
    expect(pagoTrasIntento?.id).toBe(fixtureA.pagoId);
  });

  it("el admin lee ambas reservas, ambos pagos y ambos recordatorios", async () => {
    const clientAdmin = await signInAs(admin);

    const { data: reservas, error: reservasError } = await clientAdmin
      .from("reservas")
      .select("id")
      .in("id", [fixtureA.reservaId, fixtureB.reservaId]);
    expect(reservasError).toBeFalsy();
    expect(new Set((reservas ?? []).map((r) => r.id))).toEqual(
      new Set([fixtureA.reservaId, fixtureB.reservaId]),
    );

    const { data: pagos, error: pagosError } = await clientAdmin
      .from("pagos")
      .select("id")
      .in("id", [fixtureA.pagoId, fixtureB.pagoId]);
    expect(pagosError).toBeFalsy();
    expect(new Set((pagos ?? []).map((p) => p.id))).toEqual(
      new Set([fixtureA.pagoId, fixtureB.pagoId]),
    );

    const { data: recordatorios, error: recordatoriosError } = await clientAdmin
      .from("recordatorios")
      .select("id")
      .in("id", [fixtureA.recordatorioId, fixtureB.recordatorioId]);
    expect(recordatoriosError).toBeFalsy();
    expect(new Set((recordatorios ?? []).map((r) => r.id))).toEqual(
      new Set([fixtureA.recordatorioId, fixtureB.recordatorioId]),
    );
  });

  it("un pago en VES sin tasa_cambio es rechazado, incluso para el admin", async () => {
    const clientAdmin = await signInAs(admin);

    const { error } = await clientAdmin.from("pagos").insert({
      reserva_id: fixtureB.reservaId,
      monto: 100,
      moneda: "VES",
      metodo: "efectivo",
    });

    expect(error).toBeTruthy();
  });

  it("borrar una reserva con un pago es rechazado, incluso para el admin", async () => {
    const clientAdmin = await signInAs(admin);
    const service = serviceClient();

    const { error } = await clientAdmin.from("reservas").delete().eq("id", fixtureB.reservaId);
    expect(error).toBeTruthy();

    const { data: reservaTrasIntento } = await service
      .from("reservas")
      .select("id")
      .eq("id", fixtureB.reservaId)
      .maybeSingle();
    expect(reservaTrasIntento?.id).toBe(fixtureB.reservaId);
  });
});
