# Feature Research

**Domain:** Small booking/reservations product (travel agency: flights, hotels, tours, concert tickets) for a solo operator, migrating off Instagram/WhatsApp
**Researched:** 2026-09-27
**Confidence:** MEDIUM (project requirements are HIGH — directly sourced from PROJECT.md/idea.md; competitive-landscape claims are MEDIUM, cross-checked across multiple independent sources per topic)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete, or the operator gains nothing over WhatsApp.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Admin: create/edit a reservation (type, client, service details, price, currency) | This is the entire job today done by hand in a chat thread — the app's reason to exist | MEDIUM | Needs to support 4 heterogeneous types (flight, hotel, tour, ticket) with a shared core (client, price, currency, dates) plus type-specific fields. Design the schema so type-specific fields don't force four separate forms/tables. |
| Admin: reservation list with status (pending / confirmed with provider / has an issue) | Solo-advisor CRM tools (TravelJoy, Travefy) all center on a client/booking list with status — replacing the mental list the operator keeps today | LOW | A single filterable list view. Status is a small enum, not a workflow engine. |
| Client login + personal dashboard showing only their own reservations | Direct requirement (idea.md #1); table stakes for any booking tool with a client portal (TravelJoy, Travefy both offer this) | MEDIUM | Supabase Auth covers this cheaply. Must enforce row-level security so client A can never see client B's data — this is a trust-critical feature, not cosmetic. |
| Payment method capture per reservation (cash, Zelle, Binance, card via Payoneer link) | Matches how the business already collects money; a booking tool that can't record "how" isn't replacing WhatsApp bookkeeping | LOW-MEDIUM | Model as a `payments` record per reservation: method, amount, currency, proof (file or link), status. Card via Payoneer needs a generated/pasted link, not embedded checkout (constraint, not choice). |
| Client uploads proof-of-payment screenshot | Direct requirement; this is how the operator already verifies Zelle/Binance payments manually today, just via WhatsApp images instead of a form | LOW | Supabase Storage + a simple upload field tied to a payment record. No OCR/parsing needed for v1. |
| Operator manually confirms payment (pending → paid) with one click | Direct requirement; industry research on Zelle/Binance screenshot proof confirms this is the *correct* pattern, not a stopgap — screenshots are inherently spoofable and require human review against the real account regardless of platform sophistication | LOW | One button, one state transition. Resist the urge to add automated verification for Zelle (impossible via any third-party API) or Payoneer (no business account/webhook access yet). |
| Client notified when something changes on their reservation | Direct requirement; matches "avisar si algo cambia" — the #1 manual task today | LOW-MEDIUM | Email (via Supabase) is enough for v1; WhatsApp/SMS notification is a differentiator, not table stakes, given no messaging API budget yet. |
| Reminders before important dates (flight date, check-in, event date) | Direct requirement; matches "recordarle fechas" — the #2 manual task today | LOW-MEDIUM | A scheduled job checking upcoming dates and firing a notification. Needs a `reminders` table decoupled from reservations so it can be marked "sent." |
| Mobile-first responsive UI | Explicit constraint: most clients use phones; WhatsApp/Instagram usage is mobile-native, so anything worse on mobile is a regression | MEDIUM | This is a design/CSS discipline requirement more than a "feature," but it's non-negotiable — test every screen on a phone viewport first. |
| Simple per-client reservation history | Direct requirement ("historial simple... por cliente"); every travel CRM researched (Travefy, TravelJoy) treats trip history as core, not extra | LOW | A filtered view of the same reservations table by client — no separate feature to build if the data model is right. |

### Differentiators (Competitive Advantage)

Features that set the product apart from "just another booking form." Not required for launch to function, but where this app earns its keep over the WhatsApp status quo.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One place that unifies 4 very different product types (flights, hotels, tours, tickets) under one client & payment model | Purpose-built travel CRMs (Travefy, TravelJoy) are built around itineraries/trips; generic booking tools (Calendly, Fresha) are built around a single recurring service type. Neither fits an agency selling four unrelated inventory types informally. A schema that treats all four as "a reservation with a type" — instead of bolting on separate modules — is the actual product-market fit here | MEDIUM-HIGH | This is the core architectural bet. Get the shared `reservation` shape right (client, type, price, currency, status, key dates) before the roadmap adds type-specific detail fields. |
| Support for informal, region-specific payment rails (cash, Zelle, Binance, Payoneer link) as first-class, not bolted-on | Mainstream booking SaaS (Calendly, Cal.com, Fresha) assume Stripe/PayPal-style card rails baked in; none natively support Zelle/Binance/cash-with-manual-proof. Venezuelan and diaspora customers structurally can't use standard card checkout (no local Stripe, capital controls, dollarization). This is the actual differentiator versus "just buy a booking SaaS" | MEDIUM | The payment model already reflects this (method + proof + manual status) — the differentiator is treating manual confirmation as a designed feature with good operator UX (a queue of "awaiting confirmation" payments), not an afterthought. |
| Client dashboard that replaces "scroll back through WhatsApp to find my reservation" | Diaspora clients booking for family in Venezuela lose track of details across chat threads; a persistent dashboard with status is a real upgrade over chat history search, and works even with unreliable connectivity typical to Venezuela if built PWA-first | LOW-MEDIUM | Already covered by table-stakes client login — the differentiator is polish: clear status language, dates up front, no jargon. |
| "Confirmed with provider" as an explicit, visible status step | None of the generic booking tools model a middleman relationship with an upstream airline/consolidator/wholesaler; this is specific to how the agency actually buys inventory (idea.md: "confirmar con el proveedor que la reserva quedó bien") | LOW | Already in the Active requirements as a state — worth keeping distinct from "paid," since a reservation can be paid but not yet provider-confirmed, or vice versa. |
| Brand-forward visual design (logo, purple `#482583`, Apple-inspired restraint) reused consistently across admin and client panels | Small competitors in this space (informal WhatsApp-based travel resellers) have zero brand presence; a polished, on-brand client portal is a trust signal for a business handling other people's travel money over informal payment rails | LOW (design system already decided in idea.md §8) | This is "free" differentiation since the visual identity work is already done — just apply it consistently instead of defaulting to generic component-library styling. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a v1 this small — explicitly out of scope per PROJECT.md, with the reasoning made concrete.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Automatic payment verification (Zelle/Binance API, Payoneer webhook) | Feels like the "real" fix for manual confirmation being slow/error-prone | Zelle has no third-party verification API — banks don't expose this to anyone outside the bank itself. Binance API verification is feasible but requires business API keys/setup work disproportionate to 10-15 bookings/week. Payoneer webhook confirmation requires an approved business/partner account, which requires an LLC that doesn't exist yet. Building toward this now is building on a foundation (LLC, partner approval) that isn't there | Keep manual confirmation as the permanent design for Zelle/cash (industry research confirms even mature platforms treat screenshots as needing human review); revisit Binance API only in Phase 2 once volume justifies the integration work |
| Embedded card checkout (Stripe or Payoneer Checkout API) | Feels more "professional" than redirecting to an external payment page | Both require a registered US business entity (LLC) and, for Payoneer, partner approval — neither exists today. Building UI/UX around an assumption of embedded checkout now means throwaway work later | Payoneer payment link (redirect out, pay, return) is the correct interim design — already decided in PROJECT.md |
| Loyalty/rewards points system | Owner mentioned wanting this eventually; feels like a growth lever | Adds a points ledger, redemption rules, and edge cases (partial refunds, expiry) before the core booking-and-payment loop is even validated with real customers — classic premature scope expansion | Explicitly deferred to Phase 2 per PROJECT.md; revisit only after MVP proves the core workflow reduces manual work |
| Multi-admin / team roles & permissions | Feels forward-looking ("what if he hires someone") | The operator works alone today; building role-based access control now is speculative complexity with no current user to validate it against | Single hardcoded admin role for v1; add roles only when/if a second employee is actually hired |
| Public catalog / storefront of available tours, hotels, flights | Feels like "every travel site has a browsable catalog" | Today everything is sold to-order via DM negotiation, not from fixed inventory — the business doesn't hold bookable inventory to browse. Building a catalog implies an inventory-management problem (availability, pricing sync) that doesn't exist in the current business model | Defer to Phase 2; v1 stays request-driven (client asks, operator creates the reservation), matching how the business actually operates |
| Full business analytics/reporting dashboard (revenue by currency/method, etc.) | Feels essential for "running a real business" | At 10-15 bookings/week, this is answerable by glancing at the reservation list; building charts/aggregation pipelines now is effort spent before there's enough data volume or a validated need for it | Defer to Phase 2; the reservation list itself is a sufficient "report" at this scale |
| Direct provider integrations (airline/consolidator APIs) | Feels like it would eliminate manual entry of flight/hotel details | These integrations are commercially gated (GDS access, consolidator partnerships) and irrelevant at this volume — the operator already manually confirms with providers today over WhatsApp/phone regardless of tooling | Keep manual data entry for reservation details in v1; this is a Phase-2-or-never problem tied to business growth, not app design |
| In-app chat / messaging system | Feels like the natural replacement for WhatsApp | Building a reliable real-time chat system (delivery, read receipts, notifications) is a substantial engineering surface for a problem WhatsApp already solves well; the actual gap WhatsApp has is record-keeping and reminders, not conversation itself (confirmed by web research: the realistic pattern is a *handoff*, not full replacement — DMs/WhatsApp stay for conversation, the app takes over for booking state) | Let WhatsApp remain the conversation channel; the app's job is to be the system of record and reminder engine WhatsApp can't be |
| Full customer complaint/incident-tracking workflow | Owner mentioned wanting "historial de reclamos" eventually | Building structured incident workflows (fault attribution, resolution states) before the basic reservation/payment loop is proven adds process overhead to a business that currently handles disputes case-by-case | Defer to Phase 2 per PROJECT.md; note incidents as free-text on a reservation if needed in v1, not a structured subsystem |

## Feature Dependencies

```
Admin login (single user)
    └──requires──> Reservation data model (client, type, dates, price, currency, status)
                       └──requires──> Reservation list view (admin)
                       └──requires──> Client login + client-scoped dashboard
                                          └──requires──> Row-level security (client sees only own data)
                       └──requires──> Payment record (method, amount, currency, status)
                                          └──requires──> Proof-of-payment upload (client-facing)
                                          └──requires──> Manual payment confirmation (admin-facing)
                                          └──requires──> Payoneer payment link generation (for card method)
                       └──requires──> "Confirmed with provider" status toggle (admin-facing)
                       └──requires──> Reminders/notifications table
                                          └──requires──> Scheduled job (date-based trigger)
                                          └──requires──> Email delivery (Supabase or transactional email provider)

Per-client reservation history ──derives from──> Reservation data model (no separate build)

Loyalty/rewards (Phase 2) ──requires──> Reservation + payment history (already built in v1) — safe to defer, no rework needed
Automated Binance verification (Phase 2) ──requires──> Payment record with method field (already built in v1) — safe to defer
Public catalog (Phase 2) ──conflicts with──> current request-driven model — needs a separate inventory concept, not a v1 extension
```

### Dependency Notes

- **Everything hangs off the reservation data model.** Getting the shared shape right for all four product types (flight/hotel/tour/ticket) before building any single-type-specific UI is the highest-leverage early decision — it's what lets the roadmap add type-specific fields later without a schema rewrite.
- **Client login requires row-level security, not just authentication.** A client being able to authenticate is not the same as a client being unable to see other clients' reservations — this must be enforced at the data layer (Supabase RLS), not just hidden in the UI, since a booking app leaking one family's travel details to another is a severe trust failure for this audience.
- **Payment confirmation requires the payment record to exist before the reservation is "usable."** A reservation without at least a pending payment record is an incomplete state — design the creation flow so a reservation and its initial payment record are created together, not as two disconnected steps the operator can forget.
- **Reminders depend on a scheduled job, which is a new technical capability** (not just CRUD) — Vercel cron or a Supabase scheduled function. Flag this for the phase that builds notifications as needing a bit more technical setup than the CRUD-heavy phases around it.
- **Loyalty, automated Binance verification, and reporting all safely defer** because they only *read* data the v1 model already captures (reservations + payments) — deferring them costs nothing architecturally as long as the core data model isn't warped to avoid them now.
- **Public catalog conflicts with, rather than extends, the v1 model** because it implies inventory the business doesn't currently manage — this is the one Phase-2 item that could require actual rework if v1 accidentally assumes fixed inventory. Keep v1 strictly request-driven (operator creates every reservation manually) to avoid painting into a corner.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate that the app actually reduces manual WhatsApp work, per the project's own success metric.

- [ ] Admin login (single hardcoded operator account) — no multi-user complexity to build or secure
- [ ] Create/edit/list reservations (type, client, service details, price, currency, status) — this *is* the product
- [ ] Client login + dashboard scoped to own reservations (with RLS) — direct requirement, and the client-facing half of the value proposition
- [ ] Payment record per reservation: method (cash/Zelle/Binance/Payoneer link), amount, currency, status — without this, the app doesn't replace the "cobrar" half of the daily workflow
- [ ] Client proof-of-payment upload (Zelle/Binance) — the input the operator currently receives as a WhatsApp image
- [ ] Payoneer payment link generation/attachment for card payments — required because no embedded checkout is possible yet
- [ ] One-click manual payment confirmation (admin) — closes the payment loop; must stay manual per constraints
- [ ] "Confirmed with provider" status marker — matches the actual middleman workflow, not a generic "confirmed" label
- [ ] Client notification on reservation change — replaces "avisarle al cliente si algo cambia"
- [ ] Reminder before important dates — replaces "recordarle fechas importantes"
- [ ] Per-client reservation history view — free once the data model is right, but must be explicitly surfaced in the UI

### Add After Validation (v1.x)

Features to add once the core loop is proven to reduce manual work — trigger conditions noted.

- [ ] WhatsApp/SMS notifications instead of/alongside email — add once email reminders prove the mechanism works but the operator/clients report low email engagement (likely, given WhatsApp-native user base)
- [ ] Bulk/faster reservation entry (templates for recurring trip types) — add once the operator has used manual entry long enough to identify repetitive patterns worth templating
- [ ] Basic export of reservation/payment data (CSV) — add if the operator asks "how do I get this into a spreadsheet for my accountant/records," rather than building a report engine speculatively

### Future Consideration (v2+)

Features to defer until the MVP has been used with real bookings for a few weeks (per PROJECT.md's own Fase 2 list).

- [ ] Loyalty/rewards points system — defer until repeat-client volume is high enough to make it meaningful, not just requested
- [ ] Automated Binance payment verification via API — defer until Binance-method volume alone justifies the integration cost
- [ ] Stripe/embedded checkout — defer until an LLC exists (external dependency, not a product decision)
- [ ] Business reports/summaries — defer until reservation volume outgrows "just look at the list"
- [ ] Public catalog/storefront — defer until/unless the business model shifts from request-driven to fixed-inventory
- [ ] Direct provider integrations — defer indefinitely; gated by third-party commercial access, not by this app's design
- [ ] In-app chat — defer indefinitely; WhatsApp already serves this role well
- [ ] Multi-admin roles — defer until a second staff member is actually hired
- [ ] Structured incident/complaint tracking — defer until case volume makes free-text notes insufficient

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Reservation CRUD (all 4 types) | HIGH | MEDIUM | P1 |
| Admin reservation list + status | HIGH | LOW | P1 |
| Client login + scoped dashboard | HIGH | MEDIUM | P1 |
| Payment record + method capture | HIGH | LOW-MEDIUM | P1 |
| Proof-of-payment upload | HIGH | LOW | P1 |
| Manual payment confirmation | HIGH | LOW | P1 |
| Payoneer link attachment | HIGH | LOW | P1 |
| "Confirmed with provider" status | MEDIUM-HIGH | LOW | P1 |
| Client change/reminder notifications | HIGH | LOW-MEDIUM | P1 |
| Per-client history view | MEDIUM | LOW | P1 |
| WhatsApp/SMS notifications | MEDIUM | MEDIUM | P2 |
| CSV export | LOW-MEDIUM | LOW | P2 |
| Reservation entry templates | MEDIUM | MEDIUM | P2 |
| Loyalty/rewards | MEDIUM | MEDIUM-HIGH | P3 |
| Automated Binance verification | LOW-MEDIUM | MEDIUM | P3 |
| Business reports/analytics | LOW | MEDIUM | P3 |
| Public catalog | LOW (unvalidated) | HIGH | P3 |
| Provider integrations | LOW (blocked externally) | HIGH | P3 |
| In-app chat | LOW (WhatsApp covers it) | HIGH | P3 |
| Multi-admin roles | LOW (no current need) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Solo-advisor travel CRMs (TravelJoy, Travefy) | Generic booking/scheduling SaaS (Calendly, Cal.com, Fresha) | Our Approach |
|---------|-----------------------------------------------|--------------------------------------------------------------|--------------|
| Client-facing portal | Yes — itinerary + payment viewing | Partial — mostly a booking confirmation page, not an ongoing dashboard | Full client dashboard with reservation history and status, matching direct requirement |
| Payment collection | Stripe/PayPal-style, assumes US banking rails | Stripe/PayPal on paid tiers | Cash/Zelle/Binance/Payoneer-link with manual confirmation — the actual differentiator, since none of these tools support informal LatAm rails natively |
| Booking self-service (client books without operator) | Partial — mostly proposal-and-accept, not open self-service | Yes — core feature (shareable booking link) | Not in v1 — business model is request-driven via WhatsApp/Instagram first, reservation created by operator after conversation; open self-service booking is a Phase-2-or-never fit unless the business model shifts |
| Itinerary/proposal builder | Yes — polished, branded (Travefy's core strength) | No — not applicable to their domain | Not in v1; the four product types plus current volume (10-15/week) don't yet justify a dedicated builder — a well-structured reservation detail view suffices |
| Reminders/notifications | Basic, mostly transactional (trip reminders) | Yes, especially on paid tiers | Core v1 feature — matches the #2 manual task the business already does by hand |
| Multi-provider/commission tracking | Yes — Travefy tracks commissions across suppliers | No — not applicable | Not in v1; the business already tracks profit margin informally per booking, and formal commission tracking is a Phase-2 reporting concern |
| Pricing model | Low monthly SaaS fee per seat ($19-49/mo) | Per-seat SaaS or marketplace commission (Fresha: 20% on new marketplace clients) | Not applicable — this is an internal tool built for one business, not a product sold to other agencies |

## Sources

- [Best CRM Software for Travel Agencies (2026) — Travefy](https://travefy.com/blog-post/best-crm-software-for-travel-agents) — MEDIUM confidence
- [8 Best CRM for Travel Agencies: Tools for Agents — NetHunt](https://nethunt.com/blog/8-best-crm-for-travel-agencies/) — MEDIUM confidence
- [Best Travel Agency Software 2026 — mTrip](https://www.mtrip.com/best-travel-agency-software/) — MEDIUM confidence
- [How to spot fake Zelle payments, receipts, and screenshots — Resistant AI](https://resistant.ai/blog/zelle-scams) — MEDIUM confidence
- [Zelle Payment Screenshot Fraud: How to Spot It — DocVerify](https://docverify.app/blog/zelle-payment-screenshot-fraud-detection) — MEDIUM confidence
- [Fake Zelle Screenshot? How to Verify a Transfer (2026) — A Square Solution](https://asquaresolution.com/blog/fake-zelle-payment-screenshot/) — MEDIUM confidence
- [Best Online Booking Software for Small Business in 2026 — Cal.com](https://cal.com/blog/online-booking-software-for-small-business) — MEDIUM confidence
- [The 13 best appointment booking and scheduling apps — Calendly](https://calendly.com/blog/best-appointment-scheduling-apps) — MEDIUM confidence
- [7 Best Free Booking Software Options for Small Businesses (2026) — SimplyBook.me](https://simplybook.me/en/blog/best-free-booking-software) — MEDIUM confidence
- [WhatsApp Business Mistakes to Avoid & How to Fix Them — Gallabox](https://gallabox.com/blog/whatsapp-business-mistakes) — MEDIUM confidence
- [Why (just) WhatsApp is insufficient to grow your business — Zoho](https://www.zoho.com/teaminbox/articles/why-whatsapp-isnt-enough-for-businesses.html) — MEDIUM confidence
- Project discovery notes: `idea.md` and `.planning/PROJECT.md` (first-party, HIGH confidence — direct source of all "table stakes" and "anti-feature" scoping decisions)

---
*Feature research for: small travel agency booking/reservations app (solo operator, informal payment rails, Venezuela/diaspora customers)*
*Researched: 2026-09-27*
