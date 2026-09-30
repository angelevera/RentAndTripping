import { createClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/database.types";

const RUN_ID = Math.random().toString(36).slice(2, 8);

let sequence = 0;

/**
 * Prefijo de toda reserva creada por pruebas automáticas — permite que el
 * operador identifique a simple vista una fila de prueba en /admin, y que
 * cleanupTestUsers/sweepStaleTestUsers la encuentren y la borren.
 */
export const TEST_PREFIX = `rt-test-${RUN_ID}`;

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} para los tests`);
  }

  return value;
}

function testEmailDomain(): string {
  return process.env.TEST_EMAIL_DOMAIN || "example.com";
}

/**
 * Cliente público (anon/publishable), igual al que usa la app real —
 * sin persistir sesión en disco, ya que los tests manejan sus propias cookies.
 */
export function publicClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/**
 * Cliente con la clave secreta — SOLO para tests. Nunca debe importarse
 * desde código de la app (app/, lib/).
 */
export function serviceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

const trackedUserIds = new Set<string>();

const trackedReservaIds = new Set<string>();

const trackedPagoIds = new Set<string>();

const trackedRecordatorioIds = new Set<string>();

const trackedStoragePaths = new Set<string>();

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Crea un usuario de prueba namespaced (rt-test-...), confirmado de una vez
 * (nunca se envía correo — el mailer por defecto de Supabase solo entrega a
 * miembros del equipo). Para role 'admin', promueve profiles.role tras la
 * creación (el trigger siempre crea la fila con role='customer' por defecto).
 */
export async function createTestUser(role: "admin" | "customer"): Promise<TestUser> {
  const admin = serviceClient();
  const n = ++sequence;
  const email = `rt-test-${RUN_ID}-${role}-${n}@${testEmailDomain()}`;
  const password = `Rt-Test-${RUN_ID}-${n}-${Math.random().toString(36).slice(2, 10)}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: "Prueba automática" },
  });

  if (error || !data?.user) {
    throw new Error(`No se pudo crear el usuario de prueba ${email}: ${error?.message}`);
  }

  trackedUserIds.add(data.user.id);

  if (role === "admin") {
    const { error: updateError } = await admin
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", data.user.id);

    if (updateError) {
      throw new Error(
        `No se pudo promover a admin el usuario de prueba ${email}: ${updateError.message}`,
      );
    }
  }

  return { id: data.user.id, email, password };
}

/**
 * Inicia sesión como el usuario de prueba dado, devolviendo un publicClient
 * ya autenticado (igual que el que usaría la app real).
 */
export async function signInAs(user: TestUser) {
  const client = publicClient();

  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`No se pudo iniciar sesión como ${user.email}: ${error.message}`);
  }

  return client;
}

interface ReservaFixtureParams {
  clienteId: string;
  adminId: string;
}

interface ReservaFixture {
  reservaId: string;
  pagoId: string;
  recordatorioId: string;
}

/**
 * Crea, con serviceClient, una reserva (tipo 'tour', 100 USD) con un pago
 * (100 USD, zelle) y un recordatorio (programado para mañana). Registra los
 * tres ids para que cleanupTestUsers/sweepStaleTestUsers los borren en el
 * orden correcto (pagos restringe el borrado de reservas).
 */
export async function createReservaFixture({
  clienteId,
  adminId,
}: ReservaFixtureParams): Promise<ReservaFixture> {
  const admin = serviceClient();

  const { data: reserva, error: reservaError } = await admin
    .from("reservas")
    .insert({
      cliente_id: clienteId,
      tipo: "tour",
      precio: 100,
      moneda: "USD",
      created_by: adminId,
      pagador_nombre: `${TEST_PREFIX} cliente`,
      pagador_telefono: "0000-0000000",
    })
    .select("id")
    .single();

  if (reservaError || !reserva) {
    throw new Error(`No se pudo crear la reserva de prueba: ${reservaError?.message}`);
  }

  trackedReservaIds.add(reserva.id);

  const { pagoId } = await createPagoFixture({
    reservaId: reserva.id,
    adminId,
    estado: "pendiente_revision",
  });

  const fechaEnvioProgramada = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: recordatorio, error: recordatorioError } = await admin
    .from("recordatorios")
    .insert({
      reserva_id: reserva.id,
      tipo: "recordatorio",
      fecha_envio_programada: fechaEnvioProgramada,
    })
    .select("id")
    .single();

  if (recordatorioError || !recordatorio) {
    throw new Error(`No se pudo crear el recordatorio de prueba: ${recordatorioError?.message}`);
  }

  trackedRecordatorioIds.add(recordatorio.id);

  return { reservaId: reserva.id, pagoId, recordatorioId: recordatorio.id };
}

