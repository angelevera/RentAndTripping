import { requireAdmin } from "@/lib/auth/require-admin";
import { cerrarSesion } from "./actions";

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main data-testid="panel-admin" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
      <h1 className="text-xl font-semibold">Panel de administración</h1>
      <p>Sesión iniciada como {admin.email}</p>
      <p className="text-gray-500">Todavía no hay reservas cargadas.</p>
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
