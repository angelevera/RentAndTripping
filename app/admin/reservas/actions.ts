"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import {
  datosReservaDesdeFormData,
  avisoTrasEditar,
  erroresPorCampo,
  esquemaEdicionReserva,
  filaEdicionDesdeDatos,
  esquemaReserva,
  filaReservaDesdeDatos,
} from "@/lib/validation/reservas";
import { z } from "zod";

export type EstadoFormularioReserva = {
  error?: string;
  errores?: Record<string, string>;
};

export async function crearReserva(
  _previo: EstadoFormularioReserva,
  formData: FormData,
): Promise<EstadoFormularioReserva> {
  const admin = await requireAdmin();
  const resultado = esquemaReserva.safeParse(datosReservaDesdeFormData(formData));

  if (!resultado.success) return { errores: erroresPorCampo(resultado.error) };

  const supabase = await createClient();

  const { error } = await supabase.from("reservas").insert({
    ...filaReservaDesdeDatos(resultado.data),
    created_by: admin.userId,
  });

  if (error) {
    console.error("Error al crear la reserva:", error);

    return { error: "No se guardó la reserva. Revisa tu conexión e inténtalo de nuevo." };
  }

  redirect("/admin?aviso=creada");
}

export async function editarReserva(
  id: string,
  _previo: EstadoFormularioReserva,
  formData: FormData,
): Promise<EstadoFormularioReserva> {
  await requireAdmin();

  if (!z.string().uuid().safeParse(id).success) {
    return { error: "No se guardó la reserva. Revisa tu conexión e inténtalo de nuevo." };
  }

  const resultado = esquemaEdicionReserva.safeParse(datosReservaDesdeFormData(formData));

  if (!resultado.success) return { errores: erroresPorCampo(resultado.error) };

  const supabase = await createClient();

  const { data: anterior, error: errorLectura } = await supabase
    .from("reservas")
    .select("estado_proveedor")
    .eq("id", id)
    .maybeSingle();

  if (errorLectura || !anterior) {
    console.error("Error al leer el estado anterior de la reserva:", errorLectura ?? "No se encontró la reserva.");

    return { error: "No se guardó la reserva. Revisa tu conexión e inténtalo de nuevo." };
  }

  const { data, error } = await supabase
    .from("reservas")
    .update(filaEdicionDesdeDatos(resultado.data))
    .eq("id", id)
    .select("id");

  if (error || !data?.length) {
    console.error("Error al editar la reserva:", error ?? "No se encontró la reserva actualizada.");

    return { error: "No se guardó la reserva. Revisa tu conexión e inténtalo de nuevo." };
  }

  redirect(`/admin?aviso=${avisoTrasEditar(anterior.estado_proveedor, resultado.data.estadoProveedor)}`);
}
