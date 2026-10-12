# Plan de saneamiento: errores y problemas abiertos — 2026-10-06

Inventario de lo que hoy está roto, bloqueado o en riesgo en la Biblioteca, con la acción que corresponde a cada caso y quién la ejecuta. Los prompts por etapa, con modelo y esfuerzo, están en [`prompts-saneamiento-2026-10-06.md`](./prompts-saneamiento-2026-10-06.md).

Este plan no sustituye al [plan de interfaz](./plan-interfaz-2026-10-04.md) ni al de la [biblioteca](./plan-ejecucion-biblioteca-2026-09-14.md). Ordena lo que hay que cerrar antes de seguir con U4 y de volver a intentar el candidato de lanzamiento (E21).

## 1. Diagnóstico de hoy

Comandos ejecutados el 2026-10-06 sobre el árbol actual, sin cambios:

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 74/74 en verde |
| `npm run build` | En verde, sin avisos del compilador |
| `npm run test:browser` | 108 pasan, 5 omitidas, 2 fallan: E17:198 (persistente) y E17:99 (carrera de la prueba; pasa al repetirla) |
| `git log` | Último commit: 2026-05-29 (`0ab31e0`) |
| `git status` | 552 archivos sin commit, incluidos `supabase/`, `tests/`, `docs/` y casi todo `src/lib/` |
| CI y despliegue | `ci.yml` y `deploy.yml` usan Node 20; local usa Node 22.18 |
| `.env` / `.env.local` | `.env` apunta al proyecto **final** (`ewnt…`); `.env.local` lo sobrescribe con staging |

Etapas del plan de interfaz ya ejecutadas en local, sin revisión humana ni commit: U1, R1, R2, U2, U3, D1 y D2.

## 2. Problemas por severidad

Leyenda de responsable: **Tú** = acción humana (acceso, cuenta, decisión de producto). **Claude** = ejecutable en un chat con el prompt de la etapa. **Ambos** = Claude prepara, tú decides o das acceso.

### Crítico: riesgo de perder trabajo o tumbar el sitio

| # | Problema | Evidencia | Impacto | Responsable | Acción | Etapa |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Cuatro meses de trabajo fuera de git | Último commit 2026-05-29. 552 archivos sin seguimiento ni commit: migraciones, pruebas, docs, servicios, componentes. | Ya se perdió una vez la línea base visual de U1 (2026-10-06). Un borrado, una sesión paralela o un fallo de disco se lleva E00–E21, U1–U3, R1–R2 y D1–D2. | Ambos | Respaldo fuera del repo y commit en una **rama** (no `main`), con revisión de secretos antes. Push a `origin` solo con tu autorización. | S0 |
| C2 | Un push a `main` tumba producción | `deploy.yml` publica `build/` en la rama `dist` en cada push a `main`, sin variables `VITE_*`. `src/lib/supabase/client.ts` lanza `Missing Supabase configuration` si faltan. | En cuanto el árbol actual llegue a `main`, el sitio publicado queda en blanco. Además publicaría flags y rutas que no pasaron QA. | Ambos | Variables del despliegue en GitHub (tú), y un workflow que falle antes de publicar si faltan, con flags seguros por defecto (Claude). Hasta entonces, nada entra a `main`. | S1 |
| C3 | La CI falla en el primer PR | `ci.yml` usa Node 20. `npm test` usa `--experimental-strip-types`, que solo existe desde Node 22.6. | La CI marcará rojo cualquier PR por una causa ajena al cambio. | Claude | Node 22 en los dos workflows, `engines` y `.nvmrc`. | S1 |

### Bloqueos de lanzamiento (E21 NO-GO, sin cambios desde 2026-09-24)

