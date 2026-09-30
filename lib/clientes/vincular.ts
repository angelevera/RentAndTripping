import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { escaparPatronLike } from "@/lib/reservas/parametros-lista";

export interface ReservaHuerfana {
  id: string;
  pagadorNombre: string;
  pagadorEmail: string | null;
  pagadorTelefono: string;
  tipo: string;
  fechaImportante: string | null;
  precio: number;
  moneda: string;
}

const LIMITE_CANDIDATAS = 20;

/**
 * PostgREST's `.or()` filter grammar uses comma to separate conditions and
 * parentheses to group them — escaparPatronLike only escapes LIKE
 * metacharacters (\, %, _), so a search value containing a literal comma or
 * parenthesis (e.g. "García, Luis" or "(0414) 555-1234") would otherwise
 * corrupt the filter string. Wrapping the value in double quotes, with
 * internal \ and " escaped, is PostgREST's own documented way to embed such
 * characters literally inside an .or()/.and() filter list.
 */
function paraFiltroOr(valor: string): string {
  return `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function buscarCoincidenciaExacta(
  supabase: SupabaseClient<Database>,
  { email, telefono }: { email: string; telefono?: string },
): Promise<{ id: string } | null> {
  let consulta = supabase
    .from("reservas")
    .select("id")
    .is("cliente_id", null)
    .eq("pagador_email", email);

  if (telefono !== undefined) consulta = consulta.eq("pagador_telefono", telefono);

  const { data, error } = await consulta.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (error) {
    console.error("Error al buscar coincidencia exacta de reserva:", error);

    return null;
  }

  return data ? { id: data.id } : null;
}

export async function buscarReservasHuerfanas(
  supabase: SupabaseClient<Database>,
  { q }: { q: string },
): Promise<{ filas: ReservaHuerfana[]; limitada: boolean; error: boolean }> {
  let consulta = supabase
    .from("reservas")
    .select("id, pagador_nombre, pagador_email, pagador_telefono, tipo, fecha_importante, precio, moneda")
    .is("cliente_id", null);

  if (q) {
    const patron = paraFiltroOr(`%${escaparPatronLike(q)}%`);

    consulta = consulta.or(
      `pagador_nombre.ilike.${patron},pagador_email.ilike.${patron},pagador_telefono.ilike.${patron}`,
    );
  }

  const { data, error } = await consulta.order("created_at", { ascending: false }).limit(LIMITE_CANDIDATAS + 1);

  if (error || !data) {
    console.error("Error al buscar reservas huérfanas:", error);

    return { filas: [], limitada: false, error: true };
  }

  return {
    filas: data.slice(0, LIMITE_CANDIDATAS).map((fila) => ({
      id: fila.id,
      pagadorNombre: fila.pagador_nombre,
      pagadorEmail: fila.pagador_email,
      pagadorTelefono: fila.pagador_telefono,
      tipo: fila.tipo,
      fechaImportante: fila.fecha_importante,
      precio: fila.precio,
      moneda: fila.moneda,
    })),
    limitada: data.length > LIMITE_CANDIDATAS,
    error: false,
  };
}

export async function vincularReserva(
  supabase: SupabaseClient<Database>,
  { reservaId, clienteId }: { reservaId: string; clienteId: string },
): Promise<{ ok: boolean }> {
  const { data, error } = await supabase
    .from("reservas")
    .update({ cliente_id: clienteId })
    .eq("id", reservaId)
    .is("cliente_id", null)
    .select("id");

  if (error || !data?.length) {
    console.error("Error al vincular la reserva:", error ?? "No se encontró una reserva huérfana.");

    return { ok: false };
  }

  return { ok: true };
}

export async function desvincularReserva(
  supabase: SupabaseClient<Database>,
  { reservaId }: { reservaId: string },
): Promise<{ ok: boolean }> {
  const { data, error } = await supabase
    .from("reservas")
    .update({ cliente_id: null })
    .eq("id", reservaId)
    .select("id");

  if (error || !data?.length) {
    console.error("Error al desvincular la reserva:", error ?? "No se encontró la reserva.");

    return { ok: false };
  }

  return { ok: true };
}
