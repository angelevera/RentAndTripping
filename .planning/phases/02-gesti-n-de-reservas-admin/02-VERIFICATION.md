---
phase: 02-gesti-n-de-reservas-admin
verified: 2026-09-29T12:10:22Z
status: passed
score: 9/10 must-haves verified
covered_files:

  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-01-PLAN.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-01-SUMMARY.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-02-PLAN.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-02-SUMMARY.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-03-PLAN.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-03-SUMMARY.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-04-PLAN.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-04-SUMMARY.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-05-PLAN.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-05-SUMMARY.md"
  - ".planning/phases/02-gesti-n-de-reservas-admin/02-REVIEW.md"
  - "app/admin/page.tsx"
  - "app/admin/reservas/[id]/editar/page.tsx"
  - "app/admin/reservas/actions.ts"
  - "app/admin/reservas/filtros-reservas.tsx"
  - "app/admin/reservas/lista-reservas.tsx"
  - "app/admin/reservas/nueva/page.tsx"
  - "app/admin/reservas/reserva-form.tsx"
  - "app/globals.css"
  - "app/layout.tsx"
  - "components.json"
  - "components/aviso-toast.tsx"
  - "lib/database.types.ts"
  - "lib/reservas/listar.ts"
  - "lib/reservas/parametros-lista.ts"
  - "lib/supabase/server.ts"
  - "lib/validation/reservas.ts"
  - "supabase/migrations/20260929012532_pagador_viajero_reservas.sql"
  - "tests/e2e/reservas-crear.test.ts"
  - "tests/e2e/reservas-editar.test.ts"
  - "tests/e2e/reservas-lista.test.ts"
  - "tests/helpers/fixtures.ts"
  - "tests/rls/lista-reservas.test.ts"
  - "tests/rls/reservas-sin-cuenta.test.ts"
  - "tests/validation/parametros-lista.test.ts"
  - "tests/validation/reservas.test.ts"
  - "vitest.config.ts"

covered_digest: "v1:sha256:9a15b2e19426f563293c18abb2ba0549e70c828529712372f7fd1d1be5a361f9"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:

  - truth: "AvisoToast shows a distinct toast for every genuinely-new `aviso` redirect value within one continuous admin session (02-02 must_have; fixed in commit 4985466 after code review finding WR-01 found the original `useRef` guard only ever showed the *first* toast per browser tab)"
    test: "In one continuous browser session with JavaScript on: create a reserva (toast 'Reserva creada...' should appear), then immediately edit a different reserva and mark it confirmed (toast 'Marcada como confirmada con el proveedor...' should also appear, not be silently swallowed)"
    expected: "Both toasts appear, each with its own exact copy, and the `?aviso=` query string is stripped from the URL after each one"
    why_human: "The fix removed the `useRef` boolean guard entirely (relying on `router.replace` stripping the query param before a repeat value could arrive) but no automated test exercises this — the project has no browser automation (FA-12), and the no-JS e2e harness never runs client-side effects at all, so the exact bug this fix addresses (a second sequential toast in one session) cannot be proven by grep or by the existing test suite"
