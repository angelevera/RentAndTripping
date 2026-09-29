"use client";

import { useActionState } from "react";
import { crearReserva, type EstadoFormularioReserva } from "./actions";

const estadoInicial: EstadoFormularioReserva = {};

export function ReservaForm() {
  const [estado, formAction, pendiente] = useActionState(crearReserva, estadoInicial);
  const error = (campo: string) => estado.errores?.[campo];
  const hayErroresCampo = Boolean(estado.errores && Object.keys(estado.errores).length);

  function campo(label: string, name: string, type = "text", inputMode?: "decimal" | "email") {
    const mensaje = error(name);
    const id = name.replaceAll(".", "-");

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          aria-describedby={mensaje ? `${id}-error` : undefined}
          className="min-h-11 rounded border border-gray-300 px-3 text-[17px]"
        />
        {mensaje && <p id={`${id}-error`} className="text-sm text-red-700">{mensaje}</p>}
      </div>
    );
  }

  return (
    <form data-testid="form-crear-reserva" action={formAction} className="flex flex-col gap-4">
      {estado.error && !hayErroresCampo && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{estado.error}</p>
      )}
      <input type="hidden" name="detalle.tipo" value="pasaje" />
      <h2 className="text-lg font-medium">Quién paga</h2>
      {campo("Nombre completo", "pagadorNombre")}
      {campo("Teléfono", "pagadorTelefono", "tel")}
      {campo("Correo (opcional)", "pagadorEmail", "email", "email")}
      <h2 className="text-lg font-medium">Pasaje aéreo</h2>
      {campo("Aerolínea", "detalle.aerolinea")}
      {campo("Origen", "detalle.origen")}
      {campo("Destino", "detalle.destino")}
      {campo("Fecha de vuelo", "detalle.fechaVuelo", "date")}
      {campo("Número de reserva (PNR)", "detalle.pnr")}
      {campo("Precio", "precio", "number", "decimal")}
      <div className="flex flex-col gap-1">
        <label htmlFor="moneda" className="text-sm font-medium">Moneda</label>
        <select id="moneda" name="moneda" defaultValue="USD" className="min-h-11 rounded border border-gray-300 px-3 text-[17px]">
          <option value="USD">USD</option>
          <option value="VES">VES</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="fechaImportante" className="text-sm font-medium">Fecha importante (opcional)</label>
        <input id="fechaImportante" name="fechaImportante" type="date" aria-describedby="fechaImportante-ayuda" className="min-h-11 rounded border border-gray-300 px-3 text-[17px]" />
        <p id="fechaImportante-ayuda" className="text-sm text-gray-600">Déjala en blanco si todavía no la sabes; se puede agregar después.</p>
        {error("fechaImportante") && <p id="fechaImportante-error" className="text-sm text-red-700">{error("fechaImportante")}</p>}
      </div>
      <button type="submit" disabled={pendiente} className="min-h-11 rounded-full bg-marca px-4 py-2 font-medium text-white active:scale-95 disabled:opacity-70">
        {pendiente ? "Guardando…" : "Guardar reserva"}
      </button>
    </form>
  );
}
