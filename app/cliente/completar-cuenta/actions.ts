"use server";

import { createClient } from "@/lib/supabase/server";
import { esquemaCompletarCuenta } from "@/lib/validation/completar-cuenta";

export type EstadoCompletarCuenta = {
  ok?: boolean;
  error?: string;
  errores?: { password?: string; confirmarPassword?: string };
};

export async function guardarContrasena(
  _previo: EstadoCompletarCuenta,
  formData: FormData,
): Promise<EstadoCompletarCuenta> {
  const resultado = esquemaCompletarCuenta.safeParse({
    password: formData.get("password"),
    confirmarPassword: formData.get("confirmarPassword"),
  });

  if (!resultado.success) {
    const campos = resultado.error.flatten().fieldErrors;

    return {
      errores: {
        password: campos.password?.[0],
        confirmarPassword: campos.confirmarPassword?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return {
      error: "Este enlace ya venció. Pídele al operador que te mande la invitación de nuevo.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: resultado.data.password });

  if (error) {
    console.error("Error al guardar la contraseña del cliente:", error);

    return { error: "No pudimos guardar tu contraseña. Prueba otra vez." };
  }

  return { ok: true };
}
