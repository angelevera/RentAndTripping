---
status: complete
phase: 03-panel-de-cliente
source: [03-VERIFICATION.md]
started: 2026-09-30T14:20:39Z
updated: 2026-09-30T18:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Plantilla de correo "Invite user" en el Dashboard de Supabase
expected: enlace {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/cliente/completar-cuenta; origen de la app en Redirect URLs (Authentication → Email Templates / URL Configuration)
result: pass

### 2. Verificar rentntrippin.com en Resend y activar los 2 e2e condicionales
expected: con RESEND_DOMINIO_VERIFICADO=1 pasan los 2 casos de tests/e2e/clientes-lista.test.ts; se puede quitar adminConEnvioSimulado()
result: pass
note: "rentntrippin.com verificado en Resend; remitente de Supabase SMTP cambiado a no-reply@rentntrippin.com; con RESEND_DOMINIO_VERIFICADO=1 pasan los 6 tests de tests/e2e/clientes-lista.test.ts (0 omitidos)."

### 3. Flujo real con un correo de verdad
expected: invitar desde /admin/clientes, abrir el enlace, elegir contraseña, iniciar sesión y aterrizar en /cliente
result: pass

### 4. NEXT_PUBLIC_WHATSAPP_OPERADOR configurada en .env.local y Vercel
expected: el botón de WhatsApp del estado vacío abre wa.me con el número del operador (hoy sin la variable el enlace es https://wa.me/?text=..., que no funciona)
result: pass
note: "Usuario confirmó: el botón funciona y va directo al número de teléfono del operador (número provisional; se confirma el valor exacto y se configura en Vercel antes del primer deploy)."

### 5. Revisión visual en un celular real
expected: /cliente, /admin/clientes y /admin/clientes/[id] se ven y funcionan bien en móvil
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
