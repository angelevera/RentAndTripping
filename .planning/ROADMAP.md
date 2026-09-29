# Roadmap: Rent & Trippin

## Overview

El camino va de "nada existe todavía" a "el operador reemplazó su flujo manual de WhatsApp por una sola herramienta". Primero se construye la base de datos y el acceso seguro (Fase 1) — sin esto, nada más puede construirse con confianza. Luego el admin gana la capacidad de crear y gestionar reservas (Fase 2), que es el primer valor real: ya no depende de la memoria ni de scrollear WhatsApp. Con reservas existiendo, se abre el panel de cliente (Fase 3) para que cada cliente vea lo suyo sin preguntar. Después se añade el cobro y la confirmación de pagos (Fase 4), el punto de mayor riesgo de confianza del proyecto. Por último, avisos y recordatorios automáticos (Fase 5) cierran el ciclo — y esa misma fase termina con una prueba real con una reserva de verdad, validando que todo el flujo funciona de punta a punta antes de considerar el MVP listo. Después de ese MVP operativo, la Fase 6 agrega la cara pública del negocio: una página de presentación sin login, estilo Apple, con quiénes somos y los servicios ofrecidos — el escaparate que hoy no existe fuera de Instagram/WhatsApp.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Base y acceso seguro** - Base de datos protegida y el admin puede iniciar sesión (completed 2026-09-28)
- [ ] **Phase 2: Gestión de reservas (admin)** - El admin crea, edita y da seguimiento a todas las reservas en un solo lugar
- [ ] **Phase 3: Panel de cliente** - Cada cliente entra a su propia cuenta y ve solo sus reservas
- [ ] **Phase 4: Pagos, comprobantes y confirmación** - Se registra el cobro, se sube el comprobante y el admin confirma con un clic
- [ ] **Phase 5: Avisos, recordatorios y prueba real** - El cliente se entera de cambios y recordatorios automáticamente, validado con una reserva real
- [ ] **Phase 6: Sitio público de presentación (home)** - Página pública estilo Apple con quiénes somos y los servicios que ofrece Rent & Trippin, sin login

## Phase Details

### Phase 1: Base y acceso seguro

**Goal**: La base de datos existe y está protegida de forma que cada tipo de usuario (admin, cliente) solo puede ver y tocar lo que le corresponde, y el admin ya puede entrar al sistema con su propia cuenta.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01
**Success Criteria** (what must be TRUE):

  1. El admin puede iniciar sesión con su correo y contraseña y llega a un panel de administración (aunque todavía esté vacío, sin reservas cargadas).
  2. Nadie que no sea el admin puede entrar al panel de administración.
  3. La estructura de datos para reservas, pagos y clientes ya existe y está protegida a nivel de base de datos (no solo escondida en la pantalla), lista para que las próximas fases construyan sobre ella con confianza.

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Esqueleto andante: paquetes aprobados, proyecto enlazado a Supabase, y el admin entra por /login y llega a /admin (tracer)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Solo el admin entra y se queda conectado: proxy, guardia, cierre de sesión por dispositivo, cuenta real gabbovera@gmail.com, registro público cerrado
- [x] 01-03-PLAN.md — Reservas, pagos, recordatorios y comprobantes privados protegidos con RLS y probados

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Entrada con la marca y formulario validado en español (funciona sin JavaScript)

### Phase 2: Gestión de reservas (admin)

**Goal**: El admin tiene un solo lugar para crear, editar y dar seguimiento a todas las reservas (pasajes, hoteles, tours, entradas), reemplazando el cuaderno mental/WhatsApp de hoy.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RESA-01, RESA-02, RESA-03, RESA-04
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. El admin puede crear una reserva nueva indicando el tipo (pasaje/hotel/tour/entrada), el cliente, los detalles del servicio, el precio y la moneda.
  2. El admin puede editar cualquier dato de una reserva ya creada.
  3. El admin puede ver la lista completa de reservas con su estado (pendiente / confirmada con proveedor / con problema) sin tener que buscar en el chat de WhatsApp.
  4. El admin puede marcar una reserva como "confirmada con el proveedor" de forma independiente a si ya fue pagada o no.

