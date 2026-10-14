# D1 — Datos de perfil y colecciones (2026-10-06)

Estado: **implementada y verificada solo en local. No está aplicada en staging ni en producción.** El bloqueo de backup de E21 sigue abierto ([`estado.md`](./estado.md)), así que la migración no se aplicó en staging. No hubo commit, push ni despliegue. No se construyó interfaz.

Ejecución: Claude Opus 5.5 (`claude-opus-5-5`), esfuerzo `high`. No hubo que escalar: el orden manual no tocó ninguna política existente y no se consultó staging, así que no pudo haber drift.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `supabase/migrations/20261006131054_d1_profile_social_and_collection_order.sql` | La migración. SHA-256 `34608d94ab4a39e9561ae78374dcfea8a2c000753aaff65e90b474a92670c482`. |
| `src/lib/domain/profileSocial.ts` | Formatos por red, normalización y URL pública. Puro, sin Supabase. |
| `src/lib/services/profiles.ts` | Lectura del perfil público, edición de redes y preferencia, metadatos de registro y aportes públicos. |
| `src/lib/stores/cratesStore.ts` | `CrateItem.position`, `obtenerItemsEnOrdenManual` y `reordenarItems`. |
| `tests/profile-social.test.mjs` | Unitarias del dominio (en `npm test`). |
| `tests/sql/d1-verify.sql` | RLS y contrato, transaccional; revierte todo. |
| `tests/sql/d1-concurrency.sh` | Altas y reordenamientos en paralelo; borra sus fixtures al salir. |
| `tests/sql/d1-rollback-verify.sql` | Cuerpo del rollback y su ensayo, transaccional. |
| `supabase/migrations/20260830000000_base_profiles_crates_pre_phase4.sql` | S5: base de la cadena; sustituyó a `tests/sql/local-bootstrap-pre-phase4.sql` (ver "Entorno local"). |
| `package.json` | `npm test` incluye `tests/profile-social.test.mjs`. |

## Contrato

Ninguna política existente de `profiles`, `crates`, `crate_items` ni `contributions` se creó, borró ni modificó. La migración no contiene `create/drop/alter policy`. `crates` y `crate_items` conservan sus nombres.

### 1. Redes en `profiles`

Columnas nuevas, todas `text null`. Se guarda el usuario normalizado: minúsculas, sin `@` y sin URL.

| Columna | Restricción | URL pública (cliente) |
| --- | --- | --- |
| `social_bandcamp` + `social_bandcamp_kind = 'fan'` | `^[a-z0-9_-]{1,64}$` | `https://bandcamp.com/<usuario>` |
| `social_bandcamp` + `social_bandcamp_kind = 'artist'` | ≤ 63, `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, distinto de `www` | `https://<subdominio>.bandcamp.com` |
| `social_soundcloud` | `^[a-z0-9_-]{3,25}$` | `https://soundcloud.com/<usuario>` |
| `social_instagram` | ≤ 30 y `^[a-z0-9_]+(\.[a-z0-9_]+)*$` | `https://www.instagram.com/<usuario>/` |
| `social_x` | `^[a-z0-9_]{1,15}$` | `https://x.com/<usuario>` |
| `social_facebook` | 5–50 y `^[a-z0-9]+(\.[a-z0-9]+)*$` | `https://www.facebook.com/<usuario>` |

- Las restricciones se llaman `profiles_social_<red>_format`. Un valor inválido falla con `23514`, y la cadena vacía también es inválida: el cliente envía `null` para quitar una red.
- **Bandcamp tiene dos formas:** página de fan (`bandcamp.com/usuario`) y página de artista (`artista.bandcamp.com`).
  - `social_bandcamp` guarda el nombre y `social_bandcamp_kind` (`fan` | `artist`) la forma.
  - `profiles_social_bandcamp_pair` exige que las dos columnas estén llenas o vacías a la vez.
  - `profiles_social_bandcamp_format` aplica el formato de cada forma.
  - `profiles_social_bandcamp_kind_check` limita los valores. Es redundante con la de formato, y se conserva para documentar el dominio en el esquema.
  - Un nombre suelto no dice de qué forma es, así que el cliente pide el enlace a la página de Bandcamp. Acepta `artista.bandcamp.com` con o sin `https://` (también un enlace a un álbum, de donde toma el subdominio) y `bandcamp.com/usuario`. No acepta dominios propios de artistas.
