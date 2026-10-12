# Expediente E02 — contrato canónico v2

Fecha de ejecución: 2026-09-15 (America/Bogota)  
Etapa: E02 — Contrato canónico v2: créditos, tipos e identidad  
Estado: **completa en local aislado y staging; GO explícito para E03**  
Destino modificado: únicamente `Biblioteca Staging`, ref `hgocyrzhgohetfpzbmfs`  
Producción/origen `ewntlvugbopokdrvnwvg`: **sin cambios**

## Dictamen

E01 tenía GO explícito y staging estaba identificado por nombre, ref, dirección PostgreSQL, restore firmado y siete migraciones coincidentes. E02 añadió una única migración, creada mediante el CLI y aplicada después de un ensayo local aislado, un rollback transaccional y un preflight exacto contra staging:

```text
20260915204413_canonical_v2_credits_types_identity.sql
```

Los 2.790 UUID de release y sus slugs canónicos permanecieron estables. Los 435 releases que usaban `Disco` ahora apuntan al mismo registro renombrado `Álbum`; no se creó ningún release. Los 9.298 créditos existentes eran `primary`, de modo que no hubo reescritura de relaciones ni colisiones reales. La migración sí contiene y prueba el camino determinista para `featured`, `remixer`, `other`, duplicados entre grupos y posiciones coincidentes.

La fuente TSV no se modificó. El importador la interpreta mediante el contrato nuevo, conserva la fila cruda para diagnóstico y mantiene el tipo legado en la identidad derivada de primera carga para no cambiar una clave histórica por normalizar `Disco`.

## Documentación y guías consultadas

Se siguieron las habilidades locales `supabase` y `supabase-postgres-best-practices`, incluidas las reglas de constraints, tipos, FKs, RLS, privilegios e índices. También se consultó documentación oficial vigente:

