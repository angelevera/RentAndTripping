# Phase 2: Gestión de reservas (admin) - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 13 (new/modified)
**Analogs found:** 13 / 13 (all have at least a role-match analog; several are exact matches — Phase 1 already established every pattern this phase needs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<timestamp>_pagador_viajero_reservas.sql` | migration | CRUD (schema) | `supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql` (constraint-add shape) + `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql` (table/column shape) | exact |
| `lib/validation/reservas.ts` | utility (validation schema) | transform | `lib/validation/auth.ts` | exact |
| `app/admin/reservas/actions.ts` (`crearReserva`, `editarReserva`, `marcarEstadoProveedor`) | controller (Server Action) | request-response | `app/login/actions.ts` (safeParse + redirect shape) + `app/admin/actions.ts` (`requireAdmin()` call site) | exact |
| `app/admin/reservas/reserva-form.tsx` | component (Client Component form) | request-response | `app/login/login-form.tsx` | exact |
| `app/admin/reservas/nueva/page.tsx` | route (Server Component page) | request-response | `app/admin/page.tsx` | role-match |
| `app/admin/reservas/[id]/editar/page.tsx` | route (Server Component page) | CRUD (read one + edit) | `app/admin/page.tsx` (auth-gated Server Component shell) | role-match |
| `app/admin/page.tsx` (rewrite: list + filters + pagination) | route (Server Component page) | CRUD (list/read) | `app/admin/page.tsx` itself (same file, modified) — structurally use `lib/auth/require-admin.ts` gate + query pattern shown in RESEARCH.md Pattern 5 | exact (self) |
| `app/admin/reservas/lista-reservas.tsx` | component (Server/Client split table+cards) | CRUD (read/display) | No direct analog exists yet — closest structural precedent is `app/admin/page.tsx`'s auth+layout shell | no strong analog |
| `lib/auth/require-admin.ts` (reused, not modified) | middleware/guard | request-response | itself — reuse literally, no changes needed | exact |
| `tests/helpers/fixtures.ts` (`createReservaFixture` — modify) | test helper | CRUD | itself — modify in place | exact |
| `tests/validation/reservas.test.ts` | test (unit) | transform | no existing unit-test-only file (all existing tests are integration `tests/rls/*`, `tests/auth/*`, `tests/e2e/*`) — closest structural precedent is the `describe`/`it` + `expect` shape of `tests/rls/aislamiento-clientes.test.ts`, but without fixtures/Supabase | role-match |
| `tests/actions/crear-reserva.test.ts`, `tests/actions/editar-reserva.test.ts`, `tests/actions/estado-proveedor.test.ts` | test (integration) | CRUD | `tests/rls/aislamiento-clientes.test.ts` | exact |
| `tests/rls/lista-reservas.test.ts`, `tests/rls/reservas-sin-cuenta.test.ts` | test (integration, RLS) | CRUD | `tests/rls/aislamiento-clientes.test.ts` | exact |

## Pattern Assignments

### `supabase/migrations/<timestamp>_pagador_viajero_reservas.sql` (migration)

**Analogs:** `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql` (table already defines `reservas`, `estado_proveedor`, `nota_problema`), `supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql` (constraint-tightening shape).

**Existing `reservas` column shape to alter** (`supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:34-48`):
```sql
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profiles (id) on delete restrict,
  tipo text not null check (tipo in ('pasaje', 'hotel', 'tour', 'entrada')),
  detalle jsonb not null default '{}'::jsonb,
  precio numeric(12, 2) not null check (precio >= 0),
  moneda text not null default 'USD' check (moneda in ('USD','VES')),
  estado_proveedor text not null default 'pendiente'
    check (estado_proveedor in ('pendiente', 'confirmada', 'con_problema')),
  nota_problema text,
  fecha_importante date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**Existing RLS policies to leave untouched** (still correct once `cliente_id` is nullable — a NULL never equals `auth.uid()`), `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:67-78`:
```sql
create policy "reservas: el cliente ve las suyas"
on public.reservas
for select
to authenticated
using ( (select auth.uid()) = cliente_id );

create policy "reservas: el admin gestiona todas"
on public.reservas
for all
to authenticated
using ( (select private.is_admin()) )
with check ( (select private.is_admin()) );
```

**Constraint-add pattern to copy verbatim in shape** (`supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql:1-17`) — same `alter table ... drop constraint` / `add constraint ... check (...)` shape, with a comment above explaining *why* (references the code-review/invariant that motivated it):
```sql
alter table public.pagos
  drop constraint pagos_tasa_cambio_obligatoria_en_bs;

alter table public.pagos
  add constraint pagos_tasa_cambio_solo_en_bs
    check (
      (moneda = 'VES' and tasa_cambio is not null)
      or (moneda = 'USD' and tasa_cambio is null)
    );
```
Apply the same shape for the new `reservas_nota_problema_si_con_problema` constraint (RESEARCH.md Pattern 1 already drafted the exact SQL — copy that, not this file's specific columns).

**No GRANT/RLS-enable statements needed for this migration** — `reservas` already has RLS enabled and GRANTed (`supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:50-52`); this migration only alters columns/constraints on an existing table, so skip the `alter table ... enable row level security` + `grant ...` block that a *new*-table migration would need.

**Generate the migration file, never hand-write the timestamp:**
```bash
npx supabase migration new pagador_viajero_reservas
```

---

### `lib/validation/reservas.ts` (utility, validation schema)

**Analog:** `lib/validation/auth.ts` (entire file, 21 lines — read fully, exact pattern to extend).

**Full pattern to copy** (`lib/validation/auth.ts:1-21`):
```typescript
import { z } from "zod";

/**
 * Esquema compartido por el formulario de login (validación instantánea en
 * el teléfono, vía zodResolver) y por la Server Action iniciarSesion
 * (validación real, ya que un cliente sin JavaScript puede enviar cualquier
 * cosa). Un solo esquema evita duplicar reglas en dos lugares.
 */
export const esquemaLogin = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Escribe tu correo." })
    .email({ message: "Escribe un correo válido." }),
  password: z
    .string()
    .min(1, { message: "Escribe tu contraseña." })
    .max(72, { message: "La contraseña es demasiado larga." }),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
```

**What to replicate:**
- Single `z.object`/`z.discriminatedUnion` exported as `esquemaXxx`, consumed by both `zodResolver` (client) and `.safeParse` (server) — never two schemas.
- Every field-level error uses a `message:` in Spanish, written for a non-technical single admin.
- Export the inferred type via `z.infer<typeof esquema...>` (e.g. `DatosReserva`) for `useForm<DatosReserva>`.
- RESEARCH.md's `02-RESEARCH.md:267-352` (Pattern 2) already drafted the full discriminated-union + refine shape (`esquemaDetalle`, `esquemaReserva`, `esquemaEstadoProveedor`) — copy that draft directly into this file, it already follows the `lib/validation/auth.ts` house style (trim, verbatim UI-SPEC error copy, `.refine` for cross-field rules).

---

### `app/admin/reservas/actions.ts` (controller, Server Action — `crearReserva`, `editarReserva`, `marcarEstadoProveedor`)

**Analogs:** `app/login/actions.ts` (safeParse → Supabase call → redirect shape), `app/admin/actions.ts` (`requireAdmin()` call-site convention).

**Imports + `"use server"` + state-type pattern** (`app/login/actions.ts:1-10`):
```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esquemaLogin } from "@/lib/validation/auth";

