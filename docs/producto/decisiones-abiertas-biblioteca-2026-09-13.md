# Histórico — decisiones que estaban abiertas de la Biblioteca Discótica

> **Nota de vigencia (14 de septiembre de 2026):** este documento conserva el cuestionario como historial. La ronda posterior respondió las etapas 1–11. El nuevo [`plan de ejecución por chats`](./plan-ejecucion-biblioteca-2026-09-14.md) consolida esas respuestas y resuelve explícitamente las contradicciones residuales de las etapas 12–13. E00 confirma que ninguna de estas preguntas es backlog ejecutable: solo el plan vigente o una corrección explícita del registro puede cambiar una decisión cerrada.

Registro inicial: 13 de septiembre de 2026  
Actualizado con la conversación del 14 de septiembre de 2026  
Resolución completa de las once etapas: [`resoluciones-puntos-abiertos-biblioteca-2026-09-14.md`](./resoluciones-puntos-abiertos-biblioteca-2026-09-14.md)  
Contraste con el código: [`trazabilidad-feedback-biblioteca-2026-09-13.md`](./trazabilidad-feedback-biblioteca-2026-09-13.md)

## Cómo usar este documento

La conversación del 14 de septiembre cerró la mayor parte del cuestionario original. Este documento contiene **solo lo que sigue abierto**.

Cada etapa debe tratarse como una conversación independiente. No conviene resolver dos etapas en una misma respuesta aunque parezcan pequeñas: por ejemplo, el copy de una invitación no decide el canal por el cual se recibe feedback.

Una etapa queda cerrada cuando se registran:

- la opción elegida;
- el texto, regla o ejemplo final cuando aplique;
- una excepción relevante;
- un criterio observable de aceptación;
- la persona que aprueba.

## Resumen

| Etapa | Decisión pendiente | Bloquea implementación |
| --- | --- | --- |
| 1 | Copy de resultados aproximados | Parcialmente: se puede construir el estado, no aprobar su texto final. |
| 2 | Presentación de un colaborador único | Sí, para tarjetas y ficha con créditos separados. |
| 3 | Migración y auditoría de créditos | Sí, para confiar en la separación principal/colaborador. |
| 4 | Estabilidad de slugs y URLs | Sí, para corregir autoría sin romper enlaces. |
| 5 | Obligatoriedad de Tipo | Sí, para cerrar validación y estados del formulario. |
| 6 | Títulos largos en la ficha | Sí, por contradicción entre las dos conversaciones. |
| 7 | Arquitectura compartida de ficha | No bloquea el diseño, pero sí una implementación mantenible. |
| 8 | Copy e ilustración de bienvenida | Sí, solo para publicar la bienvenida; su mecánica ya está cerrada. |
| 9 | Contrato exacto de query params beta | Sí, para crear enlaces estables de invitación. |
| 10 | Copy de invitación beta | Sí, para mostrar la invitación. |
| 11 | Canal de feedback beta | Sí, para orientar a las personas invitadas. |
| 12 | Segunda fila superior de resultados | Sí, para cerrar el layout de la barra. |
| 13 | Header global al hacer scroll en móvil | Sí, para coordinarlo con la barra Buscar. |

---

## Etapa 1 — Copy del aviso de resultados aproximados

### Lo que ya está decidido

- Es texto pequeño en línea, nunca modal, pop-up ni tarjeta.
- Cuando solo hay aproximados, reemplaza al contador.
- Cuando hay exactos y aproximados, un separador discreto marca la transición.
- El lenguaje debe ser colombiano o neutro; no debe usar voseo argentino.

### Decisión por cerrar

Aprobar la frase exacta que explica que no hubo coincidencia completa sin sonar fría ni prometer precisión falsa.

### Preguntas para esta conversación

