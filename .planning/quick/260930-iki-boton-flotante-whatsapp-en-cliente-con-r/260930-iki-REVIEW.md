---
phase: 260930-iki-boton-flotante-whatsapp-en-cliente-con-r
reviewed: 2026-09-30T00:00:00Z
depth: quick
files_reviewed: 3
files_reviewed_list:
  - components/whatsapp-cta.tsx
  - app/cliente/lista-reservas-cliente.tsx
  - tests/e2e/cliente-login.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Quick 260930-iki: Code Review Report

**Depth:** quick (uncommitted diff only)

## Summary

Constraints verified: WhatsappCta is unchanged in behavior (only the env read moved to a helper). WhatsappFlotante is mounted only after the `error` and `filas.length === 0` early returns, so it is absent in those states. No reservation logic was touched. `rel="noopener noreferrer"` and `aria-hidden` on the SVG are correct. No security issues. Remaining problems are layout, safe-area and unset-env handling.

## Warnings

### WR-01: Safe-area insets have no effect (viewport-fit=cover is not set)

**File:** `components/whatsapp-cta.tsx:34`
**Issue:** No `viewport` export or `viewportFit` exists in `app/` (grep found none). Without `viewport-fit=cover`, `env(safe-area-inset-*)` resolves to 0 on iOS Safari, so the safe-area handling is dead code. Also, `max(1rem, env(...))` does not add the inset to the margin; `calc(1rem + env(...))` is the usual form. As written it only works in standalone PWA/notch cases where the inset is larger than 16px. The inline `style` also duplicates and overrides the `bottom-4 right-4` classes.
**Fix:** In `app/layout.tsx` add `export const viewport = { viewportFit: "cover" }` (check that it does not break other layouts), and use `bottom: "calc(1rem + env(safe-area-inset-bottom))"`. Or drop the env() handling if the PWA does not need it. Keep only one source for the offsets.

### WR-02: Floating button can cover the bottom of /cliente; page bottom padding is smaller than the button footprint

**File:** `app/cliente/page.tsx:11` (context), `components/whatsapp-cta.tsx:33`
**Issue:** `<main>` uses `py-12` (48px bottom). The button occupies 16px to 72px from the viewport bottom, plus the inset. At the end of the scroll, the "Cerrar sesión" button (48px to about 92px from the bottom, left-aligned) overlaps the button vertically. There is no horizontal overlap at typical widths because the button is about 130px wide and sits on the left. The "Sesión iniciada como {email}" line and the last reservation card or table row can still slide under the button when the email wraps or the last content is full width. The layout holds only by luck and breaks with larger font scale or safe-area. The button is also `fixed` with no reserved space.
**Fix:** Add bottom padding to `<main>` when the flotante is present, e.g. `pb-28` (or `pb-[calc(6rem+env(safe-area-inset-bottom))]`) in `app/cliente/page.tsx`. Since the flotante only renders in the list branch, `pb-28` for the whole page is harmless.

### WR-03: Unset NEXT_PUBLIC_WHATSAPP_OPERADOR produces a broken link, and it is now floating on every page view

**File:** `components/whatsapp-cta.tsx:24`
**Issue:** With the env var unset, `href` becomes `https://wa.me/?text=...`, which opens a generic wa.me error page. This was already true for `WhatsappCta`, but the floating button is persistent and visible on every scroll position for customers who have reservations, so the failure is more visible. There is no e2e test for the unset case. A number with `+`, spaces or dashes is also not sanitized, and wa.me needs digits only.
**Fix:** In `WhatsappFlotante`, return `null` when `numero` is empty. Optionally normalize with `numero.replace(/\D/g, "")`. Add a test or a config note that the env var is required in production (Vercel).

## Info

### IN-01: Duplicated href construction and duplicated message constants

**File:** `components/whatsapp-cta.tsx:10-12,24-26`
**Issue:** Both components build `https://wa.me/${numero ?? ""}?text=...` separately. The helper only extracted the env read, which is a trivial wrapper around `process.env` (still inlined at build by Next because it is a literal property access, so it works).
**Fix:** Extract `construirEnlaceWhatsapp(mensaje: string): string | null` and use it in both components.

### IN-02: Accessibility details on the floating link

**File:** `components/whatsapp-cta.tsx:27-35`
**Issue:** aria-label is present and good. Missing: no visible focus style (`focus-visible:ring`) for keyboard users; `target="_blank"` opens a new tab without warning (the label could mention it, optional). Touch target is 56px, which is fine. `bg-[#25D366]` with white text/icon has about 2:1 contrast, which is acceptable for a brand icon but under WCAG non-text contrast 3:1 against a white background.
**Fix:** Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E]` or similar. Optionally use the darker WhatsApp green `#128C7E` or `#075E54`.

### IN-03: Tests assert raw-string presence only; error state not covered

**File:** `tests/e2e/cliente-login.test.ts:223-224,335`
**Issue:** The three assertions are valid for the list and empty states. The error state ("flotante absent on error") is not asserted, although it is one of the constraints. `not.toContain("whatsapp-cta-flotante")` matches any occurrence of the substring, which is fine here. The encoded-message assertion relies on the message not being altered by HTML escaping; it works because `%` and letters are not escaped.
**Fix:** If a test already forces a `listarReservasCliente` error, add `expect(body).not.toContain("whatsapp-cta-flotante")` there too.

---

_Reviewed: 2026-09-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