| # | Problema | Evidencia | Responsable | Acción | Etapa |
| --- | --- | --- | --- | --- | --- |
| B1 | No hay backup restaurable de staging (E21-P0-02) | [E21](../modernizacion/e21-candidato-lanzamiento-qa-staging-2026-09-24.md). Bloquea aplicar E18, D1 y D2. | Tú, luego Claude | Elegir cómo se respalda (backups del plan de Supabase o `pg_dump` con la cadena de conexión) y dar el acceso. Claude ejecuta el dump y el simulacro de restauración en local. | S8 |
| B2 | La migración E18 no aplica | FK hacia la vista `catalog_releases` (`42809`), hallazgo H2 de D2. | Claude | Apuntar la FK a `public.releases(id)`. E18 no está aplicada en ningún entorno, así que se corrige el archivo. | S5 |
| B3 | Un autor no puede crear reportes (E18) | El `CHECK` llama a `private.valid_problem_report_context` sin `EXECUTE` para `authenticated` (H3). `tests/sql/e18-verify.sql` falla. | Claude | `EXECUTE` solo sobre esa función, o validar en un trigger `SECURITY DEFINER`. | S5 |
| B4 | Cero créditos verificados (E21-P0-03) | 0/2.790. | Tú (equipo editorial) | Aprobar una muestra o redefinir el criterio de salida en `decisiones.md`. | S10 |
| B5 | La suite de navegador no está en verde (E21-P0-04) | E17:198 falla siempre (30 s de timeout). E17:99 es una carrera: la prueba hace `scrollTo` antes de que exista el catálogo. E17:178 falla al correr el archivo completo (la URL gana `&orden=match`). E14 (`catalogo.spec.ts:447`) falla 1 de cada 3. | Claude | Encontrar la causa de cada uno y separar prueba frágil de fallo real. | S3 |
| B6 | Sin cuentas de colaborador permanentes en staging (E21-P1-01) | E21. | Tú | Crear al menos una cuenta y asignarle el rol. | S10 |
| B7 | Fixture de E06 contradice el rechazo legado de E09 (E21-P1-02 / H6) | La última sección de `tests/sql/e06-verify.sql` falla desde E09. | Claude | Retirar o actualizar la sección. | S6 |
| B8 | Dos avisos de políticas permisivas múltiples (E21-P1-03) | Advisors de staging. | Claude | Consolidar las policies. | S6 |
| B9 | Matriz de QA incompleta (E21-P1-04) | Faltan 1024 px, zoom, lector de pantalla, otros navegadores y dispositivos, e iframe real. | Ambos | Claude automatiza lo automatizable; tú haces lector de pantalla y dispositivos físicos. | S11 |
| B10 | Sin snapshot legado de 2.796 filas para comparar (E21-P1-05) | E21. | Claude | Generar el snapshot del TSV publicado con checksum. | S8 |

### Integridad de datos (hallazgos de D2)

| # | Problema | Severidad | Responsable | Acción | Etapa |
| --- | --- | --- | --- | --- | --- |
| H1 | E06 pierde actualizaciones concurrentes: dos ediciones con la misma versión se aplican las dos, sin `40001`, y la auditoría guarda un `before_state` falso | Alta | Claude | Bloquear la fila en una sentencia previa en `admin_update_catalog_release`; revisar el mismo patrón en `admin_change_release_slug` y `admin_revert_catalog_change`. Antes de U15. | S6 |
| H4 | Cada escritura de E06 borra y recrea portadas y enlaces: se pierden `source_url`, `content_hash` y `checked_at` | Media | Claude | `apply_catalog_payload` conserva las filas que no cambian. Antes de guardar resultados de `verify:media` o de promover portadas a Storage. | S7 |
| H5 | `admin_create_catalog_release` no puede crear directamente como publicado | Baja | Claude | Corregir o documentar que se crea en borrador. | S6 |
| H7 | La cadena de migraciones no construye desde una base vacía: `profiles`, `crates` y `crate_items` son anteriores a ellas | Media | Claude | Convertir `tests/sql/local-bootstrap-pre-phase4.sql` en una migración base, o documentar el arranque como paso oficial. | S5 |
| H8 | `private.reserved_usernames` no reserva `coleccion` ni `mis-colecciones` | Baja | Claude | Añadirlas en la migración D1, que aún no está aplicada. | S4 |

