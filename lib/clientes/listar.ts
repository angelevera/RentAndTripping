import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { escaparPatronLike } from "@/lib/reservas/parametros-lista";

export const TAMANO_PAGINA_CLIENTES = 20;

export interface FilaListaCliente {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  cantidadReservas: number;
  invitacionPendiente: boolean;
}

interface ListarClientesResultado {
  filas: FilaListaCliente[];
  total: number;
  pagina: number;
  totalPaginas: number;
  error: boolean;
}

function filtroBusqueda(q: string): string {
  const valor = escaparPatronLike(q).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const patron = `"%${valor}%"`;

  return `nombre.ilike.${patron},email.ilike.${patron},telefono.ilike.${patron}`;
}

/** Lista solo perfiles de clientes; el caller debe aportar su cliente firmado normal. */
export async function listarClientes(
  supabase: SupabaseClient<Database>,
  { pagina: paginaSolicitada, q = "" }: { pagina: number; q?: string },
): Promise<ListarClientesResultado> {
  const paginaInicial = Math.max(1, Math.min(10000, Math.trunc(paginaSolicitada) || 1));
  const busqueda = q.trim().slice(0, 100);

  let conteo = supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer");
  if (busqueda) conteo = conteo.or(filtroBusqueda(busqueda));

  const { count: totalCrudo, error: errorConteo } = await conteo;
  if (errorConteo) {
    console.error("Error al contar clientes:", errorConteo);
    return { filas: [], total: 0, pagina: paginaInicial, totalPaginas: 0, error: true };
  }

  const total = totalCrudo ?? 0;
  const totalPaginas = Math.ceil(total / TAMANO_PAGINA_CLIENTES);
  const pagina = total > 0 ? Math.min(paginaInicial, totalPaginas) : paginaInicial;
  if (total === 0) return { filas: [], total: 0, pagina, totalPaginas: 0, error: false };

  let consulta = supabase
    .from("profiles")
    .select("id, nombre, email, telefono, created_at")
    .eq("role", "customer");
  if (busqueda) consulta = consulta.or(filtroBusqueda(busqueda));

  const { data, error } = await consulta
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((pagina - 1) * TAMANO_PAGINA_CLIENTES, pagina * TAMANO_PAGINA_CLIENTES - 1);

  if (error || !data) {
    console.error("Error al listar clientes:", error);
    return { filas: [], total: 0, pagina, totalPaginas: 0, error: true };
  }

  const ids = data.map((fila) => fila.id);
  const { data: reservas, error: errorReservas } = await supabase
    .from("reservas")
    .select("cliente_id")
    .in("cliente_id", ids);

  if (errorReservas || !reservas) {
    console.error("Error al contar las reservas por cliente:", errorReservas);
    return { filas: [], total: 0, pagina, totalPaginas: 0, error: true };
  }

  const conteosReservas = new Map<string, number>();
  for (const reserva of reservas) {
    if (reserva.cliente_id) conteosReservas.set(reserva.cliente_id, (conteosReservas.get(reserva.cliente_id) ?? 0) + 1);
  }

  const { data: estados, error: errorEstados } = await supabase.rpc("clientes_estado_invitacion", { ids });
  if (errorEstados || !estados) {
    console.error("Error al leer el estado de invitación de los clientes:", errorEstados);
    return { filas: [], total: 0, pagina, totalPaginas: 0, error: true };
  }

  const invitacionesPendientes = new Map(
    estados.map((fila) => [fila.id, fila.invitado_en !== null && fila.confirmado_en === null]),
  );
  const filas: FilaListaCliente[] = data.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre ?? fila.email ?? "Sin nombre",
    email: fila.email,
    telefono: fila.telefono,
    cantidadReservas: conteosReservas.get(fila.id) ?? 0,
    invitacionPendiente: invitacionesPendientes.get(fila.id) ?? false,
  }));

  return { filas, total, pagina, totalPaginas, error: false };
}
