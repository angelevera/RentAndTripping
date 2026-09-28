import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUsers,
  createTestUser,
  publicClient,
  signInAs,
  sweepStaleTestUsers,
  trackStoragePath,
  type TestUser,
} from "../helpers/fixtures";

// Un 1x1 PNG transparente, usado como archivo real de prueba para subir a
// Storage.
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

let clienteA: TestUser;
let rutaComprobanteA: string;

beforeAll(async () => {
  await sweepStaleTestUsers();
  clienteA = await createTestUser("customer");

  const clientA = await signInAs(clienteA);
  rutaComprobanteA = `${clienteA.id}/prueba-anonimo.png`;
  const { error } = await clientA.storage
    .from("comprobantes")
    .upload(rutaComprobanteA, Buffer.from(PNG_1X1_BASE64, "base64"), {
      contentType: "image/png",
    });
  expect(error).toBeFalsy();
  trackStoragePath(rutaComprobanteA);
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe("acceso anónimo (sin sesión)", () => {
  it("un visitante anónimo lee 0 filas de profiles, reservas, pagos y recordatorios", async () => {
    const anon = publicClient();

    for (const table of ["profiles", "reservas", "pagos", "recordatorios"] as const) {
      const { data } = await anon.from(table).select("id");
      expect((data ?? []).length).toBe(0);
    }
  });

  it("la inserción anónima en reservas falla", async () => {
    const anon = publicClient();

    const { error } = await anon.from("reservas").insert({
      cliente_id: clienteA.id,
      tipo: "tour",
      precio: 10,
      moneda: "USD",
    });

    expect(error).toBeTruthy();
  });

  it("la descarga anónima de un comprobante existente falla", async () => {
    const anon = publicClient();

    const { error } = await anon.storage.from("comprobantes").download(rutaComprobanteA);
    expect(error).toBeTruthy();
  });
});
