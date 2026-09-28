---
phase: 01-base-y-acceso-seguro
plan: 03
subsystem: [database]
tags: [supabase, postgres, rls, storage]
requires:
  - {phase: "01-base-y-acceso-seguro", provides: "public.profiles table, private.is_admin(), tests/helpers/fixtures.ts"}
provides:
  - "public.reservas / public.pagos / public.recordatorios live in the hosted project, RLS + GRANTs enabled in the same migration that creates each table"
  - "Private storage bucket comprobantes with folder-scoped, customer-immutable RLS policies"
  - "lib/database.types.ts generated from the live schema (proof the push happened)"
  - "tests/helpers/fixtures.ts extended with signInAs, createReservaFixture, trackStoragePath and dependency-ordered cleanup"
  - "4 RLS integration test files proving cross-tenant isolation, no role self-promotion, zero anonymous access, and private/immutable payment proofs"
affects: ["02-reservas", "03-panel-cliente", "04-pagos"]
coupling_justified: ["01-02: both plans use the same hosted Supabase project. 01-02 imports tests/helpers/fixtures.ts read-only; 01-03 only ADDS exports and extends cleanup, keeping every existing signature."]
actuals:
  tokens: 11811
  tasks: 3
  commits: 3
  plan_head_before: 977029d7d828d6da5a98dc56d358de981256b24f
tech-stack:
  added: []
  patterns:
    - "private.set_updated_at() trigger function, mirroring private.is_admin()'s SECURITY DEFINER + empty search_path pattern from Plan 01-01"
    - "Explicit per-table GRANTs alongside RLS on every new table (Data API 'Automatically expose new tables' is OFF on this project)"
    - "Storage folder-scoping via (storage.foldername(name))[1] = auth.uid()::text, no customer UPDATE/DELETE policy so an uploaded proof is immutable"
    - "Check constraint (moneda = 'USD' or tasa_cambio is not null) enforces the multi-currency rule at the schema level, not in application code"
    - "on delete restrict from pagos to reservas (not cascade) so a reserva with payments can never be deleted silently"
    - "Fixture cleanup ordered storage -> recordatorios -> pagos -> reservas -> users, because pagos.reserva_id and reservas.cliente_id both restrict/no-action on delete"
key-files:
  created:
    - supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql
    - supabase/migrations/20260927000003_comprobantes_privados.sql
    - lib/database.types.ts
    - tests/rls/aislamiento-clientes.test.ts
    - tests/rls/perfiles-rol.test.ts
    - tests/rls/anonimo.test.ts
    - tests/rls/comprobantes.test.ts
  modified:
    - tests/helpers/fixtures.ts
key-decisions:
  - "precio + moneda (not RESEARCH's single precio_usd) on reservas, USD default — lets a reserva be quoted in VES while keeping USD canonical"
  - "on delete restrict from pagos to reservas (not RESEARCH's cascade) — a reserva with payments can never disappear silently, preserving the financial dispute trail"
  - "recordatorios has no customer read policy (RESEARCH proposed one) — it is an internal send queue; customers learn of changes by email once Phase 5 ships, on least-privilege grounds"
  - "comprobantes has no customer UPDATE/DELETE policy (RESEARCH proposed FOR ALL) — an uploaded payment proof cannot be overwritten or removed by the customer, since it is dispute evidence"