### Interfaz y accesibilidad

| # | Problema | Responsable | Acción | Etapa |
| --- | --- | --- | --- | --- |
| I1 | La línea base visual no corresponde a ninguna etapa aceptada. `baseline/` es el estado R1+R2; R1, R2, U2 y U3 esperan revisión. Hay una copia temporal de 17 MB en `tests/visual/.ref-pre-u3/`. | Tú, luego Claude | Revisar las diferencias en el informe de la suite. Si las aceptas, Claude recaptura `baseline/` y borra la referencia temporal. **Bloquea U4.** | S2 |
| I2 | El anuncio de resultados para lectores de pantalla dice "Cargando lanzamientos." para siempre: `anuncioResultados = resultAnnouncement()` no tiene dependencias reactivas (`src/routes/+page.svelte:259`) | Claude | Pasar sus entradas como argumentos para que se recalcule. | S4 |
| I3 | `ficha-M` y `miscrates-M` se reacomodan a 390 px por la longitud de "colección" | — | Conocido y esperado. Lo resuelven U9 y U14. Sin acción. | — |
| I4 | Archivos por encima de ~500 líneas: manual (966), `Filtros` (925), consola (581), `ReleaseDetail` (579) | — | Ya asignados a U9, U10, U11 y U15. Sin acción. | — |

### Documentación y entorno

| # | Problema | Responsable | Acción | Etapa |
| --- | --- | --- | --- | --- |
| X1 | `estado.md` está desactualizado. No registra U1, R1, R2, U2 ni U3, y su "Siguiente acción segura" sigue siendo U1. "Hechos verificados" describe el catálogo como TSV. | Claude | Añadir las secciones de etapa y una siguiente acción real. | S4 |
| X2 | No está registrada la decisión de ejecutar E22 antes o después de U4. El plan de interfaz exige registrarla antes de U4. | Tú | Decidir y registrar en `decisiones.md`. | S12 |
| X3 | `.env` contiene la URL y la clave del proyecto final con `VITE_EDITORIAL_ENABLED=true`. Hoy no se usa porque `.env.local` lo sobrescribe, pero cualquier entorno sin `.env.local` apuntaría al proyecto final. | Tú | Cambiar `.env` a staging o vaciarlo. Claude no edita archivos de credenciales. | S0 |
| X4 | No existe el relevo de U1 en `docs/`. Su contenido está en `tests/visual/README.md`. | Claude | Enlazarlo desde `estado.md`. | S4 |
| X5 | D3 (correo propio) no puede empezar sin DNS de discotica.com ni un proveedor de envío | Tú | Dar acceso al DNS y elegir el proveedor. | Gate de D3 |

## 3. Orden de ejecución

```text
S0 Resguardo ──► S1 CI/despliegue ──┐
                                    ├──► S2 Línea base visual ──► (U4 del plan de interfaz)
S4 Arreglos menores ────────────────┘
S3 Suite de navegador ───────────────────────────────────────┐
S5 E18 + base de migraciones ──► S6 E06 (H1, H5, H6, B8) ──► S7 H4
S8 Backup y restore (gate tuyo) ──► S9 Aplicar en staging ──┤
S10 Créditos y cuentas (tuyo) ──────────────────────────────┼──► S11 Candidato E21-rc2 ──► S12 Decisión E22/U4
```

- **Hoy:** S0. Todo lo demás depende de que el trabajo esté a salvo.
- **En paralelo sin conflicto:** S3, S5 y S8 tocan zonas distintas. Aun así, **nunca dos chats sobre el mismo árbol de trabajo**: usa un worktree por chat o hazlas en serie.
- **S2 bloquea U4.** S11 bloquea E22.

