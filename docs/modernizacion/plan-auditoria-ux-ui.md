# Plan de auditoría y evolución UX/UI de Discótica

## Propósito

Conservar la dirección de arte ya lograda —oscuro, editorial, tipografía expresiva y verde ácido como señal de acción— y convertirla en un sistema de experiencia coherente, especialmente en móvil. Este plan no propone una reestilización genérica: primero elimina fricción, inconsistencia y problemas de jerarquía; después, con decisiones editoriales explícitas, define qué debe sentirse más utilitario, más coleccionable o más institucional.

La auditoría inicial se hizo el 30 de agosto de 2026 sobre el código de todas las rutas y componentes compartidos, build de producción y pruebas de navegador locales. Se verificaron visualmente inicio, filtros móviles, ficha/modal en escritorio y móvil, login y sugerir. Los estados que requieren una cuenta o rol editorial se inspeccionaron estructuralmente; se validarán visualmente con cuentas de prueba antes de implementar cambios.

## Inventario de superficie

| Grupo | Pantallas y estados | Estado de auditoría |
| --- | --- | --- |
| Descubrimiento | Inicio, búsqueda, sugerencias, filtros activos, paginación, resultado vacío, filtros desktop y hoja móvil | Revisado en código; inicio y hoja móvil comprobados visualmente. |
| Fichas de catálogo | Tarjeta de lanzamiento, menú de varios artistas, ficha de URL, modal, radar, reproductores Bandcamp/SoundCloud/Spotify, compartir, añadir a crate | Revisado; modal y tarjeta comprobados en escritorio y móvil; reproductores cubiertos por prueba. |
| Navegación global | Header desktop, hamburger y menú móvil, estado anónimo/autenticado, footer | Revisado; header anónimo móvil comprobado. |
| Taxonomías | Artista, sello y sus estados de listado/cargar más/volver | Revisado en código; pendiente pasada visual con datos de producción/fixture. |
| Cuentas | Entrar, registro, recuperación y nueva contraseña; errores y cargas | Revisado en código; entrar comprobado en móvil; demás pendientes de estados reales. |
| Comunidad | Sugerir, anónimo, formulario autenticado, detección de fuente y envío | Revisado; estado anónimo móvil comprobado. |
| Crates y perfil | Mis crates, vacío, tarjeta editable, confirmación de borrar, crear crate, crate público/privado, perfil | Revisado en código; pendiente pasada autenticada. |
| Editorial | Cola, fuente, portada, aprobación, corrección y rechazo | Revisado en código; pendiente pasada con rol colaborador/editor. |
| Información | Manual, privacidad y 404/error | Revisado en código; manual/privacidad pendientes de lectura visual completa. |
| Legado | `/OTROS` y `artista/_+page copy.svelte` | Inventariado como duplicado/legado; debe retirarse de la superficie y del mantenimiento activo. |

## Hallazgos priorizados

### P0 — definir y corregir antes de ampliar funcionalidad

1. **La ficha/modal móvil no preserva la tarea principal.** En 390 × 844 el modal apila portada, radar e información; la primera vista está dominada por la imagen/radar y obliga a recorrer bastante antes de llegar a reproductor, compra, guardado o compartir. El radar aparece superpuesto al interactuar con la portada en escritorio, pero en táctil no hay un equivalente deliberado de hover. Debe definirse una composición móvil propia, no una versión estrecha del escritorio.

2. **El fondo activo compite visualmente con capas modales.** Tanto el modal de lanzamiento como la hoja de filtros mantienen elementos del catálogo y del footer muy legibles detrás de capas oscuras/translúcidas. El resultado hace difícil saber qué plano tiene el foco, particularmente en móvil. Hay que normalizar opacidad, desenfoque, z-index y bloqueo de scroll para todo overlay.

3. **No hay un sistema compartido de controles.** Conviven botones `btn-buy`, `btn-primary`, `btn-nuevo`, `btn-outline`, botones editorial en línea, icon buttons y múltiples variaciones locales de radio, padding, tipografía, foco y altura. La dirección de arte puede conservarse; lo que falta es un contrato de variantes y tamaños. Hoy un botón puede medir cerca de 32 px, 36 px, 40 px o más según la ruta, insuficiente e irregular para tacto.

4. **Las capas no comparten contratos de accesibilidad móvil.** El modal de lanzamiento bloquea el scroll y responde a Escape, pero no contiene el foco; el modal de crear crate declara diálogo pero no mueve el foco al abrirse de forma reactiva ni protege el foco; la hoja de filtros tampoco lo contiene. La implementación debe unificar foco inicial, tabulación, retorno de foco, Escape, clic/gesto exterior y `aria`.