1. ¿Se aprueba esta propuesta: `No encontramos coincidencias exactas, pero aquí tienes las más cercanas`?
2. ¿Prefieren hablar de `coincidencias`, `resultados` o `lanzamientos`?
3. ¿La frase debe tutear (`aquí tienes`) o mantenerse impersonal (`mostramos`)?
4. ¿El separador entre grupos repite la frase completa o usa una etiqueta corta como `Resultados aproximados`?
5. En el estado de cero resultados reales, ¿se conserva `No encontramos lanzamientos con esos filtros` o se escribe un mensaje nuevo?

### Criterio de cierre

Entregar dos cadenas finales: una para “solo aproximados” y otra para el separador “exactos → aproximados”, más la cadena del estado vacío real.

### No mezclar con

El algoritmo de puntaje, que ya quedó definido funcionalmente.

---

## Etapa 2 — Cómo mostrar un único colaborador

### Lo que ya está decidido

- Existen dos grupos editoriales: artistas principales y colaboradores.
- Invitados, featured artists, remixers, productores y otros entran en colaboradores.
- Todo artista acreditado tiene página y el lanzamiento aparece en ella.
- Con varios colaboradores puede usarse `Varios artistas` como control desplegable.

### Decisión por cerrar

Definir cómo se distingue visual y semánticamente un lanzamiento con un artista principal y exactamente un colaborador.

### Preguntas para esta conversación

1. ¿Se muestran ambos nombres siempre o se oculta también el colaborador único bajo un desplegable?
2. Si se muestran ambos, ¿qué separador comunica la relación: `con`, `feat.`, una etiqueta `Colabora`, un salto de línea o solo peso tipográfico?
3. ¿La misma fórmula sirve para un invitado, un remixer y un productor aunque el producto no guarde esa subcategoría?
4. ¿En la tarjeta se usa una versión abreviada y en la ficha una versión explícita?
5. ¿Qué ocurre si el nombre principal o el del colaborador es muy largo?
6. ¿Ambos nombres son enlaces independientes y accesibles por teclado?

### Casos que deben aprobarse

- un principal + un colaborador corto;
- un principal + un colaborador con nombre largo;
- dos principales + un colaborador;
- un principal + dos colaboradores, para comprobar el paso a `Varios artistas`.

### Criterio de cierre

Una regla de texto y jerarquía que produzca el contenido exacto de tarjeta, modal y página completa para los cuatro casos.

### No mezclar con

La migración de datos existentes.

---

## Etapa 3 — Migración y auditoría de créditos existentes

### Lo que ya está decidido

- No se bloqueará el catálogo hasta terminar una auditoría total.
- Bandcamp puede ayudar a proponer artista principal y colaboradores mediante título, autor y tracklist.
- Los lanzamientos con más de tres artistas tienen prioridad de revisión.
- Las clasificaciones se pueden mejorar progresivamente en producción.

### Problema que sigue abierto

La regla `más de tres artistas = auditar` no detecta casos como `un principal + dos remixers`. Tampoco se definió qué inferencias pueden publicarse sin revisión humana.

### Preguntas para esta conversación

1. ¿Toda separación inferida por Bandcamp necesita aprobación o solo las de baja confianza?
2. ¿Qué evidencia permite clasificar automáticamente a alguien como principal: autor del release, coincidencia con el título, texto `by`, créditos de todos los tracks u otra señal?
3. ¿Qué evidencia basta para clasificar como colaborador?
4. ¿Qué ocurre cuando las fuentes se contradicen o no existe Bandcamp?
5. Además de `más de tres artistas`, ¿qué casos entran obligatoriamente a la cola: tipo Compilado, palabras `feat.`/`remix`, autores distintos por track, varios nombres separados por `&`?
6. ¿Los registros dudosos se publican temporalmente con todos como principales, se muestran como `Varios artistas` o conservan la presentación legada hasta revisión?
7. ¿Qué información necesita ver la persona revisora para decidir sin abrir varias pestañas?
8. ¿Quién puede aprobar una reclasificación masiva y cómo se revierte una clasificación equivocada?

### Criterio de cierre

Una tabla `señal → clasificación propuesta → requiere revisión sí/no`, aplicada a diez lanzamientos reales difíciles, y una regla de rollback.

