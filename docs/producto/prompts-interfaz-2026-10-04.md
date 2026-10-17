# Prompts listos para ejecutar el plan de interfaz — 2026-10-04

Este archivo contiene un chat autocontenido por etapa del [plan de interfaz](./plan-interfaz-2026-10-04.md). No hay campos entre corchetes ni texto que deba editarse antes de pegarlo.

## Uso

1. Ejecuta las etapas en el orden de este archivo, que respeta las dependencias. Va una por chat, y nunca dos en paralelo sobre el mismo árbol de trabajo.
2. Antes de pegar un prompt, elige en Claude Code el modelo de su encabezado (`/model`) y el nivel de esfuerzo indicado.
3. El prompt hace que el agente lea el plan, el registro de decisiones y el censo. No pegues esos documentos: ya están en el workspace.
4. Un chat solo cierra su etapa con la evidencia y el paquete de relevo que exige el plan. Si aparece un bloqueo, lo documenta y no salta a la etapa siguiente.
5. Ninguna etapa hace `commit`, `push`, despliegue ni toca producción. D1 y D2 solo aplican migraciones en staging cuando el backup de E21 esté resuelto. D3 necesita un gate humano (DNS y proveedor de correo).
6. U0 ya está cerrada y no tiene prompt. Las tres interpretaciones de la sección 5 del plan se aplican por defecto. Si quieres cambiar alguna, regístralo en `docs/modernizacion/decisiones.md` antes de la etapa que la usa.

Asignación de modelos:

- **Claude Sonnet 5.5** (`claude-sonnet-5-5`): primitivas y vistas delimitadas.
- **Claude Opus 5.5** (`claude-opus-5-5`): refactors grandes, datos, scroll e iframes, el Estudio y QA integral.
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`): no se asigna a ninguna etapa por defecto.

Para bajar de modelo en feedback solo visual dentro de una etapa ya hecha, sigue la sección 7 del plan.

---

## U1 — Línea base y regresión visual

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U1 — Línea base y regresión visual — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U0 está cerrada.

Primero lee completos:
- las secciones 1 a 7 y la etapa U1 del plan;
- la sección "Interfaz — ronda 3" de `docs/modernizacion/decisiones.md`;
- `docs/producto/censo-interfaz-2026-10-03.md` completo;
- el anexo `docs/producto/anexos/censo-interfaz-captura-2026-10-03.mjs`.
Ejecuta `git status --short` y revisa los diffs de lo que vayas a tocar; preserva trabajo ajeno.

El objetivo es que el censo de 127 capturas sea una suite reproducible dentro del repositorio, antes de que ninguna otra etapa cambie la interfaz:
- Adapta el script del anexo sin rutas absolutas.
- Usa datos de muestra versionados o regenerables desde staging en solo lectura, con la clave publicable de `.env.local` y nunca secretos.
- Usa un servidor propio en un puerto libre.
- Mantén las sesiones simuladas por rol y los mocks de PostgREST.
- Haz las capturas deterministas: animaciones apagadas, reloj fijo, respaldo local para portadas y embeds externos, y esperas por estado en lugar de tiempos fijos cuando sea posible.
- Añade un comando de captura y uno de comparación con umbral e informe de diferencias.
- Guarda la línea base fuera del bundle público y documenta cómo se regenera.

Verifica que dos corridas seguidas sin cambios den cero diferencias, y que un cambio deliberado de un token aparezca en el informe (y revierte ese cambio). Ejecuta `npm test`, `npm run build` y `npm run test:browser` para separar fallos previos de los tuyos.

No cambies componentes, estilos ni rutas. No escribas nada remoto, no toques producción y no hagas commit ni push. Si alguna captura no se estabiliza tras dos intentos, documenta la causa y márcala como inestable con su motivo; no la borres para pasar.

Entrega a U2, R1 y R2:
- comandos exactos;
- ubicación de la línea base;
- lista de capturas estables e inestables;
- tiempos de corrida;
- archivos creados o modificados;
- instrucciones para usar la suite antes y después de cada etapa.
```

## R1 — Ficha y reproductor: errores

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa R1 — Ficha y reproductor: errores — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U1 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa R1 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Ficha en modal", "Ficha como página" y "Tarjeta de lanzamiento";
- `docs/modernizacion/e16-ficha-compartida-2026-09-20.md`;
- el relevo de U1.
Ejecuta `git status --short`, revisa los diffs de `ReleaseDetail.svelte`, `ReleasePlayer.svelte`, `LanzamientoModal.svelte` y `LanzamientoCard.svelte`, y corre la suite visual de U1 antes de editar.

Corrige solo estos cuatro errores:
1. El reproductor se aplasta en desktop porque los hijos de la columna de información, flex y de altura fija, pueden encogerse. Los marcos deben conservar sus alturas por proveedor: Bandcamp 380, SoundCloud 300 y Spotify 352.
2. Al elegir una pista dentro del reproductor, el scroll de la ficha o del documento salta. Reprodúcelo en Bandcamp, SoundCloud y Spotify, identifica la causa (foco del iframe, scroll anchoring, cambio de alto) y contenlo desde el contenedor. Documenta lo que dependa del proveedor.
3. El menú de "Añadir a crate" se corta contra el borde del modal. Debe renderizarse fuera del contenedor que lo recorta, con los contratos de `src/lib/ui/overlay.ts`.
4. El menú de "Varios artistas" de la tarjeta queda tapado por la grilla.

Añade en `tests/browser` una prueba por punto, a 1440 y 390. Elegir la tercera pista debe dejar el scroll donde estaba, con tolerancia de 4px. Mantén en verde las pruebas de E16 y E17. Corre la suite visual al final: las diferencias deben limitarse a la ficha y a los menús.

No rediseñes la ficha, no cambies acciones, textos ni tokens (eso es U9), no toques datos ni producción y no hagas commit ni push. Si el salto de scroll no se puede contener desde el contenedor tras dos intentos, sube a esfuerzo xhigh y documenta los límites por proveedor; no lo ocultes desactivando el reproductor.

