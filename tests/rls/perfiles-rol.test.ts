import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUsers,
  createTestUser,
  serviceClient,
  signInAs,
  sweepStaleTestUsers,
  type TestUser,
} from "../helpers/fixtures";

// Prueba de no-escalación de privilegios sobre profiles.role: ni una
// actualización directa, ni una fila insertada a mano, ni metadatos de
// registro pueden convertir a un cliente en admin.

let clienteA: TestUser;

beforeAll(async () => {
  await sweepStaleTestUsers();
  clienteA = await createTestUser("customer");
});

afterAll(async () => {
  await cleanupTestUsers();

  const service = serviceClient();
  const { data, error } = await service.auth.admin.getUserById(clienteA.id);
  expect(error).toBeTruthy();
  expect(data?.user).toBeFalsy();
});

describe("perfiles: no auto-promoción a admin", () => {
  it("la actualización de A de su propio role a 'admin' no cambia nada (relectura por servicio)", async () => {
    const clientA = await signInAs(clienteA);
    const service = serviceClient();

    await clientA.from("profiles").update({ role: "admin" }).eq("id", clienteA.id);

    const { data: perfilTrasIntento } = await service
      .from("profiles")
      .select("role")
      .eq("id", clienteA.id)
      .single();
    expect(perfilTrasIntento?.role).toBe("customer");
  });

  it("la inserción de A en profiles falla", async () => {
    const clientA = await signInAs(clienteA);

    const { error } = await clientA.from("profiles").insert({
      id: randomUUID(),
      role: "customer",
    });

    expect(error).toBeTruthy();
  });

  it("A seleccionando profiles obtiene solo su propia fila", async () => {
    const clientA = await signInAs(clienteA);

    const { data, error } = await clientA.from("profiles").select("id");
    expect(error).toBeFalsy();
    expect((data ?? []).map((p) => p.id)).toEqual([clienteA.id]);
  });

  it("un usuario creado con user_metadata { role: 'admin' } recibe profiles.role 'customer'", async () => {
    const service = serviceClient();
    const email = `rt-test-metadata-escalation-${Date.now()}@example.com`;

    const { data, error } = await service.auth.admin.createUser({
      email,
      password: `Rt-Test-${Date.now()}!`,
      email_confirm: true,
      user_metadata: { role: "admin", nombre: "Prueba metadata" },
    });
    expect(error).toBeFalsy();
    expect(data?.user).toBeTruthy();

    try {
      const { data: perfil, error: perfilError } = await service
        .from("profiles")
        .select("role")
        .eq("id", data!.user!.id)
        .single();
      expect(perfilError).toBeFalsy();
      expect(perfil?.role).toBe("customer");
    } finally {
      await service.auth.admin.deleteUser(data!.user!.id);
    }
  });

  it("rpc('is_admin') a través de publicClient falla, porque la función no está expuesta", async () => {
    const clientA = await signInAs(clienteA);

    const { error } = await clientA.rpc("is_admin");
    expect(error).toBeTruthy();
  });
});
