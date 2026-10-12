# E10 — Sugerir, borradores, Perfil y estación editorial

Fecha: 18 de septiembre de 2026  
Estado: **implementada y verificada localmente; lista para E21**

## Dependencias y alcance

E04 y E09 se tomaron como aceptadas por instrucción explícita. E09 no tenía un expediente de relevo independiente al iniciar E10, por lo que su contrato efectivo se leyó de las migraciones `20260918182853_e09_contribution_contract_v2.sql` a `20260918184855_e09_cleanup_advisor_findings.sql`, `scripts/e09-verify.mjs`, `scripts/e09-concurrency-verify.mjs` y los RPC desplegables allí definidos.

E10 no cambió migraciones, RLS, payloads, reglas de estados, Edge Functions ni datos. Tampoco tocó producción, hizo commit o push. La estación de contribuciones permanece separada de `/admin/catalogo`: comunidad usa `/sugerir` y su Perfil; colaboradores y administradores usan `/editorial`; la consola administrativa del catálogo conserva su ruta propia.

## Resultado funcional

### `/sugerir`

- Empieza únicamente con una URL fuente y la acción explícita `Detectar`; salir del campo no inicia solicitudes.
- Admite mediante un validador compartido una URL HTTPS de Bandcamp, Spotify o SoundCloud y recomienda Bandcamp en el microcopy.
- Representa detección lenta, exitosa y fallida. Un fallo revela la edición manual con `Información no disponible` y no borra lo escrito.
- Mantiene metadata y portada detectadas como evidencia separada y de solo lectura. No hay input de portada, subida de archivo ni `cover_url` editable en el payload confirmado.
- Usa entradas repetibles independientes para principales, colaboradores, géneros y países. Tipo parte vacío y siempre requiere confirmación manual, aunque la fuente sugiera uno.
- `Guardar borrador` acepta campos incompletos; `Enviar a revisión` comprueba todos los obligatorios para orientar el foco y deja la validación autoritativa a E09.
- Un borrador se retoma con `/sugerir?draft=<uuid>`. `changes_requested` se carga en la misma ruta y se reenvía con la transición de E09; no se finge un guardado que el contrato E09 no admite para ese estado.
- El estado ocupado impide envíos repetidos desde la interfaz y el rechazo de una segunda transición sigue perteneciendo al RPC serializado de E09.
- Copy final exacto: `Tu propuesta quedó pendiente de revisión. Puedes consultar su estado en tu perfil.`

### Perfil

La ruta pública continúa siendo `/perfil/[username]`. Solo cuando la sesión coincide con el perfil se añade una sección privada `Mis propuestas`; perfiles ajenos no consultan ni renderizan contribuciones.

Se muestran `draft`, `pending`, `ready_for_admin`, `changes_requested`, `approved` y `rejected`, con nota editorial cuando existe. `draft` ofrece `Retomar borrador` y `changes_requested`, `Corregir propuesta`. La sección cubre carga, error y vacío sin bloquear los crates públicos.

### `/editorial`

- Comunidad y sesiones anónimas reciben gates de acceso sin controles editoriales.
- Colaborador ve propuestas comunitarias pendientes ajenas y puede invocar únicamente `prepare_contribution_for_admin`; sus aportes propios aparecen en la cola prioritaria sin controles de revisión.
- Administrador ve por separado `Cola prioritaria` y `Cola comunitaria`. Solo este rol recibe `Solicitar cambios`, `Rechazar` y `Revisar publicación`.
- El detalle presenta en la misma tarjeta fuente, portada detectada, metadata detectada, payload confirmado, diferencias, sello y nota del autor.
- Rechazo y cambios solicitados requieren nota antes de invocar el servidor. Aprobar abre un resumen final accesible con `dialogOverlay` de E04; Escape devuelve foco al disparador exacto.
- Carga, error remoto y ambas colas vacías tienen representación explícita. Tras una transición aparece un estado visible y la fila sale de la cola correspondiente.

## Mapa de rutas y roles para E21

| Ruta | Anónimo | Comunidad | Colaborador | Admin |
| --- | --- | --- | --- | --- |
| `/sugerir` | Gate a login | Detectar, guardar, enviar y reanudar aportes propios | Mismo flujo; al enviar E09 deriva cola `collaborator` | Gate hacia `/admin/catalogo`; no ofrece un envío que E09 rechazaría por rol |
| `/sugerir?draft=<uuid>` | Gate; no carga datos | Solo fila propia visible por RLS y estado editable | Solo fila propia visible por RLS y estado editable | No se presenta como vía administrativa |
| `/perfil/[username]` propio | No aplica | Estados y reanudación privados | Estados y reanudación privados | Estados propios si los hubiera |
| `/perfil/[username]` ajeno | Perfil/crates públicos | Perfil/crates públicos | Perfil/crates públicos | Perfil/crates públicos |
| `/editorial` | Gate a login | Acceso restringido | Cola comunitaria ajena + aportes propios sin auto-revisión | Colas comunitaria/prioritaria + decisión final |
| `/admin/catalogo` | Sin cambio E10 | Sin cambio E10 | Sin cambio E10 | Consola administrativa separada de E07 |

## Contrato E09 consumido

