<!-- GSD:project-start source:PROJECT.md -->

## Project

**Rent & Trippin**

Rent & Trippin es una agencia de viajes digital en Venezuela que vende pasajes aéreos (nacionales e internacionales), hoteles, tours y entradas a conciertos. Hoy opera 100% manual por Instagram y WhatsApp, gestionada por una sola persona. Este proyecto construye una app web (MVP) que centraliza reservas, cobros, confirmación de pagos y seguimiento para el operador, y da a cada cliente un panel propio para ver sus reservas.

**Core Value:** Que el operador deje de gestionar todo a mano por WhatsApp y tenga un solo lugar para crear reservas, cobrar, confirmar pagos y darles seguimiento — sin perder ninguna.

### Constraints

- **Tech stack**: Next.js + Supabase + Vercel — rápido de construir, barato de alojar, fácil de mantener sin ser programador experto (ni el dueño del negocio ni quien administra el proyecto programan).
- **Pagos**: no existe empresa constituida (LLC); los pagos con tarjeta internacional van por link de pago de Payoneer (no checkout embebido, porque eso requiere cuenta empresarial aprobada como partner). La confirmación de todos los métodos de pago (Zelle, Binance, Payoneer) es manual por parte del operador.
- **Equipo**: el operador trabaja solo — el MVP asume un solo usuario admin.
- **Identidad visual**: debe usar el logo y color de marca (`#482583`) ya definidos; no se inventa una paleta nueva.
- **Plataforma**: la mayoría de los clientes usan celular — la app debe funcionar bien en móvil antes que en escritorio.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Verdict on the Proposed Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.3.x (App Router) | Frontend + server logic (Server Components, Server Actions, Route Handlers) | Current stable LTS line (shipped Oct 2025, now ~11 months mature); most-documented React meta-framework, which matters because whoever maintains this later — a hired developer or an AI assistant — needs abundant reference material. Ships React 19.2 and Turbopack by default. [MEDIUM confidence, cross-checked against nextjs.org/blog] |
| React | 19.2 (bundled with Next.js 16) | UI library | Comes with Next.js; no separate decision needed. |
| TypeScript | 5.7+ (Next.js 16 requires 5.1.0+ minimum) | Type safety | Catches mistakes (wrong field name, wrong type) before they reach production — valuable precisely because there's no dedicated QA team to catch them. [HIGH confidence, official Next.js docs] |
| Supabase | Latest (managed cloud) | Postgres database, Auth (admin + customer), file Storage (payment screenshots), scheduled jobs (Cron), serverless functions (Edge Functions) | One managed service instead of five separate ones (DB host, auth provider, file storage, cron service, backend). Relational Postgres fits the domain (a client has many reservations, a reservation has one payment, a reservation has many reminders) far better than a NoSQL alternative like Firebase. [HIGH confidence] |
| Vercel | Pro plan ($20/month/member) | Hosting, CI/CD, preview deployments | Zero-config deploys directly from a Next.js repo; a `git push` deploys automatically with no server to patch or reboot. **Must be Pro, not Hobby** — Hobby's terms of service restrict it to non-commercial personal projects and Vercel can take down commercial deployments without notice. [HIGH confidence, verified against Vercel's own Terms of Service and Fair Use Guidelines] |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | latest v2.x | Supabase client SDK | Every read/write to the database, auth, and storage goes through this. |
| `@supabase/ssr` | latest (0.x) | Cookie-based session handling for Next.js Server Components/Route Handlers/middleware | Required for Supabase Auth to work correctly with the App Router. **Do not use `@supabase/auth-helpers-nextjs`** — it is deprecated and in maintenance-only mode; all new features and fixes go to `@supabase/ssr`. [HIGH confidence] |
| Tailwind CSS | v4.x | Styling | Utility-first CSS; pairs natively with shadcn/ui; v4's CSS-variable theming makes it easy to apply the brand purple (`#482583`) as a design token once, everywhere. |
| shadcn/ui | latest CLI | Prebuilt, accessible UI components (buttons, forms, tables, dialogs) copied into the codebase | Not an npm dependency in the traditional sense — components are generated into the project as editable source files. This matters for a non-technical-maintained project: there's no black-box component library version to fight, and an AI assistant or future developer can read and modify the actual component code directly. De facto standard for Next.js + Tailwind admin panels in 2026. |
| `react-hook-form` | 7.83.x | Form state management | Standard form library for React; handles validation state, submission, and error display for the reservation and payment forms with far less code than hand-rolled state. |
| `zod` | 4.x | Schema validation | Defines the shape of a reservation/payment once, validates both the form on the client and the data on the server (Server Action) from the same schema — avoids duplicating validation logic in two places. |
| `@hookform/resolvers` | 5.9.x | Connects zod schemas to react-hook-form | Auto-detects Zod 3 or 4; `zodResolver` glue code. |
| `resend` | latest | Transactional email (booking confirmations, change notices, date reminders) | Native integrations with Next.js, Vercel, and Supabase; free tier (3,000 emails/month, 100/day) comfortably covers 10-15 bookings/week; React Email lets templates be written as JSX, consistent with the rest of the app. |
| `react-email` | latest | Email templates as React components | Ships with Resend's workflow; lets the same component mental model (JSX + Tailwind-like styling) be reused for email design instead of learning HTML email quirks separately. |
| `date-fns` | latest v4.x | Date math (days-until-trip, formatting Bs/USD dates, timezone-safe reminder scheduling) | Lightweight, tree-shakeable, and simpler to reason about than hand-writing date arithmetic — needed for "remind X days before an important date." |
| `@serwist/next` + `serwist` | latest | PWA support (installable icon, offline shell, service worker) | Maintained successor to `next-pwa` (which is effectively unmaintained). Required to deliver the "installable web app" (PWA) experience described in the architecture decision, since most customers are on mobile. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI | Local Postgres schema migrations, local dev environment, type generation | Run `supabase gen types typescript` to auto-generate TypeScript types from the database schema — keeps the app's types in sync with the database without manual duplication, which matters a lot when no one on the team is a full-time developer maintaining that discipline by hand. |
| Vercel CLI | Preview deployments, environment variable management | `vercel env pull` syncs Supabase keys locally; every git branch gets a free preview URL to show the owner before merging to production. |
| ESLint + Prettier (Next.js defaults) | Code consistency | Ships with `create-next-app`; low-effort, catches obvious mistakes. |

