"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ETIQUETAS_ESTADO_PROVEEDOR,
  ETIQUETAS_TIPO,
  ESTADOS_PROVEEDOR,
  TIPOS_RESERVA,
} from "@/lib/validation/reservas";
import { hayFiltros, parametrosAQuery, type ParametrosLista } from "@/lib/reservas/parametros-lista";

export function FiltrosReservas({ valores }: { valores: ParametrosLista }) {
  return <ControlesFiltros key={parametrosAQuery(valores)} valores={valores} />;
}

function ControlesFiltros({ valores }: { valores: ParametrosLista }) {
  const router = useRouter();
  const [q, setQ] = useState(valores.q);

  useEffect(() => {
    if (q === valores.q) return;

    const timeout = window.setTimeout(() => {
      router.replace(`/admin?${parametrosAQuery(valores, { q, pagina: 1 })}`);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [q, router, valores]);

  function cambiarEstado(value: string) {
    const estado = ESTADOS_PROVEEDOR.find((valor) => valor === value);

    router.replace(`/admin?${parametrosAQuery(valores, { estado, q, pagina: 1 })}`);
  }

  function cambiarTipo(value: string) {
    const tipo = TIPOS_RESERVA.find((valor) => valor === value);

    router.replace(`/admin?${parametrosAQuery(valores, { tipo, q, pagina: 1 })}`);
  }

  return (
    <section className="rounded-xl bg-secondary p-4" aria-label="Filtros de reservas">
      <form method="get" action="/admin" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="buscar-reserva" className="mb-1 block text-sm font-medium">Buscar por nombre de cliente</label>
          <Input
            id="buscar-reserva"
            name="q"
            type="search"
            aria-label="Buscar por nombre de cliente"
            placeholder="Buscar por nombre de cliente"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="min-h-11 bg-background px-3"
          />
          {valores.estado && <input type="hidden" name="estado" value={valores.estado} />}
          {valores.tipo && <input type="hidden" name="tipo" value={valores.tipo} />}
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium" id="filtro-estado-label">Estado del proveedor</label>
          <Select value={valores.estado ?? "todos"} onValueChange={cambiarEstado}>
            <SelectTrigger aria-labelledby="filtro-estado-label" className="min-h-11 w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {ESTADOS_PROVEEDOR.map((estado) => (
                <SelectItem key={estado} value={estado}>{ETIQUETAS_ESTADO_PROVEEDOR[estado]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium" id="filtro-tipo-label">Tipo de reserva</label>
          <Select value={valores.tipo ?? "todos"} onValueChange={cambiarTipo}>
            <SelectTrigger aria-labelledby="filtro-tipo-label" className="min-h-11 w-full bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {TIPOS_RESERVA.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>{ETIQUETAS_TIPO[tipo]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hayFiltros(valores) && (
          <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
            Quitar filtros
          </Link>
        )}
      </form>
    </section>
  );
}
