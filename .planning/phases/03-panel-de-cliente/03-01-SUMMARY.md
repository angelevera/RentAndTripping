---
phase: 03-panel-de-cliente
plan: 01
subsystem: auth

tags: [supabase-auth, rls, nextjs-server-actions, e2e-vitest]

requires:
  - phase: 01-fundacion-admin
    provides: profiles.role, requireAdmin()/getSessionStatus() single-role-lookup pattern, admin login e2e coverage
provides:
  - Three-way login role branch (admin→/admin, customer→/cliente, unrecognized→shared generic error) closing WR-01
  - requireCliente() guard mirroring requireAdmin(), composing the same getSessionStatus()
  - /cliente minimal panel reading real reservas scoped to cliente_id
affects: [03-02, 03-03, 03-04, 03-05]

actuals:
  tokens: 28000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "getSessionStatus() as the single exported, cache()-memoized role lookup — requireAdmin() and requireCliente() both compose it, never a second profiles query"
    - "Role→destination redirect kept intentionally asymmetric between requireAdmin() (unchanged since Phase 1, non-admin always → /login?motivo=sin-acceso) and requireCliente() (new, bounces an authenticated admin to /admin) — verified against tests/e2e/admin-access.test.ts, not a general symmetry rule"

key-files:
  created:
    - lib/auth/require-cliente.ts
    - lib/reservas/listar-cliente.ts
    - app/cliente/page.tsx
    - tests/e2e/cliente-login.test.ts
  modified:
    - app/login/actions.ts
    - app/login/page.tsx
    - lib/auth/require-admin.ts
    - proxy.ts

key-decisions:
  - "D-20/D-23 applied literally: both tasks implemented directly by Claude (Sonnet, per user's explicit choice over the plan's Opus recommendation — see below), never delegated to Codex."
  - "D-22 gate run before closing the plan: anti-slop (oxlint) + an independent /code-review high pass over the full diff, not just the plan's own acceptance greps."
  - "Extracted the wrong-credentials string into one MENSAJE_CREDENCIALES_INVALIDAS constant (plan's own acceptance criterion required grep count = 1, not 2, in app/login/actions.ts)."
  - "app/login/page.tsx's already-authenticated redirect (found missing by the review, not in the plan) now checks getSessionStatus() for both admin and customer, not just getAdminSession() — otherwise a signed-in customer opening /login saw the form again instead of /cliente."
  - "requireAdmin()'s 'other' status now signs out before redirecting to /login?motivo=sin-acceso (found by review), matching app/login/actions.ts's own signOut on that branch — scoped ONLY to 'other', not to 'customer', after an initial fix attempt incorrectly bounced a customer at /admin to /cliente and broke tests/e2e/admin-access.test.ts's 'redirects a signed-in customer requesting /admin to /login?motivo=sin-acceso' (Phase 1 regression the plan explicitly locks). Reverted to the plan's documented asymmetry."

patterns-established:
  - "requireCliente() is requireAdmin()'s mirror, not its twin — deliberately asymmetric redirect targets on failure, decided per-guard against its own real destination, not by a generic 'always symmetric' rule."

requirements-completed: [AUTH-02]

coverage:
  - id: D1
    description: "Customer with correct credentials logs in via /login and lands on /cliente, never /admin or an error"
    requirement: AUTH-02
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#signs a customer in through the real /login form and redirects straight to /cliente"
        status: pass
    human_judgment: false
  - id: D2
    description: "Admin still lands on /admin unchanged (Phase 1 regression)"
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#still sends the admin to /admin, unchanged (regression)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-login.test.ts (full file, isolated run)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/admin-access.test.ts (full file, isolated run)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Anonymous visit to /cliente redirects to /login before the page renders"
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#redirects an anonymous request to /cliente to /login before the page renders"
        status: pass
    human_judgment: false
  - id: D4
    description: "Signed-in customer sees at least one of their own real reservations; a customer with none sees none of another customer's"
    requirement: AUTH-02
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#shows a signed-in customer at least one of their own real reservations"
        status: pass
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#a customer with no reservations of their own sees none of another customer's data"
        status: pass
    human_judgment: false
  - id: D5
    description: "Wrong password produces the identical generic message for admin and customer emails, no session created"
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#shows the same wrong-credentials message for admin and customer emails, and creates no session"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-30
status: complete
---

