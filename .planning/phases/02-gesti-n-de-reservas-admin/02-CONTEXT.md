# Phase 2: Gestión de reservas (admin) - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

El admin tiene un solo lugar para crear, editar y dar seguimiento a todas las reservas (pasajes, hoteles, tours, entradas), reemplazando el cuaderno mental/WhatsApp de hoy. Cubre RESA-01 (crear), RESA-02 (editar), RESA-03 (lista con estado), RESA-04 (marcar confirmada con proveedor, independiente del pago). No incluye el panel de cliente (Fase 3), ni el registro de cobros/comprobantes (Fase 4, aunque el estado de pago se lee en la lista), ni avisos/recordatorios automáticos (Fase 5, aunque `fecha_importante` ya alimenta esa fase futura).

</domain>

<decisions>
## Implementation Decisions

### Pagador vs. viajero (modelo de datos — requiere migración nueva)
- **D-01:** El pagador NO necesita tener una cuenta creada para que el admin le cree una reserva. El admin escribe nombre/correo/teléfono del pagador directo en el formulario, sin depender de que Fase 3 (login cliente) ya exista — hoy el negocio no tiene ninguna cuenta de cliente creada todavía. — **Reversibility:** one-way — cambia el esquema actual donde `reservas.cliente_id` es `not null references profiles(id)`; la migración de esta fase debe reemplazar esa columna por datos de contacto directos (o hacerla nullable + vincular después), y este cambio de forma es costoso de revertir una vez que haya reservas reales creadas sin cuenta asociada.
- **D-02:** El nombre del viajero solo se pide cuando es distinto del pagador — una casilla "Es para otra persona" en el formulario; si no se marca, el viajero es el pagador.
- **D-03:** Una reserva = un servicio vendido, no un viajero individual (ej. 3 pasajes comprados juntos en una misma venta = 1 sola reserva). La cantidad de personas y los nombres de los viajeros se guardan dentro de `detalle` (jsonb) como una lista simple, sin estado propio por viajero — el `estado_proveedor`, el pago y los recordatorios aplican a la reserva completa, no a cada viajero. Debe existir un **contacto principal del viaje** (puede no tener cuenta — ver D-01). Si más adelante hace falta separar a un viajero en su propia reserva, se crea una reserva nueva — **el diseño debe hacer ese split barato** (instrucción explícita del usuario), no forzar una migración de datos compleja.
- **D-04:** Datos del viajero/contacto principal cuando no tiene cuenta ni correo: nombre + teléfono (mínimo para poder contactarlo si hace falta). No se pide documento de identidad en el MVP.

### Campos por tipo de reserva (contenido de `detalle` jsonb)
- **D-05:** Pasaje: aerolínea + origen/destino + fecha de vuelo + número de reserva/PNR de la aerolínea como campo propio (no solo en notas libres) — el admin lo consulta seguido para dar seguimiento con el cliente.
- **D-06:** Hotel/tour/entrada: nombre del servicio + fecha(s) + un campo de nota libre. Hotel → nombre + check-in/check-out. Tour → nombre + fecha. Entrada → evento + fecha. No se diseñan formularios rígidos con campos estructurados distintos por cada variante — la nota libre cubre casos específicos.
- **D-07:** `fecha_importante` es **opcional** al crear cualquier reserva — no todas las reservas tienen una fecha crítica obvia al momento de crearla (ej. una entrada a concierto sin fecha aún confirmada). El admin la agrega después si hace falta; sin ella, simplemente no habrá recordatorio automático para esa reserva en Fase 5.

### Lista de reservas
- **D-08:** Columnas visibles de un vistazo: cliente (pagador/contacto principal) + tipo + fecha importante + estado proveedor + estado pago + monto.
- **D-09:** El monto en la lista se muestra **en USD**. Interpretación aplicada a partir de la respuesta del usuario ("Solo en USD"): cuando la reserva está en USD (caso común, moneda canónica del negocio) se muestra el monto tal cual. Cuando una reserva está cotizada en VES (caso raro — el esquema no guarda una tasa de cambio a nivel de reserva, solo a nivel de cada pago), **no se inventa una conversión** en la columna de la lista — el admin ve el monto en VES abriendo el detalle de esa reserva puntual. **Esta interpretación no fue confirmada palabra por palabra por el usuario** — si el equipo de planificación/investigación lo ve distinto, vale la pena confirmar antes de construir la columna de monto.
- **D-10:** Búsqueda/filtro: por nombre de cliente (texto libre) + filtro por estado (proveedor) + filtro por tipo. Sin filtro de rango de fechas en el MVP.
- **D-11:** Orden por defecto: más reciente creada primero — refleja el flujo de trabajo diario (lo que se acaba de vender arriba, similar a revisar los chats más recientes de WhatsApp).

