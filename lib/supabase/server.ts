import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Este archivo solo puede importarse desde Server Components, Server
// Functions o Route Handlers. Importarlo desde un Client Component es un
// error de build gracias a "server-only" — así se aplica la separación entre
// el cliente de navegador y el de servidor (nunca deben compartirse).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Un Server Component no puede escribir cookies — se ignora
            // aquí a propósito. El proxy (Plan 01-02) refresca la sesión en
            // cada request.
          }
        },
      },
      // No se pasan opciones de cookie aquí a propósito: la duración de la
      // sesión viene de los defaults de la librería (cookie de 400 días y un
      // refresh token que no expira), que ya satisfacen D-01/D-02 (sesión
      // larga tipo WhatsApp Web, multi-dispositivo). Configurar la duración
      // de la cookie aquí sería ignorado por @supabase/ssr de todas formas.
    },
  );
}
