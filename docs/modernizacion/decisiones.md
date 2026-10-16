# Decisiones de producto y arquitectura

Fecha de inicio: 2026-08-30.

## Principios rectores

1. Discótica es un patrimonio editorial: los datos deben sobrevivir a proveedores, cuentas, renovaciones de pago y cambios de interfaz.
2. La renovación mejora la arquitectura sin sacrificar el lenguaje visual, la curaduría ni los comportamientos valiosos existentes.
3. La base de datos es la fuente de verdad; las interfaces son consumidores reemplazables de esa información.
4. Todo cambio debe ser reversible, verificable y aislado. Ningún componente debe poder dañar el catálogo completo.
5. El proyecto inicia con presupuesto cero, sin diseñar una dependencia que impida pagar infraestructura razonable cuando el crecimiento lo justifique.

## Roles

Solo existen tres roles de aplicación:

| Rol | Alcance |
| --- | --- |
| `admin` | Gestión robusta de catálogo, usuarios, roles, revisión, configuración y recuperación operativa. |
| `colaborador` | Crea aportes prioritarios y puede preparar propuestas comunitarias ajenas. No publica, no aprueba su propio aporte y no administra infraestructura, propietarios ni roles. |
| `comunidad` | Tiene perfil y crates; propone nuevos lanzamientos o correcciones. No publica directamente. |

Los permisos se aplicarán en PostgreSQL mediante Row Level Security (RLS), no solo ocultando botones en el cliente.

## Publicación y moderación

Toda propuesta de comunidad entra como pendiente. Un colaborador distinto del autor puede preparar una copia de trabajo y marcarla `ready_for_admin`; únicamente un admin solicita cambios, rechaza o aprueba/publica. Una propuesta creada por colaborador entra directamente a la cola prioritaria de admin y nunca puede auto-revisarse.

Flujo mínimo:

```text
comunidad -> pendiente -> colaborador prepara (opcional) -> ready_for_admin -> admin aprueba -> catálogo público
```

## Identidad

- El registro y recuperación de cuenta usan email.
- La interfaz de inicio de sesión debe pedir `username` y contraseña, no email.
- El email permanece como identificador interno de Supabase Auth y no se expone para resolver un username.
- La resolución `username -> cuenta` se implementará mediante una función de servidor con errores genéricos y límites de intento, nunca con una consulta pública de perfiles.

## Catálogo y procedencia

- El catálogo canónico migrará desde Google Sheets/TSV a PostgreSQL.
- Google Sheets puede sobrevivir como herramienta auxiliar de importación o respaldo editorial, pero no será la única fuente de verdad.
- Cada lanzamiento tendrá un ID inmutable. Los slugs son URLs compatibles y editables; no son claves de identidad.
- La fuente editorial debe entregar una clave estable por fila (`catalog_key`). Mientras no exista, una primera carga controlada puede usar una clave derivada del contenido, pero no se reutiliza para actualizaciones editoriales.
- Artistas, sellos, géneros y países se normalizan para búsqueda y relaciones, sin borrar las variantes editoriales visibles cuando tengan valor curatorial.
- **Hoja limpia como fuente del lanzamiento (2026-10-13).** El equipo limpió y ordenó a mano la hoja de Google Sheets.
  - Su TSV publicado reemplaza el contenido de los lanzamientos de staging (paso 8 del [plan de lanzamiento](../producto/plan-lanzamiento-2026-10-13.md)), y es lo que se importa en producción en E22.
  - Resuelve la referencia del legado de B10: es la hoja actual, no el TSV histórico de 2.796 filas.
  - "Reemplazar" significa que la hoja manda en todo lanzamiento con `catalog_key`, con dos reglas:
    - se conserva el UUID, así que colecciones, reportes y URLs siguen funcionando;
    - lo que la hoja ya no tiene se archiva, nunca se borra.

## Fuentes musicales, reproductores y portadas

- La URL musical externa y la URL de portada son datos distintos y deben preservar su procedencia.
- Bandcamp es la fuente mayoritaria actual; Spotify, SoundCloud y otras fuentes también deben continuar soportadas.
- Al crear una propuesta se parte de un enlace: se detecta proveedor, se intenta enriquecer metadatos, se presenta una vista previa editable y solo después se guarda la propuesta.
- Bandcamp tendrá un adaptador específico basado en sus metadatos públicos. Spotify y SoundCloud usarán sus mecanismos oficiales de oEmbed cuando correspondan. Otros proveedores usarán adaptadores o metadatos Open Graph con degradación a edición manual.
- El orden de resolución de portada es: portada detectada desde la fuente, URL externa provista por la persona, subida propia como último recurso.
- Las subidas se limitan por tipo, tamaño y dimensiones; se deduplican por hash. Los archivos asociados a propuestas no aprobadas no se conservan indefinidamente.
- No se reemplazarán los embeds actuales sin pruebas de regresión de Bandcamp, Spotify y SoundCloud.

## Infraestructura y continuidad

- Se mantiene Supabase/PostgreSQL como hipótesis principal, porque ya existe Auth y soporte inicial de crates.
- El frontend puede permanecer estático en Hostinger durante la migración. Cambiar de hosting no es requisito previo.
- Esquema, migraciones y configuración no secreta se versionan en GitHub.
- Los datos y objetos tendrán exportaciones externas restaurables; GitHub no sustituye un backup de datos.
- Los accesos críticos deben tener más de una persona propietaria dentro de la organización Discótica: GitHub, Supabase, dominio/Hostinger y correo de recuperación.
- La prueba de restauración completa se difiere mientras Supabase no tenga datos operativos útiles ni objetos de Storage. Será obligatoria antes de una migración irreversible en producción o antes de que Supabase sea fuente de verdad del catálogo.

## Crates

- Son colecciones o playlists sencillas de lanzamientos.
- Deben referenciar `release_id` inmutable y no un slug derivado de artista/título.
- El alcance inicial no incluye colaboración en crates, seguidores ni funciones sociales adicionales, salvo nueva decisión explícita.

## Interfaz — ronda 3 (2026-10-04)

Fuente: las 64 respuestas al catálogo de interfaz ([`respuestas-catalogo-ui.md`](./respuestas-catalogo-ui.md)). El plan por etapas que las ejecuta está en [`../producto/plan-interfaz-2026-10-04.md`](../producto/plan-interfaz-2026-10-04.md), con un prompt por etapa en [`../producto/prompts-interfaz-2026-10-04.md`](../producto/prompts-interfaz-2026-10-04.md). Tres respuestas ambiguas tienen una interpretación por defecto en la sección 5 del plan. Se conserva la dirección visual actual (paleta, tokens, tono). El trabajo es de sistema: tamaños de botones y tabs, y orden de cada vista en desktop y móvil, todo bajo un mismo sistema.

### Cambios a decisiones anteriores

