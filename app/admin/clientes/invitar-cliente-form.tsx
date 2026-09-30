"use client";

import { useState, useRef, useTransition } from "react";
import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { esquemaInvitarCliente, type DatosInvitarCliente } from "@/lib/validation/clientes";
import { invitarClienteAction, type EstadoFormularioCliente } from "./actions";

const estadoInicial: EstadoFormularioCliente = {};

export function InvitarClienteForm() {
  const [abierto, setAbierto] = useState(false);
  const [estado, formAction, pendiente] = useActionState(invitarClienteAction, estadoInicial);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<DatosInvitarCliente>({
    resolver: zodResolver(esquemaInvitarCliente),
    mode: "onTouched",
    defaultValues: { nombre: "", email: "" },
  });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.handleSubmit(() => {
      startTransition(() => {
        if (formRef.current) formAction(new FormData(formRef.current));
      });
    })(event);
  };

  const errorNombre = form.formState.errors.nombre?.message ?? estado.errores?.nombre;
  const errorEmail = form.formState.errors.email?.message ?? estado.errores?.email;
  const mostrarBannerError = Boolean(estado.error) && !errorNombre && !errorEmail;

  return (
    <div className="flex flex-col items-start gap-4">
      {!abierto && <Button id="invitar-cliente" type="button" onClick={() => setAbierto(true)} className="min-h-11 w-fit rounded-full bg-primary text-primary-foreground active:scale-95">Invitar cliente</Button>}
      <form data-testid="form-invitar-cliente" ref={formRef} action={formAction} onSubmit={onSubmit} hidden={!abierto} className="flex w-full flex-col gap-4 rounded-xl border p-4 sm:p-6">
      <Field data-invalid={Boolean(errorNombre)}>
        <FieldLabel htmlFor="nombre">Nombre completo</FieldLabel>
        <Input id="nombre" autoComplete="name" className="min-h-11" aria-invalid={Boolean(errorNombre)} {...form.register("nombre")} />
        <FieldError errors={errorNombre ? [{ message: errorNombre }] : []} />
      </Field>
      <Field data-invalid={Boolean(errorEmail)}>
        <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
        <Input id="email" type="email" autoComplete="email" className="min-h-11" aria-invalid={Boolean(errorEmail)} {...form.register("email")} />
        <FieldError errors={errorEmail ? [{ message: errorEmail }] : []} />
      </Field>
      {mostrarBannerError && (
        <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-700">
          <AlertDescription className="text-red-700">{estado.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pendiente} className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95">
          {pendiente ? "Enviando…" : "Enviar invitación"}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setAbierto(false)}>Cancelar</Button>
      </div>
      </form>
    </div>
  );
}
