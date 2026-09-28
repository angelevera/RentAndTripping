---
phase: 01-base-y-acceso-seguro
verified: 2026-09-28T14:10:00Z
status: passed
score: 31/31 must-haves verified (all 4 plans)
behavior_unverified: 0
overrides_applied: 0
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/01-base-y-acceso-seguro/01-01-PLAN.md", ".planning/phases/01-base-y-acceso-seguro/01-01-SUMMARY.md", ".planning/phases/01-base-y-acceso-seguro/01-02-PLAN.md", ".planning/phases/01-base-y-acceso-seguro/01-02-SUMMARY.md", ".planning/phases/01-base-y-acceso-seguro/01-03-PLAN.md", ".planning/phases/01-base-y-acceso-seguro/01-03-SUMMARY.md", ".planning/phases/01-base-y-acceso-seguro/01-04-PLAN.md", ".planning/phases/01-base-y-acceso-seguro/01-04-SUMMARY.md", ".planning/phases/01-base-y-acceso-seguro/01-REVIEW-FIX.md", ".planning/phases/01-base-y-acceso-seguro/01-REVIEW.md", ".planning/phases/01-base-y-acceso-seguro/01-UAT.md", "app/admin/actions.ts", "app/admin/page.tsx", "app/globals.css", "app/layout.tsx", "app/login/actions.ts", "app/login/login-form.tsx", "app/login/page.tsx", "app/page.tsx", "lib/auth/require-admin.ts", "lib/database.types.ts", "lib/supabase/server.ts", "lib/validation/auth.ts", "package.json", "proxy.ts", "scripts/configure-auth.mjs", "scripts/seed-admin.mjs", "scripts/with-admin-env.mjs", "supabase/migrations/20260927000001_perfiles_y_rol_admin.sql", "supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql", "supabase/migrations/20260927000003_comprobantes_privados.sql", "supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql", "tests/auth/auth-hardening.test.ts", "tests/e2e/admin-access.test.ts", "tests/e2e/admin-login.test.ts", "tests/e2e/global-setup.ts", "tests/helpers/fixtures.ts", "tests/rls/aislamiento-clientes.test.ts", "tests/rls/anonimo.test.ts", "tests/rls/comprobantes.test.ts", "tests/rls/perfiles-rol.test.ts", "vitest.config.ts"]
covered_digest: "v1:sha256:415b621898ba6261eeef872162c49dbe170e03ff15eecc433a3cc3d15e954b13"
re_verification:
  previous_status: human_needed
  previous_score: 31/31
  gaps_closed:
    - "WR-02: cerrarSesion Server Action now calls requireAdmin() before signing out"
    - "WR-03: requireAdmin()/getAdminSession() unified on a single getSessionStatus() check"
    - "WR-04: pagos.tasa_cambio now enforced NULL-iff-USD in both directions (new migration 20260927000004)"
    - "WR-05: db:push/db:migrations/db:types no longer shell-source .env.admin.local (scripts/with-admin-env.mjs added)"
    - "WR-06: configure-auth.mjs/seed-admin.mjs now fail with a friendly Spanish message instead of a raw ENOENT stack trace"
    - "WR-07: stale server-side login error banner is now hidden while a client-side field error is active"
    - "All 4 original human-verification items resolved by the owner (01-UAT.md, 4/4 aprobado)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-01 (login authenticates non-admin accounts before checking role, creating a valid-credential oracle) is deliberately deferred, not fixed"
    category: security
    reason: "A literal fix broke the tested two-tier access design (shared /login for admin + future customer accounts); the owner explicitly deferred this to Phase 3 when real customer accounts exist on the same /login page, and recorded the deferral in ROADMAP.md Phase 3 Notes. Low risk today: single admin account, public signup closed."
    evidence_status: "Deferral is documented (01-REVIEW-FIX.md skipped-issues section, ROADMAP.md Phase 3 Notes) and reflects a project-owner decision already made, not a new finding from this re-verification. Not counted as a gap per this task's explicit instruction not to re-litigate it."