Entrega a U4 y U9:
- causa raíz de cada error;
- archivos modificados;
- pruebas con resultado;
- capturas que cambiaron;
- límites conocidos por proveedor.
```

## R2 — Errores visibles menores

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `medium`

```text
Ejecuta exclusivamente la etapa R2 — Errores visibles menores — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Sonnet 5.5 con esfuerzo medium. U1 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa R2 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Tarjeta de lanzamiento", "Hoja de filtros · móvil", "Registro", "Carga, error, vacío y 404", "Variantes de contenido de la ficha" y "Radar".
Ejecuta `git status --short`, revisa los diffs de los archivos que vayas a tocar y corre la suite visual de U1 antes de editar.

Corrige exactamente los ocho puntos de R2:
1. Una sola regla de créditos en `src/lib/domain/releases.ts`:
   - "Varios artistas" solo cuando el tipo es Compilado;
   - si no, todos los principales y, con colaboradores, "y N más".
   Las reglas duplicadas que existen hoy deben usar esta. Añade pruebas de unidad en `tests/release-domain.test.mjs` para estos casos: compilado, un principal, varios principales, principal con colaboradores y nombres largos.
2. El espacio después de la coma en los créditos. Svelte 5 recorta el espacio final dentro del span, así que la separación no puede depender de él.
3. En la hoja de filtros móvil, las opciones largas no desbordan la columna a 390.
4. El enlace azul en el éxito del registro usa el color del sistema.
5. Una portada rota o ausente muestra el logo de Discótica atenuado.
6. La página de error y el 404 están en español.
7. Los estados de los reportes están traducidos.
8. "Randomizar" pasa a "Aleatorizar".

Corre `npm test`, `npm run build`, `npm run test:browser` y la suite visual. Las diferencias deben limitarse a estos puntos.

No rediseñes componentes, no cambies tokens ni la composición de las vistas, no toques datos ni producción y no hagas commit ni push. Si la regla de créditos exige cambiar el contrato de datos, detente y documenta el caso para Opus 5.5 con esfuerzo high.

Entrega a U4 y U8:
- la API de la regla de créditos y sus casos;
- archivos modificados;
- pruebas con resultado;
- capturas que cambiaron.
```

## U2 — Saneamiento sin cambio visual

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U2 — Saneamiento sin cambio visual — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U1 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa U2 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- la sección "El sistema hoy" de `docs/producto/censo-interfaz-2026-10-03.md`;
- los documentos de E12, E13, E15 y E17 en `docs/modernizacion/`, que describen el estado de URL, la hoja móvil y el historial del inicio.
Ejecuta `git status --short`, revisa los diffs y corre la suite visual y `npm run test:browser` antes de editar.

Quita la deuda que impide cambiar un valor en un solo lugar, sin cambiar lo que se ve:
- Borra `src/app.css` tras confirmar que nadie lo importa.
- Borra la variante `detail` de `LanzamientoCard` y su segundo reproductor, tras confirmar que ninguna ruta la usa.
- Define `--radius-md` o reemplaza sus usos.
- Pasa `#8cff18` de la consola al token de acento.
- Quita los códigos internos de los textos visibles ("E06", "E09"…).
- Parte `src/routes/+page.svelte` en módulos (estado y URL, hoja móvil, barra de resultados, estilos) sin cambiar el marcado resultante ni el comportamiento.

Corre `npm test`, `npm run build`, `npm run test:browser` y la suite visual. Solo puede haber diferencias en textos y en las esquinas que usaban `--radius-md`; lista cada una.

No cambies diseño, tokens de escala, rutas ni datos. No toques producción y no hagas commit ni push. Si al partir el inicio cambia el comportamiento de URL o historial y las pruebas no lo explican, detente, revierte esa parte y sube a esfuerzo xhigh.

Entrega a U3 y U4:
- el mapa de módulos nuevos del inicio;
- archivos borrados y su justificación;
- pruebas con resultado;
- capturas que cambiaron.
```

## U3 — Colecciones: lenguaje y URLs

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U3 — Colecciones: lenguaje y URLs — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Sonnet 5.5 con esfuerzo high. U2 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa U3 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial "Crates → colecciones";
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Mis crates y crear crate", "Crate", "Perfil" y "Ficha en modal";
- el relevo de U2.
Ejecuta `git status --short`, revisa los diffs y corre la suite visual antes de editar.

Haz que "crate" desaparezca de la interfaz sin romper enlaces compartidos:
- Reemplaza "crate/crates" por "colección/colecciones" en todo texto visible y nombre accesible: títulos, botones, menús, vacíos, avisos, `aria-label`, manual, privacidad, bienvenida e invitación beta.
- Crea `/mis-colecciones` y `/coleccion/[slug]`.
- Haz que `/mis-crates` y `/crate/[slug]` redirijan conservando query y hash, con una redirección de cliente en la app y un 301 en `static/.htaccess`.
- Actualiza enlaces internos y destinos de autenticación.
- No renombres tablas, columnas, stores ni tipos de datos.

Prueba que un enlace viejo de una colección pública abre la nueva URL con el mismo contenido, que `npm run build` genera las rutas nuevas y que una búsqueda en `src` no deja "crate" en textos visibles (se permiten identificadores de código y SQL). Corre la suite visual: solo pueden cambiar textos.

No cambies diseño, datos ni producción y no hagas commit ni push. Si las redirecciones exigen cambiar el despliegue o rompen enlaces, detente y documenta el caso para Opus 5.5 con esfuerzo high.

Entrega a U14 y U12:
- rutas nuevas y redirecciones;
- lista de textos cambiados por archivo;
- pruebas con resultado.
```

## D1 — Datos de perfil y colecciones

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa D1 — Datos de perfil y colecciones — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U0 está cerrada.

Antes de nada, comprueba en `docs/modernizacion/estado.md` que el bloqueo de backup de E21 esté resuelto. Si no lo está, prepara y prueba la migración solo en local y no la apliques en staging.

