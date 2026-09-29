---
gsd_state_version: "1.0"
current_phase: 03
current_phase_name: Panel de cliente
current_plan: 0
status: ready_to_plan
stopped_at: Phase 02 complete (parcial), ready to plan Phase 03
last_updated: "2026-09-29T14:30:00.000Z"
last_activity: 2026-09-29
last_activity_desc: Phase 02 UAT closed — 6/7 passed, 1 blocked (Supabase Auth rate limit, accepted by owner)
state_head: 94558a8ecfc450cdf60807eb2e43821b69a06b92
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-27)

**Core value:** Que el operador deje de gestionar todo a mano por WhatsApp y tenga un solo lugar para crear reservas, cobrar, confirmar pagos y darles seguimiento — sin perder ninguna.
**Current focus:** Phase 03 — Panel de cliente

## Current Position

Phase: 03 (Panel de cliente) — READY TO PLAN
Current Plan: Not started
Total Plans in Phase: TBD
Status: Ready to plan
Last activity: 2026-09-29 — Phase 02 UAT cerrado (parcial)

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 55min | 3 tasks | 10 files |
| Phase 01 P02 | 45min | 2 tasks | 8 files |
| Phase 01 P03 | 35min | 3 tasks | 8 files |
| Phase 01 P04 | 25min | 2 tasks | 9 files |
| Phase 02 P01 | 95min | 3 tasks | 11 files |
| Phase 02 P02 | 30min | 3 tasks | 27 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: Stack confirmado — Next.js 16 + Supabase + Vercel Pro (Hobby plan prohíbe uso comercial)
- [Research]: Notificaciones/recordatorios vía Resend + Supabase Cron (Supabase solo no envía mensajes)
- [Roadmap]: 5 fases (no 6) — la "prueba real con reservas en vivo" sugerida por la investigación se incorporó como criterio de éxito final de la Fase 5, en vez de ser una fase separada sin requisitos propios
- [Phase 01]: Single hosted Supabase project for dev + automated tests, namespaced rt-test- fixtures with 30-min sweep (FA-4)
- [Phase 01]: shadcn/ui init deferred to Phase 2 UI contract; Task 3 login/admin markup uses plain Tailwind for now
- [Phase 01]: Worktree isolation disabled project-wide because gitignored Supabase secrets are not visible inside an isolated worktree
- [Phase 01]: requireAdmin()/getAdminSession() re-verify claims and profiles.role independently on every call rather than trusting proxy.ts's redirect — the proxy is UX only, RLS + page guard are the real boundary
- [Phase 01]: No custom session-duration, single-session, or forced-logout code added anywhere — D-01/D-02 come entirely from @supabase/ssr and Supabase Auth defaults, verified by npm run auth:configure
- [Phase 01]: Auth-hardening test for signUp rejection asserts error.code === 'signup_disabled' specifically, not just any error, after discovering an unrelated email rate-limit error could produce a false-positive RED
- [Phase 01]: precio+moneda (no precio_usd) en reservas, on delete restrict pagos->reservas, recordatorios sin lectura para clientes, comprobantes sin update/delete para el cliente — todo ya especificado en 01-03-PLAN.md, no descubierto en ejecucion
- [Phase 01]: app/admin/page.tsx dejado sin cambios en 01-04 — ya renderiza correctamente dentro del nuevo layout de marca, sin tocar nada propio
- [Phase 01]: un solo esquema zod (lib/validation/auth.ts) usado tanto por zodResolver en el cliente como por safeParse en el servidor — sin reglas de validación duplicadas
- [Phase 01]: mensaje idéntico en español para contraseña incorrecta y correo desconocido (sin revelar cuentas), con el 429 de Supabase mapeado a un mensaje de límite de intentos distinto
- [Phase 02]: D-01 opción A confirmada por el dueño: datos de pagador/viajero en la reserva, cliente_id opcional para Fase 3; teléfono del viajero obligatorio (D-04) — Puerta de un solo sentido — confirmado explícitamente antes de tocar el esquema
- [Phase 02]: Plan 02-01: primera instalación de anti-slop Oxlint en el repo; helper etiquetaDesde() para lookups de etiqueta por columna text+CHECK — Gate de calidad requerido por política del proyecto antes de dar por completo cualquier tarea delegada a Codex
- [Phase 02]: Plan 02-02: shadcn init requiere --preset en 4.21.0 (no anticipado por la investigación); elegido 'nova' por ser el único cuyo set de paquetes por defecto coincide exacto con la lista aprobada en el gate de Task 1
- [Phase 02]: Plan 02-02: el componente 'form' del PLAN es un stub no funcional en el estilo radix-nova de shadcn 4.21.0 (confirmado contra el registro en vivo); se instaló 'field' en su lugar sin tocar la lista de paquetes aprobados — planes futuros que construyan el formulario de reserva deben componer Field/FieldLabel/FieldError, no Form/FormField
- [Phase 02]: UAT cerrado como `partial` (aceptado por el dueño 2026-09-29) — 6/7 pruebas humanas pasaron, incluyendo la corrección WR-01 (segundo toast en una sesión); la única bloqueada es correr `npm test` completo en una sola corrida, por el límite de tasa de sign-in de Supabase Auth (estructural, no defecto de código, ver [[project_supabase_auth_rate_limit]])
- [Phase 02]: Bug encontrado y corregido durante el UAT: `tests/e2e/global-setup.ts` revisaba `process.env.E2E_BASE_URL` antes de cargar `.env.admin.local` con `loadEnv()`, por lo que la variable nunca se leía — reordenado, `E2E_BASE_URL` ahora sí sobreescribe el servidor de pruebas efímero (commit `8b59e07`)

### Roadmap Evolution

- Phase 6 added: Sitio público de presentación (home) — página sin login, estilo Apple, con quiénes somos y los servicios de Rent & Trippin (pasajes, hoteles, tours, entradas); numerada después del MVP de Fases 1-5, guía de estilo en `idea.md` sección 8. Anotada en ROADMAP.md y PROJECT.md; sin discuss-phase ni plan-phase corridos todavía.

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: Verificar antes de la Fase 1 el patrón exacto de políticas RLS (incluyendo `storage.objects` para comprobantes de pago) — es la decisión de mayor riesgo si se hace mal y es cara de corregir después.
- [Research]: Antes de la Fase 4, hacer una prueba manual del link de pago de Payoneer (mecánica de referencia/nota) — no se ha probado en la práctica, solo documentación general.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| UX | Campo "Nombres de los viajeros": textarea libre → lista de campos individuales con botón "+" por viajero | Deferred | 2026-09-29 (Phase 02 UAT) | v1 |

## Session Continuity

Last session: 2026-09-29T14:30:00.000Z
Stopped at: Phase 02 complete (parcial), ready to plan Phase 03
Resume file: None
