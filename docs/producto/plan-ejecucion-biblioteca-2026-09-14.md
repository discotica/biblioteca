# Plan de ejecución por chats — Biblioteca Discótica

Fecha: 14 de septiembre de 2026  
Estado: plan maestro ejecutable; no implica que las etapas estén implementadas  
Alcance: nueva ronda de correcciones de catálogo, créditos, operación editorial, descubrimiento, fichas, móvil, beta y salida gradual

## 1. Propósito

Este documento convierte las decisiones de producto tomadas entre el 30 de agosto y el 14 de septiembre de 2026 en una secuencia de trabajo que pueda ejecutarse **una etapa por chat**. Cada etapa:

- resuelve una dependencia concreta;
- limita los archivos y comportamientos que puede tocar;
- declara qué decisiones ya están cerradas y no deben reinterpretarse;
- define pruebas, criterios de aceptación, rollback y condiciones para detenerse;
- deja un paquete de relevo para el chat siguiente;
- evita que un modelo tenga que inferir producto, seguridad o arquitectura a partir de conversaciones informales.

El plan no propone una reescritura general. Conserva SvelteKit, Supabase/PostgreSQL, Hostinger, el lenguaje visual actual y la migración gradual ya iniciada.

El registro normalizado de la sección 4 es autosuficiente: un chat futuro no necesita tener acceso al archivo temporal de la transcripción para ejecutar una etapa.

## 2. Fuentes de verdad y precedencia

Cuando dos documentos parezcan contradecirse, se aplica este orden:

1. La conversación suministrada el 14 de septiembre de 2026 que responde la siguiente ronda de decisiones, en especial las etapas 1–11 del cuestionario vigente.
2. Este plan, que normaliza esas respuestas y resuelve sus implicaciones técnicas.
3. [`resoluciones-puntos-abiertos-biblioteca-2026-09-14.md`](./resoluciones-puntos-abiertos-biblioteca-2026-09-14.md).
4. [`trazabilidad-feedback-biblioteca-2026-09-13.md`](./trazabilidad-feedback-biblioteca-2026-09-13.md).
5. [`decisiones-abiertas-biblioteca-2026-09-13.md`](./decisiones-abiertas-biblioteca-2026-09-13.md), solo como historial de preguntas; las respuestas recibidas ya no están abiertas.
6. [`plan-maestro.md`](../modernizacion/plan-maestro.md), [`decisiones.md`](../modernizacion/decisiones.md), [`estado.md`](../modernizacion/estado.md) y [`plan-auditoria-ux-ui.md`](../modernizacion/plan-auditoria-ux-ui.md).
7. El comportamiento actual del código, que sirve como línea base pero no anula una decisión posterior.

Una etapa no debe reabrir una decisión cerrada porque el código actual haga otra cosa. Debe registrar la brecha y corregirla dentro de su alcance.

## 3. Línea base verificada al escribir este plan

- El árbol de trabajo contiene numerosos cambios locales sin confirmar. Ninguna etapa puede descartarlos, restaurarlos o asumir que son desechables.
- `npm test` pasa 7 de 7 pruebas actuales.
- `npm run build` termina correctamente con el adaptador estático.
- La fuente pública predeterminada sigue siendo el TSV legado; `VITE_CATALOG_SOURCE=canonical` activa Supabase.
- El catálogo canónico ya fue cargado en staging con 2.790 filas válidas y seis rechazos preservados, según `docs/modernizacion/estado.md`.
- Las Fases 4 y 5 están preparadas en migraciones y cliente, pero el estado documentado todavía exige aplicarlas y validarlas en staging antes de producción.
- El cliente público todavía aplana todos los créditos a `artist: string[]`.
- El importador y la aprobación editorial actual insertan todos los artistas como `primary`.
- Los datos reales usan cinco tipos: `Disco`, `EP`, `Single`, `Compilado` y `Sample Pack`; la detección de Bandcamp hoy puede proponer `Álbum`, creando una inconsistencia que debe normalizarse.
- `LanzamientoCard.svelte`, `LanzamientoModal.svelte`, `LanzamientoVista.svelte` y `src/routes/+page.svelte` contienen mucha lógica local y duplicada. No se deben ampliar sin extraer contratos comprobables.
- No existen todavía pruebas para exactos/aproximados, créditos separados, historial modal, swipe, retorno de foco, beta, reportes o edición administrativa del catálogo.

## 4. Decisiones normalizadas que no deben volver a inferirse

### 4.1 Resultados exactos y aproximados

- Texto para una muestra formada solo por aproximados: `No encontramos resultados exactos, pero aquí tienes los más cercanos.`
- Etiqueta del punto de transición: `Resultados aproximados`.
- Estado vacío real: `No encontramos lanzamientos con estos filtros.`
- El aviso es texto pequeño en línea. Nunca es modal, pop-up ni tarjeta.
- Si solo hay aproximados, el aviso ocupa el lugar semántico del contador y aparece antes de la grilla para que la persona entienda lo que va a ver.
- Si hay exactos y aproximados, se usa el separador corto dentro del flujo de la grilla.
- Si una página posterior de paginación contiene solo aproximados pero hubo exactos en páginas anteriores, se muestra la etiqueta corta al principio de esa página; no se afirma que no hubo exactos globales.

### 4.2 Créditos visibles

- Solo existen dos grupos editoriales visibles: `Artistas principales` y `Colaboradores`.
- Featured artists, invitados, remixers, productores y otros participantes se presentan como colaboradores; la interfaz pública no necesita mostrar esas subcategorías.
- Un colaborador único se muestra siempre. No se oculta si explica por qué el lanzamiento apareció en una búsqueda.
- En tarjeta, principales y colaborador se separan con una línea vertical discreta. Los principales usan mayor contraste y peso medio; el colaborador usa gris y peso regular.
- El bloque conjunto de principales y colaboradores ocupa como máximo dos líneas en la tarjeta y se trunca sin provocar scroll horizontal.
- Los enlaces de cada artista son independientes, navegables con teclado y conservan un nombre accesible completo aunque el texto visible se trunque.
- Con varios colaboradores, la tarjeta usa un control `Varios artistas`; la ficha muestra la relación completa.
- Un `Compilado` se presenta como `Varios artistas` aunque conserve relaciones con cada participante para sus páginas de artista.
- Fuera de compilados, se muestran hasta tres artistas principales; cuatro o más se resumen como `Varios artistas`.
- Si coinciden cuatro o más principales y varios colaboradores, la tarjeta no repite `Varios artistas | Varios artistas`: muestra un único control `Varios artistas` cuyo menú separa semánticamente `Artistas principales` y `Colaboradores`.
- Aunque el separador visual sea solo una línea, lectores de pantalla reciben los nombres de ambos grupos mediante rótulos semánticos ocultos.

### 4.3 Clasificación y auditoría de créditos existentes

- El catálogo existente no se bloquea mientras se audita.
- Bandcamp puede generar propuestas; no se convierte en fuente infalible.
- El encabezado de autor bajo el título es la evidencia principal para proponer artistas principales.
- Palabras controladas en título y tracklist —por ejemplo `feat.`, `ft.`, `featuring`, `remix`, `remixed by`, `prod.` o `produced by`— son evidencia para proponer colaboradores.
- Contradicciones entre fuente, título y tracklist, o ausencia de fuente verificable, requieren edición manual.
- Los no compilados con tres o más personas acreditadas y cualquier lanzamiento con señales de colaboración entran en la cola prioritaria.
- Un compilado se puede clasificar para presentación como `Varios artistas` sin esperar una auditoría total, pero sus relaciones individuales no se inventan.
- Una reclasificación masiva la aprueba un administrador.
- Toda aplicación o reversión deja antes, después, evidencia, actor, fecha y versión de heurística. Revertir crea un evento compensatorio; no borra el historial.

### 4.4 Identidad, slugs y crates

- `release_id` es la identidad inmutable y obligatoria en toda relación nueva.
- El slug canónico elegido antes de la salida pública queda estable; corregir título o autoría no lo regenera.
- `/lanzamiento/[slug]` y `/?modal=[slug]` usan el mismo resolvedor.
- Ante una colisión entre slug canónico y alias, gana el slug canónico.
- Los alias creados exclusivamente para la migración legada se conservan hasta validar rutas y crates y pueden retirarse antes del corte público.
- La tabla/capacidad de alias se conserva para una corrección excepcional futura. Esos redirects editoriales, a diferencia de los alias de migración, son permanentes.
- Todo crate nuevo escribe `release_id`; `lanzamiento_slug` es solo compatibilidad temporal.

### 4.5 Tipo de lanzamiento

- `Tipo` es obligatorio para comunidad, colaboradores y administradores.
- La persona debe confirmarlo manualmente antes de enviar o publicar; una detección puede sugerir, pero no seleccionar ni confirmar por ella.
- No existe un tipo publicable `Sin determinar`.
- No existe una interfaz para crear tipos arbitrarios.
- Lista canónica: `Álbum`, `EP`, `Single`, `Compilado`, `Sample Pack`.
- El valor legado `Disco` se normaliza a `Álbum`; `Album` sin tilde también se normaliza a `Álbum`.
- Añadir otro tipo en el futuro requiere una nueva decisión de producto y una migración, no texto libre.

### 4.6 Títulos y ficha compartida

- Tarjeta: máximo tres líneas en desktop y móvil, con elipsis y corte seguro de palabras extraordinarias.
- Modal y página completa: título íntegro, sin `line-clamp`, con `overflow-wrap` y sin scroll horizontal.
- Los saltos editoriales explícitos del título se conservan en la ficha; la tarjeta puede normalizarlos visualmente para aplicar el límite.
- El título usa peso Bold, no Black.
- Modal y página usan un mismo componente de contenido con un modo visual distinto. El contenedor modal conserva cierre, overlay, foco e historial; la ruta completa conserva fondo y navegación propios.
- Fecha, créditos, metadata, acciones, reproducción y recomendaciones nacen del mismo contrato y formateadores.
- Cada contenedor crea su propia sesión de reproductor; no se conserva audio al cambiar de contexto.
- Las recomendaciones aparecen en ambos contextos.

### 4.7 Bienvenida

- Es un banner grande dentro de `/`, no una pantalla de entrada.
- Solo aparece en la primera entrada directa al home de la sesión y no aparece con filtros compartidos, modal directo, invitación beta ni rutas internas.
- La grilla y la barra `Buscar` siguen siendo alcanzables sin aceptar una interrupción.
- El CTA temporal dice `Explorar`.
- El botón de cierre usa `aria-label="Cerrar bienvenida"`.
- Copy e ilustración definitivos los hará el equipo manualmente. La implementación inicial solo crea un contenido neutral y un espacio de ilustración reemplazable, sin presentar el placeholder como arte final.

### 4.8 Invitación beta

