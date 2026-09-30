"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export function BuscadorHuerfanas({ clienteId, valores }: { clienteId: string; valores: { q: string } }) {
  return <ControlesHuerfanas key={valores.q} clienteId={clienteId} valores={valores} />;
}

function ControlesHuerfanas({ clienteId, valores }: { clienteId: string; valores: { q: string } }) {
  const router = useRouter();
  const [q, setQ] = useState(valores.q);
  useEffect(() => {
    if (q === valores.q) return;
    const timeout = window.setTimeout(() => {
      const query = new URLSearchParams();
      if (q.trim()) query.set("q", q.trim().slice(0, 100));
      router.replace(`/admin/clientes/${clienteId}${query.size ? `?${query}` : ""}`);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [clienteId, q, router, valores.q]);

  return <section className="rounded-xl bg-secondary p-4" aria-label="Buscar reservas para vincular">
    <form method="get" action={`/admin/clientes/${clienteId}`} role="search" className="flex flex-col gap-3">
      <label htmlFor="buscar-huerfanas" className="text-sm font-medium">Buscar por nombre, correo o teléfono del pagador</label>
      <Input id="buscar-huerfanas" name="q" type="search" aria-label="Buscar por nombre, correo o teléfono del pagador" placeholder="Buscar por nombre, correo o teléfono del pagador" value={q} onChange={(event) => setQ(event.target.value)} className="min-h-11 bg-background px-3" />
    </form>
  </section>;
}
