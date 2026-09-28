# Phase 1: Base y acceso seguro - Research

**Researched:** 2026-09-27
**Domain:** Next.js 16 (App Router) + Supabase Auth/Postgres/Storage — foundational schema, Row Level Security, and single-admin authentication
**Confidence:** HIGH (core Next.js 16 / Supabase official docs, cross-checked, one item read directly from published package source) — one MEDIUM item (exact literal SSR client boilerplate) and one LOW item (RLS test harness without Docker) flagged explicitly below.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sesión del admin**
- **D-01:** La sesión del admin debe ser larga (persiste por semanas en su dispositivo de confianza, similar a WhatsApp Web) — no pedir contraseña de nuevo cada día. — **Reversibility:** reversible — es un parámetro de configuración de duración de sesión, se puede acortar después sin migración.
- **D-02:** No hay límite estricto de "un solo dispositivo a la vez" — el admin puede tener sesión abierta en celular y laptop simultáneamente (uso normal, no un caso raro). — **Reversibility:** reversible.

**Cuenta de admin inicial**
- **D-03:** La única cuenta de administrador del MVP se crea con el correo real del operador del negocio: `gabbovera@gmail.com` (no un placeholder). — **Reversibility:** reversible — el email de una cuenta se puede cambiar después si hiciera falta.

### Claude's Discretion
- Los detalles técnicos de cómo se implementa la seguridad de datos (políticas RLS exactas, estructura de la tabla `profiles` con columna `role`, políticas sobre `storage.objects` para comprobantes de pago) quedan a discreción de Claude — el usuario no tiene opinión sobre esto y así fue confirmado en la investigación (ver `research/ARCHITECTURE.md` y `research/PITFALLS.md`).
- No se discutieron ni recuperación de contraseña ni bloqueo por intentos fallidos — el usuario los dejó fuera de la conversación. Para un MVP de un solo admin, usar el comportamiento estándar/por defecto de Supabase Auth para ambos (recuperación de contraseña por correo disponible de fábrica; sin bloqueo agresivo por intentos fallidos más allá del rate-limiting estándar de Supabase) es una discreción razonable.

### Deferred Ideas (OUT OF SCOPE)
Ninguna — la conversación se mantuvo dentro del alcance de la fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | El admin puede iniciar sesión como único usuario administrador | Supabase Auth email+password sign-in via `@supabase/ssr`; `profiles.role='admin'` gate enforced both by RLS (real boundary) and by a route-group layout check (UX nicety); session persistence configuration mapped to D-01/D-02 in "Pattern 3" below; concrete admin-only guard pattern in Code Examples. |

Note: AUTH-02 (cliente inicia sesión y ve solo sus reservas) is Phase 3, but this phase must lay the RLS foundation (`reservas`, `pagos`, `recordatorios`, `profiles` schema + policies) that AUTH-02 will later depend on — this is explicit in the Phase Boundary ("la estructura de datos... ya existe y está protegida a nivel de base de datos").
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Stack is locked: Next.js (App Router) + Supabase + Vercel. No separate backend server, no NextAuth/Auth.js (would duplicate Supabase Auth).
- **Must use `@supabase/ssr`**, never `@supabase/auth-helpers-nextjs` (deprecated, maintenance-only).
- Vercel **Pro**, not Hobby (Hobby prohibits commercial use) — not directly actionable in this phase's code, but note for whoever provisions the Vercel project.
- Payment screenshots must live in a **private** Supabase Storage bucket with RLS + `createSignedUrl()` — never a public bucket. This phase must create that bucket and its policies even though the upload UI itself is Phase 4.
- Single admin, no RBAC system — a `profiles.role` text column (`admin` | `customer`), not a roles/permissions table.
- Brand color `#482583` and mobile-first are UI constraints for later phases; not relevant to this phase's scope (no UI beyond an empty admin shell + login form).

## Summary

This phase has no product UI to speak of — one login form and one empty admin shell — but it is the highest-leverage phase in the whole project: every RLS policy, every table shape, and every session-configuration choice made here is either free to build correctly now or expensive to retrofit once real reservations and payments exist (both `research/PITFALLS.md` and `research/ARCHITECTURE.md` say this explicitly, and this research confirms it at the tooling level too).

Two framework-level findings materially change how this phase should be built compared to older Supabase+Next.js tutorials still circulating on the web. First, **Next.js 16 renamed `middleware.ts` to `proxy.ts`** (confirmed verbatim against the official Next.js docs, current as of v16.3.6) — the file that refreshes the Supabase session on every request must be named `proxy.ts` and export `proxy()`, not `middleware()`. The old name still works with a deprecation warning, but there is no reason for a greenfield project to start on a deprecated convention. Second, **`@supabase/ssr`'s auth cookie has a hardcoded 400-day `maxAge`** that cannot be shortened via `cookieOptions` (confirmed by reading the published package source directly) — which means D-01 ("sesión larga tipo WhatsApp Web") and D-02 (multi-device, no single-session limit) are **already satisfied by the library's and Supabase Auth's own defaults**, with zero custom session-persistence code required. The only real engineering work in this phase is: (1) the Postgres schema + RLS policies, (2) the `proxy.ts`/client/server Supabase wiring, (3) the admin-only route guard, and (4) proving — with an automated test, not a UI screenshot — that RLS actually blocks cross-tenant access.

