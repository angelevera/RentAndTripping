---
phase: 03-panel-de-cliente
verified: 2026-09-30T14:30:00Z
status: human_needed
score: 4/4 must-haves verified
covered_files:
  - ".planning/REQUIREMENTS.md"
  - ".planning/phases/03-panel-de-cliente/03-01-PLAN.md"
  - ".planning/phases/03-panel-de-cliente/03-01-SUMMARY.md"
  - ".planning/phases/03-panel-de-cliente/03-02-PLAN.md"
  - ".planning/phases/03-panel-de-cliente/03-02-SUMMARY.md"
  - ".planning/phases/03-panel-de-cliente/03-03-PLAN.md"
  - ".planning/phases/03-panel-de-cliente/03-03-SUMMARY.md"
  - ".planning/phases/03-panel-de-cliente/03-04-PLAN.md"
  - ".planning/phases/03-panel-de-cliente/03-04-SUMMARY.md"
  - ".planning/phases/03-panel-de-cliente/03-05-PLAN.md"
  - ".planning/phases/03-panel-de-cliente/03-05-SUMMARY.md"
  - "app/admin/clientes/[id]/page.tsx"
  - "app/admin/clientes/page.tsx"
  - "app/auth/confirm/route.ts"
  - "app/cliente/actions.ts"
  - "app/cliente/completar-cuenta/actions.ts"
  - "app/cliente/lista-reservas-cliente.tsx"
  - "app/cliente/page.tsx"
  - "app/login/actions.ts"
  - "lib/auth/require-admin.ts"
  - "lib/auth/require-cliente.ts"
  - "lib/clientes/detalle.ts"
  - "lib/clientes/invitar.ts"
  - "lib/clientes/vincular.ts"
  - "lib/reservas/listar-cliente.ts"
  - "proxy.ts"
  - "supabase/migrations/20260929020000_estado_invitacion_clientes.sql"
