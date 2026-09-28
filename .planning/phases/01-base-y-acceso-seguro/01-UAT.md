---
status: complete
phase: 01-base-y-acceso-seguro
source: [01-VERIFICATION.md]
started: 2026-09-28T13:00:00Z
updated: 2026-09-28T13:30:00Z
---

## Current Test

None — all 4 items resolved.

## Tests

### 1. Modelo de datos para revisar (Plan 01-03)
expected: |
  Cada cliente es una cuenta creada por el admin (sin auto-registro). Cada reserva tiene precio
  y moneda (USD por defecto). Cada pago guarda método, monto, moneda y, si es en bolívares, la
  tasa de cambio obligatoria. Una reserva con pagos no se puede borrar (nunca desaparecen
  registros financieros). Los recordatorios son internos (el cliente no los ve; se le avisa por
  correo en la Fase 5). Los comprobantes de pago son privados e inmutables para el cliente una
  vez subidos.
  Pregunta abierta: ¿habrá clientes que nunca tengan cuenta (sin correo)?
result: aprobado, con nota de diseño para Fase 2 (no se cambia nada en Fase 1)
notes: |
  Sí, habrá clientes sin cuenta y sin correo. Además, quien paga no siempre es quien viaja:
  una reserva debe distinguir al pagador (puede tener cuenta) del viajero (puede no tenerla).
  Más adelante el pagador podrá ver y gestionar las reservas de sus familiares — esa
  funcionalidad se decide como alcance en Fase 3, pero el modelo de datos de Fase 2 debe
  permitirla. Registrado en PROJECT.md → Key Decisions y en ROADMAP.md → Fase 2/Fase 3 →
  Notes, para que /gsd-discuss-phase 2 y su plan lo incluyan como una migración NUEVA
  (no se edita el esquema de reservas/pagos ya aplicado en Fase 1).

### 2. Visual/marca en pantalla de teléfono (375px) (Plan 01-04)
expected: |
  Con `npm run dev` corriendo, abre http://localhost:3000 en una ventana de 375px de ancho
  (modo dispositivo del navegador). El logo y el botón morado (#482583) se ven bien en ese
  tamaño; el diseño es de una sola columna, cómodo de tocar con el dedo.
result: aprobado

### 3. Login real con gabbovera@gmail.com (Plan 01-04)
expected: |
  Inicia sesión como gabbovera@gmail.com con la contraseña inicial. El panel muestra
  "Sesión iniciada como gabbovera@gmail.com". Presiona "Cerrar sesión" y confirma que vuelve
  al login. Prueba una contraseña incorrecta y confirma que muestra
  "Correo o contraseña incorrectos." en español.
result: aprobado

### 4. Persistencia de sesión al día siguiente — D-01 (Plan 01-04)
expected: |
  Al día siguiente de iniciar sesión, reabre el mismo navegador en /admin. El panel debe abrir
  directo, sin pedir la contraseña de nuevo (sesión larga, como WhatsApp Web). Esto no se puede
  simular con una prueba automática que corre en segundos.
result: aceptado por confianza en la verificación automática (owner eligió cerrar la fase ahora en vez de esperar un día)
notes: |
  No se pudo probar en vivo por requerir el paso de un día real. El owner decidió cerrar la
  Fase 1 confiando en la doble verificación automática ya hecha: (1) Plan 01-02's
  configure-auth.mjs confirmó vía la Management API de Supabase que no hay límite de duración
  de sesión, ni cierre por inactividad, ni límite de una sola sesión por usuario; (2)
  @supabase/ssr usa por defecto una cookie de 400 días y un refresh token sin expiración. Si
  el owner nota mañana que le pide la contraseña de nuevo, es un hallazgo a reportar, no algo
  ya cerrado en falso — quedó documentado aquí para trazabilidad.

## Summary

total: 4
passed: 4
issues: 0