**Primary recommendation:** Build the full schema (`profiles`, `reservas`, `pagos`, `recordatorios`) and every RLS policy — including the `storage.objects` policies for the (still-empty) `comprobantes` bucket — in the very first migration, using a `private.is_admin()` `SECURITY DEFINER` function (not a direct self-referencing query) to avoid RLS recursion; wire Supabase session handling through `proxy.ts` (not `middleware.ts`); do not touch any session-duration setting (Supabase's and `@supabase/ssr`'s defaults already deliver D-01/D-02); and verify the RLS boundary with a real integration test using two seeded, differently-scoped Supabase Auth users — not just "the UI doesn't show it."

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin credential check (email+password) | API / Backend (Supabase Auth) | — | Supabase Auth is a managed identity provider; the app never sees or stores a password. |
| Session persistence (long-lived, multi-device) | API / Backend (Supabase Auth) + Browser (cookie) | Frontend Server (SSR, via `proxy.ts`) | The refresh token's non-expiry and the auth cookie's 400-day `maxAge` are both library/service defaults; `proxy.ts` running on the Frontend Server tier only *refreshes* the token on each request, it does not own persistence policy. |
| Admin-only route protection | Frontend Server (SSR) | Database (RLS) | The `(admin)` route-group layout check is a fast UX redirect; the **real** boundary is RLS (see next row) — a layout check alone is not authorization. |
| Row-level authorization (who can read/write which row) | Database / Storage (Postgres RLS) | — | Per `research/ARCHITECTURE.md` Anti-Pattern 1 and `research/PITFALLS.md` Pitfall 5: this must be the only trusted boundary, since there is no backend team to catch a bypassed UI check later. |
| Schema for reservas/pagos/recordatorios | Database / Storage | — | Pure data model; no business logic lives here yet (Phase 2+ adds Server Actions on top). |
| Payment-proof file storage | Database / Storage (Supabase Storage + RLS on `storage.objects`) | API / Backend (signed URL generation) | Bucket and policies must exist now (schema-complete requirement); the actual upload/download UI is Phase 4, but the tier that owns access control is Storage/RLS, not the future UI. |
| Empty admin panel shell | Browser / Client (rendered) + Frontend Server (SSR) | — | Purely presentational for this phase — no data fetching beyond "who am I." |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.3.6 [VERIFIED: npm registry, `npm view next version`] | App Router, Server Actions, `proxy.ts` | Already locked in `research/STACK.md`; version reconfirmed current this session. |
| React / React DOM | bundled with Next 16 | UI runtime | No separate decision. |
| TypeScript | 5.7+ available (registry latest 5.9.x line as of this session) [VERIFIED: npm registry] | Type safety | Next.js 16 requires >=5.1.0; a current release avoids known type-checker regressions in older 5.1–5.4 releases. |
| `@supabase/supabase-js` | 2.117.2 [VERIFIED: npm registry] | Supabase client SDK | Underlies both browser and server Supabase clients. |
| `@supabase/ssr` | 0.12.7 [VERIFIED: npm registry] | Cookie-based session handling for App Router | **Do not use `@supabase/auth-helpers-nextjs`** (deprecated). This is the only supported path for Server Components/Actions/`proxy.ts`. |
| Tailwind CSS | v4.x (project-level decision, unchanged) | Styling | Already locked in `research/STACK.md`; no phase-1-specific change. |
| `supabase` (CLI) | 2.118.0 available via `npx supabase` [VERIFIED: npm registry + local `npx supabase --version` run this session] | Migrations, local dev, type generation | Available in this environment via `npx` (no global install found — see Environment Availability). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-hook-form` | 7.89.0 [VERIFIED: npm registry] | Form state for the admin login form | One field pair (email/password) doesn't strictly need it, but installing it now establishes the pattern every later form (reservas, pagos) reuses — cheaper to standardize once than to retrofit. |
| `zod` | 4.6.5 [VERIFIED: npm registry] | Schema validation for the login form, shared client+server | Validate the login payload shape server-side inside the Server Action, not just client-side. |
| `@hookform/resolvers` | 5.9.1 [VERIFIED: npm registry] | Wires `zod` schemas into `react-hook-form` | Auto-detects Zod 4. |
| `shadcn/ui` (CLI, not a runtime dependency) | latest CLI [VERIFIED: npm registry, `shadcn` package exists] | Login form + empty admin shell components (button, input, form, card) | Components are generated into the repo as editable source, not an opaque node_modules dependency — matches the non-technical-maintainer constraint. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple `profiles.role` column + RLS | Supabase Custom Access Token Hook (JWT custom claims) | Only worth it with many admins/complex permissions — one admin doesn't justify the extra Auth-hook configuration surface (already the project-level conclusion in `research/STACK.md`). |
| `proxy.ts` (Next.js 16 convention) | `middleware.ts` (deprecated but still functional) | `middleware.ts` still runs in Next 16 with a deprecation warning — technically works, but there is no reason to start a brand-new project on a convention Next.js is actively moving away from. |
| Hosted-project RLS integration testing | Local Supabase stack (`supabase start`) + pgTAP | pgTAP is the more rigorous, CI-native approach, but it requires Docker, which is **not installed** in this environment (see Environment Availability) — flagged as a phase-blocking-with-fallback item. |

**Installation:**
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint
npm install @supabase/supabase-js @supabase/ssr
npm install react-hook-form zod @hookform/resolvers
npx shadcn@latest init
npx shadcn@latest add button card input label form
npm install -D supabase
```

