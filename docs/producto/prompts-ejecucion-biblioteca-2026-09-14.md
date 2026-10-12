# Prompts listos para ejecutar el plan de biblioteca — 2026-09-14

Este archivo contiene un chat autocontenido por etapa. No hay campos entre corchetes ni texto que deba editarse antes de pegarlo.

## Uso

1. Ejecuta las etapas estrictamente en orden de dependencias; una por chat y nunca dos en paralelo sobre el mismo árbol de trabajo.
2. Antes de pegar el prompt, selecciona exactamente el modelo y esfuerzo que aparecen en su encabezado.
3. El prompt hace que el agente lea el plan maestro para obtener la especificación exhaustiva. No pegues el plan completo: ya vive en el workspace.
4. Un chat solo puede cerrar su etapa con la evidencia y el paquete de relevo que exige el plan. Si aparece un bloqueo, que lo documente y no salte a la etapa siguiente.
5. E22 y E23 son las únicas etapas que pueden tocar producción; sus prompts exigen gates humanos explícitos. Ninguna etapa debe hacer `commit`, `push`, despliegue ni borrar datos/material legado sin la autorización prevista.

El plan no asigna Astra. Se utiliza Luna en E00, Terra en cambios acotados de interfaz y Sol como techo para integración, seguridad, datos y lanzamiento.

---

## E00 — Congelar decisiones y línea base

**Modelo:** `gpt-5.6-luna`  
**Esfuerzo:** `medium`

```text
Ejecuta exclusivamente la etapa E00 — Congelar decisiones y línea base — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-luna con esfuerzo medium.

Primero lee completos: el contrato global de chats, E00, la matriz de decisiones y dependencias del plan; `docs/producto/decisiones-abiertas-biblioteca-2026-09-13.md`; `docs/producto/resoluciones-puntos-abiertos-biblioteca-2026-09-14.md`; y `docs/producto/trazabilidad-feedback-biblioteca-2026-09-13.md`. Inspecciona el estado real del repositorio y los cambios locales antes de escribir; preserva trabajo ajeno.

El objetivo es dejar una línea base reproducible y una sola fuente de verdad documental antes de cambiar producto o base de datos. Reconcilia contradicciones aplicando la precedencia definida por el plan, registra cualquier discrepancia que no pueda resolverse, inventaría los archivos/cambios locales relevantes y fija las decisiones ya aprobadas sin inventar decisiones nuevas.

No implementes funcionalidad, no cambies Supabase, no toques staging/producción, no hagas commit ni push y no adelantes otra etapa. Ejecuta exactamente las verificaciones documentales y de estado exigidas por E00. Actualiza únicamente la documentación que E00 autorice.

Entrega un paquete de relevo para E01: decisiones vigentes, contradicciones resueltas o bloqueantes, estado del árbol de trabajo, comandos ejecutados con resultado y lista exacta de archivos modificados. Si la precedencia no resuelve una contradicción nueva, detente y registra evidencia; no la decidas por cuenta propia.
```

## E01 — Validar staging, roles y recuperación existentes

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E01 — Validar staging, roles y recuperación existentes — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E00 debe estar aceptada.

Lee completos el contrato global de chats, E01, sus entradas y los documentos de producto citados por el plan. Antes de modificar nada, revisa el árbol de trabajo, la configuración efectiva y el estado remoto autorizado. Esta etapa involucra Supabase/PostgreSQL: si las skills locales están disponibles, lee y sigue las de Supabase y buenas prácticas de Postgres; verifica documentación vigente, prueba primero en local o staging y revisa RLS/advisors.

Valida en staging las fases 4–5 ya existentes: identidad de proyecto, Auth y roles, esquema/migraciones, RLS, Storage, funciones privilegiadas, conteos de catálogo y capacidad de backup/restore. Produce evidencia reproducible de cada comprobación, sin asumir que los documentos reflejan el remoto. Contrasta el catálogo canónico de staging y los rechazos conocidos con los conteos que E01 exige.

