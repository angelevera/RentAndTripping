"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { esquemaInvitarCliente } from "@/lib/validation/clientes";
import { erroresPorCampo } from "@/lib/validation/reservas";
import { invitarCliente, reenviarInvitacion } from "@/lib/clientes/invitar";
import {
  buscarCoincidenciaExacta,
  desvincularReserva,
  vincularReserva,
} from "@/lib/clientes/vincular";
import { z } from "zod";

export type EstadoFormularioCliente = {
  error?: string;
  errores?: Record<string, string>;
};

async function origenDesdeHeaders(): Promise<string> {
  const cabeceras = await headers();
  const protocolo = process.env.NODE_ENV === "development" ? "http" : "https";

  return `${protocolo}://${cabeceras.get("host")}`;
}

function idsDeReservaSonValidos(clienteId: string, reservaId: string): boolean {
  return z.string().uuid().safeParse(clienteId).success && z.string().uuid().safeParse(reservaId).success;
}

export async function invitarClienteAction(
  _previo: EstadoFormularioCliente,
  formData: FormData,
): Promise<EstadoFormularioCliente> {
  await requireAdmin();

  const resultado = esquemaInvitarCliente.safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
  });

  if (!resultado.success) return { errores: erroresPorCampo(resultado.error) };

  const redirectTo = `${await origenDesdeHeaders()}/cliente/completar-cuenta`;
  const invitacion = await invitarCliente({ ...resultado.data, redirectTo });

  if (!invitacion.ok) {
    if (invitacion.error === "correo_duplicado") {
      return { error: "Ese correo ya tiene una cuenta." };
    }

    return { error: "No se pudo enviar la invitación. Revisa tu conexión e inténtalo de nuevo." };
  }

  const supabase = await createClient();
  const coincidencia = await buscarCoincidenciaExacta(supabase, { email: resultado.data.email });

  if (coincidencia) {
    await vincularReserva(supabase, { reservaId: coincidencia.id, clienteId: invitacion.userId });
  }

  redirect("/admin/clientes?aviso=invitada");
}

export async function reenviarInvitacionAction(
  userId: string,
  email: string,
  nombre: string,
  _previo: EstadoFormularioCliente,
  _formData: FormData,
): Promise<EstadoFormularioCliente> {
  await requireAdmin();

  const redirectTo = `${await origenDesdeHeaders()}/cliente/completar-cuenta`;
  const resultado = await reenviarInvitacion({ userId, email, nombre, redirectTo });

  if (!resultado.ok) {
    return { error: "No se pudo reenviar la invitación. Inténtalo de nuevo en un momento." };
  }

  redirect("/admin/clientes?aviso=reenviada");
}

export async function vincularReservaAction(
  clienteId: string,
  reservaId: string,
  _previo: EstadoFormularioCliente,
  _formData: FormData,
): Promise<EstadoFormularioCliente> {
  await requireAdmin();

  if (!idsDeReservaSonValidos(clienteId, reservaId)) {
    return { error: "No se pudo actualizar la reserva. Inténtalo de nuevo." };
  }

  const supabase = await createClient();
  const resultado = await vincularReserva(supabase, { reservaId, clienteId });

  if (!resultado.ok) return { error: "No se pudo actualizar la reserva. Inténtalo de nuevo." };

  redirect(`/admin/clientes/${clienteId}?aviso=vinculada`);
}

export async function desvincularReservaAction(
  clienteId: string,
  reservaId: string,
  _previo: EstadoFormularioCliente,
  _formData: FormData,
): Promise<EstadoFormularioCliente> {
  await requireAdmin();

  if (!idsDeReservaSonValidos(clienteId, reservaId)) {
    return { error: "No se pudo actualizar la reserva. Inténtalo de nuevo." };
  }

  const supabase = await createClient();
  const resultado = await desvincularReserva(supabase, { reservaId });

  if (!resultado.ok) return { error: "No se pudo actualizar la reserva. Inténtalo de nuevo." };

  redirect(`/admin/clientes/${clienteId}?aviso=desvinculada`);
}
