# R2 — Errores visibles menores (2026-10-05)

Etapa R2 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md). Sin commit ni push. No cambia el contrato de datos.

## Regla de créditos (para U4 y U8)

`src/lib/domain/releases.ts`:

```ts
export const VARIOUS_ARTISTS_LABEL = 'Varios artistas';

summarizeReleaseCredits(release: Pick<Release, 'releaseType' | 'primaryArtists' | 'collaborators'>): ReleaseCreditSummary

interface ReleaseCreditSummary {
  various: boolean;        // true solo si releaseType === 'Compilado'
  names: ArtistCredit[];   // todos los principales (si no hay, los colaboradores)
  moreCount: number;       // colaboradores fuera de `names`
  moreLabel: string;       // "y N más" o ''
  label: string;           // "Varios artistas" | "A, B" | "A, B y N más" (sin truncar)
  credits: ArtistCredit[]; // principales + colaboradores, para menús y vistas completas
}
```

`releaseArtistPresentation(release)` sigue existiendo (`{ label, credits }`, usado por recomendaciones) y delega en la misma función.

| Caso | Resultado |
| --- | --- |
| Tipo Compilado (cualquier nº de artistas) | `various`, label "Varios artistas" |
| Un principal | "Luz" |
| Varios principales, sin límite | "Ana, Beto, Caro, Dani" |
| Principal(es) + N colaboradores | "Luz y 1 más", "Luz, Árbol y 3 más" |
| Sin principales, con colaboradores | nombre del colaborador, `moreCount` 0 |
| Sin créditos | `''` |
| Nombres largos | el dominio los devuelve completos; el truncado es CSS (`CreditSummary`: nombres con elipsis, "y N más" no se encoge) |

Quién la usa: `CreditSummary.svelte` (tarjeta), `ReleaseDetail.svelte` (ficha), `LanzamientoCard.svelte` (`manyArtists`, variante `detail` sin uso) y `releaseRecommendations.ts` (vía `releaseArtistPresentation`).

Consecuencias de la regla, a tener en cuenta en U8/U9:

- La tarjeta ya no abre menú salvo en Compilado. "y N más" es texto con `title` que lista a los colaboradores; **los colaboradores no son navegables desde la tarjeta**.
- La ficha lista todos los principales como enlaces y "y N más"; **los colaboradores siguen sin verse por rol hasta U9**.
- La tarjeta pierde la caja de 44 px de "Varios artistas": las filas con ese caso miden ~3 px menos y desplazan lo que está debajo (explica las diferencias en capturas de página completa).

## Los ocho puntos

1. Regla única, más pruebas de unidad en `tests/release-domain.test.mjs` (compilado, un principal, varios principales, principal con colaboradores, nombres largos, sin principales).
2. Espacio tras la coma: la coma va en su propio `span` (`.credit-summary__sep`, `.release-detail__artist-sep`) y la separación es `margin-inline-end`, no un espacio final.
3. Hoja de filtros a 390: causa en `Filtros.svelte`. `.clouds-row` usaba `1fr` (mínimo auto) y `.select-row` volvía a `1fr 1fr` a ≤480 px, y las etiquetas de país/género no se podían encoger. Ahora `minmax(0, 1fr)`, `min-width: 0` en `.cloud-campo`/`.campo`, y `.tag` con elipsis y `title`.
4. Enlace del éxito de registro: `--color-acento`, subrayado.
5. Portada rota o ausente: `CoverFallback.svelte` (logo dimmed, opacidad .2) y acción `coverFailure` en `src/lib/ui/coverFallback.ts`. Aplicado en tarjeta, ficha y miniaturas de recomendaciones.
6. `src/routes/+error.svelte` en español (404 y otros), con "Volver al catálogo".
7. `REPORT_STATUSES` y `reportStatusLabel` en `src/lib/services/problemReports.ts`; usados en `editorial/+page.svelte` (título y selector). Los valores enviados siguen siendo los de la base.
8. "Randomizar" → "Aleatorizar" en `RadarFiltros.svelte`.

## Archivos

Modificados: `src/lib/domain/releases.ts`, `CreditSummary.svelte`, `LanzamientoCard.svelte`, `ReleaseDetail.svelte`, `ReleaseRecommendations.svelte`, `Filtros.svelte`, `RadarFiltros.svelte`, `src/routes/auth/registro/+page.svelte`, `src/routes/editorial/+page.svelte`, `src/lib/services/problemReports.ts`.
Nuevos: `src/lib/components/CoverFallback.svelte`, `src/lib/ui/coverFallback.ts`, `src/routes/+error.svelte`.
Pruebas: `tests/release-domain.test.mjs`, `tests/browser/catalogo.spec.ts` (E05 a la regla nueva, coma, portada rota, portada con mock), `tests/browser/e16-release-detail.spec.ts` (texto "y 2 más"), `tests/browser/r2-hoja-filtros.spec.ts`, `tests/browser/r2-textos.spec.ts` (nuevos).
Suite visual: `tests/visual/support/data.ts` (`VARIOS_CARD_TITLE` pasa de 'Curation 03', un EP con 6 principales, a 'HOUSEPULSE -43', un Compilado; el ID `card-varios-open-D` se conserva).

