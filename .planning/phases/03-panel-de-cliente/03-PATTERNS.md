# Phase 3: Panel de cliente - Pattern Map

**Mapped:** 2026-09-29
**Files analyzed:** 16 new/modified files (from CONTEXT.md decisions + RESEARCH.md structure)
**Analogs found:** 16 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `app/login/actions.ts` (modify — WR-01 fix, D-01/D-02/D-03) | controller (Server Action) | request-response | itself, extended (already tracked, read this session) | exact — modify in place |
| `lib/auth/require-cliente.ts` (new) | middleware/guard | request-response | `lib/auth/require-admin.ts` | exact |
| `lib/auth/require-admin.ts` (modify — factor `getSessionStatus` to return real role, per Pattern 2 Option A) | middleware/guard | request-response | itself | exact — modify in place |
| `app/cliente/page.tsx` (new) | controller (Server Component page) | request-response | `app/admin/page.tsx` | exact (guard + Suspense + list composition pattern) |
| `lib/reservas/listar-cliente.ts` (new) | service (query) | CRUD | `lib/reservas/listar.ts` | exact (same derived-`pagado` pattern, scoped to `cliente_id`) |
| `components/lista-reservas-cliente.tsx` (new, split activas/historial per D-16) | component | transform (render) | `app/admin/reservas/lista-reservas.tsx` | exact (badges, table/card responsive, skeleton) |
| `components/whatsapp-cta.tsx` (new, D-17/D-18/D-19) | component | request-response (static link) | `app/admin/reservas/lista-reservas.tsx`'s `ListaVacia()` (empty-state block) | role-match (empty-state CTA shape, not WhatsApp specifics — no analog for external link CTA exists) |
| `app/admin/clientes/page.tsx` (new) | controller (Server Component page) | request-response | `app/admin/page.tsx` | exact |
| `app/admin/clientes/lista-clientes.tsx` (new) | component | transform (render) | `app/admin/reservas/lista-reservas.tsx` | exact (table/card/badge/pagination pattern, D-06 "Claude's Discretion") |
| `app/admin/clientes/actions.ts` (new — invitar, reenviar, vincular, desvincular) | controller (Server Actions) | CRUD + event-driven (invite email) | `app/admin/reservas/actions.ts` | role-match (Server Action shape); invite/resend slice has **no in-repo analog** (see "No Analog Found") |
| `app/admin/clientes/[id]/page.tsx` (new — RESA-06 admin side) | controller (Server Component page) | request-response | `app/admin/reservas/[id]/editar/page.tsx` | role-match (detail page composing a guard + a query + a form/list) |
| `lib/clientes/listar.ts` (new) | service (query) | CRUD | `lib/reservas/listar.ts` | role-match (pagination/count/filter shape; new domain — `profiles` not `reservas`) |
| `lib/clientes/vincular.ts` (new — D-04/D-07/D-08, Pitfall 4) | service (query + mutation) | CRUD | `lib/reservas/listar.ts` (search pattern) + `app/admin/reservas/actions.ts` (mutation pattern) | role-match, composed from two analogs |
| `lib/clientes/invitar.ts` (new — D-09/D-10/D-12, Pitfall 2/3) | service (privileged mutation) | event-driven | **no analog** — first privileged/service-role code path in this repo's `lib/` | none (see "No Analog Found") |
| `lib/supabase/admin.ts` (new — server-only, `SUPABASE_SECRET_KEY`) | config/client factory | — | `lib/supabase/server.ts` | role-match (same `createClient`-factory shape, different key/no cookies) |
| `lib/validation/clientes.ts` (new — invite-email schema, búsqueda huérfanas schema) | validation | transform | `lib/validation/auth.ts` (small schema) + `lib/validation/reservas.ts` (`erroresPorCampo` reuse) | exact |
| `proxy.ts` (modify — extend matcher/redirect to `/cliente`) | middleware | request-response | itself | exact — modify in place |
| `tests/e2e/cliente-login.test.ts` (new) | test | request-response | `tests/e2e/admin-access.test.ts` | exact |
| `tests/rls/vincular-reservas.test.ts` (new, or extend `aislamiento-clientes.test.ts`) | test | CRUD | `tests/rls/aislamiento-clientes.test.ts` | exact |
| `tests/db/invitar-cliente.test.ts` (new) | test | event-driven | `tests/helpers/fixtures.ts` (`serviceClient`/`createTestUser` patterns) | role-match |
| `tests/helpers/fixtures.ts` (modify — add exact-match D-04 helper) | test fixture | CRUD | itself | exact — modify in place |

