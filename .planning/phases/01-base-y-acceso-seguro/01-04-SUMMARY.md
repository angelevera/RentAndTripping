---
phase: 01-base-y-acceso-seguro
plan: 04
subsystem: [ui, auth]
tags: [nextjs, tailwind, zod, react-hook-form, brand]
requires:
  - {phase: "01-base-y-acceso-seguro", provides: "lib/auth/require-admin.ts (getAdminSession), lib/supabase/server.ts, tests/helpers/fixtures.ts submitForm"}
provides:
  - "Brand tokens (Tailwind v4 @theme): --color-marca #482583, --color-marca-oscuro, --color-tinta, --color-pergamino, system font stack"
  - "Official logo served at public/logo-rent-and-trippin.png, rendered in the root layout header"
  - "app/page.tsx: root redirects to /admin (the /admin guard sends non-admins on to /login)"
  - "lib/validation/auth.ts: esquemaLogin (zod v4), shared by the client form and the Server Action"
  - "app/login/actions.ts: iniciarSesion Server Action — server-side validation, Supabase sign-in, anti-enumeration Spanish error mapping"
  - "app/login/login-form.tsx: progressive-enhancement client login form (react-hook-form + zodResolver + useActionState)"
  - "app/login/page.tsx: redirects an already-signed-in admin, renders the sin-acceso notice"
