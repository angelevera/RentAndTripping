---
phase: 02-gesti-n-de-reservas-admin
plan: "02"
subsystem: ui
tags: [shadcn, tailwind, next-font, sonner, radix-ui, supabase, postgrest, oxlint]

# Dependency graph
requires:
  - phase: 02-gesti-n-de-reservas-admin (plan 02-01)
    provides: "pagador_nombre/telefono/email + viajero_nombre/telefono columns, ETIQUETAS_TIPO/ETIQUETAS_ESTADO_PROVEEDOR, tests/helpers/fixtures.ts createReservaSinCuentaFixture/createPagoFixture, the /admin?aviso=creada redirect"
provides:
  - "shadcn/ui installed (radix base, Nova preset, CSS variables) with the human-approved package set and no unapproved dependency"
  - "Brand theme (Poppins/Inter, #482583 primary, UI-SPEC token table) applied to every shadcn component going forward"
  - "Fixed aviso-toast dictionary (creada/guardada/confirmada/problema) wired into the root layout"
  - "lib/reservas/listar.ts: listarReservas(supabase, {pagina}) — the paginated, RLS-respecting query every later list/filter plan builds on"
  - "app/admin/reservas/lista-reservas.tsx: table+card list with status badges, empty/error/skeleton states"
affects: [02-03-formulario-reserva, 02-04-editar-reserva-y-confirmar-pago, 02-05-filtros-y-paginacion]

# Actuals (#2632)
actuals:
  tokens: 18014
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: [shadcn@4.21.0 (CLI), radix-ui@1.6.7, class-variance-authority@0.7.1, cn@0.4.0, tw-animate-css@1.4.0, lucide-react@1.48.0, sonner@2.0.8, next-themes@0.4.6]
  patterns:
    - "listarReservas(supabase, opts) takes the client as a parameter (no 'server-only') so RLS db tests and the Server Component can both call the exact same function"
    - "Badge color mapped through a tiny pure helper (claseBadgeProveedor/BadgePago) instead of inline ternaries in JSX"
    - "aviso query-param -> fixed toast dictionary -> router.replace to strip the param, guarded by a ref against the dev double-effect"
    - "Table (hidden sm:block) and Card (sm:hidden) render the SAME data in the SAME server pass; the switch is CSS-only, never two data fetches"

key-files:
  created:
    - components.json
    - lib/utils.ts
    - "components/ui/{alert,badge,button,card,checkbox,field,input,label,radio-group,select,separator,skeleton,sonner,table,textarea}.tsx"
    - components/aviso-toast.tsx
    - lib/reservas/listar.ts
    - app/admin/reservas/lista-reservas.tsx
    - tests/rls/lista-reservas.test.ts
    - tests/e2e/reservas-lista.test.ts
  modified:
    - package.json
    - package-lock.json
    - app/globals.css
    - app/layout.tsx
    - app/admin/page.tsx

key-decisions:
  - "shadcn 4.21.0 requires a --preset selection (a new gate the 2026-09-28 UI-SPEC research didn't hit); chose 'nova' because it's the only preset whose default package set matches the Task 1 human-approved list exactly (radix-ui, cva, cn, tw-animate-css, lucide-react) — then overrode every one of its theme tokens per the UI-SPEC table, so the shipped visual theme is 100% brand, not Nova's neutral defaults"
  - "Installed field.tsx instead of the plan's form.tsx: shadcn 4.21.0's 'radix-nova' style ships 'form' as an empty registry stub (confirmed against the live ui.shadcn.com/r/styles/radix-nova/form.json — no files, no deps). 'field' is the current react-hook-form wrapper for this preset generation and needs no package outside the Task 1 approval (only registryDependencies: label, separator, both already installed)"
  - "VES reservations never render a computed USD figure — the Monto column shows the link 'En Bs · ver detalle' to the edit page instead (D-09); enforced by a grep gate (no tasa/cambio/convert in the list's code) in addition to the e2e test"

requirements-completed: [RESA-03]

