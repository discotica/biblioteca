# U3 — Colecciones: lenguaje y URLs (2026-10-06)

Etapa U3 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md). Claude Opus 5.5 (el plan asigna Sonnet 5.5), esfuerzo `high`. Sin commit, push, datos, despliegue ni producción.

Entrada: árbol de U2 sin cambios. La línea base visual **no** incluye U2: antes de editar, `visual:compare` dio exactamente las 24 diferencias que lista el [relevo de U2](./u2-saneamiento-2026-10-06.md#capturas-que-cambiaron). Para medir U3 por separado se capturó una referencia del árbol previo a U3 en `tests/visual/.ref-pre-u3/`, sin tocar `baseline/` (ver "Referencia temporal").

## Resultado

| Trabajo | Hecho |
| --- | --- |
| "Crate" fuera de la interfaz | Sí. 13 archivos de `src`. Lista abajo. |
| `/mis-colecciones` y `/coleccion/[slug]` | Sí. Son las rutas viejas movidas tal cual (`mis-crates/` → `mis-colecciones/`, `crate/` → `coleccion/`), con sus loaders. |
| Redirección de cliente | Sí. `/mis-crates` y `/crate/[slug]` montan `LegacyCollectionRedirect`, que hace `goto(…, { replaceState: true })` a la ruta nueva con `search` y `hash`. |
| 301 en `static/.htaccess` | Sí. Dos `RewriteRule` antes del fallback a `index.html`. El despliegue no cambia: `build/` ya copia `static/.htaccess`. |
| Enlaces internos y destinos de autenticación | Sí. Header (×2), tarjeta de colección, perfil, "Nueva colección" del menú de la ficha, login por defecto, `auth/reset` (×2) y el `redirect=` de `mis-colecciones/+page.ts`. Los correos de Supabase siguen yendo a `/auth/reset`, que después lleva a `/mis-colecciones`. |
| Tablas, columnas, stores y tipos | Sin cambios: `crates`, `crate_items`, `cratesStore`, `Crate`, `CrateItem`, `fetchReleasesForCrate`, nombres de componentes (`CrateCard`, `AddToCrateButton`, `CreateCrateModal`), clases CSS e ids. |

## Rutas nuevas y redirecciones

| Ruta vieja | Ruta nueva | Cliente (SvelteKit) | Servidor (Apache, 301) |
| --- | --- | --- | --- |
| `/mis-crates` y `/mis-crates/` | `/mis-colecciones` | `src/routes/mis-crates/+page.svelte` | `RewriteRule ^mis-crates/?$ /mis-colecciones [R=301,L]` |
| `/crate/<slug>` y `/crate/<slug>/` | `/coleccion/<slug>` | `src/routes/crate/[slug]/+page.svelte` | `RewriteRule ^crate/([^/]+)/?$ /coleccion/$1 [R=301,L]` |

- **Query:** se conserva en los dos lados (`?usuario=…`, `?crear=1`). Apache la añade sola porque la sustitución no lleva `?`.
- **Hash:** no llega al servidor. Tras el 301, el navegador lo conserva (verificado en Chromium). En el cliente se lee de `window.location` dentro de `onMount`, porque `load` no puede leer `url.hash`.
- **Historial:** la redirección de cliente usa `replaceState`, así que "atrás" no vuelve a `/crate/…`.
- **Regla única:** las dos implementaciones aplican el mismo patrón, definido en `src/lib/domain/collectionRoutes.ts` (función pura, con su prueba). `/crate`, `/crate/a/b`, `/mis-crates-x` y `/perfil/crate` no se redirigen.
- **Archivos nuevos:** `src/lib/domain/collectionRoutes.ts`, `src/lib/components/LegacyCollectionRedirect.svelte`, `src/routes/mis-crates/+page.svelte` y `src/routes/crate/[slug]/+page.svelte` (los dos stubs), `tests/collection-routes.test.mjs` y `tests/browser/u3-colecciones.spec.ts`.

## Textos cambiados por archivo

Al pasar de "el crate" a "la colección" cambia el género. Por eso también se ajustan los adjetivos y pronombres que concordaban con "crate": Público/Privado → Pública/Privada, "verlo" → "verla", "Crear uno" → "Crear una".

| Archivo | Antes → después |
| --- | --- |
| `lib/components/AddToCrateButton.svelte` | Botón y `title`: "Añadir a crate" → "Añadir a colección" · "No tienes crates aún." → "No tienes colecciones aún." · "Crear uno" → "Crear una" · "+ Nuevo crate" → "+ Nueva colección" · Avisos: "…para el crate." → "…para la colección.", "…del crate." → "…de la colección.", "…ya está en el crate." → "…ya está en la colección.", "…al crate." → "…a la colección." · Destino `/mis-crates?crear=1` → `/mis-colecciones?crear=1` |
| `lib/components/CreateCrateModal.svelte` | Título "Nuevo crate" → "Nueva colección" · Placeholder "¿Qué tiene este crate?" → "¿Qué tiene esta colección?" · Segmentado "Público/Privado" → "Pública/Privada" · Ayuda "…ver este crate con el link." / "Solo tú puedes verlo." → "…ver esta colección con el link." / "Solo tú puedes verla." · Botón "Crear crate" → **"Crear"** (ver "Capturas") · Error "No se pudo crear el crate." → "No se pudo crear la colección." |
| `lib/components/CrateCard.svelte` | Insignia "Público/Privado" → "Pública/Privada" · Enlace `/crate/…` → `/coleccion/…` |
| `lib/components/Header.svelte` | "Mis crates" → "Mis colecciones" (enlace de escritorio y menú) · Enlace `/mis-crates` → `/mis-colecciones` |
| `routes/mis-colecciones/+page.svelte` | `<title>` y h1 "Mis crates" → "Mis colecciones" · "+ Nuevo crate" → "+ Nueva colección" · "Cargando crates…" → "Cargando colecciones…" · "Todavía no creaste ningún crate." → "Todavía no creaste ninguna colección." · "Crear mi primer crate" → "Crear mi primera colección" |
| `routes/mis-colecciones/+page.ts` | Destino tras entrar: `redirect=/mis-crates` → `redirect=/mis-colecciones` |
| `routes/coleccion/[slug]/+page.svelte` | Migas "Crates" → "Colecciones" · Insignia "Público/Privado" → "Pública/Privada" · "Este crate está vacío." → "Esta colección está vacía." · `title` "Quitar de este crate" → "Quitar de esta colección" · `aria-label` "Quitar … del crate" → "Quitar … de la colección" |
| `routes/coleccion/[slug]/+page.ts` | Errores visibles en `+error.svelte`: "Debes iniciar sesión para ver este crate." → "…ver esta colección." · "Crate no encontrado." → "Colección no encontrada." · "Este crate es privado." → "Esta colección es privada." |
| `routes/perfil/[username]/+page.svelte` | "Crates públicos" → "Colecciones públicas" · "Este perfil no tiene crates públicos todavía." → "…no tiene colecciones públicas todavía." · Enlace `/crate/…` → `/coleccion/…` |
| `routes/auth/login/+page.svelte` | Destino por defecto `/mis-crates` → `/mis-colecciones` |
| `routes/auth/reset/+page.svelte` | Tras confirmar registro y tras nueva contraseña (×2): `/mis-crates` → `/mis-colecciones` |
| `routes/auth/registro/+page.svelte` | "…puedes entrar y crear tus crates." → "…crear tus colecciones." |
| `routes/privacidad/+page.svelte` | "**Crates** — las colecciones de lanzamientos que armes." → "**Colecciones** — las listas de lanzamientos que armes." · "**Items de crates** — los lanzamientos que agregas a cada crate." → "**Elementos de colecciones** — …a cada colección." · "…tu perfil y crates públicos cuando los marcas…" → "…tu perfil y tus colecciones públicas cuando las marcas…" |
| `routes/admin/catalogo/+page.svelte` | Diálogo de archivar: "Su identidad, crates e historial…" → "Su identidad, colecciones e historial…" |

Manual, bienvenida (`WelcomeBanner`), invitación beta (`BetaInvitation`), `lib/content/` y `LanzamientoModal` no contenían "crate".

### Lo que queda con "crate" en `src`

Búsqueda `grep -rni crate src`, revisada línea a línea. Solo quedan:

- identificadores: imports, variables, tipos, funciones, nombres de componentes, clases CSS e ids (`create-crate-title`, `btn-add-crate`…);
- tablas y columnas: `from('crates')`, `crate_items`, `crate_id`;
- comentarios y mensajes de `console.error` para desarrollo, que no se muestran;
- **`cratesStore.ts:61`:** `slugify(nombre) || 'crate'`. Es el slug de reserva cuando el nombre no produce ninguno (por ejemplo, "!!!"), así que podría verse en una URL (`/coleccion/crate`). No se cambió porque es un valor de datos que guarda el store y la etapa no toca datos. **Para U14 o D1:** pasar a `'coleccion'`.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | 67/67 (65 previas + 2 nuevas de `collection-routes`). |
| `npm run build` | Correcto. El manifiesto del cliente (`build/_app/immutable/entry/app.*.js`) contiene `/mis-colecciones` y `/coleccion/[slug]`, además de los stubs `/mis-crates` y `/crate/[slug]`. `build/.htaccess` lleva las dos reglas 301. Con `adapter-static` y `fallback: 'index.html'` no hay HTML por ruta: es el comportamiento de siempre. |
| `.htaccess` con Apache 2.4.67 local sobre `build/` | `/mis-crates` → 301 `/mis-colecciones` · `/mis-crates/?crear=1` → 301 `/mis-colecciones?crear=1` · `/crate/para-abrir-el-set?usuario=comunidad` → 301 `/coleccion/para-abrir-el-set?usuario=comunidad` · `/crate/cumbia-%C3%A1cida/?usuario=dj&x=1` → 301 `/coleccion/cumbia-%c3%a1cida?usuario=dj&x=1` · `/crate/a%20b?usuario=x` → 301 `/coleccion/a%20b?usuario=x`. `/crate`, `/crate/a/b`, `/perfil/crate` y las rutas nuevas → 200 (SPA). |
| Hash tras el 301, en Chromium sobre ese Apache | `/crate/para-abrir-el-set?usuario=comunidad#u3` → `/coleccion/para-abrir-el-set?usuario=comunidad#u3` (301 → 200) · `/mis-crates?crear=1#nueva` → `/mis-colecciones?crear=1#nueva`. |
| `tests/browser/u3-colecciones.spec.ts` ×3 | 9/9. (1) Un enlace viejo de colección pública (`/crate/…?usuario=…#u3`) abre `/coleccion/…?usuario=…#u3` con el mismo texto que la visita directa: título, descripción, insignia, conteo y los dos lanzamientos, sin "crate"; "atrás" no vuelve a la URL vieja. (2) Con sesión, `/mis-crates?crear=1#nueva` → `/mis-colecciones?crear=1#nueva` con el diálogo "Nueva colección" abierto. (3) Sin sesión, `/mis-crates` → `/auth/login?redirect=/mis-colecciones`. |
| Pruebas que leían los textos viejos | Actualizadas: E14 (`catalogo.spec.ts`, "Mis colecciones"), E10 ("Colecciones públicas 0"), E16 y R1.3 ("Añadir a colección"). Pasan. |
| `npm run test:browser` completo | 108 pasan, 5 omitidas y 2 fallan: E17:198 (persistente y conocido) y E17:99 (intermitente bajo carga, ya explicado en U2). E17:99 aislada ×5: 5/5. |

## Capturas que cambiaron

`visual:compare` contra `baseline/`: 58 diferencias, que son las 24 de U2 más las de U3. Contra la referencia previa a U3 hay **49 diferencias, todas de texto**. Los IDs no cambiaron: `censo.spec.ts` y `global-setup.ts` solo cambian sus URLs a `/mis-colecciones` y `/coleccion/…`.

| Capturas | Motivo |
| --- | --- |
| `header-auth-D`, `header-auth-menu-M` y las que muestran el header con sesión: `admin-editor-D/T`, `admin-editor-top-D`, `admin-filters-D`, `admin-history-D`, `admin-list-D/T`, `admin-new-D`, `admin-norole-D`, `admin-selection-D`, `editorial-admin-D`, `editorial-colab-D`, `sugerir-D`, `sugerir-admin-D`, `sugerir-detected-D`, `reportar-D` | "Mis crates" → "Mis colecciones" en el header (~1.720 px cada una). El enlace es más ancho y desplaza un poco los vecinos. |
| `admin-publish-D` | Header, más el texto del diálogo de archivar. |
| `modal-*` (13 de escritorio y tablet), `debug-modal-overlap`, `modal-bottom-M`, `modal-mid-M`, `ficha-D`, `ficha-comp-D`, `modal-crate-D` | "Añadir a crate" → "Añadir a colección" (botón más ancho). En `modal-crate-D`, además, "+ Nueva colección" en el menú. |
| `ficha-M` | Mismo botón. **Reflujo:** a 390 px ya no cabe junto a "Comprar" y las acciones pasan de dos filas a tres. No se cambió el CSS: U9 rehace esa fila (una sola línea, con Compartir y Reportar solo como icono). |
| `miscrates-D`, `miscrates-empty-D` | Título, botón, insignias en femenino y vacío. |
| `miscrates-M` | Mismo cambio. **Reflujo:** a 390 px "Mis colecciones" y "+ Nueva colección" ya no caben en una línea, y el `flex-wrap` existente baja el botón bajo el título. |
| `crate-crear-D`, `crate-crear-M` | Diálogo: título, placeholder, segmentado, ayuda y botón. "Crear colección" se partía en dos líneas dentro del botón a 390 px. Se dejó en **"Crear"** (el título ya dice "Nueva colección") y queda en una línea. En `-M` la diferencia es grande porque cambió la página de fondo (`miscrates-M`). |
| `crate-D`, `crate-M` | Migas "Colecciones" e insignia "Pública". |
| `perfil-D`, `perfil-M` | "Colecciones públicas". |
| `privacidad-D` | Las tres líneas de datos. |
| `registro-success-D` | "…crear tus colecciones." |

No se cambió ningún token, regla CSS ni componente de diseño. Los tres reflujos (`ficha-M`, `miscrates-M` y el fondo de `crate-crear-M`) vienen solo de la longitud del texto, dentro de los layouts actuales.

## Referencia temporal y línea base

- **`baseline/` no se recapturó.** Recapturarla ahora aceptaría a la vez U2 y U3, y U2 sigue sin línea base propia. Al aceptar las dos, ejecutar `npm run visual:capture`.
- **Referencia previa a U3:** `tests/visual/.ref-pre-u3/darwin/` (131 PNG) y `tests/visual/playwright.ref.config.ts`, una config temporal que solo cambia `snapshotPathTemplate`. Sirven para repetir la comparación aislada de U3: `npx playwright test -c tests/visual/playwright.ref.config.ts --update-snapshots=none`. Están dentro del repo y no en el scratchpad, para que no se pierdan como la línea base de U1. **Se borran cuando se acepte U3 y se recapture `baseline/`.**

## Para U14 y U12

- **U14 (perfil, aportes y colecciones):**
  - Las vistas viven en `routes/mis-colecciones/` y `routes/coleccion/[slug]/`. No crees rutas nuevas para colecciones ni toques los stubs de `mis-crates/` y `crate/`.
  - Los componentes conservan nombres de código (`CrateCard`, `CreateCrateModal`, `AddToCrateButton`). Si U14 los reescribe, puede renombrarlos dentro de esos archivos sin tocar `cratesStore` ni los tipos.
  - Pendientes:
    - slug de reserva `'crate'` en `cratesStore.ts:61`;
    - el diálogo de crear sigue con mayúsculas y segmentado propio (hallazgo del censo);
    - el botón "Crear" se acortó por espacio; U14 puede volver a "Crear colección" si su diseño de diálogo lo admite;
    - la cabecera de Mis colecciones en móvil ya baja el botón bajo el título.
  - El enlace para compartir sigue saliendo de `window.location`, así que ya copia `/coleccion/…`.
- **U12 (cuenta):**
  - El destino tras entrar, tras confirmar el registro y tras nueva contraseña es `/mis-colecciones`. La decisión "al confirmar se llega a Mis colecciones con un aviso" ya tiene la ruta; falta el aviso.
  - `supabase/config.toml` no cambia: los correos apuntan a `/auth/reset`.
- **D1 (opcional):** `private.reserved_usernames` reserva `crate` y `mis-crates`. Los nombres de usuario viven bajo `/perfil/…`, así que no hay colisión con las rutas nuevas. Añadir `coleccion` y `mis-colecciones` sería solo por coherencia.
- **E22 / despliegue:** nada que cambiar. Cuando se publique, hay que comprobar en Hostinger que `mod_rewrite` responde 301 en `/crate/<slug>?usuario=<u>`. Si el hosting ignorara el `.htaccess`, la redirección de cliente cubre el caso (con 200 en lugar de 301).

## Rollback

Sin datos ni migraciones.

1. Borrar `src/routes/mis-crates/` y `src/routes/crate/` (los stubs).
2. Mover `src/routes/mis-colecciones/` a `mis-crates/` y `src/routes/coleccion/` a `crate/`.
3. Revertir los textos de la tabla.
4. Quitar las dos `RewriteRule` y su comentario de `static/.htaccess`.
5. Borrar `collectionRoutes.ts`, `LegacyCollectionRedirect.svelte`, `tests/collection-routes.test.mjs` y `tests/browser/u3-colecciones.spec.ts`, y quitar la prueba de `package.json`.
6. Devolver las URLs de `censo.spec.ts` y `global-setup.ts`, y los textos de las cuatro pruebas de navegador.

Si ya se publicó, no conviene revertir: los 301 permanentes quedan en la caché de los navegadores.
