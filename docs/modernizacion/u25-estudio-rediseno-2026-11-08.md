# U25 — QA y cierre del rediseño del Estudio (2026-11-08)

Etapa U25 del [plan del rediseño](../producto/plan-estudio-rediseno-2026-11-07.md). Claude Opus 5.5, esfuerzo `high`. Rama `estudio-rediseno`, sobre `01a3edd` (U20–U24 aceptadas).

Estado: **a la espera de aceptación.** Falta el recorrido en staging (punto 6), que no se hizo.

## Dictamen

- **P0:** ninguno.
- **P1:** dos, los dos corregidos aquí.
- **P2:** cinco corregidos, tres abiertos.
- **El código queda listo para PR.** Antes de producción faltan el recorrido en staging y la migración `20261107120000` en staging y producción (no se aplica con el push).

## Hallazgos

| # | Sev. | Hallazgo | Estado |
| --- | --- | --- | --- |
| Q1 | P1 | **Catálogo a 768–1279: el estado se corta** («Publicad», «Public:») y las señales se le montan. Es el defecto que el plan quería quitar. La tabla reparte por porcentajes y a esos anchos no alcanza. | Corregido. Fecha y estado con ancho propio; por debajo de 1280 salen Tipo, Sello y Fecha, las mismas columnas que móvil. La tabla ya no hace scroll a ningún ancho medido. |
| Q2 | P1 | **Editor a 1024: la fecha se corta** («18/09/20:»). El campo mide 122 px. | Corregido: `--tool-date-min` (156 px). |
| Q3 | P2 | Diccionarios: 2 px de scroll horizontal fantasma en la tabla, a todos los anchos. Lo causa el área táctil del menú de fila. | Corregido. |
| Q4 | P2 | Separador «·» suelto al partir la línea a 390 (Reportes y resumen de Propuestas). | Corregido: el punto vive en el hueco y se recorta si la parte abre línea. |
| Q5 | P2 | Tooltips que no llegaban al lector de pantalla: filas de datos de Reportes y opciones del control segmentado (el conteo solo estaba en el `title`). | Corregido con texto `sr-only`. |
| Q6 | P2 | Texto truncado sin forma de leerlo entero: título y artistas del editor, ítems de la bandeja, celdas de artistas, tipo y sello, nombre del diccionario. | Corregido con `title`. |
| Q7 | P2 | Enlace de la página reportada: 19 px de alto, bajo el mínimo de 24. | Corregido: 27 px. |
| Q8 | P2 | Al abrir el editor, el anunciador de SvelteKit lee «catalogo — Biblioteca Discótica», el título genérico de `+layout.ts`, antes de que el editor ponga el suyo. Solo lo oye un lector de pantalla. | Abierto. Toca el título global del layout, fuera del Estudio. |
| Q9 | P2 | A menos de 768 no hay selección ni lote (decisión de E07/U15). Con zoom al 200 % en una ventana de 1280, el lote desaparece. | Abierto, por decisión: se conserva el comportamiento. |
| Q10 | P2 | Lecturas extra de conteo por pestaña en Diccionarios (pendiente de U21). | Abierto: medir en producción; una RPC propia queda fuera del plan. |

## 1. Responsive

- Las 7 pantallas del lienzo, más el editor de propuesta del colaborador, a 390, 768, 1024, 1280, 1440 y zoom 200 %: **46 estados**. El lote se omite por debajo de 768 (Q9).
- **Ningún** scroll horizontal de página y ningún elemento fuera del ancho. Hacen scroll en su caja solo las pestañas del Estudio, las de Diccionarios y el control segmentado a 390.
- `npm run test:anchos`: 40/40. Admite `ANCHOS_DIR` para no sobrescribir `capturas-e21rc2`.
- La comprobación queda versionada en `tests/visual/estudio-qa.spec.ts`:

  ```bash
  VISUAL_SPEC=estudio-qa.spec.ts npx playwright test -c tests/visual/playwright.config.ts
  ```

- Capturas en [`capturas-u25/responsive`](./capturas-u25/responsive) y [`capturas-u25/anchos`](./capturas-u25/anchos).

## 2. Accesibilidad