### P1 — alta ganancia de consistencia

5. **Inicio: duplicación de acceso a búsqueda en móvil.** La búsqueda desktop se oculta y aparece un FAB persistente, mientras el panel/hoja deja piezas de fondo presentes. Debe definirse si buscar es acción primaria siempre visible, un modo de exploración, o una herramienta secundaria. El contador, la paginación y el FAB tienen densidades de interfaz diferentes.

6. **Header móvil funcional pero con área de toque escasa.** El ícono tiene barras de 22 px y `padding: 4px`; visualmente es limpio, pero no asegura una caja táctil de 44 px. El menú aparece como dropdown anclado; conviene decidir si la navegación merece dropdown corto, panel lateral o una hoja coherente con filtros.

7. **Tarjeta y ficha compiten entre “objeto editorial” y “panel de datos”.** La tarjeta privilegia portada/título y la ficha expone metadatos, radar, reseña y reproductor. La jerarquía es prometedora, pero faltan reglas: cuándo aparece el radar, qué acción es primaria y qué información se reduce en móvil. El botón de compartir sólo como ícono en tarjeta reduce descubribilidad.

8. **El reproductor está tratado como bloque elástico, no como etapa de la tarea.** En la ficha puede absorber gran altura y desplazar acciones. Deben acordarse prioridades por proveedor, altura móvil, estado de carga/fallo y si “Comprar”, “Escuchar” o “Añadir a crate” lleva la acción primaria.

9. **Pantallas de cuenta tienen una experiencia más utilitaria que el catálogo.** Login móvil es legible y directo, pero los formularios son de otra familia visual y repiten estilos entre rutas. Registro, recuperar y reset deben basarse en el mismo formulario, mensajes de error, reglas de contraseña y estados de éxito.

10. **Crates, perfil y editorial tienen menos art direction que el catálogo.** Su CSS local cumple la función, pero usa tarjetas, colores y botones distintos; editorial es especialmente provisional y concentra acciones irreversibles demasiado cerca. Necesitan jerarquía de roles, confirmaciones y estados vacíos diseñados.

11. **El footer es correcto como cierre, pero interfiere con overlays y con el FAB.** En pantallas cortas queda inmediatamente tras una única tarjeta; en móvil el FAB parece pertenecerle visualmente. El comportamiento de pie de página debe ser distinto cuando hay un overlay abierto y definirse el espacio seguro inferior.

12. **Tokens globales duplicados.** `src/app.css` y `src/lib/styles/styles.css` redeclaran colores, radios, espaciado y reglas generales de botón con valores distintos. Esto impide una corrección consistente y hace riesgoso cualquier ajuste fino de tamaños.

### P2 — deuda de experiencia y cobertura

13. **Breakpoints fragmentados.** 480, 540, 560, 600, 640, 680, 720, 768, 840, 860, 960, 980 y 1024 px aparecen como decisiones locales. Se necesita una escala de breakpoints basada en cambios reales de composición.

14. **Estados importantes no están cubiertos en pruebas UX.** Las pruebas existentes validan apertura de ficha, portada y tres reproductores, pero no navegación móvil, foco, overlays, formularios, crates ni editorial. La auditoría final debe usar fixtures y screenshots para los estados de cuenta/rol.

15. **Hay superficies duplicadas o residuales.** `/OTROS` y la copia de artista conservan patrones anteriores y multiplican el coste de mantener la interfaz. Antes de rediseñar, se decide si redireccionar, eliminar o convertirlos en laboratorio explícito.

## Principios de diseño que se conservarán salvo decisión contraria

- El catálogo se siente curado y musical, no como una tabla de base de datos.
- La portada y la tipografía son protagonistas; el verde señala una acción o estado de interés, no decoración indiscriminada.
- La información puede ser densa, pero la lectura debe revelar capas en vez de pedir interpretación inmediata.
- Las acciones de comunidad y edición deben hacer visible su consecuencia y no imitar acciones de exploración.
- Mobile se diseña como una experiencia autónoma: una acción útil por pulgar, capas estables y contenido prioritario visible sin depender de hover.

## Decisiones de dirección — ronda 1

Registradas el 30 de agosto de 2026.