coverage:
  - id: D1
    description: "Every package the shadcn install added to package.json was the one a human approved at the Task 1 gate, at the exact approved version"
    requirement: RESA-03
    verification:
      - kind: other
        ref: "git diff bc223f4 -- package.json (manual diff review, this SUMMARY's package table)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Brand theme tokens (colors, radius) applied to every shadcn CSS variable, replacing the default oklch grey/blue theme"
    requirement: RESA-03
    verification:
      - kind: other
        ref: "grep -ciE against app/globals.css for --primary:#482583, --radius:0.75rem, #7E66A8, 17px body, :focus-visible (all >=1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Poppins/Inter fonts render correctly and the four aviso toasts appear/disappear with the exact UI-SPEC copy, on phone and computer"
    verification: []
    human_judgment: true
    rationale: "Typography rendering and toast appearance/timing are visual — grep can confirm the strings and CSS variables exist, not what the owner actually sees on screen. Deferred to end-of-phase human verification per workflow.human_verify_mode=end-of-phase."
  - id: D4
    description: "listarReservas returns the newest-first page with the correct pagado derivation (a pago with estado=confirmado), isolates customers via RLS, and fails safely on a broken client"
    requirement: RESA-03
    verification:
      - kind: integration
        ref: "tests/rls/lista-reservas.test.ts#listarReservas (5 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The rendered /admin list shows the six D-08 columns, badges first, newest-first ordering, dd/mm/yyyy dates, and never a computed VES->USD amount"
    requirement: RESA-03
    verification:
      - kind: e2e
        ref: "tests/e2e/reservas-lista.test.ts (5 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Empty, loading (skeleton) and error states render with the exact UI-SPEC copy and no interactive skeleton content"
    verification:
      - kind: other
        ref: "grep -c against app/admin/reservas/lista-reservas.tsx for the four state strings (Copywriting Contract) — all present"
        status: pass
    human_judgment: true
    rationale: "The grep proves the copy exists in the component; no automated test currently drives the app to an actually-empty or actually-erroring database state to prove the branch renders live. Recommended as a human/UAT check at end-of-phase."

duration: ~30min (this continuation session; excludes the prior session that reached the Task 1 checkpoint)
completed: 2026-09-29
status: complete
---

# Phase 02 Plan 02: Brand shadcn/ui + Reservas List Summary

**shadcn/ui installed under the human-approved package list (Nova preset, brand tokens overriding every default), Poppins/Inter + aviso toasts wired into the layout, and a badge-first table/card reservas list backed by a new `listarReservas` query with RLS-proven customer isolation and honest bolívar handling.**

## Performance

- **Duration:** ~30 min (this continuation session)
- **Tasks:** 3 (Task 1 checkpoint approved in a prior session; Tasks 2-3 executed in this session)
- **Files modified:** 27 (22 in Task 2's commit, 5 in Task 3's commit — package-lock.json and 15 generated shadcn component files account for most of the diff volume)

## Accomplishments

- shadcn/ui initialized (`npx shadcn@4.21.0 init --template next --base radix --css-variables --no-monorepo --preset nova`) and 15 components added, with the resulting `package.json` diff matching the Task 1 human approval exactly — no unapproved dependency
- Brand identity now lives in every shadcn CSS variable: `#482583` primary, `0.75rem` radius, the `#7E66A8` soft accent, Poppins 700 for `font-display`, Inter 400/600 for body — the shadcn default theme was never left in place
- `components/aviso-toast.tsx`: the four-key `AVISOS` dictionary drives a `toast.success(...)` once per redirect, then strips `?aviso=` from the URL without touching any other query param
- `lib/reservas/listar.ts`: a plain function (no `"server-only"`) that pages reservas newest-first and derives `pagado` from a second, narrow query against `pagos` (only `reserva_id` where `estado = 'confirmado'`) — proven against a signed-in admin, a signed-in customer, and a client with an invalid API key
- `app/admin/reservas/lista-reservas.tsx` + updated `app/admin/page.tsx`: the Fase 1 placeholder list is replaced by a table (>=640px) and card (<640px) view of the same data, badges first, VES reservations showing "En Bs · ver detalle" instead of any computed amount

## Task Commits

1. **Task 1: Package legitimacy gate** — human-approved in a prior session (no commit; the gate itself installs nothing)
2. **Task 2: shadcn/ui with brand tokens, Poppins + Inter, and toasts** — `4aed10b` (feat)
3. **Task 3: Reservas list — badges, table/cards, empty/loading/error states** — `7b82d25` (feat, tdd)

**Plan metadata:** pending (this commit, made right after this SUMMARY)

## Files Created/Modified