**Version verification:** All versions above were checked this session with `npm view <package> version` against the live npm registry (2026-09-27). Re-verify at actual scaffold time if more than a few days pass, since `next`, `react`, `@supabase/ssr`, and `zod` all ship frequently.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|--------------|---------|-------------|
| `next` | npm | 2026-09-22 | 67.3M | github.com/vercel/next.js | SUS (`too-new`) | **Approved** — false positive, see note |
| `react` | npm | 2026-09-09 | 203.5M | github.com/react/react | SUS (`too-new`) | **Approved** — false positive |
| `react-dom` | npm | 2026-09-09 | 192.0M | github.com/react/react | SUS (`too-new`) | **Approved** — false positive |
| `typescript` | npm | 2026-07-08 | 329.4M | github.com/microsoft/TypeScript | OK | Approved |
| `@supabase/supabase-js` | npm | 2026-09-25 | 30.2M | github.com/supabase/supabase-js | SUS (`too-new`) | **Approved** — false positive |
| `@supabase/ssr` | npm | 2026-09-08 | 9.4M | github.com/supabase/ssr | SUS (`too-new`) | **Approved** — false positive |
| `tailwindcss` | npm | 2026-07-16 | 147.7M | github.com/tailwindlabs/tailwindcss | OK | Approved |
| `shadcn` | npm | 2026-09-04 | 11.2M | github.com/shadcn-ui/ui | SUS (`too-new`) | **Approved** — false positive |
| `supabase` (CLI) | npm | 2026-09-25 | 5.0M | github.com/supabase/cli | SUS (`too-new`) | **Approved** — false positive |
| `zod` | npm | 2026-09-13 | 335.9M | github.com/colinhacks/zod | SUS (`too-new`) | **Approved** — false positive |
| `react-hook-form` | npm | 2026-09-26 | 66.4M | github.com/react-hook-form/react-hook-form | SUS (`too-new`) | **Approved** — false positive |
| `@hookform/resolvers` | npm | 2026-08-17 | 56.0M | github.com/react-hook-form/resolvers | OK | Approved |

