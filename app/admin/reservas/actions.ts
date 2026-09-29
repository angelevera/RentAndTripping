"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import {
  datosReservaDesdeFormData,
  erroresPorCampo,
  esquemaReserva,
  filaReservaDesdeDatos,
} from "@/lib/validation/reservas";

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