## Pattern Assignments

### `lib/auth/require-cliente.ts` (guard, request-response)

**Analog:** `lib/auth/require-admin.ts` (read in full this session, 84 lines)

**Imports pattern** (lines 1-4):
```typescript
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
```

**Core pattern — do NOT duplicate the role query.** RESEARCH.md Pattern 2 explicitly names this Phase's anti-pattern risk (WR-03, already paid down once in Phase 1): `requireCliente()` must **not** re-implement its own `getSessionStatus()`-style query. Instead, extend `lib/auth/require-admin.ts`'s existing `SessionStatus` union (currently `{status:"none"}|{status:"not-admin"}|{status:"admin", session}`) to a three-way `{status:"none"}|{status:"admin", session}|{status:"customer", session}|{status:"other"}` (or similar), export `getSessionStatus` (or a `getUserSession`-style wrapper) from `require-admin.ts`, and have `require-cliente.ts` import and compose it — mirroring exactly how `getAdminSession`/`requireAdmin` both currently compose the single private `getSessionStatus()` (lines 30-50, 58-61, 71-83 of `require-admin.ts`, reproduced below).

**Session-status core** (`lib/auth/require-admin.ts` lines 30-50 — the piece to generalize):
```typescript
const getSessionStatus = cache(async (): Promise<SessionStatus> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    return { status: "none" };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .single();

  if (perfil?.role !== "admin") {
    return { status: "not-admin" };
  }

  return { status: "admin", session: { userId: claims.sub, email: claims.email } };
});
```

**Redirect-variant pattern** (lines 71-83, the shape `requireCliente()` mirrors 1:1, swapping `"admin"`→`"customer"` and the redirect targets):
```typescript
export async function requireAdmin(): Promise<AdminSession> {
  const resultado = await getSessionStatus();

  if (resultado.status === "none") {
    redirect("/login");
  }

  if (resultado.status === "not-admin") {
    redirect("/login?motivo=sin-acceso");
  }

  return resultado.session;
}
```
`requireCliente()` should redirect a `status:"none"` session to `/login`, an `status:"admin"` (wrong-role) session sensibly (either `/admin` since they're already legitimately authenticated, or `/login?motivo=sin-acceso` — planner's call, not user-decided), and return `{ userId, email }` on `status:"customer"`.

**Doc-comment convention to copy** (lines 6-10, 22-29): every guard file opens with a comment explaining the proxy-vs-page-vs-RLS defense-in-depth split, and a comment above the shared session-status function stressing "this is the single most critical piece of security code — do not duplicate it."

---

### `app/login/actions.ts` (controller, request-response) — WR-01 redesign

**Analog:** itself (read in full this session, 55 lines) — modify in place, not a new file.

**Current unconditional-redirect line to replace** (line 53): `redirect("/admin");`

**Imports already present** (lines 1-5) — no new imports needed beyond what RESEARCH.md Pattern 1 shows (reuses `createClient` already imported):
```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esquemaLogin } from "@/lib/validation/auth";
```

**Error-handling pattern to preserve exactly** (lines 40-51) — D-02 requires the literal string `"Correo o contraseña incorrectos."` stay unchanged for both the existing wrong-password branch and the new "authenticated but no recognized role" branch:
```typescript
if (error) {
  if (error.code === "invalid_credentials" || error.status === 400) {
    return { error: "Correo o contraseña incorrectos." };
  }

  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  }

  console.error("Error inesperado al iniciar sesión:", error);
  return { error: "No pudimos iniciar sesión en este momento. Inténtalo de nuevo en unos minutos." };
}
```

