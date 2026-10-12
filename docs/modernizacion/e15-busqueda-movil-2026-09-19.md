# E15 — Barra Buscar, pills y hoja móvil: relevo a E21

## Estado y fronteras

E15 queda implementada en local sobre el `SearchState` único de E12, la composición de resultados de E13, el comportamiento de header de E14 y `sheetOverlay` de E04. No se modificaron datos, Supabase, reglas de matching/ranking, flags, producción ni Git remoto.

## Comportamiento por breakpoint

| Ancho | Barra y header | Filtros activos | Superficie de edición |
| --- | --- | --- | --- |
| `≤768px` | `Buscar` es una barra secundaria sticky sobre resultados. Se oculta tras scroll descendente y reaparece al acumular 24 px ascendentes; el header global sigue oculto hasta `scrollY=0`. | Una sola fila, sin scroll horizontal; `ResizeObserver` conserva el prefijo que cabe y resume el resto como `+N`. | `Buscar` y `+N` abren el mismo Sheet modal. |
| `>768px` | Se conserva el disparador y panel inline desktop; no aparece la barra móvil. | Misma fila medida; normalmente caben todas las pills en el ancho de contenido. | Panel inline existente; el Sheet está oculto por breakpoint. |

En rotación se vuelve a evaluar el breakpoint por ancho. Por ello `768×390` mantiene la experiencia móvil y `844×390` usa desktop. El cambio grande de ancho reinicia la línea base de `visualViewport` para no confundir rotación con teclado virtual.

## Contrato de interacción

- La hoja no tiene estado de búsqueda propio: formulario, pills externas, pills internas, URL, resultados, Back/Forward y badge se derivan y mutan desde el mismo `SearchState`.
- Sin criterios, la colección completa se presenta como estado normal: el aviso de resultados aproximados solo se muestra cuando existe al menos un criterio activo.
- País y Género conservan tags/listas; Radar monta colapsado. Cada cambio se aplica inmediatamente y vuelve a página 1 mediante el serializador E12.
- Cabecera, handle y todas las pills quedan fuera del cuerpo desplazable. Solo `.filtros-mobile-body` desplaza contenido y nunca inicia el gesto de cierre.
- Swipe comienza únicamente en handle/cabecera, excluye controles interactivos, cancela si predomina el eje horizontal y cierra con `dy ≥72px` o con `dy ≥24px` y velocidad descendente `≥0,5px/ms`.
- Escape y backdrop cierran; Tab queda contenido por E04; el foco inicial va a `Cerrar` y vuelve al disparador exacto (`Buscar` o `+N`) si este sigue conectado.
- Mientras el Sheet está abierto, hay foco en un campo o se detecta teclado virtual, la auto-ocultación se congela. `visualViewport.height/offsetTop` limita y desplaza la hoja sobre el teclado.
- El bloqueo E04 conserva scroll exacto y el ancho útil: `box-sizing:border-box` y compensación del gutter evitan el salto al desaparecer la scrollbar.
- La hoja respeta `safe-area-inset-bottom`; la barra está en flujo/sticky, no fija al borde inferior, de modo que no tapa el footer.

## Pruebas de interacción

`tests/browser/e15-mobile-search.spec.ts` cubre ocho casos:

1. geometría `360×800`, `390×844`, `768×1024` y horizontal `844×390`, targets y ausencia de overflow;
2. pills largas/numerosas, medición, `+N`, todas las pills dentro del Sheet y foco exacto;
3. hide/show de barra con umbral ascendente de 24 px sin reactivar el header;
4. scroll/gutter, cabecera fija, cuerpo desplazable, Radar colapsado, cambio inmediato y Back/Forward;
5. pointer/mouse: cancelación horizontal, no inicio desde cuerpo y cierre vertical válido;
6. touch nativo Chromium mediante CDP con contexto `hasTouch:true`;
7. `visualViewport` reducido, backdrop, tres aperturas/cierres y restauración exacta de scroll.
8. una reducción de `visualViewport` sin foco de campo no bloquea la reaparición de `Buscar`; esto distingue el chrome del navegador del teclado virtual.

En anchos de `380px` o menos, la paginación mantiene una única fila con Anterior, página actual y Siguiente; los controles conservan targets de 44 px y las páginas restantes siguen disponibles mediante los controles de navegación.

También permanecen verdes las pruebas E04/E12/E13/E14 de Escape, foco, pila modal, estado/URL, resultados, header y overlays.

## Matriz navegador/dispositivo ejecutada

| Motor/superficie | Cobertura | Resultado |
| --- | --- | --- |
| Chromium desktop/pointer | 360, 390, 768, 844 horizontal; mouse, teclado, Back/Forward | PASS 7/7 E15 |
| Chromium touch emulado | 390×844, eventos táctiles nativos CDP, swipe desde header | PASS |
| Chromium `visualViewport` | reducción reproducible a 500 px, reapertura ×3 | PASS |
| Firefox Playwright | intento de suite E15 | No ejecutado: binario `firefox-1497` no está instalado |
| WebKit Playwright | intento del caso responsive | No ejecutado: binario `webkit-2227` no está instalado |
| iOS Safari / Android Chrome físicos | — | Pendiente de E21/staging; este entorno no expone dispositivos físicos |

No se confirmó una diferencia funcional de navegador. La limitación de matriz se reproduce mínimamente con:

```sh
npx playwright test tests/browser/e15-mobile-search.spec.ts --browser=firefox --workers=1
npx playwright test tests/browser/e15-mobile-search.spec.ts --browser=webkit --workers=1
```

Ambos comandos fallan antes de abrir la página con `Executable doesn't exist`; no es un fallo de E15. Para la prueba táctil Chromium, `hasTouch:true` debe existir al crear el contexto: activarlo después de cargar la página no representa fielmente la negociación de eventos pointer/touch.

## Verificación local

- `npx playwright test tests/browser/e15-mobile-search.spec.ts tests/browser/e13-results-composition.spec.ts --workers=1` — PASS, 14/14 tras el ajuste de aviso sin criterios, viewport sin foco y paginación estrecha.
- `npx playwright test tests/browser/e12-search-state.spec.ts --workers=1` — PASS, 3/3.
- `npx playwright test tests/browser/catalogo.spec.ts tests/browser/e12-search-state.spec.ts tests/browser/e13-results-composition.spec.ts tests/browser/e15-mobile-search.spec.ts --grep 'E04|E12|E13|E14|E15' --workers=1` — PASS, 27/27.
- `npm run test:browser -- --workers=1` — 52 PASS, 2 omitidas por flags de staging/legacy y una carrera intermitente E14 al enfocar el campo fixture después de 18 pruebas. El caso E14 pasó 3/3 aislado y la matriz relevante E04/E12/E13/E14/E15 pasó 27/27; no se modificó `Header.svelte` en E15.
- `npm test` — PASS, 39/39.
- `npm run build` — PASS.
- `git diff --check` — PASS.

## Limitaciones y rollback

E21 debe completar Safari/WebKit, Firefox, Android Chrome e iOS Safari reales, especialmente teclado virtual, rotación con teclado abierto, safe area y elastic scroll. No hay un problema reproducible pendiente de pointer/`visualViewport` en Chromium que active la escalada de modelo.

Rollback: retirar `ActiveSearchPills.svelte`, la composición/gestos E15 de `src/routes/+page.svelte`, el ajuste de gutter en `src/lib/ui/overlay.ts` y la prueba E15. No hay migraciones, datos ni estado remoto que revertir.
