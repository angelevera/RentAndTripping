# Project Research Summary

**Project:** RentAndTripping (small travel agency booking/reservations app)
**Domain:** Small-business booking/reservations web app — flights, hotels, tours, and event tickets sold informally over WhatsApp/Instagram, migrating to a purpose-built tool with an admin panel and a client portal, manual payment confirmation, multi-currency (USD/Bs) accounting, one non-technical solo operator
**Researched:** 2026-09-27
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a small, single-admin CRUD application with a customer-facing portal bolted on — not a marketplace, not a booking engine with real-time inventory, and not a payments product. The correct reference class is a "solo-advisor travel CRM" (TravelJoy, Travefy) crossed with the payment realities of the Venezuela/diaspora market, where none of the mainstream tools (Calendly, Cal.com, Fresha, Stripe-based CRMs) natively support cash/Zelle/Binance/Payoneer-link payment rails with manual confirmation. The core product bet — one unified `reservation` shape covering four heterogeneous types (flight, hotel, tour, ticket) with a shared client/payment/status model — is both the primary differentiator and the highest-leverage schema decision to get right before any type-specific UI is built.

The recommended approach confirms the originally proposed stack (Next.js App Router + Supabase + Vercel) with two corrections the original plan missed: Vercel's free Hobby tier legally forbids commercial use, so the project must budget for Vercel Pro (~$20/month) from day one; and reminders/notifications need Resend (email) wired through Supabase Cron, since Supabase alone doesn't send messages and Vercel's free cron is too coarse for date-based reminders. Architecturally, this is a deliberate monolith — one Next.js app, one Supabase project, Row Level Security as the *only* authorization layer, private Storage with signed URLs for payment screenshots, and admin-provisioned (invite-only) customer accounts rather than public signup. Build order should follow the dependency chain schema+RLS → auth → admin CRUD → customer portal → payments → reminders, exactly mirroring the 7-step plan already sketched informally by the owner.

The dominant risk is not technical scaling (10-15 bookings/week has enormous headroom on every free/starter tier) but trust and correctness in a solo-operator, no-safety-net environment: (1) treating a payment screenshot as proof without a verification step, (2) collapsing multi-currency USD/Bs payments into a single total that can't be reconstructed later, (3) conflating "client paid" with "provider confirmed" into one status, (4) RLS misconfigured or deferred, exposing or hiding customer data, and (5) building something so opaque that a non-technical operator working alone cannot self-diagnose when it breaks. All five are cheap to prevent at the schema/UX level in the earliest phases and expensive-to-impossible to retrofit once real bookings and real money have flowed through the wrong shape.

## Key Findings

### Recommended Stack

Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage, Cron) + Vercel Pro is the right, unchanged stack for this profile: one relational data model (clients → reservations → payments → reminders), two auth roles, file uploads, and a budget that must start near-zero and grow slowly. Supabase consolidates five separate concerns (DB, auth, file storage, cron, backend functions) into one managed service — critical because there is no ops team to run a self-hosted alternative. The two corrections to the original plan (Vercel must be Pro, not Hobby, for legal/commercial-use reasons; and Resend + Supabase Cron closes the notifications gap) should be treated as settled decisions, not open questions.

**Core technologies:**
- **Next.js 16 (App Router) + React 19.2 + TypeScript 5.7+**: frontend + server logic in one app — best-documented React meta-framework, important because a hired developer or an AI assistant will likely maintain this later.
- **Supabase (Postgres + Auth + Storage + Cron)**: relational data model fits reservations/payments far better than a NoSQL alternative (Firebase); one vendor instead of five.
- **Vercel Pro ($20/mo)**: zero-config deploys from git; Hobby plan's ToS prohibits this commercial use case.
- **`@supabase/ssr`** (not the deprecated `auth-helpers-nextjs`), **Tailwind v4 + shadcn/ui**, **react-hook-form + zod**, **Resend + react-email**, **date-fns**, **`@serwist/next`** (PWA, successor to unmaintained `next-pwa`) — see STACK.md for full rationale and version compatibility table.

### Expected Features

The MVP is fully scoped by direct project requirements (idea.md / PROJECT.md), cross-checked against solo-advisor travel CRMs and generic booking SaaS. Everything hangs off getting the shared reservation data model right for all four product types before building type-specific UI.

**Must have (table stakes):**
- Admin create/edit/list reservations (flight/hotel/tour/ticket) with status
- Client login + dashboard scoped to own reservations (RLS-enforced)
- Payment record per reservation (method: cash/Zelle/Binance/Payoneer-link; amount; currency; status) + proof-of-payment upload
- One-click manual payment confirmation (admin) and a distinct "confirmed with provider" status
- Client notification on change + reminders before important dates
- Per-client reservation history (free once the data model is right)