covered_digest: "v1:sha256:1cb9555e6dc97f4ed23a6ba5eb17eefb57c77cae059f1d93aa03b6521fbfccd9"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Editar la plantilla de correo 'Invite user' en Supabase Dashboard (Authentication > Email Templates) para que el enlace sea {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/cliente/completar-cuenta, y confirmar que el origen de la app está en Redirect URLs."
    expected: "Sin este cambio manual, el enlace del correo real no llega a /auth/confirm y el cliente invitado no puede completar su cuenta. Es la única pieza que ningún test ni el código pueden hacer."
    why_human: "Es configuración del Dashboard de Supabase, fuera del repositorio (03-04-SUMMARY.md, sección Pending)."
  - test: "Verificar rentntrippin.com en Resend (DNS en Namecheap). Después, correr los 2 casos e2e condicionales con RESEND_DOMINIO_VERIFICADO=1 (tests/e2e/clientes-lista.test.ts), y quitar adminConEnvioSimulado() de tests/auth/invitar-cliente.test.ts y tests/rls/vincular-reservas.test.ts."
    expected: "invitarCliente()/reenviarInvitacion() a través de la Server Action real envían un correo de verdad y los 2 casos condicionales pasan."
    why_human: "Depende de DNS/proveedor externo. Con el remitente sandbox de Resend solo se puede enviar al dueño de la cuenta; ningún test automático observa la entrega real (03-03 D7)."
  - test: "Flujo completo con un correo real: el admin invita un cliente desde /admin/clientes, el cliente abre el correo, pulsa el enlace, elige contraseña, entra por /login y llega a /cliente."
    expected: "El cliente aterriza en /cliente y ve solo sus reservas. Si el enlace venció, ve 'Este enlace ya venció. Pídele al operador que te mande la invitación de nuevo.'"
    why_human: "Integración con correo real y navegador; solo se puede hacer después de los dos puntos anteriores."
  - test: "Configurar NEXT_PUBLIC_WHATSAPP_OPERADOR (número del operador en formato E.164 sin '+') en .env.local y en las variables de Vercel. Con un cliente sin reservas, pulsar el botón 'Escríbenos por WhatsApp'."
    expected: "Abre WhatsApp directo al operador con el mensaje 'Hola, quiero planificar un viaje'. Sin la variable el href queda como https://wa.me/?text=..., que no funciona. No aparece documentada en .env.example ni en scripts/check-env.sh."
    why_human: "El número real lo provee el operador (D-19); no se inventa ni se documenta."
  - test: "Revisión visual en celular real de /cliente (con reservas, con historial y vacío), /admin/clientes y /admin/clientes/[id]."
    expected: "Diseño morado de marca, tarjetas en móvil y tabla en escritorio, sin desbordes, textos en español venezolano cálido."
    why_human: "Apariencia y sensación de uso no se comprueban con grep ni con tests HTTP."
---

# Phase 3: Panel de cliente Verification Report

**Phase Goal:** Cada cliente tiene su propia cuenta para ver sus reservas y su historial, sin tener que escribirle al admin por WhatsApp para preguntar "¿cómo va mi reserva?".
**Verified:** 2026-09-30
**Status:** human_needed
**Re-verification:** No, verificación inicial

## Goal Achievement

El objetivo está logrado en el código. Ninguna verdad quedó FAILED. El estado es `human_needed` porque hay configuración externa que solo el operador puede hacer: plantilla de correo en Supabase, dominio en Resend, número de WhatsApp.

### Observable Truths (Success Criteria del ROADMAP, más los must_haves de los planes)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: el cliente inicia sesión con una cuenta creada/invitada por el admin y ve solo sus reservas, nunca las de otro cliente | VERIFIED | `app/login/actions.ts` redirige `customer` a `/cliente`. `requireCliente()` protege la página (compone `getSessionStatus()`). `listarReservasCliente()` filtra `.eq("cliente_id")` y la RLS "reservas: el cliente ve las suyas" (`auth.uid() = cliente_id`, solo `select`) es el límite real. `tests/rls/aislamiento-clientes.test.ts` (A ve solo lo suyo) pasa dentro de test:db 61/61, que corrí yo. Invitación real: `lib/clientes/invitar.ts` + `/auth/confirm` + `/cliente/completar-cuenta` (`verifyOtp`, luego `updateUser({password})`). |
| 2 | SC2: el cliente ve el detalle de cada reserva: tipo, fecha, estado y precio | VERIFIED | `app/cliente/lista-reservas-cliente.tsx` muestra tipo (etiqueta), `fecha_importante`, badge de estado del proveedor, badge de pago (derivado de `pagos.estado='confirmado'`), monto USD/VES y "Para: viajero" (D-14/D-15). No hay página de detalle aparte; el detalle son las filas/tarjetas de la lista, y cubre los cuatro campos. El e2e `cliente-login.test.ts` tiene casos para cada uno. |
| 3 | SC3: cliente y admin ven el historial de reservas pasadas | VERIFIED | Cliente: `dividirPorFecha()` separa Próximas / Historial (fecha < hoy en Caracas). Admin: `/admin/clientes/[id]` lista todas las reservas vinculadas (`listarReservasDeCliente`, todas, sin filtrar por fecha, con `requireAdmin()`). El admin no las separa por pasado/próximo; el historial está completo pero en una sola lista (ver Advertencias). `tests/rls/reservas-de-cliente.test.ts` pasa. |
| 4 | SC4 (WR-01): contraseña incorrecta y cuenta válida sin acceso son indistinguibles, y un cliente válido entra | VERIFIED | `iniciarSesion` es una rama de tres vías. `invalid_credentials` y "otro rol" devuelven la misma constante `MENSAJE_CREDENCIALES_INVALIDAS` ("Correo o contraseña incorrectos."), sin redirect delator. En "otro" hace `signOut` local. `admin` va a `/admin`, `customer` a `/cliente`. `profiles.role` tiene CHECK `admin|customer`, así que "otro" es solo defensivo. El test e2e compara admin y cliente con contraseña mala y comprueba que no hay cookie `-auth-token`. Un cliente válido llega a `/cliente` (e2e). |
| 5 | Plan 03-03 a 03-05: invitar, reenviar, vincular y desvincular reservas huérfanas (D-04 a D-12), con badge "Invitación pendiente" en la misma lista | VERIFIED | `lib/clientes/invitar.ts` y `lib/clientes/vincular.ts` (match exacto separado de la búsqueda parcial). `app/admin/clientes/{page,lista-clientes,boton-reenviar,invitar-cliente-form}`. `[id]/{boton-vincular,boton-desvincular,buscador-huerfanas}`. Migración `clientes_estado_invitacion` con `security definer`, `set search_path=''`, `is_admin()` interno y revoke a `public, anon`. Tests db (vincular, invitar, estado-invitacion) pasan. |

**Score:** 4/4 criterios del ROADMAP verificados, más 1 must_have de plan. 0 behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/login/actions.ts` | Fix WR-01, tres ramas | VERIFIED | Sustantivo y conectado a `getSessionStatus`. |
| `lib/auth/require-cliente.ts` | Guardia de cliente | VERIFIED | Compone `getSessionStatus` (no duplica la consulta a `profiles`). Usado en `app/cliente/page.tsx` y `app/cliente/actions.ts`. |
| `lib/reservas/listar-cliente.ts` | Lectura con scope de cliente | VERIFIED | Datos reales de Supabase. No selecciona la nota interna del proveedor. |
| `app/cliente/page.tsx`, `lista-reservas-cliente.tsx`, `actions.ts` | Panel completo | VERIFIED | Sin stubs. Estados vacío, error y skeleton presentes. |
| `components/whatsapp-cta.tsx` | CTA aislado, punto de reemplazo de Fase 6 | VERIFIED | Único archivo que construye `wa.me`. |
| `app/auth/confirm/route.ts` | Intercambio de token, sin open redirect | VERIFIED | `destinoSeguro` rechaza `//`, `\`, caracteres de control. |
| `app/cliente/completar-cuenta/*` | Formulario de contraseña | VERIFIED | Exige sesión y muestra el mensaje de enlace vencido. Excepción exacta en `proxy.ts`. |
| `lib/supabase/admin.ts` | Cliente de servicio confinado | VERIFIED | Un solo importador (`lib/clientes/invitar.ts`). |
| `app/admin/clientes/**` | Lista y detalle admin | VERIFIED | `requireAdmin()` en página y acciones. Enlace "Clientes" en `/admin`. |
| `supabase/migrations/20260929020000_estado_invitacion_clientes.sql` | RPC solo admin | VERIFIED | `lib/database.types.ts` regenerado y test db pasa contra la base real (migración aplicada). |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `/login` action | `/cliente` | `getSessionStatus()` en rama `customer` | WIRED |
| `app/cliente/page.tsx` | `listarReservasCliente` | `ListaReservasCliente` con `clienteId` de `requireCliente()` | WIRED |
| Correo de invitación | `/auth/confirm` | plantilla del Dashboard | NOT VERIFIABLE (manual, ver human_verification) |
| `/auth/confirm` | `/cliente/completar-cuenta` | `verifyOtp`, luego `redirect(destinoSeguro)` | WIRED |
| `/admin/clientes` | `invitarCliente` / `reenviarInvitacion` / `vincularReserva` | Server Actions con `requireAdmin()` | WIRED |
| `lista-clientes` | `clientes_estado_invitacion` | `lib/clientes/listar.ts` vía RPC | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `ListaReservasCliente` | `filas` | query `reservas` y `pagos` con la sesión del cliente (RLS) | Sí | FLOWING |
| `ReservasVinculadas` (admin) | `filas` | `listarReservasDeCliente` | Sí | FLOWING |
| `ListaClientes` | filas más badge de invitación | `profiles` más RPC `clientes_estado_invitacion` | Sí | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tipos | `npx tsc --noEmit` | sin errores | PASS |
| Lint | `npx eslint app lib components proxy.ts tests` | sin salida (limpio) | PASS |
| Tests de base (RLS, invitar, vincular, estado) | `npx vitest run --project db` | 11 archivos, 61/61 pasan | PASS |
| e2e `cliente-login` (aislado) | `npx vitest run --project e2e tests/e2e/cliente-login.test.ts` | 9/14 la primera vez. Las fallas son todas `Demasiados intentos` en `loginJar` (límite de Supabase Auth, disparado porque corrí test:db justo antes). En un segundo intento el límite seguía activo. | SKIP (ambiental, no es defecto) |

Los casos e2e que fallaron no llegaron a probar la lógica de la aplicación. El HTML devuelto es el formulario de login con "Demasiados intentos. Espera unos minutos...", que es la rama `429` de `iniciarSesion`. El límite de Supabase Auth con muchos inicios de sesión es un problema conocido del proyecto (MEMORY.md). La evidencia de que los 14 pasan es la corrida reportada por el orquestador y por 03-05-SUMMARY; yo no la reproduje.

### Probe Execution

Sin probes declarados en las fases (Step 7c: no aplica).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-02 | 03-01, 03-03, 03-04 | El cliente inicia sesión y ve solo sus reservas, protegido por RLS | SATISFIED | Login a `/cliente`, guardia, RLS `select` por `cliente_id`, `aislamiento-clientes.test.ts` (db 61/61), invitación por correo. La entrega real del correo queda como human_verification. |
| RESA-05 | 03-02 | Detalle de cada reserva (tipo, fecha, estado, precio) | SATISFIED | `lista-reservas-cliente.tsx`, dos badges, monto, "Para:". |
| RESA-06 | 03-02, 03-03, 03-05 | Admin y cliente ven el historial de reservas pasadas | SATISFIED | Cliente: sección Historial. Admin: `/admin/clientes/[id]`. |

Sin requisitos huérfanos: `REQUIREMENTS.md` mapea a la Fase 3 exactamente AUTH-02, RESA-05 y RESA-06, y los tres aparecen en el `requirements:` de algún plan (03-01 AUTH-02; 03-02 RESA-05/06; 03-03 AUTH-02/RESA-06; 03-04 AUTH-02; 03-05 RESA-06).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (fases tocadas) | n/a | `TBD`/`FIXME`/`XXX` | ninguno | grep limpio en app, lib, components, proxy.ts, tests de la fase y la migración. |
| `lib/reservas/listar-cliente.ts` y `lib/clientes/detalle.ts` | n/a | Lógica de "pago derivado" duplicada con `lib/reservas/listar.ts` | Info | Deuda de refactor reconocida en 03-01-SUMMARY. No bloquea. |

### Human Verification Required

Ver la lista completa en el frontmatter (`human_verification`). Resumen:

1. **Plantilla de correo "Invite user" en Supabase Dashboard.** Manual, del operador. Sin ella los correos reales de invitación no funcionan.
2. **Verificar rentntrippin.com en Resend**, luego correr los 2 e2e condicionales con `RESEND_DOMINIO_VERIFICADO=1` y retirar `adminConEnvioSimulado()` de los tests.
3. **Flujo de punta a punta con correo real** (invitar, abrir el enlace, elegir contraseña, entrar a `/cliente`).
4. **Definir `NEXT_PUBLIC_WHATSAPP_OPERADOR`** en `.env.local` y en Vercel (hoy no aparece en `.env.example` ni en `scripts/check-env.sh`).
5. **Revisión visual en celular** de `/cliente`, `/admin/clientes` y `/admin/clientes/[id]`.

### Gaps Summary

Sin gaps que bloqueen el objetivo. Advertencias no bloqueantes:

- **Registro de seguimiento desactualizado (trabajo del orquestador, no un defecto de código):** `ROADMAP.md` aún tiene 03-04 y 03-05 sin marcar y la Fase 3 como "[ ]". `REQUIREMENTS.md` marca AUTH-02, RESA-05 y RESA-06 como Pending. Hay que actualizarlos al cerrar la fase.
- **Historial del admin sin separar:** `/admin/clientes/[id]` muestra todas las reservas vinculadas en una sola lista ordenada por creación, sin separar pasadas y próximas. El historial completo sí es visible, así que SC3 se cumple. Un corte "pasadas" sería una mejora, no un requisito.
- **e2e no reproducido por mí:** el límite de Supabase Auth me bloqueó los casos que inician sesión. La verificación independiente cubre tsc, lint, test:db 61/61 y lectura del código. La afirmación de "e2e por archivo pasan" queda apoyada en 03-05-SUMMARY y en el orquestador.
- **Diferencia mínima observable en WR-01:** la rama "otro rol" hace `signOut` local, así que podría emitir un `Set-Cookie` de borrado que la contraseña incorrecta no emite. Mensaje y comportamiento visible son idénticos, y esa rama es hoy inalcanzable por el CHECK de `profiles.role`. Sin acción necesaria.

---

_Verified: 2026-09-30_
_Verifier: Claude (gsd-verifier)_
