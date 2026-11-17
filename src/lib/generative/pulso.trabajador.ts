/**
 * Worker del campo de pulso (U27, §4). Dibuja en el OffscreenCanvas que le cede
 * CampoPulso.svelte, para que el hilo principal no pague el cuadro. Recibe el
 * puntero, el tamaño y si debe correr; devuelve el coste medio por cuadro.
 */
import { crearPulso, type OpcionesPulso, type Pulso } from './pulso.ts';

export type MensajeAlTrabajador =
  | { tipo: 'iniciar'; lienzo: OffscreenCanvas; ancho: number; alto: number; dpr: number; opciones: OpcionesPulso }
  | { tipo: 'tamano'; ancho: number; alto: number; dpr: number }
  | { tipo: 'apuntar'; x: number; y: number }
  /** `fijo`: al parar, deja el fotograma fijo (movimiento reducido). Sin él, solo pausa. */
  | { tipo: 'correr'; activo: boolean; fijo?: boolean };

export type MensajeDelTrabajador = { tipo: 'ms'; ms: number };

type Ambito = {
  onmessage: ((e: MessageEvent<MensajeAlTrabajador>) => void) | null;
  postMessage(m: MensajeDelTrabajador): void;
  requestAnimationFrame(f: (t: number) => void): number;
  cancelAnimationFrame(id: number): void;
};
const ambito = self as unknown as Ambito;

let lienzo: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let opciones: OpcionesPulso = {};
let pulso: Pulso | null = null;
let raf = 0, ultimo = 0, saltar = false, cuadros = 0;

function preparar(ancho: number, alto: number, dpr: number) {
  if (!lienzo || !ctx || !ancho || !alto) return;
  lienzo.width = Math.round(ancho * dpr);
  lienzo.height = Math.round(alto * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pulso = crearPulso(ctx as unknown as CanvasRenderingContext2D, ancho, alto, opciones);
  pulso.fijo();
}

function cuadro(ahora: number) {
  raf = ambito.requestAnimationFrame(cuadro);
  if (!pulso) return;
  const dt = Math.min(0.05, (ahora - ultimo) / 1000);
  if (pulso.energia < 0.02 && (saltar = !saltar)) return; // en reposo basta con 30 cps
  ultimo = ahora;
  pulso.paso(dt);
  if (++cuadros % 30 === 0) ambito.postMessage({ tipo: 'ms', ms: pulso.ms });
}

function correr(si: boolean) {
  if (si && !raf) {
    ultimo = performance.now();
    raf = ambito.requestAnimationFrame(cuadro);
  } else if (!si && raf) {
    ambito.cancelAnimationFrame(raf);
    raf = 0;
  }
}

ambito.onmessage = ({ data }) => {
  switch (data.tipo) {
    case 'iniciar':
      lienzo = data.lienzo;
      ctx = lienzo.getContext('2d', { alpha: false });
      opciones = data.opciones;
      preparar(data.ancho, data.alto, data.dpr);
      break;
    case 'tamano':
      preparar(data.ancho, data.alto, data.dpr);
      break;
    case 'apuntar':
      pulso?.apuntar(data.x, data.y);
      break;
    case 'correr':
      correr(data.activo);
      if (!data.activo && data.fijo) pulso?.fijo();
      break;
  }
};
