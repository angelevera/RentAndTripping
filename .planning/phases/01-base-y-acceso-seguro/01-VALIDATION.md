---
phase: "1"
slug: "base-y-acceso-seguro"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-09-27"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed in Wave 0, Plan 01-01 Task 2), run against the **hosted** Supabase project with users seeded through the secret key. There is no local pgTAP: Docker is unavailable (RESEARCH A3). |
| **Config file** | `vitest.config.ts` (created in Wave 0) with projects `db` (tests/rls, tests/auth) and `e2e` (tests/e2e; its globalSetup starts `next dev` on a free port with admin secrets stripped) |
| **Quick run command** | `npm run test:db` (RLS + auth against the hosted DB) |
| **Full suite command** | `npm test` (both projects; e2e uses the real /login form with no JavaScript) |
| **Estimated runtime** | ~150 seconds (db ~40 s; e2e ~110 s including dev-server start and first compile) |

---

## Sampling Rate

- **After every task commit:** Run the test file that task touched (`npx vitest run --project db <file>` or `npm run test:e2e`)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green, and `npm run db:migrations` must show every migration applied remotely
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | AUTH-01 | T-01-SC | Only human-approved packages are installed | checkpoint (blocking-human) | n/a (human gate) | n/a | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-01 | T-01-04 | Secret files are git-ignored and never loaded by the app | build + config | `npm run build && npx tsc --noEmit && npx vitest run --passWithNoTests && npm run db:migrations` | ❌ W0 (created here) | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-01 | T-01-01/02/03/06 | Real form login → /admin; anonymous /admin → /login; profiles RLS live | e2e (tracer) | `npm run test:e2e` | ❌ W0 → tests/e2e/admin-login.test.ts | ⬜ pending |
| 1-02-01 | 02 | 2 | AUTH-01 | T-01-09/11/13 | A customer never sees /admin; two devices; ≥30-day cookie; per-device logout | e2e | `npm run test:e2e` | ❌ → tests/e2e/admin-access.test.ts | ⬜ pending |
| 1-02-02 | 02 | 2 | AUTH-01 | T-01-10/14/15/16 | Sign-up closed; the single real admin is gabbovera@gmail.com; session settings at their defaults | integration (db) | `npx vitest run --project db tests/auth` | ❌ → tests/auth/auth-hardening.test.ts | ⬜ pending |
| 1-03-01 | 03 | 2 | AUTH-01 | T-01-17..24 | Every new table has RLS in the same migration; bucket private | static + dry-run | `npx supabase db push --dry-run` (via admin env) + RLS grep loop | n/a | ⬜ pending |
| 1-03-02 | 03 | 2 | AUTH-01 | — | [BLOCKING] schema pushed; types generated from the live DB | CLI | `npm run db:migrations && grep -c recordatorios lib/database.types.ts` | n/a | ⬜ pending |
| 1-03-03 | 03 | 2 | AUTH-01 | T-01-17..24 | Cross-customer isolation, no role self-promotion, nothing for anonymous callers, private and immutable proofs | integration (db) | `npx vitest run --project db tests/rls` | ❌ → tests/rls/*.test.ts | ⬜ pending |
| 1-04-01 | 04 | 3 | AUTH-01 | — | Root → /admin; brand tokens; logo | e2e + build | `npm run build && npm run test:e2e` | ✅ (extends admin-login) | ⬜ pending |
| 1-04-02 | 04 | 3 | AUTH-01 | T-01-25/26/27/28 | Same message for unknown email and wrong password; server-side validation without JS | e2e | `npm run test:e2e && npm run lint` | ✅ (extends admin-login) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` (dev dependency) + `vitest.config.ts` with projects `db` and `e2e`. Env loaded via `loadEnv('admin', …)` from `.env.local` + `.env.admin.local` (Plan 01-01 Task 2)
- [ ] `tests/helpers/fixtures.ts`: namespaced `rt-test-` users via the secret key, cleanup plus a 30-minute stale sweep, `CookieJar`, `submitForm` (no-JS form posts with Server Action hidden inputs) (Plan 01-01 Task 2)
- [ ] `tests/e2e/global-setup.ts`: starts `next dev` on a free port with admin secrets stripped, or uses `E2E_BASE_URL` (Plan 01-01 Task 2)
- [ ] `.env.admin.local` holding `SUPABASE_SECRET_KEY` and the other admin secrets. Git-ignored and never auto-loaded by Next.js (Plan 01-01 Task 2)
- [ ] `tests/e2e/admin-login.test.ts`, written RED before the tracer code (Plan 01-01 Task 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Package legitimacy approval | AUTH-01 | Supply-chain gate; never auto-approvable | Plan 01-01 Task 1: compare each package's repository and downloads on npmjs.com, then reply "aprobado" |
| Real admin logs in on a phone-sized screen and sees the branded panel | AUTH-01 (SC1) | Visual/mobile feel | Plan 01-04 Task 2 human-check: 375px viewport, sign in as gabbovera@gmail.com, check logo and purple button, wrong-password message, logout |
| Session still open the next day (D-01) | AUTH-01 | The e2e suite cannot wait a day; only the cookie lifetime (≥30 days) is automated | Reopen the same browser the next day; /admin opens without asking for the password |
| Data model sign-off before Phase 2 (RESEARCH A2) | AUTH-01 (SC3) | Business-model fit | Plan 01-03 Task 1 human-check: read "Modelo de datos para revisar" in 01-03-SUMMARY.md and confirm or request changes |
| Access-token refresh after expiry | AUTH-01 | No deterministic way to force a JWT expiry in the e2e suite (flagged assumption FA-1) | Covered by the proxy calling getClaims (static check) plus the next-day check above |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the only exception is the blocking-human legitimacy checkpoint, which is exempt)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (vitest, fixtures, global-setup, secret split, first e2e test)
- [x] No watch-mode flags (every command uses `vitest run`)
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter (planner-asserted; `/gsd-validate-phase` sets status to validated)

**Approval:** {pending / approved YYYY-MM-DD}
