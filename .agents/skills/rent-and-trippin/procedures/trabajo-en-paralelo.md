# Procedimiento: dividir e integrar trabajo técnico

Úsalo para tareas de desarrollo grandes que puedan dividirse de verdad.

1. Define el resultado esperado y criterios de terminado.
2. Divide la tarea en unidades independientes; anota dependencias, interfaces y archivos probables por unidad.
3. Paraleliza solo si las unidades no requieren editar los mismos archivos ni tomar decisiones compartidas sin resolver.
4. Respeta la estrategia existente del proyecto: el estado de planificación documenta worktrees desactivados por secretos locales ignorados. No actives worktrees ni muevas secretos a un worktree.
5. Asigna a cada agente un alcance, archivos y entregable concretos. Mantén un único integrador responsable.
6. Integra revisando cada diff y resolviendo incompatibilidades; no asumas que los resultados aislados funcionan juntos.
7. Ejecuta las verificaciones pertinentes sobre el resultado integrado y comunica qué quedó comprobado.

Para colaboración entre Codex y Claude Code, prefiere una secuencia de implementación y revisión o ramas aisladas por agente. Nunca permitas que ambos editen al mismo tiempo los mismos archivos.