---

# Phase 1: Base y acceso seguro — Verification Report (Re-verification)

**Phase Goal:** "La base de datos existe y está protegida de forma que cada tipo de usuario (admin, cliente) solo puede ver y tocar lo que le corresponde, y el admin ya puede entrar al sistema con su propia cuenta."
**Verified:** 2026-09-28T14:10:00Z
**Status:** passed
**Re-verification:** Yes — after code-review gap closure and end-of-phase UAT sign-off

## Method

This is a refresh of the 2026-09-28T13:05:00Z initial verification (status `human_needed`), following:
1. A code-review pass (`01-REVIEW.md`) that found 0 Critical / 7 Warning-tier issues.
2. A fix pass (`01-REVIEW-FIX.md`) that applied 6 of the 7 warnings (commits `4d6d8ce`, `c5eec24`, `431d275`, `de7b458`, `77d6939`, `a26ea8f`) and deliberately deferred WR-01 to Phase 3 (rolled back cleanly, documented in `ROADMAP.md` Phase 3 Notes).
3. End-of-phase UAT (`01-UAT.md`) in which the owner resolved all 4 original human-verification items (4/4 `aprobado`).

Independently, in a fresh shell (not trusting SUMMARY/REVIEW-FIX-reported numbers):

- Ran `npm run build` — clean, 0 errors, all 4 routes generated.
- Ran `npx vitest run --project db` cold — **5 test files, 27/27 tests passed** (matches the required count exactly).
- Confirmed a `next dev` server was already listening on port 3000 (`lsof -i :3000`), then ran `E2E_BASE_URL=http://localhost:3000 npx vitest run --project e2e` against it (no new server spawned, no port conflict, the running dev server was left untouched) — **2 test files, 13/13 tests passed** (matches the required count exactly).
- Ran `npm run db:migrations` — confirmed all 4 migrations (`20260927000001` through `20260927000004`) show `local == remote`, i.e. applied on the live hosted Supabase project.
- Confirmed via `git log --oneline -- <file>` that `20260927000002_reservas_pagos_recordatorios.sql` and `20260927000003_comprobantes_privados.sql` each have exactly one commit (`0a94492`, the original Plan 01-03 commit) with zero commits since — WR-04's fix added a new migration file (`20260927000004`) rather than editing an already-applied one, exactly as documented.
- Read the full current content of all 6 fixed files/areas (`app/admin/actions.ts`, `lib/auth/require-admin.ts`, `supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql`, `package.json`'s `db:*` scripts + new `scripts/with-admin-env.mjs`, `scripts/configure-auth.mjs`/`scripts/seed-admin.mjs`'s env-loading block, `app/login/login-form.tsx`) and confirmed each matches its REVIEW-FIX claim exactly (not just presence — read the actual logic).
- Confirmed `app/login/actions.ts` (WR-01, skipped) has zero commits and zero diff since its original Plan 01-04 commit (`f101297`) — the rollback was clean, no partial/broken state left behind.
- Re-scanned every fixed/added file for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` — none found.
- Confirmed `REQUIREMENTS.md` still marks `AUTH-01` `[x] Complete` and Phase 1 still maps only `AUTH-01`.
- Read `.planning/ROADMAP.md`'s diff (currently unstaged) — the only change is the WR-01 deferral note added to Phase 3's Notes section, consistent with the owner's documented decision; not a scope change to Phase 1.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El admin puede iniciar sesión con su correo y contraseña y llega a un panel de administración vacío | ✓ VERIFIED | `tests/e2e/admin-login.test.ts` + `tests/e2e/admin-access.test.ts` pass (13/13, cold run against the real hosted project); owner confirmed live in UAT item 3 ("Sesión iniciada como gabbovera@gmail.com" shown, logout returns to `/login`) |
| 2 | Nadie que no sea el admin puede entrar al panel de administración | ✓ VERIFIED | `proxy.ts` (unchanged, re-read in full) redirects anonymous `/admin`; `requireAdmin()` (now unified via `getSessionStatus()`) redirects a signed-in customer to `/login?motivo=sin-acceso`; both proven by passing e2e tests on this cold run |
| 3 | La estructura de datos para reservas, pagos y clientes existe y está protegida a nivel de base de datos | ✓ VERIFIED | Migrations `20260927000001-4` all confirmed **Remote**; 23 RLS integration tests pass; WR-04's new migration closes the one schema gap the code review found (`tasa_cambio` now enforced NULL-iff-USD in both directions), re-verified: `pagos_tasa_cambio_solo_en_bs` constraint present, `pagos_tasa_cambio_obligatoria_en_bs` dropped |

**Score:** 3/3 ROADMAP success criteria verified.

### Observable Truths (Plan must_haves, all 4 plans)

All 31 `must_haves.truths` entries across the 4 plans still hold. This re-verification gave full 3-level scrutiny to the 6 truths adjacent to the fixed files (below) and a regression sanity check (existence + one passing test) to the remaining 25, none of which were touched by the fix commits.

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 01-02 | `cerrarSesion` Server Action of the admin panel must call `requireAdmin()` before acting (project invariant) | ✓ VERIFIED | `app/admin/actions.ts` now reads `await requireAdmin();` as its first line (WR-02 fix, commit `4d6d8ce`); e2e "logs out only the device that submits form-cerrar-sesion" still passes on this cold run |
| 01-02 | Admin-role check logic lives in one place, not duplicated | ✓ VERIFIED | `lib/auth/require-admin.ts` now has a single `cache()`-memoized `getSessionStatus()` returning `{status:'none'|'not-admin'|'admin'}`; both `getAdminSession()` and `requireAdmin()` compose it (WR-03 fix, commit `c5eec24`); read in full, confirmed no re-implementation remains |
| 01-03 | A VES payment without `tasa_cambio` is rejected; the documented USD-implies-null-rate invariant is also enforced (code review gap closed) | ✓ VERIFIED | New migration `20260927000004_pagos_tasa_cambio_solo_en_bs.sql`, read in full: `check ((moneda='VES' and tasa_cambio is not null) or (moneda='USD' and tasa_cambio is null))`, replacing the one-directional constraint; confirmed applied **Remote**; `npx vitest run --project db` 27/27 including RLS tests |
| 01-01 | `db:*` scripts load admin secrets safely, without a shell-injection surface | ✓ VERIFIED | `package.json`'s `db:push`/`db:migrations`/`db:types` now call `node scripts/with-admin-env.mjs supabase ...`; `scripts/with-admin-env.mjs` (new) uses `process.loadEnvFile()` (safe key=value parser), never sources the file as shell (WR-05 fix, commit `de7b458`); `npm run db:migrations` re-run in this session succeeded against the live project |
| 01-01 | Setup scripts fail with a guided message, not a raw crash, when env files are missing | ✓ VERIFIED | `scripts/configure-auth.mjs` and `scripts/seed-admin.mjs` both now wrap `process.loadEnvFile()` in try/catch, mapping `ENOENT` to the existing `fail()` Spanish-message pattern (WR-06 fix, commit `77d6939`); read in full, confirmed present in both files |
| 01-04 | Login form never shows two contradictory error messages at once | ✓ VERIFIED | `app/login/login-form.tsx`: `mostrarBannerError = Boolean(estado.error) && !errorEmail && !errorPassword` (WR-07 fix, commit `a26ea8f`); read in full, logic confirmed to gate the stale server banner behind "no active field error" |
| 01-01 | No RLS policy lets a non-admin write `profiles`; trigger never reads role from metadata | ✓ VERIFIED (regression check) | Unchanged since original commit `0a94492`/`25e1db9`; `tests/rls/perfiles-rol.test.ts` still passes on this cold run |
| 01-02 | Anonymous `/admin` redirected by root `proxy.ts` before the page renders | ✓ VERIFIED (regression check) | `proxy.ts` has zero commits/diff since `9a67732`; e2e test still passes |
| 01-03 | `comprobantes` bucket is private, folder-isolated, customer-immutable | ✓ VERIFIED (regression check) | Migration `20260927000003` confirmed untouched (single commit, no diff); `tests/rls/comprobantes.test.ts` (8 tests) still passes |
| 01-04 | Root `/` redirects to `/admin`; wrong password and unknown email produce the identical anti-enumeration message | ✓ VERIFIED (regression check) | `app/page.tsx` and `app/login/actions.ts` unchanged since their original commits; e2e tests still pass |

No must-have across any of the 4 plans failed or regressed. No override was needed for any must-have.

### Advisory (New Scope, Unevidenced)

| # | Finding | Category | Why Advisory |
|---|---------|----------|---------------|
| 1 | WR-01 (login credential-validity oracle for non-admin accounts) remains unfixed | security | Deliberately deferred by the project owner to Phase 3 (documented in `ROADMAP.md` Phase 3 Notes and `01-REVIEW-FIX.md`'s skipped-issues section) rather than a gap discovered by this re-verification; a code fix attempt broke the tested two-tier `/login` design and was cleanly rolled back. Per this task's explicit instruction, not re-litigated or re-flagged as a blocking gap — recorded here only for traceability, exactly as it already is in ROADMAP.md. |

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql` | Two-directional `tasa_cambio` NULL-iff-USD constraint | ✓ VERIFIED | New file, applied **Remote**, drops the old one-directional constraint and adds the corrected one |
| `scripts/with-admin-env.mjs` | Safe env loader + spawn wrapper for `db:*` scripts | ✓ VERIFIED | New file, uses `process.loadEnvFile()`, `spawnSync`, own `fail()` error handling; wired from `package.json` |
| `app/admin/actions.ts` | `cerrarSesion` guarded by `requireAdmin()` | ✓ VERIFIED | `await requireAdmin();` is the first statement |
| `lib/auth/require-admin.ts` | Single unified `getSessionStatus()` check | ✓ VERIFIED | `getAdminSession()` and `requireAdmin()` both call it; no duplicated query logic remains |
| `scripts/configure-auth.mjs` / `scripts/seed-admin.mjs` | Friendly ENOENT handling | ✓ VERIFIED | Both wrap `process.loadEnvFile()` in try/catch → `fail()` |
| `app/login/login-form.tsx` | No contradictory error banner + field error | ✓ VERIFIED | `mostrarBannerError` gate confirmed |
| All artifacts from the original (unchanged) verification | — | ✓ VERIFIED (unchanged) | `proxy.ts`, migrations `0001-0003`, `lib/supabase/server.ts`, `app/login/page.tsx`, `lib/validation/auth.ts`, `lib/database.types.ts`, all test files — confirmed zero commits/diff since the initial verification, all still pass |

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/admin/actions.ts` | `lib/auth/require-admin.ts` | `await requireAdmin()` | ✓ WIRED | Confirmed by read |
| `package.json` (`db:*`) | `scripts/with-admin-env.mjs` | `node scripts/with-admin-env.mjs supabase ...` | ✓ WIRED | Confirmed by read; functionally re-run in this session (`npm run db:migrations` succeeded against the live project) |
| `lib/auth/require-admin.ts`'s `getAdminSession`/`requireAdmin` | `getSessionStatus()` | direct function call, both compose the same `cache()`-memoized result | ✓ WIRED | Confirmed by read — no independent re-implementation remains |
| `supabase/migrations/20260927000004...sql` | live hosted Supabase project | `npm run db:push` (already applied per REVIEW-FIX; re-confirmed via `npm run db:migrations` in this session) | ✓ WIRED | `local == remote` for all 4 migrations |
| All original key links (login-form → actions, actions → validation schema, admin/page → require-admin, proxy → Supabase Auth, migration 0002 → `private.is_admin()`, seed-admin → profiles) | — | — | ✓ WIRED (unchanged) | Files unchanged since original verification; still pass their respective tests |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| AUTH-01 | 01-01, 01-02, 01-03, 01-04 | El admin puede iniciar sesión como único usuario administrador | ✓ SATISFIED | Unchanged — `REQUIREMENTS.md` still marks `[x] Complete`; all 4 plans' must_haves re-verified after the fix pass; only one non-test admin account exists (`gabbovera@gmail.com`), confirmed live via `tests/auth/auth-hardening.test.ts` |

No orphaned requirements.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 6 fixed files or the new files (`scripts/with-admin-env.mjs`, migration `20260927000004`) | — | None — clean |
| `app/login/actions.ts` | — | WR-01 remains open (see Advisory) — not a code-quality anti-pattern, a deliberately deferred security hardening item with an owner-approved rationale recorded in `ROADMAP.md` | ℹ️ Info | Already tracked; not a Phase 1 blocker per the owner's own scoping decision |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds end-to-end | `npm run build` | Compiled successfully, 0 TS errors, 4 routes generated | ✓ PASS |
| DB/RLS test suite | `npx vitest run --project db` | 5 files, 27/27 passed | ✓ PASS |
| E2E test suite (against existing dev server, no port conflict) | `E2E_BASE_URL=http://localhost:3000 npx vitest run --project e2e` | 2 files, 13/13 passed | ✓ PASS |
| Migrations applied remotely, `0002`/`0003` untouched | `npm run db:migrations` + `git log --oneline -- <file>` | `local==remote` for `0001-0004`; `0002`/`0003` each have exactly 1 commit, unchanged since Plan 01-03 | ✓ PASS |

