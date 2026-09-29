---
phase: 02-gesti-n-de-reservas-admin
plan: 05
subsystem: ui
tags: [zod, supabase, postgrest, search, pagination]

requires:
  - phase: 02-gesti-n-de-reservas-admin
    provides: listarReservas, ListaReservas, admin page (02-02)
provides:
  - Sanitized query-param parsing for search/filter/pagination (never reaches PostgREST unescaped)
  - Filtered, paginated listarReservas with clamped out-of-range pages
  - Filter bar (search + status + type) that works with JavaScript disabled
affects: []

actuals:
  tokens: 145000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Count-then-range query pattern: fetch an exact count with a head-only query first, clamp the requested page against it, then run exactly one ranged query — PostgREST rejects an out-of-range .range() outright (PGRST103) rather than returning an empty page, so clamping must happen before the ranged query, never as a retry after it fails"
    - ".find(...) instead of (arr as readonly string[]).includes(...) + cast — validates untrusted input against an enum array and returns the typed member directly, with no type assertion needed on either side"

key-files:
  created:
    - lib/reservas/parametros-lista.ts
    - app/admin/reservas/filtros-reservas.tsx
    - tests/validation/parametros-lista.test.ts
  modified:
    - lib/reservas/listar.ts
    - app/admin/reservas/lista-reservas.tsx
    - app/admin/page.tsx
    - tests/rls/lista-reservas.test.ts
    - tests/e2e/reservas-lista.test.ts

key-decisions:
  - "Both tasks committed together — Task 2's filter bar and pagination links are direct consumers of Task 1's parametrosAQuery/ParametrosLista contract, and splitting after review would have misrepresented what changed together"
  - "Rewrote listarReservas's pagination from retry-after-error to count-first-then-range after finding the retry approach could never actually trigger (a real bug, see Deviations)"
  - "escaparPatronLike strips * (PostgREST's own wildcard, which has no escape) and backslash-escapes %, _ and \\ — matches the plan's explicit spec rather than a generic SQL-LIKE escaper"

patterns-established:
  - "Count-then-range pagination is now the house pattern for any future paginated Supabase query in this codebase — the naive range-then-retry approach silently fails on PostgREST"

requirements-completed: [RESA-03]

coverage:
  - id: D1
    description: "Search by payer name (case-insensitive, literal wildcards), filter by provider status and type, combined; 20 per page; Anterior/Siguiente preserve filters; out-of-range pages clamp to the last real page"
    requirement: RESA-03
    verification:
      - kind: unit
        ref: "tests/validation/parametros-lista.test.ts (7 tests)"
        status: pass
      - kind: integration
        ref: "tests/rls/lista-reservas.test.ts (7 tests, includes the 21-fixture pagination/clamp proof)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/reservas-lista.test.ts (8 tests, no-JS filter/pagination/tampered-params proof)"
        status: pass
    human_judgment: true
    rationale: "Plan's human-check requires visual confirmation of debounced typing, the Radix selects, and the loading skeleton transition — all JS-on interactions the automated no-JS tests don't execute. Deferred to end-of-phase UAT."
  - id: D2
    description: "Full combined test suite (unit + db + e2e, all projects) green at phase end"
    verification:
      - kind: other
        ref: "npm test — blocked by a same-day Supabase Auth rate limit from cumulative testing across this phase's plans, not a code defect (see Deviations for the isolation evidence)"
        status: unknown
    human_judgment: true
    rationale: "Every individual piece this plan touches was verified green in isolation (see D1's verification list, plus build/lint/tsc). The combined npm test run — which signs in dozens of fresh test users across every e2e/db file in the repo, not just this plan's — could not complete without hitting Supabase's Auth rate limit. Re-run npm test once the rate limit window clears to close this out formally before shipping."

duration: 1h30min
completed: 2026-09-29
status: complete
---

# Phase 02 Plan 05: Search, Filters, Pagination Summary

**Case-insensitive name search with literal-wildcard escaping, provider-status/type filters, and Anterior/Siguiente pagination — all working with JavaScript disabled, plus a real out-of-range pagination bug found and fixed in review**

## Performance

