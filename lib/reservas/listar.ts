import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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
}

interface ListarReservasResultado {
  filas: FilaListaReserva[];
  total: number;
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
  { pagina }: ListarReservasOpciones,
): Promise<ListarReservasResultado> {
  const desde = (pagina - 1) * TAMANO_PAGINA;
  const hasta = pagina * TAMANO_PAGINA - 1;

  const { data, error, count } = await supabase
    .from("reservas")
    .select(
      "id, pagador_nombre, viajero_nombre, tipo, fecha_importante, estado_proveedor, precio, moneda, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(desde, hasta);

  if (error || !data) {
    console.error("Error al listar reservas:", error);

    return { filas: [], total: 0, error: true };
  }

  if (data.length === 0) {
    return { filas: [], total: count ?? 0, error: false };
  }

  const ids = data.map((fila) => fila.id);

  const { data: pagosConfirmados, error: errorPagos } = await supabase
    .from("pagos")
    .select("reserva_id")
    .eq("estado", "confirmado")
    .in("reserva_id", ids);

  if (errorPagos) {
    console.error("Error al leer los pagos confirmados de la página:", errorPagos);

    return { filas: [], total: 0, error: true };
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

  return { filas, total: count ?? 0, error: false };
}
