---
status: testing
phase: 03-panel-de-cliente
source: [03-VERIFICATION.md]
started: 2026-09-30T14:20:39Z
updated: 2026-09-30T14:20:39Z
---

## Current Test

number: 1
name: Plantilla de correo "Invite user" en el Dashboard de Supabase
expected: |
  Plantilla con enlace {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/cliente/completar-cuenta y el origen de la app en Redirect URLs.
awaiting: user response

## Tests

### 1. Plantilla de correo "Invite user" en el Dashboard de Supabase
expected: enlace {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/cliente/completar-cuenta; origen de la app en Redirect URLs (Authentication → Email Templates / URL Configuration)
result: [pending]

### 2. Verificar rentntrippin.com en Resend y activar los 2 e2e condicionales
expected: con RESEND_DOMINIO_VERIFICADO=1 pasan los 2 casos de tests/e2e/clientes-lista.test.ts; se puede quitar adminConEnvioSimulado()
result: [pending]

### 3. Flujo real con un correo de verdad
expected: invitar desde /admin/clientes, abrir el enlace, elegir contraseña, iniciar sesión y aterrizar en /cliente
result: [pending]

### 4. NEXT_PUBLIC_WHATSAPP_OPERADOR configurada en .env.local y Vercel
expected: el botón de WhatsApp del estado vacío abre wa.me con el número del operador (hoy sin la variable el enlace es https://wa.me/?text=..., que no funciona)
result: [pending]

### 5. Revisión visual en un celular real
expected: /cliente, /admin/clientes y /admin/clientes/[id] se ven y funcionan bien en móvil
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
