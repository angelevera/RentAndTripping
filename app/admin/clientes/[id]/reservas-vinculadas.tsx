import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listarReservasDeCliente, type FilaReservaCliente } from "@/lib/clientes/detalle";
import { ETIQUETAS_ESTADO_PROVEEDOR, ETIQUETAS_TIPO, etiquetaDesde } from "@/lib/validation/reservas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonDesvincular } from "./boton-desvincular";

function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

const FORMATO_USD = new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" });
function Monto({ fila }: { fila: FilaReservaCliente }) {
  return fila.moneda === "VES" ? <Link href={`/admin/reservas/${fila.id}/editar`} className="text-primary underline-offset-2 hover:underline">En Bs · ver detalle</Link> : <>{FORMATO_USD.format(fila.precio)}</>;
}
function BadgeProveedor({ estado }: { estado: string }) {
  const clase = estado === "confirmada" ? "bg-green-50 text-green-700" : estado === "con_problema" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-700";
  return <Badge className={clase}>{etiquetaDesde(ETIQUETAS_ESTADO_PROVEEDOR, estado)}</Badge>;
}
function BadgePago({ pagado }: { pagado: boolean }) {
  return <Badge className={pagado ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700"}>{pagado ? "Pagado" : "Pendiente"}</Badge>;
}

export function ReservasVinculadasSkeleton() {
  return <div className="flex flex-col gap-2" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
}

function ReservaInfo({ fila }: { fila: FilaReservaCliente }) {
  return <><div className="flex flex-wrap gap-2"><BadgeProveedor estado={fila.estadoProveedor} /><BadgePago pagado={fila.pagado} /></div><p>{etiquetaDesde(ETIQUETAS_TIPO, fila.tipo)} · {formatearFecha(fila.fechaImportante)}</p><p className="font-medium"><Monto fila={fila} /></p></>;
}

export async function ReservasVinculadas({ clienteId }: { clienteId: string }) {
  const supabase = await createClient();
  const { filas, error } = await listarReservasDeCliente(supabase, { clienteId });
  if (error) return <div className="flex flex-col items-start gap-3 py-8" role="alert"><p className="text-red-700">No se pudo cargar la lista. Actualiza la página o inténtalo de nuevo en un momento.</p><Button asChild variant="outline" className="min-h-11"><Link href={`/admin/clientes/${clienteId}`}>Reintentar</Link></Button></div>;
  if (filas.length === 0) return <p className="py-6 text-muted-foreground">Este cliente todavía no tiene reservas vinculadas. Búscalas abajo.</p>;

  return <>
    <div className="hidden sm:block"><Table><TableHeader><TableRow><TableHead>Estado proveedor</TableHead><TableHead>Estado pago</TableHead><TableHead>Tipo</TableHead><TableHead>Fecha importante</TableHead><TableHead>Monto</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader><TableBody>{filas.map((fila) => <TableRow key={fila.id} data-testid="reserva-vinculada" data-reserva-id={fila.id}><TableCell><BadgeProveedor estado={fila.estadoProveedor} /></TableCell><TableCell><BadgePago pagado={fila.pagado} /></TableCell><TableCell>{etiquetaDesde(ETIQUETAS_TIPO, fila.tipo)}</TableCell><TableCell>{formatearFecha(fila.fechaImportante)}</TableCell><TableCell><Monto fila={fila} /></TableCell><TableCell><BotonDesvincular clienteId={clienteId} reservaId={fila.id} /></TableCell></TableRow>)}</TableBody></Table></div>
    <div className="flex flex-col gap-4 sm:hidden">{filas.map((fila) => <Card key={fila.id} data-testid="reserva-vinculada" data-reserva-id={fila.id} className="flex flex-col gap-3 p-4"><ReservaInfo fila={fila} /><BotonDesvincular clienteId={clienteId} reservaId={fila.id} /></Card>)}</div>
  </>;
}
