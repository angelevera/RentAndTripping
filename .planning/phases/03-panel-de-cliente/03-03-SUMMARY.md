---
phase: 03-panel-de-cliente
plan: 03
subsystem: auth

tags: [supabase-auth-admin-api, service-role, postgrest-or-filter, rls]

requires:
  - phase: 03-panel-de-cliente
    provides: "03-01: requireAdmin(), profiles.email populated by handle_new_user trigger"
provides:
  - Confined service-role client (lib/supabase/admin.ts) — single reader of SUPABASE_SECRET_KEY, single importer (lib/clientes/invitar.ts)
  - invitarCliente()/reenviarInvitacion() — real Supabase Auth invite + delete-then-reinvite workaround (D-09/D-10/D-12)
  - buscarCoincidenciaExacta()/buscarReservasHuerfanas()/vincularReserva()/desvincularReserva() — exact-match auto-link vs. partial-match candidate search, structurally separated (D-04/D-05/D-07/D-08, Pitfall 4)
  - invitarClienteAction/reenviarInvitacionAction/vincularReservaAction/desvincularReservaAction Server Actions
affects: [03-05]

actuals:
  tokens: 58000
  tasks: 2
  commits: 2

tech-stack:
  added: [server-only (real npm package, previously implicitly relied on Next.js's internal shim)]
  patterns:
    - "lib/supabase/admin.ts: the one file in the repo allowed to read SUPABASE_SECRET_KEY, enforced by a checkpoint approval + a grep-based single-importer acceptance check, not just convention"
    - "invitarCliente()/reenviarInvitacion() accept an optional second admin-client parameter (default: the real createAdminClient()) so tests can inject a faithful implementation instead of vi.mock() — anti-slop's no-module-mocking rule forced this design, not a stylistic choice"
    - "PostgREST .or() filter values containing comma/parenthesis must be double-quote-wrapped (paraFiltroOr in lib/clientes/vincular.ts) — escaparPatronLike alone only escapes LIKE metacharacters, not the .or() filter grammar's own delimiters"
    - "buscarCoincidenciaExacta (auto-link, .eq() only) and buscarReservasHuerfanas (candidate search, .or()/.ilike()) are structurally separate functions, never sharing a query — Pitfall 4"

key-files:
  created:
    - lib/supabase/admin.ts
    - lib/clientes/invitar.ts
    - lib/clientes/vincular.ts
    - lib/validation/clientes.ts
    - app/admin/clientes/actions.ts
    - tests/auth/invitar-cliente.test.ts
    - tests/rls/vincular-reservas.test.ts
    - tests/helpers/server-only-stub.ts
  modified:
    - components/aviso-toast.tsx
    - tests/helpers/fixtures.ts
    - .env.example
    - scripts/check-env.sh
    - vitest.config.ts
    - eslint.config.mjs

key-decisions:
  - "Task 1 (secret-key/invite) implemented directly by Claude per D-20's security exception, gated by a blocking-human checkpoint the user explicitly approved ('confinado') before lib/supabase/admin.ts was created. Task 2 (link/unlink, RLS-protected, no secrets) delegated to Codex per D-20's default."
  - "Real Supabase Auth inviteUserByEmail() rejects @example.com (email_address_invalid) — switched test domain to mailinator.com (user-provided)."
  - "inviteUserByEmail() then hit Supabase's default email rate limit (over_email_send_rate_limit, ~2-4/hour) — user configured custom SMTP in Supabase (Resend sandbox, onboarding@resend.dev)."
  - "Resend's sandbox sender only delivers to the account owner's verified address — inviteUserByEmail() failed again ('Error sending invite email', 500) against mailinator.com. User's decision: mock only the tests (never lib/clientes/invitar.ts, which keeps calling the real API in production) until rentntrippin.com is verified in Resend (24-48h, in progress via Namecheap)."
  - "anti-slop's no-module-mocking rule forbids vi.mock() — the user's second decision: add a small, real dependency-injection seam (an optional admin-client parameter, default unchanged) to invitarCliente()/reenviarInvitacion() instead. A shared adminConEnvioSimulado() helper (tests/helpers/fixtures.ts) is used by both tests/auth/invitar-cliente.test.ts and tests/rls/vincular-reservas.test.ts's D-04 integration test — extracted after Codex's Task 2 hit the identical real-API failure without knowing about Task 1's workaround (a gap in the Task 2 delegation prompt, not told about it)."
  - "The real `server-only` npm package throws unconditionally outside Next.js's bundler (that's its whole implementation) — installed it for real (matching what the Next.js build already implicitly relies on) and aliased it to an empty stub specifically inside vitest.config.ts, so db-project tests can import server-only-guarded modules directly without weakening the real guard in the actual Next.js build."
  - "Plan's own acceptance-criteria grep for buscarReservasHuerfanas (\`grep -c '\\.ilike(' \`) doesn't match its own <action> text, which specifies PostgREST's .or() string-operator syntax (\`pagador_nombre.ilike.\${patron}\`), never the JS SDK's chained .ilike() method — verified the real requirement (ilike only inside buscarReservasHuerfanas, never buscarCoincidenciaExacta) holds; the grep pattern itself is stale, not the code."

patterns-established:
  - "A Server Action bound with curried leading args that genuinely doesn't need its trailing (prevState, formData) pair uses underscore-prefixed names and eslint's argsIgnorePattern (added project-wide in this plan) — not a per-file lint-disable."

requirements-completed: [AUTH-02, RESA-06]

coverage:
  - id: D1
    description: "Inviting a new email creates a real, unconfirmed Supabase Auth account with profiles.role='customer'"
    requirement: AUTH-02
    verification:
      - kind: integration
        ref: "tests/auth/invitar-cliente.test.ts#invitarCliente con un correo nuevo crea una cuenta real sin confirmar"
        status: pass
    human_judgment: false
  - id: D2
    description: "Inviting an email that already has a profile returns the exact D-12 duplicate message, creates nothing"
    verification:
      - kind: integration
        ref: "tests/auth/invitar-cliente.test.ts#invitarCliente con un correo que ya tiene perfil devuelve correo_duplicado sin crear nada"
        status: pass
    human_judgment: false
  - id: D3
    description: "Resending a pending invite deletes-and-reinvites (fresh id); refuses to delete an already-confirmed account"
    requirement: RESA-06
    verification:
      - kind: integration
        ref: "tests/auth/invitar-cliente.test.ts#reenviarInvitacion sobre una cuenta sin confirmar borra y reinvita con un id nuevo"
        status: pass
      - kind: integration
        ref: "tests/auth/invitar-cliente.test.ts#reenviarInvitacion sobre una cuenta ya confirmada devuelve ya_confirmado sin tocarla"
        status: pass
    human_judgment: false
  - id: D4
    description: "Exact-email match finds an orphan reservation without linking; partial search finds by name/email/phone without linking; comma/parenthesis in search input doesn't break the query"
    requirement: AUTH-02
    verification:
      - kind: integration
        ref: "tests/rls/vincular-reservas.test.ts#auto-vincula solo una coincidencia exacta de correo"
        status: pass
      - kind: integration
        ref: "tests/rls/vincular-reservas.test.ts#busca candidatas por nombre, correo o teléfono sin vincularlas"
        status: pass
      - kind: integration
        ref: "tests/rls/vincular-reservas.test.ts#busca sin romperse cuando el término trae coma o paréntesis (gramática de .or())"
        status: pass
    human_judgment: false
  - id: D5
    description: "Linking/unlinking updates cliente_id on exactly the target reservation; a second link attempt on an already-linked reservation is rejected"
    requirement: RESA-06
    verification:
      - kind: integration
        ref: "tests/rls/vincular-reservas.test.ts#vincula una reserva huérfana y rechaza pisar un vínculo existente"
        status: pass
      - kind: integration
        ref: "tests/rls/vincular-reservas.test.ts#desvincula la reserva y confirma cliente_id null con serviceClient"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-04 end-to-end: inviting a customer whose email exact-matches an orphan reservation auto-links it; a customer without that link still cannot read it (RLS)"
    requirement: AUTH-02
    verification:
      - kind: integration
        ref: "tests/rls/vincular-reservas.test.ts#la invitación exacta vincula y RLS impide que otro cliente lea la reserva"
        status: pass
    human_judgment: false
  - id: D7
    description: "The real inviteUserByEmail() call itself actually delivers a working, clickable email"
    verification: []
    human_judgment: true
    rationale: "No automated test can observe real mailer delivery (FA-2 in the plan itself). Currently blocked entirely: Resend's sandbox sender only reaches the account owner's own address, so even a manual check is not yet possible against a real recipient — must wait for rentntrippin.com's domain verification (in progress, 24-48h via Namecheap) before this can be tested at all, automated or manual."

duration: 105min
completed: 2026-09-30
status: complete
---

# Phase 03-03: Confined Service-Role Client and Client-Account Management Summary

**Real Supabase Auth invite/resend cycle behind a checkpoint-approved, single-importer service-role client, plus exact-match auto-link and partial-match search for orphan reservations**

## Performance

- **Duration:** ~105 min total (Task 1 ~55 min direct + Task 2 Codex run + audit/fix/gate cycle ~50 min)
- **Tasks:** 2
- **Files modified:** 6 modified, 8 created (across both tasks)

## Accomplishments
- `SUPABASE_SECRET_KEY` reaches the app runtime for the first time, confined to exactly one file (`lib/supabase/admin.ts`) with exactly one importer (`lib/clientes/invitar.ts`) — enforced by a grep-based acceptance check, not just convention. The architectural decision was gated behind a blocking-human checkpoint the user explicitly approved before the file existed.
- `invitarCliente()`/`reenviarInvitacion()` make D-09/D-10/D-12 real against the actual Supabase Auth Admin API: new-account invite, duplicate-email detection via `profiles.email` (not GoTrue's error string), and the delete-then-reinvite workaround for a still-pending invite — refusing to ever delete an already-confirmed account.
- `buscarCoincidenciaExacta()`/`buscarReservasHuerfanas()`/`vincularReserva()`/`desvincularReserva()` make D-04/D-05/D-07/D-08 real: exact-match auto-link on invite, partial-match candidate search (name/email/phone) that never auto-links, manual link/unlink guarded against overwriting an existing link.
- Discovered and worked around a real, multi-layered external blocker (invalid test domain → email rate limit → unverified sandbox sender) without weakening production code.

## Task Commits

1. **Task 1: confined service-role client + invite/resend cycle (D-09/D-10/D-12)** - `9036be3` (feat, implemented directly by Claude per D-20)
2. **Task 2: link/unlink orphan reservations (D-04/D-05/D-07/D-08)** - see commit below (feat, delegated to Codex per D-20, audited/fixed/gated by Claude)

## Files Created/Modified
- `lib/supabase/admin.ts` - `createAdminClient()`, the sole reader of `SUPABASE_SECRET_KEY`
- `lib/clientes/invitar.ts` - `invitarCliente()`/`reenviarInvitacion()`, with an injectable admin-client parameter for tests
- `lib/clientes/vincular.ts` - `buscarCoincidenciaExacta()`/`buscarReservasHuerfanas()`/`vincularReserva()`/`desvincularReserva()`, plus `paraFiltroOr()` for safe `.or()` filter values
- `lib/validation/clientes.ts` - `esquemaInvitarCliente`
- `app/admin/clientes/actions.ts` - four Server Actions, `origenDesdeHeaders()`, `idsDeReservaSonValidos()`
- `components/aviso-toast.tsx` - `invitada`/`reenviada`/`vinculada`/`desvinculada` keys
- `tests/helpers/fixtures.ts` - `trackTestUserId()`, `createReservaHuerfanaConContactoFixture()`, `adminConEnvioSimulado()` (shared DI test helper)
- `tests/auth/invitar-cliente.test.ts`, `tests/rls/vincular-reservas.test.ts` - 4 + 6 test cases
- `tests/helpers/server-only-stub.ts`, `vitest.config.ts` - infra so `server-only`-guarded modules stay directly testable
- `eslint.config.mjs` - `argsIgnorePattern` for curried Server Action trailing args (kept `no-unused-vars` at error severity)
- `.env.example`, `scripts/check-env.sh` - `SUPABASE_SECRET_KEY` now also documented/checked under `.env.local`

## Decisions Made
- User approved the checkpoint ("confinado") to expose `SUPABASE_SECRET_KEY` to the app runtime, breaking Phase 1's "the app never loads `.env.admin.local`" boundary deliberately and with the documented tradeoff.
- User chain of decisions resolving the external mailer blocker: real test domain (`mailinator.com`) → custom SMTP (Resend sandbox) → mock only the tests, not the app, until `rentntrippin.com` is verified.
- User's follow-up decision when anti-slop rejected `vi.mock()`: small DI seam in `lib/clientes/invitar.ts` instead (an optional, default-unchanged parameter) — satisfies both "app code doesn't change behaviorally" and the project's no-module-mocking policy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Real Supabase behavior, not anticipated by the plan] Real invite email chain of blockers**
- **Found during:** Running Task 1's own `<verify>` block
- **Issue:** `@example.com` rejected by `inviteUserByEmail()` (`email_address_invalid`) → switching to a real domain hit Supabase's default email rate limit (`over_email_send_rate_limit`) → configuring custom SMTP hit Resend's sandbox-sender-only-delivers-to-owner restriction (`Error sending invite email`, 500)
- **Fix:** User-directed chain of environment changes (`TEST_EMAIL_DOMAIN=mailinator.com`, Resend SMTP configured in Supabase Dashboard) ending in a test-only DI-based simulation of `inviteUserByEmail()` via `createUser({email_confirm:false})` — same DB effects, no dependency on the currently-unverified domain
- **Files modified:** `lib/clientes/invitar.ts` (DI parameter only, no behavior change), `tests/helpers/fixtures.ts` (`adminConEnvioSimulado()`), both test files
- **Verification:** full `test:db` suite green (54/54)
- **Committed in:** both task commits

**2. [Anti-slop, found during D-22 gate] no-module-mocking rejected the first mock approach**
- **Found during:** Anti-slop run after Task 1's initial `vi.mock()`-based fix
- **Issue:** `vi.mock("@/lib/supabase/admin", ...)` tripped `no-module-mocking`
- **Fix:** Replaced with the DI parameter approach described above (user's explicit choice between two offered options)
- **Files modified:** `lib/clientes/invitar.ts`, `tests/auth/invitar-cliente.test.ts`
- **Verification:** anti-slop clean, tests green
- **Committed in:** Task 1 commit `9036be3`

**3. [Bug, found during D-22 gate on Task 1] Login-page already-authenticated check was admin-only** — see 03-02's own deviations; unrelated to this plan, not repeated here.

**4. [Bug, found during Codex Task 2 audit] `.or()` filter grammar broken by comma/parenthesis in search input**
- **Found during:** D-22 code-review gate after Codex's Task 2 commit attempt
- **Issue:** `buscarReservasHuerfanas()` interpolated `escaparPatronLike()`'s output directly into a raw PostgREST `.or()` filter string — that function only escapes LIKE metacharacters (`\`, `%`, `_`), not `.or()`'s own delimiters (comma separates conditions, parens group them). A search for `"García, Luis"` or `"(0414) 555-1234"` would corrupt the query.
- **Fix:** Added `paraFiltroOr()` — wraps the value in double quotes with internal `\`/`"` escaped, PostgREST's own documented mechanism for embedding such characters literally in an `.or()`/`.and()` filter list. Added a regression test.
- **Files modified:** `lib/clientes/vincular.ts`, `tests/rls/vincular-reservas.test.ts`
- **Verification:** new test case passes; full suite green
- **Committed in:** Task 2 commit (below)

**5. [Bug, found during Codex Task 2 audit] Codex's Task 2 didn't know about Task 1's invite-email workaround**
- **Found during:** Running Task 2's own D-04 integration test after Codex reported done
- **Issue:** Codex's delegation prompt described Task 1's artifacts but not the `adminConEnvioSimulado()` test workaround (added after Task 1's own commit, in response to the same real-API blocker) — Task 2's D-04 integration test called `invitarCliente()` directly and hit the identical "Error sending invite email" failure
- **Fix:** Extracted the workaround from `tests/auth/invitar-cliente.test.ts` into a shared `adminConEnvioSimulado()` in `tests/helpers/fixtures.ts`; both test files now use it
- **Files modified:** `tests/helpers/fixtures.ts`, `tests/rls/vincular-reservas.test.ts`, `tests/auth/invitar-cliente.test.ts`
- **Verification:** full suite green
- **Committed in:** Task 2 commit (below)

**6. [Cleanup, found during D-22 gate on Task 2] Overly-broad eslint downgrade, stale comment, minor duplication**
- **Found during:** D-22 code-review gate on Task 2
- **Issue:** Task 1's eslint fix had downgraded `no-unused-vars` from error to warn project-wide instead of only adding the ignore pattern; `aviso-toast.tsx`'s SAFETY comment said "cuatro claves" after this plan added two more; identical inline UUID-validation blocks duplicated across `vincularReservaAction`/`desvincularReservaAction`; a stale JSDoc claim about when tests must pass the injected admin client (two tests correctly don't, since they never reach `inviteUserByEmail`); `buscarCoincidenciaExacta` had no deterministic ordering among multiple candidates
- **Fix:** Restored `no-unused-vars` to error severity (kept the `argsIgnorePattern`); made the comment count-agnostic; extracted `idsDeReservaSonValidos()`; corrected the JSDoc's blanket claim; added `.order("created_at", {ascending:false})` before `.limit(1)`
- **Files modified:** `eslint.config.mjs`, `components/aviso-toast.tsx`, `app/admin/clientes/actions.ts`, `tests/helpers/fixtures.ts`, `lib/clientes/vincular.ts`
- **Verification:** full re-run clean across tsc/lint/anti-slop/tests/build
- **Committed in:** Task 2 commit (below)

---

**Total deviations:** 6 (5 genuine fixes across both audit passes, 1 already covered in 03-02's own summary)
**Impact on plan:** All fixes address real gaps (an unanticipated external service chain, a genuine PostgREST escaping bug, a coordination gap between sequential Codex delegations, and code-review cleanup) — no scope creep beyond what each finding required.

## Issues Encountered
- Plan's own acceptance-criteria grep for `buscarReservasHuerfanas` (`` `\.ilike(` ``) doesn't match its own `<action>` text, which specifies PostgREST's `.or()` string-operator syntax, never a chained `.ilike()` method call. Verified the real Pitfall 4 requirement (ilike-as-text appears only inside `buscarReservasHuerfanas`, never `buscarCoincidenciaExacta`) holds regardless — a stale grep pattern in the plan document, not a code defect.
- `/codex:status` and `/codex:result` are `disable-model-invocation: true` — Claude cannot poll a backgrounded Codex job's progress or result on its own; the user checked and reported back for both plan 03-02 and this plan's Task 2.
- Codex's Task 2 delegation prompt should have included the invite-email workaround context from Task 1 — it didn't, causing a duplicate discovery of the identical real-API blocker. Noted for future cross-task Codex delegations within the same phase.

## Follow-up / Deferred (recorded from the code-review pass, not blocking)
- `invitarClienteAction`'s auto-link step discards `vincularReserva()`'s success/failure — this is the plan's own explicit design (its `<action>` text: "ignora el resultado... si falla, el admin lo verá como una candidata sin vincular en 03-05 y puede vincularla a mano"), not a bug; 03-05 is expected to surface unlinked orphans for manual linking.
- `vincularReservaAction`/`desvincularReservaAction`/`buscarReservasHuerfanas` have no caller yet — expected per the plan (`app/admin/clientes/` has no `page.tsx` until 03-05, this plan is Server Actions only).
- No database index on `pagador_email`/`pagador_telefono` — every invite/search forces a full table scan of `reservas`. Low urgency at current MVP volume; worth a dedicated migration once volume grows, out of scope for this plan.
- Combining invite+auto-link into one atomic operation (rather than three sequential round trips) was suggested as a more general fix than checking `vincularReserva`'s result — a bigger architecture change than this plan's scope, and would still need to preserve the plan's "invite success isn't blocked by link failure" design.

## User Setup Required
- `SUPABASE_SECRET_KEY` copied into `.env.local` (done, user-run, value never printed).
- `TEST_EMAIL_DOMAIN=mailinator.com` added to `.env.local` (done, user-run).
- Custom SMTP (Resend sandbox) configured in Supabase Auth dashboard (done, user-configured).
- **Still pending:** `rentntrippin.com` domain verification in Resend (24-48h via Namecheap, in progress) — once verified, remove `adminConEnvioSimulado()`'s callers (pass no second argument) in both test files and delete the helper from `tests/helpers/fixtures.ts`, confirming a real invite email is deliverable end to end (D7 above, currently blocked even for manual UAT).

## Next Phase Readiness
- 03-05 (admin-facing `/admin/clientes` list + detail screens) depends directly on this plan's Server Actions and `lib/clientes/vincular.ts`/`lib/clientes/invitar.ts` — no blockers.
- 03-04 (invite-accept page) is independent of this plan.

---
*Phase: 03-panel-de-cliente*
*Completed: 2026-09-30*
