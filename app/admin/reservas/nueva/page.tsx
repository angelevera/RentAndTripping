import { requireAdmin } from "@/lib/auth/require-admin";
import { crearReserva } from "../actions";
import { ReservaForm } from "../reserva-form";

export default async function NuevaReservaPage() {
  await requireAdmin();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Nueva reserva</h1>
      <ReservaForm modo="crear" accion={crearReserva} />
    </main>
  );
}