## Human Verification Required

None. All 4 original human-verification items were resolved by the project owner in `01-UAT.md` (status: complete, 4/4 `aprobado`):
1. Data model sign-off — approved, with a forward-looking payer-vs-traveler note logged into `PROJECT.md`/`ROADMAP.md` for Phase 2 (not a Phase 1 action item).
2. Mobile visual/brand check at 375px — approved.
3. Real login with the operator's account — approved (panel shows correct greeting, wrong password shows the correct Spanish message, logout returns to `/login`).
4. Next-day session persistence — accepted by owner's informed decision to trust the automated double-verification (session-duration settings confirmed via Management API + `@supabase/ssr`'s 400-day default cookie) rather than waiting a real day; explicitly documented as "not yet live-tested, report back if wrong" rather than falsely closed.

## Gaps Summary

No gaps. This re-verification confirms:
- All 6 applied code-review fixes (WR-02 through WR-07) are real, committed, correctly implemented (read in full, not grepped-only), and introduced no regressions — `npm run build`, the db test suite (27/27), and the e2e test suite (13/13) all pass cold against the live hosted Supabase project.
- WR-04's new migration (`20260927000004`) is applied **Remote** and left the already-applied `20260927000002`/`20260927000003` migrations untouched (single commit each, zero diff since Plan 01-03).
- The one deliberately-skipped finding, WR-01, was cleanly rolled back (zero diff on `app/login/actions.ts` since its original commit) and is recorded as an owner-approved deferral to Phase 3, not re-litigated here per this task's explicit scope.
- All 31 must-have truths across the 4 plans still hold; the 6 adjacent to the fixed files were re-verified at full depth, the remaining 25 (all in unchanged files) passed a regression check.
- All 4 original human-verification items are resolved by the owner in `01-UAT.md`.

The phase goal — a protected database with per-role RLS and a working admin login — is achieved. Status moves from `human_needed` to `passed`.

---

*Verified: 2026-09-28T14:10:00Z*
*Verifier: Claude (gsd-verifier)*
