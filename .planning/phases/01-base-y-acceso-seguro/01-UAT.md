---
status: testing
phase: 01-base-y-acceso-seguro
source: [01-VERIFICATION.md]
started: 2026-09-28T13:00:00Z
updated: 2026-09-28T13:00:00Z
---

## Current Test

number: 1
name: Modelo de datos para revisar (Plan 01-03)
expected: |
  El dueño confirma que el modelo de datos (reservas/pagos/recordatorios) coincide con cómo
  funciona el negocio, o señala qué cambiar antes de que la Fase 2 construya pantallas sobre él.
  Pregunta clave: ¿habrá clientes que nunca tengan cuenta (sin correo)?
awaiting: user response

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
result: [pending]

### 2. Visual/marca en pantalla de teléfono (375px) (Plan 01-04)
expected: |
  Con `npm run dev` corriendo, abre http://localhost:3000 en una ventana de 375px de ancho
  (modo dispositivo del navegador). El logo y el botón morado (#482583) se ven bien en ese
  tamaño; el diseño es de una sola columna, cómodo de tocar con el dedo.
result: [pending]

### 3. Login real con gabbovera@gmail.com (Plan 01-04)
expected: |
  Inicia sesión como gabbovera@gmail.com con la contraseña inicial. El panel muestra
  "Sesión iniciada como gabbovera@gmail.com". Presiona "Cerrar sesión" y confirma que vuelve
  al login. Prueba una contraseña incorrecta y confirma que muestra
  "Correo o contraseña incorrectos." en español.
result: [pending]

### 4. Persistencia de sesión al día siguiente — D-01 (Plan 01-04)
expected: |
  Al día siguiente de iniciar sesión, reabre el mismo navegador en /admin. El panel debe abrir
  directo, sin pedir la contraseña de nuevo (sesión larga, como WhatsApp Web). Esto no se puede
  simular con una prueba automática que corre en segundos.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