- Solo se interpreta en `/`.
- `/?beta` y `/?beta=1` activan la invitación. No se aceptan `true`, códigos de campaña ni otros valores.
- `nombre` sin `beta` se ignora.
- El nombre admite Unicode, se recorta, elimina saltos y tabs, colapsa espacios y tiene máximo 40 caracteres visibles.
- El nombre se inserta como texto, nunca como HTML.
- En rutas internas, `beta` y `nombre` no tienen efecto ni se propagan.
- Al cerrar, se eliminan únicamente `beta` y `nombre` mediante reemplazo de historial; otros parámetros válidos se conservan.
- La plantilla personalizada empieza `Hola, {nombre}.`; la genérica usa `Bienvenida a la beta de Discótica`.
- El cuerpo inicial es neutral y reemplazable: `Estás entrando a una versión en prueba de nuestra biblioteca. Explora el catálogo y cuéntanos si encuentras algo que podamos mejorar.`
- CTA: `Explorar`.
- No se inventa una fecha de lanzamiento. El componente admite una línea de fecha configurada y la omite mientras no exista una fecha aprobada.

### 4.9 Feedback y reportes

- `Reportar un problema` es permanente, discreto y sirve para errores de catálogo, bugs técnicos y comentarios generales.
- El reporte dentro del producto exige autenticación. Si no hay sesión, se lleva a login conservando una URL de retorno.
- Campos: descripción obligatoria, URL actual automática, `release_id` opcional/automático, captura opcional y contexto técnico automático.
- Antes de enviar se informa qué contexto se adjunta; nunca se incluyen cookies, tokens, contenido de formularios ni datos arbitrarios de la página.
- Un administrador recibe, clasifica y responde los reportes.
- La invitación beta muestra además una salida por correo para invitados. El correo no puede aplicar autenticación real; por tanto, “solo para beta” significa que la acción se muestra dentro de la invitación, no que el buzón pueda impedir mensajes externos.

### 4.10 Flujo de sugerencias

- La pantalla comienza con un único enlace de Bandcamp, Spotify o SoundCloud. Bandcamp se recomienda cuando exista.
- `Detectar` usa un spinner discreto y después revela los campos.
- Si la detección falla, se permite completar manualmente y se muestra `Información no disponible` sin borrar lo ya escrito.
- Campos obligatorios: fuente, título, artistas principales, tipo, fecha, géneros y países.
- Campos opcionales: colaboradores, sello y nota para el equipo.
- Ayuda de la nota: `Contexto, créditos o información adicional`.
- No se pide portada ni URL de portada. Una portada detectada es evidencia de solo lectura para la revisión.
- Se pueden guardar borradores y retomarlos desde Perfil.
- Perfil muestra borradores, pendientes, aceptados, rechazados y cambios solicitados. No promete emails.
- Todo envío que no haya sido publicado directamente por un administrador requiere aprobación final de administrador.
- Los aportes de colaboradores entran en una cola prioritaria distinta de la cola comunitaria. Los colaboradores pueden ayudar a preparar/revisar; no pueden publicar su propia propuesta ni saltarse la aprobación administrativa.
- En el alcance inicial, un colaborador puede preparar una propuesta comunitaria de la que no sea autor y marcarla `ready_for_admin`; solo un administrador solicita cambios al autor, rechaza o aprueba/publica. Una propuesta creada por un colaborador pasa directamente a la cola prioritaria de admin y no puede auto-revisarse.

## 5. Resoluciones de planificación para vacíos residuales

Estas decisiones no contradicen una respuesta explícita; cierran huecos que impedirían implementar sin inferencia. Se consideran el valor predeterminado del plan y solo se cambian mediante una corrección explícita al registro de decisiones.

1. **Barra superior:** desktop tiene una fila normal con paginación izquierda y orden derecha. Se añade una segunda fila solo cuando existe contexto aproximado que deba anunciarse. En móvil, paginación y orden ya ocupan filas separadas y el contexto aproximado aparece debajo de ambas.
2. **Header móvil:** se adopta la opción en la que el header global solo vuelve al llegar al inicio; durante scroll ascendente intermedio regresa únicamente la barra `Buscar`. Evita apilar dos superficies sticky y conserva la exploración como tarea primaria.
3. **Orden efectivo:** sin criterios, `Más reciente`; con texto/filtros, `Mejor coincidencia`; con Radar recién activado, `Radar`. Una elección explícita de fecha reordena dentro de los grupos exacto/aproximado. A–Z/Z–A no se ofrece mientras haya aproximados.
4. **Grupos invariables:** exactos siempre preceden a aproximados, incluso si la persona selecciona fecha. El orden manual solo reorganiza cada grupo.
5. **Radar como compuerta:** cuando hay ejes activos, ningún candidato con diferencia mayor a uno en un eje activo entra en la muestra. No se ensancha el margen para llenar una página.
6. **Beta y bienvenida:** si una URL activa la beta, se muestra solo la invitación beta en esa carga; la bienvenida general no aparece debajo ni después de cerrarla.

## 6. Contrato obligatorio para todos los chats de ejecución

### 6.1 Inicio del chat

El modelo ejecutor debe:

1. Leer completa esta etapa y sus documentos de entrada.
2. Ejecutar `git status --short` y revisar los diffs de archivos que vaya a tocar.
3. No borrar, restaurar ni reformatear cambios ajenos.
4. Comprobar si una etapa anterior ya modificó el supuesto estado inicial y adaptar solo las referencias técnicas, no el contrato de producto.
5. Ejecutar las pruebas base relevantes antes de editar cuando eso ayude a separar fallos previos de regresiones.
6. Si la etapa involucra Supabase, consultar el changelog y la documentación vigentes antes de implementar; usar el flujo imperativo ya existente, probar SQL en local/staging y crear la migración versionada solo cuando el diseño esté validado.
7. No tocar producción salvo que la etapa lo autorice expresamente.

### 6.2 Manejo de feedback dentro de una etapa

Ante feedback nuevo, el modelo debe clasificarlo:

- **Ajuste interno:** no cambia contratos de datos ni dependencias. Se implementa, se actualizan pruebas y aceptación dentro del mismo chat.
- **Cambio de contrato de la etapa:** se registra primero la decisión nueva, se enumeran archivos/pruebas afectados y se actualiza el alcance antes de editar.
- **Cambio que afecta una etapa futura:** se incorpora al paquete de relevo y al documento; no se adelanta trabajo ajeno.
- **Cambio que invalida una etapa ya cerrada:** se detiene la implementación relacionada y se prepara un plan de compatibilidad/migración. No se sobrescribe silenciosamente lo terminado.

### 6.3 Cierre del chat

Cada chat entrega:

- resultado funcional alcanzado;
- archivos creados/modificados;
- migraciones, flags o variables añadidas;
- pruebas ejecutadas con resultado exacto;
- comprobaciones manuales pendientes;
- riesgos o deuda que queda deliberadamente fuera;
- pasos de rollback;
- estado de cada criterio de aceptación;
- paquete de relevo para la siguiente etapa.

No se declara una etapa completa si falla una prueba causada por ella, si la documentación quedó contradiciendo el comportamiento o si depende de una comprobación remota que no se ejecutó.

### 6.4 Disciplina de versiones

- Una etapa debe poder revisarse como una unidad aislada.
- Se recomienda una rama corta y un commit por etapa después de revisión humana.
- El modelo no hace commit, push, despliegue ni merge a menos que el mensaje de ese chat lo solicite expresamente.
- Una migración aplicada no se “deshace” borrando el archivo: se corrige con una migración posterior.

### 6.5 Criterio de selección de modelo y esfuerzo

