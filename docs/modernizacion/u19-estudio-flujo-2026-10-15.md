# U19 — Flujo del Estudio y diccionarios (2026-10-15)

Paso 11b del [plan de lanzamiento](../producto/plan-lanzamiento-2026-10-13.md#paso-11b--u19-flujo-del-estudio-y-diccionarios). Va después del NO-GO de [E21-rc2](./e21-rc2-2026-10-15.md) y antes de E21-rc3.

Lo origina la lista de correcciones del Estudio que el usuario anotó al usarlo en staging. Hubo cinco rondas de preguntas el 2026-10-15, y las decisiones están en [`decisiones.md`](./decisiones.md#u19--flujo-del-estudio-y-diccionarios-2026-10-15). **El usuario decidió hacerlo todo antes de rc3**, así que cada punto de este expediente cuenta como P1.

## Estado

| Grupo | Contenido | Estado |
| --- | --- | --- |
| G1 — Servidor | Listas cerradas, alias, validación, aceptar sin altas implícitas, radar en la propuesta, duplicados por enlace | Aceptado el 2026-10-15, sin commit (ver [contrato](#contrato-del-servidor-g1)) |
| G2 — Sugerir | Un solo flujo para crear, para todos los roles; sello obligatorio; textos; radar opcional | Abierto |
| G3 — Cola en el editor | Admin y colaborador corrigen en el editor; el autor edita hasta que alguien la toma; artistas nuevos en los créditos; RC2-P1-01 | Abierto |
| G4 — Diccionarios | Pantalla de admin: crear, renombrar, fusionar con alias y borrar huérfanos | Abierto |
| G5 — Staging | Migraciones de G1 a G4 aplicadas en staging y recorrido corto | Abierto |

## Lo que hay hoy (verificado en el código y en staging)

### U19-01 — Los artistas nuevos se pierden al pasar de Sugerir al Estudio

[`ReleaseEditor.svelte`](../../src/lib/components/estudio/ReleaseEditor.svelte) `applyHandoff` solo pone en los créditos los artistas que ya existen. Los demás quedan como texto en el aviso «Datos traídos de Sugerir. Aún no existen en el catálogo, créalos aquí: …».

El usuario lo encontró con un compilado: los artistas que había añadido en Sugerir no aparecían en los créditos del borrador. Lo mismo pasa con géneros, países y sello.

### U19-02 — Aceptar una propuesta crea lo que traiga, sin control

`review_contribution` ([`20260918182853_e09_contribution_contract_v2.sql`](../../supabase/migrations/20260918182853_e09_contribution_contract_v2.sql)):
- inserta artistas, géneros, países y sello por nombre cuando no existen;
- publica directamente (`status = 'published'`).

Sugerir permite escribir géneros y países nuevos (`allowCreate`). El editor también permite crear géneros, desde un diálogo de alta auditada.

### U19-03 — Los diccionarios de staging ya vienen sucios de la hoja

| | Cantidad | Problemas |
| --- | --- | --- |
| Países | 47 | Duplicados: EE.UU, EEUU, Estados Unidos y USA; UK y Reino Unido. Valores que no son países: LATAM, WORLD, Entrañas, TSA. Países de fuera de la región: Alemania, Australia, Austria, Canada, Corea del Sur, España, Francia, Hungría, India, Islandia, Italia, Japón, Libano, Países Bajos, Pakistan, Rumania, Suecia, Suiza. Nombres sin tilde: Canada, Haiti, Libano, Pakistan, Republica Dominicana. |
| Géneros | 41 | Trip Hop y Triphop. |
| Sellos | 461 | No se revisaron uno por uno. Ningún lanzamiento publicado está sin sello: la importación ya lo exige. |
| Artistas | 4669 | No se revisaron uno por uno. |

La importación (`catalog_sheet_replace_import`) crea cualquier género o país que traiga la hoja. Por eso, cerrar las listas solo en la interfaz no basta: hay que cerrarlas también en el servidor y en la importación.

### U19-04 — Sugerir y el Estudio son dos maneras de crear

- «Nuevo lanzamiento» del Estudio abre un editor en blanco (`?nuevo=1`).
- Sugerir, en el caso de admin, termina mandando al editor con un traspaso por `sessionStorage` (`adminHandoff`).
- La pantalla final de Sugerir ofrece «Ver mis aportes» y «Sugerir otro», sin acceso al Estudio.

### U19-05 — Textos de Sugerir

- El eyebrow «Catálogo abierto» no aporta nada.
- La descripción se repite en los cuatro pasos.
- Los campos de selección dicen «ej. ambient» o «ej. colombia», cuando lo que esperan es elegir de una lista.

### U19-06 — La cola no se puede corregir

- Admin solo puede aprobar, pedir cambios o rechazar.
- El colaborador marca una propuesta como lista sin poder tocarla, aunque `prepare_contribution_for_admin` ya acepta un `working_payload`.
- El autor solo puede editar si le piden cambios.

### U19-07 — El sello es opcional en la propuesta y en el editor

Crear un sello en el editor abre un diálogo aparte que pide su propia observación.

### RC2-P1-01 — «Artista sin resolver» (E21-rc2)

Pasa a G3, porque está en el mismo editor. La carrera `artists = [...artists, ...(await …)]` está en [`ReleaseEditor.svelte`](../../src/lib/components/estudio/ReleaseEditor.svelte) `ensureArtists` y `applyHandoff`, y en [`estudio/catalogo/+page.svelte`](../../src/routes/estudio/catalogo/+page.svelte).

## Cómo queda el sistema

### Diccionarios

| | Quién crea | Desde dónde | Fuera de la lista |
| --- | --- | --- | --- |
| Géneros | Solo admin | Pantalla de diccionarios | No se puede elegir ni escribir. El servidor lo rechaza. |
| Países | Solo admin | Pantalla de diccionarios | No se puede elegir ni escribir. El servidor lo rechaza. |
| Sellos | Cualquiera que proponga o edite | El campo del lanzamiento: se crea al guardar o aceptar | Se crea, con un aviso de nombres parecidos antes. |
| Artistas | Cualquiera que proponga o edite | Los créditos: se crea al guardar o aceptar | Se crea, con un aviso de nombres parecidos antes. |

- **Países.** La lista seleccionable tiene los 33 estados independientes de Latinoamérica y el Caribe más Puerto Rico, con sus nombres en español y con tilde.
  - Los demás países que traiga la hoja se aceptan como **legado**: se conservan en los lanzamientos que los tienen, pero no se ofrecen al elegir ni aparecen en la búsqueda ni en los filtros públicos.
  - No hay valor «Diáspora».
- **«Independiente»** es un sello más. En Sugerir y en el editor aparece fijo al principio de la lista.
- **Alias.** Al fusionar, la grafía vieja queda como alias del valor que se conserva. La búsqueda, Sugerir y la importación de la hoja la traducen al valor conservado, así el duplicado no vuelve a entrar. Si se fusiona un artista o un sello, su URL vieja redirige a la del valor conservado.
- **Huérfanos.** Un artista o sello sin lanzamientos aparece en el filtro «Sin lanzamientos» de la pantalla de diccionarios, y se borra de a uno o en lote. Nada se borra solo.

### Un solo flujo para crear

```
Estudio «Nuevo lanzamiento» ─┐
Header «Sugerir» ────────────┴─▶ /sugerir: fuente → datos → nota → enviar
                                    │
          ┌─────────────────────────┼───────────────────────────────┐
     comunidad                 colaborador                         admin
  «Enviar a revisión»       «Enviar a revisión»              «Crear borrador»
   cola comunitaria          cola de colaborador         borrador en el catálogo
                                                         (con su historial, sin cola)
          │                         │                               │
  Sugerir otro ·            Sugerir otro ·             Añadir otro · Abrir el
  Ver mis aportes           Ir al Estudio              borrador · Ir al Estudio
```

- Los artistas y el sello que no existen viajan como nombres y se crean en la misma operación que guarda. Desaparecen el traspaso (`adminHandoff`) y el editor en blanco (`?nuevo=1` redirige a `/sugerir`).
- El radar es un campo opcional de Sugerir para todos. El equipo lo ajusta al revisar.
- **Duplicados.** Al detectar la fuente, si ese enlace ya está en el catálogo o en la cola, Sugerir lo dice y enlaza a lo existente antes de seguir. La comprobación devuelve solo si existe, en qué estado y, cuando está publicado, su ficha. Nunca muestra propuestas ajenas.

### La cola se corrige en el editor del Estudio

| Rol | Abre la propuesta en | Acciones finales |
| --- | --- | --- |
| Admin | El editor del Estudio, con todos los campos (radar, reseña, portada) | Guardar · Aceptar como borrador · Aceptar y publicar · Pedir cambios · Rechazar |
| Colaborador | El mismo editor, sin acceso al Catálogo | Guardar corrección · Marcar lista para admin |
| Autor | Sugerir (`?draft=`) | Guardar y reenviar, **solo mientras nadie la haya tomado** |

- **Tomada:** cuando alguien del equipo guarda la primera corrección, la marca lista o la acepta. Antes de eso, abrirla solo para mirar no la bloquea. Lo garantiza el servidor, no la interfaz.
- Aceptar crea el lanzamiento con los datos corregidos. Los artistas y sellos nuevos se crean en esa misma transacción, y la propuesta queda enlazada al lanzamiento.

## Contrato del servidor (G1)

**Cierre de G1 (2026-10-15).** Lo aceptó el usuario, que pidió no hacer commit todavía.
- **Verificado en el stack local aislado:**
  - `tests/sql/u19-g1-verify.sql`: 129 comprobaciones de los cuatro roles, con intentos negativos, y tres controles negativos que la hacen fallar;
  - las 12 verificaciones SQL anteriores (se adaptaron los fixtures de E06, E06-reopen y sheet-replace a las listas cerradas);
  - un ensayo con los diccionarios reales de staging, que comprobó fusiones, renombres y retirados;
  - la importación completa de la hoja con `--rollback`: 2.679 creadas, 110 rechazadas y ningún error SQL;
  - `npm test` 170/170, `build` y `lint:tokens`.
- **Pendiente:** `test:browser` ×2 y `visual:compare` con la máquina libre. La única corrida se hizo con carga de 60 a 110 y falló en specs que G1 no toca. G1 no cambia ninguna pantalla, y la referencia `tests/visual/.ref-pre-u19g1/` se conserva para esa comprobación.
- `scripts/e09-verify.mjs` y `e09-concurrency-verify.mjs` se actualizaron al contrato v3 para G5; solo corren contra staging.

Lo que G2, G3 y G4 necesitan saber del servidor, sin leer el SQL. Migraciones:
- [`20261015190000_u19_g1_closed_dictionaries.sql`](../../supabase/migrations/20261015190000_u19_g1_closed_dictionaries.sql): listas cerradas, alias y resolución;
- [`20261015190100_u19_g1_contribution_v3.sql`](../../supabase/migrations/20261015190100_u19_g1_contribution_v3.sql): propuesta v3, corrección, tomada, aceptar, alta directa y duplicados;
- [`20261015190200_u19_g1_import_closed_dictionaries.sql`](../../supabase/migrations/20261015190200_u19_g1_import_closed_dictionaries.sql): importación de la hoja.

Los tipos y la traducción de errores para la interfaz están en [`contributionContract.ts`](../../src/lib/domain/contributionContract.ts) (`describeContributionError`). Los envoltorios de los RPC, en [`contributionsStore.ts`](../../src/lib/stores/contributionsStore.ts).

### Diccionarios

- **`genres.status` y `countries.status`:** `selectable`, `legacy` o `retired`.

  | Estado | Se ofrece al elegir | Propuestas y editor | Importación | Donde ya está |
  | --- | --- | --- | --- | --- |
  | `selectable` | Sí | Se acepta | Se acepta | Se conserva |
  | `legacy` | No | Se rechaza si es nuevo para el lanzamiento | Se acepta | Se conserva |
  | `retired` | No | Se rechaza si es nuevo para el lanzamiento | Se rechaza | Se conserva hasta que la hoja lo corrija |

  Las tablas son de lectura pública, con el estado incluido. Lo que se ofrece al elegir es `status = 'selectable'`. Nadie cambia el estado por la tabla; G4 lo hace con sus RPC.
- **Sembrado** (aprobado por el usuario el 2026-10-15):
  - 36 géneros seleccionables, los de la hoja. Hard, Progresivo, Sample, Trip Hop y Triphop quedan como legado (solo existen en staging, en lanzamientos archivados).
  - 35 países seleccionables: los 33 estados, Puerto Rico y **LATAM**.
  - 20 países de legado.
  - Grafías corregidas: Haití, República Dominicana, Canadá, Líbano y Pakistán.
  - EE.UU, EEUU y USA quedan como alias de Estados Unidos, y UK de Reino Unido; en staging, sus lanzamientos pasan al valor conservado.
  - WORLD, Entrañas y TSA quedan retirados.
- **Alias:** `artist_aliases`, `label_aliases`, `genre_aliases` y `country_aliases` (`name` → valor conservado, `normalized_name` generado), con lectura pública.
  - Un alias no puede llamarse como un valor vivo del mismo diccionario (`23505 alias_matches_live_value`).
  - La resolución por nombre busca primero el valor vivo y después el alias, sin distinguir mayúsculas ni tildes.
- **Alias de slug:** `artist_slug_aliases` y `label_slug_aliases` (`slug` → artista o sello). Guardan la URL pública vieja, es decir, `slugifyReleaseIdentity` del nombre anterior. Los llena G4 al fusionar o renombrar, y las rutas `/artista/[slug]` y `/sello/[slug]` redirigen con ellos.
- **Artistas y sellos libres:** si no existen, se crean dentro del RPC que guarda, con su evento de alta auditado (`catalog_artist_change_events`, `catalog_dictionary_change_events`).
- **`--prune-dictionaries`** solo borra artistas, sellos y géneros o países retirados que nada usa. Las listas no se podan.

### Propuesta v3

```json
{
  "version": 3,
  "title": "…",
  "primary_artists": ["…"],
  "collaborators": ["…"],
  "release_type": "album | ep | single | compilado | sample-pack",
  "release_date": "AAAA-MM-DD",
  "genres": ["nombre de la lista"],
  "countries": ["nombre de la lista"],
  "label": "…",
  "radar": { "experimental": 0, "denso": 0, "sintetico": 0, "bailable": 0, "rapido": 0 },
  "team_note": "…",
  "review": "…",
  "cover_url": "https://…"
}
```

- Se acepta `version` 2 o 3 de entrada y siempre se guarda como 3. La interfaz actual, que envía 2, sigue funcionando; las claves desconocidas se descartan.
- **Validación:**
  - un borrador (`create`, `save`) se valida con lo que trae;
  - enviar, editar enviada, corregir, marcar lista, aceptar y el alta directa exigen la propuesta completa: título, un artista principal, tipo, fecha, un género, un país y sello.
- **Géneros y países** se resuelven por nombre o alias a un valor **seleccionable** y se guardan con su nombre canónico, sin repetidos.
- **Artistas** sin repetir (sin distinguir mayúsculas ni tildes) y nunca en los dos grupos. Se guardan como se escribieron; al aceptar se resuelven por nombre o alias y, si no existen, se crean.
- **Radar:** opcional. Si viene, lleva los cinco ejes como enteros de 0 a 5; un radar a medias se rechaza.
- **`review` y `cover_url`:** solo admin los cambia. Si otro rol los manda distintos de los guardados, el RPC falla con `42501 field_not_allowed`; si no los manda, se conservan.
- **Al aceptar:**
  - reseña = `review` o, si falta, `team_note` (como en E09);
  - portada = `cover_url` o, si falta, `detected_metadata.cover_url`;
  - enlace principal = `source_url`;
  - créditos = `proposed`.

### RPC

Todos son `security definer`, se llaman con `supabase.rpc` y solo los ejecuta `authenticated`: anon recibe `42501`. «Tomada» es `contributions.taken_at`, que el autor puede leer.

| RPC | Firma | Quién | Qué hace |
| --- | --- | --- | --- |
| `create_contribution_draft` | `(p_source_url, p_source_provider, p_payload = {}, p_detected_metadata = {})` → `contributions` | Cualquier sesión | Borrador propio. Valida lo que trae. |
| `save_contribution_draft` | `(p_contribution_id, p_source_url, p_source_provider, p_payload, p_detected_metadata = {})` → `contributions` | El autor, en `draft` | Guarda el borrador. Valida lo que trae. |
| `submit_contribution` | igual → `contributions` | El autor (comunidad o colaborador), en `draft` o `changes_requested` | Envía a la cola (`community` o `collaborator`). Exige la propuesta completa y deja `taken_at` vacío. |
| `update_submitted_contribution` | igual → `contributions` | El autor, en `pending` y sin tomar | Edita la propuesta enviada. Evento `updated`. |
| `save_contribution_correction` | `(p_contribution_id, p_expected_updated_at, p_payload, p_source_url = null, p_source_provider = null, p_note = null)` → `contributions` | Admin (`pending` o `ready_for_admin`); colaborador (cola de comunidad, `pending`, ajena) | Guarda la corrección en `payload` y la marca como tomada. Evento `corrected` con la nota. `p_source_url` null conserva la fuente. |
| `prepare_contribution_for_admin` | `(p_contribution_id, p_working_payload = {}, p_internal_note = null)` → `contributions` | Colaborador (cola de comunidad, `pending`, ajena) | Si `p_working_payload` no está vacío, lo guarda primero como corrección. Pasa a `ready_for_admin` y la marca como tomada. |
| `accept_contribution` | `(p_contribution_id, p_publish, p_expected_updated_at, p_note = null)` → `jsonb` | Admin, en `pending` o `ready_for_admin` | Crea el lanzamiento (`p_publish`: publicado o borrador) con artistas y sello nuevos en la misma transacción y una entrada `create` en el historial del catálogo. La propuesta queda `approved`, enlazada y tomada. Devuelve `{release_id, release_slug, status, catalog_version, change_set_id, contribution_id}`. |
| `review_contribution` | `(p_contribution_id, p_action, p_note = null)` → `contributions` | Admin, en `pending` o `ready_for_admin` | Firma de E09. `approved` acepta y publica, sin control de versión. `rejected` y `changes_requested` exigen nota y la marcan como tomada. |
| `admin_create_draft_from_suggestion` | `(p_source_url, p_source_provider, p_payload, p_detected_metadata = {}, p_reason = null)` → `jsonb` | Admin | «Crear borrador» de Sugerir: crea un borrador del catálogo, sin cola, con su entrada `create` en el historial (motivo `p_reason` o «Alta desde Sugerir»). Devuelve `{release_id, release_slug, status, catalog_version, change_set_id}`. |
| `check_source_duplicate` | `(p_source_url)` → `jsonb` | Cualquier sesión | `{match, state, release_slug, release_id, contribution_id}`. Ver abajo. |

**`p_expected_updated_at`** es el `updated_at` de la fila tal como lo devolvió PostgREST, como texto y con microsegundos. No hay que pasarlo por un `Date` de JS: pierde los microsegundos y el servidor respondería siempre `contribution_version_conflict`. Tras cada guardado, el siguiente usa el `updated_at` que devolvió el RPC.

**`check_source_duplicate`:**
- Compara el enlace normalizado: `https`, host en minúsculas, sin consulta ni fragmento, sin barra final y sin el segmento `/intl-xx` de Spotify.
- Busca primero en `release_links` (de cualquier estado) y después en la cola.
- La cola incluye las propuestas `pending`, `ready_for_admin` y `changes_requested`, más los borradores propios.
- Respuesta:
  - `match`: `none`, `catalog` o `queue`;
  - `state`: estado del lanzamiento o de la propuesta;
  - `release_slug`: solo si el lanzamiento está publicado;
  - `release_id`: solo para admin;
  - `contribution_id`: solo para el autor o admin.

  No expone nada más de una propuesta ajena.

**Errores.** Los RPC v3 mandan un código en `message` y, cuando aplica, el valor rechazado en `details`.

| SQLSTATE | `message` | Cuándo |
| --- | --- | --- |
| `42501` | (texto de E09) | Rol o dueño incorrecto, o anon |
| `42501` | `field_not_allowed` | Un rol que no es admin cambia `review` o `cover_url` (`details`: el campo) |
| `22023` | `genre_not_selectable`, `country_not_selectable` | Valor fuera de la lista o de legado (`details`: el valor) |
| `22023` | `title_required`, `primary_artists_required`, `release_type_required`, `release_date_required`, `genres_required`, `countries_required`, `label_required` | Falta un obligatorio al enviar, corregir o aceptar |
| `22023` | `title_invalid`, `primary_artists_invalid`, `collaborators_invalid`, `credit_in_both_groups`, `release_type_invalid`, `release_date_invalid`, `label_invalid`, `radar_invalid`, `team_note_invalid`, `cover_url_invalid`, `payload_invalid`, `payload_version_invalid` | Forma inválida |
| `22023` | (texto de E09) | Estado que no corresponde, como aceptar dos veces |
| `55000` | `contribution_taken` | El autor edita una propuesta ya tomada |
| `40001` | `contribution_version_conflict` | `p_expected_updated_at` no coincide: alguien guardó antes |
| `23514` | (texto de E06) | Publicar sin lo que exige un publicado: portada HTTPS, enlace principal, fecha, tipo, sello, artista, género y país |
| `P0002` | `Contribution not found` | Id inexistente |

### Catálogo (editor del Estudio)

- **`apply_catalog_payload`**, que usan crear, editar, revertir y aceptar:
  - un género o país nuevo para el lanzamiento tiene que ser seleccionable (`22023 genre_not_selectable` o `country_not_selectable`); lo que el lanzamiento ya tenía (legado o retirado) se conserva;
  - `admin_revert_catalog_change` está exenta y restaura tal cual;
  - `radar: {}` significa «sin radar»; un radar a medias se rechaza.
- Se retiró el trigger `audit_legacy_contribution_publication` de E06: aceptar escribe su propia entrada `create`, que el trigger duplicaba.
- `admin_create_catalog_genre` sigue, y el género que crea nace seleccionable (el valor por defecto de `status` es `selectable`). G3 retira su diálogo; G4 lo sustituye.

### Importación de la hoja

- `scripts/import-catalog.mjs` lee los diccionarios y los alias de la base de destino, también con `--dry-run` si hay `DATABASE_URL`. Sin base, el informe dice `dictionaries: 'not_checked'`.
- **Alias:** traduce los de géneros, países, sellos y artistas al nombre conservado.
- **Valores aceptados:** géneros y países seleccionables o de legado. Uno desconocido o retirado rechaza la fila con el mensaje «país desconocido: «WORLD». La importación no crea países; usa un valor de la lista o pide a admin que lo añada». El informe agrupa esos valores en `rejectedValues`, con sus filas.
- `private.import_catalog_release` aplica la misma regla como última barrera (`22023 genre_unknown` o `country_unknown`) y nunca crea géneros ni países.

**Con la hoja actual** (`83f29cda…`, sin cambios desde el paso 8), contra las listas sembradas en local, rechazaría 110 filas:

| Campo | Valor | Filas |
| --- | --- | --- |
| País | WORLD (escrito «WORLD» y «World») | 103 |
| País | Entrañas | 1 |
| País | TSA | 1 |
| — | Los 7 rechazos de siempre (6 sin título o artista y uno con radar fuera de rango) | 7 |

Las filas 677 y 2116 tienen los dos problemas (sin título y WORLD), por eso son 110 filas y 112 motivos. Los géneros de la hoja pasan todos.

La lista para corregir la hoja, con fila, `catalog_key`, artista, título y valor, está fuera del repositorio, en `../discotica-backups/2026-10-15-u19-g1/rechazos-hoja-actual.tsv`, junto al informe del dry run y sus `SHA256SUMS`.

## Grupos

Un chat por grupo, en este orden y nunca dos a la vez. Los prompts están en [`prompts-lanzamiento-2026-10-13.md`](../producto/prompts-lanzamiento-2026-10-13.md#paso-11b--u19-flujo-del-estudio-y-diccionarios). Cada grupo:
- termina con `npm test`, build, `lint:tokens`, dos corridas de `test:browser` y `visual:compare` revisado;
- deja sus migraciones verificadas en el stack local aislado, sin aplicarlas en staging (eso es G5);
- hace commit y push cuando el usuario lo acepta.

### G1 — Servidor: listas cerradas, alias y validación · Opus 5.5 `xhigh`

1. **Países.**
   - Se añade una marca de seleccionable (o un equivalente).
   - Se siembran los 33 estados más Puerto Rico con sus nombres correctos. Los que ya existen con otra grafía se renombran: Haiti → Haití, Republica Dominicana → República Dominicana.
   - El resto queda como legado.
2. **Alias** de artistas, sellos, géneros y países, y de slug para artistas y sellos, con RLS de solo lectura pública donde haga falta.
3. **Propuesta v3:**
   - sello obligatorio;
   - géneros y países solo seleccionables;
   - radar opcional (5 ejes, de 0 a 5);
   - validación en `create`, `save` y `submit`, y en el RPC de corrección.
4. **Aceptar.**
   - Desaparecen las altas implícitas de géneros y países.
   - Los nombres se resuelven por alias.
   - Artistas y sello se crean en la misma transacción.
   - Se puede aceptar como borrador o publicar.
   - El radar pasa a `release_radar`.
5. **Corrección y bloqueo.**
   - RPC para que el autor edite su propuesta pendiente mientras no esté tomada.
   - RPC para que colaborador y admin guarden una corrección, que la marca como tomada.
6. **Alta directa de admin desde Sugerir.** Crea un borrador del catálogo con artistas y sello por nombre, en una transacción y con su entrada en el historial.
7. **Duplicados por enlace.** RPC `security definer` que dice si un enlace está en el catálogo o en la cola, sin exponer propuestas ajenas.
8. **Importación.**
   - Resuelve alias.
   - Rechaza géneros y países desconocidos con un error claro en el informe, sin crearlos.
   - Acepta los países de legado.
9. **Pruebas:**
   - SQL de cada rol (anon, comunidad, colaborador, admin), incluidos los intentos negativos;
   - verificación en el stack local;
   - unitarias del dominio.

**Cierre de G1 (2026-10-15).** `npm test` 170/170, `build`, `lint:tokens` y `test:browser` ×2 (337 pasan, 5 omitidas). `visual:compare` dio 3 capturas distintas, todas por el botón «Estudio» del header: `perfil-admin-D`, `perfil-colab-M` y `sugerir-admin-D`. Se recapturaron solo esas tres. `lab-u6-D/M` y `estudio-propuesta-nota-D` salieron distintas en alguna corrida y quedaron iguales al repetirlas: son inestables con 4 workers, no son de G1.

### G2 — Sugerir: un solo flujo para crear · Opus 5.5 `high`

1. «Nuevo lanzamiento» del Estudio lleva a `/sugerir`. `?nuevo=1` redirige. Se retiran el traspaso y el editor en blanco.
2. El envío depende del rol (ver el diagrama), con su pantalla final.
3. Textos:
   - sin eyebrow;
   - la descripción solo en el paso 1, más corta;
   - los campos de selección dicen «Selecciona uno o más valores»;
   - el botón de enviar es claro y dice lo que hace en cada rol.
4. Géneros y países sin `allowCreate`, con la lista seleccionable.
5. Sello obligatorio, con «Independiente» fijo arriba y aviso de nombres parecidos al escribir uno nuevo. Lo mismo para los artistas nuevos.
6. Radar opcional en el paso de datos, reutilizando los controles del editor.
7. Aviso de duplicado al detectar la fuente.
8. Pruebas de navegador por rol y capturas del censo recapturadas.

### G3 — La cola en el editor · Opus 5.5 `xhigh`

1. El editor abre propuestas para admin y colaborador, con las acciones de la tabla según el rol. Propuestas enlaza al editor.
2. Créditos y sello aceptan nombres nuevos pendientes («se crea al guardar»), con aviso de parecidos. Se retiran el diálogo de alta de sello y la creación de géneros.
3. El autor edita su propuesta pendiente desde Mis aportes y Sugerir mientras no esté tomada. Si ya está tomada, lo ve y no puede editar.
4. RC2-P1-01: la lista compartida de artistas se fusiona por id, sin la carrera.
5. Pruebas de navegador: el compilado con artistas nuevos, la corrección del colaborador, aceptar como borrador y publicar, y el autor bloqueado.

### G4 — Pantalla de diccionarios · Opus 5.5 `high`

1. `/estudio/diccionarios`, solo para admin, con pestañas Géneros, Países, Sellos y Artistas.
2. Géneros y países: crear, renombrar, fusionar y marcar seleccionable o legado.
3. Sellos y artistas: renombrar, fusionar, ver los alias y el filtro «Sin lanzamientos», con borrado de a uno o en lote.
4. Cada operación es un RPC de admin auditado, con observación. Fusionar mueve las referencias en una transacción y deja el alias.
5. Las URL viejas de artista y sello redirigen.
6. Pruebas de servidor (intentos negativos de colaborador y comunidad) y de navegador.

### G5 — Aplicar en staging · Opus 5.5 `high`

Con la autorización del usuario y el método del paso 7:
- aplica las migraciones de G1 a G4 en staging;
- corre los advisors y las verificaciones de cada grupo;
- hace un recorrido corto con las cuatro cuentas: sugerir por rol, corregir en la cola, aceptar, fusionar un duplicado y borrar un huérfano de prueba.

Después, la hoja: el usuario la normaliza contra las listas cerradas (ver abajo) y el paso 8 se repite. Con esto, la importación ya rechaza lo que no esté en la lista.

## Lo que tiene que decidir el usuario

1. **Valores de la hoja que no son países** (LATAM, WORLD, Entrañas, TSA): qué país va en cada lanzamiento que los usa, o si se quedan sin país. Se resuelve en la hoja, junto con RC2-P1-02.
2. **Grafías de la hoja**: unificar EE.UU, EEUU, Estados Unidos y USA; UK y Reino Unido; Trip Hop y Triphop. Puede hacerse en la hoja o, después de G4, con alias. Como la hoja manda, lo más simple es corregirla.
3. **Lanzamientos sin sello en la hoja**: la importación ya exige sello. Si alguno usa otro nombre para lo autoeditado, pasa a «Independiente».

## Lo que no entra

- La comparación entre la versión del autor, la del colaborador y la que se publica. Se ofreció y el usuario no la eligió. Admin ve la propuesta corregida.
- El límite de propuestas pendientes por cuenta y el bloqueo visible al abrir una propuesta: tampoco se eligieron.
- RC2-P2-01 (`static/bu lanzamientos/`): sigue aparte, como P2.
