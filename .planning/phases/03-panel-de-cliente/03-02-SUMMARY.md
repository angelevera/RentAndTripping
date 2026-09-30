---
phase: 03-panel-de-cliente
plan: 02
subsystem: ui

tags: [nextjs-server-components, react-suspense, tailwind, e2e-vitest]

requires:
  - phase: 03-panel-de-cliente
    provides: "03-01: requireCliente(), listarReservasCliente()/FilaReservaCliente, minimal /cliente tracer page"
provides:
  - Full /cliente panel — dual status badges, "Para: [viajero]", Próximas/Historial split by fecha_importante
  - Brand empty state with isolated WhatsappCta component (single wa.me URL builder for Fase 6 to swap later)
  - Client-side sign out (app/cliente/actions.ts), guarded by requireCliente(), independent of the admin guard
affects: [03-05]

actuals:
  tokens: 42000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "components/whatsapp-cta.tsx is the ONLY file in the phase that builds a wa.me URL — the isolated swap point for Fase 6's future chat-quoting assistant (D-18/D-19)"
    - "InfoViajero renders a single template-literal text node (`Para: ${name}`) rather than adjacent literal+expression JSX children, to avoid React SSR's inter-text <!-- --> comment marker breaking substring-based e2e assertions"
    - "dividirPorFecha() preserves listarReservasCliente()'s created_at-desc order — Próximas/Historial split, never re-sorted by date"

key-files:
  created:
    - components/whatsapp-cta.tsx
    - app/cliente/lista-reservas-cliente.tsx
    - app/cliente/actions.ts
  modified:
    - app/cliente/page.tsx
    - tests/e2e/cliente-login.test.ts

key-decisions:
  - "Delegated to Codex per D-20 (plan explicitly says this task has no secrets, no security decision) — Claude's role was audit: ran the plan's own verify commands, found and fixed 2 real bugs plus anti-slop findings, then ran an independent /code-review high pass, which came back clean (empty findings array)."
  - "Fixed a test-ordering bug: the 'undated pending reservation' test grabbed whatever row rendered first in the DOM instead of the tracer reservation's own id — since listarReservasCliente() orders by created_at desc, the first-rendered row was actually a different (later-created) reservation that does have a 'Para:' line, causing a false failure. Now asserts against the captured reservaTrazadoraId."
  - "Fixed a React SSR artifact: `<p>Para: {fila.viajeroNombre}</p>` (literal text + adjacent expression) serializes with an invisible <!-- --> comment between them, breaking `.toContain('Para: ' + name)` in e2e tests reading raw HTML. Changed to a single template-literal expression `{`Para: ${fila.viajeroNombre}`}` — same visible output, one text node, no comment."
  - "Fixed a stale assertion inherited from 03-01: `expect(body).toContain('tour')` (raw lowercase DB value) broke once 03-02 legitimately switched tipo display to the translated label ETIQUETAS_TIPO.tour = 'Tour' — updated the assertion to match the new (correct) rendering."
  - "Anti-slop findings fixed: require-readable-spacing (blank lines between statements) across the new component and test file; no-unsafe-dictionary-type / no-known-value-widening — replaced a `Record<string, unknown>` insert payload with a named FilaReservaClienteInsert interface, which also let the `as never` cast be dropped entirely."

patterns-established:
  - "A JSX child sequence like `<p>literal {expr}</p>` is avoided in this codebase when the combined text is later asserted on in e2e tests — use a single template-literal expression instead to keep the server-rendered HTML free of SSR text-boundary comments."

requirements-completed: [RESA-05, RESA-06]

coverage:
  - id: D1
    description: "Each reservation shows separate provider-status and payment-status badges (D-15)"
    requirement: RESA-05
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#shows the undated pending reservation under Próximas with two separate pending badges"
        status: pass
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#shows provider and payment status separately for a confirmed paid reservation"
        status: pass
    human_judgment: false
  - id: D2
    description: "'Para: [viajero]' shown only when the traveler differs from the payer (D-14)"
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#shows Para with the traveler's name"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reservations split into Próximas/Historial by fecha_importante, undated rows in Próximas (D-16)"
    requirement: RESA-06
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#places a past reservation under Historial"
        status: pass
    human_judgment: false
  - id: D4
    description: "Brand empty state with isolated WhatsApp CTA when the customer has no reservations (D-17/D-18/D-19)"
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#shows the branded empty state with the isolated WhatsApp CTA"
        status: pass
    human_judgment: false
  - id: D5
    description: "Customer can sign out from /cliente via its own guard, independent of admin's"
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#lets the customer sign out from their own panel"
        status: pass
    human_judgment: false
  - id: D6
    description: "VES amounts shown correctly without admin's 'ver detalle' pattern; provider's internal note never reaches the client"
    requirement: RESA-05
    verification:
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#shows a VES reservation's actual formatted amount without a detail link"
        status: pass
      - kind: e2e
        ref: "tests/e2e/cliente-login.test.ts#never includes the provider's internal problem note in the client page"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-30
status: complete
---

# Phase 03-02: Full /cliente Panel Summary

**Dual status badges, "Para: [viajero]", Próximas/Historial split, and an isolated WhatsApp empty-state CTA on top of 03-01's minimal tracer**

## Performance

- **Duration:** ~30 min (Codex execution + Claude audit/fix/gate cycle)
- **Tasks:** 2
- **Files modified:** 2 modified, 3 created

## Accomplishments
- `/cliente` now shows dual provider/payment badges, "Para: [viajero]" when relevant, and a Próximas/Historial split — all reading through 03-01's unchanged `listarReservasCliente()`.
- Brand empty state (`¿Para dónde vamos ahora?`) with a WhatsApp CTA whose `wa.me` URL construction lives in exactly one file (`components/whatsapp-cta.tsx`), the deliberate Fase 6 swap point.
- Customer sign-out guarded by `requireCliente()`, entirely independent of the admin sign-out.
- Zero regression to Fase 1/2 suites; the provider's internal note structurally never reaches the client (it isn't even selected by 03-01's query).