**Notes:**

- **Pagador vs. viajero** (confirmado en el UAT de Fase 1, 2026-09-28): quien paga una reserva no siempre es quien viaja. El pagador puede tener cuenta; el viajero puede no tenerla y no tener correo. El modelo de datos de esta fase debe distinguir ambos roles en `reservas`. Esto se implementa como una **migración nueva** (siguiente número de timestamp) — no se edita `20260927000002_reservas_pagos_recordatorios.sql` ni `20260927000003_comprobantes_privados.sql`, ya aplicadas en Fase 1. Ver PROJECT.md → Key Decisions.
- Este cambio de esquema habilita, pero no implementa, la gestión de reservas de familiares por el pagador — esa funcionalidad es una decisión de alcance de **Fase 3** (ver su nota abajo).

**Plans:** 1/5 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Decisión pagador/viajero, migración nueva empujada a la base real, y el admin registra un pasaje de un pagador sin cuenta y lo ve en /admin (tracer)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — Paquetes aprobados por una persona, identidad de marca (shadcn/ui, Poppins/Inter, avisos) y lista con insignias de estado proveedor/pago

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — Formulario completo: pasaje, hotel, tour o entrada, viajero distinto, grupo de viajeros y fecha importante, con validación en español probada

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 02-04-PLAN.md — Editar cualquier reserva y marcar "confirmada con el proveedor" o "con problema", independiente del pago

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 02-05-PLAN.md — Búsqueda por nombre, filtros por estado y tipo, y páginas de 20

### Phase 3: Panel de cliente

**Goal**: Cada cliente tiene su propia cuenta para ver sus reservas y su historial, sin tener que escribirle al admin por WhatsApp para preguntar "¿cómo va mi reserva?".
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: AUTH-02, RESA-05, RESA-06
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. El cliente puede iniciar sesión con una cuenta creada/invitada por el admin y ver únicamente sus propias reservas, nunca las de otro cliente.
  2. El cliente puede ver el detalle de cada una de sus reservas: tipo, fecha, estado y precio.
  3. Tanto el cliente como el admin pueden ver el historial de reservas pasadas de ese cliente.

**Notes:**

- **Decisión de alcance pendiente** (ver Fase 2 → Notes, confirmado en el UAT de Fase 1): ¿puede el pagador ver y gestionar las reservas de sus familiares (viajeros sin cuenta propia)? El modelo de datos de Fase 2 lo permite; si esta fase decide construirlo, úsese `/gsd-discuss-phase 3` para fijar el alcance antes de planear.
- **Deuda pendiente de la revisión de código de Fase 1 (WR-01, 2026-09-28):** hoy `/login` revela si una contraseña es correcta aunque la cuenta no sea admin (mensaje distinto al de "correo/contraseña incorrectos"). El riesgo es bajo hoy (una sola cuenta admin, registro público cerrado), pero se vuelve relevante cuando esta fase agregue cuentas de cliente reales al mismo `/login` compartido. Diseñar el arreglo junto con el flujo de login del cliente, no antes — el intento de arreglarlo en Fase 1 rompió la prueba que confirma que `/login` es la puerta de entrada compartida. Ver `01-REVIEW.md`/`01-REVIEW-FIX.md` en la carpeta de Fase 1 para el detalle técnico.

**Plans**: TBD

Plans:

- [ ] 03-01: TBD

### Phase 4: Pagos, comprobantes y confirmación

**Goal**: El operador puede cobrar por cualquier método que ya usa hoy (efectivo, Zelle, Binance, tarjeta vía Payoneer) y confirmar el pago con un clic, sin perder el rastro de comprobantes ni mezclar montos en distintas monedas.
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: PAGO-01, PAGO-02, PAGO-03, PAGO-04
**UI hint**: yes
**Success Criteria** (what must be TRUE):

  1. El admin puede registrar el cobro de una reserva indicando el método (efectivo/Zelle/Binance/tarjeta), el monto y la moneda.
  2. El cliente puede subir una foto o captura de su comprobante de pago (Zelle/Binance) al reservar.
  3. Cuando el cliente paga con tarjeta, el sistema genera o adjunta un link de pago de Payoneer para completar el cobro.
  4. El admin puede confirmar el pago con un clic, y la reserva pasa de "pendiente" a "pagado".

