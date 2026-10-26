# U2 — Saneamiento sin cambio visual (2026-10-06)

Etapa U2 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md). Claude Opus 5.5, esfuerzo `high`. Sin commit, push, datos ni producción.

Entrada: U1 cerrada (suite en [`tests/visual/`](../../tests/visual/README.md)); R1 y R2 aplicadas en el árbol pero sin recapturar la línea base.

## Resultado

| Trabajo | Hecho |
| --- | --- |
| Borrar `src/app.css` | Sí. Nadie lo importaba (ni `src/`, ni `svelte.config.js`, ni `vite.config.ts`, ni pruebas). |
| Borrar la variante `detail` de `LanzamientoCard` y su segundo reproductor | Sí. Marcado, script (menú de artistas propio, reproductores Bandcamp/SoundCloud/Spotify) y CSS. La tarjeta pasa de 1.136 a 551 líneas. Se quitó el prop `variant`: la clase queda fija en `card card--grid` y los cuatro consumidores dejaron de pasarlo. |
| `--radius-md` | Reemplazado por `--radius-base` (14 px) en perfil, sugerir y editorial (7 usos). No se añadió un token nuevo para no tocar la escala antes de U4. Como el token no existía, esas cajas se pintaban con esquinas rectas. |
| `#8cff18` en la consola | Los 19 usos pasan a `var(--color-acento)` (`#96f719`). Los 8 tintes `rgba(140,255,24,α)` pasan a `color-mix(in srgb,var(--color-acento) α%,transparent)`, con el mismo alfa. Los demás verdes derivados de la consola (`#a4ed5c`, `#a8ee62`, `#78c633`…) quedan para U4/U15. |
| Códigos internos en textos visibles | 3 textos: editorial (E09) y consola (E06 ×2). No queda ningún `E\d\d` fuera de comentarios. |
| Partir `routes/+page.svelte` | Pasa de 1.418 a 509 líneas. Mapa abajo. |

### Archivos borrados

| Archivo | Justificación |
| --- | --- |
| `src/app.css` | 144 líneas sin importar. |
| `src/routes/artista/_+page copy.svelte` | **No estaba en la lista de U2.** Son 881 líneas de respaldo que SvelteKit no enruta ni compila (E03 lo marcó como "no debe reutilizarse"; `plan-auditoria-ux-ui.md`, "debe retirarse"). Era el único archivo que usaba la variante `detail` (por defecto) y dejaba la aceptación de "~500 líneas" incumplida. Está versionado: `git checkout -- "src/routes/artista/_+page copy.svelte"` lo devuelve. |

## Mapa de módulos del inicio

```text
src/routes/+page.svelte (509)        orquestador: SearchState, catálogo, sesión modal, sincronización URL
├─ $lib/domain/homeSearchView.ts     puro: pills, conteo, órdenes, transiciones (filtros, Radar, pill,
│                                    página, orden), paginado y texto del anuncio. Probado en
│                                    tests/home-search-view.test.mjs
├─ $lib/ui/homeUrl.ts                URL e historial: searchHref, historyStateWith, navigateToSearch
│                                    (push), replaceSearchHref y replaceWithCanonicalQuery (replace),
│                                    startModalSession, markModalEntry, restoreUnderlyingScroll
├─ $lib/ui/mobileSearchChrome.ts     auto-ocultación de «Buscar» (umbral 24 px) y visualViewport/teclado
├─ $lib/ui/welcomeSession.ts         + consumeWelcomeDecision (antes decideWelcome en la página)
└─ $lib/components/home/
   ├─ HomeSearchToggle.svelte        disparador desktop «Buscar / Cerrar búsqueda»
   ├─ MobileSearchBar.svelte         barra sticky móvil con badge
   ├─ HomeFilterPanel.svelte         panel inline desktop (transiciones panelIn/panelOut)
   ├─ HomeResults.svelte             carga, error, SearchResultsBar, grilla, separador, contador,
   │                                 paginación inferior
   ├─ MobileFilterSheet.svelte       hoja móvil: cabecera, pills, gesto de cierre, cuerpo desplazable
   ├─ RadarPanel.svelte              caja del Radar compartida por panel y hoja
   └─ ResetFiltersButton.svelte      «Reiniciar filtros» compartido por panel y hoja
```