- `components.json` — shadcn configuration (style: radix-nova, base: radix, cssVariables: true)
- `lib/utils.ts` — generated `cn` re-export
- `components/ui/{alert,badge,button,card,checkbox,field,input,label,radio-group,select,separator,skeleton,sonner,table,textarea}.tsx` — the 15 installed components (`field` in place of the plan's `form` — see Deviations)
- `app/globals.css` — shadcn variables overridden with the brand token table; kept the Fase 1 17px body/line-height/`:focus-visible`; added `--color-marca-hover/-activo/-suave` and `--font-display`
- `app/layout.tsx` — Poppins 700 + Inter 400/600 via `next/font/google`, header widened to `max-w-5xl`, `<Toaster>` + Suspense-wrapped `<AvisoToast>`
- `components/aviso-toast.tsx` — fixed `AVISOS` dictionary + `AvisoToast` client component
- `lib/reservas/listar.ts` — `TAMANO_PAGINA`, `FilaListaReserva`, `listarReservas`
- `app/admin/reservas/lista-reservas.tsx` — `ListaReservas`, `ListaReservasSkeleton`
- `app/admin/page.tsx` — header + pill "Crear reserva" + Suspense-wrapped list, `panel-admin`/email/`form-cerrar-sesion` kept
- `tests/rls/lista-reservas.test.ts`, `tests/e2e/reservas-lista.test.ts` — new TDD coverage for Task 3

## Package Approval Table (Task 1, cross-checked against the installed package.json)

| Package | Approved version | Installed version | Repository |
|---|---|---|---|
| shadcn (CLI) | 4.21.0 (pinned) | ^4.21.0 | github.com/shadcn-ui/ui |
| radix-ui | — | ^1.6.7 | github.com/radix-ui/primitives |
| class-variance-authority | — | ^0.7.1 | github.com/joe-bell/cva |
| cn | — | ^0.4.0 | github.com/shadcn-ui/cn |
| tw-animate-css | — | ^1.4.0 | github.com/Wombosvideo/tw-animate-css |
| lucide-react | — | ^1.48.0 | github.com/lucide-icons/lucide |
| sonner | — | ^2.0.8 | github.com/emilkowalski/sonner |
| next-themes | — | ^0.4.6 | github.com/pacocoursey/next-themes |
| clsx / tailwind-merge | conditional (only if CLI didn't use `cn`) | not installed | n/a — the CLI used `cn`, as anticipated |

`git diff bc223f4 -- package.json` contains exactly these eight names — no other dependency was added by either the `init` or the `add` commands.

## `npx shadcn info` Enumeration (UI-SPEC Dimension 7)

```
Configuration: style=radix-nova, base=radix, iconLibrary=lucide, rsc=yes, typescript=yes
Installed Components: alert, badge, button, card, checkbox, field, input, label,
  radio-group, select, separator, skeleton, sonner, table, textarea
```

## Decisions Made

- Chose the `nova` preset for `shadcn init` (mandatory in 4.21.0, not anticipated by the 2026-09-28 UI-SPEC research) because its default package set is the only one of the eight offered presets that matches the Task 1 approval exactly.
- Installed `field.tsx` instead of the plan's `form.tsx` — `form` is a non-functional stub under this style/version (see Deviations). No package-approval impact.
- Kept the `.dark` CSS block shadcn generated even though the app has no dark-mode toggle — harmless (no `dark` class is ever applied), and removing it would be unnecessary scope creep for an MVP with no dark-mode requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `shadcn@4.21.0 init` requires a `--preset` selection that didn't exist when the UI-SPEC was researched**
- **Found during:** Task 2, running the prescribed `npx shadcn@latest init --template next --base radix --css-variables --no-monorepo` command
- **Issue:** The command hung on an interactive preset picker (Nova/Vega/Maia/Lyra/Mira/Luma/Sera/Rhea/Custom) that `-y`/`--defaults` don't skip in this CLI version; `--preset custom` doesn't exist (only the eight named presets are valid `--preset` values)
- **Fix:** Ran with `--preset nova` — verified via `npx shadcn@4.21.0 info` and a `package.json` diff that Nova's default dependencies are exactly {radix-ui, class-variance-authority, cn, tw-animate-css, lucide-react} + {sonner, next-themes} once `sonner` was added — matching the Task 1 approval with no substitution needed
- **Files modified:** package.json, package-lock.json, components.json, app/globals.css, app/layout.tsx (all then further edited per Task 2's own brand-token/font instructions)
- **Verification:** `git diff bc223f4 -- package.json` lists only approved names; `npm run build`/`lint`/`tsc --noEmit` clean
- **Committed in:** `4aed10b` (Task 2 commit)

**2. [Rule 3 - Blocking, live registry discovery] The plan's `form` component is a non-functional stub under the installed style**
- **Found during:** Task 2, running `npx shadcn add ... form ...` — the CLI reported 13 files created (not 14) and silently no-opped on `form`
- **Issue:** Fetching `https://ui.shadcn.com/r/styles/radix-nova/form.json` directly returns `{"name":"form","type":"registry:ui"}` — no `files`, no `dependencies`. shadcn has replaced the classic `form`/`FormField` react-hook-form wrapper with a new `field` primitive (`Field`, `FieldLabel`, `FieldError`, etc.) for the Nova-generation presets; the `new-york-v4` style still ships the old `form`, but `radix-nova` (what components.json now specifies) does not.
- **Fix:** Installed `components/ui/field.tsx` instead (`npx shadcn@4.21.0 add field`). Its `registryDependencies` are `label` and `separator`, both already installed — no package outside the Task 1 approval was added.
- **Files modified:** components/ui/field.tsx (new)
- **Verification:** `npx shadcn info` enumerates `field` among the 15 installed components; `git diff bc223f4 -- package.json` still lists only the approved names
- **Committed in:** `4aed10b` (Task 2 commit)
- **Flagged for the next plan:** whichever plan builds `app/admin/reservas/reserva-form.tsx`'s replacement/successor form should compose `Field`/`FieldLabel`/`FieldError` (already installed), not the classic `Form`/`FormField` the UI-SPEC's Component Inventory table describes by name — the intent (react-hook-form + Zod validation wrapper) is unchanged, only the component names are.

---

**Total deviations:** 2 auto-fixed (both Rule 3 — CLI/registry drift discovered live between the 2026-09-28 research and the same-day execution, not architectural changes; neither touched the Task 1 package approval)
**Impact on plan:** Both auto-fixes were necessary to complete Task 2 at all. No scope creep — the actual UI-SPEC token table, font choices, and copy were followed exactly as written.

## Issues Encountered

- The shared hosted Supabase test project hit its Auth sign-in rate limit partway through this session, after `npm run test:db`/`test:e2e` were run several times in quick succession (my own repeated verification runs, not a code issue). Two unrelated pre-existing test files (`tests/rls/perfiles-rol.test.ts`, `tests/rls/reservas-sin-cuenta.test.ts`) failed with "Request rate limit reached" during one `npm run test:db` run; re-running each in isolation, and the full suite again a few minutes later, passed cleanly (42/42). No code changed to "fix" this — it was purely rate-limit cooldown.
- One `npm run test:e2e` run showed a single unrelated flake in `tests/e2e/admin-login.test.ts` (a file untouched by this plan) — re-running that file alone passed 8/8, and a second full-suite run passed 23/23. Treated as a pre-existing environmental flake, not a regression from this plan's changes (scope boundary: that test/file is outside Task 3's `files_modified`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- shadcn/ui + brand theme + toasts are now in place for every remaining Phase 2 plan (02-03 formulario, 02-04 editar/confirmar pago, 02-05 filtros/paginación) to build on directly — no further design-system setup needed.
- `listarReservas`/`ListaReservas` are built to take a `pagina` prop and no filter yet; 02-05 extends the same function/component with query params per the plan's own note ("Plan 02-05 adds the query parameters and page navigation on top of the same component and function").
- The "Editar" links and the VES "En Bs · ver detalle" link both point to `/admin/reservas/{id}/editar`, which does not exist yet — this is explicit, planned forward-reference to Plan 02-04, not an unplanned stub.
- Outstanding human verification (deferred per `workflow.human_verify_mode: end-of-phase`): the Poppins/Inter/toast visual check from Task 2's `<human-check>`, and a live look at the empty/loading/error list states from Task 3's `<human-check>` (D-09 VES treatment and the FA-6 "Pagado" rule are both called out in the plan as needing the owner's explicit confirmation, not just an automated pass).

---
*Phase: 02-gesti-n-de-reservas-admin*
*Completed: 2026-09-29*

## Self-Check: PASSED

All 11 claimed files verified present on disk; both task commits (`4aed10b`, `7b82d25`) verified present in git history.
