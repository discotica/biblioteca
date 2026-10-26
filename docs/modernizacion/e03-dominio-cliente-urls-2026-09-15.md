# Expediente E03 — dominio de cliente y política única de URLs

Fecha de ejecución: 2026-09-15 (America/Bogota)  
Etapa: E03 — Dominio de cliente y política única de URLs  
Estado: **aceptada; GO explícito emitido para sus etapas dependientes**  
Decisión de salida: **GO explícito de E03 → E05, E11 y E16.** La evidencia de verificación y el paquete de relevo de este expediente son la entrada vigente para esas etapas.  
Entrada: E02 con GO explícito; producción, SQL, RLS y escrituras de base sin cambios

## Resultado

El cliente ya tiene un dominio `Release` independiente de las columnas TSV/Supabase. Los adaptadores legacy y canónico convergen en ese dominio, conservan UUID/slugs/posiciones de créditos y mantienen los campos visuales históricos únicamente como compatibilidad temporal para las pantallas anteriores a E05/E16.

La política de URL vive en un solo resolvedor. `/?modal=[slug]`, `/lanzamiento/[slug]`, crates y la obtención de `release_id` usan `public.resolve_release_slug(text)` y, por tanto, la prioridad atómica de E02:

1. slug canónico publicado;
2. alias único visible;
3. cero filas para alias ambiguo, draft, archivado o inexistente.

Una respuesta de cero filas nunca se completa buscando “el más parecido” en TSV. El adaptador legacy solo actúa como rollback si el RPC falla técnicamente y el slug identifica exactamente una fila TSV. No se alteraron escrituras, policies, RLS ni semántica de aliases.

## API de dominio para E05, E11 y E16

### Tipos

Exportados desde `src/lib/domain/releases.ts`:

- `Release`
- `ArtistCredit`
- `CreditQuality = 'legacy' | 'proposed' | 'verified'`
- `ReleaseType = 'Álbum' | 'EP' | 'Single' | 'Compilado' | 'Sample Pack'`
- `ReleaseDateValue`
- `ReleaseSource = 'legacy' | 'canonical'`

`Release.id` es `string | null`: siempre UUID en canónico y `null` únicamente para una fila TSV todavía no resuelta. `Release.slug` es canónico en Supabase y el slug legado explícito en el adaptador TSV. `legacySlug` nunca sustituye a `id` en una relación nueva.

Cada `ArtistCredit` conserva:

```text
id, slug, name, position
```

El adaptador canónico consume primero `primary_artists` y `collaborators`; `artists` es fallback temporal solo si el grupo principal v2 falta. El adaptador TSV convierte todos los nombres en principales, deja colaboradores vacío y fija `creditQuality='legacy'`.

### Funciones puras

- `adaptCanonicalRelease(row)`
- `adaptLegacyRelease(row)`
- `normalizeReleaseType(value)`
- `normalizeReleaseDate(value)`
- `legacyReleaseSlug(title, firstArtist)`, única función autorizada para reconstruir una URL histórica
- `allArtistCredits(release)`
- `releaseHasArtistSlug(release, slug)`
- `findArtistCredit(release, slug)`
- `releaseArtistPresentation(release)`

`releaseArtistPresentation` devuelve `Varios artistas` para todo `Compilado` sin borrar sus relaciones. Tarjeta, modal y ficha activan la misma presentación mínima; E05 sigue siendo responsable de la composición visual definitiva de los dos grupos.

### Repositorio

Exportado desde `src/lib/utils/catalogoStore.ts`:

- `fetchReleases(fetchFn?) -> Promise<Release[]>`
- `fetchCatalogPage(page?, pageSize?) -> Promise<Release[]>`
- `resolveReleaseBySlug(slug) -> Promise<ReleaseResolution>`
- `resolveReleaseId(slug) -> Promise<string | null>`
- `findReleasesByArtistSlug(slug) -> Promise<{ artistName, releases }>`
- `findReleasesByLabelSlug(slug) -> Promise<{ labelName, releases }>`
- `fetchReleasesForCrate(releaseIds, slugs) -> Promise<Release[]>`
- `parseLegacyCatalogTsv(tsv) -> Release[]`

Una resolución exitosa entrega por separado:

```text
requestedSlug, releaseId, canonicalSlug, matchKind, aliasKind, release
```

Esto impide confundir el alias recibido con la identidad o URL canónica. `ReleaseResolution.status='unresolved'` agrupa deliberadamente inexistente y ambiguo porque ese es el contrato público de E02.

Se conservan aliases nominales (`Lanzamiento`, `fetchLanzamientos`, `findLanzamientoBySlug`, `resolveCanonicalReleaseId`, `fetchCanonicalCrateReleases`) solo para compatibilidad de imports externos no inventariados; los consumidores migrados ya usan la API E03.

## Matriz de compatibilidad

