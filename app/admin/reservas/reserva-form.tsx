"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Controller, useForm, useWatch, type Control, type DefaultValues, type FieldPath, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ETIQUETAS_TIPO,
  esquemaEdicionReserva,
  esquemaReserva,
  TIPOS_RESERVA,
  type DatosEdicionReserva,
  type EntradaEdicionReserva,
} from "@/lib/validation/reservas";
import type { EstadoFormularioReserva } from "./actions";

const valoresVacios: DefaultValues<EntradaEdicionReserva> = {
  pagadorNombre: "",
  pagadorTelefono: "",
  pagadorEmail: "",
  esParaOtraPersona: false,
  viajeroNombre: "",
  viajeroTelefono: "",
  precio: "",
  moneda: "USD",
  fechaImportante: "",
  detalle: {
    tipo: "pasaje",
    aerolinea: "",
    origen: "",
    destino: "",
    fechaVuelo: "",
    pnr: "",
    cantidadPersonas: "1",
    viajeros: "",
  },
  estadoProveedor: "pendiente",
  notaProblema: "",
};

/** Every server error path this form actually binds to a visible field. Anything
 * `estado.errores` returns outside this set (e.g. a bare "detalle" when the whole
 * object is missing, or "detalle.viajeros.2" for one bad name in the list) has no
 * field to attach to and must fall back to the top-level Alert instead of vanishing. */
const CAMPOS_CONOCIDOS = new Set<string>([
  "pagadorNombre", "pagadorTelefono", "pagadorEmail", "esParaOtraPersona",
  "viajeroNombre", "viajeroTelefono", "precio", "moneda", "fechaImportante",
  "detalle.tipo", "detalle.aerolinea", "detalle.origen", "detalle.destino",
  "detalle.fechaVuelo", "detalle.pnr", "detalle.nombre", "detalle.checkIn",
  "detalle.checkOut", "detalle.nota", "detalle.fecha", "detalle.evento",
  "detalle.cantidadPersonas", "detalle.viajeros",
  "estadoProveedor", "notaProblema",
]);

type AccionReserva = (
  previo: EstadoFormularioReserva,
  formData: FormData,
) => Promise<EstadoFormularioReserva>;

type ReservaFormProps = {
  modo: "crear" | "editar";
  accion: AccionReserva;
  valoresIniciales?: ValoresFormularioReserva;
};

export type ValoresFormularioReserva = DefaultValues<EntradaEdicionReserva> & {
  estadoProveedor?: string;
  notaProblema?: string;
};

type ControlReserva = Control<EntradaEdicionReserva, unknown, DatosEdicionReserva>;

type CampoProps = {
  control: ControlReserva;
  name: FieldPath<EntradaEdicionReserva>;
  label: string;
  type?: "text" | "tel" | "email" | "date" | "number";
  description?: string;
  inputMode?: "decimal";
  step?: string;
  min?: string;
  max?: string;
  rows?: number;
  erroresServidor?: Record<string, string>;
};

/**
 * A server-rendered error (from the previous action response) is the ONLY error
 * a no-JavaScript submission can ever show: `fieldState.error` is populated by
 * `form.setError()` inside a `useEffect`, which never runs before hydration and
 * never runs at all without JS. Once the field is touched, RHF's own "onTouched"
 * revalidation has an authoritative opinion (defined or not) that must win over
 * the stale server snapshot, so a corrected field stops showing the old message.
 */
function mensajeCampo(
  fieldState: { error?: { message?: string }; isTouched: boolean },
  erroresServidor: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (fieldState.error?.message) return fieldState.error.message;

  if (fieldState.isTouched) return undefined;

  return erroresServidor?.[name];
}

function Campo({ control, name, label, type = "text", description, inputMode, step, min, max, rows, erroresServidor }: CampoProps) {
  const id = name.replaceAll(".", "-");

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const mensaje = mensajeCampo(fieldState, erroresServidor, name);
        const invalido = fieldState.invalid || Boolean(mensaje);

        return (
          <Field data-invalid={invalido}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {rows ? (
              <Textarea
                {...field}
                id={id}
                name={field.name}
                rows={rows}
                value={field.value == null ? "" : String(field.value)}
                aria-invalid={invalido}
                className="min-h-11 max-h-64 overflow-y-auto"
              />
            ) : (
              <Input
                {...field}
                id={id}
                name={field.name}
                type={type}
                inputMode={inputMode}
                step={step}
                min={min}
                max={max}
                value={field.value == null ? "" : String(field.value)}
                aria-invalid={invalido}
                className="min-h-11 text-[17px]"
              />
            )}
            {description && <FieldDescription>{description}</FieldDescription>}
            <FieldError errors={[mensaje ? { message: mensaje } : undefined]} />
          </Field>
        );
      }}
    />
  );
}

