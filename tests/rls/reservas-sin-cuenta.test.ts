import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUsers,
  createPagoFixture,
  createReservaSinCuentaFixture,
  createTestUser,
  publicClient,
  serviceClient,
  signInAs,
  sweepStaleTestUsers,
  type TestUser,
} from "../helpers/fixtures";

// Prueba que una reserva sin cuenta de cliente (cliente_id NULL, D-01) queda
// invisible para clientes y anónimos, visible solo para el admin, y que las
// nuevas reglas de negocio (pagador_*, viajero_*, detalle, nota_problema) las
// aplica la base de datos, no solo el formulario.

let admin: TestUser;

let cliente: TestUser;

let reservaId: string;

let pagadorNombre: string;

let pagoId: string;

beforeAll(async () => {
  await sweepStaleTestUsers();
  admin = await createTestUser("admin");
  cliente = await createTestUser("customer");
  const fixture = await createReservaSinCuentaFixture({ adminId: admin.id });
  reservaId = fixture.reservaId;
  pagadorNombre = fixture.pagadorNombre;
  const pago = await createPagoFixture({ reservaId, adminId: admin.id, estado: "confirmado" });
  pagoId = pago.pagoId;
});

afterAll(async () => {
  await cleanupTestUsers();

  const service = serviceClient();

  for (const id of [admin.id, cliente.id]) {
    const { data, error } = await service.auth.admin.getUserById(id);
    expect(error).toBeTruthy();
    expect(data?.user).toBeFalsy();
  }
});

describe("reservas sin cuenta (cliente_id null)", () => {
  it("el cliente no ve la reserva ni su pago", async () => {
    const clientCustomer = await signInAs(cliente);

    const { data: reservas, error: reservasError } = await clientCustomer
      .from("reservas")
      .select("id")
      .eq("id", reservaId);

    expect(reservasError).toBeFalsy();
    expect(reservas ?? []).toHaveLength(0);

    const { data: pagos, error: pagosError } = await clientCustomer
      .from("pagos")
      .select("id")
      .eq("id", pagoId);

    expect(pagosError).toBeFalsy();
    expect(pagos ?? []).toHaveLength(0);
  });

  it("un anónimo no ve la reserva", async () => {
    const service = serviceClient();
    const anon = publicClient();

    const { data, error } = await anon.from("reservas").select("id").eq("id", reservaId);
    expect(error).toBeFalsy();
    expect(data ?? []).toHaveLength(0);

    // Confirma con serviceClient que la fila sí existe (no es un 404 real).
    const { data: real } = await service.from("reservas").select("id").eq("id", reservaId).single();
    expect(real?.id).toBe(reservaId);
  });

  it("el admin lee la reserva con su pagador_nombre y cliente_id null", async () => {
    const clientAdmin = await signInAs(admin);

    const { data, error } = await clientAdmin
      .from("reservas")
      .select("id, cliente_id, pagador_nombre")
      .eq("id", reservaId)
      .single();

    expect(error).toBeFalsy();
    expect(data?.cliente_id).toBeNull();
    expect(data?.pagador_nombre).toBe(pagadorNombre);
  });

  it("el admin no puede insertar una reserva sin pagador_telefono", async () => {
    const clientAdmin = await signInAs(admin);

    const { error } = await clientAdmin.from("reservas").insert({
      cliente_id: null,
      created_by: admin.id,
      pagador_nombre: `${pagadorNombre} sin telefono`,
      pagador_telefono: "",
      tipo: "tour",
      detalle: { tipo: "tour" },
      precio: 100,
      moneda: "USD",
    });

    expect(error).toBeTruthy();
  });

  it("el admin no puede insertar una reserva con pagador_nombre en blanco", async () => {
    const clientAdmin = await signInAs(admin);

    const { error } = await clientAdmin.from("reservas").insert({
      cliente_id: null,
      created_by: admin.id,
      pagador_nombre: "   ",
      pagador_telefono: "0000-0000000",
      tipo: "tour",
      detalle: { tipo: "tour" },
      precio: 100,
      moneda: "USD",
    });

    expect(error).toBeTruthy();
  });

  it("el admin no puede insertar una reserva cuyo detalle sea un arreglo JSON", async () => {
    const clientAdmin = await signInAs(admin);

    const { error } = await clientAdmin.from("reservas").insert({
      cliente_id: null,
      created_by: admin.id,
      pagador_nombre: `${pagadorNombre} detalle arreglo`,
      pagador_telefono: "0000-0000000",
      tipo: "tour",
      detalle: ["no", "es", "un", "objeto"],
      precio: 100,
      moneda: "USD",
    });

    expect(error).toBeTruthy();
  });

  it("el admin no puede insertar una reserva cuyo detalle.tipo no coincide con tipo", async () => {
    const clientAdmin = await signInAs(admin);

    const { error } = await clientAdmin.from("reservas").insert({
      cliente_id: null,
      created_by: admin.id,
      pagador_nombre: `${pagadorNombre} tipo distinto`,
      pagador_telefono: "0000-0000000",
      tipo: "tour",
      detalle: { tipo: "hotel" },
      precio: 100,
      moneda: "USD",
    });

    expect(error).toBeTruthy();
  });

  it("el admin no puede insertar una reserva con viajero_telefono sin viajero_nombre", async () => {
    const clientAdmin = await signInAs(admin);

    const { error } = await clientAdmin.from("reservas").insert({
      cliente_id: null,
      created_by: admin.id,
      pagador_nombre: `${pagadorNombre} viajero sin nombre`,
      pagador_telefono: "0000-0000000",
      viajero_telefono: "0414-0000000",
      tipo: "tour",
      detalle: { tipo: "tour" },
      precio: 100,
      moneda: "USD",
    });

    expect(error).toBeTruthy();
  });

  it("marcar con_problema sin nota_problema falla; con nota_problema tiene éxito", async () => {
    const clientAdmin = await signInAs(admin);
    const service = serviceClient();

    const { error: errorSinNota } = await clientAdmin
      .from("reservas")
      .update({ estado_proveedor: "con_problema", nota_problema: null })
      .eq("id", reservaId);

    expect(errorSinNota).toBeTruthy();

    const { data: reservaSinCambio } = await service
      .from("reservas")
      .select("estado_proveedor")
      .eq("id", reservaId)
      .single();

    expect(reservaSinCambio?.estado_proveedor).not.toBe("con_problema");

    const { error: errorConNota } = await clientAdmin
      .from("reservas")
      .update({ estado_proveedor: "con_problema", nota_problema: "El vuelo se retrasó." })
      .eq("id", reservaId);

    expect(errorConNota).toBeFalsy();

    const { data: reservaConCambio } = await service
      .from("reservas")
      .select("estado_proveedor, nota_problema")
      .eq("id", reservaId)
      .single();

    expect(reservaConCambio?.estado_proveedor).toBe("con_problema");
    expect(reservaConCambio?.nota_problema).toBe("El vuelo se retrasó.");
  });

  it("la actualización del cliente no cambia nada (re-lectura con serviceClient)", async () => {
    const clientCustomer = await signInAs(cliente);
    const service = serviceClient();

    const { data: antes } = await service
      .from("reservas")
      .select("pagador_nombre")
      .eq("id", reservaId)
      .single();

    await clientCustomer
      .from("reservas")
      .update({ pagador_nombre: "intento de cliente" })
      .eq("id", reservaId);

    const { data: despues } = await service
      .from("reservas")
      .select("pagador_nombre")
      .eq("id", reservaId)
      .single();

    expect(despues?.pagador_nombre).toBe(antes?.pagador_nombre);
  });
});
