# E21 — Candidato de lanzamiento y QA integral en staging

Fecha: 2026-09-24 (America/Bogota)  
Destino auditado: **Biblioteca Staging `hgocyrzhgohetfpzbmfs`**  
Proyecto final/producción: `ewntlvugbopokdrvnwvg`, **no consultado ni modificado**  
Dictamen: **NO-GO**

## Identidad exacta del candidato

- Nombre operativo: `discotica-e21-rc1-canonical-no-go`.
- Git base: `0ab31e05de17404d2bfce1485d0ef0e592e07a3f`; árbol local deliberadamente sin commit.
- Manifiesto SHA-256 de 139 rutas de producto (`src`, `static`, `supabase`, configuración y lockfile), incluyendo una baja: `c560dbef102063d90f5fb36df77dbe8fe65f87d252e8868ee25624487ef688a3`.
- Lockfile: `4bca0b5a87e055a5de8a5060a7ae3326daf56f81491702cabefd2efe6c1be2e8`.
- Migraciones locales: `31959c1713e9be11c69f3f9ac51ff88903f33638a11471bfeca5070b6bef681d`.
- Build canónico: `ff56118a427620ead9b1d5f3d1f944ee0f074e9b7f4ad09bb80d458983cddd61`.
- Artefacto: `/tmp/discotica-e21-20260924/discotica-e21-rc1-canonical.tgz`, SHA-256 `550b34bdcb2ae1cced421c720792ccc8621fbb22cabd58cad909700777735b31`.
- Flags del build: catálogo canónico, editorial, consola admin y beta activados.
- Vite efectivo: `6.4.3`; Supabase CLI: `2.116.0` (la CLI informó `2.117.0` disponible).

Este artefacto se conserva sólo como evidencia del candidato rechazado. **No debe promoverse a E22.**

## Frontera de entorno

`supabase/.temp/project-ref`, `.temp/linked-project.json` y `.env` apuntan al proyecto final. `.env.local` y `[remotes.staging]` apuntan a staging. Para evitar una operación accidental contra final, E21 no usó `--linked`: todas las consultas remotas nombraron `--project-ref hgocyrzhgohetfpzbmfs` o validaron que la URL PostgreSQL contuviera ese ref. No hubo `db push`, deploy, commit ni push Git.

## Estado real de staging

| Superficie | Evidencia 2026-09-24 | Estado |
| --- | --- | --- |
| Migraciones | 23 locales/remotas alineadas hasta `20260918184855`; `20260923120000_e18_authenticated_problem_reports.sql` sólo local | **FAIL E18** |
| Catálogo | 2.790 releases publicados y 2.790 filas en `catalog_releases` | PASS |
| Datos canónicos | 4.669 artistas, 461 sellos, 71 géneros, 48 países y cinco tipos canónicos | PASS |
| Importación | 2.790 keys y seis rechazos preservados | PASS |
| Créditos | 2.790 `legacy`, cero `verified`, cero propuestas/lotes/aplicaciones | **FAIL gate editorial E08** |
| Aliases | 2.790, todos `migration`; cero redirects editoriales | PASS inventario |
| Crates | 1 crate/1 item; cero `release_id is null` y cero item basado sólo en slug | PASS |
| Contribuciones | 1 fila `pending` legada sin `queue_kind` | Riesgo de compatibilidad |
| Roles | 2 admin, 4 comunidad, **0 colaborador** | **FAIL E01/E09 fixture operativa** |
| Reportes | tablas/eventos inexistentes; bucket `problem-report-screenshots` inexistente | **FAIL E18** |
| Storage | bucket privado `contribution-covers`, cero objetos | Parcial |
| Edge Functions | `login-with-username` v3 activa; `inspect-release-source` v3 activa con JWT | PASS inventario |

La precondición “E05–E20 completas y aceptadas” no se cumple: el propio relevo E18 dice que quedó pendiente de aplicar/verificar en staging y el estado remoto lo confirma. E21 no aplicó esa migración ni reparó etapas anteriores.

## Resultados reproducibles