Primero lee completos:
- las secciones 2 a 7 y la etapa D1 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial "Perfil social" y "Orden manual";
- las migraciones existentes de `profiles`, `crates`, `crate_items` y `contributions` en `supabase/migrations/`;
- `src/lib/stores/cratesStore.ts`;
- `src/lib/stores/contributionsStore.ts`.
Ejecuta `git status --short` y revisa los diffs.

Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y de buenas prácticas de Postgres, verifica la documentación y el changelog vigentes, prueba primero en local o staging y revisa RLS y advisors antes de declarar el trabajo completo.

Implementa solo el contrato de datos:
1. Redes sociales opcionales en `profiles` (Bandcamp, SoundCloud, Instagram, X/Twitter y Facebook):
   - se guarda el usuario o handle, con validación de formato por red en la base y en el cliente;
   - la URL pública se construye en el dominio de cliente.
2. La preferencia de mostrar los aportes aceptados en el perfil público, desactivada por defecto. La lectura pública devuelve solo aportes aceptados de perfiles que lo permiten, sin borradores, rechazos ni notas del revisor.
3. El orden manual de colecciones:
   - posición por elemento en `crate_items`, con backfill desde `added_at`;
   - reordenamiento atómico solo para el dueño;
   - sin posiciones duplicadas bajo concurrencia.
4. Tipos y servicios de cliente, sin interfaz nueva.

Añade pruebas SQL de RLS y concurrencia en `tests/sql`. Revisa los advisors y documenta el rollback como una migración posterior.

No construyas interfaz, no toques producción, no renombres `crates` ni `crate_items` y no hagas commit ni push. Si el orden manual exige reescribir políticas que hoy protegen las colecciones públicas, o aparece drift en staging, detente, conserva la evidencia y sube a esfuerzo xhigh.

Entrega a U12 y U14:
- el contrato exacto (columnas, funciones, políticas);
- ejemplos de lectura y escritura desde el cliente;
- pruebas con resultado;
- advisors;
- rollback;
- `decisiones.md` y `estado.md` actualizados.
```

## D2 — Datos del Estudio: lote y vistas rápidas

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa D2 — Datos del Estudio: lote y vistas rápidas — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo xhigh. U0 está cerrada.

Antes de nada, comprueba en `docs/modernizacion/estado.md` que el bloqueo de backup de E21 esté resuelto. Si no lo está, prepara y prueba solo en local y no apliques en staging.

Primero lee completos:
- las secciones 2 a 7 y la etapa D2 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- `docs/modernizacion/e06-servicio-mutaciones-auditadas-2026-09-16.md`;
- `docs/modernizacion/e07-consola-administrativa-2026-09-16.md`;
- `docs/modernizacion/e18-reportes-problemas-2026-09-23.md`;
- las migraciones de mutaciones administrativas, del contrato de lectura y de reportes;
- `src/lib/services/adminCatalog.ts`.
Ejecuta `git status --short` y revisa los diffs.

Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase y de buenas prácticas de Postgres, verifica la documentación y el changelog vigentes, prueba primero en local o staging y revisa RLS y advisors antes de declarar el trabajo completo.

Implementa solo el contrato de datos:
1. Publicar o archivar en lote:
   - solo para admin;
   - aplica por cada lanzamiento la misma validación y auditoría que la operación individual de E06;
   - todo o nada;
   - límite de tamaño por lote;
   - informe por elemento.
2. Señales para las vistas rápidas en el contrato de lectura administrativa: borrador, incompleto, sin portada y con reportes abiertos. El criterio de "incompleto" debe quedar explícito y documentado.
3. Servicio y tipos de cliente en `adminCatalog.ts`.

Prueba que colaborador y comunidad no pueden ejecutar el lote, que un lote con un elemento inválido no cambia nada y que la auditoría registra cada lanzamiento. Revisa los advisors.

No construyas interfaz, no toques producción y no hagas commit ni push. Si el lote no cabe en el contrato auditado sin debilitarlo, detente y pide una decisión humana.

Entrega a U15:
- el contrato documentado en `docs/modernizacion/`, con ejemplos de respuesta;
- pruebas con resultado;
- advisors;
- rollback;
- `estado.md` actualizado.
```

## D3 — Correo propio y plantillas

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa D3 — Correo propio y plantillas — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U0 está cerrada.

Primero lee completos:
- las secciones 2 a 7 y la etapa D3 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial la parte de correos;
- en `docs/producto/censo-interfaz-2026-10-03.md`, la vista "Correos de confirmación y recuperación";
- `supabase/config.toml`.
Ejecuta `git status --short` y revisa los diffs.

Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase, verifica la documentación vigente de SMTP propio y plantillas de Auth, y prueba en staging antes de declarar el trabajo completo.

Hay un gate humano obligatorio:
- Antes de crear cuentas o registros DNS, propone un proveedor SMTP con un plan gratuito suficiente y espera aprobación explícita en este chat.
- Pide que una persona con acceso cree los registros DNS de discotica.com y cargue las credenciales en Supabase.
- Nunca escribas secretos en el repositorio ni en la conversación.

Después:
- Configura el remitente hola@discotica.com y verifica SPF, DKIM y DMARC.
- Versiona en `supabase/templates/`, y referencia en `config.toml`, las plantillas de confirmación de registro, recuperación de contraseña y cambio de correo. Deben ser HTML sencillo con logo y botón verde, en español, con versión en texto plano.

Prueba un envío real a una cuenta de prueba en staging y revisa el resultado en Gmail web, Gmail móvil y Apple Mail. Los correos deben llegar a la bandeja de entrada y no al spam, y sus enlaces deben apuntar al entorno correcto.

No cambies el destino de confirmación (lo hace U12), no toques producción y no hagas commit ni push. Si el proveedor o el DNS no verifican, detente y documenta. No cambies el remitente sin una decisión humana.

