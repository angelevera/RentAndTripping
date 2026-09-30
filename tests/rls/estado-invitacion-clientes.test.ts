import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUsers,
  createReservaHuerfanaConContactoFixture,
  createTestUser,
  serviceClient,
  signInAs,
  sweepStaleTestUsers,
  trackTestUserId,
  TEST_PREFIX,
  type TestUser,
} from "../helpers/fixtures";
import { listarClientes } from "@/lib/clientes/listar";
import { vincularReserva } from "@/lib/clientes/vincular";


// generateLink(type "invite") crea la cuenta sin confirmar con invited_at real
// y no envía correo; createUser (usado por adminConEnvioSimulado) deja
// invited_at en null, que es justo lo que esta prueba necesita distinguir.
async function sembrarInvitacionPendiente(email: string, nombre: string): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { nombre } },
  });
  if (error || !data.user) throw new Error(`No se pudo sembrar la invitación: ${error?.message}`);
  trackTestUserId(data.user.id);
  return data.user.id;
}

let admin: TestUser;
let cliente: TestUser;

beforeAll(async () => {
  await sweepStaleTestUsers();
  admin = await createTestUser("admin");
  cliente = await createTestUser("customer");
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe("estado de invitación de clientes", () => {
  it("rechaza la llamada de un cliente autenticado sin devolver filas", async () => {
    const supabase = await signInAs(cliente);
    const { data, error } = await supabase.rpc("clientes_estado_invitacion", { ids: [cliente.id] });

    expect(error).toBeTruthy();
    expect(data).toBeNull();
  });

  it("devuelve invitado_en null para una cuenta creada y confirmada normalmente", async () => {
    const supabase = await signInAs(admin);
    const { data, error } = await supabase.rpc("clientes_estado_invitacion", { ids: [cliente.id] });

    expect(error).toBeNull();
    expect(data).toEqual([{ id: cliente.id, invitado_en: null, confirmado_en: expect.any(String) }]);
  });

  it("indica invitación pendiente sin consultar auth.users desde la app", async () => {
    const email = `${Date.now()}-${admin.id}@${process.env.TEST_EMAIL_DOMAIN || "example.com"}`;
    const pendienteId = await sembrarInvitacionPendiente(email, "Cliente pendiente");

    const supabase = await signInAs(admin);
    const { data, error } = await supabase.rpc("clientes_estado_invitacion", { ids: [pendienteId] });
    expect(error).toBeNull();
    expect(data).toEqual([{ id: pendienteId, invitado_en: expect.any(String), confirmado_en: null }]);
  });

  it("lista clientes por búsqueda parcial con badge y conteos de cero y una reserva", async () => {
    const sinReservas = await createTestUser("customer");
    const conReserva = await createTestUser("customer");
    const emailPendiente = `${Date.now()}-${TEST_PREFIX}@${process.env.TEST_EMAIL_DOMAIN || "example.com"}`;
    const pendienteId = await sembrarInvitacionPendiente(emailPendiente, `${TEST_PREFIX} Pendiente`);

    const reserva = await createReservaHuerfanaConContactoFixture({
      adminId: admin.id,
      pagadorEmail: conReserva.email,
      pagadorNombre: `${TEST_PREFIX} Vinculado`,
    });
    const supabase = await signInAs(admin);
    expect(await vincularReserva(supabase, { reservaId: reserva.reservaId, clienteId: conReserva.id })).toEqual({ ok: true });

    const resultado = await listarClientes(supabase, { pagina: 1, q: TEST_PREFIX });
    expect(resultado.error).toBe(false);
    expect(resultado.filas.find((fila) => fila.id === sinReservas.id)).toMatchObject({ cantidadReservas: 0, invitacionPendiente: false });
    expect(resultado.filas.find((fila) => fila.id === conReserva.id)).toMatchObject({ cantidadReservas: 1, invitacionPendiente: false });
    expect(resultado.filas.find((fila) => fila.id === pendienteId)).toMatchObject({ cantidadReservas: 0, invitacionPendiente: true });
  });
});
