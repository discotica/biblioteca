# Expediente E16 — Componente compartido de ficha, geometría y reproductor

Fecha de ejecución: 2026-09-20 (America/Bogota)  
Etapa: E16 — Componente compartido de ficha, geometría y reproductor  
Estado: **completa en local; lista para revisión/aceptación y relevo a E17/E21**  
Entrada: E03 aceptada con GO explícito a E16, contrato E04 verificado en primitivas/pruebas y relevo E05 disponible. Sin cambios de autorización, esquema, RLS, datos o producción.

## Resultado funcional

`ReleaseDetail.svelte` es la única implementación de contenido editorial para ficha. Recibe un `Release` E03 y `mode='modal'|'page'`; título, créditos completos, metadata, fecha `es-CO`, acciones, reproductor y el slot de recomendaciones nacen de esa misma instancia.

- `LanzamientoModal.svelte` quedó como wrapper de overlay: dialog, cierre, foco, bloqueo/restauración de scroll y geometría exterior.
- `LanzamientoVista.svelte` quedó como alias delgado de compatibilidad para la ruta y ya no contiene markup editorial propio.
- La ruta vuelve a resolver cuando cambia `data.slug`, descarta respuestas tardías y reemplaza el player mediante una key canónica; navegar entre fichas no conserva una instancia anterior.
- Cada mount de `ReleaseDetail` crea una sesión nueva de `ReleasePlayer`; desmontar elimina su `ResizeObserver`, listener de foco cross-origin y frames pendientes. No se conserva audio al cambiar de superficie.
- La URL compartida siempre es `https://biblioteca.discotica.com/lanzamiento/[slug-canónico]`, incluso cuando la ficha se abrió mediante alias.
- La autoría vuelve al resumen compacto aprobado para la ficha: un único principal aparece como enlace; varios principales o un compilado muestran `Varios artistas` y exponen todos los créditos navegables en un menú sin ocupar altura editorial. La ficha no repite grupos `Artistas principales`/`Colaboradores` debajo del título.
- El título usa peso 700, conserva saltos editoriales, parte palabras largas y no crea scroll horizontal.

## Contratos para E17 y E21

### `ReleaseDetail`

```text
release: Release
mode: 'modal' | 'page'
titleId?: string
slot recommendations
```

Selectores de prueba estables:

- `[data-release-detail]`
- `[data-release-detail-mode='modal'|'page']`
- `[data-release-slug]`
- `[data-release-recommendations]`
- `[data-release-menu-layer]`

El modo solo controla geometría/semántica (`h1` en página, `h2` en dialog). No crea un segundo formateador ni una rama editorial.

### Ownership de estado

| Estado/efecto | Propietario | Vida útil |
| --- | --- | --- |
| release resuelto y URL modal | wrapper/ruta que ya consume E03 | sesión de navegación |
| overlay, Escape, trap y retorno de foco | `LanzamientoModal` + `dialogOverlay` E04 | mount modal |
| copy de Compartir | `ReleaseDetail` | mount de ficha; timer limpiado al desmontar |
| crate dropdown | `AddToCrateButton` | apertura del menú; portal dentro de la ficha |
| iframe, carga/fallo, snapshot de scroll | `ReleasePlayer` | mount de player; nunca compartido entre superficies |
| recomendaciones/historial modal completo | E17 | no adelantado por E16 |

El menú de crates se portaliza a una capa dentro de `ReleaseDetail`, fuera de la columna con overflow pero todavía dentro del dialog. Así no se recorta ni rompe el trap de foco.

## Matriz modal/ruta/proveedor

| Superficie | Geometría desktop | Geometría móvil | Scroll |
| --- | --- | --- | --- |
| Modal | shell estable 1060 × hasta 720 px; portada fija y columna derecha de 440 px | recorrido vertical único, portada no sticky | solo derecha en desktop; recorrido completo en móvil |
| Ruta | composición amplia desde el mismo componente; portada sticky solo desktop | recorrido vertical único, portada no sticky | documento |

| Provider | Host/ruta aceptada | Alto exterior único | Carga/fallo | Estrategia cross-origin |
| --- | --- | ---: | --- | --- |
| Bandcamp | `bandcamp.com` o subdominio | 380 px | estado de carga + fallback externo en error | nunca se lee DOM/eventos internos |
| SoundCloud | `soundcloud.com` o subdominio | 300 px | estado de carga + fallback externo en error | nunca se lee DOM/eventos internos |
| Spotify | `open.spotify.com/album/[id]` | 352 px | estado de carga + fallback externo en error | nunca se lee DOM/eventos internos |
| Sin player/URL parecida | no monta iframe | n/a | comprar permanece disponible | hosts similares o rutas Spotify no-album se rechazan |