## Pruebas

- `npm test`: 57/57.
- `npm run build`: correcto.
- `npm run test:browser`: 101 pasan, 5 omitidas, 2 fallan: E17:99 (una vez, restauración de scroll; pasa en las corridas del archivo) y E17:198 (conocido). Dentro del archivo E17 también falla E17:178 de forma determinista; aislado pasa. Con la acción `coverFailure` neutralizada el resultado es idéntico, así que no es de R2; no se probó contra un árbol anterior a R2.
- Prueba nueva de la hoja a 390: reproducía el desborde (nube de Género a 782 px) y pasa tras el arreglo.

## Visual

Antes de editar: 14 diferencias, todas de R1 (la línea base es de 19:24 y R1 tocó ficha y menús a las 19:58).
Después: 53 diferencias, 0 errores. No se recapturó la línea base: absorbería además las diferencias de R1 sin revisión. Conviene revisar R1 y R2 juntas y ejecutar `npm run visual:capture`.

| Capturas | Motivo |
| --- | --- |
| 404-D, 404-M | punto 6 |
| registro-success-D | punto 4 |
| editorial-admin-D, editorial-admin-M | punto 7 |
| home-radar-D, home-radar-results-D, home-sheet-radar-M, home-search-suggest-D | punto 8 (y créditos en tarjetas visibles) |
| modal-nocover-D, modal-soundcloud-D | punto 5 (también R1) |
| card-row-D/T/M, card-collab-D, card-two-D, card-varios-open-D, artista-D/M, sello-D/M, crate-D/M, home-D/T, header-menu-D, home-approx-D, home-beta-D, home-filtered-panel-D, home-full-D/M/T, home-page2-D, home-scrolled-M, home-search-D, home-search-pais-D, home-search-tipo-D | puntos 1 y 2: créditos de tarjeta y desplazamiento de ~3 px |
| ficha-D, ficha-M, ficha-comp-D, modal-M, modal-D, modal-T, modal-1100-D, modal-bottom-D, modal-crate-D, modal-longtitle-D, modal-radar-D, modal-review-D, modal-spotify-D, modal-tablet-landscape-T, modal-varios-D, debug-modal-overlap | puntos 1 y 2 en la ficha (todos los principales); las de modal ya difería R1 |

No cambia `home-sheet-M`: el desborde de la hoja solo aparece con opciones largas, que los datos del censo no tienen; lo cubre la prueba de navegador.

## Fuera de alcance, detectado

- `ReleaseDetail.svelte`: el separador " / " entre países tiene el mismo recorte de espacios (se ve "Chile/Libano"). No es de créditos; sin tocar.
- Los textos "crates" siguen para U3.

## Adenda (2026-10-05): clic en tarjeta, fluidez y reproductor

Pedido aparte de R2, a partir de uso real.

- **Clic en tarjeta.** El área de información entera abre el lanzamiento: el enlace del título se estira (`.info--grid .titulo-link::after`) y los controles (créditos, país, sello, géneros, compartir) quedan por encima con `z-index: 2`. La portada conserva su enlace y su hover de radar. Sin cambios de píxeles.
- **Latencia.** `abrirModal` en `src/routes/+page.svelte` hacía dos viajes seguidos a Supabase (resolver slug + lectura por id) antes de mostrar la ficha, aunque la tarjeta ya traía el lanzamiento canónico. Ahora abre al instante si `source === 'canonical'` y tiene `id`; solo las filas legado pasan por el resolver. Con 600 ms de red simulada la ficha abre sin esperarlos. Medido con el catálogo completo y red sin retraso: abrir ficha 232 ms, página siguiente 175 ms, filtrar 65 ms.
- **Carga del catálogo.** `fetchReleases` pedía las 3 páginas de 1000 filas una tras otra; ahora la primera trae el total (`count: 'exact'`) y el resto va en paralelo. No medido contra el backend real.
- **Bandcamp.** Altura 380 → 290 (decisión del 2026-10-05): cabe una lista de ~5 pistas; las más largas hacen scroll dentro del reproductor. Actualizadas las pruebas E16, R1 y de dominio. Alternativa descartada por ahora: guardar el nº de pistas en el catálogo para una altura exacta.
- **Pruebas nuevas:** `tests/browser/tarjeta-clic-y-latencia.spec.ts` (clic en blanco a 1440 y 390, controles que no abren la ficha, apertura sin esperar a la red). Fallan sin los arreglos.
- **Visual:** 55 diferencias; las 2 nuevas respecto al cierre de R2 son `modal-mid-M` y `modal-bottom-M` (marco de Bandcamp más bajo).