- **Identidad.** El formulario de entrada acepta usuario **o** correo. Con usuario se sigue resolviendo en servidor (`login-with-username`, errores genéricos, límite de intentos). Con correo se entra directamente por Supabase Auth. Reemplaza "la interfaz de inicio de sesión debe pedir `username` y contraseña, no email".
- **Crates → colecciones.** En toda la interfaz se dice "colección/colecciones". Las URLs públicas cambian (`/mis-colecciones`, `/coleccion/[slug]`) y las antiguas redirigen, porque hay enlaces compartidos. Base de datos y código conservan `crates` y `crate_items`.
- **Perfil social.** Se amplía "sin funciones sociales adicionales": el perfil admite usuarios opcionales de Bandcamp, SoundCloud, Instagram, X/Twitter y Facebook, mostrados como iconos. El registro aclara que son voluntarios y sirven para que otras personas te encuentren y te sigan. La persona decide si sus aportes aceptados son públicos. Siguen fuera los seguidores internos y la colaboración en colecciones.
- **Orden manual.** Las colecciones se reordenan arrastrando. Requiere guardar la posición de cada elemento (hoy se ordenan por fecha de alta).

### Orden frente a E22 y línea base (2026-10-07)

- **U4 va antes de E22.** El corte a producción espera a que estén registrados todos los cambios del sitio de este plan, para publicar una sola vez. Reemplaza la recomendación de la sección 3 del plan de interfaz (E22 antes de U4) y cierra X2/S12 del [plan de saneamiento](../producto/plan-saneamiento-2026-10-06.md). Consecuencia aceptada: E22 arrastrará el cambio visual de U4 en adelante, sin un rollback separado para cada uno.
- **R1, R2, U2 y U3 aceptadas.** La línea base visual (`tests/visual/baseline/darwin/`) se recapturó sobre ese estado, junto con las plantillas de correo de D3, antes de empezar U4. Se borró la referencia temporal `.ref-pre-u3`. Cierra S2.
- **U4 aceptada (2026-10-07).** El equipo la aceptó al arrancar U5. Antes de recapturar, la línea base previa a U4 se copió a `tests/visual/.ref-pre-u4/` (se puede borrar cuando ya no haga falta). Después se recapturó `tests/visual/baseline/darwin/` sobre U4: 131 capturas, 0 diferencias antes de U5.
- **U5 aceptada (2026-10-07).** Se recapturó `tests/visual/baseline/darwin/` sobre U5: 133 capturas (incluye `lab-D` y `lab-M`) y 0 diferencias después. Las decisiones de diseño de las primitivas (tamaños 32/44/52, área táctil de 44, contraseña con solo la longitud mínima obligatoria, criterio de emoji) quedan en [`u5-primitivas-base-2026-10-07.md`](./u5-primitivas-base-2026-10-07.md). Sigue abierto si `/lab` debe existir solo en desarrollo.
- **U6 aceptada (2026-10-07).** Se recapturó `tests/visual/baseline/darwin/` sobre U6: 135 capturas (incluye `lab-u6-D` y `lab-u6-M`) y 0 diferencias después. La pasada con VoiceOver queda pendiente y no bloquea. Las decisiones de las primitivas compuestas quedan en [`u6-primitivas-compuestas-2026-10-07.md`](./u6-primitivas-compuestas-2026-10-07.md):
  - menús y listas en un portal dentro de la capa del modal o en una capa de página (`layerFor`);
  - Tab cierra el menú y devuelve el foco al "…";
  - los chips del combobox se recorren con flechas desde el campo y no son paradas de tabulación;
  - el ordenable arrastra solo desde el asa y se mueve con flechas desde ella;
  - los nombres de créditos se acogen a la excepción "en línea" del objetivo de 44 px.
- **U7 y U8 aceptadas (2026-10-07).** El equipo aceptó las dos juntas. Se recapturó `tests/visual/baseline/darwin/` sobre U8: 142 capturas (incluye `lab-u8-D` y `lab-u8-M`) y 0 diferencias después. Se borraron la referencia temporal `tests/visual/.ref-pre-u8/` y `CreditSummary.svelte`, sin uso desde U8. Las decisiones quedan en [`u7-shell-layouts-2026-10-07.md`](./u7-shell-layouts-2026-10-07.md) y [`u8-tarjeta-modo-lista-2026-10-07.md`](./u8-tarjeta-modo-lista-2026-10-07.md); las de la tarjeta, además, en "Tarjeta (2026-10-07, durante U8)". Sigue pendiente probar el doble toque del radar en un iPhone real.
- **U9 aceptada (2026-10-07).** Se recapturó `tests/visual/baseline/darwin/` sobre U9: 142 capturas y 0 diferencias después. La geometría de la ficha queda en "Ficha (2026-10-07, durante U9)" y el relevo en [`u9-ficha-2026-10-07.md`](./u9-ficha-2026-10-07.md). Siguen pendientes el iPhone real (área segura y barra acoplada), VoiceOver y si las etiquetas de rol pasan a caja normal. El `overflow-x` global de `body`, que anula el sticky, queda para U10 o U18.
- **U10 aceptada (2026-10-07).** El equipo la aceptó tras el ajuste descrito en "Inicio y búsqueda (2026-10-07, durante U10)". Se recapturó `tests/visual/baseline/darwin/` sobre U10: 145 capturas (incluye `home-list-D/M` y `home-loading-M`) y 0 diferencias después. Se borró `src/lib/components/Pagination.svelte`, sin uso desde U10 (copia en `respaldos/`). El expediente es [`u10-inicio-busqueda-2026-10-07.md`](./u10-inicio-busqueda-2026-10-07.md). Siguen pendientes el iPhone real (banda de filtros, selector de orden nativo, hoja) y el `overflow-x` global que anula el sticky (U18).

- **U15 aceptada (2026-10-10).** El equipo la aceptó al arrancar U16. `tests/visual/baseline/darwin/` no se recapturó: sigue en U10, porque U10b–U14 no están aceptadas y recapturar las aceptaría también. Se borró `tests/visual/.ref-pre-u15/`; U16 se compara contra `tests/visual/.ref-pre-u16/` (el árbol con U15). El expediente es [`u15-estudio-estructura-catalogo-2026-10-10.md`](./u15-estudio-estructura-catalogo-2026-10-10.md).
- **U10b, U11, U12, U13, U14, U16 y U17 aceptadas (2026-10-11).** El equipo las aceptó juntas. Antes de recapturar, la comparación contra `.ref-pre-u17` dio solo lo descrito en U17 (6 diferencias y 6 capturas nuevas). Se recapturó `tests/visual/baseline/darwin/` sobre U17: 182 capturas. Se borraron las ocho referencias temporales `tests/visual/.ref-pre-*` (copia en `../discotica-backups/2026-10-11-arbol/`).
  - **Header del Estudio al saltar de sección:** con `prefers-reduced-motion`, el header quedaba visible u oculto según una carrera entre el scroll y el cambio de foco. `ReleaseEditor.goTo` enfoca el `h2` un frame después, y el header queda visible, que es el estado aceptado en U16. Sin reducción de movimiento, el scroll suave lo sigue ocultando.
  - **Capturas del editor:** `estudio-editor-medios-M` enfoca el selector antes de elegir la sección, y `estudio-editor-generos-D` enfoca el combobox antes de escribir. Las dos dan las imágenes aceptadas en U16, 8 de 8 seguidas.
  - **Deuda conocida:** `lab-u6-M` y `lab-u8-M` fallan a veces, con un 0,01 % de antialiasing en los marcadores de portada. "El censo conserva sus 127 IDs" sigue fallando, como desde U7.

