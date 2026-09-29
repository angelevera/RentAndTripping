import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listarReservas, type FilaListaReserva } from "@/lib/reservas/listar";
import { hayFiltros, parametrosAQuery, type ParametrosLista } from "@/lib/reservas/parametros-lista";
import { ETIQUETAS_ESTADO_PROVEEDOR, ETIQUETAS_TIPO, etiquetaDesde } from "@/lib/validation/reservas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Clases de insignia semánticas del UI-SPEC — nunca el morado de marca, que
// está reservado para elementos interactivos (ver 02-UI-SPEC "Color").
const BADGE_GRIS = "bg-gray-100 text-gray-700";

const BADGE_VERDE = "bg-green-50 text-green-700";

const BADGE_ROJO = "bg-red-50 text-red-700";

function claseBadgeProveedor(estado: string): string {
  if (estado === "confirmada") return BADGE_VERDE;

  if (estado === "con_problema") return BADGE_ROJO;

  return BADGE_GRIS;
}

function BadgeProveedor({ estado }: { estado: string }) {
  return (
    <Badge className={claseBadgeProveedor(estado)}>
      {etiquetaDesde(ETIQUETAS_ESTADO_PROVEEDOR, estado)}
    </Badge>
  );
}

function BadgePago({ pagado }: { pagado: boolean }) {
  return (
    <Badge className={pagado ? BADGE_VERDE : BADGE_GRIS}>{pagado ? "Pagado" : "Pendiente"}</Badge>
  );
}

/**
 * "YYYY-MM-DD" → "DD/MM/YYYY" partiendo el string directamente — nunca por
 * un objeto Date, que en UTC-4 puede correr la fecha un día (nota del
 * Task 3 en el PLAN).
 */
function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";

  const [anio, mes, dia] = fecha.split("-");

  return `${dia}/${mes}/${anio}`;
}

const FORMATO_USD = new Intl.NumberFormat("es-VE", { style: "currency", currency: "USD" });

function Monto({ fila }: { fila: FilaListaReserva }) {
  if (fila.moneda === "VES") {
    // D-09: ningún monto se calcula a partir de un precio en bolívares —
    // el admin ve el detalle real en la página de edición, nunca una cifra
    // convertida aquí.
    return (
      <Link href={`/admin/reservas/${fila.id}/editar`} className="text-primary underline-offset-2 hover:underline">
        En Bs · ver detalle
      </Link>
    );
  }

  return <>{FORMATO_USD.format(fila.precio)}</>;
}

function Cliente({ fila, truncar }: { fila: FilaListaReserva; truncar: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={truncar ? "block max-w-[10rem] truncate" : undefined} title={truncar ? fila.pagadorNombre : undefined}>
        {fila.pagadorNombre}
      </span>
      {fila.viajeroNombre && (
        <span className="text-xs text-muted-foreground">Viaja: {fila.viajeroNombre}</span>
      )}
    </div>
  );
}

function BotonEditar({ id }: { id: string }) {
  return (
    <Button asChild variant="outline" className="min-h-11">
      <Link href={`/admin/reservas/${id}/editar`}>Editar</Link>
    </Button>
  );
}

