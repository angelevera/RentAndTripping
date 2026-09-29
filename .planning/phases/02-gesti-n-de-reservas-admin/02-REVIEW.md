---
phase: 02-gesti-n-de-reservas-admin
reviewed: 2026-09-29T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - app/admin/page.tsx
  - app/admin/reservas/[id]/editar/page.tsx
  - app/admin/reservas/actions.ts
  - app/admin/reservas/filtros-reservas.tsx
  - app/admin/reservas/lista-reservas.tsx
  - app/admin/reservas/nueva/page.tsx
  - app/admin/reservas/reserva-form.tsx
  - app/globals.css
  - app/layout.tsx
  - components.json
  - components/aviso-toast.tsx
  - lib/database.types.ts
  - lib/reservas/listar.ts
  - lib/reservas/parametros-lista.ts
  - lib/supabase/server.ts
  - lib/utils.ts
  - lib/validation/reservas.ts
  - supabase/migrations/20260929012532_pagador_viajero_reservas.sql
  - tests/e2e/reservas-crear.test.ts
  - tests/e2e/reservas-editar.test.ts
  - tests/e2e/reservas-lista.test.ts
  - tests/helpers/fixtures.ts
  - tests/rls/lista-reservas.test.ts
  - tests/rls/reservas-sin-cuenta.test.ts
  - tests/validation/parametros-lista.test.ts
  - tests/validation/reservas.test.ts
  - vitest.config.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

This is the phase-level cross-plan pass over reservation create/edit/list/search/filter/pagination for Rent & Trippin's admin panel. Individual plans were already reviewed and fixed in-plan (anti-slop, tsc, build), so this pass focused on the *seams* between plans: create vs. edit schema drift, the edit form's provider-status section reusing the create form's error-rendering pattern, and the new filter/pagination code composing with the pre-existing list/badge rendering and with the site-wide `AvisoToast` notification component from an earlier phase.

Most of these seams hold up well: `esquemaEdicionReserva` is built by `.extend()`ing the *unrefined* `esquemaReservaBase` and re-running `refinarReserva` alongside `refinarEstadoProveedor`, so create and edit validation logic never actually diverges; `CAMPOS_CONOCIDOS` in `reserva-form.tsx` is kept in exact sync with every leaf field of the four `detalle` variants; `avisoTrasEditar`'s state-transition table matches its own test table and every e2e scenario that exercises it; and the list's search/estado/tipo filters compose correctly with pagination, badge rendering, and the mobile/desktop dual layout.