export type EstadoLogin = {
  error?: string;
  errores?: { email?: string; password?: string };
};
```
For reservas, mirror this as `EstadoReserva = { error?: string; errores?: Record<string, string | undefined> }` (RESEARCH.md `02-RESEARCH.md:370-373` already drafted this).

**`requireAdmin()` as first line of every Server Action** (`app/admin/actions.ts:1-15`, full file):
```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function cerrarSesion() {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
```
Every one of `crearReserva`, `editarReserva`, `marcarEstadoProveedor` must start with `await requireAdmin();` exactly like this — this is the single most important pattern to copy literally (see Shared Patterns → Authorization below).

**safeParse → error-shape → Supabase mutation → redirect pattern** (`app/login/actions.ts:18-54`):
```typescript
export async function iniciarSesion(
  _previo: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const resultado = esquemaLogin.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!resultado.success) {
    const campos = resultado.error.flatten().fieldErrors;
    return {
      errores: {
        email: campos.email?.[0],
        password: campos.password?.[0],
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(resultado.data);

  if (error) {
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { error: "Correo o contraseña incorrectos." };
    }
    console.error("Error inesperado al iniciar sesión:", error);
    return { error: "No pudimos iniciar sesión en este momento. Inténtalo de nuevo en unos minutos." };
  }

  redirect("/admin");
}
```
Apply this exact shape for `crearReserva`/`editarReserva`: `requireAdmin()` first (unlike login, which has no auth gate), then `esquemaReserva.safeParse(...)`, then `supabase.from("reservas").insert(...)`/`.update(...).eq("id", id)`, then `console.error` + Spanish fallback message on failure (copy verbatim from UI-SPEC: *"No se guardó la reserva. Revisa tu conexión e inténtalo de nuevo."*), then `redirect("/admin")` on success. RESEARCH.md `02-RESEARCH.md:361-409` (Pattern 3) already has the near-final draft for `crearReserva` — use it as the base, just fill in the `formData.get(...)` extraction and field mapping for the full `esquemaReserva` shape (pagador/viajero/tipo/detalle/precio/moneda/fechaImportante).

**`marcarEstadoProveedor` note:** same shape as above but with the smaller `esquemaEstadoProveedor` (RESEARCH.md `02-RESEARCH.md:341-352`) and an `.update({ estado_proveedor, nota_problema })` — copy the same `requireAdmin()` → `safeParse` → `update` → error/redirect skeleton, do not invent a different control flow for this "smaller" action.

---

### `app/admin/reservas/reserva-form.tsx` (component, Client Component form)

**Analog:** `app/login/login-form.tsx` (full file, 108 lines — read fully).

**`useActionState` + `useForm` + `useTransition` wiring pattern** (`app/login/login-form.tsx:1-29`):
```tsx
"use client";

import { useActionState, useRef, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { esquemaLogin, type DatosLogin } from "@/lib/validation/auth";
import { iniciarSesion, type EstadoLogin } from "./actions";

const estadoInicial: EstadoLogin = {};

export function LoginForm() {
  const [estado, formAction, pendiente] = useActionState(iniciarSesion, estadoInicial);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<DatosLogin>({
    resolver: zodResolver(esquemaLogin),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.handleSubmit(() => {
      startTransition(() => {
        formAction(new FormData(formRef.current!));
      });
    })(event);
  };
  // ...
```
For `reserva-form.tsx`: same `useActionState(crearReserva | editarReserva, estadoInicial)` + `useForm<DatosReserva>({ resolver: zodResolver(esquemaReserva), mode: "onTouched", defaultValues: {...} })` wiring. For edit mode, `defaultValues` come from the loaded reserva row (per UI-SPEC "Editar: se precargan los valores guardados"), same principle as this file's `defaultValues: { email: "", password: "" }` for create.

**Error-banner suppression logic** (`app/login/login-form.tsx:31-41`) — copy this exact reasoning, it is non-obvious and load-bearing:
```tsx
const errorEmail = form.formState.errors.email?.message ?? estado.errores?.email;
const errorPassword = form.formState.errors.password?.message ?? estado.errores?.password;

// El banner de error del servidor ... solo se mantiene vigente mientras
// ningún campo tenga un error de validación propio ...
const mostrarBannerError = Boolean(estado.error) && !errorEmail && !errorPassword;
```
Generalize this to reservas: for each field, `form.formState.errors.<campo>?.message ?? estado.errores?.<campo>`; the banner (`estado.error`) only shows when no field-level error is present. This is the pattern the UI-SPEC's `Alert` component maps onto (see Shared Patterns → Error display below).

**Field markup + accessibility pattern** (`app/login/login-form.tsx:60-78`, one field of several identical ones):
```tsx
<div className="flex flex-col gap-1">
  <label htmlFor="email" className="text-sm font-medium">
    Correo
  </label>
  <input
    id="email"
    type="email"
    inputMode="email"
    autoComplete="email"
    aria-describedby={errorEmail ? "email-error" : undefined}
    className="min-h-11 rounded border border-gray-300 px-3 text-[17px]"
    {...form.register("email")}
  />
  {errorEmail && (
    <p id="email-error" className="text-sm text-red-700">
      {errorEmail}
    </p>
  )}
</div>
```
**Important deviation for this phase:** `02-UI-SPEC.md` prescribes the shadcn `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` components (not raw `<label>`/`<input>` as above) — shadcn's `Form` wraps exactly this `react-hook-form` + accessibility wiring (`aria-invalid`, `aria-describedby`, `htmlFor` auto-generated). Use `login-form.tsx` for the **state-management skeleton** (`useActionState`, `useForm`, error-merging, submit handler), but render fields with shadcn's `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` (RESEARCH.md `02-RESEARCH.md:411-433`, Pattern 4) once `npx shadcn add form` is run, not with hand-rolled `<label>`/`<input>` markup — that hand-rolled markup predates shadcn's installation in this repo (Phase 1 deliberately deferred shadcn) and is legacy for new form code in this phase.

**Submit button loading-state pattern** (`app/login/login-form.tsx:99-105`):
```tsx
<button
  type="submit"
  disabled={pendiente}
  className="min-h-11 rounded-full bg-marca px-4 py-2 font-medium text-white active:scale-95 disabled:opacity-70"
>
  {pendiente ? "Entrando…" : "Entrar"}
</button>
```
Copy this `disabled={pendiente}` + text-swap pattern for "Guardando…" (per UI-SPEC copy contract) — but render via shadcn's `Button` component (pill override per UI-SPEC) rather than a raw `<button>`.

---

### `app/admin/reservas/nueva/page.tsx`, `app/admin/reservas/[id]/editar/page.tsx`, `app/admin/page.tsx` (routes, Server Component pages)

**Analog:** `app/admin/page.tsx` (current file, full — this is also the file `app/admin/page.tsx` itself gets rewritten from).

**Full current pattern to extend** (`app/admin/page.tsx:1-22`):
```tsx
import { requireAdmin } from "@/lib/auth/require-admin";
import { cerrarSesion } from "./actions";

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main data-testid="panel-admin" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
      <h1 className="text-xl font-semibold">Panel de administración</h1>
      <p>Sesión iniciada como {admin.email}</p>
      <p className="text-gray-500">Todavía no hay reservas cargadas.</p>
      <form data-testid="form-cerrar-sesion" action={cerrarSesion}>
        <button type="submit" className="rounded bg-[#482583] px-4 py-2 font-medium text-white">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
```
**What to replicate for every new page under `/admin/reservas/`:**
- `const admin = await requireAdmin();` as the very first line of the async Server Component — same as here (RESEARCH.md's threat-model table calls this out explicitly: RLS is the real gate, but every page must call it too).
- `data-testid` on the root `<main>` (used by `tests/e2e/*` and `tests/helpers/fixtures.ts::submitForm`, which locates forms via `data-testid`) — every new form (`reserva-form.tsx`) needs its own `data-testid="form-crear-reserva"` / `data-testid="form-editar-reserva"` following the same convention as `data-testid="form-cerrar-sesion"` / `data-testid="form-login"`.
- `app/admin/page.tsx`'s placeholder paragraph (`"Todavía no hay reservas cargadas."`) is the literal copy this phase's empty-state must reuse verbatim (UI-SPEC Copywriting Contract confirms the same string) — the rewrite replaces the *surrounding* placeholder logic with `lista-reservas.tsx`, but keeps this exact string for the true-empty case.
- The Supabase list query itself (search/filter/paginate + derived payment status) has no existing analog in this repo (first list/query Server Component of the project) — use RESEARCH.md `02-RESEARCH.md:439-462` (Pattern 5) as the primary source, chaining `.ilike()`/`.eq()`/`.order()`/`.range()` on the same `createClient()` from `lib/supabase/server.ts` this file already imports transitively via `requireAdmin()`.

---

### `app/admin/reservas/lista-reservas.tsx` (component, list/table+cards)

**No close analog exists in the codebase** — this is the first data table/list component in the project. See "No Analog Found" below; build directly from `02-UI-SPEC.md`'s Component Inventory (`table`, `card`, `badge`, `skeleton`) and RESEARCH.md Pattern 5's query shape. Reuse the `min-h-11` tap-target convention and `rounded`/spacing scale already established in `login-form.tsx` and `app/globals.css`.

---

### `tests/helpers/fixtures.ts` (modify `createReservaFixture`)

**Analog:** itself — modify in place, do not create a parallel fixture function.

**Current insert to extend** (`tests/helpers/fixtures.ts:143-153`):
```typescript
const { data: reserva, error: reservaError } = await admin
  .from("reservas")
  .insert({
    cliente_id: clienteId,
    tipo: "tour",
    precio: 100,
    moneda: "USD",
    created_by: adminId,
  })
  .select("id")
  .single();
if (reservaError || !reserva) {
  throw new Error(`No se pudo crear la reserva de prueba: ${reservaError?.message}`);
}
```
**Required change (Wave 0, highest priority per RESEARCH.md Pitfall 3):** add `pagador_nombre: "Cliente de prueba"` and `pagador_telefono: "0000-0000000"` to this `insert` the moment the new migration makes those columns `NOT NULL` — every test in `tests/rls/*.test.ts` that depends on `createReservaFixture` (not just reservas-specific tests) breaks otherwise with a not-null-constraint error that masks the actual RLS assertion being tested.

---

### `tests/actions/crear-reserva.test.ts`, `tests/actions/editar-reserva.test.ts`, `tests/actions/estado-proveedor.test.ts`, `tests/rls/lista-reservas.test.ts`, `tests/rls/reservas-sin-cuenta.test.ts` (integration tests)

**Analog:** `tests/rls/aislamiento-clientes.test.ts` (full file, 189 lines — read fully, exact structural template).

**Setup/teardown pattern** (`tests/rls/aislamiento-clientes.test.ts:1-42`):
```typescript
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cleanupTestUsers,
  createReservaFixture,
  createTestUser,
  serviceClient,
  signInAs,
  sweepStaleTestUsers,
  type TestUser,
} from "../helpers/fixtures";

let clienteA: TestUser;
let admin: TestUser;

beforeAll(async () => {
  await sweepStaleTestUsers();
  clienteA = await createTestUser("customer");
  admin = await createTestUser("admin");
  // ... createReservaFixture(...) as needed
});

afterAll(async () => {
  await cleanupTestUsers();
  // re-check deleted users via serviceClient — verifies cleanup actually ran
});
```

**Assertion pattern — always re-read via `serviceClient()`, never trust "no exception thrown"** (`tests/rls/aislamiento-clientes.test.ts:83-107`):
```typescript
it("la actualización de A a su propio estado_proveedor ... no cambia nada", async () => {
  const clientA = await signInAs(clienteA);
  const service = serviceClient();

  await clientA.from("reservas").update({ estado_proveedor: "confirmada" }).eq("id", fixtureA.reservaId);

  const { data: reservaTrasIntento } = await service
    .from("reservas")
    .select("estado_proveedor")
    .eq("id", fixtureA.reservaId)
    .single();
  expect(reservaTrasIntento?.estado_proveedor).toBe("pendiente");
});
```
Apply the same "act as the actor under test, then re-read with `serviceClient()`" pattern for the new action tests — e.g. for `estado-proveedor.test.ts`, sign in as admin, call `marcarEstadoProveedor` (or insert/update directly to simulate it if testing at the DB layer), then re-read with `serviceClient()` to confirm `nota_problema` is required when `estado_proveedor = 'con_problema'` (new constraint from this phase's migration).

**For `reservas-sin-cuenta.test.ts` specifically:** create a reserva with `cliente_id: null` (via `serviceClient()`, bypassing the fixture helper if it always sets a `cliente_id`) and assert — same pattern as `aislamiento-clientes.test.ts:44-61` — that `signInAs(clienteB)` never sees it in `.from("reservas").select("id")`.

**Note on `tests/validation/reservas.test.ts` (unit, no Supabase):** no existing unit-only test file to copy structurally (all current tests are integration, importing `tests/helpers/fixtures.ts`). Use plain `describe`/`it`/`expect` from `vitest` (same imports as line 1 of `aislamiento-clientes.test.ts`, minus the fixtures import) calling `esquemaReserva.safeParse(...)`/`esquemaDetalle.safeParse(...)`/`esquemaEstadoProveedor.safeParse(...)` directly — no Supabase client needed, this is the first purely-unit test file in the project (new `tests/validation/` directory).

## Shared Patterns

### Authorization: `requireAdmin()`
**Source:** `lib/auth/require-admin.ts` (full file, unchanged — reuse literally, no edits needed)
**Apply to:** every new Server Component page (`app/admin/page.tsx`, `app/admin/reservas/nueva/page.tsx`, `app/admin/reservas/[id]/editar/page.tsx`) and every new Server Action (`crearReserva`, `editarReserva`, `marcarEstadoProveedor`) under `app/admin/reservas/actions.ts`.
```typescript
export async function requireAdmin(): Promise<AdminSession> {
  const resultado = await getSessionStatus();
  if (resultado.status === "none") redirect("/login");
  if (resultado.status === "not-admin") redirect("/login?motivo=sin-acceso");
  return resultado.session;
}
```
Call as the **first statement** in every page component and every Server Action — never rely on the proxy/middleware alone (it only does an optimistic redirect, not real authorization; RLS + `requireAdmin()` are the two real gates, per `lib/auth/require-admin.ts:6-10` comment).

### RLS admin check at the database layer: `private.is_admin()`
**Source:** `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql:46-64`
**Apply to:** the new migration does NOT need to redefine this — it already exists and is reused unchanged by the existing `"reservas: el admin gestiona todas"` policy. Relevant only as context: any new RLS policy this phase might add (none currently planned — see migration pattern above) must use `(select private.is_admin())`, never re-query `profiles` directly (avoids RLS recursion error 42P17).

### Server Action validate→mutate→redirect skeleton
**Source:** `app/login/actions.ts` (full file)
**Apply to:** `crearReserva`, `editarReserva`, `marcarEstadoProveedor` in `app/admin/reservas/actions.ts`.
Skeleton: `requireAdmin()` → `esquemaXxx.safeParse(rawFormFields)` → on failure return `{ errores: resultado.error.flatten().fieldErrors }` → on success `createClient()` + `supabase.from("reservas").insert/update(...)` → on Supabase error `console.error(...)` + return Spanish fallback message → on success `redirect(...)`.

### Client form state wiring: `useActionState` + `react-hook-form` + `zodResolver`
**Source:** `app/login/login-form.tsx` (full file)
**Apply to:** `app/admin/reservas/reserva-form.tsx` (shared between create/edit, per RESEARCH.md's recommended structure).
Skeleton: `useActionState(serverAction, estadoInicial)` + `useForm<DatosX>({ resolver: zodResolver(esquemaX), mode: "onTouched", defaultValues })` + manual `onSubmit` that calls `form.handleSubmit` then `startTransition(() => formAction(new FormData(formRef.current!)))` + field-level error merge (`form.formState.errors.<f>?.message ?? estado.errores?.<f>`) + banner suppressed when any field error is present.

### Shared Supabase server client
**Source:** `lib/supabase/server.ts` (full file, unchanged — reuse literally)
**Apply to:** every new Server Component/Server Action that reads or writes `reservas`/`pagos`. Always `await createClient()` inside the Server Component/Action body (never module scope, never a Client Component import — the file is guarded by `"server-only"`).

### Error display: field-level `FormMessage` + page-level `Alert` banner
**Source:** `app/login/login-form.tsx:51-58` (banner) + `:73-77` (field-level message), reinterpreted through shadcn's `Alert`/`FormMessage` per `02-UI-SPEC.md` Component Inventory.
**Apply to:** `reserva-form.tsx` — page-level Supabase/server failure → `Alert` banner with UI-SPEC's verbatim copy ("No se guardó la reserva. Revisa tu conexión e inténtalo de nuevo."); per-field validation failure (PNR missing, price ≤ 0, nota_problema missing) → shadcn `FormMessage` under that field, using UI-SPEC's verbatim copy strings.

### Test fixture + cleanup discipline
**Source:** `tests/helpers/fixtures.ts` (full file) + `tests/rls/aislamiento-clientes.test.ts` (usage example)
**Apply to:** all new tests under `tests/actions/` and `tests/rls/`. Always `sweepStaleTestUsers()` in `beforeAll`, `cleanupTestUsers()` in `afterAll`, act through `signInAs(user)` (never the service client) when simulating the actor under test, and always re-read state through `serviceClient()` to assert — RLS silently filters rather than erroring, so "no exception" alone is a false positive.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `app/admin/reservas/lista-reservas.tsx` | component | CRUD (read/display, table+card split) | First data-table/list component in the project — Phase 1 only ever rendered a static placeholder paragraph in `app/admin/page.tsx`, never a real collection. Build from `02-UI-SPEC.md`'s Component Inventory (`table`, `card`, `badge`, `skeleton`) and RESEARCH.md Architecture Pattern 5 (query shape), not from an existing component. |
| List/filter/paginate Supabase query (inside `app/admin/page.tsx` rewrite) | data-access logic embedded in route | CRUD (read, filtered/paginated) | First filtered+paginated `.range()`/`.ilike()`/`.order()` query in the project — Phase 1's only Supabase reads were single-row `.select().single()` lookups (`require-admin.ts`) or RLS-scoped `.select("id")` in tests. Use RESEARCH.md `02-RESEARCH.md:439-462` as the primary source. |
| `tests/validation/reservas.test.ts` | test (unit) | transform | First pure-unit (no Supabase, no fixtures) test file — `tests/validation/` is a new top-level test directory. Structure follows plain Vitest `describe`/`it`/`expect` conventions already visible in every existing test file's imports, just without the `tests/helpers/fixtures.ts` import. |

## Metadata

**Analog search scope:** `app/`, `lib/`, `supabase/migrations/`, `tests/` (entire tracked source tree relevant to this phase; confirmed via `find app lib supabase/migrations tests -type f` and cross-checked all cited paths are git-tracked, not `.gsd/` mirrors).
**Files scanned:** 19 (7 read in full for pattern extraction: `app/login/actions.ts`, `app/login/login-form.tsx`, `app/admin/actions.ts`, `app/admin/page.tsx`, `lib/auth/require-admin.ts`, `lib/validation/auth.ts`, `lib/supabase/server.ts`; plus `tests/helpers/fixtures.ts`, `tests/rls/aislamiento-clientes.test.ts`, `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql`, `supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql`, `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql` (partial, is_admin() only), `app/globals.css`, `app/layout.tsx`).
**Pattern extraction date:** 2026-09-28