Entrega a U12 y U18:
- configuración aplicada, sin secretos;
- registros DNS;
- plantillas;
- capturas de los correos recibidos;
- límites de envío del proveedor.
```

## U4 — Tokens v2

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U4 — Tokens v2 — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U2, R1 y R2 deben estar aceptadas.

Primero lee completos:
- las secciones 2 a 7 y la etapa U4 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- la sección "El sistema hoy" de `docs/producto/censo-interfaz-2026-10-03.md`;
- `src/lib/styles/styles.css`;
- los relevos de U2, R1 y R2.
Revisa también en la sección 3 del plan si E22 ya se ejecutó o si el equipo registró otra decisión. Ejecuta `git status --short`, revisa los diffs y corre la suite visual antes de editar.

Cierra las escalas sobre la paleta actual sin cambiar la dirección visual:
- Tipografía de 8 a 9 pasos. El paso más pequeño debe hacer los metadatos ~15% más legibles sin cambiar el tamaño de la tarjeta.
- Espaciado sobre base 4/8. Radios: 4 valores más pill.
- Superficies, bordes y texto con alfa como unos 16 tokens.
- Alturas de control 32, 40, 44 y 52, con padding horizontal mayor que el vertical. La referencia es el botón Comprar.
- Breakpoints 480, 680, 768, 1024 y 1280.
- Capas y motion.
- Estilo de navegación en mayúsculas sostenidas.
- Barras de scroll propias, discretas y en la paleta, en todo el sitio y en los scroll internos.
- Tokens de densidad para el Estudio.
- Migra los literales existentes a los tokens.
- Añade un lint que rechace colores, tamaños, radios y breakpoints literales nuevos en componentes, con una lista temporal de excepciones documentada.

Corre `npm test`, `npm run build`, `npm run test:browser` y la suite visual. Clasifica cada diferencia como intencional o regresión, y corrige las regresiones. Verifica que el texto pequeño tenga contraste de al menos 4.5:1.

No rediseñes componentes ni cambies la composición de las vistas, no toques datos ni producción y no hagas commit ni push. Si aparecen diferencias que no puedes clasificar, sube a esfuerzo xhigh antes de seguir.

Entrega a U5:
- tabla de tokens con sus valores;
- reglas de lint y lista de excepciones;
- capturas que cambiaron, con su motivo;
- pruebas con resultado.
```

## U5 — Primitivas base

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U5 — Primitivas base — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Sonnet 5.5 con esfuerzo high. U4 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa U5 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- la tabla de botones y las vistas "Header, menú y footer", "Inicio · listado", "Búsqueda y filtros · desktop" y "Carga, error, vacío y 404" de `docs/producto/censo-interfaz-2026-10-03.md`;
- `src/lib/ui/overlay.ts`;
- el relevo de U4.
Ejecuta `git status --short` y revisa los diffs.

Crea las primitivas base, cada una con todos sus estados y solo con tokens de U4:
- Iconos SVG: buscar, salir, compartir, reportar, menú con tres barras regulares, cerrar, flechas, grilla, lista, "…" y las cinco redes sociales.
- Button e IconButton:
  - variantes primario, secundario, ghost, destructivo y enlace;
  - tamaños sm, md y lg;
  - el icono solo lleva nombre accesible y tooltip.
- Field, Textarea y PasswordField. PasswordField muestra en vivo las reglas y la fortaleza.
- Chip para filtro activo compacto, género y estado.
- Pagination:
  - el texto alineado con los botones;
  - una variante compacta que comparte línea con "Ordenar por" a 390.
- ViewToggle grilla/lista, recordado por contexto con almacenamiento local protegido por try/catch.
- Skeleton de tarjeta y de fila, más el indicador actual con las barras en horizontal.
- EmptyState y ErrorState utilitarios.
- Breadcrumbs.
- Una página interna `/lab` que muestre todo y que no aparezca en la navegación.

Retira los emoji usados como icono. Si eso cambia una vista, el cambio debe ser solo de icono.

Verifica `/lab` a 390 y 1440, con teclado, foco visible y objetivos táctiles de 44px. El lint de tokens debe pasar. Corre `npm run build` y la suite visual.

No migres todavía las vistas a las primitivas (eso empieza en U7), salvo el cambio de emoji por SVG. No toques datos ni producción y no hagas commit ni push. Si una primitiva necesita gestionar foco entre capas, déjala para U6 y anótala.

Entrega a U6:
- API de cada primitiva (props, slots, eventos);
- la ruta de `/lab`;
- pruebas con resultado.
```

## U6 — Primitivas compuestas

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U6 — Primitivas compuestas — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U5 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa U6 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Tarjeta de lanzamiento", "Ficha en modal", "Hoja de filtros · móvil", "Sugerir un lanzamiento", "Consola de catálogo · editor" y "Crate";
- `src/lib/ui/overlay.ts`;
- la regla de créditos de R2;
- el contrato de redes de D1, si ya existe;
- el relevo de U5.
Ejecuta `git status --short` y revisa los diffs.

Crea las primitivas compuestas sobre `overlay.ts` y los tokens de U4, y añádelas a `/lab`:
- Combobox con chips:
  - búsqueda;
  - creación de valores nuevos cuando el contexto lo permita;
  - chips que se quitan con teclado.
- Menu "…" en portal, que nunca se corte contra un contenedor.
- Dialog con contenido de scroll interno.
- Sheet con altura según contenido y pie fijo con acción primaria.
- Sortable:
  - arrastrar con ratón y táctil;
  - alternativa de teclado (mover arriba y abajo);
  - anuncio para lectores de pantalla.
- Cover:
  - siempre cuadrada, con recorte;
  - logo atenuado como respaldo;
  - fondo ambiental desenfocado opcional.
- CreditLine:
  - aplica la regla de R2;
  - trunca los nombres con elipsis sin ocultar "y N más";
  - variante con todos los artistas por rol para la ficha.
- SocialLinks con iconos de las cinco redes. Si D1 no está aceptada, usa datos de ejemplo en `/lab`.

Verifica el teclado completo en combobox, menú y ordenable, VoiceOver básico en combobox y ordenable, y táctil a 390. El lint debe pasar. Corre `npm run build` y la suite visual.

No migres vistas, no toques datos ni producción y no hagas commit ni push. Si arrastrar en táctil choca con el scroll o con los gestos de la hoja móvil, sube a esfuerzo xhigh antes de cambiar de enfoque.

Entrega a U7, U8 y U9:
- API de cada primitiva;
- decisiones de accesibilidad;
- pruebas con resultado.
```

