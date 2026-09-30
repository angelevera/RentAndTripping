"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esquemaLogin } from "@/lib/validation/auth";
import { getSessionStatus } from "@/lib/auth/require-admin";

export type EstadoLogin = {
  error?: string;
  errores?: { email?: string; password?: string };
};

// Un único literal (D-01/D-02): tanto credenciales inválidas como una cuenta
// válida sin acceso reconocido devuelven exactamente este mismo mensaje, para
// que ambos casos sean indistinguibles desde afuera.
const MENSAJE_CREDENCIALES_INVALIDAS = "Correo o contraseña incorrectos.";

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
      return { error: MENSAJE_CREDENCIALES_INVALIDAS };
    }

    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
    }

    console.error("Error inesperado al iniciar sesión:", error);

    return { error: "No pudimos iniciar sesión en este momento. Inténtalo de nuevo en unos minutos." };
  }

  const estadoSesion = await getSessionStatus();

  if (estadoSesion.status === "admin") {
    redirect("/admin");
  }

  if (estadoSesion.status === "customer") {
    redirect("/cliente");
  }

  await supabase.auth.signOut({ scope: "local" });

  return { error: MENSAJE_CREDENCIALES_INVALIDAS };
}