**Should have (competitive):**
- One unified model across 4 product types (the core architectural bet / actual product-market fit)
- First-class support for informal LatAm payment rails (cash/Zelle/Binance/Payoneer) as a designed feature, not a bolt-on
- Client dashboard that genuinely replaces "scrolling WhatsApp for my reservation," PWA-first for unreliable connectivity
- Consistent brand application (logo, purple `#482583`) across both panels — "free" differentiation since the design system is already decided

**Defer (v2+):**
- Automatic payment verification (Zelle has no API; Binance/Payoneer webhook gated by LLC/partner approval)
- Embedded card checkout (Stripe/Payoneer Checkout — needs an LLC that doesn't exist yet)
- Loyalty/rewards, multi-admin roles, public catalog/storefront, full analytics/reporting, direct provider integrations, in-app chat, structured incident/complaint tracking, WhatsApp/SMS automated notifications, CSV export, reservation templates

### Architecture Approach

A deliberate monolith: one Next.js app on Vercel, one Supabase project, no microservices, no queue infrastructure — the correct shape for ~10-15 bookings/week with one non-technical operator. Row Level Security is the *only* authorization layer (never rely on UI/Server-Action checks alone); customer accounts are admin-provisioned via invite, not self-signup, matching how the business actually operates (operator creates the reservation after a WhatsApp conversation); payment-proof screenshots live in a private Storage bucket accessed only via short-lived signed URLs, never public URLs.

**Major components:**
1. **Auth (Supabase Auth + `profiles` table)** — identity for admin and every customer; a single `role` enum column (`admin`|`customer`) checked in every RLS policy.
2. **Admin Panel (route group `(admin)`)** — Server Components/Actions for reservation CRUD, payment review queue, provider-confirmation and problem-status toggles, gated by role in RLS, not just the UI.
3. **Customer Panel (route group `(cliente)`)** — read-only reservation view scoped by `auth.uid()`, plus proof-of-payment upload and the Payoneer link click-through.
4. **Reservas/Pagos/Recordatorios (Postgres, RLS-protected)** — the system of record; every state transition lives here, never in chat.
5. **Storage (`comprobantes` private bucket)** — payment screenshots, RLS-scoped upload paths, signed URLs on read.
6. **Notification/Reminder engine (Vercel Cron → Route Handler → Resend)** — daily scan for upcoming dates plus synchronous notification on any status-changing Server Action.

Suggested build order (matches dependency reality): schema + RLS → auth/profiles → admin reservation CRUD → customer invite + read-only portal → payments + proof upload + manual confirmation → reminders/notifications cron → real-world test with live bookings.

### Critical Pitfalls

1. **Trusting the payment screenshot instead of verifying the money** — screenshots are trivially fakeable and there's no third-party API to check a Zelle/Binance P2P transfer. Prevention: confirm-button copy that explicitly names the verification step ("¿verificaste el monto en tu cuenta?"), log who/when confirmed, capture reference number for high-value payments, and never auto-cascade a payment confirmation into a provider confirmation.
2. **No single source of truth for availability → double-booking** capacity-limited tours/tickets. Prevention: track remaining quantity per date/event inside the app from day one; keep "pagado" and "confirmado con proveedor" as two independent status fields, never one combined status.
3. **Multi-currency (USD/Bs) totals that silently drift or can't be reconstructed** — Venezuela's exchange-rate spread moves fast and diverges widely; a collapsed single total becomes meaningless the moment the rate has moved. Prevention: store every payment as its own row (amount, currency, rate-at-that-moment), keep USD as the canonical reservation price, never build automatic live-rate fetching into the MVP.
4. **Payoneer payment links leave no reconciliation trail and carry real chargeback exposure** since there's no webhook/API and no LLC-backed merchant protection yet. Prevention: generate a unique reference code per reservation for the client to include in the Payoneer note, and treat these payments as "pending external verification," not auto-confirmed.
5. **Building an app only a developer could fix, for an operator who works completely alone** — RLS misconfiguration, silent failures, and blank error screens are catastrophic when there's no second technical person to notice. Prevention: enable RLS from the first migration (not a later hardening pass), plain-Spanish error copy on every failure path, idempotent critical actions (safe to double-click), and prefer Supabase's managed features over custom server logic.

Additional moderate pitfall worth carrying into planning: a "con problema" status with no free-text note field loses all context versus today's WhatsApp thread — cheap to add now, expensive to reconstruct later.

## Implications for Roadmap

Based on combined research, the roadmap should closely follow the dependency chain already implied by the architecture and pitfalls research — this is not a case where features can be reordered for convenience; each phase's output is a hard prerequisite for the next.

### Phase 1: Foundation — Schema, RLS, and Auth
**Rationale:** RLS is the actual authorization layer for this entire app (Architecture Pattern 1; Pitfall 5) and must exist before any UI is built on top of it. This is also the single highest-leverage, most-damaging-to-defer decision in the whole project.
**Delivers:** `profiles`, `reservas`, `pagos`, `recordatorios` tables with RLS policies (tested with two real accounts — one admin, one customer); admin login; the `profiles` trigger on `auth.users` insert; admin profile seeded.
**Addresses:** Nothing user-facing yet — this is pure infrastructure that every table-stakes feature depends on.
**Avoids:** Pitfall 5 (app only a developer can maintain) and the "RLS added later" anti-pattern (Architecture Anti-Pattern 1).

### Phase 2: Admin Reservation Management
**Rationale:** The admin is the only one who creates data initially (business flow starts as a WhatsApp conversation the admin transcribes) — there is no customer-facing data to show until reservations exist.
**Delivers:** Admin create/edit/list reservations across all 4 types (flight/hotel/tour/ticket) sharing one core schema; reservation list with status filtering; "confirmed with provider" as a status field distinct from payment status.
**Addresses:** Core table-stakes features (reservation CRUD, admin list+status) from FEATURES.md; the unified-model differentiator from FEATURES.md.
**Avoids:** Pitfall 2 (no single source of truth for availability) — capacity tracking for tours/tickets should be designed into this schema now, and Pitfall 6's "con problema" note field should be added here since it's nearly free at this point.

### Phase 3: Customer Portal (Invite + Read-Only Dashboard)
**Rationale:** Now that reservations exist, this is the first point where the two panels' RLS boundaries are exercised end-to-end (Architecture build-order step 4) — it validates that Phase 1's policies actually hold under real customer accounts.
**Delivers:** Admin-provisioned customer invite flow (Supabase Admin API, no public signup); customer login; client dashboard scoped to own reservations via RLS; per-client reservation history view.
**Addresses:** Client login + dashboard, per-client history — direct requirements from FEATURES.md.
**Uses:** `@supabase/ssr`, Supabase Auth invite API, route groups `(admin)`/`(cliente)` from ARCHITECTURE.md.

### Phase 4: Payments, Proof Upload, and Manual Confirmation
**Rationale:** Depends on both panels existing (customer needs a reservation to pay for; admin needs a list to review) and is the highest-risk phase from a trust/privacy standpoint — allocate real testing time here.
**Delivers:** Itemized payment records (method, amount, currency, rate); private Storage bucket + signed URLs for proof-of-payment; Payoneer link generation with a unique reconciliation reference; one-click manual confirmation with verification-forward copy; running paid/pending balance shown in USD.
**Implements:** Architecture Pattern 3 (private Storage + signed URLs).
**Avoids:** Pitfall 1 (trusting the screenshot), Pitfall 3 (currency drift), Pitfall 4 (Payoneer reconciliation blindness) — all three are schema-level decisions that are cheap now and effectively unrecoverable retroactively.

### Phase 5: Notifications and Reminders
**Rationale:** Reminders are a side effect of reservation/payment state transitions already working correctly (Architecture build-order step 6) — building this before state management is solid means reminding about states that aren't trustworthy yet.
**Delivers:** Supabase Cron (or Vercel Cron) → Route Handler → Resend email pipeline for date-based reminders; synchronous notification on any status-changing admin action.
**Uses:** Resend, react-email, date-fns, Supabase Cron/pg_net from STACK.md.

### Phase 6: Real-World Test with Live Bookings
**Rationale:** Unchanged from the owner's original 7-step plan — this is where email deliverability, RLS edge cases, and manual-confirmation UX get validated against a real, impatient customer instead of test data.
**Delivers:** A short live-usage period with real bookings, explicit attention to whether email reminders actually reach WhatsApp-native customers (Architecture Anti-Pattern 4), and a punch-list of fixes before considering v1 "done."

### Phase Ordering Rationale

- **Strict dependency chain, not a convenience ordering:** you cannot show a reservation without login, cannot pay for a reservation that doesn't exist, and cannot reliably remind about a state that isn't yet tracked correctly — every phase above is a hard prerequisite for the next, per both ARCHITECTURE.md's build order and FEATURES.md's dependency graph.
- **Schema-level decisions (RLS, itemized payments, dual pago/proveedor status, capacity counters) are front-loaded** into Phases 1, 2, and 4 specifically because PITFALLS.md flags all of them as "unrecoverable retroactively" — the roadmap should not treat these as polish to add later.
- **Notifications come after payments, not before or in parallel,** because they are explicitly a side effect of state that must already be trustworthy (Architecture Data Flow: "state changes drive notifications, not the reverse").

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Foundation — RLS design):** RLS policy patterns for a two-role (admin/customer) system are documented, but the exact policy set (including `storage.objects` policies for path-scoped uploads) benefits from a focused research pass to get the SQL right the first time, given how costly RLS mistakes are per PITFALLS.md.
- **Phase 4 (Payments):** The Payoneer reconciliation-reference pattern and the itemized multi-currency payment schema are project-specific inventions (no off-the-shelf pattern exists for this exact combination) — worth a dedicated research/design pass before implementation, not just architecture research already done.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Admin CRUD)** and **Phase 3 (Customer Portal)**: standard Next.js + Supabase CRUD and auth-invite patterns, well documented in ARCHITECTURE.md and STACK.md sources.
- **Phase 5 (Notifications)**: Supabase Cron + Resend is a documented, common pattern (see ARCHITECTURE.md sources) with working examples.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core framework/platform facts (Next.js 16, Supabase, Vercel commercial-use terms) cross-checked against official docs; Venezuela-specific WhatsApp Business verification details are LOW confidence and explicitly flagged as non-blocking (deferred to Phase 2 anyway) |
| Features | MEDIUM (project requirements themselves are HIGH) | Table-stakes/anti-feature scoping is directly sourced from idea.md/PROJECT.md (HIGH); competitive-landscape claims about TravelJoy/Travefy/Calendly are MEDIUM, cross-checked across multiple independent sources |
| Architecture | HIGH | All core patterns (RLS-as-authorization, admin-provisioned accounts, private storage + signed URLs) are official Supabase/Vercel patterns verified against current docs and multiple independent write-ups |
| Pitfalls | MEDIUM | Domain patterns (screenshot fraud, double-booking, currency risk) cross-checked across multiple independent sources; Venezuela-specific and Payoneer-link-specific details are LOW-to-MEDIUM since this is a narrow, under-documented combination |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **WhatsApp Business Platform verification for a Venezuelan sole proprietor:** not confirmed for Venezuela specifically; non-blocking since WhatsApp automation is explicitly deferred to Phase 2, but should be re-checked before any Phase 2 WhatsApp work begins.
- **Exact current patch versions** of fast-moving packages (`@supabase/ssr`, `zod`, `tailwindcss`, shadcn CLI) should be re-verified with `npm view <package> version` at the moment the project is actually scaffolded, since these release frequently.
- **Payoneer reconciliation mechanics** (exact payment-link/note-field behavior) are based on general Payoneer documentation, not a hands-on test of the specific link-generation flow this project will use — worth a quick manual dry run before Phase 4 implementation.
- **RLS policy SQL for `storage.objects` path-scoping** is described conceptually in ARCHITECTURE.md but not written out in full — flagged above as a Phase 1 research item.