**Replacement core pattern** — see RESEARCH.md's "Pattern 1" (already vetted against this repo, reuses the `getSessionStatus`-equivalent role lookup rather than a second independent `profiles` query):
```typescript
// after successful signInWithPassword(), call the shared role-lookup
// (same one require-cliente.ts / require-admin.ts compose — see above)
// rather than a third independent `.from("profiles").select("role")` query.
if (role === "admin") redirect("/admin");
if (role === "customer") redirect("/cliente");

await supabase.auth.signOut({ scope: "local" });
return { error: "Correo o contraseña incorrectos." };
```

**Regression test to extend, not just add:** `tests/e2e/admin-access.test.ts` line 25's `"redirects a signed-in customer requesting /admin to /login?motivo=sin-acceso"` test is unaffected (it hits `/admin` directly, not via login redirect) — confirmed safe per RESEARCH.md. Do not touch that test; add a new assertion for the `/cliente` redirect target instead (pattern below).

---

### `app/cliente/page.tsx` (controller, request-response)

**Analog:** `app/admin/page.tsx` (read in full this session, 44 lines)

**Imports pattern** (lines 1-8) — swap `requireAdmin`→`requireCliente`, `reservas/lista-reservas`→the new client-scoped list component:
```typescript
import Link from "next/link";
import { Suspense } from "react";
import { requireCliente } from "@/lib/auth/require-cliente";
import { ListaReservasCliente, ListaReservasClienteSkeleton } from "./lista-reservas-cliente";
```

**Guard-then-render pattern** (lines 15-31) — the exact shape: call the guard first (line 15), read/derive any params, then wrap the data-dependent section in `<Suspense>`:
```typescript
const cliente = await requireCliente();

return (
  <main data-testid="panel-cliente" className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-12">
    {/* ... */}
    <Suspense fallback={<ListaReservasClienteSkeleton />}>
      <ListaReservasCliente clienteId={cliente.userId} />
    </Suspense>
  </main>
);
```
Note: unlike `/admin`, there is no `q`/`estado`/`tipo` filter bar for `/cliente` (not in scope per CONTEXT.md) — the `Suspense` wrapper is still worth keeping for the async list fetch, but there's no `FiltrosReservas`-equivalent to import.

**Empty-state composition point** — `app/admin/page.tsx` doesn't have an empty-state CTA itself (that lives inside `lista-reservas.tsx`'s `ListaVacia()`); `/cliente` should follow the same placement: the empty state (D-17/D-18) belongs **inside** the list component (see below), not inlined in `page.tsx`, keeping `page.tsx` itself thin — same separation of concerns as Phase 2.

---

### `lib/reservas/listar-cliente.ts` (service, CRUD)

**Analog:** `lib/reservas/listar.ts` (read in full this session, 139 lines) — this is the single strongest analog in the whole phase; RESEARCH.md's Code Examples section explicitly says to extend/reuse this pattern.

**Imports pattern** (lines 1-4):
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { ESTADOS_PROVEEDOR, TIPOS_RESERVA } from "@/lib/validation/reservas";
```
No `escaparPatronLike` import needed — `/cliente` has no search box (out of scope).

**"Sin server-only" comment convention to copy** (lines 6-9): this module takes the Supabase client as a parameter rather than creating its own — same reasoning applies here (`/cliente` Server Component and any client-scoped db test can both import it safely).

**Derived-payment-status core pattern to reuse verbatim** (lines 110-136) — this is exactly RESA-05/D-15's "dual status" requirement (provider status is already a plain column; payment status must be derived the same way, never trusted from a client-writable source):
```typescript
const ids = data.map((fila) => fila.id);

const { data: pagosConfirmados, error: errorPagos } = await supabase
  .from("pagos")
  .select("reserva_id")
  .eq("estado", "confirmado")
  .in("reserva_id", ids);

if (errorPagos) {
  console.error("Error al leer los pagos confirmados de la página:", errorPagos);
  return { filas: [], total: 0, pagina, totalPaginas: 0, error: true };
}