La capa `src/lib/stores/contributionsStore.ts` es un adaptador; los componentes no escriben tablas ni reconstruyen autorización o transiciones.

- Payload v2 confirmado: `version`, `title`, `primary_artists[]`, `collaborators[]`, `release_type`, `release_date`, `genres[]`, `countries[]`, `label?`, `team_note?`.
- Evidencia: `detected_metadata` separado del payload confirmado.
- Lecturas: `contributions.select(...)`, siempre moldeadas por las policies de E09.
- Borradores: `create_contribution_draft(...)`, `save_contribution_draft(...)`.
- Envío/reenvío: `submit_contribution(...)`.
- Preparación colaborativa: `prepare_contribution_for_admin(...)`.
- Decisión admin: `review_contribution(...)`.
- Estados consumidos sin redefinirlos: `draft`, `pending`, `ready_for_admin`, `changes_requested`, `rejected`, `approved`.
- Colas consumidas: `community`, `collaborator`; su asignación no procede del cliente.

El cliente sí centraliza validación de forma/obligatorios para mensajes y foco, pero no la trata como frontera de seguridad: los RPC de E09 siguen siendo autoritativos.

## Verificación

| Comando | Resultado |
| --- | --- |
| `npm test` | **PASS**, 27/27 |
| `npm run build` | **PASS**, adaptador estático, sin warnings E10 |
| `npx playwright test tests/browser/e10-contributions.spec.ts --workers=1` | **PASS**, 8/8 |
| `npx playwright test --workers=1` | **PASS**, 33 pasadas y 2 omitidas por condición (`E01 staging canonical` y `E03 legacy`) |

Los ocho casos E10 cubren:

1. detección solo por acción, lenta y exitosa; tipo sin autoselección; evidencia de portada; borrador; un solo envío ante doble acción; viewport 390 px sin overflow;
2. detección remota fallida, edición manual preservada, foco en primer obligatorio y error RPC sin borrar formulario;
3. Perfil con todos los estados, nota editorial, reanudación directa de draft/cambios y privacidad frente a perfil ajeno;
4. Perfil vacío y error remoto sin perder crates públicos;
5. denegación visible a comunidad; colaborador prepara solo comunidad ajena y no obtiene acciones admin ni auto-revisión;
6. admin con colas separadas, comparación detectado/confirmado, nota requerida, resumen de publicación, Escape y retorno de foco;
7. carga, vacío y error remoto de la estación editorial;
8. rutas directas anónimas sin acciones.

La seguridad fuera de UI —lectura por ownership, rechazo de escritura cruda, no auto-preparación, no autoaprobación, nota obligatoria, estados terminales y concurrencia de envío— pertenece a las verificaciones aceptadas de E09 (`scripts/e09-verify.mjs` y `scripts/e09-concurrency-verify.mjs`). E10 no volvió a ejecutar esas pruebas remotas ni alteró staging.

## Limitación reproducible del contrato E09

E09 persiste `p_working_payload` y `p_internal_note` en `private.contribution_preparations`, pero no expone una lectura autorizada para admin y `review_contribution` publica `contributions.payload`, no el `working_payload` preparado.

Caso reproducible:

1. una persona colaboradora llama `prepare_contribution_for_admin(id, { ...payload, title: 'Título preparado' }, 'nota interna')` sobre una propuesta comunitaria ajena;
2. el estado cambia correctamente a `ready_for_admin`;
3. una lectura admin de `contributions` sigue mostrando el título original y no incluye la nota interna;
4. `review_contribution(id, 'approved', null)` materializa el título original.

Esto no bloquea el E10 entregado porque la estación solo marca lista la propuesta confirmada sin ofrecer edición de una copia invisible, y la “nota” requerida por E10 es la nota de autor/revisor que sí está representada. Si producto exige editar esa copia colaborativa y publicarla o compararla en UI, el caso debe volver a **E09 con `gpt-5.6-sol` en `xhigh`**; no debe resolverse exponiendo la tabla privada ni cambiando autorización desde Svelte.

## Archivos E10

- `src/lib/components/StringListField.svelte`
- `src/lib/stores/contributionsStore.ts`
- `src/routes/sugerir/+page.svelte`
- `src/routes/perfil/[username]/+page.svelte`
- `src/routes/editorial/+page.svelte`
- `tests/browser/e10-contributions.spec.ts`
- este expediente

## Rollback

El kill switch existente `VITE_EDITORIAL_ENABLED=false` oculta las superficies nuevas sin conceder ni retirar permisos. Un rollback de código revierte únicamente los siete archivos E10 anteriores. No hay migración, dato o objeto remoto E10 que deshacer.

## Relevo a E21

E21 debe usar el mapa de rutas/roles anterior y probar con cuentas reales de staging: una de comunidad, una colaboradora y una admin. Debe validar la Edge Function contra una fuente real de cada proveedor, reanudación después de recarga, transición visible en Perfil, `ready_for_admin`, nota obligatoria y publicación transaccional de E09. También debe conservar la separación entre `/editorial` y `/admin/catalogo`, ejecutar teclado/retorno de foco y 390 px, y revisar la limitación de `contribution_preparations` antes de prometer edición colaborativa de working copies.