No diseñes el contrato v2, no apliques migraciones nuevas, no uses producción, no hagas commit/push ni corrijas hallazgos fuera del alcance. Si aparece drift remoto, policy contradictoria, función privilegiada inesperada o un restore/conteo inconsistente, conserva la evidencia y continúa solo en un chat nuevo de Sol xhigh; no improvises un arreglo.

Entrega a E02 el inventario comprobado de proyecto/roles/esquema, evidencia de recuperación, resultados de RLS/advisors, diferencias respecto de los documentos y un go/no-go explícito para diseñar el contrato canónico.
```

## E02 — Contrato canónico v2: créditos, tipos e identidad

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa E02 — Contrato canónico v2: créditos, tipos e identidad — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo xhigh. E01 debe tener go explícito.

Lee el contrato global, E02 completa, sus decisiones de producto y el paquete de relevo de E01. Inspecciona los cambios locales y el esquema existente antes de editar. Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y buenas prácticas de Postgres si están disponibles; consulta la documentación vigente, trabaja local o en staging, revisa RLS/advisors y no declares completo sin pruebas de migración y rollback.

Diseña e implementa solo el contrato canónico v2 definido por E02: identidad estable de releases, normalización de Disco a Álbum sin destruir compatibilidad necesaria, tipos permitidos, créditos por grupo y sus constraints, aliases/resolución y las reglas de migración/importación. Conserva trazabilidad y reversibilidad. Prueba colisiones, valores inválidos, registros existentes, compatibilidad de lectura y denegaciones de RLS. No sustituyas decisiones editoriales por heurísticas ni pierdas identidad por una reescritura masiva.

No construyas UI, consola, inferencia ni contribuciones. No toques producción, no hagas commit/push y no ejecutes borrados irreversibles. Si colisiones, reescritura histórica o RLS no caben en una migración determinista probada, detente: divide el problema, documenta fixtures/evidencia y solicita decisión humana; no cambies de modelo ni compenses con más tokens.

Entrega a E03/E06/E09: migraciones y contrato exacto, compatibilidad temporal, resultados de pruebas y RLS, plan de rollback comprobado, conteos antes/después y decisiones aún pendientes.
```

## E03 — Dominio de cliente y política única de URLs

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E03 — Dominio de cliente y política única de URLs — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E02 debe estar aceptada.

Lee el contrato global, E03 completa, E02 y sus decisiones/paquete de relevo. Inspecciona el árbol de trabajo y los consumidores actuales antes de modificar código. Implementa el dominio de cliente, tipos y resolvedores de URL/identidad exactamente como E03 los define, manteniendo la compatibilidad temporal requerida entre legado y canónico. Centraliza la resolución: no dejes parsers o reglas de alias divergentes en tarjetas, rutas, búsqueda, ficha o administración.

Añade y ejecuta las pruebas de unidad e integración indicadas: normalización, aliases, URLs canónicas, URLs heredadas, valores nulos/ambiguos y consumidores existentes. No escribas SQL ni cambies políticas/RLS desde este chat; tampoco implementes pantallas de etapas posteriores, producción, commit o push.

Si un resolvedor exige alterar escrituras, policies de DB o semántica de aliases, detente y devuelve el cambio a E02 en un chat nuevo de Sol xhigh. Entrega a E05/E11/E16 el API de dominio, matriz de compatibilidad, pruebas y lista de consumidores migrados/restantes.
```

## E04 — Fundaciones mínimas de interfaz y overlays

**Modelo:** `gpt-5.6-terra`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E04 — Fundaciones mínimas de interfaz y overlays — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-terra con esfuerzo high.

Lee el contrato global, E04 completa y las decisiones de producto relevantes. Inspecciona primero los estilos, componentes y cambios locales existentes. Construye únicamente las primitivas, tokens y contratos compartidos que E04 especifica: estados interactivos, foco, capas/overlays, bloqueo y restauración de scroll, cierre por Escape/backdrop y requisitos de accesibilidad. Respeta el lenguaje visual ya aprobado; no rediseñes pantallas de producto.

Prueba teclado, lector/semántica cuando aplique, foco inicial/final, apilamiento de overlays, scroll en desktop y móvil, y ausencia de regresiones en componentes que consumen las primitivas. Mantén los cambios pequeños y reutilizables.

No modifiques datos, Supabase, autorización, rutas de producto ni producción; no hagas commit/push. Si falta una decisión visual que E04 no puede deducir de la documentación, registra la alternativa y detente en vez de inventar un sistema visual nuevo.

Entrega a las etapas consumidoras el inventario de primitivas, APIs/props, tokens, ejemplos de uso, pruebas ejecutadas y limitaciones conocidas.
```