const idsPagados = new Set((pagosConfirmados ?? []).map((pago) => pago.reserva_id));
```

**Scoping change needed (the actual new logic):** replace every unfiltered `.from("reservas")` in the analog with `.eq("cliente_id", clienteId)` — but this is **defense-in-depth only**; RLS (`reservas: el cliente ve las suyas`, `using ((select auth.uid()) = cliente_id)`, verified in `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:67-71`) is the actual enforced boundary per AUTH-02, so the query filter must never be treated as the security control, just a convenience/perf filter that RLS would enforce anyway even if omitted.

**Split-by-`fecha_importante` (D-16, new logic not in the analog):** the analog has no equivalent — this is genuinely new. Recommend splitting client-side (in the returned data shape or in the component) rather than as two separate queries, since both slices need the same shape and the count math the analog already handles (`TAMANO_PAGINA`, `range()`) doesn't map cleanly to two independently-paginated lists for a single client's typically-small reservation count — planner should decide whether `/cliente` needs pagination at all (likely no: a single customer's reservation count is small, unlike the admin's full list).

**Pagination clamp pattern** (lines 51, 61, 71-79) — reuse only if the planner decides `/cliente` needs pagination; otherwise this whole clamp/count block can be dropped for a simpler unpaginated query.

---

### `app/cliente/lista-reservas-cliente.tsx` (component, transform/render)

**Analog:** `app/admin/reservas/lista-reservas.tsx` (read in full this session, 268 lines)

**Badge patterns to reuse verbatim** (lines 19-47) — D-15 needs exactly these two badges (provider status + payment status), already built:
```typescript
const BADGE_GRIS = "bg-gray-100 text-gray-700";
const BADGE_VERDE = "bg-green-50 text-green-700";
const BADGE_ROJO = "bg-red-50 text-red-700";

function claseBadgeProveedor(estado: string): string {
  if (estado === "confirmada") return BADGE_VERDE;
  if (estado === "con_problema") return BADGE_ROJO;
  return BADGE_GRIS;
}

function BadgeProveedor({ estado }: { estado: string }) {
  return (
    <Badge className={claseBadgeProveedor(estado)}>
      {etiquetaDesde(ETIQUETAS_ESTADO_PROVEEDOR, estado)}
    </Badge>
  );
}

function BadgePago({ pagado }: { pagado: boolean }) {
  return (
    <Badge className={pagado ? BADGE_VERDE : BADGE_GRIS}>{pagado ? "Pagado" : "Pendiente"}</Badge>
  );
}
```

**Date-formatting pattern to reuse verbatim** (lines 54-60) — the comment explains exactly why (UTC-4 off-by-one bug avoidance):
```typescript
function formatearFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}
```

**"Para: [viajero]" pattern (D-14) already exists, reuse verbatim** (lines 79-90, the `Cliente` component) — same visual language the admin list uses:
```typescript
function Cliente({ fila, truncar }: { fila: FilaListaReserva; truncar: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={truncar ? "block max-w-[10rem] truncate" : undefined} title={truncar ? fila.pagadorNombre : undefined}>
        {fila.pagadorNombre}
      </span>
      {fila.viajeroNombre && (
        <span className="text-xs text-muted-foreground">Viaja: {fila.viajeroNombre}</span>
      )}
    </div>
  );
}
```
Note: D-14 says "Para: [nombre del viajero]" — the admin analog's label is "Viaja: [nombre]"; the client-facing copy should likely say "Para:" per the locked decision, a small deliberate text change from the analog, not a verbatim copy of that one string.

**Responsive table/card split to reuse verbatim** (lines 100-183) — `ListaReservasSkeleton`, `TablaReservas` (`hidden sm:block`), `TarjetasReservas` (`flex flex-col gap-4 sm:hidden`) — same mobile-first pattern (project constraint: "la mayoría de los clientes usan celular").

**Empty-state shape to follow, content to replace per D-17/D-18** (lines 185-197, `ListaVacia()`) — same structural shape (`h2` + `p` + CTA button), but D-17/D-18/D-19 dictate entirely new copy and a WhatsApp link instead of an internal `Link`:
```typescript
// Structure to copy (h2 + p + CTA), content per D-17/D-18:
function ListaVacia() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <h2 className="font-display text-xl font-bold">Todavía no hay reservas cargadas</h2>
      <p className="text-muted-foreground">...</p>
      <Button asChild className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95">
        <Link href="/admin/reservas/nueva">Crear reserva</Link>
      </Button>
    </div>
  );
}
```
This is where `<WhatsappCta />` (the new isolated component, see below) gets composed in — `ListaVacia`-equivalent for `/cliente` renders the empty-state copy inline (per D-17's exact text) and delegates only the CTA button itself to the swappable component (per the Fase 3↔6 deferred connection point).

---

### `components/whatsapp-cta.tsx` (component, request-response / static link)

**No direct analog** — this repo has no existing "external link with prefilled message" component. Closest structural precedent is the `Button asChild` + `Link` pattern used throughout `lista-reservas.tsx` (e.g. lines 192-194 `ListaVacia`'s CTA, and `BotonEditar` lines 92-98) — reuse the `Button asChild` wrapper shape, but the `href` target is `https://wa.me/<NEXT_PUBLIC_WHATSAPP_OPERADOR>?text=<urlencoded message>` (external `<a>`, not Next `<Link>`, since it's off-site).