requirements-completed: []
coverage:
  - id: D1
    description: "Customers cannot read another customer's reservas or pagos, cannot write to either, and recordatorios is admin-only"
    requirement: "AUTH-01"
    verification:
      - {kind: integration, ref: "tests/rls/aislamiento-clientes.test.ts#A lee solo su reserva y solo su pago, y 0 recordatorios", status: pass}
      - {kind: integration, ref: "tests/rls/aislamiento-clientes.test.ts#las inserciones de A en reservas y pagos fallan", status: pass}
      - {kind: integration, ref: "tests/rls/aislamiento-clientes.test.ts#la actualización de A a su propio estado_proveedor y a su propio pago no cambia nada", status: pass}
      - {kind: integration, ref: "tests/rls/aislamiento-clientes.test.ts#los borrados de A no cambian nada", status: pass}
      - {kind: integration, ref: "tests/rls/aislamiento-clientes.test.ts#el admin lee ambas reservas, ambos pagos y ambos recordatorios", status: pass}
    human_judgment: false
  - id: D2
    description: "A VES payment without tasa_cambio, and deleting a reserva with a payment, are rejected even for the admin (schema-level, not role-dependent)"
    requirement: "AUTH-01"
    verification:
      - {kind: integration, ref: "tests/rls/aislamiento-clientes.test.ts#un pago en VES sin tasa_cambio es rechazado, incluso para el admin", status: pass}
      - {kind: integration, ref: "tests/rls/aislamiento-clientes.test.ts#borrar una reserva con un pago es rechazado, incluso para el admin", status: pass}
    human_judgment: false
  - id: D3
    description: "A customer cannot self-promote to admin via direct update, insert, or signup metadata, and is_admin() is not RPC-exposed"
    requirement: "AUTH-01"
    verification:
      - {kind: integration, ref: "tests/rls/perfiles-rol.test.ts#la actualización de A de su propio role a 'admin' no cambia nada (relectura por servicio)", status: pass}
      - {kind: integration, ref: "tests/rls/perfiles-rol.test.ts#la inserción de A en profiles falla", status: pass}
      - {kind: integration, ref: "tests/rls/perfiles-rol.test.ts#A seleccionando profiles obtiene solo su propia fila", status: pass}
      - {kind: integration, ref: "tests/rls/perfiles-rol.test.ts#un usuario creado con user_metadata { role: 'admin' } recibe profiles.role 'customer'", status: pass}
      - {kind: integration, ref: "tests/rls/perfiles-rol.test.ts#rpc('is_admin') a través de publicClient falla, porque la función no está expuesta", status: pass}
    human_judgment: false
  - id: D4
    description: "An anonymous (signed-out) caller reads zero rows across all four tables, cannot insert, and cannot download a real comprobante"
    requirement: "AUTH-01"
    verification:
      - {kind: integration, ref: "tests/rls/anonimo.test.ts#un visitante anónimo lee 0 filas de profiles, reservas, pagos y recordatorios", status: pass}
      - {kind: integration, ref: "tests/rls/anonimo.test.ts#la inserción anónima en reservas falla", status: pass}
      - {kind: integration, ref: "tests/rls/anonimo.test.ts#la descarga anónima de un comprobante existente falla", status: pass}
    human_judgment: false
  - id: D5
    description: "The comprobantes bucket is private, folder-isolated per customer, customer-immutable once uploaded, admin has full access with working signed URLs, and disallowed mime types are rejected"
    requirement: "AUTH-01"
    verification:
      - {kind: integration, ref: "tests/rls/comprobantes.test.ts#el bucket se lee como público false", status: pass}
      - {kind: integration, ref: "tests/rls/comprobantes.test.ts#A puede subir un PNG a su propia carpeta, pero no a la de B", status: pass}
      - {kind: integration, ref: "tests/rls/comprobantes.test.ts#getPublicUrl de un objeto real devuelve un status distinto de 200", status: pass}
      - {kind: integration, ref: "tests/rls/comprobantes.test.ts#B no puede descargar el archivo de A", status: pass}
      - {kind: integration, ref: "tests/rls/comprobantes.test.ts#A puede listar su propia carpeta", status: pass}
      - {kind: integration, ref: "tests/rls/comprobantes.test.ts#el remove de A no elimina el archivo, y el upsert de A sobre él falla", status: pass}
      - {kind: integration, ref: "tests/rls/comprobantes.test.ts#el admin puede descargar el archivo de A y crear una URL firmada que responde 200", status: pass}
      - {kind: integration, ref: "tests/rls/comprobantes.test.ts#subir un archivo text/plain es rechazado", status: pass}
    human_judgment: false
duration: ~35min
completed: 2026-09-28
status: complete
---

# Phase 1 Plan 03: Data Model and RLS Summary

**`reservas`, `pagos` and `recordatorios` now exist in the hosted Supabase project with Row Level Security proven by 23 integration tests, not just hidden behind a screen — cross-customer isolation, no role self-promotion, zero anonymous access, and a private, customer-immutable `comprobantes` bucket, all live before Phase 2 writes a single reservation screen.**

## Performance

- Duration: ~35 min (single sequential dispatch, no checkpoints hit)
- Tasks: 3 (all `type="auto"`, Task 2 was the `[BLOCKING]` schema-push gate)
- Commits: 3 (see Task Commits below; a 4th docs-only commit follows this SUMMARY)
- Files created: 7 (2 migrations, 4 RLS test files, 1 generated types file); files modified: 1 (`tests/helpers/fixtures.ts`)

## Accomplishments