| Verificación | Resultado |
| --- | --- |
| `npm test` | **PASS 52/52** |
| Build RC con flags activos | **PASS**, adapter-static |
| Browser integrado, flags activos, un worker | **82 PASS, 2 FAIL, 2 skip** de 86 |
| Build rollback con `legacy` y editorial/admin/beta apagados | **PASS**; hash `e396ac812f4b622c9a8201f7eb19526c0b7de50f8c74d1e638a7e57d180cef4b` |
| E19 con beta apagada | **1 PASS, 3 skip** condicionados |
| `git diff --check` | **PASS** antes de la documentación E21 |
| Audit de `static/lanzamientos.json` | 622 filas; hash `d9ff...6422f`; 6 enlaces inválidos, 1 ausente, 3 portadas inválidas, 3 ausentes, 2 claves candidatas duplicadas |
| Media health completo | 1.231 URLs: **1.170 sanas, 61 fallidas**; evidencia hash `0dd48a2ec48650418b0733d8318d55a5e75ff0056950f27a165f4105f1a11cda` |
| E09 RLS/transiciones | **PASS 14 checks**, `ROLLBACK` |
| E09 concurrencia | **PASS**: un submit y un `22023`, fixture eliminada |
| E06 reapertura | **PASS**, `ROLLBACK` |
| E08 cola/lote/reversión | **PASS**, `ROLLBACK` |
| E06 fixture original | **FAIL `22023`** al aprobar payload legado; E09 ahora exige confirmación v2 |
| E18 fixture | **FAIL `42P01`**, no existe `problem_reports` |
| Admin staging real | **PASS** login, ruta, búsqueda, 1440/390 |
| Auth/crates smoke | 17 checks PASS; después **FAIL `42501`** al insertar contribución cruda v1; 4 usuarios fixture limpiados sin error |

Los dos fallos browser son atribuibles:

1. E01 sigue buscando el encabezado histórico `Cola editorial`, reemplazado por E10.
2. E17 usa `beta=1` como parámetro desconocido en una prueba directa; con E19 activo, la invitación beta legítimamente intercepta el clic. La suite debe armonizar ese caso en E17/E19.

No se corrigieron desde E21.

## RLS, grants, advisors e índices

- Cero tablas físicas en `public` sin RLS.
- Cero hallazgos `WARN`/`ERROR` del advisor de seguridad.
- Anon sólo tiene `SELECT` sobre catálogo público/perfiles/crates públicos; `contributions` y eventos sólo conceden `SELECT` a `authenticated`; las pruebas negativas E06/E08/E09 pasaron.
- Las RPC `SECURITY DEFINER` no son ejecutables por anon. Son ejecutables por authenticated cuando forman la API deliberada y conservan gates de servidor probados.
- Advisor de rendimiento: dos `WARN multiple_permissive_policies` para `SELECT` de `contributions` y `contribution_events`. Se devuelven a E09; no se fusionaron policies desde QA.
- La búsqueda administrativa real respondió sin lentitud observable. No se añadió un índice especulativo desde E21.

## Matriz funcional y visual

Las suites cubren home normal/vacío/carga/error, cards/créditos, modal/ruta, filtros, header, auth gates, sugerir, perfil, editorial, admin, beta y bienvenida en Chromium; incluyen teclado, foco, Escape, Back/Forward, reduced motion, errores simulados de fuente/player y ausencia de overflow. Los relevos y la pasada integrada cubren 360, 390, 768 y 1440 px.

No se puede cerrar la matriz pedida como completa:

- falta evidencia visual explícita a **1024 px**;
- faltan lector de pantalla real y zoom 200 %;
- faltan Firefox/WebKit y dispositivos físicos iOS/Android ya pendientes desde E15;
- faltan clics reales dentro de iframes remotos de E16;
- falta flujo autenticado real de colaborador porque staging no tiene ese rol;
- reportes/screenshot no pueden ejecutarse porque E18 no existe en staging;
- no existe aprobación editorial de muestras exacto/aproximado ni de créditos; los 2.790 créditos siguen `legacy`.

## Datos, media y comparación legacy/canónico

El catálogo canónico conserva los conteos documentados de importación (2.790 válidos + 6 rechazos), pero el JSON local de auditoría sólo contiene 622 filas. Sin snapshot fresco de la fuente editorial legado no se demostró equivalencia fila a fila entre ambos universos. No se rellenó ni borró nada.

El health check encontró 61 fallos: 55 Bandcamp, cuatro portadas `f4.bcbits.com` y dos Beatport. Gran parte de Bandcamp devolvió rate limiting durante la pasada masiva; cada caso debe confirmarse en navegador antes de cambiar catálogo. El informe completo vive en `/tmp/discotica-e21-20260924/media-health.json`.

## Backup, restore y rollback