**Pattern to copy (button shape only)** — `app/admin/reservas/lista-reservas.tsx` lines 192-194:
```typescript
<Button asChild className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95">
  <Link href="/admin/reservas/nueva">Crear reserva</Link>
</Button>
```
becomes (structurally, not literally — swap `Link` for a plain external anchor and construct the `wa.me` URL from `NEXT_PUBLIC_WHATSAPP_OPERADOR` + `encodeURIComponent("Hola, quiero planificar un viaje")`):
```typescript
<Button asChild className="min-h-11 rounded-full bg-primary text-primary-foreground active:scale-95">
  <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_OPERADOR}?text=${encodeURIComponent("Hola, quiero planificar un viaje")}`} target="_blank" rel="noopener noreferrer">
    Planifica tu próxima aventura
  </a>
</Button>
```
**Isolation requirement (deferred-connection point, non-negotiable per CONTEXT.md):** this must be its own component file, imported by the empty-state block, with no WhatsApp-specific logic leaking into `lista-reservas-cliente.tsx` itself — Phase 6 replaces only this file's internals.

---

### `app/admin/clientes/page.tsx` (controller, request-response)

**Analog:** `app/admin/page.tsx` (read in full this session, 44 lines) — same guard+Suspense+list shape as `/cliente`, but for the admin-facing client list (D-06).

**Reuse the same skeleton**: guard (`requireAdmin()`) → optional params (`leerParametrosLista`-equivalent for cliente search) → `<Suspense>` wrapping a `<ListaClientes>` Server Component, exactly mirroring lines 15-31 of the analog. No filter bar unless the planner wants one for D-06's "list/paginate" discretion area.

---

### `app/admin/clientes/lista-clientes.tsx` (component, transform/render)

**Analog:** `app/admin/reservas/lista-reservas.tsx` (same file as above — table/card/badge/skeleton/pagination reused wholesale for the new "cuenta de cliente" domain)

**New badge needed (D-10, "Invitación pendiente")** — same `Badge` component, same `BADGE_*` class constants (lines 19-25), new semantic case:
```typescript
// Follows the same claseBadgeProveedor()-shape switch as the analog:
function claseBadgeInvitacion(pendiente: boolean): string {
  return pendiente ? BADGE_GRIS : BADGE_VERDE; // "Invitación pendiente" vs implicit "activa"
}
```

**Reenviar button** — same `Button`/`asChild` shape as `BotonEditar` (lines 92-98), but as a `<form action={reenviarInvitacion}>` submit button (Server Action, not a `Link`) — matches the `cerrarSesion` form pattern in `app/admin/page.tsx` lines 35-39:
```typescript
<form data-testid="form-cerrar-sesion" action={cerrarSesion}>
  <Button type="submit" variant="outline" className="min-h-11">
    Cerrar sesión
  </Button>
