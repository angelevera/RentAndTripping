import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { escaparPatronLike } from "@/lib/reservas/parametros-lista";
import type { ESTADOS_PROVEEDOR, TIPOS_RESERVA } from "@/lib/validation/reservas";

// Sin "server-only": este módulo recibe el cliente como parámetro y no
// guarda ningún secreto — así lo pueden importar tanto el Server Component
// de la lista como los tests de db (que usan un cliente firmado como
// customer/admin/anónimo, no un secreto de servidor).

export const TAMANO_PAGINA = 20;

export interface FilaListaReserva {
  id: string;
  pagadorNombre: string;
  viajeroNombre: string | null;
  tipo: string;
  fechaImportante: string | null;
  estadoProveedor: string;
  pagado: boolean;
  precio: number;
  moneda: string;
}

interface ListarReservasOpciones {
  pagina: number;
  q?: string;
  estado?: (typeof ESTADOS_PROVEEDOR)[number];
  tipo?: (typeof TIPOS_RESERVA)[number];
}

interface ListarReservasResultado {
  filas: FilaListaReserva[];
  total: number;
  pagina: number;
  totalPaginas: number;
  error: boolean;
}

/**
 * Lista paginada de reservas (D-08, D-11), con el estado de pago derivado
 * (FA-6): `pagado` es true solo si existe al menos un pago con
 * estado = 'confirmado' para esa reserva. Nunca lee ni escribe ninguna otra
 * columna de `pagos` (monto, método, comprobante u otro dato del cobro) —
 * el foco de esta consulta es el estado, no el detalle del cobro (T-02-11).
 */
export async function listarReservas(
  supabase: SupabaseClient<Database>,
  { pagina: paginaSolicitada, q = "", estado, tipo }: ListarReservasOpciones,
): Promise<ListarReservasResultado> {
  const paginaInicial = Math.max(1, Math.min(10000, Math.trunc(paginaSolicitada) || 1));

  // PostgREST rejects an out-of-range .range() outright (PGRST103) instead of
  // returning an empty page, so a requested page far past the real last page
  // must be clamped BEFORE the ranged query runs — a retry-after-error can
  // never work here, because the first (out-of-range) attempt never gets as
  // far as returning a usable `count`. The filters are applied twice (count,
  // then data) rather than through a shared generic helper, since Supabase's
  // query-builder type changes shape between a head-only count and a full
  // select — a generic wrapper would need its own escape-hatch casts.
  let conteo = supabase.from("reservas").select("id", { count: "exact", head: true });

  if (q) conteo = conteo.ilike("pagador_nombre", `%${escaparPatronLike(q)}%`);

  if (estado) conteo = conteo.eq("estado_proveedor", estado);

  if (tipo) conteo = conteo.eq("tipo", tipo);

  const { count: totalCrudo, error: errorConteo } = await conteo;

  if (errorConteo) {
    console.error("Error al contar reservas:", errorConteo);

    return { filas: [], total: 0, pagina: paginaInicial, totalPaginas: 0, error: true };
  }

  const total = totalCrudo ?? 0;
  const totalPaginas = Math.ceil(total / TAMANO_PAGINA);
  const pagina = total > 0 ? Math.min(paginaInicial, totalPaginas) : paginaInicial;

  if (total === 0) {
    return { filas: [], total: 0, pagina, totalPaginas: 0, error: false };
  }

  let consulta = supabase
    .from("reservas")
    .select("id, pagador_nombre, viajero_nombre, tipo, fecha_importante, estado_proveedor, precio, moneda, created_at");

  if (q) consulta = consulta.ilike("pagador_nombre", `%${escaparPatronLike(q)}%`);

  if (estado) consulta = consulta.eq("estado_proveedor", estado);

  if (tipo) consulta = consulta.eq("tipo", tipo);

  const { data, error } = await consulta
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((pagina - 1) * TAMANO_PAGINA, pagina * TAMANO_PAGINA - 1);

  if (error || !data) {
    console.error("Error al listar reservas:", error);

    return { filas: [], total: 0, pagina, totalPaginas: 0, error: true };
  }

  if (data.length === 0) {
    return { filas: [], total, pagina, totalPaginas, error: false };
  }

  const ids = data.map((fila) => fila.id);

  const { data: pagosConfirmados, error: errorPagos } = await supabase
    .from("pagos")
    .select("reserva_id")
    .eq("estado", "confirmado")
    .in("reserva_id", ids);

  if (errorPagos) {
    console.error("Error al leer los pagos confirmados de la página:", errorPagos);

    return { filas: [], total: 0, pagina, totalPaginas: 0, error: true };
  }

  const idsPagados = new Set((pagosConfirmados ?? []).map((pago) => pago.reserva_id));

  const filas: FilaListaReserva[] = data.map((fila) => ({
    id: fila.id,
    pagadorNombre: fila.pagador_nombre,
    viajeroNombre: fila.viajero_nombre,
    tipo: fila.tipo,
    fechaImportante: fila.fecha_importante,
    estadoProveedor: fila.estado_proveedor,
    pagado: idsPagados.has(fila.id),
    precio: fila.precio,
    moneda: fila.moneda,
  }));

  return { filas, total, pagina, totalPaginas, error: false };
}
