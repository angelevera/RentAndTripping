"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCliente } from "@/lib/auth/require-cliente";

export async function cerrarSesion() {
  await requireCliente();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
