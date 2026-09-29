import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { Button } from "@/components/ui/button";
import { ListaReservas, ListaReservasSkeleton } from "./reservas/lista-reservas";
import { cerrarSesion } from "./actions";

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main data-testid="panel-admin" className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Reservas</h1>
        <Button asChild className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95">
          <Link href="/admin/reservas/nueva">Crear reserva</Link>
        </Button>
      </div>

      <Suspense fallback={<ListaReservasSkeleton />}>
        <ListaReservas pagina={1} />
      </Suspense>

      <div className="flex flex-col gap-4 border-t border-gray-100 pt-8">
        <p className="text-sm text-muted-foreground">Sesión iniciada como {admin.email}</p>
        <form data-testid="form-cerrar-sesion" action={cerrarSesion}>
          <Button type="submit" variant="outline" className="min-h-11">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </main>
  );
}
