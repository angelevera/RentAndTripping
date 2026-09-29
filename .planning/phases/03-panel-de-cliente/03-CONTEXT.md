# Phase 3: Panel de cliente - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Cada cliente tiene su propia cuenta (creada/invitada por el admin) para ver sus reservas y su historial, sin tener que escribirle al admin por WhatsApp para preguntar "¿cómo va mi reserva?". Cubre AUTH-02 (login de cliente con RLS), RESA-05 (detalle de cada reserva: tipo, fecha, estado, precio) y RESA-06 (historial de reservas pasadas, visible tanto por el cliente como por el admin). Incluye, como parte del mismo diseño (no como nota aparte), el arreglo de WR-01 (login compartido) porque esta fase es la primera en introducir cuentas de cliente reales sobre `/login`. No incluye registro de cobros/comprobantes (Fase 4, aunque el estado de pago ya se lee en el panel), ni avisos/recordatorios automáticos (Fase 5), ni el asistente de cotización del sitio público (Fase 6 — ver nota de conexión en Deferred Ideas).

</domain>

<decisions>
## Implementation Decisions

### Login compartido y fix de WR-01 (criterio de aceptación de esta fase)
- **D-01:** Contraseña incorrecta y "cuenta válida pero sin acceso" deben verse **indistinguibles desde afuera** — mismo mensaje, mismo comportamiento visible (sin redirect chain delatador). Instrucción explícita del usuario: esto es criterio de aceptación de la Fase 3, no una nota aparte. — **Reversibility:** costly — toca la lógica central de `app/login/actions.ts` que ya protege tanto al admin como a los futuros clientes; un arreglo mal diseñado puede volver a romper la prueba que confirma que `/login` es la puerta compartida (ya pasó una vez en Fase 1).
- **D-02:** Mensaje unificado exacto: mantener el texto actual **"Correo o contraseña incorrectos."** para ambos casos (contraseña mala y cuenta válida sin acceso) — no se crea un mensaje nuevo.
- **D-03:** Un cliente válido que inicia sesión llega a **`/cliente`** (ruta corta, paralela a `/admin`, fácil de decir por WhatsApp).

### Vincular reservas existentes a una cuenta de cliente
- **D-04:** Vinculación híbrida: si hay coincidencia **exacta** de correo (o correo+teléfono), se vincula automático sin pedir nada al admin. Si la coincidencia es parcial/dudosa (solo teléfono, correo parecido) o no hay ninguna coincidencia pero el admin sabe que existen reservas viejas de esa persona, se muestran como **candidatas** para vincular a mano con un clic. — **Reversibility:** reversible — es lógica de aplicación sobre datos ya existentes, no cambia esquema.
- **D-05:** El admin también puede **buscar y vincular manualmente en cualquier momento después**, no solo en el momento de crear/invitar la cuenta.
- **D-06:** La acción de vincular vive en una **nueva sección `/admin/clientes`** (no en el formulario de editar reserva) — lista de cuentas de cliente; al abrir una, el admin busca y vincula reservas huérfanas ahí. Esta pantalla también sirve para RESA-06 (ver historial por cliente desde el admin).
- **D-07:** Se puede **desvincular** una reserva mal vinculada con un clic desde la misma pantalla (`cliente_id` vuelve a NULL).
- **D-08:** La búsqueda de reservas huérfanas admite **nombre, correo o teléfono del pagador** (coincidencia parcial), mismo patrón que la búsqueda de la lista de reservas de Fase 2.

### Cómo se crea/invita la cuenta del cliente
- **D-09:** Mecanismo: **invitación por correo con enlace** (Supabase Auth invite) — el cliente elige su propia contraseña, el admin nunca la conoce.
- **D-10:** Si el cliente no confirma la invitación en un tiempo razonable, el admin debe poder **ver que sigue pendiente y reenviar** la invitación, para darle seguimiento por WhatsApp. En `/admin/clientes`, un cliente invitado sin confirmar aparece **en la misma lista** que los clientes activos, con un badge "Invitación pendiente" y botón de reenviar (no en una sección separada).
- **D-11:** El admin puede **invitar a un cliente nuevo sin que exista ninguna reserva previa** — botón "Invitar cliente" independiente, no atado al flujo de vincular una reserva huérfana.
- **D-12:** Si el admin intenta invitar un correo que ya tiene cuenta, el sistema muestra un **mensaje claro** ("Ese correo ya tiene una cuenta") y no duplica la invitación.