## E05 — Créditos públicos en tarjetas y páginas de artista

**Modelo:** `gpt-5.6-terra`  
**Esfuerzo:** `medium`

```text
Ejecuta exclusivamente la etapa E05 — Créditos públicos en tarjetas y páginas de artista — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-terra con esfuerzo medium. E03 y E04 deben estar aceptadas.

Lee el contrato global, E05 completa y los relevos de E03/E04. Inspecciona los componentes y fixtures actuales antes de editar. Implementa la presentación pública de los dos grupos de créditos en tarjetas y páginas de artista, usando el dominio y las primitivas existentes, el orden/copy/estados vacíos definidos por el plan y sin duplicar lógica de identidad o URLs.

Verifica datos canónicos, compatibilidad temporal, créditos ausentes, nombres largos, navegación de enlaces, responsive y accesibilidad. Ejecuta las pruebas exactas que E05 exige y actualiza solo la documentación de la etapa.

No infieras créditos, no cambies esquema/RLS, no construyas consola/ficha ni toques producción, commit o push. Entrega a E16 y QA la lista de superficies actualizadas, estados cubiertos, pruebas y cualquier dependencia visual pendiente.
```

## E06 — Servicio de mutaciones administrativas auditadas

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa E06 — Servicio de mutaciones administrativas auditadas — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo xhigh. E02 debe estar aceptada.

Lee el contrato global, E06 completa, E02 y su relevo. Inspecciona el esquema, funciones, RLS y cualquier vía de escritura actual. Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y buenas prácticas de Postgres si están disponibles; verifica documentación vigente y prueba en local o staging, incluidas RLS/advisors.

Implementa solo el servicio administrativo definido por E06: autorización estricta, funciones/transacciones auditadas, creación, edición, archivado, reversión, control de concurrencia/versionado y trazabilidad. Ninguna pantalla debe tener acceso crudo a las tablas. Demuestra con pruebas que un usuario no admin es denegado incluso fuera de la UI, que cada mutación es atómica y que revertir recupera el estado previsto.

No construyas la consola ni inferencia de créditos, no toques producción, no hagas commit/push ni deshabilites RLS para facilitar pruebas. Si una garantía de seguridad o integridad no es demostrable, detente, separa diseño/migración/verificación y documenta el bloqueo; no hay escalamiento automático.

Entrega a E07/E08 el contrato de mutaciones, funciones y permisos, fixtures de auditoría/reversión, pruebas de roles/concurrencia, estrategia de rollback y ejemplos de consumo seguro.
```

## E07 — Consola administrativa de catálogo

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E07 — Consola administrativa de catálogo — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E03, E04 y E06 deben estar aceptadas.

Lee el contrato global, E07 completa y los relevos de sus dependencias. Inspecciona rutas, componentes y cambios locales. Implementa la consola como reemplazo operativo de Google Sheets usando exclusivamente el dominio de E03, las primitivas de E04 y el servicio auditado de E06. Incluye los flujos, validaciones, confirmaciones, estados de carga/error, control de versión, auditoría y reversión que E07 exige; no escribas directamente a tablas desde componentes.

Prueba roles, acceso forzado a rutas, validación cliente/servidor, errores de concurrencia, historial de cambios, reversión, responsive y teclado. Mantén los flags como kill switches, no como autorización.

No alteres SQL/RLS ni inventes operaciones administrativas fuera del contrato. No hagas inferencia de créditos, no toques producción, commit o push. Si la UI revela una carencia real de E06, documenta el caso y devuélvelo a E06 en un chat nuevo de Sol xhigh.

Entrega a E08 y QA las rutas, flujos disponibles, contrato consumido, evidencia de autorización/auditoría y pruebas ejecutadas.
```

