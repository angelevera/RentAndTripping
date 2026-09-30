"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { desvincularReservaAction } from "../actions";

export function BotonDesvincular({ clienteId, reservaId }: { clienteId: string; reservaId: string }) {
  const [estado, formAction, pendiente] = useActionState(desvincularReservaAction.bind(null, clienteId, reservaId), {});
  return <form data-testid={`form-desvincular-${reservaId}`} action={formAction} className="flex flex-col items-start gap-2">
    {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
    <Button type="submit" variant="outline" className="min-h-11" disabled={pendiente}>{pendiente ? "Desvinculando…" : "Desvincular"}</Button>
  </form>;
}
