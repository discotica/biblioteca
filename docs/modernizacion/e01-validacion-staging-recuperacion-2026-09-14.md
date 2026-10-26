# Expediente E01 — validación de staging, roles y recuperación

Fecha de ejecución: 2026-09-14–2026-09-15 (America/Bogota)  
Etapa: E01 — Validar staging, roles y recuperación existentes  
Estado: **completa; GO para E02**  
Alcance efectivo: inventario local, respaldo externo, restore aislado y pruebas reales sobre el staging autorizado `hgocyrzhgohetfpzbmfs`. El origen `ewntlvugbopokdrvnwvg` se consultó únicamente en modo read-only para reproducir la definición del trigger faltante; nunca se modificó.

## Dictamen

E00 está aceptada como dependencia documental. La identidad de staging quedó resuelta por una señal humana explícita y dos comprobaciones técnicas: el proyecto se llama `Biblioteca Staging`, usa el ref autorizado `hgocyrzhgohetfpzbmfs` y la dirección devuelta por PostgreSQL coincide con el DNS de `db.hgocyrzhgohetfpzbmfs.supabase.co`. Las cinco migraciones de entrada coincidían local/remoto; después de las dos correcciones E01, las siete versiones coinciden. El catálogo remoto confirma 2.790 releases publicados, 2.790 claves de importación y seis rechazos.

En la primera continuación apareció un hallazgo crítico fuera del alcance inicial: `authenticated` tenía `UPDATE` de tabla completo sobre `public.profiles`, incluida la columna `role`. Una prueba revertida confirmó autoascenso a `admin`, se conservó la evidencia y se detuvo el trabajo. El usuario amplió después el alcance de forma explícita; la única migración correctiva normalizó la causa raíz y las correcciones ya acordadas, y quedó aplicada y verificada en staging.

La matriz remota quedó verde con sesiones reales de comunidad, colaborador y admin: confirmación OTP, login por email y username, recovery con cambio de contraseña, RLS, crates, contribuciones y DELETE por Storage API. El build con catálogo canónico/editorial y su navegador específico también quedaron verdes. La prueba descubrió que el restore había omitido el trigger `auth.users -> public.handle_new_user()`; una segunda migración E01 lo restituyó con la misma definición y ACL endurecido del origen.

E01 queda aceptada. Un inbox autorizado recibió confirmación y recovery, el usuario completó el cambio de contraseña y pudo iniciar sesión; PostgreSQL confirmó una cuenta reciente confirmada con `last_sign_in_at`. Los `429` al repetir `/recover` son el límite antiabuso documentado y no invalidan el flujo exitoso anterior. La segunda persona requerida verificó el respaldo y sus checksums y firmó el restore drill.

## Límites y preservación

- Rama `main`, commit `0ab31e05de17404d2bfce1485d0ef0e592e07a3f`, alineado con `origin/main` al iniciar E01.
- El árbol estaba sucio antes de E01: 124 entradas con `git status --short --untracked-files=all`; `docs/` y `supabase/` ya eran no rastreados.
- E01 no limpió, restauró, formateó, confirmó ni publicó cambios ajenos.
- Archivos de la continuación: este expediente; las migraciones `20260914221226_normalize_phase4_phase5_acl_and_storage_rls.sql` y `20260915173322_restore_auth_profile_trigger.sql`; el smoke `scripts/e01-staging-smoke.mjs`; el test de navegador canónico; y la bitácora/manifiesto/checksum del respaldo externo. No se modificaron los dumps ni el archivo de credenciales.
- Se aplicaron dos migraciones a `hgocyrzhgohetfpzbmfs`, cada una después de preflight transaccional y dry-run. Durante la prueba manual posterior se desplegó únicamente `login-with-username` versión 2 en staging para corregir su CORS; no se modificó el origen, no se usó producción y no se hizo commit/push.
- Los dumps contienen datos de Auth y deben tratarse como material sensible. Este expediente no reproduce emails, hashes de contraseña, tokens ni claves.

## Documentación vigente consultada

Se consultaron el changelog y documentación oficial el 2026-09-14 y se revalidaron el 2026-09-15:

