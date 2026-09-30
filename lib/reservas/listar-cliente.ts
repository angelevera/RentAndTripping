import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Sin "server-only": este módulo recibe el cliente como parámetro y no
// guarda ningún secreto — mismo criterio que lib/reservas/listar.ts.

export interface FilaReservaCliente {
  id: string;
  tipo: string;
  fechaImportante: string | null;
  estadoProveedor: string;
  pagado: boolean;
  precio: number;
  moneda: string;
  viajeroNombre: string | null;
  pagadorNombre: string;
}

interface ListarReservasClienteResultado {
  filas: FilaReservaCliente[];
  error: boolean;
}

/**
 * Reservas propias del cliente autenticado (AUTH-02), scoped a cliente_id —
 * nunca al viajero de cada reserva (D-13): el pagador ve todas sus reservas
 * vinculadas sin importar quién viaja. El filtro .eq("cliente_id", clienteId)
 * es defensa en profundidad; el límite real es la política RLS
 * "reservas: el cliente ve las suyas" (auth.uid() = cliente_id), sin cambios
 * en este plan. Reusa el patrón de pago derivado de listar.ts.
 */
export async function listarReservasCliente(
  supabase: SupabaseClient<Database>,
  clienteId: string,
): Promise<ListarReservasClienteResultado> {
  const { data, error } = await supabase
    .from("reservas")
    .select("id, tipo, fecha_importante, estado_proveedor, precio, moneda, viajero_nombre, pagador_nombre")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error al listar las reservas del cliente:", error);

    return { filas: [], error: true };
  }

  if (!data || data.length === 0) {
    return { filas: [], error: false };
  }

  const ids = data.map((fila) => fila.id);

  const { data: pagosConfirmados, error: errorPagos } = await supabase
    .from("pagos")
    .select("reserva_id")
    .eq("estado", "confirmado")
    .in("reserva_id", ids);

  if (errorPagos) {
    console.error("Error al leer los pagos confirmados del cliente:", errorPagos);

    return { filas: [], error: true };
  }

  const idsPagados = new Set((pagosConfirmados ?? []).map((pago) => pago.reserva_id));

  const filas: FilaReservaCliente[] = data.map((fila) => ({
    id: fila.id,
    tipo: fila.tipo,
    fechaImportante: fila.fecha_importante,
    estadoProveedor: fila.estado_proveedor,
    pagado: idsPagados.has(fila.id),
    precio: fila.precio,
    moneda: fila.moneda,
    viajeroNombre: fila.viajero_nombre,
    pagadorNombre: fila.pagador_nombre,
  }));

  return { filas, error: false };
}