### Inicio y búsqueda (2026-10-07, durante U10)

Feedback del equipo sobre la primera versión de U10:

- **Paginación "x de y" en todas las vistas y anchos** (‹ 5 de 233 ›), la que no cambia de ancho. Reemplaza los números en desktop. `Pagination` pasa a `compact` por defecto; `full` y `auto` siguen en la primitiva.
- **"Reiniciar filtros" más visible.** Variante nueva de `Button`, `accent` (borde y texto de acento, sin relleno lleno), con el icono `reiniciar`. En el panel va al inicio del pie; en la hoja móvil, junto a "Ver N lanzamientos" ("Reiniciar", con nombre accesible "Reiniciar filtros").
- **Modo lista con la composición móvil en todos los anchos:** portada · créditos, título y datos en tres líneas · compartir, sin géneros. En desktop la columna de géneros los recortaba. Reemplaza "Desde 768: … · géneros · …" de U8.
- **Contador "x–y de z lanzamientos":** en desktop, junto a la paginación superior; en móvil, al pie, sobre la paginación inferior, para no sumar una línea antes de la primera portada.

### Búsqueda directa (2026-10-08, U10b)

Enmienda a U10, decidida con el equipo en tres rondas el 2026-10-08. Plan: [`../producto/plan-busqueda-directa-2026-10-08.md`](../producto/plan-busqueda-directa-2026-10-08.md). U10b-1 (desktop) y U10b-2 (móvil) están en [`u10b-busqueda-directa-2026-10-08.md`](./u10b-busqueda-directa-2026-10-08.md).

- **El campo de texto es el disparador en desktop.** Reemplaza el botón «Buscar» (`HomeSearchToggle`, borrado). Cerrado mide `min(100%, 24rem)` y va **centrado**, donde estaba el botón; abierto ocupa todo el ancho, desde el borde izquierdo del panel. Reemplaza "alineado a la izquierda" de la ronda 1: tras ver U10b-1, el equipo prefirió el campo estático en el centro (2026-10-08).
- **Apertura:** un clic o un toque en el campo, o empezar a escribir (también ArrowDown). El campo crece desde el centro hasta el ancho del panel con `--motion-fast` (sin transición con `prefers-reduced-motion`), aparece la × y se despliega el panel. Un foco no abre: ni Tab, ni «Explorar» de la bienvenida, ni el cierre de la invitación beta.
- **Despliegue del panel, más expresivo sin ser más largo ni rebotar** (feedback, 2026-10-08). Token nuevo `--ease-expressive` (`cubic-bezier(0.16, 1, 0.3, 1)`): arranque rápido y frenada larga, con todos los puntos de control en y ≤ 1, sin overshoot. El panel se descubre de arriba abajo desde el campo mientras baja 8 px (`--motion-base`), y sus dos columnas llegan con 20 y 50 ms de desfase (`--motion-overlay`). El campo y las chips usan la misma curva. Con `prefers-reduced-motion`, nada se anima. El cierre no cambia (180 ms, sin desfase).
- **Cierres:** la × "Cerrar búsqueda" (conserva texto, filtros y radar, como el botón de antes), Esc (el primero cierra las sugerencias y el segundo el panel) y un clic fuera de la región de búsqueda. Las chips, las sugerencias y los desplegables cuentan como dentro. La × y Esc dejan el foco en el campo sin reabrir.
- **Chips activas** fuera del campo: bajo él y sobre el panel, abierto o cerrado. Acompañan al campo: centradas bajo el campo cerrado y al inicio con el panel abierto, alineadas con el formulario (`ActiveSearchPills align`). Al cambiar, viajan a su sitio con la duración y la curva del campo, sin saltar (feedback, 2026-10-08). En móvil siguen como banda bajo la barra, siempre al inicio.
- **Texto:** sin cambios. Enter o una sugerencia crean la chip; no se filtra en vivo. E11 y E12 no cambian.
- **Formulario desktop sin hueco:** fila 1 País · Género; fila 2 Tipo · Año · «Reiniciar filtros» (acento, a la altura de los controles). El pie del panel desaparece. Reemplaza "En el panel va al inicio del pie" (arriba, U10).
- **Radar desktop** sin cambios, en la columna derecha desde 1024. **Tablet (769–1023):** el patrón de desktop con el radar apilado bajo el formulario; el corte de E15 sigue en 768.
- **Móvil (U10b-2):** la barra lleva un input real, un botón Filtros con el número de activos y la vista; la hoja pierde el campo de texto y el pie "Ver N" (cierra la ×), con el orden País·Género / Tipo·Año / Reiniciar / Radar desplegado. La hoja se mide al abrir para que asomen ~72 px del radar, con tope de 88dvh. Radar en dos columnas con puntos de 40 × 44 al dedo.
- **Implementación (U10b-1):**
  - el combobox de sugerencias se extrae a `SearchCombobox` sin cambiar comportamiento ni ARIA; las listas de país, género, tipo y año pasan a `$lib/domain/filterOptions`;
  - `dropdownMenu` (`overlay.ts`) no se reutiliza para el clic fuera: mueve el foco al abrir, lo devuelve al cerrar y anula el `pointerdown` de fuera, y aquí ese clic tiene que llegar a su destino (un resultado, la paginación);
  - el `<input>` ya no muestra el anillo global de `:focus-visible` dentro del campo: la fila lo marca con `:focus-within`. Antes había dos anillos, uno dentro del otro, y ahora el campo enfocado es el estado normal al abrir.
- **Implementación (U10b-2):**
  - **una sola región de búsqueda:** en móvil (≤768) lo es la barra (`role="search"`, "Catálogo"). `HomeSearchBar`, que ahí solo muestra la banda de chips, deja de ser landmark. Así no hay dos landmarks ni uno vacío;
  - **placeholder corto en la barra:** «Buscar», como el botón anterior. A 360 el campo mide ~150 px y el texto de desktop se cortaba ("País, género, a"). El nombre accesible no cambia;
  - **radar compacto bajo 680, no bajo 480:** ejes | gráfico a tamaño completo necesita 566 px con el dedo, y la hoja ofrece 432 px a 480 (con ratón tampoco cabe a 400). Bajo 680, la etiqueta y el valor van sobre los puntos, el gráfico mide ~115 px y Aleatorizar/Limpiar van bajo él. Los puntos de 40 × 44 se mantienen solo con el dedo bajo 480; por encima siguen siendo de 44 × 44. Desktop (>768) no cambia;
  - **«Reiniciar filtros» con su texto completo** en la hoja: ya no comparte línea con "Ver N".

### Tarjeta (2026-10-07, durante U8)