## U7 — Shell y layouts

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U7 — Shell y layouts — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Sonnet 5.5 con esfuerzo high. U6 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa U7 del plan, incluidas las interpretaciones I2 e I3 y los valores por defecto de la sección 5;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Header, menú y footer", "Carga, error, vacío y 404", "Manual y privacidad" y "Recuperar y nueva contraseña";
- `docs/modernizacion/e14-header-global-2026-09-19.md`;
- `docs/modernizacion/e15-busqueda-movil-2026-09-19.md`;
- el relevo de U6.
Ejecuta `git status --short`, revisa los diffs y corre la suite visual antes de editar.

Implementa el shell y los layouts con las primitivas de U5 y U6:
- Header:
  - navegación principal en mayúsculas sostenidas, con botones del sistema más anchos que altos;
  - en móvil sin sesión, "Entrar" lleno y "Sugerir" con borde, del mismo tamaño;
  - icono de menú nuevo y Salir con icono.
- Con sesión en desktop: avatar con menú de cuenta (Perfil, Mis colecciones, Mis aportes, Salir). Lo mismo dentro del menú móvil.
- El acceso al Estudio sale del perfil propio de admin y colaborador, no del header.
- Contenedores estrecho, regular, ancho y completo.
- Layouts:
  - cuenta, con variante de dos columnas;
  - lectura, para manual y privacidad, con mejor tipografía;
  - herramienta, con barra lateral y ancho completo, vacío hasta U15.
- Migas como patrón de retorno.
- `+error.svelte` con ErrorState.
- Las rutas existentes pasan a declarar su layout y contenedor.

Prueba anónimo, comunidad, colaborador y admin a 390 y 1440, el teclado en el menú de cuenta y que E14 y E15 sigan en verde. Corre la suite visual y clasifica las diferencias.

No rediseñes tarjeta, ficha, inicio ni formularios (son etapas posteriores), no toques datos ni producción y no hagas commit ni push. Si el header choca con el comportamiento de scroll de E14 o E15, detente y documenta el caso para Opus 5.5 con esfuerzo high.

Entrega a U8 y siguientes:
- API de layouts y contenedores;
- qué ruta usa qué layout;
- pruebas con resultado;
- capturas que cambiaron.
```

## U8 — Tarjeta y modo lista

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U8 — Tarjeta y modo lista — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Sonnet 5.5 con esfuerzo high. U6 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa U8 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial los créditos y el radar;
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Tarjeta de lanzamiento", "Radar" e "Inicio · listado";
- `docs/modernizacion/e05-creditos-publicos-2026-09-16.md`;
- los relevos de R2 y U6.
Ejecuta `git status --short`, revisa los diffs de `LanzamientoCard.svelte` y corre la suite visual antes de editar.

Rehaz la tarjeta y crea la fila del modo lista sobre las mismas piezas:
- Tarjeta:
  - Cover y CreditLine;
  - año · país · sello y géneros con el paso tipográfico nuevo;
  - compartir como IconButton discreto;
  - altura estable aunque cambie la longitud de los textos;
  - la grilla nunca pasa de 3 columnas.
- Radar: en desktop, al pasar el cursor. En táctil, el primer toque sobre la portada muestra el radar y el segundo abre la ficha, o el patrón equivalente que se pruebe mejor. Documenta el comportamiento elegido.
- Fila densa para el modo lista, con las mismas piezas.

Prueba los créditos con un compilado, varios principales de nombres largos y un principal con colaboradores, el comportamiento táctil a 390 y la suite visual.

No conectes todavía el selector grilla/lista en el inicio (es U10), no toques la ficha, datos ni producción y no hagas commit ni push. Si tocar la portada interfiere con abrir la ficha o con el scroll, detente y documenta el caso para Opus 5.5 con esfuerzo high.

Entrega a U9 y U10:
- API de tarjeta y fila;
- comportamiento táctil del radar;
- pruebas con resultado;
- capturas que cambiaron.
```

## U9 — Ficha: modal, página y móvil

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa U9 — Ficha: modal, página y móvil — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo xhigh. U8 y R1 deben estar aceptadas.

Primero lee completos:
- las secciones 2 a 7 y la etapa U9 del plan, incluida la interpretación I1;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial "Objeto lanzamiento";
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Ficha en modal", "Variantes de contenido de la ficha" y "Ficha como página";
- `docs/modernizacion/e16-ficha-compartida-2026-09-20.md`;
- `docs/modernizacion/e17-recomendaciones-historial-modal-2026-09-20.md`;
- los relevos de R1, U6 y U8.
Ejecuta `git status --short`, revisa los diffs de `ReleaseDetail.svelte`, `LanzamientoModal.svelte`, `ReleasePlayer.svelte` y `src/routes/lanzamiento/[slug]/+page.svelte`, y corre la suite visual antes de editar.

Rehaz la ficha con un solo componente para modal y página:
- Desde 680px:
  - portada cuadrada fija a la izquierda, a la altura útil;
  - un diálogo que se ajusta para que no queden barras arriba ni abajo;
  - información con scroll interno a la derecha, donde todo cabe cómodo.
- Acciones en una sola línea: Comprar y Añadir a colección con texto e icono; Compartir y Reportar como IconButton.
- Reproductor completo con lista de pistas, sobre el arreglo de R1.
- Créditos completos por rol.
- En móvil: portada a ancho completo y barra de acciones fija abajo, respetando el safe area.
- En la página `/lanzamiento/[slug]`:
  - la misma ficha, con la distribución optimizada;
  - el fondo desenfocado del modal en lugar del gris;
  - "Explorar el catálogo" rediseñado con el sistema.
- En tablet vertical (834), que la portada no quede diminuta, sin cambiar el corte de 680.