## Installation

# Scaffold (already assumes Next.js 16, App Router, TypeScript, Tailwind, ESLint — all default prompts in create-next-app)

# Core

# Forms + validation

# Email

# Dates

# PWA

# UI components (adds Tailwind config + writes component source files into the repo)

# Dev dependencies

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Supabase | Firebase | If the data model were document-shaped (chat logs, activity feeds) rather than relational. Here, reservations/payments/reminders are inherently relational (foreign keys, joins, "sum of payments per reservation") — Postgres + RLS fits better than Firestore's NoSQL model. |
| Supabase (managed) | PocketBase / self-hosted Postgres on a $5 VPS | Only if minimizing cost matters more than minimizing maintenance burden. Self-hosting means the team (who does not code) becomes responsible for OS patches, database backups, and uptime — the opposite of the stated priority ("fácil de mantener sin ser programador experto"). |
| Vercel | Netlify | Netlify is a comparable option for Next.js hosting with similar pricing tiers; Vercel is preferred here only because it's built by the same team as Next.js and has marginally tighter integration (zero-config, first-party cron, faster App Router feature support). Either is a reasonable choice; don't rebuild the decision from scratch if Netlify is already familiar to whoever builds this. |
| Supabase Cron (pg_cron + pg_net) for reminders | Vercel Cron Jobs | Only if the reminder logic needs to live in Next.js code rather than a Supabase Edge Function. On Vercel's Hobby plan, cron runs at most once a day at an imprecise hour — not reliable enough for "remind X days before." Even on Vercel Pro (which this project needs anyway for the commercial-use rule), keeping the reminder cron in Supabase keeps the logic next to the data it reads. |
| Resend (email) for MVP reminders/notifications | WhatsApp Business Platform (Cloud API) | Once the business registration situation is resolved (see Open Questions) and message volume justifies the setup cost. WhatsApp is where customers already are, but Meta's Cloud API requires business verification (documents, 2-30 day approval), pre-approved message templates, and per-message billing (roughly $0.01-$0.03+/message depending on country and category) — real setup and ongoing cost for a channel that isn't required to satisfy the MVP requirement ("aviso al cliente si algo cambia," "recordatorio antes de una fecha"). Email satisfies this requirement immediately at near-zero cost, since every customer already needs an email address to have a login. |
| react-hook-form + zod | Formik | Formik is older, has a larger bundle, and the ecosystem has largely converged on react-hook-form + zod as the 2026 default; no reason to choose Formik for a greenfield project. |
| Simple `profiles.role` column + RLS | Supabase Custom Access Token Hook (JWT custom claims for RBAC) | Only worth the extra setup (a Postgres function or Edge Function wired into Auth settings) if there were many admins or a complex permission matrix. With exactly one admin (the owner) and one other role (customer), a `role` text column on a `profiles` table checked inside RLS policies is simpler to build, explain, and debug — fewer moving parts for a non-technical maintainer to reason about. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Vercel **Hobby** plan for production | Vercel's Terms of Service define "commercial use" broadly (any deployment used for financial gain, including "requesting or processing payment from visitors") and explicitly restrict Hobby to personal/non-commercial use; Vercel can disable Hobby deployments without notice for violating this. This app processes real bookings and payments from day one. | Vercel **Pro** ($20/month/member) |
| `@supabase/auth-helpers-nextjs` | Deprecated by Supabase; in maintenance mode only, no new features or App Router improvements land here. | `@supabase/ssr` |
| `next-pwa` | Effectively unmaintained; the ecosystem has moved to Serwist as the supported successor. | `@serwist/next` + `serwist` |
| NextAuth.js / Auth.js | Would duplicate what Supabase Auth already provides (session management, email/password, RLS integration) — running two auth systems side by side adds confusion and a second thing to configure/secure for no functional gain here. | Supabase Auth (already included) |
| A separate Node/Express backend server | Next.js Server Actions and Route Handlers already provide everything a backend server would (business logic, talking to Supabase with elevated privileges when needed) — a second server means a second thing to deploy, monitor, and pay for. | Next.js Route Handlers / Server Actions running on Vercel |
| WhatsApp Business Cloud API for the MVP notification requirement | Requires Meta business verification (documents, days-to-weeks of approval lead time), pre-approved message templates, and per-message cost — real setup complexity that isn't necessary just to satisfy "notify on change" / "remind before a date." Good candidate for Phase 2 once volume and the business-registration question justify it. | Resend (email) for MVP; revisit WhatsApp Cloud API later |
| Twilio SMS for reminders | Per-message SMS cost plus inconsistent international carrier delivery to Venezuelan numbers make it a worse fit than email for this audience and volume; adds a fourth vendor account to manage. | Resend (email) |
| Storing payment screenshots in a **public** Supabase Storage bucket | A public bucket means anyone with the file URL — guessable or leaked — can view a customer's payment proof (which may contain partial card/bank details, names, amounts). | **Private** bucket + Row Level Security policies + `createSignedUrl()` for time-limited, authenticated access |