| Entrada | Adaptación/lookup | Identidad resultante | URL/presentación | Estado |
| --- | --- | --- | --- | --- |
| Vista canónica v2 | `adaptCanonicalRelease` | UUID + slug canónico | conserva créditos y fecha ISO/presentación | soportado |
| Vista canónica con solo `artists` | fallback explícito | UUID + slug canónico | nombres pasan a principales `legacy` | temporal |
| TSV legado | `adaptLegacyRelease` | `id=null`, `legacySlug` | todos principales; sin inferir colaboradores | temporal/rollback |
| Slug canónico | RPC E02 | UUID del canónico | `matchKind=canonical` | soportado |
| Alias único de migración | RPC E02 | UUID + slug canónico | `matchKind=alias`, `aliasKind=migration` | temporal |
| Redirect editorial único | RPC E02 | UUID + slug canónico | `matchKind=alias`, `aliasKind=editorial_redirect` | permanente |
| Colisión canónico/alias | RPC E02 | gana canónico | no consulta/parsing paralelo | soportado |
| Alias ambiguo | RPC devuelve cero | ninguna | `unresolved` | no se adivina |
| Desconocido/draft/archivado | RPC devuelve cero | ninguna | `unresolved` | no visible |
| RPC indisponible + TSV único | fallback legacy | sin UUID; solo lectura | `matchKind=legacy` | rollback |
| RPC indisponible + TSV duplicado | fallback legacy | ninguna | `unresolved` | no se adivina |
| Crate v2 | lookup por `release_id` | UUID | slug solo compatibilidad | preferido |
| Crate histórico | mismo resolvedor por `lanzamiento_slug` | UUID si único | alias/canónico según RPC | temporal |

## Consumidores migrados

- Home/búsqueda: carga por repositorio, fechas centralizadas, búsqueda incluye principales y colaboradores, modal directo usa el resolvedor común.
- `/lanzamiento/[slug]`: usa `resolveReleaseBySlug`; ya no redirige ni interpreta slug por su cuenta.
- Tarjeta, modal y ficha: consumen `Release`, fecha común, slug común y slug canónico de artista cuando existe.
- `/artista/[slug]`: usa créditos v2 de ambos grupos; un colaborador obtiene discografía navegable.
- `/sello/[slug]`: usa el repositorio y normalizador único de identidad visible.
- Crates: priorizan `release_id`; los slugs históricos se resuelven por la política única y no se reconstruyen desde título/artista.
- Selector Añadir a crate: obtiene el UUID por `resolveReleaseId` antes de una escritura nueva.
- `Filtros.svelte` y la ruta histórica `/OTROS`: usan fecha/créditos del dominio y dejaron de leer fuentes crudas directamente.

## Consumidores restantes y relevo

No queda un consumidor ejecutable con parser propio de fecha de release o reglas propias de alias. `src/routes/artista/_+page copy.svelte` es un archivo de respaldo que SvelteKit no enruta ni incluye en el build; conserva código histórico y no debe reutilizarse.

### E05

- Usar `primaryArtists`, `collaborators`, `creditQuality` y `releaseArtistPresentation`.
- No inferir colaboradores cuando `creditQuality='legacy'`.
- Los enlaces deben preferir `ArtistCredit.slug`; `id` queda disponible para keys/consultas.
- E03 solo dejó la presentación mínima de `Compilado`; E05 implementa la jerarquía visual y accesible final.

### E11

- El motor puro recibe `Release[]`; no recibe filas Supabase ni TSV.
- Para coincidencia textual de persona usar `allArtistCredits`, no el campo temporal `artist`.
- Para fecha/orden usar `releaseDate.timestamp`, `year` y `month`; no volver a parsear strings.

### E16

- El contenido compartido recibe un `Release` ya resuelto.
- La ruta recibida se conserva en `ReleaseResolution.requestedSlug`; enlaces compartidos usan `canonicalSlug`/`release.slug`.
- Fecha, identidad, créditos y presentación deben salir de los helpers E03; no duplicar formateadores.

## Pruebas ejecutadas

| Verificación | Resultado |
| --- | --- |
| `npm test` | PASS, 22/22 |
| `npm run test:browser` | PASS, 7/7; 2 suites condicionadas omitidas sin su flag |
| `VITE_CATALOG_SOURCE=legacy npm run test:browser -- tests/browser/e03-legacy.spec.ts` | PASS, 1/1; home TSV y URL heredada convergen en canónico |
| `VITE_CATALOG_SOURCE=canonical npm run test:browser -- tests/browser/e01-staging-canonical.spec.ts` | PASS, 1/1 contra staging |
| `npm run build` | PASS, adapter-static |
| Lectura staging: alias único → RPC | `match_kind=alias` |
| Lectura staging: slug canónico del mismo release → RPC | `match_kind=canonical` y mismo UUID |
| Lectura staging: alias ambiguo `eqetamine-eq` → RPC | cero filas |
| Lectura staging: vista v2 | principales/colaboradores arrays y calidad `legacy` |

Las 12 pruebas nuevas de dominio cubren adaptadores canonical/legacy, tipos, fechas válidas/nulas/imposibles, Compilado, colaboradores, alias único, colisión, ambigüedad, fallback y estabilidad UUID/slug. Las pruebas Playwright cubren home, tarjeta/modal, ruta completa, reproductores, paridad alias modal/ruta, alias no resuelto y discografía de colaborador.

## Criterios de aceptación

- **Ningún componente nuevo conoce columnas Supabase ni parsea TSV:** cumplido; esas fronteras están en adaptadores/repositorio.
- **Cambiar un crédito no cambia release, slug ni crate:** cumplido por contrato y prueba.
- **Modal/ruta resuelven igual canonical, alias único, colisión y desconocido:** cumplido por resolvedor compartido, unidad, Playwright y lectura staging.
- **Colaboradores tienen discografía navegable:** cumplido en `findReleasesByArtistSlug` y prueba pura.

## Rollback

No hay datos que revertir. Para rollback de cliente:

1. mantener `VITE_CATALOG_SOURCE=legacy`;
2. restaurar los imports de consumidores al alias temporal `fetchLanzamientos` si una etapa posterior aún no adopta `Release`;
3. conservar el resolvedor RPC para no reintroducir elecciones ambiguas;
4. si el RPC está caído, el fallback TSV único sigue disponible sin escritura.

No hubo SQL, cambios de policies/RLS, migración, producción, commit ni push.
