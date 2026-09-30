"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { parametrosClientesAQuery, type ParametrosClientes } from "@/lib/clientes/parametros-lista";

export function BuscadorClientes({ valores }: { valores: ParametrosClientes }) {
  return <ControlesClientes key={parametrosClientesAQuery(valores)} valores={valores} />;
}

function ControlesClientes({ valores }: { valores: ParametrosClientes }) {
  const router = useRouter();
  const [q, setQ] = useState(valores.q);

  useEffect(() => {
    if (q === valores.q) return;
    const timeout = window.setTimeout(() => {
      router.replace(`/admin/clientes?${parametrosClientesAQuery(valores, { q, pagina: 1 })}`);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [q, router, valores]);

  return (
    <section className="rounded-xl bg-secondary p-4" aria-label="Buscar clientes">
      <form method="get" action="/admin/clientes" role="search" className="flex flex-col gap-3">
        <label htmlFor="buscar-cliente" className="text-sm font-medium">Buscar por nombre, correo o teléfono</label>
        <Input
          id="buscar-cliente"
          name="q"
          type="search"
          aria-label="Buscar por nombre, correo o teléfono"
          placeholder="Buscar por nombre, correo o teléfono"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="min-h-11 bg-background px-3"
        />
      </form>
    </section>
  );
}