human_verification:

  - test: "With `npm run dev` running, open /login then /admin on phone and computer; create a reserva from /admin/reservas/nueva"
    expected: "Titles use Poppins bold, text uses Inter, buttons and the focus ring are brand purple (#482583), nothing uses shadcn's default grey/blue theme, and after saving a toast 'Reserva creada. Ya la puedes ver en la lista.' appears at the top and then disappears"
    why_human: "Typography, color and toast appearance are visual; grep cannot confirm what the owner sees (harvested from 02-02-PLAN.md Task 2 human-check)"
  - test: "On phone and computer, open /admin with at least one USD reserva, one VES reserva and one reserva with a confirmed payment; also view it before any reserva exists if possible"
    expected: "Status badges are the first thing the eye catches in each card/row; phone shows cards, computer shows a table; a VES reserva shows 'En Bs · ver detalle' instead of an amount (confirms D-09); 'Pagado' appears only where a payment was confirmed (confirms FA-6); a brief grey skeleton shows while loading; the true-empty and error states render as specified"
    why_human: "The visual focal point, the responsive table/card switch, and the owner's confirmation of two unconfirmed business rules (D-09 display, the 'Pagado' rule) cannot be verified by tests (harvested from 02-02-PLAN.md Task 3 human-check)"
  - test: "On phone with JavaScript on, open /admin/reservas/nueva and create one reserva of each type (hotel for another person, tour for a group of 3 with names, entrada in VES); try saving a pasaje without PNR and a price of 0"
    expected: "Only the chosen type's fields appear; errors show under each field instantly in Spanish with the UI-SPEC wording; the button shows 'Guardando…' while saving; after saving, /admin shows the create toast and the new row; the traveller's phone is required; the group-sale fields make sense to the owner"
    why_human: "The in-browser JavaScript path (react-hook-form + Radix controls) has no browser automation in this stack (FA-12), and the group fields need the owner's confirmation (harvested from 02-03-PLAN.md Task 2 human-check)"
  - test: "On phone, open a reserva from the list with 'Editar', mark it 'Confirmada con el proveedor' and save; open another reserva, choose 'Con problema', try to save with no note, then write what happened and save; add a 'Fecha importante' to a reserva that had none"
    expected: "Status options sit at the top of the form; saving 'Con problema' without a note shows the explanatory message; each save returns to the list with the matching toast, and the badges update; payment badges never change"
    why_human: "The in-browser radio/textarea interaction and the toast after redirect run with JavaScript, which the automated no-JS tests do not execute (harvested from 02-04-PLAN.md Task 2 human-check)"
  - test: "On phone with several reservas loaded, type part of a client's name in the search box, then choose 'Con problema' and a type; clear with 'Quitar filtros'; if more than 20 reservas exist, use 'Siguiente'/'Anterior'"
    expected: "The list narrows as you type (after a short pause) and when a filter is chosen; a brief grey skeleton shows while loading; a no-match search shows 'No hay reservas que coincidan' with 'Quitar filtros'; page links keep the search; newest reservas are always first"
    why_human: "Debounced typing, Radix selects and the loading transition run with JavaScript, which the automated no-JS tests do not execute (harvested from 02-05-PLAN.md Task 2 human-check)"
  - test: "In one continuous session, create a reserva and then edit a different one (see behavior_unverified_items above) to confirm the AvisoToast session-persistence fix actually shows a second toast"
    expected: "Both the create toast and the edit/status toast appear, each with distinct copy"
    why_human: "State-transition invariant with no automated (browser) test coverage; see behavior_unverified_items"
  - test: "Run a single, uninterrupted `npm test` (unit + db + e2e, all projects) once the shared Supabase project's Auth sign-in rate limit window is clear"
    expected: "Every project passes in one combined run"
    why_human: "Every individual test file was verified green in isolation this session (unit 31/31; e2e reservas-crear 15/15, reservas-editar 12/12, reservas-lista 8/8, admin-login+admin-access 13/13; db reservas-sin-cuenta 10/10, lista-reservas 7/7; tsc/lint/build all clean) but a full-suite single run has never completed without hitting the shared hosted Supabase project's Auth rate limit (documented in 02-02, 02-04 and 02-05 SUMMARYs as a known, structural, volume-triggered environment limitation, not a code defect) — this verification did not re-attempt the full combined run for the same reason, to avoid making the limit worse for the operator's own testing"
---

# Phase 2: Gestión de reservas (admin) Verification Report