Reglas que se conservaron a propósito:

- El bloque `$: if (!cargandoTSV) { … }` que sincroniza la URL está byte a byte igual. Sus dependencias compiladas siguen siendo `cargandoTSV`, `$page`, `lastSeenQS` y `searchState`. Se comparó el grafo reactivo compilado antes y después: solo cambian las referencias a funciones importadas (no reactivas) y tres derivados que ahora dependen de `searchState` en lugar de su alias `filtrosSeleccionados`, que se deriva solo de él.
- La orquestación del modal (`abrirModal`, `cerrarModal`, `abrirRecomendacion`, `sincronizarModalDesdeURL`, `replaceWithModalBase`) sigue en la página. Moverla a un store cambiaría el orden en que SvelteKit publica `page.state` frente al efecto, que es el invariante que E17 tuvo que escalar a `xhigh`.
- Las opciones de `goto` son las mismas: push para criterios; replace con `keepFocus` para modal, beta y fallos de resolución; replace **sin** `keepFocus` para la canonización.
- El DOM resultante es el mismo. Los componentes no añaden envoltorios y cada regla CSS se movió con el elemento al que aplica. La única regla entre componentes, `.sheet-radar .radar-panel`, pasó a `.sheet-radar :global(.radar-panel)` y sigue ganando por especificidad.

## Pruebas

| Comando | Resultado |
| --- | --- |
| `npm test` | 65/65 (57 previas + 8 nuevas de `home-search-view`). |
| `npm run build` | Correcto. El compilador de Svelte no da avisos en la página ni en los componentes nuevos. |
| `npm run test:browser` antes de editar | 106 pasan, 5 omitidas, 1 falla: E17:198 (persistente, conocido). |
| `npm run test:browser` después, tres corridas | 105–106 pasan, 5 omitidas. Siempre falla E17:198. Además, de forma intermitente: E17:99 (2 de 3), E14 `catalogo.spec.ts:447` (1 de 3) y E17:178 (1 de 3). |
| E12, E13, E15, R2 hoja, tarjeta, E19 y E20, ×2 en serie | 56 pasan, 6 omitidas, 0 fallos. |
| E17 completo en serie | Solo falla E17:198, como antes de U2. |
| E17:99 aislada ×10 / E17:178 aislada ×10 | 10/10 y 10/10. |

**E17:99 bajo carga.** Las tres reproducciones dan `Expected: 0 / Received: 302`. La prueba hace `scrollTo(0, 160)` sin esperar al catálogo. Si la página aún no tiene altura, guarda 0. Después, `trigger.click()` desplaza la tarjeta a la vista (302), el modal guarda 302 como base y lo restaura bien al cerrar. Es una carrera de la prueba, no un cambio de historial. R2 ya la había visto antes de U2 ("E17:99, una vez, restauración de scroll"). No se pudo hacer un A/B contra el inicio previo a U2: la copia se perdió (ver "Incidencias"). Arreglo sugerido, fuera de U2: esperar a la tarjeta antes de `scrollTo`.

## Capturas que cambiaron

Comparación contra una referencia capturada del árbol justo antes de U2 (R1+R2), estable en dos corridas. Resultado: 24 distintas, 107 iguales. Ninguna del inicio, modal, ficha, tarjetas, artista, sello, crates, cuenta ni 404.

| Capturas | Motivo |
| --- | --- |
| `admin-anon-D`, `admin-norole-D`, `admin-list-D/T/M`, `admin-filters-D`, `admin-selection-D`, `admin-new-D`, `admin-editor-D/T/M`, `admin-editor-top-D`, `admin-finder-D`, `admin-history-D` | Acento de la consola: `#8cff18` → `#96f719` (kickers, botón primario, pestaña activa, progreso, sliders, marcador de historial). En `admin-editor-*`, además, la nota "Esta nota se conserva en el historial auditado." |
| `editorial-approve-D` | Texto sin "E09" y esquinas del diálogo. |
| `editorial-admin-D/M`, `editorial-anon-D`, `editorial-colab-D` | Esquinas (`--radius-base`) de tarjetas y del aviso. |
| `perfil-D`, `perfil-M` | Esquinas de las filas de propuestas. |
| `sugerir-anon-D/M`, `sugerir-admin-D` | Esquinas del aviso de estado. |

