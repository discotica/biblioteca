# Plan de lanzamiento: de hoy a producción — 2026-10-13

Este es el **orden único** desde hoy hasta tener la Biblioteca en producción, y la forma de seguir cambiándola después. No sustituye el contenido de los planes anteriores ([biblioteca](./plan-ejecucion-biblioteca-2026-09-14.md), [interfaz](./plan-interfaz-2026-10-04.md), [saneamiento](./plan-saneamiento-2026-10-06.md)): cada paso remite a su etapa. Sí sustituye su orden. Si un chat propone otro orden, manda este.

Los prompts, con modelo y esfuerzo, están en [`prompts-lanzamiento-2026-10-13.md`](./prompts-lanzamiento-2026-10-13.md).

## 1. Dónde estamos (verificado el 2026-10-13)

| Bloque | Estado |
| --- | --- |
| Interfaz | U1–U17, R1 y R2 aceptadas. Línea base visual sobre U17 (182 capturas). Falta U18 (QA). |
| Datos | D1, D2, E18 corregida (S5), S6 y S7 listos en local, **sin aplicar en staging**. |
| Catálogo | Staging tiene la carga de septiembre (2.790 lanzamientos). La hoja de Google Sheets ya fue limpiada y ordenada a mano: 2.789 filas con `catalog_key` y 7 rechazos en la prueba en seco del 12-oct. Reemplaza a la carga anterior ([decisión del 2026-10-13](../modernizacion/decisiones.md#catálogo-y-procedencia)). |
| Correo (D3) | Plantillas listas. Faltan la cuenta de Resend, el DNS y el envío real. |
| Saneamiento | Cerradas: S0, S2, S4, S5, S6, S7 y S12.<br>**S1** está hecha en el árbol, sin commit. Las variables de GitHub ya existen.<br>**S3** tiene cambios del 11-oct sin verificar ni documentar.<br>**S8** está a medias: hay snapshot del legado (2.789 filas, no 2.796), pero no hay dump ni restauración de staging.<br>Pendientes: S9, S10 y S11. |
| Biblioteca | E00–E20 hechas. E21 en NO-GO (2026-09-24). E22 (corte) y E23 (retiro del legado) pendientes. |
| Git | La rama `modernizacion-2026` está en GitHub, con 2 commits locales sin subir y ~30 archivos sin commit. `main` sigue en `0ab31e0` (mayo). El repositorio es **público**. |
| Sitio en vivo | Sirve el build de `0ab31e0` (30-may), idéntico a la rama `dist`. Hostinger no está conectado a Git: el repositorio no tiene webhooks. |

## 2. Cómo se va a desplegar

```text
rama de trabajo ─► PR ─► CI verde ─► main ─► [Run workflow] ─► rama dist ─► Hostinger (Git) ─► biblioteca.discotica.com
                                              deploy.yml compila con
                                              las variables de GitHub
```

- **Hostinger no compila.** Su integración con Git copia lo que hay en la rama conectada, sin `npm run build`. Por eso el build se hace en GitHub Actions: `deploy.yml` valida las variables `VITE_*` y publica el resultado en `dist`. Hostinger lee `dist` y actualiza el sitio solo.
- **`main` es lo que está en producción.** Todo entra por PR con la CI en verde. Hasta el corte, la rama de trabajo es `modernizacion-2026`, y su PR se fusiona en E22-B.
- **Publicar es un botón:** Actions → "Build y publicar rama dist" → Run workflow. Solo funciona desde `main`.
- **Volver atrás** está en la sección 7 y tarda minutos.
- **Nunca se suben archivos a mano a Hostinger:** el siguiente despliegue los pisaría.

## 3. Reglas para todos los pasos

1. Va un paso por chat, en este orden, y nunca dos chats a la vez sobre este árbol.
2. Antes de pegar un prompt, elige el modelo y el esfuerzo de su encabezado (`/model`).
3. **Commit al aceptar.** Cuando aceptes un paso, el mismo chat hace commit en la rama de trabajo y push de esa rama.
   - Cambia la regla anterior de "sin commit": ahora Git es el camino a producción.
   - Nunca se hace commit en `main` ni en `dist` a mano.
   - Después del corte, la rama de trabajo es `cambio/<nombre>`, creada desde `main`.
4. **Entornos:**
   - staging (`hgocyrzhgohetfpzbmfs`) se toca solo con tu autorización en el chat;
   - producción (`ewntlvugbopokdrvnwvg`) se toca solo en E22-A, en lectura, y en E22-B, en escritura;
   - el CLI de Supabase está enlazado a producción, así que todo comando lleva `--project-ref`.
5. Una migración aplicada no se edita: se corrige con una nueva.
6. Un paso en rojo no da paso al siguiente. Se corrige en un chat aparte con el [prompt de corrección](./prompts-lanzamiento-2026-10-13.md#corrección) y se repite.

## 4. El orden

| # | Paso | Quién | Modelo · esfuerzo | Listo cuando |
| --- | --- | --- | --- | --- |
| 0 | Arranques tuyos que tienen espera | Tú | — | Resend y DNS en curso |
| | **A. Cerrar lo que está a medias** | | | |
| 1 | S3: suite de navegador en verde | Claude | Opus 5.5 · `high` | 3 corridas sin fallos |
| 2 | S1, commits y PR en borrador | Claude | Sonnet 5.5 · `high` | CI verde en el PR |
| | **B. Despliegue por Git, sin cambiar el sitio** | | | |
| 3 | Conectar Hostinger a `dist` y proteger `main` | Tú + Claude | Sonnet 5.5 · `medium` | Hostinger publica `dist` y el sitio no cambia |
| | **C. Interfaz** | | | |
| 4 | U18: QA de interfaz | Claude + tú (dispositivos) | Opus 5.5 · `xhigh` | Expediente con hallazgos |
| 5 | Correcciones de U18 | Claude | Opus 5.5 · `high` | Ningún P0/P1 abierto |
| | **D. Datos y correo en staging** | | | |
| 6 | S8: backup y restauración de staging | Tú autorizas + Claude | Opus 5.5 · `high` | Restore con conteos idénticos |
| 7 | S9: aplicar migraciones en staging | Tú autorizas + Claude | Opus 5.5 · `high` | Cinco migraciones aplicadas y verificadas |
| 8 | Reemplazar el catálogo de staging con la hoja limpia | Tú (hoja y decisiones) + Claude | Opus 5.5 · `high` | Staging igual a la hoja, sin colecciones rotas |
| 9 | D3: correo propio en staging | Tú + Claude | Opus 5.5 · `high` | Correos en la bandeja de entrada |
| 10 | S10: decisiones y cuentas | Tú | — | Registradas en `decisiones.md` |
| | **E. Candidato** | | | |
| 11 | E21-rc2: QA integral y GO/NO-GO | Claude + tú (QA manual y firma) | Opus 5.5 · `xhigh` | GO firmado |
| | **F. Producción** | | | |
| 12 | E22-A: ensayo del corte sobre una copia de producción | Tú autorizas + Claude | Opus 5.5 · `xhigh` | Guion de corte probado |
| 13 | E22-B: corte a producción | Tú autorizas + Claude | Opus 5.5 · `xhigh` | Sitio nuevo en vivo |
| | **G. Después** | | | |
| 14 | Observación y ciclo de cambios | Tú + Claude | según el cambio | Periodo acordado sin regresiones |
| 15 | E23: retiro del legado | Claude | Opus 5.5 · `xhigh` | Precondiciones de E23 cumplidas |

Las fases C (interfaz, en local) y D (staging) no dependen una de otra. Si ya diste los accesos de la fase D, puedes adelantarla, pero siempre un chat a la vez.

### Qué cambia respecto de los planes anteriores

- **Paso 8, nuevo.** La hoja limpia reemplaza el catálogo de staging antes del candidato. Así la QA de E21-rc2 se hace sobre los datos reales, y E22 importa la misma hoja en producción con un procedimiento ya probado.

- **U18** se parte en dos:
  - el paso 4 hace sus puntos 1–4, en local;
  - el recorrido en staging y el dictamen pasan a E21-rc2, para que haya un solo GO/NO-GO.
- **E22** se parte en un ensayo sobre una copia de producción (E22-A) y el corte real (E22-B). El ensayo es el punto 2 de E21 ("sobre copia del estado previo") hecho explícito, porque producción ya tiene usuarios y colecciones reales.
- **`deploy.yml`** tiene dos ajustes en el paso 2:
  - publica en `dist` añadiendo un commit, en vez de reescribir la rama;
  - solo corre desde `main`.

## 5. Los pasos

### Paso 0 — Lo que arrancas tú hoy

Estas tareas tienen tiempos de espera, así que conviene empezarlas ya, en paralelo con los chats.

- **Resend y DNS (para el paso 9).**
  1. Crea la cuenta en Resend (plan gratuito, ya aprobado) y añade el dominio `discotica.com`.
  2. En el DNS de Hostinger, crea los cuatro registros que te dé: `send` (MX y TXT), `resend._domainkey` y `_dmarc`. La tabla está en el [relevo de D3](../modernizacion/d3-correo-propio-plantillas-2026-10-06.md#registros-dns). Ninguno toca el sitio.
  3. La verificación puede tardar horas.

  **Por qué es obligatorio:** sin SMTP propio, Supabase solo envía a las direcciones del equipo del proyecto, con un límite de pocos correos por hora. El registro público no funcionaría en producción.
- **Visibilidad del repositorio.** Es público y la rama ya está subida, así que `docs/` (planes, refs de proyectos, tu correo) es visible. Si lo quieres privado, cámbialo antes del paso 3. Con el plan gratuito de GitHub, la protección de `main` del paso 3 solo funciona en repositorios públicos.

### Paso 1 — S3: suite de navegador en verde

- **Etapa:** [S3 del saneamiento](./plan-saneamiento-2026-10-06.md#s3--suite-de-navegador-en-verde). Un chat del 11-oct dejó arreglos en el árbol sin verificar ni documentar: la recarga con la ficha abierta y la espera de E14. Este paso los termina.
- **Listo cuando:** hay tres corridas completas sin fallos y una sección S3 en `estado.md`.

### Paso 2 — S1, commits y PR

- Cierra S1 y pone en commits todo lo hecho: S1, S3, S5–S7 y la documentación.
- Abre un PR en borrador de `modernizacion-2026` a `main` para que corra la CI. No se fusiona hasta E22-B.
- Ajusta `deploy.yml` para Hostinger:
  - cada despliegue añade un commit a `dist` en vez de reescribirla. Hostinger actualiza su copia desde esa rama, y su documentación no dice cómo reacciona a una historia reescrita;
  - el despliegue solo corre desde `main`.
- **Tú:** autorizas el push.
- **Listo cuando:** la CI del PR está en verde.

### Paso 3 — Conectar Hostinger a `dist` sin cambiar el sitio

Hoy `dist` tiene exactamente lo que está en vivo, así que conectar no cambia nada visible: sirve de ensayo del mecanismo.

**Tú, en hPanel (unos 15 minutos):**

1. **Respaldo.** En el Administrador de archivos, comprime la carpeta del sitio (la que tiene `index.html`, `_app` y `.htaccess`) y descárgala.
2. Abre el sitio de `biblioteca.discotica.com` → **Avanzado → Git** → **Connect with GitHub**. Instala la app de Hostinger solo para `discotica/biblioteca`. Si GitHub pide aprobación de la organización, apruébala.
3. Elige el repositorio `discotica/biblioteca`, la rama **`dist`** y como directorio la carpeta del punto 1. Si el subdominio vive dentro de otro sitio, elige su subcarpeta. Pulsa **Deploy**.
4. En **Deployments**, espera "Completed". Deja **Auto-deployment** activado.

**Tú, en GitHub:** Settings → Rules → Rulesets → New branch ruleset para `main`, con:

- "Require a pull request before merging";
- "Require status checks to pass", con el check `verify`.

**Claude:** compara el sitio con `dist` y documenta la conexión.

**Listo cuando:** Hostinger muestra el despliegue de `dist` y el sitio sirve los mismos archivos que antes.

### Paso 4 — U18: QA de interfaz

- **Etapa:** [U18](./plan-interfaz-2026-10-04.md#u18--qa-integral-y-candidato), puntos 1–4: visual, tokens, accesibilidad y comprobaciones globales, en local.
- **Incluye lo anotado "para U18":**
  - el sticky global (`overflow-x` de `body`);
  - el límite de intentos de `login-with-username`;
  - si `/lab` existe en producción;
  - las dos excepciones del lint de tokens;
  - la ayuda de "Nota interna".
- **No corrige:** registra cada hallazgo con su severidad.
- **Tú:** la QA manual que te pida el chat.
  - En un iPhone real: el doble toque del radar, el área segura de la ficha, la banda de filtros y la hoja.
  - Con VoiceOver: la ficha, los filtros, el combobox y el ordenable.

### Paso 5 — Correcciones de U18

- Corrige los P0 y P1 del expediente de U18, y los pendientes según lo que decidas. Si son muchos, usa un chat por grupo.
- **Tú:** decides sobre `/lab` (recomendación: solo en desarrollo) y sobre la ayuda de "Nota interna".
- **Listo cuando:** no queda ningún P0/P1 abierto, la suite y la comparación visual están en verde y la línea base está recapturada.

### Paso 6 — S8: backup y restauración de staging

- **Etapa:** [S8](./plan-saneamiento-2026-10-06.md#s8--backup-y-restauración-de-staging-gate-humano). Cierra E21-P0-02, que impide aplicar nada en staging.
- **Tú:**
  - autorizas en el chat la vía B con la cadena que ya está en `.env.local` (`E06_STAGING_DATABASE_URL`);
  - abres Docker Desktop.
- La referencia del legado (B10) ya está decidida: es la hoja limpia. Su snapshot y la comparación se hacen en el paso 8.
- **Listo cuando:** hay un dump con checksum copiado fuera de este disco y una restauración local con conteos idénticos. Ese dump es la red de seguridad del paso 8.

### Paso 7 — S9: aplicar en staging

- Aplica en este orden: E18 corregida → D1 → D2 → S6 → S7 → U18 H2 (límite de intentos). Antes de cada una pide tu autorización, y antes de la primera marca la migración base, como explica el prompt.
- Después de la migración de U18 H2, despliega `login-with-username` y verifica en staging lo que el expediente de U18 deja pendiente.
- **Listo cuando:** las cinco están aplicadas y verificadas, y la app apuntando a staging funciona: Estudio, colecciones con orden y reportes.

### Paso 8 — Reemplazar el catálogo de staging con la hoja limpia

Se vuelve a tomar el TSV publicado de Google Sheets y sus datos reemplazan los lanzamientos de staging ([decisión del 2026-10-13](../modernizacion/decisiones.md#catálogo-y-procedencia)).

**Qué significa "reemplazar"** sin romper lo que ya depende de los lanzamientos:

- **Se empareja por `catalog_key`.** Cada lanzamiento conserva su UUID, así que colecciones, reportes, propuestas y URLs siguen apuntando bien.
- **La hoja manda** en título, fecha, tipo, sello, reseña, artistas, géneros, países, radar, enlace y portada. Lo que se haya editado en el Estudio de staging sobre esos campos se pierde. El chat lo lista antes.
- **Las filas nuevas se crean.**
- **Lo que la hoja ya no tiene se archiva, no se borra**, porque puede estar en una colección.
- **Los lanzamientos que solo existen en staging** (creados en pruebas del Estudio o de Sugerir) se listan, y tú decides si se archivan.
- **El orden de las filas no se traslada al sitio:** el catálogo se ordena por fecha. Si el orden de la hoja tiene que verse en el sitio, es un cambio aparte.

**Por qué el importador actual no basta tal cual:** empareja bien por clave, pero no archiva lo que falta, vuelve a publicar lo archivado y borra y recrea enlaces y portadas. El chat lo ajusta en una migración nueva si hace falta, y lo prueba primero sobre la copia local del paso 6.

**Tú:**

1. Confirmas que la hoja está lista.
2. Corriges en la hoja las filas que el chat te devuelva como rechazadas. El 12-oct eran 7: cinco títulos vacíos, un valor de radar fuera de rango y una fila sin artista.
3. Revisas el informe de diferencias y decides los casos dudosos.
4. Autorizas el reemplazo en staging.

Desde aquí, si la hoja cambia, se repite este paso antes de E22.

**Listo cuando:**

- staging tiene exactamente los lanzamientos publicados de la hoja;
- ninguna colección apunta a un lanzamiento perdido;
- queda una tabla de cambios de identidad (títulos y artistas que cambiaron, con su slug anterior). E22 la necesita para que los enlaces compartidos y las colecciones de producción sigan resolviendo.

### Paso 9 — D3: correo propio en staging

- **Requiere** el paso 0, con el dominio verificado en Resend.
- **Tú:** pegas la API key de Resend en el dashboard de Supabase de staging (Authentication → SMTP), nunca en el chat.
- **Claude:** verifica el DNS, hace el envío real a una cuenta de prueba y revisa los encabezados SPF, DKIM y DMARC.
- **Tú:** revisas los correos en Gmail web, Gmail móvil y Apple Mail.
- Producción se configura en E22-B.

### Paso 10 — S10: decisiones y cuentas (solo tú)

Registra estas decisiones en `decisiones.md`, o pídeselo a un chat corto:

1. **Créditos (B4).** Aprueba una muestra o redefine el criterio de salida.
   - Ojo: producción se importa desde la hoja, así que lo que se edite en staging **no pasa a producción**.
   - Recomendación: aprobar una muestra pequeña en staging como prueba del flujo y verificar los créditos en producción después del corte.
2. **Cuenta de colaborador permanente en staging (B6).**
3. **Limpieza (pendiente de U12):** abre el enlace de confirmación de `hola+u12-10092308@mamanche.com` y borra esa cuenta de prueba.

La fuente del catálogo de producción ya está decidida: la hoja limpia, con el procedimiento del paso 8.

### Paso 11 — E21-rc2: QA integral y GO/NO-GO

- Repite la matriz de E21 sobre staging con todo aplicado.
- Añade el recorrido de punta a punta de U18:
  - registro → correo → confirmación → primera colección → reordenar → compartir;
  - sugerir → aprobación en el Estudio.
- Entrega el **plan exacto de corte**: fuente de datos, flags del día, orden de migraciones en producción, Edge Functions y configuración de Auth y SMTP.
- **Tú:**
  - la QA manual que te pida: Safari iOS, Android Chrome, VoiceOver e iframes reales;
  - la firma de producto. E21 pide además la firma de una segunda persona operativa.
- **Listo cuando:** el dictamen es GO, con todos los P0 cerrados. Si es NO-GO, corrige con el prompt de corrección y repite este paso.

### Paso 12 — E22-A: ensayo del corte

- **Producción solo en lectura.** Se hace un dump de producción, se restaura en local y se ensaya el corte completo sobre esa copia:
  - migraciones;
  - importación de la hoja congelada con el procedimiento del paso 8, más la tabla de cambios de identidad;
  - colecciones existentes con su `release_id`;
  - RLS;
  - la app contra la copia.
- **Tú, antes de empezar:**
  - añade a `.env.local` la cadena de conexión de producción como `E22_PROD_DATABASE_URL` (Supabase → Project Settings → Database → Connection string), nunca en el chat;
  - fija la fecha y la hora del corte. Desde aquí, nadie edita la hoja de cálculo.
- **Listo cuando:** hay un guion de corte probado de punta a punta en la copia, con comandos, resultados esperados, tiempos y condiciones de parada.

### Paso 13 — E22-B: corte a producción

- Sigue el guion de E22-A, con un backup del mismo día:
  1. migraciones, Edge Functions y Auth (URL del sitio, redirecciones y SMTP);
  2. importación y admin de recuperación;
  3. prueba de humo en la base;
  4. flags del día en las variables de GitHub;
  5. fusión del PR a `main` y Run workflow;
  6. despliegue de Hostinger y verificación en vivo.
- **Tú:**
  - autorizas en el chat cada escritura en producción, la fusión y el despliegue;
  - cargas la API key de Resend en el SMTP de producción.
- **Si falla la integridad, RLS, auth o las colecciones:** rollback de la aplicación en el momento (sección 7). Las migraciones no se revierten durante el incidente.
- **Listo cuando:** producción sirve el catálogo canónico y los flujos críticos, y el rollback sigue disponible.

### Paso 14 — Observación

- Acuerden la duración del periodo de observación (por ejemplo, 4 semanas).
- Durante ese tiempo revisa:
  - el informe diario de medios (`media-health.yml`);
  - los reportes en el Estudio;
  - los errores de Auth.
- Los cambios siguen el ciclo de la sección 6.

### Paso 15 — E23: retiro del legado

- **Etapa:** [E23](./plan-ejecucion-biblioteca-2026-09-14.md#e23--retiro-controlado-del-legado). Es la única destructiva.
- Va solo con sus precondiciones cuantitativas cumplidas y con tu aprobación explícita antes de cada borrado.

## 6. Después del lanzamiento: cómo cambiar el sitio sin miedo

**Cualquier cambio** de interfaz, texto o función sigue este ciclo:

1. Abre un chat nuevo con el [prompt de cambio](./prompts-lanzamiento-2026-10-13.md#cambio-nuevo), que crea una rama desde `main`.
2. El chat implementa y prueba en local: `npm test`, `test:browser` y `visual:compare`.
3. Si lo aceptas, el chat hace commit, push y abre el PR. La CI corre sola.
4. Con la CI en verde, fusionas el PR en GitHub.
5. Publicas: Actions → "Build y publicar rama dist" → Run workflow. Hostinger actualiza el sitio en un minuto, más o menos.
6. Miras el sitio. Si algo va mal, ve a la sección 7.

**Los cambios de base de datos** (columna, tabla, RLS) usan el [prompt de migración](./prompts-lanzamiento-2026-10-13.md#cambio-de-base-de-datos), con un orden fijo:

1. local, desde cero;
2. staging, con backup;
3. producción, con backup;
4. y solo después se publica el front que la usa.

**Las funciones a medio hacer** quedan detrás de un flag `VITE_*` en `false`. Se encienden cambiando la variable en GitHub y volviendo a publicar.

**Decisión pendiente, para después de la observación:** si se publica automáticamente al fusionar en `main` (basta cambiar el disparador de `deploy.yml`). Recomendación: mantener el botón manual. Es un clic y tú decides cuándo sale cada cambio.

## 7. Volver atrás

| Problema | Acción | Tiempo |
| --- | --- | --- |
| El último despliegue rompió algo visible | [Prompt de rollback](./prompts-lanzamiento-2026-10-13.md#rollback-de-emergencia): revierte el último commit de `dist`, y Hostinger vuelve al build anterior sin compilar | ~2 min |
| Falla el catálogo canónico o un flujo con datos | En las variables de GitHub, `VITE_CATALOG_SOURCE=legacy` y los flags afectados en `false`; después, Run workflow | ~5 min |
| El error está en el código | Un PR que revierte el cambio en `main` → CI → Run workflow | ~15 min |
| Datos dañados | Restaurar en una base aislada y corregir con una migración nueva. Nunca se revierten migraciones en producción durante el incidente | — |

## 8. Lo que solo tú haces

| Cuándo | Acción |
| --- | --- |
| Hoy | Resend y DNS; decidir la visibilidad del repositorio |
| Paso 2 | Autorizar el push |
| Paso 3 | Respaldar la carpeta del sitio, conectar Git en hPanel y crear el ruleset de `main` |
| Pasos 4–5 | QA en iPhone y con VoiceOver; decidir sobre `/lab` y "Nota interna" |
| Paso 6 | Autorizar el dump de staging y abrir Docker |
| Paso 7 | Autorizar cada migración en staging |
| Paso 8 | Dar la hoja por lista, corregir las filas rechazadas, decidir los casos dudosos y autorizar el reemplazo |
| Paso 9 | Cargar la API key de Resend en el Supabase de staging y revisar los correos |
| Paso 10 | Créditos, cuenta de colaborador y borrar la cuenta de prueba |
| Paso 11 | QA manual y firmas |
| Paso 12 | Poner la cadena de producción en `.env.local`, fijar la fecha del corte y congelar la hoja |
| Paso 13 | Autorizar cada escritura, la fusión y el despliegue; configurar el SMTP de producción |