## 4. Etapas

Cada etapa se ejecuta en un chat nuevo con el prompt del [archivo de prompts](./prompts-saneamiento-2026-10-06.md), salvo las que son solo tuyas. Valen el contrato de la sección 6 y el criterio de modelo de la sección 7 del [plan de interfaz](./plan-interfaz-2026-10-04.md). La única excepción es S0, que hace commit porque ese es su objetivo, y solo en una rama.

### S0 — Resguardo del trabajo

- **Objetivo:** que nada de lo hecho desde mayo dependa de un solo disco.
- **Tú:**
  - autorizas el nombre de rama (propuesta: `modernizacion-2026`) y el push;
  - cambias `.env` (X3).
- **Claude:**
  - copia el árbol completo y `tests/visual/` a `../discotica-backups/2026-10-06-arbol/`, con checksums;
  - busca secretos en todo lo que va a entrar (claves, `service_role`, cadenas de conexión, tokens);
  - hace un commit por bloque lógico: docs, `supabase/`, pruebas, `src/`, CI;
  - hace push de la rama solo si lo autorizaste.
- **Decisión pendiente:** si `tests/visual/baseline/` (17 MB de PNG) entra a git o se guarda solo en el respaldo. Recomendación: que entre. Es la única copia de referencia y ya se perdió una vez.
- **Aceptación:** `git status` limpio salvo lo ignorado; respaldo verificado por checksum; `main` sin tocar.
- **Perfil de ejecución:** Sonnet 5.5, `high`. Motivo: operación acotada, pero con revisión de secretos. Escalar a Opus solo si aparece un secreto versionado o historial que reescribir.

### S1 — CI y despliegue seguros

- **Objetivo:** que llevar el árbol a `main` no tumbe el sitio y que la CI dé señales reales.
- **Claude:**
  - Node 22 en `ci.yml`, `deploy.yml` y `media-health.yml`, más `engines` y `.nvmrc`;
  - `deploy.yml` lee las variables `VITE_*` desde las variables del repositorio y falla antes de publicar si falta alguna;
  - flags seguros por defecto: `VITE_CATALOG_SOURCE=legacy` y todos los kill switch en `false` hasta E22;
  - documentar qué variables crear;
  - las pruebas de navegador que dependen de staging deben quedar omitidas en la CI, no fallar.
- **Tú:** crear en GitHub las variables (URL y clave **publicable**, nunca `service_role`) y decidir si el despliegue sigue siendo automático en cada push a `main` o pasa a manual (`workflow_dispatch`). Recomendación: manual hasta E22.
- **Aceptación:** la CI corre en verde en un PR de la rama de S0; un build sin variables falla en CI sin publicar.
- **Perfil de ejecución:** Sonnet 5.5, `high`. Motivo: archivos acotados con riesgo de despliegue. Escalar a Opus si la CI revela fallos de pruebas dependientes del entorno.

### S2 — Revisión visual y nueva línea base

- **Tú:**
  1. ejecutas `npm run visual:compare` y abres el informe;
  2. revisas las diferencias contra lo descrito en los expedientes de R1, R2, U2 y U3;
  3. aceptas o pides cambios.
- **Claude, tras tu aceptación:**
  - ejecuta `npm run visual:capture` dos veces y confirma cero diferencias entre corridas;
  - borra `tests/visual/.ref-pre-u3/` y `playwright.ref.config.ts`;
  - hace commit de la línea base en la rama de S0.
- **Aceptación:** `visual:compare` con cero diferencias sobre el árbol actual.
- **Perfil de ejecución:** Sonnet 5.5, `medium`. Motivo: comandos conocidos. Escalar si alguna captura no se estabiliza.

### S3 — Suite de navegador en verde

