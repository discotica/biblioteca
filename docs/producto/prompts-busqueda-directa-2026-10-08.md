# Prompts — Búsqueda directa (U10b) — 2026-10-08

Un chat autocontenido por etapa del [plan de búsqueda directa](./plan-busqueda-directa-2026-10-08.md). Ejecuta U10b-1 y, cuando esté revisada, U10b-2. Va una por chat y nunca en paralelo sobre el mismo árbol. Antes de pegar un prompt, elige el modelo y el esfuerzo de su encabezado.


## U10b-1

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`) · **Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U10b-1 — Desktop: campo directo y formulario sin hueco — del plan en `docs/producto/plan-busqueda-directa-2026-10-08.md`, con Claude Opus 5.5 y esfuerzo high. Es una enmienda a U10 (aceptada); U11 está implementada pero sin aceptar.

Primero lee completos:
- el plan (secciones Contexto, Decisiones, Diseño y la etapa U10b-1);
- `docs/modernizacion/u10-inicio-busqueda-2026-10-07.md`;
- la sección "Inicio y búsqueda (2026-10-07, durante U10)" de `docs/modernizacion/decisiones.md`;
- `src/lib/components/Filtros.svelte`, `src/lib/components/home/` (todo), `src/routes/+page.svelte`, `src/lib/ui/overlay.ts` y `tests/browser/u10-inicio.spec.ts`.
Ejecuta `git status --short`; preserva el trabajo ajeno. Respalda los archivos que reescribas en `docs/modernizacion/respaldos/*.pre-u10b.svelte.txt`.

Antes de editar, captura la referencia aislada: `VISUAL_BASELINE_DIR=.ref-pre-u10b npm run visual:capture`, y corre `npm run test:browser` dos veces para fijar el punto de partida.

Implementa:
1. `SearchCombobox.svelte`, extraído de Filtros sin cambiar el comportamiento ni el ARIA, con los eventos filtrar, activate, escape y commit, y la utilidad compartida `filterOptions.ts`.
2. `HomeSearchBar.svelte`: campo a la izquierda (min(100%, 24rem) → 100% con --motion-fast), la × "Cerrar búsqueda", las chips bajo el campo y el panel debajo. Se abre con clic o al escribir, nunca por foco programático ni por Tab. Cierran la × (conserva todo), Esc (el segundo) y el clic fuera de la región; las chips, las sugerencias y los desplegables cuentan como dentro.
3. Grilla de Filtros: País·Género / Tipo·Año·Reiniciar (layout="panel") y el modo "sheet". Quita el pie del panel.
4. Integración en +page.svelte (returnFocus y exploreWelcome apuntan al input) y borrado de HomeSearchToggle. La hoja móvil conserva temporalmente un SearchCombobox arriba hasta U10b-2.
5. Tests: ajusta los selectores afectados y crea los casos desktop de `tests/browser/u10b-busqueda.spec.ts` que lista el plan.
6. Registra las decisiones en `decisiones.md` ("Búsqueda directa (2026-10-08, U10b)").

No toques `searchMatching.ts`, `searchState.ts`, el formato de la URL, los datos ni producción. No hagas commit ni push. No recapturas la línea base oficial.

Entrega `docs/modernizacion/u10b-busqueda-directa-2026-10-08.md` con:
- los resultados de las pruebas antes y después, separando los fallos conocidos (E17:202; E14, E16:294 y E17:99 intermitentes);
- la comparación visual contra `.ref-pre-u10b`, con el motivo de cada diferencia;
- capturas en `docs/modernizacion/capturas-u10b/` a 1440, 1024 y 834, con el panel cerrado, abierto, con sugerencias y con filtros;
- los archivos tocados y el relevo a U10b-2.
```

## U10b-2

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`) · **Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U10b-2 — Móvil: input en la barra, hoja sin pie y radar en dos columnas — del plan en `docs/producto/plan-busqueda-directa-2026-10-08.md`, con Claude Opus 5.5 y esfuerzo high. U10b-1 debe estar implementada; lee su expediente `docs/modernizacion/u10b-busqueda-directa-2026-10-08.md`.

Primero lee completos:
- el plan (Decisiones, Diseño y la etapa U10b-2);
- `docs/modernizacion/e15-busqueda-movil-2026-09-19.md`;
- `src/lib/components/home/MobileSearchBar.svelte`, `MobileFilterSheet.svelte`, `src/lib/ui/Sheet.svelte`, `src/lib/ui/mobileSearchChrome.ts`, `src/lib/components/RadarFiltros.svelte` y `src/lib/components/SearchCombobox.svelte`;
- `tests/browser/e15-mobile-search.spec.ts` y `u10-inicio.spec.ts`.
Ejecuta `git status --short`. Si `.ref-pre-u10b` no refleja el final de U10b-1, recaptúralo como `.ref-pre-u10b-2` antes de editar.

Implementa:
1. MobileSearchBar: SearchCombobox (md, flex 1) + IconButton Filtros con el icono nuevo `filtros` en icons.ts y la insignia de conteo + ViewToggle. Las sugerencias van bajo la barra; tras commit, blur del input.
2. MobileFilterSheet: sin campo de texto, sin pie ("Ver N" eliminado; cierra la ×), con Reiniciar tras Tipo·Año y el radar siempre visible.
3. Sheet: prop opcional maxHeight. La hoja mide su altura al abrir: cabecera + offsetTop del radar + 72 px, con tope de 88dvh. Recalcula al cambiar el viewport, no al cambiar las chips.
4. RadarFiltros: siempre ejes | gráfico. Con el dedo por debajo de 480: puntos de 40×44 (--pip-hit-x/--pip-hit-y), etiqueta sobre los puntos, menos gap, gráfico de ~115 px y Aleatorizar/Limpiar bajo el gráfico. Comprueba que el panel desktop no cambie.
5. Tests: E15 (disparador → botón Filtros + combobox), U10 (sin Ver N, radar en dos columnas, ≥40×44) y los casos móviles de u10b-busqueda.spec.ts. Confirma que la congelación de mobileSearchChrome con el input enfocado y el teclado sigue en verde.

No toques el motor ni la URL. No hagas commit ni push. No recapturas la línea base oficial.

Añade al expediente de U10b:
- pruebas antes y después;
- diferencias visuales;
- capturas a 390×844 y 360×800: barra, sugerencias, hoja al abrir (con el radar asomando), hoja desplazada y radar;
- comprobaciones manuales pendientes en un iPhone real (teclado sobre la barra sticky, gesto de la hoja, VoiceOver).
```
