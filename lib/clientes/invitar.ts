import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type InvitarClienteResultado = { ok: true; userId: string } | { ok: false; error: "correo_duplicado" | "error" };

export type ReenviarInvitacionResultado = { ok: true; userId: string } | { ok: false; error: "ya_confirmado" | "error" };

interface InvitarClienteParams {
  email: string;
  nombre: string;
  redirectTo: string;
}

/**
 * Invita a un cliente nuevo por correo (D-09) — crea una cuenta real de
 * Supabase Auth sin confirmar; el trigger handle_new_user puebla
 * profiles.role='customer' automáticamente. Comprueba duplicados vía
 * profiles.email (FA-4: más robusto y testeable que parsear el texto de
 * error de GoTrue) — nunca llama a inviteUserByEmail si el correo ya tiene
 * un perfil (D-12).
 *
 * `admin` es inyectable (default: createAdminClient(), el cliente real) para
 * que los tests puedan pasar una implementación fiel del mismo cliente sin
 * recurrir a vi.mock() (anti-slop no-module-mocking) — nunca cambia el
 * comportamiento en producción, donde ningún llamador pasa un segundo
 * argumento.
 */
export async function invitarCliente(
  { email, nombre, redirectTo }: InvitarClienteParams,
  admin: ReturnType<typeof createAdminClient> = createAdminClient(),
): Promise<InvitarClienteResultado> {
  const { data: existente, error: errorConsulta } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (errorConsulta) {
    console.error("Error al comprobar si el correo ya tiene cuenta:", errorConsulta);

    return { ok: false, error: "error" };
  }

  if (existente) {
    return { ok: false, error: "correo_duplicado" };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre },
    redirectTo,
  });

  if (error || !data?.user) {
    console.error("Error al invitar al cliente:", error);

    return { ok: false, error: "error" };
  }

  return { ok: true, userId: data.user.id };
}

interface ReenviarInvitacionParams {
  userId: string;
  email: string;
  nombre: string;
  redirectTo: string;
}

/**
 * Reenvía una invitación pendiente (D-10) borrando la cuenta sin confirmar y
 * creando una invitación fresca (Pitfall 2 de 03-RESEARCH.md: la API de
 * Supabase Auth no reenvía el correo de invitación sobre un usuario
 * existente). Red de seguridad: se niega a borrar si email_confirmed_at ya
 * tiene valor — ese workaround solo es seguro sobre una invitación todavía
 * sin confirmar, nunca sobre una cuenta real de cliente ya en uso.
 */
export async function reenviarInvitacion(
  { userId, email, nombre, redirectTo }: ReenviarInvitacionParams,
  admin: ReturnType<typeof createAdminClient> = createAdminClient(),
): Promise<ReenviarInvitacionResultado> {
  const { data: actual, error: errorLectura } = await admin.auth.admin.getUserById(userId);

  if (errorLectura || !actual?.user) {
    console.error("Error al leer la cuenta antes de reenviar la invitación:", errorLectura);

    return { ok: false, error: "error" };
  }

  if (actual.user.email_confirmed_at) {
    return { ok: false, error: "ya_confirmado" };
  }

  // reservas.cliente_id es ON DELETE RESTRICT: con una reserva vinculada,
  // deleteUser fallaría. Se sueltan primero y se re-vinculan a la cuenta nueva;
  // si algo falla después, quedan huérfanas (nunca perdidas) y la próxima
  // invitación las vuelve a enlazar por coincidencia exacta.
  const { data: vinculadas, error: errorVinculadas } = await admin
    .from("reservas")
    .select("id")
    .eq("cliente_id", userId);

  if (errorVinculadas) {
    console.error("Error al leer las reservas vinculadas antes de reenviar:", errorVinculadas);

    return { ok: false, error: "error" };
  }

  const idsVinculadas = (vinculadas ?? []).map((reserva) => reserva.id);

  if (idsVinculadas.length > 0) {
    const { error: errorSoltar } = await admin.from("reservas").update({ cliente_id: null }).in("id", idsVinculadas);

    if (errorSoltar) {
      console.error("Error al soltar las reservas vinculadas antes de reenviar:", errorSoltar);

      return { ok: false, error: "error" };
    }
  }

  const { error: errorBorrado } = await admin.auth.admin.deleteUser(userId);

  if (errorBorrado) {
    console.error("Error al borrar la invitación pendiente antes de reenviar:", errorBorrado);
    await admin.from("reservas").update({ cliente_id: userId }).in("id", idsVinculadas);

    return { ok: false, error: "error" };
  }

  const { data: nuevo, error: errorInvite } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre },
    redirectTo,
  });

  if (errorInvite || !nuevo?.user) {
    console.error("Error al reenviar la invitación:", errorInvite);

    return { ok: false, error: "error" };
  }

  if (idsVinculadas.length > 0) {
    const { error: errorRevincular } = await admin
      .from("reservas")
      .update({ cliente_id: nuevo.user.id })
      .in("id", idsVinculadas);

    if (errorRevincular) {
      console.error("Error al re-vincular las reservas tras reenviar la invitación:", errorRevincular);

      return { ok: false, error: "error" };
    }
  }

  return { ok: true, userId: nuevo.user.id };
}
