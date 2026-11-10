/**
 * Pulso (U27, plan de dirección de arte §4, tablero A2 «late donde estuvo»).
 *
 * Port del `<script>` de PulsoB.dc.html sin cambios de comportamiento: campo
 * continuo sobre la rejilla, malla de desplazamiento de 48×27 que se empuja, se
 * difumina y vuelve sola, radio de punto 0.6 + 4.9·v, latido donde estuvo el
 * cursor y nodos que contagian «vida» a sus vecinos por las uniones.
 *
 * Diferencias con el tablero, todas de integración o de coste:
 * - el tamaño sale del lienzo (el tablero fijaba 1440×810);
 * - la frecuencia de cuadros, la pausa y el movimiento reducido los deciden
 *   CampoPulso.svelte y motorPulso.ts; aquí solo hay `paso(dt)` y `fijo()`;
 * - `ms` mide avanzar + dibujar (el tablero medía solo dibujar);
 * - el bucle de puntos recorta por distancia, usa tablas para el seno y x^3.2
 *   y gaussianas separables. Contra el script del tablero, en 806 cuadros con
 *   cursor, un solo punto cambia de escalón de color en un cuadro y ninguno se
 *   mueve más de 1e-5 px (docs/producto/u27-motor-generativo-2026-11-10.md).
 */
import { prng, semillaDe } from './semilla.ts';

export type OpcionesPulso = {
  /** Superficie: cuánto empuja el cursor (0–100). */
  fuerza?: number;
  bpm?: number;
  /** Tiempos por latido. */
  cada?: number;
  /** Nodos que laten solos. */
  islas?: number;
  /** Intensidad de las uniones entre nodos (0–100). */
  uniones?: number;
  /** Paso de la rejilla, en píxeles CSS. */
  paso?: number;
  /** Nombre que siembra el campo y los nodos. */
  semilla?: string;
};

export const PULSO_POR_DEFECTO: Required<OpcionesPulso> = {
  fuerza: 58,
  bpm: 96,
  cada: 4,
  islas: 4,
  uniones: 80,
  paso: 24,
  semilla: 'discotica'
};

/** Malla de desplazamiento (§4). */
const G = 48, F = 27, CELDAS = G * F;
/** Escalones de la paleta: gris → verde de marca → verde claro. */
const N = 12;
/** Espejo de --color-fondo y --color-acento (tokens.css). */
const FONDO = '#0e0e0e';
const GRIS: Rgb = [58, 61, 54], VERDE: Rgb = [150, 247, 25], CLARO: Rgb = [216, 255, 158];
/** Instante del fotograma fijo (movimiento reducido o Save-Data), como en el tablero. */
export const T_FIJO = 20;

type Rgb = [number, number, number];
const TAU = Math.PI * 2;
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Seno y x^3.2 por tabla con interpolación lineal: el bucle de dibujo los llama
 * miles de veces por cuadro. Error < 3e-7 en el seno y < 1e-7 en la potencia;
 * no cambia ningún punto de forma visible (prueba en tests/generative.test.mjs).
 */
const TABLA = 4096, PASO_SENO = TABLA / TAU;
const SENOS = new Float64Array(TABLA + 1), POTENCIAS = new Float64Array(TABLA + 1);
for (let i = 0; i <= TABLA; i++) {
  SENOS[i] = Math.sin((i / TABLA) * TAU);
  POTENCIAS[i] = Math.pow(i / TABLA, 3.2);
}
export function seno(x: number): number {
  let f = x * PASO_SENO;
  f -= Math.floor(f / TABLA) * TABLA;
  const i = f | 0;
  return SENOS[i] + (SENOS[i + 1] - SENOS[i]) * (f - i);
}
export function potencia32(x: number): number {
  const f = (x <= 0 ? 0 : x >= 1 ? 1 : x) * TABLA, i = Math.min(TABLA - 1, f | 0);
  return POTENCIAS[i] + (POTENCIAS[i + 1] - POTENCIAS[i]) * (f - i);
}

