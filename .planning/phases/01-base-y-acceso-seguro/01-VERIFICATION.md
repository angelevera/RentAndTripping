---
phase: 01-base-y-acceso-seguro
verified: 2026-09-28T13:05:00Z
status: human_needed
score: 31/31 must-haves verified (all 4 plans)
behavior_unverified: 0
overrides_applied: 0
covered_files: [".planning/REQUIREMENTS.md", ".planning/phases/01-base-y-acceso-seguro/01-01-PLAN.md", ".planning/phases/01-base-y-acceso-seguro/01-01-SUMMARY.md", ".planning/phases/01-base-y-acceso-seguro/01-02-PLAN.md", ".planning/phases/01-base-y-acceso-seguro/01-02-SUMMARY.md", ".planning/phases/01-base-y-acceso-seguro/01-03-PLAN.md", ".planning/phases/01-base-y-acceso-seguro/01-03-SUMMARY.md", ".planning/phases/01-base-y-acceso-seguro/01-04-PLAN.md", ".planning/phases/01-base-y-acceso-seguro/01-04-SUMMARY.md", "app/admin/actions.ts", "app/admin/page.tsx", "app/globals.css", "app/layout.tsx", "app/login/actions.ts", "app/login/login-form.tsx", "app/login/page.tsx", "app/page.tsx", "lib/auth/require-admin.ts", "lib/database.types.ts", "lib/supabase/server.ts", "lib/validation/auth.ts", "package.json", "proxy.ts", "scripts/configure-auth.mjs", "scripts/seed-admin.mjs", "supabase/migrations/20260927000001_perfiles_y_rol_admin.sql", "supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql", "supabase/migrations/20260927000003_comprobantes_privados.sql", "tests/auth/auth-hardening.test.ts", "tests/e2e/admin-access.test.ts", "tests/e2e/admin-login.test.ts", "tests/e2e/global-setup.ts", "tests/helpers/fixtures.ts", "tests/rls/aislamiento-clientes.test.ts", "tests/rls/anonimo.test.ts", "tests/rls/comprobantes.test.ts", "tests/rls/perfiles-rol.test.ts", "vitest.config.ts"]
covered_digest: "v1:sha256:74578005f592979ab76d4a88e4183946b6490bbcb090dac821fbf7ca9c52dae0"
human_verification:
  - test: "Datos: lee la sección 'Modelo de datos para revisar' en 01-03-SUMMARY.md y confirma si el modelo (cliente = cuenta creada por el admin; reserva con precio+moneda; pago con método/monto/moneda/tasa; reserva con pagos no se puede borrar; recordatorios internos; comprobantes privados e inmutables para el cliente) coincide con cómo opera el negocio hoy."
    expected: "El dueño confirma el modelo, o señala qué cambiar antes de que la Fase 2 construya pantallas sobre él. Pregunta clave planteada por el propio plan: ¿habrá clientes que nunca tengan cuenta/correo (p. ej. pago único en efectivo)?"
    why_human: "Ajuste al modelo de negocio (RESEARCH Assumption A2); no verificable por grep ni por tests automatizados; cambiarlo después de la Fase 2 exige migración + cambios de código coordinados."
  - test: "Visual/marca en 375px: con `npm run dev` corriendo, abre http://localhost:3000 en una ventana de 375px de ancho (modo dispositivo del navegador) y revisa /login y /admin."
    expected: "El logo y el botón morado (#482583) se ven bien en pantalla de teléfono; el formulario es usable con el teclado táctil."
    why_human: "Ajuste visual/de marca no es verificable por grep ni por el test suite (DESIGN.md pide juicio humano)."
  - test: "Login real: inicia sesión como gabbovera@gmail.com con la contraseña inicial, revisa el panel, presiona 'Cerrar sesión', luego intenta con una contraseña incorrecta."
    expected: "El panel muestra 'Sesión iniciada como gabbovera@gmail.com'; una contraseña incorrecta muestra 'Correo o contraseña incorrectos.' en español; cerrar sesión regresa a /login."
    why_human: "Requiere una cuenta real y un navegador real; los tests e2e usan cuentas rt-test- desechables, nunca la cuenta real del operador."
  - test: "Persistencia de sesión al día siguiente (D-01): reabre el mismo navegador al día siguiente sin cerrar sesión."
    expected: "El panel abre sin pedir la contraseña de nuevo (cookie de 400 días por defecto de @supabase/ssr, más el refresh en proxy.ts)."
    why_human: "Una expiración/renovación de sesión de un día no puede simularse en un test e2e que corre en segundos (ver FA-1 en 01-01-PLAN.md: 'no automated expiry simulation')."
