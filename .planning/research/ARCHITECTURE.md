# Architecture Research

**Domain:** Small booking/reservations app — single admin + many customers, manual payment confirmation, file-upload payment proof (Next.js + Supabase + Vercel)
**Researched:** 2026-09-27
**Confidence:** HIGH (all core patterns are official Supabase/Vercel patterns, verified against current docs and multiple independent write-ups)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser / PWA)                       │
│  ┌────────────────────┐        ┌────────────────────┐                │
│  │  Admin Panel (/admin)│       │ Customer Panel (/app)│               │
│  │  reservas, cobros,   │       │ mis reservas, subir  │               │
│  │  confirmar pagos     │       │ comprobante, pagar   │               │
│  └──────────┬───────────┘       └──────────┬───────────┘              │
└─────────────┼──────────────────────────────┼──────────────────────────┘
              │  (Server Components/Actions, Route Handlers)            │
┌─────────────▼──────────────────────────────▼──────────────────────────┐
│                    NEXT.JS APP (Vercel, App Router)                   │
│  ┌────────────┐ ┌───────────────┐ ┌────────────────┐ ┌─────────────┐ │
│  │ Auth        │ │ Reservas      │ │ Pagos /        │ │ Reminders / │ │
│  │ middleware  │ │ Server        │ │ Storage        │ │ Notif. cron │ │
│  │ (@supabase/ │ │ Actions       │ │ Actions        │ │ route       │ │
│  │  ssr)       │ │               │ │                │ │ handler     │ │
│  └──────┬──────┘ └───────┬───────┘ └────────┬───────┘ └──────┬──────┘ │
└─────────┼────────────────┼──────────────────┼────────────────┼────────┘
          │                │                  │                │
┌─────────▼────────────────▼──────────────────▼────────────────▼────────┐
│                              SUPABASE                                 │
│  ┌───────────┐   ┌──────────────────────────┐   ┌──────────────────┐ │
│  │ Auth       │   │ Postgres + RLS            │   │ Storage           │ │
│  │ (auth.users│   │ profiles / reservas /     │   │ comprobantes/     │ │
│  │  + email/  │   │ pagos / recordatorios     │   │ (private bucket,  │ │
│  │  magic     │   │                           │   │  signed URLs)     │ │
│  │  link)     │   │                           │   │                   │ │
│  └───────────┘   └──────────────────────────┘   └──────────────────┘ │
└──────────────────────────────────┬────────────────────────────────────┘
                                    │
                      ┌─────────────┴─────────────┐
                      │      EXTERNAL SERVICES      │
                      │  Payoneer (payment link,    │
                      │  no API — manual reconcile) │
                      │  Resend/Postmark (email)    │
                      └──────────────────────────────┘