interface ReservaSinCuentaFixtureParams {
  adminId: string;
  pagadorNombre?: string;
  tipo?: string;
  detalle?: Record<string, Json>;
  precio?: number;
  moneda?: "USD" | "VES";
  estadoProveedor?: "pendiente" | "confirmada" | "con_problema";
  notaProblema?: string;
  fechaImportante?: string;
  viajeroNombre?: string;
  viajeroTelefono?: string;
  createdAt?: string;
}

interface FilaReservaSinCuenta {
  cliente_id: null;
  created_by: string;
  pagador_nombre: string;
  pagador_telefono: string;
  tipo: string;
  detalle: Record<string, Json>;
  precio: number;
  moneda: "USD" | "VES";
  estado_proveedor?: "pendiente" | "confirmada" | "con_problema";
  nota_problema?: string;
  fecha_importante?: string;
  viajero_nombre?: string;
  viajero_telefono?: string;
  created_at?: string;
}

interface ReservaSinCuentaFixture {
  reservaId: string;
  pagadorNombre: string;
}

/**
 * Crea, con serviceClient, una reserva sin cuenta de cliente (cliente_id
 * null): el caso normal desde la Fase 2 — el admin registra la venta con los
 * datos de contacto de quien paga directamente en la reserva (D-01).
 */
export async function createReservaSinCuentaFixture({
  adminId,
  pagadorNombre,
  tipo = "tour",
  detalle,
  precio = 100,
  moneda = "USD",
  estadoProveedor,
  notaProblema,
  fechaImportante,
  viajeroNombre,
  viajeroTelefono,
  createdAt,
}: ReservaSinCuentaFixtureParams): Promise<ReservaSinCuentaFixture> {
  const admin = serviceClient();
  const n = ++sequence;
  const nombre = pagadorNombre ?? `${TEST_PREFIX} pagador ${n}`;

  const fila: FilaReservaSinCuenta = {
    cliente_id: null,
    created_by: adminId,
    pagador_nombre: nombre,
    pagador_telefono: "0000-0000000",
    tipo,
    detalle: detalle ?? { tipo, nombre: "Tour de prueba", fecha: "2026-12-01" },
    precio,
    moneda,
  };

  if (estadoProveedor !== undefined) fila.estado_proveedor = estadoProveedor;

  if (notaProblema !== undefined) fila.nota_problema = notaProblema;

  if (fechaImportante !== undefined) fila.fecha_importante = fechaImportante;

  if (viajeroNombre !== undefined) fila.viajero_nombre = viajeroNombre;

  if (viajeroTelefono !== undefined) fila.viajero_telefono = viajeroTelefono;

  if (createdAt !== undefined) fila.created_at = createdAt;

  const { data: reserva, error: reservaError } = await admin
    .from("reservas")
    .insert(fila)
    .select("id")
    .single();

  if (reservaError || !reserva) {
    throw new Error(`No se pudo crear la reserva sin cuenta de prueba: ${reservaError?.message}`);
  }

  trackedReservaIds.add(reserva.id);

  return { reservaId: reserva.id, pagadorNombre: nombre };
}

interface PagoFixtureParams {
  reservaId: string;
  adminId: string;
  estado: "pendiente_revision" | "confirmado";
  monto?: number;
  moneda?: "USD" | "VES";
  tasaCambio?: number;
}

interface FilaPago {
  reserva_id: string;
  monto: number;
  moneda: "USD" | "VES";
  metodo: "zelle";
  estado: "pendiente_revision" | "confirmado";
  created_by: string;
  tasa_cambio?: number;
}

interface PagoFixture {
  pagoId: string;
}

/**
 * Crea, con serviceClient, un pago de prueba para una reserva ya existente.
 * moneda VES exige tasaCambio (constraint pagos_tasa_cambio_solo_en_bs de
 * 20260927000004).
 */