export function ListaReservasSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: 5 }, (_, indice) => (
        <Skeleton key={indice} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

function TablaReservas({ filas }: { filas: FilaListaReserva[] }) {
  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Estado proveedor</TableHead>
            <TableHead>Estado pago</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha importante</TableHead>
            <TableHead>Monto (USD)</TableHead>
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((fila) => (
            <TableRow key={fila.id} data-testid="fila-reserva" data-reserva-id={fila.id} className="min-h-11">
              <TableCell>
                <BadgeProveedor estado={fila.estadoProveedor} />
              </TableCell>
              <TableCell>
                <BadgePago pagado={fila.pagado} />
              </TableCell>
              <TableCell>
                <Cliente fila={fila} truncar />
              </TableCell>
              <TableCell>{etiquetaDesde(ETIQUETAS_TIPO, fila.tipo)}</TableCell>
              <TableCell>{formatearFecha(fila.fechaImportante)}</TableCell>
              <TableCell>
                <Monto fila={fila} />
              </TableCell>
              <TableCell>
                <BotonEditar id={fila.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TarjetasReservas({ filas }: { filas: FilaListaReserva[] }) {
  return (
    <div className="flex flex-col gap-4 sm:hidden">
      {filas.map((fila) => (
        <Card
          key={fila.id}
          data-testid="fila-reserva"
          data-reserva-id={fila.id}
          className="min-h-11 gap-3 p-4"
        >
          <div className="flex flex-wrap gap-2">
            <BadgeProveedor estado={fila.estadoProveedor} />
            <BadgePago pagado={fila.pagado} />
          </div>
          <Cliente fila={fila} truncar={false} />
          <p className="text-sm text-muted-foreground">
            {etiquetaDesde(ETIQUETAS_TIPO, fila.tipo)} · {formatearFecha(fila.fechaImportante)}
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">
              <Monto fila={fila} />
            </span>
            <BotonEditar id={fila.id} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ListaVacia() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <h2 className="font-display text-xl font-bold">Todavía no hay reservas cargadas</h2>
      <p className="text-muted-foreground">
        Crea la primera para empezar a llevar el control aquí en vez de en WhatsApp.
      </p>
      <Button asChild className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95">
        <Link href="/admin/reservas/nueva">Crear reserva</Link>
      </Button>
    </div>
  );
}

function ListaError({ parametros }: { parametros: ParametrosLista }) {
  return (
    <div className="flex flex-col items-start gap-3 py-8" role="alert">
      <p className="text-red-700">
        No se pudieron cargar las reservas. Actualiza la página o inténtalo de nuevo en un momento.
      </p>
      <Button asChild variant="outline" className="min-h-11">
        <Link href={`/admin?${parametrosAQuery(parametros)}`}>Reintentar</Link>
      </Button>
    </div>
  );
}

function ListaFiltradaVacia() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <h2 className="font-display text-xl font-bold">No hay reservas que coincidan</h2>
      <p className="text-muted-foreground">Prueba con otro nombre o quita algún filtro.</p>
      <Link href="/admin" className="min-h-11 inline-flex items-center font-medium text-primary underline-offset-4 hover:underline">
        Quitar filtros
      </Link>
    </div>
  );
}

function Paginacion({ parametros, pagina, totalPaginas }: {
  parametros: ParametrosLista;
  pagina: number;
  totalPaginas: number;
}) {
  if (totalPaginas <= 1) return null;
  const anterior = pagina > 1;
  const siguiente = pagina < totalPaginas;
  const hrefAnterior = `/admin?${parametrosAQuery(parametros, { pagina: pagina - 1 })}`;
  const hrefSiguiente = `/admin?${parametrosAQuery(parametros, { pagina: pagina + 1 })}`;

  return (
    <nav aria-label="Paginación de reservas" className="flex items-center justify-between gap-3 pt-4">
      {anterior ? (
        <Button asChild variant="outline" className="min-h-11"><Link href={hrefAnterior}>Anterior</Link></Button>
      ) : (
        <Button variant="outline" className="min-h-11" disabled aria-disabled="true">Anterior</Button>
      )}
      <span className="text-sm text-muted-foreground">Página {pagina} de {totalPaginas}</span>
      {siguiente ? (
        <Button asChild variant="outline" className="min-h-11"><Link href={hrefSiguiente}>Siguiente</Link></Button>
      ) : (
        <Button variant="outline" className="min-h-11" disabled aria-disabled="true">Siguiente</Button>
      )}
    </nav>
  );
}

export async function ListaReservas({ parametros }: { parametros: ParametrosLista }) {
  const supabase = await createClient();
  const { filas, error, pagina, totalPaginas } = await listarReservas(supabase, parametros);

  if (error) return <ListaError parametros={parametros} />;

  if (filas.length === 0) return hayFiltros(parametros) ? <ListaFiltradaVacia /> : <ListaVacia />;

  return (
    <>
      <TablaReservas filas={filas} />
      <TarjetasReservas filas={filas} />
      <Paginacion parametros={parametros} pagina={pagina} totalPaginas={totalPaginas} />
    </>
  );
}
