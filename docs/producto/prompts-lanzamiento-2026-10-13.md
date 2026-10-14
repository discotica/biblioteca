# Prompts del plan de lanzamiento — 2026-10-13

Un chat autocontenido por paso del [plan de lanzamiento](./plan-lanzamiento-2026-10-13.md). No hay campos que editar antes de pegarlos, salvo en las plantillas del final (`<…>`).

## Uso

1. Antes de pegar un prompt, elige el modelo (`/model`) y el esfuerzo de su encabezado.
2. Va un paso por chat y un solo chat a la vez sobre este árbol.
3. Los pasos 0 y 10 son solo tuyos y no tienen prompt. Los pasos 3, 6, 8, 9, 12 y 13 empiezan con una acción tuya, descrita en el plan.
4. Cuando aceptes un paso, escribe en ese chat "aceptado": hace commit en la rama de trabajo y push de esa rama. Nunca en `main` ni en `dist` a mano.
5. Ningún paso toca producción (`ewntlvugbopokdrvnwvg`) salvo E22-A (lectura) y E22-B (escritura).
6. Si Opus 5.5 no está disponible, no lo sustituyas por Sonnet en los pasos asignados a Opus: espera.

---

## Paso 1 — S3: suite de navegador en verde

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Termina y verifica la etapa S3 — Suite de navegador en verde — de `docs/producto/plan-saneamiento-2026-10-06.md`. Es el paso 1 de `docs/producto/plan-lanzamiento-2026-10-13.md`.

Contexto: un chat del 2026-10-11 dejó cambios sin verificar ni documentar (no hay sección S3 en `docs/modernizacion/estado.md`):
- `src/lib/ui/homeUrl.ts` y `src/routes/+page.svelte`: `takeBootModalEntry`, para que una recarga con la ficha abierta conserve su sesión;
- `tests/browser/e17-recommendations-history.spec.ts`: la prueba de recarga, partida en dos y con esperas de estado;
- `tests/browser/catalogo.spec.ts`: E14 espera el evento `scroll`.

Lee primero:
- B5 y la etapa S3 del plan de saneamiento, y el prompt de S3 en `docs/producto/prompts-saneamiento-2026-10-06.md`;
- `docs/modernizacion/e17-recomendaciones-historial-modal-2026-09-20.md` (el invariante de historial del modal);
- el `git diff` de esos cuatro archivos.
Ejecuta `git status --short`. Hay otros cambios sin commit (S1, S5–S7, docs) que no son de esta etapa: no los toques.

1. Revisa el diff. Decide, para cada cambio, si corrige la causa (de la prueba o de la app) sin romper el invariante de E17, y completa lo que falte.
2. Aceptación de S3, con las variables de `.env.local`:
   - tres corridas completas seguidas de `npm run test:browser`, con el servidor caliente, sin fallos;
   - `npm test`, `npm run build` y `npm run lint:tokens` en verde;
   - `npm run visual:compare` sin diferencias.
3. Si sobrevive un intermitente, mide su frecuencia en 10 corridas aisladas y explica la causa. No lo escondas con reintentos ni con `waitForTimeout`.
4. Escribe la sección "Saneamiento S3" en `estado.md`: causa y arreglo por prueba, y resultados.