export async function createPagoFixture({
  reservaId,
  adminId,
  estado,
  monto = 100,
  moneda = "USD",
  tasaCambio,
}: PagoFixtureParams): Promise<PagoFixture> {
  const admin = serviceClient();

  const fila: FilaPago = {
    reserva_id: reservaId,
    monto,
    moneda,
    metodo: "zelle",
    estado,
    created_by: adminId,
  };

  if (moneda === "VES") fila.tasa_cambio = tasaCambio;

  const { data: pago, error: pagoError } = await admin
    .from("pagos")
    .insert(fila)
    .select("id")
    .single();

  if (pagoError || !pago) {
    throw new Error(`No se pudo crear el pago de prueba: ${pagoError?.message}`);
  }

  trackedPagoIds.add(pago.id);

  return { pagoId: pago.id };
}

/**
 * Registra una ruta del bucket comprobantes para que cleanupTestUsers la
 * elimine, exista o no realmente (una subida rechazada por RLS nunca llega a
 * crear el objeto, y removerla es un no-op inofensivo).
 */
export function trackStoragePath(path: string): void {
  trackedStoragePaths.add(path);
}

/**
 * Registra un userId creado por una vía que no es createTestUser (por
 * ejemplo, directamente por invitarCliente/reenviarInvitacion en un test) en
 * el mismo Set que cleanupTestUsers ya recorre, para que se borre igual.
 */
export function trackTestUserId(id: string): void {
  trackedUserIds.add(id);
}

/**
 * Elimina todos los usuarios de prueba creados por este proceso, y todo lo
 * que dependa de ellos primero: comprobantes rastreados, luego recordatorios,
 * luego pagos, luego reservas (pagos restringe el borrado de reservas, así
 * que el orden importa), y solo entonces los usuarios.
 */
export async function cleanupTestUsers(): Promise<void> {
  const admin = serviceClient();

  if (trackedStoragePaths.size > 0) {
    const paths = Array.from(trackedStoragePaths);
    await admin.storage.from("comprobantes").remove(paths);
    trackedStoragePaths.clear();
  }

  if (trackedRecordatorioIds.size > 0) {
    const ids = Array.from(trackedRecordatorioIds);
    await admin.from("recordatorios").delete().in("id", ids);
    trackedRecordatorioIds.clear();
  }

  if (trackedPagoIds.size > 0) {
    const ids = Array.from(trackedPagoIds);
    await admin.from("pagos").delete().in("id", ids);
    trackedPagoIds.clear();
  }

  if (trackedReservaIds.size > 0) {
    const ids = Array.from(trackedReservaIds);
    await admin.from("reservas").delete().in("id", ids);
    trackedReservaIds.clear();
  }

  // Reservas creadas a través de la UI (por ejemplo, por un Server Action
  // invocado en un test e2e) nunca pasan por createReservaFixture/
  // createReservaSinCuentaFixture, así que no están en trackedReservaIds.
  // Se identifican por created_by y se limpian en el mismo orden (Fase 2).
  if (trackedUserIds.size > 0) {
    const userIds = Array.from(trackedUserIds);

    const { data: reservasPorCreador } = await admin
      .from("reservas")
      .select("id")
      .in("created_by", userIds);

    const reservaIds = (reservasPorCreador ?? []).map((r) => r.id);

    if (reservaIds.length > 0) {
      await admin.from("recordatorios").delete().in("reserva_id", reservaIds);
      await admin.from("pagos").delete().in("reserva_id", reservaIds);
      await admin.from("reservas").delete().in("id", reservaIds);
    }
  }

  const ids = Array.from(trackedUserIds);

  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);

    if (!error) {
      trackedUserIds.delete(id);
    }
  }
}

/**
 * Barre cuentas de prueba (rt-test-...) huérfanas de ejecuciones previas,
 * pero nunca borra una con menos de 30 minutos de creada — una corrida
 * paralela puede estar a mitad de camino. Antes de borrar cada cuenta,
 * limpia lo que dependa de ella (comprobantes, recordatorios, pagos,
 * reservas cuyo cliente_id o created_by sea esa cuenta), en el mismo orden
 * que cleanupTestUsers, porque pagos restringe el borrado de reservas.
 */