### Alcance: reservas de familiares / viajero distinto al pagador
- **D-13:** El pagador ve **todas** las reservas donde su cuenta es la vinculada (`cliente_id`), sin importar quién es el viajero — esto es consecuencia directa de vincular por `cliente_id`/RLS, **no requiere lógica nueva** (resuelve la decisión de alcance que el ROADMAP dejaba pendiente).
- **D-14:** Cuando el viajero es distinto del pagador, el panel de cliente muestra **"Para: [nombre del viajero]"** en cada reserva — mismo patrón que ya usa la lista de admin desde Fase 2.
- **D-15:** El detalle de cada reserva (RESA-05) muestra **ambos estados**: estado del proveedor (pendiente/confirmada/con problema) y estado de pago (pagado/pendiente) — el dato de pago ya existe en la base desde Fase 1/2, solo falta mostrarlo en el panel de cliente.
- **D-16:** El panel de cliente **separa** reservas activas/próximas (arriba) de historial pasado (abajo), según `fecha_importante` — a diferencia de la lista de admin de Fase 2, que es una sola lista sin separar (D-11 de esa fase). Esta es una decisión de diseño nueva para esta fase.

### Estado vacío de `/cliente`
- **D-17:** Cuando un cliente válido no tiene ninguna reserva vinculada todavía, ve un estado vacío con **estilo de marca** (morado, limpio) y texto tipo "¿A dónde quieres ir?" / "Planifica tu próxima aventura" — no un mensaje de error.
- **D-18:** El llamado a la acción de ese estado vacío es un **botón/enlace que abre WhatsApp directo** al número del operador, con mensaje predefinido "Hola, quiero planificar un viaje" (en vez de un botón a un chatbot, que no existe todavía).
- **D-19:** El número real de WhatsApp queda como **variable de configuración pendiente** (ej. `NEXT_PUBLIC_WHATSAPP_OPERADOR`) — no se fija un número real en ningún documento de planificación ni se inventa; el operador lo provee antes de ejecutar esta fase.

### Claude's Discretion
- Estructura técnica exacta de cómo `/admin/clientes` lista y pagina cuentas de cliente (con o sin reservas) — el usuario no tiene opinión sobre esto; seguir el patrón de tabla/tarjetas + paginación ya establecido en la lista de reservas de Fase 2.
- Detalles de UI/diseño visual exacto del panel `/cliente` y de `/admin/clientes` (layout, componentes shadcn/ui) — la fase tiene `UI hint: yes` en el roadmap; considerar `/gsd-ui-phase 3` si hace falta más detalle visual del que este documento captura.
- Implementación técnica exacta del fix de WR-01 (dónde exactamente se hace la comprobación unificada, cómo se estructura el redirect) — el usuario fijó el comportamiento observable (D-01, D-02), no la implementación; el researcher/planner debe diseñarla respetando ambos.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contexto de negocio y producto
- `.planning/PROJECT.md` — contexto del proyecto, restricciones, decisiones clave
- `.planning/REQUIREMENTS.md` — AUTH-02, RESA-05, RESA-06 son los requisitos v1 de esta fase
- `.planning/ROADMAP.md` §"Phase 3: Panel de cliente" — Goal, Success Criteria, y las dos notas que esta fase resuelve (alcance de familiares, deuda WR-01)
- `idea.md` (raíz del proyecto) — descubrimiento completo del negocio

### Esquema y RLS ya aplicados (NO editar — reservas.cliente_id ya es nullable desde Fase 2)
- `supabase/migrations/20260929012532_pagador_viajero_reservas.sql` — `cliente_id` nullable, columnas `pagador_*`/`viajero_*`; la política RLS "reservas: el cliente ve las suyas" (`cliente_id = auth.uid()`) ya cubre D-13 sin cambios
- `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql` — esquema base de `reservas`/`pagos`/`recordatorios` con RLS
- `lib/auth/require-admin.ts` — patrón de guardia de sesión+rol que el equivalente de cliente (`requireCliente()` o similar) debe seguir
- `app/login/actions.ts` — lógica actual de `iniciarSesion` donde vive el fix de WR-01 (D-01, D-02)