### No mezclar con

La presentación visual de créditos ni la política de slugs.

---

## Etapa 4 — Estabilidad de slugs, crates y URLs al corregir autoría

### Estado técnico actual

- Un release canónico ya tiene `slug` propio y puede conservar aliases.
- Los crates canónicos pueden referenciar `release_id`.
- El fallback legado genera el slug con título y primer artista, por lo que cambiar el primero puede cambiar la URL.

### Decisión por cerrar

Confirmar qué identidades son inmutables y qué redirecciones se conservan cuando se corrigen artistas principales.

### Recomendación técnica para aprobar o rechazar

- El `release_id` nunca cambia.
- El slug canónico tampoco cambia solo por corregir autoría.
- Si excepcionalmente se edita el slug, el anterior queda como alias permanente.
- Los crates resuelven por `release_id`; `lanzamiento_slug` queda solo como compatibilidad legada.
- El slug de la página individual de cada artista depende de la entidad artista, no de su rol en un lanzamiento.

### Preguntas para esta conversación

1. ¿El slug visible debe ser estable para siempre o puede actualizarse para reflejar metadatos corregidos?
2. Si cambia, ¿la URL anterior redirige permanentemente a la nueva o ambas resuelven sin redirección?
3. ¿Durante cuánto tiempo se conserva un alias: indefinidamente o hasta terminar la migración?
4. ¿Qué ocurre si un alias antiguo colisiona con el slug de otro lanzamiento?
5. ¿Las URLs compartidas con `?modal=slug` siguen la misma política que `/lanzamiento/slug`?
6. ¿Se aprueba que todo crate nuevo dependa de `release_id`, aun si la fuente pública temporalmente sigue siendo legacy?

### Criterio de cierre

Un contrato con ejemplos antes/después para URL individual, modal compartida y crate, incluyendo una colisión de alias.

### No mezclar con

La forma visual de mostrar a los artistas.

---

## Etapa 5 — ¿Tipo es obligatorio en el formulario?

### Lo que ya está decidido

- `Tipo` debe ser un selector de valores existentes, no texto libre.
- Enlace, título, artistas principales, fecha, géneros y países son obligatorios.
- Sello y nota son opcionales; portada no se solicita a quien propone.

### Ambigüedad

Primero se dijo que todos los campos serían obligatorios. La enumeración final no incluyó `Tipo`, aunque sí corrigió su control.

### Preguntas para esta conversación

1. ¿`Tipo` es obligatorio para comunidad, colaboradores y administradores?
2. Si la fuente no permite inferirlo, ¿la persona debe escoger uno antes de enviar o puede elegir `Sin determinar`?
3. ¿`Sin determinar` es un tipo publicable o solo un estado editorial pendiente?
4. ¿Qué lista exacta de tipos ofrece el selector?
5. ¿Quién puede crear un tipo nuevo y desde qué interfaz?
6. Si la detección propone un tipo, ¿se selecciona automáticamente o requiere confirmación explícita?

### Criterio de cierre

Lista cerrada de opciones, regla de obligatoriedad por rol y comportamiento cuando no hay inferencia.

### No mezclar con

La detección progresiva, que ya quedó decidida.

---

## Etapa 6 — Regla de títulos largos en la ficha

### Contradicción registrada

- Conversación inicial: máximo tres líneas en tarjeta; título completo en modal/ficha.
- Conversación de cierre: ante una pregunta explícita sobre palabras largas en la modal, se respondió máximo tres líneas y truncado.

### Decisión por cerrar

Elegir si la ficha prioriza integridad editorial del título o altura visual constante.

### Opciones concretas

**A — Completo en ficha**  
La tarjeta trunca a tres líneas; modal y página completa permiten todas las líneas, con `overflow-wrap` para palabras sin espacios.

**B — Tres líneas en modal, completo en página**  
La modal conserva altura; la ruta individual muestra el título íntegro.

**C — Tres líneas en todas partes**  
Es la regla más compacta, pero puede ocultar parte del nombre oficial incluso en la ficha completa.

