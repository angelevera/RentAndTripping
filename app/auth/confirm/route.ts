import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Único punto del repositorio que intercambia token_hash por una sesión.
// verifyOtp establece cookies de autenticación; por eso este manejo de sesión
// se mantiene concentrado aquí (D-20 de 03-CONTEXT.md).
function destinoSeguro(valor: string | null): string {
  const porDefecto = "/cliente/completar-cuenta";
  if (!valor || !valor.startsWith("/")) return porDefecto;

  // Los navegadores ignoran tab/salto de línea y tratan "\" como "/", así que
  // "/\host" o "/<tab>/host" terminan siendo "//host". Se rechazan los
  // caracteres de control y se resuelve con el parser de URL: el origen debe
  // seguir siendo el de un host ficticio.
  if (/[\u0000-\u001f\u007f\\]/.test(valor)) return porDefecto;

  const base = "http://origen.invalido";
  const resuelto = new URL(valor, base);
  if (resuelto.origin !== base) return porDefecto;

  return resuelto.pathname + resuelto.search;
}

export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const tokenHash = parametros.get("token_hash");
  const tipo = parametros.get("type");
  const siguiente = destinoSeguro(parametros.get("next"));

  if (tokenHash && tipo === "invite") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "invite", token_hash: tokenHash });

    if (!error) redirect(siguiente);
  }

  redirect("/cliente/completar-cuenta");
}
