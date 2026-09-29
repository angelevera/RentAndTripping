import { requireAdmin } from "@/lib/auth/require-admin";
import { ReservaForm } from "../reserva-form";

export default async function NuevaReservaPage() {
  await requireAdmin();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Nueva reserva</h1>
      <ReservaForm />
    </main>
  );
}