export async function sweepStaleTestUsers(): Promise<void> {
  const admin = serviceClient();
  const staleBefore = Date.now() - 30 * 60 * 1000;
  let page = 1;
  const perPage = 200;
  const staleUserIds: string[] = [];

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error || !data) {
      break;
    }

    const users = data.users ?? [];

    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      if (!user.email?.startsWith("rt-test-")) continue;
      const createdAt = new Date(user.created_at).getTime();

      if (createdAt < staleBefore) {
        staleUserIds.push(user.id);
      }
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  if (staleUserIds.length === 0) {
    return;
  }

  for (const uid of staleUserIds) {
    const { data: files } = await admin.storage.from("comprobantes").list(uid);

    if (files && files.length > 0) {
      await admin.storage.from("comprobantes").remove(files.map((f) => `${uid}/${f.name}`));
    }
  }

  const { data: reservasPorCliente } = await admin
    .from("reservas")
    .select("id")
    .in("cliente_id", staleUserIds);

  const { data: reservasPorCreador } = await admin
    .from("reservas")
    .select("id")
    .in("created_by", staleUserIds);

  const reservaIds = Array.from(
    new Set([
      ...(reservasPorCliente ?? []).map((r) => r.id),
      ...(reservasPorCreador ?? []).map((r) => r.id),
    ]),
  );

  if (reservaIds.length > 0) {
    await admin.from("recordatorios").delete().in("reserva_id", reservaIds);
    await admin.from("pagos").delete().in("reserva_id", reservaIds);
    await admin.from("reservas").delete().in("id", reservaIds);
  }

  for (const uid of staleUserIds) {
    await admin.auth.admin.deleteUser(uid);
  }
}

interface Cookie {
  value: string;
  expiresAtMs: number | null;
}

/**
 * Guarda pares nombre→valor de cookies entre requests, tal como lo haría
 * un navegador. Aplica Set-Cookie tratando Max-Age=0 o Expires en el
 * pasado como una eliminación.
 */
export class CookieJar {
  private cookies = new Map<string, Cookie>();

  applySetCookie(setCookieValues: string[]): void {
    for (const raw of setCookieValues) {
      const parts = raw.split(";").map((p) => p.trim());
      const [nameValue, ...attrs] = parts;
      const eqIndex = nameValue.indexOf("=");

      if (eqIndex === -1) continue;
      const name = nameValue.slice(0, eqIndex);
      const value = nameValue.slice(eqIndex + 1);

      let maxAge: number | null = null;
      let expires: number | null = null;

      for (const attr of attrs) {
        const [attrNameRaw, attrValueRaw] = attr.split("=");
        const attrName = attrNameRaw?.toLowerCase();

        if (attrName === "max-age" && attrValueRaw !== undefined) {
          maxAge = Number(attrValueRaw);
        } else if (attrName === "expires" && attrValueRaw !== undefined) {
          expires = Date.parse(attr.slice(attr.indexOf("=") + 1));
        }
      }

      const isDeletion =
        (maxAge !== null && maxAge <= 0) || (expires !== null && expires <= Date.now());

      if (isDeletion) {
        this.cookies.delete(name);
        continue;
      }

      let expiresAtMs: number | null = null;

      if (maxAge !== null) {
        expiresAtMs = Date.now() + maxAge * 1000;
      } else if (expires !== null) {
        expiresAtMs = expires;
      }

      this.cookies.set(name, { value, expiresAtMs });
    }
  }

  get(name: string): string | undefined {
    const cookie = this.cookies.get(name);

    if (!cookie) return undefined;

    if (cookie.expiresAtMs !== null && cookie.expiresAtMs <= Date.now()) {
      this.cookies.delete(name);

      return undefined;
    }

    return cookie.value;
  }

