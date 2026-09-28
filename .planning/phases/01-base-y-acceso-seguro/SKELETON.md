# Walking Skeleton — Rent & Trippin

**Phase:** 1
**Generated:** 2026-09-27

## Capability Proven End-to-End

> The operator (`gabbovera@gmail.com`) types his email and password into the real `/login` form, Supabase Auth signs him in, and he lands on `/admin` — a panel served by the Next.js app whose access decision comes from his real `profiles.role` row, read from Postgres under Row Level Security.

The Plan 01-01 tracer proves this path with a test admin account. Plan 01-02 then creates the real admin account (D-03).

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.x App Router, TypeScript, Tailwind CSS v4, ESLint, no `src/` dir, import alias `@/*` | This is the locked stack (`.claude/CLAUDE.md`). Next 16 is the current LTS line, and its documentation is abundant for an AI or hired maintainer. |
| Data layer | Supabase Postgres. Every table has RLS enabled in the same migration that creates it. Admin checks go through `private.is_admin()`, a `SECURITY DEFINER` function with `search_path = ''` living in a non-exposed `private` schema. | RLS is the only trusted authorization boundary. The helper function avoids the 42P17 recursion on `profiles` (RESEARCH Pattern 2). |
| Migrations | Supabase CLI. Timestamped SQL files live in `supabase/migrations/`. They are pushed with `npm run db:push`. Types are generated from the live project with `npm run db:types` into `lib/database.types.ts`. | Docker is not installed, so the local Supabase stack is unavailable. Migrations are pushed straight to the hosted project, and generating types from the live DB proves the push happened. |
| Auth | Supabase Auth email + password, with sessions stored in cookies by `@supabase/ssr`. The root `proxy.ts` refreshes the session on every request via `supabase.auth.getClaims()`. Page and action guards live in `lib/auth/require-admin.ts`. Public sign-up is disabled (invite-only). | Session length and multi-device use come from library/service defaults: a 400-day cookie, a non-expiring refresh token, and unlimited concurrent sessions. That satisfies D-01 and D-02 with no custom code. Logout uses local scope, so it ends only the current device's session. |
| Browser/server client split | `lib/supabase/server.ts` starts with `import 'server-only'`, so a Client Component that imports it fails the build. A browser client (`lib/supabase/client.ts`) is added by the first phase that has a Client Component talking to Supabase directly, which will likely be Phase 4 (uploads). It must never be merged with or re-export `server.ts`. | Mixing the two clients is the most common `@supabase/ssr` bug (RESEARCH Pitfall 3). In Phase 1 the login and logout are Server Actions, so no browser client is needed. The split is enforced by the build, not by convention. |
| Secrets | `.env.local` holds only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and is read by the app. `.env.admin.local` holds the secret key, access token, DB password and initial admin password. Next.js never loads `.env.admin.local`; only the CLI scripts and tests read it. Both files are git-ignored. `.env.example` is tracked. | This keeps the full-access secret key out of the app runtime entirely. The e2e harness also strips those variables from the environment of the `next dev` process it starts. |
| Storage | Private bucket `comprobantes` with a 10 MB limit and allowed types jpeg/png/webp/heic/pdf. Path convention: `{auth.uid}/{reserva_id}-{timestamp}.{ext}`. Customers can insert into and read only their own folder; they cannot update or delete. The admin has full access. | Payment proofs must never be public (locked stack). Customers are denied update and delete so an uploaded proof cannot be altered or withdrawn later (dispute evidence). |
| Testing | Vitest with two projects. `db` runs RLS and auth tests against the hosted project, with users seeded by the secret key. `e2e` starts `next dev` on a free port and drives the real forms over HTTP without JavaScript, the way a no-JS browser does, by submitting the Server Action hidden inputs. | Local pgTAP is not possible without Docker (RESEARCH A3). The e2e tests exercise the real Auth, cookie, proxy, page and RLS path without browser tooling. |
| Test data hygiene | Every automated test account's email starts with `rt-test-`. Each account is deleted after its run. A sweep deletes only `rt-test-` accounts older than 30 minutes. | Tests and development share one hosted project (RESEARCH Open Question 2), so the real operator must never see phantom users or reservations. The 30-minute floor keeps parallel runs from deleting each other's live fixtures. |
| Deployment target | For Phase 1, the documented local full-stack run is `npm run dev`, then open `http://localhost:3000/login`. This uses the real hosted Supabase project (real Auth, Postgres and RLS). Vercel Pro (the locked stack) receives its first deploy in the first phase that ships operator-facing value, recommended to be Phase 2. | The phase boundary is the DB plus admin login (RESEARCH A4). The Vercel CLI is not installed, and Vercel Pro is a paid account the owner has not provisioned yet. The skeleton template allows a documented local run. |
| Directory layout | `app/login/` holds the page, its action and the form. `app/admin/` holds the panel and its actions. The root `proxy.ts` sits next to `app/`. `lib/supabase/`, `lib/auth/` and `lib/validation/` hold shared code. `supabase/migrations/` holds the schema. `scripts/` holds admin/ops scripts in plain ESM. `tests/{helpers,e2e,rls,auth}/` hold the tests. | Route files are colocated. Next.js 16 only reads `proxy.ts` from the project root or `src/`; a copy inside `app/` is silently ignored. The research's `app/(admin)/` route group was dropped, because a route group adds no URL segment and would collide with `/`. |
| Language | UI copy and user-facing errors are in Spanish. Domain identifiers are Spanish (`reservas`, `pagos`, `recordatorios`, `comprobantes`). Framework plumbing is in English. | The operator and customers read Spanish. PITFALLS asks for clear Spanish error messages for a non-technical maintainer. |
| Visual identity | The brand purple `#482583` is the single accent color, replacing DESIGN.md's Action Blue as required by the CLAUDE.md brand constraint. The font is the system/SF stack from DESIGN.md. Touch targets are at least 44 px and inputs use 17 px text. | The brand constraint is locked. The DESIGN.md accent conflict is left for Phase 2's UI contract to formalize. |

