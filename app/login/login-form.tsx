"use client";

import { useActionState, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { esquemaLogin, type DatosLogin } from "@/lib/validation/auth";
import { iniciarSesion, type EstadoLogin } from "./actions";

const estadoInicial: EstadoLogin = {};

export function LoginForm() {
  const [estado, formAction, pendiente] = useActionState(iniciarSesion, estadoInicial);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<DatosLogin>({
    resolver: zodResolver(esquemaLogin),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.handleSubmit(() => {
      startTransition(() => {
        formAction(new FormData(formRef.current!));
      });
    })(event);
  };

  const errorEmail = form.formState.errors.email?.message ?? estado.errores?.email;
  const errorPassword = form.formState.errors.password?.message ?? estado.errores?.password;

  return (
    <form
      data-testid="form-login"
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-4"
    >
      {estado.error && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {estado.error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Correo
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-describedby={errorEmail ? "email-error" : undefined}
          className="min-h-11 rounded border border-gray-300 px-3 text-[17px]"
          {...form.register("email")}
        />
        {errorEmail && (
          <p id="email-error" className="text-sm text-red-700">
            {errorEmail}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-describedby={errorPassword ? "password-error" : undefined}
          className="min-h-11 rounded border border-gray-300 px-3 text-[17px]"
          {...form.register("password")}
        />
        {errorPassword && (
          <p id="password-error" className="text-sm text-red-700">
            {errorPassword}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pendiente}
        className="min-h-11 rounded-full bg-marca px-4 py-2 font-medium text-white active:scale-95 disabled:opacity-70"
      >
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