- [Changelog de Supabase](https://supabase.com/changelog.md): entre los cambios relevantes recientes constan correcciones de backups diarios omitidos (2026-08-12) y resincronización de credenciales tras restore físico (2026-07-30). También anuncia que las tablas nuevas dejan de exponerse automáticamente en Data API; los `GRANT` explícitos de estas migraciones son por ello parte del contrato, no sustituto de RLS.
- [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security): grants y policies son controles separados; cada tabla expuesta debe tener ambos y pruebas allow/deny por operación.
- [Advisors](https://supabase.com/docs/guides/observability/advisors): los advisors inspeccionan el esquema vivo; una lectura estática no equivale a ejecutarlos.
- [Seguridad de Edge Functions](https://supabase.com/docs/guides/functions/auth) y [API keys](https://supabase.com/docs/guides/getting-started/api-keys): una clave privilegiada omite RLS y exige autorización de servidor; `verify_jwt=false` abre el handler a la autenticación implementada dentro de la función.
- [CORS de Edge Functions](https://supabase.com/docs/guides/functions/cors): desde `supabase-js` 2.95 se recomienda importar `corsHeaders` del SDK para incluir `x-client-info` y mantener sincronizada la lista permitida.
- [Templates de email](https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching): un filtro de seguridad del proveedor puede consumir el enlace de un solo uso antes de que el navegador lo abra.
- [Control de acceso de Storage](https://supabase.com/docs/guides/storage/security/access-control) y [buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals): un bucket privado sigue sujeto a RLS; MIME y tamaño se validan en el bucket y cada operación necesita policy adecuada.
- [Gestión de usuarios](https://supabase.com/docs/guides/auth/managing-user-data): el patrón oficial para perfiles usa una función `SECURITY DEFINER` endurecida y un trigger `AFTER INSERT` sobre `auth.users`; un fallo del trigger puede bloquear registros y debe probarse.
- [SMTP personalizado](https://supabase.com/docs/guides/auth/auth-smtp) y [rate limits de Auth](https://supabase.com/docs/guides/auth/rate-limits): el SMTP integrado solo entrega a emails del equipo, limita el envío a dos mensajes por hora y no sirve como prueba pública de entrega.
- [Backup/restore con CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): el flujo actual genera `roles.sql`, `schema.sql` y `data.sql` y los restaura con `psql --single-transaction --variable ON_ERROR_STOP=1`.
- [Backups de base](https://supabase.com/docs/guides/platform/backups): el backup de base solo conserva metadatos de Storage; los objetos deben respaldarse aparte.
- [pg_restore de PostgreSQL](https://www.postgresql.org/docs/current/app-pgrestore.html): `pg_restore` acepta archivos de archivo no planos creados por `pg_dump`; los scripts SQL planos se cargan con `psql`.

No se encontró en el changelog un cambio que autorice omitir RLS, advisors o un restore real. La deprecación anunciada de claves legadas hacia final de 2026 hace necesario verificar la configuración remota de Functions antes de un corte; el único redeploy E01 conservó `verify_jwt=false` y corrigió CORS solo en staging.

## Herramientas y configuración comprobadas

| Elemento | Resultado comprobado | Consecuencia |
| --- | --- | --- |
| Node / npm | `v22.18.0` / `10.9.3` | Coincide con E00. |
| Supabase CLI | No está en `PATH`; `npx --yes supabase --version` devuelve `2.116.0`; CLI `2.117.0` disponible | Todos los comandos deben registrar que se ejecutan mediante `npx`; no se actualizó la herramienta. |
| Ayuda CLI | Se ejecutaron `supabase --help`, `db --help`, `migration --help`, `db advisors --help`, `migration list --help`, `db dump --help` y `functions --help` | La versión instalada expone `db query`, `db advisors`, `migration list`, `db dump` y Functions. |
| PostgreSQL clientes | `psql` y `pg_restore` no están en `PATH` | No puede seguirse ningún procedimiento de restore desde el host actual. |
| Docker | Binario `29.7.2`; `docker info` falla porque no existe el socket/daemon | Tampoco se pudo usar un cliente PostgreSQL en contenedor ni crear una base aislada. |
| Workflow de esquema | `supabase/config.toml` tiene `schema_paths = []` y migraciones habilitadas | Proyecto imperativo, cinco archivos SQL locales. |
| Versión PostgreSQL | Config local: major 17. Proyecto listado: engine 17, `17.6.1.127` | Solo hay compatibilidad de versión mayor; no valida el contenido del esquema. |
| Auth local | Registro habilitado; `enable_confirmations=false`; redirect local `/auth/reset` | Contradice la afirmación histórica de confirmación remota activa; el remoto no se comprobó. |
| Functions locales | `inspect-release-source`: `verify_jwt=true`; `login-with-username`: `verify_jwt=false` | La primera espera usuario; la segunda usa comprobación propia y servicio privilegiado. Despliegue/config remotos no verificados. |
| Flags de cliente | Existen `VITE_CATALOG_SOURCE` y `VITE_EDITORIAL_ENABLED`; los defaults documentados son `legacy` y `false` | La configuración de build de staging no fue identificada; “activable” no está demostrado. |

Discrepancia documental: `estado.md` primero registra que Supabase CLI no estaba en PATH y después afirma que CLI y `psql` estaban disponibles. El estado actual reproducible es: CLI solo mediante `npx`; `psql`/`pg_restore` ausentes.

## Primera pasada de identidad y estado remoto (histórica)

Comandos read-only ejecutados antes de declarar la ambigüedad:

```sh
npx supabase projects list --help
npx supabase projects list --output json
tr -d '\r\n' < supabase/.temp/project-ref
# Se inspeccionaron solo refs/hosts derivados de .env y .env.local, sin imprimir valores.
```

Resultado saneado:

| Señal | Valor |
| --- | --- |
| Proyectos visibles | 1 |
| Ref/id | `ewntlvugbopokdrvnwvg` |
| Linked | `true` |
| Nombre | `Biblioteca` |
| Organización | `twmxxmbxdtmtcxdppweb` |
| Región / salud | `us-east-1` / `ACTIVE_HEALTHY` |
| Host DB | `db.ewntlvugbopokdrvnwvg.supabase.co` |
| `.temp/project-ref`, `.temp/linked-project.json`, pooler y refs derivadas | Coinciden con el mismo ref |
| Señal independiente “staging” | **Ausente** |

Que todas las configuraciones apunten al mismo proyecto prueba consistencia del enlace, no su función ambiental. “Es el único proyecto” no permite usarlo por descarte: podría ser producción. Esta es una condición de parada explícita de E01.

Estado de esa primera pasada:

| Comprobación E01 | Estado | Evidencia disponible |
| --- | --- | --- |
| Identidad inequívoca de staging | **FALLA** | Ref consistente, etiqueta/registro independiente ausente. |
| Migraciones local/remoto | **NO VERIFICADA** | No se ejecutó `migration list --linked`. |
| Esquema y drift | **NO VERIFICADO** | No se ejecutó SQL ni `db pull/diff`. |
| Auth: registro, confirmación, login, recovery | **NO VERIFICADO** | Solo configuración/código local. |
| Roles y cuentas de prueba | **NO VERIFICADO** | No se consultaron ni crearon usuarios. |
| RLS allow/deny real | **NO VERIFICADO** | Solo inventario estático. |
| Bucket/objetos/policies | **NO VERIFICADO** | Solo migración local. |
| Edge Functions desplegadas y secretos | **NO VERIFICADO** | Solo dos fuentes locales. |
| Advisors seguridad/rendimiento | **NO EJECUTADOS** | Requieren un destino confirmado. |
| Conteos canónicos/rechazos | **NO VERIFICADOS REMOTAMENTE** | Solo snapshot local histórico. |
| Backup fresco de staging | **NO GENERADO** | Destino ambiguo. |

## Inventario local de esquema, RLS y funciones (primera pasada)

Este inventario describe intención versionada; no afirma que exista remotamente.

### Migraciones

| Versión | Archivo | SHA-256 |
| --- | --- | --- |
| `20260830192747` | `create_canonical_catalog.sql` | `2dcfdadb341e61c1096bc801345da832eb58e288a7a7aacde45bcbd635a4c1cb` |
| `20260830193838` | `preserve_catalog_import_rejections.sql` | `dfe039507f7f791604a4b23741d6a1fe2ab394364e3a6d44af5d36ca4ea5b8ae` |
| `20260830202105` | `phase4_identity_profiles_and_stable_crate_items.sql` | `627824b703c9819f559d2c90b0e992ea463905df968d0ad17709d27ab0f17382` |
| `20260830213000` | `phase5_editorial_contributions.sql` | `a5ce054996c4eef92b3b7e721a6f1f5081619a87a67248af765b1ec172f6dda3` |
| `20260830233946` | `phase5_grant_editor_predicate.sql` | `f0743d9cb2510c2c9fd2d445bc30903ec6b60bb0f22684cfae06f4bbae8f41fd` |
| `20260914221226` | `normalize_phase4_phase5_acl_and_storage_rls.sql` | `3c36f1c8213f1d124ea39170f21393d8f3d9a868e6a2f45f6662b655aa8d134a` |

Los cinco archivos declaran 19 tablas nuevas (17 `public`, 2 `private`), habilitan RLS en esas 19 tablas, crean 29 policies, ocho funciones y una vista `public.catalog_releases` con `security_invoker=true`. Fase 4 además presupone las tablas preexistentes `profiles`, `crates` y `crate_items`; no hay una migración local que las cree desde cero. Por eso los cinco archivos por sí solos no son una cadena reproducible desde una base vacía.

Fase 4 declara `release_id` para crate items, trigger de compatibilidad de slug y ownership por `auth.uid()`. Fase 5 declara roles `admin`, `colaborador`, `comunidad`, contribuciones/eventos y el bucket privado `contribution-covers` (5 MiB; JPEG/PNG/WebP).

### Funciones privilegiadas locales

| Función | Seguridad | Exposición declarada | Estado real remoto |
| --- | --- | --- | --- |
| `public.handle_new_user()` | `SECURITY DEFINER`, `search_path=''` | Revocada a `PUBLIC`, `anon`, `authenticated`; uso esperado solo por trigger | No verificado |
| `private.is_editor()` | `SECURITY DEFINER`, `search_path=''` | Revocada inicialmente; la última migración concede `EXECUTE` a `authenticated`; esquema `private` sin `USAGE` cliente | No verificado; candidato a advisor 0029 |
| `private.is_admin()` | `SECURITY DEFINER`, `search_path=''` | Revocada; no es usada por `review_contribution` | No verificado |
| `public.record_contribution_event()` | `SECURITY DEFINER`, `search_path=''` | Revocada a roles cliente; trigger | No verificado |
| `public.review_contribution(uuid,text,text)` | `SECURITY DEFINER`, `search_path=''` | `EXECUTE` para `authenticated`, comprobación interna `is_editor()` | No verificado; endpoint privilegiado expreso |

Las otras tres funciones son `SECURITY INVOKER`: `private.import_catalog_release`, `private.record_catalog_import_rejection` y `public.set_crate_item_release_slug`.

### Hallazgos estáticos que impiden tratar el inventario como aceptado

1. **Aprobación/publicación por colaborador contradice el plan vigente.** `private.is_editor()` acepta `admin` o `colaborador`, y `public.review_contribution()` usa ese predicado para `approved`, creando un release publicado. La matriz normativa del plan reserva a admin la aprobación/publicación final de propuestas no administrativas. `private.is_admin()` existe, pero no protege esa transición.
2. **Policy de borrado Storage contradice su nombre/contrato.** `authors delete their pending contribution covers` solo comprueba bucket y `owner_id`; no relaciona la ruta con la contribución ni exige estado pendiente. Un propietario podría conservar permiso de borrado después de revisión/aprobación, según los datos locales.
3. **Roles visibles en perfiles.** Fase 4 concede `SELECT` de tabla completa `profiles` a `anon`/`authenticated`; Fase 5 añade allí la columna `role` sin reducir el grant. Si las cinco migraciones se aplican literalmente, el rol de cada perfil queda incluido en la lectura pública. El contrato vigente no documenta esta exposición.
4. **Función de login privilegiada no verificada.** `login-with-username` tiene `verify_jwt=false`, compara una clave pública en `apikey`, usa `SUPABASE_SERVICE_ROLE_KEY` para resolver el perfil/Auth y devuelve mensajes genéricos. Una clave pública identifica el cliente pero no limita quién puede invocarlo; no se verificaron rate limits, despliegue, logs ni comportamiento no enumerativo real.

En esa primera pasada no se propuso solución: los hallazgos exigían comprobar primero el esquema vivo y continuar E01 en Sol xhigh. La continuación y corrección autorizadas quedan documentadas más abajo.

## Catálogo y rechazos (primera pasada local)

Comprobación local ejecutada:

```sh
npm run import:catalog -- \
  --input ../discotica-backups/2026-08-30/catalogo-publicado.tsv \
  --allow-derived-keys --keep-invalid --dry-run
```

El comando termina con código 1 porque hay errores conocidos y no escribe datos. Resultado:

| Métrica | Resultado local |
| --- | ---: |
| SHA-256 | `22ab9cfce3495ec034d6b32584c087c72b4e15f892cd1bb9aaa70d762818b0ea` |
| Filas | 2.796 |
| Filas válidas potenciales | 2.790 |
| Rechazos | 6 |
| Claves derivadas | 2.796 |
| URLs inválidas advertidas | 10 |
| Artistas repetidos advertidos | 24 |

Los seis rechazos coinciden por fila/campo con el contrato: títulos vacíos en 681, 1273, 1369, 1515 y 2122; radar `sintetico` fuera de rango en 1445.

Esto **no** reproduce la carga canónica documentada: el archivo disponible no tiene columna `catalog_key`, mientras `estado.md` describe otro TSV con claves editoriales, hash `eb40f9612a3fb41c5e340c90a26f1eab41afcadc4eb7824895809d5f4725f54d`, `derivedKeys: 0` y resultado remoto 2.790/6. Ese snapshot no está disponible en `../discotica-backups/2026-08-30/` y los conteos remotos no se consultaron. El JSON de referencia separado sí conserva 622 registros y SHA-256 `d9ffdb6d9a4f637dd3676e4445375dc0ae9fd647d4653cb2f7b30818edc6422f`; no debe mezclarse con el TSV.

## Backup y restore histórico 2026-08-30

Archivos externos disponibles:

| Archivo | Formato | SHA-256 actual |
| --- | --- | --- |
| `roles.sql` | SQL plano ASCII | `a1c56b013dd585348059d79aaefeea3433b17442acf5a8af321b366d84187840` |
| `schema.sql` | SQL plano ASCII | `8f2034d3b78698c36ec3491f1c5cbe273914247ea43dca1264f44c66671a1adf` |
| `data.sql` | SQL plano UTF-8 | `d028fa548b3e5f9af12a4b22f4cb5ad892565a1b279588f68ae52e3803aa6389` |
| `catalogo-publicado.tsv` | TSV UTF-8/CRLF | `22ab9cfce3495ec034d6b32584c087c72b4e15f892cd1bb9aaa70d762818b0ea` |

Desde la raíz del repositorio, este comando valida correctamente las cuatro rutas y hashes del manifiesto principal:

```sh
shasum -a 256 -c ../discotica-backups/2026-08-30/SHA256SUMS
```

Resultado: cuatro `OK`. El cwd forma parte del contrato porque las rutas están escritas como `../discotica-backups/...`.

Hay un segundo manifiesto, `SHA256SUMS.sql`, que contradice los archivos actuales: registra el hash SHA-256 de archivo vacío para `roles.sql` y `schema.sql`, y un hash diferente para `data.sql`. No es utilizable como prueba de integridad de este conjunto.

El simulacro no se pudo considerar ejecutado ni exitoso:

- `operacion-fase-6.md` ordena restaurar “el dump lógico” con `pg_restore --clean --if-exists --no-owner`, pero no existe un archivo archive/custom/directory; existen tres scripts SQL planos. La herramienta correcta para este formato, según PostgreSQL y Supabase, es `psql`.
- El host no tiene `psql`/`pg_restore`, y Docker no tiene daemon disponible.
- `schema.sql` presupone roles/esquemas/extensiones administrados por Supabase; `data.sql` incluye tablas de `auth`/`storage`. Una base PostgreSQL vacía genérica no reproduce por sí sola ese entorno.
- El backup es de Fase 1: su esquema contiene `profiles`, `crates` y `crate_items`, pero no catálogo canónico, contribuciones, roles de Fase 5 ni el bucket/objetos requeridos. Aunque se restaurara, no demostraría recuperación del staging que E01 exige.
- No hubo segunda persona para verificar acceso y firmar el simulacro.
- La documentación oficial recuerda que los objetos binarios de Storage no están en el backup de base; no existe export/manifiesto de objetos de staging en el conjunto disponible.

Conclusión de recuperación: los bytes históricos disponibles tienen integridad demostrable mediante el manifiesto principal, pero **no hay capacidad de recuperación actual demostrada**.

## Pruebas ejecutadas en la primera pasada

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 7/7; no prueba RLS ni remoto |
| `node scripts/audit-catalog.mjs` | PASS de ejecución; JSON local 622, hash esperado, 0 radar inválido |
| Importador con TSV histórico, `--allow-derived-keys --keep-invalid --dry-run` | Código 1 esperado por seis rechazos; 2.796 filas, 2.790 válidas potenciales, 2.796 claves derivadas |
| `shasum -a 256 -c .../SHA256SUMS` | PASS, 4/4 |
| `docker info --format '{{.ServerVersion}}'` | FAIL, daemon/socket no disponible |
| `psql --version`; `pg_restore --version` | FAIL, comandos ausentes |

No se ejecutó build/browser porque E01 quedó detenida antes de cualquier cambio de producto y E00 ya registra ambos verdes. No se ejecutaron tests remotos por rol.

## Continuación xhigh sobre staging confirmado

Una autorización humana posterior identificó de forma explícita el nuevo proyecto `hgocyrzhgohetfpzbmfs` como staging y prohibió modificar el origen `ewntlvugbopokdrvnwvg`. `projects list` muestra `Biblioteca Staging`, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166` en `us-east-1`. La dirección devuelta por `inet_server_addr()` fue la misma resolución AAAA de `db.hgocyrzhgohetfpzbmfs.supabase.co`, segunda señal técnica de destino. Todos los comandos SQL usaron simultáneamente `--linked --project-ref hgocyrzhgohetfpzbmfs`; el enlace principal antiguo no se cambió.

### Preestado remoto reproducido

Las cinco migraciones locales iniciales coincidían literalmente con las cinco versiones remotas. Sin embargo, el esquema vivo no coincidía con sus privilegios efectivos:

- `releases=2790`, publicados `2790`, `catalog_import_keys=2790` y `catalog_import_rejections=6`;
- un perfil `admin`, una contribución, dos eventos y cero objetos en `contribution-covers`;
- cero policies sobre `storage.objects`, aunque Fase 5 declaraba tres;
- `anon` y `authenticated` tenían `EXECUTE` sobre `handle_new_user`, `record_contribution_event` y `review_contribution`; `set_crate_item_release_slug` también conservaba grants cliente no previstos;
- el default ACL de `postgres` en `public` concedía DML completo sobre tablas/secuencias y EXECUTE sobre funciones a `anon`/`authenticated`;
- esos grants daban a `authenticated` UPDATE de tabla y de columna sobre `profiles.role`, mientras la policy solo exigía que el perfil fuera propio.

La explotabilidad se confirmó sin dejar cambios:

```sql
begin;
-- Se rebajó temporalmente el único perfil a comunidad como postgres,
-- se fijó request.jwt.claim.sub al mismo id y se usó SET LOCAL ROLE authenticated.
update public.profiles set role = 'admin' where id = (select auth.uid());
rollback;
```

El UPDATE devolvió `authenticated_self_escalation_succeeded=true`; una consulta posterior confirmó de nuevo un único perfil `admin`. No se reproduce el UUID.

Los advisors previos mostraron cuatro `INFO` fail-closed, seis `WARN` de funciones `SECURITY DEFINER` ejecutables por cliente y un `WARN` de leaked-password protection. Rendimiento mostró siete foreign keys sin índice y once índices sin uso, todos `INFO`.

### Backup fresco y restore aislado

El expediente externo `../discotica-backups/2026-09-14-current/` contiene un backup lógico fresco del origen autorizado solo para lectura: `roles.sql`, `schema.sql`, `data.sql`, esquema/datos de `supabase_migrations`, fuentes/configuración locales y un manifiesto SHA-256. El password de staging está separado, con permisos de usuario, y excluido del manifiesto y de esta documentación.

El restore se ejecutó sobre el proyecto independiente `Biblioteca Staging` usando `psql` dentro de Docker, una sola transacción y `ON_ERROR_STOP=1`. La copia `restore/roles.sql` comenta únicamente el `ALTER ROLE supabase_admin` que el procedimiento oficial documenta como incompatible con el destino administrado. Datos, esquema e historial restaurados coincidieron en los conteos: 2.790 releases, seis rechazos, 1/1 Auth/perfil, 1/1 crates/items, 1/2 contribuciones/eventos y bucket/objetos 1/0.

La primera comparación post-restore detectó el drift de policies/ACL documentado arriba; por eso el restore no se declaró equivalente antes de corregir. Los dumps son un corte previo a E01: reproducir el staging actual exige restaurarlos y aplicar después `20260914221226` y `20260915173322`. El archivo externo `supabase-source-post-e01.tar.gz` conserva ambas migraciones además de configuración y Functions. Falta aún la firma de la segunda persona requerida por el plan.

### Migración correctiva única

Se generó con:

```sh
npx --no-install supabase migration new normalize_phase4_phase5_acl_and_storage_rls
```

Archivo: `supabase/migrations/20260914221226_normalize_phase4_phase5_acl_and_storage_rls.sql`.

La migración normaliza todos los ACL de relaciones, la secuencia y las ocho funciones de aplicación conforme a los grants versionados; cierra UPDATE de `profiles.role`; corrige los defaults de objetos creados por `postgres` en `public`; exige `private.is_admin()` para las tres acciones actuales de `review_contribution`; y crea las policies Storage con bucket, ruta exacta `uid/contribution_id/archivo`, contribución/autor/owner y estados editables `draft|changes_requested`.

No se alteraron los defaults de `supabase_admin`: `postgres` no es miembro de ese rol, ningún objeto de aplicación inventariado le pertenece y el único revoke capaz de retirar el grant implícito a `PUBLIC` sería global, con impacto potencial sobre esquemas gestionados. Los objetos de aplicación y las migraciones de este repositorio son propiedad de `postgres`; sus defaults sí quedaron sin grants automáticos cliente y conservan `service_role`.

El preflight ejecutó el contenido exacto del archivo dentro de `BEGIN`/`ROLLBACK`. Dos primeros intentos validaron el DDL pero demostraron que `storage.protect_delete` prohíbe DELETE SQL directo incluso para filas permitidas; no se desactivó esa protección. El ensayo final probó el predicado DELETE con fixtures transaccionales y terminó verde. Después, `db push --dry-run --skip-vault` enumeró solo `20260914221226`; `db push --skip-vault` aplicó únicamente esa versión a staging.

### Verificación post-migración

`migration list` muestra seis versiones locales/remotas coincidentes, incluida `20260914221226`. `db lint --level warning` devuelve `No schema errors found`.

| Operación | Allow comprobado | Deny comprobado |
| --- | --- | --- |
| Catálogo como `anon` | SELECT de 2.790 releases | INSERT |
| Perfil propio autenticado | UPDATE de `display_name` | UPDATE de `role` y `username` |
| Contribución propia | INSERT de borrador | UPDATE de `reviewed_by` |
| Review | admin pasa el gate y luego falla por UUID inexistente | colaborador recibe `42501` antes del lookup |
| Storage INSERT | autor en `draft` y `changes_requested` | `pending`, contribución inexistente y ruta profunda |
| Storage SELECT | propietario verificado; editor | comunidad no propietaria |
| Storage DELETE | predicado verdadero para autor/owner en estado editable | `pending` y editor no propietario |

Las pruebas usaron el único perfil cambiando su rol solo dentro de la transacción y UUIDs fixture reservados. El rollback final dejó cero contribuciones y cero objetos fixture. DELETE no se ejecutó físicamente por SQL: el trigger gestionado exige Storage API, de modo que falta aún esa prueba end-to-end con una sesión real.

Inventario efectivo después de aplicar:

- las 13 tablas públicas del catálogo y la vista: solo SELECT para `anon`/`authenticated`;
- `catalog_import_keys` y `catalog_import_rejections`: sin privilegios cliente;
- `profiles`, crates, crate items, contribuciones y eventos: grants exactos de Fases 4–5; `contribution_events_id_seq` sin acceso cliente;
- `authenticated` solo ejecuta `private.is_editor()` y `public.review_contribution(...)`; `anon` no ejecuta ninguna función de aplicación; `review_contribution` contiene `is_admin` y no `is_editor`;
- tres policies Storage efectivas: INSERT, SELECT y DELETE `authors delete editable contribution covers`;
- conteos intactos: 2.790 releases/publicados, 2.790 claves, seis rechazos, un perfil admin, una contribución, dos eventos y cero objetos.

Advisor de seguridad posterior: cuatro `INFO` por tablas deliberadamente sin policy, un `WARN` por el RPC `review_contribution` autenticado —contrato expreso y ahora fail-closed por admin— y un `WARN` de leaked-password protection deshabilitada. Desaparecieron los cinco avisos adicionales de funciones. No hay `ERROR` ni crítico. Advisor de rendimiento con nivel `WARN`: cero hallazgos.

`npm test` pasa 7/7 después de la migración.

### Cierre técnico con sesiones reales — 2026-09-15

El primer smoke Auth creó un usuario no confirmado y confirmó el OTP, pero el perfil no apareció. La inspección read-only mostró que `public.handle_new_user()` era byte a byte equivalente en origen y staging, seguía como `SECURITY DEFINER`, `search_path=''`, owner `postgres`, sin `EXECUTE` para `PUBLIC`/`anon`/`authenticated`; la diferencia era exclusivamente el trigger no interno `on_auth_user_created`, presente en origen y ausente en staging.

Se generó mediante `npx --no-install supabase migration new restore_auth_profile_trigger` la migración `20260915173322_restore_auth_profile_trigger.sql`. La migración aborta si no encuentra la función endurecida, vuelve a revocar acceso cliente y recrea idempotentemente el trigger `AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()`. El preflight exacto dentro de `BEGIN`/`ROLLBACK` terminó verde y dejó el trigger ausente; el dry-run enumeró solo `20260915173322`; el push lo aplicó únicamente a staging. La inspección posterior devuelve la misma definición de trigger que el origen y conserva todos los denies de `EXECUTE` cliente.

`node scripts/e01-staging-smoke.mjs` terminó con código 0: 31/31 checks reales verdes, cuatro usuarios temporales y cleanup sin errores. Comprobó:

- creación Auth no confirmada, rechazo de login previo, confirmación OTP y creación automática del perfil comunidad;
- login por email, recovery token real, cambio de contraseña, rechazo de la anterior y acceso con la nueva;
- login por username con publishable key y respuesta idéntica `401 / Invalid credentials` para username existente con password incorrecto y username inexistente;
- sesiones separadas de comunidad, colaborador y admin; autoascenso de `profiles.role` denegado y actualización de campo seguro permitida;
- crate privado oculto, crate público visible, escritura por `release_id` y writes ajenos denegados;
- contribución ajena oculta para comunidad, cola visible a colaborador, columnas privilegiadas denegadas, review de colaborador `42501` y review admin permitida;
- upload/read/delete por Storage API, lectura ajena denegada, lectura editorial permitida, rutas profundas y operaciones en `pending` denegadas. El DELETE editable devolvió una fila eliminada y el listado privilegiado confirmó cero objetos; un download inmediato todavía obtuvo la copia cacheada y se registró como diagnóstico, no como existencia autoritativa.

Los emails fixture no se enviaron. Dos probes previos de `/auth/v1/recover` y signup público devolvieron primero rechazo del destinatario `example.com` y después `429` al agotar el límite integrado. La documentación oficial confirma que, sin SMTP personalizado, solo se permiten destinatarios del equipo y dos mensajes por hora. Por ello signup/confirmación/recovery quedaron comprobados mediante links/tokens reales generados por Auth, pero la entrega a inbox sigue siendo un gate operativo explícito. La pantalla de recovery no expone la respuesta del servidor y siempre presenta el mismo mensaje genérico; el endpoint de username sí quedó probado como no enumerativo.

El build de staging se ejecutó con URL del proyecto, `VITE_CATALOG_SOURCE=canonical` y `VITE_EDITORIAL_ENABLED=true`: `npm run build` terminó con código 0 y `adapter-static` escribió `build/`. El suite histórico `npm run test:browser` falló 4/4 porque intercepta Google Sheets y espera tres fixtures legados incluso bajo el flag canonical; no fue un fallo remoto. El test específico `npx playwright test tests/browser/e01-staging-canonical.spec.ts` pasó 1/1: loader oculto, contador de 2.790, primer release/modal y gate Auth de `/editorial`. Los defaults versionados continúan `legacy` y `false`; no hubo despliegue ni cambio de producción.

La repetición final confirmó siete migraciones local/remoto, `db lint` sin errores, advisor de rendimiento sin `WARN`, advisor de seguridad sin críticos y los mismos cuatro `INFO`/dos `WARN` aceptados. Los conteos siguen 2.790 releases/publicados, 2.790 claves y seis rechazos. Quedaron cero usuarios, perfiles, crates, contribuciones u objetos fixture y exactamente un trigger de perfil.

### Incidencia del navegador en la entrega manual — 2026-09-15

La prueba con un inbox autorizado entregó correos reales y dejó dos cuentas recientes confirmadas en staging, sin sesión iniciada. El enlace llegó al navegador ya consumido; esto coincide con el prefetch documentado por Supabase. No se registraron emails, tokens ni UUIDs en la evidencia.

El navegador mostró además dos fallos independientes. El `pattern="[a-z0-9_-]{3,30}"` literal de Svelte interpolaba `{3,30}` y producía una expresión inválida; se sustituyó por un valor enlazado que conserva `[a-z0-9_\\-]{3,30}`. La Edge Function `login-with-username` permitía solo `apikey, authorization, content-type`, pero `supabase-js` envía también `x-client-info`; se reemplazó la lista manual por `corsHeaders` oficial del SDK y se desplegó solo esa función en staging como versión 2, manteniendo `verify_jwt=false`.

Verificación posterior: `deno check`, `npm test` 7/7 y build pasaron. Un preflight real devuelve `x-client-info` y los métodos estándar; una prueba desde Chromium confirmó patrón válido, respuesta genérica para credenciales inexistentes, cero errores CORS y cero errores de expresión regular. El propietario del inbox confirmó después login real, recepción del recovery y cambio de contraseña; la lectura remota corroboró una cuenta reciente confirmada con inicio de sesión. Repetir el envío con demasiada frecuencia produjo el `429` esperado de Auth.

## Estado de aceptación E01

| Criterio | Estado |
| --- | --- |
| Matriz por rol y operación con permitido/denegado real | **CUMPLE**: 31/31 checks con sesiones Auth y Storage API; cleanup cero. |
| Restore drill exitoso y firmado | **CUMPLE**: restore técnico exitoso; verificación independiente de Juan Herrea, 2026-09-15, checksums 10/10. |
| Fases 4–5 activables en staging mediante flags, no producción | **CUMPLE**: build canonical/editorial y browser específico verdes; defaults legacy/false intactos y sin despliegue. |
| Cero hallazgos críticos de advisors sin resolución | **CUMPLE**: cero `ERROR`/críticos; quedan dos `WARN` documentados. |
| Identidad de staging confirmada inequívocamente | **CUMPLE** |
| Catálogo 2.790 + seis rechazos confirmado contra remoto | **CUMPLE** |
| Entrega de email signup/recovery | **CUMPLE**: inbox autorizado, confirmación, login, recovery y cambio de contraseña comprobados; el `429` de reenvío frecuente es el rate limit esperado. |

**GO/NO-GO E02: GO.** La validación técnica de DB/Auth/RLS/Storage/build, la entrega real de correo y la verificación independiente del restore están completas. E02 queda habilitada para diseñar el contrato canónico v2 usando este inventario como entrada.

## Firma operativa y relevo a E02

Firma registrada:

- Revisor: Juan Herrea.
- Fecha: 2026-09-15.
- Resultado informado: acceso y comprobación ejecutados correctamente; checksums 10/10.
- Staging: `hgocyrzhgohetfpzbmfs`.

Relevo entregado a E02: identidad del proyecto, roles, esquema y siete migraciones comprobados; restore y checksum firmados; RLS/advisors documentados; catálogo 2.790/2.790/6 confirmado; diferencias históricas y correcciones E01 preservadas. No es necesario generar más correos ni repetir `/recover` para iniciar E02.

## Rollback de E01

Las migraciones aplicadas no deben borrarse ni retirarse del historial. Ante una regresión, desactivar catálogo canónico/editorial en el build de staging y crear otra migración correctiva revisada; no restaurar los grants inseguros, las policies contradictorias ni omitir el trigger de perfiles. El backup lógico previo permite recrear el corte de origen en otro destino aislado y luego aplicar las siete versiones conservadas en `supabase-source-post-e01.tar.gz`. El origen no requiere rollback porque nunca fue modificado.

## Anexo histórico — hallazgo que amplió el alcance

Después de crear y restaurar el proyecto aislado `hgocyrzhgohetfpzbmfs`, el usuario autorizó preparar una migración correctiva para las tres policies de Storage y el drift de `EXECUTE`. La inspección inmediatamente anterior descubrió un conflicto adicional de severidad crítica, por lo que esa iteración se detuvo antes de escribir SQL.

Consulta reproducible ejecutada únicamente contra staging:

```sql
select
  has_table_privilege('authenticated', 'public.profiles', 'update') as auth_update_table,
  has_column_privilege('authenticated', 'public.profiles', 'role', 'update') as auth_update_role_column,
  has_table_privilege('anon', 'public.profiles', 'update') as anon_update_table;
```

Los tres resultados fueron `true`. `public.profiles` conserva el ACL de tabla completo para `anon` y `authenticated`, y el default ACL del rol `postgres` en el esquema `public` concede `arwdDxtm` sobre tablas nuevas a ambos roles. Esto contradice Fase 4, que revocaba los permisos de tabla y concedía a `authenticated` solo `UPDATE (display_name, bio, newsletter_opt_in)`.

La policy `profile owners update safe fields` limita la fila por `id`, pero no limita columnas. Como Fase 5 agregó `profiles.role`, la combinación del grant de tabla y la policy deja disponible la columna de autorización del perfil propio. Endurecer `review_contribution()` a `private.is_admin()` sin normalizar primero estos ACL no cerraría la frontera de confianza.

El usuario autorizó después ese alcance mínimo. La migración `20260914221226` corrigió y verificó los ACL existentes, defaults de `postgres`, funciones y policies descritos en la sección de continuación. La prueba real posterior justificó `20260915173322` para restaurar el trigger omitido. El proyecto de origen no fue modificado y la firma independiente posterior cerró el último gate operativo.