```

This is a **monolith by design**: one Next.js app, one Supabase project, no microservices, no queue infra. That is the correct shape for ~10-15 bookings/week with one non-technical operator. Do not introduce a separate backend, a message queue, or a second database — every one of those adds an ops surface nobody on this team can maintain.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Auth (Supabase Auth) | Identity for both the admin and every customer; issues the session Postgres RLS reads via `auth.uid()` | `@supabase/ssr` — one browser client, one server client used in Server Components/Actions/Route Handlers |
| `profiles` table | Maps `auth.users.id` → role (`admin` \| `customer`) + display data (nombre, teléfono) | Row auto-created via a Postgres trigger on `auth.users` insert; `role` defaults to `customer`, admin row seeded manually once |
| Admin Panel | Create/edit reservas, register cobros, review comprobantes, confirm pagos, mark reservas confirmed/con problema | Server Components for lists/detail, Server Actions for mutations — all gated by `role = 'admin'` in RLS, not just in the UI |
| Customer Panel | Read-only view of own reservas + pago status, upload comprobante, click Payoneer link | Server Components scoped by `auth.uid()`; one client-side upload widget for Storage |
| Reservas/Pagos/Recordatorios (Postgres) | System of record — every state transition (pendiente → confirmada, pendiente_revision → confirmado) lives here, not in chat/WhatsApp | Postgres tables with RLS; status changes are the only source of truth the app trusts |
| Storage (`comprobantes` bucket) | Holds payment-proof screenshots privately; never public URLs | Private bucket, RLS policies on `storage.objects`, access only via short-lived signed URLs |
| Notification/Reminder engine | Detects state changes and upcoming dates, sends email (and logs it), independent of WhatsApp | A single Vercel Cron-triggered Route Handler, run once daily, calling Resend |
| Payoneer | External, out-of-band card processor — app only stores a link and a manual confirmation flag | No API integration in MVP; admin reconciles manually in their Payoneer dashboard |

## Recommended Project Structure

```
app/
├── (admin)/                 # admin-only route group, protected by middleware + RLS
│   ├── layout.tsx           # checks role=admin, redirects otherwise
│   ├── reservas/
│   │   ├── page.tsx         # list + filters by estado
│   │   ├── nueva/page.tsx   # create reserva (+ cliente if new)
│   │   └── [id]/page.tsx    # detail: edit, ver pago, confirmar
│   └── pagos/
│       └── page.tsx         # cola de comprobantes pendientes de revisión
├── (cliente)/                # customer route group
│   ├── layout.tsx           # checks authenticated customer
│   ├── mis-reservas/page.tsx
│   └── reservas/[id]/page.tsx  # detail + subir comprobante / link Payoneer
├── (auth)/
│   ├── login/page.tsx
│   └── invitar/[token]/page.tsx  # customer sets password after admin creates them
├── api/
│   └── cron/
│       └── recordatorios/route.ts   # hit by Vercel Cron, protected by CRON_SECRET
├── actions/                  # Server Actions, one file per aggregate
│   ├── reservas.ts
│   ├── pagos.ts
│   └── clientes.ts
lib/
├── supabase/
│   ├── client.ts             # browser client (@supabase/ssr createBrowserClient)
│   ├── server.ts              # server client (@supabase/ssr createServerClient)
│   └── middleware.ts          # session refresh, used in middleware.ts
├── notifications/
│   └── email.ts               # Resend wrapper, templates
supabase/
├── migrations/                # SQL migrations: schema + RLS policies, version-controlled
└── seed.sql                   # admin profile seed for local/dev
middleware.ts                  # refreshes Supabase session on every request
```

### Structure Rationale

- **Route groups `(admin)` / `(cliente)`:** physically separates the two panels so a layout-level guard (`role !== 'admin' → redirect`) can never be bypassed by forgetting a per-page check. Mirrors the real-world boundary: one operator, many customers, never overlapping UI.
- **`app/actions/`:** all writes (create reserva, confirm pago) go through Server Actions, not client-side Supabase calls. This keeps business rules (e.g., "only admin can flip pago to confirmado") in one server-side place, and lets you log/audit every mutation later without redesigning.
- **`supabase/migrations/`:** treat schema + RLS policies as code, checked into the repo. This matters more than usual here because RLS is the actual authorization layer — there is no separate backend to enforce rules, so migrations are the audit trail of "who can do what."
- **Single `lib/supabase/` module:** enforces the two-client rule (browser vs. server) that `@supabase/ssr` requires; scattering client creation invites the classic bug of using a browser-session client inside a Server Component.

## Architectural Patterns

### Pattern 1: RLS as the only authorization layer

**What:** Every table (`reservas`, `pagos`, `recordatorios`, `profiles`) has Row Level Security enabled, with policies keyed off `auth.uid()` and a `role` check via a `profiles` lookup (or a Postgres function `is_admin()`). The Next.js app never uses the Supabase **service role key** to bypass RLS for normal app traffic — only for one-off admin scripts (seeding, backfills) run outside the request path.
**When to use:** Always, for this project. With one admin and no internal team, there is no case where "trust the server code" is safer than "trust the database policy" — RLS protects you even if a Server Action has a bug.
**Trade-offs:** Slightly more upfront SQL to write and test (policies must be verified with `SET ROLE` or integration tests); in exchange you get correctness that survives future refactors, added routes, or a second developer touching the code without knowing every rule.

**Example:**
```sql
create policy "customers read own reservas"
on reservas for select
using (cliente_id = auth.uid());