1. **Jerarquía de acciones en una ficha:** escuchar → compartir → guardar en crate → comprar. Escuchar será la acción de mayor peso visual cuando exista un reproductor o destino reproducible. Compartir será visible y entendible, no sólo un ícono residual. Guardar será una acción personal secundaria. Comprar conservará valor editorial y de apoyo al artista, pero no competirá con la escucha.
2. **Ficha móvil:** portada grande e inmersiva, con la información distribuida de forma que identidad, metadatos y acciones no queden enterrados después de la imagen. La solución debe preservar la portada como escena inicial y garantizar una ruta inmediata hacia escuchar, compartir y guardar.
3. **Posicionamiento general:** Discótica es ante todo una **herramienta de exploración potente**. La estética editorial guía el carácter y la curaduría; búsqueda, filtros, relaciones entre datos, estado de resultados y navegación son la columna vertebral del producto.

## Decisiones de dirección — ronda 2

Registradas el 30 de agosto de 2026.

1. **Filtrado:** los resultados se actualizan instantáneamente. La interfaz de búsqueda y filtros no puede ocupar el espacio de exploración ni impedir ver las portadas/resultados: en desktop será un panel colapsable y compacto; en móvil, una hoja invocada desde un control persistente y discreto. Al cerrar la capa, los filtros activos y el resultado actualizado deben seguir siendo legibles y editables.
2. **Radar:** es una herramienta central para filtrar y conocer música. Cuando tenga valores distintos de cero, debe producir un orden por **afinidad de radar** y no quedar subordinado a fecha, alfabeto u otro orden general. La interfaz debe mostrar que está en modo afinidad, permitir volver a los otros órdenes deliberadamente y explicar de forma breve la relación entre la selección y los resultados. La implementación actual se considera defectuosa hasta que este contrato se cumpla.
3. **Navegación móvil:** por ahora se conserva el menú desplegable compacto. Se corrige su área táctil, foco, cierre y jerarquía; no se convierte todavía en una hoja o panel de navegación.

## Plan de trabajo por etapas

### Etapa 0 — decisiones de dirección (dos rondas)

**Objetivo:** elegir prioridades que no puede resolver una auditoría técnica: carácter, orden de tareas y grado de cambio admisible.

1. Ronda general: posicionamiento de la biblioteca, rol de la portada/radar, prioridad entre escuchar/comprar/coleccionar y nivel de densidad.
2. Ronda específica: composición móvil de ficha, patrón de navegación, comportamiento de búsqueda/filtros, roles editorial/comunidad y tratamiento de cuentas.
3. Salida: una breve carta de dirección UX/UI y decisiones registradas en `docs/modernizacion/decisiones.md`.

### Etapa 1 — fundaciones de interfaz

**Objetivo:** reducir variación accidental sin borrar el lenguaje visual.

- Unificar tokens de color, tipo, espaciado, radios, elevación, capas y motion; retirar duplicados entre estilos globales.
- Crear escala de controles: enlace textual, icono, compacto, estándar y prominente; mínimo táctil de 44 × 44 px cuando corresponda.
- Definir estados para hover, foco visible, activo, deshabilitado, carga, éxito, error y destructivo.
- Elegir 3–4 breakpoints semánticos y reglas de contenedor/espacio seguro inferior.
- Crear una primitiva única para diálogo, hoja móvil, dropdown y confirmación.

**Criterio:** una acción del mismo nivel se ve y se comporta igual en catálogo, cuentas, crates y editorial.

### Etapa 2 — descubrimiento y catálogo

**Objetivo:** que explorar, buscar y filtrar sea rápido y legible en todos los tamaños.

- Reordenar inicio y resultados para aclarar búsqueda, contador, filtros activos, grid y paginación.
- Dar prioridad explícita a la exploración: búsqueda fácil de reabrir, filtros que expliquen su efecto, URLs compartibles, resultados recuperables al volver y taxonomías navegables.
- Aplicar los filtros al instante, sin botón de confirmación. El panel se abre sólo cuando la persona lo solicita, conserva resultados visibles cuando sea posible y refleja inmediatamente los cambios en contador, chips, URL y orden.
- Rediseñar el radar como modo de descubrimiento central: calcular y ordenar por puntuación de afinidad cuando esté activo; distinguirlo visual y semánticamente de fecha/A–Z; incluir limpiar radar y una explicación corta del criterio aplicado.
- Definir la convivencia entre radar y orden manual: el radar toma el control mientras esté activo; fecha, A–Z y demás órdenes se restauran sólo al limpiar/desactivar radar o elegir explícitamente “ordenar por…”, acción que debe comunicar que cambia el modo.
- Diseñar un único flujo móvil de filtros: entrada, hoja, aplicar/cerrar, limpiar y retorno al resultado; evitar capas competidoras.
- Ajustar tarjetas para equilibrar portada, identidad, metadata y acciones; evaluar etiqueta accesible para compartir.
- Revisar taxonomías de artista/sello, estados vacíos y cargar más para que sean parte del mismo sistema.
- Acordar el destino del legado `/OTROS` y de la copia de artista.

