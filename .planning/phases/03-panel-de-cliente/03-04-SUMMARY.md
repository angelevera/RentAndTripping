---
phase: 03-panel-de-cliente
plan: 04
subsystem: auth

tags: [supabase-auth, verifyOtp, invite, open-redirect]

requires:
  - phase: 03-panel-de-cliente
    provides: "03-01: /cliente + proxy; 03-03: invitarCliente() with redirectTo=/cliente/completar-cuenta"
provides:
  - GET /auth/confirm — exchanges token_hash (type=invite) for a real session; invalid/absent token lands on the same destination
  - /cliente/completar-cuenta — password form only with a session, exact "Este enlace ya venció..." message otherwise
  - guardarContrasena Server Action + shared zod schema (client and server)
affects: [03-05]

actuals:
  tasks: 2
  commits: 1
---

# Plan 03-04 Summary — Completar cuenta (D-09)

Implemented by Codex, audited by Claude + Code Reviewer.

## Files
app/auth/confirm/route.ts, lib/validation/completar-cuenta.ts, app/cliente/completar-cuenta/{page,completar-cuenta-form,actions}.tsx|ts, tests/e2e/completar-cuenta.test.ts, proxy.ts (deviation).

## Deviations
- proxy.ts: exact-match exemption for `/cliente/completar-cuenta` so anonymous visitors see the expired-link message instead of a /login redirect. Reviewer confirmed it is fail-closed (sub-paths and trailing slash still redirect).
- Claude hardened `destinoSeguro` after review: control characters and `\` rejected, resolved with the URL parser (tab bypass `/%09/host` would have escaped the same-site check). Tests now cover `https://`, `//`, `/\`, `/<tab>/` and assert origin.

## Verification
tsc, lint, e2e completar-cuenta 11/11 passed.

## Pending (manual, operator)
Supabase Dashboard: edit the "Invite user" email template to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/cliente/completar-cuenta` and confirm the app origin is in Redirect URLs. Real invitation emails do not work until this is done.

## Reviewer notes not applied
Extra truth-2 coverage (identical status/Location across valid/invalid/absent, consumed-token case) left as low-priority.
