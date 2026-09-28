---
phase: 01-base-y-acceso-seguro
plan: 01
subsystem: auth
tags: [supabase, nextjs, rls, vitest, walking-skeleton]
requires: []
provides:
  - "Next.js 16 scaffold (App Router, TypeScript, Tailwind v4) linked to the hosted Supabase project"
  - "public.profiles table + RLS + private.is_admin() SECURITY DEFINER + new-user trigger, live in the hosted project"
  - "lib/supabase/server.ts server-only Supabase client factory"
  - "Working /login -> /admin path proven end-to-end over real HTTP"
  - "tests/helpers/fixtures.ts shared test fixtures every later Phase 1 plan reuses"
  - "vitest.config.ts db + e2e projects with hosted-project globalSetup"
affects: ["01-02", "01-03", "01-04"]
actuals:
  tokens: 88500
  tasks: 3
  commits: 2
tech-stack:
  added:
    - "next@16.3.6, react@19.2.8, react-dom@19.2.8"
    - "@supabase/supabase-js@2.117.2, @supabase/ssr@0.12.7"
    - "zod@4.6.5, react-hook-form@7.89.0, @hookform/resolvers@5.9.1"
    - "supabase CLI@2.118.0 (dev), vitest@5.0.2 (dev)"
  patterns:
    - "private.is_admin() SECURITY DEFINER with empty search_path, called from every admin-check RLS policy — avoids RLS self-recursion on profiles"
    - "Explicit schema/table GRANTs alongside RLS, because this project's Data API has 'Automatically expose new tables' OFF"
    - "server-only import in lib/supabase/server.ts to make browser-vs-server client misuse a build error"
    - "No-JS Server Action form: hidden Server Action input read by submitForm fixture, POSTed as multipart FormData"
    - "getClaims() (JWT-verified) for the admin guard, never getSession()/getUser()'s unverified cookie reader"
key-files:
  created:
    - package.json
    - .env.example
    - vitest.config.ts
    - tests/e2e/global-setup.ts
    - tests/helpers/fixtures.ts
    - supabase/migrations/20260927000001_perfiles_y_rol_admin.sql
    - lib/supabase/server.ts
    - app/login/page.tsx
    - app/admin/page.tsx
    - tests/e2e/admin-login.test.ts
  modified:
    - .gitignore
    - tsconfig.json
key-decisions:
  - "Single hosted Supabase project for dev + automated tests, namespaced rt-test- fixtures with a 30-minute stale sweep (FA-4)"
  - "shadcn/ui init deferred to Phase 2's UI contract; login/admin markup uses plain Tailwind for now (re-scoped, flagged for owner confirmation)"
  - "lib/supabase/client.ts (browser client) not created this phase — no Phase 1 code path needs it yet; enforced split via server-only import"
requirements-completed: [AUTH-01]
coverage:
  - id: D1
    description: "Admin signs in through the real /login form (no JS) and lands on /admin, seeing panel-admin and their email"
    requirement: "AUTH-01"
    verification:
      - {kind: e2e, ref: "tests/e2e/admin-login.test.ts#signs the admin in through the real /login form and redirects to /admin", status: pass}
      - {kind: e2e, ref: "tests/e2e/admin-login.test.ts#shows the panel and the admin's email when visiting /admin with a valid session", status: pass}
    human_judgment: false
  - id: D2
    description: "Anonymous visitor requesting /admin is redirected to /login"
    requirement: "AUTH-01"
    verification:
      - {kind: e2e, ref: "tests/e2e/admin-login.test.ts#redirects an anonymous visitor of /admin to /login", status: pass}
    human_judgment: false
  - id: D3
    description: "public.profiles + RLS + private.is_admin() + new-user trigger live in the hosted project, no customer write path"
    requirement: "AUTH-01"
    verification:
      - {kind: manual-grep, ref: "supabase/migrations/20260927000001_perfiles_y_rol_admin.sql acceptance_criteria greps", status: pass}
      - {kind: cli, ref: "npm run db:migrations shows 20260927000001 applied Remote", status: pass}
    human_judgment: false
duration: 55min
completed: 2026-09-28
status: complete
---

