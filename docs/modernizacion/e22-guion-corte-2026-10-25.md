# E22 — Ensayo del corte (E22-A) y guion de E22-B — 2026-10-25

Paso 12 del [plan de lanzamiento](../producto/plan-lanzamiento-2026-10-13.md#paso-12--e22-a-ensayo-del-corte). Requiere el GO de E21-rc3 ([expediente](./e21-rc3-2026-10-25.md)).

- **Producción** (`ewntlvugbopokdrvnwvg`): solo se leyó. Hubo un inventario, un `pg_dump` y consultas en sesiones con `default_transaction_read_only = on`; en esas sesiones, un `create temp table` de prueba falló como debía. No hubo ninguna escritura, migración, función ni cambio de configuración.
- **El ensayo** se hizo sobre una copia restaurada en un stack local aislado (`discotica-e22a`, puertos 544xx).
- **Registros:** `../discotica-backups/2026-10-25-produccion/` (dump, inventarios, `ensayo/`) y `../discotica-backups/2026-10-25-e22-hoja/` (snapshot de la hoja), cada uno con `SHA256SUMS`.

## Resultado

**El corte se puede hacer.** Cada paso del orden de corte se ensayó de punta a punta sobre la copia y quedó en verde:

- la cadena de migraciones;
- la importación;
- las colecciones;
- el admin;
- RLS;
- la app con los flags del día;
- el rollback.

Antes de E22-B quedan dos cosas: aceptar los cambios al plan de rc3 de la sección 2 y lo pendiente de la sección 7.

| Comprobación | Resultado |
| --- | --- |
| Destino, con dos señales | El usuario del pooler lleva el ref `ewntlvugbopokdrvnwvg`, e `inet_server_addr()` = `2600:1f18:3036:4e00:faa5:7d75:8f73:f8d1`, igual al DNS de `db.ewntlvugbopokdrvnwvg.supabase.co`. PostgreSQL 17.6 |
| Dump | 51 s, 2,7 MB, 615 entradas TOC. Inventario de 58 tablas idéntico antes y después. Storage: 1 bucket (`contribution-covers`), 0 objetos |
| Restauración | Copia idéntica a producción: 58/58 tablas con filas y md5, y 317/317 líneas de estructura (políticas, funciones, ACL, índices, triggers y privilegios por defecto) |
| Migraciones | `repair` de la base y las 30 pendientes, una a una, sin errores. 36 aplicadas |
| Verificaciones SQL | 12/12 en verde sobre la cadena completa |
| Importación de la hoja congelada | 0 rechazos. 7 creados, 736 actualizados, 2.046 iguales y 8 archivados |
| Comprobaciones posteriores | 24/24 |
| Usuarios, perfiles, colecciones, ítems, propuestas | 2, 2, 1, 1 y 1, los mismos que en el origen. 0 ítems sin `release_id` |
| Catálogo frente a la fuente | 2.789 publicados = 2.789 filas válidas de la hoja (`e67e35e9…`). `catalog_releases` = 2.789 |
| Tabla de identidad | Los 10 pares viejo→nuevo y `dark-perreo-oh-margo` resuelven, cada uno a un único lanzamiento, como `anon` y por la misma RPC de la app |
| RLS | 43/43 intentos por API, con anon, comunidad, colaborador y admin. Matriz de políticas idéntica a la de staging. `anon` sin `EXECUTE` en las RPC de admin. Advisors: 0 `WARN`/`ERROR` |
| App con los flags del día | 13/14, y el que falla es el selector de la prueba (ver 4.6). Sin errores de consola ni respuestas ≥ 400 |
| Rollback de la app | El build con los flags seguros dio 14/14 sobre el esquema nuevo. El build que está hoy en vivo no usa Supabase y carga |
| Rollback de datos del catálogo | Ensayado en una transacción con `ROLLBACK`: las 78 tablas quedan idénticas |

## 1. Lo que hay en producción (2026-10-25, solo lectura)

| Dato | Valor |
| --- | --- |
| Migraciones en el historial | 5: `20260830192747`, `193838`, `202105`, `213000` y `233946` (fases 2, 4 y 5, del 30 de agosto). Falta `20260830000000` |
| Usuarios (`auth.users`) / perfiles | 2 / 2: `mamanche` (admin) y `jmamanche` (comunidad), los dos confirmados |
| Colecciones / ítems | 1 / 1: `discoticast-2025` (pública, de `mamanche`), con *Reflexiones* (Gabriella Olivo). El ítem ya tiene `release_id` |
| Catálogo | Es la carga de agosto: 2.790 publicados con clave, 6 rechazos, 4.669 artistas, 460 sellos, 70 géneros, 48 países y 2.790 alias |
| `private.legacy_crate_release_map` | 5.547 filas |
| Propuestas | 1: «EL RITMO CHANCLETA +remixes», de `mamanche`, `pending`, contrato v1 del 30 de agosto |
| Storage | `contribution-covers` (privado, 5 MB, jpeg/png/webp), 0 objetos |
| Privilegio global | **No tiene** `alter default privileges for role postgres revoke execute on functions from public` |
| Sitio en vivo | `origin/dist` = `3c137d7` («deploy: 0ab31e0»): `index.html` idéntico al servido (SHA-256 `37d92de8…`). **No usa Supabase:** el bundle no tiene URL, clave ni consultas, y lee el catálogo de Google Sheets |

## 2. Cambios al plan de corte de rc3

El [plan exacto de corte](./e21-rc3-2026-10-25.md#6-plan-exacto-de-corte-para-e22) partía de dos premisas que el ensayo desmintió:

1. «En producción no hay lanzamientos previos: todo entra como creado y no se archiva nada.»
2. Producción está en el esquema base.

| Plan de rc3 | Lo que pasa en realidad | Cambio |
| --- | --- | --- |
| `repair` de `20260830000000` y **35** migraciones | Producción ya tiene 5. Faltan la base, que se marca con `repair`, y **30** | `repair` y 30 `db push` |
| Verificación después de cada migración | Los scripts del repo prueban el esquema final: `e06-verify` ya exige E09, que se aplica después | Las verificaciones corren **después de la última migración** |
| La importación crea todo y no archiva nada | Empareja por clave con la carga de agosto, como en staging: **7 creados, 736 actualizados, 2.046 iguales y 8 archivados** (las 7 claves ausentes y `rel_001638`) | Se usa `--max-archive` por defecto (25), porque 8 ≤ 25. Se comprueba que la vista previa dé exactamente esos números |
| Migración nueva `e22_map_legacy_crate_items` | El único ítem ya tiene `release_id` desde agosto, y el importador conserva los UUID y añade los alias nuevos | **No hace falta.** La comprobación 8 (0 ítems sin `release_id`) lo cubre |
| `dark-perreo-oh-margo` apunta a dos lanzamientos | En producción, `rel_001638` nunca tuvo los datos de OH MARGÓ: el alias apunta solo a `rel_002797` | Nada que resolver |
| Se corrige RC3-P1-01 en la hoja antes de congelarla | **Decisión del usuario (2026-10-25):** la hoja se congela como está (`e67e35e9…`). Los 17 enlaces de Bandcamp en 404 y los títulos dañados se corregirán en la app, en producción, después del corte | Ver sección 6.3: no se vuelve a importar la hoja |
| Rollback de datos con el dump del mismo día | El dump de hoy es anterior a las migraciones: sus datos no encajan en el esquema nuevo | **Un segundo dump** después de migrar y antes de importar. De él sale `rollback-catalogo.sql` |
| Rollback de la app: revertir el último commit de `dist` | El build en vivo no usa Supabase. Revertir `dist` deja el sitio exactamente como está hoy, se haya migrado o no | Es la vía de rollback más simple. Ver sección 6 |

## 3. Comparación (punto 4 del paso 12)

- **No se pierde nada:** antes y después del corte ensayado hay 2 usuarios, 2 perfiles, 1 colección, 1 ítem y 1 propuesta, con los mismos id. Ningún lanzamiento se borra, ningún slug canónico cambia y no se pierde ningún alias (comprobaciones 5 a 7 y 10 a 14).
- **Ítems sin equivalencia única:** 0. El único ítem resuelve por su slug canónico y apunta a un publicado.
- **Enlaces legados ambiguos.** Son 17 slugs legados que comparten 2 o 3 filas de la hoja, con el mismo título y primer artista: 35 filas en total.
  - Cada lanzamiento tiene su alias, pero un enlace `/lanzamiento/<slug legado>` con más de un candidato da «no encontrado». No se adivina, como decidió la fase 3.
  - Ninguno está en una colección.
  - Lista: `ensayo/detalle-legado.txt`. Son `liquadora-syen` (×3), `aviario-entranas`, `corazon-club-vol-1-mj-nebreda`, `el-barrio-vol-2-toby`, `eqetamine-eq`, `flor-fase-figura-forma-final-el-mamu`, `la-ultima-rave-del-mundo-the-beginning-of-pozole`, `lo-ultimo-el-irreal-veintiuno`, `mega-macumbinha-do-jlz`, `phrase-vault-ice-breaker-sangam`, `ransomware-pvssy`, `ravers-dnza`, `saturno-y-la-luna-ene-ese`, `set-ultrarrapido-de-10-min-funk-jaijiu`, `the-gomboc-stone-nplnsss`, `viral-joaquin-ruiz` y `zero-crossnip`.
  - Es trabajo editorial: decidir si son filas duplicadas o lanzamientos distintos con el mismo título.
- **Catálogo frente a la fuente:** 2.789 publicados, igual a las filas válidas de la hoja congelada; 0 rechazos y 0 publicados sin clave.

| Tabla | Producción | Copia después del corte |
| --- | ---: | ---: |
| `releases` (total / publicados) | 2.790 / 2.790 | 2.797 / 2.789 |
| `catalog_import_keys` | 2.790 | 2.797 |
| `catalog_import_rejections` | 6 | 0 |
| `release_artists` | 9.298 | 9.332 |
| `release_genres` | 8.138 | 7.439 |
| `release_countries` | 2.966 | 3.007 |
| `release_links` / `release_covers` | 2.783 / 2.782 | 2.797 / 2.792 |
| `release_slug_aliases` | 2.790 | 2.807 |
| `artists` / `labels` / `countries` | 4.669 / 460 / 48 | 4.685 / 461 / 55 |
| Países / géneros seleccionables | — | 35 / 36 (listas cerradas de U19) |
| `crates` / `crate_items` / `profiles` / `auth.users` | 1 / 1 / 2 / 2 | 1 / 1 / 2 / 2 |

La poda de diccionarios quita 9 artistas con el texto dañado («YoReino Unido», «LReino Unidoro»…), los sellos MalReino Unidoo y BODY MUSIC, y los países WORLD, Entrañas y TSA. «Independiente» existe.

## 4. Hallazgos del ensayo

1. **E22A-01 (cambia el plan):** producción ya tiene las fases 2, 4 y 5 y la carga de agosto. Ver sección 2.
2. **E22A-02 (P2):** la propuesta v1 de agosto («EL RITMO CHANCLETA +remixes», tuya) tiene `queue_kind` nulo.
   - Cuenta en la insignia «Propuestas» del Estudio, pero no aparece en ninguna de las dos colas.
   - Se abre por enlace directo, con todas las decisiones: `/estudio/propuestas?editar=65e9879a-6328-4eae-b507-31b4604c63a6`.
   - Después del corte, decidirla desde ahí (rechazarla o aceptarla) deja la insignia en 0.
3. **E22A-03 (P2, editorial):** los 17 slugs legados ambiguos de la sección 3.
4. **E22A-04 (procedimiento):** `supabase functions list --project-ref ewntlvugbopokdrvnwvg` se quedó esperando más de 2 min y se cortó, probablemente pidiendo un login del CLI. En E22-B se corre a mano antes de desplegar funciones, para saber si producción ya tiene alguna.
5. **Sin cuenta de admin de recuperación en producción.** Hoy solo `mamanche` es admin, y la de recuperación no se puede crear antes del despliegue (ver B6): se registra en el sitio nuevo y después se le asigna el rol.
6. **Prueba de la cola en la app:** la primera corrida buscó filas de tabla en `/estudio/propuestas`, que es una lista. La captura (`dia-04-admin-estudio-propuestas.png`) muestra la cola comunitaria con la propuesta de prueba. Es un fallo de la prueba, no de la app.

## 5. Guion de E22-B

**Convenciones:**

- `REF=ewntlvugbopokdrvnwvg`.
- `$PROD` se carga de `E22_PROD_DATABASE_URL` (`.env.local`) y no se muestra nunca. La salida pasa por `sed -E 's#postgres(ql)?://[^ ]*#<url>#g'`.
- Cada escritura la autoriza el usuario en el chat. **Nunca `--linked`:** `supabase/.temp/project-ref` apunta a producción (E21-P2-02).
- Las lecturas van en sesiones que empiezan con `set default_transaction_read_only = on;`, porque el pooler ignora `PGOPTIONS`.
- **Tiempos:** «ensayo» es lo medido hoy en local. «Remoto» es la referencia por el pooler: lo medido en producción hoy, o en staging, que tiene el mismo tamaño de catálogo.
- Los scripts del ensayo están en `../discotica-backups/2026-10-25-produccion/ensayo/` y se reutilizan apuntando a `$PROD`.

### B0. Antes de empezar (todo solo lectura)

| # | Comando | `--project-ref` / destino | Resultado esperado | Ensayo | Remoto |
| --- | --- | --- | --- | --- | --- |
| B0.1 | Hoja: `curl` del TSV publicado (`gid=1229139332`) y `shasum -a 256` | — | `e67e35e9f9d9…943138`. Si cambia, **parar**: la hoja no está congelada | 2 s | 2 s |
| B0.2 | Señal 1: usuario del pooler de `$PROD` | `ewntlvugbopokdrvnwvg` | `postgres.ewntlvugbopokdrvnwvg`, `aws-1-us-east-1.pooler.supabase.com:5432` | — | 1 s |
| B0.3 | Señal 2: `select inet_server_addr()` frente a `dig +short AAAA db.$REF.supabase.co`, **rederivado ese día** | `$PROD` | Iguales. Hoy: `2600:1f18:3036:4e00:faa5:7d75:8f73:f8d1` | — | 3 s |
| B0.4 | `simulacro/inventory.sql` en solo lectura, comparado con `inventario-antes.txt` del 2026-10-25 | `$PROD` | Idéntico: el dump `db5279a0…` vale como backup del día. Si difiere: dump nuevo (B0.5) | — | 5 s |
| B0.5 | Solo si B0.4 difiere: `docker run --rm -e U … supabase/postgres:17.6.1.165 pg_dump "$U" -Fc -n public -n private -n auth -n storage -n supabase_migrations`, con inventario antes y después, y restauración de comprobación (`prep-target-produccion.sql` y `pg_restore`) | `$PROD` | Inventario idéntico; restauración = producción | 51 s + 1 min | 51 s |
| B0.6 | Copia del backup fuera de este disco y `shasum -a 256 -c SHA256SUMS` en el destino | — | `OK` en cada archivo | — | — |
| B0.7 | `supabase functions list --project-ref $REF` (a mano, ver E22A-04) | `ewntlvugbopokdrvnwvg` | Lista (vacía o no). Se anota | — | — |

### B1. Migración base y privilegio global

| # | Comando | `--project-ref` / destino | Resultado esperado | Ensayo | Remoto |
| --- | --- | --- | --- | --- | --- |
| B1.1 | Solo lectura: `profiles`, `crates` y `crate_items` (con `lanzamiento_slug`) existen; historial con 5 migraciones, la última `20260830233946` | `$PROD` | `t` y `5 \| 20260830233946`. Si no, **parar** | 0 s | 1 s |
| B1.2 | `supabase migration repair --status applied 20260830000000 --project-ref $REF --workdir <wd con esa migración>` | `ewntlvugbopokdrvnwvg` | «Repaired migration history». 6 en el historial. No ejecuta SQL | 4 s | ~10 s |
| B1.3 | `alter default privileges for role postgres revoke execute on functions from public;` | `$PROD` | `pg_default_acl` global: `{postgres=X/postgres}` | 0 s | 1 s |

### B2. Las 30 migraciones (método S9)

Desde `20260914221226` hasta `20261016180000`, en orden. Por cada una:

1. workdir temporal con las migraciones hasta esa (symlinks), `config.toml` y `templates`, y sin `.temp`;
2. `supabase db push --project-ref $REF --workdir $W --dry-run`: tiene que proponer **solo esa**;
3. `supabase db push --project-ref $REF --workdir $W --skip-vault`.

El bucle está en `ensayo/migrar.sh`. Para producción se cambia `--db-url "$L"` por `--project-ref $REF`.

| Resultado esperado | Ensayo | Remoto |
| --- | --- | --- |
| Cada push sin error. Al final, `migration list --project-ref $REF`: 36 aplicadas, local = remoto | 1,1–1,3 s por push y 89 s el bucle completo | ~35 s por migración (G5: 5 en 3 min). **~18 min** las 30 |

La única que toca datos de forma notable es `20260915204413` (créditos, tipos e identidad), sobre los 2.790 lanzamientos de agosto. En el ensayo tardó 1,2 s.

### B3. Verificaciones (después de la última migración)

| # | Comando | Resultado esperado | Ensayo | Remoto |
| --- | --- | --- | --- | --- |
| B3.1 | `e06-verify`, `e06-reopen-verify` y `e08-verify` | `DO` / `ROLLBACK`, sin `ERROR` | 0,1 s c/u | ~5 s c/u |
| B3.2 | `e18-verify`, `d1-verify`, `s7-verify`, `u18-h2-verify` y `catalog-sheet-replace-verify` | `NOTICE … OK` | 0,1 s c/u | ~5 s c/u |
| B3.3 | `d2-verify-staging.sql` (copia adaptada, `../discotica-backups/2026-10-25-paso8/analisis/`) | `D2 verify (staging): OK` | 0,7 s | ~10 s |
| B3.4 | `u19-g1-verify`, `u19-g3-verify` y `u19-g4-verify` | OK, con 129, 59 y 104 comprobaciones | 0,1–0,3 s | ~10 s c/u |
| B3.5 | Listas cerradas: países y géneros `selectable`; «Independiente» | 35, 36 y 1 | 0 s | 1 s |
| B3.6 | `db advisors --db-url "$PROD" --level info --type all --output-format json` | 0 `WARN`/`ERROR`. Ensayo: 55 `INFO` | 3 s | ~10 s |

Cualquier `ERROR` aquí: **parar**, sin importar.

### B4. Rollback de datos preparado (antes de importar)

| # | Comando | Resultado esperado | Ensayo | Remoto |
| --- | --- | --- | --- | --- |
| B4.1 | Segundo dump de `$PROD` (como B0.5), ya migrado y sin importar | Inventario idéntico antes y después | 0,4 s | ~50 s |
| B4.2 | `pg_restore -a -n public -t <las 20 tablas del catálogo> -f rollback-catalogo-datos.sql`, junto con `ensayo/rollback-datos/rollback-catalogo.sql`, que hace `\ir` del anterior | Archivos generados, con SHA-256 | <1 s | <1 s |
| B4.3 | Ensayo en producción: `begin;` + `\i rollback-catalogo.sql` + `inventory.sql` + `rollback;` | Inventario dentro de la transacción = inventario de B4.1; sin cambios después del `ROLLBACK` | 0,7 s | ~18 s (staging) |

### B5. Importación de la hoja congelada

Con `DATABASE_URL=$PROD`, desde la raíz del repo. Nadie edita en el Estudio mientras corre.

| # | Comando | Resultado esperado | Ensayo | Remoto |
| --- | --- | --- | --- | --- |
| B5.1 | `npm run import:catalog -- --input <TSV congelado> --dry-run` | `records 2789`, `rejectedRows 0`, `dictionaries checked`, `derivedKeys 0` | 0,3 s | ~5 s |
| B5.2 | `… --archive-missing --prune-dictionaries --rollback` | `created 7`, `updated 736`, `unchanged 2046`, `republished 0`, `rejected 0`; 8 archivados (`rel_000117`, `000412`, `000647`, `000654`, `001638`, `001740`, `001923` y `002299`), todos con 0 ítems de colección; podados: 9 artistas, 2 sellos y 3 países. Inventario igual al de antes | 5,9 s | **~9 min** |
| B5.3 | El mismo comando sin `--rollback` | Los mismos números, `applied: true` | 6,0 s | **~8 min** |
| B5.4 | `ensayo/checks-produccion.sql`, generado con `gen-checks.mjs` a partir del TSV congelado y de un export de `releases` tomado antes de B5.3 | **24/24 OK** | 1 s | ~10 s |
| B5.5 | Tabla de identidad como `anon` (`ensayo/identidad-resultado.txt`) | Los 21 slugs resuelven, cada uno a 1 lanzamiento; `dark-perreo-rio-zur` da 0 (archivado) | 0 s | 2 s |

### B6. Admin de recuperación

**Se hace después de B10.3.** La cuenta no se puede crear antes:
- el «Add user» del dashboard no envía `username` en los metadatos, y `handle_new_user` rechaza el alta («Invalid username»);
- el sitio en vivo de hoy no tiene registro.

Por eso la persona se registra en el sitio nuevo, confirma el correo y entonces se le asigna el rol. Hasta ese momento, `mamanche` es el único admin.

| # | Comando | Resultado esperado | Ensayo | Remoto |
| --- | --- | --- | --- | --- |
| B6.1 | Solo lectura: `select username, role from public.profiles` | `mamanche` admin. La cuenta de recuperación existe y está confirmada | 0 s | 1 s |
| B6.2 | `update public.profiles set role = 'admin' where username = '<recuperación>' returning username, role;` | 1 fila, `admin` | 0,04 s | 1 s |
| B6.3 | La cuenta de recuperación entra (en el sitio en vivo, después de B10) y abre Estudio, Catálogo y Diccionarios | Las tres cargan | Ensayado con `e22a_recuperacion` | — |

### B7. RLS y humo en la base

| # | Comando | Resultado esperado | Ensayo |
| --- | --- | --- | --- |
| B7.1 | `s6-b8-policy-matrix.sql`, la parte `MATRIX` | Idéntica a `e21-rc3/sql/s6-b8-policy-matrix.log` (26 líneas) | Idéntica |
| B7.2 | `u15-staging-permissions.sql` | Misma forma que staging: admin lista, colaborador `42501` en catálogo y conteos | Igual |
| B7.3 | `anon` con `EXECUTE` en las RPC `admin_%`, `accept_%`, `review_%`, `prepare_%`, `save_contribution%`, `check_source_duplicate` y `resolve_catalog_names` | 0 | 0 |
| B7.4 | Negativos por API (`ensayo/rls-copia.mjs`) | Solo si hay cuentas de rol en producción. Si no, B7.1 y B7.2 bastan | 43/43 |

### B8. Edge Functions

| # | Comando | `--project-ref` | Resultado esperado | Ensayo |
| --- | --- | --- | --- | --- |
| B8.1 | `supabase functions deploy login-with-username --project-ref $REF --use-api --no-verify-jwt` (workdir con copia de `supabase/functions`) | `ewntlvugbopokdrvnwvg` | Desplegada, `verify_jwt=false` | Local: login por usuario OK |
| B8.2 | `supabase functions deploy inspect-release-source --project-ref $REF --use-api` | `ewntlvugbopokdrvnwvg` | Desplegada, `verify_jwt=true` | Local: Bandcamp leído en 1 s |
| B8.3 | Petición inválida a `login-with-username` con la clave publicable de producción | **400**, no 503 | 400 |

### B9. Auth (dashboard de producción, a mano)

Igual que la [sección 6.4 de rc3](./e21-rc3-2026-10-25.md#64-auth-url-del-sitio-redirecciones-y-smtp):

1. SMTP de Resend: la key `supabase-production` la pega el usuario. Remitente `Discótica <hola@discotica.com>`, 30 correos por hora.
2. Las tres plantillas con `token_hash`.
3. Site URL `https://biblioteca.discotica.com`; redirección `https://biblioteca.discotica.com/auth/reset`.
4. Confirmación de correo activada.
5. Ese día, nada de QA de correo en staging.

Esto no se puede ensayar en una copia local.

### B10. Flags, PR y despliegue

| # | Paso | Resultado esperado | Ensayo |
| --- | --- | --- | --- |
| B10.1 | Variables de GitHub: `VITE_CATALOG_SOURCE=canonical`, `VITE_EDITORIAL_ENABLED=true`, `VITE_ADMIN_CATALOG_ENABLED=true` y `VITE_BETA_INVITATION_ENABLED=<decisión>`; `VITE_SUPABASE_*` siguen siendo las de producción | El paso «Verificar variables de despliegue» pasa | Build local con esos flags: 5 s |
| B10.2 | Fusionar el PR `modernizacion-2026` → `main` (ruleset: check `verify` en verde) | `main` = candidato | — |
| B10.3 | Actions → «Build y publicar rama dist» → Run workflow sobre `main` | Commit nuevo en `dist` («deploy: <sha>»), fast-forward sobre `3c137d7` | — |
| B10.4 | hPanel → Git → «Todos los despliegues» | Despliegue nuevo; los `_app/immutable/...` cambian | No probado: primer push real a `dist` |
| B10.5 | Humo en vivo (`ensayo/humo-copia.mjs dia https://biblioteca.discotica.com`, adaptado a las cuentas reales) y la lista de la app de [rc3 6.6](./e21-rc3-2026-10-25.md#66-comprobaciones-de-humo) | Inicio «2789 lanzamientos» desde `catalog_releases`, 0 peticiones a Google Sheets; enlaces legados; `discoticast-2025` con 1; entrar con usuario y con correo; colección; Sugerir; Estudio; `/.htaccess` 403; 301 | Copia: 13/14 (el fallo es de la prueba) |
| B10.6 | Correo real: registro, recuperación y cambio de correo, con SPF, DKIM y DMARC en `pass` | Enlaces a `/auth/reset?token_hash=…` | — |

**Duración estimada de E22-B:** unos 75 a 90 minutos.

| Fase | Tiempo |
| --- | --- |
| B0 | 10 min |
| B1 | 1 min |
| B2 | 18 min |
| B3 | 3 min |
| B4 | 2 min |
| B5 | 18 min |
| B6 a B8 | 5 min |
| B9 | 10 min |
| B10 | ~15 min, más el CI |

## 6. Punto de no retorno, condiciones de parada y rollback

### 6.1 Punto de no retorno

- **Hasta B1.2** no se ha escrito nada: abortar no cuesta nada.
- **Desde B2 (la primera migración)**, el esquema de producción ya no vuelve atrás durante el incidente: las migraciones no se revierten. Aun así, **el sitio sigue intacto**: el build en vivo no usa Supabase. Si se para entre B2 y B10.3, producción queda migrada y el público no ve ninguna diferencia.
- **El punto de no retorno real es B10.3 con el registro abierto.** En cuanto alguien se registre o cree una colección en el sitio nuevo, restaurar el dump de hoy borraría a esa persona. Desde ahí, la única vuelta atrás es la de la aplicación (6.3), nunca la de la base.

### 6.2 Condiciones de parada

| Señal | Acción |
| --- | --- |
| Hash de la hoja ≠ `e67e35e9…` | No empezar. La hoja no está congelada |
| Ref o dirección distintos, o B0.4 distinto sin dump nuevo comprobado | No empezar |
| B1.1 no da 5 migraciones con la última `20260830233946`, o faltan las tablas base | Parar antes del `repair` |
| El `--dry-run` de B2 propone más de una migración, o un push falla | Parar. Nada de `repair` ni SQL a mano: se corrige con una migración nueva, en un ensayo aparte. El sitio no se toca |
| Cualquier verificación de B3 da `ERROR`, o los advisors dan `WARN`/`ERROR` | Parar sin importar |
| B4.3 no deja el inventario idéntico | No importar sin rollback de datos |
| B5.1 con rechazos, o B5.2 con números distintos de los de 5/B5.2 | No importar. Con la hoja congelada, cualquier diferencia significa que producción cambió: investigar |
| B5.4 con algún FAIL | No activar `canonical`. Rollback de datos (`rollback-catalogo.sql`) si el fallo es del catálogo |
| Ítems de colección sin `release_id` | No activar `canonical` |
| B8.3 da 503 | No publicar: el login por usuario fallaría (clave publicable distinta de la del runtime) |
| Correo de Auth sin `pass` o con enlaces reescritos | No abrir el registro; resolver con Resend |
| B10.5 con fallo de integridad, RLS, Auth o colecciones | Rollback de la aplicación (6.3) en el momento |
| Falla un proveedor aislado (Bandcamp, Spotify) | Confirmar en el navegador; no cambiar el catálogo |

### 6.3 Rollback

- **Aplicación, la vía preferida.** En `dist`, `git revert HEAD` y push. Hostinger despliega `3c137d7`, el sitio de hoy.
  - No usa Supabase, así que funciona sobre cualquier estado de la base. Comprobado: carga desde Google Sheets, 0 peticiones a Supabase.
  - Con quien se haya registrado entretanto no se pierde nada: sus datos quedan en la base, sin uso.
- **Aplicación, la alternativa:** flags seguros (`legacy` y los tres en `false`) y Run workflow.
  - Ensayado sobre la copia migrada: 14/14. Catálogo desde la hoja, las colecciones resuelven y se pueden crear, y Sugerir y el Estudio quedan cerrados.
  - Mantiene cuentas y colecciones activas. Conviene más que revertir `dist` si ya hay usuarios nuevos.
- **Datos del catálogo,** solo si B5.3 dejó el catálogo mal: `psql "$PROD" -v ON_ERROR_STOP=1 -1 -f rollback-catalogo.sql` (B4). Devuelve el catálogo al estado posterior a las migraciones; colecciones, propuestas y reportes no se tocan.
- **Migraciones:** no se revierten durante el incidente. Se recupera en una base aislada a partir del dump de B0, se corrige con una migración nueva y se vuelve a validar.
- **Después del corte no se vuelve a importar la hoja.** La hoja manda en cada lanzamiento con `catalog_key`, así que una reimportación pisaría lo que se corrija en el Estudio (RC3-P1-01 incluido). La hoja y su snapshot quedan como respaldo de solo lectura.

## 7. Antes de E22-B: respuestas del usuario (2026-10-25)

1. **Hora del corte:** hoy, 2026-10-25, a las **16:36** (hora de Bogotá; 21:36 UTC).
2. **`VITE_BETA_INVITATION_ENABLED`:** `true`.
3. **Admin de recuperación:** usuario `discotica`. El correo es una cuenta de Gmail nueva del usuario; no se escribe aquí porque el repositorio es público.
   - A las 16:36, ni el correo ni el usuario existían en producción, y `discotica` no está entre los nombres reservados.
   - Se registra en el sitio nuevo después de B10.3 (ver B6), con la contraseña fuera de este equipo.
4. **Key de Resend** `supabase-production`: creada y en manos del usuario. La pega él en B9.
5. **Backups fuera de este disco:** copiados por el usuario. `shasum -a 256 -c SHA256SUMS` dio `OK` en la copia para los tres archivos de `2026-10-25-produccion/` y para el TSV de `2026-10-25-e22-hoja/`.
6. **Cambios al plan de rc3** (sección 2): **aceptados** por el usuario.

## Evidencia

| Archivo (en `../discotica-backups/`) | SHA-256 |
| --- | --- |
| `2026-10-25-produccion/produccion-ewntlvugbopokdrvnwvg-2026-10-25.dump` | `db5279a0adc7734d711002f9affd7e0d8d542433f73e063b047939a189428a57` |
| `2026-10-25-produccion/inventario-antes.txt` (= `inventario-despues-dump.txt`) | `fc1b8d531056c97e0bb2f8457319885e25406eb7b22c4ae0ce047bb2b171d9cb` |
| `2026-10-25-e22-hoja/catalogo-hoja-congelada.tsv` | `e67e35e9f9d9d56a44f7b8ff87982fd97b723ac072276e05315d48ce8f943138` |

En `2026-10-25-produccion/ensayo/`:

- **Migraciones y verificaciones:** `migrar.log`, `verify-final-*.log`.
- **Importación:** `import-{dryrun,preview,apply}.json`, `checks-produccion.sql`, `checks-resultado.txt`, `identidad-resultado.txt` y `detalle-legado.txt`.
- **RLS:** `rls-copia.log` (43/43), `s6-matrix-{copia,staging}.txt`, `u15-copia.log` y `advisors-copia.json`.
- **App:** `humo-dia.log`, `humo-rollback.log`, `humo-vivo.log` y `capturas/`.
- **Rollback de datos:** `rollback-datos/`.

`stack/` es el workdir del stack local; la copia se vuelve a levantar en unos 30 s con el procedimiento de [`operacion-fase-6.md`](./operacion-fase-6.md#restauración-y-rollback), usando `simulacro/prep-target-produccion.sql`, que no replica el revoke global porque producción no lo tiene.