export function ReservaForm({ modo, accion, valoresIniciales }: ReservaFormProps) {
  const [estado, formAction, pendiente] = useActionState(accion, {});
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Both schemas validate the same rendered controls; create intentionally omits
  // provider status while edit requires it. The chosen resolver follows `modo`.
  // SAFETY: esquemaReserva simply doesn't declare estadoProveedor/notaProblema, so in
  // crear mode the resolver never sees or validates those two fields — RHF's generic
  // Resolver<T> type has no way to express "a resolver for a strict subset of T" without
  // this widening, but the runtime behavior (create never checks provider status) is exact.
  const resolver = (modo === "editar"
    ? zodResolver(esquemaEdicionReserva)
    : zodResolver(esquemaReserva)) as Resolver<EntradaEdicionReserva, unknown, DatosEdicionReserva>;

  const form = useForm<EntradaEdicionReserva, unknown, DatosEdicionReserva>({
    resolver,
    mode: "onTouched",
    defaultValues: { ...valoresVacios, ...valoresIniciales },
  });

  useEffect(() => {
    if (!estado.errores) return;

    for (const [path, message] of Object.entries(estado.errores)) {
      // SAFETY: estado.errores keys are dotted zod issue paths built server-side by
      // erroresPorCampo() from the create/edit schema this form resolves against, so
      // every key names a real field of EntradaEdicionReserva.
      form.setError(path as FieldPath<EntradaEdicionReserva>, { type: "server", message });
    }
  }, [estado.errores, form]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.handleSubmit(() => {
      startTransition(() => {
        if (formRef.current) formAction(new FormData(formRef.current));
      });
    })(event);
  };

  const tipo = useWatch({ control: form.control, name: "detalle.tipo" }) ?? "pasaje";
  const esParaOtraPersona = useWatch({ control: form.control, name: "esParaOtraPersona" });
  const estadoProveedor = useWatch({ control: form.control, name: "estadoProveedor" });
  const hayErroresCampo = Object.keys(form.formState.errors).length > 0 || Boolean(estado.errores && Object.keys(estado.errores).length);

  // Errors zod attaches to a path this form has no field for (e.g. a bare "detalle"
  // when the whole object is missing, or "detalle.viajeros.2" for one bad name) —
  // shown here instead of silently dropped, since no <Campo>/<Controller> would ever render them.
  const erroresSinCampo = estado.errores
    ? Object.entries(estado.errores).filter(([ruta]) => !CAMPOS_CONOCIDOS.has(ruta))
    : [];

  const etiquetaGuardar = modo === "crear" ? "Guardar reserva" : "Guardar cambios";
  const idFormulario = modo === "crear" ? "form-crear-reserva" : "form-editar-reserva";

  return (
    <form
      ref={formRef}
      data-testid={idFormulario}
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="mx-auto flex w-full max-w-2xl flex-col gap-8"
    >
      {modo === "editar" && (
        <Card className="p-6">
          <CardContent className="flex flex-col gap-4 p-0">
            <h2 id="titulo-estado-proveedor" className="font-display text-xl font-bold">Estado del proveedor</h2>
            <Controller
              control={form.control}
              name="estadoProveedor"
              render={({ field, fieldState }) => {
                const mensaje = mensajeCampo(fieldState, estado.errores, "estadoProveedor");

                const opciones = [
                  ["pendiente", "Pendiente"],
                  ["confirmada", "Confirmada con el proveedor"],
                  ["con_problema", "Con problema"],
                ] as const;

                return (
                  <Field data-invalid={fieldState.invalid || Boolean(mensaje)}>
                    <RadioGroup
                      name={field.name}
                      value={String(field.value ?? "pendiente")}
                      onValueChange={field.onChange}
                      aria-labelledby="titulo-estado-proveedor"
                      aria-invalid={fieldState.invalid || Boolean(mensaje)}
                      className="gap-1"
                    >
                      {opciones.map(([value, label]) => (
                        <FieldLabel key={value} htmlFor={`estadoProveedor-${value}`} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 font-normal">
                          <RadioGroupItem id={`estadoProveedor-${value}`} value={value} />
                          <span>{label}</span>
                        </FieldLabel>
                      ))}
                    </RadioGroup>
                    <FieldError errors={[mensaje ? { message: mensaje } : undefined]} />
                  </Field>
                );
              }}
            />
            {(estadoProveedor === "con_problema" || estado.errores?.notaProblema) && (
              <Campo
                control={form.control}
                name="notaProblema"
                label="¿Qué pasó?"
                rows={4}
                erroresServidor={estado.errores}
              />
            )}
          </CardContent>
        </Card>
      )}

      {estado.error && !hayErroresCampo && (
        <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-700">
          <AlertDescription className="text-red-700">{estado.error}</AlertDescription>
        </Alert>
      )}

      {erroresSinCampo.length > 0 && (
        <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-700">
          <AlertDescription className="text-red-700">
            {erroresSinCampo.map(([ruta, mensaje]) => <div key={ruta}>{mensaje}</div>)}
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6">
        <CardContent className="flex flex-col gap-6 p-0">
          <h2 className="font-display text-xl font-bold">Quién paga</h2>
          <Campo control={form.control} name="pagadorNombre" label="Nombre completo" erroresServidor={estado.errores} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo control={form.control} name="pagadorTelefono" label="Teléfono" type="tel" erroresServidor={estado.errores} />
            <Campo control={form.control} name="pagadorEmail" label="Correo (opcional)" type="email" erroresServidor={estado.errores} />
          </div>
          <Controller
            control={form.control}
            name="esParaOtraPersona"
            render={({ field, fieldState }) => {
              const mensaje = mensajeCampo(fieldState, estado.errores, "esParaOtraPersona");

              return (
                <Field orientation="horizontal" data-invalid={fieldState.invalid || Boolean(mensaje)} className="min-h-11 items-start">
                  <Checkbox
                    id="esParaOtraPersona"
                    name={field.name}
                    value="on"
                    checked={field.value === true || field.value === "on"}
                    onCheckedChange={(checked) => field.onChange(checked === true ? "on" : false)}
                    aria-invalid={fieldState.invalid || Boolean(mensaje)}
                    className="mt-1"
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="esParaOtraPersona">Es para otra persona</FieldLabel>
                    <FieldDescription>Márcalo solo si quien viaja no es quien paga.</FieldDescription>
                    <FieldError errors={[mensaje ? { message: mensaje } : undefined]} />
                  </div>
                </Field>
              );
            }}
          />
        </CardContent>
      </Card>

      {Boolean(esParaOtraPersona) && (
        <Card className="p-6">
          <CardContent className="flex flex-col gap-4 p-0">
            <h2 className="font-display text-xl font-bold">Quién viaja</h2>
            <Campo control={form.control} name="viajeroNombre" label="Nombre del viajero" erroresServidor={estado.errores} />
            <Campo
              control={form.control}
              name="viajeroTelefono"
              label="Teléfono del viajero"
              type="tel"
              description="Si el viajero no tiene cuenta, con el teléfono alcanza para ubicarlo — no hace falta correo."
              erroresServidor={estado.errores}
            />
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card className="p-6">
        <CardContent className="flex flex-col gap-6 p-0">
          <h2 className="font-display text-xl font-bold">Tipo de reserva</h2>
          <Controller
            control={form.control}
            name="detalle.tipo"
            render={({ field, fieldState }) => {
              const mensaje = mensajeCampo(fieldState, estado.errores, "detalle.tipo");

              return (
                <Field data-invalid={fieldState.invalid || Boolean(mensaje)}>
                  <FieldLabel htmlFor="detalle-tipo">Tipo de reserva</FieldLabel>
                  <Select name={field.name} value={String(field.value ?? "pasaje")} onValueChange={field.onChange}>
                    <SelectTrigger id="detalle-tipo" className="min-h-11 w-full" aria-invalid={fieldState.invalid || Boolean(mensaje)}>
                      <SelectValue placeholder="Elige un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_RESERVA.map((value) => (
                        <SelectItem key={value} value={value}>{ETIQUETAS_TIPO[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[mensaje ? { message: mensaje } : undefined]} />
                </Field>
              );
            }}
          />

          {tipo === "pasaje" && (
            <section className="flex flex-col gap-4" aria-labelledby="titulo-detalles">
              <h3 id="titulo-detalles" className="font-display text-xl font-bold">Detalles del pasaje</h3>
              <Campo control={form.control} name="detalle.aerolinea" label="Aerolínea" erroresServidor={estado.errores} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo control={form.control} name="detalle.origen" label="Origen" erroresServidor={estado.errores} />
                <Campo control={form.control} name="detalle.destino" label="Destino" erroresServidor={estado.errores} />
              </div>
              <Campo control={form.control} name="detalle.fechaVuelo" label="Fecha de vuelo" type="date" erroresServidor={estado.errores} />
              <Campo control={form.control} name="detalle.pnr" label="Número de reserva (PNR)" erroresServidor={estado.errores} />
            </section>
          )}
          {tipo === "hotel" && (
            <section className="flex flex-col gap-4" aria-labelledby="titulo-detalles">
              <h3 id="titulo-detalles" className="font-display text-xl font-bold">Detalles del hotel</h3>
              <Campo control={form.control} name="detalle.nombre" label="Nombre del hotel" erroresServidor={estado.errores} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo control={form.control} name="detalle.checkIn" label="Check-in" type="date" erroresServidor={estado.errores} />
                <Campo control={form.control} name="detalle.checkOut" label="Check-out" type="date" erroresServidor={estado.errores} />
              </div>
              <Campo control={form.control} name="detalle.nota" label="Nota (opcional)" rows={4} erroresServidor={estado.errores} />
            </section>
          )}
          {tipo === "tour" && (
            <section className="flex flex-col gap-4" aria-labelledby="titulo-detalles">
              <h3 id="titulo-detalles" className="font-display text-xl font-bold">Detalles del tour</h3>
              <Campo control={form.control} name="detalle.nombre" label="Nombre del tour" erroresServidor={estado.errores} />
              <Campo control={form.control} name="detalle.fecha" label="Fecha" type="date" erroresServidor={estado.errores} />
              <Campo control={form.control} name="detalle.nota" label="Nota (opcional)" rows={4} erroresServidor={estado.errores} />
            </section>
          )}
          {tipo === "entrada" && (
            <section className="flex flex-col gap-4" aria-labelledby="titulo-detalles">
              <h3 id="titulo-detalles" className="font-display text-xl font-bold">Detalles de la entrada</h3>
              <Campo control={form.control} name="detalle.evento" label="Evento" erroresServidor={estado.errores} />
              <Campo control={form.control} name="detalle.fecha" label="Fecha" type="date" erroresServidor={estado.errores} />
              <Campo control={form.control} name="detalle.nota" label="Nota (opcional)" rows={4} erroresServidor={estado.errores} />
            </section>
          )}

          <div className="flex flex-col gap-4">
            <Campo control={form.control} name="detalle.cantidadPersonas" label="Cantidad de personas" type="number" min="1" max="50" erroresServidor={estado.errores} />
            <Campo
              control={form.control}
              name="detalle.viajeros"
              label="Nombres de los viajeros (opcional)"
              description="Uno por línea. Útil cuando la reserva es para varias personas."
              rows={4}
              erroresServidor={estado.errores}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card className="p-6">
        <CardContent className="flex flex-col gap-6 p-0">
          <h2 className="font-display text-xl font-bold">Precio y moneda</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo control={form.control} name="precio" label="Precio" type="number" inputMode="decimal" step="0.01" erroresServidor={estado.errores} />
            <Controller
              control={form.control}
              name="moneda"
              render={({ field, fieldState }) => {
                const mensaje = mensajeCampo(fieldState, estado.errores, "moneda");

                return (
                  <Field data-invalid={fieldState.invalid || Boolean(mensaje)}>
                    <FieldLabel htmlFor="moneda">Moneda</FieldLabel>
                    <Select name={field.name} value={String(field.value ?? "USD")} onValueChange={field.onChange}>
                      <SelectTrigger id="moneda" className="min-h-11 w-full" aria-invalid={fieldState.invalid || Boolean(mensaje)}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="VES">VES</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError errors={[mensaje ? { message: mensaje } : undefined]} />
                  </Field>
                );
              }}
            />
          </div>
          <Campo
            control={form.control}
            name="fechaImportante"
            label="Fecha importante (opcional)"
            type="date"
            erroresServidor={estado.errores}
            description="Déjala en blanco si todavía no la sabes; se puede agregar después."
          />
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={pendiente}
        className="min-h-11 w-full rounded-full bg-marca px-6 text-base text-white transition-transform active:scale-95 sm:w-auto sm:self-end"
      >
        {pendiente ? "Guardando…" : etiquetaGuardar}
      </Button>
    </form>
  );
}
