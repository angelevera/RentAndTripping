# Phase 2: Gestión de reservas (admin) - Research

**Researched:** 2026-09-28
**Domain:** Next.js 16 (App Router) Server Actions + Supabase Postgres schema migration (pagador/viajero) + shadcn/ui forms, on top of the Phase 1 auth/RLS foundation
**Confidence:** HIGH for stack/versions and shadcn Form API (verified live this session); MEDIUM for architecture patterns (cross-checked against official docs + this project's own established Phase 1 code); LOW/ASSUMED for the exact new-migration schema and two business-rule gaps not fully specified in CONTEXT.md/UI-SPEC — flagged explicitly below and in the Assumptions Log.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pagador vs. viajero (modelo de datos — requiere migración nueva)**
- **D-01:** El pagador NO necesita tener una cuenta creada para que el admin le cree una reserva. El admin escribe nombre/correo/teléfono del pagador directo en el formulario, sin depender de que Fase 3 (login cliente) ya exista — hoy el negocio no tiene ninguna cuenta de cliente creada todavía. — **Reversibility:** one-way — cambia el esquema actual donde `reservas.cliente_id` es `not null references profiles(id)`; la migración de esta fase debe reemplazar esa columna por datos de contacto directos (o hacerla nullable + vincular después), y este cambio de forma es costoso de revertir una vez que haya reservas reales creadas sin cuenta asociada.
- **D-02:** El nombre del viajero solo se pide cuando es distinto del pagador — una casilla "Es para otra persona" en el formulario; si no se marca, el viajero es el pagador.
- **D-03:** Una reserva = un servicio vendido, no un viajero individual (ej. 3 pasajes comprados juntos en una misma venta = 1 sola reserva). La cantidad de personas y los nombres de los viajeros se guardan dentro de `detalle` (jsonb) como una lista simple, sin estado propio por viajero — el `estado_proveedor`, el pago y los recordatorios aplican a la reserva completa, no a cada viajero. Debe existir un **contacto principal del viaje** (puede no tener cuenta — ver D-01). Si más adelante hace falta separar a un viajero en su propia reserva, se crea una reserva nueva — **el diseño debe hacer ese split barato** (instrucción explícita del usuario), no forzar una migración de datos compleja.
- **D-04:** Datos del viajero/contacto principal cuando no tiene cuenta ni correo: nombre + teléfono (mínimo para poder contactarlo si hace falta). No se pide documento de identidad en el MVP.

**Campos por tipo de reserva (contenido de `detalle` jsonb)**
- **D-05:** Pasaje: aerolínea + origen/destino + fecha de vuelo + número de reserva/PNR de la aerolínea como campo propio (no solo en notas libres).
- **D-06:** Hotel/tour/entrada: nombre del servicio + fecha(s) + un campo de nota libre. Hotel → nombre + check-in/check-out. Tour → nombre + fecha. Entrada → evento + fecha. No se diseñan formularios rígidos con campos estructurados distintos por cada variante — la nota libre cubre casos específicos.
- **D-07:** `fecha_importante` es **opcional** al crear cualquier reserva.

**Lista de reservas**
- **D-08:** Columnas visibles: cliente (pagador/contacto principal) + tipo + fecha importante + estado proveedor + estado pago + monto.
- **D-09:** El monto en la lista se muestra **en USD**. Cuando la reserva está en VES (raro), no se inventa una conversión en la columna de la lista — el admin ve el monto en VES abriendo el detalle. **Esta interpretación no fue confirmada palabra por palabra por el usuario.**
- **D-10:** Búsqueda/filtro: por nombre de cliente (texto libre) + filtro por estado (proveedor) + filtro por tipo. Sin filtro de rango de fechas en el MVP.
- **D-11:** Orden por defecto: más reciente creada primero.

### Claude's Discretion
- Estado "con problema" (`nota_problema`, cuándo se marca, si la nota es obligatoria, quién la quita): `nota_problema` obligatoria al marcar `estado_proveedor = 'con_problema'`, cualquier admin (solo hay uno) puede quitar el estado editando la reserva.
- Detalles de UI/diseño visual del formulario y la lista: ya resueltos en `02-UI-SPEC.md` (aprobado) — este documento de investigación complementa ese contrato, no lo reemplaza.
- Estructura técnica exacta de la migración nueva (nombres de columnas, si `detalle` guarda el contacto principal o si se promueve a columnas propias): sin opinión del usuario — este documento propone un diseño concreto abajo (ver "Architecture Patterns → Migración nueva"), pero es **[ASSUMED]**, no verificado contra ninguna fuente externa, por ser una decisión de diseño greenfield de este proyecto.

### Deferred Ideas (OUT OF SCOPE)
Ninguna — la conversación se mantuvo dentro del alcance de la fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESA-01 | El admin puede crear una reserva (tipo, cliente, detalles, precio, moneda) | Migración nueva (pagador/viajero) + `lib/validation/reservas.ts` con `zod` discriminated union por `tipo` + Server Action `crearReserva` siguiendo el patrón exacto de `app/login/actions.ts` + `esquemaLogin` ya en el repo. |
| RESA-02 | El admin puede editar una reserva existente | Mismo esquema `zod` reutilizado para editar; Server Action `editarReserva` que hace `update` en vez de `insert`; formulario precargado (`defaultValues` desde la fila existente). |
| RESA-03 | El admin puede ver la lista de todas las reservas con su estado | Server Component que consulta `reservas` con paginación (`range`), búsqueda (`ilike` sobre `pagador_nombre`), filtros (`eq` tipo/estado) y orden `created_at desc` (D-11); estado de pago derivado con una segunda consulta liviana sobre `pagos` (ver Architecture Patterns). |
| RESA-04 | El admin puede marcar una reserva como "confirmada con el proveedor", independiente del pago | Ya soportado por el esquema existente (`reservas.estado_proveedor` es una columna independiente de `pagos`, sin relación funcional entre ambas) — Fase 2 solo necesita el control de UI (radio-group, ya en `02-UI-SPEC.md`) y la Server Action que hace `update estado_proveedor` (+ `nota_problema` si aplica). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Stack está fijo: Next.js 16 (App Router) + Supabase + Vercel. Ningún backend separado.
- Usar `@supabase/ssr` (ya integrado en Fase 1) — nunca `@supabase/auth-helpers-nextjs`.
- `react-hook-form` + `zod` + `@hookform/resolvers` ya son el patrón establecido (Fase 1, `lib/validation/auth.ts`) — un solo esquema compartido entre cliente y servidor; esta fase debe seguir el mismo patrón para reservas, no inventar uno nuevo.
- `shadcn/ui` es la librería de componentes fijada por el stack del proyecto, todavía no inicializada — esta fase la inicializa (ya prescrito en `02-UI-SPEC.md`, con tokens de marca `#482583` y radio Apple-pill).
- Mobile-first (la mayoría de clientes usan celular) — ya cubierto por `02-UI-SPEC.md`.
- Un solo admin, sin RBAC — `requireAdmin()` ya existe en `lib/auth/require-admin.ts` y debe reusarse literalmente en cada nueva página/Server Action de reservas (no reimplementar la comprobación de sesión).
- RLS habilitada en la misma migración que crea/modifica cada tabla — nunca "después" (Pitfall 5 de Fase 1, sigue vigente para la migración nueva de esta fase).

## Summary

Esta fase no introduce ningún paquete npm nuevo: los mismos `next@16.3.6`, `@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.117.2`, `react-hook-form@7.89.0`, `zod@4.6.5` y `@hookform/resolvers@5.9.1` que Fase 1 ya instaló y verificó siguen siendo la versión vigente en el registro de npm hoy [VERIFIED: npm registry, `npm view <pkg> version`, 2026-09-28] — el único trabajo de "stack" de esta fase es ejecutar el comando de instalación de shadcn/ui que `02-UI-SPEC.md` ya prescribió (`npx shadcn@latest init` + `npm install lucide-react` + `npx shadcn add <componentes>`), que este documento confirma sigue siendo el registro correcto (leído directamente el JSON del registro oficial, ver Architecture Patterns).

El trabajo real de esta fase tiene dos partes claramente separables: (1) una **migración nueva** de Postgres que reforma `public.reservas` para permitir crear una reserva sin que el pagador tenga cuenta (D-01 a D-04) — se detalla abajo con nombres de columna concretos, marcados `[ASSUMED]` porque es una decisión de diseño greenfield delegada a discreción de Claude — y (2) el mismo patrón de formulario Server Action + `zod` + `react-hook-form` que Fase 1 ya estableció con el login, ahora aplicado a un formulario polimórfico (`detalle` cambia de forma según `tipo`), usando `zod`'s `discriminatedUnion` como la pieza central de validación tanto en cliente como en servidor.

Se encontraron dos vacíos genuinos entre `02-CONTEXT.md`/`02-UI-SPEC.md` y lo que hace falta construir, documentados en detalle en Assumptions Log y Pitfalls: (a) D-03 pide guardar una "lista simple de nombres de viajeros" en `detalle` jsonb, pero la tabla de campos de `02-UI-SPEC.md` (explícitamente "no exhaustiva") no incluye un control de UI para ese campo — se recomienda agregarlo como campo opcional adicional; y (b) el constraint existente `reservas.precio numeric(12,2) not null check (precio >= 0)` [VERIFIED: `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:39`, `precio numeric(12, 2) not null check (precio >= 0)`] permite `0`, mientras que el copy de error de `02-UI-SPEC.md` dice "El precio tiene que ser mayor a cero" [VERIFIED: `.planning/phases/02-gesti-n-de-reservas-admin/02-UI-SPEC.md:184`, `"El precio tiene que ser mayor a cero."`] — se recomienda que la validación `zod` (no la constraint de base de datos, que Fase 1 ya aplicó) sea la que exija `> 0`.

**Primary recommendation:** Escribir una migración nueva (timestamp generado con `supabase migration new`, nunca copiado a mano de este documento) que (1) hace `cliente_id` nullable en vez de reemplazarlo, (2) agrega columnas `pagador_nombre`/`pagador_telefono`/`pagador_email` (contacto directo, sin depender de una cuenta) y `viajero_nombre`/`viajero_telefono` (solo si distinto del pagador), y (3) agrega un constraint que exige `nota_problema` cuando `estado_proveedor = 'con_problema'`; después construir el formulario de crear/editar reserva con `zod.discriminatedUnion("tipo", […])` + `react-hook-form` + el componente `Form` oficial de shadcn/ui (confirmado vigente, no reemplazado por el patrón `Field` más nuevo de shadcn — ver Architecture Patterns), siguiendo literalmente el patrón `useActionState` + Server Action `safeParse` que ya existe en `app/login/actions.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Captura de contacto pagador/viajero sin cuenta | Database / Storage (columnas nuevas, nullable `cliente_id`) | Frontend Server (formulario) | El dato vive en la fila de `reservas` misma, no en `profiles` — no depende de que exista una cuenta (D-01). |
| Validación de campos por tipo de reserva (`detalle`) | Frontend Server (Server Action, `zod.safeParse`) | Browser / Client (`zodResolver`, feedback instantáneo) | La validación real y confiable es server-side (un envío sin JS puede saltarse el cliente) — el cliente solo da UX rápida, igual que el patrón ya establecido en `app/login/actions.ts`. |
| Autorización de creación/edición/lista de reservas | Database / Storage (RLS `private.is_admin()`) | Frontend Server (`requireAdmin()` como UX/second gate) | Mismo patrón que Fase 1: RLS es el límite real, `requireAdmin()` es el redirect rápido — nunca al revés. |
| Estado proveedor (RESA-04) | Database / Storage (`reservas.estado_proveedor`) | Frontend Server (radio-group + Server Action) | Columna ya existe y ya es independiente de `pagos` — Fase 2 solo agrega la UI/Action, no cambia el esquema de este campo. |
| Estado de pago mostrado en la lista (D-08) | Database / Storage (lectura de `pagos`, tabla de Fase 1) | Frontend Server (consulta derivada) | `pagos` ya existe y tiene RLS; Fase 2 solo lee (nunca escribe pagos — eso es Fase 4), así que la responsabilidad de "verdad" del pago sigue siendo la tabla `pagos`. |
| Lista con búsqueda/filtro/paginación | Frontend Server (Server Component, consulta a Supabase) | Browser / Client (controles de filtro, sin JS de cliente pesado) | Sin API pública ni cliente SPA — el propio Server Component de Next.js hace la consulta filtrada, coherente con "sin backend separado" del stack. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.3.6 [VERIFIED: npm registry, `npm view next version`, 2026-09-28 — sin cambio desde Fase 1] | App Router, Server Actions | Ya instalado; ninguna razón para tocarlo esta fase. |
| `@supabase/supabase-js` | 2.117.2 [VERIFIED: npm registry] | Cliente Supabase | Ya instalado. |
| `@supabase/ssr` | 0.12.7 [VERIFIED: npm registry] | Sesión cookie-based | Ya instalado; `lib/supabase/server.ts` no necesita cambios para esta fase. |
| `react-hook-form` | 7.89.0 [VERIFIED: npm registry] | Estado de formulario | Ya instalado; mismo patrón que `app/login/login-form.tsx` (`useForm` + `zodResolver` + `useActionState`). |
| `zod` | 4.6.5 [VERIFIED: npm registry] | Validación de esquema | Ya instalado; esta fase usa `z.discriminatedUnion` por primera vez en el proyecto (campo `detalle` polimórfico por `tipo`) — API estable en Zod 4, sin paquete adicional. |
| `@hookform/resolvers` | 5.9.1 [VERIFIED: npm registry] | Conecta zod↔react-hook-form | Ya instalado. |
| `shadcn` (CLI) | 4.21.0 [VERIFIED: npm registry, `npm view shadcn version`, 2026-09-28] | Genera componentes UI en el repo | Prescrito en `02-UI-SPEC.md`; instalación pendiente de ejecutar esta fase (no antes). |
| `lucide-react` | 1.48.0 [VERIFIED: npm registry, `npm view lucide-react version`, 2026-09-28] | Iconos (default de shadcn) | Requerido por `02-UI-SPEC.md`. |

### Supporting

Ninguna librería nueva más allá de las ya fijadas en `research/STACK.md` y `.claude/CLAUDE.md` — Fase 2 es, en términos de dependencias, una fase de "usar lo que ya está instalado", no de agregar paquetes.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zod.discriminatedUnion` por `tipo` para `detalle` | Un solo esquema `zod.object` con todos los campos opcionales de los 4 tipos | El discriminated union da errores específicos por tipo ("falta el PNR" solo aparece si `tipo === 'pasaje'`) y hace imposible enviar campos de otro tipo por error; un objeto con todo opcional permitiría enviar `pnr` en una reserva de hotel sin que nada lo impida. |
| Columnas nuevas en `reservas` para pagador/viajero (D-01 a D-04) | Extender `detalle` jsonb con `pagador`/`viajero` anidados, sin columnas nuevas | D-08 exige mostrar "cliente (pagador)" y D-10 exige buscar por nombre de cliente en la lista — buscar/filtrar/ordenar contra un campo jsonb anidado es posible con `->>'`, pero columnas de texto reales son más simples de indexar (`ilike` + índice `pg_trgm` si hiciera falta después) y de leer para cualquier mantenedor no técnico que abra la tabla en el dashboard de Supabase. |
| Segunda consulta a `pagos` para derivar "estado pago" en la lista (D-08) | Una vista Postgres (`reservas_con_estado_pago`) que haga el join | A 10-15 reservas/semana, una segunda consulta simple desde el Server Component es más fácil de razonar y de depurar para un mantenedor no técnico que una vista + regenerar tipos + mantener su RLS (`security_invoker`) sincronizada; revisar la vista si el volumen crece (ver `research/STACK.md` → Stack Patterns by Variant, mismo criterio ya aplicado ahí a otras decisiones). |

**Installation:**
```bash
npx shadcn@latest init --template next --base radix --css-variables --no-monorepo
npm install lucide-react
npx shadcn add button input label textarea select checkbox radio-group form table card badge skeleton alert sonner separator
```
(Comando exacto ya prescrito en `02-UI-SPEC.md` → "Comando de instalación"; repetido aquí solo por completitud del Standard Stack.)

**Version verification:** Todas las versiones de esta tabla se confirmaron en vivo contra el registro de npm el 2026-09-28 (mismo día de esta investigación). Como `next`, `zod` y los paquetes de shadcn/lucide publican seguido, re-verificar con `npm view <pkg> version` si pasan más de un par de días antes de ejecutar el plan.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|--------------|---------|-------------|
| `shadcn` (CLI) | npm | 2026-09-04 | 11.4M | github.com/shadcn-ui/ui | SUS (`too-new`) | **Approved** — false positive (ver nota) |
| `lucide-react` | npm | 2026-09-24 | 121.5M | github.com/lucide-icons/lucide | SUS (`too-new`) | **Approved** — false positivo (ver nota) |

**Note on the `too-new` verdicts:** igual que en `01-RESEARCH.md`, el gate de legitimidad marca `too-new` por la fecha de publicación de la última versión, no por la edad real del paquete — ambos tienen repositorio oficial en GitHub, decenas a cientos de millones de descargas semanales, y ningún script `postinstall`. Es el perfil opuesto a un paquete slopsquat. **Disposición: aprobados sin `checkpoint:human-verify`** — no se requiere gate adicional para instalarlos.

Ninguna otra librería nueva entra en esta fase (todo lo demás ya fue auditado en `01-RESEARCH.md` y sigue instalado sin cambios).

**Packages removed due to [SLOP] verdict:** ninguno.
**Packages flagged as suspicious [SUS]:** `shadcn`, `lucide-react` — ambos revisados manualmente y aprobados (falso positivo de "recién publicado"); no requieren `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│  Browser (admin, mobile-first)                                       │
│  /admin              → lista de reservas (tabla/tarjetas, filtros)   │
│  /admin/reservas/nueva        → formulario crear                     │
│  /admin/reservas/[id]/editar  → formulario editar (+ estado proveedor)│
└───────────────┬───────────────────────────────────────────────────┘
                │ cada request pasa por requireAdmin() (ya existe, Fase 1)
                ▼
┌───────────────────────────────────────────────────────────────────┐
│  Server Components (lectura)                                         │
│  app/admin/page.tsx → lista: reservas.select(...).ilike/eq/range      │
│    + 2ª consulta liviana a pagos (estado pago derivado, ver abajo)    │
│  app/admin/reservas/[id]/editar/page.tsx → reserva.select().single()  │
└───────────────┬───────────────────────────────────────────────────┘
                ▼
┌───────────────────────────────────────────────────────────────────┐
│  Server Actions (escritura) — app/admin/reservas/actions.ts           │
│  crearReserva(prevState, formData)                                   │
│    1. requireAdmin()                                                 │
│    2. esquemaReserva.safeParse(...)  (zod.discriminatedUnion)        │
│    3. supabase.from('reservas').insert({...})                        │
│  editarReserva(id, prevState, formData) → mismo esquema, .update()   │
│  marcarEstadoProveedor(id, prevState, formData) → esquema más chico  │
└───────────────┬───────────────────────────────────────────────────┘
                ▼
┌───────────────────────────────────────────────────────────────────┐
│  Supabase Postgres                                                    │
│  public.reservas (esquema Fase 1 + migración nueva de esta fase:      │
│    cliente_id ahora nullable; + pagador_nombre/telefono/email;        │
│    + viajero_nombre/telefono; detalle jsonb sin cambio de forma)      │
│  RLS: "reservas: el admin gestiona todas" (ya existe, sin cambios)    │
│  public.pagos — Fase 2 SOLO LEE (nunca escribe; Fase 4 la gestiona)   │
└───────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (esta fase agrega esto sobre lo existente)

```
app/
├── admin/
│   ├── page.tsx                       # REEMPLAZA el placeholder — lista de reservas
│   ├── actions.ts                     # ya existe (cerrarSesion) — sin cambios
│   └── reservas/
│       ├── nueva/
│       │   └── page.tsx               # formulario crear
│       ├── [id]/
│       │   └── editar/
│       │       └── page.tsx           # formulario editar + estado proveedor
│       ├── reserva-form.tsx           # Client Component compartido crear/editar
│       ├── lista-reservas.tsx         # Server/Client split: tabla (≥640px) / tarjetas (<640px)
│       └── actions.ts                 # crearReserva, editarReserva, marcarEstadoProveedor
lib/
└── validation/
    └── reservas.ts                    # esquemaDetallePasaje/Hotel/Tour/Entrada + esquemaReserva + esquemaEstadoProveedor
supabase/
└── migrations/
    └── <timestamp-generado>_pagador_viajero_reservas.sql   # ver abajo
```

### Pattern 1: Migración nueva — pagador/viajero sin romper lo ya aplicado

**What:** `reservas.cliente_id` hoy es `not null references public.profiles (id) on delete restrict` [VERIFIED: `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:36`, `cliente_id uuid not null references public.profiles (id) on delete restrict`]. D-01 exige poder crear una reserva sin que el pagador tenga cuenta. `02-CONTEXT.md` mismo sugiere la salida: "o hacerla nullable + vincular después" — esta es la opción recomendada aquí, porque cambia menos superficie (RLS, tests, fixtures) que eliminar la columna.

**When to use:** Migración nueva de esta fase, con timestamp posterior a `20260927000004` — **generarlo con `npx supabase migration new pagador_viajero_reservas`** en el momento de ejecutar el plan, no copiar una fecha fija de este documento (la fecha de investigación puede no coincidir con la fecha real de ejecución).

**[ASSUMED — diseño greenfield de este proyecto, no verificado contra ninguna fuente externa; delegado a discreción de Claude por `02-CONTEXT.md`]:**
```sql
-- supabase/migrations/<timestamp>_pagador_viajero_reservas.sql

-- D-01: el pagador puede no tener cuenta. cliente_id pasa a ser opcional —
-- se mantiene como vínculo A una cuenta existente (para cuando Fase 3 exista
-- y el pagador sí tenga login), pero deja de ser obligatorio para crear una
-- reserva. Hoy (2026-09-28) el negocio no tiene ninguna cuenta de cliente
-- creada todavía (PROJECT.md → Key Decisions), así que en la práctica esta
-- columna queda en NULL para toda reserva creada en esta fase.
alter table public.reservas
  alter column cliente_id drop not null;

comment on column public.reservas.cliente_id is
  'Cuenta de cliente vinculada a esta reserva, si el pagador tiene una (opcional desde la migración de Fase 2 — D-01). NULL es el caso normal en el MVP: hoy no existen cuentas de cliente. Los datos de contacto reales del pagador SIEMPRE viven en pagador_nombre/pagador_telefono/pagador_email, con o sin cuenta vinculada.';

-- D-01/D-04: contacto directo del pagador, sin depender de una cuenta.
-- SIEMPRE se llenan, tenga o no cuenta el pagador (denormalizado a propósito
-- para que la lista y el detalle nunca necesiten un join con profiles).
alter table public.reservas
  add column pagador_nombre text,
  add column pagador_telefono text,
  add column pagador_email text;

-- D-02/D-04: viajero solo se llena cuando es distinto del pagador (checkbox
-- "Es para otra persona"). NULL en ambas columnas significa "el viajero es
-- el pagador" — no se duplica el nombre del pagador cuando coinciden.
alter table public.reservas
  add column viajero_nombre text,
  add column viajero_telefono text;

-- La tabla no tiene filas reales todavía (Fase 1 dejó /admin con un
-- placeholder, sin UI para crear reservas) — verificar con
-- `select count(*) from public.reservas` antes de aplicar el NOT NULL de
-- abajo. Si por algún motivo ya hay filas (ej. datos de prueba no barridos),
-- hace falta un UPDATE de backfill antes de este paso, o el ALTER falla.
alter table public.reservas
  alter column pagador_nombre set not null,
  alter column pagador_telefono set not null;

alter table public.reservas
  add constraint reservas_pagador_nombre_no_vacio check (btrim(pagador_nombre) <> ''),
  add constraint reservas_pagador_telefono_no_vacio check (btrim(pagador_telefono) <> '');

-- Discreción de Claude ya registrada en 02-CONTEXT.md: nota_problema es
-- obligatoria cuando estado_proveedor = 'con_problema'. La UI ya lo valida
-- (02-UI-SPEC.md), pero un constraint de base de datos es la misma disciplina
-- de "defensa en profundidad" que ya usa este proyecto (ver
-- 20260927000004_pagos_tasa_cambio_solo_en_bs.sql, agregado tras un code
-- review de Fase 1 por la misma razón: un invariante de negocio que solo
-- vivía en la UI/lógica de app no se cumplía siempre).
alter table public.reservas
  add constraint reservas_nota_problema_si_con_problema
    check (estado_proveedor <> 'con_problema' or nota_problema is not null);
```

No hace falta tocar ninguna política RLS ni ningún GRANT: `"reservas: el admin gestiona todas"` ya usa `private.is_admin()` para todas las operaciones (sin importar qué columnas cambien), y `"reservas: el cliente ve las suyas"` sigue siendo correcta con `cliente_id` nullable — una fila con `cliente_id is null` nunca puede igualar `auth.uid()` de ningún cliente, así que sigue siendo invisible para cualquier cuenta cliente, que es exactamente el comportamiento esperado (nadie tiene cuenta todavía para esas reservas). [VERIFIED: `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:67-78`, políticas `"reservas: el cliente ve las suyas"` y `"reservas: el admin gestiona todas"` leídas verbatim]

**Trade-offs:** Ninguna reescritura de tabla grande (la tabla está vacía o casi vacía); el costo es solo el de correr `npm run db:types` después para regenerar `lib/database.types.ts` (ver Pitfall 2) y actualizar `tests/helpers/fixtures.ts::createReservaFixture` (ver Pitfall 3), que hoy inserta en `reservas` sin `pagador_nombre`/`pagador_telefono` [VERIFIED: `tests/helpers/fixtures.ts:144-152`, el `insert` de `createReservaFixture` solo pasa `cliente_id, tipo, precio, moneda, created_by`] y dejaría de compilar/insertar en cuanto esas columnas sean `NOT NULL`.

### Pattern 2: `zod.discriminatedUnion` para el campo `detalle` polimórfico

**What:** `reservas.detalle` es `jsonb not null default '{}'::jsonb` [VERIFIED: `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:38`, `detalle jsonb not null default '{}'::jsonb`], sin ninguna forma fija a nivel de base de datos — la forma depende de `tipo` (D-05/D-06). El patrón estándar de Postgres para esto es un modelo híbrido: columnas reales para lo común (`tipo`, `precio`, `moneda`…) y jsonb solo para lo variable [CITED: hallazgo cruzado de varias fuentes sobre diseño jsonb polimórfico en Postgres — confianza LOW/websearch, ver Sources], que es exactamente lo que este esquema ya hace desde Fase 1 — esta fase no cambia esa forma, solo la valida.

**When to use:** `lib/validation/reservas.ts`, para el formulario de crear/editar y para el `safeParse` server-side.

```ts
// lib/validation/reservas.ts
import { z } from "zod";

const detallePasaje = z.object({
  tipo: z.literal("pasaje"),
  aerolinea: z.string().trim().min(1, { message: "Escribe la aerolínea." }),
  origen: z.string().trim().min(1, { message: "Escribe el origen." }),
  destino: z.string().trim().min(1, { message: "Escribe el destino." }),
  fechaVuelo: z.string().trim().min(1, { message: "Escribe la fecha de vuelo." }),
  pnr: z.string().trim().min(1, {
    // Copy verbatim — 02-UI-SPEC.md:183
    message: "Falta el número de reserva de la aerolínea (PNR). Anótalo tal como te lo dio la aerolínea.",
  }),
});

const detalleHotel = z.object({
  tipo: z.literal("hotel"),
  nombre: z.string().trim().min(1, { message: "Escribe el nombre del hotel." }),
  checkIn: z.string().trim().min(1, { message: "Escribe la fecha de check-in." }),
  checkOut: z.string().trim().min(1, { message: "Escribe la fecha de check-out." }),
  nota: z.string().trim().optional(),
});

const detalleTour = z.object({
  tipo: z.literal("tour"),
  nombre: z.string().trim().min(1, { message: "Escribe el nombre del tour." }),
  fecha: z.string().trim().min(1, { message: "Escribe la fecha del tour." }),
  nota: z.string().trim().optional(),
});

const detalleEntrada = z.object({
  tipo: z.literal("entrada"),
  evento: z.string().trim().min(1, { message: "Escribe el nombre del evento." }),
  fecha: z.string().trim().min(1, { message: "Escribe la fecha del evento." }),
  nota: z.string().trim().optional(),
});

export const esquemaDetalle = z.discriminatedUnion("tipo", [
  detallePasaje,
  detalleHotel,
  detalleTour,
  detalleEntrada,
]);

export const esquemaReserva = z
  .object({
    pagadorNombre: z.string().trim().min(1, { message: "Escribe el nombre de quien paga." }),
    pagadorTelefono: z.string().trim().min(1, { message: "Escribe un teléfono de contacto." }),
    pagadorEmail: z
      .string()
      .trim()
      .email({ message: "Escribe un correo válido." })
      .optional()
      .or(z.literal("")),
    esParaOtraPersona: z.boolean().default(false),
    viajeroNombre: z.string().trim().optional(),
    viajeroTelefono: z.string().trim().optional(),
    // Copy verbatim — 02-UI-SPEC.md:184: "> 0", no ">= 0" — la constraint de
    // base de datos (Fase 1) es más permisiva (precio >= 0); zod es el lugar
    // donde se aplica la regla real de negocio, sin tocar la constraint ya
    // aplicada (ver Pitfall 4).
    precio: z.coerce.number().positive({ message: "El precio tiene que ser mayor a cero." }),
    moneda: z.enum(["USD", "VES"]),
    fechaImportante: z.string().trim().optional().or(z.literal("")),
    detalle: esquemaDetalle,
  })
  .refine((data) => !data.esParaOtraPersona || Boolean(data.viajeroNombre?.length), {
    message: "Escribe el nombre del viajero.",
    path: ["viajeroNombre"],
  });

export type DatosReserva = z.infer<typeof esquemaReserva>;

export const esquemaEstadoProveedor = z
  .object({
    estadoProveedor: z.enum(["pendiente", "confirmada", "con_problema"]),
    notaProblema: z.string().trim().optional(),
  })
  .refine((data) => data.estadoProveedor !== "con_problema" || Boolean(data.notaProblema), {
    // Copy verbatim — 02-UI-SPEC.md:185
    message:
      "Para marcar la reserva como 'con problema' hace falta explicar qué pasó, así no se te olvida el detalle después.",
    path: ["notaProblema"],
  });
```
[VERIFIED for the copy strings: `.planning/phases/02-gesti-n-de-reservas-admin/02-UI-SPEC.md:183-185`, quoted verbatim above. Schema shape/field names: `[ASSUMED]` — greenfield design, not verified against any existing source.]

### Pattern 3: Server Action con `useActionState`, mismo molde que `app/login/actions.ts`

**What:** El proyecto ya tiene un patrón probado (login, Fase 1) para Server Action + `react-hook-form` + `zod` + `useActionState`: validar en cliente con `zodResolver` para feedback instantáneo, y volver a validar en servidor con `schema.safeParse(...)` porque un envío sin JavaScript puede saltarse el cliente [CITED: patrón cross-checked contra múltiples guías 2026 de Next.js Server Actions + react-hook-form + zod — confianza LOW/websearch, ver Sources — pero además **ya implementado y probado en este mismo repo**, lo que sube la confianza práctica de reusarlo literalmente].

**When to use:** `app/admin/reservas/actions.ts`, para `crearReserva`, `editarReserva`, `marcarEstadoProveedor`. Reproducir exactamente la forma de `app/login/actions.ts`:

```ts
// app/admin/reservas/actions.ts (forma, no contenido final)
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { esquemaReserva } from "@/lib/validation/reservas";

export type EstadoReserva = {
  error?: string;
  errores?: Record<string, string | undefined>;
};

export async function crearReserva(
  _previo: EstadoReserva,
  formData: FormData,
): Promise<EstadoReserva> {
  await requireAdmin(); // mismo patrón que cerrarSesion() en app/admin/actions.ts

  const resultado = esquemaReserva.safeParse(/* mapear formData → forma esperada */);
  if (!resultado.success) {
    return { errores: resultado.error.flatten().fieldErrors as Record<string, string> };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("reservas").insert({
    pagador_nombre: resultado.data.pagadorNombre,
    pagador_telefono: resultado.data.pagadorTelefono,
    pagador_email: resultado.data.pagadorEmail || null,
    viajero_nombre: resultado.data.esParaOtraPersona ? resultado.data.viajeroNombre : null,
    viajero_telefono: resultado.data.esParaOtraPersona ? resultado.data.viajeroTelefono : null,
    tipo: resultado.data.detalle.tipo,
    detalle: resultado.data.detalle,
    precio: resultado.data.precio,
    moneda: resultado.data.moneda,
    fecha_importante: resultado.data.fechaImportante || null,
  });

  if (error) {
    console.error("Error al crear la reserva:", error);
    // Copy verbatim — 02-UI-SPEC.md:182
    return { error: "No se guardó la reserva. Revisa tu conexión e inténtalo de nuevo." };
  }

  redirect("/admin");
}
```
[VERIFIED for `requireAdmin()` call placement and error-shape convention: pattern read verbatim from `app/admin/actions.ts` and `app/login/actions.ts` this session. Field-mapping body: `[ASSUMED]`, illustrative — the executor fills in the exact `formData.get(...)` extraction.]

### Pattern 4: `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` de shadcn/ui — vigente, no reemplazado

**What:** `02-UI-SPEC.md` prescribe el componente `form` de shadcn como "Envoltorio oficial de shadcn sobre react-hook-form" [VERIFIED: `.planning/phases/02-gesti-n-de-reservas-admin/02-UI-SPEC.md:97`]. Se confirmó **leyendo directamente el JSON del registro oficial en vivo** (`https://ui.shadcn.com/r/styles/new-york-v4/form.json`, fetched 2026-09-28) que `npx shadcn add form` sigue instalando la API clásica — `Form = FormProvider`, `FormField` (envuelve `Controller` de react-hook-form), `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage` — sin cambios de forma respecto a lo que `02-UI-SPEC.md` asumió. shadcn también documenta un patrón más nuevo y aditivo (`Field`/`FieldLabel`/`FieldError` + `Controller` manual) en otras páginas de su sitio, pero **no reemplaza** al componente `form` clásico — ambos coexisten en el registro actual.

```tsx
// Fuente: https://ui.shadcn.com/r/styles/new-york-v4/form.json — leído verbatim 2026-09-28
"use client"
// ... (Form = FormProvider; FormField envuelve <Controller>; FormControl usa
// <Slot.Root> para pasar aria-invalid/aria-describedby automáticamente)
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
}
```
[VERIFIED: `ui.shadcn.com/r/styles/new-york-v4/form.json`, leído verbatim 2026-09-28 — confirma que la elección de `02-UI-SPEC.md` sigue siendo instalable tal cual con el comando ya prescrito, sin necesidad de migrar al patrón `Field` más nuevo para esta fase.]

**When to use:** todo campo de `reserva-form.tsx` se envuelve en `FormField name="..." control={form.control} render={({field}) => (<FormItem><FormLabel/><FormControl>{...}</FormControl><FormMessage/></FormItem>)}` — patrón estándar, sin necesidad de reinventar el wiring de accesibilidad (`aria-invalid`, `aria-describedby`, `htmlFor`) que el componente ya resuelve.

### Pattern 5: Lista con paginación/filtro/orden + "estado pago" derivado sin vista

**What:** D-08/D-10/D-11 piden búsqueda por nombre, filtro por estado y tipo, orden por creación descendente, y una columna de estado de pago que no existe como columna directa en `reservas` (vive en `pagos`, tabla ya construida en Fase 1). A este volumen (~10-15 reservas/semana), dos consultas simples desde el Server Component son más fáciles de mantener que una vista Postgres.

```ts
// app/admin/page.tsx (forma, ilustrativa)
const PAGE_SIZE = 20; // 02-UI-SPEC.md: "Tamaño de página [Confirmado]: 20 reservas por página"

const { data: reservas, count } = await supabase
  .from("reservas")
  .select("*", { count: "exact" })
  .ilike("pagador_nombre", `%${busqueda}%`) // solo si hay término de búsqueda (D-10)
  .eq(/* tipo si hay filtro */)
  .eq(/* estado_proveedor si hay filtro */)
  .order("created_at", { ascending: false }) // D-11
  .range(offset, offset + PAGE_SIZE - 1);

const reservaIds = (reservas ?? []).map((r) => r.id);
const { data: pagosConfirmados } = await supabase
  .from("pagos")
  .select("reserva_id")
  .eq("estado", "confirmado")
  .in("reserva_id", reservaIds);

const idsPagados = new Set((pagosConfirmados ?? []).map((p) => p.reserva_id));
// estado pago por fila: idsPagados.has(reserva.id) ? "Pagado" : "Pendiente"
```
[ASSUMED — regla de negocio de "estado pago" (¿cuenta como pagado cualquier pago confirmado, o solo si la suma cubre el precio total?) no está especificada en `02-CONTEXT.md` ni en `02-UI-SPEC.md` más allá del nombre de la columna (D-08). Se propone la regla más simple — existe al menos un pago con `estado = 'confirmado'` — porque el seguimiento de pagos parciales es explícitamente alcance de Fase 4 (PAGO-04). Ver Assumptions Log A2.]

### Anti-Patterns to Avoid

- **Reemplazar `cliente_id` en vez de hacerlo nullable:** cambia más políticas RLS, tests y fixtures de los necesarios; D-01 mismo sugiere la ruta nullable + vincular después.
- **Confiar en un solo esquema `zod.object` con todos los campos opcionales para `detalle`:** permite que un formulario de "hotel" envíe silenciosamente un `pnr`, y no da errores específicos por tipo — usar `discriminatedUnion` (Pattern 2).
- **Server Action sin `requireAdmin()` al inicio:** mismo anti-patrón ya documentado en `01-RESEARCH.md` — el proxy/layout es UX, RLS es el límite real, pero cada Server Action debe llamar `requireAdmin()` explícitamente igual que `cerrarSesion()` en `app/admin/actions.ts`.
- **Olvidar regenerar `lib/database.types.ts` tras la migración nueva:** ver Pitfall 2 — el `insert`/`update` a `reservas` compilará contra tipos desactualizados y puede enmascarar errores hasta runtime.
- **Copiar el timestamp de migración de este documento:** generar con `supabase migration new` en el momento real de ejecución, no con la fecha de esta investigación (ver Pitfall 5).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Validación de formulario polimórfico | `if/else` manual por `tipo` con mensajes de error hechos a mano | `zod.discriminatedUnion` | Ya es el patrón establecido del proyecto (`zod` en Fase 1); el discriminated union da narrowing de tipos gratis en TypeScript y errores por campo automáticamente mapeables a `FormMessage`. |
| Wiring de accesibilidad de formulario (`aria-invalid`, `aria-describedby`, `htmlFor`) | Atributos ARIA a mano en cada campo | `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` de shadcn (Pattern 4) | Ya resuelto por el componente oficial, verificado vigente esta sesión — reimplementarlo a mano es trabajo duplicado con más superficie de error. |
| Paginación/orden/filtro de la lista | Lógica de paginación manual sobre un `select *` sin `range()` | `supabase-js` `.range()` + `.order()` + `.ilike()`/`.eq()` encadenados | La API de Supabase ya traduce esto a `LIMIT`/`OFFSET`/`ORDER BY`/`WHERE` eficiente; no hace falta traer todas las reservas al servidor para paginar en memoria. |
| Derivar "estado pago" con una tabla o columna redundante en `reservas` | Una columna `reservas.estado_pago` actualizada manualmente en cada cambio de `pagos` | Consulta derivada en el momento de listar (Pattern 5) | Una columna redundante puede desincronizarse de `pagos` (la fuente real de verdad); a este volumen, calcularla en cada lectura es más simple y nunca queda "vieja". |

**Key insight:** cada "no reinventar" de esta tabla existe porque el proyecto ya tiene, en su propio código de Fase 1, la solución correcta un nivel más arriba — copiar ese patrón (Server Action + zod, RLS como límite real, componentes oficiales de shadcn) es más barato y más consistente que inventar una variante nueva solo para reservas.

## Runtime State Inventory

> Trigger: esta fase incluye una migración de Postgres que modifica una tabla ya aplicada en producción (Fase 1), agregando columnas `NOT NULL` — se audita qué estado en tiempo de ejecución podría verse afectado.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `public.reservas` no tiene filas reales de negocio — Fase 1 dejó `app/admin/page.tsx` con el placeholder "Todavía no hay reservas cargadas" [VERIFIED: `app/admin/page.tsx:11`, `<p className="text-gray-500">Todavía no hay reservas cargadas.</p>`], sin ninguna UI para crear una reserva hasta esta fase. Pueden existir filas transitorias `rt-test-` creadas por `tests/helpers/fixtures.ts::createReservaFixture` durante corridas de test, con un barrido automático a los 30 minutos [VERIFIED: `tests/helpers/fixtures.ts:252-254`, `sweepStaleTestUsers` — `const staleBefore = Date.now() - 30 * 60 * 1000;`]. | Verificar `select count(*) from public.reservas` antes de aplicar el `NOT NULL` de la migración nueva; si el resultado no es 0, agregar un paso de backfill antes del `ALTER ... SET NOT NULL` (ver Pattern 1). |
| Live service config | Ninguno — Supabase es el único servicio externo que guarda el esquema de `reservas`, y su configuración (migraciones) ya vive en git. | Ninguna acción. |
| OS-registered state | Ninguno — esta fase no registra nada a nivel de sistema operativo (no hay tareas programadas, procesos pm2, etc. relacionados con `reservas`). | Ninguna acción. |
| Secrets/env vars | Ninguno — la migración no introduce ni renombra ninguna variable de entorno o secreto. | Ninguna acción. |
| Build artifacts | `lib/database.types.ts` es generado por Supabase CLI a partir del esquema vivo [VERIFIED: `package.json` script `db:types`, `"supabase gen types typescript --linked > lib/database.types.ts"`] y quedará desactualizado en cuanto se aplique la migración nueva. | Correr `npm run db:types` inmediatamente después de aplicar la migración (`npm run db:push`), como parte de la misma tarea/commit — ver Pitfall 2. |

**Código existente que rompe si no se actualiza en la misma fase:** `tests/helpers/fixtures.ts::createReservaFixture` inserta hoy en `reservas` solo con `cliente_id, tipo, precio, moneda, created_by` [VERIFIED: `tests/helpers/fixtures.ts:144-152`] — sin `pagador_nombre`/`pagador_telefono`. En cuanto la migración nueva las vuelva `NOT NULL`, ese `insert` empieza a fallar y **toda** la suite de tests RLS existente (`tests/rls/aislamiento-clientes.test.ts`, `tests/rls/comprobantes.test.ts`, etc., que dependen de `createReservaFixture`) se rompe. Esto debe ser la primera tarea de Wave 0 de esta fase, no un efecto secundario descubierto tarde.

## Common Pitfalls

### Pitfall 1: `ALTER TABLE ... ADD COLUMN ... NOT NULL` bloquea/falla si hay filas
**What goes wrong:** Agregar una columna `NOT NULL` sin `DEFAULT` a una tabla con filas existentes falla directamente (violación de la constraint en las filas ya existentes); combinarla con un `DEFAULT` dinámico fuerza una reescritura completa de la tabla bajo un lock `ACCESS EXCLUSIVE` [CITED: cross-checked websearch sobre patrones de migración Postgres sin downtime — confianza LOW, ver Sources].
**Why it happens:** Es la forma más directa de escribir la migración, y funciona sin avisos si la tabla está vacía — el problema solo aparece si alguien la corre contra un ambiente con datos.
**How to avoid:** Verificar `select count(*) from public.reservas` antes de aplicar el `NOT NULL` (Runtime State Inventory); si hay filas, agregar nullable primero, hacer backfill, y solo entonces `SET NOT NULL`.
**Warning signs:** El `db:push` (`supabase db push --linked`) falla con `column "pagador_nombre" contains null values`.

### Pitfall 2: `lib/database.types.ts` desactualizado después de la migración
**What goes wrong:** El código nuevo hace `supabase.from('reservas').insert({ pagador_nombre: ... })`, pero si `lib/database.types.ts` no se regeneró, TypeScript no conoce esa columna — dependiendo de cómo esté tipado el cliente, esto puede compilar igual (tipos `any`/`never` silenciosos) y solo fallar en runtime contra la base de datos real.
**Why it happens:** La generación de tipos es un paso manual (`npm run db:types`), no automático al aplicar una migración.
**How to avoid:** Correr `npm run db:push` seguido de `npm run db:types` como un solo paso de la misma tarea que agrega la migración — nunca migrar sin regenerar tipos en el mismo commit.
**Warning signs:** Un campo nuevo de `reservas` no aparece con autocompletado/type-checking en el editor al escribir el `insert`/`update`.

### Pitfall 3: Fixtures de test rotos por las nuevas columnas `NOT NULL`
**What goes wrong:** `tests/helpers/fixtures.ts::createReservaFixture` deja de poder insertar una reserva de prueba en cuanto `pagador_nombre`/`pagador_telefono` sean `NOT NULL`, y cada test que dependa de esa fixture (varios de `tests/rls/`) empieza a fallar con un error de constraint, no con el error de RLS que en realidad está probando.
**Why it happens:** La fixture se escribió en Fase 1, antes de que existieran estas columnas.
**How to avoid:** Actualizar `createReservaFixture` para pasar `pagador_nombre`/`pagador_telefono` (valores de prueba simples, ej. `"Cliente de prueba"` / `"0000-0000000"`) en la misma tarea que aplica la migración — tratar esto como parte del "Wave 0" de esta fase, no como limpieza posterior.
**Warning signs:** Tests de `tests/rls/*.test.ts` que no tocan reservas directamente empiezan a fallar con `null value in column "pagador_nombre" violates not-null constraint`.

### Pitfall 4: Mezclar la constraint de base de datos (`precio >= 0`) con la regla de negocio (`precio > 0`)
**What goes wrong:** `reservas.precio` en base de datos permite `0` [VERIFIED: `supabase/migrations/20260927000002_reservas_pagos_recordatorios.sql:39`, `check (precio >= 0)`], pero `02-UI-SPEC.md` define el mensaje de error "El precio tiene que ser mayor a cero" [VERIFIED: `02-UI-SPEC.md:184`] — si el formulario solo confía en la constraint de base de datos, un precio de `0` se guardaría sin error, contradiciendo el copy ya aprobado.
**Why it happens:** Es fácil asumir que "la base de datos ya valida esto" cuando en realidad la constraint existente es más permisiva que la regla de UI/negocio de esta fase.
**How to avoid:** `zod` debe exigir `precio > 0` (`z.coerce.number().positive(...)`, ya en Pattern 2) independientemente de que la base de datos permita `>= 0` — no es necesario ni se recomienda tocar la constraint de Fase 1 para esto, ya que ninguna decisión de `02-CONTEXT.md` pide cambiarla.
**Warning signs:** Una reserva con `precio = 0` se guarda exitosamente a pesar del mensaje de error visible en el formulario.

### Pitfall 5: Copiar el timestamp de migración de este documento
**What goes wrong:** Este documento usa `<timestamp-generado>` como placeholder; si el ejecutor copia literalmente una fecha escrita durante la investigación (2026-09-28) en vez de generarla al momento real de ejecutar el plan, el archivo de migración puede terminar con un timestamp que no refleja cuándo se aplicó, o — peor — colisionar si ya existe otro archivo con ese mismo prefijo.
**Why it happens:** Es tentador copiar un ejemplo de código literal sin notar que el nombre de archivo es parte del "contenido" a generar, no a copiar.
**How to avoid:** Ejecutar `npx supabase migration new pagador_viajero_reservas` (o el nombre que el plan elija) y dejar que la CLI genere el timestamp real.
**Warning signs:** `supabase migration list --linked` muestra un archivo de migración con una fecha que no coincide con la fecha real en que se aplicó.

## Code Examples

Ver Architecture Patterns arriba — Pattern 1 (migración SQL), Pattern 2 (`lib/validation/reservas.ts`), Pattern 3 (forma de Server Action), Pattern 4 (componente `Form` de shadcn, leído verbatim del registro oficial), Pattern 5 (consulta de lista + estado de pago derivado). Todos los ejemplos de código reusan literalmente los patrones ya establecidos y probados en `app/login/actions.ts`, `app/login/login-form.tsx`, `lib/auth/require-admin.ts` y `lib/validation/auth.ts` — no se introduce ningún patrón de Server Action nuevo, solo se extiende el existente a un formulario polimórfico.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| shadcn/ui `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` como única forma de conectar react-hook-form | shadcn documenta también un patrón `Field`/`FieldLabel`/`FieldError` más nuevo, con `Controller` manual y más control de markup | Visto en la documentación actual de shadcn (2026); no invalida el componente `form` clásico, que sigue en el registro oficial y sigue siendo lo que `02-UI-SPEC.md` ya prescribió | Ninguno para esta fase — se confirmó que `npx shadcn add form` sigue instalando la API clásica que `02-UI-SPEC.md` espera; no hace falta migrar de patrón. Vale la pena que un futuro contribuidor sepa que el patrón `Field` existe, por si una fase posterior decide adoptarlo. |

**Deprecated/outdated:** ninguno relevante a esta fase — el stack completo (Next.js 16, `@supabase/ssr`, `zod` 4) ya está en su convención vigente desde Fase 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Esquema exacto de la migración nueva (nombres de columna `pagador_nombre`/`pagador_telefono`/`pagador_email`/`viajero_nombre`/`viajero_telefono`, constraints nuevos) | Architecture Patterns → Pattern 1 | Medio — es un diseño greenfield delegado a discreción de Claude por `02-CONTEXT.md`; renombrar una columna después de que Fase 3/4 construyan sobre ella requiere una migración adicional + cambios de código en cascada. Recomendado: que el planner/ejecutor confirme este nombrado antes de aplicarlo, o al menos lo deje explícito en el PLAN.md para que sea fácil de auditar. |
| A2 | Regla de "estado pago" en la lista: `EXISTS(pago con estado='confirmado')` ⇒ "Pagado", si no "Pendiente" (ignora pagos parciales) | Architecture Patterns → Pattern 5 | Bajo-medio — ni `02-CONTEXT.md` ni `02-UI-SPEC.md` especifican esta regla de negocio más allá del nombre de la columna (D-08); el seguimiento de pagos parciales es explícitamente Fase 4 (PAGO-04), así que la regla simple parece razonable, pero si el operador espera ver "pago parcial" como estado propio, esta fase la mostraría como "Pendiente" sin distinguirlo. |
| A3 | La "lista de nombres de viajeros" de D-03 (para reservas de varias personas, ej. 3 pasajes en una venta) se guarda como un campo adicional opcional dentro de `detalle` jsonb (ej. `detalle.viajeros: string[]`), aunque `02-UI-SPEC.md` no lo incluye como campo de formulario explícito | Architecture Patterns → Pattern 2 (nota), User Constraints (D-03) | Medio — si el planner interpreta la tabla de campos de `02-UI-SPEC.md` como exhaustiva (a pesar de que el documento mismo la marca "no exhaustiva", `02-UI-SPEC.md:196`), D-03 quedaría sin cumplir del todo: el esquema soportaría múltiples viajeros pero el formulario no tendría dónde capturarlos. Recomendado confirmar con el usuario o al menos dejarlo como decisión explícita del PLAN. |
| A4 | `precio` debe validarse como `> 0` en `zod` sin tocar la constraint de base de datos existente (`>= 0`) | Common Pitfalls → Pitfall 4 | Bajo — es la lectura más simple de un copy ya aprobado (`02-UI-SPEC.md`) contra una constraint ya aplicada (Fase 1) que nadie pidió cambiar; el riesgo es solo si el operador realmente quisiera permitir reservas de precio 0 (ej. cortesías), caso no mencionado en ningún documento de esta fase. |

**If this table is empty:** N/A — ver ítems arriba. A1 y A3 son los que más vale la pena que el planner marque como checkpoint explícito antes de que Fase 3/4 construyan sobre ellos.

## Open Questions

1. **Interpretación de D-09 (monto en USD en la lista)**
   - What we know: `02-CONTEXT.md` mismo marca esta interpretación como "no confirmada palabra por palabra por el usuario" — cuando la reserva está en VES, la columna de monto de la lista no debe inventar una conversión.
   - What's unclear: si "no inventar conversión" significa mostrar el monto en VES tal cual (sin la etiqueta "USD" al lado) o mostrar un placeholder como "—" en esa columna.
   - Recommendation: usar un placeholder claro (ej. "Ver detalle") para filas en VES en la columna de monto de la lista, y mostrar el monto real (con su moneda) en la vista de detalle/edición — evita imprimir un número sin unidad ambigua en la lista.

2. **Regla exacta de "estado pago" (ver Assumption A2)**
   - What we know: la columna debe existir (D-08); el detalle de pagos es Fase 4.
   - What's unclear: si "Pagado" debe requerir que la suma de pagos confirmados cubra el precio total (posiblemente cruzando monedas, lo cual reabre el problema de tasa de cambio que D-09 ya evita en la columna de monto) o si basta un pago confirmado cualquiera.
   - Recommendation: usar la regla simple (Pattern 5) para el MVP; si el operador reporta confusión durante el UAT de esta fase, es una revisión rápida y localizada (una función/query, no un cambio de esquema).

## Environment Availability

Ninguna dependencia externa nueva respecto a Fase 1 — Node.js, npm, git y Supabase CLI ya están disponibles y verificados en `01-RESEARCH.md` (sin cambios esperados en una semana). Docker sigue sin estar disponible (mismo fallback ya en uso: tests de RLS contra el proyecto Supabase hospedado real, no un stack local). No se requiere ninguna acción de entorno nueva para esta fase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (ya configurado, `vitest.config.ts` con proyectos `db` y `e2e`) [VERIFIED: `vitest.config.ts`, leído este sesión] |
| Config file | `vitest.config.ts` (sin cambios necesarios — los tests nuevos de esta fase caen naturalmente en `tests/rls/**` o `tests/actions/**`, ya cubiertos por el proyecto `db`) |
| Quick run command | `npx vitest run --project db` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| RESA-01 | Admin crea una reserva (con y sin "Es para otra persona") vía `crearReserva`, la fila aparece con los campos correctos | integration (Server Action contra proyecto Supabase real, con `requireAdmin()` seed) | `npx vitest run tests/actions/crear-reserva.test.ts` | ❌ Wave 0 |
| RESA-02 | Admin edita una reserva existente vía `editarReserva`, los campos cambian | integration | `npx vitest run tests/actions/editar-reserva.test.ts` | ❌ Wave 0 |
| RESA-03 | La consulta de lista devuelve columnas D-08 correctas, respeta búsqueda/filtro/orden/paginación (D-10/D-11) | integration (consulta directa, sin necesidad de renderizar HTML) | `npx vitest run tests/rls/lista-reservas.test.ts` | ❌ Wave 0 |
| RESA-04 | `marcarEstadoProveedor` cambia `estado_proveedor` independientemente de si hay pagos; exige `nota_problema` cuando pasa a `con_problema` | integration | `npx vitest run tests/actions/estado-proveedor.test.ts` | ❌ Wave 0 |
| Regresión RLS | Una reserva con `cliente_id is null` (creada sin cuenta) sigue siendo invisible para cualquier cuenta cliente | integration (dos usuarios de prueba, uno cliente) | `npx vitest run tests/rls/reservas-sin-cuenta.test.ts` | ❌ Wave 0 |
| Esquema `zod` | `esquemaReserva`/`esquemaDetalle`/`esquemaEstadoProveedor` rechazan/aceptan los casos de D-05 a D-07 (PNR obligatorio solo en pasaje, nota_problema obligatoria solo en con_problema, precio > 0) | unit (sin base de datos) | `npx vitest run tests/validation/reservas.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** el archivo específico de `tests/**/*.test.ts` tocado por esa tarea.
- **Per wave merge:** `npm test` (suite completa, incluye `tests/rls/*` existentes de Fase 1 — confirma que la migración nueva no rompió nada de la Fase 1).
- **Phase gate:** suite completa verde **y** UAT manual (crear una reserva de cada tipo, editarla, marcarla con problema, verla en la lista con los filtros) antes de `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/helpers/fixtures.ts::createReservaFixture` — actualizar el `insert` para incluir `pagador_nombre`/`pagador_telefono` (requerido en cuanto la migración aplique `NOT NULL`, o **toda** la suite de Fase 1 se rompe — ver Pitfall 3). Esta es la tarea de mayor prioridad de Wave 0, antes que cualquier test nuevo.
- [ ] `lib/validation/reservas.ts` — no existe todavía.
- [ ] `tests/validation/reservas.test.ts` — carpeta `tests/validation/` no existe todavía (los tests actuales son `tests/auth/`, `tests/rls/`, `tests/e2e/`; esta fase agrega la primera carpeta de tests unitarios puros de esquema).
- [ ] `tests/actions/` — carpeta nueva para los tests de `crearReserva`/`editarReserva`/`marcarEstadoProveedor`.
- [ ] `tests/rls/lista-reservas.test.ts`, `tests/rls/reservas-sin-cuenta.test.ts` — archivos nuevos mapeados arriba.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no (sin cambios) | Ya cubierto por Fase 1; esta fase no toca autenticación. |
| V3 Session Management | no (sin cambios) | Ya cubierto por Fase 1. |
| V4 Access Control | yes | RLS ya existente (`private.is_admin()`) sigue siendo el límite real; cada Server Action de reservas debe llamar `requireAdmin()` explícitamente (mismo patrón que `cerrarSesion()`), sin excepción. |
| V5 Input Validation | yes | `zod.discriminatedUnion` server-side (`safeParse`, nunca solo cliente) para el formulario polimórfico; ningún campo de `detalle` se guarda sin pasar por el esquema correspondiente a su `tipo`. |
| V6 Cryptography | no | Sin superficie nueva de criptografía en esta fase. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Enviar un `detalle` con campos de otro `tipo` (ej. `pnr` en una reserva de hotel) para confundir el seguimiento del operador | Tampering | `zod.discriminatedUnion("tipo", […])` rechaza cualquier combinación de campos que no corresponda exactamente al `tipo` declarado — validado server-side, no solo en el cliente (Pattern 2). |
| Server Action de reservas invocada sin pasar por `requireAdmin()` (copy-paste de una acción nueva que olvida la línea) | Elevation of Privilege | Mismo patrón ya establecido en Fase 1 (`app/admin/actions.ts`): **toda** Server Action bajo `/admin` empieza con `await requireAdmin()`; RLS es la red de seguridad si se olvida, pero no debe ser la única capa. |
| Contenido libre de `nota`/`nota_problema` renderizado más adelante en el panel de cliente (Fase 3) sin escapar | Tampering / XSS | React escapa por defecto cualquier texto interpolado en JSX — nunca usar `dangerouslySetInnerHTML` para estos campos, ni en esta fase ni en Fase 3/4 cuando el cliente los lea. |
| Guardar un precio de `0` (o negativo, vía manipulación directa del `FormData`) a pesar del copy de error del formulario | Tampering | `zod` valida `precio > 0` server-side (Pitfall 4) — la constraint de base de datos (`>= 0`) es una segunda capa más permisiva, no la única. |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260927000001_perfiles_y_rol_admin.sql`, `20260927000002_reservas_pagos_recordatorios.sql`, `20260927000003_comprobantes_privados.sql`, `20260927000004_pagos_tasa_cambio_solo_en_bs.sql` — leídos verbatim esta sesión, esquema y RLS actuales de `reservas`/`pagos`/`profiles`/`storage.objects`.
- `app/login/actions.ts`, `app/login/login-form.tsx`, `app/admin/actions.ts`, `app/admin/page.tsx`, `lib/auth/require-admin.ts`, `lib/validation/auth.ts`, `lib/supabase/server.ts`, `tests/helpers/fixtures.ts` — leídos verbatim esta sesión, patrones de Server Action/formulario/RLS-test ya establecidos en Fase 1.
- [ui.shadcn.com/r/styles/new-york-v4/form.json](https://ui.shadcn.com/r/styles/new-york-v4/form.json) — registro oficial leído verbatim (`curl`) esta sesión, confirma la API `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` vigente.
- npm registry (`npm view <pkg> version`) — todas las versiones de Standard Stack, verificadas en vivo 2026-09-28.
- `.planning/phases/02-gesti-n-de-reservas-admin/02-UI-SPEC.md`, `02-CONTEXT.md` — leídos completos esta sesión (contrato de diseño y decisiones de usuario ya aprobados).

### Secondary (MEDIUM confidence)
- `01-RESEARCH.md` (Fase 1) — confirma el patrón `proxy.ts`/RLS/`SECURITY DEFINER` que esta fase reutiliza sin cambios.

### Tertiary (LOW confidence)
- WebSearch cross-checks sobre patrón shadcn/ui Form + react-hook-form + zod, patrón Next.js Server Actions + `useActionState` + `safeParse`, diseño jsonb polimórfico en Postgres, y ALTER TABLE ADD COLUMN NOT NULL sin downtime — no verificados contra una única fuente oficial primaria (fuera de la lectura directa del registro shadcn ya citada arriba), pero consistentes entre sí y con el código ya existente de este proyecto.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todas las versiones re-verificadas en vivo esta sesión, sin cambios desde Fase 1.
- Migración/esquema nuevo (pagador/viajero): LOW/ASSUMED — diseño greenfield delegado a discreción de Claude por `02-CONTEXT.md`, no verificable contra ninguna fuente externa; recomendado como checkpoint explícito del planner.
- Patrón shadcn Form: HIGH — leído verbatim del registro oficial en vivo esta sesión.
- Patrón Server Action + zod + useActionState: MEDIUM — API surface y forma ya confirmados por código propio del repo (Fase 1); el resto del patrón general viene de websearch (LOW por sí solo, pero corroborado por el código ya funcionando).
- Pitfalls (NOT NULL migration, tipos desactualizados, fixtures rotos): HIGH para los hallazgos específicos de este repo (leídos verbatim); LOW/CITED para el patrón general de ALTER TABLE sin downtime (websearch).

**Research date:** 2026-09-28
**Valid until:** ~14 días para versiones de paquetes (mismo ritmo de publicación que Fase 1); ~90 días para los patrones arquitectónicos (Server Action + zod, RLS, shadcn Form) que son hechos estables a nivel de framework/proyecto.