- Título de la tarjeta a `--text-2xl` (24 px, 800), hasta dos líneas: un punto medio entre el que se veía (`--text-3xl`, demasiado grande) y 16 px (demasiado pequeño).
- Altura estable por fila de la grilla: las tarjetas de una fila miden lo mismo, sin reservar dos líneas de título en todas (dejaba un hueco bajo cada título corto). Detalle en [`u8-tarjeta-modo-lista-2026-10-07.md`](./u8-tarjeta-modo-lista-2026-10-07.md).
- Para U9: en la ficha, todos los colaboradores visibles por rol (sin "y N más") y los nombres de los créditos en caja normal, como en la tarjeta, no en mayúsculas sostenidas.

### Ficha (2026-10-07, durante U9)

Decidido por el equipo en dos pasos, al detenerse U9 por geometría. Evidencia y capturas en [`u9-ficha-bloqueo-geometria-2026-10-07.md`](./u9-ficha-bloqueo-geometria-2026-10-07.md).

- **Dos columnas desde 768 px (`--breakpoint-mobile`), en modal y en página.** Reemplaza "Pasa a dos columnas desde 680 px" (abajo, "Objeto lanzamiento") y el "sin cambiar el corte de 680" del plan (U9, punto 7).
  - Por debajo de 768, una columna: portada enmarcada a todo el ancho y barra de acciones fija abajo.
  - `--breakpoint-ficha` (680) no cambia: lo siguen usando la grilla y otras vistas.
  - Un primer paso fijó el corte en 1024. El equipo lo encontró demasiado alto: dejaba una ficha vertical con portadas gigantes en pantallas de escritorio y tablet.
- **Barra de acciones al pie de toda la ficha**, también bajo la portada: arriba portada | información; abajo, la línea de acciones. Así la columna de información ya no tiene que contener los 455 px de las acciones y puede bajar a 360 px. La "altura útil" de la portada es el alto de la ficha menos la barra.
- **Marco uniforme alrededor de la portada:** 24 px (`--ficha-frame`), el mismo en los cuatro lados, sobre el fondo del sitio. Sustituye a "sin barras arriba ni abajo": lo que molestaba eran franjas solo arriba y abajo. Un margen igual en todos los lados es aceptable.
- **Tope del bloque de la portada:** 640 px (marco incluido). La portada a 1440 se veía demasiado grande.
- **Por qué:** con la portada a toda la altura y las acciones dentro de la columna de información, el diálogo mediría 158 px de alto a 680 y 312 px a 834, y el reproductor no cabría.

### Contrato de datos D1 (2026-10-06)

Detalle, pruebas y rollback en [`d1-datos-perfil-colecciones-2026-10-06.md`](./d1-datos-perfil-colecciones-2026-10-06.md). Implementado solo en local; no está aplicado en staging.

- **Redes.** Cinco columnas `social_*` en `profiles` con el usuario normalizado (minúsculas, sin `@` ni URL) y una restricción de formato por red. La URL pública la construye el cliente (`src/lib/domain/profileSocial.ts`), que replica los formatos. Las redes son públicas, como el resto del perfil, y las escribe solo el dueño. Al registrarse se envían en los metadatos del alta.
- **Bandcamp: página de artista y de fan (decidido el 2026-10-06).** Se aceptan las dos: `artista.bandcamp.com` y `bandcamp.com/usuario`. Se guarda el nombre en `social_bandcamp` y la forma en `social_bandcamp_kind` (`fan` | `artist`). Como un nombre suelto no dice cuál es, el formulario pide el enlace a la página de Bandcamp. Los dominios propios de artistas no se aceptan. Reemplaza la interpretación I4, que solo aceptaba la página de fan.
- **Aportes públicos.** La preferencia `show_accepted_contributions` está apagada por defecto. La lectura pública es una RPC que devuelve solo el lanzamiento publicado y la fecha de aceptación; `contributions` sigue cerrada a lectura ajena.
- **Orden manual.** `crate_items.position`, única por colección, con backfill desde `added_at`. Las altas van al final y las bajas dejan huecos. Se reordena solo con una RPC del dueño que recibe la colección completa en el nuevo orden y la aplica de forma atómica. Si la colección cambió desde la última lectura, falla con `40001` y el cliente recarga. Entre dos reordenamientos simultáneos gana el último. Ninguna política existente de colecciones cambió.

### Contrato de datos D2 (2026-10-06)

Detalle, ejemplos de respuesta, pruebas y rollback en [`d2-estudio-lote-vistas-rapidas-2026-10-06.md`](./d2-estudio-lote-vistas-rapidas-2026-10-06.md). Implementado solo en local; no está aplicado en staging. Requiere E18.

- **Lote.**
  - Publicar o archivar hasta 50 lanzamientos, solo admin, todo o nada.
  - No tiene escritura propia: cada lanzamiento pasa por la RPC individual de E06 con su versión. Así recibe la misma validación, la misma auditoría (un change set por lanzamiento, enlazados por `batch_id`) y los mismos errores.
  - Si un elemento falla, no cambia nada y el informe dice qué falló en cada uno.
  - Un lanzamiento que ya está en el estado pedido sale "sin cambios" y no se audita.
  - El límite de 50 evita degradar la base durante el lote. Una selección mayor no se parte en silencio.
- **Incompleto.** Significa que hoy no se podría publicar por falta de datos. Se aplica en cualquier estado y es la regla de publicación de E06: fecha, tipo, sello, un artista principal, un género, un país, portada HTTPS y un enlace principal HTTPS con proveedor. La reseña y la calidad de créditos no cuentan.
- **Sin portada.** No hay portada HTTPS; una `http://` cuenta como faltante.
- **Con reportes.** Tiene al menos un reporte vinculado sin resolver ni cerrar (`new`, `triaged` o `in_progress`).
- **Borrador.** Su estado es `draft`.

### Sistema y navegación

- Header con mayúsculas sostenidas en los elementos principales. Los botones usan el padding del botón Comprar: más ancho que alto.
- En móvil "Entrar" es el botón lleno, pero con el mismo tamaño que "Sugerir", para que no domine. El icono de menú se redibuja con tres barras regulares.
- Con sesión en desktop: avatar que abre el menú de cuenta (Perfil, Mis colecciones, Salir).
- Admin y colaboradores llegan a sus herramientas desde el perfil, no desde el header.
- Iconos solo en SVG: fuera los emoji (🔍 de Buscar). Salir lleva icono.
- Barras de scroll propias, discretas y en la paleta, en todo el sitio.
- Texto pequeño (metadatos) ~15 % más legible, sin cambiar el tamaño ni la distribución de la tarjeta.
- Estados vacíos y de error utilitarios: mensaje corto y una acción.
- Carga: esqueleto que conserva la composición, más el indicador actual con las barras pulsantes en horizontal.
- Retorno con migas en texto ("Catálogo › Artista").

### Descubrimiento