# Phase 03-01: WR-01 Login Fix + Minimal Client Panel Summary

**Three-way login role branch (admin/customer/unrecognized) closing WR-01, with a minimal `/cliente` panel reading real RLS-scoped reservations end to end**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 4 modified, 4 created

## Accomplishments
- WR-01 closed: `iniciarSesion` is a true three-way branch (admin→/admin, customer→/cliente, unrecognized→same generic error as wrong password) — no two-way reject branch reintroduced.
- `getSessionStatus()` generalized to four states (none/admin/customer/other) and exported as the single shared role lookup; `requireCliente()` composes it instead of a second `profiles` query.
- `/cliente` renders a real, RLS-scoped reservation read (`listarReservasCliente`, filtered by `cliente_id` only, never by traveler) — proven end to end over HTTP without JavaScript.
- Zero observable regression to `/admin`, `/login?motivo=sin-acceso`, or any Phase 1 test file.

## Task Commits

Both tasks (Task 1 tracer + Task 2 test extension) were implemented in one continuous TDD pass and committed together, since Task 2 only extends Task 1's same test file with two more cases in the same describe block — splitting them into separate commits would have meant committing a file mid-edit.

1. **Tasks 1+2: WR-01 three-way login branch + minimal /cliente panel + full e2e coverage** - see commit below (feat)

**Plan metadata:** included in the same commit (docs: SUMMARY)