affects: ["Phase 2+ — this plan's layout, brand tokens and login flow are the UI baseline every later admin page builds on"]
actuals:
  tokens: 4999
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 @theme tokens (no shadcn/ui yet, per SKELETON.md — deferred to Phase 2's UI contract)"
    - "One zod schema (lib/validation/auth.ts) consumed by both zodResolver on the client and safeParse on the server — no duplicated validation rules"
    - "useActionState + form action={formAction} + onSubmit calling form.handleSubmit(() => startTransition(() => formAction(new FormData(formRef.current!)))) — the form keeps working via a real POST when JavaScript is absent, and gets instant RHF/zod feedback when it's present"
    - "Identical Spanish error message for wrong password and unknown email (no account-enumeration signal), Supabase's own 429 mapped to a distinct rate-limit message, everything else logged server-side only"
key-files:
  created:
    - lib/validation/auth.ts
    - app/login/actions.ts
    - app/login/login-form.tsx
    - public/logo-rent-and-trippin.png
  modified:
    - app/globals.css
    - app/layout.tsx
    - app/page.tsx
    - app/login/page.tsx
    - tests/e2e/admin-login.test.ts
key-decisions:
  - "app/admin/page.tsx left untouched, as the plan requires — it already renders correctly inside the new brand layout without any changes of its own"
  - "The malformed-email test bypasses the browser by posting a raw FormData value ('no-es-un-correo') through submitForm, exactly the way a no-JS client could — this is what proves server-side validation, not just the zodResolver client check"
  - "esquemaLogin's chained zod checks (.trim().min(1).email()) both fire on an empty string, so the resolver picks the first issue ('Escribe tu correo.') for the required case and the email format issue only surfaces on a non-empty malformed value — verified directly against the installed zod v4.6.5 before writing the schema"
requirements-completed: [AUTH-01]
coverage:
  - id: D1
    description: "Opening the site root / redirects to /admin"
    requirement: "AUTH-01"
    verification:
      - {kind: e2e, ref: "tests/e2e/admin-login.test.ts#la raíz / lleva a /admin", status: pass}
    human_judgment: false
  - id: D2
    description: "Every page carries the brand purple #482583, the official logo, Spanish lang=es and the system font stack, with app/admin/page.tsx left untouched"
    requirement: "AUTH-01"
    verification:
      - {kind: other, ref: "grep acceptance criteria (#482583, @theme, lang=\"es\", logo-rent-and-trippin.png, no next/font/google) + npm run build", status: pass}
    human_judgment: false
  - id: D3
    description: "A wrong password and an unknown email produce the identical Spanish message 'Correo o contraseña incorrectos.' with no auth cookie set"
    requirement: "AUTH-01"
    verification:
      - {kind: e2e, ref: "tests/e2e/admin-login.test.ts#muestra el mismo mensaje para contraseña incorrecta y correo desconocido, sin crear sesión", status: pass}
    human_judgment: false
  - id: D4
    description: "A malformed email submitted without JavaScript is rejected server-side with 'Escribe un correo válido.'"
    requirement: "AUTH-01"
    verification:
      - {kind: e2e, ref: "tests/e2e/admin-login.test.ts#rechaza un correo mal formado en el servidor aunque el navegador no valide (sin JS)", status: pass}
    human_judgment: false
  - id: D5
    description: "Visiting /login?motivo=sin-acceso shows the access-denied notice"
    requirement: "AUTH-01"
    verification:
      - {kind: e2e, ref: "tests/e2e/admin-login.test.ts#GET /login?motivo=sin-acceso muestra el aviso de acceso denegado", status: pass}
    human_judgment: false
  - id: D6
    description: "An admin who is already signed in and opens /login is sent straight to /admin"
    requirement: "AUTH-01"
    verification:
      - {kind: e2e, ref: "tests/e2e/admin-login.test.ts#un admin que ya inició sesión y abre /login va directo a /admin", status: pass}
    human_judgment: false
  - id: D7
    description: "Phone-sized visual/brand fit, a real gabbovera@gmail.com login/logout/wrong-password pass, and next-day session persistence (D-01)"
    verification: []
    human_judgment: true
    rationale: "Visual brand fit and next-day session persistence cannot be judged by grep or by the e2e suite (which cannot wait a day) — queued for end-of-phase UAT, see Human Verification Required below"
duration: 25min
completed: 2026-09-28
status: complete
---

# Phase 1 Plan 04: Brand and Login Form Summary

**Branded Spanish login and admin entry — Tailwind v4 `#482583` tokens, the official logo, a root-to-/admin redirect, and a `zod`+`react-hook-form` login form whose Server Action validates on the server, maps errors to identical anti-enumeration Spanish text, and still submits without JavaScript.**

## Performance

- **Duration:** ~25 min, sequential execution on `main` (no worktree, `branching_strategy: none`, `allow_default_branch_commits: true`)
- **Tasks:** 2/2 complete (Task 2 TDD: RED confirmed for the 3 genuinely new behaviors, then implemented to GREEN)
- **Commits:** 2 (one per task)
- **Files created:** 4; modified: 5

## Accomplishments

- **Task 1** — `app/globals.css` now defines Tailwind v4 `@theme` tokens (`--color-marca #482583`, `--color-marca-oscuro`, `--color-tinta`, `--color-pergamino`, the system font stack) and drops the scaffold's demo dark-mode variables; `app/layout.tsx` is `<html lang="es">`, uses the system font stack (no more `next/font/google` network dependency at build time), sets `Rent & Trippin` / `Panel de reservas de Rent & Trippin` metadata, and renders the official logo via `next/image` in a slim header; `app/page.tsx` is now a Server Component that redirects `/` straight to `/admin`; `public/logo-rent-and-trippin.png` is a byte-identical copy of `assets/Rent_a_trippin-01.png` (`cmp -s` confirmed); `app/admin/page.tsx` was left untouched, confirmed by `git diff --quiet HEAD -- app/admin/page.tsx`
- Added the "la raíz / lleva a /admin" e2e test; full e2e suite (9 tests) passed, `npm run build` was clean
- **Task 2** — Added 3 new behaviors to `tests/e2e/admin-login.test.ts` first and confirmed RED (malformed-email server rejection, `motivo=sin-acceso` notice, already-signed-in redirect all failed against the old tracer code — 2 of the planned behaviors, wrong-password and unknown-email producing the identical message, already passed under the old tracer's blanket `if (error) redirect(...)` handling, which is expected since that handling already collapsed every sign-in error to one message); then built `lib/validation/auth.ts` (`esquemaLogin`, `DatosLogin`), `app/login/actions.ts` (`iniciarSesion` Server Action), `app/login/login-form.tsx` (`LoginForm`, progressive enhancement via `useActionState` + the `action` attribute + `react-hook-form`/`zodResolver`), and rewrote `app/login/page.tsx` to redirect an already-signed-in admin via `getAdminSession()` and render the `sin-acceso` notice, removing the Plan 01-01 tracer's inline Server Function entirely
- All 13 e2e tests (8 in `admin-login.test.ts` — 4 pre-existing/regression plus 4 new Task 2 behaviors — plus 5 in `admin-access.test.ts`) passed; `npm run lint` clean; `npm run build` clean; full `npm run test` (7 files, 40 tests across `e2e` + `db`) green — no regressions in Plan 01-02/01-03 tests

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Brand identity and site entry — logo, purple #482583, Spanish, system fonts, root goes to the panel | `0bca88d` | app/globals.css, app/layout.tsx, app/page.tsx, public/logo-rent-and-trippin.png, tests/e2e/admin-login.test.ts |
| 2 | Formulario de entrada con validación en teléfono y servidor (TDD: RED confirmed, then implemented) | `f101297` | lib/validation/auth.ts, app/login/actions.ts, app/login/login-form.tsx, app/login/page.tsx, tests/e2e/admin-login.test.ts |

## Files Created/Modified

**Created:** `lib/validation/auth.ts`, `app/login/actions.ts`, `app/login/login-form.tsx`, `public/logo-rent-and-trippin.png`

**Modified:** `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`, `tests/e2e/admin-login.test.ts`

## Decisions Made

- `app/admin/page.tsx` stayed untouched — the plan's own acceptance criterion (`git diff --quiet HEAD -- app/admin/page.tsx`) confirmed this; it renders correctly inside the new brand layout with zero changes of its own
- The malformed-email behavior is proven by posting a raw `FormData` value (`"no-es-un-correo"`) through `submitForm`, the same way a no-JS client could bypass the browser's native `type="email"` check — this is what actually proves server-side validation rather than just the client-side `zodResolver`
- Verified `zod` v4.6.5's chained `.trim().min(1).email()` behavior directly in a scratch Node script before writing `esquemaLogin`: both checks fire on an empty string (so the resolver surfaces the first issue, `'Escribe tu correo.'`), while a non-empty malformed value only trips the `.email()` check (`'Escribe un correo válido.'`) — confirmed this matches the plan's exact required message pairing before relying on it

## Deviations from Plan

None — plan executed exactly as written. `app/admin/page.tsx` untouched as required; the login page's tracer Server Function was fully replaced as the plan explicitly specified (not a deviation, per the plan's own note).

## Issues Encountered

None.

## User Setup Required

None new for this plan — no environment variables or external service configuration were touched.

## Human Verification Required (end-of-phase UAT)

Per `workflow.human_verify_mode: end-of-phase`, Task 2's `<human-check>` was not run interactively during execution. It is queued here for end-of-phase UAT:

**Test:** With the dev server running (`npm run dev`), open `http://localhost:3000` in a phone-sized window (375px wide, e.g. the browser's device mode). Sign in as `gabbovera@gmail.com` with the initial password, check the panel, press "Cerrar sesión", then try a wrong password. The next day, reopen the same browser.

**Expected:** The logo and purple button look right on the phone-sized screen. The panel shows "Sesión iniciada como gabbovera@gmail.com". A wrong password shows "Correo o contraseña incorrectos." in Spanish. Logout returns to the login page. The next day the panel opens without asking for the password again (D-01).

**Why human:** Visual brand fit, mobile feel, and next-day session persistence cannot be judged by grep or by the e2e suite (which cannot wait a day).

## Next Phase Readiness

- This is the **last plan of Phase 1**. Phase-level verification / end-of-phase UAT (including the human-check above) is next.
- `AUTH-01` is now expected to be markable complete — this plan is the last of the 4 sharing it (per Plan 01-02's SUMMARY, it was intentionally left open pending this plan's login UI). `state.record-session`/`requirements.mark-complete` below act on this.
- Phase 2 (reservation UI) builds on: the brand tokens in `app/globals.css`, the layout header pattern in `app/layout.tsx`, and the `esquemaLogin`-style shared-schema pattern in `lib/validation/` for its own forms.
- `shadcn/ui` initialization and the formal design system remain deferred to Phase 2's UI contract, as SKELETON.md specifies — this plan used plain Tailwind utilities only, consistent with Plans 01-01/01-02/01-03.

## Self-Check: PASSED

All 4 created files confirmed present on disk (`lib/validation/auth.ts`, `app/login/actions.ts`, `app/login/login-form.tsx`, `public/logo-rent-and-trippin.png`). Both commits (`0bca88d`, `f101297`) confirmed present in `git log --oneline`. `commits: 2` matches `git rev-list --count 495a9ad..HEAD` measured from the plan-start ledger (`plan_head_before: 495a9ad4c924abe4fa55dd0b3538f795352857d7`).

---
*Phase: 01-base-y-acceso-seguro*
*Completed: 2026-09-28*
