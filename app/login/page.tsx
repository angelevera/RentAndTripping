import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/require-admin";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getAdminSession()) {
    redirect("/admin");
  }

  const params = await searchParams;
  const sinAcceso = params.motivo === "sin-acceso";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">Entrar al panel</h1>

      {sinAcceso && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Esta cuenta no tiene acceso al panel de administración.
        </p>
      )}

      <LoginForm />
    </main>
  );
}
