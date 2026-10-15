# Estado operativo

Actualizado: 2026-10-15.

> **Orden vigente hasta producción:** [`plan-lanzamiento-2026-10-13.md`](../producto/plan-lanzamiento-2026-10-13.md), con sus [prompts](../producto/prompts-lanzamiento-2026-10-13.md). Sustituye el orden de los planes anteriores, no su contenido. **Siguiente acción segura:**
>
> 1. Se corrigen RC2-P1-01 y RC2-P1-02.
> 2. Se repite el paso 11 como E21-rc3.
>
> RC2-P0-01 (enlaces de Auth) quedó corregido y verificado en staging con un correo real el 2026-10-15, con las plantillas nuevas ya en el dashboard ([expediente](./e21-rc2-2026-10-15.md#rc2-p0-01--los-enlaces-de-auth-terminan-en-el-enlace-venció)).
>
> El paso 11 (E21-rc2) dio **NO-GO** el 2026-10-15 ([expediente](./e21-rc2-2026-10-15.md)). Los pasos 1 a 10 están cerrados: el 8 se aceptó con la hoja tal como está y el 10 se decidió por delegación ([decisiones](./decisiones.md#pasos-8-y-10-del-lanzamiento-2026-10-15)). La QA manual en dispositivos conviene hacerla después de la corrección.

## Paso 11 del lanzamiento — E21-rc2: NO-GO (2026-10-15)

Expediente completo, con matriz, recorridos, plan de corte y checklist: [`e21-rc2-2026-10-15.md`](./e21-rc2-2026-10-15.md). Solo staging; producción no se consultó.

- **Candidato** `discotica-e21-rc2`: commit `54e9a06`, manifiesto del build `be71b91c…` y artefacto `6918f340…` en `../discotica-backups/2026-10-15-e21-rc2/`. Staging tiene las 31 migraciones, sin drift.
- **Al arrancar,** con lo que el usuario delegó:
  - paso 9 aceptado (`0fed9be`);
  - H3 corregido (`53af666`; las capas de la fila, en `54e9a06`);
  - paso 8 aceptado con la hoja `83f29cda…`;
  - paso 10 decidido: créditos redefinidos, `colaborador_qa` creada y la cuenta de U12 borrada.
- **Suite:**
  - `npm test` 158/158; build OK;
  - `test:browser` ×3, con 320 pasan, 5 omitidas y 0 fallos; con beta apagada, 21/3/0;
  - `visual:compare` 0 diferencias;
  - `test:anchos` (nuevo: 1024 px y zoom al 200 %) 40/40;
  - las 11 verificaciones SQL OK en staging (D2 con la copia adaptada de S9);
  - advisors sin `WARN`.
- **Recorridos en staging,** con anon, comunidad, colaborador y admin:
  - colección, reordenar y compartir: OK;
  - Sugerir → preparar → aprobar → archivar: OK;
  - reporte con captura (E18): OK;
  - 28 intentos negativos de RLS rechazados;
  - rollback de flags ensayado con Apache y el `.htaccess` real.
- **Los cuatro P0 de E21 están cerrados.**
- **P0 nuevo, RC2-P0-01:** la confirmación, la recuperación y el cambio de correo terminan en "El enlace venció". La recuperación de contraseña es imposible.
  - Causa: `@supabase/ssr` impone PKCE, el SDK canjea el código solo y `/auth/reset` lo vuelve a canjear.
  - En otro navegador no hay verifier.
  - H7 del paso 9 era esto.
- **También:**
  - RC2-P1-01: "Artista sin resolver" en el editor, por una carrera;
  - RC2-P1-02: textos dañados en la hoja, con 79 campos candidatos;
  - 58 URLs de medios rotas confirmadas en navegador;
  - `static/bu lanzamientos/` sale publicado en el build.
- **Pendiente del usuario:**
  - QA manual (Safari iOS, Android, VoiceOver, iframes y llegada de 3 correos);
  - las dos firmas;
  - borrar la cuenta `e21rc2_comunidad` después de la repetición.

## Paso 9 del lanzamiento — D3: correo propio en staging (2026-10-15)

Registro completo en [`d3-correo-propio-plantillas-2026-10-06.md`](./d3-correo-propio-plantillas-2026-10-06.md). Solo staging; producción no se tocó.

- **DNS:** los cuatro registros de Resend (`send` MX/TXT, `resend._domainkey`, `_dmarc` `p=none`) resuelven en el autoritativo y en resolvers públicos. Resend muestra `discotica.com` como **Verified** (región `sa-east-1`).
- **Dashboard de staging** (el usuario):
  - SMTP de Resend con remitente `Discótica <hola@discotica.com>` y la key `supabase-staging`;
  - límite de 30 correos por hora;
  - las tres plantillas.
- **Envío real** a `hola+d3-20261015@mamanche.com`: confirmación, recuperación y cambio de correo (×2).
  - Todos llegaron a la bandeja de entrada.
  - SPF, DKIM (`d=discotica.com`) y DMARC en `pass`.
  - Enlaces directos a staging.
  - Parte `text/plain` generada por Resend, con lo que H3 queda resuelto sin hook.
- **Hallazgos nuevos:**
  - H6: el click tracking de Resend no se deja apagar, aunque no reescribió enlaces. Hay que repetir la comprobación en producción.
  - H7: la pantalla de "venció" tras una confirmación que sí funcionó. Nota para U12.
- **Para E22-B:** la lista de qué repetir en producción y la cuota compartida de 100 correos al día están en la sección "Producción" del registro.

## Paso 8 del lanzamiento — catálogo de staging reemplazado con la hoja limpia (2026-10-14)

Registro completo, con el informe de diferencias, las decisiones y la tabla de cambios de identidad para E22: [`catalogo-hoja-limpia-2026-10-14.md`](./catalogo-hoja-limpia-2026-10-14.md). Solo staging; producción no se tocó.

- **Hoja:**
  - SHA-256 `83f29cda…`, idéntico al snapshot B10 del 12-oct;
  - 2.789 filas, todas con clave, 7 rechazos y 34 advertencias;
  - el orden de las filas es el de agosto. El sitio sigue ordenando por fecha (decisión del usuario).
- **Migración `20261014203000_catalog_sheet_replace_import.sql`:**
  - el importador ya no escribe las filas iguales;
  - sube `catalog_version` cuando algo cambia;
  - conserva `status` y `credit_quality`;
  - conserva enlaces y portadas como S7 (H4);
  - añade el archivado de las claves ausentes y la poda de diccionarios, con las opciones `--archive-missing`, `--prune-dictionaries` y `--rollback`;
  - verificación: `tests/sql/catalog-sheet-replace-verify.sql`, con control negativo.
  - Aplicada en staging el 2026-10-15 a las 02:27 UTC.
- **Ensayo** sobre un dump nuevo, post-S9 (`2d45e174…`), restaurado en local:
  - reemplazo y rollback de datos ensayados;
  - 14/14 comprobaciones y la regresión en verde.
- **Staging,** entre las 03:26 y las 03:34 UTC:
  - resultado: 667 actualizados, 2.115 sin cambios y 8 archivados (ninguno en colecciones); ninguno borrado;
  - se podaron 30 géneros, 2 sellos, 1 país y 1 artista;
  - publicados = las 2.782 filas válidas;
  - las 14 comprobaciones dieron OK, la regresión de E06, D2 y S7 está en verde y la prueba de humo dio 12/12.
- **Con la hoja sin corregir:**
  - REUNION (rel_001634) quedó archivada;
  - rel_001638 conserva su UUID con los datos de OH MARGÓ. Su slug anterior resuelve por alias.
- **Pendiente:**
  - repetir el reemplazo cuando la hoja traiga las correcciones 1 y 4;
  - rotar la contraseña de staging;
  - copiar los dos backups nuevos fuera de este disco.

## Paso 7 del lanzamiento — S9: migraciones aplicadas en staging (2026-10-14)

Etapa S9 del [plan de saneamiento](../producto/plan-saneamiento-2026-10-06.md) en staging (`hgocyrzhgohetfpzbmfs`), con autorización del usuario antes de cada cambio. Producción no se tocó.

- **Requisitos:**
  - paso 6 cerrado;
  - dump del mismo día (16:53, hora local). Antes del primer cambio se repitió el inventario: 69/69 tablas idénticas al manifiesto del dump.
- **Destino**, con dos señales:
  - `migration list --project-ref` mostró 23 migraciones aplicadas, la última `20260918184855`, sin drift;
  - `inet_server_addr()` = `2600:1f18:38df:9502::a50a`, igual al DNS de `db.hgocyrzhgohetfpzbmfs`.
  - Además, el CLI resolvió el proyecto como "Biblioteca Staging".
- **Método:**
  - un workdir temporal por migración, con enlaces a las migraciones hasta esa y sin `.temp/project-ref`: si el CLI ignorara `--project-ref`, no tendría destino;
  - en cada una: `migration list`, `db push --project-ref hgocyrzhgohetfpzbmfs --skip-vault --dry-run` (solo esa migración), autorización y `db push`. Nunca `--linked`;
  - `db advisors` rechaza `--project-ref` sin `--linked`, así que se corrió con `--db-url` (la cadena de staging ya validada). Es el linter del CLI. Los `WARN` 0029 del linter alojado que esperaban D1 y D2 no se comprobaron, por decisión del usuario.

| Paso | Migración | Aplicada (UTC) | Verificación en staging | Advisors | Humo |
| --- | --- | --- | --- | --- | --- |
| 0 | `20260830000000`, base de S5 (`migration repair --status applied`, sin ejecutar SQL) | 2026-10-14 23:34:39 | — | — | — |
| 1 | E18 `20260923120000` | 2026-10-14 23:58:55 | `e18-verify.sql` OK | +2 `WARN` (políticas permisivas en las tablas de E18) y +5 `INFO` | 8/16; fallan solo D1 y D2 |
| 2 | D1 `20261006131054` | 2026-10-15 00:01:39 | `d1-verify.sql` OK; backfill 4/4; H8 OK | sin cambios | 11/16; falla solo D2 |
| 3 | D2 `20261006200859` | 2026-10-15 00:11:04 | `d2-verify.sql` adaptado OK | +1 `INFO` (`catalog_change_sets_batch_idx` sin uso) | 16/16 |
| 4 | S6 `20261011190000` | 2026-10-15 00:20:47 | matriz B8 idéntica (26 líneas); `e06-verify`, `e06-reopen-verify` y D2 OK | −4 `WARN`: quedan 0 | 16/16 |
| 5 | S7 `20261012120000` | 2026-10-15 00:23:49 | `s7-verify.sql` 8/8; E06 y D2 OK | sin nuevos | 16/16 |
| 6 | U18 H2 `20261014120000` | 2026-10-15 00:30:10 | `u18-h2-verify.sql` OK | +1 `INFO` (`rls_enabled_no_policy` en la tabla privada, a propósito) | 16/16 |

- **Advisors:** antes, 52 (2 `WARN`, en `contributions` y `contribution_events`); después, 51 (0 `WARN`, 51 `INFO`).
- **Verificaciones:** todas son una transacción que termina en `rollback`. Staging no tiene `pg_net` ni webhooks, así que los fixtures no salen de la transacción. Después de correrlas: `releases` 2.790 y ningún fixture.
  - **`d2-verify.sql` supone una base vacía** en las listas y los conteos de las vistas rápidas. Staging tiene 15 lanzamientos incompletos reales (8 sin portada), y el primer intento falló en "Sin portada" por eso, no por D2. La copia adaptada cambia dos cosas: acota las listas con `p_query => 'D2 Artista'`, el artista que solo tienen los fixtures, y mide los conteos como diferencia sobre una línea base tomada en la misma transacción. El resto es idéntico. El archivo del repositorio no se cambió.
  - **H8 (nombres reservados), verificado por fin:** `d1-verify.sql` no lo cubre. Una comprobación aparte, con rollback, confirmó que `coleccion` y `mis-colecciones` dan `Username unavailable.` y que un nombre de control se crea.
  - **Backfill de D1:** 4 ítems en 2 colecciones, `count(distinct (crate_id, position)) = count(*)`, en orden de `added_at`.
  - **No se corrieron en staging:** `d1-concurrency.sh`, `d2-concurrency.sh` y `d2-mutations.py`. Confirman escrituras, así que son solo locales.
- **Prueba de humo** (Playwright y supabase-js con `.env.local`, cuenta QA con rol admin):
  - catálogo y ficha anónimos;
  - Estudio: catálogo (2.790; vistas rápidas 0/15/8/0), inicio, propuestas y reportes;
  - `/sugerir` y `/reportar`, solo hasta el formulario. Esas tablas no se pueden borrar desde el cliente, y el envío lo cubren `e18-verify`, `e06-verify` y la matriz B8;
  - colección privada temporal con 3 ítems, reordenada con `reorder_crate_items`, vista en `/mis-colecciones` y en su página, y borrada.
  - Sin errores de consola ni respuestas ≥ 400 de Supabase. La corrida de antes de empezar dio 8/16, con exactamente los fallos esperados.
- **Edge Functions:**
  - `login-with-username` v4 se desplegó a las 00:32:31 UTC, después de su migración, con `--use-api` y `verify_jwt` falso como antes;
  - la v3 era idéntica al `index.ts` de `5f7684f`: ese es el rollback;
  - `inspect-release-source` no cambió en el paso 5 y no se desplegó (sigue la v3 del 2026-09-17).
- **H2 en staging** (detalle en el [expediente de U18](./u18-qa-interfaz-2026-10-14.md#paso-7--h2-en-staging-2026-10-14)):
  - la IP sale de `cf-connecting-ip`, y no se puede falsificar;
  - Auth ve la IP del runtime;
  - la latencia del camino real (mediana 731 ms) queda bajo el piso de 1200 ms;
  - el 6.º intento recibe 429.
- **Lo que queda en staging de las sondas:**
  - 13 filas de fallo de usuarios `s9h2-*` en `private.username_login_attempts`, que se purgan en un día;
  - 8 de acceso correcto de `jmamanche`;
  - las sesiones de QA están cerradas;
  - la colección de humo se borró en cada corrida.
- **Incidente:** una sonda falló y el error de Node imprimió la cadena de conexión de staging, con su contraseña, en la salida de la sesión de Claude. No llegó a ningún otro servicio. Recomendado: rotar la contraseña de la base de staging y actualizar `E06_STAGING_DATABASE_URL` en `.env.local`.
- **`migration list` final:** 30 migraciones aplicadas en remoto, de `20260830000000` a `20261014120000`; ninguna pendiente y sin drift.
- **Rollback:** el de cada migración, en su sección (más abajo y en los relevos de D1 y D2). E18 no tiene un rollback ensayado: revertirla exigiría una migración nueva de `drop`.

## Paso 6 del lanzamiento — S8: dump de staging y restauración local: cerrado (2026-10-14)

Registro completo en [`operacion-fase-6.md`](./operacion-fase-6.md#2026-10-14--s8-dump-de-staging-y-restauración-local-conteos-idénticos).

- Dump de staging hecho con `pg_dump` 17.6 (SHA-256 `8671fbdb…`). La restauración en un stack aislado dio datos y estructura idénticos en 69 tablas.
- Cierra E21-P0-02.
- El paso 7 lo usó como backup del mismo día.

## Paso 5 del lanzamiento — correcciones de U18, grupo "Seguridad de acceso" (H2): aceptado (2026-10-14)

Detalle en el [expediente de U18](./u18-qa-interfaz-2026-10-14.md#paso-5--h2-2026-10-14). Hecho en local. La migración y la función se aplicaron en staging en el paso 7 (2026-10-14); producción no se tocó.

- **H2 (P1), corregido:** `login-with-username` tiene límite de intentos propio.
  - **Límites:** 5 fallos por usuario (exista o no) y 20 por IP, en 15 minutos. Al superarlos, 429 y "Demasiados intentos seguidos…" en la pantalla de entrar.
  - **Enumeración por tiempo:** toda respuesta de credenciales inválidas tarda al menos 1200 ms.
  - **Migración** `20261014120000_u18_username_login_attempts.sql`: tabla `private.username_login_attempts` (IP como HMAC, purga a un día) y las RPC `begin_username_login`/`finish_username_login`, solo para `service_role`.
- **Pruebas:**
  - `tests/username-login.test.mjs` (en `npm test`);
  - `tests/sql/u18-h2-verify.sql`: OK en un stack local construido desde vacío;
  - `scripts/u18-h2-login-verify.mjs`, de punta a punta contra la función en local: OK. Ráfaga de 12 → 5 llegan a `/token`; mediana 1217 frente a 1216 ms;
  - un caso nuevo en `u12-cuenta`.
- **Verificado:**
  - `npm test` 156/156; `build` OK; `lint:tokens` OK (2 excepciones de los radares);
  - `test:browser`: 2 corridas, 319 pasan, 5 omitidas y 0 fallos;
  - visual: 0 diferencias contra `.ref-pre-u18fix` (borrada). La línea base no cambia.
- **CI del PR:** la corrida de `b7aa82c` falló en `waitForFloor` (`username-login.test.mjs`). `setTimeout` venció una fracción de milisegundo antes del piso. Ahora `waitForFloor` espera en bucle hasta cumplirlo, y la prueba exige el piso exacto (30/30 en local).
- **Para el paso 7:**
  - la migración va después de S7, y la función después de la migración (sin ella, toda entrada con usuario da 503). Ya está en el plan y en el prompt del paso 7;
  - comprobar en staging la cabecera de la IP real y si se puede falsificar, qué IP ve Auth y la latencia real bajo el piso.
- **Decisión** (`decisiones.md`): quien conozca un usuario puede bloquear su entrada con usuario 15 minutos; entrar con correo sigue disponible.
- **Sigue abierto:**
  - H3 (P1);
  - los P2 de "Objetivos táctiles", "Menores" y "Censo".

## Paso 5 del lanzamiento — correcciones de U18, grupo "Scroll y header" (H1 y H15): aceptado (2026-10-14)

Detalle en el [expediente de U18](./u18-qa-interfaz-2026-10-14.md#paso-5--h1-2026-10-14). En local; no toca staging ni producción.

- **H1 (P1), corregido:**
  - `overflow-x: clip` en `html, body`, y fuera el caso `html.is-tool`;
  - header fijo en todo el sitio (E14), «Buscar» fija en móvil (E15/U10) e índice del manual bajo el header;
  - la barra de la ficha página pasa de `dockBar` (JavaScript) a `position: sticky`.
- **Reserva al desplazarse:** `scroll-padding-top` con `--header-reserve` y `--search-reserve`. Así anclas, `scrollIntoView` y el foco no quedan bajo el header ni bajo «Buscar» cuando reaparecen. Coste aceptado: un hueco de 76/60 px al desplazarse hacia abajo (`decisiones.md`).
- **H15 (P2, nuevo), corregido:** paginar desde abajo no subía a la grilla con movimiento normal (carrera con `goto` y `noScroll`).
- **Pruebas:**
  - `tests/browser/u18-sticky.spec.ts`, 4 pruebas de geometría que fallan contra `559058b`;
  - ajustadas `u9-ficha`, `e13` y `r1` (R1.4).
- **Suite visual:** `support/capture-document.css` para las capturas de página completa y de elemento.
- **Verificado:**
  - `npm test` 153/153; `build` OK; `lint:tokens` OK (2 excepciones de los radares);
  - `test:browser`: 2 corridas, 318 pasan, 5 omitidas y 0 fallos.
- **CI del PR:**
  - la corrida de `0f664e3` falló en `E04: el menú contiene Tab…` (`catalogo.spec.ts`). Es una carrera de la prueba, no del arreglo: el menú enfoca su primer enlace en un `requestAnimationFrame`, y en la CI lenta llegaba después de Shift+Tab. La prueba ahora espera ese foco (70/70 en local);
  - la de `559058b` (solo documentación) falló una vez en E16 (`cada apertura crea una sesión…`), esperando el enlace de la tarjeta. Queda anotada como intermitencia de CI si vuelve.
- **Visual:**
  - 7 diferencias contra `.ref-pre-u18fix`, todas del arreglo y aceptadas: `home-scrolled-M`, `card-row-D/T/M`, `card-varios-open-D`, `estudio-editor-generos-D` y `manual-D`;
  - línea base recapturada; `.ref-pre-u18fix` borrada.
- **Sigue abierto:**
  - H2 y H3 (P1);
  - los P2 de los grupos "Objetivos táctiles", "Menores" y "Censo";
  - "Mejor coincidencia" a 360 y el aviso al salir de Sugerir, que el equipo deja para después.

## Paso 4 del lanzamiento — U18, QA de interfaz (puntos 1–4): expediente aceptado (2026-10-14)

Expediente: [`u18-qa-interfaz-2026-10-14.md`](./u18-qa-interfaz-2026-10-14.md). En local, sin corregir nada y sin tocar staging ni producción. Sin dictamen: el GO/NO-GO es del paso 11.

- **P0:** ninguno.
- **P1:** tres.
  - H1: el `overflow-x` de `html`/`body` anula el sticky (header de E14, barra de E15 e índice del manual). `clip` lo arregla sin desborde en 22 combinaciones. Necesita decisión.
  - H2: `login-with-username` no tiene límite de intentos propio, y hay enumeración por tiempo.
  - H3: país y sello de la tarjeta miden 17 px de alto, sin excepción registrada. Necesita decisión.
- **P2:** diez (H4 y H6–H14), entre ellos:
  - el radar de filtros anima con `prefers-reduced-motion`;
  - mensajes de la base en inglés que pueden llegar a la vista;
  - `/lab` está en el build de producción, con códigos internos;
  - la ayuda de "Nota interna";
  - falta "Saltar al contenido";
  - huecos del censo: ficha a 680, ficha página a 834/1112 y panel de búsqueda a 834.
- **Comprobaciones globales** (203 estados auditados en Chromium):
  - sin barras de scroll nativas, sin "crate" y sin emoji;
  - códigos internos solo en `/lab`;
  - contraste: 0 fallos en texto activo (26 754 nodos);
  - teclado: sin trampas y con indicador de foco en todas las paradas.
- **Verificado:**
  - `visual:compare` 182/182 iguales, y la prueba de los 127 IDs pasa;
  - `lint:tokens` OK, con las 2 excepciones de los radares (cierre propuesto con un token en unidades del `viewBox`);
  - `npm test` 153/153; `build` OK;
  - `test:browser`: calentamiento y 2 corridas, 314 pasan, 5 omitidas y 0 fallos en las tres.
- **Decisiones (2026-10-14, en `decisiones.md`):**
  - H1: header fijo en todo el sitio, con `clip`;
  - H3: área táctil de 44 px en país y sello;
  - H7: `/lab` solo en desarrollo;
  - H8: se cambia la ayuda de "Nota interna" ahora, y el caso de E09 va después del lanzamiento.
- **Pendiente del usuario:** las 8 comprobaciones manuales (iPhone real y VoiceOver).
- **Aceptado el 2026-10-14.** Commit y push de la rama `modernizacion-2026`.

## Paso 3 del lanzamiento — Hostinger conectado a `dist`, `main` protegido: cerrado (2026-10-14)

Detalle operativo en [`operacion-fase-6.md`](./operacion-fase-6.md#conexión-de-hostinger-a-dist-2026-10-14).

- **Conexión:** repositorio `discotica/biblioteca`, rama `dist`, directorio `public_html`, despliegue automático activado. Primer despliegue 2026-10-14 09:39:47 (hora local), 3 s, completado; commit `3c137d7` ("deploy: 0ab31e0").
- **El sitio no cambió:** `index.html` en vivo y el de `origin/dist` son idénticos (SHA-256 `37d92de8…`), con los mismos 10 `_app/immutable/...`. `Last-Modified` 14:39:49 GMT, coherente con el despliegue. `/artista/pepito-perez` responde 200 con el `index.html`; `/.htaccess` responde 403.
- **Ruleset de `main`:** activo, sin bypass, exige PR y el check `verify`, y bloquea borrado y force-push. Al principio de la sesión no existía (`gh api` devolvía `[]` y GitHub mostraba "You haven't created any rulesets"); el usuario lo creó y se verificó con `gh api`.
- **No probado:** el despliegue automático ante un push real a `dist`; se verá en el primer Run workflow. Tampoco se probó `force_orphan: false` sobre la `dist` existente (ver S1).
- **Regla:** nunca se suben archivos a mano a Hostinger.

## Saneamiento S1 — CI y despliegue seguros: cerrada (2026-10-13)

Cierra C2 y C3. Paso 2 del [plan de lanzamiento](../producto/plan-lanzamiento-2026-10-13.md); el detalle operativo está en [`operacion-fase-6.md`](./operacion-fase-6.md#despliegue-desde-github-actions).

- **Node 22** en `ci.yml`, `deploy.yml` y `media-health.yml` (`node-version-file: .nvmrc`), más `engines` en `package.json`.
- **`deploy.yml`:**
  - manual (`workflow_dispatch`);
  - las `VITE_*` salen de las variables del repositorio, con flags seguros por defecto (`legacy` y todo en `false`);
  - el paso "Verificar variables de despliegue" falla antes de compilar si falta la URL o la clave, si la clave es `sb_secret_` o un JWT `service_role`, o si un valor está fuera de rango;
  - **nuevo:** el paso "Verificar rama" falla si el `ref` no es `refs/heads/main`;
  - **nuevo:** `force_orphan: false` y `keep_files: false` en la publicación a `dist`. Cada despliegue añade un commit en vez de reescribir la rama, para el despliegue por Git de Hostinger (paso 3).
- **`ci.yml`:** valores ficticios propios y flags de la CI; `e01-staging-canonical` se omite con `CI=true`.
- **Variables en GitHub:** `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` existen como variables del repositorio y apuntan a producción.
- **Verificado en local** (`CI=true`, Node 22.18, con las variables de `ci.yml`): `audit:catalog`, `lint:tokens`, `npm test`, `build` y `test:browser` terminan con exit 0; `test:browser`: 314 pasan, 5 omitidas, 0 fallos.
- **Guardas simulados** ejecutando el script de cada paso con `env -i`:
  - sin variables, sin clave, `sb_secret_`, JWT `service_role`: exit 1 con su mensaje;
  - clave publicable, JWT `anon` y combinación canónica: exit 0;
  - `Verificar rama`: exit 1 desde `refs/heads/modernizacion-2026` y desde una etiqueta; exit 0 desde `refs/heads/main`.
- **Secretos:** revisados los 196 archivos que entran (cambios sin commit y los 2 commits sin subir): sin claves `sb_secret_`, JWT, cadenas `postgres://` ni tokens. Solo hay el nombre del rol `service_role` (en `GRANT` de la migración base y en reglas de guarda) y un token ficticio en una prueba.
- **PR en borrador:** [discotica/biblioteca#1](https://github.com/discotica/biblioteca/pull/1), `modernizacion-2026` → `main`, "Modernización 2026: candidato de lanzamiento". No se fusiona hasta E22-B. `main` sigue en `0ab31e0`.
- **CI del PR: verde** (job `verify`, ~5 min; 313–314 pruebas de navegador pasan, 5 omitidas). Las dos primeras corridas fallaron, cada una con una prueba distinta que en local no fallaba (tres causas, las tres arregladas en la rama):

  | Prueba | Causa | Arreglo | De |
  | --- | --- | --- | --- |
  | U11 "bienvenida" (1440 px) | La proporción del hueco de la ilustración es un alto **mínimo**; el texto de la bienvenida lo estira. Work Sans no se carga (no hay `@font-face`), y en Linux cae a la sans genérica, más alta: 1,16 en vez de 1,33. Del entorno. | La prueba comprueba el `aspect-ratio` declarado y que el hueco no sea más ancho que él. | la prueba |
  | E15 gesto táctil | Con 30 px cierra solo por velocidad (≥ 0,5 px/ms, es decir, ≤ 60 ms entre `touchStart` y `touchEnd`). En un runner cargado, los tres envíos CDP a veces tardan más. Del entorno. | Arrastre de 90 px (> `CLOSE_DISTANCE` = 72): cierra por distancia. | la prueba |
  | U10b "un clic fuera cierra" | **Defecto de la app.** `onSearchBlur` programa el cierre de las sugerencias a los 160 ms y no se cancelaba. Tras quitar una chip (el campo pierde el foco) y volver a escribir, el temporizador viejo cerraba las sugerencias con el campo enfocado. Reproducido en local: 1 de 40 repeticiones con 6 trabajadores. | `SearchCombobox.svelte` cancela el cierre pendiente al recuperar el foco. 120/120 repeticiones después. | la app |

  Desde las filas 1 y 2: la CI de Linux ve diferencias que el Mac del desarrollo no. Cualquier prueba nueva que dependa de métricas de la fuente o de la velocidad de un gesto puede repetirlo.
- **Qué no se ha probado:** `deploy.yml` no se ha ejecutado en GitHub; el primer Run workflow real es en E22-B (o un ensayo desde `main` en el paso 3). `force_orphan: false` sobre la rama `dist` existente (un commit huérfano) se comprobará en ese primer despliegue.

## Saneamiento S3 — suite de navegador en verde: cerrada (2026-10-13)

Cierra B5 / E21-P0-04. Termina y verifica los cambios que dejó el chat del 2026-10-11. Las causas se comprobaron con una copia aislada de `HEAD` en el scratchpad, con otro puerto y sin tocar el árbol de trabajo.

| Prueba (línea en B5) | Causa | Arreglo | De |
| --- | --- | --- | --- |
| E17 "URL directa encadena recomendaciones" (:198, luego :202; ahora :228) | Usaba `beta=1` como parámetro desconocido. Con `VITE_BETA_INVITATION_ENABLED=true` (`.env.local`), `beta` es de E19: monta la invitación encima de la modal y su fondo intercepta el clic en la recomendación. Con la prueba original: flag activo, timeout; flag apagado, pasa. Por eso pasaba en la CI de S1 y fallaba en local. | El parámetro desconocido es `e17_extra=1`, que ninguna superficie usa. | la prueba |
| E17 A → B → C (:99) | `scrollTo` antes de que existiera el catálogo: guardaba 0. | Ya estaba hecho en U10 (espera la tarjeta y la lleva a la vista antes de guardar). | la prueba |
| E17 "Back a la base … Forward" (:178) | Leía `page.url()` en cuanto la tarjeta era visible, antes de que llegara la URL canónica (`&orden=match`). Reproducido en 1 de 10 repeticiones de esa prueba con el archivo original (`--repeat-each=10`, en paralelo). | Espera `toHaveURL(…&orden=match)` antes de capturar la base, como las otras pruebas del archivo. | la prueba |
| E17 recarga con la ficha abierta (antes una sola prueba) | **Dos defectos.** (1) En la prueba: desplazaba antes del catálogo, guardaba 0 y la aserción de scroll pasaba sin ejercitarse. (2) En la app: tras recargar, SvelteKit deja `page.state` en `{}` en la primera página cargada (cliente 2.70.3, `start`), aunque `history.state['sveltekit:states']` conserve el marker. La app trataba la recarga como apertura directa: cerrar reemplazaba C por la base (A y B quedaban en el historial) y perdía el scroll guardado. | Prueba partida en dos: "conserva la sesión y vuelve a la URL base" y "restaura el scroll ±1 px", con esperas de estado. App: `takeBootModalEntry` (`homeUrl.ts`) lee el marker de `history.state` al evaluar el módulo, una sola vez y solo si coincide con el `modal` de la URL. `+page.svelte` restaura con él la sesión y reescribe el marker. | la prueba y la app |
| E14 header móvil (`catalogo.spec.ts:447`, ahora :450) | `scrollTo` vuelve antes de que el navegador despache `scroll`. Si el evento de `scrollTo(0,180)` llegaba después de `Escape`, el menú ya no congelaba el header, que se ocultaba. La aserción de "visible con el campo enfocado" fallaba. | La prueba espera el evento `scroll` en cada desplazamiento. El oyente del header se registró antes, así que ya se ejecutó. Se quitó el `waitForTimeout(20)` tras `blur`: con cualquier orden entre `resetBaseline` y el `scroll`, el resultado es "oculto". | la prueba |

- **Control negativo del arreglo de la app:** con la app de `HEAD` y la prueba nueva, "restaura el scroll ±1 px" falla 3/3 (492 px de diferencia); con el arreglo pasa.
  - Una sonda confirmó que tras la recarga `history.state` trae el marker con `depth: 3`.
  - Cerrar vuelve a la base dentro del mismo documento (navegación `reload`, `persisted: false`), y el scroll restaurado es el `baseScroll` del marker, no el de `sveltekit:scroll`.
- **Invariante de E17:** intacto. Abrir, recomendar, Back/Forward y cerrar no cambian. Solo cambia la recarga, que ahora cumple el invariante 6 del expediente E17. El marker solo se toma si su `slug` es el de la URL.
- **Comentarios corregidos en este cierre:** el del 11-oct decía que SvelteKit vacía `history.state` al arrancar (vacía `page.state`) y que la app guardaba el scroll en `sessionStorage` (no lo hace).
- **Resultados** (`.env.local`, servidor caliente, máquina cargada, load 9–13):
  - calentamiento y tres corridas seguidas de `npm run test:browser`: 314 pasan, 5 omitidas (E01, E03 y E19 según flags), **0 fallos en las cuatro**;
  - archivo E17 8/8; E17 + E14 12/12;
  - `npm test` 153/153; `lint:tokens` OK (175 archivos); `npm run build` OK;
  - `npm run visual:compare`: 183/183, **cero diferencias**.
- **Sin intermitentes:** no hizo falta la medición de 10 corridas.
- **Hallazgo fuera de alcance (para U18):** cargar una URL de inicio no canónica (p. ej. `/?genero=Ambient`, sin `orden`) deja una entrada de historial de más. El primer Back vuelve a la URL sin canonizar.
  - Causa: `canonizarURLActual` lanza un `goto` de *replace*. Antes de que termine, el bloque reactivo de `$page.url` ve una URL distinta de `lastSeenQS` y lanza otro, que cancela el primero (token de navegación de SvelteKit). Luego `aplicarTodosLosFiltros` encuentra la URL aún sin canonizar y hace *push*. Traza: el único `pushState` de la carga viene de `navigateToSearch`.
  - No rompe ninguna prueba y no se tocó: es orquestación de E12/E17.
- **Sin commit:** los commits los hace el paso 2.

## Saneamiento S7 — metadatos de portadas y enlaces (H4): aplicada en staging en el paso 7 (2026-10-14) (lista en local el 2026-10-12)

Migración `20261012120000_s7_preserve_release_media_metadata.sql`. Redefine `private.apply_catalog_payload` con las mismas validaciones que `20260917181154`; cambia solo el bloque de enlaces y portadas. `catalog_snapshot` no cambia, así que `before_state`/`after_state` conservan forma y contenido.

- **Enlaces:** se emparejan por URL. Sin cambios no se escribe (mismo id, mismo `xmin`, conserva `checked_at`); cambia `provider` o `is_primary`: `UPDATE`; la URL que el payload quita: `DELETE`; la nueva: `INSERT`. Orden borrar, bajar primarios, actualizar, insertar, por el índice de un solo primario. URLs repetidas en el payload siguen dando `23505`.
- **Portada externa:** la fila que ya tiene esa URL queda intacta. Si la URL cambia, la fila se actualiza en el sitio (mismo id y `created_at`) y se anulan `source_url`, `content_hash` y `checked_at`, que describían la imagen anterior. Sin portada: se borra la externa.
- **Portadas `storage`:** el payload no las expresa, así que ya no se borran.
- **Verificación** (stack aislado `discotica-s7`, 544xx, cadena vacía con `db reset`): `tests/sql/s7-verify.sql` (nuevo, 8 comprobaciones: edición sin media, cambio de un enlace, quitar y añadir, intercambio de primario, portada, duplicados, auditoría con revert, lote de D2), `e06-verify.sql`, `e06-reopen-verify.sql`, `d2-verify.sql` y `d2-concurrency.sh` en verde. La huella de `d2-verify.sql` ahora incluye `xmin` y metadatos de enlaces y portadas: el lote rechazado de 50 elementos deja la huella idéntica. Control negativo: `s7-verify.sql` sobre el cuerpo antiguo falla en la comprobación 1.
- **Rollback:** `tests/sql/s7-rollback-verify.sql` (bloque `>>> S7 ROLLBACK`, ensayado: `S7 rollback verify: OK`), migración posterior `npx supabase migration new s7_rollback_preserve_release_media_metadata`. Sin pérdida de datos, pero desde la siguiente escritura vuelven a perderse los metadatos y las portadas `storage` de ese lanzamiento: no revertir una vez que `verify:media` o Storage los hayan guardado.
- **Staging:** aplicada el 2026-10-15 a las 00:23:49 UTC, después de S6 (paso 7). `s7-verify.sql` dio 8/8 y la regresión de E06 y D2 quedó en verde.
- **Sin commit ni push.**

## Saneamiento S6 — concurrencia y fixtures de E06: aplicada en staging en el paso 7 (2026-10-14) (lista en local el 2026-10-11)

Migración `20261011190000_s6_e06_concurrency_and_policy_consolidation.sql`. E06 ya está en staging; no se editó ninguna migración existente.

- **H1 (las tres RPC).** `private.catalog_snapshot` es `STABLE`: dentro de `select snapshot(...) from releases ... for update` lee con la instantánea previa a esperar el bloqueo. Ahora `admin_update_catalog_release`, `admin_change_release_slug` y `admin_revert_catalog_change` bloquean con `perform 1 from public.releases where id = … for update` y leen el snapshot en la sentencia siguiente. El resto de cada cuerpo es el de E06. Las tres tenían el defecto (se probó sin el arreglo).
  - Orden de bloqueos: change set y luego lanzamiento (solo la reversión toma los dos). Ninguna otra RPC bloquea un change set existente después del lanzamiento, así que no hay ciclo.
- **H5.** `admin_create_catalog_release` inserta siempre en borrador y `apply_catalog_payload` fija el estado real y valida. Crear como `published` funciona con un payload completo (fecha, tipo, sello, artista, género, país, portada HTTPS y un enlace principal); sin tipo sigue fallando con `23514`. El contrato de entrada y salida no cambia; E07 (crea en borrador y publica) no se toca.
- **B7 / H6.** La última sección de `e06-verify.sql` ya no ejercita la aprobación legada de E02: comprueba que un payload legado se rechaza (`22023`) sin publicar ni auditar, que una aprobación v2 confirmada publica y deja la auditoría de creación, y que H5 funciona. `e06-verify.sql` y `e06-reopen-verify.sql` crean dentro de su transacción el admin, la persona de comunidad, el artista y el país que una cadena vacía no tiene.
- **B8.** Una policy `SELECT` por tabla en `contributions`, `contribution_events`, `problem_reports` y `problem_report_events` (antes 3/3/2/2), con el OR de las mismas condiciones. Los dos avisos de staging (`contributions`, `contribution_events`) y los dos de E18 desaparecen; los advisors locales ya no muestran ningún `WARN`.
  - Matriz de lectura antes/después: `tests/sql/s6-b8-policy-matrix.sql`, 5 roles × 4 tablas más 6 intentos de escritura; las 26 líneas son idénticas antes y después, y también tras el rollback.

| Rol | contributions | contribution_events | problem_reports | problem_report_events |
|---|---|---|---|---|
| anon | denegado | denegado | denegado | denegado |
| comunidad A (autora de c1, c3) | c1, c3 | c1, c3 | r1 | r1 (solo `created`) |
| comunidad B (autora de c2, c4, c6) | c2, c4, c6 | c2, c4, c6 | r2 | r2 (solo `created`) |
| colaborador (autor de c5) | c1, c2, c5 | c1, c2, c5 | ninguna | ninguna |
| admin | c1–c6 | c1–c6 | r1, r2 | todos (incluye `triaged`) |

  c4 (cola `collaborator`) y c6 (rechazada) no las ve el colaborador; c3 (borrador) tampoco. Escrituras de autor y admin: denegadas en las tres tablas de solo lectura.

- **Sondas de H1** (`tests/sql/d2-concurrency.sh`, fase 3, ahora estricta: una sonda fallida falla el script). Una por RPC: update/update, slug/slug y update/revert (la reversión llega con la versión del change set mientras otra edición retiene el bloqueo). Cada una comprueba `40001` en la segunda escritura, estado final, ausencia de saltos de versión y que cada `before_state` sea el `after_state` del change set anterior.
  - **Control negativo** (cadena de S5, sin la migración): las tres sondas **FALLAN**: la segunda escritura se aplica, 1 salto de versión y 1 `before_state` falso en cada una.
  - **Con la migración:** 3 corridas completas en `PASS`; la segunda escritura recibe `Catalog version conflict` (`40001`), 0 saltos, 0 `before_state` falsos; fases 1 y 2 de D2 sin cambios (0 deadlocks).
- **Verificación** sobre `supabase db reset` en un stack aislado (`discotica-s6`, 545xx, detenido con `--no-backup`): `e06-verify.sql`, `e06-reopen-verify.sql`, `d1-verify.sql`, `d2-verify.sql`, `e18-verify.sql` en verde sobre la cadena vacía; `d1-concurrency.sh` y `d2-concurrency.sh` en verde; `playwright test e07-admin-console`: 8 de 8 (las RPC van simuladas, así que no ejercitan la base).
  - Control negativo de H5: el cuerpo de rollback seguido de `e06-verify.sql` falla con `releases_published_type_required_check`.
- **Rollback:** `tests/sql/s6-rollback-verify.sql` (cuerpo entre `>>> S6 ROLLBACK` y `<<< S6 ROLLBACK`, ensayado: `S6 rollback verify: OK`). Es una migración posterior (`npx supabase migration new s6_rollback_e06_concurrency_and_policies`), nunca se edita la de S6. Devuelve las cuatro RPC a los cuerpos de 20260916220554 y las policies a las de E09 y E18, sin tocar datos ni auditoría. **Reintroduce la pérdida de actualizaciones concurrentes (H1)**: solo como último recurso.
- **Staging:** aplicada el 2026-10-15 a las 00:20:47 UTC (paso 7). La matriz B8 dio las mismas 26 líneas antes y después, con una política por tabla. `e06-verify`, `e06-reopen-verify` y D2 en verde, y advisors sin ningún `WARN`. `d2-concurrency.sh` no se corrió: es solo local.
- **Sin commit ni push.**

## Saneamiento S4 — arreglos menores y documentación (2026-10-11)

- **I2 (anuncio de resultados):** ya estaba corregido desde U10: `anuncioResultados` llama a `describeResults` con sus entradas dentro de la sentencia reactiva (`src/routes/+page.svelte`). S4 añade la prueba que faltaba en `tests/browser/u10-inicio.spec.ts`: la región `aria-live` dice "300 lanzamientos." tras cargar y "150 lanzamientos." tras aplicar el filtro Tipo = EP en la página.
- **H8 (nombres reservados):** la migración D1 reserva `coleccion` y `mis-colecciones`. **Verificación pendiente:** no había stack local (Docker apagado), así que `d1-verify.sql`, `d1-concurrency.sh` y `d1-rollback-verify.sql` no se repitieron. Detalle en el [relevo de D1](./d1-datos-perfil-colecciones-2026-10-06.md#cambio-posterior-nombres-reservados-h8-s4-2026-10-11).
- **X1 y X4:** secciones de U1, R1, R2, U2 y U3 más abajo; el relevo de U1 vive en [`tests/visual/README.md`](../../tests/visual/README.md). La descripción del catálogo vía TSV en "Hechos verificados" queda marcada como histórica.
- **Siguiente acción segura:** seguir el [plan de saneamiento](../producto/plan-saneamiento-2026-10-06.md) en el orden de su sección 3: cerrar S1 (workflows, `.nvmrc` y `package.json` siguen sin commit en el árbol), después S3, S5 (que incluye repetir las pruebas SQL de D1 con H8) y S6–S9. U18 espera a que se cierren S3–S9.

## Saneamiento S0 y línea base sobre U17 (2026-10-11)

- **S0 cerrada en local:**
  - todo el trabajo desde mayo está en la rama `modernizacion-2026`, en 7 commits por bloque; `main` sigue en `0ab31e0`;
  - respaldo en `../discotica-backups/2026-10-11-arbol/` con `SHA256SUMS`, más una copia fuera de este disco;
  - **sin push**: `origin` (`discotica/biblioteca`) es público.
- **X3 cerrada:** `.env` está vacío.
- **U10b, U11, U12, U13, U14, U16 y U17 aceptadas.** La línea base está recapturada sobre U17: 182 capturas, se borraron las `.ref-pre-*` y el detalle está en [`decisiones.md`](./decisiones.md).
- **Arreglo de inestabilidad:** al saltar de sección en el editor con `prefers-reduced-motion`, el header ya no depende de una carrera de foco. También se estabilizaron las capturas `estudio-editor-medios-M` y `generos-D`.
- **Deuda:**
  - `lab-u6-M` y `lab-u8-M` tienen antialiasing intermitente, del 0,01 %;
  - "El censo conserva sus 127 IDs" sigue fallando desde U7;
  - E17:202 sigue fallando en `test:browser` (S3).
- **Siguiente acción segura:** cerrar S1, que ya está en curso en el árbol con los workflows, `.nvmrc` y `package.json`. Después, S3, S4 (H8) y S5 del [plan de saneamiento](../producto/plan-saneamiento-2026-10-06.md). U18 espera a que se cierren S3–S9.

## U17 — Estudio: propuestas y reportes: aceptada el 2026-10-11 (implementada 2026-10-10)

- **Arranque:** U15 aceptada; U16 sin aceptar. La comparación contra `.ref-pre-u16` dio solo lo de U16; el árbol de partida se capturó en `tests/visual/.ref-pre-u17/` (176).
- **Propuestas en bandeja:** lista a la izquierda y detalle a la derecha; en móvil, lista y después detalle, con "Volver". La propuesta abierta va en la URL (`?propuesta=`).
- **Detalle:** solo lo propuesto, en el orden de Sugerir, con "Editado" en lo que difiere de lo detectado (título, artistas, tipo y fecha) y "Sin nota" si no la hay.
- **Acciones iguales a E10:** el colaborador marca lista para administración; el admin aprueba (con resumen), pide cambios o rechaza, con nota obligatoria en estos dos. Tras decidir se abre la siguiente; al aprobar, el aviso lleva al lanzamiento en el Catálogo.
- **Reportes** en la misma bandeja: abiertos y resueltos, estados en español, enlace al lanzamiento y la clasificación de siempre.
- **Layouts nuevos** `InboxLayout`, `InboxItem`, `InboxDetail` e `InboxField`, en `/lab`. Token `--tool-inbox-list-w`.
- **Sin cambios de contrato** (E09, E18): mismos RPC con los mismos cuerpos, comprobados con igualdad estricta.
- **Pruebas:**
  - `npm test` 153/153, build y `lint:tokens` OK;
  - `u17-bandeja.spec.ts` 11/11 (×3);
  - E10 8/8 y U15 15/15, adaptadas;
  - `test:browser`: 311 pasan, solo falla E17:202 (conocida).
- **Visual:** contra `.ref-pre-u17`, 6 diferencias y 6 capturas nuevas, todas de Propuestas, Reportes y `/lab`. La línea base no se recapturó.
- **Pendiente del equipo:** la ayuda de "Nota interna" promete algo que administración no ve (limitación de E09 desde E10).
- Relevo: [`u17-estudio-propuestas-reportes-2026-10-10.md`](./u17-estudio-propuestas-reportes-2026-10-10.md). Sin commit, push ni producción.

## U16 — Estudio: editor: aceptada el 2026-10-11 (implementada 2026-10-10)

- **Arranque:** U15 aceptada por el equipo al empezar U16. La línea base oficial sigue en U10 (U10b–U14 sin aceptar); el árbol de partida se capturó en `tests/visual/.ref-pre-u16/` (172) y se borró `.ref-pre-u15`.
- **Editor en una página** con índice lateral fijo: Datos, Créditos, Clasificación, Medios e Historial, con lo que falta para publicar marcado por sección. Más compacto: géneros y países con el Combobox de U6 (sin la nube), créditos en filas, radar en una fila y el historial como última sección. Sin vista previa.
- **Móvil edita:** el índice es un selector fijo arriba y la barra de guardar (observación, Publicar, Guardar) queda fija abajo, igual que en desktop. Archivar y los enlaces relacionados van a "Más acciones".
- **Auditoría igual:** el servicio no cambió. El payload de cada RPC se comprobó con igualdad estricta frente al de E07 para la misma edición (crear, guardar sin y con cambios, archivar, revertir, arrastrar créditos), a 390 y 1440.
- **Sticky en el Estudio:** `html.is-tool` usa `overflow-x: clip` en lugar de `hidden`, y el header publica `--header-offset`. El arreglo global queda para U18 (activaría el header fijo en todo el sitio).
- **Pruebas:**
  - `npm test` 142/142, build y `lint:tokens` OK;
  - `u16-editor.spec.ts` 12/12 (24/24 ×2);
  - E07 8/8 y U15 15/15, adaptadas; U13 8/8;
  - `test:browser`: 299 pasan, solo falla E17:202 (conocida).
- **Visual:** contra `.ref-pre-u16`, 15 diferencias y 4 capturas nuevas, todas del editor y de `/lab`. La línea base no se recapturó.
- Relevo: [`u16-estudio-editor-2026-10-10.md`](./u16-estudio-editor-2026-10-10.md). Sin commit, push ni producción.

## U15 — Estudio: estructura y catálogo: aceptada (2026-10-10)

- **Aceptada** por el equipo al arrancar U16. La línea base no se recapturó porque habría aceptado también U10b–U14; se borró `.ref-pre-u15` y U16 se aisló con `.ref-pre-u16`.

- **Estudio en `/estudio`** con el `ToolLayout` de U7: barra lateral por rol (Catálogo con sus cuatro vistas rápidas y su tamaño, Propuestas y Reportes), ancho completo, densidad compacta, header a ancho completo y sin pie.
- **Redirecciones:** `/admin/catalogo` → `/estudio/catalogo` y `/editorial` → `/estudio/propuestas`, con la query, en el cliente y como 301 en `.htaccess` (verificadas con el Apache local).
- **Permisos iguales:** admin las tres secciones; colaborador solo Propuestas; comunidad y sin sesión, nada. Verificado en staging en solo lectura, antes y después, con salidas idénticas (`tests/sql/u15-staging-permissions.sql`). Staging no tiene cuentas con rol colaborador: ese rol se verificó por la huella de sus gates y políticas.
- **Catálogo:** tabla con la densidad de E07 y las señales de D2; vistas rápidas por URL (`?vista=`); selección entre páginas y lote de publicar o archivar con confirmación, observación obligatoria, límite de 50 e informe por elemento. El editor no cambia (U16) y se abre por URL (`?lanzamiento=`, `?nuevo=1`).
- **Enlaces cruzados** entre un lanzamiento, sus reportes y sus propuestas; aprobar deja un enlace al lanzamiento creado.
- **Propuestas y Reportes:** la vista de E10, movida y partida en dos (su rediseño es U17).
- **Pruebas:**
  - `npm test` 134/134, build y `lint:tokens` OK;
  - `u15-estudio.spec.ts` 15/15 (45/45 ×3);
  - E07 8/8 y E10 8/8, adaptadas;
  - `test:browser`: 288 pasan, solo falla E17:202 (conocida).
- **Visual:** contra `.ref-pre-u15`, 30 diferencias y 8 capturas nuevas, todas del Estudio, del bloque Estudio del perfil y de `/lab`. La línea base no se recapturó.
- **No publicar todavía en staging:** allí faltan D2 y E18, así que la lista del Catálogo y Reportes fallan (lo de la lista ya pasaba con `/admin/catalogo` desde D2). Orden: E18 corregida → D2 → U15.
- Relevo: [`u15-estudio-estructura-catalogo-2026-10-10.md`](./u15-estudio-estructura-catalogo-2026-10-10.md). Sin commit, push ni producción.

## U14 — Perfil, aportes y colecciones: aceptada el 2026-10-11 (implementada 2026-10-10)

- **Mis aportes** (`/mis-aportes`): filas compactas con estado, lanzamiento, fecha y una acción a tamaño normal. Mismos estados y datos que la sección del perfil, que desaparece. El menú de cuenta, el perfil propio y Sugerir enlazan aquí.
- **Perfil:** redes con SocialLinks; en el propio, "Editar redes" (→ `/cuenta#redes`), interruptor "Mostrar mis aportes aceptados" y Estudio para admin y colaborador. En el ajeno, colecciones públicas en mosaico y aportes aceptados solo si su dueño lo permite.
- **Mis colecciones:** mosaico de 4 portadas y nombre, "…" con Compartir, Editar y Eliminar; crear y editar en `Dialog`.
- **Colección:** Compartir, Editar y Eliminar arriba; grilla/lista recordada; sin notas; reordenar desde el asa solo el dueño (`reorder_crate_items`, D1); quitar con "Deshacer"; carga por ID.
- **Primitivas:** `Checkbox variant="switch"` y `Sortable` con `bare` y `listClass`, en `/lab`.
- **Sin D1** (staging hoy): orden por fecha y sin asas; perfil sin redes ni aportes. Nada falla.
- **Pruebas:**
  - `npm test` 125/125, build y `lint:tokens` OK;
  - `u14-perfil-colecciones.spec.ts` 13/13 ×3;
  - `test:browser`: 273 pasan; solo falla E17:202 (conocida). E16:294 falló una vez en la primera pasada (intermitente conocida).
- **Visual:** contra `.ref-pre-u14`, 12 diferencias y 14 capturas nuevas, todas de perfil, Mis aportes, Mis colecciones y colección. La línea base no se recapturó.
- Relevo: [`u14-perfil-colecciones-2026-10-10.md`](./u14-perfil-colecciones-2026-10-10.md). Sin commit, push ni producción.

## U13 — Sugerir y reportar: aceptada el 2026-10-11 (implementada 2026-10-09)

- **Sugerir por pasos:** fuente → revisar datos → nota → enviar.
  - Se vuelve con "Atrás", "Editar" o el navegador sin perder datos.
  - El borrador de E09 sigue igual.
  - La nota es opcional y el resumen dice "Sin nota".
  - Artistas, géneros y países con el Combobox de U6.
- **Directo a crear (pedido del equipo):** el botón Sugerir abre el paso 1 con el foco en la fuente, también para admin. El último paso de admin es "Continuar en la consola", con "Nuevo lanzamiento" rellenado.
- **Reportar:** desde la ficha, el lanzamiento llega identificado y la categoría es "Error de catálogo". El selector de captura está en español.
- **Menú global:** ningún enlace navegaba (dos menús montados). Corregido en `Header`.
- **Pruebas:**
  - `npm test` 122/122;
  - E10 8/8 y U13 8/8;
  - `test:browser`: 260 pasan; solo falla E17:202 (conocida).
- **Visual:** contra `.ref-pre-u13`, 9 diferencias, todas de `/sugerir` y `/reportar`.
- **Sin contrato nuevo:** "cambio a un lanzamiento existente" no existe en E09; el caso está documentado para E09.
- Relevo: [`u13-sugerir-reportar-2026-10-09.md`](./u13-sugerir-reportar-2026-10-09.md). Sin commit, push ni producción.

## U12 — Cuenta: entrar, registro y correo: aceptada el 2026-10-11 (implementada 2026-10-09)

- **Entrar:**
  - dos columnas con tres beneficios y, en móvil, primero el formulario;
  - "Usuario o correo": con `@` usa Supabase Auth y, si no, `login-with-username`;
  - el mismo error en todos los casos.
- **Registro:**
  - un paso en cuatro grupos;
  - PasswordField en vivo;
  - redes opcionales de D1;
  - lleva a "Revisa tu correo" (`/auth/confirmar`), con "Abrir Gmail/Outlook/iCloud Mail" y reenviar con 60 s de espera.
- **Al confirmar:** Mis colecciones con aviso.
- **Editar cuenta** (`/cuenta`), pedida por el equipo en el chat: perfil, redes, novedades, correo y contraseña. Se llega desde el menú de cuenta y el perfil propio.
- **Primitivas nuevas:** `Notice` y `Checkbox`.
- **Pruebas:**
  - `npm test` 116/116, build y `lint:tokens` OK;
  - `u12-cuenta.spec.ts` 19/19 ×3;
  - `test:browser`: 252 pasan ×2, solo falla E17:202 (conocida).
- **Visual:** contra `tests/visual/.ref-pre-u12/`, 31 diferencias, todas del alcance, más 5 capturas nuevas. La línea base no se recapturó.
- **Staging:** probado entrar con usuario y con correo, los seis casos de error con el mismo texto, el registro real (alta 200, correo enviado según `auth.users`) y reenviar (200 y luego el límite).
  - **Pendiente manual:** abrir el enlace de confirmación de `hola+u12-10092308@mamanche.com` y borrar esa cuenta de prueba.
- **D1** sigue sin aplicar en staging: las redes del alta no llegan al perfil, y `/cuenta` oculta las redes. (Aplicada el 2026-10-14 en el paso 7.)
- **Hallazgo para U18:** `login-with-username` no tiene un límite de intentos propio.
- Relevo: [`u12-cuenta-2026-10-09.md`](./u12-cuenta-2026-10-09.md). Sin commit, push ni producción.

## U9 — Ficha: modal, página y móvil: aceptada (2026-10-07)

- **Bloqueo:** se detuvo por geometría antes de editar. El equipo decidió dos columnas desde 768, la barra de acciones al pie de toda la ficha y un marco uniforme de 24 px con tope de 640 ([`decisiones.md`](./decisiones.md), "Ficha (2026-10-07, durante U9)").
- **Ficha:**
  - un solo componente para modal y página;
  - `CreditLine` por rol;
  - acciones del sistema en una línea (Comprar y Añadir a colección con texto; Compartir y Reportar como IconButton);
  - en móvil, barra fija abajo con el área segura;
  - página sobre la portada desenfocada.
- **Pruebas:**
  - `u9-ficha.spec.ts` 22/22 (matriz 390 · 680 · 767 · 768 · 834 · 1112 · 1440, modal y página, siete casos);
  - E16 14/14;
  - `test:browser`: 197 pasan; falla solo E17:198 (conocida).
- **Visual:** 25 diferencias, todas de la ficha o de `/lab`. La línea base no se recapturó.
- **Deuda registrada:** `body { overflow-x: hidden }` anula todo sticky del documento; el header tampoco se queda arriba. U9 no lo tocó (decisión del equipo).
- Relevo: [`u9-ficha-2026-10-07.md`](./u9-ficha-2026-10-07.md). Sin commit, push, datos ni producción.
- **Aceptación (2026-10-07):** `npm run visual:capture` (142 capturas) y `visual:compare` con 0 diferencias.
- **Siguiente acción segura:** U10 (inicio y búsqueda), que el plan asigna a Claude Opus 5.5 con esfuerzo `high`. Debe tener en cuenta el `overflow-x` de `body`: anula el sticky de la barra de búsqueda de E15 (ver la deuda en el relevo de U9).

## U8 — Tarjeta y modo lista: aceptada (2026-10-07)

- **Arranque:** U6 aceptada; U7 implementada sin aceptar. La `visual:compare` previa dio las 114 diferencias de U7 y ninguna de tarjeta. El estado de partida se guardó en `tests/visual/.ref-pre-u8/` para aislar U8 (`VISUAL_BASELINE_DIR`).
- **Tarjeta:**
  - Cover con fondo ambiental y CreditLine;
  - título a 24 px y hasta dos líneas (decisión del equipo);
  - año · país · sello en una línea y géneros en Chip `sm`;
  - compartir como IconButton discreto;
  - las tarjetas de una fila miden lo mismo.
- **Radar:** con cursor, al pasar. Con el dedo, el primer toque lo muestra y el segundo abre la ficha; deslizar desplaza la página. No hizo falta escalar.
- **Fila del modo lista:** `LanzamientoFila`, con las mismas piezas en 73 px, sin radar.
- **Grilla compartida** (`.lanzamientos-grilla`) en inicio, artista, sello y colección: nunca más de 3 columnas. Corrige el desborde de la segunda columna en tablet.
- **Pruebas:**
  - `npm test` 106/106, lint y build en verde;
  - `u8-tarjeta.spec.ts` 54/54 en tres repeticiones;
  - `test:browser`: 174 pasan; fallan E17:198 (conocido) y E14 (intermitente, 9/10 aislada).
- **Visual:**
  - solo U8: 63 capturas cambian, todas por la tarjeta, la grilla o las tarjetas tras una capa, más 2 nuevas;
  - contra la línea base: 133 distintas (U7 + U8).
- **Para U9** (feedback del equipo): en la ficha, "y N más" no se despliega y los créditos van en mayúsculas sostenidas. La ficha debe pasar a `CreditLine variant="roles"` con nombres en caja normal.
- **Aceptación (2026-10-07), junto con U7:** `npm run visual:capture` (142 capturas) y `visual:compare` con 0 diferencias. Se borraron `.ref-pre-u8` y `CreditSummary.svelte`. Pendiente: el doble toque en un iPhone real.
- Relevo: [`u8-tarjeta-modo-lista-2026-10-07.md`](./u8-tarjeta-modo-lista-2026-10-07.md). Sin commit, push, datos ni producción.
- **Siguiente acción segura:** U9 (ficha), que el plan asigna a Claude Opus 5.5 con esfuerzo `xhigh`. Debe incluir el feedback de créditos de arriba.

## U7 — Shell y layouts: aceptada (2026-10-07)

- **Arranque:** U6 aceptada. La `visual:compare` previa dio 5 diferencias, todas por la carga del equipo (detalle en el relevo); con menos carga, desaparecieron.
- **Header:**
  - mayúsculas sostenidas y Button del sistema;
  - Entrar lleno y Sugerir con borde, del mismo tamaño;
  - icono de menú de U5;
  - con sesión, avatar con menú de cuenta (Perfil, Mis colecciones, Mis aportes · Salir con icono); en móvil, el mismo grupo dentro del menú.
- **Estudio:** se accede desde el perfil propio de admin y colaborador, no desde el header.
- **Layouts** en `src/lib/layouts/`: contenedores narrow, regular, wide y full; PageLayout con migas; AccountLayout (con `split`); ReadingLayout (manual y privacidad); ToolLayout para U15. `+error.svelte` usa ErrorState. Todas las rutas declaran layout y contenedor (excepciones listadas en el relevo).
- **Pruebas:**
  - `npm test` 106/106, lint y build en verde;
  - `u7-shell.spec.ts` 20/20;
  - E04/E12/E13/E14/E15 29/29;
  - `test:browser`: 156 pasan; fallan E17:198 (conocido) y E16 "cada apertura crea una sesión", intermitente en paralelo (3/3 aislada).
- **Visual:** 114 capturas cambian, todas por el shell o los layouts, y 5 nuevas. La línea base no se recapturó.
- **Aceptada el 2026-10-07**, junto con U8; la línea base se recapturó sobre U8 (ver U8).
- Relevo: [`u7-shell-layouts-2026-10-07.md`](./u7-shell-layouts-2026-10-07.md). Sin commit, push, datos ni producción.
- **Siguiente acción segura:** U8 (hecha y aceptada; ver arriba).

## U6 — Primitivas compuestas: aceptada (2026-10-07)

- **Arranque:** U5 aceptada; `visual:compare` con 0 diferencias antes de editar.
- **Primitivas** en `src/lib/ui/`, sobre `overlay.ts` y solo con tokens:
  - Combobox con chips: búsqueda sin tildes, sinónimos, crear cuando se permite y chips con teclado;
  - Menu "…" en portal, con `layerFor`: la capa del modal o la de la página;
  - Dialog con scroll interno y Sheet con altura según contenido y pie fijo;
  - Sortable: ratón, dedo y teclado, con anuncios;
  - Cover cuadrada con respaldo y fondo ambiental;
  - CreditLine (regla de R2 y variante por rol);
  - SocialLinks.
- **`overlay.ts`:** cambios compatibles (`layerFor`, `tabCloses`, `align`, `matchWidth`, viewport visual, Escape del combobox).
- **Pruebas:**
  - `npm test` 106/106, lint y build en verde;
  - `u6-lab.spec.ts` 19/19, y 57/57 en tres repeticiones;
  - `test:browser`: solo los fallos conocidos (E17:198 y E14 intermitente).
- **Visual:** solo cambian `lab-D` y `lab-M`; hay 2 capturas nuevas, `lab-u6-D` y `lab-u6-M`.
- **Aceptada.** Línea base recapturada sobre U6: 135 capturas y 0 diferencias. `home-approx-D` dio 4 px una vez y luego se estabilizó; está anotado en el relevo.
- **Pendiente:** la pasada humana con VoiceOver en combobox y ordenable (guion en el relevo).
- Relevo: [`u6-primitivas-compuestas-2026-10-07.md`](./u6-primitivas-compuestas-2026-10-07.md). Sin commit, push, datos ni producción.
- **Siguiente acción segura:** U7 (shell y layouts) con Claude Sonnet 5.5, esfuerzo `high`.

## U5 — Primitivas base: aceptada (2026-10-07)

- **Arranque:** U4 aceptada por el equipo ([`decisiones.md`](./decisiones.md)). Se respaldó la línea base previa a U4 en `tests/visual/.ref-pre-u4/` y se recapturó sobre U4, con 0 diferencias antes de editar.
- **Primitivas** en `src/lib/ui/`, todas en modo runes y solo con tokens:
  - Icon, con 28 iconos SVG, incluidos el menú de tres barras iguales y las cinco redes del perfil;
  - Button e IconButton: 5 variantes × sm/md/lg (32/44/52); el icono solo lleva nombre accesible y ayuda;
  - Field, Textarea y PasswordField, con reglas y fortaleza en vivo;
  - Chip: filtro, género y estado;
  - Pagination: completa, compacta y automática;
  - ViewToggle, recordado por contexto con try/catch;
  - Skeleton de tarjeta y de fila, y LoadingIndicator con los puntos en horizontal;
  - EmptyState, ErrorState y Breadcrumbs.
- **Catálogo** en `/lab`: sin enlaces y con `noindex`.
- **Emoji por SVG**, solo con cambio de icono: Buscar y Cerrar búsqueda, los ✔ de Filtros y el ↗ de la Estación editorial.
- **Pruebas:**
  - `npm test` 92/92, lint y build en verde;
  - `u5-lab.spec.ts` 9/9, que cubre 390 y 1440, teclado, foco y 44 px;
  - `test:browser`: solo los fallos ya conocidos (E17:198 persistente y E17:99 en paralelo, que pasa 5/5 aislada).
- **Visual:** 22 capturas distintas, todas acotadas al icono, más `lab-D` y `lab-M` nuevas. Hay una incidencia: la línea base de `editorial-colab-D` se reescribió por un filtro `-g` demasiado amplio; está explicada en el relevo.
- **Aceptada.** Línea base recapturada sobre U5: 133 capturas y 0 diferencias.
- **Pendiente:** decidir si `/lab` debe existir solo en desarrollo.
- Relevo: [`u5-primitivas-base-2026-10-07.md`](./u5-primitivas-base-2026-10-07.md). Sin commit, push, datos ni producción.
- **Siguiente acción:** U6, ejecutada (ver arriba).

## U4 — Tokens v2: aceptada (2026-10-07)

- **Arranque:**
  - el equipo decidió hacer U4 antes que E22 y aceptó R1, R2, U2 y U3 ([`decisiones.md`](./decisiones.md), "Orden frente a E22 y línea base");
  - se recapturó `tests/visual/baseline/` sobre ese estado, con las plantillas de D3;
  - quedan cerrados S2 y X2 del plan de saneamiento.
- **Escalas:**
  - `src/lib/styles/tokens.css` es la única fuente de literales;
  - tipografía en 9 pasos, con 12 px como mínimo;
  - 20 tokens con alfa, más estados y categorías;
  - radios 4 + pill, controles 32/40/44/52, breakpoints 480/680/768/1024/1280;
  - capas, motion, navegación en mayúsculas, scrollbars propias y densidad del Estudio.
- **Migración:** los 724 colores, 342 tamaños de fuente, 158 radios y 36 breakpoints literales de `src/` pasan a tokens.
- **Lint:** `npm run lint:tokens` corre en CI y falla con un literal nuevo; tiene 2 excepciones temporales (los radares SVG).
- **Pruebas:**
  - `npm test` 81/81 y `build` en verde;
  - `test:browser`: solo los fallos ya conocidos (E17:198 persistente, E14 intermitente, 5/5 aislada);
  - contraste del texto pequeño: 4.618 textos en 32 vistas, 0 por debajo de 4.5:1.
- **Visual:** 129 capturas distintas de la línea base, todas clasificadas. Hubo 4 regresiones, ya corregidas: desborde del footer a 390 px, fecha de la consola sobre la insignia de Estado, alto de la tarjeta y contraste.
- **Aceptada** al arrancar U5. La línea base se recapturó sobre U4; la previa quedó en `tests/visual/.ref-pre-u4/`. Sigue sin haber commit del árbol.
- Relevo: [`u4-tokens-v2-2026-10-07.md`](./u4-tokens-v2-2026-10-07.md). Sin commit, push, datos ni producción.

## D3 — Correo propio y plantillas: cerrada en staging en el paso 9 (2026-10-15) (plantillas listas en local el 2026-10-06)

- **Proveedor aprobado:** Resend Free (3.000 correos al mes, 100 al día). El remitente es `hola@discotica.com`.
- **Pendiente de una persona con acceso:**
  - crear la cuenta en Resend;
  - crear los registros DNS (`send` MX/TXT, `resend._domainkey`, `_dmarc`);
  - cargar SMTP y plantillas en el dashboard de staging.
  
  Después falta el envío real y la revisión en Gmail web, Gmail móvil y Apple Mail. Relevo: [`d3-correo-propio-plantillas-2026-10-06.md`](./d3-correo-propio-plantillas-2026-10-06.md).
- Plantillas de confirmación, recuperación y cambio de correo en `supabase/templates/` (HTML + `.txt`), referenciadas en `config.toml` y verificadas en local.
- **Hallazgos:**
  - hola@discotica.com no recibe correo, porque el dominio no tiene MX;
  - el CLI está enlazado a producción;
  - Supabase envía solo HTML, sin `text/plain`;
  - el logo depende del próximo despliegue.

## S5 — E18 aplicable y cadena de migraciones desde cero: aplicada en staging en el paso 7 (2026-10-14) (lista en local el 2026-10-11)

- **B2 / H2, B3 / H3 (E18):** FK a `public.releases(id)` y `grant execute` de `private.valid_problem_report_context(jsonb)` a `authenticated`, sin `USAGE` en `private` ni trigger `SECURITY DEFINER`. Justificación y advisors en [el expediente de E18](./e18-reportes-problemas-2026-09-23.md), "Corrección 2026-10".
- **H7:** nueva migración base `20260830000000_base_profiles_crates_pre_phase4.sql`, anterior a la primera migración versionada.
  - Recrea `profiles`, `crates` y `crate_items` como en el dump del 2026-08-30 (columnas, restricciones, índices, políticas y grants comparados línea a línea).
  - Cada bloque actúa solo si su tabla no existe (`to_regclass`). Donde existe, no hace nada; ensayado sobre una base ya poblada: políticas, ACL, RLS y columnas idénticas antes y después.
  - Sustituye a `tests/sql/local-bootstrap-pre-phase4.sql`, que se eliminó. Ya no hay copias temporales ni parches.
- **Verificación** sobre `supabase db reset` en un stack aislado (`discotica-s5`, 544xx), detenido con `--no-backup`:
  - `e18-verify.sql`, `d1-verify.sql` y `d2-verify.sql` en verde. `e18-verify.sql` ahora crea sus fixtures y tiene control negativo;
  - `db lint --level warning` sin errores;
  - advisors: nada nuevo respecto de D1/D2 salvo los 6 propios de E18 (2 `WARN` de políticas permisivas múltiples, que absorbe B8/S6).
- **Staging (paso 7):** `20260830000000` se marcó con `migration repair` el 2026-10-14 a las 23:34:39 UTC, y E18 se aplicó a las 23:58:55 UTC (`e18-verify.sql` OK). Nota original: el historial remoto no contiene `20260830000000`, y el CLI se niega a insertar una migración anterior a la última remota. Antes del `db push` hay que marcarla con `supabase migration repair --status applied 20260830000000 --project-ref hgocyrzhgohetfpzbmfs`; así no se ejecuta ni una sola vez allí. Si se ejecutara (`--include-all`), es un no-op.

## D2 — Datos del Estudio: lote y vistas rápidas: aplicada en staging en el paso 7 (2026-10-14) (lista en local el 2026-10-06)

- Migración `20261006200859_d2_studio_batch_and_quick_views.sql`:
  - publicar o archivar en lote (solo admin, todo o nada, hasta 50, informe por elemento), pasando cada lanzamiento por la RPC individual de E06;
  - señales `signals` en el snapshot administrativo;
  - filtro `p_quick_view` en la lista y conteos de las vistas rápidas;
  - `batch_id` en la auditoría.
  
  También el servicio y los tipos en `adminCatalog.ts`. No se construyó interfaz. Relevo completo, con ejemplos de respuesta: [`d2-estudio-lote-vistas-rapidas-2026-10-06.md`](./d2-estudio-lote-vistas-rapidas-2026-10-06.md).
- "Incompleto" = no cumple la regla de publicación de E06. Los campos que se miran son fecha, tipo, sello, artista principal, género, país, portada HTTPS y enlace principal HTTPS.
- Verificada en un stack local aislado:
  - `tests/sql/d2-verify.sql` en verde, con 13/13 mutaciones detectadas;
  - concurrencia (`tests/sql/d2-concurrency.sh`) con control negativo;
  - rollback ensayado y API real 20/20;
  - regresión de E06, D1 y la consola E07 (8/8);
  - advisors sin hallazgos nuevos y `db lint` limpio;
  - `npm test` 74/74 y `npm run build` en verde.
- **Staging:** aplicada el 2026-10-15 a las 00:11:04 UTC (paso 7). `d2-verify.sql` adaptado a staging dio OK, y U15 ya funciona allí. Detalle en el [relevo D2](./d2-estudio-lote-vistas-rapidas-2026-10-06.md#staging-paso-7-2026-10-14).
- **Depende de E18:** la migración se detiene si no existe `public.problem_reports`. Desde S5 E18 está corregida en el repositorio y D2 se prueba sobre la cadena completa, sin parches.
- **Hallazgos preexistentes que requieren decisión** (detalle en el relevo D2):
  - **H1, E06:** dos ediciones individuales simultáneas con la misma versión pierden una actualización sin `40001`, y la auditoría queda con un `before_state` falso. El lote no lo sufre. Se recomienda corregir E06 antes de U15.
  - **H2 y H3, E18: resueltos en local (S5, 2026-10-11).** La FK apunta a `public.releases(id)` y `authenticated` tiene `EXECUTE` sobre el validador del `CHECK`. Detalle en [`e18-reportes-problemas-2026-09-23.md`](./e18-reportes-problemas-2026-09-23.md), "Corrección 2026-10". Aplicados en staging en el paso 7.
  - **H4:** cada escritura de E06 borra metadatos de portadas y enlaces.
- U15 puede programarse sobre este contrato, pero solo se publica después de aplicar D2 en el entorno correspondiente.

## D1 — Datos de perfil y colecciones: aplicada en staging en el paso 7 (2026-10-14) (lista en local el 2026-10-06)

- Migración `20261006131054_d1_profile_social_and_collection_order.sql`: redes en `profiles`, preferencia de aportes públicos con su RPC, y orden manual de colecciones con su RPC. Además, tipos y servicios de cliente. No se construyó interfaz. Relevo completo: [`d1-datos-perfil-colecciones-2026-10-06.md`](./d1-datos-perfil-colecciones-2026-10-06.md).
- Verificada en un stack Supabase local: RLS (`tests/sql/d1-verify.sql`, con 8/8 mutaciones detectadas), concurrencia (`tests/sql/d1-concurrency.sh`, con control negativo), rollback ensayado, API real con supabase-js, advisors sin hallazgos nuevos y `db lint` limpio. `npm test` 73/73 y `npm run build` en verde.
- **Staging:** aplicada el 2026-10-15 a las 00:01:39 UTC (paso 7), con backfill 4/4, `d1-verify.sql` OK y H8 verificado. Detalle en el [relevo D1](./d1-datos-perfil-colecciones-2026-10-06.md#staging-paso-7-2026-10-14).
- **Hallazgo preexistente, resuelto en S5:** E18 no aplicaba sobre una cadena limpia (FK a la vista `public.catalog_releases`, `42809`). Corregido en el archivo de E18; ver la sección S5.
- Bandcamp acepta página de artista (`artista.bandcamp.com`) y de fan (`bandcamp.com/usuario`); el formulario pide el enlace ([`decisiones.md`](./decisiones.md), contrato D1).
- U12 y U14 pueden programarse sobre este contrato, pero solo se publican después de aplicar D1 en el entorno correspondiente.

## U3 — Colecciones: lenguaje y URLs: aceptada el 2026-10-07 (implementada 2026-10-06)

- "Crate" sale de la interfaz (13 archivos de `src`); tablas, columnas, stores, tipos, componentes y clases conservan su nombre.
- Rutas nuevas `/mis-colecciones` y `/coleccion/[slug]`. Las viejas redirigen en cliente (`replaceState`, con `search` y `hash`) y con 301 en `static/.htaccess`. La regla vive en `src/lib/domain/collectionRoutes.ts`.
- Pruebas al cierre: `npm test` 67/67; `test:browser` con E17:198 y E17:99 (intermitente). Contra la referencia previa a U3: 49 diferencias visuales, todas de texto.
- La aceptación llegó con la recaptura de la línea base sobre U4 (ver [`decisiones.md`](./decisiones.md), "Orden frente a E22 y línea base").
- Expediente: [`u3-colecciones-2026-10-06.md`](./u3-colecciones-2026-10-06.md).

## U2 — Saneamiento sin cambio visual: aceptada el 2026-10-07 (implementada 2026-10-06)

- Se borró `src/app.css` (sin importar) y la variante `detail` de `LanzamientoCard` (1.136 → 551 líneas). `routes/+page.svelte` pasó de 1.418 a 509 líneas.
- `--radius-md` (inexistente) pasa a `--radius-base`; los 19 usos de `#8cff18` en la consola, a `var(--color-acento)`; tres códigos internos `E\d\d` salen de textos visibles.
- Pruebas al cierre: `npm test` 65/65; `test:browser` con E17:198 persistente e intermitentes ya conocidos. Cambiaron 24 capturas, listadas en el expediente.
- Expediente: [`u2-saneamiento-2026-10-06.md`](./u2-saneamiento-2026-10-06.md).

## R2 — Errores visibles menores: aceptada el 2026-10-07 (implementada 2026-10-05)

- Ocho arreglos: regla única de créditos (`summarizeReleaseCredits`), espacio tras la coma, hoja de filtros a 390 px, enlace del éxito de registro, portada rota con `CoverFallback`, `+error.svelte` en español, etiquetas de estado de reportes y "Aleatorizar".
- Pruebas al cierre: `npm test` 57/57; `test:browser` con E17:198 y E17:99 (una vez), más E17:178 dentro del archivo completo.
- Expediente: [`r2-errores-visibles-menores-2026-10-05.md`](./r2-errores-visibles-menores-2026-10-05.md).

## R1 — Ficha y reproductor: errores: aceptada el 2026-10-07 (implementada 2026-10-05)

- Cuatro errores con causa raíz: reproductor aplastado en desktop, scroll que salta al elegir una pista, menú "Añadir a crate" cortado (nuevo `anchoredLayer` en `src/lib/ui/overlay.ts`) y menú "Varios artistas" tapado por la grilla.
- Pruebas al cierre: `npm test` 52/52; `tests/browser/r1-ficha-reproductor.spec.ts` (18 pruebas); 14 diferencias visuales, todas dentro del alcance.
- Expediente: [`r1-ficha-reproductor-2026-10-05.md`](./r1-ficha-reproductor-2026-10-05.md).

## U1 — Línea base y regresión visual: cerrada antes del 2026-10-05

- Suite en `tests/visual/` con red simulada, datos de un snapshot de staging y capturas deterministas. Convirtió las 127 capturas del censo en una suite reproducible (131 capturas al arrancar R1) y hoy tiene 182.
- No existe un relevo de U1 en `docs/`; su documentación es [`tests/visual/README.md`](../../tests/visual/README.md). La línea base original se perdió durante U2; la actual se recapturó sobre U17 (ver la sección de S0, arriba).

## Sistema de interfaz — U0 cerrada (2026-10-04)

- El censo visual (127 capturas, 25 vistas) está publicado en https://claude.ai/artifact/7NAxvxQyhyGMUK2Zr1GG55 y en texto en [`../producto/censo-interfaz-2026-10-03.md`](../producto/censo-interfaz-2026-10-03.md).
- Las 64 respuestas del equipo están respaldadas en [`respuestas-catalogo-ui.md`](./respuestas-catalogo-ui.md) y normalizadas en [`decisiones.md`](./decisiones.md), ronda 3.
- El plan está en [`../producto/plan-interfaz-2026-10-04.md`](../producto/plan-interfaz-2026-10-04.md): U1–U18, R1–R2 y D1–D3. Los prompts por etapa, con modelo y esfuerzo, están en [`../producto/prompts-interfaz-2026-10-04.md`](../producto/prompts-interfaz-2026-10-04.md).
- No se cambió código de la aplicación.
- **Siguiente acción segura:** U1 (línea base y regresión visual), con Claude Opus 5.5 (`claude-opus-5-5`) en esfuerzo `high`.
- D1 y D2 no aplican migraciones en staging mientras siga abierto el bloqueo de backup de E21. Las dos están listas en local (secciones D1 y D2, arriba).
- Se recomienda ejecutar E22 antes de U4 (sección 3 del plan).

## E21 — candidato de lanzamiento

El candidato `discotica-e21-rc1-canonical-no-go` recibió dictamen **NO-GO** en Biblioteca Staging `hgocyrzhgohetfpzbmfs`. El proyecto final `ewntlvugbopokdrvnwvg` no fue consultado ni modificado. La evidencia completa, hashes, matriz, issues y checklist están en [`e21-candidato-lanzamiento-qa-staging-2026-09-24.md`](./e21-candidato-lanzamiento-qa-staging-2026-09-24.md).

Bloqueos P0: E18 no está aplicada en staging; no se pudo generar/restaurar un backup fresco; cero créditos están verificados/editorialmente aprobados; y la suite browser integrada conserva dos fallos atribuibles a contratos/pruebas anteriores. No iniciar E22.

## Línea base reproducible E00 — 2026-09-14

Esta fotografía se tomó antes de cualquier edición documental de E00. No implica validación de staging ni de producción.

- Rama: `main`.
- Commit base: `0ab31e05de17404d2bfce1485d0ef0e592e07a3f` (`Fixes de modal: sync URL, cover, scroll y botón de cierre`, 2026-05-29T19:16:14-05:00).
- Node: `v22.18.0`; npm: `10.9.3`.
- Supabase CLI: no disponible en PATH (`supabase: command not found`); no se ejecutó ninguna operación de Supabase.
- Estado inicial del árbol: cambios locales no confirmados y numerosos archivos sin seguimiento. Se preservaron sin limpiar, restaurar, confirmar ni publicar.

### Verificaciones E00

| Comando | Resultado | Evidencia resumida |
| --- | --- | --- |
| `npm test` | **PASS** | 7/7 pruebas, 0 fallos. |
| `npm run build` | **PASS** | Vite/SvelteKit terminó correctamente con `adapter-static`; escribió `build/`. |
| `npm run test:browser` | **PASS** | 4/4 pruebas Chromium: ficha/portada, Bandcamp, SoundCloud y Spotify. Advertencias no bloqueantes de `NO_COLOR` ignorado por `FORCE_COLOR`. |

### Variables, flags y migraciones

Variables requeridas u observadas, registradas sin valores secretos: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (con compatibilidad observada para `VITE_SUPABASE_ANON_KEY`), `VITE_CATALOG_SOURCE`, `VITE_EDITORIAL_ENABLED` y `DATABASE_URL` para operaciones del importador. No se registró ningún valor de `.env`.

Flags vigentes: `VITE_CATALOG_SOURCE` (`legacy` por defecto; `canonical` activa Supabase) y `VITE_EDITORIAL_ENABLED` (`false` como valor seguro). Flags previstos por el plan, aún no creados: `VITE_ADMIN_CATALOG_ENABLED`, `VITE_ISSUE_REPORTING_ENABLED`, `VITE_BETA_INVITATION_ENABLED`, `VITE_BETA_FEEDBACK_EMAIL` y `VITE_PUBLIC_LAUNCH_LABEL`.

Migraciones locales pendientes de validación/aplicación operativa, sin ejecutar en E00: `20260830192747_create_canonical_catalog.sql`, `20260830193838_preserve_catalog_import_rejections.sql`, `20260830202105_phase4_identity_profiles_and_stable_crate_items.sql`, `20260830213000_phase5_editorial_contributions.sql` y `20260830233946_phase5_grant_editor_predicate.sql`. E00 no declara staging validado.

### Inventario de cambios locales relevantes

El árbol ya contenía antes de E00 modificaciones en: `.gitignore`, `package-lock.json`, `package.json`, `src/app.html`, `src/lib/components/Filtros.svelte`, `Header.svelte`, `LanzamientoCard.svelte`, `LanzamientoModal.svelte`, `LanzamientoVista.svelte`, `src/lib/utils/slugLanzamiento.ts`, `src/routes/+layout.svelte`, `+layout.ts`, `+page.svelte`, las rutas de artista, lanzamiento, manual, sello y sugerir, `static/favicon.png` y `static/manifest.json`.

También existían sin seguimiento `.agents/`, `.env.example`, `.github/workflows/ci.yml`, `.github/workflows/media-health.yml`, `playwright.config.ts`, `scripts/`, `skills-lock.json`, los nuevos componentes y stores de crates/auth/contribuciones, `src/lib/supabase.ts`, `src/lib/supabase/`, `src/routes/auth/`, `crate/`, `editorial/`, `mis-crates/`, `perfil/`, `privacidad/`, `src/lib/utils/catalogoStore.ts`, `supabase/` y `tests/`. Los documentos de `docs/` forman parte de ese conjunto local preexistente.

Los archivos documentales modificados por E00 son únicamente `docs/producto/decisiones-abiertas-biblioteca-2026-09-13.md`, `docs/producto/resoluciones-puntos-abiertos-biblioteca-2026-09-14.md` y este archivo. No se modificó código, migración, dato, entorno remoto, commit ni push.

## Fase actual

**Fase 6 — controles de calidad preparados localmente; pendiente aplicar y validar Fases 4–5 en staging antes del corte.**

## Hechos verificados en el repositorio

- Aplicación SvelteKit estática con `adapter-static`; SSR desactivado.
- El catálogo público se descarga desde un TSV publicado por Google Sheets y se procesa en el navegador.
- El repositorio contiene 622 lanzamientos en el JSON de referencia local.
- Supabase ya está integrado para autenticación, perfiles y crates. Las migraciones del catálogo nuevo ya viven en `supabase/migrations/`; las tablas existentes no se modificaron.
- Los crates guardan `lanzamiento_slug`; esto debe migrarse posteriormente a un ID de lanzamiento inmutable.
- La lógica de parseo TSV está duplicada entre rutas y componentes.
- **Nota (2026-10-11):** las viñetas anteriores sobre el catálogo vía TSV, el JSON de 622 lanzamientos y las portadas describen el repositorio al inicio de la modernización (E00). Son históricas. Hoy `src/lib/utils/catalogoStore.ts` elige la fuente con `VITE_CATALOG_SOURCE`: `canonical` lee `catalog_releases` de Supabase (staging, `.env.local` y CI) y `legacy` conserva el TSV. El código y `deploy.yml` usan `legacy` si la variable falta; el catálogo canónico no se ha activado en producción.
- Se detectaron 619 portadas para 622 registros; 583 vienen de `f4.bcbits.com` (Bandcamp).
- El reproductor actual crea embeds para Bandcamp, SoundCloud y Spotify a partir de `buy_link`.
- El proyecto compila correctamente. Hay advertencias de accesibilidad y marcado HTML que entrarán en la fase de calidad.
- El árbol de trabajo ya tenía cambios locales sin confirmar, incluidos auth y crates. Son cambios preexistentes que no deben mezclarse accidentalmente con la modernización.

## Accesos y límites conocidos

- El inventario de Supabase se completó en solo lectura: las únicas tablas de aplicación son `profiles`, `crates` y `crate_items`, con RLS habilitado. No existe aún catálogo en Supabase ni buckets de Storage. El detalle está en `auditoria-fase-1.md`.
- Existe `.env` local; sus valores no se han mostrado ni deben registrarse en Git.
- Supabase CLI y el cliente `psql` están disponibles localmente para respaldos y pruebas futuras.
- Hosting actual: sitio estático en Hostinger.
- Repositorio remoto: organización Discótica en GitHub; los propietarios son únicamente el equipo actual.

## Avances de Fase 1

- Se añadió `npm run audit:catalog`, que comprueba de forma repetible el JSON de referencia: campos faltantes, validez sintáctica de URLs, hosts principales, radar y candidatos a duplicado.
- Se añadió CI para ejecutar la auditoría y el build en pull requests y cambios a `main`.
- Se añadió `.env.example` sin secretos para documentar las únicas variables públicas requeridas por el cliente.
- El informe local está en [`auditoria-fase-1.md`](./auditoria-fase-1.md).
- Se generaron dumps lógicos de Supabase y un snapshot del TSV publicado en `../discotica-backups/2026-08-30/`, con checksums. No se modificó producción.
- La prueba de restauración se difiere: Supabase no contiene datos operativos útiles ni Storage. Debe completarse antes de cualquier migración irreversible en producción.

## Avances de Fase 2

- Se inicializó la configuración local de Supabase y se añadió la migración `20260830192747_create_canonical_catalog.sql`.
- El contrato normaliza lanzamientos, artistas, sellos, géneros, países y tipos; usa UUIDs inmutables, relaciones, radar validado, enlaces/portadas separados y mapa de alias de slugs.
- `catalog_import_keys` mantiene la relación entre la clave editorial de origen y el UUID. Las claves derivadas de contenido están permitidas solo para una primera carga explícita y repetible.
- RLS se habilitó para todas las tablas nuevas: las APIs públicas solo pueden leer lanzamientos publicados. La vista `catalog_releases` usa `security_invoker`; la rutina de importación está en `private`, no es accesible desde `anon` ni `authenticated`.
- Se añadió `npm run import:catalog`, que valida TSV, genera un reporte JSON y, con `DATABASE_URL`, importa de forma transaccional e idempotente. También se añadió `npm run test:catalog-import`.
- La migración y el importador se probaron en PostgreSQL local aislado: primera ejecución `created: 1`, segunda ejecución `updated: 1`, con una única fila pública y acceso de escritura privado denegado para `anon`.
- El TSV con `catalog_key` contiene 2.796 filas y SHA-256 `eb40f9612a3fb41c5e340c90a26f1eab41afcadc4eb7824895809d5f4725f54d`. Se importó exitosamente en staging: `created: 2790`, `updated: 0`, `rejected: 6`, `derivedKeys: 0`.
- Las seis filas estructuralmente inválidas se preservaron en `catalog_import_rejections` y no se publican ni se alteran automáticamente. El reporte también señaló diez URLs inválidas y 24 artistas repetidos dentro de sus filas; las URL no se exponen y los artistas se deduplican solo en la relación canónica, conservando el TSV crudo.

## Avances de Fase 3

- `src/lib/utils/catalogoStore.ts` es ahora el único repositorio de lectura. Convierte `catalog_releases` a la forma histórica que usan las vistas y conserva el TSV como fuente por defecto.
- `VITE_CATALOG_SOURCE=canonical` activa Supabase; `legacy` (o ausencia de variable) conserva Google Sheets. La consulta canónica está paginada internamente y mantiene el orden por fecha e ID.
- La portada, enlace, radar y fecha ISO se adaptan sin cambiar los contratos de componentes existentes. Las rutas de artista, sello, inicio y crates usan el repositorio único.
- Las URLs de lanzamientos resuelven primero el slug canónico y, cuando existe un único alias legado, redirigen al modal canónico. Los crates aún pueden resolver sus slugs históricos durante la transición.

## Siguiente acción segura

Aplicar en staging la migración `20260830202105_phase4_identity_profiles_and_stable_crate_items.sql` y desplegar la función `login-with-username`. Verificar allí el registro, confirmación, recuperación, login por username y acceso anónimo/propietario a crates públicos y privados. No aplicar todavía en producción.

## Avances de Fase 4

- Se reservan nombres de sistema y el trigger de alta valida username y metadatos antes de crear perfiles. El trigger `SECURITY DEFINER` deja de ser ejecutable como RPC por `anon` o `authenticated`.
- `crate_items.release_id` referencia `releases.id`. La migración conserva `lanzamiento_slug` para lectura histórica, registra equivalencias no ambiguas en `private.legacy_crate_release_map` y no adivina los slugs con más de un candidato.
- Los nuevos ítems se crean únicamente con `release_id`; un trigger copia el slug canónico como dato de compatibilidad. La interfaz añade y quita lanzamientos por UUID cuando el catálogo canónico está activo.
- El login del cliente usa la Edge Function `login-with-username`, que resuelve el email exclusivamente dentro de Supabase y devuelve una respuesta genérica ante credenciales inválidas. La recuperación de contraseña conserva el mensaje no enumerativo existente.
- Las políticas y grants se declaran por operación: cualquiera puede leer perfiles y crates públicos; solo el dueño puede crear, editar o borrar su crate e ítems. Los campos mutables del perfil excluyen `username`.

## Avances de Fase 5

- La migración `20260830213000_phase5_editorial_contributions.sql` añade roles explícitos, propuestas con estados de borrador, pendiente y resolución, además de un historial de acciones editoriales.
- Las RLS impiden que una persona de comunidad lea propuestas ajenas, se atribuya otra propuesta o publique directamente. La aprobación editorial crea el lanzamiento público y sus relaciones básicas en la misma transacción.
- `/sugerir` sustituye el formulario externo por una propuesta autenticada y moderada. `/editorial` ofrece cola, aprobación, solicitud de correcciones y rechazo a colaboradores y administradores.
- `VITE_EDITORIAL_ENABLED=false` es el valor de despliegue seguro: impide consultar tablas/columnas de Fase 5 antes de que staging tenga la migración. Tras la validación se cambia a `true` en el entorno correspondiente y se recompila el sitio.
- `inspect-release-source` detecta Bandcamp, Spotify y SoundCloud bajo HTTPS y con tiempo límite; las fuentes desconocidas se conservan como edición manual, sin convertir la función en un proxy arbitrario.
- El bucket privado `contribution-covers` limita MIME, tamaño y acceso por autor/editor. La promoción de una portada subida y la limpieza programada de objetos temporales quedan como tarea operativa antes de producción.

## Avances de Fase 6

- `npm run test` cubre la importación canónica y las reglas del monitor de enlaces; `npm run test:browser` prueba en Chromium la navegación de una ficha, su portada y los reproductores de Bandcamp, SoundCloud y Spotify con un TSV de fixture.
- `npm run verify:media` inspecciona enlaces y portadas mediante solicitudes no destructivas, con concurrencia limitada y reporte JSON. GitHub Actions lo ejecuta diariamente y conserva el informe como artefacto; ningún resultado cambia el catálogo automáticamente.
- Se corrigieron los avisos actuales de accesibilidad y HTML del build: tarjetas ya no usan un contenedor no interactivo como botón, los diálogos/menús tienen controles accesibles y se repararon atributos que tenían comillas tipográficas.
- `operacion-fase-6.md` define el simulacro de restauración, rollback por feature flags y un corte gradual. Aún falta ejecutar ese simulacro contra staging/producción; no se declara completada la fase hasta entonces.

## No hacer todavía

- No cambiar de hosting.
- No borrar los JSON/TSV ni Google Sheets.
- No aplicar cambios de Fase 4 en producción hasta completar la validación en staging.
- No aplicar Fase 5 antes de validar Fase 4 en staging; asignar al menos un rol `admin` de forma administrativa antes de usar `/editorial`.
- No desplegar el formulario de contribuciones en producción hasta validar el flujo completo en staging, incluidos roles, RLS y Storage.
- No retirar `lanzamiento_slug` hasta revisar los ítems que no tengan equivalencia única en `private.legacy_crate_release_map`.