## E08 — Inferencia, cola y migración progresiva de créditos

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa E08 — Inferencia, cola y migración progresiva de créditos — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo xhigh. E06 y E07 deben estar aceptadas.

Lee el contrato global, E08 completa, las decisiones editoriales y los relevos de E06/E07. Inspecciona datos, evidencia disponible, esquema y consola antes de cambiar nada. Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y buenas prácticas de Postgres si están disponibles; trabaja primero en local/staging, revisa RLS/advisors y conserva un rollback probado.

Implementa únicamente la inferencia y migración progresiva descritas por E08: propuestas separadas de hechos publicados, evidencia trazable, heurísticas conservadoras, lotes reanudables, revisión/aprobación editorial, aplicación auditada, reversión y métricas de cobertura. Nunca conviertas una coincidencia incierta en crédito publicado automáticamente; los falsos positivos son más graves que la falta de cobertura.

Prueba reanudación, idempotencia, fallos de lote, aprobación/rechazo, conflictos, rollback, permisos y casos ambiguos. No toques producción, no hagas commit/push y no amplíes reglas editoriales por intuición. Si la heurística es incierta, detén el lote, reduce alcance y deja los nuevos casos para validación editorial.

Entrega a E21 la evidencia de cada lote, criterios de inferencia, conteos antes/después, casos pendientes, auditoría, rollback y pruebas de permisos.
```

## E09 — Contrato de contribuciones v2, permisos y colas

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E09 — Contrato de contribuciones v2, permisos y colas — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E02 debe estar aceptada.

Lee el contrato global, E09 completa, E02 y sus decisiones/relevo. Inspecciona los payloads, estados, roles, RLS y consumidores existentes. Esta etapa involucra Supabase/PostgreSQL: sigue las instrucciones locales de Supabase y buenas prácticas de Postgres disponibles; verifica documentación vigente, trabaja local/staging y prueba RLS/advisors.

Implementa el contrato v2 de contribuciones exactamente como E09 lo define: payload versionado, validación, máquina de estados, transiciones autorizadas, visibilidad por rol, colas de comunidad/colaborador/admin y compatibilidad temporal de datos existentes. La autorización debe vivir fuera de la UI y negar toda transición no permitida.

Ejecuta fixtures para cada estado y transición, pruebas de RLS para cada rol, payloads antiguos/malformados, carrera/doble envío y visibilidad forzada. No construyas pantallas de Sugerir o Perfil, no cambies producción, no hagas commit/push ni resuelvas estados contradictorios inventando una transición.

Si el historial no puede migrarse o un estado es contradictorio, conserva fixtures y eleva Sol a xhigh en un chat nuevo para cerrar el contrato antes de codificar consumidores. Entrega a E10 el esquema, API, diagrama de estados, matriz de permisos y pruebas.
```

## E10 — Sugerir, borradores, Perfil y estación editorial

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E10 — Sugerir, borradores, Perfil y estación editorial — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E04 y E09 deben estar aceptadas.

Lee el contrato global, E10 completa y los relevos de E04/E09. Inspecciona rutas, componentes y estados actuales antes de editar. Implementa el flujo de punta a punta por rol que E10 especifica: borradores, sugerencia, perfil, colas editoriales y sus estados de carga/error/vacío. Consume el contrato de E09 sin duplicar validación ni autorización en componentes.

Prueba cada rol, rutas directas, borrador/reanudación, envíos repetidos, transiciones visibles, errores remotos, foco/teclado, responsive y denegación de acciones no autorizadas. Mantén las superficies administrativas separadas de las comunitarias según el plan.

No cambies payload, RLS ni reglas de estados en este chat; no toques producción, commit o push. Si E09 no representa un estado necesario, documenta un caso reproducible y devuélvelo a E09 en Sol xhigh; no soluciones autorización desde UI.