- **Lectura:** pública, por la política existente "profiles are publicly readable". Es intencional: las redes se muestran en el perfil ajeno.
- **Escritura:** `grant update (social_*, social_bandcamp_kind, show_accepted_contributions)` a `authenticated`, bajo la política existente "profile owners update safe fields" (solo el dueño). `username` y `role` siguen sin grant de escritura.
- **Registro:** `handle_new_user()` copia las claves opcionales `social_*` y `social_bandcamp_kind` de `raw_user_meta_data`. No normaliza: un formato inválido aborta el alta igual que un username inválido, y GoTrue responde un 500 genérico ("Database error saving new user"). U12 tiene que validar antes con `signupSocialMetadata`.
- El cliente replica los formatos en `profileSocial.ts`. Paridad comprobada: 246 casos (Bandcamp en sus dos formas), 0 discrepancias entre el cliente y la base.

### 2. Aportes aceptados en el perfil público

- **`profiles.show_accepted_contributions boolean not null default false`.** La escribe solo el dueño (mismo grant y política que las redes).
- **`public.get_public_accepted_contributions(p_profile_id uuid, p_limit integer default 50, p_offset integer default 0) returns table (release_id uuid, accepted_at timestamptz)`**
  - `SECURITY DEFINER`, `search_path = ''`, `stable`.
  - `EXECUTE` solo para `anon` y `authenticated`; revocado de `public`.
  - Devuelve únicamente los aportes `approved` de esa persona, si su perfil tiene la preferencia activa y el lanzamiento sigue `published`. Ordena por aceptación descendente.
  - `p_limit` se acota a 1–100 y `p_offset` a ≥ 0.
  - Nunca devuelve payload, notas del revisor, estados, borradores, rechazos ni pendientes.
- **`contributions` no cambia.** `anon` sigue sin grant. `authenticated` sigue viendo solo lo suyo, o la cola según su rol.
- **Por qué es definer:** es la única forma de que un anónimo lea dos columnas sin abrir la tabla. Abrir `contributions` con una política nueva expondría `reviewer_note` y `payload` a cualquier autenticado, que tiene `SELECT` a nivel de tabla.

### 3. Orden manual de colecciones

- **`crate_items.position integer not null`**
  - Restricción `crate_items_position_nonnegative` (`position >= 0`).
  - Unicidad `crate_items_crate_position_key unique (crate_id, position) deferrable initially immediate`: se valida al final de cada sentencia, no fila a fila, y eso permite permutar en una sola sentencia.
- **Backfill:** `row_number() over (partition by crate_id order by added_at, id) - 1`. El orden visible no cambia; los empates de `added_at` se resuelven por `id`.
- **Altas:** el trigger `set_crate_item_position` (`BEFORE INSERT`, `SECURITY INVOKER`) bloquea la fila de la colección (`for no key update`) y asigna `max + 1`. La posición que envíe el cliente se ignora.
- **Bajas:** no recompactan. Pueden quedar huecos; el orden relativo se mantiene.
- **Reordenar:** solo con `public.reorder_crate_items(p_crate_id uuid, p_item_ids uuid[]) returns setof public.crate_items`.
  - `SECURITY DEFINER`, `search_path = ''`; `EXECUTE` solo para `authenticated`.
  - Bloquea la colección y comprueba que quien llama sea el dueño. Una colección inexistente y una ajena devuelven el mismo `42501`, así que no revela colecciones privadas.
  - Exige la permutación completa: todos los ítems actuales, sin nulos ni repetidos.
  - Aplica las posiciones `0..n-1` en una sentencia y devuelve los ítems ordenados.
- **Sin escritura directa:** `authenticated` sigue sin `UPDATE` sobre `crate_items` (un `PATCH` de `position` falla con `42501`).
- **Concurrencia:** altas y reordenamientos de la misma colección se serializan en la fila de `crates`. Entre dos reordenamientos gana el último.

