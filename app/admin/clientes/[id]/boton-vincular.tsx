"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { vincularReservaAction } from "../actions";

export function BotonVincular({ clienteId, reservaId }: { clienteId: string; reservaId: string }) {
  const [estado, formAction, pendiente] = useActionState(vincularReservaAction.bind(null, clienteId, reservaId), {});
  return <form data-testid={`form-vincular-${reservaId}`} action={formAction} className="flex flex-col items-start gap-2">
    {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
    <Button type="submit" className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95" disabled={pendiente}>{pendiente ? "Vinculando…" : "Vincular"}</Button>
  </form>;
}
