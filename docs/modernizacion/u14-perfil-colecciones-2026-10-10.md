# U14 — Perfil, aportes y colecciones (2026-10-10)

Etapa U14 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#u14--perfil-aportes-y-colecciones). Claude Opus 5.5, esfuerzo `high`, como asigna el plan. No hubo que escalar: ni el reordenamiento ni la visibilidad pública exponen datos nuevos (ver "Exposición de datos").

Estado: **implementada, pendiente de aceptación.** La línea base visual no se recapturó. Sin commit, push, despliegue, datos ni producción. El contrato de D1 no cambió.

## Condición de arranque

- **U3, U7 y U8 aceptadas** (`decisiones.md`, ronda 3).
- **D1:** implementada solo en local y sin aplicar en staging (`estado.md`: "U12 y U14 pueden programarse sobre este contrato, pero solo se publican después de aplicar D1"). Las vistas detectan su ausencia (`42703`) y se degradan sin fallar (ver "Sin D1 en el entorno").
- **U12 y U13 implementadas, sin aceptar.** Para aislar U14, el árbol de partida se capturó en `tests/visual/.ref-pre-u14/` (150 capturas).
- **Antes de editar:** `npm test` 122/122; `test:browser` 260 pasan, 5 omitidas, solo falla E17:202 (conocida).
- **Respaldos** de cada archivo sin versionar que se reescribió: `respaldos/*.pre-u14.*.txt` (14 archivos de `src` y 9 de pruebas). `tokens.css`, `profiles.ts` y `/cuenta` solo recibieron añadidos, descritos en "Rollback".

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. `/mis-aportes` | Página propia. Filas compactas: título, estado (Chip), fecha según el estado ("Guardado", "Enviado", "Revisado"), fuente, nota del equipo si existe y una acción como mucho, a la derecha y a tamaño normal en todos los anchos. Mismos estados y datos que la sección "Mis propuestas" del perfil, que desaparece. |
| 2. Perfil propio | Redes con SocialLinks y "Editar redes" / "Añadir tus redes" hacia `/cuenta#redes`. Interruptor "Mostrar mis aportes aceptados". Botones "Mis aportes" y "Editar cuenta". Acceso al Estudio para admin y colaborador (el de U7, sin cambios). |
| 3. Perfil ajeno | Colecciones públicas en mosaico, redes con SocialLinks y aportes aceptados solo si su dueño lo permite y hay alguno. |
| 4. Mis colecciones | Mosaico de 4 portadas y nombre; toda la pieza abre la colección. "…" con Compartir, Editar y Eliminar. Crear y editar en `Dialog`; eliminar con confirmación. |
| 5. Colección | Compartir, Editar y Eliminar como botones arriba (el visitante solo ve Compartir). ViewToggle grilla/lista recordado (`coleccion`). Sin notas visibles. Reordenar arrastrando desde el asa, solo el dueño, con `reorder_crate_items`. Carga solo sus lanzamientos, por ID. |

### Decisiones tomadas en la etapa

Ninguna sustituye una decisión de producto. Se registran para que U18 no las vuelva a inferir.

- **Las redes se editan en un solo sitio.** "Edición de redes" en el perfil propio es un enlace a la sección Redes de Editar cuenta (`/cuenta#redes`, la de U12), no un segundo formulario. Dos formularios sobre las mismas columnas se habrían desincronizado.
- **El interruptor vive en el perfil propio**, en la sección "Aportes aceptados", porque controla lo que esa sección muestra a los demás. Se guarda al momento; si falla, vuelve atrás con un aviso. Apagado, la sección dice "Solo tú ves esta sección".
- **`/mis-aportes` es el destino** del menú de cuenta, del perfil propio y de "Ver mis aportes" en Sugerir. El ancla `/perfil/…#mis-aportes` deja de existir.
- **Acciones de cada aporte:** borrador → "Retomar"; cambios solicitados → "Corregir"; aceptado y aún publicado → "Ver lanzamiento". Pendiente, listo para administración y rechazado no tienen acción. Cada acción lleva nombre accesible con el título ("Retomar: …").
- **Insignia de visibilidad:** solo se marca la privada ("Privada" en el mosaico; "Privada: solo tú la ves" en la colección). La pública es el caso normal.
- **Compartir una privada** está deshabilitado (botón y elemento del "…"), con el motivo en la ayuda: su enlace solo lo abre su dueño. El enlace sigue saliendo de `window.location.origin`, como desde U3.
- **Quitar un lanzamiento** ya no es una × sin vuelta atrás: quita al momento y ofrece "Deshacer", que lo vuelve a añadir (con su nota oculta) y lo recoloca en su posición con `reorder_crate_items`.
- **Editar no cambia el slug**, así que los enlaces compartidos siguen funcionando tras renombrar.
- **Paginación y orden:** la colección conserva la paginación de 12 de U10. Se reordena dentro de la página visible; el envío incluye la colección completa (D1). Mover entre páginas no es posible arrastrando.
- **Mosaico:** casillas vacías en `--color-superficie-1`; una colección vacía muestra el logo atenuado, como un lanzamiento sin portada.
- **Diálogo de crear:** "Crear colección" vuelve a caber (pendiente de U3), sin mayúsculas ni segmentado propio (hallazgo del censo). La visibilidad es un interruptor.
- **Slug de reserva** `'crate'` → `'coleccion'` en `cratesStore.ts` (pendiente de U3).

