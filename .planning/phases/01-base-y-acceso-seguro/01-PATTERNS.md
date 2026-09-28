# Phase 1: Base y acceso seguro - Pattern Map

**Mapped:** 2026-09-27
**Files analyzed:** 13 (new — greenfield, zero modified)
**Analogs found:** 0 internal / 13 external-doc-sourced

## Greenfield Notice

This repository has **no application code today**. Verified via:
```
git ls-files | grep -Ev '^\.planning/|^assets/|^DESIGN\.md$|^idea\.md$'
→ .claude/CLAUDE.md   (only tracked file outside planning/design/assets)
```
No `app/`, `lib/`, or `supabase/` directories exist on disk. There is **no internal codebase analog** for any file in this phase — this phase creates the first real code in the project.

Per the orchestrator's fallback instruction, this document instead serves as a **concrete file manifest** derived from `01-RESEARCH.md`'s "Recommended Project Structure" and Code Examples, classified by role/data-flow, with the *external* pattern source (official Next.js/Supabase docs, already vetted in RESEARCH.md) named per file so the planner has something copyable. Every excerpt below is reproduced from `01-RESEARCH.md` (which already cites/verifies each source) — **not** independently re-fetched here, to avoid re-reading ranges already in context.

**Tracked-source gate:** N/A this phase — there are no internal analog paths to gate-check (nothing to mis-cite as a gitignored mirror). All cited sources are either (a) `01-RESEARCH.md` itself (tracked at `.planning/phases/01-base-y-acceso-seguro/01-RESEARCH.md`, confirmed via `git ls-files` above showing the `.planning/` tree is part of the repo) or (b) external official documentation, never a local mirror.

## File Classification

| New File | Role | Data Flow | Pattern Source | Match Quality |
|----------|------|-----------|-----------------|---------------|
| `supabase/migrations/0001_schema_and_rls.sql` | migration | CRUD | RESEARCH.md Code Examples ("Schema + RLS") — itself citing supabase.com RLS docs | external-doc (no internal analog) |
| `supabase/seed.sql` | migration | batch | RESEARCH.md Code Examples ("Seeding the one admin account") | external-doc (no internal analog) |
| `lib/supabase/client.ts` | service (SDK factory) | request-response | RESEARCH.md Code Examples — Supabase SSR guide (ASSUMED/verify at impl time, API surface confirmed via package types) | external-doc, MEDIUM confidence |
| `lib/supabase/server.ts` | service (SDK factory) | request-response | RESEARCH.md Code Examples — Supabase SSR guide (same provenance note as above) | external-doc, MEDIUM confidence |
| `lib/supabase/proxy.ts` | service (session refresh helper) | request-response | RESEARCH.md Code Examples ("updateSession") | external-doc, MEDIUM confidence |
| `app/proxy.ts` | middleware (Next.js 16 proxy convention) | request-response | RESEARCH.md Pattern 1 — Next.js 16 official `proxy.js` file-convention docs | external-doc, HIGH confidence |
| `app/(admin)/layout.tsx` | middleware/guard (route-group layout) | request-response | RESEARCH.md "Admin route guard" code example | external-doc, HIGH confidence (pattern), schema fields MEDIUM (A2) |
| `app/(admin)/page.tsx` | component | request-response | No dedicated example in RESEARCH.md — trivial empty Server Component shell; follow Next.js App Router default `page.tsx` convention | no analog — build from RESEARCH.md structure only |
| `app/(auth)/login/page.tsx` | component (form) | request-response | RESEARCH.md Standard Stack (`react-hook-form` + `zod` + `@hookform/resolvers`) — no literal login-form code block given; compose from library docs | no analog — build from RESEARCH.md library choices |
| `app/actions/auth.ts` | controller (Server Action) | request-response | RESEARCH.md Architecture Diagram step "Login Server Action" — `zod` validate → `supabase.auth.signInWithPassword()`; no literal code block given, pattern implied | no analog — build from RESEARCH.md architecture description |
| `tests/rls/helpers.ts` | test (fixture/utility) | batch | RESEARCH.md Validation Architecture "Wave 0 Gaps" — service-role seeding/teardown helper described, no literal code | no analog — build from RESEARCH.md test-map description |
| `tests/rls/admin-login.test.ts` | test | request-response | RESEARCH.md Phase Requirements → Test Map (AUTH-01 row) | no analog |
| `tests/rls/admin-guard.test.ts` | test | request-response | RESEARCH.md Phase Requirements → Test Map (Success criterion 2 row) | no analog |
| `tests/rls/cross-tenant.test.ts` | test | CRUD (cross-row read attempt) | RESEARCH.md Phase Requirements → Test Map (Success criterion 3 row) | no analog |
| `vitest.config.ts` | config | — | RESEARCH.md Validation Architecture ("Recommend Vitest... create `vitest.config.ts` in Wave 0") — standard Vitest config, no project-specific excerpt given | no analog — standard tool default |

