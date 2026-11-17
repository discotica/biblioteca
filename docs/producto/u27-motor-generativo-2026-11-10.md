# U27 — Motor generativo (2026-11-10)

Etapa U27 del [plan de dirección de arte](./plan-direccion-arte-2026-11-10.md), §4. Todo vive en `src/lib/generative/` y no tiene dependencias nuevas. Se ve en `/lab`, sección «Motor generativo (U27)».

## API

Se importa desde `$lib/generative`.

### Semilla (`semilla.ts`)

| Export | Qué hace |
| --- | --- |
| `fnv1a(texto)` | FNV-1a de 32 bits sobre las unidades UTF-16. Entero sin signo. |
| `normalizarNombre(nombre)` | `trim`, NFC y minúsculas. «Comunidad» y « comunidad» siembran igual. |
| `semillaDe(nombre)` | `fnv1a(normalizarNombre(nombre))`. |
| `prng(semilla)` | mulberry32, el mismo PRNG del tablero A2. Devuelve `() => [0, 1)`. |

### Huella (`huella.ts`)

| Export | Qué hace |
| --- | --- |
| `tonosDe(nombre, rol)` | `[oscuro, medio, claro]` en hex. Usuario: verdes de 66° a 166°, de saturación media como en B. Colaborador: grises con saturación < 8 %. Admin: ±12° alrededor de `--color-rol-admin` (263°). El tono exacto sale del nombre. |
| `huella(ctx, w, h, opciones)` | Pinta la huella en un contexto 2D de w×h px. |
| `puntosHuella(w, h, opciones)` | Los puntos como `Float32Array` `[x, y, radio, banda, …]`. Es puro: lo usan las pruebas. |
| `campoDe(nombre, w, h)` | El campo continuo `(x, y) → [0, 1]`. |
| `firma(puntos)` | FNV-1a de los puntos redondeados a milésimas. |
| `TONOS_GRISES` | Gama sin tono, para la huella antes de revelar el color (onboarding, K). |
| `FONDO`, `ROL_ADMIN` | Espejo de `--color-fondo` y `--color-rol-admin`. Una prueba los compara con `tokens.css`. |

`OpcionesHuella`:

| Opción | Uso |
| --- | --- |
| `nombre` y `rol` | Siembran la forma y el color. El rol solo cambia el color, nunca la forma. |
| `paso` | Paso de la rejilla en px del lienzo. Por defecto 24. |
| `celdas` | En lugar de `paso`: cuántas celdas caben en el lado menor. |
| `borde` | Ancho del borde suave, en celdas. Por defecto 1,5. |
| `tonos` | Sustituye la gama del rol. |
| `fondo` | Color de fondo. `null` deja el lienzo transparente. |
| `mascara` | Blanco sobre transparente, con opacidad 0,75, 0,9 o 1 según la banda. Para `mask-image`. |

### Componentes

- **`<Huella nombre rol tamano={32|40|96} alt? />`**: avatar circular estático. Se genera a 2× (el DPR máximo) y se cachea como dataURL por rol, tamaño y nombre mientras viva la página. Usa 7 celdas a 32 y 40 px, y 11 a 96. `avatarDataURL()` y `celdasAvatar()` se exportan para quien necesite la URL sin el componente.
- **`<Cenefa nombre rol portada? alto=400 paso=12 velo=true zonaDerecha? />`** con contenido como hijo:
  - **Con portada**: un `<img>` con `filter: blur(48px) saturate(1.3) brightness(1.4)`, escalado a 1,3 para tapar el borde del desenfoque. Encima va la máscara de puntos, un canvas propio servido como blob a `mask-image`. Lo que queda fuera de los puntos es `--color-fondo`. La portada nunca entra en un canvas ni se lee con `getImageData`. Hasta tener la máscara, la superficie no se ve, así que nunca aparece la portada entera.
  - **Sin portada**: la huella con el color del rol, en un canvas.
  - **Velos**: el vertical va de `--color-velo-cenefa-arriba` (0,66) a `--color-velo-cenefa-abajo` (0,46). `zonaDerecha` es la fracción del ancho donde empieza la zona atenuada (`--color-velo-cenefa-zona`, 0,72), con 48 px de transición.
  - El paso por defecto es 12 px CSS: el «paso 24» del lienzo a 2×, medido en las imágenes de G2 y F.
- **`<CampoPulso opciones? fijo? bind:ms class? />`**: el campo A2. Ocupa su contenedor y lo coloca la página.
  - Lleva `pointer-events: none` y `aria-hidden`. Escucha `pointermove` en la ventana y solo cuenta los puntos que caen sobre él.
  - Es una sola instancia viva por pantalla: si ya hay otra montada, la nueva queda en fotograma fijo y avisa en desarrollo.
  - Se pausa fuera de pantalla (`IntersectionObserver`) y con la pestaña oculta (`visibilitychange`).
  - Con `prefers-reduced-motion`, `Save-Data` o `fijo`, muestra el fotograma fijo (t = 20, el del tablero), dibujado en el hilo principal al montar. Si el movimiento reducido se activa con la página abierta, el campo para y deja ese fotograma.
  - El DPR está limitado a 2.
  - Lo vivo corre en un worker (`pulso.trabajador.ts`) sobre un `OffscreenCanvas`; el hilo principal solo le pasa el puntero, el tamaño y la pausa. Sin `OffscreenCanvas`, corre en el hilo principal. Los dos caminos están en `motorPulso.ts`.
