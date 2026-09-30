"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { esquemaInvitarCliente } from "@/lib/validation/clientes";
import { erroresPorCampo } from "@/lib/validation/reservas";
import { invitarCliente, reenviarInvitacion } from "@/lib/clientes/invitar";

export type EstadoFormularioCliente = {
  error?: string;
  errores?: Record<string, string>;
};

async function origenDesdeHeaders(): Promise<string> {
  const cabeceras = await headers();
  const protocolo = process.env.NODE_ENV === "development" ? "http" : "https";

  return `${protocolo}://${cabeceras.get("host")}`;
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