## Pattern Assignments

### `supabase/migrations/0001_schema_and_rls.sql` (migration, CRUD)

**Source:** `01-RESEARCH.md` lines 477-631 ("Schema + RLS (migration `0001_schema_and_rls.sql`)"), citing supabase.com/docs/guides/database/postgres/row-level-security for the RLS technique; table/column names are Claude's-discretion greenfield design (CONTEXT.md, Assumption A2 — flag for human nod before Phase 2).

**Core pattern — `private.is_admin()` SECURITY DEFINER (avoids RLS recursion on `profiles`):**
```sql
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
```

**Policy pattern (apply per table — `profiles`, `reservas`, `pagos`, `recordatorios`):**
```sql
alter table public.<table> enable row level security;

create policy "customers read own <table>" on public.<table>
  for select to authenticated
  using ( (select auth.uid()) = cliente_id );  -- or exists(...) join through reservas

create policy "admin full access <table>" on public.<table>
  for all to authenticated
  using ( (select private.is_admin()) );
```
**Rule from RESEARCH.md Pitfall 5:** every `CREATE TABLE` must be immediately followed by `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least one `CREATE POLICY` — in the *same* migration, never deferred.

**Trigger pattern (auto-create profile row on signup):**
```sql
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
```

**Storage pattern (private bucket + `storage.objects` RLS):**
```sql
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
Path convention: `comprobantes/{user_id}/{reserva_id}.jpg`. Bucket **must** be created with `public: false` — never a public bucket (CLAUDE.md "What NOT to Use" table + RESEARCH.md Anti-Pattern).

**Anti-patterns to avoid (RESEARCH.md lines 321-328):**
- Self-referencing policy on `profiles` querying `profiles` → Postgres error 42P17 (infinite recursion). Always route through `private.is_admin()`.
- Granting customers `UPDATE` on `profiles` in this phase — don't; no customer self-service exists until Phase 3, and an unscoped `UPDATE` policy lets a customer self-promote `role` to `admin`.

---

### `supabase/seed.sql` (migration, batch)

**Source:** `01-RESEARCH.md` lines 633-641.

```sql
-- Actual account creation should go through Supabase Auth (dashboard "Invite user"
-- or `supabase.auth.admin.createUser`), not a raw SQL insert into auth.users.
-- After the auth.users row + trigger-created profiles row exist, promote it:
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'gabbovera@gmail.com');
```
D-03 lock: the seeded email is literally `gabbovera@gmail.com` — do not use a placeholder.

---

### `lib/supabase/client.ts` (service, request-response)

**Source:** `01-RESEARCH.md` lines 377-387. **Provenance flag:** API surface confirmed via `@supabase/ssr` published TypeScript declarations; literal file text is ASSUMED from Supabase's Next.js SSR guide (page renders client-side, not fetchable verbatim this session) — verify field-for-field against https://supabase.com/docs/guides/auth/server-side/nextjs at implementation time.

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
**Rule (Pitfall 3):** this file is imported ONLY from Client Components. Never share/re-export with `server.ts`.

---

### `lib/supabase/server.ts` (service, request-response)

**Source:** `01-RESEARCH.md` lines 389-416. Same provenance flag as `client.ts` above.

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
**Rule:** imported ONLY from Server Components/Actions/Route Handlers. Never from Client Components.
**Do-not-touch:** never pass `cookieOptions.maxAge` to override session length — confirmed no-op in `@supabase/ssr` 0.12.7 (hardcoded 400-day cookie `maxAge`, satisfies D-01/D-02 already). Leave a code comment saying so.

---

### `lib/supabase/proxy.ts` (service, request-response — session refresh)

**Source:** `01-RESEARCH.md` lines 418-450. Same provenance flag as above.

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

---

### `app/proxy.ts` (middleware, request-response)

