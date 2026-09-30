import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El proxy solo refresca la sesión y hace un redirect optimista para
// visitantes anónimos de /admin — no es un límite de autorización (los docs
// de Next.js piden verificar dentro de cada Server Function). El límite real
// es RLS en Postgres. Por eso TODA página y TODA Server Action del panel de
// administración debe llamar a requireAdmin() explícitamente.

export interface AdminSession {
  userId: string;
  email: string | undefined;
}

export interface ClienteSession {
  userId: string;
  email: string | undefined;
}

type SessionStatus =
  | { status: "none" }
  | { status: "admin"; session: AdminSession }
  | { status: "customer"; session: ClienteSession }
  | { status: "other" };

/**
 * Única implementación de la comprobación de sesión+rol (la más crítica de
 * todo el código de seguridad): llama a getClaims() y lee profiles.role.
 * getAdminSession(), requireAdmin() y requireCliente() (lib/auth/require-cliente.ts)
 * son las únicas formas permitidas de consumirla — todas componen este
 * resultado en vez de repetir la consulta, para que una futura corrección
 * (ej. una columna disabled) no pueda aplicarse a una y olvidarse en otra.
 * "other" es una rama defensiva prácticamente inalcanzable hoy (profiles.role
 * tiene el CHECK admin|customer desde Fase 1) — existe para fallar seguro
 * (mismo mensaje genérico) si esa invariante se violara fuera de banda.
 */
export const getSessionStatus = cache(async (): Promise<SessionStatus> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    return { status: "none" };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .single();

  if (perfil?.role === "admin") {
    return { status: "admin", session: { userId: claims.sub, email: claims.email } };
  }

  if (perfil?.role === "customer") {
    return { status: "customer", session: { userId: claims.sub, email: claims.email } };
  }

  return { status: "other" };
});

/**
 * Devuelve la sesión del admin si el usuario autenticado tiene
 * profiles.role = 'admin', o null en cualquier otro caso (sin sesión, o
 * sesión de un cliente). No redirige — pensado para el login (Plan 01-04),
 * que necesita mandar a un admin ya conectado directo a /admin.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const resultado = await getSessionStatus();

  return resultado.status === "admin" ? resultado.session : null;
});

/**
 * Variante que redirige: la usa cada página y cada Server Action del panel
 * de administración.
 *   - Sin sesión → /login
 *   - Sesión pero no admin (cliente, u "other") → /login?motivo=sin-acceso
 *     (Plan 01-04 lee este query param para mostrar el mensaje
 *     correspondiente) — comportamiento sin cambios respecto a antes de este
 *     plan (tests/e2e/admin-access.test.ts no se toca), salvo que el caso
 *     "other" además cierra la sesión (ver getSessionStatus, rama defensiva
 *     prácticamente inalcanzable — nunca el caso normal de un cliente).
 *   - Admin → devuelve { userId, email }
 */
export async function requireAdmin(): Promise<AdminSession> {
  const resultado = await getSessionStatus();

  if (resultado.status === "none") {
    redirect("/login");
  }

  if (resultado.status === "other") {
    const supabase = await createClient();

    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?motivo=sin-acceso");
  }

  if (resultado.status !== "admin") {
    redirect("/login?motivo=sin-acceso");
  }

  return resultado.session;
}
