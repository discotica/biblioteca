# Prompts del plan de saneamiento — 2026-10-06

Un chat autocontenido por etapa del [plan de saneamiento](./plan-saneamiento-2026-10-06.md). No hay campos que editar antes de pegarlos.

## Uso

1. Antes de pegar un prompt, elige el modelo (`/model`) y el esfuerzo de su encabezado.
2. Va una etapa por chat. Nunca dos chats sobre el mismo árbol de trabajo: si quieres paralelizar S3, S5 y S8, usa un worktree por chat.
3. S10 y S12 son solo tuyas y no tienen prompt. S2 y S8 empiezan con una acción tuya; el prompt cubre la parte de Claude.
4. Salvo S0 (y el commit de la línea base en S2), ninguna etapa hace commit, push ni despliegue. Ninguna toca el proyecto final `ewntlvugbopokdrvnwvg`.

---

## S0 — Resguardo del trabajo

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa S0 — Resguardo del trabajo — de `docs/producto/plan-saneamiento-2026-10-06.md`.

Lee primero la sección 2 (C1, X3) y la etapa S0 del plan, y `docs/modernizacion/estado.md` (sección "Línea base reproducible E00").

Contexto: el último commit es de 2026-05-29 y hay ~550 archivos sin commit. `main` dispara `deploy.yml`, que publica en producción: NO hagas commit ni merge en `main` bajo ninguna circunstancia.

Pasos:
1. Copia el árbol de trabajo completo (sin `node_modules`, `.svelte-kit` ni `build`) a `../discotica-backups/2026-10-06-arbol/` y genera un `SHA256SUMS`. Verifica la copia contra los checksums.
2. Revisa todo lo que vaya a entrar a git en busca de secretos: claves `service_role`, `sb_secret_`, JWT, cadenas `postgres://`, tokens de GitHub y contraseñas. `.env*` ya está ignorado salvo `.env.example`; confírmalo. Si encuentras un secreto en un archivo que iba a entrar, detente y repórtalo sin mostrar su valor.
3. Pregunta antes de crear la rama. Nombre propuesto: `modernizacion-2026`.
4. Haz commits separados por bloque lógico, en este orden: docs; `supabase/` (migraciones, funciones y config); `scripts/`; pruebas (`tests/`, `playwright.config.ts`); código de `src/` y `static/`; CI (`.github/`). Incluye `tests/visual/baseline/` salvo que el usuario diga lo contrario. Deja fuera `tests/visual/.ref-pre-u3/` (temporal, se borra en S2) y añádelo a `tests/visual/.gitignore`.
5. Pregunta antes de hacer push de la rama a `origin`. No abras PR.

Aceptación: `git status` limpio salvo lo ignorado; respaldo verificado; `main` intacta (mismo hash `0ab31e0`).
No toques `.env` ni `.env.local`: recuérdale al usuario que cambie `.env` (X3).

