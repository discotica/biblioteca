<script lang="ts">
  import { huella, RADIO_MIN, TONOS_GRISES } from '$lib/generative';

  type Props = {
    /**
     * Nombre que siembra la huella: el usuario que se está escribiendo. Vacío
     * es la cuadrícula en cero del tablero K: puntos iguales, grises y sin forma.
     */
    nombre?: string;
    /** Revela el color de la gama de usuario (verdes). Sin él, la huella va gris. */
    color?: boolean;
    /** Segundos de un latido lento. 0 la deja quieta. */
    latido?: number;
    /** Velo de lectura bajo el texto de la página (Entrar). */
    velo?: boolean;
  };

  let { nombre = '', color = false, latido = 0, velo = false }: Props = $props();

  /** Paso de la rejilla en px CSS (24 en el lienzo a 2×) y escala de dibujo. */
  const PASO = 12;
  const ESCALA = 2;

  let ancho = $state(0);
  let alto = $state(0);
  let gris = $state<HTMLCanvasElement>();
  let tinta = $state<HTMLCanvasElement>();

  const semilla = $derived(nombre.trim());

  /** La cuadrícula en cero: la rejilla de la huella con todos los puntos del mismo radio. */
  function cuadriculaEnCero(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const paso = PASO * ESCALA;
    const cols = Math.max(1, Math.floor(w / paso)), filas = Math.max(1, Math.floor(h / paso));
    const x0 = (w - cols * paso) / 2 + paso / 2, y0 = (h - filas * paso) / 2 + paso / 2;
    ctx.fillStyle = TONOS_GRISES[1];
    ctx.beginPath();
    for (let j = 0; j < filas; j++) {
      for (let i = 0; i < cols; i++) {
        const x = x0 + i * paso, y = y0 + j * paso;
        ctx.moveTo(x + paso * (RADIO_MIN + 0.03), y);
        ctx.arc(x, y, paso * (RADIO_MIN + 0.03), 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  function dibujar(lienzo: HTMLCanvasElement, grises: boolean) {
    const w = Math.round(ancho * ESCALA), h = Math.round(alto * ESCALA);
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;
    if (!semilla) return cuadriculaEnCero(ctx, w, h);
    huella(ctx, w, h, { nombre: semilla, rol: 'usuario', paso: PASO * ESCALA, fondo: null, ...(grises ? { tonos: TONOS_GRISES } : {}) });
  }

  // Cada tecla del usuario cambia la semilla y reorganiza los puntos.
  $effect(() => {
    if (gris && ancho && alto) dibujar(gris, true);
  });

  // El color solo se dibuja cuando se va a revelar.
  $effect(() => {
    if (tinta && ancho && alto && color) dibujar(tinta, false);
  });
</script>

<!--
  Fondo de las pantallas de acceso (U30, tableros E, K y M): la huella de
  U27 a toda la ventana, gris al empezar y con el color del nombre cuando
  la cuenta ya tiene forma. Fijo y detrás del contenido, para que el primer
  hijo de <main> siga siendo el contenedor del sistema.
-->
<div class="acceso-fondo" class:acceso-fondo--color={color} aria-hidden="true" bind:clientWidth={ancho} bind:clientHeight={alto}>
  <div class="acceso-fondo__lienzos" class:acceso-fondo__lienzos--late={latido > 0} style:--latido="{latido}s">
    <canvas class="acceso-fondo__gris" bind:this={gris}></canvas>
    <canvas class="acceso-fondo__tinta" bind:this={tinta}></canvas>
  </div>
  {#if velo}<div class="acceso-fondo__velo"></div>{/if}
</div>

<style>
  .acceso-fondo {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .acceso-fondo__lienzos,
  .acceso-fondo__velo {
    position: absolute;
    inset: 0;
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transition: opacity var(--acceso-revela) ease;
  }
  .acceso-fondo__tinta { opacity: 0; }
  .acceso-fondo--color .acceso-fondo__gris { opacity: 0; }
  .acceso-fondo--color .acceso-fondo__tinta { opacity: 1; }

  .acceso-fondo__lienzos--late { animation: acceso-late var(--latido) ease-in-out infinite alternate; }
  @keyframes acceso-late {
    from { opacity: 0.78; }
    to { opacity: 1; }
  }

  .acceso-fondo__velo { background: var(--acceso-velo); }
  @media (max-width: 767px) {
    .acceso-fondo__velo { background: var(--acceso-velo-movil); }
  }

  @media (prefers-reduced-motion: reduce) {
    canvas { transition: none; }
    .acceso-fondo__lienzos--late { animation: none; }
  }
</style>