## Stack Patterns by Variant

- Move from Supabase's Free tier to Pro ($25/month) before hitting the free tier's storage/compute ceilings, and start watching egress costs (screenshots are the main egress driver).
- Revisit WhatsApp Cloud API for reminders — at higher volume the "customers are already on WhatsApp" advantage starts to outweigh the setup cost.
- Only then is it worth introducing Supabase's Custom Access Token Hook / proper `roles` + `user_roles` tables — building that now for a single admin would be premature complexity.
- Payment confirmation moves from fully manual (screenshot upload + admin click) to a webhook-driven flow (Stripe/Payoneer webhook → Supabase Edge Function → auto-update payment status). This is a meaningful architecture change, not just a config swap — flag it as its own phase when it happens rather than trying to build it speculatively now.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Next.js 16.x | Node.js 20.9+ | Node 18 is no longer supported; whoever sets up the dev machine or CI needs Node 20.9 or newer. |
| Next.js 16.x (App Router) | `@supabase/ssr` (latest) | `@supabase/ssr` is built specifically for App Router Server Components/Route Handlers/middleware; this is the supported path, unlike the deprecated auth-helpers package. |
| Next.js 16.x | TypeScript 5.1.0+ | Minimum enforced by Next.js 16; recommend using a current 5.7+ release anyway for the latest type-checking improvements. |
| Tailwind CSS v4 | shadcn/ui (latest CLI) | shadcn/ui's current generator targets Tailwind v4's CSS-variable-based theming; don't mix a v3-era shadcn install with a v4 Tailwind project. |
| `zod` v4 | `@hookform/resolvers` 5.x | The resolver auto-detects Zod 3 vs 4, but installing both packages at their latest versions together avoids ambiguity. |

## Open Questions / Needs Verification Before Building

- **WhatsApp Business Platform verification for a Venezuelan sole proprietor without a formal company:** Meta's documented policy accepts sole proprietorships as a business type, but the specific documentation required varies by country and wasn't confirmed for Venezuela specifically. [LOW confidence — flagged, not blocking, since WhatsApp is deferred to Phase 2 in this recommendation anyway.]
- **Exact current patch versions** of fast-moving packages (`@supabase/ssr`, `zod`, `tailwindcss`, shadcn CLI) should be re-checked with `npm view <package> version` at the moment the project is actually scaffolded — this research is current as of the research date, but these packages release frequently.

