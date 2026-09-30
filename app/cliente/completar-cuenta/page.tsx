import { createClient } from "@/lib/supabase/server";
import { CompletarCuentaForm } from "./completar-cuenta-form";

export default async function CompletarCuentaPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main
      data-testid="panel-completar-cuenta"
      className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12"
    >
      <h1 className="font-display text-xl font-bold">Completa tu cuenta</h1>

      {!data?.claims ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Este enlace ya venció. Pídele al operador que te mande la invitación de nuevo.
        </p>
      ) : (
        <CompletarCuentaForm />
      )}
    </main>
  );
}