- Grilla de máximo 3 columnas, con la tarjeta del tamaño actual. Selector grilla/lista que se recuerda; también dentro de las colecciones.
- Paginación numerada en todas las vistas. Se corrige la alineación del texto con los botones y el ancho. En móvil, paginación y "Ordenar por" comparten línea.
- Móvil, antes de la primera portada:
  1. buscar;
  2. filtros activos, en una banda horizontal desplazable más compacta;
  3. paginación y orden.
- Desktop: se mantiene el panel actual con filtros y radar, más compacto. El campo de texto sigue dentro del panel, más alto y ~15 % más visible. "Reiniciar filtros" es un botón secundario del panel.
- Radar:
  - en desktop se ve al pasar el cursor; en móvil, tocar la portada equivale a ese hover;
  - cinco puntos por eje;
  - "Randomizar" pasa a "Aleatorizar";
  - en móvil la palabra RADAR aparece solo en el desplegable cerrado.
- Hoja de filtros móvil: altura según contenido y un botón fijo "Ver lanzamientos" abajo. Ningún texto desborda el ancho.
- La bienvenida editorial es un componente permanente del inicio, con ilustración de marca. La invitación beta es otra pieza, con diálogo propio, para enviar a probadores.
- Artista y sello: solo el nombre, alineado a la izquierda, con migas y sin filtros internos.

### Objeto lanzamiento

- Créditos en la tarjeta:
  - se ven todos los artistas principales, truncados si no caben;
  - con colaboradores: "Principal y N más", en texto y sin caja;
  - "Varios artistas" solo cuando el tipo es Compilado, nunca por número de artistas.
- La ficha muestra a todos los artistas organizados por rol.
- Tarjeta: año · país · sello más géneros. Compartir como icono discreto.
- Ficha en desktop: portada cuadrada fija a la izquierda (se recorta si no es cuadrada) e información con scroll interno a la derecha, sin barras arriba ni abajo. Pasa a dos columnas desde ~~680~~ 768 px, con marco uniforme y la barra de acciones al pie (cambio del 2026-10-07, ver "Ficha (2026-10-07, durante U9)").
- Acciones en una sola línea: Comprar y Añadir a colección con texto e icono; Compartir y Reportar solo con icono.
- Reproductor completo con lista de pistas. Elegir una pista no mueve el scroll.
- Ficha en móvil: portada a ancho completo y barra de acciones fija abajo.
- Sin portada: logo de Discótica atenuado. Los títulos largos crecen.
- La página del lanzamiento usa el mismo componente que el modal, con:
  - la distribución optimizada;
  - el fondo desenfocado del modal en lugar del gris;
  - un "Explorar el catálogo" rediseñado;
  - las mismas acciones.

### Cuenta y comunidad

- Las pantallas de cuenta comparten layout: título, ayuda, formulario y pie.
- Entrar:
  - desktop en dos columnas: beneficios a la izquierda, formulario a la derecha;
  - en móvil, primero el formulario;
  - tres beneficios: colecciones, compartirlas y aportar lanzamientos.
- El registro sigue en un paso, con los campos agrupados. Las reglas y la fortaleza de la contraseña se muestran en vivo, y las redes sociales son opcionales.
- Tras registrarse aparece la pantalla "Revisa tu correo", con el correo, "Reenviar" y "Abrir correo".
- Correos en HTML sencillo con logo y botón verde, desde hola@discotica.com. Al confirmar se llega a Mis colecciones con un aviso.
- Sugerir va por pasos: fuente → revisar datos → nota → enviar.
- La nota de quien propone nunca es obligatoria, ni al sugerir ni al proponer un cambio. La nota del revisor al rechazar o pedir cambios sigue siendo obligatoria.
- Las listas (artistas, géneros, países) se editan con chips y buscador, el mismo control que en la herramienta interna.
- Se reporta desde la ficha y desde el menú global.
- "Mis aportes" es una sección propia (el nombre reemplaza a "propuestas"):
  - filas compactas;
  - botones de acción de los pendientes con tamaño normal.
- En un perfil ajeno se ven las colecciones, las redes y los aportes aceptados, si la persona lo permite.
- Mis colecciones: mosaico de 4 portadas y nombre. Las acciones van en "…": todas menos abrir.
- Dentro de una colección:
  - las acciones son botones explícitos arriba;
  - selector grilla/lista, sin notas visibles;
  - se reordena arrastrando.

### Cuenta (2026-10-09, durante U12)

- **Editar cuenta.** Lo pidió el equipo en el chat de U12. Ruta `/cuenta`, con `AccountLayout`, y tres formularios:
  - perfil, redes y novedades por correo;
  - correo;
  - contraseña.

  El usuario sigue sin poder cambiarse.
- **Accesos a Editar cuenta:**
  - "Editar cuenta" en el menú de cuenta, junto a Salir;
  - en móvil, bajo Mis aportes;
  - botón en el perfil propio.

  Amplía el menú de la sección 5 del plan (Perfil, Mis colecciones, Mis aportes, Salir).
- **"Revisa tu correo"** es una ruta propia, `/auth/confirmar`. El correo no viaja en la URL. Se reenvía con 60 s de espera.
- **Webmail:** "Abrir correo" solo para Gmail, Outlook e iCloud.
- **Destino del correo de confirmación:** sigue siendo `/auth/reset?flow=signup`, que lleva a Mis colecciones con el aviso. Así no cambian las Redirect URLs de Supabase.
- Detalle en [`u12-cuenta-2026-10-09.md`](./u12-cuenta-2026-10-09.md).

### Sugerir (2026-10-09, durante U13)

- **Sugerir lleva directo a crear la sugerencia, sin pantalla intermedia.** Lo pidió el equipo en el chat de U13.
  - Comunidad y colaboración llegan al paso 1, con el foco en la fuente.
  - **Admin:** ve el mismo flujo (pegar el enlace y rellenar). Como E09 no acepta envíos de admin, el último paso es "Continuar en la consola": abre "Nuevo lanzamiento" con lo rellenado y nombra lo que falta crear. Sustituye la tarjeta "Usa la consola administrativa" de E10.
  - Una primera versión redirigía a la consola después de pintar el formulario. El equipo la rechazó y eligió esta opción sobre cambiar E09 (publicar desde Sugerir, o enviar a la cola).
  - Sin sesión, el header sigue llevando a Entrar con retorno.
- **Listas de sugerir:** artistas, géneros y países con el Combobox de U6. Los cuatro permiten "Añadir «…»", porque E09 acepta nombres libres. Cerrar géneros o países al diccionario sería una decisión aparte.
- **"Proponer un cambio a un lanzamiento existente"** no existe en el contrato de E09. Hoy, "cambio" es corregir una propuesta con cambios solicitados, y su nota es opcional. El caso para E09 está en [`u13-sugerir-reportar-2026-10-09.md`](./u13-sugerir-reportar-2026-10-09.md).
- **Menú global:** se monta solo el del ancho actual. Con los dos montados, ningún enlace del menú navegaba (fallo previo, corregido en U13).

### Herramienta interna

