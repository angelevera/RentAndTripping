# Pitfalls Research

**Domain:** Small travel agency booking/reservations app — manual payment confirmation, multi-currency (USD/Bs), file-upload proof of payment, single non-technical operator (Venezuela market)
**Researched:** 2026-09-27
**Confidence:** MEDIUM (domain patterns cross-checked across multiple independent sources; Venezuela-specific and Payoneer-link-specific details are LOW-to-MEDIUM — this is a narrow, under-documented combination)

## Critical Pitfalls

### Pitfall 1: Trusting the proof-of-payment screenshot instead of verifying the money

**What goes wrong:**
The operator marks a reservation "pagado" because the client uploaded a screenshot that looks like a Zelle or Binance transfer confirmation. The screenshot is edited, reused from a different transaction, or shows a payment that was later reversed/cancelled by the sender. The operator confirms the flight/hotel with the provider based on the app showing "pagado," then discovers days later the money never arrived.

**Why it happens:**
Screenshots are trivially editable (any photo editing app or even a text message mockup generator can fake a Zelle confirmation screen), and Zelle/Binance give the *recipient's own account* as the only reliable source of truth — there is no third-party API the operator can check from inside this app to confirm a P2P transfer actually cleared. The workflow as designed in `idea.md` treats "cliente sube comprobante → operador confirma con un clic" as the whole verification step, with nothing forcing the operator to cross-check the bank/exchange app itself.

**How to avoid:**
- Design the "confirmar pago" UI/copy so it never implies the screenshot itself is proof — e.g., checklist language like "¿Verificaste este monto en tu cuenta de Zelle/Binance?" next to the confirm button, not just "Confirmar."
- Log who confirmed and when, and store the exact amount + currency the client claims to have paid alongside the screenshot, so mismatches (wrong amount, wrong sender name) are visible at a glance instead of buried in an image.
- For higher-value reservations (international flights, multi-night hotels), consider requiring the transaction reference number/last-4 of sender info as a text field in addition to the image — searchable/matchable, unlike a screenshot.
- Never auto-confirm-with-provider until payment status is "pagado" — keep "confirmar con proveedor" as a distinct, separate action from "confirmar pago," so a bad payment confirmation doesn't cascade into a non-refundable provider purchase.

**Warning signs:**
- Clients pushing for fast confirmation ("ya pagué, confirма ya" before the operator has had time to check) — a common social-engineering pattern in P2P payment scams.
- Same client name/reference reused across multiple screenshots.
- Payment amount in the screenshot doesn't match the reservation total exactly (rounding tricks, wrong currency).

**Phase to address:**
Phase covering payment recording + confirmation UI (per `idea.md` step 5, "Cobro y comprobante"). This is a UX/copy and data-model concern, not a technical integration — cheap to get right early, expensive to retrofit once the operator has a habit of one-click-confirming.

---

### Pitfall 2: No single source of truth for availability → double-booked flights, hotels, or tour slots

**What goes wrong:**
The operator (or, later, a helper) sells the same hotel room, tour slot, or set of concert tickets twice because two reservations were created before either was checked against the same provider inventory, or because a reservation that should have blocked a slot was never marked correctly.

**Why it happens:**
This project's providers are external (airlines, consolidators, other agencies, event box offices) with no live inventory feed into the app — the operator is manually re-selling limited inventory he doesn't control in real time. Multiple independent sources on this exact failure mode agree: double-booking happens specifically when there is no single, immediately-updated source of availability that every reservation checks against. A single-operator app without any concept of "this tour date has N seats and N are sold" is structurally exposed to this, especially for tours/concerts with hard caps (concert tickets are literally finite and non-negotiable once sold out).