**Source:** `01-RESEARCH.md` lines 208-237, verified verbatim against Next.js 16.3.6 official docs (nextjs.org/docs/app/api-reference/file-conventions/proxy).

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
**Critical naming rule:** file must be named `proxy.ts`, export `proxy()` — NOT `middleware.ts`/`middleware()`. The old convention still runs (deprecated, with a warning) but must not be used for this greenfield project (Pitfall 4).

---

### `app/(admin)/layout.tsx` (middleware/guard, request-response)

**Source:** `01-RESEARCH.md` lines 452-473.

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
**Critical framing (Anti-Pattern):** this layout check is a UX convenience redirect only. The real authorization boundary is Postgres RLS (`private.is_admin()` policies above) — do not treat this check as sufficient security on its own, and do not skip RLS "because the layout already checks role."

---

### `app/(admin)/page.tsx` (component, request-response) — No Analog

No RESEARCH.md code block covers this file; it is described only as "empty admin dashboard shell." Build as a minimal Server Component (no data fetching beyond what the parent layout already resolved). Follow standard Next.js App Router `page.tsx` conventions (default export, Server Component by default, no `'use client'` needed since there's no interactivity yet).

---

### `app/(auth)/login/page.tsx` (component/form, request-response) — No Analog

No literal code given in RESEARCH.md. Compose from Standard Stack choices already locked in: `react-hook-form` (7.89.0) + `zod` (4.6.5) + `@hookform/resolvers` (5.9.1) for client-side validation, submitting to the `app/actions/auth.ts` Server Action described below. Use `shadcn/ui` `form`, `input`, `button`, `card`, `label` components (already in the installation list) rather than hand-rolled form markup, consistent with the project's "editable source, not opaque dependency" maintainability constraint (CLAUDE.md).

---

### `app/actions/auth.ts` (controller/Server Action, request-response) — No Analog

No literal code given in RESEARCH.md; pattern is described in the Architecture Diagram (RESEARCH.md lines 158-161): "validates `{email,password}` with zod" then "calls `supabase.auth.signInWithPassword()`". Build as a `'use server'` Server Action:
- Validate input with the same `zod` schema shared with the client form (per RESEARCH.md Standard Stack: "Validate the login payload shape server-side inside the Server Action, not just client-side").
- Call `createClient()` from `lib/supabase/server.ts` (never the browser client here — Pitfall 3).
- Call `supabase.auth.signInWithPassword({ email, password })`.
- On success, `redirect('/admin')` (the `(admin)` layout above then re-verifies role); on failure, return a form error — no custom password/lockout logic (CONTEXT.md discretion: use Supabase Auth defaults for recovery/rate-limiting, don't hand-roll).

---

### `tests/rls/helpers.ts`, `admin-login.test.ts`, `admin-guard.test.ts`, `cross-tenant.test.ts` (test, various) — No Analog

**Source:** `01-RESEARCH.md` Validation Architecture section (lines 692-720). No literal test code given — described requirements only:
- `helpers.ts`: uses the **service role key** (server-only, never in app runtime, never in client bundle) to seed 1 admin profile + 2 distinct customer profiles + one `reserva`+`pago` per customer, and tear down after each run. Framework: **Vitest** (no Docker dependency; runs against a real hosted Supabase project since Docker is unavailable in this environment — see RESEARCH.md Environment Availability / Assumption A3).
- `admin-login.test.ts` → maps to AUTH-01: admin signs in with email+password and reaches `/admin`.
- `admin-guard.test.ts` → maps to Success criterion 2: non-admin (seeded customer-role user, and anonymous) cannot read admin-scoped data or land on `/admin`.
- `cross-tenant.test.ts` → maps to Success criterion 3: two seeded customer users cannot cross-read each other's `reservas`/`pagos`/`recordatorios` at the database level (RLS, not just UI).

**Secret-handling rule:** `.env.test` (or equivalent) holds the service-role key only for these seeding scripts — must never be imported by any app runtime code path.

---

### `vitest.config.ts` (config) — No Analog

No project-specific example given; use Vitest's standard TypeScript config defaults. Referenced by RESEARCH.md as a Wave 0 gap ("no test framework exists yet").

## Shared Patterns

### Two-client split (browser vs. server) — never share

**Source:** `lib/supabase/client.ts` (browser-only) vs. `lib/supabase/server.ts` (server-only), per RESEARCH.md Pitfall 3, "the most common `@supabase/ssr` integration bug."
**Apply to:** every file that touches Supabase — `app/(admin)/layout.tsx`, `app/actions/auth.ts`, `app/(auth)/login/page.tsx` (client component uses `client.ts`; anything doing auth/data server-side uses `server.ts`), `lib/supabase/proxy.ts` uses `createServerClient` directly (not either wrapper, since it needs the request-scoped cookie shape).

### RLS is the only trusted authorization boundary

**Source:** RESEARCH.md Architectural Responsibility Map (lines 54-64) and Anti-Pattern list (lines 321-328).
**Apply to:** `supabase/migrations/0001_schema_and_rls.sql` (the boundary itself), `app/(admin)/layout.tsx` (UX-only redirect, must not be treated as the real check), all three RLS test files (must assert the DB-level boundary directly, not just observe UI behavior).

### `private.is_admin()` SECURITY DEFINER helper — required for every admin-check policy

**Source:** `01-RESEARCH.md` lines 240-271 (Pattern 2), citing supabase.com RLS docs.
**Apply to:** every `CREATE POLICY ... admin full access ...` statement across `profiles`, `reservas`, `pagos`, `recordatorios`, and `storage.objects` in the single migration file.

### Do not add custom session-duration code

**Source:** `01-RESEARCH.md` lines 273-291 (Pattern 3) — `@supabase/ssr` 0.12.7 hardcodes cookie `maxAge` at 400 days regardless of caller-supplied `cookieOptions`; Supabase Auth's refresh token never expires by default and allows unlimited concurrent sessions by default.
**Apply to:** `lib/supabase/server.ts`, `lib/supabase/proxy.ts` — leave `cookieOptions` unset for session duration; D-01/D-02 are satisfied by doing nothing. Add a one-line code comment in `server.ts` to preempt a future "fix" attempt.

### `proxy.ts` naming convention (Next.js 16)

**Source:** `01-RESEARCH.md` lines 202-237, Pitfall 4.
**Apply to:** `app/proxy.ts` only file at this location; must never be named/authored as `middleware.ts`/`middleware()`.

### Server-side validation with the same `zod` schema as the client

**Source:** RESEARCH.md Standard Stack table, `zod` row: "Validate the login payload shape server-side inside the Server Action, not just client-side."
**Apply to:** `app/(auth)/login/page.tsx` (client-side `zodResolver`) and `app/actions/auth.ts` (re-validate server-side) — share one schema module (e.g. `lib/schemas/auth.ts`, not itself required by RESEARCH.md but implied by "same schema" reuse) to avoid duplicating validation logic.

## No Analog Found

All 13 new files lack an *internal* codebase analog (greenfield project — see Greenfield Notice). Files below additionally lack even a literal *external* code excerpt in RESEARCH.md (RESEARCH.md gives structure/requirements only, not code) — planner should treat RESEARCH.md's prose description as the spec and standard library/framework docs (React Server Components, Vitest, shadcn/ui, react-hook-form) as the pattern source at implementation time:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/(admin)/page.tsx` | component | request-response | RESEARCH.md describes only "empty admin dashboard shell," no code given |
| `app/(auth)/login/page.tsx` | component | request-response | No literal form code in RESEARCH.md; compose from named libraries (react-hook-form/zod/shadcn) |
| `app/actions/auth.ts` | controller | request-response | Described in architecture diagram prose only, no literal Server Action code |
| `tests/rls/helpers.ts` | test | batch | Described as a Wave 0 gap/requirement, no literal code |
| `tests/rls/admin-login.test.ts` | test | request-response | Same — requirement only |
| `tests/rls/admin-guard.test.ts` | test | request-response | Same — requirement only |
| `tests/rls/cross-tenant.test.ts` | test | CRUD | Same — requirement only |
| `vitest.config.ts` | config | — | Standard tool default, no project-specific example |

## Metadata

**Analog search scope:** entire repository root (`git ls-files`, `find . -maxdepth 2`) — confirmed zero application-code directories exist (`app/`, `lib/`, `supabase/`). No `Glob`/`Grep` for internal analogs was productive beyond this confirmation, so search stopped after verifying greenfield status rather than searching further with no code to find.
**Files scanned:** 2 upstream docs (`01-CONTEXT.md`, `01-RESEARCH.md`) + repository root listing + `git ls-files` output.
**Pattern extraction date:** 2026-09-27.
**Key open risk carried from RESEARCH.md (Assumption A2):** the exact schema (table/column names, check-constraint value sets) is a new-project design choice delegated to Claude's discretion, not user-confirmed — the planner should flag this schema back to the user or `/gsd-verify-work` as a checkpoint before Phase 2 builds UI on top of it.
</content>