</form>
```

---

### `app/admin/clientes/actions.ts` (controller, CRUD + event-driven)

**Analog:** `app/admin/reservas/actions.ts` (read in full this session, 90 lines)

**Imports and guard pattern to copy verbatim** (lines 1-5):
```typescript
"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
```
Every Server Action in this file must call `await requireAdmin();` as its **first** line (see `crearReserva` line 26, `editarReserva` line 52) — non-negotiable, this is the page-level authorization convention throughout `app/admin/`.

**Zod-validate-then-mutate pattern to copy** (lines 22-45, `crearReserva`):
```typescript
export async function crearReserva(
  _previo: EstadoFormularioReserva,
  formData: FormData,
): Promise<EstadoFormularioReserva> {
  const admin = await requireAdmin();
  const resultado = esquemaReserva.safeParse(datosReservaDesdeFormData(formData));

  if (!resultado.success) return { errores: erroresPorCampo(resultado.error) };

  const supabase = await createClient();

  const { error } = await supabase.from("reservas").insert({ ...filaReservaDesdeDatos(resultado.data), created_by: admin.userId });

  if (error) {
    console.error("Error al crear la reserva:", error);
    return { error: "No se guardó la reserva. Revisa tu conexión e inténtalo de nuevo." };
  }

  redirect("/admin?aviso=creada");
}
```
`vincularReserva`/`desvincularReserva` (D-07) follow this exact shape: guard → validate the `reservaId`/`clienteId` (reuse `z.string().uuid().safeParse(id)` from `editarReserva` line 54) → `.update({ cliente_id: ... }).eq("id", ...)` → redirect with an `?aviso=` query param (extend `components/aviso-toast.tsx`'s fixed `AVISOS` dictionary, lines 10-15, with new keys like `vinculada`/`desvinculada`/`invitada`).

**Privileged actions (`invitarCliente`, `reenviarInvitacion`) have NO analog in this file** — they must additionally import `lib/supabase/admin.ts` (new, service-role-keyed) rather than the regular `createClient()`. Per D-20/RESEARCH.md, this slice is Claude-implemented directly (secrets-touching), not delegated to Codex.

---

### `lib/supabase/admin.ts` (config/client factory)

**Analog:** `lib/supabase/server.ts` (read in full this session, 38 lines) — same "server-only" factory shape, different key and no cookie plumbing (the Admin API is stateless/service-role, not session-based).

**Imports and `server-only` guard pattern to copy verbatim** (lines 1-4, 6-9):
```typescript
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js"; // not @supabase/ssr — no cookies needed
import type { Database } from "@/lib/database.types";

// Este archivo solo puede importarse desde app/admin/clientes/actions.ts (y
// nada más). SUPABASE_SECRET_KEY bypasea RLS por completo — Pitfall 3.
```

**Test-only precedent for the same key** — `tests/helpers/fixtures.ts` lines 50-61 (`serviceClient()`) already establishes the exact client-construction shape this new file mirrors, just promoted from test-only to a narrowly-scoped app runtime file:
```typescript
export function serviceClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```
**Critical difference from the test helper:** the app version must read `SUPABASE_SECRET_KEY` from `.env.local` (not `.env.admin.local`, which the app never loads per `.env.example`'s own comment, verified this session) — this is a **new** env var placement decision, not a copy of the test file's env source.

---

### `lib/clientes/invitar.ts` (service, event-driven) — no analog, RESEARCH.md Code Examples cover it directly

**Source:** RESEARCH.md's own "Code Examples" section (verified against `node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js:148-163` and this repo's own trigger in `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql:96-104`):
```typescript
await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  data: { nombre },
  redirectTo: `${baseUrl}/cliente/completar-cuenta`,
});
```
This relies on the existing trigger (verified, lines 96-104 of the migration) already reading `raw_user_meta_data ->> 'nombre'` into `profiles.nombre` — no new migration needed for this piece.

**Resend workaround (Pitfall 2, D-10) — delete then reinvite, not a second `inviteUserByEmail()` call:**
```typescript
// RESEARCH.md Pitfall 2: a second inviteUserByEmail() call for the same
// still-unconfirmed email errors ("A user with this email address has
// already been registered"). Safe because profiles.id references
// auth.users(id) on delete cascade (verified, perfiles_y_rol_admin.sql:20).
await supabaseAdmin.auth.admin.deleteUser(userId);
await supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { nombre }, redirectTo });
```

---

### `lib/clientes/vincular.ts` (service, CRUD) — D-04/D-08, Pitfall 4

**Analog (search half):** `lib/reservas/listar.ts` line 63 + `lib/reservas/parametros-lista.ts` line 64-66 (`escaparPatronLike`)

**Existing narrow search to extend, not copy as-is** (`lib/reservas/listar.ts:63`, verified):
```typescript
if (q) conteo = conteo.ilike("pagador_nombre", `%${escaparPatronLike(q)}%`);
```

**D-08's required extension (from RESEARCH.md Code Examples, cross-referenced against the escape helper actually in this repo):**
```typescript
const patron = `%${escaparPatronLike(q)}%`;
consulta = consulta
  .is("cliente_id", null)
  .or(`pagador_nombre.ilike.${patron},pagador_email.ilike.${patron},pagador_telefono.ilike.${patron}`);