| Código | Cuándo |
| --- | --- |
| `42501` | No es dueño, la colección no existe, o la llamada es anónima. |
| `22023` | Lista con nulos o con IDs repetidos. |
| `40001` | La colección cambió desde que el cliente la leyó: faltan ítems o sobran. El cliente recarga y reintenta. |

## Uso desde el cliente (para U12 y U14)

**Despliegue:** hasta que la migración esté aplicada en el entorno, las columnas y RPC nuevas no existen. Las vistas actuales no llaman nada nuevo; U12 y U14 solo deben publicarse después de aplicar D1 en el entorno correspondiente. `obtenerItemsDeCrate` y `/coleccion/[slug]` siguen ordenando por `added_at` (mismo orden tras el backfill) hasta que U14 las cambie a `position`.

```ts
// U12 — registro con redes opcionales
import { signupSocialMetadata } from '$lib/services/profiles';

const social = signupSocialMetadata({
  instagram: form.instagram,   // acepta "@usuario", usuario o enlace
  bandcamp: form.bandcamp      // enlace: artista.bandcamp.com o bandcamp.com/usuario
});
if (!social.ok) { errores = social.errors; return; }          // { instagram?: 'El usuario de Instagram no es válido: …' }
// social.data incluye social_bandcamp y social_bandcamp_kind cuando hay Bandcamp
await supabase.auth.signUp({
  email, password,
  options: { data: { username, display_name, newsletter_opt_in, ...social.data } }
});
```

```ts
// U14 — perfil ajeno
import { loadPublicProfile, profileSocialLinks, loadPublicAcceptedContributions } from '$lib/services/profiles';

const perfil = await loadPublicProfile(params.username);       // null → 404
const redes = profileSocialLinks(perfil);                      // [{ network, label, handle, url }] para SocialLinks; Bandcamp según su forma
const aportes = await loadPublicAcceptedContributions(perfil.id, { limit: 24 });
// [{ release_id, accepted_at }]; [] si la persona no lo permite. Datos del lanzamiento: catálogo por ID.
```

```ts
// U14 — perfil propio
import { updateOwnSocialHandles, setShowAcceptedContributions } from '$lib/services/profiles';

const r = await updateOwnSocialHandles(userId, {
  soundcloud: 'https://soundcloud.com/mi-usuario',
  bandcamp: 'https://mi-artista.bandcamp.com',  // guarda nombre y forma; '' quita las dos
  facebook: ''
});
if (!r.ok) erroresPorRed = r.errors;                           // no escribe nada si alguna red es inválida
await setShowAcceptedContributions(userId, true);              // interruptor "Mostrar mis aportes aceptados"
```

```ts
// U14 — colección: leer y reordenar (solo el dueño)
import { obtenerItemsEnOrdenManual, reordenarItems } from '$lib/stores/cratesStore';

let items = await obtenerItemsEnOrdenManual(crate.id);
const r = await reordenarItems(crate.id, nuevoOrden.map((i) => i.id)); // la colección completa
if (r.ok) items = r.items;
else if (r.motivo === 'coleccion-cambio') items = await obtenerItemsEnOrdenManual(crate.id); // recargar y avisar
```

`agregarItem` no cambia: añade al final. El `23505` sigue significando "ya está en la colección", porque el bloqueo impide colisiones de posición (ver la prueba de control abajo).

## Pruebas

Las pruebas corrieron en un stack Supabase local (CLI 2.116.0, PostgreSQL `17.6.1.127`) con la cadena completa de migraciones más D1, aplicada desde cero con `db reset`.