- `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql`: `reservas`, `pagos`, `recordatorios` tables, each with RLS enabled and explicit `GRANT`s in the same file that creates it (this project's Data API has "Automatically expose new tables" OFF, same reasoning as Plan 01-01's `profiles` grant)
- `supabase/migrations/20260927000003_comprobantes_privados.sql`: private `comprobantes` bucket (10 MB limit, jpeg/png/webp/heic/pdf only) with folder-scoped customer policies and full admin access
- Both migrations pushed non-interactively via `npm run db:push` (the `.env.admin.local`-sourced script ran without any interactive prompt) and confirmed applied **Remote** for all three migration versions (`20260927000001`/`002`/`003`)
- `lib/database.types.ts` regenerated from the live database — contains `reservas`, `pagos`, `recordatorios` and `profiles`, proving the push happened
- `tests/helpers/fixtures.ts` extended with `signInAs`, `createReservaFixture`, `trackStoragePath`, and both `cleanupTestUsers`/`sweepStaleTestUsers` now clean up storage objects, recordatorios, pagos, and reservas (in that dependency order) before deleting a test user — all 7 pre-existing exports (`publicClient`, `serviceClient`, `createTestUser`, `cleanupTestUsers`, `sweepStaleTestUsers`, `CookieJar`, `submitForm`) kept their exact signatures
- 4 new RLS test files, 23 tests total, all green on two consecutive runs (confirming cleanup leaves no trace): `aislamiento-clientes.test.ts`, `perfiles-rol.test.ts`, `anonimo.test.ts`, `comprobantes.test.ts`
- `npx tsc --noEmit` clean throughout; full `db` project suite (this plan's 4 files + Plan 01-02's `auth-hardening.test.ts`) passes together: 5 files, 27 tests

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Migrations for reservas, pagos, recordatorios and the private comprobantes bucket | `0a94492` | supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql, supabase/migrations/20260927000003_comprobantes_privados.sql |
| 2 [BLOCKING] | Push to hosted project, regenerate types | `279b003` | lib/database.types.ts |
| 3 | RLS test suite + fixture extensions | `9ed6abc` | tests/helpers/fixtures.ts, tests/rls/aislamiento-clientes.test.ts, tests/rls/perfiles-rol.test.ts, tests/rls/anonimo.test.ts, tests/rls/comprobantes.test.ts |

## Files Created/Modified

**Created:** `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql`, `supabase/migrations/20260927000003_comprobantes_privados.sql`, `lib/database.types.ts`, `tests/rls/aislamiento-clientes.test.ts`, `tests/rls/perfiles-rol.test.ts`, `tests/rls/anonimo.test.ts`, `tests/rls/comprobantes.test.ts`

**Modified:** `tests/helpers/fixtures.ts` (new exports `signInAs`, `createReservaFixture`, `trackStoragePath`; extended `cleanupTestUsers`/`sweepStaleTestUsers` cleanup ordering)

## Decisions Made

- `precio` + `moneda` columns on `reservas` (USD default), replacing RESEARCH.md's single `precio_usd` column — RESA-01 requires both a price and a currency on the reserva itself, and the default keeps USD canonical per PITFALLS Pitfall 3
- `pagos.reserva_id` uses `on delete restrict` (not RESEARCH's `cascade`) — a reserva with payments can never be deleted, so financial records never disappear silently
- `recordatorios` has only an admin policy, dropping RESEARCH's proposed customer-read policy — it is an internal send queue; no requirement needs customer read access, and customers are notified by email once Phase 5 ships
- `comprobantes` storage has no customer UPDATE/DELETE policy, stricter than RESEARCH's proposed `FOR ALL` customer policy — once uploaded, a payment proof is dispute evidence and cannot be altered or withdrawn by the customer
- These four points were already the plan's own considered design (documented in `01-03-PLAN.md`'s task actions), not deviations discovered during execution — implemented exactly as written, no Rule 4 architectural questions arose

## Modelo de datos para revisar

*(Esta sección resume, en español, el modelo de datos para que el dueño del negocio lo confirme antes de que la Fase 2 construya pantallas sobre él — corresponde al `<human-check>` de la verificación de la Tarea 1, que este plan no detiene la ejecución para esperar, según `workflow.human_verify_mode: end-of-phase`. El orquestador la recogerá en el lote de UAT de fin de fase.)*