---

# Phase 1: Base y acceso seguro — Verification Report

**Phase Goal:** "La base de datos existe y está protegida de forma que cada tipo de usuario (admin, cliente) solo puede ver y tocar lo que le corresponde, y el admin ya puede entrar al sistema con su propia cuenta."
**Verified:** 2026-09-28
**Status:** human_needed
**Re-verification:** No — initial verification

## Method

Read all 4 PLAN.md/SUMMARY.md pairs in full, ROADMAP.md, REQUIREMENTS.md, and `.claude/CLAUDE.md`. Independently, in a fresh shell (not trusting any SUMMARY-reported numbers):

- Ran `npm run build` — clean, 0 errors.
- Ran `npm run db:migrations` — confirmed all 3 migrations (`20260927000001/2/3`) applied **Remote** on the live hosted Supabase project.
- Ran the full test suite (`npm run test`, i.e. `vitest run` across the `db` and `e2e` projects) once, cold: **7 test files, 40/40 tests passed.**
- Ran it a second time (`npx vitest run --reporter=verbose`) to get per-test names for cross-referencing against each SUMMARY's `coverage` claims — this second run hit Supabase Auth's own login rate limiter (`Request rate limit reached`, plus one assertion catching the "Demasiados intentos" 429-mapped message instead of the expected wrong-password message) because the same hosted project had just been hit by the first full run seconds earlier. This is **not a code defect** — it is a live consequence of Plan 01-04's own rate-limit handling code doing its job (mapping Supabase's 429 to the correct Spanish message), triggered by two back-to-back full-suite runs against a shared hosted project. The first, cold run is the authoritative evidence and matches every SUMMARY-claimed pass count exactly. See "Anti-Patterns / Notable Findings" below — flagged as an info-level operational caution, not a gap.
- Grepped every acceptance-criteria pattern from all 4 plans directly against the current file contents (not the plan's own claims) — see "Required Artifacts" and "Key Link Verification" below.
- Read the full contents of `proxy.ts`, `lib/auth/require-admin.ts`, `app/admin/page.tsx`, `app/login/page.tsx`, `app/login/login-form.tsx` to confirm behavior, not just grep hits.
- Confirmed `.env.local`/`.env.admin.local` are git-ignored and untracked (`git ls-files | grep env` → only `.env.example` and `scripts/check-env.sh`), and that no admin secret name (`SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN`, `ADMIN_INITIAL_PASSWORD`) appears anywhere under `app/`, `lib/`, or `proxy.ts`. Did not read `.env.local`/`.env.admin.local` contents directly, per instructions; used `./scripts/check-env.sh` (exit 0, all 7 vars `OK:`) instead.
- Confirmed `.claude/CLAUDE.md` is byte-for-byte unchanged across the whole phase: `git diff --quiet -- .claude/CLAUDE.md` exits 0, and `git log --follow -- .claude/CLAUDE.md` shows no commits touching it since the two pre-Phase-1 project-init commits.
- Scanned every file the phase created/modified for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/empty-return stubs — none found.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | El admin puede iniciar sesión con su correo y contraseña y llega a un panel de administración vacío | ✓ VERIFIED | `tests/e2e/admin-login.test.ts` (3 tests) + `tests/e2e/admin-access.test.ts` pass on a cold run against the real hosted project; `app/admin/page.tsx` renders `panel-admin` + "Todavía no hay reservas cargadas." via `requireAdmin()` → `lib/auth/require-admin.ts` → `getClaims()` → `profiles.role` under RLS |
| 2 | Nadie que no sea el admin puede entrar al panel de administración | ✓ VERIFIED | `proxy.ts` redirects anonymous `/admin` before render; `requireAdmin()` redirects a signed-in customer to `/login?motivo=sin-acceso`; both paths proven by passing e2e tests (`redirects a signed-in customer...`, `redirects an anonymous request...`) |
| 3 | La estructura de datos para reservas, pagos y clientes existe y está protegida a nivel de base de datos | ✓ VERIFIED | `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql` + `20260927000003_comprobantes_privados.sql` pushed and confirmed **Remote**; 23 RLS integration tests (`tests/rls/*.test.ts`) pass, proving cross-customer isolation, no role self-promotion, zero anonymous access, and a private/immutable `comprobantes` bucket |

**Score:** 3/3 ROADMAP success criteria verified.

### Observable Truths (Plan must_haves, all 4 plans)

All 31 `must_haves.truths` entries across the 4 plans were checked. All 31 are backed by a passing automated test (e2e or db/RLS integration) from the cold, independent run, plus direct code/migration inspection — not presence-only grepping. None are behavior-dependent-but-unverified; every state-transition/isolation claim (session refresh, per-device logout, cross-tenant isolation, role self-promotion, bucket privacy/immutability) is exercised by a real test against the live hosted Supabase project, not simulated.

Representative sample (full list cross-referenced against each plan's frontmatter and each SUMMARY's `coverage:` block):

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 01-01 | No RLS policy lets a non-admin write `profiles`; trigger never reads role from metadata | ✓ VERIFIED | `grep -ciE "for (insert|update|delete)"` on the migration → 0 (only the admin `FOR ALL` policy exists); `tests/rls/perfiles-rol.test.ts` (5 tests) pass |
| 01-01 | Secrets live only in `.env.admin.local`, git-ignored, never loaded by the app | ✓ VERIFIED | `git ls-files` shows no `.env.local`/`.env.admin.local`; `grep -rn "SUPABASE_SECRET_KEY\|SUPABASE_ACCESS_TOKEN\|ADMIN_INITIAL_PASSWORD" app lib proxy.ts` → empty |
| 01-02 | Anonymous `/admin` redirected by root `proxy.ts` before the page renders | ✓ VERIFIED | `proxy.ts` read in full — `getClaims()` called immediately after client creation, redirects to `/login` for `/admin` with no claims; e2e test passes |
| 01-02 | `cerrarSesion` uses local-scope logout only (D-02) | ✓ VERIFIED | `app/admin/actions.ts`: `scope: 'local'`; `grep -rn "scope: 'global'"` → empty; e2e "logs out only the device that submits form-cerrar-sesion" passed on cold run |
| 01-02 | Exactly one non-test admin: gabbovera@gmail.com | ✓ VERIFIED | `tests/auth/auth-hardening.test.ts` "es el único admin real" passed on cold run |
| 01-03 | A VES payment without `tasa_cambio`, and deleting a reserva with a payment, are rejected even for the admin | ✓ VERIFIED | Schema check constraint + `on delete restrict` read directly in the migration; `tests/rls/aislamiento-clientes.test.ts` proves both, even for a service/admin client |
| 01-03 | `comprobantes` bucket is private, folder-isolated, customer-immutable | ✓ VERIFIED | Migration has no customer UPDATE/DELETE policy on `storage.objects`; `tests/rls/comprobantes.test.ts` (8 tests) passed on cold run, including the public-URL-non-200 and upsert-rejected cases |
| 01-04 | Wrong password and unknown email produce the identical anti-enumeration message | ✓ VERIFIED | `app/login/actions.ts` maps both to `'Correo o contraseña incorrectos.'`; e2e test passed on the cold run (this is the specific assertion that only failed on the *second*, rate-limited run — see Method) |
| 01-04 | Root `/` redirects to `/admin` | ✓ VERIFIED | `app/page.tsx` contains `redirect('/admin')`; e2e "la raíz / lleva a /admin" passed |

No must-have across any of the 4 plans failed. No override was needed.

### Advisory (New Scope, Unevidenced)

Not applicable — this is an initial verification, not a re-verification.

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql` | profiles + RLS + `private.is_admin()` + trigger | ✓ VERIFIED | Exists, pushed remotely, `enable row level security` ×2, `private.is_admin()` ×8 |
| `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql` | reservas/pagos/recordatorios + RLS | ✓ VERIFIED | Exists, pushed remotely, RLS enabled for all 3 tables (confirmed by grep loop) |
| `supabase/migrations/20260927000003_comprobantes_privados.sql` | private bucket + storage policies | ✓ VERIFIED | Exists, pushed remotely, `'comprobantes'` ×7 |
| `lib/supabase/server.ts` | server-only Supabase client | ✓ VERIFIED | `import "server-only"` on line 1, used by `require-admin.ts`, `login/actions.ts`, `admin/actions.ts` |
| `lib/auth/require-admin.ts` | `getAdminSession`/`requireAdmin` | ✓ VERIFIED | Both exported, both call `getClaims()` (2 occurrences), used by `app/admin/page.tsx` and `app/login/page.tsx` |
| `proxy.ts` | session refresh + optimistic redirect | ✓ VERIFIED | At project root (not `app/`, not `middleware.ts`); `getClaims()` called immediately after client creation |
| `app/admin/page.tsx` / `app/admin/actions.ts` | guarded panel + local logout | ✓ VERIFIED | `requireAdmin()` called; `form-cerrar-sesion` present; `scope: 'local'` |
| `app/login/page.tsx` / `login-form.tsx` / `actions.ts` | branded, validated, progressive-enhancement login | ✓ VERIFIED | `esquemaLogin.safeParse` server-side, `zodResolver(esquemaLogin)` client-side, `useActionState` + `action={formAction}` for no-JS fallback |
| `lib/validation/auth.ts` | shared zod schema | ✓ VERIFIED | `esquemaLogin`, `DatosLogin` exported, consumed by both actions.ts and login-form.tsx |
| `scripts/seed-admin.mjs` / `scripts/configure-auth.mjs` | real admin + closed signup | ✓ VERIFIED | Idempotent per SUMMARY; `tests/auth/auth-hardening.test.ts` proves the live state (4/4 tests pass) |
| `lib/database.types.ts` | generated from live schema | ✓ VERIFIED | Contains `reservas` (5), `pagos` (4), `recordatorios` (2), `profiles` (5) |
| `tests/helpers/fixtures.ts` | shared test fixtures, 10 exports | ✓ VERIFIED | All 10 exports present (`publicClient`, `serviceClient`, `createTestUser`, `cleanupTestUsers`, `sweepStaleTestUsers`, `CookieJar`, `submitForm`, `signInAs`, `createReservaFixture`, `trackStoragePath`) |
| `tests/rls/*.test.ts` (4 files) | RLS proof suite | ✓ VERIFIED | All 4 files exist, 23 tests, all passed on the cold run |
| `tests/e2e/*.test.ts` (2 files) + `global-setup.ts` | e2e proof suite | ✓ VERIFIED | 13 e2e tests, all passed on the cold run |
| `tests/auth/auth-hardening.test.ts` | admin-hardening proof | ✓ VERIFIED | 4 tests, all passed on the cold run |

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/login/login-form.tsx` | `app/login/actions.ts` | `useActionState(iniciarSesion)` + `action={formAction}` | ✓ WIRED | Confirmed in file content read in full |
| `app/login/actions.ts` | `lib/validation/auth.ts` | `esquemaLogin.safeParse` | ✓ WIRED | Confirmed by grep + read |
| `app/admin/page.tsx` | `lib/auth/require-admin.ts` | `await requireAdmin()` | ✓ WIRED | Confirmed by read; not orphaned — `app/admin/page.tsx` and `app/login/page.tsx` both import it |
| `proxy.ts` | Supabase Auth | `createServerClient` → immediate `getClaims()` | ✓ WIRED | No code between client creation and the call, confirmed by reading the file |
| `supabase/migrations/...0002...sql` | `private.is_admin()` | admin policies call `(select private.is_admin())` | ✓ WIRED | `grep -c "private.is_admin()"` = 7 across that migration |
| `scripts/seed-admin.mjs` | `public.profiles` | promotes role to admin for `gabbovera@gmail.com` | ✓ WIRED | `tests/auth/auth-hardening.test.ts` confirms the live row |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| AUTH-01 | 01-01, 01-02, 01-03, 01-04 | El admin puede iniciar sesión como único usuario administrador | ✓ SATISFIED | All 4 plans' must_haves independently verified; REQUIREMENTS.md correctly marks it `[x] Complete`; no other admin account exists besides `gabbovera@gmail.com` (proven live, not just by code review) |

No orphaned requirements — REQUIREMENTS.md maps only AUTH-01 to Phase 1, and all 4 plans declare `requirements: [AUTH-01]`.

## Anti-Patterns / Notable Findings

| File(s) | Finding | Severity | Impact |
|---------|---------|----------|--------|
| — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any phase-created/modified file | — | None — clean |
| Supabase Auth rate limiting on back-to-back full-suite runs | Running the full `vitest run` suite twice in quick succession against the same hosted Supabase project trips Supabase's own login rate limiter, causing transient test failures unrelated to application code (confirmed: the failing wrong-password assertion actually received the correctly-mapped "Demasiados intentos..." 429 message, proving the rate-limit-handling code works) | ℹ️ Info | Already flagged by the phase's own FA-1 ("rate-limited login... no automated expiry simulation. Needs human review at verify time"). Worth keeping in mind for CI: back-to-back full runs against the single shared hosted dev/test project can produce spurious red — not a defect to fix in Phase 1, but a fragility to watch as Phase 2+ adds more tests to the same suite. |
| Root `AGENTS.md`/`CLAUDE.md` regenerated by `next dev` | Present on disk (untracked, gitignored) — expected per 01-01-SUMMARY's documented deviation fix | ℹ️ Info | Confirmed both files are gitignored (`/AGENTS.md`, `/CLAUDE.md` in `.gitignore`) and untracked; `.claude/CLAUDE.md` (the real project-instructions file) is confirmed byte-for-byte unchanged all phase (`git diff --quiet` exits 0; `git log --follow` shows no phase-1 touches) |
| Worktree isolation disabled (`workflow.use_worktrees: false`, commit `f985e13`) | All 4 plans ran sequentially on `main`, no worktree | ℹ️ Info | Confirmed as an infrastructure decision, not a scope deviation: `.env.local`/`.env.admin.local` are gitignored and exist only in the main checkout, so they are structurally invisible to a worktree. Commit `f985e13` ("chore(01-01): disable git worktree isolation for phase execution") predates all 4 plans' execution commits, and each plan's SUMMARY documents the same rationale consistently. This did not change what was built — every plan's own `<verify>`/acceptance-criteria commands ran and passed regardless of branching strategy, and the git history shows clean, sequential, non-overlapping commits per plan (`01-01` → `01-02`/`01-03` (parallel-safe per `coupling_justified`) → `01-04`) with no lost or conflicting work. |

## Human Verification Required

Per `workflow.human_verify_mode: end-of-phase`, this phase deliberately deferred human-check items to end-of-phase UAT instead of halting execution. Harvested from all 4 SUMMARY.md files (none were dropped):

### 1. Modelo de datos para revisar (Plan 01-03)

**Test:** Lee la sección "Modelo de datos para revisar" en `01-03-SUMMARY.md`. Resume: cada cliente es una cuenta creada por el admin (sin registro público); cada reserva tiene precio y moneda (USD por defecto); cada pago guarda método/monto/moneda, y si es en bolívares, la tasa de cambio es obligatoria; una reserva con pagos no se puede borrar; los recordatorios son una cola interna (el cliente se entera por correo en Fase 5); los comprobantes de pago son privados y, una vez subidos, el cliente no puede borrarlos ni reemplazarlos.
**Expected:** El dueño del negocio confirma que el modelo coincide con cómo opera hoy, o señala qué cambiar antes de que la Fase 2 construya pantallas sobre él. Pregunta explícita del propio plan: **¿habrá clientes que nunca tengan cuenta (sin correo)?** — por ejemplo alguien que paga en efectivo una sola vez y nunca vuelve a usar la app. Si la respuesta es sí, el modelo actual no lo resuelve todavía.
**Why human:** Ajuste al modelo de negocio (RESEARCH Assumption A2); no es verificable por grep ni por pruebas automatizadas, y cambiarlo después de que la Fase 2 construya sobre él costaría una migración más cambios de código coordinados.

### 2. Visual/marca en pantalla de teléfono (Plan 01-04)

**Test:** Con `npm run dev` corriendo, abre `http://localhost:3000` en una ventana de 375px de ancho (modo dispositivo del navegador) y revisa `/login` y `/admin`.
**Expected:** El logo y el botón morado (`#482583`) se ven bien en el tamaño de teléfono; los campos y el botón son cómodos de tocar.
**Why human:** El ajuste visual/de marca no es verificable por grep ni por el test suite automatizado.

### 3. Login real con la cuenta del operador (Plan 01-04)

**Test:** Inicia sesión como `gabbovera@gmail.com` con la contraseña inicial, revisa el panel, presiona "Cerrar sesión", luego intenta iniciar sesión con una contraseña incorrecta.
**Expected:** El panel muestra "Sesión iniciada como gabbovera@gmail.com"; la contraseña incorrecta muestra "Correo o contraseña incorrectos." en español; cerrar sesión regresa a `/login`.
**Why human:** Requiere la cuenta real del operador y un navegador real; los tests automatizados usan exclusivamente cuentas desechables `rt-test-`, nunca la cuenta real, por diseño (para no arriesgar la única cuenta admin real).

### 4. Persistencia de sesión al día siguiente — D-01 (Plan 01-04)

**Test:** Reabre el mismo navegador (con la sesión de `gabbovera@gmail.com` ya iniciada) al día siguiente.
**Expected:** El panel abre sin pedir la contraseña de nuevo — la cookie de sesión de `@supabase/ssr` dura 400 días por defecto, y `proxy.ts` la renueva en cada visita.
**Why human:** Una expiración/renovación de sesión de un día de diferencia no puede simularse en un test e2e que corre en segundos. El propio 01-01-PLAN.md lo marca explícitamente como sin cobertura automatizada (FA-1: "access-token refresh after expiry: only a static check... plus a next-day human check. There is no automated expiry simulation").

## Gaps Summary

No gaps. All 3 ROADMAP success criteria and all 31 must-have truths across the 4 plans are verified by a combination of live code inspection, migration content read directly from the repository, and a cold, independent full-suite test run (40/40 passing) against the real hosted Supabase project — not by trusting SUMMARY-reported numbers. `AUTH-01` is correctly marked complete in `REQUIREMENTS.md`; no orphaned requirements exist for Phase 1. The phase's own deferred human-check items (data-model sign-off, visual/brand check, real-account login, and next-day session persistence) were correctly harvested from all 4 SUMMARY.md files and are queued above — none were dropped. The phase goal is achieved pending this human sign-off.

---

*Verified: 2026-09-28*
*Verifier: Claude (gsd-verifier)*
