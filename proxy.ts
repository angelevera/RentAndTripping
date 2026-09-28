import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 solo ejecuta proxy.ts si vive en la raíz del proyecto (o en
// src/) — una copia dentro de app/ se ignora en silencio. Este archivo tiene
// dos responsabilidades, y ninguna más:
//   1. Refrescar la sesión de Supabase en cada request (la llamada a
//      getClaims() de abajo es lo que dispara el refresh).
//   2. Un redirect optimista de UX para visitantes anónimos de /admin.
// El proxy NUNCA decide el rol de admin: eso es trabajo de la página
// (lib/auth/require-admin.ts) más RLS en Postgres, que es el límite real de
// autorización.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: no poner código entre crear el cliente y esta llamada — es
  // getClaims() lo que refresca la sesión.
  const { data } = await supabase.auth.getClaims();

  if (request.nextUrl.pathname.startsWith("/admin") && !data?.claims) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