## Stack Touched in Phase 1

- [ ] Project scaffold (framework, build, lint, test runner) — Plan 01-01 Task 2
- [ ] Routing — `/login`, `/admin`, `/` (redirect) — Plans 01-01 and 01-04
- [ ] Database — real write: sign-in creates a session, the trigger creates a `profiles` row, and the admin seed updates `role`. Real read: `/admin` reads `profiles.role` under RLS. Plans 01-01, 01-02 and 01-03.
- [ ] UI — the `/login` form is wired to a Server Action that calls Supabase Auth; the logout form is wired to a Server Action. Plans 01-01, 01-02 and 01-04.
- [ ] Deployment — documented local full-stack run command (`npm run dev` against the hosted Supabase project). Plan 01-01 Task 3 records it in its SUMMARY.

## Out of Scope (Deferred to Later Slices)

- Reservation create/edit/list UI → Phase 2 (RESA-01..04)
- Customer panel, customer invites and customer login routing → Phase 3 (AUTH-02, RESA-05/06)
- Payment recording, proof upload UI and signed-URL viewing → Phase 4 (PAGO-01..04). The bucket and its policies already exist.
- Email delivery (custom SMTP via Resend), change notices, reminders and cron → Phase 5 (AVISO-01/02)
- Password-reset UI, MFA, OAuth providers and magic links. CONTEXT says to use Supabase defaults. Note that the default mailer only reaches project team members, so reset emails won't reach the operator until Phase 5's SMTP is in place.
- Browser Supabase client (`lib/supabase/client.ts`) → first phase with a Client Component talking to Supabase directly
- shadcn/ui initialization and the formal design system → Phase 2 UI contract, which needs to resolve the DESIGN.md accent versus the brand color
- Vercel deployment → first operator-facing phase (recommended: Phase 2)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without changing its architectural decisions:

- Phase 2: the admin creates, edits and lists reservations (tipo, cliente, detalle, precio, moneda, estado_proveedor) on `public.reservas`. Every admin page and action calls `requireAdmin()`.
- Phase 3: the admin invites a customer (Auth admin API from a server-only module). The customer logs in and sees only their own `reservas` through the existing `reservas: el cliente ve las suyas` policy.
- Phase 4: the admin records `pagos` (monto, moneda, tasa_cambio for Bs, metodo, estado). The customer uploads to `comprobantes/{uid}/…`, and the admin confirms with one click.
- Phase 5: Resend SMTP and change or reminder emails driven from `public.recordatorios`, followed by a real end-to-end booking.