El cambio de acento de la consola es un cambio visible de color. El prompt lo pedía, pero el criterio "solo textos y esquinas" no lo nombra.

## Incidencias

1. **Línea base de U1 perdida.** Para medir U2 sin las 55 diferencias de R1+R2 se respaldó `tests/visual/baseline/darwin/` en el scratchpad de la sesión y se capturó el árbol previo a U2 como referencia. Ese directorio temporal se vació durante una interrupción. La línea base original no está en git (`tests/` sin seguimiento) y Time Machine no estaba montado. **Hoy `baseline/darwin/` contiene el estado R1+R2 capturado el 2026-10-05 a las 21:31, antes de U2**, no la línea base de U1. En consecuencia:
   - las diferencias de R1 y R2 frente a U1 ya no se pueden revisar con `visual:compare`; quedan descritas en sus expedientes;
   - aceptar U2 equivale a aceptar también R1+R2 como línea base.
2. Durante esa interrupción, `+page.svelte` volvió a la versión original. Se reconstruyó la versión partida y se repitieron todas las pruebas de esta página sobre la reconstrucción.

## Para U3 y U4

- **U3:** los textos "crate" del inicio no cambiaron de sitio: siguen en `LanzamientoModal`/`AddToCrateButton`, no en `components/home`. `censo.spec.ts` no se tocó.
- **U4:**
  - `--radius-md` ya no existe en el código: U4 decide si la escala lleva un paso medio.
  - La consola ya usa `--color-acento`, pero le quedan ~180 colores literales.
  - La tarjeta conserva `.titulo` después de `.titulo--grid` a propósito: hoy es `.titulo` la que fija el tamaño del título de la tarjeta (comentado en el CSS).
  - Los componentes de `home/` arrastran los literales del inicio (rgba del acento, radios 18/22 px, 999 px).
- **U10:**
  - `anuncioResultados` no tiene dependencias reactivas y anuncia "Cargando lanzamientos." para siempre. Es un fallo previo de accesibilidad (E13 decía lo contrario) y se conservó porque U2 no cambia comportamiento. Basta con pasar sus entradas a `describeResults` dentro de la sentencia reactiva.
  - `RadarPanel` y `ResetFiltersButton` son candidatos a las primitivas de U5.
- **Línea base:** no se recapturó. Tras revisar R1+R2+U2, ejecutar `npm run visual:capture`.

## Aceptación

| Criterio | Estado |
| --- | --- |
| `npm test`, `build`, `test:browser` en verde | `npm test` y `build`, sí. `test:browser`: los mismos fallos conocidos de antes (E17:198) más intermitentes ya registrados por R1/R2 y explicados arriba. |
| Visual: cero diferencias salvo textos y `--radius-md` | 24 diferencias, todas listadas. 14 son el cambio de acento que pide la propia etapa. |
| Ningún archivo de interfaz supera ~500 líneas sin motivo | Inicio: 509. Tarjeta: 551 (CSS de la grilla; U8 la reescribe). Fuera de U2 siguen por encima: manual (966), `Filtros` (925), consola (581) y `ReleaseDetail` (579); son de U9, U10, U15 y U11. |
| Ninguna referencia a archivos borrados | Sí. |

## Rollback

Sin datos ni migraciones. Para revertir:

1. Devolver `+page.svelte` y `LanzamientoCard.svelte` a su versión previa.
2. Borrar `src/lib/components/home/`, `homeSearchView.ts`, `homeUrl.ts`, `mobileSearchChrome.ts` y `tests/home-search-view.test.mjs`.
3. Quitar `consumeWelcomeDecision` de `welcomeSession.ts` y la prueba de `package.json`.
4. Restaurar `src/app.css` y `_+page copy.svelte` con git.
