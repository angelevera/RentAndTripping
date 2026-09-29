import { describe, expect, it } from "vitest";
import {
  datosReservaDesdeFormData,
  erroresPorCampo,
  esquemaReserva,
  filaReservaDesdeDatos,
} from "@/lib/validation/reservas";

interface DetalleCrudo {
  tipo: string;
  aerolinea?: string;
  origen?: string;
  destino?: string;
  fechaVuelo?: string;
  pnr?: string;
  nombre?: string;
  checkIn?: string;
  checkOut?: string;
  fecha?: string;
  evento?: string;
  nota?: string;
  cantidadPersonas?: string;
  viajeros?: string;
}

interface ReservaCruda {
  pagadorNombre: string;
  pagadorTelefono: string;
  pagadorEmail: string;
  esParaOtraPersona?: string;
  viajeroNombre: string;
  viajeroTelefono: string;
  precio: string;
  moneda: string;
  fechaImportante: string;
  detalle: DetalleCrudo;
}

function pasaje(): ReservaCruda {
  return {
    pagadorNombre: "Ana Pérez",
    pagadorTelefono: "555-0100",
    pagadorEmail: "",
    esParaOtraPersona: undefined,
    viajeroNombre: "",
    viajeroTelefono: "",
    precio: "350",
    moneda: "USD",
    fechaImportante: "",
    detalle: {
      tipo: "pasaje",
      aerolinea: "Aerolínea",
      origen: "Caracas",
      destino: "Miami",
      fechaVuelo: "2026-12-15",
      pnr: "ABC123",
    },
  };
}

function parseFailure(input: ReservaCruda) {
  const result = esquemaReserva.safeParse(input);
  expect(result.success).toBe(false);

  if (result.success) throw new Error("Expected schema failure");

  return erroresPorCampo(result.error);
}

