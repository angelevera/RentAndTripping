import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { listarReservasCliente, type FilaReservaCliente } from "@/lib/reservas/listar-cliente";
import { createClient } from "@/lib/supabase/server";
import { ETIQUETAS_ESTADO_PROVEEDOR, ETIQUETAS_TIPO, etiquetaDesde } from "@/lib/validation/reservas";
import { WhatsappCta } from "@/components/whatsapp-cta";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BADGE_GRIS = "bg-gray-100 text-gray-700";

const BADGE_VERDE = "bg-green-50 text-green-700";

const BADGE_ROJO = "bg-red-50 text-red-700";

function claseBadgeProveedor(estado: string): string {
  if (estado === "confirmada") return BADGE_VERDE;

  if (estado === "con_problema") return BADGE_ROJO;

  return BADGE_GRIS;
}

function BadgeProveedor({ estado }: { estado: string }) {
  return <Badge className={claseBadgeProveedor(estado)}>{etiquetaDesde(ETIQUETAS_ESTADO_PROVEEDOR, estado)}</Badge>;
}

function BadgePago({ pagado }: { pagado: boolean }) {
  return <Badge className={pagado ? BADGE_VERDE : BADGE_GRIS}>{pagado ? "Pagado" : "Pendiente"}</Badge>;
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";

  const [anio, mes, dia] = fecha.split("-");

  return `${dia}/${mes}/${anio}`;
}

const FORMATO_USD = new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" });

const FORMATO_VES = new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES" });

function Monto({ fila }: { fila: FilaReservaCliente }) {
  return <>{(fila.moneda === "VES" ? FORMATO_VES : FORMATO_USD).format(fila.precio)}</>;
}

function InfoViajero({ fila }: { fila: FilaReservaCliente }) {
  return fila.viajeroNombre ? (
    <p className="text-sm text-muted-foreground">{`Para: ${fila.viajeroNombre}`}</p>
  ) : null;
}

function Insignias({ fila }: { fila: FilaReservaCliente }) {
  return <div className="flex flex-wrap gap-2"><BadgeProveedor estado={fila.estadoProveedor} /><BadgePago pagado={fila.pagado} /></div>;
}

function TablaReservasCliente({ filas }: { filas: FilaReservaCliente[] }) {
  return <div className="hidden sm:block"><Table>
    <TableHeader><TableRow><TableHead>Estado proveedor</TableHead><TableHead>Estado pago</TableHead><TableHead>Tipo</TableHead><TableHead>Fecha importante</TableHead><TableHead>Monto</TableHead></TableRow></TableHeader>
    <TableBody>{filas.map((fila) => <TableRow key={fila.id} data-testid="reserva-cliente" data-reserva-id={fila.id}>
      <TableCell><BadgeProveedor estado={fila.estadoProveedor} /></TableCell><TableCell><BadgePago pagado={fila.pagado} /></TableCell>
      <TableCell>{etiquetaDesde(ETIQUETAS_TIPO, fila.tipo)}</TableCell><TableCell>{formatearFecha(fila.fechaImportante)}</TableCell><TableCell><Monto fila={fila} /><InfoViajero fila={fila} /></TableCell>
    </TableRow>)}</TableBody>
  </Table></div>;
}

function TarjetasReservasCliente({ filas }: { filas: FilaReservaCliente[] }) {
  return <div className="flex flex-col gap-4 sm:hidden">{filas.map((fila) => <Card key={fila.id} data-testid="reserva-cliente" data-reserva-id={fila.id} className="min-h-11 gap-3 p-4">
    <Insignias fila={fila} />
    <p className="text-sm">{etiquetaDesde(ETIQUETAS_TIPO, fila.tipo)} · {formatearFecha(fila.fechaImportante)}</p>
    <span className="font-medium"><Monto fila={fila} /></span><InfoViajero fila={fila} />
  </Card>)}</div>;
}

function fechaDeHoyEnCaracas(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
}

function dividirPorFecha(filas: FilaReservaCliente[]) {
  const hoy = fechaDeHoyEnCaracas();

  return {
    proximas: filas.filter((fila) => !fila.fechaImportante || fila.fechaImportante >= hoy),
    historial: filas.filter((fila) => Boolean(fila.fechaImportante) && fila.fechaImportante! < hoy),
  };
}

function SeccionReservas({ titulo, filas }: { titulo: string; filas: FilaReservaCliente[] }) {
  return <section className="flex flex-col gap-4"><h2 className="font-display text-xl font-bold">{titulo}</h2>
    {filas.length === 0 ? <p className="text-muted-foreground">{titulo === "Próximas" ? "Por ahora no tienes reservas próximas." : "Tu historial está vacío por ahora."}</p> : <><TablaReservasCliente filas={filas} /><TarjetasReservasCliente filas={filas} /></>}
  </section>;
}

function EstadoVacioCliente() {
  return <div className="flex flex-col items-center gap-4 py-12 text-center"><h2 className="font-display text-xl font-bold">¿Para dónde vamos ahora?</h2><p className="text-muted-foreground">Cuéntanos para dónde quieres ir y te ayudamos a organizarlo todo.</p><WhatsappCta /></div>;
}

function ListaErrorCliente() {
  return <div className="flex flex-col items-start gap-3 py-8" role="alert"><p className="text-red-700">Se nos fue algo cargando la lista. Actualiza la página o prueba de nuevo en un ratico.</p><Button asChild variant="outline" className="min-h-11"><Link href="/cliente">Reintentar</Link></Button></div>;
}

export function ListaReservasClienteSkeleton() {
  return <div className="flex flex-col gap-2" aria-hidden="true">{Array.from({ length: 5 }, (_, indice) => <Skeleton key={indice} className="h-16 w-full rounded-xl" />)}</div>;
}

export async function ListaReservasCliente({ clienteId }: { clienteId: string }) {
  const supabase = await createClient();
  const { filas, error } = await listarReservasCliente(supabase, clienteId);

  if (error) return <ListaErrorCliente />;

  if (filas.length === 0) return <EstadoVacioCliente />;

  const { proximas, historial } = dividirPorFecha(filas);

  return <><SeccionReservas titulo="Próximas" filas={proximas} /><Separator /><SeccionReservas titulo="Historial" filas={historial} /></>;
}
