import { createClient } from "@supabase/supabase-js";

const RUN_ID = Math.random().toString(36).slice(2, 8);
let sequence = 0;

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
 * Elimina todos los usuarios de prueba creados por este proceso.
 */
export async function cleanupTestUsers(): Promise<void> {
  const admin = serviceClient();
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
 * paralela puede estar a mitad de camino.
 */
export async function sweepStaleTestUsers(): Promise<void> {
  const admin = serviceClient();
  const staleBefore = Date.now() - 30 * 60 * 1000;
  let page = 1;
  const perPage = 200;

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
        await admin.auth.admin.deleteUser(user.id);
      }
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
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