- **Objetivo:** cerrar E21-P0-04 con causas, no con reintentos.
- **Claude:**
  - **E17:198:** reproducir en aislado, decidir si el fallo es de la prueba o del historial del modal y corregir lo que corresponda.
  - **E17:99:** esperar a la tarjeta antes de `scrollTo` (causa ya identificada en U2).
  - **E17:178:** encontrar qué deja `&orden=match` entre pruebas del mismo archivo (estado compartido, `sessionStorage` o la URL) y aislarlo.
  - **E14 (`catalogo.spec.ts:447`):** sustituir la espera fija por una espera de estado.
- **Aceptación:**
  - tres corridas completas seguidas, con el servidor ya caliente, sin fallos;
  - cada arreglo explica si era de la prueba o de la app;
  - las diferencias visuales, cero.
- **Perfil de ejecución:** Opus 5.5, `high`. Motivo: historial y scroll no deterministas, el invariante que E17 escaló a `xhigh`. Escalar a `xhigh` solo si E17:198 resulta ser un fallo real del historial.

### S4 — Arreglos menores y documentación

- **Claude:**
  - I2, el anuncio reactivo de resultados, con su prueba;
  - H8, añadir `coleccion` y `mis-colecciones` a los nombres reservados en la migración D1, y repetir `d1-verify.sql` en local;
  - X1 y X4, actualizar `estado.md`.
- **Aceptación:**
  - `npm test` y `build` en verde;
  - el lector de pantalla anuncia el conteo real tras cargar (prueba de navegador);
  - `estado.md` refleja U1–U3, R1–R2, D1–D2 y este plan.
- **Perfil de ejecución:** Sonnet 5.5, `medium`. Motivo: tres cambios pequeños y delimitados. Escalar a Opus si tocar D1 rompe su suite SQL.

### S5 — E18 aplicable y cadena de migraciones desde cero

- **Claude:**
  - corregir la FK de E18 (B2) y el permiso del `CHECK` (B3);
  - convertir el arranque local en una migración base o en un procedimiento oficial (H7);
  - verificar `e18-verify.sql`, `d1-verify.sql` y `d2-verify.sql` sobre una cadena limpia, sin parches en copias temporales.
- **Aceptación:** `supabase db reset` en local construye toda la cadena; las tres verificaciones en verde; advisors sin hallazgos nuevos.
- **Perfil de ejecución:** Opus 5.5, `high`. Motivo: RLS, grants y orden de migraciones. Escalar a `xhigh` si la migración base obliga a reescribir migraciones ya aplicadas en staging (en ese caso, detenerse y pedir decisión).

### S6 — Concurrencia y fixtures de E06

- **Claude:**
  - H1 en las tres RPC;
  - H5, crear como publicado o documentarlo;
  - B7 (H6), actualizar la fixture;
  - B8, consolidar las policies permisivas.
- Todo en una migración nueva, porque E06 ya está aplicada en staging.
- **Aceptación:**
  - la sonda de `d2-concurrency.sh` da `40001` a la segunda edición, con control negativo;
  - `e06-verify.sql` completo en verde;
  - D2 sigue en verde.
- **Perfil de ejecución:** Opus 5.5, `xhigh`. Motivo: auditoría y concurrencia del contrato central de escritura. Escalar: si `xhigh` no basta, separar H1 del resto, no subir a `max`.

### S7 — Conservar metadatos de portadas y enlaces (H4)

- **Claude:** `apply_catalog_payload` actualiza en lugar de borrar y recrear las filas que no cambian, y conserva `source_url`, `content_hash` y `checked_at`.
- **Aceptación:** una edición que no cambia la portada deja su fila intacta (mismo id y mismo `xmin`). El lote de D2 sigue todo o nada.
- **Perfil de ejecución:** Opus 5.5, `high`. Motivo: función compartida por E06, E09 y D2.

### S8 — Backup y restauración de staging (gate humano)

