# Suite de regresión visual — censo de interfaz

Convierte las 127 capturas del [censo del 2026-10-03](../../docs/producto/censo-interfaz-2026-10-03.md) en una suite reproducible (etapa U1 del [plan de interfaz](../../docs/producto/plan-interfaz-2026-10-04.md)). Desde U1, **cada etapa la ejecuta antes y después de editar** (sección 6 del plan).

## Comandos

| Comando | Qué hace | Tiempo (M-series, 4 workers) |
| --- | --- | --- |
| `npm run visual:compare` | Compara contra la línea base y escribe el informe. No toca la línea base. | ~55 s |
| `npm run visual:capture` | Reescribe toda la línea base con el estado actual. | ~60 s |
| `npm run visual:data` | Regenera los datos de muestra desde staging (solo lectura). | ~5 s |

Filtrar capturas: `npm run visual:compare -- -g "modal"` o `-g " (home-D|ficha-M)$"` (el título incluye el nombre del archivo, así que `^` no sirve).

Variables opcionales:

- `VISUAL_THRESHOLD` (0–1, por defecto `0.02`): distancia de color por píxel.
- `VISUAL_MAX_DIFF_PIXELS` (por defecto `0`): píxeles distintos tolerados por captura.
- `VISUAL_WORKERS` (por defecto `4`).
- `VISUAL_DEBUG=1`: imprime el tiempo de cada paso de cada captura.
- `VISUAL_BASELINE_DIR` (por defecto `baseline`): carpeta de referencia bajo `tests/visual/`. Sirve para aislar una etapa cuando la anterior no está aceptada: `VISUAL_BASELINE_DIR=.ref-pre-u8 npm run visual:capture` antes de editar y `VISUAL_BASELINE_DIR=.ref-pre-u8 npm run visual:compare` después (U8).

## Uso en cada etapa

1. **Antes de editar:** `npm run visual:compare`. Debe dar 0 diferencias. Si no, el árbol ya no coincide con la línea base: detente y averigua por qué antes de tocar nada.
2. **Después de editar:** `npm run visual:compare` y abre `tests/visual/report/informe.md`.
   - Cada captura distinta tiene esperada, actual y diff en `report/diferencias/`. El comparador deslizante está en `npx playwright show-report tests/visual/report/html`.
   - Cada diferencia debe estar dentro del alcance de la etapa. Las que no lo estén son regresiones (contrato del plan, sección 6.1).
3. **Al cerrar la etapa:**
   - Si la etapa no debía cambiar la interfaz (U2, por ejemplo), el resultado es 0 diferencias y la línea base no se toca.
   - Si la etapa cambia la interfaz a propósito, revisa cada diferencia y luego ejecuta `npm run visual:capture`.
   - Adjunta al paquete de relevo la lista de capturas que cambiaron y su motivo; se copia de la tabla "Capturas con diferencias" del informe.
   - La línea base nueva se versiona junto con el cambio que la produjo.
4. **Si una etapa cambia rutas, selectores o textos que usa la suite:** se actualiza `censo.spec.ts` en la misma etapa, sin borrar IDs. Ejemplo: U3 cambia `/mis-crates` y `/crate/…`; en ese caso la captura conserva su ID y cambia su URL.

## Estado de la línea base

