"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esquemaLogin } from "@/lib/validation/auth";

export type EstadoLogin = {
  error?: string;
  errores?: { email?: string; password?: string };
};

/**
 * Server Action del formulario de login. Valida en el servidor (un cliente
 * sin JavaScript puede saltarse la validación del navegador), llama a
 * Supabase Auth, y traduce cualquier error a un mensaje en español que nunca
 * revela si el correo existe (T-01-25).
 */
export async function iniciarSesion(
  _previo: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const resultado = esquemaLogin.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!resultado.success) {
    const campos = resultado.error.flatten().fieldErrors;
    return {
      errores: {
        email: campos.email?.[0],
        password: campos.password?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(resultado.data);

  if (error) {
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { error: "Correo o contraseña incorrectos." };
    }

    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
    }

    console.error("Error inesperado al iniciar sesión:", error);
    return { error: "No pudimos iniciar sesión en este momento. Inténtalo de nuevo en unos minutos." };
  }

  redirect("/admin");
}
