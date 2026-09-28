import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function iniciarSesion(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=credenciales");
  }

  redirect("/admin");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tieneError = params.error === "credenciales";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>

      {tieneError && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Correo o contraseña incorrectos.
        </p>
      )}

      <form data-testid="form-login" action={iniciarSesion} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="rounded border border-gray-300 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-[#482583] px-4 py-2 font-medium text-white"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
