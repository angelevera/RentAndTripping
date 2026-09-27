# Phase 1: Base y acceso seguro - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

La base de datos existe y está protegida de forma que cada tipo de usuario (admin, cliente) solo puede ver y tocar lo que le corresponde, y el admin ya puede entrar al sistema con su propia cuenta. No incluye ninguna pantalla de gestión de reservas todavía (eso es Fase 2) ni el panel de cliente (Fase 3) — solo el cimiento: esquema de datos, seguridad a nivel de fila (RLS), y autenticación del admin.

</domain>

<decisions>
## Implementation Decisions

### Sesión del admin
- **D-01:** La sesión del admin debe ser larga (persiste por semanas en su dispositivo de confianza, similar a WhatsApp Web) — no pedir contraseña de nuevo cada día. — **Reversibility:** reversible — es un parámetro de configuración de duración de sesión, se puede acortar después sin migración.
- **D-02:** No hay límite estricto de "un solo dispositivo a la vez" — el admin puede tener sesión abierta en celular y laptop simultáneamente (uso normal, no un caso raro). — **Reversibility:** reversible.

### Cuenta de admin inicial
- **D-03:** La única cuenta de administrador del MVP se crea con el correo real del operador del negocio: `gabbovera@gmail.com` (no un placeholder). — **Reversibility:** reversible — el email de una cuenta se puede cambiar después si hiciera falta.

### Claude's Discretion
- Los detalles técnicos de cómo se implementa la seguridad de datos (políticas RLS exactas, estructura de la tabla `profiles` con columna `role`, políticas sobre `storage.objects` para comprobantes de pago) quedan a discreción de Claude — el usuario no tiene opinión sobre esto y así fue confirmado en la investigación (ver `research/ARCHITECTURE.md` y `research/PITFALLS.md`).
- No se discutieron ni recuperación de contraseña ni bloqueo por intentos fallidos — el usuario los dejó fuera de la conversación (no los seleccionó como temas a discutir). Para un MVP de un solo admin, usar el comportamiento estándar/por defecto de Supabase Auth para ambos (recuperación de contraseña por correo disponible de fábrica; sin bloqueo agresivo por intentos fallidos más allá del rate-limiting estándar de Supabase) es una discreción razonable — no requiere ninguna decisión de negocio adicional.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Arquitectura y stack (de la investigación de proyecto)
- `.planning/research/ARCHITECTURE.md` — patrones de RLS, invite-only para clientes, storage privado con URLs firmadas, y el orden de construcción sugerido
- `.planning/research/PITFALLS.md` — riesgos específicos: RLS debe existir desde la primera migración, cada tabla necesita política desde el día uno, y cómo un solo mantenedor no-técnico necesita mensajes de error claros en español
- `.planning/research/STACK.md` — versiones y librerías confirmadas (Next.js 16, Supabase, `@supabase/ssr`, no usar `@supabase/auth-helpers-nextjs` que está obsoleto)

### Contexto de negocio y producto
- `idea.md` (raíz del proyecto) — descubrimiento completo del negocio, MVP vs Fase 2, arquitectura y estilo visual
- `.planning/PROJECT.md` — contexto del proyecto, restricciones, decisiones clave
- `.planning/REQUIREMENTS.md` — AUTH-01 es el único requisito v1 de esta fase

### Identidad visual (no aplica directamente a esta fase, pero es referencia para toda pantalla futura)
- `DESIGN.md` (raíz del proyecto) — guía de estilo basada en Apple
- `assets/Rent_a_trippin-01.png` — logo oficial; color de marca `#482583`

</canonical_refs>

<code_context>
## Existing Code Insights

No existe código todavía — proyecto greenfield. No hay `.planning/codebase/*.md` porque no hay codebase que mapear.

### Reusable Assets
- Ninguno todavía — esta fase construye la primera pieza real de código del proyecto.

### Established Patterns
- Ninguno todavía.

### Integration Points
- N/A — es la fase fundacional; todo lo demás se construye encima de lo que esta fase entregue.

</code_context>

<specifics>
## Specific Ideas

- El admin es una sola persona (el operador del negocio), correo `gabbovera@gmail.com` — no hay equipo, no hay roles adicionales en el MVP.
- La sesión debe sentirse como WhatsApp Web: entras una vez y te quedas conectado por semanas, no como un banco que te saca cada rato.

</specifics>

<deferred>
## Deferred Ideas

Ninguna — la conversación se mantuvo dentro del alcance de la fase.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Base y acceso seguro*
*Context gathered: 2026-09-27*
