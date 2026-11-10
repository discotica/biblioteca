/**
 * Dónde corre el pulso (U27, §4). Mismo contrato para los dos caminos:
 * - `motorTrabajador`: el canvas se cede a un worker (OffscreenCanvas) y el hilo
 *   principal solo reenvía puntero, tamaño y pausa. Es el camino normal.
 * - `motorLocal`: todo en el hilo principal. Para el fotograma fijo (movimiento
 *   reducido, Save-Data, segunda instancia) y donde no hay OffscreenCanvas.
 */
import { crearPulso, type OpcionesPulso, type Pulso } from './pulso.ts';
import type { MensajeAlTrabajador, MensajeDelTrabajador } from './pulso.trabajador.ts';

export type MotorPulso = {
  tamano(ancho: number, alto: number, dpr: number): void;
  apuntar(x: number, y: number): void;
  /** Arranca o pausa. Con `fijo`, al pausar deja el fotograma fijo. */
  correr(si: boolean, fijo?: boolean): void;
  cerrar(): void;
};

export const admiteTrabajador = (canvas: HTMLCanvasElement) =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'transferControlToOffscreen' in canvas;

export function motorLocal(canvas: HTMLCanvasElement, opciones: OpcionesPulso, alMedir: (ms: number) => void): MotorPulso {
  const ctx = canvas.getContext('2d', { alpha: false });
  let pulso: Pulso | null = null;
  let raf = 0, ultimo = 0, saltar = false, cuadros = 0;

  const cuadro = (ahora: number) => {
    raf = requestAnimationFrame(cuadro);
    if (!pulso) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000);
    if (pulso.energia < 0.02 && (saltar = !saltar)) return; // en reposo basta con 30 cps
    ultimo = ahora;
    pulso.paso(dt);
    if (++cuadros % 30 === 0) alMedir(pulso.ms);
  };

  return {
    tamano(ancho, alto, dpr) {
      if (!ctx || !ancho || !alto) return;
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pulso = crearPulso(ctx, ancho, alto, opciones);
      pulso.fijo();
    },
    apuntar(x, y) {
      pulso?.apuntar(x, y);
    },
    correr(si, fijo) {
      if (si && !raf) {
        ultimo = performance.now();
        raf = requestAnimationFrame(cuadro);
      } else if (!si) {
        cancelAnimationFrame(raf);
        raf = 0;
        if (fijo) pulso?.fijo();
      }
    },
    cerrar() {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

export function motorTrabajador(canvas: HTMLCanvasElement, opciones: OpcionesPulso, alMedir: (ms: number) => void): MotorPulso {
  const trabajador = new Worker(new URL('./pulso.trabajador.ts', import.meta.url), { type: 'module', name: 'campo-pulso' });
  const enviar = (m: MensajeAlTrabajador, transferir: Transferable[] = []) => trabajador.postMessage(m, transferir);
  trabajador.onmessage = ({ data }: MessageEvent<MensajeDelTrabajador>) => {
    if (data.tipo === 'ms') alMedir(data.ms);
  };
  let lienzo: OffscreenCanvas | null = canvas.transferControlToOffscreen();

  return {
    tamano(ancho, alto, dpr) {
      if (!ancho || !alto) return;
      if (lienzo) {
        enviar({ tipo: 'iniciar', lienzo, ancho, alto, dpr, opciones: { ...opciones } }, [lienzo]);
        lienzo = null;
      } else enviar({ tipo: 'tamano', ancho, alto, dpr });
    },
    apuntar(x, y) {
      enviar({ tipo: 'apuntar', x, y });
    },
    correr(si, fijo) {
      enviar({ tipo: 'correr', activo: si, fijo });
    },
    cerrar() {
      trabajador.terminate();
    }
  };
}
