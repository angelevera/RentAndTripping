# Phase 3: Panel de cliente - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-29
**Phase:** 3-Panel de cliente
**Areas discussed:** Login compartido / WR-01 (fijado antes de las preguntas), Vincular reservas existentes, Alcance: reservas de familiares, Cómo se crea la cuenta del cliente, Destino y estado vacío tras login

---

## Login compartido tras el fix de WR-01

Este tema no se presentó como pregunta de opciones — el usuario pidió una explicación detallada del bug WR-01 (qué filtra, qué tan grave es, por qué se dejó para esta fase) y luego dio el comportamiento requerido directamente.

**Comportamiento fijado:** Contraseña incorrecta y cuenta válida sin acceso deben verse indistinguibles desde afuera (mismo mensaje, mismo comportamiento visible); un cliente válido debe poder entrar sin que el arreglo lo bloquee.
**Notas:** Instrucción explícita: esto queda como criterio de aceptación de la Fase 3 (Success Criteria #4 en ROADMAP.md), no como nota aparte.

| Pregunta | Selección |
|--------|-----------|
| Ruta destino de un cliente válido | `/cliente` (sobre `/mis-reservas`) |
| Mensaje exacto unificado | Mantener el mensaje actual: "Correo o contraseña incorrectos." |

---

## Vincular reservas existentes

| Pregunta | Opciones presentadas | Selección |
|--------|----------------------|-----------|
| Cómo se vinculan reservas viejas a una cuenta nueva | Automático por correo / El admin elige manualmente / Solo hacia adelante | **Híbrido** (no era una de las opciones originales): automático si hay coincidencia exacta de correo (o correo+teléfono); candidatas para vincular a mano si la coincidencia es parcial/dudosa o inexistente. El admin también puede vincular manualmente en cualquier momento después. |
| Dónde vive la acción de vincular manualmente | Nueva sección Clientes / Desde cada reserva individual | ✓ Nueva sección `/admin/clientes` |
| Se puede desvincular una reserva mal vinculada | Sí, con un clic / No hace falta en el MVP | ✓ Sí, con un clic |
| Por qué campos se busca al vincular | Nombre, correo o teléfono / Solo correo o teléfono | ✓ Nombre, correo o teléfono del pagador |

**Notas:** El usuario fue más allá de las opciones presentadas en la primera pregunta y describió un híbrido explícito — ver D-04/D-05 en CONTEXT.md para el texto exacto.

---

## Alcance: reservas de familiares

| Pregunta | Opciones presentadas | Selección |
|--------|----------------------|-----------|
| ¿El pagador ve reservas donde el viajero es otra persona sin cuenta? | Sí, el pagador ve todo lo que pagó / No en este MVP | ✓ Sí — el pagador ve todo lo que pagó |
| ¿Se indica quién viaja cuando es distinto del pagador? | Sí, con el nombre visible / No, se ve igual | ✓ Sí, con el nombre del viajero visible |
| ¿El cliente ve estado de pago además del estado de proveedor? | Sí, ambos estados / Solo estado del proveedor | ✓ Sí, ambos estados |
| ¿Se separan reservas activas/próximas del historial pasado? | Una sola lista / Separado en dos secciones | ✓ Separado en dos secciones |

**Notas:** Esta área resuelve la "Decisión de alcance pendiente" que el ROADMAP dejaba abierta desde el UAT de Fase 1. La respuesta confirma que no hace falta lógica nueva — es consecuencia directa de la RLS por `cliente_id` ya existente.

---

## Cómo se crea la cuenta del cliente

| Pregunta | Opciones presentadas | Selección |
|--------|----------------------|-----------|
| Mecanismo exacto de invitación | Invitación por correo con enlace / Contraseña temporal por WhatsApp | ✓ Invitación por correo, con condición: reenvío/estado visible si no confirma en unos días |
| Cómo se ve un cliente invitado sin confirmar | En la misma lista con badge / Sección separada de Pendientes | ✓ En la misma lista, con badge "Invitación pendiente" |
| ¿Se puede invitar sin reserva previa? | Sí, desde cero / Solo desde una reserva existente | ✓ Sí, invitar desde cero en cualquier momento |
| ¿Qué pasa si el correo ya tiene cuenta? | Mensaje claro, sin duplicar / Dejarlo a criterio de Claude | ✓ Mensaje claro, sin duplicar |

---

## Destino y estado vacío tras login

| Pregunta | Opciones presentadas | Selección |
|--------|----------------------|-----------|
| Ruta destino de un cliente válido | `/cliente` / `/mis-reservas` | ✓ `/cliente` |
| Qué ve un cliente sin ninguna reserva vinculada | Mensaje amistoso de estado vacío / Dejarlo a criterio de Claude | El usuario fue más allá de las opciones: estado vacío con estilo de marca, texto tipo "¿A dónde quieres ir?"/"Planifica tu próxima aventura", botón que abre WhatsApp con mensaje predefinido "Hola, quiero planificar un viaje" en vez de un chatbot (que no existe todavía) |
| Número real de WhatsApp para el enlace | Te lo paso ahora / Variable de configuración pendiente | ✓ Variable de configuración pendiente — no se documenta un número real |
| Mensaje exacto unificado para WR-01 (confirmación) | Mantener el mensaje actual / Dejarlo a criterio de Claude | ✓ Mantener el mensaje actual |

**Notas:** El usuario pidió explícitamente anotar el punto de conexión entre esta fase y la Fase 6 (el botón de WhatsApp se reemplaza más adelante por el asistente de cotización sin tocar nada más) — anotado en ambas secciones del ROADMAP.md (Fase 3 y Fase 6).

---

## Claude's Discretion

- Estructura técnica exacta de listado/paginación de `/admin/clientes`.
- Detalles de UI/diseño visual exacto del panel `/cliente` y de `/admin/clientes` (considerar `/gsd-ui-phase 3`).
- Implementación técnica exacta del fix de WR-01 (el usuario fijó el comportamiento observable, no el código).

## Deferred Ideas

- Asistente de cotización por chat (Fase 6) — reemplaza el botón de WhatsApp del estado vacío de `/cliente` sin tocar nada más de esta fase. Anotado en ROADMAP.md (notas de Fase 3 y Fase 6).