# Phase 1 Plan 01: Walking Skeleton Summary

**A test admin signs in through the real no-JS `/login` form, reaching `/admin` whose access decision comes entirely from `profiles.role` read under Postgres RLS via a `private.is_admin()` SECURITY DEFINER helper — the full Next.js 16 / `@supabase/ssr` / RLS stack proven end-to-end against the real hosted Supabase project before any feature work begins.**

## Performance

- Duration: ~55 minutes across two dispatches (an initial dispatch that scaffolded and wrote Task 2's files but was cut off by a Claude API rate limit before committing, and this continuation agent, which verified Task 2, then executed and committed Task 3 in full)
- Tasks: 3 (Task 1 approval-only, Tasks 2-3 committed)
- Commits: 2 (see Task Commits below)
- Files created: 10 new application/test files + scaffold tree; files modified: 2 (`.gitignore`, `tsconfig.json`)

## Accomplishments

- Approved package list (Task 1) — `react`/`react-dom`'s `too-new` flag confirmed a false positive (Meta donated React to the Linux Foundation's React Foundation, repo moved `facebook/react` → `react/react`, same maintainers)
- Next.js 16 scaffolded via `create-next-app@16` into a temp dir and merged into the existing repo root without clobbering `.claude/`, `.planning/`, `assets/`, `DESIGN.md`, `idea.md`
- Hosted Supabase project linked (`supabase link`) using only `.env.admin.local`-sourced credentials, never read or echoed directly — confirmed solely via `./scripts/check-env.sh`
- `.env.example` documents all 9 variable names (2 in `.env.local`, 7 in `.env.admin.local`) with Spanish source comments, no values
- Vitest configured with `db` and `e2e` projects; `tests/e2e/global-setup.ts` boots a throwaway `next dev` per test run with admin secrets stripped from its child environment
- `tests/helpers/fixtures.ts` gives every later Phase 1 plan: `publicClient`, `serviceClient`, `createTestUser`, `cleanupTestUsers`, `sweepStaleTestUsers`, `CookieJar`, `submitForm` — namespaced `rt-test-` fixtures with a 30-minute stale-account sweep
- `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql` pushed and confirmed applied **Remote**: `public.profiles`, RLS, `private.is_admin()`, `private.handle_new_user()` trigger, explicit schema/table GRANTs (this project's Data API has table auto-expose OFF)
- `lib/supabase/server.ts` + `app/login/page.tsx` + `app/admin/page.tsx`: the real no-JS login form signs an admin in via `signInWithPassword`, and `/admin` verifies the session with `getClaims()` (JWT-verified) before reading `profiles.role` under RLS
- `tests/e2e/admin-login.test.ts`: RED first (watched fail — `/login` didn't exist, then failed again because `public.profiles` didn't exist), GREEN after the full path was built — 3/3 tests pass against the real hosted project
- **Ejecución local completa:** `npm run dev` → http://localhost:3000/login (usa el proyecto Supabase real) — confirmed manually, `/login` responds 200

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Package legitimacy gate | (no commit — approval-only; human replied "aprobado" for the standard audit plus an extra round specifically on react/react-dom) | none |
| 2 | Wave 0 scaffold, link, secrets split, Vitest harness, fixtures | `46bfd01` | package.json, package-lock.json, .gitignore, .env.example, tsconfig.json, next.config.ts, eslint.config.mjs, postcss.config.mjs, app/layout.tsx, app/page.tsx, app/favicon.ico, app/globals.css, public/*, supabase/config.toml, supabase/.gitignore, vitest.config.ts, tests/e2e/global-setup.ts, tests/helpers/fixtures.ts |
| 3 (tracer) | Admin signs in at /login, lands on /admin via real RLS | `25e1db9` | supabase/migrations/20260927000001_perfiles_y_rol_admin.sql, lib/supabase/server.ts, app/login/page.tsx, app/admin/page.tsx, tests/e2e/admin-login.test.ts, tests/e2e/global-setup.ts (deviation fix), tsconfig.json (Next auto-managed), .gitignore (deviation fix) |

Task 2's file-writing work was originally done by a prior dispatch that was interrupted by an HTTP 429 Claude API session-limit error right before it could verify and commit — no files were lost, nothing was committed prematurely. This continuation agent re-verified every one of Task 2's `<verify>` commands and `<acceptance_criteria>` checks against the on-disk state before committing it, then executed Task 3 in full.

## Files Created/Modified

**Created:** `package.json`, `package-lock.json`, `.env.example`, `tsconfig.json` (scaffold baseline), `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/favicon.ico`, `app/globals.css`, `public/*.svg`, `supabase/config.toml`, `supabase/.gitignore`, `vitest.config.ts`, `tests/e2e/global-setup.ts`, `tests/helpers/fixtures.ts`, `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql`, `lib/supabase/server.ts`, `app/login/page.tsx`, `app/admin/page.tsx`, `tests/e2e/admin-login.test.ts`

**Modified:** `.gitignore` (twice — secrets split in Task 2, root `AGENTS.md`/`CLAUDE.md` ignore in Task 3), `tsconfig.json` (Next 16 dev-server auto-managed typegen include, Task 3)

**Local-only, git-ignored, never committed:** `.env.local`, `.env.admin.local` (pre-existing, written directly by the user; verified only via `./scripts/check-env.sh`)

## Decisions Made

- Worktree isolation is disabled project-wide for this phase/plan (`workflow.use_worktrees: false`) because gitignored Supabase secrets (`.env.local`, `.env.admin.local`) live only in the main checkout and would not be visible inside an isolated worktree — a prior commit (`f985e13`) already made this call; this plan executed sequentially on `main` per that decision (`branching_strategy: none`, `allow_default_branch_commits: true`)
- Single hosted Supabase project serves both development and automated e2e/RLS tests; test data is namespaced `rt-test-` and swept after 30 minutes (FA-4) rather than provisioning a separate test project
- `shadcn/ui init` deferred to Phase 2's UI contract — it rewrites the global Tailwind theme and DESIGN.md's accent (`#0066cc`) conflicts with the brand purple `#482583`; Task 3's login/admin markup uses plain Tailwind utility classes for now (re-scoped from RESEARCH/PATTERNS, flagged for owner confirmation, not silently resolved)
- `lib/supabase/client.ts` (browser client) not created this phase — no Phase 1 code path needs it (login and the admin guard are both server-side); the browser/server split is enforced today via `server-only` import instead

## Deviations from Plan

**1. [Rule 3 - Blocking issue] `tests/e2e/global-setup.ts` couldn't see `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, causing every `/login` and `/admin` request in the e2e run to 500**
- **Found during:** Task 3, first GREEN attempt after building the full path (RED had already passed as expected; this surfaced only once real HTTP requests hit the spawned dev server)
- **Issue:** the plan's design assumes Vitest's `test.env` (populated by `vitest.config.ts`'s `loadEnv('admin', ...)`) is already present on `process.env` inside `global-setup.ts`. In this Vitest version, `globalSetup` runs in a separate process from the test-file worker, so `process.env` there did **not** carry `NEXT_PUBLIC_SUPABASE_URL` or the publishable key (confirmed by temporarily piping the spawned `next dev`'s stdout/stderr to a log file and reading the exact error: `Your project's URL and Key are required to create a Supabase client!`)
- **Fix:** `global-setup.ts` now calls `loadEnv('admin', process.cwd(), '')` directly (same technique `vitest.config.ts` already uses) and merges it into the child's env, still stripping `SUPABASE_SECRET_KEY`/`SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`/`ADMIN_INITIAL_PASSWORD` before spawning `next dev`
- **Files modified:** `tests/e2e/global-setup.ts`
- **Commit:** `25e1db9`

**2. [Rule 2 - Missing critical functionality / plan-forbidden artifact] Next.js 16's `next dev` auto-writes root-level `AGENTS.md`/`CLAUDE.md`**
- **Found during:** Task 3, after running `npm run dev` for the manual full-stack check
- **Issue:** every `next dev` start (re)writes an agent-rules block to a root `AGENTS.md` and a root `CLAUDE.md` that `@`-imports it — new Next.js 16 behavior not anticipated by the plan, which explicitly forbids root `CLAUDE.md`/`AGENTS.md` (project instructions live only in `.claude/CLAUDE.md`). Left uncleaned, every future `npm run dev` in this or later plans would re-dirty `git status` with these files.
- **Fix:** deleted both files, added `/AGENTS.md` and `/CLAUDE.md` to `.gitignore` with a comment explaining why. Confirmed `.claude/CLAUDE.md` stayed byte-for-byte unchanged (`git diff --quiet -- .claude/CLAUDE.md` exits 0).
- **Files modified:** `.gitignore`
- **Commit:** `25e1db9`

**3. [Rule 1 - unrequested but harmless] `tsconfig.json` reformatted + one include path added by Next's own dev typegen**
- **Found during:** Task 3, same `npm run dev` run as above
- **Issue:** Next 16's dev server auto-manages `tsconfig.json`'s `compilerOptions`/`include` arrays for its own type-checking (added `.next/dev/dev/types/**/*.ts`, reformatted arrays to multi-line) — same class of auto-managed file as `next-env.d.ts`, harmless, and would re-occur on the next `dev`/`build` run regardless of whether it was reverted now.
- **Fix:** accepted the framework's own change rather than fighting it every dev-server start; re-ran `npx tsc --noEmit` and `npm run build` after — both still pass.
- **Files modified:** `tsconfig.json`
- **Commit:** `25e1db9`

## Issues Encountered

- The original Task 2 dispatch was cut off by an `HTTP 429 session limit` (a Claude API rate limit, not a task failure) right as it was about to verify Task 2's remaining acceptance criteria — it had already scaffolded, installed, and written every Task 2 file, but had not committed anything and had not started Task 3. This continuation agent verified every Task 2 `<verify>` command and `<acceptance_criteria>` check from scratch against the on-disk state (did not assume correctness from file presence alone) before committing, then proceeded cleanly through Task 3. No work was lost or duplicated.
- The `git status --short` / `git check-ignore` / `git ls-files` commands that directly named `.env.local`/`.env.admin.local` were blocked by this environment's own secret-file read guard (a `PreToolUse:Bash` hook), even though those git subcommands only check tracked/ignored status and never print file contents. Verified the same facts indirectly instead: `.gitignore`'s content (`.env.local`, `.env.admin.local`, and the blanket `.env*` line, with `!.env.example` un-ignoring the template) and the fact that `.env.local`/`.env.admin.local` never appear in `git status --short` output (git silently omits ignored files from status by default) together confirm both files are git-ignored and untracked.

## User Setup Required

None — already satisfied per Task 2's precondition. The user had already written real values directly into `.env.local` (2 vars) and `.env.admin.local` (7 vars, including `ADMIN_INITIAL_PASSWORD`), confirmed via `./scripts/check-env.sh` printing `OK:` for all 7 checked vars before this plan started.

## Next Phase Readiness

- Plan 01-02 can now build the real operator account (`gabbovera@gmail.com`, D-03) and the `proxy.ts` session-refresh wrapper on top of this skeleton — `lib/supabase/server.ts`, the `profiles` schema, and `private.is_admin()` are all live and proven end-to-end.
- Plan 01-03 can extend the same migration pattern (explicit GRANTs + RLS + `private.is_admin()`) to `reservas`/`pagos`/`recordatorios`/`storage.objects` without re-deriving the pattern.
- Plan 01-04 can move the inline `iniciarSesion` Server Action into `app/login/actions.ts` with full `zod`/`react-hook-form` validation, reusing the same `form-login` test id and `submitForm` fixture.
- `tests/helpers/fixtures.ts` is stable and ready for later plans to **add** exports to (never remove/rename existing ones, per the plan's own contract).
- Flagged for owner confirmation before Phase 2 UI work: the `shadcn/ui init` re-scope (Task 3 uses plain Tailwind for now) and the `profiles`/`reservas`/`pagos`/`recordatorios` schema design (FA-3, Claude's-discretion greenfield choice).

---
*Phase: 01-base-y-acceso-seguro*
*Completed: 2026-09-28*
