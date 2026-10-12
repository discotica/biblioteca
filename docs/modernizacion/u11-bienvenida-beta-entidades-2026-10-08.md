# U11 — Bienvenida, beta, artista y sello (2026-10-08)

Etapa U11 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#u11--bienvenida-beta-artista-y-sello). El plan asigna Claude Sonnet 5.5 con esfuerzo `medium`; el chat corrió en **Claude Opus 5.5**. No hubo que escalar: separar la beta de la bienvenida no rompe las reglas de E19 ni de E20 (ver "E19 y E20"). No se hizo commit ni push, y no se tocaron datos, despliegue ni producción.

Estado: **implementada, pendiente de aceptación.** La línea base visual no se recapturó: se recaptura cuando el equipo acepte, como en U4–U10.

## Condición de arranque

- U7 y U8 aceptadas (`decisiones.md`, ronda 3). U9 y U10 también.
- `npm run visual:compare` antes de editar: 145 capturas, **0 diferencias**. La meta-prueba "el censo conserva sus 127 IDs" falla (cuenta 130) desde U7: tres capturas no llevan `supplementary: true`. No es una diferencia de captura y U11 no la toca.
- Los archivos reescritos o borrados se respaldaron en `respaldos/*.pre-u11.txt` (no están en git en su versión actual).

## Resultado

| Trabajo del plan | Hecho |
| --- | --- |
| 1. Bienvenida editorial | `home/HomeWelcome.svelte` sustituye a `WelcomeBanner.svelte`. Es un bloque grande alineado con la grilla (contenedor `wide`), con la composición de la ficha: ilustración a la izquierda e información a la derecha; en móvil, la información primero y la ilustración en una banda al pie. Usa `Button` e `IconButton` del sistema. Las reglas de sesión de E20 no cambian. |
| 2. Hueco de la ilustración | Se cambia en `src/lib/content/welcome.ts` (`illustration`). Sin arte, se ve el logo atenuado, igual que una portada sin imagen. Ver "Dónde va la ilustración". |
| 3. Invitación beta | `BetaInvitation.svelte` pasa a la primitiva `Dialog` (U5), sin overlay propio. Conserva las reglas de E19 y es un diálogo propio, distinto de la bienvenida. |
| 4. Artista y sello | `CatalogEntityPage.svelte`, compartido por las dos rutas: migas "Catálogo › Artista" y "Catálogo › Sello", h1 solo con el nombre a la izquierda, sin antetítulo, sin filtros, y la barra de resultados del inicio (paginación "x de y", contador y "Ordenar por"), con la paginación inferior. |

### Decisiones tomadas en la etapa

Ninguna sustituye una decisión de producto. Se registran para que U18 no las vuelva a inferir.

**Bienvenida**

- "Componente permanente" se lee como "deja de ser provisional", no como "siempre visible". `decisiones.md` no cambia la regla de sesión de E20, y el plan dice conservarla. Sigue apareciendo una vez por pestaña, solo al entrar directo a `/`, y se cierra con ×. **Para el equipo:** si "permanente" significaba visible en cada visita, hace falta una decisión nueva (E20 lo exige así).
- Salen el degradado del fondo y el marcador punteado con un círculo con halo: eran ornamento. El bloque es un panel plano con borde, como el resto de superficies.
- Ilustración a la izquierda, como la portada en la ficha y en la fila. En móvil la ilustración va abajo para que título y "Explorar" lleguen antes. El cierre queda siempre en la esquina superior derecha, sobre la información y nunca sobre el arte.
- El hueco tiene alto mínimo 4:3 y, si el texto es más alto (tablet), se estira con la fila. En móvil es una banda 5:2.
- El arte es decorativo por defecto (`alt` vacío): el título ya dice qué es el bloque. Se retiró el `aria-label` "Espacio reservado para ilustración…", que se leía en voz alta a los usuarios.
- Tokens nuevos en `tokens.css` (bloque "Bienvenida del inicio (U11)"): `--welcome-art-ratio`, `--welcome-art-ratio-narrow`, `--welcome-title-measure` y `--welcome-copy-measure`.

**Beta**

