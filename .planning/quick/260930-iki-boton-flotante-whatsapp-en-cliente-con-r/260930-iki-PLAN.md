---
quick_id: 260930-iki
description: Botón flotante de WhatsApp en /cliente cuando el cliente tiene reservas
implementer: codex (vía /codex:rescue) — Claude audita
---

# Plan: botón flotante WhatsApp en /cliente

## Decisión de montaje
`page.tsx` no sabe si hay reservas; `ListaReservasCliente` sí (rama `filas.length === 0`).
Montar el flotante SOLO en la rama con reservas del return final de `ListaReservasCliente`
(`app/cliente/lista-reservas-cliente.tsx`, una línea + import). Así se oculta solo en el estado
vacío y en el estado de error, sin tocar lógica de reservas. `app/cliente/page.tsx` NO se toca
(menos de lo aprobado).

## Tarea 1 — components/whatsapp-cta.tsx
- Conservar `WhatsappCta` tal cual (testid `whatsapp-cta`, mensaje "Hola, quiero planificar un viaje").
- Agregar `export function WhatsappFlotante()`:
  - `<a>` fixed `bottom-4 right-4` con `bottom: max(1rem, env(safe-area-inset-bottom))` y right equivalente, z-50
  - círculo 56px (`size-14 rounded-full`), fondo `#25D366`, ícono WhatsApp SVG inline (sin dependencias nuevas), contraste del ícono blanco
  - `href` = `https://wa.me/${numero ?? ""}?text=` + encodeURIComponent("Hola, quiero pedir una cotización para un nuevo viaje")
  - `target="_blank" rel="noopener noreferrer"`, `aria-label="Pedir una cotización por WhatsApp"`, `data-testid="whatsapp-cta-flotante"`, `active:scale-95`
- Compartir el cálculo del número entre ambas variantes sin cambiar el comportamiento de la existente.

## Tarea 2 — app/cliente/lista-reservas-cliente.tsx
- Importar `WhatsappFlotante`; añadirlo al fragmento final del return con reservas. Nada más.

## Tarea 3 — tests/e2e/cliente-login.test.ts
- Con `clienteConReserva`: body contiene `data-testid="whatsapp-cta-flotante"` y `encodeURIComponent("Hola, quiero pedir una cotización para un nuevo viaje")`.
- Con `clienteSinReserva`: body NO contiene `whatsapp-cta-flotante` y sigue conteniendo `data-testid="whatsapp-cta"`.
- No modificar los tests existentes.

## Restricciones
- No tocar lógica de reservas, `page.tsx` ni otros componentes.
- Nunca leer ni imprimir `.env.local` / `.env.admin.local`; usar solo `scripts/check-env.sh`.
- Next.js tiene cambios: consultar `node_modules/next/dist/docs/` si hace falta.
- Copy de cara al cliente en español venezolano cálido (aria-label incluido).
- NO correr `npm test` completo (rate limit de Supabase Auth); correr solo `tests/e2e/cliente-login.test.ts`.

## Cierre (Claude)
Anti-Slop + gsd-code-review sobre el diff antes de commit.
