import {
  ESTADOS_PROVEEDOR,
  TIPOS_RESERVA,
} from "@/lib/validation/reservas";

export type ParametrosLista = {
  q: string;
  estado?: (typeof ESTADOS_PROVEEDOR)[number];
  tipo?: (typeof TIPOS_RESERVA)[number];
  pagina: number;
};

type ValoresBusqueda = Record<string, string | string[] | undefined>;

function primero(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

export function leerParametrosLista(searchParams: ValoresBusqueda): ParametrosLista {
  const q = primero(searchParams.q).trim().slice(0, 100);
  const estadoCrudo = primero(searchParams.estado);
  const tipoCrudo = primero(searchParams.tipo);
  const paginaCruda = primero(searchParams.pagina);
  const valorPagina = /^\d+$/.test(paginaCruda) ? Number(paginaCruda) : 1;

  const parametros: ParametrosLista = {
    q,
    pagina: Number.isSafeInteger(valorPagina) ? Math.min(10000, Math.max(1, valorPagina)) : 10000,
  };

  const estado = ESTADOS_PROVEEDOR.find((valor) => valor === estadoCrudo);

  if (estado) parametros.estado = estado;

  const tipo = TIPOS_RESERVA.find((valor) => valor === tipoCrudo);

  if (tipo) parametros.tipo = tipo;

  return parametros;
}

export function hayFiltros(parametros: ParametrosLista): boolean {
  return Boolean(parametros.q || parametros.estado || parametros.tipo);
}

export function parametrosAQuery(
  parametros: ParametrosLista,
  cambios: Partial<ParametrosLista> = {},
): string {
  const valores = { ...parametros, ...cambios };
  const query = new URLSearchParams();

  if (valores.q) query.set("q", valores.q);

  if (valores.estado) query.set("estado", valores.estado);

  if (valores.tipo) query.set("tipo", valores.tipo);

  if (valores.pagina > 1) query.set("pagina", String(valores.pagina));

  return query.toString();
}

export function escaparPatronLike(texto: string): string {
  return texto.replace(/\*/g, "").replace(/[\\%_]/g, "\\$&");
}
