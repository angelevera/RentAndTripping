import { z } from "zod";

export const TIPOS_RESERVA = ["pasaje", "hotel", "tour", "entrada"] as const;

export const ETIQUETAS_TIPO: Record<(typeof TIPOS_RESERVA)[number], string> = {
  pasaje: "Pasaje aéreo",
  hotel: "Hotel",
  tour: "Tour",
  entrada: "Entrada",
};

export const MONEDAS = ["USD", "VES"] as const;

export const ESTADOS_PROVEEDOR = ["pendiente", "confirmada", "con_problema"] as const;

export const ETIQUETAS_ESTADO_PROVEEDOR: Record<(typeof ESTADOS_PROVEEDOR)[number], string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada con el proveedor",
  con_problema: "Con problema",
};

export function etiquetaDesde<T extends Record<string, string>>(mapa: T, valor: string): string {
  // SAFETY: los únicos llamadores (tipo y estado_proveedor) son columnas
  // `text` con CHECK, no enums de Postgres, así que el tipo generado es
  // `string` y no `keyof typeof mapa`. La aserción es segura porque la base
  // de datos ya acota esos valores a exactamente los literales de
  // TIPOS_RESERVA / ESTADOS_PROVEEDOR; `??` cubre igual una fila legacy
  // inesperada mostrando el valor crudo.
  return mapa[valor as keyof T] ?? valor;
}

const detallePasaje = z.object({
  tipo: z.literal("pasaje"),
  aerolinea: z.string().trim().min(1, { message: "Escribe la aerolínea." }),
  origen: z.string().trim().min(1, { message: "Escribe el origen." }),
  destino: z.string().trim().min(1, { message: "Escribe el destino." }),
  fechaVuelo: z.string().trim().min(1, { message: "Escribe la fecha de vuelo." }),
  pnr: z.string().trim().min(1, {
    message: "Falta el número de reserva de la aerolínea (PNR). Anótalo tal como te lo dio la aerolínea.",
  }),
});

const detalleHotel = z.object({
  tipo: z.literal("hotel"),
  nombre: z.string().trim().min(1, { message: "Escribe el nombre del hotel." }),
  checkIn: z.string().trim().min(1, { message: "Escribe la fecha de check-in." }),
  checkOut: z.string().trim().min(1, { message: "Escribe la fecha de check-out." }),
  nota: z.string().trim().optional(),
});

const detalleTour = z.object({
  tipo: z.literal("tour"),
  nombre: z.string().trim().min(1, { message: "Escribe el nombre del tour." }),
  fecha: z.string().trim().min(1, { message: "Escribe la fecha del tour." }),
  nota: z.string().trim().optional(),
});

const detalleEntrada = z.object({
  tipo: z.literal("entrada"),
  evento: z.string().trim().min(1, { message: "Escribe el nombre del evento." }),
  fecha: z.string().trim().min(1, { message: "Escribe la fecha del evento." }),
  nota: z.string().trim().optional(),
});

export const esquemaDetalle = z.discriminatedUnion("tipo", [
  detallePasaje, detalleHotel, detalleTour, detalleEntrada,
]);

const aBooleano = z.preprocess(
  (valor) => valor === true || valor === "true" || valor === "on",
  z.boolean(),
);

export const esquemaReserva = z.object({
  pagadorNombre: z.string().trim().min(1, { message: "Escribe el nombre de quien paga." }),
  pagadorTelefono: z.string().trim().min(1, { message: "Escribe un teléfono de contacto." }),
  pagadorEmail: z.string().trim().email({ message: "Escribe un correo válido." }).optional().or(z.literal("")),
  esParaOtraPersona: aBooleano,
  viajeroNombre: z.string().trim().optional(),
  viajeroTelefono: z.string().trim().optional(),
  // El precio puede llegar con coma decimal ("350,50") porque el input
  // nativo no la bloquea; String(...) normaliza cualquier valor de entrada
  // a texto (sin typeof) antes de reemplazar la coma y dejar que
  // z.coerce.number() establezca el valor de dominio.
  precio: z.preprocess(
    (valor) => String(valor ?? "").replace(",", "."),
    z.coerce.number().positive({ message: "El precio tiene que ser mayor a cero." }),
  ),
  moneda: z.enum(MONEDAS).default("USD"),
  fechaImportante: z.string().trim().optional().or(z.literal("")),
  detalle: esquemaDetalle,
}).superRefine((datos, contexto) => {
  if (datos.esParaOtraPersona && !datos.viajeroNombre?.trim()) {
    contexto.addIssue({ code: "custom", message: "Escribe el nombre del viajero.", path: ["viajeroNombre"] });
  }

  if (datos.esParaOtraPersona && !datos.viajeroTelefono?.trim()) {
    contexto.addIssue({ code: "custom", message: "Escribe el teléfono del viajero.", path: ["viajeroTelefono"] });
  }
});

export type EntradaReserva = z.input<typeof esquemaReserva>;

export type DatosReserva = z.output<typeof esquemaReserva>;

interface DatosReservaCrudos {
  pagadorNombre: FormDataEntryValue | null;
  pagadorTelefono: FormDataEntryValue | null;
  pagadorEmail: FormDataEntryValue;
  esParaOtraPersona: FormDataEntryValue | null;
  viajeroNombre: FormDataEntryValue;
  viajeroTelefono: FormDataEntryValue;
  precio: FormDataEntryValue | null;
  moneda: FormDataEntryValue;
  fechaImportante: FormDataEntryValue;
  detalle: Record<string, FormDataEntryValue | null>;
}

export function datosReservaDesdeFormData(formData: FormData): DatosReservaCrudos {
  const detalle: Record<string, FormDataEntryValue | null> = {};

  for (const [nombre, valor] of formData.entries()) {
    if (nombre.startsWith("detalle.")) detalle[nombre.slice("detalle.".length)] = valor;
  }

  return {
    pagadorNombre: formData.get("pagadorNombre"),
    pagadorTelefono: formData.get("pagadorTelefono"),
    pagadorEmail: formData.get("pagadorEmail") ?? "",
    esParaOtraPersona: formData.get("esParaOtraPersona"),
    viajeroNombre: formData.get("viajeroNombre") ?? "",
    viajeroTelefono: formData.get("viajeroTelefono") ?? "",
    precio: formData.get("precio"),
    moneda: formData.get("moneda") ?? "USD",
    fechaImportante: formData.get("fechaImportante") ?? "",
    detalle,
  };
}

export function filaReservaDesdeDatos(datos: DatosReserva) {
  const detalle = Object.fromEntries(
    Object.entries(datos.detalle).filter(([, valor]) => valor !== undefined),
  );

  return {
    pagador_nombre: datos.pagadorNombre,
    pagador_telefono: datos.pagadorTelefono,
    pagador_email: datos.pagadorEmail || null,
    viajero_nombre: datos.esParaOtraPersona ? datos.viajeroNombre || null : null,
    viajero_telefono: datos.esParaOtraPersona ? datos.viajeroTelefono || null : null,
    tipo: datos.detalle.tipo,
    detalle,
    precio: datos.precio,
    moneda: datos.moneda,
    fecha_importante: datos.fechaImportante || null,
  };
}

export function erroresPorCampo(error: z.ZodError) {
  const errores: Record<string, string> = {};

  for (const issue of error.issues) {
    const campo = issue.path.join(".");

    if (campo && !errores[campo]) errores[campo] = issue.message;
  }

  return errores;
}
