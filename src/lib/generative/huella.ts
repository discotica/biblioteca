/**
 * Huella: la retícula de puntos que deja un nombre (U27, plan de dirección de
 * arte §4, tablero B). Rejilla de paso fijo y radio de 0,06 a 0,47 del paso
 * según un campo continuo sembrado con el nombre (`campoDe`), con borde suave.
 *
 * Todo es puro salvo `huella()`, que pinta en un contexto 2D que le pasan.
 */
import { fnv1a, prng, semillaDe } from './semilla.ts';

export type Rol = 'usuario' | 'colaborador' | 'admin';
/** Tres tonos de la gama: [oscuro, medio, claro]. */
export type Tonos = readonly [string, string, string];

/** Espejo de los tokens --color-fondo y --color-rol-admin (tokens.css). Una prueba los mantiene iguales. */
export const FONDO = '#0e0e0e';
export const ROL_ADMIN = '#682cc6';

/** Gama sin tono, para la huella antes de revelar el color (onboarding, tablero K). */
export const TONOS_GRISES: Tonos = ['#3a3b38', '#6b6c69', '#a4a5a1'];

export const RADIO_MIN = 0.06;
export const RADIO_MAX = 0.47;
export const GANANCIA = 2.1;
/** Valor del campo lejos de toda mancha: los puntos mínimos del fondo. */
export const FONDO_CAMPO = 0.05;
/** Opacidad de cada banda en modo máscara: los puntos chicos dejan ver menos portada. */
export const ALFA_MASCARA = [0.75, 0.9, 1] as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function hsl(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

/** Tono del nombre en [0, 1): un flujo distinto al de la forma. */
const tonoDe = (nombre: string) => prng(semillaDe(nombre) ^ 0x9e3779b9)();

/**
 * Tres colores de la gama del rol, con el tono exacto derivado del nombre:
 * - usuario: verdes, de lima (66°) a agua (166°);
 * - colaborador: grises, con un matiz apenas perceptible;
 * - admin: ±12° alrededor de --color-rol-admin (263°).
 */
export function tonosDe(nombre: string, rol: Rol = 'usuario'): Tonos {
  const u = tonoDe(nombre);
  if (rol === 'colaborador') {
    const h = 40 + u * 200;
    return [hsl(h, 3, 27), hsl(h, 4, 56), hsl(h, 6, 90)];
  }
  if (rol === 'admin') {
    const h = 263 + (u - 0.5) * 24;
    return [hsl(h, 46, 30), hsl(h, 62, 55), hsl(h, 78, 77)];
  }
  const h = 66 + u * 100;
  return [hsl(h, 52, 25), hsl(h, 60, 44), hsl(h, 74, 68)];
}

// ---------------------------------------------------------------------------
// Campo

type Mancha = { x: number; y: number; a: number; c: number; s: number; ix: number; iy: number };

export type Campo = (x: number, y: number) => number;

/**
 * Campo continuo de un nombre en coordenadas de lienzo, en [0, 1].
 *
 * Dos o tres manchas gaussianas sembradas (centro, tamaño, alargamiento, giro y
 * peso), sobre un fondo de 0,05, con el dominio ondulado por dos senos para que
 * los bordes no sean elipses. Cada mancha lleva un halo de la misma forma y
 * GANANCIA veces más ancho: es el borde suave que llena de puntos medianos el
 * contorno, como en el tablero B.
 *
 * La escala se mide sobre √(w·h): un avatar y una huella grande del mismo nombre
 * comparten composición, y una cenefa ancha reparte las manchas a lo largo.
 * Dos o tres manchas en un cuadrado; en formatos más anchos que 2:1, una más.
 */
export function campoDe(nombre: string, w: number, h: number): Campo {
  const r = prng(semillaDe(nombre));
  const lado = Math.sqrt(w * h), nw = w / lado, nh = h / lado;
  const manchas: Mancha[] = [];
  // En formatos anchos (cenefas) las manchas se achican hacia el lado menor y
  // hay una más, como en F y G2. En un cuadrado no cambia nada.
  const encoge = Math.min(w, h) / lado;
  const n = 2 + Math.floor(r() * 2) + (Math.max(w, h) / Math.min(w, h) > 2 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const giro = r() * Math.PI, alarga = 1 + r() * 0.9, sigma = (0.07 + r() * 0.06) * encoge;
    const sx = sigma * alarga, sy = (sigma / alarga) * 1.2;
    manchas.push({
      x: (0.12 + r() * 0.76) * nw,
      y: (0.12 + r() * 0.76) * nh,
      a: 0.4 + r() * 0.6,
      c: Math.cos(giro),
      s: Math.sin(giro),
      ix: 1 / (2 * sx * sx),
      iy: 1 / (2 * sy * sy)
    });
  }
  const o1 = 0.05 + r() * 0.06, f1 = 4 + r() * 5, p1 = r() * Math.PI * 2;
  const o2 = 0.05 + r() * 0.06, f2 = 4 + r() * 5, p2 = r() * Math.PI * 2;
  const halo = 1 / (GANANCIA * GANANCIA);
  return (px, py) => {
    const x0 = px / lado, y0 = py / lado;
    const x = x0 + o1 * Math.sin(y0 * f1 + p1), y = y0 + o2 * Math.sin(x0 * f2 + p2);
    let nucleo = 0, borde = 0;
    for (const m of manchas) {
      const dx = x - m.x, dy = y - m.y;
      const u = dx * m.c + dy * m.s, v = dy * m.c - dx * m.s;
      const q = u * u * m.ix + v * v * m.iy;
      nucleo += m.a * Math.exp(-q);
      borde += m.a * Math.exp(-q * halo);
    }
    return clamp01(FONDO_CAMPO + 0.95 * nucleo + 0.22 * borde);
  };
}

// ---------------------------------------------------------------------------
// Puntos

export type OpcionesHuella = {
  nombre: string;
  rol?: Rol;
  /** Paso de la rejilla en píxeles del lienzo. Por defecto 24. */
  paso?: number;
  /** Alternativa a `paso`: cuántas celdas caben en el lado menor. */
  celdas?: number;
  /** Ancho del borde suave, en celdas. */
  borde?: number;
  /** Sustituye la gama del rol (p. ej. TONOS_GRISES). */
  tonos?: Tonos;
  /** Color de fondo; `null` deja el lienzo transparente. Por defecto FONDO. */
  fondo?: string | null;
  /** Blanco sobre transparente, con la opacidad de ALFA_MASCARA por banda. Para `mask-image`. */
  mascara?: boolean;
};

const pasoDe = (w: number, h: number, op: Pick<OpcionesHuella, 'paso' | 'celdas'>) =>
  op.celdas ? Math.min(w, h) / op.celdas : (op.paso ?? 24);

/** Banda de tono de un valor del campo: 0 oscuro, 1 medio, 2 claro. */
export const bandaDe = (v: number) => (v < 0.36 ? 0 : v < 0.68 ? 1 : 2);

/**
 * Puntos de la huella como [x, y, radio, banda, …] en píxeles del lienzo.
 * Rejilla centrada; cada punto toma su radio del campo, atenuado cerca del borde.
 */
export function puntosHuella(w: number, h: number, op: OpcionesHuella): Float32Array {
  const paso = pasoDe(w, h, op);
  const cols = Math.max(1, Math.floor(w / paso)), filas = Math.max(1, Math.floor(h / paso));
  const x0 = (w - cols * paso) / 2 + paso / 2, y0 = (h - filas * paso) / 2 + paso / 2;
  const campo = campoDe(op.nombre, w, h);
  const borde = (op.borde ?? 1.5) * paso;
  const out = new Float32Array(cols * filas * 4);
  let k = 0;
  for (let j = 0; j < filas; j++) {
    const y = y0 + j * paso;
    for (let i = 0; i < cols; i++) {
      const x = x0 + i * paso;
      let v = campo(x, y);
      if (borde > 0) {
        const d = clamp01(Math.min(x, w - x, y, h - y) / borde);
        v *= d * d * (3 - 2 * d);
      }
      out[k++] = x;
      out[k++] = y;
      out[k++] = paso * (RADIO_MIN + (RADIO_MAX - RADIO_MIN) * v);
      out[k++] = bandaDe(v);
    }
  }
  return out;
}

/** Firma de un conjunto de puntos (FNV-1a sobre valores redondeados a milésimas). */
export function firma(puntos: Float32Array): number {
  let texto = '';
  for (let k = 0; k < puntos.length; k++) texto += Math.round(puntos[k] * 1000) + ',';
  return fnv1a(texto);
}

/** El contexto mínimo que usa `huella()`: lo cumple CanvasRenderingContext2D. */
export type Contexto2D = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'globalAlpha' | 'fillRect' | 'clearRect' | 'beginPath' | 'moveTo' | 'arc' | 'fill'
>;

/** Pinta la huella del nombre en `ctx`, sobre un lienzo de w×h píxeles. */
export function huella(ctx: Contexto2D, w: number, h: number, op: OpcionesHuella): void {
  const puntos = puntosHuella(w, h, op);
  const tonos = op.tonos ?? tonosDe(op.nombre, op.rol);
  const fondo = op.mascara ? null : op.fondo === undefined ? FONDO : op.fondo;
  ctx.globalAlpha = 1;
  if (fondo) {
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, w, h);
  } else ctx.clearRect(0, 0, w, h);
  for (let b = 0; b < 3; b++) {
    ctx.fillStyle = op.mascara ? '#ffffff' : tonos[b];
    ctx.globalAlpha = op.mascara ? ALFA_MASCARA[b] : 1;
    ctx.beginPath();
    for (let k = 0; k < puntos.length; k += 4) {
      if (puntos[k + 3] !== b) continue;
      const x = puntos[k], y = puntos[k + 1], r = puntos[k + 2];
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