Entrega a E21 el mapa de rutas/roles, flujos cubiertos, contrato de E09 consumido, pruebas y limitaciones conocidas.
```

## E11 — Motor puro de coincidencia y Radar

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E11 — Motor puro de coincidencia y Radar — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E03 debe estar aceptada.

Lee el contrato global, E11 completa, E03 y sus decisiones/relevo. Inspecciona la búsqueda actual y las fixtures. Implementa un motor aislado y determinista que aplique exactamente la prioridad lexicográfica, normalización, coincidencias exactas/aproximadas, agrupación y compuerta Radar que E11 define. No mezcles consulta de red, render ni efectos de UI dentro de las funciones puras.

Construye las fixtures y pruebas de borde indicadas: acentos/Unicode, puntuación, aliases, exactos contra aproximados, empates, grupos, resultados vacíos y cada condición de Radar. Haz explícitos los contratos de entrada/salida para E12/E17.

No rediseñes la barra o resultados, no cambies esquema/RLS, no toques producción, commit o push. Si fixtures válidos descubren contradicción entre prioridades o la compuerta Radar, preserva el caso y ciérralo primero en un chat nuevo de Sol xhigh antes de continuar.

Entrega a E12/E17 las funciones puras, tipos, fixtures, pruebas, reglas de orden y ejemplos de integración.
```

## E12 — Estado de búsqueda, URL, sugerencias y retiro de Mes

**Modelo:** `gpt-5.6-terra`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E12 — Estado de búsqueda, URL, sugerencias y retiro de Mes — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-terra con esfuerzo high. E03 y E11 deben estar aceptadas.

Lee el contrato global, E12 completa y los relevos de E03/E11. Inspecciona parsers, rutas, query params, componentes y cambios locales. Implementa el contrato único de estado de búsqueda/URL, sugerencias tipadas y el retiro de Mes exactamente como E12 ordena. Conserva filtros válidos, navegación Back/Forward y compatibilidad definida; no crees parsers paralelos por superficie.

Prueba deep links, historial, query params inválidos/duplicados, Unicode, sugerencias, limpiar/restaurar filtros, resultados vacíos y el retiro idempotente de Mes. Revisa accesibilidad de controles y no rompas consumidores existentes.

No construyas la composición completa de resultados, beta ni UI móvil, no alteres datos/Supabase, no toques producción, commit o push. Si el contrato de E11 no representa un caso de coincidencia, documenta fixture y devuélvelo a E11.

Entrega a E13/E19 el parser único, tipos de estado, matriz URL→estado, pruebas de historial y consumidores migrados.
```

## E13 — Barra, grupos, contador, orden y paginación

**Modelo:** `gpt-5.6-terra`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E13 — Barra, grupos, contador, orden y paginación — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-terra con esfuerzo high. E12 y E04 deben estar aceptadas.

Lee el contrato global, E13 completa y los relevos de E12/E04. Inspecciona la composición actual de resultados y sus estados. Implementa únicamente barra, grupos, contador, orden y paginación según el contrato aprobado: usa el estado/URL único de E12, las primitivas de E04 y el copy/jerarquía especificados. No recalcules las reglas del motor de E11 en la vista.

Prueba órdenes, cambio de página, contador, grupos mixtos/vacíos, deep link, conservación de filtros, teclado, foco, responsive y estados de carga/error. Verifica que paginación y orden no oculten ni dupliquen resultados.

No implementes hoja móvil, header, beta ni cambios de DB/producción; no hagas commit/push. Si aparece un fallo del parser o del motor, registra el caso y devuélvelo a E12/E11, no lo parches localmente.

Entrega a E15/E19/E20 el comportamiento de búsqueda visible, pruebas, componentes reutilizables y restricciones de integración.
```

## E14 — Jerarquía y comportamiento del header global

**Modelo:** `gpt-5.6-terra`  
**Esfuerzo:** `medium`