| Prueba | Resultado |
| --- | --- |
| `tests/sql/d1-verify.sql` | **PASS** (`D1 verify: OK`). Cubre: alta con redes (incluido Bandcamp de artista) y alta inválida; formatos inválidos por red (16 casos); Bandcamp de fan y de artista, con 12 casos inválidos (pareja incompleta, forma desconocida, formato de la otra forma, guion en el borde, `www`, longitud); otra persona y `anon` no editan el perfil; `username` sin grant; preferencia apagada por defecto; anónimo sin aportes de un perfil que no lo permite; con preferencia, solo aprobados con lanzamiento publicado (excluye archivado, rechazado, borrador, pendiente y aportes ajenos); forma del resultado; paginación; `contributions` sin lectura directa para `anon` ni para otra persona; altas al final ignorando la posición enviada; alta múltiple; `PATCH` directo denegado; reordenar; `22023` y `40001`; compactación tras una baja; nadie reordena colecciones ajenas, públicas, privadas ni inexistentes, ni siendo anónimo; lectura de colecciones públicas y privadas sin cambios. |
| Mutaciones sobre `d1-verify.sql` | **8/8 detectadas.** Preferencia `true` por defecto, `UPDATE` abierto en `crate_items`, sin restricción de X, RPC que ignora la preferencia, RPC de reordenar vacía, RPC sin comprobar dueño, sin trigger de posición, política de lectura abierta. |
| Mutaciones de Bandcamp | **4/4 detectadas:** sin emparejamiento, formato único de fan, artista con guion bajo y sin grant de la forma. Quitar `profiles_social_bandcamp_kind_check` no se detecta porque la restricción de formato ya cubre ese caso (redundancia deliberada, ver arriba). |
| `tests/sql/d1-concurrency.sh` | **PASS.** Fase 1: 20 altas simultáneas, 0 errores, posiciones 0–19 sin duplicados. Fase 2: 12 reordenamientos, 6 altas y 3 bajas simultáneos; 5 reordenamientos aplicados, 7 rechazados con `40001` (esperado), 0 errores inesperados y 0 posiciones duplicadas. |
| Control negativo de concurrencia | Sin el bloqueo del trigger, la misma prueba **falla**: 23 `23505` en `crate_items_crate_position_key`. Con el bloqueo restaurado, PASS. |
| `tests/sql/d1-rollback-verify.sql` | **PASS** (`D1 rollback verify: OK`): quita columnas y funciones, los grants de `profiles` vuelven a los de Fase 4, siguen las 7 políticas de colecciones y el alta funciona. |
| API real (supabase-js → GoTrue/PostgREST local) | **PASS.** Bandcamp: alta con enlace de álbum de artista (`artist`, `https://mi-artista.bandcamp.com`), cambio a fan (`https://bandcamp.com/mi_fan`), `23514` al quitar solo la forma, y quitar las dos columnas. Resto: alta con redes, 500 genérico con red inválida, lectura anónima de redes, `23514` con formato inválido, 0 filas al editar un perfil ajeno, `[2,0,1]` tras reordenar, `40001`/`42501`/`42501`/`42501` (desactualizada/ajena/anónima/`PATCH`), `23505` en alta repetida, `[]` con preferencia apagada, `release_id, accepted_at` con preferencia encendida, `contributions` cerrada. |
| Paridad cliente/base de formatos | 246 casos, 0 discrepancias. |
| `npm test` | **74/74 PASS.** |
| `npm run build` | **PASS.** |
| `svelte-check` | Sin errores en el código de D1. Los errores restantes son preexistentes (`./$types` sin `svelte-kit sync`, tipos de Node en `tests/` y una importación con ruta absoluta de `cratesStore` en `tests/browser/e16-release-detail.spec.ts`). |

### Cambio posterior: nombres reservados (H8, S4, 2026-10-11)

La migración D1 añade `coleccion` y `mis-colecciones` a `private.reserved_usernames` (`on conflict do nothing`), porque U3 movió las rutas de `/crate` y `/mis-crates` a esas dos. Se editó el archivo y no se creó otra migración porque D1 no está aplicada en ningún entorno.

**Verificación pendiente:** no había stack local (el daemon de Docker no estaba activo). La tabla de arriba corresponde a la migración **antes** de este cambio. Falta repetir `d1-verify.sql`, `d1-concurrency.sh` y `d1-rollback-verify.sql` con la receta de "Entorno local", y comprobar que un alta con `username = 'coleccion'` o `'mis-colecciones'` falla con `Username unavailable.` Hasta entonces H8 queda escrito, no verificado.

## Advisors (local)

`npx supabase db advisors --local --type all --level info`, antes y después de D1, sobre la misma base:

