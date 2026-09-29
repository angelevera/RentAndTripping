# Rent & Trippin

## What This Is

Rent & Trippin es una agencia de viajes digital en Venezuela que vende pasajes aéreos (nacionales e internacionales), hoteles, tours y entradas a conciertos. Hoy opera 100% manual por Instagram y WhatsApp, gestionada por una sola persona. Este proyecto construye una app web (MVP) que centraliza reservas, cobros, confirmación de pagos y seguimiento para el operador, y da a cada cliente un panel propio para ver sus reservas.

## Core Value

Que el operador deje de gestionar todo a mano por WhatsApp y tenga un solo lugar para crear reservas, cobrar, confirmar pagos y darles seguimiento — sin perder ninguna.

## Business Context

- **Customer**: el operador (dueño único del negocio) usa el panel de administración; los clientes finales (venezolanos dentro de Venezuela y de la diáspora comprando para sí mismos o familiares) usan el panel de cliente.
- **Revenue model**: la agencia cobra por vender pasajes, hoteles, tours y entradas (margen/comisión sobre cada reserva). El software es una herramienta interna, no tiene modelo de suscripción propio.
- **Success metric**: automatizar el trabajo manual que hoy se hace por WhatsApp — éxito en el primer mes se mide por cuánto de ese trabajo manual (cobrar, informar, dar seguimiento) queda resuelto por la app.
- **Strategy notes**: ver `idea.md` en la raíz del proyecto para el contexto de descubrimiento completo (incluye arquitectura técnica y guía de estilo visual).

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Panel de administración: crear y gestionar reservas (pasajes, hoteles, tours, entradas)
- [ ] Registro de cobros en efectivo, Zelle, Binance, y tarjeta internacional vía link de pago Payoneer
- [ ] Subida de comprobante de pago (cliente) y confirmación manual (operador)
- [ ] Panel de cliente con login propio para ver sus propias reservas y su estado
- [ ] Avisos al cliente si algo cambia en su reserva, y recordatorios antes de fechas importantes
- [ ] Sitio público de presentación (home), sin login, estilo Apple — quiénes somos y los servicios que ofrece Rent & Trippin (pasajes, hoteles, tours, entradas) — Fase 6, después del MVP operativo de las Fases 1-5

### Out of Scope

- Sistema de rewards/puntos para clientes frecuentes — Fase 2, no crítico para validar el MVP
- Verificación automática de pagos vía API de Binance — requiere evaluación posterior; Zelle nunca podrá verificarse automáticamente por terceros
- Checkout con Stripe embebido — requiere constituir una LLC en EE.UU., no existe todavía
- Reportes/resumen del negocio, catálogo público, integraciones directas con proveedores, chat interno — Fase 2
- Soporte multi-usuario admin — el operador trabaja solo hoy

## Context

- **Negocio hoy**: solo por Instagram y WhatsApp, sin ningún sistema; ~10-15 reservas por semana; un solo operador, sin equipo.
- **Proveedores**: compra a aerolíneas directo, consolidadoras/mayoristas, y otras agencias, según el caso.
- **Clientes**: venezolanos dentro de Venezuela, y de la diáspora comprando para sí mismos o para familiares que viven allá.
- **Identidad de marca**: logo en `assets/Rent_a_trippin-01.png`; color de marca `#482583` (morado, extraído directamente del logo); tipografía Poppins/Fredoka para títulos (bold/redondeada, no hay fuente original del logo) + Inter para cuerpo de texto.
- **Guía de estilo visual**: `DESIGN.md` (análisis del sitio de Apple) combinado con la identidad de marca — ver sección 8 de `idea.md`. Fotografía: banco de imágenes de stock libres de derechos (Unsplash, Pexels) por ahora, reemplazables por fotos propias más adelante.
- **Arquitectura técnica ya decidida**: app web responsive tipo PWA (no apps nativas); Next.js + Supabase (base de datos, login, storage de comprobantes) + Vercel (hosting); cobro con tarjeta vía link de pago de Payoneer.

## Constraints

- **Tech stack**: Next.js + Supabase + Vercel — rápido de construir, barato de alojar, fácil de mantener sin ser programador experto (ni el dueño del negocio ni quien administra el proyecto programan).
- **Pagos**: no existe empresa constituida (LLC); los pagos con tarjeta internacional van por link de pago de Payoneer (no checkout embebido, porque eso requiere cuenta empresarial aprobada como partner). La confirmación de todos los métodos de pago (Zelle, Binance, Payoneer) es manual por parte del operador.
- **Equipo**: el operador trabaja solo — el MVP asume un solo usuario admin.
- **Identidad visual**: debe usar el logo y color de marca (`#482583`) ya definidos; no se inventa una paleta nueva.
- **Plataforma**: la mayoría de los clientes usan celular — la app debe funcionar bien en móvil antes que en escritorio.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| App web responsive tipo PWA, no apps nativas | Ni el dueño ni el desarrollador programan; evita mantener dos codebases y pasar por revisión de app stores | — Pending |
| Next.js + Supabase + Vercel | Rápido de construir, barato, fácil de mantener; login/BD/storage ya incluidos en Supabase | — Pending |
| Cobro con tarjeta vía link de pago Payoneer (no checkout embebido) | No hay LLC/cuenta empresarial todavía; el checkout embebido de Payoneer requiere aprobación de partner | — Pending |
| Confirmación de pagos manual en todos los métodos | Sin acceso a webhooks automáticos de Zelle/Binance/Payoneer en esta etapa | — Pending |
| Color de marca `#482583`, tipografía Poppins/Fredoka (títulos) + Inter (cuerpo) | Extraído directamente del logo oficial; no existe la fuente original | ✓ Good |
| Fotografía de stock (Unsplash/Pexels) en vez de fotos propias | El negocio no tiene banco de fotos propio todavía | — Pending |
| Una reserva distingue al pagador (quien paga, puede tener cuenta) del viajero (quien viaja, puede no tener cuenta ni correo) | Confirmado en el UAT de Fase 1: habrá clientes sin cuenta/correo, y quien paga no siempre es quien viaja | — Pending. Se implementa en Fase 2 como **migración nueva** (no se edita el esquema de reservas/pagos ya aplicado en Fase 1). La gestión de reservas de familiares por el pagador es una decisión de **alcance de Fase 3**, pero el modelo de datos de Fase 2 debe permitirla |
| Fase 6 nueva: sitio público de presentación (home), sin login, estilo Apple | El negocio no tiene ningún escaparate fuera de Instagram/WhatsApp; se agrega después del MVP operativo (Fases 1-5) para no distraer del flujo de reservas/pagos. Usa la guía de estilo de `idea.md` sección 8 (Apple + identidad de marca morado `#482583`) | — Pending. Solo anotada en ROADMAP.md; no se ha corrido `/gsd-discuss-phase 6` ni `/gsd-plan-phase 6` todavía |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-27 after initialization*
