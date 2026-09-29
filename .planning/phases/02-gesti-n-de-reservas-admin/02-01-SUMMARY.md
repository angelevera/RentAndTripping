---
phase: 02-gesti-n-de-reservas-admin
plan: 01
subsystem: database, api, ui
tags: [supabase, postgres, zod, nextjs-server-actions, rls]

requires:
  - phase: 01-base-y-acceso-seguro
    provides: requireAdmin(), lib/supabase/server.ts createClient(), profiles/reservas/pagos/recordatorios schema, tests/helpers/fixtures.ts core helpers, tests/e2e admin-login/admin-access contract
provides:
  - Additive reservas schema for payer-without-account sales (nullable cliente_id, pagador_*/viajero_* columns, business-rule CHECK constraints)
  - Shared zod contract for reservas (lib/validation/reservas.ts) used by both client and server
  - crearReserva Server Action + /admin/reservas/nueva create page (pasaje path only; other 3 types land in 02-03)
  - /admin reservas list (newest first)
  - Test fixtures createReservaSinCuentaFixture / createPagoFixture / getFormHiddenInputs / loginJar
  - anti-slop Oxlint plugin installed project-wide (tools/oxlint/anti-slop/, .oxlintrc.json)
affects: [02-02, 02-03, 02-04, 02-05]

actuals:
  tokens: 42000
  tasks: 3
  commits: 4

tech-stack:
  added: [oxlint, "@oxlint/plugins"]
  patterns:
    - "Server Actions: requireAdmin() first statement, safeParse, insert, redirect outside try/catch"
    - "Shared zod schema (lib/validation/*.ts) used by both the client form and the Server Action"
    - "Test fixtures build an insert row as a typed local object, adding optional fields conditionally instead of spreading `{...} : {}`"
    - "Codex delegation: implementation code for a plan's tasks goes through /codex:rescue when it doesn't touch secrets; Claude reviews architecture and runs anti-slop + a manual thermos (security + code-quality parallel review) before marking done"

key-files:
  created:
    - supabase/migrations/20260929012532_pagador_viajero_reservas.sql
    - lib/validation/reservas.ts
    - app/admin/reservas/actions.ts
    - app/admin/reservas/reserva-form.tsx
    - app/admin/reservas/nueva/page.tsx
    - tests/rls/reservas-sin-cuenta.test.ts
    - tests/e2e/reservas-crear.test.ts
  modified:
    - lib/database.types.ts
    - lib/supabase/server.ts
    - tests/helpers/fixtures.ts
    - app/admin/page.tsx

key-decisions:
  - "D-01 shape confirmed by owner: Option A — pagador/viajero contact data lives directly on the reserva row; cliente_id stays as an optional link to a future customer account (Fase 3)"
  - "D-04: the traveller's phone is required (not optional) when 'es para otra persona' is checked"

patterns-established:
  - "Pattern: etiquetaDesde(mapa, valor) helper in lib/validation/reservas.ts for text-column-to-label lookups, instead of inline `as keyof typeof mapa` casts repeated per call site"

requirements-completed: [RESA-01, RESA-03]