Prueba la matriz 390, 680, 834, 1112 y 1440, en modal y en página, con estos casos: con y sin portada, título muy largo, reseña larga, y Bandcamp, SoundCloud y Spotify. Mantén E16 y E17 en verde y corre la suite visual.

No toques datos, recomendaciones ni historial más allá de lo necesario para el layout. No toques producción y no hagas commit ni push. Si la geometría no cumple en algún ancho, detente y documenta con capturas; no lo compenses con excepciones locales.

Entrega a U13 y U18:
- geometría por breakpoint;
- API de acciones (para el reporte de U13);
- pruebas con resultado;
- capturas.
```

## U10 — Inicio y búsqueda

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U10 — Inicio y búsqueda — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U7 y U8 deben estar aceptadas.

Primero lee completos:
- las secciones 2 a 7 y la etapa U10 del plan, incluido el valor por defecto de la hoja móvil en la sección 5;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial "Descubrimiento";
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Inicio · listado", "Búsqueda y filtros · desktop", "Radar", "Hoja de filtros · móvil" y "Carga, error, vacío y 404";
- los documentos de E12, E13 y E15 en `docs/modernizacion/`;
- el mapa de módulos de U2;
- el relevo de U8.
Ejecuta `git status --short`, revisa los diffs y corre la suite visual antes de editar.

Reordena el inicio y la búsqueda con las primitivas:
- En móvil, antes de la primera portada:
  1. buscar;
  2. filtros activos en una banda horizontal desplazable, con chips compactos;
  3. paginación y "Ordenar por" en la misma línea.
- En desktop:
  - el panel de filtros y radar se mantiene, más compacto;
  - el campo de texto es más alto y ~15% más visible;
  - "Reiniciar filtros" es un botón secundario del panel.
- Radar: en móvil, la palabra RADAR aparece solo en el desplegable cerrado; "Aleatorizar"; cinco puntos por eje.
- Hoja móvil:
  - altura según contenido;
  - × en la cabecera;
  - botón fijo "Ver N lanzamientos";
  - sin "Cerrar" de texto.
- Selector grilla/lista recordado.
- Esqueleto con indicador horizontal durante la carga.
- EmptyState y ErrorState.
- La misma paginación en el inicio, el artista, el sello y las colecciones.

Mantén E12, E13 y E15 en verde. A 390×844, la primera portada debe asomar sin scroll con un filtro activo, y la paginación y el orden deben caber en una línea a 360. Corre la suite visual.

No cambies el motor de búsqueda ni el formato de la URL, no toques datos ni producción y no hagas commit ni push. Si el orden móvil choca con el comportamiento sticky de E15, sube a esfuerzo xhigh y documenta la alternativa antes de implementarla.

Entrega a U11 y U18:
- composición final por breakpoint;
- pruebas con resultado;
- capturas.
```

## U11 — Bienvenida, beta, artista y sello

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `medium`

```text
Ejecuta exclusivamente la etapa U11 — Bienvenida, beta, artista y sello — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Sonnet 5.5 con esfuerzo medium. U7 y U8 deben estar aceptadas.

Primero lee completos:
- las secciones 2 a 7 y la etapa U11 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Bienvenida e invitación beta" y "Artista y sello";
- `docs/modernizacion/e19-invitacion-beta-2026-09-23.md`;
- `docs/modernizacion/e20-bienvenida-provisional-2026-09-24.md`.
Ejecuta `git status --short`, revisa los diffs y corre la suite visual antes de editar.

Implementa:
- La bienvenida editorial como componente permanente del inicio, en bloque grande, con un espacio de ilustración de marca reemplazable por el equipo. Conserva las reglas de sesión de E20 salvo que `decisiones.md` diga otra cosa.
- La invitación beta como diálogo propio, distinto de la bienvenida, con las reglas de E19.
- En artista y sello:
  - cabecera solo con el nombre, alineado a la izquierda;
  - migas "Catálogo › Artista" y "Catálogo › Sello";
  - sin filtros internos;
  - la paginación del sistema.

Mantén E19 y E20 en verde. Verifica a 390 y 1440 y corre la suite visual.

No crees la ilustración final (es del equipo), no toques datos ni producción y no hagas commit ni push. Si separar beta y bienvenida rompe las reglas de E19 o E20, detente y documenta el caso para Opus 5.5 con esfuerzo high.

Entrega a U18:
- componentes nuevos;
- dónde va la ilustración;
- pruebas con resultado;
- capturas.
```

## U12 — Cuenta: entrar, registro y correo

**Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U12 — Cuenta: entrar, registro y correo — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Sonnet 5.5 con esfuerzo high. U7 y D1 deben estar aceptadas.

Primero lee completos:
- las secciones 2 a 7 y la etapa U12 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial "Identidad" y "Cuenta y comunidad";
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Entrar", "Registro", "Correos de confirmación y recuperación" y "Recuperar y nueva contraseña";
- los relevos de D1, U3 y, si existe, D3.
Ejecuta `git status --short`, revisa los diffs de `src/routes/auth/` y corre la suite visual antes de editar.

Esta etapa usa Supabase Auth: verifica la documentación vigente de `signInWithPassword` y `resend`, y prueba en staging.

Implementa con el layout de cuenta de U7:
- Entrar:
  - dos columnas en desktop: beneficios (colecciones, compartirlas, aportar lanzamientos) y formulario;
  - en móvil, primero el formulario;
  - un campo "Usuario o correo": con `@` entra por correo con Supabase Auth; si no, usa `login-with-username`;
  - errores genéricos en los dos casos.
- Registro:
  - un paso, con los campos agrupados;
  - PasswordField con reglas y fortaleza en vivo;
  - redes opcionales de D1, con la aclaración de que son voluntarias y ayudan a que otras personas te encuentren y te sigan.
- "Revisa tu correo" tras registrarse:
  - muestra el correo;
  - "Reenviar", con espera entre envíos;
  - "Abrir correo", con enlace al webmail solo para Gmail, Outlook e iCloud.