create policy "admin full access reservas"
on reservas for all
using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
```

### Pattern 2: Admin-provisioned customer accounts (invite, not self-signup)

**What:** The admin creates the reserva (and the cliente record) first — exactly as described in the discovery notes. The system then creates a Supabase Auth user for that email/phone and sends a magic-link/invite so the customer can set a password and log in to see the reserva already waiting for them. There is no public "sign up" page.
**When to use:** Matches this business model exactly — reservations are made by the operator on behalf of a client (often over WhatsApp first), not self-served. It also closes off spam signups and keeps `profiles.role` simple (every self-created row defaults to `customer`; there is exactly one `admin` row, seeded once).
**Trade-offs:** Requires an "invite" flow (Supabase `auth.admin.inviteUserByEmail` from a server-only context, or a Server Action calling the Admin API) instead of a plain public signup — a little more code, but it removes a whole class of edge cases (unclaimed accounts, duplicate customers, fake accounts).

**Example:**
```typescript
// app/actions/clientes.ts (Server Action, uses service role — admin-only context)
const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  data: { role: "customer", nombre },
});
```

### Pattern 3: Private Storage + signed URLs for payment proof

**What:** The `comprobantes` bucket is **not public**. Customers upload directly from the browser to Storage (via the Supabase client, short-lived upload), scoped by an RLS policy on `storage.objects` that only lets a customer write under a path containing their own `auth.uid()` (e.g., `comprobantes/{user_id}/{reserva_id}.jpg`). The admin panel reads the image via a server-generated signed URL (`createSignedUrl`, ~1 hour TTL) — never a raw public link.
**When to use:** Always for anything resembling a financial document. A public bucket with an "unguessable" URL is not access control — it is security through obscurity, and screenshots of Zelle/Binance transfers are sensitive enough to warrant real RLS.
**Trade-offs:** Signed URLs expire, so the admin panel must generate them on render (small server cost, negligible at this volume) rather than caching a permanent URL in the `pagos` row. Store the **storage path**, not a URL, in the `pagos.comprobante_path` column, and resolve it to a signed URL on read.

## Data Flow

### Reservation + Payment Lifecycle (core flow)

```
Admin creates reserva (Server Action)
    ↓
INSERT cliente (if new, triggers Auth invite) → INSERT reserva (estado=pendiente)
    ↓
Customer logs in via invite link → sees reserva in "Mis reservas"
    ↓
Customer chooses payment method
    ├─ Efectivo/Zelle/Binance → uploads comprobante to Storage → INSERT pagos (estado=pendiente_revision, comprobante_path=...)
    └─ Tarjeta → admin already generated Payoneer link at reserva creation → INSERT pagos (metodo=payoneer, payment_link_url=..., estado=pendiente_revision)
    ↓
Admin reviews pending pagos queue → opens signed URL of comprobante (or checks Payoneer dashboard)
    ↓
Admin clicks "Confirmar pago" (Server Action, role=admin only)
    ↓
UPDATE pagos SET estado='confirmado', confirmed_by, confirmed_at
    ↓
(Optional trigger) UPDATE reserva estado if fully paid
```

### Confirmation & Reminder Flow (async, cron-driven)

```
Vercel Cron (once/day, e.g. 08:00 UTC) → GET /api/cron/recordatorios
    ↓ (validates Authorization: Bearer CRON_SECRET)
Route Handler queries: reservas with fecha_importante within N days AND recordatorio not yet sent
    ↓
For each match (try/catch per row — one failure must not abort the batch):
    → send email via Resend → UPDATE recordatorios SET sent_at=now()
    ↓
Separately: any admin action that changes reserva estado (e.g., "con problema") triggers an immediate email
    to the affected customer (called directly from the same Server Action that made the change —
    no need for a queue at this volume)