```text
Ejecuta exclusivamente la etapa E14 — Jerarquía y comportamiento del header global — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-terra con esfuerzo medium. E04 debe estar aceptada.

Lee el contrato global, E14 completa y el relevo de E04. Inspecciona el header actual en las rutas afectadas y cualquier cambio local. Implementa la jerarquía, navegación, estados de scroll, responsive, foco y accesibilidad exactamente definidos por E14, reutilizando las primitivas de overlay/scroll de E04.

Prueba las rutas y breakpoints que E14 enumera, navegación por teclado, foco visible, scroll sostenido, superposición con overlays y ausencia de saltos visuales. Conserva compatibilidad con rutas y flags existentes.

No modifiques búsqueda móvil, invitación beta, datos/Supabase ni producción; no hagas commit/push. Si el cambio exige una decisión de arquitectura de navegación no establecida, documenta el caso y detente.

Entrega a E15/E19 la API/comportamiento del header, matriz de breakpoints, pruebas y restricciones de integración.
```

## E15 — Barra Buscar, pills y hoja móvil

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E15 — Barra Buscar, pills y hoja móvil — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E04, E13 y E14 deben estar aceptadas.

Lee el contrato global, E15 completa y los relevos de E04/E13/E14. Inspecciona la búsqueda actual en móvil y desktop. Implementa barra Buscar, pills y hoja móvil con la geometría, gestos, foco, Escape, bloqueo/restauración de scroll, visualViewport y comportamiento de navegación que E15 define. Reutiliza el estado de búsqueda de E12 y las primitivas de E04; no crees un estado móvil paralelo.

Prueba táctil y puntero, swipe en umbrales, teclado, lectores/semántica, rotación, viewport virtual, apertura/cierre repetidos, Back/Forward y scroll de fondo. Documenta cualquier diferencia de navegador con una reproducción mínima.

No cambies datos, Supabase, reglas de búsqueda ni producción; no hagas commit/push. Si un problema reproducible de pointer/visualViewport persiste, sube Sol a xhigh sobre el caso aislado; si sigue fallando, detente en vez de reescribir a ciegas.

Entrega a E21 el comportamiento por breakpoint, pruebas de interacción, matriz de navegadores/dispositivos y limitaciones verificadas.
```

## E16 — Componente compartido de ficha, geometría y reproductor

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa E16 — Componente compartido de ficha, geometría y reproductor — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo xhigh. E03, E04 y E05 deben estar aceptadas.

Lee el contrato global, E16 completa y los relevos de E03/E04/E05. Inspecciona ambas implementaciones actuales de ficha, rutas, modal, wrappers de embed y cambios locales. Refactoriza hacia el componente compartido definido por E16, sin divergencias entre ruta y modal. Respeta geometría, URL canónica, créditos, crates, ownership de estado, foco y restauración de scroll; trata cada proveedor cross-origin según su matriz de regresión.

Prueba ruta directa, apertura/cierre modal, Back/Forward, deep link, scroll, foco, contenido largo, fallos/carga de iframes y cada proveedor indicado. Demuestra que una corrección compartida aplica a ambas superficies y que no se duplican listeners/estado.

No cambies autorización, esquema ni producción; no hagas commit/push. Si no puedes demostrar estabilidad de scroll/iframe o propiedad de estado, conserva un caso reproducible y continúa en Sol xhigh sobre él, sin reescribir la ficha a ciegas.

Entrega a E17/E21 el componente y sus contratos, matriz modal/ruta/proveedor, pruebas de regresión y restricciones pendientes.
```

## E17 — Recomendaciones y sesión de historial modal

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E17 — Recomendaciones y sesión de historial modal — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E11 y E16 deben estar aceptadas.

Lee el contrato global, E17 completa y los relevos de E11/E16. Inspecciona la ficha, navegación e historial actuales. Implementa las recomendaciones y la sesión modal exactamente como E17 define, usando el motor puro de E11 y el componente compartido de E16. Mantén una máquina de estados explícita para apertura directa, navegación entre releases, Back/Forward, foco y restauración de scroll.

Prueba recomendaciones nulas/insuficientes, exactitud de las dos recomendaciones, apertura desde ruta y desde resultados, cadenas de navegación, retroceso/avance, cierre, recarga, foco y scroll. Evita que la URL, la ficha visible y el historial queden desincronizados.

No alteres el algoritmo de E11, datos/Supabase ni producción; no hagas commit/push. Si un caso reproducible viola un invariante de historial, ciérralo en un chat nuevo de Sol xhigh con tests antes de continuar.

