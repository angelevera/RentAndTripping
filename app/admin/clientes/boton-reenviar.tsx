"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { reenviarInvitacionAction } from "./actions";

export function BotonReenviar({ userId, email, nombre }: { userId: string; email: string; nombre: string }) {
  const [estado, formAction, pendiente] = useActionState(
    reenviarInvitacionAction.bind(null, userId, email, nombre),
    {},
  );

  return (
    <form data-testid={`form-reenviar-${userId}`} action={formAction} className="flex flex-col items-start gap-2">
      {estado.error && <p role="alert" className="text-sm text-red-700">{estado.error}</p>}
      <Button type="submit" variant="outline" className="min-h-11" disabled={pendiente}>
        {pendiente ? "Reenviando…" : "Reenviar"}
      </Button>
    </form>
  );
}