describe("esquemaReserva", () => {
  it("parses a valid pasaje with default group fields", () => {
    const result = esquemaReserva.parse(pasaje());
    expect(result.detalle).toEqual({
      tipo: "pasaje",
      aerolinea: "Aerolínea",
      origen: "Caracas",
      destino: "Miami",
      fechaVuelo: "2026-12-15",
      pnr: "ABC123",
      cantidadPersonas: 1,
      viajeros: [],
    });
  });

  it("requires the PNR with the contracted message", () => {
    const input = pasaje();
    input.detalle.pnr = "";
    expect(parseFailure(input)["detalle.pnr"]).toBe(
      "Falta el número de reserva de la aerolínea (PNR). Anótalo tal como te lo dio la aerolínea.",
    );
  });

  it.each(["0", "", "-5"])("rejects price %s", (precio) => {
    const input = pasaje();
    input.precio = precio;
    expect(parseFailure(input).precio).toBe("El precio tiene que ser mayor a cero.");
  });

  it("normalizes comma decimal prices and rejects excessive prices", () => {
    const input = pasaje();
    input.precio = "1500,50";
    expect(esquemaReserva.parse(input).precio).toBe(1500.5);
    input.precio = "10000001";
    expect(parseFailure(input).precio).toBe("El precio es demasiado alto. Revísalo.");
  });

  it("requires traveller name and phone when the sale is for someone else", () => {
    const input = pasaje();
    input.esParaOtraPersona = "on";
    expect(parseFailure(input).viajeroNombre).toBe("Escribe el nombre del viajero.");
    input.viajeroNombre = "Luis";
    expect(parseFailure(input).viajeroTelefono).toBe("Escribe el teléfono del viajero.");
  });

  it("does not store traveller details when the payer travels", () => {
    const input = pasaje();
    input.viajeroNombre = "X";
    const parsed = esquemaReserva.parse(input);
    expect(filaReservaDesdeDatos(parsed)).toMatchObject({
      viajero_nombre: null,
      viajero_telefono: null,
    });
  });

  it("trims group traveller names and limits their count", () => {
    const input = pasaje();
    input.detalle.viajeros = "Ana\n\n  Luis \n";
    expect(esquemaReserva.parse(input).detalle).toMatchObject({ viajeros: ["Ana", "Luis"] });
    input.detalle.viajeros = Array.from({ length: 21 }, (_, i) => `Persona ${i}`).join("\n");
    expect(parseFailure(input)["detalle.viajeros"]).toBe("Máximo 20 nombres.");
  });

  it("defaults an empty group size and rejects sizes outside 1 through 50", () => {
    const input = pasaje();
    input.detalle.cantidadPersonas = "";
    expect(esquemaReserva.parse(input).detalle).toMatchObject({ cantidadPersonas: 1 });

    for (const cantidadPersonas of ["0", "51"]) {
      input.detalle.cantidadPersonas = cantidadPersonas;
      expect(parseFailure(input)["detalle.cantidadPersonas"]).toBe(
        "Escribe cuántas personas viajan (de 1 a 50).",
      );
    }
  });

  it("validates hotel date order and real ISO dates", () => {
    const hotel = {
      ...pasaje(),
      detalle: { tipo: "hotel", nombre: "Hotel", checkIn: "2026-12-16", checkOut: "2026-12-15" },
    };

    expect(parseFailure(hotel)["detalle.checkOut"]).toBe("El check-out no puede ser antes del check-in.");
    const input = pasaje();
    input.detalle.fechaVuelo = "2026-02-30";
    expect(parseFailure(input)["detalle.fechaVuelo"]).toBe("Escribe una fecha válida.");
    input.detalle.fechaVuelo = "15/12/2026";
    expect(parseFailure(input)["detalle.fechaVuelo"]).toBe("Escribe una fecha válida.");
    input.detalle.fechaVuelo = "2026-12-15";
    expect(esquemaReserva.parse(input).fechaImportante).toBe("");
  });

  it("strips cross-type fields and rejects unknown reservation types", () => {
    const hotel = {
      ...pasaje(),
      detalle: { tipo: "hotel", nombre: "Hotel", checkIn: "2026-12-15", checkOut: "2026-12-16", pnr: "X" },
    };

    expect(esquemaReserva.parse(hotel).detalle).not.toHaveProperty("pnr");
    hotel.detalle.tipo = "crucero";
    expect(parseFailure(hotel)["detalle.tipo"]).toBeDefined();
  });

  it("normalizes optional payer email and validates its format", () => {
    const input = pasaje();
    expect(esquemaReserva.parse(input).pagadorEmail).toBe("");
    input.pagadorEmail = "no-es-correo";
    expect(parseFailure(input).pagadorEmail).toBe("Escribe un correo válido.");
    input.pagadorEmail = "ANA@Mail.com";
    expect(esquemaReserva.parse(input).pagadorEmail).toBe("ana@mail.com");
  });

  it("limits payer names and notes", () => {
    const input = pasaje();
    input.pagadorNombre = "A".repeat(121);
    expect(parseFailure(input).pagadorNombre).toBe("Máximo 120 caracteres.");
    input.pagadorNombre = "Ana";
    input.detalle = { tipo: "tour", nombre: "Tour", fecha: "2026-12-15", nota: "x".repeat(2001) };
    expect(parseFailure(input)["detalle.nota"]).toBe("Máximo 2000 caracteres.");
  });

  it("builds the nested schema input from dotted FormData names", () => {
    const form = new FormData();

    for (const [key, value] of Object.entries({
      pagadorNombre: "Ana", pagadorTelefono: "555", precio: "350", moneda: "USD",
      "detalle.tipo": "pasaje", "detalle.aerolinea": "Aerolínea", "detalle.origen": "CCS",
      "detalle.destino": "MIA", "detalle.fechaVuelo": "2026-12-15", "detalle.pnr": "ABC",
      "detalle.cantidadPersonas": "2", "detalle.viajeros": "Ana\nLuis",
    })) form.set(key, value);
    const parsed = esquemaReserva.parse(datosReservaDesdeFormData(form));
    expect(parsed.detalle).toMatchObject({ cantidadPersonas: 2, viajeros: ["Ana", "Luis"] });
  });
});