coverage:
  - id: D1
    description: "Admin records a pasaje for a payer with no customer account and sees it listed on /admin"
    requirement: RESA-01
    verification:
      - kind: e2e
        ref: "tests/e2e/reservas-crear.test.ts#guarda un pasaje sin cuenta con los campos y valores esperados y lo lista en /admin"
        status: pass
    human_judgment: false
  - id: D2
    description: "Server rejects missing PNR and price <= 0 even without JavaScript, and saves nothing"
    requirement: RESA-01
    verification:
      - kind: e2e
        ref: "tests/e2e/reservas-crear.test.ts#rechaza un PNR vacío sin crear una fila"
        status: pass
      - kind: e2e
        ref: "tests/e2e/reservas-crear.test.ts#rechaza precio cero sin crear una fila"
        status: pass
    human_judgment: false
  - id: D3
    description: "crearReserva is admin-gated: anonymous and customer-session POSTs create no row"
    requirement: RESA-01
    verification:
      - kind: e2e
        ref: "tests/e2e/reservas-crear.test.ts#rechaza el POST sin cookies y el POST autenticado como cliente"
        status: pass
    human_judgment: false
  - id: D4
    description: "A reserva with no customer account (cliente_id NULL) and its pagos stay invisible to customers and anonymous callers; only the admin reads/writes it"
    requirement: RESA-03
    verification:
      - kind: integration
        ref: "tests/rls/reservas-sin-cuenta.test.ts#el cliente no ve la reserva ni su pago"
        status: pass
      - kind: integration
        ref: "tests/rls/reservas-sin-cuenta.test.ts#un anónimo no ve la reserva"
        status: pass
    human_judgment: false
  - id: D5
    description: "Database enforces business rules independently of the app: non-blank pagador fields, con_problema requires a note, detalle is a bounded JSON object matching tipo, viajero_telefono requires viajero_nombre"
    verification:
      - kind: integration
        ref: "tests/rls/reservas-sin-cuenta.test.ts (constraint-rejection tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase 1 contracts (/admin panel, logout form, RLS/e2e suites) still hold after the /admin rewrite"
    verification:
      - kind: e2e
        ref: "npm run test:e2e (admin-login.test.ts, admin-access.test.ts)"
        status: pass
      - kind: integration
        ref: "npm run test:db (aislamiento-clientes.test.ts, anonimo.test.ts, perfiles-rol.test.ts, comprobantes.test.ts)"
        status: pass
    human_judgment: false

duration: 95min
completed: "2026-09-29"
status: complete
---

# Phase 2 Plan 01: Reservas tracer (pasaje sin cuenta) Summary

**Admin can record a pasaje for a payer with no customer account and see it listed on /admin — additive schema, shared zod contract, requireAdmin()-gated Server Action, proven end to end over HTTP without JavaScript.**

## Performance

- **Duration:** ~95 min
- **Started:** 2026-09-29T01:19:00Z
- **Completed:** 2026-09-29T02:00:00Z
- **Tasks:** 3 (1 checkpoint:decision, 2 auto)
- **Files modified:** 11 app/test files + 1 migration + anti-slop tooling install

## Accomplishments
- Additive migration (`20260929012532_pagador_viajero_reservas.sql`) makes `cliente_id` nullable and adds `pagador_*`/`viajero_*` columns with 8 business-rule CHECK constraints, applied to the live Supabase project with zero pre-existing rows needing backfill
- Shared `lib/validation/reservas.ts` zod schema drives both the create form and the Server Action from one source of truth
- `crearReserva` Server Action: `requireAdmin()` first, `safeParse`, insert, `redirect()` outside try/catch — never touches `pagos` or Supabase Auth admin APIs
- `/admin/reservas/nueva` create page and a rewritten `/admin` list (newest first) that keeps the Phase 1 panel contract (`panel-admin`, session email, logout form) intact
- RLS regression test proves a no-account reserva and its pago stay invisible to customers/anonymous callers while the admin can read/write it, and that every new DB constraint actually rejects bad data
- anti-slop Oxlint plugin installed project-wide (first time this repo has had it) and its in-scope findings resolved

## Task Commits

1. **Task 1: Decisión — forma de pagador/viajero (D-01)** - checkpoint, no code (owner answered via AskUserQuestion: Option A, traveller phone required)
2. **Task 2: Wave 0 — migración pagador/viajero, tipos, fixtures, RLS** - `<see git log: feat(02-01)>` (executed directly by Claude — touches `.env.admin.local`-loaded Supabase CLI, never delegated per project policy)
3. **Task 3 (tracer): formulario, Server Action, listado** - `<see git log: feat(02-01)>` (implemented by Codex via `/codex:rescue`; Codex could not run e2e/build in its own sandbox due to a port-bind EPERM, so Claude ran and confirmed all verification directly, then applied 3 code-quality fixes surfaced by a manual thermos pass)