## Sources

### Primary (HIGH confidence)
- [Vercel Terms of Service](https://vercel.com/legal/terms) and [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) — Hobby plan commercial-use restriction
- [Supabase auth-helpers deprecation notice (GitHub)](https://github.com/supabase/auth-helpers) and [`@supabase/ssr` npm page](https://www.npmjs.com/package/@supabase/ssr)
- [Setting up Server-Side Auth for Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Storage — Supabase Docs](https://supabase.com/docs/guides/storage) / [Storage Buckets — Supabase Docs](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- Project discovery notes: `idea.md` and `.planning/PROJECT.md` (direct source of feature scoping and business constraints)

### Secondary (MEDIUM confidence)
- [Next.js 16 blog post](https://nextjs.org/blog/next-16) and [Upgrading: Version 16 docs](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Supabase pricing](https://supabase.com/pricing), [Supabase Cron blog post](https://supabase.com/blog/supabase-cron), [Resend pricing](https://resend.com/pricing)
- [Best CRM Software for Travel Agencies (2026) — Travefy](https://travefy.com/blog-post/best-crm-software-for-travel-agents), [8 Best CRM for Travel Agencies — NetHunt](https://nethunt.com/blog/8-best-crm-for-travel-agencies/)
- [How to spot fake Zelle payments, receipts, and screenshots — Resistant AI](https://resistant.ai/blog/zelle-scams)
- [Venezuelan bolívar–dollar rate jumps to nearly 480% — Yahoo Finance](https://ca.finance.yahoo.com/news/venezuelan-bol-var-dollar-rate-135049714.html)
- [10 Common Mistakes Building with Next.js and Supabase — Iloveblogs](https://www.iloveblogs.blog/post/nextjs-supabase-common-mistakes)
- [How to Avoid Double Bookings — Hostfully](https://www.hostfully.com/blog/how-to-avoid-double-bookings/)
- [Credit Card Chargebacks — Payoneer](https://www.payoneer.com/resources/how-to-use-payoneer/credit-card-chargebacks-everything-merchants-need-to-know/)

### Tertiary (LOW confidence)
- [WhatsApp API prerequisites / business verification guides — wati.io](https://www.wati.io/en/blog/whatsapp-api-prerequisites/) — sole proprietorship acceptance, not Venezuela-specific, needs validation before Phase 2

---
*Research completed: 2026-09-27*
*Ready for roadmap: yes*
