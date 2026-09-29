"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Diccionario fijo de avisos — el valor crudo del query param nunca se
// renderiza; solo estas cuatro claves producen un toast, cualquier otro
// valor se ignora en silencio (T-02-10).
export const AVISOS = {
  creada: "Reserva creada. Ya la puedes ver en la lista.",
  guardada: "Cambios guardados.",
  confirmada: "Marcada como confirmada con el proveedor.",
  problema: "Marcada con problema.",
} as const satisfies Record<string, string>;

export function AvisoToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const mostrado = useRef(false);

  const aviso = searchParams.get("aviso");

  useEffect(() => {
    if (!aviso) return;

    if (!(aviso in AVISOS)) return;

    // La ref evita un segundo toast por el doble efecto de desarrollo
    // (React Strict Mode) — sin ella se mostraría duplicado en `next dev`.
    if (mostrado.current) return;
    mostrado.current = true;

    // SAFETY: la línea anterior (`aviso in AVISOS`) ya probó que `aviso` es
    // una de las cuatro claves literales de AVISOS, algo que el compilador
    // no puede inferir solo del `in` sobre un string proveniente de la URL.
    toast.success(AVISOS[aviso as keyof typeof AVISOS]);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("aviso");
    const resto = params.toString();
    router.replace(resto ? `${pathname}?${resto}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aviso]);

  return null;
}