- Recuperar y nueva contraseña con el mismo layout.
- `emailRedirectTo` lleva a Mis colecciones con un aviso de cuenta confirmada.

Prueba en navegador:
- entrar con usuario y con correo;
- error genérico;
- contraseña débil y contraseña fuerte;
- reenviar.
Prueba en staging el recorrido de registro, correo, confirmación y Mis colecciones. Ninguna respuesta debe revelar si un usuario o correo existe. Corre la suite visual.

No cambies el diseño de los correos (es D3) ni el contrato de perfiles, no toques producción y no hagas commit ni push. Si entrar con correo interfiere con `login-with-username`, la sesión o los límites de intento, detente y documenta el caso para Opus 5.5 con esfuerzo high.

Entrega a U14 y U18:
- flujos implementados;
- pruebas con resultado;
- capturas;
- comprobaciones manuales pendientes.
```

## U13 — Sugerir y reportar

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U13 — Sugerir y reportar — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U7 y U9 deben estar aceptadas.

Primero lee completos:
- las secciones 2 a 7 y la etapa U13 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Sugerir un lanzamiento" y "Reportar un problema";
- `docs/modernizacion/e10-sugerencias-perfil-editorial-2026-09-18.md`;
- `docs/modernizacion/e18-reportes-problemas-2026-09-23.md`;
- los relevos de U6 y U9.
Ejecuta `git status --short`, revisa los diffs de `src/routes/sugerir/` y `src/routes/reportar/` y corre la suite visual antes de editar.

Implementa:
- Sugerir por pasos: fuente → revisar datos → nota → enviar.
  - Los borradores se conservan entre pasos y entre visitas, como hoy.
  - Se puede volver atrás sin perder datos.
  - La nota es siempre opcional, también al proponer un cambio a un lanzamiento existente.
  - Artistas, géneros y países con el Combobox de U6.
- Reportar:
  - el IconButton de la ficha abre el flujo de E18 con el lanzamiento ya identificado;
  - se mantiene el acceso desde el menú global.

Mantén E10 y E18 en verde. Prueba el flujo completo de sugerir a 390 y 1440, y una propuesta de cambio sin nota. Corre la suite visual.

No cambies el payload, los estados de contribución ni la obligatoriedad de la nota del revisor. No toques producción y no hagas commit ni push. Si los pasos exigen cambiar el contrato de E09, detente y documenta el caso para un chat de Opus 5.5 con esfuerzo xhigh sobre E09.

Entrega a U17 y U18:
- flujo por pasos;
- pruebas con resultado;
- capturas.
```

## U14 — Perfil, aportes y colecciones

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U14 — Perfil, aportes y colecciones — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U3, U7, U8 y D1 deben estar aceptadas.

Primero lee completos:
- las secciones 2 a 7 y la etapa U14 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Perfil", "Mis crates y crear crate" y "Crate";
- los relevos de D1, U3 y U8.
Ejecuta `git status --short`, revisa los diffs de `src/routes/perfil/`, `src/routes/mis-colecciones/` y `src/routes/coleccion/`, y corre la suite visual antes de editar.

Implementa:
- `/mis-aportes`:
  - filas compactas con estado, lanzamiento, fecha y una acción;
  - los botones de pendientes con tamaño normal;
  - los mismos estados y datos que hoy.
- Perfil propio:
  - edición de redes;
  - interruptor "Mostrar mis aportes aceptados";
  - acceso al Estudio para admin y colaborador.
- Perfil ajeno: colecciones públicas, redes con SocialLinks y aportes aceptados solo si su dueño lo permite.
- Mis colecciones:
  - mosaico de 4 portadas y nombre;
  - menú "…" con compartir, editar y eliminar.
- Colección:
  - compartir, editar y eliminar como botones explícitos arriba;
  - selector grilla/lista;
  - sin notas visibles;
  - reordenar con Sortable, solo para el dueño, usando el contrato de D1.

Prueba la vista de dueño frente a la de visitante, reordenar con ratón, táctil y teclado, y un perfil con aportes visibles y otro con aportes ocultos. Corre la suite visual.

No cambies el contrato de datos de D1, no toques producción y no hagas commit ni push. Si el reordenamiento o la visibilidad pública exponen datos que no deben verse, detente y vuelve a D1.

Entrega a U18:
- vistas implementadas;
- pruebas con resultado;
- capturas.
```

## U15 — Estudio: estructura y catálogo

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U15 — Estudio: estructura y catálogo — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U7 y D2 deben estar aceptadas.

Primero lee completos:
- las secciones 2 a 7 y la etapa U15 del plan, incluida la interpretación I3;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial "Herramienta interna";
- en `docs/producto/censo-interfaz-2026-10-03.md`, las vistas "Consola de catálogo · listado" y "Estación editorial";
- `docs/modernizacion/e07-consola-administrativa-2026-09-16.md`;
- `docs/modernizacion/e10-sugerencias-perfil-editorial-2026-09-18.md`;
- los relevos de D2 y U7.
Ejecuta `git status --short`, revisa los diffs de `src/routes/admin/` y `src/routes/editorial/` y corre la suite visual antes de editar.

Esta etapa consume contratos de Supabase con permisos por rol: verifica en staging los permisos efectivos de admin, colaborador y comunidad antes y después.

Implementa el Estudio en `/estudio` con el layout de herramienta de U7:
- Barra lateral con Catálogo, Propuestas y Reportes.
- Ancho completo y un lenguaje visual propio y más denso, sobre los mismos tokens.
- `/admin/catalogo` y `/editorial` redirigen a la sección equivalente, conservando la query.
- Los permisos por rol quedan iguales que hoy.
- Catálogo:
  - tabla con la densidad actual;
  - vistas rápidas Borradores, Incompletos, Sin portada y Con reportes, con las señales de D2;
  - selección múltiple con publicar o archivar en lote, confirmación e informe por elemento.
- Enlaces cruzados entre un lanzamiento, sus propuestas y sus reportes.
- Propuestas y Reportes pueden mostrar todavía la vista actual dentro del layout nuevo. Su rediseño es U17.

Mantén E07 en verde, adaptada a las rutas nuevas. Prueba que la comunidad no tenga acceso, que el colaborador tenga acceso parcial, y un lote con éxito y otro con error. Corre la suite visual.

No rediseñes el editor (U16) ni la bandeja (U17), no cambies contratos de datos, no toques producción y no hagas commit ni push. Si unir las rutas cambia los permisos efectivos de algún rol, detente y sube a esfuerzo xhigh.

Entrega a U16 y U17:
- estructura de rutas y secciones;
- permisos verificados;
- pruebas con resultado;
- capturas.
```

