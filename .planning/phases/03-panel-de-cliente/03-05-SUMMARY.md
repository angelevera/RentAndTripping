---
phase: 03-panel-de-cliente
plan: 05
subsystem: admin
requirements: [RESA-06]
provides:
  - public.clientes_estado_invitacion(ids uuid[]) — SECURITY DEFINER, admin-only (migration 20260929020000, applied)
  - lib/clientes/{listar,detalle,parametros-lista}.ts
  - /admin/clientes (list, search, pagination, invite, badge, resend) and /admin/clientes/[id] (history, link/unlink in two blocks)
actuals:
  tasks: 3
  commits: 3
---

# Plan 03-05 Summary — Admin clientes

Task 1 (migration, push, types): Claude. Rest: Codex, audited by Claude + Code Reviewer.

## Verification (run by Claude with network)
- tsc, lint clean.
- test:db 61/61 (incl. new estado-invitacion + reservas-de-cliente + reenvío con reserva vinculada).
- e2e per file: clientes-lista 4 pass + 2 conditional, clientes-detalle 5/5, cliente-login 14/14, completar-cuenta 11/11, reservas-*, admin-login all green. Full-suite e2e run trips the Supabase Auth rate limit (known), so files are run one by one.

## Fixes made after Codex (tests could not run in its sandbox)
- Tests seeded "pending" accounts with the simulated invite (createUser leaves invited_at null); now seeded with generateLink(type "invite").
- "N reservas" rendered as two React text nodes; now one string.
- reservas-de-cliente test shared a customer with a prior case; isolated.
- Reviewer finding: `reenviarInvitacion` (03-03 code) could not delete a pending account with a linked reservation (`reservas.cliente_id` ON DELETE RESTRICT). Now unlinks, deletes, re-invites and re-links; rolls back the unlink if delete fails. Test added.
- Reenviar button hidden when the profile has no email.

## Known limits / follow-ups
- Two e2e cases (invite and resend through the real Server Action) run only with RESEND_DOMINIO_VERIFICADO=1: rentntrippin.com is not yet verified in Resend, so real email sending fails.
- Not applied (low): anon-caller RPC test, hostile search characters test through listarClientes, non-customer profiles absent from list test, pagination test, count of reservations capped by PostgREST 1000-row default at extreme volume, "Invitar cliente" link in empty state only scrolls.
