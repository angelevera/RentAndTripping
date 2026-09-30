---
quick_id: 260930-iki
status: complete
---

# Botón flotante de WhatsApp en /cliente

Implementado por Codex, auditado por Claude (Anti-Slop/oxlint, ESLint, tsc, gsd-code-reviewer, e2e 14/14).

- `components/whatsapp-cta.tsx`: nuevo `WhatsappFlotante` (56px, #25D366, safe-area con calc, focus-visible). `WhatsappCta` intacto.
- `app/cliente/lista-reservas-cliente.tsx`: montado solo en la rama con reservas (oculto en vacío y en error).
- `app/cliente/page.tsx`: `pb-28` para que no tape el final del contenido.
- `tests/e2e/cliente-login.test.ts`: 3 aserciones nuevas.

## Pendientes (decisión del dueño)
- WR-03: ocultar el flotante si NEXT_PUBLIC_WHATSAPP_OPERADOR no está definida (hoy lleva a wa.me/ vacío).
- WR-01: `viewport-fit=cover` en app/layout.tsx para que el margen de iPhone aplique (no aprobado aún).
- IN-02: contraste ~2:1 del ícono blanco sobre #25D366 (color elegido por el dueño).
- IN-03: sin test para "ausente en estado de error".