- **Antes:** 59 hallazgos (2 `WARN`, 57 `INFO`, 0 `ERROR`).
- **Después:** 48–49 hallazgos según qué índices hayan usado las pruebas (2 `WARN`, el resto `INFO`, 0 `ERROR`).
- **Nuevos:** ninguno, también tras añadir Bandcamp de artista. Los que desaparecen son `unused_index` que las pruebas llegaron a usar.
- Los 2 `WARN` son preexistentes: `multiple_permissive_policies` en `contributions` y `contribution_events`.
- `supabase db lint --level warning`: sin errores.

**Esperado en staging:** el linter alojado incluye los avisos de funciones `SECURITY DEFINER` ejecutables que el CLI local no reportó. Se esperan dos `WARN` nuevos de esa familia, a aceptar como los de E06/E09:

- `get_public_accepted_contributions`, ejecutable por `anon` y `authenticated`. Mitigación: devuelve dos columnas filtradas por la preferencia y el estado.
- `reorder_crate_items`, ejecutable por `authenticated`. Mitigación: comprueba al dueño dentro de la función, con prueba negativa.

`set_crate_item_position` es invoker y sin `EXECUTE` para clientes.

## Rollback

Es una migración posterior; nunca se borra ni se edita la de D1. El cuerpo exacto está entre los marcadores `>>> D1 ROLLBACK` y `<<< D1 ROLLBACK` de [`tests/sql/d1-rollback-verify.sql`](../../tests/sql/d1-rollback-verify.sql), ensayado arriba.

```bash
npx supabase migration new d1_rollback_profile_social_and_collection_order
# pegar el bloque marcado; probar en local con db reset; revisar advisors
```

**Pérdida de datos:** redes (incluida la forma de Bandcamp), preferencia de aportes y orden manual. El orden visible vuelve a `added_at`. Antes de aplicarlo en un entorno con datos reales, respaldar `profiles(social_*, social_bandcamp_kind, show_accepted_contributions)` y `crate_items(id, position)`.

**Orden de despliegue para revertir:** primero el frontend que ya no usa D1, después la migración de rollback.

## Entorno local

Actualización S5 (2026-10-11): la cadena de `supabase/migrations/` construye desde una base vacía. La migración base `20260830000000_base_profiles_crates_pre_phase4.sql` crea `profiles`, `crates` y `crate_items`, y E18 está corregida. Ya no hace falta copiar `supabase/` ni parchear nada.

1. **Stack aislado** (para no chocar con otra sesión): una carpeta de trabajo con un `config.toml` propio (`project_id` distinto y puertos 544xx) y `supabase/migrations` como enlace simbólico al directorio del repositorio.
2. **Parar con `--no-backup`**, para no dejar volúmenes.

```bash
W=$(mktemp -d); mkdir -p $W/supabase
ln -s $PWD/supabase/migrations $W/supabase/migrations
cp supabase/config.toml $W/supabase/   # editar project_id (p. ej. discotica-d1) y puertos 544xx
npx supabase start --workdir $W -x realtime,imgproxy,mailpit,studio,edge-runtime,logflare,vector,supavisor
docker exec -i supabase_db_discotica-d1 psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/d1-verify.sql
bash tests/sql/d1-concurrency.sh
docker exec -i supabase_db_discotica-d1 psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/d1-rollback-verify.sql
npx supabase db advisors --workdir $W --local --type all
npx supabase stop --workdir $W --no-backup
```

Histórico (D1, antes de S5): la cadena no construía desde cero y E18 se excluía de la copia temporal.

## Pendiente para staging (cuando E21 libere el backup)

1. Backup restaurable fresco de staging `hgocyrzhgohetfpzbmfs`.
2. Corregir E18 (otro chat) o decidir explícitamente el orden de aplicación.
3. Con `--project-ref hgocyrzhgohetfpzbmfs`, nunca `--linked`: comparar el `migration list` local y el remoto. Si aparece drift, detenerse y subir a `xhigh`.
4. Aplicar la migración y comprobar el backfill: mismo número de ítems y `count(distinct (crate_id, position)) = count(*)`.
5. Ejecutar `d1-verify.sql`, `d1-concurrency.sh` (con `PSQL` apuntando a staging; confirma fixtures temporales y los borra) y los advisors. Registrar los dos `WARN` esperados.
6. Actualizar este documento y `estado.md`.
