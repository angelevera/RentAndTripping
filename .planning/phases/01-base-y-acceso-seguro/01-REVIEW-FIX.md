---
phase: 01-base-y-acceso-seguro
fixed_at: 2026-09-28T13:45:00Z
review_path: .planning/phases/01-base-y-acceso-seguro/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-09-28T13:45:00Z
**Source review:** .planning/phases/01-base-y-acceso-seguro/01-REVIEW.md
**Iteration:** 1

**Verification environment:** `workflow.use_worktrees` is `false` for this project, so all edits, syntax checks, migration pushes, and test runs happened directly in the main checkout (no isolated worktree was created; `wt="."`, commits went straight onto `main`).

**Summary:**
- Findings in scope: 7 (WR-01 through WR-07; IN-01/IN-02 excluded per `fix_scope=critical_warning`)
- Fixed: 6
- Skipped: 1

## Fixed Issues

### WR-02: `cerrarSesion` Server Action does not call `requireAdmin()`

**Files modified:** `app/admin/actions.ts`
**Commit:** `4d6d8ce`
**Applied fix:** Added `await requireAdmin();` as the first line of `cerrarSesion`, matching `require-admin.ts`'s documented invariant that every admin-panel Server Action must call it explicitly. Verified with `tsc --noEmit` (clean) and the full e2e suite (13/13 passing, including the logout-only-affects-one-device test that exercises this action).

### WR-03: `requireAdmin()` duplicated `getAdminSession()`'s logic

**Files modified:** `lib/auth/require-admin.ts`
**Commit:** `c5eec24`
**Applied fix:** Extracted a single, request-memoized `getSessionStatus()` returning a discriminated `{status:'none'|'not-admin'|'admin', session?}` result. `getAdminSession()` and `requireAdmin()` now both compose it instead of independently re-implementing the `getClaims()` + `profiles.role` query, so the codebase's single most security-critical check lives in exactly one place. Verified with `tsc --noEmit` (clean) and the full e2e suite (13/13 passing).

### WR-04: `pagos.tasa_cambio` not enforced `NULL` when `moneda = 'USD'`

**Files modified:** `supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql` (new migration — the already-applied `20260927000002` was left untouched, per instructions)
**Commit:** `431d275`
**Applied fix:** New migration drops `pagos_tasa_cambio_obligatoria_en_bs` and replaces it with `pagos_tasa_cambio_solo_en_bs`, enforcing both directions: `(moneda='VES' and tasa_cambio is not null) or (moneda='USD' and tasa_cambio is null)`. Applied to the live hosted Supabase project via `npm run db:push` and confirmed synced (local/remote both at `20260927000004`) via `npm run db:migrations`. Re-ran `npx vitest run --project db tests/rls` afterward: 23/23 passing, no RLS regression.

### WR-05: `db:*` scripts shell-sourced `.env.admin.local`

**Files modified:** `package.json`, `scripts/with-admin-env.mjs` (new)
**Commit:** `de7b458`
**Applied fix:** Replaced `set -a && . ./.env.admin.local && set +a && supabase ...` (which executes the file as shell script — an injection surface for any value containing shell metacharacters) with a new `scripts/with-admin-env.mjs` that loads the file via `process.loadEnvFile()` (the safe parser already used by `configure-auth.mjs`/`seed-admin.mjs`) and spawns the Supabase CLI with that environment. The `--password "$SUPABASE_DB_PASSWORD"` flag was dropped entirely rather than kept — verified empirically that the Supabase CLI reads `SUPABASE_DB_PASSWORD` directly from the environment when `--password` isn't passed, so the password is never placed on a command line. Verified functionally against the live linked Supabase project: `db:migrations` and `db:push` both still work (`db:push` correctly reported "Remote database is up to date" after WR-04's migration was already applied), and `db:types`' generated output diffed byte-identical to the pre-fix output.

### WR-06: `configure-auth.mjs`/`seed-admin.mjs` crash with a raw stack trace on missing env files

**Files modified:** `scripts/configure-auth.mjs`, `scripts/seed-admin.mjs`
**Commit:** `77d6939`
**Applied fix:** Wrapped both scripts' `process.loadEnvFile()` calls in a loop with try/catch that translates `ENOENT` into the scripts' existing `fail()` pattern (`Falta {file}. Copia .env.example y complétalo antes de correr este script.`), re-throwing any other error. Verified by copying the script into an empty temp directory and confirming it now prints the friendly message and exits 1 instead of an unhandled `ENOENT` stack trace; then re-ran both `npm run auth:configure` and `npm run seed:admin` against the real project to confirm normal operation is unaffected (seed-admin correctly reported the admin account already existed and did not touch its password).