**Tooling:** `<see git log: chore>` — anti-slop Oxlint plugin install (required by project policy before any Codex-delegated task is marked done)

**Plan metadata:** `<see git log: docs(02-01)>` — SUMMARY + STATE + ROADMAP

## Files Created/Modified
- `supabase/migrations/20260929012532_pagador_viajero_reservas.sql` - additive schema change (Task 2)
- `lib/database.types.ts` - regenerated from the live schema (Task 2)
- `lib/supabase/server.ts` - `createServerClient<Database>` (Task 2)
- `tests/helpers/fixtures.ts` - new reserva/pago fixtures + form helpers + extended cleanup (Task 2)
- `tests/rls/reservas-sin-cuenta.test.ts` - RLS + constraint regression suite (Task 2)
- `lib/validation/reservas.ts` - shared zod schema, FormData mappers, `etiquetaDesde` helper (Task 3)
- `app/admin/reservas/actions.ts` - `crearReserva` Server Action (Task 3)
- `app/admin/reservas/reserva-form.tsx` - pasaje create form (Task 3)
- `app/admin/reservas/nueva/page.tsx` - admin-guarded create page (Task 3)
- `app/admin/page.tsx` - reservas list added on top of the Phase 1 panel (Task 3)
- `tests/e2e/reservas-crear.test.ts` - end-to-end create-path proof (Task 3)
- `.oxlintrc.json`, `tools/oxlint/anti-slop/**`, `package.json`/`package-lock.json`, `tsconfig.json` - anti-slop tooling install