No cambies textos, estilos ni datos. No hagas commit: los commits los hace el paso 2.
Entrega: causa y arreglo por prueba (de la prueba o de la app), resultado de las tres corridas y si S3 queda cerrada.
```

## Paso 2 — S1, commits y PR

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta el paso 2 de `docs/producto/plan-lanzamiento-2026-10-13.md`: cerrar S1 (CI y despliegue seguros), poner todo el trabajo en commits y abrir el PR que deja correr la CI. S3 debe estar cerrada (sección en `docs/modernizacion/estado.md`).

Lee primero:
- las secciones 2 y 3 y el paso 2 del plan de lanzamiento;
- C2, C3 y la etapa S1 de `docs/producto/plan-saneamiento-2026-10-06.md`;
- `.github/workflows/*.yml` y "Despliegue desde GitHub Actions" en `docs/modernizacion/operacion-fase-6.md`.
Ejecuta `git status --short` y `git log --oneline -5`.

Estado:
- Los workflows, `.nvmrc`, `package.json` y `.env.example` ya tienen los cambios de S1, sin commit.
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` ya existen como variables del repositorio en GitHub, y apuntan a producción.
- La rama `modernizacion-2026` está en `origin` con 2 commits locales sin subir.
- `origin` (discotica/biblioteca) es PÚBLICO.

1. Dos ajustes en `deploy.yml`, necesarios para el despliegue por Git de Hostinger (paso 3):
   - `force_orphan: false` en la publicación a `dist`. Así cada despliegue añade un commit encima en lugar de reescribir la rama. Hostinger actualiza su copia desde esa rama, y su documentación no dice cómo reacciona a una historia reescrita. Comprueba que `keep_files` sigue en `false`.
   - El job corre solo si `github.ref == 'refs/heads/main'`. Desde otra rama falla con un mensaje claro: producción solo sale de `main`.
   Documenta los dos ajustes en `operacion-fase-6.md`.
2. Verifica S1 en local:
   - con `CI=true` y Node 22, reproduce los pasos de `ci.yml` con sus variables: `audit:catalog`, `lint:tokens`, `npm test`, `build` y `test:browser`;
   - el paso de guarda de `deploy.yml` falla sin variables y con una clave `sb_secret_`. Simúlalo ejecutando su script.
3. Revisa si hay secretos en todo lo que va a entrar: claves `service_role` o `sb_secret_`, JWT, cadenas `postgres://` y tokens. Si encuentras uno, detente sin mostrar su valor.
4. Haz commits en `modernizacion-2026`, nunca en `main`, uno por bloque:
   - S1: CI y despliegue;
   - S3: suite de navegador;
   - S5–S7: migraciones y pruebas SQL;
   - documentación: planes, estado y expedientes.
5. Muestra la lista de commits y pide autorización antes del push, recordando que el repositorio es público. Con autorización:
   - haz push de la rama;
   - abre un PR en borrador hacia `main` con `gh pr create --draft`, titulado "Modernización 2026: candidato de lanzamiento".
   No lo marques como listo ni lo fusiones: se fusiona en E22-B.
6. Espera la CI del PR (`gh pr checks --watch`). Si falla, corrige la causa en la rama. Si la causa es del entorno y no del código, explícala.

Aceptación: CI verde en el PR; `main` intacta en `0ab31e0`; `git status` limpio salvo lo ignorado.
Actualiza `estado.md`: S1 cerrada y "Siguiente acción segura" apuntando al paso 3 del plan de lanzamiento.
Entrega: diff de `deploy.yml`, lista de commits, enlace del PR y resultado de la CI.
```

## Paso 3 — Comprobar el despliegue por Git

Antes, haz tu parte del paso 3 del plan: respaldo de la carpeta, conexión en hPanel y ruleset de `main`.

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `medium`

```text
Ejecuta el paso 3 de `docs/producto/plan-lanzamiento-2026-10-13.md`: comprueba que Hostinger publica la rama `dist` por Git y documéntalo. El usuario ya conectó el repositorio en hPanel y creó el ruleset de `main`.

Lee el paso 3 y la sección 2 del plan, y "Despliegue desde GitHub Actions" en `docs/modernizacion/operacion-fase-6.md`.

Trabaja en solo lectura sobre el sitio, Hostinger y GitHub: no ejecutes workflows ni hagas push a `dist`.

1. Pregunta al usuario por la carpeta de despliegue y la hora del despliegue que muestra Hostinger.
2. Compara https://biblioteca.discotica.com con `origin/dist`:
   - los mismos `_app/immutable/...` en `index.html`;
   - un `Last-Modified` coherente con el despliegue.
3. Comprueba con `curl` que:
   - una ruta profunda del SPA, como una página de artista real, responde 200 con el `index.html`;
   - `/.htaccess` no se puede descargar.
4. Comprueba con `gh api` que existe el ruleset de `main` y que exige PR y el check `verify`.
5. Documenta en `operacion-fase-6.md`:
   - la conexión: rama, carpeta, auto-deployment y fecha;
   - dónde se ve un despliegue en Hostinger (Deployments);
   - que nunca se suben archivos a mano.
   Actualiza `estado.md`.

Si el sitio cambió o algo no coincide, detente y descríbelo. No intentes arreglarlo desde Hostinger.
Cierre: cuando el usuario acepte, haz commit en `modernizacion-2026` y push de la rama.
```

## Paso 4 — U18: QA de interfaz

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta la etapa U18 — QA integral y candidato — de `docs/producto/plan-interfaz-2026-10-04.md`, solo los puntos 1 a 4, como paso 4 de `docs/producto/plan-lanzamiento-2026-10-13.md`. Los puntos 5 y 6 (recorrido en staging y dictamen) pasan al paso 11 (E21-rc2): aquí no hay dictamen de despliegue.

Lee primero completos:
- la etapa U18 y las secciones 4, 6 y 7 del plan de interfaz;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- `docs/modernizacion/estado.md` y `tests/visual/README.md`;
- los relevos de U4–U17 en `docs/modernizacion/`.
Busca "U18" en los relevos y en `decisiones.md`: hay pendientes asignados a esta etapa. Ejecuta `git status --short`.

Ejecuta y documenta, en local:
1. **Visual.** `npm run visual:compare` contra la línea base actual (U17, 182 capturas). Debe dar cero diferencias; cualquiera es un hallazgo. Comprueba que el censo cubre rutas, estados y roles a 390, 834 y 1440 px (y 680 y 1112 en la ficha), y lista las combinaciones que falten.
2. **Tokens.** Ejecuta `npm run lint:tokens`, lista las excepciones que quedan (los radares SVG) y propone cómo cerrarlas.
3. **Accesibilidad.** Teclado en todas las vistas, contraste ≥ 4.5:1, objetivos de 44 px y `prefers-reduced-motion`, automatizados donde se pueda.
   Prepara para el usuario una lista corta de comprobaciones manuales y registra los resultados cuando te los dé:
   - en un iPhone real: el doble toque del radar, el área segura y la barra de la ficha, la banda de filtros y la hoja;
   - con VoiceOver: la ficha, los filtros, el combobox y el ordenable.
4. **Comprobaciones globales:**
   - ninguna barra de scroll nativa visible;
   - ningún "crate" en la interfaz;
   - ningún emoji como icono;
   - ningún código interno (E06, U4…) en los textos.
5. **Pendientes asignados a U18,** cada uno con evidencia y una propuesta:
   - el `overflow-x` de `html`/`body` que anula el sticky fuera del Estudio (U16 lo arregló solo en `/estudio`);
   - el límite de intentos propio de `login-with-username` (U12);
   - si `/lab` debe existir en producción (U5);
   - la ayuda de "Nota interna" (U17).
6. **Suites.** `npm test`, `npm run build` y dos corridas de `npm run test:browser` con el servidor caliente.

No corrijas nada salvo erratas triviales. Registra cada hallazgo con:
- su severidad: P0 bloquea el lanzamiento, P1 se corrige antes, P2 puede esperar;
- su etapa de origen y el archivo.
No toques staging ni producción.

Entrega:
- el expediente `docs/modernizacion/u18-qa-interfaz-<fecha>.md`, con matriz, evidencia, hallazgos y las decisiones que necesita el usuario;
- `estado.md` actualizado.
Cierre: cuando el usuario acepte el expediente, haz commit en `modernizacion-2026` y push de la rama.
```

## Paso 5 — Correcciones de U18

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta el paso 5 de `docs/producto/plan-lanzamiento-2026-10-13.md`: corrige los hallazgos de U18.

Lee primero:
- el expediente `docs/modernizacion/u18-qa-interfaz-*.md`;
- las secciones 4, 6 y 7 de `docs/producto/plan-interfaz-2026-10-04.md`;
- `tests/visual/README.md` y `docs/modernizacion/estado.md`.
Ejecuta `git status --short`.

Antes de editar, pregunta al usuario:
- qué decidió sobre los pendientes que el expediente deja abiertos (`/lab` en producción, "Nota interna" y cualquier otro);
- si corriges en este chat todos los P0 y P1, o solo un grupo. Si son más de seis, o tocan zonas muy distintas, propone grupos y haz uno.

Captura el árbol de partida: `VISUAL_BASELINE_DIR=.ref-pre-u18fix npm run visual:capture`.

Para cada hallazgo: causa, arreglo y una prueba que lo cubra. Respeta el contrato del plan de interfaz (tokens, primitivas, 44 px, sin literales).
- Si el arreglo del sticky global activa el header fijo en todo el sitio, muestra las capturas afectadas y espera la aceptación del usuario.
- Si un arreglo toca una Edge Function o una migración, déjalo listo y verificado en local, pero no lo apliques en staging: se despliega en el paso 7.

Aceptación:
- `npm test`, `build`, `lint:tokens` y dos corridas de `test:browser` en verde;
- las diferencias visuales contra `.ref-pre-u18fix` son solo las de los arreglos, listadas con su motivo.

Con la aceptación del usuario:
- recaptura la línea base (`npm run visual:capture`), borra `.ref-pre-u18fix` y actualiza `tests/visual/README.md`;
- actualiza el expediente de U18 (estado de cada hallazgo), `estado.md` y, si hubo decisiones, `decisiones.md`;
- haz commit en `modernizacion-2026` y push de la rama. La CI del PR debe seguir en verde.
```

## Paso 6 — S8: backup y restauración de staging

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la parte de Claude de la etapa S8 — Backup y restauración de staging — de `docs/producto/plan-saneamiento-2026-10-06.md`. Es el paso 6 de `docs/producto/plan-lanzamiento-2026-10-13.md`.

Lee primero:
- B1, B10 y la etapa S8 del plan de saneamiento;
- `docs/modernizacion/operacion-fase-6.md` completo, incluido el intento del 2026-10-12, que no tuvo dump;
- E21-P0-02 y E21-P1-05 en `docs/modernizacion/e21-candidato-lanzamiento-qa-staging-2026-09-24.md`;
- la sección S5 de `docs/modernizacion/estado.md` (stack local desde cero).

Vía B, con la cadena de conexión que ya está en `.env.local` como `E06_STAGING_DATABASE_URL`.
- Antes de usarla, pide al usuario autorización explícita en el chat para hacer un `pg_dump` de staging con ella.
- Nunca muestres su valor ni lo copies a otro archivo.
- Comprueba con dos señales que apunta a `hgocyrzhgohetfpzbmfs` (host y `inet_server_addr()`) antes de volcar.
- El proyecto final `ewntlvugbopokdrvnwvg` no se toca.

1. **Dump.** `pg_dump` de esquema y datos en formato custom, con una versión de `pg_dump` compatible con el servidor. Incluye `public`, `private`, `auth` y `storage`.
   - Guárdalo en `../discotica-backups/<fecha>-staging/` con `SHA256SUMS`.
   - Si Storage tiene objetos, descárgalos también y registra cuántos son.
2. **Restauración.** Restaura en un stack local aislado (`project_id` propio, puertos 544xx). Compara los conteos por tabla y las sumas de control del catálogo con staging, en solo lectura.
3. **B10** ya está decidido (`decisiones.md`, "Hoja limpia como fuente del lanzamiento"): la referencia es la hoja limpia. Su snapshot y la comparación se hacen en el paso 8, así que aquí no se toman.
4. **Registro.** Anota el simulacro en `operacion-fase-6.md`: fecha, vía, duración, conteos, diferencias y hash. Recuerda al usuario copiar el dump fuera de este disco.

Si la restauración no reproduce los conteos, el simulacro falla: regístralo y detente. No apliques migraciones ni escribas en staging.
Cierre: cuando el usuario acepte, haz commit de la documentación en `modernizacion-2026` y push de la rama. El dump nunca entra en git.
```

## Paso 7 — S9: aplicar en staging

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta la etapa S9 — Aplicar en staging — de `docs/producto/plan-saneamiento-2026-10-06.md`. Es el paso 7 de `docs/producto/plan-lanzamiento-2026-10-13.md`. Requiere el paso 6 cerrado y un dump de staging de menos de 24 h; si es más antiguo, repite primero el dump del paso 6.

Lee primero:
- la etapa S9;
- las secciones S5, S6, S7 y S8 de `docs/modernizacion/estado.md`;
- las secciones de rollback y "Pendiente para staging" de `docs/modernizacion/d1-datos-perfil-colecciones-2026-10-06.md` y `docs/modernizacion/d2-estudio-lote-vistas-rapidas-2026-10-06.md`;
- `docs/modernizacion/operacion-fase-6.md`.

Solo staging (`hgocyrzhgohetfpzbmfs`). El CLI está enlazado a producción: cada comando lleva `--project-ref hgocyrzhgohetfpzbmfs` y nunca `--linked`. Antes del primer cambio, comprueba el destino con dos señales.

0. **Migración base.** El historial remoto no tiene `20260830000000`, la migración base de S5, que no hace nada donde las tablas ya existen.
   - Muestra el comando `supabase migration repair --status applied 20260830000000 --project-ref hgocyrzhgohetfpzbmfs`.
   - Explica que solo la marca como aplicada.
   - Ejecútalo con autorización.
1. **Migraciones, en este orden:**
   1. E18 corregida (`20260923120000`);
   2. D1 (`20261006131054`);
   3. D2 (`20261006200859`);
   4. S6 (`20261011190000`);
   5. S7 (`20261012120000`);
   6. U18 H2 (`20261014120000`, límite de intentos de `login-with-username`; verificación en `tests/sql/u18-h2-verify.sql`).
   Aplícalas de una en una y explica el método antes de la primera. Antes de cada una, ejecuta `migration list`, muestra qué se va a aplicar y espera autorización explícita.
2. **Después de cada una:**
   - su verificación SQL adaptada a staging, en solo lectura o dentro de una transacción con rollback;
   - advisors;
   - una prueba de humo con `.env.local`: catálogo, Estudio, colecciones con orden, sugerir y reportar.
   `tests/sql/s6-b8-policy-matrix.sql` se puede correr en staging; `d2-concurrency.sh` es solo local.
3. **Edge Functions.** Si el paso 5 dejó cambios en Edge Functions (por ejemplo, `login-with-username`), despliégalas en staging con `--project-ref` y autorización, y pruébalas.
   - `login-with-username` llama a las funciones de la migración `20261014120000`: despliégala solo después de esa migración, porque sin ella toda entrada con usuario responde 503.
   - Haz las tres comprobaciones de "Paso 5 · H2" del expediente de U18 (cabecera de la IP real y si se puede falsificar, IP que ve Auth, latencia real bajo el piso de 1200 ms) y anótalas allí.

Si una migración falla, detente: no improvises un arreglo remoto. Registra el error y el estado, y aplica el rollback documentado solo con autorización.
Actualiza `estado.md` y la sección "Pendiente para staging" de D1 y D2.
Entrega: migraciones aplicadas con su hora, verificaciones, advisors y el `migration list` final.
Cierre: cuando el usuario acepte, haz commit en `modernizacion-2026` y push de la rama.
```

## Paso 8 — Reemplazar el catálogo de staging con la hoja limpia

Antes, confirma que la hoja está lista. El chat te devolverá las filas que debes corregir en ella.

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`. Escala a `xhigh` solo si hay que cambiar `import_catalog_release` y la verificación no cierra.

```text
Ejecuta el paso 8 de `docs/producto/plan-lanzamiento-2026-10-13.md`: reemplaza el catálogo de lanzamientos de staging por el TSV publicado de Google Sheets, que el equipo limpió y ordenó a mano. Requiere cerrados el paso 6 (dump y restauración de staging) y el paso 7 (migraciones aplicadas en staging).

Lee primero:
- el paso 8 del plan y la decisión "Hoja limpia como fuente del lanzamiento" en `docs/modernizacion/decisiones.md`;
- `docs/modernizacion/contrato-catalogo-fase-2.md` y `docs/modernizacion/e01-validacion-staging-recuperacion-2026-09-14.md`, que describen la primera carga;
- `scripts/import-catalog.mjs`, `tests/catalog-import.test.mjs` y la última definición de `private.import_catalog_release` (`supabase/migrations/20260915204413_canonical_v2_credits_types_identity.sql`);
- la sección S7 de `docs/modernizacion/estado.md` y el registro de B10 en `docs/modernizacion/operacion-fase-6.md` (snapshot del 12-oct: 2.789 filas y 7 rechazos).
Ejecuta `git status --short`.

Solo staging (`hgocyrzhgohetfpzbmfs`), con `--project-ref` y dos señales del destino. El proyecto final no se toca. Las escrituras en staging requieren autorización explícita.

Qué significa "reemplazar" (decisión del 2026-10-13):
- la hoja manda en todo lanzamiento con `catalog_key`;
- cada lanzamiento se empareja por clave, así que conserva su UUID;
- lo que la hoja ya no tiene se archiva, nunca se borra.

1. **Snapshot y prueba en seco.**
   - Descarga el TSV publicado (la URL está en `src/lib/utils/catalogoStore.ts`) a `../discotica-backups/<fecha>-hoja-limpia/`, con `SHA256SUMS`.
   - Ejecuta `npm run import:catalog -- --input … --dry-run`, sin `--allow-derived-keys`: toda fila debe tener `catalog_key`.
   - Devuelve al usuario las filas rechazadas y las advertencias, con número de fila y motivo, en una lista que pueda corregir en la hoja.
   - Repite tras sus correcciones hasta llegar a cero rechazos, o a rechazos que el usuario acepte.
2. **Informe de diferencias contra staging**, en solo lectura y por `catalog_key`:
   - lanzamientos nuevos, cambiados (con los campos que cambian) e iguales;
   - claves de staging que la hoja ya no tiene, con cuántas colecciones, reportes y propuestas las usan;
   - lanzamientos de staging sin clave de importación (creados en el Estudio o por Sugerir);
   - lanzamientos editados en el Estudio después de la carga de septiembre (auditoría de E06), que el reemplazo pisaría;
   - una tabla de cambios de identidad para los títulos o artistas principales que cambian: clave, slug legado anterior, slug legado nuevo y slug canónico.
   Detente y espera las decisiones del usuario sobre los casos dudosos. Pregúntale también si el orden de las filas debe verse en el sitio; hoy el catálogo se ordena por fecha e ID.
3. **Importador.** Hoy `import_catalog_release` actualiza por clave y conserva el UUID, pero:
   - no archiva lo que falta;
   - publica siempre (`status = 'published'`);
   - pone `credit_quality = 'legacy'`;
   - borra y recrea enlaces y portadas. Es el problema H4, que S7 resolvió solo en `apply_catalog_payload`.
   Si hace falta cambiarlo para cumplir la decisión, hazlo en una migración nueva (nunca edites las aplicadas), con una opción explícita en `import-catalog.mjs` para archivar las claves ausentes.
   Pruebas: amplía `npm run test:catalog-import` y añade una verificación SQL en `tests/sql/` con control negativo.
4. **Ensayo local** sobre la restauración del dump del paso 6 (stack aislado, puertos 544xx): aplica la migración, si la hay, y ejecuta el reemplazo completo. Ensaya también el rollback: devolver las tablas del catálogo al dump. Comprueba que:
   - los publicados son exactamente las filas válidas de la hoja;
   - ningún `crate_items`, `problem_reports` ni `contributions` apunta a un lanzamiento borrado;
   - las colecciones conservan sus ítems;
   - los slugs antiguos resuelven por alias;
   - `e06-verify.sql`, `d2-verify.sql` y `s7-verify.sql` siguen en verde.
5. **Staging**, con autorización:
   - un dump del mismo día (repite el del paso 6 si es más antiguo);
   - la migración, si la hay, con `migration list` antes;
   - el reemplazo, con `DATABASE_URL` tomada de `E06_STAGING_DATABASE_URL` sin mostrar su valor. Nadie edita en el Estudio mientras corre;
   - después, las mismas comprobaciones del ensayo, en solo lectura, y una prueba de humo con `.env.local`: conteo en inicio, una ficha, una colección existente y el Estudio.

Si los conteos no cuadran o una colección pierde un ítem, detente. El rollback ensayado en el punto 4 solo se aplica en staging con autorización.

Entrega:
- `docs/modernizacion/catalogo-hoja-limpia-<fecha>.md`, con el hash del snapshot, el informe de diferencias, las decisiones del usuario, la tabla de cambios de identidad (la usa E22) y los conteos antes y después;
- `estado.md` actualizado y, si cambió el procedimiento, `operacion-fase-6.md`.
Cierre: cuando el usuario acepte, haz commit en `modernizacion-2026` y push de la rama. Los snapshots y los dumps nunca entran en git.
```

## Paso 9 — D3: correo propio en staging

Antes, el dominio tiene que estar verificado en Resend (paso 0).

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Cierra la etapa D3 — Correo propio y plantillas — de `docs/producto/plan-interfaz-2026-10-04.md`, en staging. Es el paso 9 de `docs/producto/plan-lanzamiento-2026-10-13.md`.

Lee primero:
- `docs/modernizacion/d3-correo-propio-plantillas-2026-10-06.md` completo: proveedor, registros DNS, configuración SMTP, hallazgos H1–H4 y pruebas pendientes;
- la etapa D3 del plan de interfaz;
- `supabase/config.toml`.

Estado: Resend está aprobado y las plantillas están listas en `supabase/templates/`. El usuario creó la cuenta y los registros DNS.

Solo staging (`hgocyrzhgohetfpzbmfs`).
- No uses `supabase config push`: el CLI está enlazado a producción y subiría el `config.toml` local (H2).
- Nunca pidas ni escribas la API key.

1. **DNS.** Verifica con `dig` los cuatro registros y pregunta al usuario si Resend muestra el dominio verificado. Copia los valores públicos al relevo.
2. **Configuración.** Guía al usuario para cargar en el dashboard de staging:
   - el SMTP: host, puerto, usuario, remitente `hola@discotica.com` y nombre;
   - la API key, que pega él;
   - el límite de Auth (30 por hora);
   - las tres plantillas con sus asuntos.
3. **Envío real** a `hola+d3-<fecha>@mamanche.com` (ese buzón lo lee el usuario, no esta sesión): confirmación, recuperación y cambio de correo. Pide al usuario el mensaje crudo de uno y comprueba:
   - SPF, DKIM y DMARC en `pass`;
   - que los enlaces apuntan a staging;
   - si llega una parte `text/plain` (H3).
4. **Revisión.** El usuario revisa los correos en Gmail web, Gmail móvil y Apple Mail. Registra la tabla de pruebas del relevo.
5. **Producción.** Deja escrito en el relevo qué hay que repetir en E22-B (SMTP, límite, plantillas y URL del sitio), y que staging y producción comparten la cuota de Resend (100 al día).

Si el DNS o el proveedor no verifican, detente y documenta. No cambies el remitente sin decisión del usuario. Que el logo de los correos no cargue hasta el primer despliegue es lo esperado (H4).
Cierre: cuando el usuario acepte, haz commit en `modernizacion-2026` y push de la rama.
```

## Paso 11 — E21-rc2: QA integral y GO/NO-GO

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta el candidato E21-rc2: la etapa S11 de `docs/producto/plan-saneamiento-2026-10-06.md` más los puntos 5 y 6 de U18 de `docs/producto/plan-interfaz-2026-10-04.md`. Es el paso 11 de `docs/producto/plan-lanzamiento-2026-10-13.md` y requiere los pasos 1 a 10 cerrados.

Lee primero:
- `docs/modernizacion/e21-candidato-lanzamiento-qa-staging-2026-09-24.md` completo: matriz, issues, checklist de corte e inventario de flags;
- la etapa E21 de `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, con sus criterios go;
- `docs/modernizacion/estado.md`, el expediente de U18 y el del reemplazo del catálogo (`docs/modernizacion/catalogo-hoja-limpia-*.md`);
- las decisiones de los pasos 8 y 10 en `docs/modernizacion/decisiones.md`;
- `docs/modernizacion/operacion-fase-6.md`.

El candidato es `discotica-e21-rc2`: registra el hash del commit, el del build y la lista de migraciones aplicadas en staging. Trabaja solo en staging; el proyecto final no se consulta.

1. **Matriz.** Repite la matriz completa de E21 sobre staging y cierra o justifica cada issue (P0-01 a P0-04, P1-01 a P1-05 y los P2) con evidencia nueva.
2. **Recorridos de punta a punta en staging** (U18, punto 5), con los roles anon, comunidad, colaborador y admin, incluidos intentos negativos de RLS:
   - registro → correo → confirmación → primera colección → reordenar → compartir;
   - sugerir → aprobación en el Estudio.
3. **Anchos y zoom.** Automatiza 1024 px y el zoom al 200 %. Da al usuario la lista de comprobaciones manuales (Safari iOS, Android Chrome, VoiceOver e iframe real de Bandcamp, SoundCloud y Spotify) y espera sus resultados.
4. **Suite completa:**
   - `npm test`, `build`, tres corridas de `test:browser` y `visual:compare`;
   - `audit:catalog`;
   - `verify:media`, clasificando los fallos confirmados en navegador.
5. **Rollback de flags ensayado,** no solo compilado: un build con los flags en su valor seguro, servido con el Apache local (`.htaccess` real) contra staging.
6. **Inventario de flags.** Normaliza las discrepancias que dejó E21 y registra la decisión en `decisiones.md`.
7. **Plan exacto de corte para E22.** Debe cubrir:
   - la fuente de los datos de producción: la hoja limpia, con el procedimiento y la tabla de cambios de identidad del paso 8;
   - los flags del día;
   - el orden de migraciones en producción, incluido cómo se marca la migración base;
   - las Edge Functions y sus secretos, sin valores;
   - la configuración de Auth: URL del sitio, redirecciones y SMTP;
   - el admin de recuperación;
   - las comprobaciones de humo y las condiciones de parada.

Escribe el dictamen GO o NO-GO en `docs/modernizacion/e21-rc2-<fecha>.md`.
- GO exige todos los P0 cerrados y la checklist de corte de E21 completa.
- La firma de producto y la de la segunda persona operativa son del usuario.
- La falta de evidencia es NO-GO.
No hagas ningún despliegue.
Cierre: cuando el usuario acepte el expediente, haz commit en `modernizacion-2026` y push de la rama.
```

## Paso 12 — E22-A: ensayo del corte

Antes: la cadena de conexión de producción en `.env.local` como `E22_PROD_DATABASE_URL`, la fecha del corte fijada y la hoja congelada.

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta el paso 12 de `docs/producto/plan-lanzamiento-2026-10-13.md`: E22-A, ensayo del corte sobre una copia de producción. Requiere el GO de E21-rc2.

Producción (`ewntlvugbopokdrvnwvg`) solo en lectura: ninguna escritura, migración, función ni configuración.

Lee primero:
- la etapa E22 de `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`;
- el expediente de E21-rc2 completo, sobre todo el plan exacto de corte;
- `docs/modernizacion/operacion-fase-6.md`;
- las secciones de Fases 4 y 5 de `docs/modernizacion/estado.md`: la migración de `crate_items` a `release_id` y `legacy_crate_release_map`;
- el expediente del reemplazo del catálogo (`docs/modernizacion/catalogo-hoja-limpia-*.md`): procedimiento de importación y tabla de cambios de identidad.

1. **Acceso.** El usuario añadió a `.env.local` la cadena de producción como `E22_PROD_DATABASE_URL`.
   - Pide autorización explícita para usarla en un `pg_dump`.
   - Nunca muestres su valor.
   - Comprueba con dos señales que apunta a `ewntlvugbopokdrvnwvg` antes de volcar.
2. **Dump.** `pg_dump` de producción (esquemas de aplicación, `auth` y `storage`) y objetos de Storage si los hay.
   - Guárdalo en `../discotica-backups/<fecha>-produccion/` con `SHA256SUMS`.
   - Registra los conteos de origen: usuarios, perfiles, colecciones e ítems.
3. **Ensayo.** Restaura en un stack local aislado y ensaya el corte completo sobre esa copia, en el orden del plan de corte:
   - marcar o aplicar las migraciones;
   - importar la hoja congelada (snapshot final, con checksum) con el procedimiento del paso 8;
   - mapear los ítems de las colecciones existentes a `release_id`. Producción guarda `lanzamiento_slug` con los títulos de antes de la limpieza: usa la tabla de cambios de identidad del paso 8 para que esos ítems y los enlaces compartidos sigan resolviendo;
   - asignar el admin;
   - comprobar RLS por rol;
   - probar la app (build con los flags del día) contra la copia.
4. **Comparación:**
   - ningún usuario, perfil, colección ni ítem perdido;
   - los ítems sin equivalencia única quedan listados, sin adivinarlos;
   - los conteos del catálogo coinciden con la fuente.
5. **Rollback de aplicación.** Ensaya un build con flags seguros contra la copia migrada y confirma que el sitio legado sigue funcionando sobre el esquema nuevo.
6. **Guion de E22-B** en `docs/modernizacion/e22-guion-corte-<fecha>.md`. Para cada comando: su `--project-ref`, el resultado esperado y el tiempo medido. Además, el punto de no retorno, las condiciones de parada y el rollback.

Si algo no cuadra (conteos, ítems sin mapear, una migración que falla), detente y regístralo: E22-B no empieza hasta resolverlo.
Cierre: cuando el usuario acepte, haz commit de la documentación en `modernizacion-2026` y push de la rama. Los dumps nunca entran en git; recuerda al usuario copiarlos fuera de este disco.
```

## Paso 13 — E22-B: corte a producción

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta el paso 13 de `docs/producto/plan-lanzamiento-2026-10-13.md`: E22-B, corte a producción, siguiendo el guion `docs/modernizacion/e22-guion-corte-*.md`. Esta etapa escribe en producción (`ewntlvugbopokdrvnwvg`).

Lee primero:
- el guion completo;
- la etapa E22 de `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`;
- las secciones 2 y 7 del plan de lanzamiento;
- `docs/modernizacion/operacion-fase-6.md`;
- el expediente de E21-rc2 y el relevo de D3 (qué se repite en producción).

Precondiciones. Verifícalas y detente si falta una:
- el GO de E21-rc2, firmado;
- el guion de E22-A, aceptado;
- el usuario está presente y escribe "autorizo el corte";
- la hoja de cálculo está congelada;
- Hostinger está conectado a `dist` (paso 3);
- el PR de `modernizacion-2026` tiene la CI en verde.

1. **Backup del mismo día.** Repite el dump de E22-A, con checksum, y compáralo con el del ensayo.
2. **Guion.** Síguelo paso a paso.
   - Antes de cada escritura en producción, muestra el comando y espera autorización.
   - Comprueba el project ref con dos señales antes del primer cambio.
   - Usa siempre `--project-ref`, nunca `--linked`.
3. **Auth en producción:**
   - URL del sitio `https://biblioteca.discotica.com` y redirecciones;
   - SMTP de Resend (la API key la pega el usuario en el dashboard), límite y plantillas;
   - Edge Functions con sus secretos (los carga el usuario).
4. **Prueba de humo en la base:** RLS por rol, catálogo, colecciones existentes, propuesta, aprobación y reporte.
5. **Publicación.** Cada acción, con autorización:
   - pon los flags del día en las variables de GitHub (`gh variable set`);
   - marca el PR como listo y fusiónalo en `main`;
   - etiqueta ese commit como `v1.0.0`;
   - ejecuta `gh workflow run deploy.yml --ref main` y sigue el run hasta el final.
6. **Verificación en vivo.** Pide al usuario que confirme en Hostinger (Deployments) que el despliegue está "Completed". Después comprueba:
   - que los hashes de `index.html` coinciden con `dist`;
   - los 301 de `.htaccess` (`/crate/x` → `/coleccion/x` y `/admin/catalogo` → `/estudio/catalogo`);
   - el conteo del catálogo y la ficha;
   - entrar con usuario y con correo, y un registro con un correo real;
   - una colección, Sugerir y Reportar.
7. **Si falla la integridad, RLS, auth o las colecciones,** haz el rollback de la aplicación en el momento, según la sección 7 del plan: revertir el último commit de `dist`, o flags seguros y Run workflow. No reviertas migraciones.

Registra todo en `docs/modernizacion/e22-corte-<fecha>.md`: horas, comandos, resultados e incidentes. Actualiza `estado.md`: producción en vivo, rollback disponible y periodo de observación iniciado.
Cierre: haz commit de la documentación en una rama `docs/e22-corte` y abre un PR a `main`, porque el ruleset de `main` exige PR.
```

## Paso 15 — E23: retiro del legado

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta la etapa E23 — Retiro controlado del legado — de `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`. Es el paso 15 de `docs/producto/plan-lanzamiento-2026-10-13.md` y se ejecuta con Claude Opus 5.5 en lugar del modelo original de la etapa.

Lee primero:
- la etapa E23 completa;
- el expediente del corte (`docs/modernizacion/e22-corte-*.md`);
- `docs/modernizacion/estado.md` y `docs/modernizacion/operacion-fase-6.md`.
Trabaja en una rama creada desde `main`: `cambio/e23-retiro-legado`.

1. **Precondiciones.** Comprueba una por una las precondiciones cuantitativas de E23 con consultas de solo lectura en producción, con autorización explícita y dos señales del ref. Si alguna falla, detente y entrégala como bloqueo.
2. **Archivo del legado.** El TSV, el JSON y el mapa de equivalencias van a un backup externo con checksum antes de retirarlos del runtime.
3. **Borrados.** Antes de cualquier borrado material (columna, alias o archivo histórico), muestra exactamente qué se borra y espera aprobación.
4. **Ciclo.** Sigue el ciclo de cambio: pruebas locales, PR y CI. Las migraciones van por el ciclo de base de datos: local → staging → producción, con backup. La publicación la hace el usuario con Run workflow.

Entrega: precondiciones con evidencia, cambios, restore verificado y documentación actualizada.
```

---

# Plantillas para después del lanzamiento

## Cambio nuevo

**Modelo:**
- Claude Sonnet 5.5 para interfaz acotada;
- Claude Opus 5.5 para datos, flujos completos, scroll, historial o Estudio.

**Esfuerzo:** `high`, o `medium` si es un texto o un estilo puntual.

```text
Quiero este cambio en la Biblioteca: <describe el cambio y por qué>.

Lee primero:
- `docs/modernizacion/estado.md` y `docs/modernizacion/decisiones.md`;
- las secciones 4, 6 y 7 de `docs/producto/plan-interfaz-2026-10-04.md`: el contrato de tokens, primitivas, 44 px y regresión visual;
- la sección 6 de `docs/producto/plan-lanzamiento-2026-10-13.md`.
Ejecuta `git status --short`.

1. Crea una rama desde `main` actualizada: `cambio/<nombre-corto>`.
2. Antes de editar, ejecuta `npm run visual:compare`. Debe dar cero diferencias: es el punto de partida.
3. Implementa el cambio. Si toca la base de datos, detente: eso va por la plantilla de cambio de base de datos.
4. Pruebas: `npm test`, `build`, `lint:tokens`, `test:browser` y `visual:compare`. Las diferencias visuales deben ser solo las del cambio, listadas.
5. Si una decisión de producto no está clara, pregunta; no la inventes.
6. Si el cambio no está listo para todo el público, ponlo detrás de un flag `VITE_*` con `false` por defecto, y documenta la variable en `.env.example` y en `docs/modernizacion/operacion-fase-6.md`.

Cuando el usuario acepte:
- recaptura la línea base si hubo diferencias aceptadas;
- actualiza `estado.md`, y `decisiones.md` si hubo una decisión;
- haz commit, push de la rama y `gh pr create`;
- espera la CI.
No fusiones ni publiques: eso lo hace el usuario.
```

## Cambio de base de datos

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Necesito este cambio en la base de datos de la Biblioteca: <qué y por qué>.

Lee primero:
- `docs/modernizacion/estado.md`, secciones S5 a S9: cadena desde cero, stack local y staging;
- `docs/modernizacion/operacion-fase-6.md` y `docs/modernizacion/decisiones.md`.
Ejecuta `git status --short`. Trabaja en una rama creada desde `main`: `cambio/<nombre-corto>`.

1. **Migración nueva** (`npx supabase migration new <nombre>`). Nunca edites una aplicada. RLS y grants explícitos, por operación.
2. **Local:**
   - stack aislado con `project_id` propio y puertos 544xx;
   - `db reset` desde cero;
   - una verificación SQL en `tests/sql/` con control negativo;
   - advisors y `db lint`;
   - un script de rollback ensayado.
3. **Front.** Si el front cambia, debe funcionar con y sin la migración, o quedar detrás de un flag. El front nunca se publica antes que la migración.
4. **Staging:**
   - dump del día y dos señales del ref;
   - `--project-ref hgocyrzhgohetfpzbmfs`;
   - autorización antes de aplicar;
   - verificación y prueba de humo.
5. **Producción,** solo cuando el usuario lo pida:
   - dump del día;
   - `--project-ref ewntlvugbopokdrvnwvg`;
   - autorización explícita;
   - la misma verificación.
   Después, el usuario publica el front.

Documenta en `estado.md`. Commit, push y PR como en el ciclo de cambio.
```

## Rollback de emergencia

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `medium`

```text
El último despliegue de la Biblioteca rompió algo: <qué se ve>. Vuelve el sitio al build anterior.

Lee la sección 7 de `docs/producto/plan-lanzamiento-2026-10-13.md` y "Despliegue desde GitHub Actions" en `docs/modernizacion/operacion-fase-6.md`.

1. Ejecuta `git fetch origin dist` y muestra los dos últimos commits de `origin/dist`, con su fecha y el commit de `main` del que viene cada uno (mensaje "deploy: <sha>").
2. Con autorización: en un worktree temporal de `dist`, ejecuta `git revert --no-edit HEAD` y `git push origin dist`, sin `--force`. Hostinger publica el build anterior solo.
3. Pide al usuario que confirme "Completed" en Hostinger, y comprueba que el `index.html` en vivo coincide con el build anterior.
4. Registra el incidente en `estado.md`: hora, síntoma y build retirado.

No toques `main`. La corrección va por el ciclo de cambio, y el próximo Run workflow vuelve a publicar desde `main`.
```

## Corrección

Para cuando un paso sale en rojo o el candidato da NO-GO. Usa el modelo y el esfuerzo del paso que falló.

```text
El paso <N> de `docs/producto/plan-lanzamiento-2026-10-13.md` dejó estos problemas: <lista, o ruta del expediente>.

Lee el expediente del paso, su etapa de origen en el plan correspondiente y `docs/modernizacion/estado.md`. Ejecuta `git status --short`.

Para cada problema: causa con evidencia, arreglo y una prueba que lo cubra.
- Si la causa cruza otra etapa o exige una decisión de producto, detente y pregunta.
- Tras dos intentos fallidos sobre la misma causa, detente y registra la evidencia.

Aceptación: las pruebas del paso que falló vuelven a estar en verde, y `visual:compare` no muestra diferencias ajenas al arreglo.
Cierre: cuando el usuario acepte, actualiza el expediente y `estado.md`, haz commit en la rama de trabajo y push. Después se repite el paso <N>.
```
