import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarReservasHuerfanas } from "@/lib/clientes/vincular";
import { etiquetaDesde, ETIQUETAS_TIPO } from "@/lib/validation/reservas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonVincular } from "./boton-vincular";

function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

const FORMATO_USD = new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" });
function monto(precio: number, moneda: string): string {
  return moneda === "VES" ? `Bs. ${precio.toLocaleString("es-VE")}` : FORMATO_USD.format(precio);
}

export function ResultadosHuerfanasSkeleton() {
  return <div className="flex flex-col gap-2" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
}

export async function ResultadosHuerfanas({ clienteId, q }: { clienteId: string; q: string }) {
  const supabase = await createClient();
  const resultado = await buscarReservasHuerfanas(supabase, { q });
  if (resultado.error) return <div className="flex flex-col items-start gap-3 py-8" role="alert"><p className="text-red-700">No se pudo cargar la lista. Actualiza la página o inténtalo de nuevo en un momento.</p><Button asChild variant="outline" className="min-h-11"><Link href={`/admin/clientes/${clienteId}${q ? `?q=${encodeURIComponent(q)}` : ""}`}>Reintentar</Link></Button></div>;
  if (resultado.filas.length === 0) return <p className="py-6 text-muted-foreground">No se encontraron reservas sin vincular con esa búsqueda.</p>;

  return <div className="flex flex-col gap-3">
    <div className="hidden sm:block"><Table><TableHeader><TableRow><TableHead>Pagador</TableHead><TableHead>Tipo</TableHead><TableHead>Fecha importante</TableHead><TableHead>Monto</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>{resultado.filas.map((fila) => <TableRow key={fila.id} data-testid="reserva-huerfana" data-reserva-id={fila.id}><TableCell><div className="flex max-w-xs flex-col break-words"><span>{fila.pagadorNombre}</span><span className="text-sm text-muted-foreground">{fila.pagadorEmail ?? "—"} · {fila.pagadorTelefono}</span></div></TableCell><TableCell>{etiquetaDesde(ETIQUETAS_TIPO, fila.tipo)}</TableCell><TableCell>{formatearFecha(fila.fechaImportante)}</TableCell><TableCell>{monto(fila.precio, fila.moneda)}</TableCell><TableCell><BotonVincular clienteId={clienteId} reservaId={fila.id} /></TableCell></TableRow>)}</TableBody></Table></div>
    <div className="flex flex-col gap-4 sm:hidden">{resultado.filas.map((fila) => <Card key={fila.id} data-testid="reserva-huerfana" data-reserva-id={fila.id} className="flex flex-col gap-3 p-4"><div className="flex flex-col break-words"><strong>{fila.pagadorNombre}</strong><span className="text-sm text-muted-foreground">{fila.pagadorEmail ?? "—"}</span><span className="text-sm text-muted-foreground">{fila.pagadorTelefono}</span></div><p>{etiquetaDesde(ETIQUETAS_TIPO, fila.tipo)} · {formatearFecha(fila.fechaImportante)}</p><div className="flex items-center justify-between gap-3"><span className="font-medium">{monto(fila.precio, fila.moneda)}</span><BotonVincular clienteId={clienteId} reservaId={fila.id} /></div></Card>)}</div>
    {resultado.limitada && <p className="text-sm text-muted-foreground">Refina tu búsqueda si no ves lo que buscas</p>}
  </div>;
}