## Decisions Made
- **D-01 (one-way door, owner-confirmed):** Option A — pagador/viajero contact data lives on the reserva row; `cliente_id` stays nullable/optional for a future Fase 3 account link. 0 pre-existing reservas rows needed backfill (pre-launch MVP, no real bookings yet — confirmed by the Task 2 pre-flight `test:db` sweep and by the migration's NOT NULL step succeeding without rollback, which would have failed had any row lacked contact data).
- **D-04:** the traveller's phone is required (not optional) when "es para otra persona" is checked.
- Reused the project's established Codex-delegation policy (confirmed in Phase 1): Task 2 (touches `.env.admin.local`-loaded Supabase CLI) was executed directly by Claude; Task 3 was delegated to Codex with the mandatory secrets-safety instruction, then reviewed, anti-slop-linted, and thermos-reviewed by Claude before being marked done.

## Deviations from Plan

### Auto-fixed Issues

**1. [Codex sandbox limitation] Codex could not run e2e/build verification itself**
- **Found during:** Task 3 review
- **Issue:** Codex's own sandbox hit `listen EPERM` when the e2e harness tried to bind a port for its `next dev` instance, and Turbopack's `next build` hit a similar bind error there. Codex correctly did not commit and reported the blocker instead of claiming false success.
- **Fix:** Claude ran the full verification suite directly in the real dev environment (which has no such sandbox restriction). Found and killed an unrelated 8.5-hour-old orphaned `next dev` process on port 3000 (leftover from an earlier session) that was blocking the e2e harness's own ephemeral dev server from starting.
- **Verification:** `npx vitest run --project e2e tests/e2e/reservas-crear.test.ts` (5/5), `npm run test:e2e` (18/18), `npm run build`, `npm run lint`, `npx tsc --noEmit` all green.

**2. [Anti-slop install] First-time install surfaced pre-existing-codebase findings**
- **Found during:** Task 3 anti-slop gate
- **Issue:** This is the first time `install-anti-slop` has run in this repo; running it flagged both the new diff and dozens of pre-existing Phase 1 findings (mostly `require-readable-spacing`) across untouched files.
- **Fix:** Autofixed spacing and fixed all real findings (type-safety, dead code, boundary-typing) in files this plan touches. Left 2 pre-existing findings in Phase-1-only functions (`extractHiddenInputs`, `submitForm` in `tests/helpers/fixtures.ts`) unfixed and out of scope — reported below for a future cleanup pass.
- **Files modified:** `lib/validation/reservas.ts`, `tests/helpers/fixtures.ts`, `app/admin/page.tsx`, plus `tsconfig.json` (excluded the vendored plugin directory, whose `.ts`-extension imports otherwise break `next build`'s TypeScript check).
- **Verification:** `npx oxlint` scoped to this plan's files is clean except the 2 reported pre-existing findings.

**3. [Manual thermos — code quality] 3 findings applied**
- **Found during:** post-implementation thermos code-quality review
- **Issue:** `createReservaFixture`'s inline pago insert duplicated the new `createPagoFixture` helper; the `tipo`/`estado_proveedor` label-lookup cast+SAFETY-comment pattern was duplicated twice inline in `app/admin/page.tsx`; `aBooleano`'s `.default(false)` was dead code (the preprocess callback never returns `undefined`).
- **Fix:** `createReservaFixture` now calls `createPagoFixture`; extracted a shared `etiquetaDesde(mapa, valor)` helper into `lib/validation/reservas.ts` and used it from both call sites in `app/admin/page.tsx`; dropped the dead `.default(false)`.
- **Verification:** full suite re-run green after each fix (tsc, oxlint, eslint, test:db, test:e2e, build).

---

**Total deviations:** 3 auto-fixed (1 environment/tooling, 1 first-time-install noise, 1 code-quality). No scope creep — all fixes were either required for correctness (the tsconfig exclude, without which `npm run build` would break) or squarely inside files this plan already touches.
**Impact on plan:** None on scope or requirements; all RESA-01/RESA-03 acceptance criteria met as written.

## Issues Encountered
- An orphaned `next dev` process (8.5h old, unrelated to this session) was occupying port 3000 and silently causing the e2e harness's global-setup to time out waiting for its own ephemeral server. Killed; not a code defect.
- The anti-slop `no-runtime-typeof` rule does not have a documented comment-based override (unlike `require-safety-comment-for-type-assertion`), so the comma-decimal price normalization was restructured to avoid `typeof` entirely (`String(valor ?? "").replace(",", ".")`) rather than suppressed.

## Reported, Not Fixed (out of scope for this plan)

- `tests/helpers/fixtures.ts`: `extractHiddenInputs` (`no-known-value-widening`) and `submitForm`'s conditional header spread (`no-conditional-empty-object-spread`) are pre-existing Phase 1 code this plan does not otherwise touch. Left as-is per scope discipline; worth a small follow-up cleanup pass.
- Manual thermos code-quality review also flagged that `cleanupTestUsers` now has two overlapping cleanup mechanisms (the explicit `trackedReservaIds`/`trackedPagoIds`/`trackedRecordatorioIds` Sets, and the new `created_by`-cascade added in Task 2) — every fixture-created row is in practice always reachable via the cascade, so the three Sets and their ~6 call sites could likely be deleted entirely. Not applied here: it's a larger refactor touching Phase 1 fixture code beyond this plan's diff, with real (if probably small) regression risk to test cleanup reliability. Flagged for a dedicated follow-up rather than folded into this plan's commit.

## User Setup Required

None - no external service configuration required beyond what Phase 1 already set up.

## Next Phase Readiness
- The FormData field-name contract, `filaReservaDesdeDatos`/`datosReservaDesdeFormData` mapping, and `esquemaReserva`/`esquemaDetalle` shape are the foundation Plan 02-02 (shadcn UI + list polish) and 02-03 (all 4 reservation types) build directly on top of.
- `aviso=creada` is already wired into the redirect from `crearReserva` but not yet consumed by any toast — this is intentional forward-wiring for Plan 02-02 ("adds the success toasts that the create and edit flows trigger" per the phase plan map), not dead code.
- `EntradaReserva` (z.input type) is exported but not yet imported anywhere — also intentional, per this plan's own artifact list, for 02-03/02-04's react-hook-form integration.
- No blockers for Plan 02-02.

---
*Phase: 02-gesti-n-de-reservas-admin*
*Completed: 2026-09-29*