- **Duration:** ~1h30min (includes ~25 min of Supabase Auth rate-limit cooldown waits)
- **Started:** 2026-09-29T07:05:00Z (approx)
- **Completed:** 2026-09-29T08:35:00Z (approx)
- **Tasks:** 2
- **Files modified:** 8 (3 created)

## Accomplishments
- `lib/reservas/parametros-lista.ts`: sanitizes raw `searchParams` into a typed `ParametrosLista` — unknown `estado`/`tipo` values dropped, `q` trimmed and capped at 100 chars, `pagina` clamped to 1..10000 — and provides `parametrosAQuery`/`hayFiltros`/`escaparPatronLike` for the rest of the feature to build on
- `listarReservas` extended with name search (`.ilike`, escaped) and status/type filters (`.eq`), with zero string-built PostgREST filters (`.or()`/`.filter()`) anywhere — the search text only ever flows through parameterized filter calls
- `filtros-reservas.tsx`: a real `<form method="get" role="search">` so pressing Enter works with JavaScript off (hidden inputs carry the current estado/tipo through that GET), with debounced `router.replace` as the JS-on enhancement
- `lista-reservas.tsx`: a distinct filtered-empty state ("No hay reservas que coincidan"), a "Reintentar" link that preserves the active filters, and Anterior/Siguiente pagination (disabled + `aria-disabled`, no `href`, at the ends)
- **Real bug found and fixed in review:** PostgREST rejects an out-of-range `.range()` outright instead of returning an empty page, so a page number far past the real last page (e.g. `?pagina=99` with only 1 real page) threw an error instead of clamping — exactly the behavior the plan's own test cases require. Rewrote `listarReservas` to count first, clamp against that count, then run one ranged query, guaranteeing the range is always valid.

## Task Commits

Both tasks landed in one commit (interdependent — see Decisions Made):

1. **Both tasks: safe params/query + filter bar/pagination UI** - `94558a8` (feat) — Codex implementation, Claude-reviewed and fixed (a real pagination bug, two test-fixture DB-constraint violations, and anti-slop type-assertion cleanup)

_Note: Codex's sandbox again had no git-write/network access; Claude ran and verified every individual test file, build, and lint before committing._

## Files Created/Modified
- `lib/reservas/parametros-lista.ts` - `leerParametrosLista`, `hayFiltros`, `parametrosAQuery`, `escaparPatronLike`, `ParametrosLista`
- `lib/reservas/listar.ts` - Search/filter/pagination on `listarReservas`, count-first clamping
- `app/admin/reservas/filtros-reservas.tsx` - Filter bar (search + status + type Selects, "Quitar filtros")
- `app/admin/reservas/lista-reservas.tsx` - Filtered-empty state, preserved-filter retry, pagination nav
- `app/admin/page.tsx` - Reads `searchParams`, renders `FiltrosReservas`, keys the list Suspense by the query
- `tests/validation/parametros-lista.test.ts` - 7 unit cases (sanitizing, escaping, query building)
- `tests/rls/lista-reservas.test.ts` - Extended with search/filter/pagination/clamp db proof
- `tests/e2e/reservas-lista.test.ts` - Extended with filter, filtered-empty, tampered-params, pagination cases

## Decisions Made
- Count-then-range instead of range-then-retry for pagination — the retry approach silently could never trigger, since the first (out-of-range) query itself errors rather than returning a usable count
- `.find(...)` instead of `(arr as readonly string[]).includes(...)` + a narrowing cast, in both `parametros-lista.ts` and `filtros-reservas.tsx` — removes every type assertion from the new code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, blocking] Out-of-range page number threw instead of clamping**
- **Found during:** Running `tests/rls/lista-reservas.test.ts` myself — Codex's sandbox couldn't run db tests at all, so it never caught this
- **Issue:** `listarReservas`'s original clamping logic ran the ranged query first and only retried-with-clamping if that first query succeeded with `count > 0` — but PostgREST's `.range()` returns an actual error (`PGRST103`, "Requested range not satisfiable") for a genuinely out-of-range offset, not an empty success. So `?pagina=99` against 1 real page threw instead of clamping to page 1, directly contradicting the plan's `<behavior>` spec ("page 99 is clamped to page 2" in the analogous 21-fixture case)
- **Fix:** Rewrote to fetch an exact count first (`.select("id", { count: "exact", head: true })`, no range), clamp the requested page against `Math.ceil(count / TAMANO_PAGINA)`, then run exactly one ranged data query — the range is now always valid by construction
- **Files modified:** `lib/reservas/listar.ts`
- **Verification:** `tests/rls/lista-reservas.test.ts` (7/7, including the specific clamp assertion that first caught this)
- **Committed in:** `94558a8`