Entrega: nombre de la rama, lista de commits con su contenido, ruta y checksum del respaldo, y si hubo push.
```

## S1 — CI y despliegue seguros

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa S1 — CI y despliegue seguros — de `docs/producto/plan-saneamiento-2026-10-06.md`. S0 debe estar cerrada: trabaja en su rama, nunca en `main`.

Lee primero C2, C3 y la etapa S1 del plan, `.github/workflows/*.yml`, `.env.example`, `src/lib/supabase/client.ts`, `playwright.config.ts` y la lista de pruebas en `tests/browser/`.

Problemas:
- `deploy.yml` construye sin variables `VITE_*` y `client.ts` lanza un error si faltan. Un push a `main` dejaría el sitio en blanco.
- Los workflows usan Node 20, pero `npm test` necesita Node ≥ 22.6 (`--experimental-strip-types`).

Haz:
1. Node 22 en los tres workflows, `"engines": { "node": ">=22.6" }` en `package.json` y un `.nvmrc`.
2. En `deploy.yml`:
   - lee las variables desde `vars` del repositorio (son públicas; nunca `secrets` de servicio);
   - añade un paso que falle antes del build si falta `VITE_SUPABASE_URL` o la clave publicable;
   - fija flags seguros por defecto (`VITE_CATALOG_SOURCE=legacy` y los kill switch en `false`) cuando la variable no exista.
   Propón al usuario cambiar el disparador a `workflow_dispatch` hasta E22 y aplícalo solo si acepta.
3. En `ci.yml`: el build de CI necesita variables ficticias para no lanzar. Las pruebas que requieren staging real (por ejemplo `e01-staging-canonical`) deben omitirse con un motivo, no fallar. Confirma cuáles dependen de red externa.
4. Documenta en `.env.example` y en `docs/modernizacion/operacion-fase-6.md` qué variables crear en GitHub.

Verifica con `act` si está disponible; si no, reproduce los pasos de CI en local con `CI=true` y Node 22, y un build sin variables que debe fallar en el paso de guarda.
No hagas push ni merge. No crees variables en GitHub: dale al usuario la lista exacta.

Entrega: diff de los workflows, lista de variables para GitHub, pruebas omitidas en CI con su motivo y resultado de la simulación.
```

## S2 — Nueva línea base visual (tras tu revisión)

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `medium`

```text
Ejecuta exclusivamente la parte de Claude de la etapa S2 — Revisión visual y nueva línea base — de `docs/producto/plan-saneamiento-2026-10-06.md`.

Lee primero `tests/visual/README.md` y las secciones de capturas de `docs/modernizacion/r1-ficha-reproductor-2026-10-05.md`, `r2-errores-visibles-menores-2026-10-05.md`, `u2-saneamiento-2026-10-06.md` y `u3-colecciones-2026-10-06.md`.

Antes de nada, pregunta al usuario si aceptó las diferencias de R1, R2, U2 y U3. Si no las aceptó todas, detente y registra cuáles rechaza.

Con la aceptación:
1. Ejecuta `npm run visual:compare` y confirma que las diferencias coinciden con las listadas en los cuatro expedientes. Si aparece una no listada, detente y muéstrala.
2. Ejecuta `npm run visual:capture`. Después, `npm run visual:compare` dos veces: deben dar cero diferencias.
3. Borra `tests/visual/.ref-pre-u3/` y `tests/visual/playwright.ref.config.ts`.
4. Actualiza `tests/visual/README.md`: qué estado representa la línea base (R1+R2+U2+U3) y la fecha.
5. Commit de la línea base en la rama de S0, nunca en `main`. Sin push salvo que el usuario lo pida.

Entrega: número de capturas, resultado de las dos comparaciones y hash del commit.
```

## S3 — Suite de navegador en verde

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa S3 — Suite de navegador en verde — de `docs/producto/plan-saneamiento-2026-10-06.md`.

Lee primero:
- B5 y la etapa S3 del plan;
- `docs/modernizacion/e17-recomendaciones-historial-modal-2026-09-20.md` completo (el invariante de historial del modal);
- la sección "Pruebas" de `docs/modernizacion/u2-saneamiento-2026-10-06.md`;
- `docs/modernizacion/e14-header-global-2026-09-19.md`;
- `tests/browser/e17-recommendations-history.spec.ts` y `tests/browser/catalogo.spec.ts`.
Ejecuta `git status --short` y preserva trabajo ajeno.

Línea base conocida:
- La primera corrida con Vite en frío da ~20 fallos falsos por timeouts. Calienta el servidor antes de medir.
- E17:198 ("una URL directa encadena recomendaciones…") falla siempre con timeout de 30 s.
- E17:99 es una carrera: la prueba hace `scrollTo(0,160)` antes de que el catálogo tenga altura.
- E17:178 falla cuando corre el archivo E17 completo (la URL gana `&orden=match`) y pasa aislada.
- E14 (`catalogo.spec.ts:447`, ocultación del header móvil) falla ~1 de 3.

Para cada una, con evidencia (traza de Playwright, URL y `history.state`):
1. Determina si el fallo es de la prueba o de la aplicación.
2. Si es de la prueba, corrígela con esperas de estado, nunca con `waitForTimeout` ni reintentos.
3. Si es de la aplicación, corrige la causa sin romper el invariante de E17: el orden en que SvelteKit publica `page.state` frente al efecto. Si el arreglo exige mover la orquestación del modal fuera de `src/routes/+page.svelte`, detente y pide decisión.

Aceptación:
- tres corridas completas seguidas de `npm run test:browser` con el servidor caliente, sin fallos;
- `npm test` y `npm run build` en verde;
- `npm run visual:compare` sin diferencias nuevas.
No cambies textos, estilos ni datos. No hagas commit ni push.

Entrega: causa y arreglo por prueba (prueba o app), resultados de las tres corridas y, si sobrevive algún fallo intermitente, su frecuencia medida en 10 corridas aisladas.
```

## S4 — Arreglos menores y documentación

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `medium`

```text
Ejecuta exclusivamente la etapa S4 — Arreglos menores y documentación — de `docs/producto/plan-saneamiento-2026-10-06.md`.

Lee primero I2, H8, X1, X4 y la etapa S4 del plan; `docs/modernizacion/estado.md` completo; y los expedientes de U2, U3, R1, R2, D1 y D2 en `docs/modernizacion/`. Ejecuta `git status --short`.

Tres cambios:
1. I2. En `src/routes/+page.svelte`, `$: anuncioResultados = resultAnnouncement();` no tiene dependencias reactivas y anuncia "Cargando lanzamientos." para siempre. Pasa las entradas de las que depende como argumentos (o llama a `describeResults` de `$lib/domain/homeSearchView.ts` con ellas dentro de la sentencia), para que se recalcule al cargar y al filtrar. Añade una prueba de navegador que lea la región `aria-live` tras la carga y tras aplicar un filtro.
2. H8. En la migración `supabase/migrations/20261006131054_d1_profile_social_and_collection_order.sql` (no está aplicada en ningún entorno), añade `coleccion` y `mis-colecciones` a `private.reserved_usernames`. Si no tienes un stack local, documenta el cambio y deja la verificación con `tests/sql/d1-verify.sql` como pendiente explícito; no la declares hecha. La receta del stack local está en `docs/modernizacion/d1-datos-perfil-colecciones-2026-10-06.md`.
3. X1 y X4. Actualiza `docs/modernizacion/estado.md`:
   - una sección breve por cada etapa ejecutada sin registrar (U1, R1, R2, U2 y U3), con enlace a su expediente (U1 → `tests/visual/README.md`);
   - "Siguiente acción segura" apuntando a este plan de saneamiento;
   - en "Hechos verificados", una nota de que la descripción del catálogo vía TSV es histórica.
   No reescribas las secciones antiguas.

No cambies estilos ni textos visibles. No hagas commit ni push.
Aceptación: `npm test` y `npm run build` en verde, la prueba nueva pasa y `npm run visual:compare` no tiene diferencias.
Entrega: diff resumido, resultado de las pruebas y estado de la verificación de D1.
```

## S5 — E18 aplicable y cadena de migraciones desde cero

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa S5 — E18 aplicable y cadena de migraciones desde cero — de `docs/producto/plan-saneamiento-2026-10-06.md`.

Lee primero:
- B2, B3, H7 y la etapa S5 del plan;
- `docs/modernizacion/e18-reportes-problemas-2026-09-23.md`;
- las secciones "Hallazgos preexistentes" y "Entorno local" de `docs/modernizacion/d2-estudio-lote-vistas-rapidas-2026-10-06.md`;
- la sección del entorno local de `docs/modernizacion/d1-datos-perfil-colecciones-2026-10-06.md`;
- `supabase/migrations/20260923120000_e18_authenticated_problem_reports.sql`, `tests/sql/e18-verify.sql` y `tests/sql/local-bootstrap-pre-phase4.sql`.

Ninguna de estas migraciones toca staging ni producción en esta etapa.

1. E18 no está aplicada en ningún entorno (E21 lo confirma: `problem_reports` no existe en staging). Corrige el archivo:
   - la FK debe apuntar a `public.releases(id)`, no a la vista `public.catalog_releases`;
   - el `CHECK` que llama a `private.valid_problem_report_context` debe funcionar para `authenticated`. Concede `EXECUTE` solo sobre esa función (y `USAGE` en `private` solo si hace falta, sin abrir otras funciones), o mueve la validación a un trigger `SECURITY DEFINER` con `search_path` fijo. Justifica la elección con los advisors.
2. H7. La cadena no construye desde vacío porque `profiles`, `crates` y `crate_items` son anteriores a las migraciones. Propón y aplica una de estas dos opciones:
   - una migración base con versión anterior a `20260830192747`, idempotente (`if not exists`), que no altere un staging donde esas tablas ya existen;
   - un procedimiento oficial documentado.
   Antes de elegir, compara el esquema de esas tablas con el dump de `../discotica-backups/2026-08-30/`. Si la migración base pudiera cambiar algo en staging, detente y pide decisión.
3. Verifica sobre una cadena limpia, con `supabase db reset` en un stack local aislado (`project_id` propio y puertos 544xx; ver memoria del proyecto), sin parches en copias temporales:
   - `e18-verify.sql`, `d1-verify.sql` y `d2-verify.sql` en verde;
   - `db lint` limpio;
   - advisors sin hallazgos nuevos.
   Detén el stack con `--no-backup`.

No hagas commit ni push. Actualiza el expediente de E18 con una sección "Corrección 2026-10" y la sección D2 de `estado.md` (H2 y H3 resueltos en local).
Entrega: diff de migraciones, resultado de las tres verificaciones, decisión sobre H7 y riesgos para aplicar en staging.
```

## S6 — Concurrencia y fixtures de E06

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa S6 — Concurrencia y fixtures de E06 — de `docs/producto/plan-saneamiento-2026-10-06.md`. S5 debe estar cerrada.

Lee primero:
- H1, H5, B7, B8 y la etapa S6 del plan;
- `docs/modernizacion/e06-servicio-mutaciones-auditadas-2026-09-16.md`;
- el hallazgo H1 completo y la sección de concurrencia de `docs/modernizacion/d2-estudio-lote-vistas-rapidas-2026-10-06.md`;
- `tests/sql/d2-concurrency.sh`, `tests/sql/e06-verify.sql` y la issue E21-P1-03 en `docs/modernizacion/e21-candidato-lanzamiento-qa-staging-2026-09-24.md`.

E06 ya está aplicada en staging: todo va en una migración NUEVA, nunca editando las existentes.

1. H1. En `admin_update_catalog_release`, la lectura del snapshot dentro de `select … for update` usa la instantánea previa a esperar el bloqueo. La segunda edición concurrente se aplica sin `40001` y deja un `before_state` falso. Bloquea la fila en una sentencia previa y valida la versión después. Revisa y corrige el mismo patrón en `admin_change_release_slug` y `admin_revert_catalog_change`, con una sonda de concurrencia para cada una.
2. H5. `admin_create_catalog_release` no puede crear como `published`. Corrígelo, o documenta que se crea en borrador si corregirlo cambia el contrato que usa E07.
3. B7/H6. Actualiza o retira la última sección de `e06-verify.sql` (aprobación legada de E02), que contradice el rechazo de E09.
4. B8. Consolida las dos policies permisivas múltiples que señalan los advisors, sin cambiar quién puede leer o escribir: demuéstralo con una matriz de roles antes y después.

Verifica en el stack local aislado, con la cadena limpia de S5:
- la sonda H1 da `40001` a la segunda edición y la auditoría queda coherente, con control negativo sin el arreglo;
- `e06-verify.sql` completo, `e06-reopen-verify.sql`, `d1-verify.sql`, `d2-verify.sql` y `d2-concurrency.sh` en verde;
- la consola E07 (pruebas de navegador `e07-admin-console`) en verde.

Si `xhigh` no basta, separa H1 del resto y entrega solo H1; no subas a `max`. No hagas commit ni push.
Entrega: migración nueva, resultados con control negativo, matriz de roles de B8 y procedimiento de rollback.
```

## S7 — Conservar metadatos de portadas y enlaces

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa S7 — Conservar metadatos de portadas y enlaces (H4) — de `docs/producto/plan-saneamiento-2026-10-06.md`. S6 debe estar cerrada.

Lee primero H4 y la etapa S7 del plan, el hallazgo H4 de `docs/modernizacion/d2-estudio-lote-vistas-rapidas-2026-10-06.md`, la definición vigente de `apply_catalog_payload` (busca la última migración que la redefine) y `scripts/verify-release-media.mjs`.

Hoy cada escritura de E06 (individual, E09 o el lote de D2) borra y recrea `release_covers` y `release_links`. Se pierden `source_url`, `content_hash`, `checked_at` y cualquier portada `storage`.

En una migración nueva:
- las filas cuyo contenido no cambia se conservan intactas (mismo id y mismo `xmin`);
- las que cambian se actualizan, y solo se borra lo que el payload quita;
- la auditoría (`before_state`/`after_state`) sigue igual de completa.

Verifica en el stack local de S5/S6:
- una edición que no toca la portada deja su fila idéntica;
- una que cambia un enlace conserva los demás;
- el lote de D2 sigue todo o nada (repite su prueba de rollback por huella de `xmin`);
- `e06-verify.sql`, `d2-verify.sql` y `d2-concurrency.sh` en verde.

No hagas commit ni push. Entrega: migración, evidencia de las cuatro verificaciones y rollback.
```

## S8 — Backup y restauración de staging

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la parte de Claude de la etapa S8 — Backup y restauración de staging — de `docs/producto/plan-saneamiento-2026-10-06.md`.

Lee primero B1, B10 y la etapa S8 del plan; `docs/modernizacion/operacion-fase-6.md`; las issues E21-P0-02 y E21-P1-05 de `docs/modernizacion/e21-candidato-lanzamiento-qa-staging-2026-09-24.md`; y `docs/modernizacion/e01-validacion-staging-recuperacion-2026-09-14.md`.

Antes de nada, pregunta al usuario qué vía eligió:
- A, backup descargable del plan de Supabase;
- B, cadena de conexión de staging en una variable de entorno de esta sesión.
Nunca le pidas que pegue la contraseña en el chat ni la escribas en un archivo. Solo staging (`hgocyrzhgohetfpzbmfs`); el proyecto final `ewntlvugbopokdrvnwvg` no se toca.

1. Genera el dump de esquema y datos (roles incluidos si la vía lo permite) en `../discotica-backups/2026-10-06-staging/`, con `SHA256SUMS`. Solo lectura sobre staging.
2. Restáuralo en un stack local aislado (`project_id` propio, puertos 544xx) y compara los conteos por tabla y las sumas de control de las tablas del catálogo contra staging.
3. B10. Genera el snapshot del TSV legado publicado (2.796 filas esperadas) con checksum, con el procedimiento de E01.
4. Registra el simulacro en `operacion-fase-6.md`: fecha, vía, duración, conteos y diferencias.

Si la restauración no reproduce los conteos, el simulacro falla: regístralo y detente, sin declarar cerrado E21-P0-02.
No apliques migraciones ni escribas en staging. No hagas commit ni push.
Entrega: rutas y checksums, tabla de conteos staging/restaurado y dictamen de E21-P0-02.
```

## S9 — Aplicar en staging

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa S9 — Aplicar en staging — de `docs/producto/plan-saneamiento-2026-10-06.md`. Requiere S5, S6, S7 y S8 cerrados, y un backup de staging del mismo día. Si el backup tiene más de 24 h, repite el paso 1 de S8 antes de empezar.

Lee primero:
- la etapa S9 del plan;
- los expedientes de S5–S8;
- las secciones de rollback y "Pendiente para staging" de `docs/modernizacion/d1-datos-perfil-colecciones-2026-10-06.md` y `docs/modernizacion/d2-estudio-lote-vistas-rapidas-2026-10-06.md`.

Solo staging (`hgocyrzhgohetfpzbmfs`). El proyecto final no se toca.

Orden: E18 corregida → D1 → D2 → migración de S6 → migración de S7. Antes de cada una:
- muestra al usuario qué se va a aplicar y espera su autorización explícita;
- comprueba con `supabase migration list` que el estado remoto es el esperado.
Después de cada una:
- su verificación SQL adaptada a staging, en solo lectura o dentro de una transacción con rollback;
- advisors;
- prueba de humo con `.env.local` apuntando a staging (catálogo canónico, consola, sugerir y reportar).

Si una migración falla en staging, detente: no improvises un arreglo remoto. Registra el error y el estado, y aplica el rollback documentado solo si el usuario lo autoriza.
No hagas commit ni push. Actualiza `estado.md`.
Entrega: migraciones aplicadas con hora, verificaciones, advisors y estado remoto final.
```

## S11 — Nuevo candidato E21-rc2

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa S11 — Nuevo candidato E21-rc2 — de `docs/producto/plan-saneamiento-2026-10-06.md`. Requiere S1–S9 cerrados, y las acciones humanas de S10 hechas o registradas en `decisiones.md`.

Lee primero:
- `docs/modernizacion/e21-candidato-lanzamiento-qa-staging-2026-09-24.md` completo: matriz, issues y checklist;
- la etapa E21 de `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`;
- `docs/modernizacion/estado.md`;
- los expedientes de S3, S8 y S9.

Repite la matriz completa de E21 sobre staging con el árbol actual: candidato `discotica-e21-rc2`, con hash del build y de las migraciones aplicadas.
- Cierra o justifica cada issue de E21 (P0-01 a P0-04, P1-01 a P1-05) con evidencia nueva, no por referencia a la anterior.
- B9. Automatiza 1024 px y zoom al 200 %. Entrega al usuario una lista breve de comprobaciones manuales (lector de pantalla en VoiceOver, Safari iOS, Android Chrome e iframe real de cada proveedor) y espera sus resultados antes del dictamen.
- Suite completa: `npm test`, `build`, tres corridas de `test:browser` y `visual:compare`.

Dictamen GO o NO-GO por escrito, en un expediente nuevo `docs/modernizacion/e21-rc2-<fecha>.md`. GO exige todos los P0 cerrados. El proyecto final no se consulta ni se modifica. No hagas commit, push ni despliegue.
Entrega: dictamen, matriz, issues con estado y siguiente acción (E22 o lo que bloquee).
```
