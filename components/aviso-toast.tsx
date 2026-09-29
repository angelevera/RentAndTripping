"use client";

import { useEffect } from "react";
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

  const aviso = searchParams.get("aviso");

  useEffect(() => {
    if (!aviso) return;

    if (!(aviso in AVISOS)) return;

    // Sin ref de "ya mostrado": este componente vive en el layout raíz y
    // persiste entre navegaciones del cliente durante toda la sesión de la
    // pestaña, así que una ref que solo se pone en true nunca se vuelve a
    // resetear — el primer aviso se ve y todos los siguientes (crear otra
    // reserva, guardar otra edición) quedan silenciados para siempre. En
    // producción, React ejecuta este efecto exactamente una vez por cada
    // valor de `aviso` realmente nuevo (el propio `router.replace` de abajo
    // limpia el query param antes de que pueda llegar un valor repetido). El
    // único costo es un toast duplicado en `next dev` por el doble-invoke de
    // React Strict Mode (no ocurre en producción) — preferible a que el aviso
    // real deje de mostrarse después del primero.
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