Entrega a E21 la máquina de estados, reglas de navegación, fixtures/pruebas y evidencia de restauración de foco/scroll.
```

## E18 — Reportar un problema de forma permanente

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E18 — Reportar un problema de forma permanente — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo high. E04 debe estar aceptada.

Lee el contrato global, E18 completa, las decisiones de privacidad y el relevo de E04. Inspecciona el flujo existente, Auth, Storage, RLS y componentes. Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y buenas prácticas de Postgres disponibles, verifica documentación vigente, trabaja local/staging y revisa RLS/advisors.

Implementa el canal autenticado permanente de reporte, contexto técnico mínimo, adjuntos privados, validación, almacenamiento, cola administrativa, visibilidad por rol, limpieza y flag definidos por E18. Modela privacidad y autorización en servidor/RLS, no solo mediante UI. No expongas adjuntos ni contexto de otros usuarios.

Prueba usuario anónimo/autenticado/admin, creación, tamaño/tipo de archivo, URLs de Storage, acceso cruzado denegado, fallos de subida, limpieza y estados UI. No toques producción, no hagas commit/push ni añadas envío automático de correo fuera de alcance.

Si las policies de subida, adjunto o limpieza requieren privilegios excesivos, sube Sol a xhigh y separa Storage del flujo de reporte antes de continuar. Entrega a E19/E21 el modelo de datos, matriz de permisos, pruebas, ruta de limpieza y evidencia de privacidad.
```

## E19 — Invitación beta temporal

**Modelo:** `gpt-5.6-terra`  
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa E19 — Invitación beta temporal — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-terra con esfuerzo high. E04, E12, E14 y E18 deben estar aceptadas.

Lee el contrato global, E19 completa y los relevos de sus dependencias. Inspecciona parsers de URL, header, componentes temporales, sanitización y flags. Implementa únicamente la invitación beta definida: query params, Unicode, copy aprobado, correo temporal, XSS seguro, accesibilidad, foco y limpieza idempotente de historial. Respeta el flag como kill switch y no lo confundas con autorización.

Prueba todos los parámetros válidos/ausentes/malformados, Unicode, codificación, XSS, repetición de enlaces, Back/Forward, cierre, foco y responsive. Asegura que los filtros de E12 sobrevivan y que retirar la beta no rompa navegación.

No cambies el parser de búsqueda de fondo, datos/Supabase, permisos ni producción; no hagas commit/push. Si E12 no puede conservar filtros y retirar beta idempotentemente, documenta caso y resuélvelo con Sol high; si aparece una brecha de seguridad distinta, detente y devuélvela a su etapa origen.

Entrega a E21 pruebas de parámetros/seguridad, comportamiento del flag, copy final y plan de retirada.
```

## E20 — Bienvenida general provisional

**Modelo:** `gpt-5.6-terra`  
**Esfuerzo:** `medium`

```text
Ejecuta exclusivamente la etapa E20 — Bienvenida general provisional — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-terra con esfuerzo medium. E04 y E13 deben estar aceptadas.

Lee el contrato global, E20 completa y los relevos de E04/E13. Inspecciona la superficie de inicio, sesión/almacenamiento existente, tokens y cambios locales. Implementa la bienvenida provisional por sesión exactamente como E20 especifica, con copy aprobado, estado reemplazable, accesibilidad y comportamiento no intrusivo. No inventes la ilustración definitiva ni una fecha de lanzamiento.

Prueba primera visita, cierre/estado de sesión, recarga, rutas, móvil/desktop, teclado, foco, lectores y convivencia con búsqueda/overlays. Mantén la implementación fácilmente retirable.

