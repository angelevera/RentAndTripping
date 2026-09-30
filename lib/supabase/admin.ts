import "server-only";
import { createClient } from "@supabase/supabase-js";

// Único punto de lectura de SUPABASE_SECRET_KEY en toda la app — bypasea RLS
// por completo. Solo lib/clientes/invitar.ts puede importar este archivo
// (checkpoint aprobado en 03-03-PLAN.md, Pitfall 3 de 03-RESEARCH.md).
// Ningún otro Server Action, página, o módulo de lib/ debe llamar a
// createAdminClient() — cada revisión de código (D-22) lo confirma buscando
// referencias a este archivo fuera de ese único importador permitido.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
