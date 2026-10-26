# U13 — Sugerir y reportar (2026-10-09)

Etapa U13 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#u13--sugerir-y-reportar). Corrió en Claude Opus 5.5 con esfuerzo `high`, como asigna el plan. No hizo falta escalar: los pasos no cambian el payload, los estados ni el borrador de E09. Sin commit, push, datos, despliegue ni producción.

Estado: **implementada, pendiente de aceptación.**

## Condición de arranque

- U7 y U9 aceptadas ([`decisiones.md`](./decisiones.md), ronda 3). U12 está implementada pero sin aceptar.
- Por eso la referencia visual es aislada: `VISUAL_BASELINE_DIR=.ref-pre-u13 npm run visual:capture` antes de editar (150 capturas, 0 inestables). La línea base oficial no se tocó.
- Los archivos reescritos se respaldaron en `docs/modernizacion/respaldos/*.pre-u13.*.txt` (casi todo `src/` está fuera de git).

## Pedido del equipo durante la etapa

> "es esencial que el botón sugerir lleve directamente a la creación de la sugerencia y no a una pantalla tonta intermedia"

Clasificado como ajuste interno (sección 6.2 del plan de la biblioteca): no cambia contratos. Queda registrado en `decisiones.md`, "Sugerir (2026-10-09, durante U13)". Se aplica así:

- **Comunidad y colaboración:** Sugerir abre directamente el paso 1, con el foco en el campo de la fuente. No hay portada, introducción ni "Empezar". El formulario se pinta sin esperar a la comprobación del rol.
- **Admin:** antes veía la tarjeta "Usa la consola administrativa", que era justamente una pantalla intermedia.
  - **Primera versión:** `/sugerir` lo redirigía a la consola. El formulario se veía ~1 s, mientras se leía el rol, y luego saltaba.
  - **Segunda ronda de feedback:** el equipo quiere ver el mismo flujo (pegar el enlace de Bandcamp y rellenar) y que el último paso lleve a la consola. Lo eligió entre tres opciones; las otras dos cambiaban E09.
  - **Por qué no puede enviar:** E09 deja a admin crear borradores, pero `submit_contribution` rechaza su rol ("Author role is invalid").
  - **Cómo queda:**
    - el mismo flujo de cuatro pasos y sin "Guardar borrador" (sería un borrador imposible de enviar);
    - en el paso 3, la nota se llama "Observación del cambio" (va al historial auditado);
    - el paso 4 dice **"Continuar en la consola"**.
  - **El traspaso:** va por `sessionStorage` (`$lib/domain/adminHandoff.ts`), se lee una vez y abre `/admin/catalogo?nuevo=1` con:
    - título e identificador, enlace principal, tipo, fecha, sello y portada detectada;
    - artistas, géneros y países que **ya existen** (sin distinguir tildes ni mayúsculas);
    - la observación (o "Alta desde Sugerir.").
  - **Lo que no existe en el catálogo** se nombra en el aviso ("Aún no existen en el catálogo, créalos aquí: …") para crearlo con las herramientas de la consola. El traspaso no crea nada por su cuenta.
  - Nada cambia en E06, E09 ni en la consola salvo `?nuevo`.
- **Sin sesión:** el botón del header ya iba directo a Entrar con retorno a `/sugerir` (sin cambios). La tarjeta de `/sugerir` solo aparece si se abre la URL a mano. Ahora tiene botones del sistema ("Entrar" y "Crear una cuenta") en lugar de dos enlaces subrayados (hallazgo del censo).

## Resultado

### Sugerir por pasos

| Paso | Contenido | Avanzar |
| --- | --- | --- |
| 1. Fuente | Enlace (Field `url`) y su ayuda de E10 | **Detectar** (Intro también). Si la URL no cambió desde la última detección, el botón es **Continuar** y no vuelve a detectar. |
| 2. Revisar datos | Aviso "Información no disponible." si la detección falla. Portada detectada como evidencia. Título, artistas principales, colaboradores, tipo, fecha, géneros, países y sello. | **Continuar** valida los obligatorios del paso (espejo de E09), muestra los errores y enfoca el primero |
| 3. Nota | "Nota para el equipo", opcional: "Puedes enviarla sin nota." | **Continuar**, siempre |
| 4. Enviar | Resumen de solo lectura en tres bloques (Fuente, Datos, Nota), cada uno con "Editar", que lleva a su paso. La nota vacía se muestra como "Sin nota". | **Enviar a revisión**. Si algo falta, vuelve al paso del primer error y lo enfoca. |

