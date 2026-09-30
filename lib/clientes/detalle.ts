import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface FilaReservaCliente {
  id: string;
  tipo: string;
  fechaImportante: string | null;
  estadoProveedor: string;
  pagado: boolean;
  precio: number;
  moneda: string;
}

export async function listarReservasDeCliente(
  supabase: SupabaseClient<Database>,
  { clienteId }: { clienteId: string },
): Promise<{ filas: FilaReservaCliente[]; error: boolean }> {
  const { data, error } = await supabase
    .from("reservas")
    .select("id, tipo, fecha_importante, estado_proveedor, precio, moneda")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error al listar las reservas del cliente:", error);
    return { filas: [], error: true };
  }

  if (data.length === 0) return { filas: [], error: false };

  const ids = data.map((fila) => fila.id);
  const { data: pagosConfirmados, error: errorPagos } = await supabase
    .from("pagos")
    .select("reserva_id")
    .eq("estado", "confirmado")
    .in("reserva_id", ids);

  if (errorPagos || !pagosConfirmados) {
    console.error("Error al leer los pagos confirmados del cliente:", errorPagos);
    return { filas: [], error: true };
  }

  const idsPagados = new Set(pagosConfirmados.map((pago) => pago.reserva_id));
  const filas: FilaReservaCliente[] = data.map((fila) => ({
    id: fila.id,
    tipo: fila.tipo,
    fechaImportante: fila.fecha_importante,
    estadoProveedor: fila.estado_proveedor,
    pagado: idsPagados.has(fila.id),
    precio: fila.precio,
    moneda: fila.moneda,
  }));

  return { filas, error: false };
}