**Phase Goal:** El admin tiene un solo lugar para crear, editar y dar seguimiento a todas las reservas (pasajes, hoteles, tours, entradas), reemplazando el cuaderno mental/WhatsApp de hoy.
**Verified:** 2026-09-29T12:10:22Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: Admin can create a reserva stating tipo, cliente (payer/traveller), service details, price and currency | ✓ VERIFIED | `crearReserva` in `app/admin/reservas/actions.ts` (`requireAdmin()` → `esquemaReserva.safeParse` → insert → redirect); `esquemaDetalle` discriminated union for all 4 tipos in `lib/validation/reservas.ts`; re-ran `npx vitest run --project e2e tests/e2e/reservas-crear.test.ts` myself: **15/15 passed** |
| 2 | SC2: Admin can edit any field of an existing reserva | ✓ VERIFIED | `editarReserva` in `app/admin/reservas/actions.ts`, whitelist update via `filaReservaDesdeDatos`, never writes `cliente_id`/`created_at` (grep confirmed empty); `/admin/reservas/[id]/editar/page.tsx` preloads every field; re-ran `npx vitest run --project e2e tests/e2e/reservas-editar.test.ts` myself: **12/12 passed** |
| 3 | SC3: Admin can see the full reserva list with status (pendiente/confirmada/con_problema), searchable, without checking WhatsApp | ✓ VERIFIED | `lib/reservas/listar.ts` (`listarReservas` with `.ilike`/`.eq` filters, exact count, count-then-range pagination), `app/admin/reservas/lista-reservas.tsx` (badges, table/cards, empty/error states), `app/admin/reservas/filtros-reservas.tsx` (search/estado/tipo); re-ran `npx vitest run --project e2e tests/e2e/reservas-lista.test.ts` myself: **8/8 passed**; `npx vitest run --project db tests/rls/lista-reservas.test.ts` myself: **7/7 passed** |
| 4 | SC4: Admin can mark a reserva "confirmada con el proveedor" independently of whether it's paid | ✓ VERIFIED | `avisoTrasEditar`/`filaEdicionDesdeDatos`/`esquemaEstadoProveedor` in `lib/validation/reservas.ts`; `editarReserva` never reads/writes `pagos` (grep confirmed); e2e cases assert the `pagos` row is byte-identical after a status change — part of the 12/12 `reservas-editar.test.ts` run above |
| 5 | Phase 1 contract holds: `/admin` panel, session email, logout form still work after the rewrite | ✓ VERIFIED | `grep -c 'data-testid="panel-admin"'`/`form-cerrar-sesion"` in `app/admin/page.tsx` both ≥1; re-ran `npx vitest run --project e2e tests/e2e/admin-login.test.ts tests/e2e/admin-access.test.ts` myself: **13/13 passed** |
| 6 | A reserva with no customer account (`cliente_id` NULL) and its `pagos` stay invisible to customers/anonymous callers; only the admin reads/writes it | ✓ VERIFIED | RLS policies unchanged (additive migration only); re-ran `npx vitest run --project db tests/rls/reservas-sin-cuenta.test.ts` myself: **10/10 passed** |
| 7 | Prohibition: reservation screens never create/modify/delete `pagos` rows | ✓ VERIFIED | `grep -rnE "from\(\"pagos\"\)\s*\.(insert\|update\|delete\|upsert)" app lib` → no matches |
| 8 | Prohibition (D-09): the list never shows an invented VES→USD conversion | ✓ VERIFIED | `grep -rniE "tasa\|cambio\|convert" lib/reservas/listar.ts app/admin/reservas/lista-reservas.tsx` → no matches; VES rows render "En Bs · ver detalle" instead (confirmed in the passing e2e list test) |
| 9 | Code-review fix WR-02: non-numeric `precio`/`cantidadPersonas` get the friendly Spanish message, not Zod's generic one | ✓ VERIFIED | Spot-check test written and run against `esquemaReserva` in this session (`precio: "abc"` → "El precio tiene que ser mayor a cero."; `detalle.cantidadPersonas: "abc"` → "Escribe cuántas personas viajan (de 1 a 50)."), both passed, then removed — not a permanent regression test in the suite |
| 10 | Code-review fix WR-01: `AvisoToast` shows a distinct toast for every new `aviso` value across sequential redirects in one browser session (not just the first ever) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Fix present and wired (`components/aviso-toast.tsx` no longer has the session-lifetime `useRef` guard; commit `4985466`) — see behavior_unverified_items |

**Score:** 9/10 truths verified (1 present, behavior-unverified)

### Required Artifacts

All 26 artifacts declared across the 5 plans' `must_haves.artifacts` exist, are substantive (no stub bodies), and are wired into the app. Spot-checked at all three levels (exists/substantive/wired):