const PALETA = Array.from({ length: N }, (_, i) => {
  const v = i / (N - 1);
  const c = v < 0.55 ? mix(GRIS, VERDE, v / 0.55) : mix(VERDE, CLARO, (v - 0.55) / 0.45);
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
});

type Isla = { x0: number; y0: number; x: number; y: number; fase: number; f: number; a: number; lazo: number; viva: number; obj: number };
type Union = { a: number; b: number };
type Cursor = { x: number; y: number; px: number; py: number; tx: number; ty: number; vx: number; vy: number; fase: number; activo: number; ox: number; oy: number; lx: number; ly: number };
type Nodo = { ax: number; ay: number; nucleo: number; radio: number; ola: number; ancho: number };
type Linea = { ax: number; ay: number; vx: number; vy: number; l: number; i: number; v: number; sem: number; h: number; arco: number };

export type Pulso = {
  /** Lleva el cursor a (x, y), normalizados al lienzo (0–1). */
  apuntar(x: number, y: number): void;
  /** Avanza la simulación dt segundos (≤ 0,05) y dibuja. */
  paso(dt: number): void;
  /** Dibuja el fotograma fijo de reposo. */
  fijo(): void;
  /** Energía actual: por debajo de 0,02 el campo está en reposo. */
  readonly energia: number;
  /** Media móvil del coste de un cuadro (avanzar + dibujar), en ms. */
  readonly ms: number;
};

/**
 * Crea el pulso sobre un contexto ya escalado por el DPR: dibuja en píxeles CSS
 * dentro de W×H.
 */
