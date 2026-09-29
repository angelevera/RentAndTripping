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

const texto = (max: number) => z.string().trim().max(max, { message: `Máximo ${max} caracteres.` });

const fecha = z.iso.date({ error: "Escribe una fecha válida." });

const cantidadPersonas = z.preprocess(
  (valor) => valor === "" || valor == null ? 1 : valor,
  z.coerce.number().int({ message: "Escribe cuántas personas viajan (de 1 a 50)." })
    .min(1, { message: "Escribe cuántas personas viajan (de 1 a 50)." })
    .max(50, { message: "Escribe cuántas personas viajan (de 1 a 50)." }),
);

const viajeros = z.preprocess(
  (valor) => Array.isArray(valor) ? valor : String(valor ?? "").split(/\r?\n/).map((nombre) => nombre.trim()).filter(Boolean),
  z.array(texto(120).max(120, { message: "Máximo 120 caracteres por nombre." }))
    .max(20, { message: "Máximo 20 nombres." }),
);

const grupo = { cantidadPersonas, viajeros };

const detallePasaje = z.object({
  tipo: z.literal("pasaje"),
  aerolinea: texto(120).min(1, { message: "Escribe la aerolínea." }),
  origen: texto(80).min(1, { message: "Escribe el origen." }),
  destino: texto(80).min(1, { message: "Escribe el destino." }),
  fechaVuelo: fecha,
  pnr: texto(20).min(1, {
    message: "Falta el número de reserva de la aerolínea (PNR). Anótalo tal como te lo dio la aerolínea.",
  }),
  ...grupo,
});

const detalleHotel = z.object({
  tipo: z.literal("hotel"),
  nombre: texto(120).min(1, { message: "Escribe el nombre del hotel." }),
  checkIn: fecha,
  checkOut: fecha,
  nota: texto(2000).optional(),
  ...grupo,
});

const detalleTour = z.object({
  tipo: z.literal("tour"),
  nombre: texto(120).min(1, { message: "Escribe el nombre del tour." }),
  fecha,
  nota: texto(2000).optional(),
  ...grupo,
});

const detalleEntrada = z.object({
  tipo: z.literal("entrada"),
  evento: texto(120).min(1, { message: "Escribe el nombre del evento." }),
  fecha,
  nota: texto(2000).optional(),
  ...grupo,
});

export const esquemaDetalle = z.discriminatedUnion("tipo", [
  detallePasaje, detalleHotel, detalleTour, detalleEntrada,
]);

const aBooleano = z.preprocess(
  (valor) => valor === true || valor === "true" || valor === "on",
  z.boolean(),
);

const esquemaReservaBase = z.object({
  pagadorNombre: texto(120).min(1, { message: "Escribe el nombre de quien paga." }),
  pagadorTelefono: texto(30).min(1, { message: "Escribe un teléfono de contacto." }),
  pagadorEmail: z.string().trim().toLowerCase().max(254, { message: "Máximo 254 caracteres." }).email({ message: "Escribe un correo válido." }).optional().or(z.literal("")),
  esParaOtraPersona: aBooleano,
  viajeroNombre: texto(120).optional(),
  viajeroTelefono: texto(30).optional(),
  // El precio puede llegar con coma decimal ("350,50") porque el input
  // nativo no la bloquea; String(...) normaliza cualquier valor de entrada
  // a texto (sin typeof) antes de reemplazar la coma y dejar que
  // z.coerce.number() establezca el valor de dominio.
  precio: z.preprocess(
    (valor) => String(valor ?? "").replace(",", "."),
    z.coerce.number().positive({ message: "El precio tiene que ser mayor a cero." })
      .max(10_000_000, { message: "El precio es demasiado alto. Revísalo." }),
  ),
  moneda: z.enum(MONEDAS).default("USD"),
  fechaImportante: z.union([fecha, z.literal("")]).optional(),
  detalle: esquemaDetalle,
});

function refinarReserva(datos: z.output<typeof esquemaReservaBase>, contexto: z.RefinementCtx) {
  if (datos.detalle.tipo === "hotel" && datos.detalle.checkOut < datos.detalle.checkIn) {
    contexto.addIssue({ code: "custom", message: "El check-out no puede ser antes del check-in.", path: ["detalle", "checkOut"] });
  }

  if (datos.esParaOtraPersona && !datos.viajeroNombre?.trim()) {
    contexto.addIssue({ code: "custom", message: "Escribe el nombre del viajero.", path: ["viajeroNombre"] });
  }

  if (datos.esParaOtraPersona && !datos.viajeroTelefono?.trim()) {
    contexto.addIssue({ code: "custom", message: "Escribe el teléfono del viajero.", path: ["viajeroTelefono"] });
  }

  if (!datos.esParaOtraPersona) {
    datos.viajeroNombre = undefined;
    datos.viajeroTelefono = undefined;
  }
}

export const esquemaReserva = esquemaReservaBase.superRefine(refinarReserva);

const mensajeNotaProblema = "Para marcar la reserva como 'con problema' hace falta explicar qué pasó, así no se te olvida el detalle después.";

export const esquemaEstadoProveedor = z.object({
  estadoProveedor: z.enum(ESTADOS_PROVEEDOR),
  notaProblema: texto(2000).optional(),
}).superRefine(refinarEstadoProveedor);

function refinarEstadoProveedor(
  datos: { estadoProveedor: (typeof ESTADOS_PROVEEDOR)[number]; notaProblema?: string },
  contexto: z.RefinementCtx,
) {
  if (datos.estadoProveedor === "con_problema" && !datos.notaProblema?.trim()) {
    contexto.addIssue({ code: "custom", message: mensajeNotaProblema, path: ["notaProblema"] });
  }
}

export const esquemaEdicionReserva = esquemaReservaBase.extend({
  estadoProveedor: z.enum(ESTADOS_PROVEEDOR),
  notaProblema: texto(2000).optional(),
}).superRefine((datos, contexto) => {
  refinarReserva(datos, contexto);
  refinarEstadoProveedor(datos, contexto);
});

export type EntradaReserva = z.input<typeof esquemaReserva>;

export type DatosReserva = z.output<typeof esquemaReserva>;

export type EntradaEdicionReserva = z.input<typeof esquemaEdicionReserva>;

export type DatosEdicionReserva = z.output<typeof esquemaEdicionReserva>;

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
  estadoProveedor: FormDataEntryValue | null;
  notaProblema: FormDataEntryValue;
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
    estadoProveedor: formData.get("estadoProveedor"),
    notaProblema: formData.get("notaProblema") ?? "",
    detalle,
  };
}

export function filaEdicionDesdeDatos(datos: DatosEdicionReserva) {
  return {
    ...filaReservaDesdeDatos(datos),
    estado_proveedor: datos.estadoProveedor,
    nota_problema: datos.estadoProveedor === "con_problema" ? datos.notaProblema?.trim() || null : null,
  };
}

export function avisoTrasEditar(anterior: string, nuevo: string): "confirmada" | "problema" | "guardada" {
  if (anterior !== "confirmada" && nuevo === "confirmada") return "confirmada";

  if (anterior !== "con_problema" && nuevo === "con_problema") return "problema";

  return "guardada";
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
