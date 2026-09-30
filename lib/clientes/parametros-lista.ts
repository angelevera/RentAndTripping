export type ParametrosClientes = {
  q: string;
  pagina: number;
};

type ValoresBusqueda = Record<string, string | string[] | undefined>;

function primero(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? "" : valor ?? "";
}

export function leerParametrosClientes(searchParams: ValoresBusqueda): ParametrosClientes {
  const q = primero(searchParams.q).trim().slice(0, 100);
  const paginaCruda = primero(searchParams.pagina);
  const valorPagina = /^\d+$/.test(paginaCruda) ? Number(paginaCruda) : 1;

  return {
    q,
    pagina: Number.isSafeInteger(valorPagina) ? Math.min(10000, Math.max(1, valorPagina)) : 10000,
  };
}

export function hayBusquedaClientes(parametros: ParametrosClientes): boolean {
  return Boolean(parametros.q);
}

export function parametrosClientesAQuery(
  parametros: ParametrosClientes,
  cambios: Partial<ParametrosClientes> = {},
): string {
  const valores = { ...parametros, ...cambios };
  const query = new URLSearchParams();

  if (valores.q) query.set("q", valores.q);
  if (valores.pagina > 1) query.set("pagina", String(valores.pagina));

  return query.toString();
}
