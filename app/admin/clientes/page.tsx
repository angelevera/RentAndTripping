import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { leerParametrosClientes, parametrosClientesAQuery } from "@/lib/clientes/parametros-lista";
import { BuscadorClientes } from "./buscador-clientes";
import { InvitarClienteForm } from "./invitar-cliente-form";
import { ListaClientes, ListaClientesSkeleton } from "./lista-clientes";

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const parametros = leerParametrosClientes(await searchParams);

  return (
    <main data-testid="panel-clientes" className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-2xl font-bold">Clientes</h1>
      <InvitarClienteForm />
      <BuscadorClientes valores={parametros} />
      <Suspense key={parametrosClientesAQuery(parametros)} fallback={<ListaClientesSkeleton />}>
        <ListaClientes parametros={parametros} />
      </Suspense>
    </main>
  );
}