```

### Key Data Flows

1. **Admin-authored writes:** all creation/mutation of `reservas` and confirmation of `pagos` flows one direction — Admin Panel → Server Action → Postgres. Customers never mutate `reservas`; they only mutate `pagos` (insert) and `storage.objects` (insert their own proof).
2. **Customer-authored writes:** limited to two things — uploading a comprobante file and (implicitly) clicking through to Payoneer. Everything else is read-only for the customer.
3. **State changes drive notifications, not the reverse:** notifications are a side effect of a Postgres write (either synchronous, from the same Server Action, or asynchronous, from the daily cron scan) — never a separate manually-triggered "send message" step the operator has to remember. This is the entire point of automating what today happens by hand in WhatsApp.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~10-15 bookings/week, 1 admin) | Exactly the architecture above. Vercel Hobby + Supabase Free tier are sufficient. |
| 50-100 bookings/week | Still the same architecture. Move to Vercel Pro (needed anyway for more than 2 cron jobs or sub-daily schedules) and Supabase Pro (needed for backups + no project pausing after 1 week idle). No structural change. |
| Second admin/employee | Add a real `role` distinction (`admin` vs `staff`) and per-row `created_by`/`assigned_to` if accountability matters — RLS policies extend naturally since they already key off `profiles.role`. |
| 1000+ bookings/week, catalog/self-serve booking | This is a different product (public catalog, real-time availability, possibly a queue for provider confirmations). Re-evaluate stack fit at that point — not a concern for this milestone. |

### Scaling Priorities

1. **First real bottleneck: none technical, all operational.** At this volume, Postgres/Supabase/Vercel free/starter tiers have enormous headroom. The actual constraint is the single admin's time reviewing payment proofs — the architecture should optimize the admin's "pending review" queue UX before optimizing anything technical.
2. **Second bottleneck (if it ever comes): Supabase project auto-pause.** Free-tier Supabase projects pause after a week of no activity — irrelevant once there is any real usage, but worth knowing for the pre-launch/testing period (see Integration Points).

## Anti-Patterns

### Anti-Pattern 1: Authorization only in the UI/Server Action, not in RLS

**What people do:** Check `if (user.role !== 'admin') redirect()` in a layout or Server Action and leave the Postgres tables wide open (RLS disabled, or a permissive `using (true)` policy) because "the app already checks."
**Why it's wrong:** Any direct call to Supabase from a new page, a forgotten check, a future public API route, or a bug bypasses the UI check entirely and exposes every customer's reservations, prices, and payment proofs. With a single non-technical maintainer, there will be no code review catching this later.
**Do this instead:** Enable RLS on every table from the first migration and write policies as the actual authorization rules. Treat the Server Action check as a UX nicety (fast redirect, good error message), not the security boundary.

### Anti-Pattern 2: Public Storage bucket for comprobantes "because it's simpler"

**What people do:** Make the `comprobantes` bucket public to avoid dealing with signed URLs, since public URLs are copy-pasteable and easy to render as `<img src>`.
**Why it's wrong:** A public bucket means anyone with (or who can guess/enumerate) the file path can view a customer's Zelle/Binance payment screenshot — often containing names, phone numbers, and partial account info. This is exactly the kind of financial-document leak that erodes trust fastest.
**Do this instead:** Private bucket + RLS + server-generated signed URLs, as in Pattern 3. The extra code is a handful of lines; the downside of getting it wrong is a real privacy incident for a real customer.

### Anti-Pattern 3: Building a generic multi-tenant/roles system for a team of one

**What people do:** Anticipating future growth, build a full RBAC system (roles table, permissions table, teams, invitations UI) from day one.
**Why it's wrong:** The constraint is explicit — one admin, no team, non-technical maintainers. A generic RBAC layer adds tables, migrations, and edge cases (what happens when a role is removed mid-session?) that nobody needs yet and that make the codebase harder for an AI or future developer to reason about quickly.
**Do this instead:** A single `role` enum column (`admin` | `customer`) on `profiles`. If a second admin/staff role is ever needed, it is a one-column migration and a couple of policy edits — not a rewrite.

### Anti-Pattern 4: Treating WhatsApp as replaceable by email notifications in the MVP

**What people do:** Assume that once in-app email notifications exist, WhatsApp/Instagram communication stops entirely.
**Why it's wrong:** The customers (many in Venezuela, with unreliable connectivity and inbox habits skewed toward WhatsApp, not email) may not check email promptly. Silently relying on email alone for "aviso si algo cambia" or "recordatorio antes del viaje" risks looking like the automation failed, when really the channel just did not reach the customer.
**Do this instead:** Ship email as the automated MVP channel (it is what Resend/Supabase support without new infrastructure or Meta Business verification), but treat WhatsApp/Instagram as the operator's manual fallback/complement during the "prueba real" phase (step 7 of the build plan) rather than assuming it is fully replaced. A WhatsApp Business API integration (via Twilio or Meta Cloud API) is a reasonable Phase 2 item, not an MVP requirement — it requires business verification and adds real cost/complexity.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `@supabase/ssr` browser + server clients; middleware refreshes session on every request | Two distinct client factories are required by the SSR package — mixing them up (using the browser client inside a Server Component) is the most common integration bug reported in current guides. |
| Supabase Postgres (RLS) | Migrations in `supabase/migrations/`, applied via Supabase CLI | Free tier pauses inactive projects after ~1 week — schedule a keep-alive or simply expect to "unpause" once during development if there's a gap before real usage starts. |
| Supabase Storage | Private bucket, RLS on `storage.objects`, `createSignedUrl` for reads | Never store a raw public URL in the `pagos` table — store the object path and resolve a signed URL at render time. |
| Payoneer | Manual: admin generates a payment-request link outside any API (Payoneer dashboard or manually per Payoneer's payment-request flow) and pastes it into the reserva; no webhook, no API call from the app | Confirmation is 100% manual (per project constraints) — the app's only job is to store the link and let the admin flip a status flag after checking their own Payoneer account. |
| Resend (or Postmark) for email | Vercel Cron (`vercel.json`, once/day route on Hobby) → Route Handler → Resend API | Vercel Hobby plan hard-caps cron jobs at once per day per job (max 2 jobs); this is not a limitation for daily reminder digests but would block "hourly" reminder granularity without upgrading to Pro. Protect the cron route with `CRON_SECRET` — it is a public URL otherwise. |
| WhatsApp (manual, Phase 2 for API) | None in MVP — operator continues manual WhatsApp as a complement | If ever automated, use Meta's WhatsApp Cloud API or Twilio; both require business verification and per-message cost, appropriately deferred. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Admin Panel ↔ Postgres | Server Actions calling the server-side Supabase client | All writes to `reservas`/`pagos` status originate here; RLS is the real enforcement, the Action is the ergonomics layer. |
| Customer Panel ↔ Postgres | Server Components (reads) + one Server Action (comprobante insert) | Customer never gets a write path to `reservas` — enforced by RLS `for select` only on that table for the `customer` role. |
| Customer Panel ↔ Storage | Direct browser upload (Supabase client, short-lived signed upload URL or client-side insert under RLS-scoped path) | Keeps large file bytes off the Next.js server/Vercel function, avoiding payload-size limits on Server Actions. |
| Cron Route ↔ Postgres/Resend | Route Handler using the service-role client (server-only, needed to scan across all customers' reservas for reminders) | This is the one legitimate MVP use of the service role key outside admin scripts — isolate it to this single route file and never expose it to any client-reachable code path. |

## Suggested Build Order (with rationale)

This refines the 7-step plan already sketched in `idea.md`, adding the technical dependency reasoning:

1. **Schema + RLS first, before any UI.** `profiles`, `reservas`, `pagos`, `recordatorios` tables and their RLS policies must exist and be tested (even with dummy data via SQL) before writing a single page — RLS is the authorization model, not an afterthought bolted onto working pages.
2. **Auth (admin login + `profiles` trigger).** Nothing else can be scoped correctly (`auth.uid()`) without this. Seed the one admin profile manually here.
3. **Admin Panel: create + list reservas.** The admin is the only one who creates data initially (per the business flow — reservations start as a WhatsApp conversation the admin transcribes), so this must exist before there is any data for a customer to see.
4. **Customer invite + Customer Panel (read-only).** Now that reservas exist, wire the invite-on-cliente-creation flow and the customer's read-only view. This is the first point where the two panels' RLS boundaries get exercised end-to-end.
5. **Payment + proof upload + manual confirmation.** Depends on both panels existing (customer needs a reserva to pay for; admin needs a list to review). This is the highest-risk step from a trust/privacy standpoint (Pattern 3) — allocate real testing time to the Storage RLS policies here.
6. **Notifications/reminders (cron).** Depends on `reservas`/`pagos` state transitions already working correctly, since reminders are a side effect of that state, not an independent feature.
7. **Real-world test with live bookings.** Unchanged from the original plan — this is where email deliverability, RLS edge cases, and the manual-confirmation UX get validated against a real, impatient customer instead of test data.

This order matches dependency reality: you cannot show a reservation without login, cannot pay for a reservation that does not exist, and cannot remind about a reservation state that isn't yet tracked reliably.

## Sources

- [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Creating a Supabase client for SSR — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [How to Actually Use Supabase RLS With Next.js App Router](https://dev.to/funnywish/how-to-actually-use-supabase-rls-with-nextjs-app-router-without-losing-your-mind-5563)
- [Using Service Role with Supabase in Next.js Backend — Supabase GitHub Discussion #30739](https://github.com/orgs/supabase/discussions/30739)
- [Storage — Supabase Docs](https://supabase.com/docs/guides/storage)
- [Storage Buckets — Supabase Docs](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Your Supabase Storage bucket is public — signed URLs will not save you](https://dev.to/veristria/your-supabase-storage-bucket-is-public-signed-urls-will-not-save-you-519a)
- [Supabase Storage Deep Dive — Bucket Design, Signed URLs, RLS](https://dev.to/kanta13jp1/supabase-storage-deep-dive-bucket-design-signed-urls-image-transforms-and-rls-3b9k)
- [Building automated booking reminders with Vercel Cron Jobs and Resend](https://dev.to/slotkdev/building-automated-booking-reminders-with-vercel-cron-jobs-and-resend-4jdk)
- [Vercel Cron Jobs — Official Docs](https://vercel.com/docs/cron-jobs)
- [Managing Cron Jobs — Vercel Docs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel cron jobs limit: Hobby plan caps and how to beat them](https://crontap.com/blog/vercel-cron-hourly-limit-and-how-to-beat-it)

---
*Architecture research for: small booking/reservations app, single admin + many customers*
*Researched: 2026-09-27*
