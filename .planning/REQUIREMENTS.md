# Requirements: Rent & Trippin

**Defined:** 2026-09-27
**Core Value:** Que el operador deje de gestionar todo a mano por WhatsApp y tenga un solo lugar para crear reservas, cobrar, confirmar pagos y darles seguimiento — sin perder ninguna.

## v1 Requirements

Requisitos para el lanzamiento inicial (MVP). Cada uno se mapea a una fase del roadmap.

### Autenticación (AUTH)

- [x] **AUTH-01**: El admin puede iniciar sesión como único usuario administrador
- [ ] **AUTH-02**: El cliente puede iniciar sesión y ver solo sus propias reservas (protegido con seguridad a nivel de fila — Row Level Security — no solo ocultado en la interfaz)

### Reservas (RESA)

- [x] **RESA-01**: El admin puede crear una reserva (tipo: pasaje/hotel/tour/entrada, cliente, detalles del servicio, precio, moneda)
- [x] **RESA-02**: El admin puede editar una reserva existente
- [x] **RESA-03**: El admin puede ver la lista de todas las reservas con su estado (pendiente / confirmada con proveedor / con problema)
- [x] **RESA-04**: El admin puede marcar una reserva como "confirmada con el proveedor" (independiente del estado de pago)
- [ ] **RESA-05**: El cliente puede ver el detalle de cada una de sus reservas (tipo, fecha, estado, precio)
- [ ] **RESA-06**: Admin y cliente pueden ver el historial de reservas pasadas por cliente

### Pagos (PAGO)

- [ ] **PAGO-01**: El admin puede registrar el cobro de una reserva (método: efectivo/Zelle/Binance/tarjeta vía Payoneer, monto, moneda)
- [ ] **PAGO-02**: El cliente puede subir una foto/captura de su comprobante de pago (Zelle/Binance) al reservar
- [ ] **PAGO-03**: Al reservar con tarjeta, se genera/adjunta un link de pago de Payoneer
- [ ] **PAGO-04**: El admin puede confirmar el pago manualmente con un clic (pasa de "pendiente" a "pagado")

### Avisos (AVISO)

- [ ] **AVISO-01**: El cliente recibe una notificación si algo cambia en su reserva
- [ ] **AVISO-02**: El cliente recibe un recordatorio antes de una fecha importante de su reserva

## v2 Requirements

Pospuestos a Fase 2, no incluidos en el roadmap actual.

### Notificaciones

- **NOTI-01**: Notificaciones por WhatsApp/SMS en vez de o junto a email

### Operación

- **OPER-01**: Plantillas de reserva para tipos de viaje recurrentes
- **OPER-02**: Exportar reservas/pagos a CSV
- **OPER-03**: Soporte multi-usuario admin (para cuando se contrate ayuda)
- **OPER-04**: Reportes/resumen del negocio (ventas por moneda/método)
- **OPER-05**: Seguimiento estructurado de reclamos/incidencias

### Pagos avanzados

- **PAGO2-01**: Verificación automática de pagos Binance vía su API
- **PAGO2-02**: Checkout embebido con Stripe (requiere constituir una LLC en EE.UU.)

### Crecimiento

- **CREC-01**: Sistema de rewards/puntos para clientes frecuentes
- **CREC-02**: Catálogo público de tours/hoteles/entradas disponibles

## Out of Scope

Exclusiones permanentes (no solo pospuestas), con su razón.

| Feature | Reason |
|---------|--------|
| Verificación automática de pagos por Zelle | Ningún banco expone una API de verificación de Zelle a terceros — es técnicamente imposible, no solo prematuro |
| Chat/mensajería interna en la app | WhatsApp ya cumple ese rol bien; el trabajo real de la app es ser el registro y motor de recordatorios que WhatsApp no puede ser |
| Integraciones directas con proveedores (aerolíneas/consolidadoras) | Acceso comercial cerrado (tipo GDS) e irrelevante al volumen actual; el operador ya confirma manualmente con proveedores hoy |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 3 | Pending |
| RESA-01 | Phase 2 | Complete |
| RESA-02 | Phase 2 | Complete |
| RESA-03 | Phase 2 | Complete |
| RESA-04 | Phase 2 | Complete |
| RESA-05 | Phase 3 | Pending |
| RESA-06 | Phase 3 | Pending |
| PAGO-01 | Phase 4 | Pending |
| PAGO-02 | Phase 4 | Pending |
| PAGO-03 | Phase 4 | Pending |
| PAGO-04 | Phase 4 | Pending |
| AVISO-01 | Phase 5 | Pending |
| AVISO-02 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-27*
*Last updated: 2026-09-27 after roadmap creation (5-phase mapping confirmed, coverage 14/14)*