## Task Commits

1. **Tasks 1+2: full /cliente panel + WhatsApp CTA + sign-out + full e2e coverage** - implemented by Codex (`/codex:rescue`, background job `task-muo0axgk-cim148`), then audited/fixed/gated by Claude before commit (see below)

## Files Created/Modified
- `components/whatsapp-cta.tsx` (new) - isolated `wa.me` URL builder, degrades gracefully with no invented fallback number (D-19)
- `app/cliente/lista-reservas-cliente.tsx` (new) - full list: dual badges, `Para:`, Próximas/Historial, skeleton, error, empty states
- `app/cliente/actions.ts` (new) - `cerrarSesion()`, guarded by `requireCliente()` only
- `app/cliente/page.tsx` - replaced 03-01's inline body with guard→Suspense→component pattern (mirrors `app/admin/page.tsx`)
- `tests/e2e/cliente-login.test.ts` - extended from 6 to 14 cases

## Decisions Made
- Codex delegation followed the plan's own D-20 exception literally — this task has no secrets and no security decision, unlike 03-01.
- Claude's audit found and fixed two genuine bugs (not present in Codex's own passing local run, but surfaced under `npx vitest run` here) plus every anti-slop finding, before running the independent `/code-review high` pass required by D-22.

## Deviations from Plan

### Auto-fixed Issues

**1. [Bug, found during audit] Test asserted the wrong row for the "no Para:" case**
- **Found during:** Re-running the plan's own `<verify>` command after Codex reported done
- **Issue:** `fragmentoDeReservaCliente(body, "")` grabbed whichever reservation happened to render first in the DOM and asserted it had no "Para:" line — but `listarReservasCliente()` orders by `created_at desc`, so the first-rendered row was actually `reservaViajeroId` (which legitimately has a "Para:" line), not the intended undated tracer reservation
- **Fix:** Captured the tracer reservation's own id from `createReservaFixture()`'s return value and asserted against it directly, same pattern as every other row-specific test in the file
- **Files modified:** `tests/e2e/cliente-login.test.ts`
- **Verification:** full file re-run, 14/14 green
- **Committed in:** same commit as the plan's tasks

**2. [Bug, found during audit] React SSR comment broke a "Para: {name}" substring assertion**
- **Found during:** same re-run
- **Issue:** `<p>Para: {fila.viajeroNombre}</p>` (literal text sibling to an expression) serializes as `Para: <!-- -->{value}` in server-rendered HTML — the SSR text-boundary comment split the string the test searched for
- **Fix:** Changed to a single template-literal expression `{`Para: ${fila.viajeroNombre}`}`, one text node, same visual output, no comment
- **Files modified:** `app/cliente/lista-reservas-cliente.tsx`
- **Verification:** same re-run
- **Committed in:** same commit

**3. [Stale assertion, found during audit] Inherited 03-01 test broke on legitimate tipo-label change**
- **Found during:** same re-run
- **Issue:** `expect(body).toContain("tour")` (lowercase, from 03-01) stopped matching once 03-02 correctly switched to the translated label (`ETIQUETAS_TIPO.tour = "Tour"`)
- **Fix:** Updated the assertion to `"Tour"` with a comment explaining why
- **Files modified:** `tests/e2e/cliente-login.test.ts`
- **Verification:** same re-run
- **Committed in:** same commit

**4. [Anti-slop, found during audit] Spacing + unsafe dictionary type**
- **Found during:** running the project's oxlint anti-slop config (D-22 gate) over the diff
- **Issue:** Several `require-readable-spacing` violations in the new component and test file; a `Record<string, unknown>` insert payload tripped `no-unsafe-dictionary-type`/`no-known-value-widening`, which also required an `as never` cast
- **Fix:** Added blank lines between statements; replaced the loose dictionary with a named `FilaReservaClienteInsert` interface, which let the `as never` cast be dropped entirely
- **Files modified:** `app/cliente/lista-reservas-cliente.tsx`, `tests/e2e/cliente-login.test.ts`
- **Verification:** anti-slop re-run clean
- **Committed in:** same commit

---

**Total deviations:** 4 auto-fixed (2 genuine bugs, 1 stale assertion, 1 anti-slop batch)
**Impact on plan:** All four are fixes to code/tests this plan itself introduced or inherited unchanged from 03-01 — no scope creep, no plan requirement changed. The independent `/code-review high` pass after these fixes returned zero findings.

## Issues Encountered
- Codex's own background run reported success and a clean local build/test pass, but running the plan's own `<verify>` commands here (Claude's audit step) surfaced the 2 genuine bugs and the anti-slop findings above — confirms the value of the D-22 gate as a real check, not a formality.
- Codex ran as an async background job rather than synchronously; `/codex:status` and `/codex:result` are `disable-model-invocation: true` (same class of gate as `/thermos`), so Claude could not poll progress or pull the result itself — the user checked status and reported back when it finished.

## User Setup Required
`NEXT_PUBLIC_WHATSAPP_OPERADOR` — operator-provided real WhatsApp number (E.164, no `+`), not invented per D-19. The button renders and degrades gracefully without it; only the `wa.me` link itself is non-functional until set.

## Next Phase Readiness
- 03-03 (privileged `/admin/clientes` action layer) and 03-04 (invite-accept page) are independent of this plan's UI work — no blockers.
- 03-05 (admin-facing `/admin/clientes` screens) will reuse the badge/date-formatting patterns established here.

---
*Phase: 03-panel-de-cliente*
*Completed: 2026-09-30*