```

**Pitfall 4 — auto-link (D-04) must be a SEPARATE function using exact equality, never the `ilike` search above:**
```typescript
// Separate function/query from the candidate search above — never share
// the same .or()/.ilike() call between auto-link and candidate search.
consulta = consulta
  .is("cliente_id", null)
  .eq("pagador_email", email); // exact match only; add .eq("pagador_telefono", telefono) per D-04's hybrid rule
```

**Mutation half (link/unlink, D-04/D-07) — copy `editarReserva`'s update-then-check shape** (`app/admin/reservas/actions.ts` lines 76-86):
```typescript
const { data, error } = await supabase
  .from("reservas")
  .update({ cliente_id: clienteId }) // or { cliente_id: null } for desvincular
  .eq("id", id)
  .select("id");

if (error || !data?.length) {
  console.error("Error al vincular la reserva:", error ?? "No se encontró la reserva.");
  return { error: "No se pudo vincular la reserva. Inténtalo de nuevo." };
}
```

---

### `lib/validation/clientes.ts` (validation, transform)

**Analog:** `lib/validation/auth.ts` (read in full this session, 22 lines) for the shared-schema doc-comment convention, plus `erroresPorCampo()` from `lib/validation/reservas.ts` (lines 246-256) for server-side error mapping — reuse `erroresPorCampo` directly, no need to reimplement it.

**Schema-doc-comment convention to copy** (`lib/validation/auth.ts` lines 3-8):
```typescript
/**
 * Esquema compartido por el formulario de [X] (validación instantánea vía
 * zodResolver) y por la Server Action [Y] (validación real, ya que un
 * cliente sin JavaScript puede enviar cualquier cosa). Un solo esquema evita
 * duplicar reglas en dos lugares.
 */