**How to avoid:**
- For inventory-capped services (tours with a max group size, event tickets with a fixed allotment), track available quantity per date/event *inside the app*, not from memory. Every new reservation against that date/event decrements it immediately; the app should visibly warn or block the operator before he can confirm a reservation that would oversell it.
- For flights/hotels bought per-request from third parties (where the operator doesn't hold inventory, he buys upon confirmed sale), the risk is different: it's about *provider confirmation lag*, not overselling app-side inventory — track "pendiente de confirmar con proveedor" as a distinct status so the operator never tells a client "confirmado" before the airline/hotel actually confirmed.
- Do not conflate "cliente pagó" with "proveedor confirmó" in the data model — `idea.md` already separates these (pendiente / confirmada con proveedor / con problema), which is correct; the roadmap must preserve that as two independent status fields, not one combined status.

**Warning signs:**
- Operator manually tracking tour/event capacity in his head or in WhatsApp instead of a counter the app shows him.
- Any UI that lets the operator create a reservation for a capacity-limited item without seeing remaining capacity at that moment.

**Phase to address:**
Phase covering reservation creation (`idea.md` step 3, "Panel del hermano — crear reserva"). The reservation-status model (pending / confirmed-with-provider / problem) must be locked in during data-model design, before any UI is built on top of it.

---

### Pitfall 3: Multi-currency (USD/Bs) totals that silently drift or don't add up

**What goes wrong:**
A reservation is priced in USD, but the client pays part in Bs cash and part in USD Zelle, at whatever exchange rate was "the rate" on a given day. Weeks later, nobody — operator or client — can reconstruct how the final total was calculated, whether the right rate was used, or whether the reservation is actually fully paid. Disputes ("yo pagué completo") become impossible to resolve with confidence.

**Why it happens:**
Venezuela's USD/Bs spread is large and moves fast (official and parallel/black-market rates diverge by roughly 85%+, and the bolivar has devalued by triple-digit percentages within a single year in recent periods). "Multi-currency" here isn't a cosmetic display feature (show a toggle) — it's a real accounting problem: the exchange rate at the moment of quoting a reservation is not the same rate at the moment of paying, which may not be the same rate at the moment of confirming. If the app stores only a final "total" without the rate and currency used per payment, the number becomes meaningless the moment the rate has moved.

**How to avoid:**
- Store every payment as its own row with: amount, currency (USD or Bs), and the exchange rate used at that moment (even if manually typed in by the operator) — never collapse multi-currency payments into a single pre-converted total without keeping the breakdown.
- Always keep the reservation's canonical price in USD (the stable currency in this market, per the research and per the project's own convention), and treat Bs amounts as a derived/logged conversion at time of payment, not the source of truth.
- Show the operator, and the client, a running "pagado vs. pendiente" balance in the *same currency as the reservation price* (USD), converting each Bs payment at the rate the operator enters for that payment — don't make the operator do currency math by hand to figure out if someone still owes money.
- Do not build automatic live exchange-rate fetching into the MVP — the operator already sets rates manually in his current process; forcing a "real" API rate could create disputes when it differs from the informal rate he actually used with the client. Let him type the rate per payment.

**Warning signs:**
- Any screen that shows only one final number with no way to see which payments/rates made it up.
- Operator having to use a calculator or WhatsApp math outside the app to figure out what a client still owes.

**Phase to address:**
Phase covering the payments data model (`idea.md` step 5). This decision — payments as itemized rows with currency+rate, not a single collapsed total — must be made in the schema before any payment-recording UI is built; retrofitting it later means migrating historical payment data with no way to recover the original rates.

---

### Pitfall 4: Payoneer payment links leave the operator with no reconciliation trail and real chargeback exposure

**What goes wrong:**
A client clicks a Payoneer payment link, pays by card, and returns to the app — but the app has no way to know, on its own, whether that payment actually succeeded, partially succeeded, or was never completed. The operator has to manually check his Payoneer account and match it to the right reservation by amount/date/name, which gets error-prone as volume grows. Separately, because this is a bare payment link and not an approved embedded/partner checkout, the business carries the full chargeback/dispute risk with none of Payoneer's merchant protections designed for that flow, and a card-holder who disputes a charge has no automated documentation trail tying the charge to a specific reservation.

**Why it happens:**
This is a direct, known constraint of the current setup: no US LLC yet, so no partner-approved embedded checkout — only a generic payment link, confirmed manually (see `PROJECT.md` constraints and `idea.md` §7.2/§7.4). Payment links generated per-reservation with no webhook or API callback mean the app is blind to the actual payment outcome by design.