**Plans**: TBD

Plans:

- [ ] 04-01: TBD

### Phase 5: Avisos, recordatorios y prueba real

**Goal**: El cliente se entera automáticamente si algo cambia en su reserva o si se acerca una fecha importante, sin que el admin tenga que escribirle uno por uno por WhatsApp — y esto se valida con al menos una reserva real de principio a fin antes de dar el MVP por listo.
**Mode:** mvp
**Depends on**: Phase 2, Phase 4
**Requirements**: AVISO-01, AVISO-02
**Success Criteria** (what must be TRUE):

  1. El cliente recibe una notificación (por correo) cuando el admin cambia algo importante en su reserva (fecha, estado, precio).
  2. El cliente recibe un recordatorio automático antes de una fecha importante de su reserva (por ejemplo, la fecha del vuelo o el check-in del hotel).
  3. El operador completa al menos un ciclo real de principio a fin — crear la reserva, cobrar, confirmar el pago, y el cliente recibe el aviso o recordatorio correspondiente — con una reserva de verdad, confirmando que todo el flujo funciona sin ayuda técnica.

**Plans**: TBD

Plans:

- [ ] 05-01: TBD

### Phase 6: Sitio público de presentación (home)

**Goal**: Rent & Trippin tiene una página pública de presentación (sin login) donde cualquier visitante entiende quiénes somos y qué servicios ofrece la agencia (pasajes, hoteles, tours, entradas), con un estilo visual cuidado tipo Apple aplicado a la identidad de marca.
**Depends on**: Phase 1 (scaffold de Next.js, assets de marca — no depende funcionalmente de reservas/pagos/avisos de las Fases 2-5; se numera después de ellas porque cierra el milestone del MVP operativo)
**Requirements**: TBD
**Success Criteria** (what must be TRUE):

  1. Un visitante sin cuenta (sin login) puede entrar a la página pública y navegarla completa.
  2. La página comunica "quiénes somos" (la agencia, su propuesta).
  3. La página presenta los servicios que ofrece Rent & Trippin: pasajes (nacionales e internacionales), hoteles, tours y entradas a conciertos.
  4. El estilo visual sigue la guía de "Estilo visual" (sección 8 de `idea.md`): disciplina tipo Apple (fotografía grande protagonista, mucho espacio en blanco, casi cero decoración, transiciones suaves) combinada con la identidad de marca de Rent & Trippin (morado `#482583` como único color de acento, títulos bold/redondeados en Poppins o Fredoka, cuerpo de texto en Inter, botones tipo "pill" morados).

**Notes:**

- Sitio de solo presentación/marketing — no reemplaza ni requiere el login de admin/cliente de las Fases 1-3. Es la puerta de entrada pública al negocio, no al panel operativo.
- Guía de estilo obligatoria: `idea.md` → sección 8 "Estilo visual" (y su referencia `DESIGN.md`, análisis del lenguaje visual de Apple). No se inventa una paleta ni tipografía nueva.
- Pendiente de planear — no se ha corrido `/gsd-discuss-phase 6` ni `/gsd-plan-phase 6` todavía.

**Plans**: TBD

Plans:

- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Base y acceso seguro | 4/4 | Complete    | 2026-09-28 |
| 2. Gestión de reservas (admin) | 1/5 | In Progress|  |
| 3. Panel de cliente | 0/TBD | Not started | - |
| 4. Pagos, comprobantes y confirmación | 0/TBD | Not started | - |
| 5. Avisos, recordatorios y prueba real | 0/TBD | Not started | - |
| 6. Sitio público de presentación (home) | 0/TBD | Not started | - |