### Primitivas y tokens

- **`Checkbox variant="switch"`** (nuevo): `role="switch"`, pista y pulgar; la fila entera sigue siendo el área táctil. Prop nueva `hint` (línea de apoyo, en `aria-describedby`). Se usa en el perfil y en el diálogo de colección. En `/lab`, sección "Interruptor".
- **`Sortable`**: props nuevas `bare` (sin marco propio, para envolver tarjetas y filas completas) y `listClass` (la lista toma la disposición del anfitrión, p. ej. `lanzamientos-grilla`). Sin ellas, el comportamiento es el de U6. En `/lab`, sección "Sortable sin marco".
- **Tokens nuevos** (`tokens.css`, bloque "Colecciones y perfil (U14)"): `--mosaic-gap`, `--mosaic-min-w`, `--switch-w`, `--switch-h`, `--switch-inset`.
- **`FormSection`**: prop `id` (ancla `redes` en Editar cuenta).

## Archivos

| Archivo | Cambio |
| --- | --- |
| `src/routes/mis-aportes/+page.ts`, `+page.svelte` | Nuevos. Sin sesión → `/auth/login?redirect=/mis-aportes`. |
| `src/lib/domain/contributionRows.ts` | Nuevo, puro: tono, fecha y acción de cada fila. |
| `src/routes/perfil/[username]/+page.ts`, `+page.svelte` | Reescritos. |
| `src/routes/mis-colecciones/+page.svelte` | Reescrito (conserva los avisos de U12). |
| `src/routes/coleccion/[slug]/+page.ts`, `+page.svelte` | Loader con orden manual; página reescrita. |
| `src/lib/components/colecciones/` | Nuevos: `CollectionMosaic`, `CollectionTile`, `CollectionFormDialog`, `DeleteCollectionDialog`, `share.ts`. |
| `src/lib/components/CrateCard.svelte`, `CreateCrateModal.svelte` | **Borrados** (sin uso). Copias en `respaldos/`. |
| `src/lib/stores/cratesStore.ts` | Nuevas: `obtenerItemsOrdenados`, `portadasDeColecciones`, `lanzamientosDeItems`, `enlaceColeccion`, `PORTADAS_MOSAICO`. `actualizarCrate` acepta `description: null`. Slug de reserva. Las funciones de D1 no cambian. |
| `src/lib/services/profiles.ts` | Nueva `loadProfilePage` (perfil con respaldo sin D1). |
| `src/lib/ui/Checkbox.svelte`, `Sortable.svelte` | Extensiones descritas arriba. |
| `src/lib/styles/tokens.css` | Bloque U14. |
| `src/lib/components/account/FormSection.svelte`, `src/routes/cuenta/+page.svelte` | `id="redes"`. |
| `src/lib/components/Header.svelte`, `src/routes/sugerir/+page.svelte` | "Mis aportes" → `/mis-aportes`. |
| `src/routes/lab/+page.svelte` | Sección `.lab__u14`, al final para no desplazar las capturas de elemento de U6–U8. |
| `tests/browser/u14-perfil-colecciones.spec.ts` | Nueva (13 pruebas). |
| `tests/contribution-rows.test.mjs` | Nueva, en `npm test`. |
| `tests/browser/{e10-contributions,u7-shell,catalogo,u3-colecciones,u10-inicio,u12-cuenta}.spec.ts` | Leían la sección "Mis propuestas", `#mis-aportes`, la insignia "Pública", `.item-card` o el texto del vacío de Mis colecciones. Las dos de E10 pasan a `/mis-aportes`. |
| `tests/visual/support/{data,mocks}.ts`, `tests/visual/censo.spec.ts` | `position` en los ítems, ítems de la colección privada, perfil público con redes y preferencia, RPC de aportes públicos, lectura anónima de perfiles y colecciones públicas. 14 capturas suplementarias nuevas. |

