# Modernización de Discótica

Esta carpeta es la fuente de contexto duradero para la modernización de la plataforma. Debe leerse antes de diseñar, modificar o migrar sistemas relacionados con catálogo, identidad, contribuciones, crates, infraestructura o despliegue.

## Documentos

- [`plan-maestro.md`](./plan-maestro.md): diagnóstico, arquitectura objetivo y fases de ejecución.
- [`decisiones.md`](./decisiones.md): decisiones de producto y arquitectura ya acordadas. No se reinterpretan sin una nueva decisión explícita.
- [`estado.md`](./estado.md): punto exacto de avance, bloqueadores y siguiente acción segura.
- [`contrato-catalogo-fase-2.md`](./contrato-catalogo-fase-2.md): esquema, identidad e importación segura del catálogo canónico.
- [`../producto/plan-lanzamiento-2026-10-13.md`](../producto/plan-lanzamiento-2026-10-13.md): **orden vigente** desde hoy hasta producción, despliegue por Git a Hostinger y ciclo de cambios posterior, con sus [prompts](../producto/prompts-lanzamiento-2026-10-13.md).
- [`../producto/plan-interfaz-2026-10-04.md`](../producto/plan-interfaz-2026-10-04.md): plan por etapas del sistema de interfaz, con sus [prompts](../producto/prompts-interfaz-2026-10-04.md), el [censo](../producto/censo-interfaz-2026-10-03.md) y las [respuestas](./respuestas-catalogo-ui.md) de la ronda 3.

## Regla de continuidad

Al terminar una sesión de trabajo se debe actualizar `estado.md`. Si se toma una decisión que afecte producto, datos, seguridad o infraestructura, se debe registrar en `decisiones.md`. Ninguna migración destructiva, cambio de proveedor o corte del sistema legado se ejecuta sin actualizar antes el plan maestro y disponer de un respaldo verificable.