export function crearPulso(ctx: CanvasRenderingContext2D, W: number, H: number, opciones: OpcionesPulso = {}): Pulso {
  const o = { ...PULSO_POR_DEFECTO, ...opciones };
  const r = prng(semillaDe(o.semilla));
  const asp = W / H, paso = o.paso;
  const cols = Math.ceil(W / paso) + 1, rows = Math.ceil(H / paso) + 1;
  const p = { a1: 2.2 + r() * 2.4, a2: 2 + r() * 2.6, a3: 3.4 + r() * 3.4, p1: r() * TAU, p2: r() * TAU, p3: r() * TAU, w1: 0.14 + r() * 0.16, w2: 0.14 + r() * 0.16, f1: 2 + r() * 2, f2: 2 + r() * 2 };
  // Campo del tablero con las constantes de cada cuadro precalculadas (ver `fase`).
  const k1 = p.f1 * 2, k2 = p.f2 * 2, k3 = p.a1 * 2, k4 = p.a2 * 2;
  let c1 = 0, c2 = 0, c3 = 0, c4 = 0, c5 = 0;
  const fase = (t: number) => {
    c1 = t * 0.07 + p.p2;
    c2 = -t * 0.05 + p.p1;
    c3 = p.p1 + t * 0.11;
    c4 = p.p2 - t * 0.09;
    c5 = p.p3 + t * 0.06;
  };
  const campo = (x: number, y: number) => {
    const u = x + p.w1 * seno(y * k1 + c1), v = y + p.w2 * seno(x * k2 + c2);
    return 0.5 + (seno(u * k3 + c3) + seno(v * k4 + c4) + 0.6 * seno((u + v) * p.a3 + c5)) / 5.2;
  };

  // Superficie: una malla gruesa de desplazamientos que se empuja, se difumina y vuelve sola a su sitio.
  const ganancia = (o.fuerza / 100) * 1.5;
  let dx = new Float32Array(CELDAS), dy = new Float32Array(CELDAS), qx = new Float32Array(CELDAS), qy = new Float32Array(CELDAS);
  let luz = new Float32Array(CELDAS), ql = new Float32Array(CELDAS);
  const alt = new Float32Array(CELDAS);
  const cursor: Cursor = { x: 0.62, y: 0.5, px: 0.62, py: 0.5, tx: 0.62, ty: 0.5, vx: 0, vy: 0, fase: 0, activo: 0, ox: 0.62, oy: 0.5, lx: 0.62, ly: 0.5 };
  const islas: Isla[] = Array.from({ length: o.islas }, () => ({ x0: 0.12 + r() * 0.76, y0: 0.14 + r() * 0.72, x: 0, y: 0, fase: r(), f: 0.82 + r() * 0.36, a: r() * TAU, lazo: 0, viva: 0, obj: 0 }));
  let E = 0, t = 0, ms = 16;

  // Los nodos guardan distancia entre sí; cada uno se une con sus dos vecinos más cercanos.
  islas.forEach((a, n) => {
    for (let k = 0; k < 40 && !islas.slice(0, n).every((b) => Math.hypot((a.x0 - b.x0) * asp, a.y0 - b.y0) > 0.42); k++) {
      a.x0 = 0.12 + r() * 0.76;
      a.y0 = 0.14 + r() * 0.72;
    }
  });
  const uniones: Union[] = [];
  islas.forEach((a, n) => {
    a.x = a.x0;
    a.y = a.y0;
    islas
      .map((b, m) => ({ m, d: Math.hypot((a.x0 - b.x0) * asp, a.y0 - b.y0) }))
      .filter((e) => e.m !== n)
      .sort((e, f) => e.d - f.d)
      .slice(0, 2)
      .forEach((e) => {
        if (!uniones.some((u) => (u.a === n && u.b === e.m) || (u.a === e.m && u.b === n))) uniones.push({ a: n, b: e.m });
      });
  });

  const compas = o.cada / (o.bpm / 60), w = Math.min(0.45, 1.1 / compas);

  // Gaussiana separable: exp(-(rx²+ry²)/2s²) = exp(-rx²/2s²)·exp(-ry²/2s²). Mismo resultado, 2N exp en vez de N².
  const gx = new Float32Array(G), gy = new Float32Array(F), rxs = new Float32Array(G), rys = new Float32Array(F);
  const empujar = (ax: number, ay: number, fx: number, fy: number, rad: number, s: number, dt: number, l = 0) => {
    const ci = (ax / asp) * (G - 1), cj = ay * (F - 1), alc = Math.ceil(s * 2.6 * (F - 1));
    const i0 = Math.max(0, Math.floor(ci - alc)), i1 = Math.min(G - 1, Math.ceil(ci + alc));
    const j0 = Math.max(0, Math.floor(cj - alc)), j1 = Math.min(F - 1, Math.ceil(cj + alc));
    const ss = 2 * s * s, kr = rad / s;
    for (let i = i0; i <= i1; i++) {
      const rx = (i / (G - 1)) * asp - ax;
      rxs[i] = rx;
      gx[i] = Math.exp(-(rx * rx) / ss);
    }
    for (let j = j0; j <= j1; j++) {
      const ry = j / (F - 1) - ay;
      rys[j] = ry;
      gy[j] = Math.exp(-(ry * ry) / ss);
    }
    for (let j = j0; j <= j1; j++) {
      const ry = rys[j], gj = gy[j];
      for (let i = i0; i <= i1; i++) {
        const g = gx[i] * gj, k = i + j * G;
        dx[k] += (fx * g + kr * rxs[i] * g) * dt;
        dy[k] += (fy * g + kr * ry * g) * dt;
        luz[k] += l * g * dt;
      }
    }
  };

  const relajar = (dt: number) => {
    const a = Math.min(0.24, dt * 9.9), caida = Math.exp(-dt / 2.64), apaga = Math.exp(-dt / 0.825);
    for (let j = 0; j < F; j++)
      for (let i = 0; i < G; i++) {
        const k = i + j * G, l = i ? k - 1 : k, d = i < G - 1 ? k + 1 : k, u = j ? k - G : k, b = j < F - 1 ? k + G : k;
        qx[k] = (dx[k] + a * (dx[l] + dx[d] + dx[u] + dx[b] - 4 * dx[k])) * caida;
        qy[k] = (dy[k] + a * (dy[l] + dy[d] + dy[u] + dy[b] - 4 * dy[k])) * caida;
        ql[k] = (luz[k] + a * (luz[l] + luz[d] + luz[u] + luz[b] - 4 * luz[k])) * apaga;
        alt[k] = (dx[d] - dx[l] + dy[b] - dy[u]) * 13;
      }
    [dx, qx] = [qx, dx];
    [dy, qy] = [qy, dy];
    [luz, ql] = [ql, luz];
  };

  const envolvente = (f: number, ancho: number) => {
    if (f >= ancho) return 0;
    const s = Math.sin(Math.PI * Math.pow(f / ancho, 0.7));
    return s * s;
  };

  const avanzar = (dt: number) => {
    const c = cursor;
    c.x += (c.tx - c.x) * Math.min(1, dt * 3.2);
    c.y += (c.ty - c.y) * Math.min(1, dt * 3.2);
    const h = Math.max(dt, 0.001), mx = ((c.x - c.px) * asp) / h, my = (c.y - c.py) / h, vel = Math.sqrt(mx * mx + my * my);
    c.px = c.x;
    c.py = c.y;
    c.vx += (mx - c.vx) * Math.min(1, dt * 4);
    c.vy += (my - c.vy) * Math.min(1, dt * 4);
    c.activo += (clamp(vel * 1.4) - c.activo) * Math.min(1, dt * (vel > 0.02 ? 2.5 : 0.6));
    // Cada latido fija su origen donde estaba el cursor; de ahí nace y ahí se queda.
    const previa = c.fase;
    c.fase = (c.fase + (dt / compas) * (1 + 0.35 * E)) % 1;
    if (c.fase < previa) {
      c.ox = c.x;
      c.oy = c.y;
    }
    c.lx += (c.ox - c.lx) * Math.min(1, dt * 2.2);
    c.ly += (c.oy - c.ly) * Math.min(1, dt * 2.2);
    E += (c.activo - E) * Math.min(1, dt * 1.4);
    const rapidez = Math.sqrt(c.vx * c.vx + c.vy * c.vy), tope = rapidez > 1.6 ? 1.6 / rapidez : 1, ax = c.x * asp, ay = c.y, ox = c.ox * asp, oy = c.oy;
    if (rapidez > 0.004) empujar(ax, ay, c.vx * tope * ganancia, c.vy * tope * ganancia, 0, 0.165, dt);
    const latido = envolvente(c.fase, w) * (0.1 + 0.9 * E);
    if (latido > 0.002) empujar(ox, oy, 0, 0, 0.18 * latido * (0.3 + ganancia * 0.5), 0.264, dt, 0.6 * latido);
    for (const s of islas) {
      s.x = s.x0 + 0.02 * Math.sin(t * 0.13 + s.a);
      s.y = s.y0 + 0.024 * Math.cos(t * 0.11 + s.a);
      const ix = s.x * asp, iy = s.y, vx = ix - ax, vy = iy - ay, d = Math.sqrt(vx * vx + vy * vy), obj = clamp(1.25 - d * 3.2) * clamp(E * 3);
      s.lazo += (obj - s.lazo) * Math.min(1, dt * (obj > s.lazo ? 1.6 : 0.5));
      let dif = c.fase - s.fase;
      dif -= Math.round(dif);
      s.fase = (s.fase + (dt / compas) * (s.f + (1 - s.f) * s.lazo) * (0.55 + 0.65 * s.viva) + (dt * 1.2 * s.lazo * Math.sin(TAU * dif)) / TAU + 1) % 1;
      const suyo = envolvente(s.fase, w);
      if (suyo > 0.002) empujar(ix, iy, 0, 0, 0.1 * suyo * (0.2 + 0.9 * s.viva), 0.22, dt);
      if (s.lazo > 0.1 && latido > 0.01)
        for (let u = 0.25; u < 1; u += 0.25)
          empujar(ax + vx * u, ay + vy * u, (vx / d) * 0.09 * s.lazo * latido, (vy / d) * 0.09 * s.lazo * latido, 0, 0.143, dt);
    }
    // El movimiento despierta: la vida de un nodo contagia a sus vecinos y se apaga despacio.
    for (const s of islas) s.obj = Math.max(s.lazo, E * 0.3);
    for (const u of uniones) {
      const A = islas[u.a], B = islas[u.b];
      A.obj = Math.max(A.obj, B.viva * 0.6);
      B.obj = Math.max(B.obj, A.viva * 0.6);
    }
    for (const s of islas) s.viva += (s.obj - s.viva) * Math.min(1, dt * (s.obj > s.viva ? 1.8 : 0.45));
    relajar(dt);
  };

  // Coordenadas de rejilla por columna y por fila: no cambian entre cuadros.
  const colX = new Float64Array(cols), colA = new Int32Array(cols), colF = new Float64Array(cols);
  for (let i = 0; i < cols; i++) {
    const x = i / (cols - 1), g = x * (G - 1), a = Math.min(G - 2, g | 0);
    colX[i] = x * asp;
    colA[i] = a;
    colF[i] = g - a;
  }
  const filaY = new Float64Array(rows), filaB = new Int32Array(rows), filaF = new Float64Array(rows);
  for (let j = 0; j < rows; j++) {
    const y = j / (rows - 1), g = y * (F - 1), b = Math.min(F - 2, g | 0);
    filaY[j] = y;
    filaB[j] = b;
    filaF[j] = g - b;
  }
  const lotes: number[][] = PALETA.map(() => []);

  const dibujar = () => {
    const c = cursor, un = o.uniones / 100;
    for (const l of lotes) l.length = 0;
    ctx.fillStyle = FONDO;
    ctx.fillRect(0, 0, W, H);
    const nodos: Nodo[] = islas.map((s) => {
      const f = s.fase / w, ola = f < 1 ? Math.pow(1 - f, 1.5) : 0, v = s.viva, env = envolvente(s.fase, w);
      return { ax: s.x * asp, ay: s.y, nucleo: 0.1 + 0.1 * v + env * (0.18 + 0.4 * v) + 0.1 * s.lazo, radio: Math.min(1, f) * (0.2 + 0.08 * v), ola: ola * (0.06 + 0.42 * v), ancho: 0.0033 - 0.0011 * v };
    });
    const fc = c.fase / w, fuerzaC = 0.1 + 0.9 * E;
    nodos.push({ ax: c.ox * asp, ay: c.oy, nucleo: 0.78 * envolvente(c.fase, w) * fuerzaC, radio: Math.min(1, fc) * 0.3, ola: (fc < 1 ? Math.pow(1 - fc, 1.5) : 0) * 0.58 * fuerzaC, ancho: 0.00218 });
    const lineas: Linea[] = [];
    const unir = (ax: number, ay: number, bx: number, by: number, i: number, fase: number, sem: number, v: number) => {
      if (i < 0.02) return;
      const vx = bx - ax, vy = by - ay;
      lineas.push({ ax, ay, vx, vy, l: Math.max(1e-5, vx * vx + vy * vy), i, v, sem, h: fase < w ? fase / w : -1, arco: 0.05 * Math.sin(t * 0.4 + sem) });
    };
    for (const u of uniones) {
      const A = islas[u.a], B = islas[u.b], v = Math.max(A.viva, B.viva);
      unir(A.x * asp, A.y, B.x * asp, B.y, un * (0.25 + 0.75 * v), A.fase, A.a + B.a, v);
    }
    for (const s of islas) unir(c.lx * asp, c.ly, s.x * asp, s.y, un * s.lazo, c.fase, s.a, s.lazo);

    fase(t);
    const respiro = 0.5 + 0.12 * Math.sin(t * 0.5), mezcla = 0.65 + 0.5 * E, desplaza = H * 0.16;
    // Recortes que no cambian el resultado (< 1e-6): el núcleo de un nodo pesa
    // exp(-d²/ancho) y se ignora pasado 14·ancho; su ola, pasado 3,5 anchos de
    // banda del anillo. Una línea se ignora si el punto cae fuera de su caja
    // ampliada por el arco (0,05) y el alcance (√0,0055).
    // Nodos y líneas en arreglos planos: el bucle de puntos solo lee números.
    const nn = nodos.length, nl = lineas.length;
    const nAx = new Float64Array(nn), nAy = new Float64Array(nn), nNuc = new Float64Array(nn), nAnc = new Float64Array(nn);
    const nOla = new Float64Array(nn), nRad = new Float64Array(nn), corte = new Float64Array(nn), ola0 = new Float64Array(nn), ola1 = new Float64Array(nn);
    for (let m = 0; m < nn; m++) {
      const n = nodos[m];
      nAx[m] = n.ax;
      nAy[m] = n.ay;
      nNuc[m] = n.nucleo;
      nAnc[m] = n.ancho;
      nOla[m] = n.ola;
      nRad[m] = n.radio;
      corte[m] = n.ancho * 14;
      const r0 = Math.max(0, n.radio - 0.1925), r1 = n.radio + 0.1925;
      ola0[m] = r0 * r0;
      ola1[m] = r1 * r1;
    }
    const caja = new Float64Array(nl * 4), margen = 0.05 + Math.sqrt(0.0055);
    const lAx = new Float64Array(nl), lAy = new Float64Array(nl), lVx = new Float64Array(nl), lVy = new Float64Array(nl), lL = new Float64Array(nl);
    const lArco = new Float64Array(nl), lTope = new Float64Array(nl);
    for (let m = 0; m < nl; m++) {
      const l = lineas[m], bx = l.ax + l.vx, by = l.ay + l.vy;
      caja[m * 4] = Math.min(l.ax, bx) - margen;
      caja[m * 4 + 1] = Math.max(l.ax, bx) + margen;
      caja[m * 4 + 2] = Math.min(l.ay, by) - margen;
      caja[m * 4 + 3] = Math.max(l.ay, by) + margen;
      lAx[m] = l.ax;
      lAy[m] = l.ay;
      lVx[m] = l.vx;
      lVy[m] = l.vy;
      lL[m] = l.l;
      lArco[m] = l.arco;
      // El arco desplaza el segmento a lo sumo |arco|: más lejos de (√0,0055 + |arco|) del segmento recto, no hay aporte.
      const tope = Math.sqrt(0.0055) + Math.abs(l.arco);
      lTope[m] = tope * tope;
    }
    const DX = dx, DY = dy, LUZ = luz, ALT = alt;
    for (let j = 0; j < rows; j++) {
      const y = filaY[j], gb = filaB[j], fb = filaF[j], kj = gb * G;
      for (let i = 0; i < cols; i++) {
        const X = colX[i], fa = colF[i], k = colA[i] + kj;
        // Pesos bilineales compartidos por las cuatro mallas.
        const w00 = (1 - fa) * (1 - fb), w10 = fa * (1 - fb), w01 = (1 - fa) * fb, w11 = fa * fb, k1 = k + 1, kG = k + G, kG1 = kG + 1;
        let ux = DX[k] * w00 + DX[k1] * w10 + DX[kG] * w01 + DX[kG1] * w11;
        let uy = DY[k] * w00 + DY[k1] * w10 + DY[kG] * w01 + DY[kG1] * w11;
        const blando = 1 / (1 + Math.sqrt(ux * ux + uy * uy) / 0.3);
        ux *= blando;
        uy *= blando;
        const Xs = X - ux, ys = y - uy;
        const onda = campo(Xs, ys);
        const reposo = potencia32(onda) * respiro;
        const relieve = Math.min(0.39, Math.abs(ALT[k] * w00 + ALT[k1] * w10 + ALT[kG] * w01 + ALT[kG1] * w11) * 0.22);
        const brillo = (LUZ[k] * w00 + LUZ[k1] * w10 + LUZ[kG] * w01 + LUZ[kG1] * w11) * (0.45 + onda);
        let red = 0;
        for (let m = 0; m < nn; m++) {
          const ex = Xs - nAx[m], ey = ys - nAy[m], d2 = ex * ex + ey * ey;
          if (d2 > 0.2) continue;
          if (d2 < corte[m]) red += nNuc[m] * Math.exp(-d2 / nAnc[m]);
          if (nOla[m] > 0.01 && d2 > ola0[m] && d2 < ola1[m]) {
            const q = (Math.sqrt(d2) - nRad[m]) / 0.055;
            red += nOla[m] * Math.exp(-q * q);
          }
        }
        for (let m = 0; m < nl; m++) {
          const c4 = m * 4;
          if (Xs < caja[c4] || Xs > caja[c4 + 1] || ys < caja[c4 + 2] || ys > caja[c4 + 3]) continue;
          const ax = lAx[m], ay = lAy[m], vx = lVx[m], vy = lVy[m];
          let u = ((Xs - ax) * vx + (ys - ay) * vy) / lL[m];
          u = u < 0 ? 0 : u > 1 ? 1 : u;
          const qx_ = Xs - (ax + vx * u), qr = ys - (ay + vy * u);
          if (qx_ * qx_ + qr * qr > lTope[m]) continue;
          const qy_ = qr - Math.sin(u * Math.PI) * lArco[m], ds = qx_ * qx_ + qy_ * qy_;
          if (ds > 0.0055) continue;
          const l = lineas[m];
          const zq = (u - l.h) / 0.154, z = l.h < 0 ? 0 : Math.exp(-zq * zq), parche = 0.5 + 0.5 * Math.sin(u * 7 + t * 0.6 + l.sem);
          red += l.i * Math.exp(-ds / 0.00075) * ((0.14 + 0.24 * l.v) * (0.35 + 0.65 * parche) + (0.4 + 0.5 * l.v) * z);
        }
        let v = reposo * mezcla + relieve * 0.9 + brillo + red;
        if (v < 0.03) continue;
        if (v > 1) v = 1;
        let b = (reposo * 0.5 + relieve + brillo * 0.9 + red) * N;
        b = b < 0 ? 0 : b >= N ? N - 1 : b | 0;
        lotes[b].push(i * paso + ux * desplaza, j * paso + uy * desplaza, 0.6 + 4.9 * v);
      }
    }
    for (let b = 0; b < N; b++) {
      const l = lotes[b];
      if (!l.length) continue;
      ctx.fillStyle = PALETA[b];
      ctx.beginPath();
      for (let k = 0; k < l.length; k += 3) {
        ctx.moveTo(l[k] + l[k + 2], l[k + 1]);
        ctx.arc(l[k], l[k + 1], l[k + 2], 0, TAU);
      }
      ctx.fill();
    }
  };

  return {
    apuntar(x, y) {
      cursor.tx = x;
      cursor.ty = y;
    },
    paso(dt) {
      const a = performance.now();
      t += dt;
      avanzar(dt);
      dibujar();
      ms = ms * 0.95 + (performance.now() - a) * 0.05;
    },
    fijo() {
      t = T_FIJO;
      dibujar();
    },
    get energia() {
      return E;
    },
    get ms() {
      return ms;
    }
  };
}
