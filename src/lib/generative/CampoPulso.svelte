<script module lang="ts">
  /** La única instancia que anima en la pantalla (§2: una sola pieza viva). */
  let duena: symbol | null = null;

  /** DPR máximo del motor (§4). */
  export const DPR_MAX = 2;
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { OpcionesPulso } from './pulso.ts';
  import { admiteTrabajador, motorLocal, motorTrabajador, type MotorPulso } from './motorPulso.ts';

  type Props = {
    opciones?: OpcionesPulso;
    /** Fuerza el fotograma fijo, como con movimiento reducido. Se lee al montar. */
    fijo?: boolean;
    /** Media del coste por cuadro en ms (avanzar + dibujar), donde corra. Solo lectura. */
    ms?: number;
    class?: string;
  };

  let { opciones = {}, fijo = false, ms = $bindable(0), class: className = '' }: Props = $props();

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const yo = Symbol('campo');
    if (duena) {
      if (import.meta.env.DEV) console.warn('CampoPulso: ya hay un campo vivo en la pantalla; este queda en fotograma fijo.');
    } else duena = yo;

    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ahorro = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const siempreQuieto = fijo || ahorro || duena !== yo;
    const quieto = () => siempreQuieto || reducido.matches;

    // El fotograma fijo se dibuja en el hilo principal, al montar: sin worker ni
    // espera, como lo capturan las pruebas visuales. Lo vivo va a un worker si se puede.
    const alMedir = (valor: number) => (ms = valor);
    const motor: MotorPulso = !quieto() && admiteTrabajador(canvas) ? motorTrabajador(canvas, opciones, alMedir) : motorLocal(canvas, opciones, alMedir);

    let ancho = 0, alto = 0, visible = true, corriendo = false;
    let caja = canvas.getBoundingClientRect();

    const medir = () => {
      caja = canvas.getBoundingClientRect();
      const w = Math.round(caja.width), h = Math.round(caja.height);
      if (!w || !h || (w === ancho && h === alto)) return;
      ancho = w;
      alto = h;
      motor.tamano(w, h, Math.min(DPR_MAX, window.devicePixelRatio || 1));
    };
    const decidir = () => {
      const debe = !quieto() && visible && !document.hidden;
      if (debe !== corriendo) {
        corriendo = debe;
        motor.correr(debe, quieto());
      }
    };

    const mover = (e: PointerEvent) => {
      if (!corriendo) return;
      caja = canvas.getBoundingClientRect();
      const x = (e.clientX - caja.left) / caja.width, y = (e.clientY - caja.top) / caja.height;
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) motor.apuntar(x, y);
    };

    const tamano = new ResizeObserver(medir);
    const vista = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      decidir();
    });
    const alCambiarMovimiento = () => {
      // Al pasar a movimiento reducido, para y deja el fotograma fijo.
      if (quieto() && corriendo) {
        corriendo = false;
        motor.correr(false, true);
      } else decidir();
    };

    medir();
    tamano.observe(canvas);
    vista.observe(canvas);
    document.addEventListener('visibilitychange', decidir);
    reducido.addEventListener('change', alCambiarMovimiento);
    window.addEventListener('pointermove', mover, { passive: true });
    decidir();

    return () => {
      motor.cerrar();
      tamano.disconnect();
      vista.disconnect();
      document.removeEventListener('visibilitychange', decidir);
      reducido.removeEventListener('change', alCambiarMovimiento);
      window.removeEventListener('pointermove', mover);
      if (duena === yo) duena = null;
    };
  });
</script>

<!-- Campo de pulso (U27, §4, tablero A2). Decorativo: sin foco, sin eventos y fuera del árbol de accesibilidad. -->
<canvas class="ui-campo-pulso {className}" bind:this={canvas} aria-hidden="true"></canvas>

<style>
  .ui-campo-pulso {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background: var(--color-fondo);
  }
</style>
