---
phase: 02-gesti-n-de-reservas-admin
plan: 04
subsystem: ui
tags: [zod, react-hook-form, shadcn, next-server-actions, radio-group]

requires:
  - phase: 02-gesti-n-de-reservas-admin
    provides: ReservaForm(modo, accion, valoresIniciales), esquemaReserva, crearReserva pattern, mensajeCampo no-JS-safe error rendering (02-03)
provides:
  - Edit page /admin/reservas/[id]/editar with 404/access-control/preload
  - editarReserva Server Action (whitelist update, never touches ownership columns)
  - Provider-status schema and RadioGroup section, independent of pagos
affects: [02-05]

actuals:
  tokens: 155000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Shared-base zod schemas: esquemaReservaBase + refinarReserva()/refinarEstadoProveedor() composed into esquemaReserva (create) and esquemaEdicionReserva (edit) so no validation rule is duplicated or can drift between the two"
    - "z.record(z.string(), z.unknown()).catch({}) to parse an untyped jsonb DB column at its read boundary, instead of a typeof-narrowed cast"

key-files:
  created:
    - "app/admin/reservas/[id]/editar/page.tsx"
    - tests/e2e/reservas-editar.test.ts
  modified:
    - app/admin/reservas/actions.ts
    - app/admin/reservas/reserva-form.tsx
    - lib/validation/reservas.ts
    - tests/validation/reservas.test.ts

key-decisions:
  - "Both tasks committed together (not split) — they share reserva-form.tsx and lib/validation/reservas.ts so densely that an artificial split after Claude's review pass would have been less honest than one commit describing both"
  - "detalle jsonb parsing at the edit page's read boundary uses z.record(...).catch({}) rather than a runtime typeof check, so a legacy/malformed row still opens with defaulted fields without an unjustified type assertion"
  - "fila.tipo resolved via TIPOS_RESERVA.find(...) ?? \"pasaje\" — mirrors the adjacent ESTADOS_PROVEEDOR.find pattern Codex already used, removing a literal-union cast entirely instead of justifying it"

patterns-established:
  - "Codex correctly extended a Claude-authored pattern (mensajeCampo no-JS error rendering) into new form fields on its own from written instructions, without the pattern needing to be re-explained field-by-field"

requirements-completed: [RESA-02, RESA-04]

coverage:
  - id: D1
    description: "Any reserva can be opened from the list with every field preloaded, edited, and saved; unknown/malformed ids 404; only an admin session can reach the page or the action"
    requirement: RESA-02
    verification:
      - kind: e2e
        ref: "tests/e2e/reservas-editar.test.ts (12 tests: preload, save, 404s, access control, cookie-less POST)"
        status: pass
    human_judgment: true
    rationale: "Plan's human-check requires visual confirmation of the JS-on edit flow (field preload rendering, save round-trip, toast). Deferred to end-of-phase UAT per workflow.human_verify_mode."
  - id: D2
    description: "Provider status (pendiente/confirmada/con_problema) set independently of payment, mandatory note for con_problema, correct toast per what changed"
    requirement: RESA-04
    verification:
      - kind: unit
        ref: "tests/validation/reservas.test.ts (9 new provider-status/aviso cases, 24/24 total)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/reservas-editar.test.ts (status-change + pagos-independence + mandatory-note cases)"
        status: pass
    human_judgment: true
    rationale: "Plan's human-check requires visual confirmation of the RadioGroup/Textarea interaction and toast copy in the browser with JS on."

duration: 2h5min
completed: 2026-09-29
status: complete
---

# Phase 02 Plan 04: Edit Reserva + Provider Status Summary

**Full edit flow for any reserva (all fields, payer/traveller, group, type) plus an independent provider-status RadioGroup with a mandatory "con problema" note**

## Performance

- **Duration:** ~2h5min (includes a Supabase Auth rate-limit cooldown wait unrelated to the code)
- **Started:** 2026-09-29T02:31:00Z (approx, prior session)
- **Completed:** 2026-09-29T06:58:00Z
- **Tasks:** 2
- **Files modified:** 6 (2 created)

## Accomplishments
- `/admin/reservas/[id]/editar`: admin-guarded, UUID-validated, 404 on any missing/malformed id, every saved field preloaded (payer, traveller, type + its details, group, price, currency, important date, provider status)
- `editarReserva(id, prev, formData)` Server Action: re-validates the id, updates only the whitelisted columns via the same `filaReservaDesdeDatos`-based mapper the create path uses, never touches `cliente_id`/`created_by`/`created_at`, never reads or writes `pagos`
- "Estado del proveedor" RadioGroup (Pendiente/Confirmada con el proveedor/Con problema) as the first section in edit mode, with a conditional "¿Qué pasó?" Textarea mandatory for `con_problema` (backed by the existing DB check from 02-01) and cleared automatically when the status moves away from it
- `avisoTrasEditar()` picks the exact toast for what changed (`confirmada`/`problema`/`guardada`), and the new fields fully reuse 02-03's `mensajeCampo()` no-JS-safe error-rendering pattern — Codex extended it correctly to the new controls from written instructions alone