export const esquemaInvitarCliente = z.object({
  nombre: z.string().trim().min(1, { message: "Escribe el nombre del cliente." }).max(120),
  email: z.string().trim().toLowerCase().email({ message: "Escribe un correo válido." }).max(254),
});
```

---

## Shared Patterns

### Auth Guard (session-status composition)
**Source:** `lib/auth/require-admin.ts` (lines 30-61, the private `getSessionStatus` + `getAdminSession`)
**Apply to:** `lib/auth/require-cliente.ts`, and the redesigned `app/login/actions.ts`
**Rule:** exactly one query composes `profiles.role`; every guard/action derives its answer from that single cached function. Never write a second independent `.from("profiles").select("role")` call anywhere in this phase's new code — this is the WR-03 lesson already paid for once in this codebase (see `01-REVIEW-FIX.md`).

### Server Action shape (guard-first, validate, mutate, redirect-with-aviso)
**Source:** `app/admin/reservas/actions.ts` (both `crearReserva` and `editarReserva`)
**Apply to:** All new `app/admin/clientes/actions.ts` functions
```typescript
"use server";
export async function accion(_previo: Estado, formData: FormData): Promise<Estado> {
  const admin = await requireAdmin(); // 1. guard first, always
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) return { errores: erroresPorCampo(resultado.error) }; // 2. validate
  const supabase = await createClient();
  const { error } = await supabase.from("x").insert/update(...); // 3. mutate
  if (error) { console.error("...", error); return { error: "mensaje genérico en español" }; }
  redirect("/ruta?aviso=clave"); // 4. redirect with a fixed AVISOS key
}
```

### Toast/aviso pattern
**Source:** `components/aviso-toast.tsx` (fixed `AVISOS` dictionary, lines 10-15)
**Apply to:** Any new redirect-with-confirmation flow (invite sent, reserva vinculada/desvinculada)
**Rule:** extend the existing fixed dictionary with new keys — never render the raw query param value directly (comment at lines 9-10 explains why: avoids reflecting arbitrary text).

### Error handling / generic-message convention
**Source:** `app/login/actions.ts` (lines 40-51), `app/admin/reservas/actions.ts` (lines 38-42, 82-86)
**Apply to:** All new Server Actions
**Rule:** `console.error("Error [en español, contexto específico]:", error)` server-side, paired with a short, non-technical Spanish message to the user that never leaks the underlying Postgres/Supabase error detail. D-01/D-02 raise this to a hard security requirement specifically for the login path (identical string for both failure modes) — everywhere else it's a UX convention, not a security boundary.

### RLS as the real boundary (page guards are UX only)
**Source:** `proxy.ts` (lines 6-12), `lib/auth/require-admin.ts` (lines 6-10), migrations (`reservas: el cliente ve las suyas`, `pagos: el cliente ve los de sus reservas`)
**Apply to:** `/cliente`, `lib/reservas/listar-cliente.ts`, `lib/clientes/vincular.ts`
**Rule:** every new query still scopes explicitly (`.eq("cliente_id", ...)`) for correctness/performance, but AUTH-02 is satisfied by the pre-existing RLS policies, unchanged this phase — never treat an app-level filter as the security control.

### Secret-key confinement
**Source:** RESEARCH.md Pitfall 3, `lib/supabase/server.ts`'s own `server-only` pattern, `tests/helpers/fixtures.ts`'s `serviceClient()` precedent
**Apply to:** `lib/supabase/admin.ts` only
**Rule:** `SUPABASE_SECRET_KEY` (new: added to `.env.local`, not `.env.admin.local`) is read in exactly one file, imported only from `app/admin/clientes/actions.ts`'s privileged functions (`invitarCliente`, `reenviarInvitacion`, and optionally the pending-list read per RESEARCH.md's Open Question 2). Never import `lib/supabase/admin.ts` from anything client-reachable or from any other `lib/` module.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/clientes/invitar.ts` (invite/resend calls specifically — `auth.admin.inviteUserByEmail`/`deleteUser`) | service | event-driven | First privileged (service-role) code path anywhere in this repo's `lib/` — the only precedent is test-only (`tests/helpers/fixtures.ts`'s `serviceClient()`/`createTestUser()`), which RESEARCH.md's Code Examples section already covers directly; no in-app analog exists because this is a genuinely new capability class for this phase. |
| `components/whatsapp-cta.tsx` | component | request-response (static external link) | No existing component builds an external `wa.me`/`mailto:`-style link with a prefilled message; closest precedent is only the generic `Button asChild` + anchor shape used throughout `lista-reservas.tsx`, reused above for its button styling only. |
| `app/cliente/completar-cuenta/page.tsx` (invite-accept flow, `updateUser({password})`) | controller (Server Component + form) | request-response | Not explicitly named in CONTEXT.md's file list but required by RESEARCH.md's Runtime State Inventory (the invite `redirectTo` target doesn't exist yet) — no analog because this repo has no prior "set your own password" flow (the admin's password was seeded via `scripts/seed-admin.mjs`, not a web form). Planner should treat this as a small net-new page; closest stylistic reference is `app/login/login-form.tsx`'s `useActionState` + `zodResolver` shape for the two-field (password + confirm) form. |

## Metadata

**Analog search scope:** `app/`, `lib/`, `components/`, `supabase/migrations/`, `tests/` (all directories in this repo containing source/test files; confirmed exhaustive via `find app lib components -type f`)
**Files scanned:** 24 source files (`app/`, `lib/`, `components/`) + 5 migrations + 20 test files, of which 18 were read in full or in targeted excerpt this session
**Pattern extraction date:** 2026-09-29
**Tracked-source gate:** all analog paths verified via `git ls-files` (18/18 tracked, plus `proxy.ts`) — no gitignored mirrors in this repo; not applicable here since this project has no `.gsd/capabilities/` plugin-mirror structure.