**Note on the `too-new` verdicts:** the legitimacy gate's `too-new` signal fires on the **publish date of the latest version**, not the package's overall age — every flagged package here has an official GitHub repo, tens to hundreds of millions of weekly downloads, and no postinstall script, which is the opposite profile of a slopsquat/hallucinated package. These are simply actively-maintained, extremely popular libraries that happen to have shipped a patch/minor release in the last few weeks. **Disposition: approved without a `checkpoint:human-verify` gate** — but the planner should still note in the install task that a human confirmed these read as legitimate here (an unusually different downloads/repo profile on a re-run of this check would be the actual red flag, not the "too-new" label alone).

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all listed above cleared on manual review (age-of-latest-release false positive); no `checkpoint:human-verify` required for install.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                          │
│  admin visits /login → submits email+password                     │
│  admin visits /admin  (cookie already set on prior request)       │
└───────────────┬─────────────────────────────────────────────────┘
                │ every request
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  proxy.ts  (Next.js 16, Node.js runtime)                          │
│  - calls supabase.auth.getUser() to refresh the session           │
│  - rewrites the refreshed auth cookie onto the outgoing response  │
│  - does NOT decide authorization, only keeps the session alive    │
└───────────────┬─────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  (admin) route-group layout.tsx  (Server Component)               │
│  - reads the session via the server Supabase client               │
│  - if no session OR profiles.role != 'admin' → redirect to /login │
│    (fast UX redirect — NOT the security boundary)                 │
└───────────────┬─────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Login Server Action (app/actions/auth.ts)                        │
│  - validates {email,password} with zod                            │
│  - calls supabase.auth.signInWithPassword()                       │
└───────────────┬─────────────────────────────────────────────────┘
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase                                                          │
│  ┌───────────────┐  ┌─────────────────────────────┐  ┌─────────┐ │
│  │ Auth           │  │ Postgres + RLS                │  │ Storage │ │
│  │ auth.users     │→ │ profiles (role: admin|customer)│  │ private │ │
│  │ (email/pass)   │  │ reservas / pagos / recordatorios│ │ bucket  │ │
│  │                │  │ every table: RLS ON from        │ │ RLS on  │ │
│  │ on INSERT →    │  │ migration #1, is_admin()        │ │ objects │ │
│  │ trigger        │  │ SECURITY DEFINER function        │ │         │ │
│  │ handle_new_user│  │                                  │ │         │ │
│  └───────────────┘  └─────────────────────────────────┘  └─────────┘ │
│  THIS is the real authorization boundary: every query the app makes  │
│  — from any current or future route — is filtered by these policies. │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (this phase's slice only)

```
app/
├── (admin)/
│   ├── layout.tsx            # role=admin guard (UX redirect, not the real boundary)
│   └── page.tsx               # empty admin dashboard shell
├── (auth)/
│   └── login/page.tsx         # email+password form (react-hook-form + zod)
├── actions/
│   └── auth.ts                 # signIn Server Action
├── proxy.ts                    # Next.js 16 — replaces middleware.ts; refreshes Supabase session
lib/
└── supabase/
    ├── client.ts                # createBrowserClient (Client Components only)
    ├── server.ts                 # createServerClient (Server Components/Actions)
    └── proxy.ts                  # updateSession() helper, called from app/proxy.ts
supabase/
├── migrations/
│   └── 0001_schema_and_rls.sql  # profiles, reservas, pagos, recordatorios + every RLS policy + storage policies
└── seed.sql                      # seeds the one admin profile row for local/dev
```

### Pattern 1: `proxy.ts` replaces `middleware.ts` (Next.js 16)

**What:** Next.js 16 renamed the middleware file convention to `proxy.ts`, exporting `proxy(request)` instead of `middleware(request)`. `middleware.ts` still executes (with a deprecation warning) for backward compatibility, but a greenfield project has no reason to start there.
**When to use:** Always for this project — it is being scaffolded on Next 16 from day one.
**Trade-offs:** None functionally; most existing Supabase+Next.js tutorials on the web (written before Next 16 shipped, Oct 2025) still show `middleware.ts` — do not copy them verbatim, rename the export and the file.

**Example** (verified verbatim against Next.js 16.3.6 official docs):
```ts
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy (v16.3.6, fetched 2026-09-27)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

export const config = {
  matcher: '/about/:path*',
}
```
Proxy defaults to the **Node.js runtime** (stable since Next 15.5) — this matters because `@supabase/ssr` needs Node APIs and was historically incompatible with the old Edge-only Middleware runtime. [CITED: nextjs.org/docs/app/api-reference/file-conventions/proxy]

For this project, `app/proxy.ts` should be a thin wrapper delegating to a shared `updateSession()` helper (see Code Examples), matching Supabase's own documented split between the root proxy/middleware file and a reusable session-refresh function:
```ts
// app/proxy.ts
import { updateSession } from '@/lib/supabase/proxy'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```
[ASSUMED — this wrapper shape follows the standard Supabase SSR split documented at supabase.com/docs/guides/auth/server-side/nextjs, but the literal file contents on that page could not be reproduced verbatim in this research session (see Assumptions Log A1); verify against the live docs page at implementation time.]

### Pattern 2: `is_admin()` as a `SECURITY DEFINER` function, not a direct self-join

**What:** A policy on `profiles` (or any table) that queries `profiles` again to check `role = 'admin'` causes Postgres error 42P17 ("infinite recursion detected in policy for relation") the moment RLS is enabled on `profiles` itself. The fix is a helper function owned by a role that can bypass RLS (Supabase's `postgres` role has `bypassrls`), placed in a **non-exposed schema** so it can't be called directly over the REST API, with `search_path` pinned to prevent search-path hijacking.
**When to use:** Any RLS policy that needs to check "is this user the admin," including on `profiles` itself.
**Trade-offs:** One extra schema (`private`) and one extra migration statement — trivial cost for avoiding a recursion bug that is otherwise very confusing to debug for a non-technical maintainer.

**Example** (verbatim from official Supabase RLS docs, adapted table name):
```sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security (fetched 2026-09-27)
create schema if not exists private;

create function private.is_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where (select auth.uid()) = id and role = 'admin'
  );
end;
$$;

create policy "admin full access reservas"
on public.reservas
for all
to authenticated
using ( (select private.is_admin()) );
```
[CITED: supabase.com/docs/guides/database/postgres/row-level-security] — wrapping both `auth.uid()` and the helper function call in `(select …)` lets Postgres cache the result once per statement instead of re-evaluating per row (documented performance pattern, same source).

### Pattern 3: D-01/D-02 are satisfied by defaults — do not add custom session code

**What:** Supabase Auth's default access-token (JWT) expiry is 1 hour, but the **refresh token never expires** by default and is silently rotated by the client SDK — the user is never asked to re-enter a password as long as the refresh token keeps being used. Supabase Auth also allows **unlimited concurrent sessions per user by default**; a "Single session per user" toggle exists in Auth settings but is off unless explicitly enabled. Separately, `@supabase/ssr` v0.12.7's `createServerClient`/`createBrowserClient` write the session cookie with a **hardcoded `maxAge` of `400 * 24 * 60 * 60` seconds (400 days)** — confirmed by reading the compiled package source directly this session:
```js
// Source: unpkg.com/@supabase/ssr@0.12.7/dist/main/utils/constants.js (read verbatim this session)
exports.DEFAULT_COOKIE_OPTIONS = {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    // https://developer.chrome.com/blog/cookie-max-age-expires
    // https://httpwg.org/http-extensions/draft-ietf-httpbis-rfc6265bis.html#name-cookie-lifetime-limits
    maxAge: 400 * 24 * 60 * 60,
};
```
[VERIFIED: unpkg.com/@supabase/ssr@0.12.7/dist/main/utils/constants.js, read 2026-09-27] Both `cookies.js:230` and `cookies.js:470` set `maxAge: utils_1.DEFAULT_COOKIE_OPTIONS.maxAge` **after** spreading any caller-supplied `cookieOptions`, so a developer-supplied `cookieOptions.maxAge` is silently overridden — confirmed by reading the same file. This matches a still-open, unresolved upstream issue reporting the identical symptom. [CITED: github.com/supabase/ssr/issues/40]

**When to use:** This is not a decision to make — it is the current, unconfigurable behavior of the pinned library version. **Action for this phase: do nothing.** Leave Auth settings > Sessions "Time-box user sessions" and "Single session per user" at their default (disabled) state — both D-01 (weeks-long persistence) and D-02 (multi-device) fall out of the defaults with zero extra code.
**Trade-offs:** None to build; the only risk is a future teammate "fixing" what looks like a too-long session by passing `cookieOptions.maxAge` to `createServerClient` — that call will silently do nothing, which is worth a one-line code comment so nobody spends time debugging it.

### Pattern 4: Private Storage bucket + `storage.objects` RLS (schema-only this phase)

**What:** `createSignedUrl()` only requires a `select` policy on `storage.objects` (no separate policy is needed on the `buckets` table) [CITED: dev.to Supabase Storage RLS write-ups, cross-checked against official Storage Access Control docs]. The standard per-user-folder policy pattern:
```sql
-- Source: pattern cross-checked across supabase.com/docs/guides/storage/security/access-control
-- and multiple independent Supabase Storage RLS write-ups, adapted to this project's naming
create policy "customers manage own comprobantes"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'comprobantes'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'comprobantes'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "admin full access comprobantes"
on storage.objects
for all
to authenticated
using ( bucket_id = 'comprobantes' and (select private.is_admin()) );
```
Path convention: `comprobantes/{user_id}/{reserva_id}.jpg` (matches `research/ARCHITECTURE.md` Pattern 3).
**When to use:** This phase must create the bucket (as **private**, never public) and both policies, even though no upload UI exists until Phase 4 — the phase's third success criterion ("la estructura de datos... ya existe y está protegida") explicitly includes payment-proof storage.
**Trade-offs:** None — the cost of doing this now is a few SQL lines; the cost of skipping it is rebuilding trust after a real customer's Zelle screenshot leaks (per `research/PITFALLS.md` Security Mistakes table).

### Anti-Patterns to Avoid

- **Checking `role` only in the `(admin)` layout, RLS left permissive:** any future route, bug, or forgotten check exposes every customer's data. RLS is the boundary; the layout check is a convenience redirect (see `research/ARCHITECTURE.md` Anti-Pattern 1 — restated here because Phase 1 is exactly where this gets decided).
- **Self-referencing RLS policy on `profiles` to check `role`:** causes Postgres recursion error 42P17. Use the `private.is_admin()` `SECURITY DEFINER` pattern (Pattern 2 above).
- **Letting `profiles.role` be customer-writable:** if a customer can `UPDATE` their own `profiles` row and that row holds `role`, they can promote themselves to admin. In this phase, restrict `UPDATE` on `profiles` to admin-only (no customer self-service profile editing exists until Phase 3 anyway) — do not add a "customers can update their own profile" policy yet, or if you do, explicitly exclude the `role` column from what it can change.
- **Copying a pre-Next-16 Supabase tutorial's `middleware.ts` verbatim:** it will still run (deprecated, with a warning), but there's no reason to start greenfield on a convention Next.js is phasing out. Use `proxy.ts` from day one.
- **Trying to shorten the session by passing `cookieOptions.maxAge`:** confirmed no-op in `@supabase/ssr` 0.12.7 (Pattern 3) — don't spend time on it, and don't let a future contributor "fix" a perceived bug that doesn't exist.
- **Public Storage bucket "just for now":** per project stack rules and `research/ARCHITECTURE.md` Anti-Pattern 2 — never, even before the upload UI exists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Password storage/hashing | Custom bcrypt/argon2 logic | Supabase Auth (`auth.users`) | The app never sees a raw password beyond passing it to `signInWithPassword`; Supabase manages hashing, rate-limiting, and password-reset tokens. |
| Session cookie refresh | Custom cookie-signing/refresh logic in a hand-rolled middleware | `@supabase/ssr`'s `createServerClient` + `proxy.ts` `updateSession()` helper | This is exactly the class of bug ("using the browser client inside a Server Component") flagged as the most common `@supabase/ssr` integration mistake across independent sources. |
| Role/permission system | A `roles` + `user_roles` + `permissions` schema | A single `profiles.role` text column checked via `private.is_admin()` | One admin, one other role — a generic RBAC system adds migrations and edge cases nobody needs (`research/ARCHITECTURE.md` Anti-Pattern 3). |
| Signed URL generation | Custom HMAC-signed link logic | Supabase Storage's built-in `createSignedUrl()` | Already implements expiry, revocation-on-delete, and RLS integration correctly. |

**Key insight:** every "don't hand-roll" item above maps to a documented pitfall specifically because a solo, non-technical operator has no one to catch a subtly-wrong custom implementation later (`research/PITFALLS.md` Pitfall 5) — prefer the managed/documented path even when the custom version looks trivial.

## Common Pitfalls

### Pitfall 1: RLS policy on `profiles` recurses into itself
**What goes wrong:** A policy like `using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))` placed **on the `profiles` table itself** triggers Postgres error 42P17 the moment RLS is enabled, because evaluating the policy requires querying the very table the policy protects.
**Why it happens:** It is the intuitive way to write "is this user an admin," and works fine on *other* tables — it only breaks on `profiles` itself.
**How to avoid:** Always route the admin check through the `private.is_admin()` `SECURITY DEFINER` function (Pattern 2), including for policies **on** `profiles`.
**Warning signs:** `ERROR: infinite recursion detected in policy for relation "profiles"` the first time you try to `SELECT` from `profiles` as an authenticated user.

### Pitfall 2: `profiles.role` is self-editable
**What goes wrong:** A customer flips their own `role` to `admin` via a normal authenticated `UPDATE` request, because the `UPDATE` policy on `profiles` only checked `id = auth.uid()` without restricting which columns could change.
**Why it happens:** It's the natural first policy to write ("users can update their own profile") and privilege escalation isn't obvious until you think about which column is being protected.
**How to avoid:** In this phase, don't grant customers `UPDATE` on `profiles` at all (there's no customer self-service UI until Phase 3). When that policy is eventually added, scope it with a `WITH CHECK` that pins `role` to its previous value, or split `role` into a separate admin-only table/column path.
**Warning signs:** Any `UPDATE ... profiles` policy that doesn't explicitly account for the `role` column.

### Pitfall 3: Mixing up the browser vs. server Supabase client
**What goes wrong:** Using the browser (`createBrowserClient`) client inside a Server Component, or vice versa — sessions silently fail to read/refresh correctly.
**Why it happens:** `@supabase/ssr` requires two distinct client factories and it isn't obvious from the API surface which one belongs where. Flagged as "the most common integration bug" across multiple independent guides cross-checked this session.
**How to avoid:** One `lib/supabase/client.ts` (browser-only, imported only from Client Components) and one `lib/supabase/server.ts` (imported only from Server Components/Actions/Route Handlers) — never share or re-export between them.
**Warning signs:** "Auth session missing" errors that only happen on the server, or a logged-in user's `auth.uid()` reading as `null` in a Server Component.

### Pitfall 4: Assuming `middleware.ts` from an older tutorial "just works" the same as `proxy.ts`
**What goes wrong:** Nothing breaks immediately (`middleware.ts` still executes in Next 16), but the project starts life on a deprecated convention, and Supabase's own docs and most current guides now show `proxy.ts` — meaning a search for help later surfaces code that doesn't match the file actually in the repo.
**How to avoid:** Name the file `proxy.ts` and the export `proxy()` from the start (Pattern 1).
**Warning signs:** A deprecation warning in the Next.js dev server output referencing `middleware.ts`.

### Pitfall 5: RLS "added later, once the UI works"
**What goes wrong:** Tables get created and queried successfully during development with RLS off (or a permissive `using (true)` policy) "to make it easier to test," with a plan to "lock it down before launch." This step gets forgotten or rushed.
**Why it happens:** RLS-off is genuinely faster to develop against, and nothing visibly breaks without it.
**How to avoid:** Every table gets RLS enabled **in the same migration that creates it** — including `reservas`/`pagos`/`recordatorios` in this phase, even though no UI reads them yet. This is a direct carry-forward from `research/PITFALLS.md` Pitfall 5, now scoped to this specific phase's migration.
**Warning signs:** Any `CREATE TABLE` in the migration file not immediately followed by `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY`.

## Code Examples

### `lib/supabase/server.ts` and `lib/supabase/client.ts`
[ASSUMED — standard, extremely well-documented Supabase SSR pattern; the exact literal file contents on supabase.com's current Next.js guide could not be reproduced verbatim via automated fetch this session (the page renders framework tabs client-side) — verify field-for-field against https://supabase.com/docs/guides/auth/server-side/nextjs at implementation time. The API surface used below (`createBrowserClient`, `createServerClient`, `cookies()` from `next/headers`) is independently confirmed via `@supabase/ssr`'s published TypeScript declarations.]

```ts
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
            // if proxy.ts is refreshing the session on every request
          }
        },
      },
    }
  )
}
```

### `lib/supabase/proxy.ts` (session refresh, called from `app/proxy.ts`)
[ASSUMED — same provenance note as above.]
```ts
// lib/supabase/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: this call refreshes the session — do not remove it
  await supabase.auth.getUser()

  return response
}
```

### Admin route guard (real UX check; RLS is still the actual boundary)
```ts
// app/(admin)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/login')

  return <>{children}</>
}
```

### Schema + RLS (migration `0001_schema_and_rls.sql`)
Design proposed under Claude's Discretion per `01-CONTEXT.md` — table/column names below are new-project choices, not verified against any existing source.
```sql
create schema if not exists private;

-- profiles: one row per auth.users row
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  nombre text,
  telefono text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create function private.is_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where (select auth.uid()) = id and role = 'admin'
  );
end;
$$;

create policy "users read own profile" on public.profiles
  for select to authenticated
  using ( (select auth.uid()) = id or (select private.is_admin()) );

create policy "admin full access profiles" on public.profiles
  for all to authenticated
  using ( (select private.is_admin()) );

-- auto-create profile row on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nombre)
  values (new.id, new.raw_user_meta_data ->> 'nombre');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- reservas / pagos / recordatorios: schema only this phase, RLS on from the start
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.profiles(id),
  tipo text not null check (tipo in ('pasaje', 'hotel', 'tour', 'entrada')),
  detalle jsonb not null default '{}',
  precio_usd numeric(12,2) not null,
  estado_proveedor text not null default 'pendiente'
    check (estado_proveedor in ('pendiente', 'confirmada', 'con_problema')),
  nota_problema text,
  fecha_importante date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reservas enable row level security;
create index reservas_cliente_id_idx on public.reservas using btree (cliente_id);

create policy "customers read own reservas" on public.reservas
  for select to authenticated
  using ( (select auth.uid()) = cliente_id );

create policy "admin full access reservas" on public.reservas
  for all to authenticated
  using ( (select private.is_admin()) );

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  monto numeric(12,2) not null,
  moneda text not null check (moneda in ('USD', 'VES')),
  tasa_cambio numeric(12,4),
  metodo text not null check (metodo in ('efectivo', 'zelle', 'binance', 'payoneer')),
  comprobante_path text,
  payment_link_url text,
  referencia text,
  estado text not null default 'pendiente_revision'
    check (estado in ('pendiente_revision', 'confirmado')),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.pagos enable row level security;
create index pagos_reserva_id_idx on public.pagos using btree (reserva_id);

create policy "customers read own pagos" on public.pagos
  for select to authenticated
  using ( exists (
    select 1 from public.reservas r
    where r.id = pagos.reserva_id and r.cliente_id = (select auth.uid())
  ) );

create policy "admin full access pagos" on public.pagos
  for all to authenticated
  using ( (select private.is_admin()) );

create table public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  tipo text not null check (tipo in ('recordatorio', 'aviso_cambio')),
  fecha_envio_programada timestamptz not null,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.recordatorios enable row level security;
create index recordatorios_reserva_id_idx on public.recordatorios using btree (reserva_id);

create policy "customers read own recordatorios" on public.recordatorios
  for select to authenticated
  using ( exists (
    select 1 from public.reservas r
    where r.id = recordatorios.reserva_id and r.cliente_id = (select auth.uid())
  ) );

create policy "admin full access recordatorios" on public.recordatorios
  for all to authenticated
  using ( (select private.is_admin()) );

-- storage: private bucket + RLS for payment proofs (schema-only this phase)
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', false)
  on conflict (id) do nothing;

create policy "customers manage own comprobantes" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'comprobantes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'comprobantes'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "admin full access comprobantes" on storage.objects
  for all to authenticated
  using ( bucket_id = 'comprobantes' and (select private.is_admin()) );
```
[CITED for the RLS technique (SECURITY DEFINER, `(select …)` wrapping, indexing): supabase.com/docs/guides/database/postgres/row-level-security. Table/column names and check-constraint values: ASSUMED / Claude's Discretion per CONTEXT.md — not verified against any existing source since this is a greenfield schema.]

### Seeding the one admin account (D-03)
```sql
-- supabase/seed.sql — run once against the target project after the migration
-- Actual account creation should go through Supabase Auth (dashboard "Invite user"
-- or `supabase.auth.admin.createUser`), not a raw SQL insert into auth.users.
-- After the auth.users row + trigger-created profiles row exist, promote it:
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'gabbovera@gmail.com');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `middleware.ts` / `export function middleware()` | `proxy.ts` / `export function proxy()` | Next.js 16.0.0 (Oct 2025) [CITED: nextjs.org/docs/messages/middleware-to-proxy, version history table] | Old convention still runs with a deprecation warning; new projects should start on `proxy.ts`. |
| Middleware restricted to Edge Runtime | Proxy defaults to Node.js runtime (stable since 15.5.0) | Next.js 15.5 → 16.0 | Removes the historical Edge-Runtime-vs-Node-API friction that made `@supabase/ssr` awkward in Middleware. |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Already superseded before this project started | Already reflected in `research/STACK.md`; restated here because it's this phase's first line of code. |

**Deprecated/outdated:** `@supabase/auth-helpers-nextjs` (maintenance-only, no new features); pre-16 `middleware.ts` convention (functional but deprecated).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Literal file contents of `lib/supabase/client.ts`, `server.ts`, and the `proxy.ts` `updateSession()` helper, as currently shown on supabase.com's Next.js SSR guide | Code Examples | Low — the API surface (`createBrowserClient`, `createServerClient`, cookie get/set shape) is independently confirmed via package type declarations and cross-checked against multiple third-party guides; a minor field name or comment could differ from the live docs page, which the executor should diff against at implementation time. |
| A2 | Exact schema (table/column names, check-constraint values, `estado_proveedor`/`estado` value sets) for `profiles`/`reservas`/`pagos`/`recordatorios` | Code Examples, Architecture Patterns | Medium — this is a new-project design decision explicitly delegated to Claude's discretion in `01-CONTEXT.md`, not a user-confirmed spec; renaming a column later requires a migration + code changes across every phase that reads it. Recommend the planner surface this schema back to the user (or at minimum to `/gsd-verify-work`) as a checkpoint before Phase 2 builds UI on top of it. |
| A3 | RLS testing without Docker (real hosted Supabase project + seeded test users, via a lightweight JS test runner) is a workable substitute for the more rigorous local pgTAP + `supabase start` approach | Validation Architecture | Medium — this pattern is sourced from WebSearch summaries (LOW confidence per the classify-confidence seam), not hands-on-verified in this environment; if it proves awkward in practice (e.g., cross-tenant test data polluting the real project), the fallback is installing Docker Desktop and using the CLI's local stack instead. |
| A4 | Vercel CLI absence has no impact on this phase (git-push + dashboard-configured env vars are sufficient) | Environment Availability | Low — this phase does not require deploying to Vercel to be "done" (Phase boundary is DB + admin login), so this is a forward-looking note rather than a phase blocker. |

**If this table is empty:** N/A — see items above; none of them block starting Phase 1, but A2 in particular should get a lightweight human nod before Phase 2 locks in on top of it.

## Open Questions (RESOLVED)

1. **(RESOLVED)** Should the Supabase Auth "Time-box user sessions" / "Single session per user" dashboard settings be explicitly verified as disabled, rather than just assumed default?
   - What we know: Both are off/unset by default per Supabase's own session docs.
   - What's unclear: Whether the actual Supabase project (once created) could have inherited a non-default org-level setting.
   - Resolution: Plan 01-02 Task 2 (`npm run auth:configure`) checks and, if needed, patches these session settings through the Management API as part of admin account setup — not left as a manual dashboard check.

2. **(RESOLVED)** Single Supabase project for dev+prod, or a separate dev/staging project?
   - What we know: `research/ARCHITECTURE.md` sizes the whole system for ~10-15 bookings/week with one admin, which doesn't obviously require environment separation.
   - What's unclear: CONTEXT.md doesn't address this, and RLS integration testing (this phase's own Validation Architecture) will insert test fixtures somewhere.
   - Resolution: Single hosted project for the MVP (Plan 01-01 Task 2), with test fixtures namespaced `rt-test-` and cleaned up (a stale-fixture sweep) so they never appear as "phantom" reservations to the real admin. Recorded as flagged assumption FA-4 in 01-01-PLAN.md.

3. **(NOTED, not blocking)** Exact patch versions will drift. All versions in this document were confirmed against the live npm registry on 2026-09-27 — re-run `npm view <pkg> version` at actual scaffold time (Plan 01-01 Task 2 scaffolds the project, so this check happens naturally then).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 runtime (requires >=20.9) | ✓ | v26.10.0 | — |
| npm | Package installation | ✓ | 11.19.1 | — |
| git | Version control, GSD workflow | ✓ | 2.50.1 | — |
| Supabase CLI | Migrations, type generation | ✓ (via `npx supabase`) | 2.118.0 | No global install found — prefix every command with `npx supabase` or add as a `devDependency` (already in Standard Stack installation). |
| Docker | `supabase start` (local Postgres stack, required for local pgTAP RLS testing) | ✗ | — | Skip local Supabase stack entirely; run migrations directly against a real (free-tier) hosted Supabase project via `supabase link` + `supabase db push`, and do RLS integration testing against that hosted project with seeded test users (see Validation Architecture) instead of local pgTAP. |
| Vercel CLI | Local env var pulling, terminal-driven preview deploys | ✗ (not found on PATH) | — | Use Vercel's GitHub integration (dashboard-connected auto-deploy on `git push`) and manage environment variables via the Vercel dashboard UI instead of `vercel env pull`. Not required for this phase's scope (no deploy is part of the phase boundary). |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Docker (RLS testing moves to hosted-project integration tests instead of local pgTAP); Vercel CLI (dashboard-driven config instead of CLI).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None yet — greenfield project. Recommend **Vitest** (fast, TypeScript-native, no Docker dependency, works directly against a hosted Supabase project via `@supabase/supabase-js`). |
| Config file | none — create `vitest.config.ts` in Wave 0 |
| Quick run command | `npx vitest run tests/rls` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| AUTH-01 | Admin signs in with email+password and reaches `/admin` | integration (supabase-js against real project, seeded admin) | `npx vitest run tests/rls/admin-login.test.ts` | ❌ Wave 0 |
| Success criterion 2 | Non-admin (seeded `customer`-role user, and an anonymous session) cannot read admin-scoped data or land on `/admin` | integration + manual UAT | `npx vitest run tests/rls/admin-guard.test.ts` | ❌ Wave 0 |
| Success criterion 3 | `reservas`/`pagos`/`recordatorios`/`profiles`/`storage.objects` RLS blocks cross-tenant access at the database level, not just in the UI | integration (two seeded customer users, cross-read attempt) | `npx vitest run tests/rls/cross-tenant.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** run the specific `tests/rls/*.test.ts` file touched by that task.
- **Per wave merge:** `npx vitest run` (full suite).
- **Phase gate:** full suite green **and** the manual UAT below, before `/gsd-verify-work`.

**Manual UAT (in addition to automated tests, since this phase's success criteria are partly UI-observable):** log in as the seeded admin in a real browser and confirm arrival at an empty `/admin`; in a private/incognito window, attempt to visit `/admin` with no session and confirm redirect to `/login`.

### Wave 0 Gaps
- [ ] `vitest` + `vitest.config.ts` — no test framework exists yet.
- [ ] `tests/rls/helpers.ts` — a shared fixture helper that, using the **service role key** (server-only, never shipped to the app), seeds: 1 admin profile, 2 distinct customer profiles, and one `reserva`+`pago` per customer, then tears them down after each test run.
- [ ] `tests/rls/admin-login.test.ts`, `admin-guard.test.ts`, `cross-tenant.test.ts` — the three test files mapped above.
- [ ] `.env.test` (or equivalent) holding the service-role key **only** for these seeding scripts — must never be imported by any app runtime code path, and must be excluded from the client bundle (this is the one legitimate non-cron use of the service role key per `research/ARCHITECTURE.md` Internal Boundaries table, and must be treated with the same isolation discipline as the cron route).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | Supabase Auth email+password sign-in; default rate-limiting and password-recovery flow, unmodified per CONTEXT.md discretion. |
| V3 Session Management | yes | `@supabase/ssr` cookie (`sameSite=lax`, 400-day `maxAge`, non-expiring refresh token by default) refreshed via `proxy.ts`; no custom session code. |
| V4 Access Control | yes | Postgres RLS on every table, `private.is_admin()` `SECURITY DEFINER` function — this is the actual authorization boundary, not the route-group layout check. |
| V5 Input Validation | yes | `zod` schema for the login form, validated inside the Server Action (server-side), not only client-side. |
| V6 Cryptography | yes (indirect) | Never hand-roll password hashing or token signing — delegated entirely to Supabase Auth. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Privilege escalation via a customer-writable `role` column | Tampering / Elevation of Privilege | No customer `UPDATE` policy on `profiles` in this phase; when one is added later (Phase 3), exclude `role` from what it can change (Pitfall 2). |
| Cross-tenant data exposure via missing/misconfigured RLS | Information Disclosure | RLS enabled in the same migration that creates each table; verified with the automated cross-tenant integration test in Validation Architecture, not just a UI check. |
| RLS recursion causing a fail-open or fail-closed surprise on `profiles` | Denial of Service / Information Disclosure | `private.is_admin()` `SECURITY DEFINER` pattern (Pattern 2) — avoids the self-referencing-policy recursion bug entirely rather than working around its symptoms. |
| Signed URL over-exposure (long TTL, cached/persisted URL) | Information Disclosure | Store only the storage **path** in `pagos.comprobante_path`; generate a short-TTL signed URL on render (Phase 4 concern, but the schema decision — path not URL — is made now). |
| Session/cookie theft (`httpOnly: false` on the Supabase auth cookie) | Session Hijacking | This is Supabase's documented, intentional default (the client SDK needs browser-side cookie access) — mitigate via HTTPS-only transport (Vercel enforces TLS by default) rather than trying to override `httpOnly`, which isn't a supported `@supabase/ssr` configuration point for this cookie. |

## Sources

### Primary (HIGH confidence)
- [Next.js — File-system conventions: proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — fetched verbatim, v16.3.6, includes version history table confirming the middleware→proxy rename in 16.0.0
- `@supabase/ssr@0.12.7` published package source (`dist/main/utils/constants.js`, `dist/main/cookies.js`) — read directly via unpkg this session; confirms hardcoded 400-day cookie `maxAge`
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — `SECURITY DEFINER` recursion-avoidance pattern, `(select auth.uid())` performance wrapping, indexing guidance, fetched verbatim this session
- npm registry `npm view <pkg> version` — all versions in Standard Stack, checked live this session (2026-09-27)

### Secondary (MEDIUM confidence)
- [Supabase — Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — confirmed the middleware→proxy terminology shift and two-client requirement; literal code blocks not reproducible via automated fetch this session (see Assumptions Log A1)
- [Supabase — User sessions](https://supabase.com/docs/guides/auth/sessions) — default JWT expiry (1 hour), refresh-token non-expiry and reuse-window behavior, "Single session per user" setting
- [github.com/supabase/ssr issue #40](https://github.com/supabase/ssr/issues/40) — corroborates the hardcoded-`maxAge` finding from an independent (user-reported) angle
- [Supabase — Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) and multiple cross-checked Storage RLS write-ups — `storage.objects` signed-URL policy pattern

### Tertiary (LOW confidence)
- WebSearch results on pgTAP / `basejump-supabase_test_helpers` / `rlsautotest` for RLS test automation — not hands-on-verified in this environment (Docker unavailable); informed the Validation Architecture fallback but flagged as Assumption A3
- WebSearch cross-checks on `handle_new_user` trigger conventions — well-established community pattern, not an official docs page

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version number checked live against npm this session.
- Architecture (proxy.ts, RLS recursion pattern, cookie maxAge): HIGH — read directly from official docs or published package source, not paraphrased secondhand.
- Exact SSR client boilerplate: MEDIUM — API surface confirmed, literal file text not reproducible via automated fetch this session.
- Pitfalls: HIGH — directly informed by this session's own findings plus the project's existing `research/PITFALLS.md`.
- RLS testing approach without Docker: LOW — sourced from WebSearch summaries, not hands-on validated.

**Research date:** 2026-09-27
**Valid until:** ~14 days for the fast-moving package versions (Next.js/Supabase ship frequently); ~90 days for the architectural patterns (proxy.ts convention, RLS recursion fix) which are stable framework-level facts.