- Sobre `Dialog`: el título es "Hola, {nombre}." (o el genérico) y el cuerpo de E19 es su descripción (`aria-describedby`). Se pierde el antetítulo "Discótica", que `Dialog` no tiene.
- "Explorar" va en el cuerpo, antes de los enlaces de contacto, no en el pie: E19 fija el orden de tabulación × → Explorar.
- `Dialog` se extiende con `closeLabel` (nombre del ×; aquí "Cerrar invitación beta") y con atributos extra en la raíz (`data-beta-invitation`, que usan las pruebas E19).
- `IconButton` se extiende con `quietTip`, y `Dialog` lo usa en su ×. La ayuda emergente del × empieza descartada y vuelve cuando el foco o el puntero salen y regresan. Así se cumple que el foco inicial vaya al cierre (E19) sin que la ayuda tape el texto. El anillo de foco se mantiene. Afecta a todos los diálogos, pero solo se nota en los que se abren con teclado o al cargar la página.

**Artista y sello**

- La miga final es el tipo ("Artista", "Sello"), literal del plan; el nombre va en el h1. Sin antetítulo, la miga es lo único que dice si la página es de un artista o de un sello.
- "Ordenar por" no es un filtro: se conserva, pero sale de la cabecera a la barra de resultados del inicio, junto a la paginación (en móvil, en la misma línea). Se usa `Select` del sistema, sin los dos puntos. Se mantienen los cuatro órdenes (fecha y título).
- Sin selector grilla/lista: la ronda 3 no lo pide aquí, y en móvil el del inicio vive en la línea de "Buscar", que estas páginas no tienen. `SearchResultsBar` gana `viewToggle` (por defecto `true`).
- La paginación se ve siempre (también "1 de 1"), como en el inicio.
- Vacío: `EmptyState` con "Volver al catálogo" (estados vacíos utilitarios: mensaje y una acción).
- El contador "x–y de z lanzamientos" sale a `resultsSummary()` en `homeSearchView.ts` y lo usan el inicio, artista y sello.

## E19 y E20

- **E20:** sin cambios en `welcomeSession.ts`, el layout raíz ni la decisión de `+page.svelte`. Se conservan `data-welcome-banner`, "Cerrar bienvenida", "Explorar" (enfoca Buscar) y el bloque en el flujo, no modal.
- **E19:** sin cambios en `betaInvitation.ts` ni en la limpieza de la URL. Se conservan el foco inicial en el ×, Tab → Explorar, Escape, el fondo, el retorno del foco a Buscar, el nombre como texto y `data-beta-invitation`.
- **Prueba E19 ajustada:** el caso móvil medía `max-height` en el elemento con `role="dialog"`. En `Dialog` ese rol está en la raíz a pantalla completa y el tope de alto está en el panel. La prueba ahora mide el panel y además comprueba que quepa en 740 px. La intención no cambia.
- **Intermitencia previa de E19** (no es de U11): "acepta parámetros válidos… idempotente" falla a veces en las líneas 50–51. Tras Escape, clic en una tarjeta y Atrás, el historial vuelve a una entrada con `beta=&nombre=…&orden=match`: la normalización de E12 deja una entrada con los parámetros beta. A/B en una copia del árbol con la beta previa a U11: 8/12 pasan. Con U11: 6/12. Es la misma carrera, dentro del ruido. El historial no determinista es de Opus, fuera de U11. Queda para U18.

## Archivos

- **Nuevos**
  - `src/lib/components/home/HomeWelcome.svelte`
  - `src/lib/components/CatalogEntityPage.svelte`
  - `tests/browser/u11-bienvenida-entidades.spec.ts` (7 casos)
  - `docs/modernizacion/capturas-u11/` y este documento
- **Modificados**
  - `src/lib/content/welcome.ts`: `eyebrow` e `illustration`; sale `visualLabel`.
  - `src/lib/components/BetaInvitation.svelte`: sobre `Dialog`, con runas y `onclose`.
  - `src/lib/ui/Dialog.svelte`: `closeLabel`, atributos extra y `quietTip` en el ×.
  - `src/lib/ui/IconButton.svelte`: `quietTip`.
  - `src/lib/components/SearchResultsBar.svelte`: `viewToggle`.
  - `src/lib/components/home/HomeResults.svelte`: usa `resultsSummary()`.
  - `src/lib/domain/homeSearchView.ts`: `resultsSummary()`.
  - `src/lib/styles/tokens.css`: bloque U11.
  - `src/routes/+page.svelte`: `HomeWelcome` y `onclose` de la beta.
  - `src/routes/artista/[slug]/+page.svelte` y `src/routes/sello/[slug]/+page.svelte`: delegan en `CatalogEntityPage`.
  - `tests/browser/u10-inicio.spec.ts`: la prueba de artista y sello usa las navegaciones de la barra ("Paginación superior/inferior de resultados") y el contador.
  - `tests/browser/e19-beta-invitation.spec.ts`: ver "E19 y E20".