- `supabase backups list --project-ref hgocyrzhgohetfpzbmfs`: `backups=null`, PITR apagado.
- Docker no está disponible; `npx supabase db dump` falló al conectar al socket de Docker.
- `psql`/`pg_dump` no están instalados.
- No se generó dump y **no se ejecutó restore drill** de catálogo, contributions, reports o Storage.
- El rollback de aplicación se ensayó sólo localmente mediante build con fuente legacy y flags apagados. No se desplegó ni cambió configuración remota.

Esto incumple un criterio go explícito. E22 no debe aceptar un backup histórico ni una declaración documental como sustituto de un restore fresco.

## Inventario efectivo de flags

| Variable | Implementación real | Estado RC | Rollback |
| --- | --- | --- | --- |
| `VITE_CATALOG_SOURCE` | vigente | `canonical` | `legacy` compiló |
| `VITE_EDITORIAL_ENABLED` | vigente | `true` | `false` compiló |
| `VITE_ADMIN_CATALOG_ENABLED` | vigente | `true` | `false` compiló |
| `VITE_BETA_INVITATION_ENABLED` | vigente | `true` | `false`, prueba PASS |
| `VITE_ISSUE_REPORTING_ENABLED` | **no existe**; E18 decidió canal permanente | n/a | DB ausente en staging |
| `VITE_BETA_FEEDBACK_EMAIL` | **no existe**; E19 fijó `hola@discotica.com` | n/a | retirar E19 |
| `VITE_PUBLIC_LAUNCH_LABEL` | **no existe** | sin fecha | n/a |
| Bienvenida | sin flag por contrato E20 | activa por sesión | rollback de código |

Los flags cliente no sustituyen RLS. El inventario discrepa del plan en tres nombres y debe normalizarse como decisión documental antes de E22, no inventarse durante el corte.

## Issues y atribución

| ID | Severidad | Origen | Reproducción/impacto |
| --- | --- | --- | --- |
| E21-P0-01 | P0 | E18 | migración/tablas/bucket ausentes; reportes imposibles |
| E21-P0-02 | P0 | E01/operación | no hay backup descargable ni restore drill fresco |
| E21-P0-03 | P0 | E08/producto | 0/2.790 créditos verificados y sin muestra aprobada |
| E21-P0-04 | P0 | integración E01/E17/E19 | suite completa no verde: 2 fallos reproducibles |
| E21-P1-01 | P1 | E01/E09 | cero cuentas colaborador permanentes en staging |
| E21-P1-02 | P1 | E06/E09 | fixture E06 anterior contradice rechazo legado E09 |
| E21-P1-03 | P1 | E09 | dos warnings de policies permisivas múltiples |
| E21-P1-04 | P1 | E15/E16/E21 | matriz 1024, zoom/lector, browsers/dispositivos e iframe real incompleta |
| E21-P1-05 | P1 | datos/operación | no hay snapshot legado de 2.796 filas para comparación fresca |
| E21-P2-01 | P2 | catálogo/media | 61 URLs requieren triage; no editar por 429 aislado |
| E21-P2-02 | P2 | configuración | `.temp` apunta a final y hace inseguro cualquier `--linked` |

## Checklist de corte para E22

- [ ] E18 aplicada y aceptada en staging; RLS, MIME/tamaño, attach y cola admin verificados.
- [ ] `migration list` local/remoto idéntico con E18.
- [ ] Cuenta real de colaborador y matriz anon/comunidad/colaborador/admin completa.
- [ ] Suite unitaria/browser/build verde con beta on/off.
- [ ] Matriz visual 360/390/768/1024/1440 y accesibilidad manual firmada.
- [ ] Créditos y ejemplos exacto/aproximado aprobados editorialmente.
- [ ] Backup fresco con checksum fuera del proveedor y restore aislado comprobado, incluyendo Storage.
- [ ] Snapshot legado fresco y comparación canónica conciliada.
- [ ] Media failures confirmados en navegador y clasificados.
- [ ] `.temp`/perfil operativo separado de final; dos señales de project ref antes de cada comando.
- [ ] Rollback de flags desplegado/ensayado en staging, no sólo compilado.
- [ ] Producto firma y segunda persona operativa firma el go/no-go.

## Firma

- QA técnico por evidencia: **NO-GO**, 2026-09-24.
- Firma de producto: **pendiente**.
- Segunda persona operativa: **pendiente**.

E22 queda bloqueada hasta un nuevo candidato que cierre todos los P0 y repita la matriz completa. El proyecto final/producción permaneció intacto.