- **Volver sin perder datos.** Todo vive en el componente mientras se recorre el flujo. "Atrás", "Editar" y los botones atrás/adelante del navegador cambian de paso sin tocar los datos. Cada cambio de paso es una entrada de historial superficial (`pushState` de SvelteKit con `sugerirPaso`), sin cambiar la URL.
- **Entre visitas, como hoy.** "Guardar borrador" está en los pasos 2 a 4 (no en `changes_requested`, que E09 no deja guardar) y usa `create/save_contribution_draft`. `/sugerir?draft=<uuid>` retoma en el paso 2 con todo cargado. No se añadió autoguardado ni `localStorage`.
- **Sin datos no hay pasos vacíos.** Una recarga o una entrada vieja del historial sin datos muestran el paso 1 (`visibleStep`).
- **Foco.** Al cambiar de paso, el foco va al título del paso ("Paso N de 4: …" para lectores de pantalla) y la vista sube al formulario si había quedado por debajo.
- **Indicador de pasos.** Una lista ordenada con `aria-current="step"`; los completados llevan check y "completado" oculto. En móvil (bajo 680) se ve solo el nombre del paso actual y los demás como número.
- **Listas con el Combobox de U6.**
  - **Artistas principales y colaboradores:** búsqueda en `artists` (mínimo 2 caracteres, 200 ms) y "Añadir «…»" para nombres que no existen. Los artistas detectados entran como chips: los 41 del caso del censo ya no son 41 campos apilados.
  - **Géneros y países:** sugerencias desde los diccionarios públicos `genres` y `countries`, también con "Añadir «…»".
  - **Por qué todos permiten añadir:** el payload de E09 acepta nombres libres y E10 los admitía como texto. Cerrar géneros o países al diccionario sería un cambio de producto (U6 lo sugería "salvo que el Estudio confirme diccionarios"). El Combobox impide duplicar un valor existente sin distinguir tildes ni mayúsculas.
- **Sin cambios de contrato:** el payload es el mismo objeto v2 (`team_note` solo si hay texto, como antes), con las mismas RPC y los mismos estados. La validación del cliente sigue siendo solo orientativa; E09 manda.

### Nota opcional siempre

- En E09 la nota de quien propone (`team_note`) **ya era opcional** en todos los caminos. U13 lo hace explícito en la interfaz (paso propio, "(opcional)", "Puedes enviarla sin nota", "Sin nota" en el resumen).
- La nota del revisor sigue siendo obligatoria (`review_contribution`, sin tocar; E10 lo comprueba).
- **"Proponer un cambio a un lanzamiento existente".** El contrato de E09 no tiene ese concepto: una contribución siempre propone un lanzamiento nuevo, y `review_contribution` aprobada siempre crea uno. El único "cambio" que existe hoy es **corregir una propuesta con cambios solicitados** ("Corregir propuesta" en el perfil), y ahí se prueba el envío sin nota. Si el producto quiere propuestas de edición sobre lanzamientos publicados, hay que **cambiar el contrato de E09**: ver "Caso para E09".
- Al corregir una propuesta, el aviso "Cambios solicitados" muestra ahora la nota del revisor en la propia página (antes remitía al perfil).

### Reportar

