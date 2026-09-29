---
status: testing
phase: 02-gesti-n-de-reservas-admin
source: [02-VERIFICATION.md]
started: 2026-09-29T12:15:00Z
updated: 2026-09-29T12:15:00Z
---

## Current Test

number: 1
name: Identidad de marca + primer toast
expected: |
  Con `npm run dev` corriendo, abre /login y luego /admin en el celular y en la computadora; crea una reserva desde /admin/reservas/nueva.
  Los títulos usan Poppins bold, el texto usa Inter, los botones y el anillo de foco son morado de marca (#482583), nada usa el tema gris/azul por defecto de shadcn, y después de guardar aparece un toast "Reserva creada. Ya la puedes ver en la lista." arriba, que luego desaparece.
awaiting: user response

## Tests

### 1. Identidad de marca + primer toast
expected: Poppins/Inter, morado #482583 en todo, toast "Reserva creada. Ya la puedes ver en la lista." tras guardar.
result: [pending]

### 2. Lista: foco visual, tabla/tarjetas, reglas D-09/FA-6, skeleton
expected: |
  En celular y computadora, abre /admin con al menos una reserva en USD, una en VES y una con pago confirmado (y si es posible, antes de que exista ninguna reserva).
  Los badges de estado son lo primero que llama la atención en cada tarjeta/fila; el celular muestra tarjetas, la computadora muestra tabla; una reserva en VES muestra "En Bs · ver detalle" en vez de un monto (confirma D-09); "Pagado" aparece solo donde hay un pago confirmado (confirma FA-6); se ve un skeleton gris breve mientras carga; los estados vacío-real y de error se ven como se especificó.
result: [pending]

### 3. Formulario completo de creación (4 tipos, con JavaScript)
expected: |
  En el celular con JavaScript activo, abre /admin/reservas/nueva y crea una reserva de cada tipo (hotel para otra persona, tour para un grupo de 3 con sus nombres, entrada en VES); intenta guardar un pasaje sin PNR y un precio de 0.
  Solo aparecen los campos del tipo elegido; los errores se muestran bajo cada campo al instante, en español, con el texto del UI-SPEC; el botón dice "Guardando…" mientras guarda; después de guardar, /admin muestra el toast de creación y la fila nueva; el teléfono del viajero es obligatorio; los campos de venta grupal tienen sentido para el dueño.
result: [pending]

### 4. Editar reserva: estado del proveedor, nota obligatoria, toasts
expected: |
  En el celular, abre una reserva de la lista con "Editar", márcala "Confirmada con el proveedor" y guarda; abre otra reserva, elige "Con problema", intenta guardar sin nota, luego escribe qué pasó y guarda; agrega una "Fecha importante" a una reserva que no tenía.
  Las opciones de estado están arriba del formulario; guardar "Con problema" sin nota muestra el mensaje explicativo; cada guardado regresa a la lista con el toast correspondiente y los badges se actualizan; los badges de pago nunca cambian.
result: [pending]

### 5. Búsqueda, filtros y paginación
expected: |
  En el celular con varias reservas cargadas, escribe parte del nombre de un cliente en la búsqueda, luego elige "Con problema" y un tipo; limpia con "Quitar filtros"; si hay más de 20 reservas, usa "Siguiente"/"Anterior".
  La lista se reduce mientras escribes (tras una pausa breve) y al elegir un filtro; se ve un skeleton gris breve mientras carga; una búsqueda sin resultados muestra "No hay reservas que coincidan" con "Quitar filtros"; los enlaces de página conservan la búsqueda; las reservas más nuevas siempre aparecen primero.
result: [pending]

### 6. Segundo toast en una misma sesión (corrección WR-01)
expected: |
  En una sola sesión continua, crea una reserva y luego edita otra distinta (cambia su estado, por ejemplo).
  Deben aparecer AMBOS toasts, cada uno con su texto correspondiente — el de creación y el de edición/estado — ninguno debe quedar silenciado por haber mostrado uno antes en la misma sesión.
result: [pending]

### 7. Suite completa de pruebas en una sola corrida
expected: |
  Corre `npm test` (unit + db + e2e, todos los proyectos) una sola vez, fuera de horas de mucha prueba, para que el límite de la API de autenticación de Supabase ya se haya liberado.
  Todos los proyectos deben pasar en una sola corrida combinada.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

Ninguno detectado por el verificador automático. Los 4 criterios de éxito de la Fase 2 (crear, editar, listar/buscar, marcar estado de proveedor) están respaldados por pruebas automatizadas que se corrieron de nuevo en esta sesión — no solo por lo que dicen los SUMMARY.md. Los 7 ítems de arriba son verificación humana que el proyecto siempre difiere al final de la fase (`workflow.human_verify_mode: end-of-phase`), más un ítem de ambiente (límite de tasa de Supabase Auth, ya documentado como estructural y no relacionado al código).
