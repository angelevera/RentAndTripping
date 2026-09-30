import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { BuscadorHuerfanas } from "./buscador-huerfanas";
import { ReservasVinculadas, ReservasVinculadasSkeleton } from "./reservas-vinculadas";
import { ResultadosHuerfanas, ResultadosHuerfanasSkeleton } from "./resultados-huerfanas";

function leerQHuerfanas(searchParams: Record<string, string | string[] | undefined>): string {
  const valor = Array.isArray(searchParams.q) ? searchParams.q[0] ?? "" : searchParams.q ?? "";
  return valor.trim().slice(0, 100);
}

export default async function DetalleClientePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, nombre, email, telefono").eq("id", id).eq("role", "customer").maybeSingle();

  if (error) return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10"><h1 className="font-display text-2xl font-bold">Cliente</h1><Alert variant="destructive" className="border-red-300 bg-red-50 text-red-700"><AlertDescription className="text-red-700">No se pudo cargar la lista. Actualiza la página o inténtalo de nuevo en un momento.</AlertDescription></Alert></main>;
  if (!data) notFound();

  const q = leerQHuerfanas(await searchParams);
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
    <h1 className="font-display text-2xl font-bold break-words">{data.nombre ?? data.email ?? "Cliente"}</h1>
    <section aria-labelledby="reservas-vinculadas-heading" className="flex flex-col gap-4">
      <h2 id="reservas-vinculadas-heading" className="font-display text-xl font-bold">Reservas vinculadas</h2>
      <Suspense fallback={<ReservasVinculadasSkeleton />}><ReservasVinculadas clienteId={id} /></Suspense>
    </section>
    <Separator />
    <section aria-labelledby="buscar-reservas-heading" className="flex flex-col gap-4">
      <h2 id="buscar-reservas-heading" className="font-display text-xl font-bold">Buscar reservas para vincular</h2>
      <BuscadorHuerfanas clienteId={id} valores={{ q }} />
      <Suspense key={q} fallback={<ResultadosHuerfanasSkeleton />}><ResultadosHuerfanas clienteId={id} q={q} /></Suspense>
    </section>
  </main>;
}