- **Tú:** decidir la vía y dar el acceso:
  - **A.** Plan de Supabase con backups descargables o PITR.
  - **B.** Cadena de conexión de staging para `pg_dump` en una variable local, nunca en un archivo versionado.
- **Claude:**
  - dump de esquema y datos con checksum en `../discotica-backups/`;
  - restauración completa en un stack local aislado, con conteos comparados;
  - snapshot legado de 2.796 filas (B10);
  - informe del simulacro según `operacion-fase-6.md`.
- **Aceptación:** restauración local con conteos idénticos por tabla y checksum registrado. Cierra E21-P0-02.
- **Perfil de ejecución:** Opus 5.5, `high`. Motivo: operación sobre staging, aunque sea de solo lectura.

### S9 — Aplicar en staging

- **Requiere** S5, S6 y S8 cerrados, y un backup del mismo día.
- **Claude:** aplicar en orden E18 corregida, D1, D2, S6 y S7. Después de cada una: verificación SQL, advisors y prueba de humo con la app apuntando a staging.
- **Tú:** autorizar cada aplicación.
- **Aceptación:** las cinco migraciones aplicadas, sus verificaciones en verde en staging y el rollback documentado.
- **Perfil de ejecución:** Opus 5.5, `high`. Motivo: esquema remoto. Si una migración falla en staging, detenerse; no improvisar un arreglo remoto.

### S10 — Créditos y cuentas (solo tuyo)

- Aprobar una muestra de créditos o registrar en `decisiones.md` un criterio de salida alcanzable (B4).
- Crear una cuenta de colaborador permanente en staging (B6).
- Sin prompt: es trabajo editorial y de cuentas.

### S11 — Nuevo candidato E21-rc2

- **Claude:**
  - repetir la matriz completa de E21 sobre staging con todo lo anterior aplicado;
  - automatizar 1024 px y zoom;
  - preparar la lista manual de lector de pantalla y dispositivos.
- **Tú:** la parte manual de B9.
- **Aceptación:** dictamen GO o NO-GO con evidencia y todos los P0 cerrados o justificados.
- **Perfil de ejecución:** Opus 5.5, `xhigh`. Motivo: QA integral de lanzamiento.

### S12 — Decisión E22 frente a U4 (solo tuya)

- Con el dictamen de S11, registrar en `decisiones.md` si el corte (E22) va antes de U4, como recomienda el plan de interfaz.

## 5. Lo que solo tú puedes hacer

| Acción | Desbloquea | Cuándo |
| --- | --- | --- |
| Autorizar rama y push del resguardo | S0, C1 | Hoy |
| Cambiar `.env` para que no apunte al proyecto final | X3 | Hoy |
| Crear las variables de despliegue en GitHub y decidir despliegue manual o automático | S1, C2 | Esta semana |
| Revisar las diferencias visuales de R1, R2, U2 y U3 | S2, U4 | Esta semana |
| Elegir la vía de backup de staging y dar el acceso | S8, S9, E21 | Esta semana |
| Aprobar una muestra de créditos o el criterio de salida | B4, E21 | Antes de S11 |
| Crear la cuenta de colaborador en staging | B6 | Antes de S11 |
| QA manual: lector de pantalla y dispositivos | B9 | Durante S11 |
| Decidir E22 antes o después de U4 | X2 | Tras S11 |
| DNS de discotica.com y proveedor de correo | D3 | Cuando quieras abrir D3 |

## 6. Fuera de este plan

- Los rediseños de U4–U18 siguen en el [plan de interfaz](./plan-interfaz-2026-10-04.md), y su orden no cambia.
- Reflujos móviles por textos (I3) y archivos grandes (I4): ya tienen etapa.
- Reproductor para enlaces de pista de Spotify: decisión previa, fuera de alcance.
- La guarda de scroll del reproductor actúa durante 1,6 s (R1). Es un riesgo residual sin caso observado, así que no tiene acción.