## Task Commits

Both tasks landed in one commit (see Decisions Made for why):

1. **Both tasks: edit page/action + provider status** - `b4c4388` (feat) — Codex implementation, Claude-reviewed and fixed (anti-slop: replaced a `typeof`-narrowed jsonb cast with `z.record(...).catch({})`, replaced an unjustified `tipo` literal-union cast with `TIPOS_RESERVA.find(...)`, added the one genuinely-necessary `SAFETY:` comment for the create/edit resolver type)

_Note: Codex's sandbox again had no git-write/network access; Claude ran and verified the full suite (unit, this plan's e2e file, full e2e suite, build, lint, test:db) before committing._

## Files Created/Modified
- `app/admin/reservas/[id]/editar/page.tsx` - Admin-guarded edit page; `valoresDesdeFila` maps a DB row to form defaults
- `app/admin/reservas/actions.ts` - `editarReserva`: id re-validation, whitelist update, aviso selection
- `lib/validation/reservas.ts` - `esquemaEstadoProveedor`, `esquemaEdicionReserva` (shared base with `esquemaReserva`), `filaEdicionDesdeDatos`, `avisoTrasEditar`
- `app/admin/reservas/reserva-form.tsx` - Edit-mode resolver switch, "Estado del proveedor" RadioGroup + conditional Textarea
- `tests/validation/reservas.test.ts` - 9 new unit cases (mandatory note, status-clears-note, invalid/missing status, aviso selection)
- `tests/e2e/reservas-editar.test.ts` - 12 no-JS server-path cases (preload, save, type change, validation, 404s, access control, provider status, pagos independence)

## Decisions Made
- One commit instead of two: Codex's diff for both tasks touches `reserva-form.tsx` and `lib/validation/reservas.ts` so densely (edit-mode wiring and the provider-status section are adjacent, interleaved code) that a post-hoc split after review would have misrepresented what actually changed together
- `z.record(z.string(), z.unknown()).catch({})` for parsing the `detalle` jsonb column at the page's read boundary, instead of a `typeof`-based runtime check — satisfies the anti-slop "parse at the I/O boundary" rule literally rather than working around it
- `TIPOS_RESERVA.find((valor) => valor === fila.tipo) ?? "pasaje"` instead of casting `fila.tipo` to the literal union — mirrors the adjacent `ESTADOS_PROVEEDOR.find` pattern already in the same function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, environment] Codex sandbox lacks git-write and network access**
- **Found during:** Both tasks
- **Issue:** Same as every prior plan this milestone — Codex could self-verify with `tsc`/unit/lint but not commit or run e2e/build
- **Fix:** Claude ran the full verification suite and committed
- **Committed in:** `b4c4388`

**2. [Rule 2 - Missing critical, style] Anti-slop violations left by Codex (all type-assertion-related)**
- **Found during:** Running `npx oxlint -c .oxlintrc.json` myself after Codex's report
- **Issue:** A `typeof`-narrowed cast for the jsonb `detalle` column, an unjustified `tipo` literal-union cast, and an unjustified resolver-type cast
- **Fix:** `z.record(...).catch({})` for the jsonb parse; `TIPOS_RESERVA.find(...)` for `tipo` (removes the assertion entirely); a `SAFETY:` comment for the resolver cast (the one genuinely unavoidable case — RHF's `Resolver<T>` type can't express "validates a strict subset of T")
- **Files modified:** `app/admin/reservas/[id]/editar/page.tsx`, `app/admin/reservas/reserva-form.tsx`
- **Verification:** `npx oxlint -c .oxlintrc.json` clean; `npx tsc --noEmit` clean
- **Committed in:** `b4c4388`

**3. [Environment, non-blocking] Supabase Auth sign-in rate limit during `npm run test:db`**
- **Found during:** Final full-suite verification pass
- **Issue:** `Request rate limit reached` on `signInAs` calls in pre-existing (unrelated) RLS tests, from many same-day test runs across this and the prior two plans
- **Fix:** Waited for the rate limit to cool down (polled every 60s), then re-ran — 42/42 passed with no code changes
- **Impact:** None on shipped code; purely a test-environment throttle, same phenomenon documented in 02-02-SUMMARY

---

**Total deviations:** 3 (1 environment/blocking for Codex, 1 style/missing-critical, 1 environment/non-blocking)
**Impact on plan:** No scope creep. All fixes were required by this project's mandatory anti-slop gate or were pure environment noise unrelated to the code.

## Issues Encountered
None beyond what's documented above as deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RESA-02 and RESA-04 fully delivered. `ReservaForm` now serves both crear and editar modes from one component.
- Ready for Plan 02-05 (search, filters, pagination on the list) — no known blockers.
- Carried-over known limitation from 02-03 (not re-verified here, same root cause): a failed no-JS resubmission loses in-progress edits since `defaultValues` don't reflect the just-submitted values — low real-world impact, the admin always has JS.

---
*Phase: 02-gesti-n-de-reservas-admin*
*Completed: 2026-09-29*