El bloque y el frame usan altura fija y `overflow-anchor:none`. Antes de entrar al iframe se guarda el `scrollTop` del ancestro que realmente desplaza. El listener de `blur` nunca vuelve a tomar la posición: Bandcamp, SoundCloud o Spotify pueden entregar el foco después de que el navegador ya desplazó la columna. La guarda permanece activa mientras foco y puntero siguen dentro del reproductor, de modo que también corrige desplazamientos parciales tardíos y cambios de pista que no generan un segundo `blur`. Al salir del player se desarma inmediatamente para permitir scroll intencional. `load` y `ResizeObserver` reutilizan la misma posición estable. La prueba de balance abre/cierra dos sesiones y verifica limpieza de listeners, observers y frames al desmontar.

## Pruebas y evidencia

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 42/42; incluye presentación compacta, fecha/URL canónica y matriz pura de providers |
| `PLAYWRIGHT_PORT=4203 npx playwright test tests/browser/e16-release-detail.spec.ts --grep 'varios artistas\|SoundCloud no reemplaza' --workers=1 --reporter=line` | PASS, 2/2; regresiones exactas reportadas |
| `PLAYWRIGHT_PORT=4204 npx playwright test tests/browser/e16-release-detail.spec.ts tests/browser/catalogo.spec.ts --grep 'E04\|E16' --workers=1 --reporter=line` | 21/22 en la primera corrida: descubrió una lectura prematura del snapshot en la prueba de cierre; se corrigió esperando el diálogo y normalizando cero |
| Mismo comando después de la corrección, con `PLAYWRIGHT_PORT=4207` | PASS, 22/22 |
| `PLAYWRIGHT_PORT=4205 npm run test:browser -- --workers=1 --reporter=line` | 69 PASS, 2 staging omitidas y 1 carrera E14 conocida; los 15 casos E16 pasaron en la corrida completa |
| `PLAYWRIGHT_PORT=4208 npx playwright test tests/browser/e16-release-detail.spec.ts --workers=1 --reporter=line` | PASS, 14/14; Bandcamp, SoundCloud y Spotify reproducen y restauran el salto a cero en modal y ruta |
| `PLAYWRIGHT_PORT=4210 npx playwright test tests/browser/e16-release-detail.spec.ts --workers=1 --reporter=line` | PASS, 14/14; añade desplazamiento parcial tardío, segundo cambio sin `blur` y liberación de la guarda al abandonar el player |
| `PLAYWRIGHT_PORT=4206 npx playwright test tests/browser/catalogo.spec.ts --grep 'E14: en móvil se oculta' --workers=1 --repeat-each=3 --reporter=line` | PASS, 3/3 aislado; confirma la intermitencia previa E14 y no una regresión E16 |
| `PLAYWRIGHT_PORT=4194 npx playwright test --workers=1 --reporter=line` | PASS, 68/68 ejecutadas; 2 staging condicionadas omitidas |
| `VITE_CATALOG_SOURCE=legacy PLAYWRIGHT_PORT=4195 npm run test:browser -- tests/browser/e03-legacy.spec.ts` | PASS, 1/1 |
| `npm run build` | PASS, adapter-static, sin warnings Svelte |
| `git diff --check` | PASS |

La suite E16 cubre paridad exacta de texto/fecha/autoría/acciones, resumen individual frente a `Varios artistas`, menú sin crecimiento de la columna, alias → URL canónica, títulos con salto y palabra extrema, 390 px sin overflow, modal desktop con portada inmóvil, los tres providers en ambos modos, la secuencia de salto a cero al interactuar con Bandcamp, SoundCloud y Spotify, carga/error, ausencia de player, menú de crates no recortado, sesiones/listeners, ruta directa, deep link, Back/Forward, cierre, foco y scroll del documento.

## Restricciones y relevo

- E17 debe rellenar el slot `recommendations` en ambos wrappers y diseñar la sesión de historial modal. E16 conserva el contrato anterior de apertura/cierre con `replaceState`; su prueba Back/Forward valida deep links/entradas reales, no adelanta la máquina de historial E17.
- Por la frontera cross-origin no se inspeccionan tracks ni callbacks internos. La regresión reproduce desde el padre la secuencia observable (entrada/foco, desplazamiento, `load`/resize) para cada provider y modo. E21 debe repetir el clic real sobre tracks con iframes remotos en staging/dispositivos objetivo.
- Las alturas son deliberadamente comunes a modal/ruta y estables. Cambiarlas requiere modificar `releasePlayerConfig` y la matriz, no CSS por superficie.
- `LanzamientoCard` conserva su contrato abreviado E05; no debe usarse para implementar otra ficha. Nuevas superficies deben montar `ReleaseDetail`.

## Rollback

No hay datos ni migraciones. Para rollback de cliente se revierten `ReleaseDetail.svelte`, `ReleasePlayer.svelte`, `releaseDetail.ts`, los dos wrappers y el portal de crates. E03/E04/E05 quedan intactas. No hubo commit, push ni despliegue.