- [Changelog de Supabase](https://supabase.com/changelog?types=breaking-change): no apareció un cambio de Database/RLS que invalide el diseño; los cambios recientes relevantes no afectan este contrato.
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): grants y policies son controles separados; las tablas expuestas y las vistas requieren pruebas allow/deny.
- [Flujo local](https://supabase.com/docs/guides/local-development/cli-workflows) y [migraciones](https://supabase.com/docs/guides/local-development/database-migrations): migración creada por CLI, `--project-ref` explícito, dry-run antes del push.
- [Seguridad de Data API](https://supabase.com/docs/guides/api/securing-your-api): el resolver y la vista son `security_invoker`; los logs permanecen en `private` sin grants cliente.

CLI usada: `2.116.0`; la versión `2.117.0` estaba anunciada como disponible, pero no se cambió tooling durante la etapa.

## Contrato exacto resultante

### Identidad de releases

- `public.releases.id` continúa como UUID inmutable y es la identidad de todas las relaciones.
- `private.import_catalog_release(jsonb)` localiza primero `(source_name, source_key)` en `catalog_import_keys`; una segunda importación actualiza el mismo UUID.
- El importador no actualiza `releases.slug` para una clave existente, aunque llegue otro slug en el payload.
- `crate_items.release_id` y `lanzamiento_slug` no cambiaron. La compatibilidad temporal de Fase 4 se conserva.
- No se modificaron ni eliminaron TSV, `artists`, aliases ni `lanzamiento_slug`.

### Créditos

`public.release_artists` acepta exactamente:

```text
role = primary | collaborator
PRIMARY KEY (release_id, artist_id)
UNIQUE (release_id, role, position)
CHECK (position >= 0)
```

La migración aplica estas reglas:

- `featured`, `remixer` y `other` pasan a `collaborator`.
- Si una persona estaba como principal y no principal, queda `primary`.
- Si repetía varios roles no principales, queda una relación `collaborator`.
- El orden se vuelve compacto por grupo; usa posición previa, precedencia técnica estable del rol legado y UUID solo para desempatar. Conserva la relación relativa dentro de cada rol legado sin inferir importancia editorial.
- Solo se eliminan relaciones no principales que deben transformarse. Las relaciones `primary` existentes no se reinsertaron.
- Cada relación modificada o colisionada se registra en `private.release_credit_migration_log`, con rol/posición anterior, resultado y motivo. La tabla tiene RLS, cero policies y cero grants cliente.

`public.releases.credit_quality` es obligatorio y acepta:

```text
legacy | proposed | verified
```

Los 2.790 registros quedaron `legacy`: “sin colaboradores” todavía no significa “auditado”. E02 no infirió colaboradores ni elevó calidad.

### Tipos

`public.release_types` contiene exactamente cinco filas y un constraint que impide otras combinaciones:

| Nombre | `normalized_name` | slug estable | Releases |
| --- | --- | --- | ---: |
| `Álbum` | `album` | `album` | 435 |
| `EP` | `ep` | `ep` | 1.218 |
| `Single` | `single` | `single` | 792 |
| `Compilado` | `compilado` | `compilado` | 339 |
| `Sample Pack` | `sample pack` | `sample-pack` | 6 |

`Disco`, `Album` y `Álbum` se resuelven como `Álbum`. Cualquier otro texto, incluido `Mixtape`, falla con error editorial antes de insertar. Un release `published` debe tener `release_type_id`.

La migración no borró trazabilidad: `private.release_type_migration_log` conserva por release el ID/nombre/slug anterior y el destino canónico. Hay 2.790 filas porque los cinco slugs hash legados cambiaron a slugs estables; 435 registran además el cambio visible `Disco` → `Álbum`.

### Aliases y resolución

`public.release_slug_aliases.alias_kind` acepta:

```text
migration | editorial_redirect
```

Se conserva `is_legacy` por compatibilidad y un constraint exige consistencia:

- `migration` ↔ `is_legacy = true`;
- `editorial_redirect` ↔ `is_legacy = false`.

Los 2.790 aliases actuales quedaron `migration`. Los 16 slugs ambiguos históricos siguen ambiguos y no se resolvieron al azar.

El contrato atómico de lectura es:

```sql
public.resolve_release_slug(text)
returns table (
  release_id uuid,
  canonical_slug text,
  match_kind text,
  alias_kind text
)
```

Prioridad:

1. slug canónico publicado;
2. un único alias visible a un release publicado;
3. cero filas para alias ambiguo, draft, archivado o inexistente.

`alias_kind` no rompe empates entre aliases. Inventar precedencia editorial frente a migración sería una decisión de producto no tomada; un redirect futuro debe evitar una colisión ambigua o recibir una decisión explícita.

La función es `SECURITY INVOKER`, tiene `search_path=''` y `EXECUTE` solo para `anon`/`authenticated` entre roles cliente.

### Vista pública

`public.catalog_releases` sigue siendo `security_invoker=true`, filtra `published` y mantiene intactas las primeras 17 columnas de compatibilidad:

```text
id, slug, title, release_date, type, label, review,
experimental, denso, sintetico, bailable, rapido,
artists, genres, countries, buy_link, cover
```

Añade al final:

```text
primary_artists jsonb
collaborators jsonb
credit_quality text
```

Cada elemento de los dos grupos tiene esta forma y orden por `position`, nombre e ID:

```json
{
  "id": "uuid",
  "slug": "artist-slug",
  "name": "Nombre editorial",
  "position": 0
}
```

`artists` continúa como lista JSON de nombres principales y se deriva de las mismas relaciones `primary`; ya no es la única fuente canónica.

### Escrituras

`scripts/import-catalog.mjs` ahora:

- emite `primary_artists`, `collaborators` y `credit_quality=legacy`;
- normaliza solo los cinco tipos permitidos;
- conserva el tipo crudo en la fila fuente y, para claves derivadas de primera carga, en la identidad histórica;
- rechaza que una persona aparezca en ambos grupos en vez de decidir por heurística;
- no crea tipos;
- no regenera UUID ni slug de un source key existente.

`private.import_catalog_release(jsonb)` acepta temporalmente `artists` si falta `primary_artists`, para payloads anteriores; las nuevas escrituras deben usar los grupos. El RPC editorial existente conserva su payload plano hasta E09, publica esos nombres como principales con calidad `legacy`, mapea `Disco`/`Album` y rechaza tipos desconocidos. No se añadieron estados, colas ni permisos de contribuciones.

## Conteos antes/después en staging

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Releases | 2.790 | 2.790 |
| Releases publicados | 2.790 | 2.790 |
| Claves de importación | 2.790 | 2.790 |
| Rechazos preservados | 6 | 6 |
| Relaciones de créditos | 9.298 | 9.298 |
| `primary` | 9.298 | 9.298 |
| `collaborator` | 0 | 0 |
| Tipos | 5 | 5 |
| Releases `Disco` / `Álbum` | 435 / 0 | 0 / 435 |
| Aliases | 2.790 | 2.790 |
| Aliases ambiguos | 16 | 16 |
| Colisiones alias ↔ slug canónico | 0 | 0 |
| Calidad `legacy` | columna ausente | 2.790 |
| Evidencia de migración de tipo | tabla ausente | 2.790 |
| Evidencia de migración de créditos | tabla ausente | 0 |

La única contribución existente conserva tipo `Compilado`; sus datos no se reescribieron.

## Verificación ejecutada

### Base local aislada

`supabase start` no puede reconstruir el repositorio desde cero porque la migración histórica de Fase 4 presupone `public.crates`, que no tiene migración base en esta cadena. E02 no corrigió ni reescribió historia.

Se inició Docker Desktop y se creó el contenedor aislado `discotica-e02-local` con la imagen Supabase PostgreSQL `17.6.1.127`. Se restauraron el esquema firmado de E01 y solo los datos `public` necesarios para catálogo; Auth/Storage del contenedor no coincidían con el dump y quedaron fuera de esta prueba de contrato. Conteos de entrada: 2.790 releases, 2.790 claves, seis rechazos y 9.298 créditos.

Comandos/resultados:

| Comando | Resultado |
| --- | --- |
| `npm test` | PASS, 10/10 |
| `DATABASE_URL=... node scripts/e02-verify.mjs` | PASS, 17 checks |
| migración exacta con `psql --single-transaction --variable ON_ERROR_STOP=1` | PASS |
| `supabase db lint --db-url ... --schema public,private --level warning --fail-on error` | `No schema errors found` |
| advisor local de seguridad `WARN` | cero hallazgos |
| advisor local de rendimiento `WARN` | cero hallazgos |

El verificador crea fixtures de los cuatro roles legados, persona en ambos grupos, duplicado entre roles colaboradores, orden por grupo, importación doble, tipo inválido, alias canónico colisionado, alias ambiguo y draft. Prueba lecturas como `anon`, escrituras denegadas y grants privados. Todo corre dentro de una transacción y termina en `ROLLBACK`.

Rollback local comprobado por conteos exactos:

```text
releases          2790 -> 2790
release_artists   9298 -> 9298
release_types        5 ->    5
aliases           2790 -> 2790
import_keys       2790 -> 2790
credit_quality    ausente después del rollback
```

### Staging

1. `db push --dry-run --skip-vault --project-ref hgocyrzhgohetfpzbmfs` enumeró solo `20260915204413`.
2. El archivo exacto se ejecutó dentro de `BEGIN`; assertions de conteos, constraints, logs, grants y vista pasaron; `ROLLBACK` devolvió el estado previo y `credit_quality` ausente.
3. `db push --skip-vault --project-ref hgocyrzhgohetfpzbmfs` aplicó solo E02.
4. `migration list` muestra ocho versiones locales/remotas coincidentes.
5. Fixtures transaccionales posteriores comprobaron y revirtieron:
   - importación `Disco`, reimportación `Album`, un UUID/slug/clave y dos grupos;
   - rechazo `Mixtape`;
   - aprobación editorial `Disco` → `Álbum` y rechazo editorial `Mixtape`;
   - canonical sobre alias colisionado;
   - alias ambiguo sin resolución;
   - draft oculto en tabla, vista y resolver;
   - INSERT denegado a `anon` y `authenticated`;
   - cero fixtures residuales.
6. `db lint`: sin errores.
7. Advisor de rendimiento a nivel `WARN`: cero hallazgos.
8. Advisor de seguridad: cero `ERROR`; permanecen los dos `WARN` aceptados de E01 (`review_contribution` como RPC `SECURITY DEFINER` con gate admin interno y leaked-password protection). Aparecen dos `INFO` nuevos por RLS sin policy en los logs privados: es fail-closed deliberado y además no tienen grants ni exposición cliente.

El dry-run del TSV histórico conserva exactamente 2.796 filas, 2.790 potencialmente válidas y los mismos seis rechazos. No apareció un séptimo rechazo por taxonomía.

## Rollback operativo comprobado

El rollback seguro no borra la migración aplicada ni ejecuta un “down” destructivo:

1. Desactivar catálogo canónico/editorial en el build de staging y pausar import/review.
2. Tomar un backup fresco del estado afectado.
3. Crear una migración compensatoria posterior. `private.release_type_migration_log` y `private.release_credit_migration_log` contienen el antes/después necesario para revertir los datos transformados sin cambiar `release_id`.
4. Validarla dentro de transacción contra una restauración aislada y solo después aplicarla.

La reversibilidad fue comprobada de dos formas: restauración local del backup E01 firmado y ejecución/rollback del archivo E02 tanto local como remotamente. El backup E01 no debe restaurarse ciegamente encima del staging actual porque Auth puede haber cambiado desde su corte; sirve para recuperación aislada y para validar la corrección compensatoria. En el estado de cierre no existen escrituras v2 persistentes posteriores a la migración, por lo que una compensación sigue siendo determinista. Todas las escrituras de prueba se revirtieron.

## Archivos E02

- `supabase/migrations/20260915204413_canonical_v2_credits_types_identity.sql`
- `scripts/import-catalog.mjs`
- `scripts/e02-verify.mjs`
- `tests/catalog-import.test.mjs`
- este expediente

No hubo cambios de UI, inferencia, consola ni flujo v2 de contribuciones. No hubo commit, push de Git, despliegue frontend ni operación sobre producción.

## Relevo

### E03 — dominio cliente y URLs

**GO/NO-GO E03: GO.** E02 satisface sus criterios de aceptación: la migración `20260915204413` está aplicada y verificada en staging, la forma pública compatible está documentada, los UUID/slugs canónicos se conservaron y el resolvedor tiene una prioridad determinista. E03 puede continuar sin esperar la auditoría editorial de créditos ni la resolución de los 16 aliases ambiguos, siempre que trate esos aliases como no resueltos y no cambie escrituras, RLS ni la semántica de aliases. Este GO no autoriza producción ni el corte gradual.

- Consumir `primary_artists` y `collaborators`; mantener `artists` solo como fallback temporal.
- Unificar `/?modal=[slug]` y `/lanzamiento/[slug]` sobre la misma política. Puede usar `resolve_release_slug(text)` para obtener prioridad atómica.
- Tratar cero filas del resolver como inexistente o ambiguo; no elegir entre los 16 aliases históricos.
- Mantener el slug recibido separado del UUID resuelto y usar `release_id` para relaciones/escrituras.

### E06 — mutaciones auditadas

- Toda mutación debe conservar `releases.id` y el slug canónico salvo redirect editorial explícito.
- Escribir créditos por `(release_id, artist_id)` con rol/posición; nunca recrear releases para corregir autoría.
- Mantener/elevar `credit_quality` de forma auditable. No marcar `verified` por automatismo.
- Para redirects permanentes usar `alias_kind=editorial_redirect` e `is_legacy=false`; prevenir colisiones ambiguas antes de guardar.
- Los logs privados de E02 son evidencia de migración, no una API de mutaciones.

### E09 — contribuciones v2

- Cambiar el payload plano `artists` a `primary_artists` y `collaborators` explícitos.
- Tipo obligatorio y confirmado por persona; los únicos valores son los cinco canónicos. Una sugerencia automática no equivale a confirmación.
- La publicación final debe buscar `release_types.slug`; no insertar diccionario.
- Mantener gate admin final y RLS de E01. E02 no añadió `ready_for_admin`, colas ni auto-revisión.

## Decisiones que permanecen pendientes

- Resolver editorialmente los 16 aliases de migración ambiguos o retirarlos antes del corte público; E02 preservó evidencia y se negó a adivinar.
- Auditar créditos: los 2.790 releases continúan `legacy` y los 9.298 créditos siguen principales porque E02 no infirió colaboradores.
- Si un redirect editorial futuro colisiona con otro alias, hace falta una decisión explícita; el contrato actual solo fija prioridad canónico > alias y unicidad del alias visible.
- La cadena local histórica sigue sin ser reproducible desde cero por la ausencia de migraciones base para `profiles`, `crates` y `crate_items`. No bloqueó E02 porque se usó el backup E01 firmado, pero debe corregirse en una etapa operativa autorizada, sin reescribir migraciones aplicadas.
