import { Suspense } from "react";
import { requireCliente } from "@/lib/auth/require-cliente";
import { Button } from "@/components/ui/button";
import { ListaReservasCliente, ListaReservasClienteSkeleton } from "./lista-reservas-cliente";
import { cerrarSesion } from "./actions";

export default async function ClientePage() {
  const cliente = await requireCliente();

  return (
    <main data-testid="panel-cliente" className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-2xl font-bold">Mis reservas</h1>
      <Suspense fallback={<ListaReservasClienteSkeleton />}>
        <ListaReservasCliente clienteId={cliente.userId} />
      </Suspense>
      <div className="flex flex-col gap-4 border-t border-gray-100 pt-8">
        <p className="text-sm text-muted-foreground">Sesión iniciada como {cliente.email}</p>
        <form data-testid="form-cerrar-sesion" action={cerrarSesion}>
          <Button type="submit" variant="outline" className="min-h-11">Cerrar sesión</Button>
        </form>
      </div>
    </main>
  );
}