Las recomendaciones se basan en la guía oficial vigente de [modelos de OpenAI](https://developers.openai.com/api/docs/models): Terra equilibra capacidad y costo, Luna prioriza costo en trabajo acotado y Sol es el modelo profesional para trabajo complejo. Por decisión de presupuesto, este plan no usa Astra en ninguna etapa por defecto.

La disponibilidad y el consumo exacto de créditos pueden variar por cuenta o plan. La tabla es una recomendación relativa para este repositorio, no una promesa de precio fijo.

| Modelo | Usarlo aquí para | No usarlo por defecto para |
| --- | --- | --- |
| `gpt-5.6-luna` | Documentación mecánica, inventarios y cambios pequeños con aceptación explícita | Migraciones, RLS, historial, gestos complejos o producción |
| `gpt-5.6-terra` | UI delimitada, utilidades, query params, accesibilidad y pruebas locales | Cambios de datos irreversibles o arquitectura con varias capas de confianza |
| `gpt-5.6-sol` | Refactors e integraciones de varios archivos, RLS, migraciones, flujos completos, QA amplio y operaciones de corte con gates humanos | Trabajo mecánico que Luna/Terra pueden verificar de forma determinista |

`gpt-6-astra` queda fuera de este plan y de todos sus prompts. Si un workspace no ofrece la familia 5.6, no sustituir Sol en E02, E06, E08, E09, E18, E22 o E23: detenerse y pedir una decisión humana, porque son etapas con frontera de confianza, datos o producción.

Reglas de ahorro y escalamiento:

1. Empezar con el modelo y esfuerzo indicados en cada etapa; ningún prompt selecciona Astra.
2. `medium` es suficiente cuando contrato y archivos están acotados; `high` cuando hay varios estados o casos límite; `xhigh` solo para riesgo sistémico, ambigüedad fuerte o producción.
3. No usar `max` como valor inicial en este plan. Si `xhigh` no basta, primero dividir nuevamente la etapa o identificar la pregunta bloqueante.
4. Subir un nivel de esfuerzo antes de cambiar de modelo cuando el problema sea profundidad dentro del mismo alcance.
5. Cambiar de Terra/Luna a Sol cuando aparezca una clase de problema distinta: drift remoto, RLS dudosa, concurrencia, pérdida de datos, historial de navegador no determinista o contradicción entre contratos.
6. Tras dos intentos fallidos sobre la misma causa, no seguir quemando créditos: detenerse, registrar evidencia y escalar según el campo `Escalar solo si` de la etapa.
7. Para feedback puramente visual o de copy dentro de una etapa ya implementada, puede bajarse temporalmente a Terra o Luna si no se toca comportamiento, datos ni accesibilidad.
8. El chat debe leer el archivo desde el workspace en lugar de pegar sus 1.300+ líneas en el mensaje; así se reduce contexto duplicado.

## 7. Mapa de dependencias

```text
E00 Decisiones y línea base
 └─ E01 Staging y recuperación
     └─ E02 Contrato canónico v2
         ├─ E03 Dominio cliente y URLs
         │   ├─ E05 Créditos públicos
         │   ├─ E11 Motor de coincidencia
         │   │   └─ E12 Estado de búsqueda y autocompletado
         │   │       └─ E13 Resultados y paginación
         │   │           ├─ E15 Búsqueda móvil
         │   │           ├─ E19 Invitación beta
         │   │           └─ E20 Bienvenida
         │   └─ E16 Ficha compartida
         │       └─ E17 Recomendaciones e historial
         ├─ E06 Mutaciones auditadas
         │   └─ E07 Consola administrativa
         │       └─ E08 Auditoría de créditos
         └─ E09 Contribuciones v2
             └─ E10 Sugerir, Perfil y colas

E04 Fundaciones de interfaz
 ├─ E05, E07, E10, E13, E14, E15, E16, E18, E19, E20
E14 Header global ─┬─ E15 Búsqueda móvil
                   └─ E19 Invitación beta
E18 Reportes ───────── E19 Invitación beta

E05–E20 completos
 └─ E21 Candidato de lanzamiento
     └─ E22 Corte gradual
         └─ E23 Retiro del legado
```

Las ramas no autorizan ejecución paralela sobre el mismo árbol de trabajo. Solo explican dependencias lógicas.

## 8. Resumen de etapas

| ID | Etapa | Modelo | Esfuerzo | Resultado principal | Riesgo |
| --- | --- | --- | --- | --- | --- |
| E00 | Congelar decisiones y línea base | `gpt-5.6-luna` | `medium` | Registro coherente y estado reproducible | Bajo |
| E01 | Validar staging y recuperación | `gpt-5.6-sol` | `high` | Fases 4–5 existentes comprobadas sin producción | Alto |
| E02 | Contrato canónico v2 | `gpt-5.6-sol` | `xhigh` | Créditos, tipos e identidad estables en DB | Alto |
| E03 | Dominio cliente y URLs | `gpt-5.6-sol` | `high` | Un contrato de release compatible con legado/canónico | Alto |
| E04 | Fundaciones de interfaz | `gpt-5.6-terra` | `high` | Primitivas accesibles y tokens mínimos | Medio |
| E05 | Créditos públicos | `gpt-5.6-terra` | `medium` | Tarjetas y páginas de artista entienden dos grupos | Medio |
| E06 | Mutaciones auditadas | `gpt-5.6-sol` | `xhigh` | Crear/editar/archivar/revertir sin acceso crudo | Alto |
| E07 | Consola administrativa | `gpt-5.6-sol` | `high` | Reemplazo operativo de Google Sheets | Alto |
| E08 | Auditoría progresiva de créditos | `gpt-5.6-sol` | `xhigh` | Propuestas con evidencia, aprobación y rollback | Alto |
| E09 | Contribuciones v2 | `gpt-5.6-sol` | `high` | Payload, RLS y colas alineados | Alto |
| E10 | Sugerir, Perfil y editorial | `gpt-5.6-sol` | `high` | Flujo de punta a punta por rol | Alto |
| E11 | Motor de coincidencia | `gpt-5.6-sol` | `high` | Exactos/aproximados y Radar deterministas | Alto |
| E12 | Estado de búsqueda | `gpt-5.6-terra` | `high` | URL, filtros y sugerencias tipadas coherentes | Medio |
| E13 | Composición de resultados | `gpt-5.6-terra` | `high` | Orden/paginación/copy exactos | Medio |
| E14 | Header global | `gpt-5.6-terra` | `medium` | Jerarquía aprobada y scroll estable | Medio |
| E15 | Búsqueda móvil | `gpt-5.6-sol` | `high` | Barra, pills, sheet y swipe accesibles | Alto |
| E16 | Ficha compartida | `gpt-5.6-sol` | `xhigh` | Modal/ruta sin divergencia y scroll correcto | Alto |
| E17 | Recomendaciones e historial | `gpt-5.6-sol` | `high` | Dos recomendaciones y navegación reversible | Alto |
| E18 | Reportar un problema | `gpt-5.6-sol` | `high` | Canal autenticado permanente y cola admin | Alto |
| E19 | Invitación beta | `gpt-5.6-terra` | `high` | Query params, copy y correo temporal | Medio |
| E20 | Bienvenida provisional | `gpt-5.6-terra` | `medium` | Banner por sesión, reemplazable | Medio |
| E21 | Candidato de lanzamiento | `gpt-5.6-sol` | `xhigh` | QA integral y go/no-go de staging | Alto |
| E22 | Corte gradual | `gpt-5.6-sol` | `xhigh` | Producción canónica con rollback | Crítico |
| E23 | Retiro del legado | `gpt-5.6-sol` | `xhigh` | Menos deuda sin perder recuperación | Crítico |

## 9. Etapas detalladas

### E00 — Congelar decisiones y línea base

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-luna`.
- **Esfuerzo:** `medium`.
- **Motivo:** es documentación, inventario y verificación mediante comandos deterministas; no hay diseño de código ni escritura remota.
- **Escalar solo si:** los documentos activos contienen contradicciones nuevas que no puede resolver la precedencia. En ese caso usar `gpt-5.6-terra` con `medium`, no Astra.

**Objetivo**  
Eliminar contradicciones documentales y producir una fotografía reproducible antes de cambiar comportamiento.

**Entradas obligatorias**

- Este plan.
- Los tres documentos de `docs/producto/` citados en la sección 2.
- `docs/modernizacion/estado.md` y `decisiones.md`.

**Trabajo**

1. Añadir a `decisiones-abiertas-biblioteca-2026-09-13.md` una advertencia visible de archivo: las etapas 1–11 fueron respondidas; 12–13 se resuelven por este plan salvo cambio explícito.
2. Actualizar el documento de resoluciones con las cadenas finales, tipos, slugs, ficha compartida, beta y reportes.
3. Registrar las resoluciones derivadas de la sección 5 como tales, para distinguirlas de citas del equipo.
4. Capturar rama, commit base, `git status --short`, versión de Node/npm/Supabase CLI y variables requeridas sin mostrar secretos.
5. Ejecutar `npm test`, `npm run build` y, si el fixture sigue disponible, `npm run test:browser`.
6. Guardar el resultado en `docs/modernizacion/estado.md` con fecha real.
7. Enumerar flags vigentes y nuevos flags previstos; todavía no crearlos.

**No hacer**

- No cambiar código de producto, migraciones ni datos.
- No limpiar el worktree.
- No declarar staging validado.

**Aceptación**

- Ningún documento activo llama “abierta” a una decisión cerrada.
- Los tres comandos de verificación tienen resultado registrado.
- Existe un inventario de cambios locales y no se perdió ninguno.
- Las seis resoluciones derivadas están visibles y susceptibles de corrección explícita.

**Rollback**  
Solo documentación; revertir el diff documental si contiene una atribución incorrecta.

**Relevo a E01**  
Commit/base identificado, matriz de decisiones y lista exacta de migraciones/flags pendientes.

---

### E01 — Validar staging, roles y recuperación existentes

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** coordina CLI, estado remoto, Auth, RLS, Storage, funciones y restore, pero todavía no diseña el contrato canónico nuevo.
- **Escalar solo si:** aparece drift remoto, una policy contradictoria, una función privilegiada inesperada o conteos distintos después de restaurar. Continuar en un chat nuevo con `gpt-5.6-sol` en `xhigh` usando la evidencia ya recogida.

**Depende de:** E00.

**Objetivo**  
Comprobar lo ya construido en Fases 4–5 antes de diseñar encima y demostrar que staging es recuperable.

**Precondiciones**

- Acceso autenticado a staging y a su backup.
- Confirmación inequívoca del project ref; nunca usar producción por descarte.
- Segunda persona disponible para verificar acceso al respaldo cuando se ejecute el simulacro.

**Trabajo**

1. Consultar changelog y documentación vigentes de Supabase para Auth, Edge Functions, RLS, Storage, CLI y backups.
2. Ejecutar comandos `--help` antes de usar el CLI; registrar la versión instalada y cualquier diferencia con la versión recomendada.
3. Generar un backup de staging con checksum y manifiesto sin exponer credenciales.
4. Comparar `supabase migration list` local/remoto; detenerse ante migraciones remotas desconocidas.
5. Aplicar en staging las migraciones de Fases 4 y 5 pendientes, en el orden versionado.
6. Desplegar `login-with-username` e `inspect-release-source` con secretos del entorno, nunca del cliente.
7. Crear/configurar el bucket privado requerido por Fase 5 solo si la migración no lo resolvió y validar MIME/tamaño/RLS.
8. Preparar cuentas de prueba `admin`, `colaborador` y `comunidad` mediante una operación administrativa auditable.
9. Verificar registro, confirmación, login por username, recuperación y mensajes no enumerativos.
10. Verificar crates públicos/privados, propiedad y escritura por `release_id`.
11. Verificar que comunidad no lee aportes ajenos ni publica; comprobar el comportamiento actual de colaborador/admin como línea base.
12. Ejecutar advisors de seguridad/rendimiento disponibles y resolver hallazgos causados por estas migraciones.
13. Restaurar el backup en una base aislada y comprobar conteos/migraciones/pruebas según `operacion-fase-6.md`.

**Condiciones de parada**

- Project ref ambiguo.
- Backup fallido o no verificable.
- Drift remoto no explicado.
- Una política permite lectura/escritura entre usuarios.
- Una función privilegiada es ejecutable por `anon`/`authenticated` sin contrato expreso.

**Aceptación**

- Matriz por rol y operación con permitido/denegado real.
- Restore drill exitoso y firmado.
- Fases 4–5 activables en staging mediante flags, no en producción.
- Cero hallazgos críticos de advisors sin resolución.

**Rollback**  
Recompilar staging con catálogo legado y editorial deshabilitada. No revertir migraciones destructivamente; corregir con otra migración.

**Relevo a E02**  
Esquema remoto confirmado, versiones de migración, roles de prueba, limitaciones del entorno y evidencia de restauración.

---

### E02 — Contrato canónico v2: créditos, tipos e identidad

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `xhigh`.
- **Motivo:** cambia constraints, relaciones, compatibilidad e importación; es una de las pocas etapas que justifica el techo de razonamiento disponible sin usar Astra, porque un error silencioso puede duplicar o perder identidad editorial.
- **Escalar solo si:** la reescritura de datos existentes, las colisiones o RLS no caben en una migración determinista probada localmente. No hay escalamiento de modelo: dividir el problema y pedir decisión humana sobre la ambigüedad.

**Depende de:** E01.

**Objetivo**  
Hacer que PostgreSQL pueda representar sin pérdida las decisiones editoriales antes de adaptar formularios e interfaz pública.

**Trabajo de esquema**

1. Trabajar primero en base local aislada. Crear la migración final mediante el flujo imperativo del proyecto, no inventando un nombre manual.
2. Reducir la taxonomía efectiva de `release_artists.role` a `primary` y `collaborator`; migrar `featured`, `remixer` y `other` a `collaborator`.
3. Conservar `position` dentro de cada grupo y evitar duplicados de la misma persona en un release. Si una persona estaba en ambos grupos, `primary` prevalece y el caso se registra para revisión.
4. Sembrar los cinco tipos canónicos con slugs estables; mapear `Disco`/`Album` a `Álbum` en importación y contribuciones.
5. Quitar de las rutas de escritura cualquier `insert` automático de tipos desconocidos. Un valor desconocido produce un error editorial claro o un rechazo de importación.
6. Ampliar `catalog_releases` para exponer `primary_artists` y `collaborators` como listas ordenadas con `id`, `slug`, `name` y `position`.
7. Mantener temporalmente `artists` como campo de compatibilidad documentado; debe derivarse de los principales y no ser la única fuente nueva.
8. Añadir un estado de calidad de créditos (`legacy`, `proposed`, `verified`) o una representación relacional equivalente que no confunda “sin colaboradores” con “todavía no auditado”.
9. Distinguir alias de migración y redirects editoriales futuros mediante un campo controlado; documentar su prioridad.
10. Confirmar constraints, FKs, índices para páginas de artista y lookup de slugs/aliases.
11. Mantener RLS en toda tabla expuesta, grants explícitos y vista `security_invoker`.
12. Actualizar importador idempotente y fixtures para el nuevo contrato sin mutar la fuente TSV.

**Pruebas mínimas**

- Conversión de cada rol viejo.
- Persona duplicada en dos roles.
- Orden independiente de principales y colaboradores.
- Los cinco tipos válidos; rechazo de `Mixtape` u otro arbitrario.
- `Disco` se convierte en `Álbum` sin crear un release nuevo.
- Lectura anónima solo de published.
- Slug canónico prevalece sobre alias colisionado.
- Importación dos veces no duplica entidades ni relaciones.

**No hacer**

- No inferir colaboradores todavía.
- No aplicar a producción.
- No retirar `artists`, TSV, aliases ni `lanzamiento_slug`.

**Aceptación**

- El esquema representa dos grupos y cinco tipos sin JSON opaco como fuente primaria.
- La vista pública y el importador pasan pruebas locales.
- Advisors sin errores críticos.
- Migración reversible operativamente mediante backup y corrección posterior.

**Relevo a E03**  
Forma exacta de la vista, migration version, mapa de compatibilidad y casos de datos que quedaron en revisión.

---

### E03 — Dominio de cliente y política única de URLs

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** es un refactor de varios consumidores con compatibilidad dual y casos límite de identidad, pero las reglas ya están fijadas por E02.
- **Escalar solo si:** unificar resolvedores exige cambiar escrituras, políticas de DB o semántica de aliases. Volver primero a E02 en un chat nuevo con `gpt-5.6-sol` en `xhigh`.

**Depende de:** E02.

**Objetivo**  
Evitar que cada componente interprete por su cuenta artistas, tipos, fechas y slugs.

**Trabajo**

1. Crear un contrato TypeScript de dominio, por ejemplo `Release`, `ArtistCredit`, `CreditQuality` y `ReleaseType`; no ampliar indefinidamente `Lanzamiento` histórico.
2. Mapear la vista canónica al contrato sin perder IDs/slugs de artistas ni posiciones.
3. Crear un adaptador legado explícito: todos los nombres TSV quedan temporalmente como principales y `creditQuality='legacy'`; no se adivinan colaboradores en el navegador.
4. Para `Compilado`, separar presentación de relaciones: el label visible es `Varios artistas`, pero la lista completa sigue disponible.
5. Centralizar fecha ISO ↔ presentación; no distribuir conversiones `DD/MM/YYYY` por componentes nuevos.
6. Centralizar `resolveReleaseBySlug` con precedencia canónico → alias único → no encontrado/ambiguo.
7. Hacer que ruta completa, modal, crates, artista y sello consuman el mismo resolvedor/repositorio.
8. Eliminar en escrituras nuevas el cálculo `título + primer artista`; conservarlo solo en una función marcada legacy.
9. Hacer que una página de artista incluya releases donde aparece como principal o colaborador.
10. Añadir tests de contrato para fuente legacy y canonical.

**Aceptación**

- Ningún componente nuevo necesita conocer columnas de Supabase ni parsear TSV.
- Cambiar un crédito no cambia `release.id`, slug ni crate.
- Modal/ruta resuelven igual canonical, alias único, colisión y desconocido.
- Artistas colaboradores tienen discografía navegable.

**Rollback**  
El flag de fuente sigue permitiendo legacy; el adaptador anterior puede reactivarse sin alterar datos.

**Relevo**  
Tipos exportados, tabla de compatibilidad y API exacta del repositorio.

---

### E04 — Fundaciones mínimas de interfaz y overlays

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-terra`.
- **Esfuerzo:** `high`.
- **Motivo:** trabajo frontend delimitado con accesibilidad y estados de foco bien especificados; Terra ofrece mejor relación capacidad/costo aquí.
- **Escalar solo si:** aparecen carreras de lifecycle/foco compartidas por tres o más overlays o incompatibilidades de Svelte difíciles de aislar. Usar `gpt-5.6-sol high`.

**Depende de:** E00. Debe cerrar antes de E05 y de cualquier interfaz modal nueva.

**Objetivo**  
Crear las primitivas que necesitarán tarjetas, consola, filtros, ficha, reportes y beta sin rediseñar todo el sitio.

**Trabajo**

1. Consolidar solo tokens necesarios: color, tipografía, foco, radios, capas, backdrop, espaciado, targets táctiles y breakpoints semánticos.
2. Definir variantes mínimas de botón/enlace: primario, secundario, discreto, icono y destructivo.
3. Crear primitivas reutilizables para `Dialog`, `Sheet` y menú desplegable con:
   - foco inicial;
   - contención de Tab/Shift+Tab;
   - Escape;
   - retorno de foco;
   - bloqueo/restauración de scroll;
   - backdrop consistente;
   - `aria-labelledby`/`aria-describedby`;
   - soporte de `prefers-reduced-motion`.
4. Garantizar 44 × 44 px de área táctil donde corresponda sin inflar necesariamente el dibujo visual.
5. Crear pruebas de teclado para cada primitiva.

**No hacer**

- No migrar todos los formularios ni botones del producto.
- No cambiar la dirección de arte.
- No implementar todavía swipe, beta o ficha.

**Aceptación**

- Las primitivas funcionan aisladas a 360 px y desktop.
- No hay interacción posible con el fondo de un overlay modal.
- El foco vuelve al disparador exacto.
- Los consumidores pueden variar composición sin copiar lógica accesible.

**Relevo**  
API de componentes, tokens y ejemplo mínimo de uso.

---

### E05 — Créditos públicos en tarjetas y páginas de artista

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-terra`.
- **Esfuerzo:** `medium`.
- **Motivo:** las reglas visuales y fixtures están cerrados; el trabajo es mayormente composición Svelte/CSS y pruebas responsive.
- **Escalar solo si:** la tarjeta existente produce interacciones cruzadas difíciles de separar. Probar primero `high` con Terra; después `gpt-5.6-sol high`.

**Depende de:** E03 y E04.

**Objetivo**  
Hacer visible la razón por la que un release pertenece a un artista sin esperar la ficha completa.

**Trabajo**

1. Crear un componente específico de resumen de créditos para tarjeta.
2. Aplicar reglas de compilado, 1–3 principales, 4+ principales, colaborador único y varios colaboradores.
3. Usar línea vertical discreta, jerarquía de contraste/peso y máximo dos líneas del bloque de créditos.
4. Mantener el nombre completo en nombre accesible y destino de enlace aun con truncado.
5. Limitar título de tarjeta a tres líneas; `overflow-wrap:anywhere`, elipsis y sin expansión horizontal.
6. Reparar esquinas/borde de hover: portada superior recta y esquinas inferiores exteriores redondeadas según decisión.
7. Ajustar páginas de artista para mostrar releases por ambos roles sin duplicarlos.
8. Añadir fixtures para cuatro casos de créditos y nombres/títulos largos.

**Pruebas**

- Un principal + un colaborador.
- Dos principales + un colaborador.
- Un principal + dos colaboradores.
- Cuatro principales no compilado.
- Compilado.
- Teclado sobre todos los nombres y el control `Varios artistas`.
- 360, 390, 768 y 1440 px sin scroll horizontal.

**No hacer**

- No modificar modal/página completa; E16 los unifica.
- No inferir roles.

**Aceptación**

- Buscar a un colaborador devuelve un release cuya tarjeta permite reconocerlo.
- La tarjeta no oculta la autoría principal.
- Ningún caso excede dos líneas de créditos o tres de título.

---

### E06 — Servicio de mutaciones administrativas auditadas

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `xhigh`.
- **Motivo:** combina autorización, funciones privilegiadas, transacciones, concurrencia, versionado y rollback; es uno de los puntos donde ahorrar modelo aumenta el riesgo total.
- **Escalar solo si:** no hay escalamiento automático. Ante una garantía de seguridad/integridad no demostrable, detenerse y dividir diseño, migración y verificación antes de considerar más esfuerzo.

**Depende de:** E02 y E01.

**Objetivo**  
Permitir administrar el catálogo sin abrir el Dashboard o editar tablas crudas, con historial y reversión.

**Trabajo**

1. Diseñar `catalog_change_sets`/`catalog_change_events` o equivalente con actor, operación, entidad, before, after, razón, estado y timestamps.
2. Implementar operaciones transaccionales de administrador para crear, editar, publicar, archivar y corregir releases y relaciones.
3. Prohibir borrado físico desde la interfaz.
4. Validar tipos estáticos, campos obligatorios, URLs permitidas, radar 0–5 y relaciones existentes.
5. Conservar `release_id` y slug al editar metadata/créditos.
6. Para cambio excepcional de slug, exigir operación distinta que cree redirect editorial permanente y rechace colisiones canónicas.
7. Implementar reversión como nuevo change set compensatorio con precondición de versión para evitar pisar ediciones posteriores.
8. Usar autorización administrativa en servidor/RPC; no confiar en rol de `user_metadata` ni en botones ocultos.
9. Revocar ejecución pública por defecto de funciones privilegiadas y fijar `search_path` seguro cuando aplique.
10. Probar concurrencia: dos editores no pueden sobrescribirse silenciosamente.

**Aceptación**

- Cada cambio visible tiene actor y before/after.
- Un usuario comunidad/anon no invoca ninguna mutación.
- Una reversión no borra historia ni revive datos más antiguos sobre una versión nueva sin advertencia.
- Crear y editar respeta tipos, roles, slug e identidad.

**Rollback**  
Deshabilitar la interfaz/funciones por flag o grants; los eventos ya escritos permanecen.

**Relevo**  
Contrato de servicio, estado de conflicto y ejemplos de payload válidos.

---

### E07 — Consola administrativa de catálogo

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** integra muchas vistas y estados sobre un backend ya cerrado; necesita buena coordinación de archivos, no rediseñar seguridad.
- **Escalar solo si:** la UI revela una carencia real del contrato de E06. No improvisar SQL desde este chat; devolver el cambio a E06 en un chat nuevo con `gpt-5.6-sol` en `xhigh`.

**Depende de:** E03, E04 y E06.

**Objetivo**  
Entregar la herramienta sencilla solicitada para ingresar, buscar, revisar y corregir datos como se hacía en Google Sheets.

**Trabajo**

1. Crear una ruta administrativa separada del flujo de propuestas, protegida para `admin` en datos y UI.
2. Vista lista paginada con búsqueda por título/artista/sello/ID/slug y filtros por estado, tipo y calidad de créditos.
3. Mostrar columnas esenciales, fecha de última edición y alertas de datos faltantes; no cargar los 2.790 releases como una tabla gigante.
4. Editor de release con título, slug de solo lectura por defecto, fecha, tipo, sello, géneros, países, radar, principales, colaboradores, fuente, portada y estado.
5. Selectores de artistas conservan ID y permiten crear entidad solo con confirmación explícita, evitando duplicados por normalización.
6. Crear release con todos los campos obligatorios y preview antes de publicar.
7. Guardar con control de versión/updated_at; ante conflicto mostrar comparación y no sobreescribir.
8. Panel de historial con actor, razón, before/after y acción `Revertir este cambio` sujeta a confirmación.
9. Confirmaciones distintas para publicar, archivar y revertir.
10. Estados de carga/error/vacío y navegación por teclado.

**No hacer**

- No añadir gestión de usuarios/infraestructura.
- No añadir creación dinámica de tipos.
- No implementar todavía inferencia masiva.

**Pruebas**

- Matriz admin/colaborador/comunidad/anon.
- Crear borrador, publicar, editar, conflicto, archivar y revertir.
- Mantener ID/slug/crate al corregir artistas.
- Navegación a 390 y 1440 px.

**Aceptación**

- Un administrador puede operar catálogo sin Dashboard ni SQL.
- Todo cambio es visible en historial y reversible.
- La consola no expone secretos ni eleva privilegios desde cliente.

---

### E08 — Inferencia, cola y migración progresiva de créditos

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `xhigh`.
- **Motivo:** mezcla datos ambiguos, heurísticas, evidencia externa, lotes reanudables y reversión. Los falsos positivos afectan el patrimonio editorial.
- **Escalar solo si:** no subir a `max` para compensar una heurística incierta. Detener el lote, reducir alcance y pedir validación editorial de nuevos casos difíciles.

**Depende de:** E06 y E07.

**Objetivo**  
Separar créditos existentes con evidencia y control administrativo, sin bloquear catálogo ni degradar datos dudosos.

**Trabajo**

1. Crear una función pura/versionada que reciba metadata ya obtenida y devuelva principales, colaboradores, evidencia, confianza y advertencias.
2. No hacer fetch arbitrario desde el navegador. Reutilizar/adaptar la Edge Function con allowlist HTTPS, redirects limitados, timeout y tamaño máximo.
3. Extraer el autor estructurado de Bandcamp antes de intentar separar texto. Separar coma/`&`/`and`/`y` solo cuando los fragmentos se pueden cruzar con créditos o entidades existentes; no dividir ciegamente porque esos caracteres pueden pertenecer a un nombre artístico.
4. Detectar vocabulario controlado en títulos/tracklist y registrar exactamente qué señal produjo cada propuesta.
5. Definir tres resultados:
   - `high`: evidencia estructurada consistente;
   - `review`: colaboración/separadores o contradicción;
   - `manual`: fuente ausente/no soportada/ambigua.
6. Priorizar no compilados con tres o más acreditados y cualquier señal `feat/remix/producer`.
7. Los high confidence pueden formar un lote, pero el lote solo se aplica tras aprobación de admin.
8. Las propuestas review/manual se editan individualmente en la consola; la fuente y evidencia se ven sin abrir varias pestañas cuando sea legal mostrarla.
9. Al aplicar, actualizar relaciones y calidad de créditos en una transacción usando E06.
10. Crear rollback de lote y de release como cambios compensatorios.
11. Ejecutar primero dry-run sobre diez lanzamientos difíciles reales; guardar expected vs proposed y aprobación editorial.
12. Procesar catálogo por lotes pequeños y reanudables; fallar una fila no revierte ni oculta las demás propuestas, pero ninguna escritura parcial queda fuera de un change set.

**Casos obligatorios**

- coautoría con `&`;
- nombre artístico que contiene `&` o coma;
- un principal + dos remixers;
- varios autores por track;
- compilado;
- fuente contradictoria;
- fuente no disponible;
- tres artistas sin palabras de colaboración;
- artista duplicado con distinta grafía;
- release ya verificado.

**Aceptación**

- Cero mutaciones durante dry-run.
- Ninguna propuesta se aplica sin actor admin.
- Los releases no revisados siguen publicados con presentación legada explícita.
- Aplicar y revertir restaura exactamente relaciones y calidad anterior.

**Relevo**  
Versión de heurística, métricas de lotes, falsos positivos conocidos y cola restante.

---

### E09 — Contrato de contribuciones v2, permisos y colas

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** el estado de aprobación y RLS deben seguir siendo correctos incluso fuera de la UI; un modelo más barato no compensa una escalada de privilegios accidental.
- **Escalar solo si:** migrar payloads existentes o demostrar las transiciones requiere resolver estados contradictorios. Subir a `xhigh` después de preservar fixtures del estado previo.

**Depende de:** E01 y E02.

**Objetivo**  
Alinear base de datos y servicios con el formulario decidido antes de reconstruir la pantalla.

**Contrato v2**

- `source_url`, `source_provider`;
- `title`;
- `primary_artists[]`;
- `collaborators[]`;
- `release_type` canónico;
- `release_date`;
- `genres[]`;
- `countries[]`;
- `label` opcional;
- `team_note` opcional;
- metadata detectada/evidencia separada del contenido confirmado;
- versión de payload.

**Trabajo**

1. Migrar payloads v1 sin fingir que fueron auditados; mapear `artists` a principales y marcar versión/calidad legada.
2. Validar obligatorios en servidor, no solo Svelte.
3. Exigir selección manual de tipo; conservar una sugerencia detectada por separado.
4. Derivar la cola del rol real del autor al enviar, no de un campo controlado por cliente.
5. Definir la máquina de estados exacta: `draft → pending`; un colaborador distinto del autor puede preparar una propuesta comunitaria como `pending → ready_for_admin`; admin puede llevar `pending|ready_for_admin → approved|rejected|changes_requested`; el autor puede corregir `changes_requested → pending`. Los estados terminales no se reabren silenciosamente.
6. Admin puede crear/publicar directamente mediante E06. Cualquier envío de colaborador/comunidad requiere aprobación final admin.
7. Impedir autoaprobación y escalamiento de rol.
8. Colaborador puede editar una copia de trabajo/añadir nota interna y marcar `ready_for_admin` solo en propuestas comunitarias ajenas; no cambia la respuesta visible al autor ni convierte ninguna propuesta en published.
9. Mantener portada detectada como evidencia; retirar del contrato público de autor `cover_url` editable y subida manual.
10. Crear índices para cola/autor/estado y policies por operación con ownership.
11. Preservar historial de cada transición.

**Pruebas de seguridad**

- Comunidad CRUD solo de sus drafts y lectura de sus aportes.
- No se edita un pending salvo transición autorizada.
- Colaborador no autoaprueba ni publica, no prepara su propia propuesta y no marca como terminal una propuesta ajena.
- Admin aprueba de forma transaccional y crea relaciones completas.
- Payload malformado, tipo desconocido o artista vacío no publica.
- UPDATE incluye política SELECT y `WITH CHECK` cuando aplique.

**Aceptación**

- DB impone el flujo aunque se invoque fuera de la UI.
- Las dos colas se distinguen sin confiar en datos editables del usuario.
- Aprobación crea un release válido con ambos grupos y tipo existente.

---

### E10 — Sugerir, borradores, Perfil y estación editorial

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** es un flujo agente de varias rutas, roles y estados, pero debe limitarse a consumir el contrato seguro de E09.
- **Escalar solo si:** las pruebas demuestran que E09 no puede representar un estado necesario. Volver a E09 con `gpt-5.6-sol` en `xhigh`; no solucionar autorización en componentes.

**Depende de:** E04 y E09.

**Objetivo**  
Completar el recorrido visible de quien propone y de quien administra la decisión.

**Trabajo en `/sugerir`**

1. Al iniciar, mostrar solo fuente y `Detectar`.
2. Aceptar exactamente una URL HTTPS de Bandcamp, Spotify o SoundCloud; mostrar microcopy de preferencia por Bandcamp.
3. No detectar automáticamente en blur si eso dispara solicitudes involuntarias; la acción explícita controla el intento.
4. Tras éxito o fallo, revelar campos. En fallo mostrar `Información no disponible` y conservar edición manual.
5. Separar principales y colaboradores; usar controles repetibles, no una cadena por comas como única representación.
6. Tipo es select requerido y vacío inicial, aunque exista sugerencia detectada.
7. Fecha, géneros y países requeridos; sello/nota opcionales.
8. No mostrar inputs de portada. Preview detectado puede aparecer como solo lectura con texto “el equipo lo verificará”.
9. Botones distintos `Guardar borrador` y `Enviar a revisión`; validar obligatorios solo al enviar.
10. Copy de éxito no promete email: `Tu propuesta quedó pendiente de revisión. Puedes consultar su estado en tu perfil.`

**Trabajo en Perfil/editorial**

1. Perfil lista borradores y aportes por estado, con retomar draft/cambios solicitados.
2. Colas separadas visual y funcionalmente para colaboradores y comunidad.
3. Revisor ve fuente, metadata detectada, payload confirmado, diferencias y nota sin múltiples pestañas cuando sea posible.
4. Colaborador solo puede preparar propuestas comunitarias ajenas y enviarlas a `ready_for_admin`; sus propios aportes aparecen en la cola prioritaria sin controles de revisión.
5. Solo admin ve solicitar cambios, rechazar y publicar.
6. Rechazo/cambios solicitados exigen nota; aprobar muestra resumen del release final.

**Pruebas**

- Detección exitosa/fallida/lenta.
- Guardar y retomar draft.
- Validación de cada obligatorio.
- Matriz de permisos y colas.
- Foco/error accesible y viewport 390 px.

**Aceptación**

- Un aporte puede completarse de punta a punta sin portada del usuario.
- El estado reaparece en Perfil.
- Ningún rol ve una acción que DB deba rechazar como camino normal.

---

### E11 — Motor puro de coincidencia y Radar

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** exige razonamiento algorítmico y muchos casos límite, pero está aislado en funciones puras y tiene un contrato de tests detallado.
- **Escalar solo si:** fixtures válidos exponen una contradicción entre prioridad lexicográfica, grupo exacto/aproximado y compuerta Radar. Usar `gpt-5.6-sol` en `xhigh` para resolver el contrato antes de seguir codificando.

**Depende de:** E03.

**Objetivo**  
Sustituir el filtro booleano por una evaluación determinista y comprobable, separada de Svelte.

**Contrato del motor**

Para cada release produce:

- elegible/no elegible;
- grupo `exact` o `approximate`;
- coincidencias por categoría;
- vector de relevancia;
- distancia Radar;
- razones legibles para tests/debug, no visibles como puntaje público.

**Reglas**

1. Sin criterios: todos elegibles y fecha descendente.
2. Dentro de género/país con varias selecciones, cualquier valor aporta coincidencia; cumplir todos es necesario para exactitud y una fracción mayor mejora relevancia.
3. Entre categorías activas, exacto cumple todas por completo.
4. Aproximado cumple al menos una categoría.
5. Prioridad lexicográfica: texto, género, Radar, país, tipo, año. No usar pesos pequeños que permitan a muchas señales inferiores superar accidentalmente una superior.
6. Sugerencia tipada de artista/sello/release usa identidad exacta. Texto libre usa normalización y grados exacto → prefijo → contiene; no confunde entidades seleccionadas con substring.
7. Normalización cubre mayúsculas, tildes, `ñ` y un mapa explícito de `ø`, `ł`, `ß` y otras grafías decididas; no modifica el nombre visible.
8. Radar activo aplica compuerta de diferencia máxima 1 por eje activo. Dentro, menor distancia va primero cuando orden efectivo es Radar.
9. No ensanchar margen ni completar con candidatos arbitrarios.
10. Exactos siempre preceden aproximados.
11. Orden `Mejor coincidencia`: vector de relevancia, luego fecha descendente, luego ID estable.
12. Orden explícito de fecha: grupo, fecha, ID. Orden Radar: grupo, distancia, vector, fecha, ID.

**Pruebas obligatorias**

- `Julio Victoria + reggaetón` con exacto, parciales de cada criterio y cero coincidencias.
- Dos géneros donde un release cumple uno y otro cumple ambos.
- Coincidencia de texto de mayor prioridad contra varias señales inferiores.
- Radar exacto, ±1 y un eje a ±2 excluido.
- Radar con cero candidatos.
- Tildes, `ñ`, `ø`, `ł`, `ß`.
- Empates estables.
- Ningún criterio activo.

**No hacer**

- No tocar layout ni copy.
- No mostrar score.
- No consultar popularidad.

**Aceptación**

- Todas las reglas viven en funciones puras con fixtures.
- `+page.svelte` no contiene una segunda implementación de ranking.
- Repetir la misma entrada produce el mismo orden.

---

### E12 — Estado de búsqueda, URL, sugerencias y retiro de Mes

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-terra`.
- **Esfuerzo:** `high`.
- **Motivo:** parser/serializer y sugerencias son trabajo delimitado y altamente comprobable, aunque hay compatibilidad con enlaces antiguos.
- **Escalar solo si:** aparecen interacciones no deterministas entre navegación, modal y estado reactivo. Usar `gpt-5.6-sol high` y conservar primero los tests de URLs.

**Depende de:** E11.

**Objetivo**  
Hacer que controles, URL y motor compartan una sola semántica antes de componer resultados.

**Trabajo**

1. Definir un tipo único `SearchState` y serializador/parser de query params.
2. Eliminar Mes del estado, URL nueva, pills, formulario y manual; durante transición ignorar un `mes` viejo sin romper la página.
3. Conservar `texto`, entidades tipadas, género, país, tipo, año, Radar, orden, página y modal.
4. Una sugerencia de artista/sello/release guarda tipo e ID/slug; no se reduce a texto.
5. Ordenar sugerencias exacta → prefijo → contiene, luego alfabético con `localeCompare('es')`; sin popularidad.
6. Géneros/países se ordenan sin sensibilidad a mayúsculas/tildes.
7. Estado de orden:
   - limpio → `fecha-desc`;
   - primer criterio no Radar → `match`;
   - activar Radar → `radar`;
   - elegir fecha conserva esa elección hasta que el cambio la vuelva inválida;
   - limpiar último criterio → `fecha-desc`.
8. Ocultar A–Z/Z–A si el resultado contiene aproximados; si estaban seleccionados, cambiar al orden efectivo adecuado y anunciar el cambio a tecnología asistiva.
9. Cualquier cambio de criterio vuelve a página 1; página/orden conservan URL compartible.
10. Añadir tests de parse/serialize idempotente y URLs legadas.

**Aceptación**

- Copiar/pegar URL reconstruye el mismo estado.
- Elegir artista exacto no devuelve nombres que solo lo contienen.
- `mes` deja de afectar resultados sin hacer fallar enlaces viejos.
- Los params beta todavía no se implementan, pero el serializador preserva params desconocidos hasta que E19 defina su limpieza.

---

### E13 — Barra, grupos, contador, orden y paginación

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-terra`.
- **Esfuerzo:** `high`.
- **Motivo:** es UI con una matriz de estados explícita; el riesgo se controla mejor con fixtures de bordes de página que con un modelo insignia.
- **Escalar solo si:** paginación, URL y reactividad producen una carrera reproducible que Terra no resuelve en dos intentos. Usar `gpt-5.6-sol high`.

**Depende de:** E04, E11 y E12.

**Objetivo**  
Presentar honestamente la salida del motor sin duplicar lógica de búsqueda en el markup.

**Trabajo**

1. Sacar `Ordenar por` de `Filtros.svelte`.
2. Desktop: una fila normal alineada con grilla, paginación izquierda y orden derecha.
3. Móvil: paginación y orden en filas separadas; selector pequeño pero con target accesible.
4. Segunda fila solo cuando hay contexto aproximado.
5. Renderizar los tres estados:
   - normal/exactos: sin aviso superior, contador final;
   - solo aproximados: frase completa superior, sin contador redundante;
   - exactos + aproximados: separador corto en la transición y contador final.
6. Paginar la secuencia ya agrupada. Si el límite cae entre grupos, preservar contexto según 4.1.
7. Mantener paginación arriba y abajo.
8. Cambiar orden o página desplaza al inicio exacto de la grilla después de actualizar DOM; respetar `prefers-reduced-motion`.
9. El selector solo ofrece órdenes válidos para el estado actual.
10. Actualizar `aria-live` con cantidad/grupo sin leer toda la grilla.

**Pruebas**

- Cero, solo exactos, solo aproximados, mezcla con transición en misma página y transición entre páginas.
- Desktop/móvil.
- Cambio de página/orden y posición de scroll.
- URL conserva estado.

**Aceptación**

- Nunca se presenta un aproximado como exacto.
- No existe una fila superior vacía.
- El contador no duplica el aviso.
- El orden visual coincide con el valor del selector.

---

### E14 — Jerarquía y comportamiento del header global

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-terra`.
- **Esfuerzo:** `medium`.
- **Motivo:** jerarquía, CSS, scroll y teclado están especificados y no tocan datos.
- **Escalar solo si:** `visualViewport`, foco y scroll generan saltos distintos entre navegadores. Subir primero Terra a `high`; luego usar `gpt-5.6-sol high`.

**Depende de:** E04.

**Objetivo**  
Resolver la navegación global antes de apilar una barra Buscar móvil.

**Trabajo**

1. Anónimo: `Sugerir`, `Entrar` como último primario y menú.
2. Autenticado: conservar Perfil, Mis crates y Salir como agrupación reconocible; secundarios en menú.
3. Menú contiene Manual, Blog, Substack e Instagram; footer sigue disponible.
4. `Sugerir` permanece visible. Sin sesión lleva a login/registro con retorno a `/sugerir`.
5. Iconos acompañan texto; nunca son el único nombre accesible.
6. Desktop conserva ocultar/reaparecer actual si es estable.
7. Móvil: header visible en inicio; al bajar se oculta y no reaparece hasta `scrollY=0`. No responder a microvariaciones de 1–2 px.
8. Congelar detección de scroll con menú abierto, input enfocado o cambio fuerte de `visualViewport` por teclado.
9. Corregir targets táctiles y foco del menú.

**Pruebas**

- Anónimo/autenticado a 360 y desktop.
- Scroll abajo/arriba/intermedio/inicio.
- Menú abierto, teclado móvil y retorno de foco.

**Aceptación**

- Acciones primarias no compiten con enlaces sociales.
- El header móvil no aparece detrás/encima de un overlay ni salta con teclado.
- E15 puede calcular su posición sin depender de heurísticas del header.

---

### E15 — Barra Buscar, pills y hoja móvil

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** combina medidas responsive, gestos, sheet, foco, teclado y scroll; necesita coordinación robusta de comportamiento más que trabajo visual mecánico.
- **Escalar solo si:** las diferencias de pointer/visualViewport entre navegadores persisten con pruebas reproducibles. Subir Sol a `xhigh`; si sigue fallando, aislar el caso y no continuar a ciegas.

**Depende de:** E13, E14 y E04.

**Objetivo**  
Convertir búsqueda móvil en una herramienta persistente y predecible sin tapar catálogo.

**Trabajo**

1. Reemplazar FAB por barra secundaria `Buscar` sobre la grilla con badge de filtros activos.
2. Al bajar se oculta; tras 24 px acumulados de scroll ascendente reaparece. En `scrollY=0` convive debajo del header; en intermedio aparece sola.
3. Congelar auto-hide con sheet abierto, foco dentro de campo o teclado detectado por `visualViewport`.
4. Fuera del sheet, medir pills con `ResizeObserver`: una sola fila, sin scroll horizontal, y control `+N` para las ocultas.
5. `+N` y `Buscar` abren el mismo sheet.
6. Dentro, encabezado + todas las pills permanecen fijos; solo formulario hace scroll.
7. País/Género conservan listas/tags; Radar empieza colapsado; cambios aplican inmediatamente.
8. Usar la primitiva Sheet de E04 y devolver foco al disparador exacto.
9. Swipe solo desde handle/header. Cerrar si desplazamiento vertical ≥72 px o velocidad descendente ≥0,5 px/ms después de 24 px; cancelar si el gesto es principalmente horizontal.
10. No iniciar swipe desde cuerpo desplazable.
11. Reparar cambio de ancho bloqueando scroll de fondo sin remover espacio de scrollbar de manera brusca.
12. Mantener safe area inferior y footer sin interferencia.

**Pruebas**

- 360 × 800, 390 × 844, 768 y orientación horizontal.
- Pills largas, 0/1/muchas pills y redimensionamiento.
- Scroll, swipe válido/cancelado, teclado, Escape, backdrop y foco.
- Cambios instantáneos preservan URL/resultados.

**Aceptación**

- Buscar siempre es recuperable con scroll ascendente sin traer el header intermedio.
- No hay wrap ni scroll horizontal de pills.
- El contenido del sheet puede desplazarse sin cerrarlo accidentalmente.

---

### E16 — Componente compartido de ficha, geometría y reproductor

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `xhigh`.
- **Motivo:** refactoriza dos componentes grandes, overlays, scroll, crates y tres proveedores cross-origin; requiere profundidad, pero no cambia autorización ni esquema.
- **Escalar solo si:** no se puede demostrar la estabilidad de scroll/iframe o la propiedad de estado entre wrappers. Mantener Sol en `xhigh` sobre un caso reproducible, no reescribir la ficha a ciegas.

**Depende de:** E03, E04 y E05.

**Objetivo**  
Eliminar la divergencia entre modal y página completa y cumplir la geometría aprobada.

**Trabajo**

1. Crear un único componente de contenido `ReleaseDetail` con `mode='modal'|'page'` y datos de dominio; los wrappers gestionan overlay/ruta.
2. Compartir credits, metadata, fecha `es-CO`, acciones, reproductor y slot de recomendaciones.
3. Modal desktop: tamaño estable; portada fija; solo columna derecha con scroll.
4. Página desktop: mismo contenido/fuente, fondo y navegación propios; puede usar composición amplia sin copiar markup.
5. Móvil: portada e información en un recorrido vertical único, sin portada sticky.
6. Título completo en modal/página, peso 700, saltos editoriales preservados y palabras largas partidas sin scroll.
7. Mostrar créditos completos y enlaces independientes; la tarjeta sigue siendo la versión abreviada.
8. Comprar, Añadir a crate y Compartir en una fila desplazable con el contenido, no fija.
9. El menú de crates se monta/posiciona de modo que overflow de la columna no lo recorte.
10. Mantener embed grande de Bandcamp y altura actual o crecimiento mínimo documentado.
11. Tratar el iframe como cross-origin: no intentar leer eventos o DOM internos. Mantener fija la geometría exterior y usar `overflow-anchor: none` en el bloque del player. Guardar `scrollTop` al enfocar/entrar al elemento iframe; observar `load` y cambios de tamaño del contenedor desde el padre y restaurar en los siguientes frames si el navegador movió la columna.
12. Cada mount crea reproductor nuevo; cerrar/desmontar detiene esa instancia.

**Pruebas**

- Paridad de texto/fecha/créditos/acciones entre modos con el mismo fixture.
- Contenido corto/largo y títulos extremos.
- Bandcamp, Spotify, SoundCloud y sin player.
- Portada fija desktop, recorrido único móvil.
- Crate menu no recortado.
- Scroll no cambia al seleccionar pista.

**Aceptación**

- No quedan dos implementaciones de contenido editorial.
- Diferencias entre modal/página son explícitas por modo/wrapper.
- Cero scroll horizontal y posición estable de reproductor.

---

### E17 — Recomendaciones y sesión de historial modal

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** la recomendación es pura, pero el historial, apertura directa, Back/Forward, foco y restauración de scroll requieren razonamiento de estado.
- **Escalar solo si:** el historial del navegador viola un invariante con un caso reproducible. Usar `gpt-5.6-sol` en `xhigh` para rediseñar la máquina de estados y sus tests.

**Depende de:** E11 y E16.

**Objetivo**  
Añadir descubrimiento dentro de la ficha sin perder búsqueda, filtros ni posición subyacente.

**Trabajo**

1. Crear función pura de recomendaciones que ignora filtros activos.
2. Recomendación 1: candidatos que comparten al menos un género; menor distancia Radar.
3. Recomendación 2: menor distancia Radar entre restantes, sin requisito de género.
4. Excluir release actual, primera recomendación y duplicados por `release_id`.
5. Empates: orden pseudoaleatorio estable derivado de `release_id actual + slot + release_id candidato`; no usar `Math.random()` en render.
6. Si faltan candidatos válidos, mostrar uno o ninguno; nunca rellenar arbitrariamente.
7. Fila compacta con miniportada, título y artista; máximo dos al final de ficha.
8. Modal: abrir recomendación hace `pushState` de un nuevo `modal=slug` y reemplaza contenido sin cerrar overlay.
9. Atrás/Adelante recorre releases de la sesión.
10. Guardar al abrir la URL base, SearchState y scroll subyacente.
11. Cerrar vuelve a la entrada base de la sesión y restaura estado/scroll exactos. Una URL directa sin base local elimina solo `modal` y conserva filtros.
12. Página completa navega a otra ruta completa; browser Back usa historial normal.
13. Gestionar foco: al reemplazar contenido, foco al encabezado de ficha; al cerrar, disparador original si existe.

**Pruebas**

- Reglas 1/2, exclusiones y empate estable.
- Abrir A → recomendar B → C → Back → B → Back → A → cerrar.
- Forward vuelve a abrir según historial.
- Filtros/URL/scroll no cambian.
- Modal directa y release sin Radar/género.

**Aceptación**

- Exactamente 0–2 recomendaciones sin duplicados.
- Historial no destruye contexto del catálogo.
- Cerrar restaura scroll con tolerancia máxima de 1 px después de layout estable.

---

### E18 — Reportar un problema de forma permanente

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `high`.
- **Motivo:** cruza RLS, Storage privado, contexto técnico, privacidad, limpieza y cola admin. El formulario es sencillo; la frontera de confianza no lo es.
- **Escalar solo si:** las policies de subida/adjunto/limpieza no se pueden demostrar sin privilegios excesivos. Subir a `xhigh` y separar Storage del flujo de reporte antes de continuar.

**Depende de:** E01, E04 y E06.

**Objetivo**  
Crear el canal autenticado para catálogo, bugs y feedback general antes de invitar beta testers.

**Trabajo de datos**

1. Crear tabla de reportes con ID, autor, categoría, descripción, URL, release_id opcional, contexto JSON validado, screenshot path opcional, estado, asignación/notas admin y timestamps.
2. Categorías canónicas: `catalog_error`, `technical_bug`, `general_feedback`.
3. RLS: autor inserta/lee propios; admin lee/clasifica/responde; anon no accede; el autor no cambia actor/estado administrativo.
4. Bucket privado de capturas, MIME JPEG/PNG/WebP, máximo 5 MB, sin upsert y con policies ligadas al reporte/autor.
5. Flujo tolerante a fallos: crear primero el reporte sin captura, subir después a una ruta derivada de autor/reporte y adjuntarla mediante una operación autorizada. Si la subida falla, conservar el reporte y permitir reintento; limpiar objetos huérfanos con un job no destructivo/revisable.
6. Historial de cambio de estado administrativo.

**Trabajo de interfaz**

1. Acción discreta permanente en un lugar consistente, más acceso contextual desde ficha con release_id.
2. Sin sesión, redirigir a login con retorno a la URL actual.
3. Formulario: categoría, descripción requerida y captura opcional; URL/release/contexto no se editan salvo una vista resumida.
4. Contexto permitido: ruta, release_id, timestamp, app version, catalog source, user agent, viewport, locale y online state.
5. Aviso: se adjunta contexto técnico; no cookies, tokens, contraseñas ni contenido de otros campos.
6. Cola admin separada o pestaña de `/editorial` con filtros, estado y respuesta interna.
7. La respuesta puede registrarse aunque no haya email automático; no prometer notificación que no existe.

**Pruebas**

- RLS por rol.
- Reporte general y contextual.
- Screenshot válido/inválido/grande.
- Login con retorno.
- Contexto no contiene claves sensibles.
- Admin clasifica; otro usuario no lee.

**Aceptación**

- Un reporte se crea sin exponer datos privados.
- Admin puede procesarlo sin Dashboard.
- El enlace es permanente pero no compite visualmente con acciones principales.

---

### E19 — Invitación beta temporal

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-terra`.
- **Esfuerzo:** `high`.
- **Motivo:** query params, Unicode, XSS, foco y limpieza de historial están delimitados por una matriz exhaustiva.
- **Escalar solo si:** el parser compartido de E12 no puede conservar filtros y retirar beta de forma idempotente. Usar `gpt-5.6-sol` en `high`; si aparece una brecha de seguridad distinta, detenerse y devolverla a su etapa de origen.

**Depende de:** E04, E12, E14 y E18.

**Objetivo**  
Implementar el contrato exacto de URLs y una invitación reemplazable sin contaminar navegación normal.

**Trabajo**

1. Proteger con `VITE_BETA_INVITATION_ENABLED`; desactivado no muestra ni interpreta interfaz, aunque preserva el resto de URL.
2. Parser exclusivo de home con matriz:
   - `/?beta` válido genérico;
   - `/?beta=1` válido genérico;
   - `/?beta&nombre=María` válido personalizado;
   - `/?beta=1&nombre=李雷` válido personalizado;
   - `/?beta=true` inválido;
   - `/?nombre=Ana` ignorado;
   - `/artista/x?beta=1` ignorado.
3. Normalizar nombre según 4.8; vacío tras normalización usa versión genérica.
4. Renderizar con primitiva Dialog pequeña tipo aviso; no usar `innerHTML`.
5. Copy exacto inicial de 4.8, CTA `Explorar` y línea opcional de lanzamiento solo si existe configuración aprobada.
6. Mostrar acción email dentro de esta invitación. Reutilizar `hola@discotica.com` solo si el equipo acepta que ya es público en Privacidad; de lo contrario configurar un alias beta sin hardcodearlo.
7. Mantener acción `Reportar un problema` para quien inicia sesión; explicar sin confundir los dos canales.
8. Al cerrar, borrar `beta`/`nombre`, preservar filtros válidos y usar replaceState.
9. Cualquier navegación interna elimina/no propaga ambos params.
10. No registrar nombre ni añadir telemetría.
11. Documentar cómo retirar flag, componente, parser y copy al terminar beta.

**Pruebas**

- Toda la matriz de URLs.
- XSS como `<img onerror=...>` se presenta como texto.
- 40/41 caracteres, espacios, saltos, emoji y Unicode.
- Cierre conserva otros params y no añade entrada de historial.
- Navegación no propaga.
- Foco/teclado/móvil.

**Aceptación**

- Un enlace enviado hoy conserva contrato durante toda la beta.
- El nombre no puede ejecutar markup.
- La invitación reaparece al volver a abrir explícitamente una URL beta.

---

### E20 — Bienvenida general provisional

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-terra`.
- **Esfuerzo:** `medium`.
- **Motivo:** es una composición frontend acotada con contenido provisional y reglas claras de sesión/entrada.
- **Escalar solo si:** distinguir cold start de navegación interna falla de manera intermitente. Subir Terra a `high`; usar Sol solo si exige cambiar lifecycle global del router.

**Depende de:** E04, E12, E13 y E19.

**Objetivo**  
Construir la mecánica final con copy/arte neutral reemplazable, sin bloquear el catálogo ni competir con beta.

**Trabajo**

1. Mostrar solo en primera carga directa de `/` por sesión de pestaña (`sessionStorage`). Un estado inicial creado en el layout registra la primera ruta de arranque: si la aplicación arrancó en otra ruta y después navega a home, no se considera entrada directa.
2. Suprimir si hay filtros reconocidos, `modal`, beta válida o navegación interna.
3. Banner dentro del flujo, lo bastante bajo para dejar asomar la siguiente sección en 390 × 844 y desktop.
4. Copy provisional: título `Explora la biblioteca de Discótica`; línea `Descubre lanzamientos por género, país, año y perfil sonoro.`
5. CTA `Explorar` desplaza/enfoca la barra Buscar o comienzo de grilla y marca cerrado en sesión.
6. Cierre secundario con `aria-label="Cerrar bienvenida"`, también persistente durante sesión.
7. Placeholder visual local reemplazable, con dimensiones/aspect-ratio definidos y sin depender de red.
8. Crear props/archivo de contenido para reemplazar copy/arte sin reescribir lógica.
9. Respetar reduced motion y no instrumentar telemetría específica.

**Pruebas**

- Primera carga, recarga, cierre, nueva pestaña/sesión.
- Entrada con filtro/modal/beta e interna.
- CTA deja catálogo utilizable y foco visible.
- 360/390/768/1440 sin pantalla bloqueada.

**Aceptación**

- Nunca obliga a un clic para acceder al catálogo.
- No se superpone con invitación beta.
- Cambiar copy/arte definitivo es una sustitución acotada.

---

### E21 — Candidato de lanzamiento y QA integral en staging

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `xhigh`.
- **Motivo:** hay gran amplitud de rutas, roles, pruebas y evidencias, pero la tarea principal es integración/diagnóstico sobre contratos ya cerrados.
- **Escalar solo si:** un no-go cruza simultáneamente DB, RLS, migración y frontend y no puede atribuirse a una etapa. Continuar con `gpt-5.6-sol` en `xhigh` solo para ese análisis sistémico.

**Depende de:** E05–E20 completos y aceptados.

**Objetivo**  
Demostrar que el conjunto funciona, no solo cada pieza aislada, y producir una decisión go/no-go.

**Trabajo**

1. Activar en staging catálogo canónico, editorial, reportes y beta mediante flags documentados.
2. Ejecutar migraciones desde cero en base limpia y sobre copia del estado previo.
3. Comparar conteos, releases de muestra, artistas/sellos, tipos, crates y aliases entre legado/canónico.
4. Ejecutar `npm test`, tests nuevos, `npm run test:browser`, `npm run build`, audit de catálogo y media health.
5. Añadir matriz visual a 360, 390, 768, 1024 y 1440 para home/estados, card, modal, ruta, filtros, header, auth, sugerir, perfil, editorial, admin, reportes, beta y bienvenida.
6. Probar teclado, lector básico, zoom 200 %, reduced motion, carga lenta, offline/fallo de fuente y errores de player.
7. Verificar RLS/API con anon, comunidad, colaborador y admin, incluidos intentos negativos.
8. Ejecutar advisors Supabase y revisar índices con consultas reales/EXPLAIN si hay lentitud.
9. Ejecutar restore drill fresco incluyendo catálogo, contributions, reports y Storage.
10. Actualizar Manual, Privacidad, decisiones, estado y operación para que describan el producto real; eliminar voseo residual como `Ingresá`.
11. Registrar issues P0/P1/P2. Cualquier P0 impide corte.
12. Producir checklist de go/no-go firmado por producto y segunda persona operativa.

**Criterios go**

- Cero P0.
- Cero fuga RLS/secretos.
- Build/tests completos verdes.
- Restore comprobado.
- Cero crate nuevo basado solo en slug.
- Muestras exacto/aproximado y créditos aprobadas editorialmente.
- Rollback de flags ensayado.

**Rollback**  
Desactivar flags en staging y conservar evidencia. No maquillar un no-go bajando severidad sin resolver causa.

**Relevo**  
Artefacto de build, hashes/backups, versiones de migración, checklist y plan exacto de corte.

---

### E22 — Corte gradual a producción

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `xhigh`.
- **Motivo:** escribe en producción, coordina backups, migraciones, delta de datos, flags y rollback; el costo de una omisión supera el ahorro de modelo.
- **Escalar solo si:** no hay escalamiento automático. Si una precondición, referencia de proyecto, backup o conteo es incierto, detener el corte y pedir intervención humana; no compensar incertidumbre con más tokens.

**Depende de:** E21 con go explícito.

**Objetivo**  
Activar la plataforma canónica sin perder capacidad de retorno.

**Precondiciones**

- Aprobación explícita para escribir en producción.
- Backup fresco, checksum y restore reciente.
- Project ref verificado por dos señales.
- Ventana operativa y responsables disponibles.

**Trabajo**

1. Congelar temporalmente cambios editoriales externos o definir cómo reconciliarlos durante el corte.
2. Tomar backup final de DB, Storage, TSV/Sheet y build desplegado.
3. Aplicar migraciones en orden y verificar lista remota.
4. Desplegar Edge Functions/configuración y asignar admin de recuperación.
5. Importar/reconciliar delta del catálogo de forma idempotente.
6. Ejecutar smoke RLS, auth, crates, catálogo, ficha, propuesta, aprobación y reporte.
7. Activar `VITE_CATALOG_SOURCE=canonical`; mantener editorial/beta bajo sus flags según calendario.
8. Desplegar artefacto exacto aprobado en E21.
9. Monitorear errores, media health, reportes, auth y consultas; registrar cada incidente.
10. Ante incidente de aplicación/datos de lectura, volver a build legacy mediante flag. No revertir migraciones aplicadas durante el incidente.
11. Mantener TSV, aliases de migración y `lanzamiento_slug` durante el periodo de observación aprobado.

**Go/no-go durante corte**

- Si falla integridad, RLS, auth o crates: rollback inmediato de aplicación.
- Si falla un proveedor aislado: confirmar en navegador; no cambiar catálogo automáticamente.
- Si aparecen conteos distintos: detener activación, no rellenar ni borrar datos manualmente.

**Aceptación**

- Producción sirve catálogo canónico y flujos críticos.
- Rollback sigue disponible y probado.
- Backup y hashes del corte están fuera de los proveedores primarios.

---

### E23 — Retiro controlado del legado

**Perfil de ejecución**

- **Modelo:** `gpt-5.6-sol`.
- **Esfuerzo:** `xhigh`.
- **Motivo:** es la única etapa deliberadamente destructiva: elimina fallbacks, columnas/aliases potenciales y rutas después de demostrar que ya no protegen a nadie.
- **Escalar solo si:** no hay escalamiento automático. Falta de evidencia implica detenerse, no usar `max`. Todo borrado material conserva aprobación humana explícita.

**Depende de:** E22 y periodo de observación aprobado sin regresiones críticas.

**Objetivo**  
Retirar compatibilidad que ya no protege usuarios, sin destruir patrimonio ni capacidad de recuperación.

**Precondiciones cuantitativas**

- Cero `crate_items.release_id is null` o cada excepción tiene resolución aprobada.
- Cero rutas compartidas conocidas que dependan únicamente de alias de migración, según muestreo/logs disponibles.
- Importador canónico es la única escritura editorial activa.
- Restore canónico verificado después del corte.
- Aprobación explícita antes de cualquier borrado material.

**Trabajo**

1. Archivar TSV/JSON/Sheet y mapa de equivalencias en backup externo con checksums; retirar de runtime no significa borrar la copia histórica.
2. Eliminar fallback TSV y parseadores duplicados del cliente.
3. Retirar `VITE_CATALOG_SOURCE` si ya no cumple función de rollback; conservar un procedimiento de despliegue de artefacto anterior por tiempo documentado.
4. Retirar escritura/lectura nueva de `lanzamiento_slug`; eliminar columna solo en una migración posterior aprobada y tras verificar cero dependencias.
5. Retirar aliases con `source_kind=legacy_migration` solo después de validar el criterio; conservar redirects editoriales permanentes.
6. Retirar flags/componentes beta cuando concluya beta, independientemente de la bienvenida permanente.
7. Eliminar rutas residuales `/OTROS` y copia de artista mediante redirect o retiro explícito verificado.
8. Actualizar arquitectura, operación, README y Manual.
9. Ejecutar suite y restore una vez más.

**Condiciones de parada**

- Cualquier crate sin ID.
- Alias ambiguo aún usado.
- Backup histórico inaccesible.
- Código externo todavía consume TSV.

**Aceptación**

- El runtime no descarga ni parsea catálogo legado.
- Toda relación usa IDs.
- Los redirects editoriales siguen funcionando.
- Existe archivo recuperable del legado y documentación de restauración.

## 10. Flags y configuración previstos

Los nombres pueden ajustarse en E00 si ya existe una convención, pero no deben proliferar duplicados:

| Variable | Propósito | Retiro |
| --- | --- | --- |
| `VITE_CATALOG_SOURCE` | rollback legacy/canonical existente | E23 |
| `VITE_EDITORIAL_ENABLED` | habilitar contribuciones/editorial existente | después de estabilidad |
| `VITE_ADMIN_CATALOG_ENABLED` | consola de catálogo | puede permanecer como kill switch |
| `VITE_ISSUE_REPORTING_ENABLED` | reportes internos | puede permanecer como kill switch |
| `VITE_BETA_INVITATION_ENABLED` | invitación por params | final de beta |
| `VITE_BETA_FEEDBACK_EMAIL` | canal mostrado solo en invitación | final de beta |
| `VITE_PUBLIC_LAUNCH_LABEL` | línea opcional, no fecha inventada | reemplazo de copy |

Los flags del cliente no son autorización. RLS/servicios deben seguir negando operaciones aunque la ruta se fuerce manualmente.

## 11. Matriz de responsabilidades

| Acción | Comunidad | Colaborador | Admin |
| --- | --- | --- | --- |
| Explorar catálogo | Sí | Sí | Sí |
| Crates propios | Sí | Sí | Sí |
| Guardar/enviar aporte propio | Sí | Sí, cola prioritaria | Sí |
| Ver aportes propios | Sí | Sí | Sí |
| Preparar aportes ajenos | No | Solo cola comunitaria ajena; `ready_for_admin` | Sí |
| Aprobar publicación no administrativa | No | No | Sí |
| Publicar directamente desde consola | No | No | Sí |
| Editar catálogo publicado | No | No | Sí |
| Aprobar lote de créditos | No | No | Sí |
| Revertir cambio de catálogo | No | No | Sí |
| Crear reporte | Con sesión | Con sesión | Con sesión |
| Clasificar/responder reportes | No | No, salvo decisión posterior | Sí |

## 12. Fuera de alcance deliberado

- Cambiar de hosting.
- Reproductor global persistente.
- Popularidad, telemetría de búsquedas o recomendaciones por comportamiento.
- Colaboración social en crates, seguidores o likes.
- Tipos dinámicos de lanzamiento.
- Envíos automáticos de email por estado de aportes/reportes.
- Reemplazar embeds sin matriz de regresión.
- Crear la ilustración definitiva de bienvenida.
- Instrumentar una fecha de lanzamiento no aprobada.

## 13. Mensajes para iniciar cada chat

Los 24 prompts ya rellenados, uno por etapa y sin variables que reemplazar, están en [`prompts-ejecucion-biblioteca-2026-09-14.md`](prompts-ejecucion-biblioteca-2026-09-14.md). Usar ese archivo es la vía recomendada. El mensaje genérico siguiente queda como referencia para crear una etapa futura, no para las 24 etapas actuales.

Seleccionar primero el modelo y el esfuerzo indicados en la etapa. Después copiar este texto y reemplazar `[ID]`, `[MODELO]` y `[ESFUERZO]`:

> Ejecuta la etapa `[ID]` de `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md` usando `[MODELO]` con esfuerzo `[ESFUERZO]`. Lee completa esa etapa, el contrato global de chats y todas sus entradas. Inspecciona primero el estado real y los cambios locales; no descartes trabajo ajeno. Limita los cambios al alcance de la etapa, implementa y verifica todos sus criterios, actualiza la documentación afectada y entrega el paquete de relevo. No toques producción, no hagas commit/push y no adelantes etapas salvo que esta etapa lo autorice explícitamente. Si encuentras una contradicción, aplica la precedencia del plan y registra la evidencia antes de actuar. Escala solo bajo la condición escrita en el perfil de ejecución de la etapa.

Para E01, E02, E06, E08, E09, E18, E21, E22 y E23 se debe añadir:

> Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y buenas prácticas de Postgres, verifica documentación/changelog vigentes, prueba primero en local o staging y revisa RLS/advisors antes de declarar el trabajo completo.