**How to avoid:**
- Generate a unique, human-readable reference (e.g., reservation ID or short code) that the operator can ask the client to include in the Payoneer payment note/description, so matching a Payoneer dashboard entry to a reservation doesn't rely on memory or guesswork.
- Treat Payoneer-link payments as "pendiente de verificación externa" by default, with the same manual-confirm-with-clear-copy pattern as Pitfall 1 — the operator should have to actively check his Payoneer account, not just trust that "the client came back to the app" means payment succeeded.
- Keep a record of the exact link generated per reservation (with amount and currency) so if a dispute happens later, there's at least an internal record of what was requested, even without transaction-level proof from Payoneer.
- Do not treat this as solved — flag it explicitly as a "Fase 2 evaluar LLC + checkout embebido" item (already captured in `PROJECT.md` Out of Scope), since it's the payment method most exposed to silent failure and chargeback risk with the current setup.

**Warning signs:**
- Reservations stuck in "pendiente" because the operator forgot to check Payoneer.
- No written reference/note connecting a Payoneer transaction to a specific reservation once volume grows past what he can remember.

**Phase to address:**
Phase covering payment recording (`idea.md` step 5). The reference-code mechanism needs to exist from the first version of the Payoneer flow, since retrofitting it means old links/payments will never have a reliable match.

---

### Pitfall 5: Building an app only the developer can maintain, for an operator who works completely alone

**What goes wrong:**
Something breaks (a login issue, a broken upload, a confusing error) and the operator — who does not program — cannot self-diagnose or fix it, and has no one else in the business to ask. In the meantime he reverts to WhatsApp for that reservation, defeating the purpose of the tool, and trust in the app erodes. Because this is explicitly a single-admin, single-maintainer system (`PROJECT.md`: "el operador trabaja solo"), there is no safety net of a second technical person noticing and fixing things quietly.

**Why it happens:**
Next.js + Supabase is a good stack for fast, cheap builds, but the failure modes documented for exactly this combination are *silent* ones: Row Level Security misconfigured (data exposed, or — just as commonly — data invisible to the very user who should see it, so the operator thinks a reservation "disappeared"); auth sessions expiring oddly across tabs/devices making the operator or client "randomly" get logged out; slow Supabase calls with no timeout hanging a screen with no error message at all. A non-technical solo operator has no way to distinguish "the app is down" from "I did something wrong" from "there's no internet," and no one to escalate to.