- Catálogo, propuestas y reportes son una sola herramienta, con una sección por tarea bajo la misma base de URL.
- Layout propio (barra lateral y ancho completo) con un lenguaje visual dedicado a revisar y crear lanzamientos. Es parte de la misma plataforma, como YouTube Studio respecto de YouTube.
- La tabla del catálogo conserva la densidad actual.
- Vistas rápidas: Borradores, Incompletos, Sin portada y Con reportes.
- Primera acción masiva: publicar o archivar en lote.
- Editor:
  - una sola página con secciones e índice lateral, más compacta que hoy;
  - géneros y países con combobox con búsqueda y chips;
  - sin vista previa;
  - edición completa en móvil, con una vista pensada para móvil.
- Propuestas en bandeja: lista a la izquierda y detalle a la derecha. Se muestra solo lo propuesto, con los campos editados marcados.

### Editor del Estudio (2026-10-10, durante U16)

Detalle en [`u16-estudio-editor-2026-10-10.md`](./u16-estudio-editor-2026-10-10.md). Ninguna sustituye una decisión de producto.

- **Secciones:**
  - Datos: título, tipo, fecha, sello, reseña y datos técnicos;
  - Créditos;
  - Clasificación: géneros, países y radar;
  - Medios: link de compra o escucha y portada. El link pasa de los datos esenciales de E07 a Medios y sigue contando para publicar;
  - Historial: deja de ser una pestaña.
- **Créditos en filas, con el Combobox para buscar y añadir** (`chips={false}`). Se conservan mover entre grupos, arrastrar y la selección múltiple; arrastrar ahora también ordena (soltar delante de otro). Se quita "Cambiar identidad" (✎): es Quitar + añadir, y el orden se corrige arrastrando.
- **Géneros con alta desde el Combobox** ("Crear género «…»", con la confirmación auditada). **Países sin alta:** vocabulario cerrado (E07).
- **Una barra de guardar fija abajo en todos los anchos**, con la observación y los avisos del resultado. **Archivar y "Relacionado" van a "Más acciones"**, separados de Guardar (hallazgo del censo). Los reportes abiertos, además, en la cabecera.
- **Observación:** sin ella, Publicar y Archivar no abren la confirmación. La reversión pide la suya en el diálogo. El payload no cambia (`p_reason`).
- **Sticky en el Estudio:** `html.is-tool` (`overflow-x: clip`) y `--header-offset`. Queda pendiente para U18 aplicarlo a todo el sitio, porque activa el header fijo de E14 en todas las páginas. *Sustituido en U18 (H1): `clip` global; `html.is-tool` ya no existe.*

### Bandeja del Estudio (2026-10-10, durante U17)

Detalle en [`u17-estudio-propuestas-reportes-2026-10-10.md`](./u17-estudio-propuestas-reportes-2026-10-10.md). Ninguna sustituye una decisión de producto.

- **Selección en la URL** (`?propuesta=`, `?reporte=`). En ancho se abre sola la primera; en móvil, solo la lista. Tras decidir se abre la siguiente.
- **"Editado"** compara lo que la fuente detecta (título, artistas en orden, tipo y fecha). Cualquier cambio de texto cuenta, también mayúsculas y tildes. Lo demás nunca se marca. Con la fuente ilegible no hay marcas y se dice.
- **Colaborador:** su cola comunitaria va antes que sus aportes. Las acciones no cambian.
- **Botones de decisión** en una línea; apilados si el detalle mide menos de 480 px. "Rechazar" nunca queda solo.
- **Nota interna del colaborador:** E09 la guarda donde administración no la lee (limitación de E10). Queda para el equipo cambiar su ayuda o abrir el caso de E09. Decidido en U18 (abajo).

### QA de interfaz (2026-10-14, U18)

Decidido por el equipo sobre el [expediente de U18](./u18-qa-interfaz-2026-10-14.md). Se ejecuta en el paso 5 del plan de lanzamiento.

- **Header fijo en todo el sitio (H1).** `html, body` pasan de `overflow-x: hidden` a `clip`, y desaparece el caso especial `html.is-tool`. Se activan el header de E14 (se oculta al bajar y reaparece al subir), la línea «Buscar» fija de E15 y U10, y el índice del manual. Cierra el pendiente abierto desde U9.
- **País y sello de la tarjeta con área táctil de 44 px (H3).** El área de toque se amplía sin cambiar el aspecto de la línea "año · país · sello", en la tarjeta y en la fila. La excepción "en línea" de U6 sigue cubriendo solo los nombres de los créditos.
- **`/lab` solo en desarrollo (H7).** En producción responde 404. La suite visual y las pruebas de `/lab` siguen corriendo contra `vite dev`. Cierra lo que dejó abierto U5.
- **"Nota interna" (H8).** Ahora se cambia la ayuda para que no prometa que administración la lee. Después del lanzamiento se abre el caso de E09 para que el admin la vea.
- **Pendientes sin decidir, para después (2026-10-14, paso 5):** "Mejor coincidencia" cortada a 360 (U10) y el aviso al salir de Sugerir con datos sin guardar (U13) siguen como P2 abiertos.

**Al corregir H1 (2026-10-14, paso 5, grupo "Scroll y header").** Decisiones técnicas; ninguna cambia producto.

- **Reserva arriba al desplazarse.** Con el header y «Buscar» sticky, un elemento al que se desplaza la página (ancla, `scrollIntoView`, foco con Tab) quedaba bajo lo que reaparece al subir. `html { scroll-padding-top }` suma `--header-reserve` (alto del header en escritorio; 0 en móvil, donde solo vuelve al inicio) y `--search-reserve` (la barra «Buscar» del inicio en móvil). Las publican `Header.svelte` y `MobileSearchBar.svelte`. **Coste aceptado:** al desplazarse hacia abajo el header se oculta y queda un hueco de 76 px (60 en móvil) sobre el destino. Se prefiere un hueco a un destino tapado. Los `scroll-margin` de cada vista ya no suman el header (el editor del Estudio lo hacía con `--header-offset`).
- **Barra de la ficha página en sticky.** `dockBar` (JavaScript, `position: fixed` hasta acoplarse) emulaba sticky por el `overflow-x` de `body`. Ahora es `position: sticky; bottom: 0`, con la misma geometría.
- **Capturas de página completa y de elemento** (`tests/visual/support/capture-document.css`): el header y «Buscar» se capturan en su sitio del documento (`relative`), no donde esté el scroll. Las capturas del viewport conservan el sticky real.
- **H15 (nuevo):** paginar desde abajo no subía a la grilla con movimiento normal (`goto` con `noScroll` devolvía el scroll al terminar). Se corrigió en el mismo grupo: primero la URL y después el desplazamiento.

**Al corregir H2 (2026-10-14, paso 5, grupo "Seguridad de acceso").** Aceptado por el equipo. Da contenido al "límite de intentos" de "Identidad", que hasta ahora recaía solo en el límite por IP de Auth.

