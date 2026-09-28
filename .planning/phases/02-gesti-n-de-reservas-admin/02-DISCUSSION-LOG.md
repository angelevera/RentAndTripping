# Phase 2: Gestión de reservas (admin) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 2-Gestión de reservas (admin)
**Areas discussed:** Pagador vs. viajero, Campos por tipo de reserva, Lista de reservas

---

## Pagador vs. viajero

| Pregunta | Opciones presentadas | Elegida |
|---|---|---|
| ¿El pagador debe tener ya una cuenta creada, o el admin puede registrar sus datos sin cuenta? | Sin cuenta al crear (recomendado) / Requiere cuenta existente / Tú decides | ✓ Sin cuenta al crear |
| ¿Siempre se pide el nombre del viajero, o solo cuando es distinto del pagador? | Solo cuando es distinto (recomendado) / Siempre se pide / Tú decides | ✓ Solo cuando es distinto |
| ¿Una reserva puede tener varios viajeros, o es siempre 1 reserva = 1 viajero? | 1 reserva = 1 viajero (recomendado) / Varios viajeros por reserva / Tú decides | Other (respuesta libre, ver Notas) |
| ¿Qué datos del viajero se capturan cuando no tiene cuenta ni correo? | Nombre + teléfono (recomendado) / Nombre + teléfono + documento / Tú decides | ✓ Nombre + teléfono |

**User's choice (pregunta 3, texto libre):** "Una reserva = un servicio vendido (por ejemplo, 3 pasajes en una misma venta). Guarda la cantidad de personas y los nombres de los viajeros dentro de detalle (jsonb), como lista simple sin estado propio. El estado, el pago y los recordatorios son de la reserva completa. Debe existir un contacto principal del viaje (puede no tener cuenta). Si más adelante hace falta separar a un viajero, se crea una reserva nueva. Diseña para que ese cambio sea barato."

**Notes:** Esta respuesta reemplaza por completo las dos opciones ofrecidas (ni "1 reserva = 1 viajero" ni "varios viajeros con estado propio") por un modelo intermedio: 1 reserva = 1 venta, con lista simple de viajeros sin estado individual. Reflejado íntegro en CONTEXT.md D-03 y en `<specifics>` como cita textual.

---

## Campos por tipo de reserva

| Pregunta | Opciones presentadas | Elegida |
|---|---|---|
| Pasaje: ¿qué datos mínimos? | Aerolínea + origen/destino + fecha (recomendado) / + número PNR / Tú decides | ✓ + número de reserva/PNR de la aerolínea |
| Hotel/tour/entrada: ¿qué datos mínimos? | Nombre + fecha(s) + nota libre (recomendado) / Campos estructurados por tipo / Tú decides | ✓ Nombre + fecha(s) + nota libre |
| ¿`fecha_importante` obligatoria u opcional? | Opcional (recomendado) / Obligatoria / Tú decides | ✓ Opcional |

**Notes:** Sin desviaciones — las 3 respuestas siguieron la opción recomendada.

---

## Lista de reservas

| Pregunta | Opciones presentadas | Elegida |
|---|---|---|
| ¿Qué columnas ve el admin de un vistazo? | Cliente+tipo+fecha+estado proveedor+estado pago (recomendado) / + precio/moneda / Tú decides | Other — "el número uno agregando el monto que siempre aparezca en dólares" |
| Seguimiento: ¿cómo se muestra el monto si la reserva está en VES (sin tasa a nivel de reserva)? | Mostrar en moneda original (recomendado) / Convertir con la última tasa de un pago / Tú decides | ✓ "Solo en USD" |
| ¿Cómo busca/filtra el admin? | Nombre de cliente + estado + tipo (recomendado) / + rango de fechas / Tú decides | ✓ Nombre de cliente + estado + tipo |
| ¿Orden por defecto? | Más reciente creada primero (recomendado) / Fecha importante más próxima primero / Tú decides | ✓ Más reciente creada primero |

**User's choice (columnas, texto libre):** "el numero uno agregando el monto que siempre aparezca en dolares"

**Notes:** La respuesta "Solo en USD" a la pregunta de seguimiento sobre VES quedó terse — Claude aplicó una interpretación explícita (no convertir VES sin tasa confiable, mostrar el monto convertido solo en el detalle) documentada en CONTEXT.md D-09 con una nota de que no fue confirmada palabra por palabra. Si el researcher/planner tiene dudas, vale la pena confirmar con el usuario antes de construir la columna de monto.

---

## Claude's Discretion

- Estado "con problema" (`nota_problema`) — área no seleccionada para discutir por el usuario. Ver CONTEXT.md → Claude's Discretion para el criterio aplicado.
- Detalles de UI/diseño visual exacto del formulario y la lista — se sugiere `/gsd-ui-phase 2` si hace falta más profundidad visual.
- Estructura técnica exacta de la migración nueva (nombres de columnas, si el contacto principal se promueve fuera del jsonb) — a discreción del researcher/planner, respetando D-01 a D-04.

## Deferred Ideas

Ninguna — la conversación se mantuvo dentro del alcance de la fase (RESA-01 a RESA-04).
