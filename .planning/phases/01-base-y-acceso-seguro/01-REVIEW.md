---
phase: 01-base-y-acceso-seguro
reviewed: 2026-09-28T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - .env.example
  - .gitignore
  - app/admin/actions.ts
  - app/admin/page.tsx
  - app/globals.css
  - app/layout.tsx
  - app/login/actions.ts
  - app/login/login-form.tsx
  - app/login/page.tsx
  - app/page.tsx
  - lib/auth/require-admin.ts
  - lib/database.types.ts
  - lib/supabase/server.ts
  - lib/validation/auth.ts
  - package.json
  - proxy.ts
  - scripts/configure-auth.mjs
  - scripts/seed-admin.mjs
  - supabase/migrations/20260927000001_perfiles_y_rol_admin.sql
  - supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql
  - supabase/migrations/20260927000003_comprobantes_privados.sql
  - tests/auth/auth-hardening.test.ts
  - tests/e2e/admin-access.test.ts
  - tests/e2e/admin-login.test.ts
  - tests/e2e/global-setup.ts
  - tests/helpers/fixtures.ts
  - tests/rls/aislamiento-clientes.test.ts
  - tests/rls/anonimo.test.ts
  - tests/rls/comprobantes.test.ts
  - tests/rls/perfiles-rol.test.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 0
  warning: 7
  info: 2
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-28T00:00:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

This phase implements Supabase Auth + RLS for a single-admin panel: profile/role modeling, `reservas`/`pagos`/`recordatorios` tables, a private `comprobantes` storage bucket, `require-admin.ts` guards, `proxy.ts` session refresh, and a progressively-enhanced login form. The core security architecture is sound and deliberately defensive: every migration pairs `RLS` with an explicit `GRANT` (required because "Automatically expose new tables" is off), `private.is_admin()` is `SECURITY DEFINER` with `search_path = ''` to avoid both RLS recursion and search-path hijacking, `getClaims()` (verified) is used everywhere instead of the unverified `getSession()`, `proxy.ts` never makes authorization decisions, and the anti-privilege-escalation trigger (`private.handle_new_user`) never trusts `user_metadata.role`. RLS/isolation tests (aislamiento-clientes, anonimo, comprobantes, perfiles-rol) exercise the negative cases with service-role re-reads rather than trusting "no exception," which is the correct pattern.

No Critical/BLOCKER-tier defects were found — no injection vectors, no exposed secrets in app/lib/proxy code, no RLS bypass, no auth bypass to `/admin` or to another customer's rows. The findings below are Warnings and Info items: a credential-validity oracle in the login flow that partially undercuts the stated anti-enumeration goal, a documented Server-Action security invariant that one action silently doesn't follow, duplicated admin-role-check logic that's easy to let drift, a documented data invariant the schema doesn't actually enforce, and some script/test robustness gaps.

## Warnings

### WR-01: Login flow authenticates non-admin accounts before checking role, creating a valid-credential oracle

**File:** `app/login/actions.ts:37-53`
**Issue:** `iniciarSesion` calls `supabase.auth.signInWithPassword()` and, on success, unconditionally `redirect("/admin")` — it never checks `profiles.role` itself. The role check only happens one hop later, inside `requireAdmin()` on the `/admin` page, which then redirects to `/login?motivo=sin-acceso`.

This means a caller who submits a *correct* email+password pair for a non-admin account gets a distinguishably different response (a `/admin` → `/login?motivo=sin-acceso` redirect chain, visible even without reading the response body) than a caller who submits an *incorrect* password (same-page re-render with "Correo o contraseña incorrectos."). The code comment on line 15-16 explicitly states the goal is a message that "nunca revela si el correo existe (T-01-25)" — but this redirect-chain difference is exactly that kind of oracle: it lets an attacker who is credential-stuffing (trying known email+password pairs from a breach) learn "this pair is valid on this system" even though they can never reach the admin panel with it. It doesn't expose admin data (RLS still protects that), but it undercuts the stated design goal.

**Fix:** Check the caller's role inside `iniciarSesion` itself before redirecting, and return the same generic error (or sign the session back out) if the account isn't an admin, so a non-admin credential match is indistinguishable from a wrong password from the login action's perspective:
```ts
const { error } = await supabase.auth.signInWithPassword(resultado.data);
if (error) { /* ...existing handling... */ }

const admin = await getAdminSession(); // already checks profiles.role
if (!admin) {
  await supabase.auth.signOut({ scope: "local" });
  return { error: "Correo o contraseña incorrectos." };
}
redirect("/admin");
```

