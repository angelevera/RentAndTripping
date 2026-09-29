import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS_PROVEEDOR, TIPOS_RESERVA } from "@/lib/validation/reservas";
import { editarReserva } from "../../actions";
import { ReservaForm, type ValoresFormularioReserva } from "../../reserva-form";

type FilaReserva = Database["public"]["Tables"]["reservas"]["Row"];

// detalle is a jsonb column (typed only as `Json` by the generated types); a plain
// object is the only shape this app ever writes, but a legacy/malformed row must
// still open with every field defaulted rather than throwing.
const esquemaDetalleCrudo = z.record(z.string(), z.unknown()).catch({});

function valoresDesdeFila(fila: FilaReserva): ValoresFormularioReserva {
  const detalle = esquemaDetalleCrudo.parse(fila.detalle);

  return {
    pagadorNombre: fila.pagador_nombre,
    pagadorTelefono: fila.pagador_telefono,
    pagadorEmail: fila.pagador_email ?? "",
    esParaOtraPersona: fila.viajero_nombre !== null,
    viajeroNombre: fila.viajero_nombre ?? "",
    viajeroTelefono: fila.viajero_telefono ?? "",
    precio: String(fila.precio),
    moneda: fila.moneda === "VES" ? "VES" : "USD",
    fechaImportante: fila.fecha_importante ?? "",
    estadoProveedor: ESTADOS_PROVEEDOR.find((estado) => estado === fila.estado_proveedor) ?? "pendiente",
    notaProblema: fila.nota_problema ?? "",
    detalle: {
      tipo: TIPOS_RESERVA.find((valor) => valor === fila.tipo) ?? "pasaje",
      aerolinea: String(detalle.aerolinea ?? ""),
      origen: String(detalle.origen ?? ""),
      destino: String(detalle.destino ?? ""),
      fechaVuelo: String(detalle.fechaVuelo ?? ""),
      pnr: String(detalle.pnr ?? ""),
      nombre: String(detalle.nombre ?? ""),
      checkIn: String(detalle.checkIn ?? ""),
      checkOut: String(detalle.checkOut ?? ""),
      fecha: String(detalle.fecha ?? ""),
      evento: String(detalle.evento ?? ""),
      nota: String(detalle.nota ?? ""),
      cantidadPersonas: String(detalle.cantidadPersonas ?? "1"),
      viajeros: Array.isArray(detalle.viajeros) ? detalle.viajeros.join("\n") : String(detalle.viajeros ?? ""),
    },
  };
}

export default async function EditarReservaPage({
  params,
}: PageProps<"/admin/reservas/[id]/editar">) {
  await requireAdmin();
  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from("reservas").select("*").eq("id", id).maybeSingle();

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <h1 className="font-display text-2xl font-bold">Editar reserva</h1>
        <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-700">
          <AlertDescription className="text-red-700">No se pudo cargar la reserva. Actualiza la página o inténtalo de nuevo en un momento.</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!data) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Editar reserva</h1>
      <ReservaForm modo="editar" accion={editarReserva.bind(null, id)} valoresIniciales={valoresDesdeFila(data)} />
    </main>
  );
}
