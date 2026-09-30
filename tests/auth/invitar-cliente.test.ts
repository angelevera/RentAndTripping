import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminConEnvioSimulado,
  createTestUser,
  serviceClient,
  sweepStaleTestUsers,
  cleanupTestUsers,
  trackTestUserId,
  TEST_PREFIX,
} from "../helpers/fixtures";
import { invitarCliente, reenviarInvitacion } from "@/lib/clientes/invitar";

// Ciclo de invitación (D-09/D-10/D-12): invitar crea una cuenta real sin
// confirmar vía la API de administración de Supabase Auth; reenviar borra y
// reinvita SOLO si la cuenta sigue sin confirmar (Pitfall 2) — nunca sobre
// una cuenta real ya en uso, protegida por el chequeo de email_confirmed_at.
//
// adminConEnvioSimulado (fixtures.ts) sustituye el envío real de
// inviteUserByEmail mientras rentntrippin.com no esté verificado en Resend
// — ver el comentario junto a su definición para el porqué completo.

describe("invitarCliente / reenviarInvitacion (D-09/D-10/D-12)", () => {
  beforeAll(async () => {
    await sweepStaleTestUsers();
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("invitarCliente con un correo nuevo crea una cuenta real sin confirmar", async () => {
    const email = `${TEST_PREFIX}-invite-${Date.now()}@example.com`;

    const resultado = await invitarCliente(
      { email, nombre: "Prueba Invitada", redirectTo: "http://localhost:3000/cliente/completar-cuenta" },
      adminConEnvioSimulado(),
    );

    expect(resultado.ok).toBe(true);

    if (!resultado.ok) return;

    trackTestUserId(resultado.userId);

    const service = serviceClient();
    const { data } = await service.auth.admin.getUserById(resultado.userId);

    expect(data?.user?.email_confirmed_at).toBeFalsy();

    const { data: perfil } = await service.from("profiles").select("role").eq("id", resultado.userId).single();

    expect(perfil?.role).toBe("customer");
  });

  it("invitarCliente con un correo que ya tiene perfil devuelve correo_duplicado sin crear nada", async () => {
    const clienteExistente = await createTestUser("customer");

    const resultado = await invitarCliente({
      email: clienteExistente.email,
      nombre: "Otro nombre",
      redirectTo: "http://localhost:3000/cliente/completar-cuenta",
    });

    expect(resultado).toEqual({ ok: false, error: "correo_duplicado" });
  });

  it("reenviarInvitacion sobre una cuenta sin confirmar borra y reinvita con un id nuevo", async () => {
    const email = `${TEST_PREFIX}-resend-${Date.now()}@example.com`;

    const primera = await invitarCliente(
      { email, nombre: "Prueba Reenvío", redirectTo: "http://localhost:3000/cliente/completar-cuenta" },
      adminConEnvioSimulado(),
    );

    expect(primera.ok).toBe(true);

    if (!primera.ok) return;

    const resultado = await reenviarInvitacion(
      {
        userId: primera.userId,
        email,
        nombre: "Prueba Reenvío",
        redirectTo: "http://localhost:3000/cliente/completar-cuenta",
      },
      adminConEnvioSimulado(),
    );

    expect(resultado.ok).toBe(true);

    if (!resultado.ok) return;

    trackTestUserId(resultado.userId);

    expect(resultado.userId).not.toBe(primera.userId);

    const service = serviceClient();
    const { data: viejo, error: errorViejo } = await service.auth.admin.getUserById(primera.userId);

    expect(errorViejo).toBeTruthy();
    expect(viejo?.user).toBeFalsy();

    const { data: nuevo } = await service.auth.admin.getUserById(resultado.userId);

    // El campo invited_at solo lo pone inviteUserByEmail()/generateLink() real
    // (sustituido arriba — requiere dominio verificado en Resend); esta
    // aserción confirma en su lugar lo que sí prueban ambos caminos: una
    // cuenta nueva, distinta y todavía sin confirmar.
    expect(nuevo?.user?.id).toBe(resultado.userId);
    expect(nuevo?.user?.email_confirmed_at).toBeFalsy();
  });

  it("reenviarInvitacion sobre una cuenta ya confirmada devuelve ya_confirmado sin tocarla", async () => {
    const clienteConfirmado = await createTestUser("customer");

    const resultado = await reenviarInvitacion({
      userId: clienteConfirmado.id,
      email: clienteConfirmado.email,
      nombre: "Cliente confirmado",
      redirectTo: "http://localhost:3000/cliente/completar-cuenta",
    });

    expect(resultado).toEqual({ ok: false, error: "ya_confirmado" });

    const service = serviceClient();
    const { data } = await service.auth.admin.getUserById(clienteConfirmado.id);

    expect(data?.user?.id).toBe(clienteConfirmado.id);
  });
});