- **Borrados:** `src/lib/components/WelcomeBanner.svelte` (copia en `respaldos/`).
- `/lab` no cambia: `quietTip` y `closeLabel` no tienen variante visual nueva que mostrar.

## Dónde va la ilustración

1. Poner el archivo en `static/img/bienvenida/` (por ejemplo `ilustracion.svg` o `.webp`).
2. En `src/lib/content/welcome.ts`, cambiar `illustration: null` por `illustration: { src: '/img/bienvenida/ilustracion.svg', alt: '' }`. `alt` va vacío si el arte es decorativo.
3. Formato: el hueco mide 4:3 en dos columnas (unos 480 × 360 px a 1440; el doble en pantallas de densidad 2) y una banda 5:2 en móvil (unos 340 × 136 px a 390). El arte se recorta para llenarlo (`object-fit: cover`), así que el motivo debe quedar en la franja central horizontal. Entre 769 y ~1000 px el hueco crece en alto con el texto.
4. Correr `tests/browser/e20-welcome.spec.ts` y `tests/browser/u11-bienvenida-entidades.spec.ts`. La segunda comprueba el marcador; con arte real, cambiar esa aserción por la imagen.

## Pruebas

- `npm test`: **106/106**.
- `node scripts/lint-tokens.mjs`: OK (136 archivos, 2 excepciones temporales previas).
- `npm run build` y `git diff --check`: OK. `svelte-check` sin errores en los archivos tocados (los errores de entorno de `tests/visual` y `$types` son previos).
- `npx playwright test tests/browser/u11-bienvenida-entidades.spec.ts tests/browser/e20-welcome.spec.ts tests/browser/e19-beta-invitation.spec.ts`: con el flag apagado, 12 pasan y 3 se omiten.
- `VITE_BETA_INVITATION_ENABLED=true` (E19 + E20): 7 pasan y 1 se omite, salvo la intermitencia previa de E19 descrita arriba.
- `npx playwright test` completo (2 workers): **214 pasan, 5 omitidas, 2 fallan**.
  - E17:202 es la falla persistente previa y falla igual en la copia previa a U11.
  - E16:294 fue arranque en frío: pasa aislada.
- Verificado a 390, 834 y 1440 px, sin scroll horizontal (pruebas U11 y E20; 834 con captura manual).

## Capturas

Capturas de entrega en [`capturas-u11/`](./capturas-u11/): las 8 actuales de la suite y `home-welcome-834`/`artista-834`.

### Suite visual

Contra la línea base U10: **145 capturas, 137 iguales, 8 distintas**, 0 inestables.

| Capturas | Motivo |
| --- | --- |
| `home-welcome-D`, `home-welcome-M` | Bloque editorial nuevo: alineado con la grilla, ilustración (logo atenuado) a la izquierda o abajo, título en `--text-display`, `Button` e `IconButton` del sistema. En móvil la primera portada baja unos 90 px: el bloque ya no va a sangre y el título ocupa tres líneas. |
| `home-beta-D`, `home-beta-M` | Invitación sobre `Dialog`: panel, cabecera y × del sistema, sin antetítulo. El × muestra su anillo de foco inicial sin ayuda emergente. |
| `artista-D/M`, `sello-D/M` | Sin antetítulo; miga "Catálogo › Artista/Sello"; barra de resultados (paginación, contador, orden) en lugar del "Ordenar por:" de la cabecera; paginación inferior siempre visible. |

Ninguna diferencia fuera del alcance.

## Para el equipo / U18

- Confirmar la lectura de "permanente" (ver "Bienvenida").
- La bienvenida en móvil empuja la primera portada más abajo que antes. Si molesta, las palancas son la banda (`--welcome-art-ratio-narrow`) o el tamaño del título en móvil, no la regla de sesión.
- Intermitencia de historial en E19 (`beta` persiste en una entrada tras Atrás): previa, para Opus.
- La meta-prueba de los 127 IDs del censo sigue fallando desde U7.