| Criterio | Resultado |
| --- | --- |
| IconButton e iconos con nombre | 0 controles sin nombre en los 46 estados. Ningún SVG informativo sin nombre. |
| Foco visible | SplitButton (las dos mitades), control segmentado y barra plegada: anillo de 2 px. Barra plegada: el tooltip también sale con el foco. |
| Menú con teclado | Enter o ↓ abren en el primer ítem, Escape cierra y devuelve el foco a la flecha. |
| Contraste ≥ 4.5:1 | 0 textos por debajo, medido sobre el fondo compuesto. No mide texto sobre portadas. |
| Marcas con tooltip | **Desvío del prompt, a propósito:** las marcas que no son controles llevan el texto en `sr-only` y no `aria-describedby`, porque un lector no anuncia `aria-describedby` en un `span` que no recibe foco. En enlaces y controles, el `title` ya llega como descripción accesible. |

Límites: Chromium sin interfaz, sin WebKit ni VoiceOver. Las comprobaciones manuales de U18 (iPhone y VoiceOver) siguen sin hacer.

## 3. Voz

Recorrido contra la sección 3 del plan: sin subtítulos bajo el h1, sin eyebrows ni leyendas, estados con punto y palabra, una sola acción verde por vista.

Sobra una cosa, y es a sabiendas: «Solo admin cambia la portada.» en el editor del colaborador pasa de las 3 palabras de la regla 3. El plan la pidió así en U22. Se deja.

## 4. Suite

| Comando | Resultado |
| --- | --- |
| `npm test` | 199/199 |
| `npm run build` | OK |
| `npm run lint:tokens` | OK, 193 archivos |
| `test:browser` ×3 seguidas | 374 / 374 / 374, sin reintentos ni intermitentes |
| `estudio-qa` | 46/46 |
| `test:anchos` | 40/40 |

## 5. Visual

Línea base recapturada sobre U25 al aceptar la etapa (2026-11-08): 54 capturas nuevas, las de abajo. `visual:capture` reescribió además 5 públicas sin cambio real (`home-D`, `card-grid-D`, `card-row-D`, `header-menu-D`, `header-account-menu-D`), que se restauraron. Compare posterior: 192 de 193 iguales; `lab-u6-M` dio 337 px en esa corrida y 4 de 4 iguales al repetirla sola.

Las cifras siguientes son de antes de recapturar.

- **Contra la línea base vigente (G4 de U19):** 193 capturas, 139 iguales, 54 diferentes, 0 errores, 0 inestables. Son 43 del Estudio, 10 de `/lab` (primitivas e iconos de U20–U24) y `modal-review-D`, que es la reseña oculta en la ficha pública (D7a). Nada más del sitio público cambia.
- **Contra `.ref-pre-u24` (U23):** 24 diferentes. Mezcla U24 y U25, porque no se guardó referencia antes de empezar U25.
  - Reportes (`estudio-reportes-D/M`, `estudio-reporte-M`) y `lab-D/M`: U24.
  - Catálogo y lote (`admin-list-D/T`, `admin-filters-D`, `admin-selection-D`, `estudio-lote*`, `estudio-vista-D`): Q1.
  - Diccionarios (`estudio-diccionarios-*`): Q3.
  - Resumen de Propuestas (`estudio-propuesta-M`, `editorial-*-D`, `estudio-propuestas-T`): Q4.
  - `lab-u8-M`: 12 px de ruido conocido.

## 6. Staging

**No hecho.** El prompt pide el recorrido con admin y `colaborador_qa`. Esta sesión tiene la instrucción de no usar credenciales en staging ni en producción, y además staging no tiene esta rama ni la migración D7b. Pendiente: Catálogo, lote, editor, Propuestas (aceptar y devolver), Reportes y Diccionarios, con los dos roles.

## Archivos

- `src/routes/estudio/catalogo/+page.svelte`, `diccionarios/+page.svelte`, `reportes/+page.svelte`.
- `src/lib/components/estudio/ReleaseForm.svelte`, `ProposalSummary.svelte`.
- `src/lib/layouts/InboxItem.svelte`, `src/lib/ui/SegmentedControl.svelte`, `src/lib/styles/tokens.css`.
- `tests/visual/estudio-qa.spec.ts` (nuevo), `tests/visual/anchos-zoom.spec.ts` (`ANCHOS_DIR`).