- **Límites de `login-with-username`:** 5 fallos por usuario y 20 por IP de quien llama, en 15 minutos. Al superarlos, la función responde 429 sin consultar la cuenta, y la pantalla de entrar dice "Demasiados intentos seguidos…", como con el límite de Auth.
- **Un usuario inexistente se bloquea igual que uno real.** Si solo se bloquearan los reales, el bloqueo los delataría. Por lo mismo, toda respuesta de credenciales inválidas tarda al menos 1200 ms (`FAILURE_FLOOR_MS`).
- **Coste aceptado:** quien conozca un usuario puede bloquear su entrada con usuario durante 15 minutos. Entrar con correo no pasa por la función y sigue disponible.
- **Un acceso correcto reinicia el contador del usuario**, no el de la IP.
- **Privacidad:** la tabla (`private.username_login_attempts`) guarda la IP como HMAC, nunca en claro, y borra las filas de más de un día.

### Pasos 8 y 10 del lanzamiento (2026-10-15)

Decididas al arrancar el paso 11 (E21-rc2). El usuario las delegó en el chat: "ya salió bien" para el paso 8 y "acéptalo tú por mí" para el paso 10. Claude tomó la recomendación del plan cuando la había.

- **Paso 8, aceptado con la hoja tal como está.**
  - El 2026-10-15, el TSV publicado sigue siendo `83f29cda…`, el mismo del reemplazo. No trae las correcciones 1 y 4 (el artista de REUNION y la clave `rel_002797` de OH MARGÓ). El reemplazo no se repite.
  - Efecto en staging: REUNION (`rel_001634`) sigue archivada, y `rel_001638` conserva su UUID con los datos de OH MARGÓ, con el slug anterior como alias.
  - Si la hoja cambia antes de congelarla para E22-A, el paso 8 se repite en staging antes del ensayo (regla del plan). E22 importa la hoja congelada, esté como esté.
- **B4, créditos (E21-P0-03): se redefine el criterio de salida.** El criterio de E21 era: "Muestras exacto/aproximado y créditos aprobadas editorialmente".
  - **Por qué no se aprueba una muestra en staging:**
    - ninguna pantalla del Estudio marca créditos como `verified`. Solo lo hace aplicar un lote de E08, y un lote solo admite inferencias `high`;
    - la prueba en seco de E08 dio `manual` en los 10 casos, porque la hoja no trae autor estructurado;
    - lo que se aprobara en staging no pasaría a producción, que se importa desde la hoja.
  - **Por qué no bloquea:** el sitio no muestra la calidad de los créditos. `creditQuality` se calcula, pero ninguna vista la usa. Los créditos publicados son los de la hoja, que el equipo limpió a mano.
  - **Criterio nuevo para el lanzamiento:**
    1. el flujo de E08 (cola, lote, aplicación y reversión) pasa su verificación en staging, con rollback, dentro de E21-rc2;
    2. la verificación de créditos empieza en producción después del corte, como trabajo editorial del periodo de observación;
    3. `legacy` es el estado esperado de los 2.782 lanzamientos al cortar.
  - Con esto, E21-P0-03 se cierra por redefinición cuando se cumpla el punto 1.
- **B6, cuenta de colaborador permanente en staging (E21-P1-01).**
  - Se crea desde el registro real, con el correo `hola+colaborador@mamanche.com` y el usuario `colaborador_qa`.
  - Se confirma y se le asigna el rol `colaborador` por SQL. No hay pantalla de roles: es el mismo camino que usan E01 y E09.
  - La contraseña vive solo en `.env.local` (`E21_STAGING_COLAB_EMAIL` y `E21_STAGING_COLAB_PASSWORD`).
- **Limpieza de U12.** Se borra la cuenta sin confirmar `hola+u12-10092308@mamanche.com` (`u12_10092308`), sin abrir su enlace:
  - el enlace de U12 llevaba seis días y el remitente era el de antes de D3;
  - la confirmación con el correo propio ya quedó probada en el paso 9 y se repite en el recorrido de E21-rc2.
  - Queda otra cuenta de prueba sin confirmar, `prueba_d3` (2026-10-07). No estaba en el encargo y no se toca.

### Enlaces de los correos de Auth (2026-10-15, RC2-P0-01)

Lo pidió el usuario: los enlaces de confirmación, recuperación y cambio de correo tienen que funcionar siempre, también abiertos en otro dispositivo.

- **Las plantillas enlazan a la app con `token_hash`,** no al endpoint `/verify` de Auth: `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=…`. La app lo canjea con `verifyOtp`.
  - El enlace no depende del navegador en que se pidió.
  - Funciona aunque `@supabase/ssr` imponga PKCE.
- **Un solo destino:** `/auth/reset`, sin query. El tipo del enlace dice si es confirmación, recuperación o cambio de correo.
  - En Redirect URLs basta `<origen>/auth/reset` por entorno.
  - Producción: `https://biblioteca.discotica.com/auth/reset`.
- **Las plantillas viven en `supabase/templates/`** y se pegan a mano en el dashboard de cada proyecto, nunca con `config push`.

### Flags del lanzamiento (2026-10-15)