**How to avoid:**
- Enable Row Level Security from the very first schema migration, not as a later hardening pass — this is the single highest-leverage, easiest-to-defer, most damaging-to-defer decision in the whole stack.
- Every user-facing error state (upload failed, payment link didn't generate, session expired) needs a plain-Spanish message telling the operator exactly what to do next ("intenta de nuevo," "vuelve a iniciar sesión") — never a blank screen or a raw technical error, because there is no one else to interpret it for him.
- Keep the admin panel's critical actions (confirm payment, mark confirmed-with-provider) idempotent and forgiving of double-clicks or page refreshes — a solo, non-technical operator under time pressure with 10-15 reservations/week will double-click things.
- Favor Supabase's built-in, managed features (Auth, Storage, RLS policies) over custom server logic wherever possible, specifically because managed features fail more predictably and are better documented than custom code a future non-original developer would have to reverse-engineer.
- Build a lightweight way for the operator to see "is everything working right now?" without needing a developer — e.g., a simple status view of pending confirmations, not a health-check page, but the app being honest and visible about its own state.

**Warning signs:**
- Any screen where an error can happen but nothing is shown to the user (silent failure).
- Any action (confirm payment, create reservation) that isn't safe to click twice.
- RLS policies added "later, once it works" instead of from the first migration.

**Phase to address:**
Foundational/base phase (`idea.md` step 1, "crear las cuentas... y dejar armadas las tablas") — RLS and error-handling conventions need to be architectural decisions baked into the very first schema and the first shared UI patterns (e.g., a standard error-toast component), not phase-specific patches added later.

---

### Pitfall 6: No shared record of "quién tuvo la culpa" when something goes wrong

**What goes wrong:**
A flight gets cancelled, a hotel doesn't confirm, a client gives the wrong passport spelling, or a client claims they paid and the operator disagrees — and today this is resolved entirely from memory, on a case-by-case WhatsApp basis (confirmed explicitly in `idea.md` §4, Q7: "depende de quién tuvo la culpa... así se resuelve el reclamo"). If the MVP app doesn't capture *any* trace of what happened and when, it inherits this same "he-said-she-said" weakness — except now the client may expect the app itself to be the record, and disputes about "the app doesn't show what happened" become a new source of friction.

**Why it happens:**
`PROJECT.md` explicitly scopes "historial de reclamos o incidencias" as Out of Scope / Fase 2, which is a reasonable MVP cut — but if the reservation's "con problema" status has no accompanying note field, the app captures *that* something went wrong without capturing *what* or *why*, which is strictly worse than today's WhatsApp thread (which at least has the full conversation).

**How to avoid:**
- Even without a full incident-tracking system, give the "con problema" status a free-text note field the operator fills in when he sets it — cheap to build, prevents total information loss versus today's WhatsApp-based memory.
- Timestamp every status change (pending → confirmed-with-provider → problem → resolved) automatically, so there's at least a chronological trail even without a rich incident model.
- Keep WhatsApp as the actual dispute-resolution channel for the MVP (don't try to replace it) but make sure the app's status history doesn't contradict or omit what happened there.

**Warning signs:**
- A reservation stuck in "con problema" for weeks with no note explaining why.
- Client disputes that reference something the app has no record of at all.

**Phase to address:**
Phase covering reservation status management (`idea.md` step 3). A single optional note field on status changes is nearly free to add now and expensive to reconstruct retroactively once reservations have already gone through the pipeline without it.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Storing a single final "total pagado" per reservation instead of itemized payment rows (amount, currency, rate) | Faster to build the first payment screen | Impossible to resolve currency disputes or reconstruct what happened; unrecoverable retroactively | Never |
| Skipping RLS policies "until it's needed" | Faster initial CRUD screens | Full data exposure via anon key, or operator-invisible data bugs; expensive emergency fix under live use | Never |
| One combined reservation status field instead of separate "pago" and "confirmación con proveedor" statuses | Simpler status enum, fewer states to design | Conflates "client paid" with "trip is actually secured," risking the operator telling a client "confirmado" before the provider confirmed | Never |
| Letting the operator confirm payment with a single click and no verification prompt/copy | Faster confirm flow, feels efficient | Normalizes rubber-stamping screenshots, the exact failure mode of Pitfall 1 | Only if paired with mandatory reference-number field as a partial safeguard — otherwise never |
| No note field on "con problema" status | One less form field to build | Loses all context on disputes, worse than today's WhatsApp thread | Only truly acceptable if WhatsApp thread is always kept as the backup record — better to just add the field |
| Building automatic live-exchange-rate fetching for Bs conversion | Looks more "accurate" | Creates disputes when the API rate differs from the informal rate the operator actually charged; adds an external dependency the operator can't control | Never for MVP; revisit only if the business ever needs official accounting reconciliation |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Payoneer payment link | Treating "client returned to the app" as proof of payment | Require operator to manually verify in his own Payoneer dashboard, matched by a unique reference code included in the payment note |
| Supabase Storage (comprobantes) | Uploading proof-of-payment images to a public bucket, or generating permanent public URLs | Use a private bucket with signed, time-limited URLs so payment screenshots (which may contain bank account details) aren't accidentally web-indexable or shareable outside the app |
| Supabase Auth (client + operator login) | Sharing one auth flow/role model for both without clear role checks, risking a client seeing another client's reservations if RLS policies aren't scoped per-user | Scope every table's RLS policy explicitly by `auth.uid()` matched to the owning client, and give the operator a distinct admin role with its own broader policy — test both roles' access before shipping, not after |
| Zelle / Binance (no API) | Assuming any future "verification" integration is just a matter of connecting an API | Zelle has no third-party verification API at all (confirmed pattern across sources) — budget zero engineering time for "automating Zelle confirmation" in any future phase; only Binance has an API worth evaluating later, and even that is explicitly deferred in `PROJECT.md` |

## Performance Traps

At 10-15 reservations/week (the stated current volume), none of the classic scaling traps (query performance, storage costs, concurrent booking races) are real risks yet. The one item worth flagging for future growth:

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| No inventory counters for capacity-limited items (tours, event tickets) | Works fine when the operator personally remembers every sold-out date; starts silently overselling as volume grows | Track remaining capacity per tour date/event in the schema from the start (see Pitfall 2), even if the number is small | Becomes a real risk past roughly 20-30 reservations/week or whenever a single tour/event sells out fast |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing proof-of-payment screenshots (which often show bank account numbers, full names, phone numbers) in a public or predictably-named storage path | Sensitive financial/personal data of clients exposed to anyone with the URL | Private Supabase Storage bucket, signed URLs with short expiry, no sequential/guessable file naming |
| No RLS or overly broad RLS policies | Any client could read/edit another client's reservations or payments via the anon key | RLS enabled from the first migration, policies scoped per `auth.uid()`, tested with two real client accounts before shipping |
| Treating the operator's admin session the same as a client session (same role/permission model) | A bug in role-checking logic could let a client access the admin panel, or vice versa | Explicit, separate role check for admin routes/actions, verified with automated or manual tests before each release touching auth |
| No audit trail on who confirmed a payment / changed a status | If a wrong confirmation happens, no way to know if it was operator error or a bug/tampering | Timestamp + log every status/payment confirmation change automatically (cheap, mentioned above in Pitfall 6) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Confirm-payment button reads just "Confirmar" | Encourages rubber-stamping screenshots without checking the bank/exchange app first | Copy that explicitly names the verification step ("Confirmar — ya verifiqué el monto en mi cuenta") |
| Showing only a single final price/total without currency+rate breakdown | Client and operator can't agree on what's owed when partial payments happened in different currencies | Itemized payment history visible to both operator and client, each row showing currency and rate used |
| Blank/generic error screens on upload or payment-link failures | Non-technical operator and clients (often on shaky Venezuelan mobile connections) don't know whether to retry, wait, or contact support | Plain-language, action-oriented error messages in Spanish for every failure state |
| No visible reservation status distinction between "pagado" and "confirmado con el proveedor" | Client believes trip is 100% secured once they've paid, then is blindsided if the provider doesn't confirm | Two clearly separate, visible statuses on the client's own reservation view, not just internal to the admin panel |

## "Looks Done But Isn't" Checklist

- [ ] **Confirmación de pago manual:** Often missing a verification prompt or reference-matching field — verify the confirm action requires more than a single blind click, especially for Payoneer link payments.
- [ ] **RLS policies:** Often missing or too permissive — verify with two real test accounts (one client, one operator) that neither can see or edit the other's data.
- [ ] **Manejo de moneda (USD/Bs):** Often collapsed into a single total — verify every payment row independently stores currency and the rate used.
- [ ] **Estado de reserva:** Often conflates "pagado" with "confirmado con proveedor" into one field — verify these are two independently-settable statuses in the schema and both are visible to the client.
- [ ] **Subida de comprobantes:** Often stored in a public bucket with a guessable URL — verify the bucket is private and URLs are signed/expiring.
- [ ] **Mensajes de error:** Often generic or blank — verify every failure path (upload, payment link generation, login) shows the operator/client a plain-Spanish next step.
- [ ] **Notas en "con problema":** Often just a status flag with no explanation — verify there's a free-text field capturing what went wrong.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Fake/wrong proof-of-payment confirmed as paid | MEDIUM | Add a manual "revertir a pendiente" action for the operator; cross-check against Payoneer/bank records case by case; no automated recovery is possible after the fact — this is why prevention (Pitfall 1) matters more than recovery here |
| Double-booked tour/event slot | MEDIUM–HIGH | Contact the affected client immediately, offer alternative date/refund; retroactively add capacity counters to prevent recurrence; this is reputationally costly with a diaspora client base that talks to each other |
| Collapsed/ambiguous currency totals discovered after the fact | HIGH | Requires manually reconstructing payment history from WhatsApp/bank records per affected reservation — effectively undoable at scale, which is why this must be prevented at the schema level from day one |
| RLS misconfigured, data exposed or hidden | LOW–MEDIUM if caught early via testing; HIGH if discovered after a real data leak | Fix policies, audit Supabase logs for unexpected access, notify affected clients if real exposure occurred |
| "Con problema" reservation with no note, dispute arises later | LOW | Reconstruct from WhatsApp history (still the actual record of truth today) — annoying but not catastrophic since WhatsApp isn't being deprecated in the MVP |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Trusting the screenshot instead of verifying money (Pitfall 1) | Payment recording + confirmation UI phase | Confirm button copy names the verification step; reference-number field exists for high-value/Payoneer payments |
| No single source of truth for availability (Pitfall 2) | Reservation creation phase | Capacity-limited items (tours/tickets) show remaining slots before the operator can confirm a new sale |
| Currency totals that drift or don't reconcile (Pitfall 3) | Payments data-model phase | Every payment row stores amount, currency, and rate independently; running balance always shown in USD |
| Payoneer link reconciliation blindness (Pitfall 4) | Payment recording phase (Payoneer sub-flow) | Every generated link has a unique reference code the operator can match against his own Payoneer dashboard |
| App only the developer can maintain (Pitfall 5) | Foundational/base phase (schema + auth setup) | RLS enabled and tested with two accounts before any other phase builds on top of the schema; every screen has a defined error state, none blank |
| No trace of "quién tuvo la culpa" (Pitfall 6) | Reservation status management phase | "Con problema" status change requires a note field; all status changes are timestamped |

## Sources

- [How to spot fake Zelle payments, receipts, and screenshots — resistant.ai](https://resistant.ai/blog/zelle-scams)
- [Zelle Business Account Scams and How to Spot Them Fast — ScamAdviser](https://www.scamadviser.com/articles/zelle-business-account-scam-warning-signs-every-seller-should-know)
- [Fake Zelle Screenshot? How to Verify a Transfer (2026) — asquaresolution](https://asquaresolution.com/blog/fake-zelle-payment-screenshot/)
- [14 common Zelle scams to recognize and avoid — NordProtect](https://nordprotect.com/blog/zelle-scams/)
- [How to Avoid Double Bookings — Hostfully](https://www.hostfully.com/blog/how-to-avoid-double-bookings/)
- [Why Double Bookings Happen & How to Prevent Them — ZealConnect](https://zealconnect.com/double-bookings-prevention-travel-agencies)
- [How to Avoid Overbooking Tours — TicketingHub](https://www.ticketinghub.com/blog/avoid-overbooking-tours)
- [Solving Double Booking at Scale: System Design Patterns — itnext.io](https://itnext.io/solving-double-booking-at-scale-system-design-patterns-from-top-tech-companies-4c5a3311d8ea)
- [Venezuelan bolívar–dollar rate jumps to nearly 480% as sanctions bite deepens — Yahoo Finance](https://ca.finance.yahoo.com/news/venezuelan-bol-var-dollar-rate-135049714.html)
- [Why Venezuela's Exchange Rate Gap Is Growing — Caracas Chronicles](https://www.caracaschronicles.com/2025/04/09/why-venezuelas-exchange-rate-gap-is-growing-and-what-to-expect/)
- [How to prevent online payment fraud as an SMB — Payoneer](https://www.payoneer.com/resources/general-payments/how-to-prevent-online-payment-fraud-as-an-smb/)
- [Credit Card Chargebacks: Everything Merchants Need to Know — Payoneer](https://www.payoneer.com/resources/how-to-use-payoneer/credit-card-chargebacks-everything-merchants-need-to-know/)
- [10 Common Mistakes Building with Next.js and Supabase — Iloveblogs](https://www.iloveblogs.blog/post/nextjs-supabase-common-mistakes)
- [Next.js + Supabase app in production: what would I do differently — catjam.fi](https://catjam.fi/articles/next-supabase-what-do-differently)
- [6 Common Supabase Auth Mistakes (and Fixes) — Startupik](https://startupik.com/6-common-supabase-auth-mistakes-and-fixes/)
- Project discovery notes: `/Users/angel/Claude/Proyectos/RentAndTripping/idea.md` (current manual process, what happens today when something goes wrong)
- Project scope/constraints: `/Users/angel/Claude/Proyectos/RentAndTripping/.planning/PROJECT.md`

---
*Pitfalls research for: small travel booking/reservations app with manual payment confirmation, multi-currency, and a single non-technical operator*
*Researched: 2026-09-27*
