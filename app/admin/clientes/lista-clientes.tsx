import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listarClientes, type FilaListaCliente } from "@/lib/clientes/listar";
import { hayBusquedaClientes, parametrosClientesAQuery, type ParametrosClientes } from "@/lib/clientes/parametros-lista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BotonReenviar } from "./boton-reenviar";

export function ListaClientesSkeleton() {
  return <div className="flex flex-col gap-2" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
}

function Acciones({ fila }: { fila: FilaListaCliente }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" className="min-h-11"><Link href={`/admin/clientes/${fila.id}`}>Ver detalle</Link></Button>
      {fila.invitacionPendiente && fila.email && <BotonReenviar userId={fila.id} email={fila.email} nombre={fila.nombre} />}
    </div>
  );
}

function EstadoInvitacion({ pendiente }: { pendiente: boolean }) {
  return pendiente ? <Badge className="bg-gray-100 text-gray-700">Invitación pendiente</Badge> : <span className="text-sm text-muted-foreground">Activa</span>;
}

function TablaClientes({ filas }: { filas: FilaListaCliente[] }) {
  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader><TableRow><TableHead>Estado</TableHead><TableHead>Nombre</TableHead><TableHead>Correo</TableHead><TableHead>Teléfono</TableHead><TableHead>Reservas</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader>
        <TableBody>{filas.map((fila) => (
          <TableRow key={fila.id} data-testid="fila-cliente" data-cliente-id={fila.id}>
            <TableCell><EstadoInvitacion pendiente={fila.invitacionPendiente} /></TableCell>
            <TableCell><span className="block max-w-[12rem] truncate" title={fila.nombre}>{fila.nombre}</span></TableCell>
            <TableCell>{fila.email ?? "—"}</TableCell><TableCell>{fila.telefono ?? "—"}</TableCell>
            <TableCell>{`${fila.cantidadReservas} ${fila.cantidadReservas === 1 ? "reserva" : "reservas"}`}</TableCell>
            <TableCell><Acciones fila={fila} /></TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </div>
  );
}

function TarjetasClientes({ filas }: { filas: FilaListaCliente[] }) {
  return <div className="flex flex-col gap-4 sm:hidden">{filas.map((fila) => (
    <Card key={fila.id} data-testid="fila-cliente" data-cliente-id={fila.id} className="flex flex-col gap-3 p-4">
      <EstadoInvitacion pendiente={fila.invitacionPendiente} />
      <h2 className="font-medium break-words">{fila.nombre}</h2>
      {fila.email && <p className="text-sm break-all">{fila.email}</p>}
      {fila.telefono && <p className="text-sm">{fila.telefono}</p>}
      <p className="text-sm text-muted-foreground">{`${fila.cantidadReservas} ${fila.cantidadReservas === 1 ? "reserva" : "reservas"}`}</p>
      <Acciones fila={fila} />
    </Card>
  ))}</div>;
}

function ListaVacia() {
  return <div className="flex flex-col items-center gap-4 py-12 text-center">
    <h2 className="font-display text-xl font-bold">Todavía no hay clientes con cuenta</h2>
    <p className="max-w-xl text-muted-foreground">Invita al primero para que pueda ver sus reservas sin escribirte por WhatsApp.</p>
    <Link href="#invitar-cliente" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">Invitar cliente</Link>
  </div>;
}

function ListaFiltradaVacia() {
  return <div className="flex flex-col items-center gap-3 py-12 text-center">
    <h2 className="font-display text-xl font-bold">No hay clientes que coincidan</h2>
    <p className="text-muted-foreground">Prueba con otro nombre, correo o teléfono.</p>
    <Link href="/admin/clientes" className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">Quitar búsqueda</Link>
  </div>;
}

function ListaError({ parametros }: { parametros: ParametrosClientes }) {
  return <div className="flex flex-col items-start gap-3 py-8" role="alert">
    <p className="text-red-700">No se pudo cargar la lista. Actualiza la página o inténtalo de nuevo en un momento.</p>
    <Button asChild variant="outline" className="min-h-11"><Link href={`/admin/clientes?${parametrosClientesAQuery(parametros)}`}>Reintentar</Link></Button>
  </div>;
}

function Paginacion({ parametros, pagina, totalPaginas }: { parametros: ParametrosClientes; pagina: number; totalPaginas: number }) {
  if (totalPaginas <= 1) return null;
  const href = (numero: number) => `/admin/clientes?${parametrosClientesAQuery(parametros, { pagina: numero })}`;
  return <nav aria-label="Paginación de clientes" className="flex items-center justify-between gap-3 pt-4">
    {pagina > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={href(pagina - 1)}>Anterior</Link></Button> : <Button variant="outline" className="min-h-11" disabled>Anterior</Button>}
    <span className="text-sm text-muted-foreground">Página {pagina} de {totalPaginas}</span>
    {pagina < totalPaginas ? <Button asChild variant="outline" className="min-h-11"><Link href={href(pagina + 1)}>Siguiente</Link></Button> : <Button variant="outline" className="min-h-11" disabled>Siguiente</Button>}
  </nav>;
}

export async function ListaClientes({ parametros }: { parametros: ParametrosClientes }) {
  const supabase = await createClient();
  const resultado = await listarClientes(supabase, parametros);
  if (resultado.error) return <ListaError parametros={parametros} />;
  if (resultado.filas.length === 0) return hayBusquedaClientes(parametros) ? <ListaFiltradaVacia /> : <ListaVacia />;

  return <>
    <TablaClientes filas={resultado.filas} />
    <TarjetasClientes filas={resultado.filas} />
    <Paginacion parametros={parametros} pagina={resultado.pagina} totalPaginas={resultado.totalPaginas} />
  </>;
}
