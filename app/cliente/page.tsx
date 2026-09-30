import { requireCliente } from "@/lib/auth/require-cliente";
import { createClient } from "@/lib/supabase/server";
import { listarReservasCliente } from "@/lib/reservas/listar-cliente";

// Vista deliberadamente mínima (FA-2, 03-01): sin insignias duales (D-15),
// sin "Para: [viajero]" (D-14), sin separación Próximas/Historial (D-16),
// sin estado vacío de marca (D-17/D-18) — todo eso lo construye 03-02. Este
// plan solo prueba la tubería completa: login -> guardia -> lectura real.
export default async function ClientePage() {
  const cliente = await requireCliente();
  const supabase = await createClient();
  const { filas, error } = await listarReservasCliente(supabase, cliente.userId);

  return (
    <main data-testid="panel-cliente" className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-2xl font-bold">Mis reservas</h1>

      {error && <p className="text-sm text-destructive">No pudimos cargar tus reservas. Inténtalo de nuevo.</p>}

      {!error && filas.length === 0 && (
        <p className="text-sm text-muted-foreground">Todavía no tienes reservas.</p>
      )}

      {!error && filas.length > 0 && (
        <ul className="flex flex-col gap-4">
          {filas.map((fila) => (
            <li
              key={fila.id}
              data-testid="reserva-cliente"
              className="flex flex-col gap-1 rounded-lg border border-gray-100 p-4"
            >
              <span className="font-medium capitalize">{fila.tipo}</span>
              <span className="text-sm text-muted-foreground">{fila.fechaImportante ?? "—"}</span>
              <span className="text-sm text-muted-foreground">{fila.pagadorNombre}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-4 border-t border-gray-100 pt-8">
        <p className="text-sm text-muted-foreground">Sesión iniciada como {cliente.email}</p>
      </div>
    </main>
  );
}