- **Desde la ficha:** el IconButton "Reportar un problema" de U9 sigue enlazando a `/reportar?release_id={uuid}`, sin cambios en la ficha. `/reportar` ahora **identifica el lanzamiento**: portada, título, artistas y "Ver ficha" (lectura de `catalog_releases` por id con `fetchReleasesForCrate`). Mientras carga, esqueleto de fila. Si no se encuentra, conserva el texto anterior ("Este reporte incluye el lanzamiento desde el que llegaste."). La categoría parte de "Error de catálogo".
- **Desde el menú global:** el enlace ya existía, pero **no navegaba**. Ningún enlace del menú global funcionaba, en ningún ancho, desde U7. Causa: el menú se montaba dos veces (desktop y móvil, uno oculto por CSS) con el mismo estado. El oculto tomaba el toque en el visible como un clic fuera, cancelaba el `pointerdown` y cerraba el menú antes del clic. Corrección mínima en `Header.svelte`: solo se monta el menú del ancho actual (`menuMovil`, de `MOBILE_QUERY`), y al cambiar de ancho se cierra. Así tampoco hay dos `id="global-menu"`. El aspecto no cambia (0 diferencias en las capturas del header y del menú).
- **Formulario con primitivas:** Select (Categoría), Textarea con contador (Descripción) y Notice (contexto técnico, error y éxito).
  - **Captura en español:** el input nativo ("Choose File / No file chosen") queda oculto. Lo sustituyen un botón "Elegir imagen" / "Cambiar imagen", el nombre del archivo o "Ningún archivo elegido", y "Quitar".
  - **Descripción vacía:** el error va en el campo, con foco, en lugar de una alerta suelta.
  - **Al enviar desde un lanzamiento:** el aviso de éxito ofrece "Volver al lanzamiento".
- E18 sin cambios: mismo servicio (`createProblemReport`), mismo contexto técnico permitido y mismo flujo de captura.

### Primitivas extendidas

- `Field`: `type="date"`, con `color-scheme: dark` para el selector nativo.
- `Select`: `hint` y `error`, con `aria-invalid` y `aria-describedby`, igual que Field. Las usan Tipo (sugerencia de la fuente y error).
- No se añadieron a `/lab` para no mover sus capturas en esta etapa. **Pendiente para U18 o la próxima etapa que toque `/lab`:** mostrar un Field fecha y un Select con ayuda y error.

## Archivos

- **Nuevos**
  - `src/lib/domain/contributionSteps.ts`: pasos, campo → paso, primer error y paso visible. Puro.
  - `src/lib/domain/adminHandoff.ts`: traspaso de Sugerir a la consola (admin) y emparejamiento por nombre.
  - `src/lib/stores/profileRole.ts`: rol de la sesión leído una vez y compartido. `/sugerir` ya no llama a `getUser()` antes de leerlo.
  - `tests/contribution-steps.test.mjs` (6 casos, en `npm test`).
  - `tests/browser/u13-sugerir-reportar.spec.ts` (8 casos).
  - `docs/modernizacion/capturas-u13/` (~2,3 MB): 15 capturas de flujo y `visual/` con las 9 actuales de la suite.
  - Respaldos `docs/modernizacion/respaldos/*.pre-u13.*.txt`.
  - Este documento.
- **Modificados**
  - `src/routes/sugerir/+page.svelte` (reescrito, runes).
  - `src/routes/reportar/+page.svelte` (reescrito, runes).
  - `src/lib/stores/contributionsStore.ts`: `loadContributionDictionaries`, `searchArtistNames` y `ADMIN_NEW_RELEASE_HREF`, de solo lectura. Las RPC no cambian.
  - `src/lib/services/adminCatalog.ts`: `findArtistsByNames` (lectura exacta, no crea).
  - `src/routes/admin/catalogo/+page.svelte`: `?nuevo` abre el lanzamiento nuevo, aplica el traspaso de Sugerir y se retira de la URL.
  - `src/lib/components/Header.svelte`: un solo menú global montado.
  - `src/lib/ui/Field.svelte` y `src/lib/ui/Select.svelte`.
  - `tests/browser/e10-contributions.spec.ts`: el mismo contrato recorrido por pasos (ver "Pruebas").
  - `package.json` (`npm test`), [`decisiones.md`](./decisiones.md) y [`estado.md`](./estado.md).
- **Sin borrar:** `src/lib/components/StringListField.svelte` queda sin uso. Se borra al aceptar.
- Sin migraciones, flags ni variables nuevas.

## Pruebas