| Artifact | Expected | Status |
|----------|----------|--------|
| `supabase/migrations/20260929012532_pagador_viajero_reservas.sql` | Additive schema (nullable `cliente_id`, pagador/viajero columns, CHECK constraints) | ✓ VERIFIED |
| `lib/validation/reservas.ts` | Shared zod contract (create + edit) | ✓ VERIFIED |
| `app/admin/reservas/actions.ts` | `crearReserva`, `editarReserva` Server Actions | ✓ VERIFIED |
| `app/admin/reservas/reserva-form.tsx` | Full 4-type form, crear/editar modes, provider-status section | ✓ VERIFIED |
| `app/admin/reservas/nueva/page.tsx`, `app/admin/reservas/[id]/editar/page.tsx` | Admin-guarded create/edit pages | ✓ VERIFIED |
| `app/admin/page.tsx` | Reservas list host page, `searchParams` wired to filters | ✓ VERIFIED |
| `lib/reservas/listar.ts`, `lib/reservas/parametros-lista.ts` | Filtered/paginated query + sanitized query params | ✓ VERIFIED |
| `app/admin/reservas/lista-reservas.tsx`, `filtros-reservas.tsx` | List rendering + filter bar | ✓ VERIFIED |
| `components/aviso-toast.tsx` | Toast dictionary + display logic | ✓ VERIFIED (see truth #10 above for the one unverified behavior) |
| Test files (`tests/rls/*`, `tests/e2e/*`, `tests/validation/*`) | Regression coverage per plan | ✓ VERIFIED — re-ran the ones covering all 4 roadmap SCs myself this session; all green |

### Key Link Verification

| From | To | Via | Status |
|------|-----|-----|--------|
| `app/admin/reservas/actions.ts` | `lib/auth/require-admin.ts` | `await requireAdmin()` first statement, both actions | ✓ WIRED |
| `app/admin/reservas/actions.ts` | `lib/validation/reservas.ts` | `esquemaReserva.safeParse` / `esquemaEdicionReserva.safeParse` | ✓ WIRED |
| `app/admin/reservas/actions.ts` | `public.reservas` | `.from("reservas").insert(...)` / `.update(...)` | ✓ WIRED |
| `app/admin/reservas/reserva-form.tsx` | `lib/validation/reservas.ts` | `zodResolver(esquemaReserva \| esquemaEdicionReserva)` | ✓ WIRED |
| `app/admin/reservas/[id]/editar/page.tsx` | `app/admin/reservas/actions.ts` | `editarReserva.bind(null, id)` | ✓ WIRED |
| `app/admin/page.tsx` | `lib/reservas/parametros-lista.ts` | `leerParametrosLista(await searchParams)` | ✓ WIRED |
| `lib/reservas/listar.ts` | `public.reservas` / `public.pagos` | `.ilike("pagador_nombre", ...)`, `.eq(...)`, second query for `pagado` | ✓ WIRED |

### Behavioral Spot-Checks (run this session)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Zod unit suite | `npx vitest run --project unit` | 31/31 passed | ✓ PASS |
| Create tracer + full 4-type form (no-JS server path) | `npx vitest run --project e2e tests/e2e/reservas-crear.test.ts` | 15/15 passed | ✓ PASS |
| Edit + provider status independence (no-JS server path) | `npx vitest run --project e2e tests/e2e/reservas-editar.test.ts` | 12/12 passed | ✓ PASS |
| List, filters, pagination (no-JS server path) | `npx vitest run --project e2e tests/e2e/reservas-lista.test.ts` | 8/8 passed | ✓ PASS |
| RLS isolation for no-account reservas | `npx vitest run --project db tests/rls/reservas-sin-cuenta.test.ts` | 10/10 passed | ✓ PASS |
| List query (order, Pagado rule, customer isolation, search/filter) | `npx vitest run --project db tests/rls/lista-reservas.test.ts` | 7/7 passed | ✓ PASS |
| Phase 1 contract regression | `npx vitest run --project e2e tests/e2e/admin-login.test.ts tests/e2e/admin-access.test.ts` | 13/13 passed | ✓ PASS |
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Lint | `npm run lint` | exit 0, no findings | ✓ PASS |
| Production build | `npm run build` | compiled successfully; `/admin`, `/admin/reservas/nueva`, `/admin/reservas/[id]/editar` all registered as dynamic routes | ✓ PASS |
| WR-02 regression (non-numeric precio/cantidadPersonas) | scratch vitest spec against `esquemaReserva`, written and removed this session | 2/2 passed, correct Spanish messages | ✓ PASS |
| Combined `npm test` (all projects, one run) | not re-attempted this session | — | ? SKIP — see human_verification (shared Supabase Auth rate limit; every project verified green individually instead) |

I did not run the full `npm test` in one shot: the shared hosted Supabase project's Auth sign-in rate limit is documented across three plans this same milestone day (02-02, 02-04, 02-05 SUMMARYs) as a structural, volume-triggered limitation, and re-attempting a full combined run risked reproducing it for no new evidence beyond what running each project individually already proved. Every individual project (unit, the three phase e2e files, the two phase db files, plus a Phase 1 regression pair) ran green in this session.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| RESA-01 | 02-01, 02-03 | Admin creates a reserva (4 types, price, currency) | ✓ SATISFIED | Truth #1 |
| RESA-02 | 02-04 | Admin edits any field of a reserva | ✓ SATISFIED | Truth #2 |
| RESA-03 | 02-01, 02-02, 02-05 | Admin sees the full list with status, searchable/filterable | ✓ SATISFIED | Truth #3 |
| RESA-04 | 02-04 | Admin marks provider status independently of payment | ✓ SATISFIED | Truth #4 |

No orphaned requirements: `.planning/REQUIREMENTS.md` maps only RESA-01..04 to Phase 2, and all four are declared across the phase's plans.

### Anti-Patterns Found

No blocker or warning anti-patterns in the phase's modified files. `grep`-scanned every file this phase created/modified for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" — zero matches.

`02-REVIEW.md` (phase-level cross-plan code review, 2026-09-29) recorded 0 critical, 3 warning, 1 info findings:

- **WR-01** (AvisoToast session-persistence bug) — **fixed**, verified present in current code (see truth #10; the fix itself is unverified by an automated test, hence the behavior_unverified flag, not a gap)
- **WR-02** (non-numeric precio/cantidadPersonas generic message) — **fixed**, verified present and behaviorally correct this session (truth #9)
- **WR-03** (resolver type-cast removes compiler drift-check) — **accepted as-is**, documented in `02-REVIEW.md` with the reviewer's own reasoning ("no change needed today... consider narrowing the blast radius" as a future nice-to-have, not a required fix); confirmed the underlying assumption (`esquemaEdicionReserva` is `esquemaReservaBase.extend(...)`, a strict superset) still holds by reading `lib/validation/reservas.ts` directly
- **IN-01** (`erroresPorCampo` drops path-less issues) — **accepted as-is**, documented in `02-REVIEW.md` as "not currently reachable given today's schemas"; confirmed by reading the file that every `superRefine`/discriminated-union issue still specifies a non-empty path

Both accepted-as-is findings are documented with their acceptance reasoning inline in `02-REVIEW.md` itself (in-line "Fix: No change needed today, but..." / rationale text) rather than in a separate acceptance log — this satisfies "documented" but there is no standalone sign-off record (e.g. in STATE.md) beyond the review report. Not flagged as a gap since the review's own text already constitutes the disposition record for a `standard`-depth review with only warning/info findings.

### Human Verification Required

7 items need human testing before this phase can be treated as fully closed — 5 are JavaScript-on visual/interaction checks the project's no-browser-automation stack (FA-12) cannot exercise, 1 is the specific state-transition behavior the WR-01 fix addresses, and 1 is running the full combined test suite once outside the current rate-limit window. See the `human_verification` and `behavior_unverified_items` frontmatter for full detail on each. Summary:

1. **Brand identity + first toast** (visual, phone + computer)
2. **List focal point, responsive table/cards, D-09/FA-6 rules, skeleton** (visual, phone + computer)
3. **Full 4-type create form, JS-on validation, group fields** (visual/interaction, phone)
4. **Edit flow: provider-status radio, mandatory con_problema note, toasts** (visual/interaction, phone)
5. **Search/filter/pagination debounce and states** (visual/interaction, phone)
6. **AvisoToast shows a second, distinct toast in one continuous session** (the WR-01 fix itself — no automated coverage)
7. **One clean combined `npm test` run** once the Supabase Auth rate limit window clears

### Gaps Summary

No gaps. All 4 roadmap Success Criteria are backed by passing, freshly-re-run tests against real code paths (not SUMMARY.md claims taken on faith), every declared artifact exists/is substantive/is wired, every prohibition holds under a fresh grep, and both code-review fixes (WR-01, WR-02) are present in the current code — one of them (WR-02) was additionally spot-check-tested behaviorally in this session, and the other (WR-01) is flagged as behavior-unverified rather than assumed correct, since its own bug class (a state guard silently breaking after the first use) is exactly the kind of thing static analysis cannot catch and no test in this JS-light stack currently exercises. The 5 harvested `<human-check>` items were always deferred to end-of-phase per this project's `workflow.human_verify_mode: end-of-phase` convention (not skipped) and are being surfaced now, per that same convention. The one unresolved test-environment item (a single combined `npm test` run) is honestly a known, structural, non-code limitation already documented across three separate plan SUMMARYs this milestone day.

---

*Verified: 2026-09-29T12:10:22Z*
*Verifier: Claude (gsd-verifier)*
