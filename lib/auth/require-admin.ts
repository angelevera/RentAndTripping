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

/**
 * Devuelve la sesión del admin si el usuario autenticado tiene
 * profiles.role = 'admin', o null en cualquier otro caso (sin sesión, o
 * sesión de un cliente). No redirige — pensado para el login (Plan 01-04),
 * que necesita mandar a un admin ya conectado directo a /admin.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    return null;
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .single();

  if (perfil?.role !== "admin") {
    return null;
  }

  return { userId: claims.sub, email: claims.email };
});

/**
 * Variante que redirige: la usa cada página y cada Server Action del panel
 * de administración.
 *   - Sin sesión → /login
 *   - Sesión pero no admin → /login?motivo=sin-acceso (Plan 01-04 lee este
 *     query param para mostrar el mensaje correspondiente)
 *   - Admin → devuelve { userId, email }
 */
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .single();

  if (perfil?.role !== "admin") {
    redirect("/login?motivo=sin-acceso");
  }

  return { userId: claims.sub, email: claims.email };
}