### WR-07: Stale server error banner not cleared on client-side validation failure

**Files modified:** `app/login/login-form.tsx`
**Commit:** `a26ea8f`
**Applied fix:** Adapted the suggested fix to a simpler, state-free derivation rather than adding a `useEffect`/local dismissal flag: the banner is now gated on `Boolean(estado.error) && !errorEmail && !errorPassword`, so the stale server-side message is hidden the instant either field has an active validation error (client-side zod or server field-level), and reappears only when a real Server Action round-trip sets a fresh `estado.error` with no concurrent field errors. This covers the reviewer's exact scenario (editing a field into an invalid state after a login error) without needing to track submit-attempt timing. Verified with `tsc --noEmit` (clean) and the full e2e suite (13/13 passing).

## Skipped Issues

### WR-01: Login flow authenticates non-admin accounts before checking role, creating a valid-credential oracle

**File:** `app/login/actions.ts:37-53`
**Reason:** Applied the literal fix from REVIEW.md (check `getAdminSession()` after `signInWithPassword()` succeeds; sign out and return the generic error if not admin) and verified it against the full e2e suite. It caused a real regression: `tests/e2e/admin-access.test.ts`'s test "redirects a signed-in customer requesting /admin to /login?motivo=sin-acceso" failed (`5 passed → 4 passed, 1 failed`), because that test's assertion depends on the *current, intentional* design — a valid customer login through the shared `/login` route must succeed and establish a real session; role-based gating happens at the resource level (`requireAdmin()` on `/admin`), not inside the login action itself. This is not an incidental test gap: `/login` is deliberately a single shared entry point for both the admin and (per the project's stated goal of "un panel propio" for every customer) future customer accounts, and Plan 01-04 explicitly designed the `?motivo=sin-acceso` redirect to distinguish "wrong role" from "wrong credentials" for exactly this reason.

WR-01's diagnosis (a credential-stuffing attacker can learn "this email+password pair is valid on this system" from the redirect-chain/cookie difference, even though they can never reach `/admin` with it) is accurate and still stands as a real, if inherent, property of any shared multi-role login endpoint — but its suggested fix is incompatible with the product's existing, tested, two-tier access design, not a simple code correction. Rolled back cleanly via `git checkout -- app/login/actions.ts` (confirmed zero diff afterward) rather than leaving a partial or broken change. This needs a product/architecture decision (e.g., rate-limiting instead of blocking non-admin logins outright, or deferring the distinction until a real customer-facing panel exists in a later phase) rather than a blind code fix, so it is left for human review.

**Original issue (from REVIEW.md):** `iniciarSesion` calls `supabase.auth.signInWithPassword()` and, on success, unconditionally `redirect("/admin")` — it never checks `profiles.role` itself. The role check only happens one hop later, inside `requireAdmin()` on the `/admin` page, which then redirects to `/login?motivo=sin-acceso`. A caller who submits a correct email+password pair for a non-admin account gets a distinguishably different response than a caller who submits an incorrect password, which undercuts the stated "never reveal if the correo exists" design goal (T-01-25), though RLS still protects all admin data regardless.

## Final Verification

Full suite re-run after all 6 commits, in the main checkout (no worktree, per `workflow.use_worktrees=false`):

| Command | Result |
|---|---|
| `npm run build` | ✅ Pass — compiled successfully, TypeScript check clean, all 4 routes (`/`, `/_not-found`, `/admin`, `/login`) generated |
| `npm run test` (db + e2e projects, `vitest run`) | ✅ 40/40 tests passed (7 test files) |
| `npm run test:e2e` (`vitest run --project e2e`) | ✅ 13/13 tests passed (2 test files) |

Note: an already-running `next dev` server on `localhost:3000` (pre-existing in this environment, not started by this fixer) was reused via `E2E_BASE_URL=http://localhost:3000` for e2e runs, since the e2e harness's own auto-spawn (`tests/e2e/global-setup.ts`) refuses to start a second `next dev` instance against the same project directory and times out after 120s trying. This is a pre-existing environment characteristic, unrelated to any of the 6 fixes applied.

---

_Fixed: 2026-09-28T13:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