One real cross-plan interaction bug was found: the site-wide `AvisoToast` component (mounted once in the root layout, from an earlier phase) uses a `useRef` "already shown" guard that was designed to survive React Strict Mode's double-invoke in dev, but because the root layout never remounts across client-side navigations, that same guard silently swallows every `?aviso=` notification after the very first one shown in a browser tab — a real problem now that this phase's `actions.ts` redirects with a *different* `aviso` value after every create/edit. Three further, lower-severity issues (a validation-message consistency gap for non-numeric coerced fields, a defensive-coding gap in error-path handling, and a type-safety compromise in the shared form's resolver) round out the findings below.

## Warnings

### WR-01: `AvisoToast` only ever shows the first notification per browser session

**File:** `components/aviso-toast.tsx:17-48` (interacts with `app/admin/reservas/actions.ts:44,88`)
**Issue:** `AvisoToast` is mounted once in `app/layout.tsx:48`, inside the root layout that wraps every route. Because Next.js App Router layouts persist across client-side navigations, this single component instance — and its `mostrado` ref — lives for the entire browser tab session, not per-navigation.

The comment on lines 30-33 explains the ref exists only to dedupe React Strict Mode's dev-only double effect invocation on *mount*:
```tsx
// La ref evita un segundo toast por el doble efecto de desarrollo
// (React Strict Mode) — sin ella se mostraría duplicado en `next dev`.
if (mostrado.current) return;
mostrado.current = true;
```
But this phase's `crearReserva`/`editarReserva` actions (`app/admin/reservas/actions.ts:44,88`) each redirect to `/admin?aviso=<value>` with a *different* value every time (`creada`, `guardada`, `confirmada`, `problema`), across independent server-action calls that happen throughout one continuous admin session. Once the first toast fires and sets `mostrado.current = true`, every subsequent `aviso` value — even though `searchParams.get("aviso")` correctly reports the new value and the effect correctly re-runs — is silently dropped by the `if (mostrado.current) return;` guard, and crucially this happens *before* the `router.replace(...)` call that would otherwise strip the query param. The result: after the admin's first create/edit of a session, the notification feature stops working for the rest of the session, and the `?aviso=...` query string is left dangling in the URL bar (only cleared by the branch that never runs).

Since this admin app is built around one operator doing many creates/edits/status-changes per sitting (the whole point of T-02-10's four-message aviso vocabulary), this defeats the feature for the overwhelming majority of real usage — only the very first action of a fresh page load ever gets visible feedback.

**Fix:** Scope the "already shown" guard to the specific `aviso` value rather than to the component's entire lifetime, e.g. track the last-shown value instead of a boolean:
```tsx
const mostrado = useRef<string | null>(null);

useEffect(() => {
  if (!aviso) return;
  if (!(aviso in AVISOS)) return;
  if (mostrado.current === aviso) return;
  mostrado.current = aviso;

  toast.success(AVISOS[aviso as keyof typeof AVISOS]);
  // ...router.replace as before
}, [aviso]);
```
This still prevents the Strict Mode double-fire (same `aviso` value fires twice back-to-back) while allowing a genuinely new `aviso` value on a later navigation to show. Also worth pairing with an e2e/RLS-style test that performs two sequential form submissions (create, then edit) against a live page and asserts both toasts appear — the current e2e suite only ever does one submission per navigation context, which is why this slipped through.

### WR-02: Coerced numeric fields fall back to a generic (non-Spanish) message for non-numeric input

**File:** `lib/validation/reservas.ts:36-41,108-112`
**Issue:** `cantidadPersonas` and `precio` both use `z.preprocess(...)` into `z.coerce.number()...` with custom `message` strings attached only to the `.int()`/`.min()`/`.max()`/`.positive()` refinements:
```ts
const cantidadPersonas = z.preprocess(
  (valor) => valor === "" || valor == null ? 1 : valor,
  z.coerce.number().int({ message: "Escribe cuántas personas viajan (de 1 a 50)." })
    .min(1, { message: "Escribe cuántas personas viajan (de 1 a 50)." })
    .max(50, { message: "..." }),
);
```
`z.coerce.number()` runs `Number(value)` first; for a non-numeric string (e.g. `"abc"`), this produces `NaN`, which Zod's base number check rejects as an `invalid_type` issue *before* any of the chained refinements run — so the friendly, Spanish, UAT-reviewed message never fires for that case. The admin instead sees Zod's generic built-in message. The same applies to `precio` (line 108-112): `String(valor ?? "").replace(",", ".")` only normalizes decimal commas, it doesn't guard against non-numeric input, so a garbled `precio` value also bypasses `"El precio tiene que ser mayor a cero."` in favor of a generic message.

This is reachable in production: the numeric `<input type="number">` widgets constrain typical browser typing, but every e2e test in this suite submits raw `FormData` over HTTP with no browser input constraints at all, and a real admin can still get here via autofill glitches, copy-paste, or a stale/cached form. Given the app otherwise takes real care to give every validation error a specific, friendly Spanish message, this is an inconsistency worth closing.

**Fix:** Give the coercion step itself a matching custom message so the `invalid_type` case is also covered, e.g.:
```ts
z.coerce.number({ error: "Escribe cuántas personas viajan (de 1 a 50)." })
  .int({ message: "..." }).min(1, { message: "..." }).max(50, { message: "..." })
```
(and equivalently for `precio`), or add an explicit `Number.isNaN` guard inside the `z.preprocess` step that raises the same custom message via `z.NEVER`/`ctx.addIssue`.

### WR-03: `reserva-form.tsx`'s resolver type-cast removes the exact compiler check this review was asked to verify

**File:** `app/admin/reservas/reserva-form.tsx:180-183`
**Issue:**
```ts
const resolver = (modo === "editar"
  ? zodResolver(esquemaEdicionReserva)
  : zodResolver(esquemaReserva)) as Resolver<EntradaEdicionReserva, unknown, DatosEdicionReserva>;
```
The in-code `SAFETY` comment above this correctly explains *today's* behavior is sound (crear mode simply never sees `estadoProveedor`/`notaProblema`), but the `as` cast means TypeScript no longer checks that `esquemaReserva` (the create schema) is actually assignable to what the rest of the component expects. If a future edit to `esquemaReserva`'s field types (e.g. renaming/retyping a field shared between both schemas) ever introduced a genuine incompatibility with `EntradaEdicionReserva`, this cast would silently hide it — exactly the "drift between create vs. edit schema" class of bug this cross-plan review was asked to watch for. Today there's no drift (verified: `esquemaEdicionReserva` is `esquemaReservaBase.extend(...)`, a strict superset), but the safety net for catching drift *in the future* has been intentionally removed.
**Fix:** No change needed today, but consider narrowing the blast radius — e.g. a small runtime assertion in dev (`if (modo === "crear" && "estadoProveedor" in resultado.errors) ...`) or a typed test that fails to compile if `EntradaReserva` and `EntradaEdicionReserva` ever diverge on a shared field, so the cast's safety assumption is continuously verified rather than only true "as of now."

## Info

### IN-01: `erroresPorCampo` silently drops root-level (path-less) validation issues

**File:** `lib/validation/reservas.ts:244-254`
**Issue:**
```ts
export function erroresPorCampo(error: z.ZodError) {
  const errores: Record<string, string> = {};

  for (const issue of error.issues) {
    const campo = issue.path.join(".");

    if (campo && !errores[campo]) errores[campo] = issue.message;
  }

  return errores;
}
```
`if (campo && ...)` treats an empty-string path (`issue.path = []`, e.g. a root-level `superRefine` issue with no `path` argument, or a schema-level `invalid_type` on the whole payload) as falsy and drops it entirely — it's never added to `errores`, so it never reaches the field-level UI *nor* the `erroresSinCampo` top-level `Alert` fallback in `reserva-form.tsx` (which only surfaces entries that already exist in `estado.errores`). Not currently reachable given today's schemas (every `superRefine`/discriminated-union issue in this file specifies a non-empty `path`), but it's a silent-failure trap for the next person who adds a whole-object refinement without a `path`.
**Fix:** Fall back to a sentinel key instead of dropping the issue, e.g. `const campo = issue.path.join(".") || "_raiz";`, and ensure `reserva-form.tsx`'s `erroresSinCampo` filter (which already excludes anything not in `CAMPOS_CONOCIDOS`) picks up `"_raiz"` as an unknown field and renders it in the top-level alert.

---

_Reviewed: 2026-09-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