- **`crearPulso(ctx, W, H, opciones)`** (`pulso.ts`): el motor sin componente, con `apuntar`, `paso(dt)`, `fijo()`, `energia` y `ms`. `PULSO_POR_DEFECTO` son los valores del tablero: fuerza 58, bpm 96, cada 4, islas 4, uniones 80, paso 24 y semilla «discotica».

## Reconstrucción

**Huella.** El `motor.js` original se perdió. Quedan los parámetros de §4 y las imágenes de B, G2, F y K. La primera versión usaba ruido de valor en dos octavas con ganancia 2,1, y salía en bandas duras y llenas. Las imágenes muestran otra cosa: una a tres manchas redondas, con núcleo lleno y un contorno largo de puntos medianos, sobre un fondo de puntos mínimos. El campo que se parece es este:

- dos o tres manchas gaussianas sembradas, cada una con su centro, tamaño (σ de 0,07 a 0,13), alargamiento, giro y peso (0,4 a 1);
- un halo de la misma forma, **2,1 veces más ancho** y con peso 0,22. Aquí vive la «ganancia 2,1 y borde suave» de §4, como ensanche del halo;
- el dominio ondulado por dos senos, para que los bordes no sean elipses;
- un fondo de 0,05 y el borde del lienzo atenuado en 1,5 celdas;
- radio `paso · (0,06 + 0,41·v)` y tres bandas de tono (v < 0,36, v < 0,68 y el resto).

La escala se mide sobre √(w·h). Así un avatar y una huella grande del mismo nombre comparten composición, como en B: el avatar de 64 repite la mancha de abajo a la izquierda de la huella grande. Y una cenefa ancha reparte las manchas a lo largo. En formatos más anchos que 2:1, las manchas se achican en proporción al lado menor y hay una más, porque en F y G2 son más chicas y están más repartidas que en B.

No es idéntica píxel a píxel a las imágenes. El tono exacto de cada nombre tampoco coincide con el del tablero («comunidad» sale verde puro y no menta), porque la función original del tono se perdió con el motor.

**Pulso.** Es el `<script>` de `PulsoB.dc.html` sin cambios de comportamiento. Las optimizaciones (abajo) se compararon contra el script original: corrieron los dos con 900 cuadros, 3 s quietos y luego el cursor en un ocho. En 806 cuadros dibujados y 1,34 millones de puntos, un solo punto cambió de escalón de color, en un cuadro, por el redondeo de la tabla de seno. Ninguno se movió más de 1e-5 px.

## Rendimiento

Presupuesto de §4: **menos de 4 ms por cuadro**, en el Performance de Chromium con CPU ×4.

**Método.** Build de producción (`vite build` + `vite preview`) en Chromium headless de Playwright, viewport de 1440×900, DPR 2 y `Emulation.setCPUThrottlingRate(4)`. La página es `/lab?campo=pantalla`, que pone el campo a pantalla completa. Se graba una traza `devtools.timeline` de 6 s en reposo y 6 s con el ratón trazando un ocho sobre todo el viewport. Se toma la duración de `FireAnimationFrame` por hilo, más la media móvil que lleva el propio motor (`ms`). Script: [`scripts/medir-campo-pulso.mjs`](../../scripts/medir-campo-pulso.mjs).

**Resultado con worker** (el camino normal). Tres corridas:

| Fase | Hilo principal | Worker: mediana | Worker: p95 | Worker: máx | Media del motor |
| --- | --- | --- | --- | --- | --- |
| Reposo | 0 cuadros del campo | 0,07–0,60 ms ¹ | 0,75–0,80 ms | 1,2–2,7 ms | 0,70 ms |
| Cursor | 0 cuadros del campo | 0,89–0,91 ms | 1,03–1,04 ms | 2,9–3,4 ms | 0,90 ms |

¹ En reposo el motor dibuja a 30 cps: la mitad de los callbacks no dibuja nada, y eso baja la mediana. La media del motor (0,70 ms) es el coste real de un cuadro dibujado.

**El ×4 de Chromium no frena al worker**: solo limita el hilo principal. Para comparar con el presupuesto, el coste del worker multiplicado por 4 da unos **2,8 ms en reposo y 3,6 ms con cursor**. Es una estimación, no una medida limitada. El hilo principal no paga ningún cuadro: solo reenvía `pointermove`.

**Camino sin worker** (sin `OffscreenCanvas`, p. ej. Safari anterior a 16.4), medido en el hilo principal con ×4:

| Fase | Mediana | p95 | Media del motor |
| --- | --- | --- | --- |
| Reposo | 0,9–2,2 ms ¹ | 3,6–4,7 ms | 2,9–3,8 ms |
| Cursor | 3,8–4,2 ms | 4,9–6,4 ms | 3,8–4,9 ms |

Sin worker, el campo queda **en el límite del presupuesto con cursor**. Antes de optimizar el bucle de puntos, la mediana con cursor era de 5,4 ms.

En Chromium con ×4, el cálculo de los puntos se lleva unos 3,3 ms y los `arc()` cerca de 1 ms. Por eso el worker es el camino normal: con cursor, en el hilo principal no hay margen fiable bajo 4 ms.

**Optimizaciones** (todas en `pulso.ts`, sin cambiar el dibujo):

- gaussianas separables en `empujar`;
- `Math.sqrt` en lugar de `Math.hypot`;
- pesos bilineales compartidos por las cuatro mallas;
- coordenadas de rejilla precalculadas por fila y columna;
- recorte del núcleo y de la ola de cada nodo por distancia (error < 1e-6);
- caja y distancia al segmento recto antes del arco de cada línea (exacto);
- tablas de 4096 entradas para el seno del campo y para x^3,2 (error < 3e-7).