**2. [Rule 1 - Bug, test-only] Two fixtures violated the con_problema DB constraint**
- **Found during:** Running `tests/rls/lista-reservas.test.ts` myself
- **Issue:** Two `createReservaSinCuentaFixture(...)` calls set `estadoProveedor: "con_problema"` without `notaProblema`, violating the `reservas_nota_problema_si_con_problema` check constraint from 02-01 — again, something only a real database connection (unavailable to Codex) could catch
- **Fix:** Added a `notaProblema` string to both fixture calls
- **Files modified:** `tests/rls/lista-reservas.test.ts`
- **Committed in:** `94558a8`

**3. [Rule 2 - Missing critical, style] Anti-slop type-assertion violations**
- **Found during:** Running `npx oxlint -c .oxlintrc.json` myself
- **Issue:** Four unjustified type assertions (`(ESTADOS_PROVEEDOR as readonly string[]).includes(...)` + a cast-back, twice each, in `parametros-lista.ts` and `filtros-reservas.tsx`)
- **Fix:** Replaced all four with `.find((valor) => valor === x)`, which returns the correctly-typed enum member (or `undefined`) with no cast on either side
- **Files modified:** `lib/reservas/parametros-lista.ts`, `app/admin/reservas/filtros-reservas.tsx`
- **Committed in:** `94558a8`

**4. [Environment, unresolved] Combined `npm test` could not be verified green**
- **Found during:** Final phase-end verification pass
- **Issue:** `npm test` runs every unit/db/e2e file in the repo — dozens of fresh test-user sign-ins across files this plan never touched (e.g. `admin-access.test.ts` from Phase 1). After heavy same-day testing across plans 02-02 through 02-05, this hit a Supabase Auth rate limit that a ~25-minute combined wait did not clear
- **What was verified instead, all in isolation and all green:** `npx tsc --noEmit`, `npm run lint`, `npx oxlint -c .oxlintrc.json` (anti-slop), `npm run build`, `npx vitest run --project unit` (31/31), `npx vitest run --project db tests/rls/lista-reservas.test.ts` (7/7), `npx vitest run --project e2e tests/e2e/reservas-lista.test.ts` (8/8). A single isolated `/login` request (outside the test harness) also succeeded normally (303 redirect), confirming this is sign-in volume exhaustion, not a login regression.
- **Not fixed — flagged instead:** re-run `npm test` once the Supabase Auth rate limit window clears, to formally close this plan's own acceptance criterion before treating the phase as fully shippable
- **Impact:** Low confidence risk — every piece of code this plan added or changed was independently exercised and passed; the only unverified thing is cross-file interaction with parts of the app this plan never touched, which is unlikely to be affected

---

**Total deviations:** 4 (2 real bugs, 1 style, 1 unresolved environment blocker)
**Impact on plan:** No scope creep. The pagination bug was a genuine correctness issue this plan's own test suite was designed to catch and did catch (once run against a real database, which Codex's sandbox cannot do). The `npm test` gap is honestly flagged rather than silently claimed green.

## Issues Encountered
- Supabase Auth sign-in rate limit, now observed across three consecutive plans this same day (02-02, 02-04, 02-05) — worth raising with the project owner as a testing-workflow concern (e.g. spacing out full-suite runs, or a higher-tier Supabase plan) rather than something to keep working around plan-by-plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RESA-03 complete. All four Phase 2 requirements (RESA-01 through RESA-04) are now done.
- **Before treating Phase 2 as fully shippable:** re-run `npm test` (full suite) once the Supabase Auth rate limit clears, to confirm no cross-file regression outside what this plan's isolated verification already covered.
- Carried-over known limitation (not re-verified here): a failed no-JS resubmission on the create/edit form loses in-progress typing (documented in 02-03-SUMMARY) — doesn't affect this plan's GET-only filter bar.

---
*Phase: 02-gesti-n-de-reservas-admin*
*Completed: 2026-09-29*
