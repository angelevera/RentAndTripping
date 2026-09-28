"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// scope: 'local' cierra solo la sesión de este dispositivo — el teléfono
// sigue conectado cuando se cierra sesión en la laptop (D-02). Nunca usar el
// scope 'global' (todos los dispositivos) aquí.
export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
