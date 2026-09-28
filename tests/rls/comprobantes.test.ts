import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUsers,
  createTestUser,
  serviceClient,
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
let clienteB: TestUser;
let admin: TestUser;
let rutaComprobanteA: string;

beforeAll(async () => {
  await sweepStaleTestUsers();
  clienteA = await createTestUser("customer");
  clienteB = await createTestUser("customer");
  admin = await createTestUser("admin");
});

afterAll(async () => {
  await cleanupTestUsers();

  const service = serviceClient();
  for (const id of [clienteA.id, clienteB.id, admin.id]) {
    const { data, error } = await service.auth.admin.getUserById(id);
    expect(error).toBeTruthy();
    expect(data?.user).toBeFalsy();
  }
});

describe("bucket comprobantes: privado y aislado por carpeta", () => {
  it("el bucket se lee como público false", async () => {
    const service = serviceClient();
    const { data, error } = await service.storage.getBucket("comprobantes");
    expect(error).toBeFalsy();
    expect(data?.public).toBe(false);
  });

  it("A puede subir un PNG a su propia carpeta, pero no a la de B", async () => {
    const clientA = await signInAs(clienteA);
    rutaComprobanteA = `${clienteA.id}/prueba.png`;

    const { error: subidaPropia } = await clientA.storage
      .from("comprobantes")
      .upload(rutaComprobanteA, Buffer.from(PNG_1X1_BASE64, "base64"), {
        contentType: "image/png",
      });
    expect(subidaPropia).toBeFalsy();
    trackStoragePath(rutaComprobanteA);

    const rutaCarpetaAjena = `${clienteB.id}/x.png`;
    const { error: subidaAjena } = await clientA.storage
      .from("comprobantes")
      .upload(rutaCarpetaAjena, Buffer.from(PNG_1X1_BASE64, "base64"), {
        contentType: "image/png",
      });
    expect(subidaAjena).toBeTruthy();
  });

  it("getPublicUrl de un objeto real devuelve un status distinto de 200", async () => {
    const clientA = await signInAs(clienteA);
    const { data } = clientA.storage.from("comprobantes").getPublicUrl(rutaComprobanteA);

    const response = await fetch(data.publicUrl);
    expect(response.status).not.toBe(200);
  });

  it("B no puede descargar el archivo de A", async () => {
    const clientB = await signInAs(clienteB);
    const { error } = await clientB.storage.from("comprobantes").download(rutaComprobanteA);
    expect(error).toBeTruthy();
  });

  it("A puede listar su propia carpeta", async () => {
    const clientA = await signInAs(clienteA);
    const { data, error } = await clientA.storage.from("comprobantes").list(clienteA.id);
    expect(error).toBeFalsy();
    expect((data ?? []).some((f) => f.name === "prueba.png")).toBe(true);
  });

  it("el remove de A no elimina el archivo, y el upsert de A sobre él falla", async () => {
    const clientA = await signInAs(clienteA);
    const service = serviceClient();

    await clientA.storage.from("comprobantes").remove([rutaComprobanteA]);

    const { data: archivoTrasRemove } = await service.storage
      .from("comprobantes")
      .download(rutaComprobanteA);
    expect(archivoTrasRemove).toBeTruthy();

    const { error: upsertError } = await clientA.storage
      .from("comprobantes")
      .upload(rutaComprobanteA, Buffer.from(PNG_1X1_BASE64, "base64"), {
        contentType: "image/png",
        upsert: true,
      });
    expect(upsertError).toBeTruthy();
  });

  it("el admin puede descargar el archivo de A y crear una URL firmada que responde 200", async () => {
    const clientAdmin = await signInAs(admin);

    const { error: downloadError } = await clientAdmin.storage
      .from("comprobantes")
      .download(rutaComprobanteA);
    expect(downloadError).toBeFalsy();

    const { data: signedUrlData, error: signedUrlError } = await clientAdmin.storage
      .from("comprobantes")
      .createSignedUrl(rutaComprobanteA, 60);
    expect(signedUrlError).toBeFalsy();
    expect(signedUrlData?.signedUrl).toBeTruthy();

    const response = await fetch(signedUrlData!.signedUrl);
    expect(response.status).toBe(200);
  });

  it("subir un archivo text/plain es rechazado", async () => {
    const clientA = await signInAs(clienteA);

    const { error } = await clientA.storage
      .from("comprobantes")
      .upload(`${clienteA.id}/prueba.txt`, Buffer.from("no es una imagen", "utf-8"), {
        contentType: "text/plain",
      });

    expect(error).toBeTruthy();
  });
});