### Claude's Discretion
- Estado "con problema" (`nota_problema`, cuándo se marca, si la nota es obligatoria, quién la quita) — el usuario no seleccionó este tema para discutir. Usar criterio razonable: `nota_problema` obligatoria al marcar `estado_proveedor = 'con_problema'` (ya existe la columna), cualquier admin (solo hay uno) puede quitar el estado editando la reserva.
- Detalles de UI/diseño visual del formulario y la lista (layout exacto, componentes shadcn/ui a usar) — la fase tiene `UI hint: yes` en el roadmap; considerar `/gsd-ui-phase 2` para un contrato de diseño antes o durante la planificación si hace falta más detalle visual del que este documento captura.
- Estructura técnica exacta de la migración nueva que implementa D-01 a D-03 (nombres de columnas, si `detalle` guarda el contacto principal o si se promueve a columnas propias) — el usuario no tiene opinión sobre esto; el researcher/planner debe diseñarlo respetando D-01 a D-04 y el patrón RLS-desde-la-primera-migración ya establecido en Fase 1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexto de negocio y producto
- `.planning/PROJECT.md` — contexto del proyecto, restricciones, decisión clave sobre pagador vs. viajero (tabla "Key Decisions")
- `.planning/REQUIREMENTS.md` — RESA-01 a RESA-04 son los requisitos v1 de esta fase
- `.planning/ROADMAP.md` §"Phase 2: Gestión de reservas (admin)" — Goal, Success Criteria, y la nota sobre la migración nueva
- `idea.md` (raíz del proyecto) — descubrimiento completo del negocio

### Esquema y migraciones ya aplicadas (Fase 1 — NO editar, la migración de esta fase es nueva)
- `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql` — esquema actual de `reservas`/`pagos`/`recordatorios` con RLS; `reservas.cliente_id` hoy es `not null references profiles(id)` — esto es lo que D-01 requiere cambiar en una migración nueva
- `supabase/migrations/20260927000004_pagos_tasa_cambio_solo_en_bs.sql` — constraint que confirma: `tasa_cambio` solo existe en `pagos`, nunca en `reservas` (relevante para D-09)
- `.planning/phases/01-base-y-acceso-seguro/01-CONTEXT.md` — contexto de Fase 1, incluye discreción ya aplicada sobre RLS y estructura de `profiles`

### Investigación de arquitectura (de la Fase 1, sigue vigente)
- `.planning/research/ARCHITECTURE.md` — patrones de RLS, storage privado
- `.planning/research/PITFALLS.md` — Pitfall 3 (USD como moneda canónica, sin integrar API de tasa en vivo), Pitfall 5 (RLS desde la primera migración, nunca "después")
- `.planning/research/STACK.md` — versiones confirmadas (Next.js 16, Supabase, `@supabase/ssr`)

### Identidad visual (para el formulario y la lista)
- `DESIGN.md` (raíz del proyecto) — guía de estilo basada en Apple
- `assets/Rent_a_trippin-01.png` — logo oficial; color de marca `#482583`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth/require-admin.ts` — guardia ya usado en `app/admin/page.tsx`; toda nueva página/acción de reservas bajo `/admin` debe reusar este patrón.
- `lib/validation/*.ts` (patrón establecido en `lib/validation/auth.ts`) — un solo esquema zod compartido entre `zodResolver` (cliente) y `safeParse` (Server Action). Crear `lib/validation/reservas.ts` siguiendo el mismo patrón.
- `lib/supabase/server.ts` — cliente Supabase del lado servidor ya configurado.
- `app/admin/actions.ts` — ya existe un archivo de Server Actions para el admin (hoy solo tiene `cerrarSesion`); las acciones de crear/editar reserva probablemente viven aquí o en un archivo hermano bajo una nueva ruta `app/admin/reservas/`.

### Established Patterns
- RLS habilitada en la misma migración que crea cada tabla, nunca "después" (Pitfall 5, ya aplicado en Fase 1).
- Cada tabla necesita GRANT explícito además de política RLS — "Automatically expose new tables" está desactivado en este proyecto Supabase.
- `private.set_updated_at()` trigger genérico ya existe — reusar en cualquier tabla nueva que necesite `updated_at`.
- Mensajes de error en español, claros para un solo mantenedor no técnico (Pitfall de Fase 1).
- shadcn/ui **no está instalado todavía** — Fase 1 usó Tailwind plano deliberadamente y difirió la instalación al contrato de UI de esta fase.

### Integration Points
- `app/admin/page.tsx` hoy solo muestra "Todavía no hay reservas cargadas." — esta fase reemplaza ese placeholder con la lista real.
- Nueva ruta probable: `app/admin/reservas/` (crear, editar, listar) — no existe todavía.
- La migración nueva de esta fase debe tener timestamp posterior a `20260927000004` y no debe tocar ninguna de las 4 migraciones ya aplicadas.

</code_context>

<specifics>
## Specific Ideas

- "Una reserva = un servicio vendido (por ejemplo, 3 pasajes en una misma venta). Guarda la cantidad de personas y los nombres de los viajeros dentro de detalle (jsonb), como lista simple sin estado propio. El estado, el pago y los recordatorios son de la reserva completa. Debe existir un contacto principal del viaje (puede no tener cuenta). Si más adelante hace falta separar a un viajero, se crea una reserva nueva. Diseña para que ese cambio sea barato." — respuesta textual del usuario, cita exacta preservada porque define la forma del esquema nuevo (ver D-03).
- El monto en la lista de reservas debe verse "solo en USD" — ver D-09 para la interpretación aplicada al caso de reservas en VES.

</specifics>

<deferred>
## Deferred Ideas

Ninguna — la conversación se mantuvo dentro del alcance de la fase.

### Reviewed Todos (not folded)
None — `todo.match-phase` no encontró coincidencias para esta fase.

</deferred>

---

*Phase: 2-Gestión de reservas (admin)*
*Context gathered: 2026-09-28*