## Files Created/Modified
- `lib/auth/require-admin.ts` - `SessionStatus` widened to none|admin|customer|other; `getSessionStatus` exported; `requireAdmin()` signs out only on the unreachable "other" branch (new), unchanged for "customer"
- `lib/auth/require-cliente.ts` (new) - mirror guard, composes `getSessionStatus()`, bounces an authenticated admin to `/admin`
- `app/login/actions.ts` - three-way redirect branch; wrong-credentials string centralized in `MENSAJE_CREDENCIALES_INVALIDAS`
- `app/login/page.tsx` - already-authenticated redirect now checks admin AND customer (was admin-only; found by review, not in the original plan)
- `proxy.ts` - anonymous-redirect condition extended to `/cliente`
- `lib/reservas/listar-cliente.ts` (new) - `listarReservasCliente()`, scoped to `cliente_id`, reuses the `listar.ts` derived-payment-status pattern
- `app/cliente/page.tsx` (new) - minimal panel, deliberately without D-14–D-19 (03-02's scope)
- `tests/e2e/cliente-login.test.ts` (new) - 6 e2e cases covering both tasks

## Decisions Made
- Stayed on Sonnet (high effort) for this plan instead of switching to Opus, despite the plan's own D-23 explicitly naming WR-01 as Opus's justifying case — the user's explicit choice when asked.
- Extracted `MENSAJE_CREDENCIALES_INVALIDAS` as a single constant (plan's acceptance criteria required the literal string to appear exactly once in `app/login/actions.ts`, not twice).
- `app/login/page.tsx`'s stale already-authenticated check (admin-only) was fixed to cover customers too — a real gap the plan didn't call out but the D-22 review caught before commit.
- Kept `requireAdmin()`'s customer-handling behavior byte-for-byte unchanged from before this plan (no bounce to `/cliente`) after an initial attempt to "symmetrize" it with `requireCliente()` broke `tests/e2e/admin-access.test.ts`'s Phase 1 regression test — the plan's own `read_first` notes had already flagged that exact test as untouchable, and the asymmetry is intentional, not an oversight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Review finding] Already-authenticated customer stuck on /login**
- **Found during:** D-22 code-review gate (`/code-review high`), not covered by the plan's own acceptance criteria
- **Issue:** `app/login/page.tsx` only called `getAdminSession()` for the already-authenticated redirect, so a signed-in customer who opened `/login` saw the form again instead of `/cliente`
- **Fix:** Switched to `getSessionStatus()`, redirecting admin→`/admin` and customer→`/cliente`
- **Files modified:** `app/login/page.tsx`
- **Verification:** `tsc`, `eslint`, anti-slop, and the full `cliente-login.test.ts`/`admin-login.test.ts`/`admin-access.test.ts` suites re-run clean after the fix
- **Committed in:** same commit as the plan's tasks

**2. [Review finding] "other" status never signed out**
- **Found during:** D-22 code-review gate
- **Issue:** `requireAdmin()`/`requireCliente()` redirected the (practically unreachable) "other" status to `/login?motivo=sin-acceso` without clearing the session, unlike `app/login/actions.ts`'s own handling of the same case
- **Fix:** Added `supabase.auth.signOut({ scope: "local" })` before the redirect, scoped exclusively to `status === "other"` in both guards
- **Files modified:** `lib/auth/require-admin.ts`, `lib/auth/require-cliente.ts`
- **Verification:** same full re-run as above
- **Committed in:** same commit

**3. [Review finding, reverted after breaking a regression] Requireadmin/requireCliente symmetry**
- **Found during:** D-22 code-review gate (finding: `requireAdmin()` sends a customer to a generic error while `requireCliente()` bounces an admin to `/admin` — an "inconsistency")
- **Issue:** Initially "fixed" by also bouncing a customer at `/admin` to `/cliente` — this broke `tests/e2e/admin-access.test.ts`'s existing test `"redirects a signed-in customer requesting /admin to /login?motivo=sin-acceso"`, a Phase 1 regression the plan's own `read_first` section explicitly named as untouchable
- **Fix:** Reverted `requireAdmin()`'s customer handling to its exact pre-plan behavior; the asymmetry is intentional (documented in the plan's FA-4), not a bug
- **Files modified:** `lib/auth/require-admin.ts`
- **Verification:** `tests/e2e/admin-access.test.ts` re-run isolated, 5/5 pass
- **Committed in:** same commit (the revert never left the working tree in a broken state that was committed)

---

**Total deviations:** 3 (2 genuine fixes applied, 1 review suggestion investigated and correctly rejected as contradicting the plan's own locked regression test)
**Impact on plan:** Both applied fixes close real, review-caught gaps in scope (login page's own already-authenticated check; session hygiene on the defensive branch). The rejected suggestion is recorded so a future pass doesn't reintroduce it and re-break `admin-access.test.ts`.

## Issues Encountered
- `npm run test:e2e` (the full suite) reliably rate-limits on Supabase Auth sign-in volume when run repeatedly in a short window — this matches known, pre-existing project behavior, not a regression from this plan. All three touched/added test files (`cliente-login.test.ts`, `admin-login.test.ts`, `admin-access.test.ts`) were verified passing individually in isolation instead, which is the reliable signal.
- Anti-slop's `require-readable-spacing` and `require-safety-comment-for-type-assertion` rules are new as of this phase (existing Phase 1/2 test files like `admin-login.test.ts` still contain the same `as string` pattern without SAFETY comments, unflagged because they weren't touched by this diff) — fixed in full in every new/touched file for this plan; did not retrofit untouched Phase 1/2 files.

## Follow-up / Deferred (not blocking, recorded from the code-review pass)
- `proxy.ts`'s `startsWith("/admin")`/`startsWith("/cliente")` has no path-segment boundary — pre-existing pattern from Phase 1, inherited rather than introduced by this plan.
- `/login?motivo=sin-acceso` copy always reads "panel de administración," which is technically imprecise for the (practically unreachable) "other"-status case reaching it via `requireCliente()` — low severity, same disposition as the plan's own T-03-05 (accept).
- `lib/reservas/listar-cliente.ts`'s derived-payment-status query duplicates `lib/reservas/listar.ts`'s pattern instead of a shared helper; `FilaReservaCliente`/`FilaListaReserva` are structurally identical interfaces; `AdminSession`/`ClienteSession` are structurally identical; role→destination routing is inlined in three places instead of one shared helper. All legitimate simplification candidates, deliberately left as-is for this plan (a `reversibility: costly`, TDD security fix) rather than expanding scope into `listar.ts` and touching already-tested Phase 1/2 code. Worth a dedicated small refactor plan later.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 03-02 (full `/cliente` panel UI), 03-03 (privileged `/admin/clientes` action layer), and 03-04 (invite-accept page) all build on `requireCliente()`, `listarReservasCliente()`, and the login/guard pipeline proven here — no blockers.
- Per user instruction, 03-02/03-03/03-04/03-05 are delegated to Codex (`/codex:rescue`) rather than executed directly by Claude, since none of them are the WR-01 security exception 03-01 was.

---
*Phase: 03-panel-de-cliente*
*Completed: 2026-09-30*