No modifiques datos, autenticación, Supabase, producción, commit o push. Si el requisito de sesión contradice almacenamiento/privacidad existentes, documenta la evidencia y detente. Entrega a E21 el comportamiento, pruebas y procedimiento de reemplazo/retirada.
```

## E21 — Candidato de lanzamiento y QA integral en staging

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa E21 — Candidato de lanzamiento y QA integral en staging — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo xhigh. E05 a E20 deben estar completas y aceptadas.

Lee el contrato global, E21 completa y todos los paquetes de relevo de E05–E20. Inspecciona el árbol de trabajo y el estado real de staging antes de cambiar nada. Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y buenas prácticas de Postgres disponibles; verifica documentación vigente, trabaja en staging y revisa RLS/advisors.

Construye y valida el candidato de lanzamiento según la matriz E21: compilación, pruebas, rutas, roles, RLS, migraciones, datos, créditos, administración, contribuciones, búsqueda, ficha, móvil, embeds, reportes, beta, bienvenida, flags, backup/restore y rollback. Ejecuta la matriz de go/no-go completa; no reduzcas cobertura por conveniencia ni declares aprobado sin evidencia reproducible.

No toques producción, no hagas commit/push ni arregles silenciosamente problemas de una etapa anterior. Atribuye cada fallo a su origen, conserva reproducción/evidencia y devuelve el trabajo a esa etapa. Si un no-go cruza DB, RLS, migración y frontend sin atribución, continúa solo con Sol xhigh para el análisis sistémico.

Entrega a E22 un expediente de release: versión/candidato exacto, resultados de todas las pruebas, riesgos abiertos, inventario de flags, backups/restore comprobados, checklist de corte y dictamen go/no-go firmado por evidencia.
```

## E22 — Corte gradual a producción

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa E22 — Corte gradual a producción — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo xhigh. E21 debe tener go explícito y expediente completo.

Lee el contrato global, E22 completa, el expediente de E21 y toda la documentación de operación/reversión citada. Inspecciona identificadores de proyecto, candidato, cambios locales, backups y flags antes de cualquier acción. Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y buenas prácticas de Postgres disponibles, verifica documentación vigente y revisa RLS/advisors.

Esta es una operación de producción. No hagas ninguna escritura hasta obtener dentro de este chat la aprobación humana explícita que E22 exige para el proyecto, backup y ventana de corte correctos. Tras cada gate humano, ejecuta el corte gradual, migración, delta, verificación de conteos, smoke tests, flags y observación exactamente en el orden definido por E22. Registra hora, comando, objetivo, resultado y decisión de continuar/revertir.

No hagas commit/push como parte del corte. No asumas referencias de proyecto, no ignores una precondición y no borres datos. Si un backup, conteo, identidad de proyecto o resultado es incierto, detén el corte, activa el rollback indicado si ya se cruzó un punto reversible y pide intervención humana; no intentes compensarlo con más razonamiento.

Entrega a E23 el acta de corte, cambios realizados, evidencia de salud/roles/RLS/datos, flags finales, backup y rollback disponibles, métricas de observación y autorización explícita para considerar el retiro del legado.
```

## E23 — Retiro controlado del legado

**Modelo:** `gpt-5.6-sol`  
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa E23 — Retiro controlado del legado — del plan `docs/producto/plan-ejecucion-biblioteca-2026-09-14.md`, usando gpt-5.6-sol con esfuerzo xhigh. E22 debe estar estable y el período/evidencia de observación exigido por el plan debe cumplirse.

Lee el contrato global, E23 completa, el acta de E22 y todos los criterios de deprecación/reversión. Inspecciona el estado de producción, consumidores, métricas, aliases/fallbacks y backups antes de proponer cualquier retiro. Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y buenas prácticas de Postgres disponibles, verifica documentación vigente y revisa RLS/advisors.

Identifica y elimina únicamente los fallbacks, columnas, aliases, rutas o código legado que E23 autorice tras demostrar que no protegen consumidores activos. Ejecuta el orden gradual, las verificaciones, snapshots y planes de reversión definidos; conserva trazabilidad de cada retiro. Esta etapa es deliberadamente destructiva.

No borres nada ni apliques cambios de producción sin la aprobación humana explícita requerida para cada lote de retiro. No hagas commit/push automáticamente. Si falta evidencia de uso cero, recuperación, backup o compatibilidad, detente: falta de evidencia es un no-go, no una invitación a seguir.

Entrega el cierre final: lista exacta de elementos retirados y preservados, autorizaciones, pruebas post-retiro, evidencias de no uso, ubicación de backups, procedimiento de restauración y deuda restante que no se retiró.
```