### Preguntas para esta conversación

1. ¿Cuál opción eligen: A, B o C?
2. Si hay truncado, ¿cómo accede una persona al título completo: tooltip, `aria-label`, expansión al tocar o ruta individual?
3. ¿El límite es exactamente tres líneas en desktop y móvil?
4. ¿Se permite cortar una palabra extraordinariamente larga para impedir scroll horizontal?
5. ¿Un título con saltos editoriales propios conserva esos saltos o se normaliza?

### Criterio de cierre

Regla aprobada para tarjeta, modal y página completa, validada con un título largo normal y una palabra sin espacios.

### No mezclar con

El peso tipográfico Bold, que ya se decidió.

---

## Etapa 7 — Componente compartido entre modal y página completa

### Contexto

`LanzamientoModal.svelte` y `LanzamientoVista.svelte` repiten artistas, metadata, acciones y reproductores. Las nuevas reglas de créditos y recomendaciones aumentan el riesgo de que presenten datos distintos.

### Decisión técnica por cerrar

Definir qué parte de la ficha será una fuente compartida y qué parte seguirá siendo específica de cada contenedor.

### Propuesta para discutir

Compartir componentes de contenido, no el contenedor completo:

- `ReleaseCredits`;
- `ReleaseMetadata`;
- `ReleasePlayer`;
- `ReleaseActions`;
- `ReleaseRecommendations`.

Modal y página conservan por separado geometría, scroll, navegación y cierre.

### Preguntas para esta conversación

1. ¿Se aprueba compartir bloques de contenido en lugar de un único componente monolítico?
2. ¿Qué diferencias legítimas deben existir entre modal y página completa?
3. ¿Las recomendaciones aparecen en ambas?
4. ¿El reproductor debe conservar estado al pasar de modal a ruta completa, o cada contenedor crea su propia sesión?
5. ¿Qué componente es responsable de formatear fecha y créditos para que no diverjan?
6. ¿Qué pruebas garantizan que ambos contextos presentan los mismos datos?

### Criterio de cierre

Un mapa de responsabilidades y una lista de bloques compartidos, con al menos una prueba de paridad de datos.

### No mezclar con

La geometría de scroll, que ya está decidida.

---

## Etapa 8 — Copy e ilustración de la bienvenida general

### Lo que ya está decidido

- Banner grande dentro del home, no pantalla completa.
- Primera entrada directa por sesión.
- No aparece con filtros compartidos ni URLs internas.
- Ilustración + frase corta, con el objetivo de invitar a explorar.
- Mismo contenido esencial en desktop y móvil.

### Decisión por cerrar

Definir el contenido editorial y el activo visual que se publicarán.

### Direcciones mencionadas, no aprobadas

- `La biblioteca electrónica sudaca más grande del mundo`.
- `Bailamos y sudamos. Orgullo Sudaka`.

### Preguntas para esta conversación

1. ¿Cuál es la frase principal exacta?
2. ¿Necesita una línea secundaria que explique qué contiene la biblioteca?
3. ¿Existe CTA visible? Si sí, ¿dice `Explorar`, `Buscar` o simplemente desplaza a la grilla?
4. ¿Cuál es el texto accesible del botón de cerrar?
5. ¿Qué debe representar la ilustración y qué referencias visuales debe evitar?
6. ¿La ilustración ya existe o debe encargarse/generarse?
7. ¿Qué recorte o composición se usa en móvil sin cambiar el mensaje?
8. ¿Quién aprueba copy e ilustración juntos?

### Criterio de cierre

Copy final, archivo o brief final de ilustración y dos composiciones aprobadas: desktop y móvil.

### No mezclar con

La invitación beta, que es una capa separada.

---

## Etapa 9 — Contrato exacto de query params beta

### Lo que ya está decidido

- Query params solo en `/`.
- Invitación genérica y personalizada.
- Unicode, espacios y tildes permitidos.
- Los params desaparecen al navegar y no se propagan.
- La función es temporal.

### Decisión por cerrar