## U16 — Estudio: editor

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U16 — Estudio: editor — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U15 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa U16 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- en `docs/producto/censo-interfaz-2026-10-03.md`, la vista "Consola de catálogo · editor";
- `docs/modernizacion/e06-servicio-mutaciones-auditadas-2026-09-16.md`;
- `docs/modernizacion/e07-consola-administrativa-2026-09-16.md`;
- el relevo de U15.
Ejecuta `git status --short`, revisa los diffs del editor y corre la suite visual antes de editar.

Rehaz el editor:
- Una página con secciones e índice lateral fijo: Datos, Créditos, Clasificación, Medios e Historial.
- Densidad más compacta, porque hoy la vista es demasiado grande.
- Géneros y países con el Combobox de U6 en lugar de la nube completa.
- Sin vista previa.
- Edición completa en móvil con una vista pensada para móvil:
  - el índice se vuelve un selector;
  - las acciones de guardar quedan fijas abajo.

Prueba crear, editar, archivar y revertir a 390 y 1440, y comprueba que la auditoría registra igual que antes. Corre la suite visual.

No cambies el payload de las mutaciones auditadas, no toques producción y no hagas commit ni push. Si la reorganización exige cambiar el payload, detente y documenta el caso.

Entrega a U18:
- estructura del editor;
- pruebas con resultado;
- capturas.
```

## U17 — Estudio: propuestas y reportes

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `high`

```text
Ejecuta exclusivamente la etapa U17 — Estudio: propuestas y reportes — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo high. U15 debe estar aceptada.

Primero lee completos:
- las secciones 2 a 7 y la etapa U17 del plan;
- la ronda 3 de `docs/modernizacion/decisiones.md`, en especial "Herramienta interna";
- la sección "Publicación y moderación" de ese mismo archivo;
- en `docs/producto/censo-interfaz-2026-10-03.md`, la vista "Estación editorial";
- `docs/modernizacion/e10-sugerencias-perfil-editorial-2026-09-18.md`;
- `docs/modernizacion/e18-reportes-problemas-2026-09-23.md`;
- los relevos de U13 y U15.
Ejecuta `git status --short`, revisa los diffs y corre la suite visual antes de editar.

Implementa la sección Propuestas como bandeja:
- Lista a la izquierda y detalle a la derecha. En móvil, lista y después detalle, con retorno.
- El detalle muestra solo lo propuesto, con los campos editados respecto de lo detectado marcados.
- Acciones por rol, iguales a las actuales: el colaborador prepara y marca la propuesta como lista para admin; el admin aprueba, pide cambios o rechaza, con nota obligatoria en estos dos últimos.
- La sección Reportes usa la misma bandeja, con estados traducidos y enlace al lanzamiento.

Mantén E10 y E18 en verde, adaptadas. Prueba que un admin aprueba una propuesta y corrige el lanzamiento sin salir del Estudio ni escribir URLs. Corre la suite visual.

No cambies estados, permisos ni el contrato de E09, no toques producción y no hagas commit ni push. Si la bandeja necesita datos que E09 no expone, detente y documenta el caso para un chat de Opus 5.5 con esfuerzo xhigh sobre E09.

Entrega a U18:
- flujo de moderación;
- pruebas con resultado;
- capturas.
```

## U18 — QA integral y candidato

**Modelo:** Claude Opus 5.5 (`claude-opus-5-5`)
**Esfuerzo:** `xhigh`

```text
Ejecuta exclusivamente la etapa U18 — QA integral y candidato — del plan `docs/producto/plan-interfaz-2026-10-04.md`, usando Claude Opus 5.5 con esfuerzo xhigh. Todas las etapas U1–U17, R1, R2 y D1–D3 deben estar aceptadas.

Primero lee completos:
- el plan entero;
- la ronda 3 de `docs/modernizacion/decisiones.md`;
- `docs/producto/censo-interfaz-2026-10-03.md`;
- `docs/modernizacion/estado.md`;
- todos los paquetes de relevo.
Ejecuta `git status --short` y revisa el árbol completo.

Esta etapa involucra Supabase/PostgreSQL: usa las instrucciones locales de Supabase, verifica la documentación vigente y revisa RLS y advisors en staging.

Ejecuta y documenta:
- La suite visual completa por ruta, estado y rol a 390, 834 y 1440 (680 y 1112 en la ficha), comparada con la línea base de U1. Cada diferencia debe ser intencional y estar explicada.
- El lint de tokens, sin excepciones restantes.
- Accesibilidad:
  - teclado en todas las vistas;
  - VoiceOver básico en ficha, filtros, combobox y ordenable;
  - contraste;
  - objetivos táctiles de 44px;
  - `prefers-reduced-motion`.
- Comprobaciones globales:
  - ninguna barra de scroll nativa visible;
  - ningún "crate" en la interfaz;
  - ningún emoji como icono;
  - ningún código interno en los textos.
- El recorrido de punta a punta en staging:
  - registro, correo, confirmación, primera colección, reordenar y compartir;
  - sugerir y su aprobación en el Estudio.
- `npm test`, `npm run build` y `npm run test:browser` completos.

No corrijas hallazgos dentro de este chat salvo erratas triviales. Registra cada hallazgo con su etapa de origen. No toques producción y no hagas commit ni push. La falta de evidencia es un no-go.

Entrega:
- un expediente en `docs/modernizacion/` con matriz, evidencia, hallazgos por severidad y dictamen go/no-go para desplegar;
- `estado.md` actualizado.
```