Normaliza el inventario que E21 dejó con tres nombres que no existen. Lo decidió Claude en E21-rc2, como pide el paso 11. El detalle está en el [expediente de E21-rc2](./e21-rc2-2026-10-15.md#5-inventario-de-flags-normalizado).

- **Hay cuatro flags, todos de presentación:** `VITE_CATALOG_SOURCE` (`legacy` | `canonical`), `VITE_EDITORIAL_ENABLED`, `VITE_ADMIN_CATALOG_ENABLED` y `VITE_BETA_INVITATION_ENABLED`.
  - El valor seguro es `legacy` y `false`, el que aplica `deploy.yml` si la variable no existe.
  - No sustituyen a RLS.
- **Se retiran del inventario** `VITE_ISSUE_REPORTING_ENABLED`, `VITE_BETA_FEEDBACK_EMAIL` y `VITE_PUBLIC_LAUNCH_LABEL`. Nunca existieron en el código:
  - los reportes (E18) son un canal permanente; su retirada es de código y de RLS;
  - el correo de la beta está fijo (`hola@discotica.com`);
  - no hay etiqueta de lanzamiento.

  La bienvenida (E20) tampoco tiene flag.
- **`VITE_APP_VERSION` no es un flag.** `deploy.yml` la fija con el commit desde `54e9a06`, para que los reportes digan qué build los generó.
- **Día del corte:**
  - `canonical`, editorial `true` y consola admin `true`;
  - la beta la decide el usuario. Recomendación: `true` solo si ese día salen invitaciones con `?beta=1`.
- **Rollback de la aplicación:** los cuatro a su valor seguro y Run workflow. Ensayado en E21-rc2 con Apache y el `.htaccess` real, contra staging.

### U19 — Flujo del Estudio y diccionarios (2026-10-15)

Las decidió el usuario en cinco rondas de preguntas, a partir de su lista de correcciones del Estudio. El detalle está en [`u19-estudio-flujo-2026-10-15.md`](./u19-estudio-flujo-2026-10-15.md). **Todo va antes de E21-rc3** (paso 11b del plan de lanzamiento).

- **Diccionarios:**
  - **Géneros y países: listas cerradas en todos los formularios**, Estudio incluido. Solo admin los crea o cambia, desde una pantalla de diccionarios. El servidor rechaza valores de fuera de la lista.
  - **Países:** la lista seleccionable tiene los 33 estados independientes de Latinoamérica y el Caribe más Puerto Rico, sin «Diáspora». Los demás países que traiga la hoja se aceptan como legado: no se ofrecen al elegir ni aparecen en la búsqueda.
  - **Artistas y sellos: libres.** Si no existen, se crean al guardar o aceptar, sin alta auditada aparte, con un aviso de nombres parecidos. La limpieza se hace al revisar el lanzamiento y en la pantalla de diccionarios.
- **Sello obligatorio.** «Independiente» es un sello más y aparece fijo arriba en el buscador.
- **Pantalla de diccionarios (solo admin):**
  - crear, renombrar, fusionar y marcar seleccionable o legado;
  - al fusionar, la grafía vieja queda como alias, que reconocen la búsqueda y la importación, y la URL vieja redirige;
  - los huérfanos (sin lanzamientos) se listan para borrarlos. Nada se borra solo.
- **Un solo flujo para crear:**
  - «Nuevo lanzamiento» del Estudio lleva a Sugerir;
  - **admin** termina con «Crear borrador»: un borrador del catálogo con su historial, sin pasar por la cola. La pantalla final ofrece «Añadir otro», «Abrir el borrador» e «Ir al Estudio»;
  - comunidad y colaboración envían a la cola como hasta ahora.
- **Radar en Sugerir:** opcional, para todos.
- **La cola se corrige en el editor del Estudio.**
  - Admin edita cualquier propuesta o borrador y acepta como borrador o publicando.
  - El colaborador corrige en el mismo editor, sin acceso al Catálogo, y marca la propuesta lista.
  - El autor edita su propuesta enviada hasta que alguien del equipo guarde la primera corrección, la marque lista o la acepte.
- **Duplicados:** Sugerir avisa si el enlace ya está en el catálogo o en la cola.
- **Botón «Estudio» en el header** para admin y colaborador. Sustituye la parte de I3 que decía «desde el perfil, no desde el header». Aparece solo si el rol ve alguna sección, lleva a `/estudio` y no se muestra dentro del Estudio. En móvil ocupa el lugar de «Entrar», que con sesión no está. El acceso desde el perfil propio se conserva.
- **No entran:** la comparación entre versiones, el límite de propuestas pendientes y el bloqueo visible al abrir una propuesta.

**Añadidas al cerrar G1 (2026-10-15):**
- **LATAM es seleccionable:** la lista tiene 35 valores, los 33 estados, Puerto Rico y LATAM. Lo decidió el usuario.
- **Duplicados de la hoja:** EE.UU, EEUU y USA quedan como alias de Estados Unidos, y UK de Reino Unido (decisión del usuario). La hoja no necesita corregirlos.
- **WORLD, Entrañas y TSA se rechazan en la importación** (decisión del usuario). En staging quedan en estado `retired`: se conservan en sus lanzamientos hasta que la hoja los corrija, nadie los acepta de nuevo y, cuando quedan huérfanos, la poda los borra (Claude).
- **Legado con tilde:** Canadá, Líbano y Pakistán (decisión del usuario).
- **Reseña y portada de una propuesta solo las cambia admin.** El colaborador corrige el resto, radar incluido (Claude, según la tabla del expediente).
- **Aceptar y publicar exige lo mismo que cualquier publicado,** portada incluida. Antes E09 publicaba sin portada (Claude).
- **El editor conserva los valores de legado que ya tiene un lanzamiento, pero no deja añadir otros.** La reversión del historial restaura tal cual (Claude).
- **Pendiente sin grupo:** ocultar los países de legado en los filtros públicos. El servidor ya expone `status`; la propuesta es que lo haga G4.

**Añadidas al cerrar G2 (2026-10-15, aceptadas por el usuario):**
- **Duplicado:** el aviso queda en el paso 1, con el enlace a lo existente, y el botón pasa a «Continuar igualmente». No bloquea.
- **Nombres parecidos:** solo avisan los nombres que se escriben («Añadir «…»»), no los detectados en la fuente: un compilado traería decenas de avisos. «Usar «X»» sustituye el nombre por el existente.
  - Cuentan como parecidos los que se escriben casi igual, los que contienen al otro y los que comparten una palabra de cuatro letras o más.
  - Se buscan por hasta tres palabras del nombre. Si la regla de la palabra compartida resulta ruidosa, se puede endurecer.
- **La observación de admin en Sugerir** va al historial (`p_reason`), no a la propuesta, porque el servidor la usaría como reseña.
- **«Nuevo lanzamiento»** sigue oculto en el Estudio en móvil; allí está «Sugerir» en el header.

**Añadidas al cerrar G3 (2026-10-16, aceptadas por el usuario):**
- **La bandeja conserva el detalle** (lista, resumen y lo editado frente a la fuente) con «Abrir en el editor». Todas las acciones están en el editor (decisión del usuario).
- **Después de aceptar, admin vuelve a la cola** con el aviso, el enlace «Abrir el lanzamiento en el Catálogo» y la siguiente propuesta abierta (decisión del usuario).
- **Nombres nuevos en el editor del catálogo:** se crean al guardar, en la misma transacción, con un cambio en `admin_update_catalog_release` (G3). El editor de propuestas pregunta al servidor qué nombres existen (`resolve_catalog_names`) para marcar como «nuevo» solo lo que se creará (Claude).
- **Las correcciones se guardan sin nota:** el autor puede leer el historial de su propuesta. La nota interna del colaborador va solo a «Marcar lista» (se guarda antes la corrección y se marca lista sin payload). La «Nota para quien propone» de admin acompaña a aceptar, pedir cambios y rechazar, y es la que ve el autor (Claude).
- **La reseña empieza con la nota de quien propone,** porque aceptar la usa si no hay reseña. Si admin la vacía, el servidor publica igualmente esa nota (comportamiento de G1); el editor lo avisa en el campo (Claude).
- **Aceptar con cambios sin guardar** guarda primero la corrección y acepta con la versión que devolvió (Claude).
- **Géneros y países fuera de la lista** en una propuesta vieja no se cargan en el editor; un aviso los nombra (Claude).
- **Radar vacío:** «Sin radar · Añadir radar»; no hay botón para quitarlo (Claude).
- **Pendiente sin grupo:** en móvil, la barra de admin con cinco acciones ocupa unas cuatro filas fijas abajo. Funciona; se puede compactar si molesta.

**Sustituye:**
- en «Sugerir (U13)»: el «Continuar en la consola» de admin y los cuatro «Añadir «…»»;
- en «Editor del Estudio (U16)»: el alta de géneros desde el Combobox;
- en «Bandeja del Estudio (U17)»: «las acciones no cambian» del colaborador.

### Manual

- Sigue como página, con mejor tipografía.
