# Expediente E05 — Créditos públicos en tarjetas y páginas de artista

Fecha de ejecución: 2026-09-16 (America/Bogota)  
Etapa: E05 — Créditos públicos en tarjetas y páginas de artista  
Estado: completa en local; lista para revisión/aceptación de E05

## Alcance realizado

- `CreditSummary.svelte` presenta exclusivamente los dos grupos del `Release` E03: `Artistas principales` y `Colaboradores`.
- En tarjetas: 1–3 principales se enlazan en orden; cuatro o más, y todo `Compilado`, usan `Varios artistas`. Un colaborador se presenta separado por una línea vertical; dos o más usan el control. Si ambos grupos requieren resumen, existe un solo control cuyo menú los separa semánticamente.
- El control reutiliza `dropdownMenu` de E04 para foco inicial, Escape, clic exterior y retorno al disparador. Los enlaces usan únicamente `ArtistCredit.slug`; no reconstruyen identidad ni URL.
- Las páginas de artista conservan la discografía de ambos roles entregada por E03 y, al renderizar tarjetas, reciben el mismo resumen público sin duplicar releases.
- Créditos ausentes no se sustituyen ni se infieren: no se renderiza un bloque de créditos.
- La tarjeta limita créditos a dos líneas visuales y título a tres; incorpora truncado y `overflow-wrap:anywhere`. La portada mantiene borde superior recto y el panel de información tiene esquinas inferiores exteriores redondeadas.
- Se corrigió una carrera ya presente en el home: el filtrado diferido se cancela al desmontar, para que un enlace de artista no sea sobrescrito de vuelta a `/` tras navegar.

## Fixtures y cobertura E05

Los fixtures Playwright cubren:

- un principal + un colaborador;
- dos principales + un colaborador;
- un principal + dos colaboradores;
- cuatro principales no compilado;
- compilado;
- créditos ausentes, nombres/título largos;
- teclado sobre enlaces y `Varios artistas`;
- 360, 390, 768 y 1440 px, sin scroll horizontal.

## Relevo a E16 y QA

Superficies actualizadas: tarjeta de lanzamiento en home, resultados, sello, crates y página de artista (por su uso compartido de `LanzamientoCard`). La página de artista ya incorpora ambos roles mediante `findReleasesByArtistSlug` E03; E05 no añadió consulta ni deduplicación paralela.

Estados cubiertos: principal único/múltiple, colaborador único/múltiple, cuatro principales, compilado, ambos grupos resumidos, crédito ausente, nombres y títulos largos, navegación por teclado y anchos objetivo.

Pendiente visual para E16: modal y página completa conservan su presentación previa de créditos; E05 no los modifica por contrato. E16 deberá componer su ficha compartida desde `primaryArtists`, `collaborators` y `releaseArtistPresentation`, manteniendo la jerarquía/copy de E05 donde corresponda.

## Verificación

| Comando | Resultado |
| --- | --- |
| `npm run test:browser -- tests/browser/catalogo.spec.ts --grep E05` | PASS, 3/3 |
| `npm run test:browser` | PASS, 17/17; 2 suites de staging condicionadas omitidas sin su flag |
| `VITE_CATALOG_SOURCE=legacy npm run test:browser -- tests/browser/e03-legacy.spec.ts` | PASS, 1/1; compatibilidad TSV/URL heredada |
| `npm test` | PASS, 22/22 |
| `npm run build` | PASS, adapter-static |
| `git diff --check` | PASS |

## Criterios de aceptación

- **Un colaborador encontrado identifica la tarjeta sin ocultar la autoría principal:** cumplido.
- **Dos grupos, orden/copy y reglas de compilado/resumen:** cumplido.
- **Máximo dos líneas de créditos y tres de título, sin scroll horizontal en los cuatro anchos:** cubierto por prueba E05.
- **Nombres completos accesibles, enlaces canónicos independientes y menú por teclado:** cubierto por prueba E05 y la primitiva E04.

## Rollback

Revertir `CreditSummary.svelte` y su uso en la rama de tarjeta restaura solo la presentación anterior. No hubo SQL, esquema, RLS, datos, producción, commit ni push.
