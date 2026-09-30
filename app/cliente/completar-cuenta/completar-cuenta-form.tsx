"use client";

import Link from "next/link";
import { useActionState, useRef, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  esquemaCompletarCuenta,
  type DatosCompletarCuenta,
} from "@/lib/validation/completar-cuenta";
import { guardarContrasena, type EstadoCompletarCuenta } from "./actions";

const estadoInicial: EstadoCompletarCuenta = {};

export function CompletarCuentaForm() {
  const [estado, formAction, pendiente] = useActionState(guardarContrasena, estadoInicial);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<DatosCompletarCuenta>({
    resolver: zodResolver(esquemaCompletarCuenta),
    mode: "onTouched",
    defaultValues: { password: "", confirmarPassword: "" },
  });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    form.handleSubmit(() => {
      startTransition(() => {
        if (formRef.current) formAction(new FormData(formRef.current));
      });
    })(event);
  };

  const errorPassword = form.formState.errors.password?.message ?? estado.errores?.password;

  const errorConfirmar =
    form.formState.errors.confirmarPassword?.message ?? estado.errores?.confirmarPassword;

  const mostrarBannerError = Boolean(estado.error) && !errorPassword && !errorConfirmar;

  if (estado.ok) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>¡Listo! Ya puedes ver tus reservas.</p>
        <Button asChild className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95">
          <Link href="/cliente">Ver mis reservas</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      data-testid="form-completar-cuenta"
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-4"
    >
      {mostrarBannerError && (
        <Alert variant="destructive">
          <AlertDescription>{estado.error}</AlertDescription>
        </Alert>
      )}

      <Field data-invalid={Boolean(errorPassword)}>
        <FieldLabel htmlFor="password">Nueva contraseña</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errorPassword)}
          aria-describedby={errorPassword ? "password-error" : undefined}
          className="min-h-11 text-[17px]"
          {...form.register("password")}
        />
        <FieldError id="password-error" errors={[errorPassword ? { message: errorPassword } : undefined]} />
      </Field>

      <Field data-invalid={Boolean(errorConfirmar)}>
        <FieldLabel htmlFor="confirmarPassword">Confirmar contraseña</FieldLabel>
        <Input
          id="confirmarPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errorConfirmar)}
          aria-describedby={errorConfirmar ? "confirmarPassword-error" : undefined}
          className="min-h-11 text-[17px]"
          {...form.register("confirmarPassword")}
        />
        <FieldError
          id="confirmarPassword-error"
          errors={[errorConfirmar ? { message: errorConfirmar } : undefined]}
        />
      </Field>

      <Button
        type="submit"
        disabled={pendiente}
        className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95"
      >
        {pendiente ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