## Sources

- [Next.js 16 blog post](https://nextjs.org/blog/next-16) — version/feature confirmation [MEDIUM confidence, websearch cross-checked]
- [Next.js Upgrading: Version 16 docs](https://nextjs.org/docs/app/guides/upgrading/version-16) — Node.js 20.9+ requirement [MEDIUM confidence]
- [Vercel Terms of Service](https://vercel.com/legal/terms) and [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) — Hobby plan commercial-use restriction [HIGH confidence, primary source, cross-checked against multiple third-party summaries]
- [Vercel Cron Jobs usage and pricing docs](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Hobby once-daily cron limit vs Pro plan [MEDIUM confidence]
- [Supabase pricing](https://supabase.com/pricing) area — free tier limits (500MB DB, 1GB storage, 50k MAU) [MEDIUM confidence, cross-checked across multiple 2026 pricing breakdowns]
- [Supabase Custom Claims & RBAC docs](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac) — role/JWT patterns [MEDIUM confidence]
- [Supabase Storage Access Control docs](https://supabase.com/docs/guides/storage/security/access-control) — private bucket + signed URL pattern [MEDIUM confidence]
- [Supabase Scheduling Edge Functions docs](https://supabase.com/docs/guides/functions/schedule-functions) and [Supabase Cron blog post](https://supabase.com/blog/supabase-cron) — pg_cron + pg_net reminder architecture [MEDIUM confidence]
- [Supabase auth-helpers deprecation notice (GitHub)](https://github.com/supabase/auth-helpers) and [`@supabase/ssr` npm page](https://www.npmjs.com/package/@supabase/ssr) — deprecation confirmation [HIGH confidence, primary source]
- [Resend pricing](https://resend.com/pricing) — free tier limits (3,000/mo, 100/day) [MEDIUM confidence]
- [Meta for Developers — WhatsApp Business Platform pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) and third-party 2026 pricing breakdowns — per-message cost model [MEDIUM confidence]
- [WhatsApp API prerequisites / business verification guides](https://www.wati.io/en/blog/whatsapp-api-prerequisites/) — sole proprietorship acceptance, general (non-Venezuela-specific) [LOW confidence for the Venezuela-specific case]
- Websearch cross-checks on `react-hook-form`, `zod`, `@hookform/resolvers`, Serwist/PWA setup, shadcn/ui + Tailwind v4 stack conventions [MEDIUM confidence, multiple independent 2026 sources corroborating]

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## Codex Delegation Policy

Vigente desde Fase 3 y todas las fases siguientes.

- **Por defecto, Codex implementa todo el código** (vía `/codex:rescue`). Claude no escribe implementación directamente salvo excepción explícita abajo.
- **Claude:** audita el resultado de Codex, toma las decisiones de arquitectura, y resuelve lo que Codex no puede delegarse:
  - Migraciones que tocan secretos (contraseñas, tokens, llaves — cualquier cosa que viva en `.env.admin.local`).
  - Decisiones de seguridad (ej. el fix de WR-01 y cualquier cosa de esa naturaleza — login compartido, RLS, manejo de sesión).
  - Cualquier tarea que el PLAN.md correspondiente marque explícitamente como no delegable.
- **Antes de cerrar cualquier tarea delegada a Codex:** correr Anti-Slop y el skill `gsd-code-review` (o el agente "Code Reviewer") sobre el diff — no `/thermos`, que tiene `disable-model-invocation: true` y solo el usuario puede dispararlo escribiéndolo él mismo, nunca Claude por su cuenta. Ninguna tarea delegada se da por completa sin este gate automático.
- **Instrucción estándar para Codex en cada PLAN.md:** nunca leer ni imprimir `.env.local` ni `.env.admin.local` — para verificar que una variable existe, usar únicamente `scripts/check-env.sh`.

### Selección de modelo por tarea (vigente desde Fase 3)

- **Haiku:** tareas mecánicas — leer archivos, verificar que un grep coincide, correr checks deterministas, formatear output.
- **Sonnet:** código y decisiones de alcance medio — el default para la mayoría del trabajo de ejecución.
- **Opus:** solo cuando el plan lo justifique explícitamente — arquitectura nueva de alto riesgo, decisiones con impacto en seguridad (ej. el fix de WR-01).
- Si el modelo activo es más caro de lo que la tarea necesita, pausar y bajar de nivel antes de continuar — no seguir en un modelo sobredimensionado por inercia.

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
