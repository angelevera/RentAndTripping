import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionStatus, type ClienteSession } from "@/lib/auth/require-admin";

// El proxy solo refresca la sesión y hace un redirect optimista para
// visitantes anónimos de /cliente — no es un límite de autorización. El
// límite real es RLS en Postgres. Por eso TODA página y TODA Server Action
// del panel de cliente debe llamar a requireCliente() explícitamente.

/**
 * Variante de requireAdmin() para el panel de cliente: compone la misma
 * getSessionStatus() exportada de require-admin.ts (nunca una consulta
 * propia a profiles — esta es la comprobación más crítica de todo el código
 * de seguridad, no la dupliques).
 *   - Sin sesión → /login
 *   - Admin autenticado → /admin (un destino real que le corresponde, no un
 *     mensaje de error)
 *   - Cliente → devuelve { userId, email }
 *   - Cualquier otro caso → cierra la sesión y /login?motivo=sin-acceso
 *     (mismo tratamiento defensivo que requireAdmin())
 */
export async function requireCliente(): Promise<ClienteSession> {
  const resultado = await getSessionStatus();

  if (resultado.status === "none") {
    redirect("/login");
  }

  if (resultado.status === "admin") {
    redirect("/admin");
  }

  if (resultado.status !== "customer") {
    const supabase = await createClient();

    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?motivo=sin-acceso");
  }

  return resultado.session;
}