- **Estado que representa:** el árbol tras la corrección de H1 y H15 de U18 (paso 5 del lanzamiento, aceptada el 2026-10-14): header y «Buscar» sticky, y reserva de `scroll-padding`. Antes representaba el cierre de U17 (commit `02223ea`, aceptado el 2026-10-11), que incluye R1 (ficha y reproductor), R2 (errores visibles menores), U2 (saneamiento) y U3 (colecciones) además de U4–U17.
- **Último cambio:** 7 capturas, listadas con su motivo en el [expediente de U18](../../docs/modernizacion/u18-qa-interfaz-2026-10-14.md#paso-5--h1-2026-10-14). La referencia temporal `.ref-pre-u18fix/` se borró al recapturar.
- **Cómo se llegó:** la línea base de U1 se perdió durante U2 y la de R1+R2 (2026-10-05) nunca se versionó. Las diferencias de R1, R2, U2 y U3 se aceptaron al recapturar sobre U17 y quedan descritas solo en sus expedientes de `docs/modernizacion/`. S2 (2026-10-11) confirmó 0 diferencias en 182 capturas y que las referencias temporales `.ref-pre-u3/` y `playwright.ref.config.ts` ya no existen.
- **Verificada:** `npm run visual:compare` → 182 iguales, 0 diferentes, 0 inestables. La corrección de H2 de U18 (límite de intentos de `login-with-username`, 2026-10-14) dio 0 diferencias contra `.ref-pre-u18fix`, así que no se recapturó; la referencia temporal se borró.

## Dónde vive cada cosa

| Ruta | Contenido | ¿Versionado? |
| --- | --- | --- |
| `censo.spec.ts` | Lista de capturas (mismos IDs del censo) y runner | Sí |
| `baseline/<plataforma>/` | Línea base PNG (`darwin` hoy). 182 archivos | Sí |
| `data/staging.json.gz` | Snapshot de staging: catálogo (2.790), sellos, géneros, países, tipos y artistas. ~880 KB | Sí |
| `support/` | Mocks, evaluador PostgREST, respaldos locales, estabilización, CSS de las capturas de documento e informe | Sí |
| `record-staging.mjs` | Grabador del snapshot | Sí |
| `report/`, `results/` | Informe y artefactos de la última corrida | No (`.gitignore`) |

La línea base está fuera de `static/` y de `build/`, así que nunca entra en el bundle público.

## Cómo funciona

- **Servidor propio.** Playwright arranca `vite dev` en un puerto libre con `tests/visual/vite.config.ts`, que hereda la configuración del proyecto con dos cambios: caché separada (`node_modules/.vite-visual`) y sin HMR. Un paso previo visita cada ruta dos veces para que Vite termine de optimizar dependencias antes de capturar.
- **Sin red.**
  - La app apunta a un Supabase ficticio (`https://visual-fixture.supabase.co`). Todas sus peticiones se resuelven en `support/mocks.ts`:
    - catálogo y diccionarios, desde el snapshot, con un evaluador PostgREST mínimo (`support/postgrest.ts`);
    - sesiones por rol (anónimo, comunidad, colaborador, admin), colecciones, propuestas, reportes y RPC de admin, desde fixtures ficticios iguales a los del censo (`support/data.ts`);
    - funciones Edge simuladas.
  - Cualquier escritura se responde en local y queda anotada.
  - Cualquier otra petición externa se aborta y aparece en el informe ("Red no simulada").
  - La captura no lee `.env.local` y no puede escribir nada remoto.
- **Respaldos locales.**
  - Las portadas se sustituyen por un SVG determinista: color derivado de la URL y retícula con borde, para notar escalados y recortes. No representa portadas no cuadradas.
  - La portada de Madafa se fuerza a fallar (404), como en producción, para conservar el estado "portada rota".
  - Los reproductores de Bandcamp, SoundCloud y Spotify se sustituyen por una página local con lista de pistas.
- **Determinismo.**
  - `Date` fijo en 2026-10-03 12:00 (Bogotá); temporizadores y `requestAnimationFrame` siguen reales.
  - `Math.random` con semilla.
  - Zona horaria `America/Bogota`, idioma `es-CO` y `prefers-reduced-motion: reduce`.
  - Animaciones desactivadas y cursor de texto oculto en la captura.
  - Las imágenes `lazy` se cargan antes de las capturas de página completa.
- **Sticky en capturas de página completa y de elemento.** Usan `support/capture-document.css` (`stylePath`): el header y la barra «Buscar» pasan a `relative` y se dibujan en su sitio del documento, no donde esté el scroll. `relative` ocupa lo mismo que `sticky`, así que el layout no cambia. Las capturas del viewport no lo usan y muestran el sticky real (`home-scrolled-M`).
- **Esperas por estado.** Red simulada en reposo, fuentes, imágenes visibles decodificadas, reproductores con `data-player-loaded`, ningún "Cargando…/Comprobando…" visible y el selector propio de cada captura. Además, `toHaveScreenshot` exige dos capturas idénticas seguidas.
- **Umbral.**
  - `threshold 0.02` con 0 píxeles tolerados.
  - Las vistas de admin varían ±1–3 niveles de gris entre corridas (dithering del fondo), lo que equivale a una distancia ≈4,5. El umbral corta en ≈14.
  - Cambiar `--color-acento` de `#96f719` a `#8cff18` (distancia ≈28) cambió 124 de 131 capturas. Con `0.05` ese cambio no se detectaba.

## Limitaciones conocidas

- **Fuente.** El sitio no carga Work Sans (no hay `@font-face` ni enlace): solo se ve si está instalada en el sistema. La línea base actual se tomó con Work Sans instalada. Si falta, el informe lo avisa y las capturas no son comparables.
- **Plataforma.** El render cambia entre sistemas operativos. Hoy solo existe `baseline/darwin/`; para CI en Linux hay que capturar `baseline/linux/` en ese entorno.
- **Barras de scroll.** Chromium sin interfaz oculta las barras de scroll. Las barras propias que pide la ronda 3 no aparecerán en estas capturas.
- **Correos** (`email-confirm`, `email-reset`). Reconstruyen las plantillas por defecto de Supabase dentro de un marco de cliente de correo. Cuando D3 declare `content_path` para `confirmation` y `recovery` en `supabase/config.toml`, la suite capturará esas plantillas.
- **Diagnóstico** (`debug-modal-overlap`). Añade contornos sin alterar el layout: naranja para la columna de portada, azul para la portada y rojo para el marco del reproductor.

## Capturas

- 182 en total: 127 IDs del censo (126 estados más 1 diagnóstico) y 55 suplementarias (`supplementary: true` en `censo.spec.ts`).
- Las suplementarias no están en el censo. Son las del anexo (`home-scrolled-M`, `miscrates-anon-D`, `reportar-anon-D`, `reset-signup-D`) y las que añadió cada etapa desde U5:
  - `lab-D`, `lab-M` (U5): el catálogo de primitivas en `/lab`, página completa. Cada primitiva nueva o extendida aparece ahí.
  - `lab-u6-*`, `lab-u7-*`, `lab-u8-*`, `lab-u17-*` (D y M): solo la sección de cada etapa (captura de elemento), para no depender del largo de las anteriores ni del tope de 10 000 px de `lab-M`.
  - Cuenta, colecciones, perfil, Estudio (editor, lotes, propuestas, reportes) y menús de U7–U17.
  - `header-account-menu-D`, `perfil-admin-D` y `perfil-colab-M` (U7). Les faltaba el marcador y el test de IDs fallaba (130 en lugar de 127).
- Al filtrar con `-g`, ancla el ID con un espacio: `-g " lab-(D|M)$"`. Sin el espacio, `lab-D$` también coincide con `editorial-colab-D`.
- Un test adicional comprueba que los 127 IDs del censo siguen presentes.

**Inestables.** Ninguna a 2026-10-05: 0 diferencias en cinco comparaciones sin cambios (dos con umbral 0.05 y tres con 0.02, el valor actual).

- Si alguna deja de estabilizarse tras dos intentos de corrección, se añade a `UNSTABLE` en `censo.spec.ts` con su motivo.
- Una captura inestable se sigue capturando y comparando, pero no hace fallar la corrida. El informe la lista aparte.
- Nunca se borra una captura para que la suite pase.

## Regenerar los datos de muestra

`npm run visual:data` lee staging con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de `.env.local`:

- solo hace GET a tablas públicas;
- rechaza claves que no sean publicables.

Después hay que:

1. Revisar que siguen existiendo los slugs fijados en `support/data.ts` (`pick`, `ARTIST_SLUG`, `LABEL_SLUG`). Si falta alguno, el runner falla con un mensaje claro.
2. Ejecutar `npm run visual:capture`. Con datos nuevos, la línea base anterior deja de ser comparable.

Hazlo solo cuando una etapa lo necesite (por ejemplo, D1 o D2 añaden columnas). Si no, el catálogo cambia y todas las capturas cambian con él.
