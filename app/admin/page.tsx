import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { etiquetaDesde, ETIQUETAS_ESTADO_PROVEEDOR, ETIQUETAS_TIPO } from "@/lib/validation/reservas";
import { cerrarSesion } from "./actions";

export default async function AdminPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: reservas, error } = await supabase
    .from("reservas")
    .select("id, pagador_nombre, tipo, precio, moneda, estado_proveedor, fecha_importante")
    .order("created_at", { ascending: false })
    .range(0, 19);

  return (
    <main data-testid="panel-admin" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
      <h1 className="text-xl font-semibold">Panel de administración</h1>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Reservas</h2>
          <Link href="/admin/reservas/nueva" className="min-h-11 inline-flex items-center rounded-full bg-[#482583] px-4 py-2 font-medium text-white">
            Crear reserva
          </Link>
        </div>
        {error ? (
          <p role="alert" className="text-red-700">No se pudieron cargar las reservas. Actualiza la página o inténtalo de nuevo en un momento.</p>
        ) : !reservas?.length ? (
          <p className="text-gray-500">Todavía no hay reservas cargadas</p>
        ) : (
          <ul data-testid="lista-reservas" className="flex flex-col gap-2">
            {reservas.map((reserva) => (
              <li key={reserva.id} data-reserva-id={reserva.id} className="rounded border border-gray-200 p-4">
                <p className="font-medium">{reserva.pagador_nombre}</p>
                <p>{etiquetaDesde(ETIQUETAS_TIPO, reserva.tipo)}</p>
                <p>{reserva.precio} {reserva.moneda}</p>
                <p>{etiquetaDesde(ETIQUETAS_ESTADO_PROVEEDOR, reserva.estado_proveedor)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p>Sesión iniciada como {admin.email}</p>
      <form data-testid="form-cerrar-sesion" action={cerrarSesion}>
        <button
          type="submit"
          className="rounded bg-[#482583] px-4 py-2 font-medium text-white"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