Fijar nombres, valores y manejo de entradas inválidas para que los enlaces enviados no cambien durante la beta.

### Propuesta base

```text
/?beta=1
/?beta=1&nombre=María%20José
```

### Preguntas para esta conversación

1. ¿Se aprueban `beta=1` y `nombre=...` como contrato final?
2. ¿`?beta` sin valor activa la invitación o se considera inválido?
3. ¿Qué valores alternos son válidos: `true`, un código de campaña u otros?
4. ¿Cuál es la longitud máxima del nombre visible?
5. ¿Los espacios al inicio/final se recortan y las líneas nuevas se eliminan?
6. ¿Si `nombre` existe sin `beta`, se ignora?
7. ¿Qué ocurre si los params aparecen en una ruta interna: se ignoran, se eliminan o se redirige al home?
8. ¿Los params se eliminan al cerrar la invitación o solo en la primera navegación posterior?

### Criterio de cierre

Tabla de URLs válidas e inválidas, salida visible esperada y momento exacto en que se limpian.

### No mezclar con

El texto de la invitación.

---

## Etapa 10 — Copy de la invitación beta

### Lo que ya está decidido

- Modal pequeña tipo aviso de cookies.
- Aparece cada vez que se abre una URL beta.
- Puede ser genérica o saludar por nombre.
- Debe contar brevemente la beta y comunicar una fecha de lanzamiento.

### Decisión por cerrar

Escribir y aprobar el contenido completo de la invitación.

### Preguntas para esta conversación

1. ¿Cuál es el saludo genérico exacto?
2. ¿Cuál es la plantilla personalizada y cómo se puntúa el nombre?
3. ¿Qué parte de la historia de Discótica necesita conocer una persona invitada?
4. ¿Cuál es la fecha de lanzamiento y en qué formato se muestra?
5. ¿Qué se le pide probar: búsqueda, Radar, fichas, crates, sugerencias o todo?
6. ¿Cuál es la acción principal de la modal y cómo se llama el botón?
7. ¿Se menciona que la biblioteca puede cambiar o contener errores durante la beta?
8. ¿El canal de feedback se nombra dentro del copy o se presenta como acción aparte?

### Criterio de cierre

Versión genérica y personalizada listas para interfaz, incluyendo título, cuerpo, fecha, CTA y texto de cierre.

### No mezclar con

La elección del canal de feedback.

---

## Etapa 11 — Canal de feedback de la beta

### Contradicción registrada

Se propusieron dos modelos sin elección final:

1. botón autenticado `Reportar un problema`, reutilizable para errores de catálogo;
2. feedback informal por el mismo canal personal mediante el cual se envió la invitación, porque la beta tendrá pocas personas.

### Decisión por cerrar

Elegir el canal real y definir si reportar requiere cuenta.

### Preguntas para esta conversación

1. ¿El feedback de beta será estructurado dentro del producto o conversación directa fuera del producto?
2. Si es directo, ¿qué canal se nombra: responder el mensaje, correo, WhatsApp u otro?
3. Si es dentro del producto, ¿la persona debe iniciar sesión antes de reportar?
4. ¿`Reportar un problema` sirve solo para errores de catálogo, también para bugs técnicos o para cualquier comentario?
5. ¿Qué campos mínimos necesita un reporte: texto, URL actual, release, captura, dispositivo?
6. ¿Se captura contexto técnico automáticamente y se informa a la persona?
7. ¿Quién recibe, clasifica y responde los reportes?
8. ¿El botón existe solo durante beta o permanece como parte del producto?
9. ¿Cómo se previene spam sin frustrar a una persona invitada que todavía no tiene cuenta?

### Criterio de cierre

Un único canal principal, regla de autenticación, datos solicitados, responsable de revisión y texto exacto que orienta a la persona invitada.

### No mezclar con

El sistema comunitario para corregir créditos, aunque una implementación futura pueda compartir infraestructura.

---

## Etapa 12 — ¿Qué ocupa la segunda fila superior de resultados?