  header(): string {
    const parts: string[] = [];

    for (const [name, cookie] of this.cookies.entries()) {
      if (cookie.expiresAtMs !== null && cookie.expiresAtMs <= Date.now()) continue;
      parts.push(`${name}=${cookie.value}`);
    }

    return parts.join("; ");
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractFormMarkup(html: string, formTestId: string): string {
  const marker = `data-testid="${formTestId}"`;
  const markerIndex = html.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error(`No se encontró un <form data-testid="${formTestId}"> en la página`);
  }

  const formStart = html.lastIndexOf("<form", markerIndex);

  if (formStart === -1) {
    throw new Error(`No se encontró la apertura <form> antes de ${marker}`);
  }

  const formEnd = html.indexOf("</form>", markerIndex);

  if (formEnd === -1) {
    throw new Error(`No se encontró el cierre </form> después de ${marker}`);
  }

  return html.slice(formStart, formEnd + "</form>".length);
}

function extractHiddenInputs(formMarkup: string): Record<string, string> {
  const hidden: Record<string, string> = {};
  const inputRegex = /<input\b[^>]*>/gi;
  const matches = formMarkup.match(inputRegex) ?? [];

  for (const tag of matches) {
    const typeMatch = tag.match(/type\s*=\s*"([^"]*)"/i);

    if (!typeMatch || typeMatch[1].toLowerCase() !== "hidden") continue;
    const nameMatch = tag.match(/name\s*=\s*"([^"]*)"/i);
    const valueMatch = tag.match(/value\s*=\s*"([^"]*)"/i);

    if (!nameMatch) continue;
    const name = decodeHtmlEntities(nameMatch[1]);
    const value = valueMatch ? decodeHtmlEntities(valueMatch[1]) : "";
    hidden[name] = value;
  }

  return hidden;
}

export interface GetFormHiddenInputsOptions {
  baseUrl: string;
  path: string;
  jar: CookieJar;
  formTestId: string;
}

/**
 * GET de una página y lectura de los inputs ocultos de un formulario dado
 * (típicamente el id de Server Action de Next.js), sin hacer el POST.
 * Reutiliza los mismos extractores internos que submitForm.
 */
export async function getFormHiddenInputs({
  baseUrl,
  path,
  jar,
  formTestId,
}: GetFormHiddenInputsOptions): Promise<Record<string, string>> {
  const response = await fetch(new URL(path, baseUrl), {
    headers: jar.header() ? { Cookie: jar.header() } : undefined,
  });

  jar.applySetCookie(response.headers.getSetCookie());

  const html = await response.text();
  const formMarkup = extractFormMarkup(html, formTestId);

  return extractHiddenInputs(formMarkup);
}

export interface LoginJarOptions {
  baseUrl: string;
  user: TestUser;
}

/**
 * Envía /login con form-login para el usuario de prueba dado (real HTTP, sin
 * JavaScript) y devuelve el CookieJar ya autenticado. Lanza si la respuesta
 * no es una redirección (3xx) — un login que no redirige es un login que
 * falló.
 */
export async function loginJar({ baseUrl, user }: LoginJarOptions): Promise<CookieJar> {
  const jar = new CookieJar();

  const response = await submitForm({
    baseUrl,
    path: "/login",
    jar,
    formTestId: "form-login",
    fields: { email: user.email, password: user.password },
  });

  if (response.status < 300 || response.status >= 400) {
    throw new Error(
      `loginJar: /login no redirigió para ${user.email} (status ${response.status})`,
    );
  }

  return jar;
}

export interface SubmitFormOptions {
  baseUrl: string;
  path: string;
  jar: CookieJar;
  formTestId: string;
  fields: Record<string, string>;
}

/**
 * Envía un formulario real exactamente como lo haría un navegador sin
 * JavaScript: primero un GET para leer los inputs ocultos (los ids de
 * Server Action de Next.js), luego un POST multipart con esos inputs más
 * los campos dados.
 */
export async function submitForm({
  baseUrl,
  path,
  jar,
  formTestId,
  fields,
}: SubmitFormOptions): Promise<Response> {
  const getResponse = await fetch(new URL(path, baseUrl), {
    headers: jar.header() ? { Cookie: jar.header() } : undefined,
  });

  jar.applySetCookie(getResponse.headers.getSetCookie());

  const html = await getResponse.text();
  const formMarkup = extractFormMarkup(html, formTestId);
  const hiddenInputs = extractHiddenInputs(formMarkup);

  const formData = new FormData();

  for (const [name, value] of Object.entries(hiddenInputs)) {
    formData.append(name, value);
  }

  for (const [name, value] of Object.entries(fields)) {
    formData.append(name, value);
  }

  const postResponse = await fetch(new URL(path, baseUrl), {
    method: "POST",
    body: formData,
    redirect: "manual",
    headers: {
      Origin: baseUrl,
      ...(jar.header() ? { Cookie: jar.header() } : {}),
    },
  });

  jar.applySetCookie(postResponse.headers.getSetCookie());

  return postResponse;
}