- **Cada cliente es una cuenta creada por el admin.** No existe registro público — el admin crea la reserva y, según se decida en la Fase 3, invita al cliente por correo para que vea sus reservas. Nadie puede registrarse por su cuenta y aparecer como cliente sin que el admin lo haya originado.
- **Cada reserva tiene un precio y una moneda.** Por defecto la moneda es USD (dólares), que es la moneda de referencia estable del negocio; si hiciera falta cotizar una reserva puntual en bolívares, la columna `moneda` lo permite, pero el dólar sigue siendo la base.
- **Cada pago guarda su propio método, monto y moneda — nunca se colapsan varios pagos en un solo total.** Si el pago es en bolívares, la tasa de cambio usada ese día es obligatoria y queda guardada junto al pago (nunca se pierde el dato de "a qué tasa se calculó esto"). Un pago en dólares nunca necesita tasa.
- **Una reserva que ya tiene pagos registrados no se puede borrar, ni siquiera el admin puede hacerlo por accidente.** Esto protege el registro financiero: nunca desaparece en silencio.
- **Los recordatorios son una cola interna, no algo que el cliente vea directamente en su panel.** El cliente se entera de recordatorios o cambios por correo (a partir de la Fase 5); esta tabla es solo para que el sistema sepa qué avisos programar.
- **Los comprobantes de pago (capturas de Zelle/Binance/etc.) se guardan en un lugar privado, nunca público.** Cada cliente solo puede subir y ver sus propios comprobantes — no puede ver los de otro cliente. Una vez subido, el cliente no puede borrarlo ni reemplazarlo (queda como evidencia si hay una disputa). El admin sí puede ver, gestionar y generar un enlace temporal para revisar cualquier comprobante.

**La pregunta principal para el dueño del negocio:** ¿habrá clientes que nunca tengan cuenta (sin correo)? El modelo actual asume que todo cliente tiene o tendrá un correo para su cuenta — si hay clientes que compran sin dar un correo (por ejemplo, alguien que paga en efectivo una sola vez y nunca vuelve a entrar a la app), el admin necesitaría una forma de registrar esa reserva sin crear una cuenta de cliente, lo cual no está resuelto en este modelo todavía. Vale la pena confirmarlo antes de que la Fase 2 construya la pantalla de creación de reservas.

## Deviations from Plan

None — plan executed exactly as written. The four intentional divergences from `01-RESEARCH.md` listed under "Decisions Made" above were already specified in `01-03-PLAN.md`'s task instructions (not discovered mid-execution), so they are not deviations from *this plan*, only from the earlier research draft — the plan itself flags this explicitly in its `coupling_justified`/task text.

## Issues Encountered

None. `npm run db:push` ran non-interactively on the first attempt (no auth gate, no CLI prompt requiring unsupported flags). No RLS policy gaps were found during Task 3 — all 23 tests passed on the first `npx vitest run` attempt, so no `20260927000004_...` follow-up migration was needed.

## User Setup Required

None — this plan only required the same `.env.admin.local` credentials already verified present before Plan 01-01 started (`./scripts/check-env.sh` confirmed all 7 variables `OK` again before this plan's Task 2).

## Next Phase Readiness

- Phase 2 (reservation screens) can now build `app/actions/reservas.ts` and `app/actions/pagos.ts` directly against `public.reservas`/`public.pagos`, trusting RLS as the real boundary — every admin write already has a policy to hit, and every customer read is already scoped correctly.
- Phase 3 (customer panel) can rely on the `reservas: el cliente ve las suyas` policy exactly as-is; no schema change needed to add the customer-facing "mis reservas" view.
- Phase 4 (payments, proof upload) can build the upload widget directly against the `comprobantes` bucket and its existing folder-scoped policies, and read `pagos.comprobante_path` to resolve a signed URL on render — the storage contract is already proven end-to-end by `tests/rls/comprobantes.test.ts`.
- Flagged for owner confirmation before Phase 2 UI work (see "Modelo de datos para revisar" above): the `reservas`/`pagos`/`recordatorios` schema design, and specifically whether any customer will ever need a reserva without an associated account/email.
- `tests/helpers/fixtures.ts` is stable and ready for Plan 01-04 (and later phases) to keep extending with new exports — never remove/rename the 10 exports that now exist (`publicClient`, `serviceClient`, `createTestUser`, `cleanupTestUsers`, `sweepStaleTestUsers`, `CookieJar`, `submitForm`, `signInAs`, `createReservaFixture`, `trackStoragePath`).

## Self-Check: PASSED

All 7 created files confirmed present on disk (`supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql`, `supabase/migrations/20260927000003_comprobantes_privados.sql`, `lib/database.types.ts`, `tests/rls/aislamiento-clientes.test.ts`, `tests/rls/perfiles-rol.test.ts`, `tests/rls/anonimo.test.ts`, `tests/rls/comprobantes.test.ts`). All 3 task commits confirmed present in `git log --oneline` (`0a94492`, `279b003`, `9ed6abc`).

---
*Phase: 01-base-y-acceso-seguro*
*Completed: 2026-09-28*