## Sin D1 en el entorno

Hoy es el caso de staging. Nada falla:

- **Colección:** si `position` no existe (`42703`), ordena por `added_at` (el mismo orden que deja el backfill) y no muestra asas. Quitar y deshacer siguen.
- **Mosaicos:** igual, por fecha de alta.
- **Perfil:** si las columnas sociales no existen, lee lo demás; sin redes, sin "Editar redes" y sin sección de aportes. Las colecciones se ven.

El contrato de despliegue de D1 sigue en pie: U14 solo se publica después de aplicar D1 en el entorno.

## Exposición de datos

Revisado contra la condición de escalar del plan. No se detectó nada que no deba verse:

- **Reordenar** solo llama a `reorder_crate_items`, que comprueba al dueño en la base. La interfaz oculta las asas a quien no es dueño; aunque las forzara, la RPC responde `42501`.
- **Aportes públicos** solo por `get_public_accepted_contributions` (`release_id`, `accepted_at`). Los datos del lanzamiento salen del catálogo público por ID. `contributions` no se lee en ningún perfil ajeno.
- **Colecciones en el perfil:** la consulta pide `is_public = true` también en el perfil propio. Los mosaicos leen ítems solo de esas colecciones, y RLS no devuelve ítems de una privada ajena.
- **Notas de ítem:** no se pintan en ninguna vista. Siguen viajando en la lectura del dueño, como antes. En las colecciones públicas eran legibles antes de U14 por la misma política, y U14 no la cambió.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **125/125** (incluye `contribution-rows`, 3). |
| `npm run build` | OK. |
| `npm run lint:tokens` | OK: 156 archivos, 2 excepciones temporales (preexistentes). |
| `svelte-check` | Sin errores en los archivos de U14. Siguen los preexistentes (`./$types` sin sincronizar, `Menu.svelte:202`, tipos de Node en `tests/`). |
| `u14-perfil-colecciones.spec.ts` | **13/13; ×3, 39/39.** Ver la lista abajo. |
| Pruebas ajustadas (E10, U3, U5, U6, U7, U10, U12, E14) | 112/112. |
| `npm run test:browser`, pasada 1 | 272 pasan, 5 omitidas, 2 fallan: E17:202 (conocida, persistente) y E16:294 (intermitente conocida en arranque). |
| `npm run test:browser`, pasada 2 | 273 pasan, 5 omitidas, 1 falla: E17:202. |

Qué cubre `u14-perfil-colecciones.spec.ts`:

- **Dueño frente a visitante:** el dueño ve Compartir, Editar y Eliminar, 4 asas y 4 "Quitar"; el visitante, solo Compartir, sin asas ni "Quitar". La nota del ítem no aparece. Cada lectura de `catalog_releases` lleva `id=in.(…)`: nunca el catálogo completo.
- **Teclado:** ↓ y Fin sobre el asa envían la colección completa en el orden nuevo; el foco sigue al elemento; recargar trae el orden guardado.
- **Ratón:** arrastre en la grilla (1440) y en la lista; la vista lista se recuerda al recargar.
- **Táctil (390, toques reales por CDP):** arrastrar desde el asa reordena; deslizar fuera del asa desplaza la página y no reordena. Las tres acciones caben en una línea.
- **`40001`:** recarga el orden actual y avisa.
- **Quitar y deshacer:** vuelve a su posición (`reorder_crate_items` con el ítem nuevo en su sitio).
- **Editar y eliminar:** renombrar y pasar a privada; Compartir queda deshabilitado; eliminar confirma con el número de lanzamientos y lleva a Mis colecciones.
- **Sin D1:** colección por fecha y sin asas; perfil sin redes ni interruptor.
- **Mis colecciones:** mosaico de 4 portadas, "…" con Compartir, Editar y Eliminar; compartir copia `/coleccion/…?usuario=…`.
- **Perfil propio:** redes, "Editar redes" → `/cuenta#redes`, enlace a Mis aportes, sin Estudio para comunidad, interruptor que guarda `show_accepted_contributions` y muestra el aporte.
- **Perfil ajeno con aportes visibles y con aportes ocultos.**
- **`/mis-aportes` sin sesión** → Entrar con retorno.

