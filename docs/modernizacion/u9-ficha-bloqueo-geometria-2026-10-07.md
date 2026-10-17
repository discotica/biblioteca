# U9 — Ficha: bloqueo de geometría (2026-10-07)

Etapa U9 del [plan de interfaz](../producto/plan-interfaz-2026-10-04.md#u9--ficha-modal-página-y-móvil). Corre en Claude Opus 5.5 con esfuerzo `xhigh`, como asigna el plan.

Estado: **resuelto por el equipo el 2026-10-07.**

- La decisión final: dos columnas desde 768, barra de acciones al pie de toda la ficha y marco uniforme de 24 px con tope de 640. Está en [`decisiones.md`](./decisiones.md), "Ficha (2026-10-07, durante U9)".
- La implementación y el relevo están en [`u9-ficha-2026-10-07.md`](./u9-ficha-2026-10-07.md).
- Este documento conserva la evidencia que detuvo la etapa.

## Condición de arranque

- U8 y R1 están aceptadas ([`decisiones.md`](./decisiones.md), ronda 3).
- `npm run visual:compare`: 142 capturas, **0 diferencias**.
  - Falla además un test de la suite: "el censo conserva sus 127 IDs" (cuenta 130). Viene de U7: `header-account-menu-D`, `perfil-admin-D` y `perfil-colab-M` se añadieron sin `supplementary: true` (`tests/visual/censo.spec.ts`, líneas 187, 304 y 305). No es de U9 y no se tocó.
- E16 + E17 + R1: 38 pasan y 1 falla, E17:198, la falla persistente conocida desde U1.

## Qué exige la geometría

Las decisiones que fijan la ficha desde 680 px:

1. Dos columnas desde 680 px (ronda 3, "Objeto lanzamiento"; el prompt: "sin cambiar el corte de 680").
2. Portada cuadrada a la izquierda, a la altura útil, sin barras arriba ni abajo. Por eso el alto del diálogo es igual al lado de la portada ("el diálogo se ajusta").
3. Acciones en una sola línea:
   - Comprar y Añadir a colección, con texto e icono;
   - Compartir y Reportar, como IconButton.
4. Reproductor completo, con 290 (Bandcamp), 300 (SoundCloud) o 352 px (Spotify) de alto, dentro de la columna de información, "donde todo cabe cómodo".

Las medidas reales con las primitivas de U5, en Chromium y con Work Sans:

| Pieza | Ancho |
| --- | ---: |
| Button md "Comprar" con icono | 138 px |
| Button md "Añadir a colección" con icono | 205 px |
| IconButton md (×2) | 44 px cada uno |
| Separaciones (3 × `--space-2`) | 24 px |
| **Línea de acciones** | **455 px** |
| Columna de información con relleno `--space-5` y barra de scroll | **≈ 490 px** |

Con un margen de 16 px por lado (`--dialog-gutter`), el lado de la portada es `min(alto − 32, ancho − 32 − 490)`. El alto del diálogo y de la columna de información es ese mismo valor.

| Viewport | Portada = alto del diálogo | Columna de información | ¿Cabe el reproductor (290–352)? |
| --- | ---: | --- | --- |
| 680 × 1000 | **158 px** | 490 × 158 | **No** |
| 834 × 1112 | **312 px** | 490 × 312 | **No** (Spotify 352; Bandcamp deja 22 px) |
| 1024 × 768 | 502 px | 490 × 502 | Sí |
| 1112 × 834 | 590 px | 490 × 590 | Sí |
| 1440 × 900 | 760 px (tope) | 490 × 760 | Sí |

Por debajo de unos 1000 px de ancho, las cuatro condiciones no se cumplen a la vez. Para que haya columna de información, hay que reducir la portada, y con ella el alto del diálogo. Con acciones más pequeñas (Button e IconButton `sm`, unos 364 px de línea) a 680 queda una portada de unos 248 px, que sigue sin dar cabida a ningún reproductor. La página `/lanzamiento/[slug]` no tiene alto fijo, pero sufre lo mismo en ancho: a 834 la portada se queda en unos 272 px al lado de una columna de 490.

## Capturas

Ficha real (fixtures de R1, reproductor con lista de pistas) con la geometría pedida inyectada por CSS desde una prueba temporal, sin tocar `src/`. El recuadro verde punteado ocupa el lugar y el ancho de la línea de acciones (455 px). Están en [`capturas-u9/`](./capturas-u9/):

| Ancho | Bandcamp | Spotify | Lectura |
| --- | --- | --- | --- |
| 680 | `geometria-pedida-680-bandcamp.png` | `geometria-pedida-680-spotify.png` | Franja de 158 px: solo se ve la portada. La información no tiene alto. |
| 834 | `geometria-pedida-834-bandcamp.png` | `geometria-pedida-834-spotify.png` | Diálogo de 312 px en una pantalla de 1112. Se corta en la reseña: reproductor y acciones quedan fuera. |
| 1112 | `geometria-pedida-1112-bandcamp.png` | `geometria-pedida-1112-spotify.png` | Cumple. |
| 1440 | `geometria-pedida-1440-bandcamp.png` | `geometria-pedida-1440-spotify.png` | Cumple: sin barras y con las acciones en una línea. |

## Opciones para decidir

1. **Dos columnas desde 1024 (`--breakpoint-wide`), en modal y página (recomendada).**
   - De 680 a 1023 la ficha usa la composición de una columna: portada a ancho completo y barra de acciones fija abajo, igual que en el móvil.
   - El token `--breakpoint-ficha` (680) no cambia: lo siguen usando la grilla y otras vistas. La ficha pasa a usar el corte que ya existe.
   - A 834 la portada pasa de 225 px (hoy) a unos 800 px, a ancho completo. Resuelve el punto 7 del plan ("que la portada no quede diminuta").
   - **Cambia la decisión "Pasa a dos columnas desde 680 px".**
2. **Mantener 680 y relajar las acciones entre 680 y 1023:** botones `sm`, o acciones en dos líneas.
   - A 680 no basta: la portada se queda en unos 248 px y el reproductor sigue sin caber.
   - Además incumple "acciones en una sola línea" o el tamaño del botón Comprar.
   - No recomendada.
3. **Mantener 680 y separar el alto del diálogo del de la portada entre 680 y 1023.** La portada arriba a la izquierda y la información con scroll a todo el alto.
   - Reintroduce un hueco bajo la portada, es decir, la "barra" que el equipo pidió quitar.
   - No recomendada.

## Qué no depende de esta decisión

Todo lo demás del trabajo de U9 se puede hacer con cualquiera de las opciones:

- acciones en una línea con Button e IconButton;
- `CreditLine variant="roles"` y el feedback de U8;
- barra fija en móvil con área segura;
- fondo desenfocado de la página;
- capa `data-ui-layer` en el modal (relevo U6);
- geometría desde 1024.

Se hará en este mismo chat en cuanto se elija el corte.

Una nota de contrato, que no requiere decisión: E16 exige el resumen compacto ("Artista Principal y 2 más") y el menú "Varios artistas" dentro de la ficha. La ronda 3 lo sustituye por "todos los artistas organizados por rol", y el registro de decisiones manda. Al implementar U9 se actualizarán esas dos pruebas de E16 al contrato nuevo, y se documentará el cambio.

## Rollback

Nada que revertir en el código. Este documento y `capturas-u9/` son la única huella.