### Contradicción registrada

Se decidió que la zona superior tendría dos filas, pero solo se asignó contenido a la primera: paginación a la izquierda y `Ordenar por` a la derecha. Después se movió el contador exclusivamente al final de la grilla. La segunda fila quedó sin contenido definido.

### Decisión por cerrar

Confirmar si la zona superior tiene realmente una o dos filas y dónde aparece el aviso cuando solo existen aproximados.

### Opciones concretas

**A — Una fila superior**  
Paginación izquierda y orden derecha. Contador o aviso viven únicamente al final.

**B — Dos filas superiores**  
Primera: paginación + orden. Segunda: definir un contenido útil, por ejemplo estado de la búsqueda o aviso de aproximaciones.

**C — Segunda fila condicional**  
Solo existe cuando hace falta mostrar una advertencia o contexto; en resultados normales la zona tiene una fila.

### Preguntas para esta conversación

1. ¿Cuál opción eligen: A, B o C?
2. Si hay dos filas, ¿qué contenido exacto ocupa la segunda?
3. Si solo hay aproximados, ¿el aviso se muestra arriba, al final en lugar del contador o en ambos lugares?
4. Si hay exactos y aproximados, ¿el aviso superior existe además del separador interno?
5. ¿Desktop y móvil usan la misma lógica aunque distribuyan paginación y orden en filas distintas?

### Criterio de cierre

Un wireframe para resultados normales, solo aproximados y exactos + aproximados, en desktop y móvil.

### No mezclar con

El copy final del aviso, que se decide en la etapa 1.

---

## Etapa 13 — Header global y barra Buscar al hacer scroll en móvil

### Contradicción registrada

- Etapa 8: el header global solo aparece al inicio; la barra `Buscar` se oculta al bajar y reaparece al subir.
- Etapa 11: el header global se oculta al bajar y reaparece al subir “como ahora”.

En ambos casos `Buscar` es una barra secundaria independiente, no parte del header.

### Decisión por cerrar

Definir qué superficies regresan cuando la persona desplaza la página hacia arriba sin haber llegado al inicio.

### Opciones concretas

**A — Solo regresa Buscar**  
El header global aparece únicamente en `scrollY = 0`; cualquier scroll ascendente intermedio recupera solo la barra Buscar.

**B — Regresan ambos**  
Header global y barra Buscar reaparecen al detectar scroll ascendente.

**C — Regresa el header; Buscar permanece**  
La barra Buscar siempre está visible y el header sigue el comportamiento actual.

### Preguntas para esta conversación

1. ¿Cuál opción eligen: A, B o C?
2. ¿Cuánto desplazamiento ascendente hace falta antes de mostrar una superficie?
3. Si regresan ambos, ¿se apilan o uno reemplaza temporalmente al otro?
4. ¿La paginación o el panel abierto cambian este comportamiento?
5. ¿Al enfocar un campo y abrir el teclado móvil se congelan ambos headers para evitar saltos?
6. ¿El comportamiento desktop permanece como hoy?

### Criterio de cierre

Una regla única para scroll descendente, ascendente, inicio de página, panel de filtros abierto y teclado móvil visible.

### No mezclar con

Los enlaces y acciones del header, cuya jerarquía ya quedó cerrada.

---

## Orden sugerido de las conversaciones restantes

1. Tipo obligatorio (etapa 5).
2. Títulos largos (etapa 6).
3. Presentación de colaborador único (etapa 2).
4. Arquitectura compartida (etapa 7).
5. Auditoría de créditos (etapa 3).
6. Slugs y URLs (etapa 4).
7. Composición de la barra de resultados (etapa 12).
8. Copy de aproximaciones (etapa 1).
9. Scroll del header móvil (etapa 13).
10. Contrato de params beta (etapa 9).
11. Canal de feedback beta (etapa 11).
12. Copy de invitación beta (etapa 10).
13. Copy e ilustración de bienvenida (etapa 8).

El orden prioriza decisiones que cambian datos o contratos antes de las decisiones de contenido visual.
