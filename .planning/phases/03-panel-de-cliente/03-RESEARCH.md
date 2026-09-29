# Phase 3: Panel de cliente - Research

**Researched:** 2026-09-29
**Domain:** Next.js 16 App Router + Supabase Auth (customer accounts, invite flow, RLS) on top of an existing single-admin codebase
**Confidence:** MEDIUM — the RLS/auth architecture is HIGH confidence (verified directly against this repo's own code and migrations), but the Supabase Admin invite/resend-invite mechanics are a genuine, documented API gap with no official fix, so that slice is MEDIUM/LOW and flagged accordingly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Login compartido y fix de WR-01 (criterio de aceptación de esta fase)**
- **D-01:** Contraseña incorrecta y "cuenta válida pero sin acceso" deben verse **indistinguibles desde afuera** — mismo mensaje, mismo comportamiento visible (sin redirect chain delatador). Instrucción explícita del usuario: esto es criterio de aceptación de la Fase 3, no una nota aparte. — **Reversibility:** costly.
- **D-02:** Mensaje unificado exacto: mantener el texto actual **"Correo o contraseña incorrectos."** para ambos casos — no se crea un mensaje nuevo.
- **D-03:** Un cliente válido que inicia sesión llega a **`/cliente`** (ruta corta, paralela a `/admin`).

**Vincular reservas existentes a una cuenta de cliente**
- **D-04:** Vinculación híbrida: coincidencia **exacta** de correo (o correo+teléfono) → vínculo automático. Coincidencia parcial/dudosa o sin coincidencia → candidatas para vincular a mano con un clic. — **Reversibility:** reversible.
- **D-05:** El admin también puede buscar y vincular manualmente en cualquier momento después.
- **D-06:** La acción de vincular vive en una **nueva sección `/admin/clientes`** — lista de cuentas de cliente; también sirve para RESA-06.
- **D-07:** Se puede **desvincular** una reserva mal vinculada con un clic (`cliente_id` vuelve a NULL).
- **D-08:** La búsqueda de reservas huérfanas admite **nombre, correo o teléfono del pagador** (coincidencia parcial), mismo patrón que la búsqueda de la lista de Fase 2.

**Cómo se crea/invita la cuenta del cliente**
- **D-09:** Mecanismo: **invitación por correo con enlace** (Supabase Auth invite) — el cliente elige su propia contraseña.
- **D-10:** Si el cliente no confirma en un tiempo razonable, el admin debe poder **ver que sigue pendiente y reenviar**, en `/admin/clientes`, misma lista con badge "Invitación pendiente" y botón de reenviar.
- **D-11:** El admin puede **invitar a un cliente nuevo sin reserva previa** — botón "Invitar cliente" independiente.
- **D-12:** Si el correo ya tiene cuenta, mostrar mensaje claro y no duplicar la invitación.

**Alcance: reservas de familiares / viajero distinto al pagador**
- **D-13:** El pagador ve **todas** las reservas donde su cuenta es `cliente_id`, sin importar el viajero — consecuencia directa de RLS, no requiere lógica nueva.
- **D-14:** Cuando el viajero es distinto del pagador, mostrar **"Para: [nombre del viajero]"**.
- **D-15:** El detalle de cada reserva (RESA-05) muestra **ambos estados**: proveedor y pago.
- **D-16:** El panel de cliente **separa** reservas activas/próximas (arriba) de historial pasado (abajo), según `fecha_importante`.

**Estado vacío de `/cliente`**
- **D-17:** Estado vacío con estilo de marca (morado, limpio), texto tipo "¿A dónde quieres ir?" / "Planifica tu próxima aventura".
- **D-18:** CTA es un botón/enlace que abre **WhatsApp directo** con mensaje predefinido "Hola, quiero planificar un viaje".
- **D-19:** El número real de WhatsApp queda como **variable de configuración pendiente** (`NEXT_PUBLIC_WHATSAPP_OPERADOR`) — no se documenta ni se inventa.

**Delegación a Codex**
- **D-20:** Cada `PLAN.md` marca tareas de código para `/codex:rescue` por defecto. Claude implementa directamente solo: migraciones que tocan secretos, decisiones de seguridad (WR-01, D-01/D-02), o lo que el PLAN.md marque explícitamente como no delegable.
- **D-21:** Instrucción estándar para Codex: nunca leer/imprimir `.env.local` ni `.env.admin.local` — verificar variables solo con `scripts/check-env.sh`.
- **D-22:** Antes de cerrar tareas delegadas: Anti-Slop + `gsd-code-review` (nunca `/thermos`, solo disparable por el usuario).
- **D-23:** Selección de modelo: Haiku (mecánico), Sonnet (default), Opus (solo si el plan lo justifica explícitamente — arquitectura de alto riesgo o seguridad).

### Claude's Discretion
- Estructura técnica exacta de cómo `/admin/clientes` lista y pagina cuentas de cliente — seguir el patrón de tabla/tarjetas + paginación de Fase 2.
- Detalles de UI/diseño visual exacto del panel `/cliente` y `/admin/clientes` — `UI hint: yes`; considerar `/gsd-ui-phase 3` si hace falta más detalle del que este documento captura.
- Implementación técnica exacta del fix de WR-01 (dónde se hace la comprobación unificada, cómo se estructura el redirect) — el usuario fijó el comportamiento observable (D-01, D-02), no la implementación.

### Deferred Ideas (OUT OF SCOPE)
- **Punto de conexión explícito Fase 3 ↔ Fase 6:** el botón de WhatsApp del estado vacío de `/cliente` (D-18) debe diseñarse como un componente de CTA aislado para que Fase 6 (asistente de cotización por chat) pueda reemplazarlo sin tocar nada más de esta fase. No implementar el asistente ahora.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-02 | El cliente puede iniciar sesión y ver solo sus propias reservas (RLS, no solo ocultado en la interfaz) | RLS policy already exists and is verified (`reservas: el cliente ve las suyas`); this phase's work is the login redirect fix (WR-01 redesign) + `requireCliente()` guard + `/cliente` route. See "Architecture Patterns" and "Common Pitfalls" below. |
| RESA-05 | El cliente puede ver el detalle de cada una de sus reservas (tipo, fecha, estado, precio) | `lib/reservas/listar.ts` already derives `pagado`; this phase extends/reuses that pattern scoped to `cliente_id = auth.uid()`, adds the dual-status display (D-15). See "Code Examples". |
| RESA-06 | Admin y cliente pueden ver el historial de reservas pasadas por cliente | Client-side: split by `fecha_importante` (D-16). Admin-side: new `/admin/clientes/[id]` detail view reusing `listarReservas`-style query filtered by `cliente_id`. See "Architecture Patterns". |
</phase_requirements>

## Summary

This phase's engineering core is not "build a new feature" — it's **safely making customer accounts real for the first time** in a codebase whose entire security model (`/login` as shared gate, `requireAdmin()`, RLS) was built and tested around a single admin. Three things drive the plan:

1. **WR-01's redesign is now simple, not hard.** The Phase 1 reviewer's literal fix (reject non-admin logins) was correctly rolled back because it broke the product's real design: `/login` is a shared gate for both roles. Now that customers are a first-class role with a real destination, the fix is a **three-way branch inside `iniciarSesion`** (admin → `/admin`, customer → `/cliente`, anything else → the same generic error as a wrong password), not a reject-non-admin gate. This eliminates the credential-oracle WR-01 described (no more "authenticate then bounce" two-hop) while trivially satisfying "un cliente válido puede iniciar sesión sin que ese arreglo lo bloquee."

2. **The Supabase Admin invite API has a real, unfixed limitation directly in D-10's path**: calling `inviteUserByEmail()` (or `generateLink({type:'invite'})`) a second time for an email that was already invited but hasn't confirmed returns `"A user with this email address has already been registered"` — there is no supported "resend" for an unconfirmed invite. This is not a training-data guess; it is corroborated by a still-open Supabase Auth GitHub issue and matches this project's own installed SDK, whose `resend()` method's documented `type` values (`signup`, `email_change`, `sms`, `phone_change`) do not include `invite`. The pragmatic, low-risk MVP fix is **delete the unconfirmed `auth.users` row, then re-invite** (safe because nothing depends on it yet — `profiles.id` cascades on delete, verified from this repo's own migration).

3. **Using the Supabase Admin API (invite, resend, and reading `auth.users.invited_at`/`email_confirmed_at` for the "pending" badge) requires the service-role/secret key inside a running Server Action** — and this project's Phase 1 architecture explicitly documented that `.env.admin.local`/`SUPABASE_SECRET_KEY` is **never** loaded by the Next.js app, only by CLI scripts and tests. This phase must consciously and narrowly break that boundary (a new `.env.local` var, a new server-only admin client module used only by the two/three privileged Server Actions). Per this project's own delegation policy, that is a decision that touches secrets/security and **must be implemented directly by Claude, not delegated to Codex**.

**Primary recommendation:** Redesign `iniciarSesion` as a role-branching action (not a reject-gate); read/write Supabase Admin Auth operations from one new `lib/supabase/admin.ts` (secret-key, server-only, narrowly scoped); prefer a `SECURITY DEFINER` SQL function over the secret key for the read-only "who's pending" list, to keep the secret key confined to the two mutation actions (invite, resend-via-delete-reinvite).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login role routing (admin vs. customer vs. reject) | API / Backend (Server Action) | — | `iniciarSesion` in `app/login/actions.ts` is the single place credentials are checked; must not leak role info via redirect-chain differences. |
| `/cliente` page authorization | API / Backend (Server Component + guard) | Database (RLS) | `requireCliente()` guard (new, mirrors `requireAdmin()`) is UX; RLS (`reservas: el cliente ve las suyas`) is the real boundary — already exists, unchanged. |
| Reservation data scoping (own reservations only) | Database (RLS) | API / Backend | Postgres RLS is the enforced boundary (AUTH-02 explicitly requires row-level security, not UI filtering); the Server Component query is a convenience layer on top. |
| Invite / resend-invite / delete-stale-invite | API / Backend (privileged Server Action, secret key) | — | Only GoTrue's Admin REST API can send auth emails; must run server-side with the service-role key, never client-reachable. |
| "Invitación pendiente" badge (read-only) | Database (SQL `SECURITY DEFINER` function) preferred, or API / Backend (secret key) as fallback | — | Reading `auth.users.invited_at`/`email_confirmed_at` doesn't require GoTrue's REST API — Postgres can read the `auth` schema directly, avoiding secret-key exposure for a read-only list. |
| Reserva ↔ cliente linking/unlinking (D-04–D-08) | API / Backend (Server Action) | Database (RLS: admin-only writes on `reservas`) | Existing `reservas: el admin gestiona todas` RLS policy already covers `UPDATE cliente_id`; no new policy needed, just new Server Actions. |
| Empty-state WhatsApp CTA | Browser / Client | — | Static `wa.me` link with a query-string message; no server logic, isolated component per the Fase 3↔6 connection point. |

## Standard Stack

No new external packages are required for this phase — every capability is covered by dependencies already installed and verified working in Phases 1–2.

### Core (already installed, reused)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.117.2 [VERIFIED: node_modules/@supabase/supabase-js/package.json] | Auth Admin API (`auth.admin.inviteUserByEmail`, `deleteUser`, `getUserById`), RLS-scoped queries | Same client the whole project already uses; Admin API only needs a service-role-keyed instance, not a new package. |
| `@supabase/ssr` | ^0.12.7 [VERIFIED: package.json] | Cookie-based session for the new `/cliente` route and `requireCliente()` guard | Already the sole session mechanism in this codebase (`lib/supabase/server.ts`); no new package needed. |
| `zod` | ^4.6.5 [VERIFIED: package.json] | New schemas: invite-email form, search/link-reserva form | Same pattern as `lib/validation/auth.ts`/`lib/validation/reservas.ts`. |
| `react-hook-form` + `@hookform/resolvers` | ^7.89.0 / ^5.9.1 [VERIFIED: package.json] | Invite-cliente form, búsqueda de reservas huérfanas | Reuse `login-form.tsx`'s `useActionState` + `zodResolver` pattern. |
| shadcn/ui components | already installed (`style: "radix-nova"`) [VERIFIED: components.json] | Table/Card/Badge/Skeleton for `/admin/clientes`; new components as needed for `/cliente` | Reuse the Phase 2 theme tokens (brand purple `#482583` already wired into `--primary`); do not reinitialize shadcn. |

### Supporting — new server-only module (no package, just new code)
| Module | Purpose | When to Use |
|---------|---------|-------------|
| `lib/supabase/admin.ts` (new) | Service-role Supabase client, `server-only`, reads `SUPABASE_SECRET_KEY` | Only inside the invite/resend/delete-stale-invite Server Actions in `app/admin/clientes/actions.ts` — never anywhere else. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Delete-unconfirmed-user + re-invite (resend workaround) | `supabase.auth.resetPasswordForEmail()` as a substitute "resend" | A community PR ([Contour-Digital/Wedding-Planner-App#9]) uses this pattern, but Supabase's own docs don't confirm `resetPasswordForEmail` sends mail for an **unconfirmed** account (the anti-enumeration behavior is explicitly undocumented for that case) — delete+reinvite is simpler to reason about and verifiably safe (cascade delete, verified from this repo's migration) [ASSUMED — recommend the planner add a `checkpoint:human-verify` to confirm actual mailer behavior against the live Supabase project before relying on this in production]. |
| `SECURITY DEFINER` SQL function for "pending invite" list | Call `admin.listUsers()` from the same privileged Server Action used for invite/resend | Simpler code (one client, one place) at the cost of using the secret key for a read that doesn't strictly need it — reasonable simplification for a single-maintainer MVP if the planner prefers fewer moving parts; either is defensible, but note the tradeoff explicitly in the plan. |
| New `/admin/clientes` route section (D-06, locked) | Add link/unlink UI inside the existing reserva edit form | Rejected by the user's decision (D-06) — do not revisit. |

**Installation:** None — no `npm install` needed this phase.

## Package Legitimacy Audit

Not applicable — this phase introduces no new external packages. All capabilities are covered by dependencies already verified and installed in Phases 1–2 (see Standard Stack above).

## Architecture Patterns

### System Architecture Diagram

```
Browser (customer)                    Browser (admin)
       |                                     |
       v                                     v
  POST /login (form-login)            /admin/clientes (Server Component)
       |                                     |
       v                                     v
  iniciarSesion() Server Action        requireAdmin() guard (existing, unchanged)
       |                                     |
       | signInWithPassword()                v
       | (Supabase Auth)              listarClientes() query
       |                              (profiles role='customer'
       v                               + RPC/admin-client for
  role lookup (getSessionStatus-       "invitación pendiente")
  style, reused/extended)                     |
       |                                     v
   +---+----+----+                    Table/Card list, badge
   |        |    |                    "Invitación pendiente" +
   v        v    v                    "Reenviar" button
 admin  customer  else (same
   |        |      generic error      Click "Invitar cliente" -->
   v        v      as wrong pw)       invitarCliente() Server Action
 /admin  /cliente                     (lib/supabase/admin.ts,
                                        service-role key)
                                              |
                                              v
                                        auth.admin.inviteUserByEmail()
                                              |
                                              v
                                    Postgres trigger on_auth_user_created
                                    creates public.profiles row
                                    (role='customer' default)
                                              |
                                              v
                              Click "Reenviar" (still pending) -->
                              reenviarInvitacion() Server Action
                                 delete unconfirmed auth.users row
                                 --> re-invite (fresh invited_at)

/cliente page (Server Component)
       |
       v
  requireCliente() guard (new, mirrors requireAdmin())
       |
       v
  Query reservas WHERE cliente_id = auth.uid()   <-- RLS enforces this
  regardless of query filters (AUTH-02's real boundary)
       |
       v
  Split by fecha_importante: activas/próximas (top) | historial (bottom)  (D-16)
       |
       v
  Empty? --> Brand empty state + isolated WhatsApp CTA component (D-17/D-18,
             swappable by Phase 6 without touching anything else)
```

### Recommended Project Structure
```
app/
├── cliente/
│   └── page.tsx                  # /cliente — requireCliente() guard, lista + detalle inline
├── admin/
│   └── clientes/
│       ├── page.tsx               # /admin/clientes — lista de cuentas + búsqueda
│       ├── actions.ts             # invitarCliente, reenviarInvitacion, vincular/desvincular reserva
│       ├── [id]/
│       │   └── page.tsx           # detalle de un cliente: reservas vinculadas + huérfanas candidatas (RESA-06 admin side)
│       └── lista-clientes.tsx     # tabla/tarjetas, badge "Invitación pendiente"
lib/
├── auth/
│   └── require-cliente.ts         # nuevo, compone getSessionStatus-equivalente (mirror de require-admin.ts)
├── supabase/
│   └── admin.ts                   # NUEVO — server-only, SUPABASE_SECRET_KEY, solo para invite/resend
├── clientes/
│   ├── listar.ts                  # lista de profiles role='customer' + estado de invitación
│   ├── vincular.ts                # búsqueda de reservas huérfanas + vincular/desvincular
│   └── invitar.ts                 # invitarCliente/reenviarInvitacion (llama a lib/supabase/admin.ts)
└── reservas/
    └── listar-cliente.ts          # variante de listar.ts scoped a cliente_id = auth.uid(), split activas/historial
components/
└── whatsapp-cta.tsx                # NUEVO — CTA aislado (D-18), reemplazable por Fase 6 sin tocar /cliente
```

### Pattern 1: Login role-branch (WR-01 redesign — replaces the reverted Phase 1 fix)

**What:** After a successful `signInWithPassword()`, look up the caller's role once and branch to exactly one of three outcomes — never "authenticate, then bounce from a second page."
**When to use:** `app/login/actions.ts` `iniciarSesion`, replacing the current unconditional `redirect("/admin")`.
**Why this satisfies D-01/D-02/D-03 without repeating the Phase 1 regression:** the Phase 1 attempt failed because it treated "not admin" as "reject the login" — which is wrong now that `customer` is a legitimate, first-class destination, not an error state. The redesign below has **no reject case for a real role** — only an unrecognized/missing-profile case (which should not occur given the `role` CHECK constraint, but is handled defensively with the same generic message as a wrong password, satisfying D-01's "indistinguibles desde afuera" for the one remaining edge case). Because every legitimate credential match now leads to a genuine, working destination, there is no oracle: a credential-stuffing attacker who gets a "wrong password" response never learns anything about whether an account exists, and a valid customer is never blocked.

```ts
// Source: derived from this repo's own lib/auth/require-admin.ts pattern
// (getSessionStatus, read this session — VERIFIED) + the reverted WR-01 fix
// attempt documented in 01-REVIEW-FIX.md (read this session).
const { error } = await supabase.auth.signInWithPassword(resultado.data);

if (error) { /* ...existing handling, unchanged (D-02 message)... */ }

// Un solo lookup de rol, igual al de getSessionStatus() en require-admin.ts
// (o una función compartida factorizada de ahí) — nunca dos consultas
// independientes que puedan divergir.
const { data: perfil } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", (await supabase.auth.getClaims()).data!.claims!.sub)
  .single();

if (perfil?.role === "admin") redirect("/admin");
if (perfil?.role === "customer") redirect("/cliente");

// Caso defensivo (no debería ocurrir dado el CHECK constraint de role):
// mismo mensaje que contraseña incorrecta, sesión cerrada.
await supabase.auth.signOut({ scope: "local" });
return { error: "Correo o contraseña incorrectos." };
```

**Regression check for the planner:** re-run (or extend) `tests/e2e/admin-access.test.ts`'s "redirects a signed-in customer requesting /admin to /login?motivo=sin-acceso" test — that test logs a customer in via `/login` and then makes a **separate** request to `/admin`, so it is unaffected by this redesign (it tests `requireAdmin()`'s page-level guard, not the login action's redirect target). Add a new e2e assertion that a customer login redirects to `/cliente` specifically (not just "doesn't error").

### Pattern 2: `requireCliente()` guard, composed the same way as `requireAdmin()`

**What:** Mirror `lib/auth/require-admin.ts`'s `cache()`-memoized `getSessionStatus()` pattern, but for the customer role.
**When to use:** Every Server Component/Action under `/cliente`.
**Example (verified pattern from `lib/auth/require-admin.ts`, read this session):**
```ts
// The existing getSessionStatus() in require-admin.ts already returns a
// three-way discriminated result: {status:'none'|'not-admin'|'admin', session?}.
// D-03 needs a customer-equivalent. Two defensible options for the planner:
//
// Option A (recommended): extend getSessionStatus() to return the actual role
// ('admin'|'customer') instead of a boolean-like 'not-admin', and derive both
// requireAdmin() and requireCliente() from the same single query — this is
// exactly the WR-03 lesson already learned and fixed once in this codebase
// (see 01-REVIEW-FIX.md, "requireAdmin() duplicated getAdminSession()'s logic").
// Do not reintroduce that duplication for the customer guard.
//
// Option B: a separate requireCliente() that repeats the query — rejected,
// same anti-pattern WR-03 already fixed.
```

**Anti-Patterns to Avoid**
- **Two independent role-check implementations (admin's and customer's):** this codebase already paid down this exact debt once (WR-03). Do not reintroduce it for `requireCliente()`.
- **Calling `inviteUserByEmail()` a second time to "resend":** verified via the installed SDK's own `resend()` method (whose documented `type` values do not include `invite`) and a still-open Supabase Auth GitHub issue — this errors with "A user with this email address has already been registered." Use delete-then-reinvite instead (see Pitfall 2).
- **Reading `SUPABASE_SECRET_KEY` anywhere outside `lib/supabase/admin.ts`:** this project's Phase 1 architecture deliberately keeps the service-role key out of the app runtime (`.env.admin.local` is loaded only by CLI scripts/tests, per `.env.example`'s own comment, read this session). This phase must narrowly and consciously break that boundary — confine the new env var and its only consumer to one file.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sending an invite email with a working accept-and-set-password link | A custom email + token table | `supabase.auth.admin.inviteUserByEmail()` (D-09, already the decided mechanism) | GoTrue already implements the token, expiry, and the `updateUser({password})` completion flow; reinventing this is exactly the kind of "custom auth solution" Next.js's own docs (read this session) warn is easy to get subtly wrong. |
| Detecting "customer never confirmed the invite" | A new `pendiente` column on `profiles`, manually kept in sync | Read `auth.users.invited_at` / `email_confirmed_at` directly (already tracked by Supabase Auth, verified in the installed SDK's `User` type) | Avoids a second source of truth that can drift from what Supabase Auth actually knows. |
| Row-level "customer sees only their own reservations" | Application-level `WHERE cliente_id = ...` filtering only | The existing RLS policy `reservas: el cliente ve las suyas` (already in production, unchanged this phase) | AUTH-02 explicitly requires this be enforced at the row-security level, not just hidden in the UI — and it already is; this phase's job is to stop leaking role info at login, not to touch RLS. |

**Key insight:** almost nothing in this phase is "build a feature from scratch" — it's composing primitives (Supabase Auth invite, existing RLS, existing `require-admin.ts` pattern) that either already exist in this codebase or are one well-documented Supabase Auth call away. The actual risk in this phase is architectural discipline (not duplicating the role-check logic, not letting the service-role key leak beyond one file), not missing functionality.

## Runtime State Inventory

> Trigger: this phase changes login behavior (all real users, admin and future customers, pass through it) and introduces the first real customer accounts. Not a rename/refactor, but touches enough runtime state to warrant the same discipline.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no existing customer accounts exist yet in the live Supabase project; this phase is the first to create real `role='customer'` `auth.users` rows via invite. Existing `reservas` rows all have `cliente_id IS NULL` (per Phase 2's migration, verified) except test fixtures. | None — no data migration needed; D-04's hybrid linking is new application logic operating on already-nullable data, not a backfill. |
| Live service config | Supabase Auth email templates (invite email) — configured in the Supabase Dashboard, not in git. `redirectTo` for the invite link must point at a real page in this app that completes the flow (calls `updateUser({password})`) — that page does not exist yet. | New page (e.g. `/cliente/completar-cuenta` or similar) must be built as part of this phase's invite flow; verify the Dashboard's invite email template's `{{ .ConfirmationURL }}` points at it via `redirectTo`. |
| OS-registered state | None found — no scheduled tasks, no pm2/systemd units reference login/customer logic. | None. |
| Secrets/env vars | New requirement: `SUPABASE_SECRET_KEY` must become readable by the running Next.js app (currently, per `.env.example`'s own comment read this session, it is loaded **only** by CLI scripts/Vitest via `.env.admin.local`, never by the app). This is a genuine architecture change from Phase 1, not a pre-existing gap. | Add `SUPABASE_SECRET_KEY` to `.env.local` (not `.env.admin.local`), consumed by exactly one new server-only file (`lib/supabase/admin.ts`). This is a secrets-touching decision — per D-20, Claude implements this directly, not Codex. |
| Build artifacts / installed packages | None — no new packages, no renamed packages. | None. |

## Common Pitfalls

### Pitfall 1: Reintroducing WR-01 by rejecting non-admin logins instead of branching to a valid destination

**What goes wrong:** A tempting "obvious" fix is to check `role === 'admin'` and reject anything else at login — this is literally what was tried and reverted in Phase 1 (`01-REVIEW-FIX.md`, read this session), because it breaks a real customer's ability to log in at all.
**Why it happens:** WR-01's original description ("credential oracle") reads like "block non-admin logins," but the actual fix needed is "give every real role a real destination" — the oracle disappears because there's no longer a distinguishable error state for a valid non-admin account.
**How to avoid:** Implement the three-way branch in Pattern 1 above (admin/customer/defensive-generic-error), never a two-way admin/reject branch.
**Warning signs:** If the new `iniciarSesion` code has an `if (role !== 'admin') { signOut(); return error }` shape anywhere, it has regressed to the reverted fix — check for a `redirect("/cliente")` branch specifically before considering this done.

### Pitfall 2: Assuming `inviteUserByEmail()` (or `generateLink({type:'invite'})`) can be safely called twice for "resend"

**What goes wrong:** The second call for the same still-unconfirmed email returns an error ("A user with this email address has already been registered"), so a naive "Reenviar" button implementation that just calls `inviteUserByEmail()` again will silently fail or surface a confusing error to the admin.
**Why it happens:** GoTrue's `/invite` endpoint is designed for creating new users, and treats the already-created-but-unconfirmed `auth.users` row from the first invite as "already registered" — this is a documented, still-open limitation (Supabase Auth GitHub issue #2180, "Resending of invitation email doesn't work"), not a misconfiguration in this project.
**How to avoid:** For "Reenviar" (D-10), delete the unconfirmed `auth.users` row via `admin.deleteUser(id)` first, then call `inviteUserByEmail()` fresh. This is safe in this codebase specifically because `public.profiles.id references auth.users(id) on delete cascade` (verified, `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql:20`, read this session) — deleting an unconfirmed user's `auth.users` row cleanly removes the orphaned `profiles` row too, and nothing else references an unconfirmed customer yet (no reservations can be linked to an account that never logged in).
**Warning signs:** An admin clicking "Reenviar" gets a generic 500/error toast, or the invite silently does nothing — both are symptoms of calling the invite endpoint directly on an already-invited address.

### Pitfall 3: Letting the service-role key leak beyond the two privileged Server Actions

**What goes wrong:** Once `SUPABASE_SECRET_KEY` is available to the running app (a new requirement this phase, see Runtime State Inventory), it becomes easy to reach for it elsewhere "since it's already there" — e.g., using it to simplify the "list clientes with pending badge" read path instead of the RLS-scoped anon client or a `SECURITY DEFINER` function.
**Why it happens:** The service-role key bypasses RLS entirely, so any code that touches it silently stops being protected by the row-security model this project relies on everywhere else.
**How to avoid:** Confine the secret key's only consumer to `lib/supabase/admin.ts`, imported only from the invite/resend Server Actions (and, if the planner chooses the simpler alternative from "Alternatives Considered," also the pending-list read — but nowhere else). Mark this file's purpose in a comment the same way `lib/supabase/server.ts` documents its own scope.
**Warning signs:** `SUPABASE_SECRET_KEY` or `lib/supabase/admin.ts` imported from any file outside `app/admin/clientes/`.

### Pitfall 4: Linking a reserva to the wrong customer via a loose partial match

**What goes wrong:** D-04's "coincidencia exacta" auto-link path must never fire on a partial/fuzzy match (e.g., same first name, similar phone) — that would silently expose one customer's reservation data to another customer's account, a direct AUTH-02 violation.
**Why it happens:** "Exact" and "partial" are easy to conflate in a single search query if the same `ilike` pattern is reused for both the auto-link check and the candidate-search UI (D-08).
**How to avoid:** Auto-link (D-04) must use exact equality (`=`) on `pagador_email` (or `pagador_email` + `pagador_telefono` together), never `ilike`. The candidate/partial search (D-08) is a **separate** query, explicitly requiring the admin's manual click to confirm — never auto-applied.
**Warning signs:** A single shared query/function used for both the "auto-link on invite" path and the "show candidates" search UI.

## Code Examples

### Extending the search pattern (D-08) to correo/teléfono, not just nombre

The existing `listarReservas()` (`lib/reservas/listar.ts`, read this session) only searches `pagador_nombre`:
```ts
// Source: lib/reservas/listar.ts:63 (read this session) — the existing
// pattern this phase's "buscar reservas huérfanas" (D-08) must extend, not
// just reuse as-is: D-08 explicitly requires correo and teléfono too.
if (q) conteo = conteo.ilike("pagador_nombre", `%${escaparPatronLike(q)}%`);
```
A new `buscarReservasHuerfanas()` (or an extended `listarReservas` option) needs an `.or()` filter across all three columns, still passing every value through the same `escaparPatronLike()` helper already in `lib/reservas/parametros-lista.ts` (read this session) to avoid `LIKE` metacharacter injection:
```ts
// Pattern to follow — Postgrest .or() syntax, each term still escaped:
const patron = `%${escaparPatronLike(q)}%`;
consulta = consulta
  .is("cliente_id", null)
  .or(`pagador_nombre.ilike.${patron},pagador_email.ilike.${patron},pagador_telefono.ilike.${patron}`);
```

### Populating `profiles.nombre` automatically on invite

The existing trigger (verified, `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql:96-104`, read this session) already reads `nombre` from `raw_user_meta_data`:
```sql
insert into public.profiles (id, nombre, email)
values (
  new.id,
  new.raw_user_meta_data ->> 'nombre',
  new.email
);
```
So `invitarCliente()` should pass the admin-entered name through `options.data`, no migration needed:
```ts
// Source: node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js:148-163
// (read this session) — options.data becomes raw_user_meta_data server-side,
// which the existing trigger above already reads into profiles.nombre.
await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  data: { nombre },
  redirectTo: `${baseUrl}/cliente/completar-cuenta`,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Next.js Middleware (`middleware.ts`) | Next.js Proxy (`proxy.ts`) | Next.js 16 (confirmed: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, read this session — "Starting with Next.js 16, Middleware is now called Proxy") | Already correctly adopted in this repo (`proxy.ts` at root). This phase must extend its matcher/logic to also optimistically redirect anonymous `/cliente` requests, the same way it already does for `/admin`. |

**Deprecated/outdated:** N/A for this phase's scope — no library upgrades needed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Delete-unconfirmed-user-then-reinvite is a safe, working substitute for "resend invite" against the live Supabase Auth mailer (no documented official alternative exists). | Pitfall 2, Alternatives Considered | If Supabase's mailer behaves differently than assumed (e.g., rate-limits repeated invites to the same address, or the delete doesn't fully clear server-side invite state), D-10's "reenviar" button could silently fail. Recommend a `checkpoint:human-verify` task early in execution to confirm this against the real project before building the full UI around it. |
| A2 | `resetPasswordForEmail()` is NOT a reliable substitute for resending an invite to an unconfirmed account (Supabase's anti-enumeration behavior for unconfirmed accounts is undocumented). | Alternatives Considered | Low risk — this assumption only affects which of two designs the planner picks; the recommended path (delete+reinvite) does not depend on this being right. |
| A3 | No existing customer (`role='customer'`) `auth.users` rows exist in the live Supabase project yet (only test fixtures). | Runtime State Inventory | If wrong, D-04's "hybrid linking" logic needs to run once against real historical reservations at rollout, which is a one-time operational step, not a code change — low risk, but worth an explicit human check before/at UAT. |

## Open Questions

1. **Does the Supabase Dashboard's invite email template's default `redirectTo` handling work out of the box, or does this project need to configure it explicitly?**
   - What we know: `inviteUserByEmail(email, { redirectTo })` accepts an explicit `redirectTo` (verified in the installed SDK).
   - What's unclear: Whether this project's Supabase project has "Additional Redirect URLs" configured to allow a `/cliente/completar-cuenta` (or equivalent) URL — Phase 1's `scripts/configure-auth.mjs` handled some Auth configuration already and should be checked/extended.
   - Recommendation: the planner should have a task read `scripts/configure-auth.mjs` (not reviewed in depth in this research) to see if redirect URL allow-listing is already automated there, and extend it if not.

2. **Should the "pending invite" list read use the secret-key admin client (simpler) or a `SECURITY DEFINER` SQL function (more consistent with this project's existing security architecture)?**
   - What we know: Both are technically viable; the SQL-function approach mirrors the already-established `private.is_admin()` pattern.
   - What's unclear: No user decision was captured on this specific implementation choice (correctly left to "Claude's Discretion" per CONTEXT.md).
   - Recommendation: prefer the SQL function (keeps secret-key surface area minimal, consistent with this project's existing defense-in-depth pattern), but either is acceptable — flag the choice explicitly in the PLAN.md so it's a visible decision, not an implicit one.

## Environment Availability

Skipped — this phase has no new external tool/service dependencies beyond the already-configured, already-verified-working Supabase project and Next.js/Vercel toolchain from Phases 1–2. The one new "dependency" (service-role key reachable by the app) is a configuration/architecture change, not a new external tool, and is covered in Runtime State Inventory above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.2 [VERIFIED: package.json], with `db`, `e2e` projects already configured (`vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --project db tests/rls` (fast RLS/isolation checks) |
| Full suite command | `npm test` (note: per project memory, the full suite reliably rate-limits on Supabase Auth sign-in volume alone — this is a known, accepted environment characteristic from Phase 2's UAT, not a defect to chase) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-02 | Customer logs in, lands on `/cliente`, sees only own reservations | e2e | `npx vitest run --project e2e tests/e2e/cliente-login.test.ts` | ❌ Wave 0 — new file, follow `tests/e2e/admin-access.test.ts`'s `submitForm`/`CookieJar` pattern |
| AUTH-02 | RLS isolation between two customer accounts (already covered structurally, extend for the new login-redirect behavior) | db/rls | `npx vitest run --project db tests/rls/aislamiento-clientes.test.ts` | ✅ exists, covers RLS itself; login-redirect-to-`/cliente` behavior is new and needs the e2e test above |
| AUTH-02 (WR-01 fix) | Wrong password and "defensive generic error" case are indistinguishable; valid customer never blocked | e2e | `npx vitest run --project e2e tests/e2e/admin-login.test.ts` (extend) or new file | ❌ Wave 0 — extend existing or new assertions for the three-way branch |
| RESA-05 | Client sees tipo/fecha/estado/precio + dual status (proveedor + pago) for own reservations | e2e or db | new test | ❌ Wave 0 |
| RESA-06 | Client and admin both see historial pasado, split correctly by `fecha_importante` | e2e | new test | ❌ Wave 0 |
| D-04/D-08 | Auto-link exact match, candidate search partial match, never cross-links | db | new test, following `aislamiento-clientes.test.ts`'s "reread with serviceClient" pattern | ❌ Wave 0 |
| D-10 | Resend invite (delete+reinvite) doesn't error, `invited_at` refreshes | db/integration | new test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project db tests/rls` (fast, no auth rate-limit exposure)
- **Per wave merge:** `npx vitest run --project e2e` (accept the known Supabase Auth rate-limit risk on the full e2e project, same as Phase 2's accepted UAT gap — do not chase it)
- **Phase gate:** Full suite green before `/gsd-verify-work`, with the Phase 2-established caveat that a single full `npm test` run may still hit the rate limit — split into `db`/`e2e` project runs if needed, per project memory.

### Wave 0 Gaps
- [ ] `tests/e2e/cliente-login.test.ts` — covers AUTH-02 login-redirect and WR-01's three-way branch
- [ ] `tests/rls/vincular-reservas.test.ts` (or extend `aislamiento-clientes.test.ts`) — covers D-04/D-07/Pitfall 4 (no cross-customer leakage via linking)
- [ ] `tests/db/invitar-cliente.test.ts` (or similar) — covers D-10/D-12/Pitfall 2 (resend workaround, duplicate-invite message)
- [ ] Extend `tests/helpers/fixtures.ts` with a `createReservaSinCuentaFixture`-style helper that also exercises `pagador_email`/`pagador_telefono` exact-match scenarios for D-04's auto-link tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (`signInWithPassword`, `inviteUserByEmail`) — already the project's standard, unchanged mechanism this phase, just a new role-branch on top. |
| V3 Session Management | yes | `@supabase/ssr` cookie-based sessions, unchanged this phase — `requireCliente()` composes the same session-status pattern as `requireAdmin()`. |
| V4 Access Control | yes | Postgres RLS (`reservas: el cliente ve las suyas`, already exists and enforces AUTH-02's actual boundary) + page-level guards (`requireAdmin()`/`requireCliente()`) as UX-layer defense in depth, consistent with `proxy.ts`'s own documented philosophy ("El proxy NUNCA decide el rol... eso es trabajo de la página... más RLS en Postgres, que es el límite real"). |
| V5 Input Validation | yes | `zod` schemas for the new invite-email form and búsqueda de reservas huérfanas, following `lib/validation/auth.ts`/`lib/validation/reservas.ts`. |
| V6 Cryptography | no (delegated) | Password hashing, invite tokens, and session tokens are entirely Supabase Auth's responsibility — never hand-rolled in this codebase. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential-stuffing oracle via role-based redirect differences (the original WR-01) | Information Disclosure | Pattern 1 above — collapse every non-success case to the identical generic message/behavior; only a genuine, working destination (`/admin` or `/cliente`) is a distinguishable success. |
| Cross-customer data leakage via a loose "linking" match (D-04) | Information Disclosure / Tampering | Pitfall 4 — exact equality only for auto-link, RLS already prevents a linked customer from reading another's data regardless, but the *linking write itself* must not misassign a reservation to the wrong `cliente_id` in the first place. |
| Secret-key (`SUPABASE_SECRET_KEY`) scope creep once it's in the app runtime | Elevation of Privilege | Pitfall 3 — confine to one file, one narrow set of Server Actions; never import from anything client-reachable (enforced by `server-only`, same pattern as `lib/supabase/server.ts`). |
| Enumeration via "correo ya tiene cuenta" message (D-12) | Information Disclosure | D-12 is an explicit, user-approved exception scoped to the **admin-only** `/admin/clientes` surface (the admin already knows which emails they're inviting) — this is not the same surface as the public `/login` form, so it does not reopen the WR-01 class of issue. Confirm in the plan that this message never appears on any customer-facing/public route. |

## Sources

### Primary (HIGH confidence)
- This repository's own code, read directly this session: `app/login/actions.ts`, `lib/auth/require-admin.ts`, `lib/reservas/listar.ts`, `lib/reservas/parametros-lista.ts`, `lib/validation/auth.ts`, `lib/validation/reservas.ts`, `app/login/login-form.tsx`, `app/admin/reservas/actions.ts`, `app/admin/reservas/lista-reservas.tsx`, `app/admin/page.tsx`, `proxy.ts`, `.env.example`, `package.json`, `components.json`, `lib/database.types.ts`, `tests/helpers/fixtures.ts`, `tests/e2e/admin-access.test.ts`, `tests/rls/aislamiento-clientes.test.ts`.
- Supabase migrations, read directly this session: `20260927000001_perfiles_y_rol_admin.sql`, `20260927000002_reservas_pagos_recordatorios.sql`, `20260929012532_pagador_viajero_reservas.sql`.
- This project's own prior phase artifacts, read directly this session: `.planning/phases/01-base-y-acceso-seguro/01-REVIEW.md` (WR-01 original diagnosis), `.planning/phases/01-base-y-acceso-seguro/01-REVIEW-FIX.md` (WR-01 fix attempt and why it was reverted), `.planning/phases/02-gesti-n-de-reservas-admin/02-UI-SPEC.md`.
- Installed SDK source, read directly this session: `node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.js` (`inviteUserByEmail`, `generateLink`), `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` (`resend`, `resetPasswordForEmail`), `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts` (`User` interface: `invited_at`, `confirmed_at`, `email_confirmed_at`).
- Next.js 16 docs, bundled in this project's own `node_modules` (per this repo's `AGENTS.md` instruction to read these before writing code, this session): `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

### Secondary (MEDIUM confidence)
- [Supabase Auth GitHub Issue #2180 — "Resending of invitation email doesn't work"](https://github.com/supabase/auth/issues/2180) — corroborates the `inviteUserByEmail()`/`generateLink({type:'invite'})` double-call failure, cross-checked against this project's own installed SDK's `resend()` docstring (which omits `invite` from its supported types).
- [Contour-Digital/Wedding-Planner-App PR #9 — "Fix 'Resend invite' silently doing nothing for stuck invitees"](https://github.com/Contour-Digital/Wedding-Planner-App/pull/9) — community-documented workaround pattern (check `email_confirmed_at`, branch to a fresh link), used here only as corroboration that this is a known, real gap, not as the recommended implementation (this research recommends delete+reinvite instead, for verifiability against this project's own cascade-delete schema).

### Tertiary (LOW confidence)
- General WebSearch results on `resetPasswordForEmail` behavior for unconfirmed accounts — inconclusive, flagged as Assumption A2, not relied upon in the primary recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, every capability traced to already-installed, already-verified dependencies.
- Architecture (RLS/auth guard patterns): HIGH — directly verified against this repo's own code and migrations, not training-data recall.
- Architecture (invite/resend mechanics): MEDIUM/LOW — genuine, documented upstream API gap with no official Supabase fix; recommendation is a defensible workaround, not a verified-safe official pattern, hence Assumption A1.
- Pitfalls: HIGH for WR-01/RLS-related pitfalls (grounded in this project's own Phase 1 review history); MEDIUM for the invite-resend pitfall (grounded in external, corroborated but non-official sources).

**Research date:** 2026-09-29
**Valid until:** 30 days (stable stack, no fast-moving dependencies in scope) — but re-verify the Supabase Admin invite/resend behavior (Assumption A1) empirically against the live project before relying on it in execution, since it is the one LOW-confidence area in this research.