### Revisión de código de Fase 1 (detalle técnico de WR-01)
- `.planning/phases/01-base-y-acceso-seguro/01-REVIEW.md` §WR-01 — descripción completa del bug (líneas 62-77), incluye el intento de fix que se descartó por bloquear clientes reales
- `.planning/phases/01-base-y-acceso-seguro/01-REVIEW-FIX.md` — detalle de por qué el intento de arreglo rompió la prueba de puerta compartida

### Fase 2 (patrones reusables de lista/búsqueda/estado)
- `.planning/phases/02-gesti-n-de-reservas-admin/02-CONTEXT.md` — decisiones D-01 a D-11 de Fase 2 (pagador/viajero, columnas de lista, orden, búsqueda)
- `lib/reservas/listar.ts` — query de listado con `pagado` derivado de `pagos.estado = 'confirmado'`, reusar el mismo patrón para el panel de cliente
- `app/admin/reservas/lista-reservas.tsx`, `filtros-reservas.tsx` — patrón de tabla/tarjetas, badges, búsqueda, skeleton

### Identidad visual
- `DESIGN.md` (raíz del proyecto) — guía de estilo basada en Apple
- `assets/Rent_a_trippin-01.png` — logo oficial; color de marca `#482583`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth/require-admin.ts` — patrón de guardia de sesión+rol (`getSessionStatus` cacheado, variantes con/sin redirect); el guardia de cliente debe componer sobre el mismo `getSessionStatus` en vez de repetir la consulta a `profiles`, para que un futuro cambio (ej. columna `disabled`) no se aplique a uno y se olvide en el otro.
- `lib/reservas/listar.ts` — ya resuelve exactamente el problema de "estado de pago derivado" (`pagado` = existe un pago con `estado = 'confirmado'`) que el panel de cliente necesita mostrar (D-15).
- `app/admin/reservas/lista-reservas.tsx` — badges de estado, patrón tabla/tarjetas responsive, ya construido en Fase 2; el panel de cliente reusa el mismo lenguaje visual.
- Componentes shadcn/ui instalados en Fase 2 (preset 'nova', `field` en vez de `form`) — reusar, no reinstalar.

### Established Patterns
- RLS ya cubre el caso de cliente (`cliente_id = auth.uid()`) — no hace falta tocar políticas para D-13.
- Mensajes de error en español, claros para un solo mantenedor no técnico.
- `/login` es la puerta compartida admin+cliente — cualquier cambio ahí debe preservar ambos flujos (lección de Fase 1).

### Integration Points
- `app/login/actions.ts` — punto exacto donde se implementa el fix de WR-01 (D-01, D-02) y el redirect a `/cliente` (D-03).
- Nueva ruta `/cliente` — no existe todavía.
- Nueva ruta `/admin/clientes` — no existe todavía; se conecta con `app/admin/reservas/actions.ts` (o un archivo hermano) para la lógica de vincular/desvincular/invitar.
- `app/admin/page.tsx` — puede necesitar un enlace de navegación a la nueva sección `/admin/clientes`.

</code_context>

<specifics>
## Specific Ideas

- El botón de estado vacío en `/cliente` debe decir algo como "¿A dónde quieres ir?" o "Planifica tu próxima aventura", con el estilo visual de la app (morado, limpio) — cita del usuario, preservada porque define el tono exacto (D-17).
- El mensaje predefinido del enlace de WhatsApp debe ser "Hola, quiero planificar un viaje" (D-18).
- El operador que atiende ese WhatsApp es "el hermano" del usuario, no necesariamente el mismo dueño que aparece en otros documentos del proyecto — el número real no se documenta aquí (D-19), queda como configuración pendiente.

</specifics>

<deferred>
## Deferred Ideas

- **Punto de conexión explícito Fase 3 ↔ Fase 6** (instrucción directa del usuario, anotar en ROADMAP.md): el botón de WhatsApp del estado vacío de `/cliente` (D-18) debe diseñarse para que Fase 6, al construir el asistente de cotización por chat, pueda **reemplazar ese botón sin tocar nada más** de esta fase. No implementar el asistente ahora — solo dejar el punto de reemplazo limpio (ej. un solo componente de CTA, no lógica de WhatsApp esparcida).

### Reviewed Todos (not folded)
None — `todo.match-phase` no encontró coincidencias para esta fase.

</deferred>

---

*Phase: 3-Panel de cliente*
*Context gathered: 2026-09-29*