| Prueba | Resultado |
| --- | --- |
| `npm test` | **122/122** (116 + 6 de `contribution-steps`) |
| `npm run lint:tokens` | OK: 150 archivos, 2 excepciones temporales (las de U4; ninguna nueva) |
| `npm run build` | OK. El único aviso es de `/cuenta` (U12, `state_referenced_locally`), previo. |
| `svelte-check` | Sin errores en los archivos de U13. En `admin/catalogo` quedan los 2 previos (`onMount` async y radar). |
| E10 (`e10-contributions.spec.ts`) | **8/8** |
| U13 (`u13-sugerir-reportar.spec.ts`) | **8/8** |
| U7 (`u7-shell.spec.ts`), tras el arreglo del menú | 20/20 |
| `npm run test:browser` | Tras el feedback de admin: **260 pasan**, 5 omitidas y 1 falla, E17:202 (persistente). En la corrida anterior también fallaron E17:182 y E14 `catalogo.spec.ts:450`, intermitentes registradas; aisladas dieron 10/10 con `--repeat-each=5`. |
| E18 | No tiene prueba de navegador. Su verificación SQL (`tests/sql/e18-verify.sql`) no depende de la interfaz y no se tocó. La prueba U13 cubre el alta desde la ficha (categoría, `release_id` y descripción en el `insert`) y la captura elegida y quitada. |

**Cambios en E10.** Se conservan todas las aserciones de contrato: detección solo por acción, lenta, sin autoseleccionar el tipo, con evidencia de portada y sin input de portada; borrador; un solo envío ante doble clic; 390 sin desborde; fallo de detección con la fuente intacta; foco en el primer obligatorio; error remoto sin perder datos; reanudación; rutas anónimas. Cambia solo cómo se recorre la interfaz:

- `Continuar` entre pasos;
- chips en lugar de "Géneros, entrada 1";
- "Título conservado" se comprueba volviendo con "Atrás";
- admin: ve el formulario y nunca "Enviar a revisión", en lugar de la tarjeta;
- nuevo: el foco cae en la fuente al abrir.

**Qué cubre `u13-sugerir-reportar.spec.ts`:**

- **Flujo completo a 390 y a 1440:**
  - desde el botón Sugerir del header, sin pantalla intermedia y con el foco en la fuente;
  - detección, chips de artistas detectados, colaborador del catálogo, género del diccionario y país nuevo con "Añadir";
  - "Atrás" y vuelta sin perder nada, y la fuente sin cambios no vuelve a detectar;
  - atrás/adelante del navegador;
  - la nota vacía y el resumen con "Sin nota";
  - el envío, con el payload exacto y sin `team_note`;
  - sin scroll horizontal en cada paso.
- **Propuesta de cambio sin nota:** una propuesta con cambios solicitados y nota original. Se ve la nota del revisor, no se ofrece "Guardar borrador", se vacía la nota y se reenvía: `submit_contribution` sobre la misma propuesta, sin `team_note` y sin crear borrador nuevo.
- **Borrador entre visitas:** el paso 2 incompleto no avanza y enfoca el Tipo. Se guarda el borrador, se sale y se retoma con `?draft=` con todos los datos, en el paso 2 y con la fuente en el paso 1.
- **Admin:** desde el header llega al paso 1 con foco, sin redirección y sin "Guardar borrador". Ve "Observación del cambio" y, al final, "Continuar en la consola". La consola se abre con título, enlace, tipo, fecha, sello, portada y género. El aviso nombra lo que no existe ("Segunda artista (artista)", "Perú (país)"). La observación queda en "Alta desde Sugerir." y el traspaso se borra al leerlo.
- **Reportar desde la ficha:** el enlace de la ficha, el lanzamiento identificado, "Ver ficha", "Error de catálogo", el input nativo oculto, el error de descripción con foco, elegir y quitar una captura, el envío con `release_id` y "Volver al lanzamiento".
- **Reportar desde el menú global a 390 y 1440:** un solo menú montado, el enlace navega y no hay lanzamiento.

## Suite visual

Contra `tests/visual/.ref-pre-u13/` (U12 sin aceptar): **150 capturas, 141 iguales y 9 distintas, todas de esta etapa.** 0 inestables.