### WR-02: `cerrarSesion` Server Action does not call `requireAdmin()`, breaking the codebase's own stated invariant

**File:** `app/admin/actions.ts:9-13`
**Issue:** `lib/auth/require-admin.ts:6-10` documents an explicit project rule: "TODA página y TODA Server Action del panel de administración debe llamar a requireAdmin() explícitamente" (every page and every Server Action of the admin panel must call `requireAdmin()` explicitly), because the proxy's redirect is optimistic UX only, not an authorization boundary. `cerrarSesion` is a Server Action of the admin panel (its form lives on `/admin`), and it does not call `requireAdmin()`.

Today this is low-impact (an unauthenticated `signOut({scope:'local'})` call is a no-op on the caller's own session), but it silently violates the one invariant this codebase relies on to keep future admin Server Actions safe. If this action is later extended (e.g., to log an audit event, or copy-pasted as a template for a real data-mutating admin action), the missing guard stops being harmless.
**Fix:**
```ts
export async function cerrarSesion() {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
```

### WR-03: `requireAdmin()` duplicates `getAdminSession()`'s logic instead of composing it

**File:** `lib/auth/require-admin.ts:23-73`
**Issue:** `getAdminSession()` (lines 23-43) and `requireAdmin()` (lines 53-73) independently implement the identical sequence — call `createClient()`, call `auth.getClaims()`, `select role from profiles where id = claims.sub`, compare to `'admin'`. This is the single most security-critical check in the codebase, duplicated in two places that must be kept in sync by hand. A future edit to the role-check logic (e.g., adding a `disabled` flag, changing the comparison, fixing a bug) that's applied to only one of the two functions would silently reintroduce a bypass or a lockout in the other.
**Fix:** Have `requireAdmin()` call `getAdminSession()` and branch on its result, rather than re-implementing the query. Since `requireAdmin()` needs to distinguish "no session" from "session but not admin" for the two different redirect targets, consider having `getAdminSession()` return a small discriminated result (e.g. `{ status: 'none' | 'not-admin' | 'admin', session? }`) that both callers can share, instead of collapsing both failure cases to `null`.

### WR-04: `pagos.tasa_cambio` is not enforced to be `NULL` when `moneda = 'USD'`, despite the documented invariant

**File:** `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:90-104,116-117`
**Issue:** The column comment on `tasa_cambio` (lines 116-117) states: "Obligatoria cuando moneda = VES; siempre null cuando moneda = USD" (mandatory when VES; always null when USD). The only CHECK constraint present, `pagos_tasa_cambio_obligatoria_en_bs` (lines 102-104), is `moneda = 'USD' or tasa_cambio is not null` — this only enforces the VES-requires-a-rate half. Nothing stops a future INSERT/UPDATE (from the admin UI built in a later phase, or a bug in a seed/migration script) from setting `moneda = 'USD'` together with a non-null `tasa_cambio`, silently violating the documented invariant that downstream USD/VES-equivalent reporting logic will likely rely on.
**Fix:** Strengthen the constraint to enforce both directions:
```sql
constraint pagos_tasa_cambio_solo_en_bs
  check (
    (moneda = 'VES' and tasa_cambio is not null)
    or (moneda = 'USD' and tasa_cambio is null)
  )
```
(replacing `pagos_tasa_cambio_obligatoria_en_bs`).

### WR-05: `package.json` `db:*` scripts shell-source `.env.admin.local`, an injection surface if any value contains shell metacharacters

**File:** `package.json:13-15`
**Issue:** `db:push`, `db:migrations`, and `db:types` all do `set -a && . ./.env.admin.local && set +a && ...`. The `.` (dot/source) builtin executes the file's contents as shell script, not as a safe `KEY=VALUE` dotenv parser — unlike `process.loadEnvFile()`, which the `.mjs` scripts correctly use elsewhere in this same phase (`scripts/configure-auth.mjs:9-10`, `scripts/seed-admin.mjs:10-11`). If `SUPABASE_DB_PASSWORD` (a value the developer may paste from a password generator) or any other value in that file contains shell metacharacters — a backtick, `$(...)`, or an unbalanced quote — sourcing it can execute arbitrary commands or break in confusing ways, since double-quoted values still allow command substitution in bash.
**Fix:** Load the file with a safe parser instead of sourcing it, e.g. `env $(node -e "for (const [k,v] of Object.entries(require('dotenv').parse(require('fs').readFileSync('.env.admin.local')))) console.log(\`${k}=${v}\`)") supabase db push ...`, or wrap the three `db:*` scripts in a small `scripts/with-admin-env.mjs` that uses `process.loadEnvFile()` (already the pattern used elsewhere in this phase) and then `spawn`s the `supabase` CLI with the loaded env.

### WR-06: `configure-auth.mjs` and `seed-admin.mjs` crash with a raw Node stack trace if `.env.local`/`.env.admin.local` is missing, instead of the scripts' own `fail()` pattern

**File:** `scripts/configure-auth.mjs:9-10`, `scripts/seed-admin.mjs:10-11`
**Issue:** Both scripts call `process.loadEnvFile(".env.local")` and `process.loadEnvFile(".env.admin.local")` at module top-level, outside any try/catch, before the script's own `fail(mensaje)` helper (which prints a friendly `Error: ...` message in Spanish and exits) is available to use. `process.loadEnvFile()` throws a raw `ENOENT` if the file doesn't exist (verified: `Error: ENOENT: no such file or directory, open '.env.local'`). On a fresh checkout, before `.env.local`/`.env.admin.local` are created per the setup instructions in `.env.example`, running `npm run seed:admin` or `npm run auth:configure` produces an unhandled exception with a raw stack trace instead of a guided error message — inconsistent with the error-handling style used for every other failure path in the same files.
**Fix:**
```js
for (const file of [".env.local", ".env.admin.local"]) {
  try {
    process.loadEnvFile(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      fail(`Falta ${file}. Copia .env.example y complétalo antes de correr este script.`);
    }
    throw error;
  }
}
```

### WR-07: Stale server-side error banner isn't cleared when client-side validation subsequently fails

**File:** `app/login/login-form.tsx:22-49`
**Issue:** `estado.error` (from `useActionState`, e.g. "Correo o contraseña incorrectos.") is only replaced when `formAction` actually runs another Server Action round-trip. If a user triggers that error, then edits a field in a way that fails the *client-side* `zodResolver` validation (e.g. clears the email field), `form.handleSubmit`'s validation short-circuits and `formAction` is never called — so `estado` from the previous submission is never updated. The old "Correo o contraseña incorrectos." banner (lines 42-49) keeps rendering at the same time as the new inline "Escribe tu correo." field error, showing the user two contradictory explanations for why they can't log in.
**Fix:** Clear the stale banner as soon as the user starts correcting the form, e.g. track a local `dismissed` flag reset in `onChange`/on next submit attempt, or derive the displayed banner as `!pendiente && !form.formState.isValidating && estado.error` gated behind a "the form hasn't been touched since this error" condition; simplest fix is to call `form.clearErrors()`/reset a local `bannerError` state at the start of `onSubmit`, before `form.handleSubmit` runs, whenever client-side validation is about to be (re)checked.

## Info

### IN-01: `ADMIN_EMAIL` constant duplicated across script and test

**File:** `scripts/seed-admin.mjs:13`, `tests/auth/auth-hardening.test.ts:4`
**Issue:** The literal `"gabbovera@gmail.com"` is hardcoded independently in both files (by design, per D-03 — single real admin), but duplicating the literal means a future rename requires remembering to update both, with no compiler/test to catch a mismatch beyond the auth-hardening test itself failing.
**Fix:** Low priority given there's exactly one admin by design; if this becomes awkward, move the constant to a small shared `lib/constants.ts` (non-secret) that both import.

### IN-02: `anonimo.test.ts` can't distinguish "permission denied" from "RLS-filtered empty result"

**File:** `tests/rls/anonimo.test.ts:40-47`
**Issue:** `const { data } = await anon.from(table).select("id"); expect((data ?? []).length).toBe(0);` ignores the `error` field. Since `anon` has no `GRANT` at all on `schema public` (see `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql:15`, which only grants `usage on schema public to authenticated`), the realistic failure mode today is a `42501 permission denied` PostgREST error, which also yields `data: null` → `(data ?? []).length === 0`. The test currently can't tell "correctly denied at the grant/RLS layer" apart from "some other unrelated failure that also happens to leave `data` null," which weakens it as a regression guard for this specific security boundary.
**Fix:** Assert on the error explicitly, e.g. `expect(error).toBeTruthy(); expect((data ?? []).length).toBe(0);`, so a future change that returns `data: []` with no error (a real RLS-filtered empty result, which is also acceptable) is still distinguished from an unexpected 500 or other failure.

---

_Reviewed: 2026-09-28T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
