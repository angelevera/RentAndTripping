import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  // getClaims() verifica la firma del JWT contra Supabase — nunca usar un
  // lector que confíe en la cookie sin verificar. Este chequeo es solo un
  // redirect de UX; el límite real de autorización es la consulta a
  // profiles de abajo, filtrada por RLS.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const claims = data.claims;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .single();

  if (perfil?.role !== "admin") {
    redirect("/login");
  }

  return (
    <main data-testid="panel-admin" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
      <h1 className="text-xl font-semibold">Panel de administración</h1>
      <p>Sesión iniciada como {claims.email}</p>
      <p className="text-gray-500">Todavía no hay reservas cargadas.</p>
    </main>
  );
}