| Capturas | Motivo |
| --- | --- |
| `sugerir-D`, `sugerir-M` | Paso 1: indicador de pasos, título del paso, Field del sistema con foco, "Detectar" como acción principal y el texto de introducción nuevo |
| `sugerir-detected-D`, `sugerir-detected-M` | Paso 2: chips en lugar de un campo por artista (la captura móvil baja de 6400 a 5310 px), Select con la sugerencia de la fuente, Field fecha y acciones del paso |
| `sugerir-anon-D`, `sugerir-anon-M` | Tarjeta sin sesión con botones del sistema y el texto de introducción nuevo |
| `sugerir-admin-D` | Ya no hay tarjeta: admin ve el paso 1, como el resto |
| `reportar-D`, `reportar-M` | El lanzamiento identificado, primitivas, la captura en español y el aviso de contexto como Notice |

Ningún cambio en el header ni en el menú: el arreglo solo deja de montar el menú oculto. Las actuales están en [`capturas-u13/visual/`](./capturas-u13/visual/); el informe con esperada, actual y diff, en `tests/visual/report/` (se borra con la próxima captura).

## Capturas del flujo (para U17 y U18)

En [`capturas-u13/`](./capturas-u13/). Se regeneran con `U13_CAPTURAS=1 npx playwright test tests/browser/u13-sugerir-reportar.spec.ts`.

- `1-fuente-{390,1440}`, `2-datos-…`, `3-nota-…`, `4-enviar-…` y `5-enviada-…`;
- `cambio-sin-nota-1440`, `admin-enviar-1440` (paso 4 de admin) y `admin-consola-1440` (consola rellenada);
- `reportar-ficha-1440` y `reportar-menu-{390,1440}`.

## Caso para E09 (no bloquea U13)

Para un chat de Claude Opus 5.5 con esfuerzo `xhigh` sobre E09, **solo si el producto lo pide**:

- **Hoy:** `contributions` no tiene un lanzamiento destino, y `review_contribution('approved')` siempre inserta un `releases` nuevo (`20260918182853_e09_contribution_contract_v2.sql`, línea ~202). No hay manera de proponer un cambio a un lanzamiento publicado salvo con un reporte "Error de catálogo" (E18), cuya descripción es el contenido del reporte, no una nota.
- **Qué haría falta:**
  - un `target_release_id` (y su versión de catálogo, para la concurrencia de E06) en la contribución;
  - una rama de `review_contribution` que aplique el cambio por la RPC auditada de E06 en lugar de insertar;
  - policies y verificación (`e09-verify.mjs`).
- **En la interfaz:** U13 ya deja preparado lo necesario. Un cuarto origen "desde la ficha" entraría en el paso 2 con los datos del lanzamiento, y la nota seguiría siendo opcional.

## Comprobaciones manuales pendientes

- **iPhone real:**
  - el teclado virtual sobre el Combobox en el paso 2;
  - el selector de fecha nativo;
  - el selector de imagen de `/reportar`.
- **VoiceOver:** el anuncio "Paso N de 4" al cambiar de paso y los chips del Combobox (lo pendiente de U6 sigue abierto).
- **Staging con datos reales:**
  - la búsqueda de artistas y los diccionarios con la RLS real (son tablas públicas de lectura; se consultan igual que en la consola);
  - un envío real de comunidad;
  - un reporte desde una ficha real.
- **Admin en móvil:** puede recorrer Sugerir, pero la consola en móvil no edita (E07). Al continuar verá el editor rellenado sin poder guardar, igual que si pulsara "Nuevo lanzamiento".
- **Staging, admin:** comprobar el traspaso con artistas, géneros y sellos reales (la coincidencia de artistas es exacta, sin distinguir mayúsculas).

## Riesgos y deuda

- **Sin aviso al salir con datos sin guardar.** Antes tampoco existía, y el borrador sigue siendo explícito. Un `beforeNavigate` con confirmación sería una decisión de producto.
- **El Combobox deja su lista abierta si el foco sale por programa** (por ejemplo, `focus()` sobre otro campo). Con ratón, dedo o Tab se cierra. Es de U6 y no se tocó.
- **"Observación del cambio"** de la consola sigue siendo obligatoria. Es la nota de auditoría de E06 para quien administra, no la nota de quien propone.
- **U15:** cuando la consola pase a `/estudio`, `ADMIN_NEW_RELEASE_HREF` (`contributionsStore.ts`) debe apuntar al nuevo destino. El Estudio tiene que leer `?nuevo` y el traspaso (`takeAdminHandoff`) como hoy la consola.
- **Traspaso y pestañas:** va en `sessionStorage`, así que no pasa a otra pestaña. Si la consola falla al cargar, el traspaso se pierde y hay que volver a Sugerir; lo rellenado sigue en esa pestaña al pulsar Atrás.