## Visual

`VISUAL_BASELINE_DIR=.ref-pre-u14 npm run visual:compare`: 164 capturas, **12 distintas** y 14 nuevas sin línea base. Todas del alcance. Falla además "el censo conserva sus 127 IDs", que ya fallaba (130) desde U7.

| Capturas | Motivo |
| --- | --- |
| `perfil-D`, `perfil-M` | Redes, "Editar redes", botón "Mis aportes", colecciones en mosaico, sección "Aportes aceptados" con interruptor; sin "Mis propuestas". |
| `perfil-admin-D`, `perfil-colab-M` | Lo mismo, con el Estudio (sin cambios) y "Añadir tus redes". |
| `miscrates-D`, `miscrates-M`, `miscrates-confirmada-D` | Mosaicos con "…" en lugar de tarjetas de texto. |
| `miscrates-empty-D` | `EmptyState` del sistema. |
| `crate-crear-D`, `crate-crear-M` | Diálogo nuevo (`Dialog`, interruptor, "Crear colección") sobre la página nueva. |
| `crate-D`, `crate-M` | Acciones arriba, selector de vista, asas y "Quitar"; sin insignia "Pública". |
| Nuevas (suplementarias) | `aportes-D/M`, `aportes-anon-D`, `perfil-visitante-D/M`, `perfil-oculto-D`, `miscrates-T`, `miscrates-menu-D`, `crate-T`, `crate-lista-D/M`, `crate-visitante-D/M`, `crate-editar-D`. |

`lab-D/M` no cambian (la sección nueva queda por debajo del pliegue) y tampoco las capturas de elemento de U6–U8.

Capturas de entrega en [`capturas-u14/`](./capturas-u14/) (27).

**Al aceptar:**

1. `npm run visual:capture` (pasará a 164 capturas).
2. Borrar `tests/visual/.ref-pre-u14/`.

## Comprobaciones manuales pendientes

1. **Con D1 aplicada en staging:** reordenar con la cuenta de QA (ratón y dedo), interruptor de aportes y perfil visto sin sesión. Hoy staging no tiene D1, así que allí se ve el modo degradado.
2. **iPhone real:** arrastre desde el asa en la lista y en la grilla, y que deslizar fuera del asa desplace la página.
3. **VoiceOver:** anuncios del ordenable, interruptor ("activado"/"desactivado") y "Deshacer".

## Riesgos y deuda

- **Reordenar entre páginas** no es posible arrastrando (12 por página). Si las colecciones crecen, una vista "Ordenar" sin paginar, o "Mover al principio/final" en el ordenable, lo resolverían.
- **Perfil a perfil:** navegar de un perfil a otro reutiliza el componente (SvelteKit); el estado de dueño y los mosaicos se recalculan al montar. Era igual antes de U14.
- **`lanzamientosDeItems`** resuelve uno a uno los ítems legados sin `release_id`. En staging todas las colecciones migradas tienen `release_id` (E03); si hubiera muchos legados, sería lento.

## Para U18

- La matriz de U14 está en `u14-perfil-colecciones.spec.ts` y en las capturas suplementarias.
- Los pendientes manuales de arriba, sobre todo los que dependen de D1 en staging.
- `CrateCard` y `CreateCrateModal` ya no existen; `AddToCrateButton` sigue enlazando a `/mis-colecciones?crear=1`, que abre `CollectionFormDialog`.

## Rollback

Sin datos ni migraciones.

1. Borrar `src/routes/mis-aportes/`, `src/lib/components/colecciones/`, `src/lib/domain/contributionRows.ts`, `tests/browser/u14-perfil-colecciones.spec.ts`, `tests/contribution-rows.test.mjs` (y su entrada en `package.json`) y `docs/modernizacion/capturas-u14/`.
2. Restaurar desde `respaldos/*.pre-u14.*.txt`: perfil (página y loader), Mis colecciones, colección (página y loader), `CrateCard`, `CreateCrateModal`, `cratesStore`, `Checkbox`, `Sortable`, `Header`, Sugerir, `/lab`, `FormSection`, y las pruebas `e10`, `u7-shell`, `catalogo`, `u3`, `u10`, `u12` y los soportes visuales.
3. Quitar `loadProfilePage` de `profiles.ts`, el bloque U14 de `tokens.css` y `id="redes"` de `/cuenta`.
4. Quitar las 14 capturas suplementarias de `censo.spec.ts` (incluido en el respaldo).