### Etapa 3 — ficha y modal de lanzamiento

**Objetivo:** hacer que la ficha sea una experiencia editorial completa, con una composición móvil intencional.

- Prototipar una ficha móvil de portada grande con información en capas y acciones siempre localizables: (a) datos y acciones superpuestos en gradiente inferior; (b) portada a ancho completo seguida de resumen compacto y barra de acciones persistente. No implementar hasta elegir una.
- En escritorio, preservar el diálogo de dos columnas y reducir el ruido del fondo; confirmar tamaño máximo, ritmo vertical y altura del reproductor.
- Separar radar como capa informativa explícita en móvil, en vez de depender de hover de portada.
- Aplicar la jerarquía acordada: escuchar → compartir → guardar → comprar. Garantizar que las cuatro acciones no compitan visualmente ni cambien de orden sin razón entre proveedores.
- Definir fallbacks de portada/reproductor y comportamiento sin `buy_link`.

### Etapa 4 — cuenta, comunidad, crates y editorial

**Objetivo:** extender la calidad del catálogo a los flujos con identidad y consecuencias.

- Convertir auth en una familia única de formulario con validación legible, ayuda, recuperación y éxito/error consistentes.
- Diseñar vacío, crear, editar, compartir, quitar y borrar en crates; las acciones destructivas requieren confirmación contextual clara.
- Dar a sugerir una progresión comprensible: fuente → detección/edición → evidencia → envío → seguimiento de estado.
- Convertir editorial en una estación de revisión: comparación de datos, evidencia, decisión, comentario, historial y medidas contra errores de aprobación/rechazo.

### Etapa 5 — QA y lanzamiento gradual

**Objetivo:** volver medible la calidad y evitar regresiones.

- Matriz de screenshots por ruta/estado a 360–390 px, 768 px, 1024 px y 1440 px.
- Pruebas de teclado, foco, lector de pantalla básico, zoom 200 %, `prefers-reduced-motion`, carga lenta y error de reproductor.
- Pruebas de ranking del radar con fixtures deterministas: un perfil de radar debe devolver primero los lanzamientos de menor distancia/ mayor afinidad, sin que fecha o alfabeto alteren ese orden; empates deben tener una regla estable y visible en el código.
- Fixtures para estado anónimo, usuario, propietario de crate, colaborador/editor y admin; sin depender de producción.
- Lanzamiento por bloques: fundaciones → catálogo → ficha → áreas privadas; comparar analítica/feedback antes del siguiente bloque.

## Entregables

1. Auditoría versionada y matriz de cobertura de rutas/estados.
2. Carta de dirección y decisiones de las dos rondas.
3. Inventario de tokens y componentes con equivalencias de los estilos actuales.
4. Prototipos de alta fidelidad para los flujos de mayor riesgo, especialmente ficha móvil y filtros.
5. Backlog priorizado por P0/P1/P2 con criterios de aceptación y pruebas visuales.
6. Registro de QA responsive y accesibilidad antes de cada bloque de despliegue.

## Métricas de aceptación

- En móvil, una persona puede abrir una ficha, identificar el lanzamiento y ejecutar la acción principal sin una búsqueda visual larga ni depender de hover.
- Al activar filtros, el catálogo se actualiza de inmediato y la interfaz de control no tapa innecesariamente los resultados.
- Con radar activo, los primeros resultados son los de mayor afinidad al perfil elegido; el orden general no los desplaza silenciosamente.
- Todo control táctil operativo tiene caja útil de al menos 44 px o un agrupamiento que lo garantiza.
- Un overlay no deja competir visualmente ni interactivamente el contenido del fondo.
- Un diálogo/hoja mueve y devuelve el foco correctamente, cierra de forma predecible y no permite perderse con tabulación.
- Cada pantalla comparte la misma escala de botones, inputs, feedback y estados.
- Las pruebas visuales cubren cada ruta pública y cada rol/estado privado relevante a los cuatro anchos acordados.