## Criterios de aceptación

| Criterio | Estado |
| --- | --- |
| Sugerir por pasos: fuente → revisar datos → nota → enviar | Cumplido |
| Borradores entre pasos y entre visitas, como hoy | Cumplido (estado del componente y borrador de E09; prueba) |
| Volver atrás sin perder datos | Cumplido (botón, "Editar" y navegador; prueba) |
| Nota siempre opcional, también al proponer un cambio | Cumplido en todos los caminos que existen. "Cambio a un lanzamiento existente" no existe en E09: queda documentado arriba. |
| Artistas, géneros y países con el Combobox de U6 | Cumplido |
| Reportar desde la ficha con el lanzamiento identificado | Cumplido |
| Reportar desde el menú global | Cumplido (además, el menú vuelve a navegar) |
| Sugerir lleva directo a crear, sin pantalla intermedia (pedido del equipo) | Cumplido para comunidad, colaboración y admin. Admin ve el mismo flujo y termina en la consola rellenada (segunda ronda de feedback). |
| E10 y E18 en verde | E10 8/8. E18 sin cambios de contrato; su alta cubierta por la prueba de U13. |
| Sugerir completo a 390 y 1440 y cambio sin nota | Cumplido (prueba y capturas) |
| Payload, estados y nota del revisor sin cambios | Cumplido |
| Solo tokens y primitivas | Cumplido. Lint en verde. Field y Select extendidos (ver arriba). |

## Rollback

Sin datos ni migraciones.

1. Restaurar desde `docs/modernizacion/respaldos/`:
   - `sugerir-page`, `reportar-page`, `admin-catalogo-page` y `Header`;
   - `Field`, `Select` y `contributionsStore`;
   - `e10-contributions.spec` y `censo.spec` (este último no cambió).
2. Borrar `src/lib/domain/contributionSteps.ts`, `tests/contribution-steps.test.mjs` y `tests/browser/u13-sugerir-reportar.spec.ts`, y quitar el test de `npm test` en `package.json`.
3. **Ojo:** restaurar `Header` devuelve el fallo del menú global.

## Al aceptar

1. `npm run visual:capture` sobre la línea base oficial. Si U12 se acepta antes, basta con que la comparación contra `baseline` dé solo las 9 de arriba.
2. Borrar `tests/visual/.ref-pre-u13/`.
3. Borrar `StringListField.svelte`, sin uso.
4. Decidir si `capturas-u13/` se versiona.

## Relevo

- **U14 (perfil, aportes y colecciones):**
  - "Nueva propuesta" y "Retomar borrador" siguen apuntando a `/sugerir` y `/sugerir?draft=…`;
  - el éxito de U13 enlaza a `{perfil}#mis-aportes`: si U14 crea `/mis-aportes`, hay que cambiar ese enlace en `sugerir/+page.svelte`.
- **U15:** lo de `?nuevo`, `ADMIN_NEW_RELEASE_HREF` y el traspaso (ver "Riesgos").
- **U17 (propuestas y reportes en el Estudio):**
  - el payload no cambió;
  - la nota del autor puede faltar y la interfaz de revisión debe mostrar "Sin nota", no un hueco;
  - los géneros y países propuestos pueden no existir en el diccionario (los acepta E09 al aprobar).
  - Los reportes que vienen de una ficha llegan con `release_id` y categoría "Error de catálogo" por defecto.
- **U18:**
  - repetir en WebKit y en iPhone el Combobox con teclado virtual, el selector de fecha y el de imagen;
  - mostrar Field fecha y Select con ayuda y error en `/lab`;
  - decidir el aviso al salir con datos sin guardar.
