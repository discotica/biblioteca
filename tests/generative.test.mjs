import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fnv1a, prng, semillaDe, normalizarNombre } from '../src/lib/generative/semilla.ts';
import {
  huella,
  puntosHuella,
  tonosDe,
  firma,
  FONDO,
  ROL_ADMIN,
  RADIO_MIN,
  RADIO_MAX,
  ALFA_MASCARA
} from '../src/lib/generative/huella.ts';

// U27: motor generativo. Determinismo de la semilla, la huella y el tono.

const NOMBRES = ['comunidad', 'laura_rios', 'pachanga', 'nina_808', 'colaboradora', 'jmamanche', 'Para abrir el set', 'TraTraTrax', 'Nicola Cruz', 'Ñandú', 'a', 'b', 'ab', 'ba'];
const huellaDe = (nombre, rol = 'usuario') => puntosHuella(840, 840, { nombre, rol, paso: 28 });

function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}

test('U27 semilla: FNV-1a de 32 bits con los vectores de referencia', () => {
  assert.equal(fnv1a(''), 0x811c9dc5);
  assert.equal(fnv1a('a'), 0xe40c292c);
  assert.equal(fnv1a('foobar'), 0xbf9cf968);
});

test('U27 semilla: el nombre se normaliza antes de sembrar', () => {
  assert.equal(normalizarNombre('  Comunidad '), 'comunidad');
  assert.equal(semillaDe('  Comunidad '), semillaDe('comunidad'));
  // NFC: «ñ» compuesta y descompuesta dan la misma semilla.
  assert.equal(semillaDe('ñandu'), semillaDe('ñandu'));
});

test('U27 PRNG: misma semilla, misma secuencia en [0, 1)', () => {
  const a = prng(42), b = prng(42), c = prng(43);
  const sa = Array.from({ length: 64 }, a), sb = Array.from({ length: 64 }, b), sc = Array.from({ length: 64 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const v of sa) assert.ok(v >= 0 && v < 1);
});

test('U27 huella: el mismo nombre da los mismos puntos y el mismo tono', () => {
  for (const nombre of NOMBRES) {
    assert.equal(firma(huellaDe(nombre)), firma(huellaDe(nombre)), nombre);
    assert.deepEqual(tonosDe(nombre, 'usuario'), tonosDe(nombre, 'usuario'), nombre);
    assert.deepEqual(tonosDe(nombre, 'admin'), tonosDe(nombre, 'admin'), nombre);
  }
});

test('U27 huella: nombres distintos dan huellas distintas', () => {
  const firmas = new Set(NOMBRES.map((n) => firma(huellaDe(n))));
  assert.equal(firmas.size, NOMBRES.length);
});

test('U27 tonos: el tono se reparte por toda la gama', () => {
  // Dos nombres pueden caer en el mismo tono (la gama es continua y el color se
  // redondea a 8 bits); la forma ya los distingue. Lo que importa es el reparto.
  const tonos = Array.from({ length: 200 }, (_, i) => hsl(tonosDe(`usuario_${i}`, 'usuario')[1]).h);
  assert.ok(Math.min(...tonos) < 76 && Math.max(...tonos) > 156, `${Math.min(...tonos)}…${Math.max(...tonos)}`);
  assert.ok(new Set(tonos.map((h) => Math.round(h))).size > 60);
});

test('U27 huella: la forma no depende del rol; el rol solo cambia el color', () => {
  assert.equal(firma(huellaDe('jmamanche', 'admin')), firma(huellaDe('jmamanche', 'usuario')));
  assert.notDeepEqual(tonosDe('jmamanche', 'admin'), tonosDe('jmamanche', 'usuario'));
});

test('U27 huella: regresión, la huella de «comunidad» no cambia sin querer', () => {
  // Si cambia a propósito (otro campo, otro paso), todos los avatares cambian: actualiza el valor y dilo en el cambio.
  assert.equal(firma(huellaDe('comunidad')), 1832687110);
});

test('U27 huella: rejilla centrada y radio entre 0,06 y 0,47 del paso', () => {
  const paso = 24;
  const p = puntosHuella(2880, 800, { nombre: 'Para abrir el set', paso });
  assert.equal(p.length / 4, 120 * 33);
  let min = Infinity, max = 0;
  for (let k = 0; k < p.length; k += 4) {
    min = Math.min(min, p[k + 2]);
    max = Math.max(max, p[k + 2]);
    assert.ok([0, 1, 2].includes(p[k + 3]));
  }
  assert.ok(min >= paso * RADIO_MIN - 1e-6 && max <= paso * RADIO_MAX + 1e-6, `${min}…${max}`);
  // Hay contraste: puntos mínimos en el borde y manchas que llegan arriba.
  assert.ok(max > paso * 0.4, `max ${max}`);
  assert.equal(p[0], (2880 - 120 * paso) / 2 + paso / 2);
});

test('U27 tonos: verdes para usuarios, grises para colaboradores y morado de admin', () => {
  for (const nombre of NOMBRES) {
    const u = tonosDe(nombre, 'usuario').map(hsl);
    const c = tonosDe(nombre, 'colaborador').map(hsl);
    const a = tonosDe(nombre, 'admin').map(hsl);
    for (const t of u) assert.ok(t.h >= 64 && t.h <= 168 && t.s > 0.5, `${nombre} usuario ${JSON.stringify(t)}`);
    for (const t of c) assert.ok(t.s < 0.08, `${nombre} colaborador ${JSON.stringify(t)}`);
    for (const t of a) assert.ok(Math.abs(t.h - hsl(ROL_ADMIN).h) <= 13, `${nombre} admin ${JSON.stringify(t)}`);
    // De oscuro a claro.
    for (const g of [u, c, a]) assert.ok(g[0].l < g[1].l && g[1].l < g[2].l, nombre);
  }
});

test('U27 tonos: FONDO y ROL_ADMIN son los de tokens.css', () => {
  const tokens = fs.readFileSync(new URL('../src/lib/styles/tokens.css', import.meta.url), 'utf8');
  assert.match(tokens, new RegExp(`--color-fondo:\\s*${FONDO};`, 'i'));
  assert.match(tokens, new RegExp(`--color-rol-admin:\\s*${ROL_ADMIN};`, 'i'));
});

function contextoFalso() {
  const ops = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect: (...a) => ops.push(['fillRect', ctx.fillStyle, ...a]),
    clearRect: (...a) => ops.push(['clearRect', ...a]),
    beginPath: () => {},
    moveTo: () => {},
    arc: () => ops.push(['arc']),
    fill: () => ops.push(['fill', ctx.fillStyle, ctx.globalAlpha])
  };
  return { ctx, ops };
}

test('U27 huella(): pinta cada punto una vez, en su banda y sobre el fondo', () => {
  const { ctx, ops } = contextoFalso();
  huella(ctx, 192, 192, { nombre: 'comunidad', celdas: 11 });
  assert.deepEqual(ops[0], ['fillRect', FONDO, 0, 0, 192, 192]);
  assert.equal(ops.filter((o) => o[0] === 'arc').length, 11 * 11);
  assert.deepEqual(ops.filter((o) => o[0] === 'fill').map((o) => o[1]), [...tonosDe('comunidad')]);
});

test('U27 huella(): en modo máscara, blanco sobre transparente con opacidad por banda', () => {
  const { ctx, ops } = contextoFalso();
  huella(ctx, 400, 100, { nombre: 'comunidad', mascara: true });
  assert.equal(ops[0][0], 'clearRect');
  const fills = ops.filter((o) => o[0] === 'fill');
  assert.deepEqual(fills.map((o) => o[1]), ['#ffffff', '#ffffff', '#ffffff']);
  assert.deepEqual(fills.map((o) => o[2]), [...ALFA_MASCARA]);
  assert.equal(ctx.globalAlpha, 1);
});

// ---- Pulso (A2) ---------------------------------------------------------------

const { crearPulso, seno, potencia32, T_FIJO } = await import('../src/lib/generative/pulso.ts');

test('U27 pulso: las tablas de seno y x^3.2 no se notan (error < 3e-7 y < 1e-6)', () => {
  let es = 0, ep = 0;
  for (let x = -50; x <= 50; x += 0.0137) es = Math.max(es, Math.abs(seno(x) - Math.sin(x)));
  for (let x = 0; x <= 1; x += 0.00031) ep = Math.max(ep, Math.abs(potencia32(x) - Math.pow(x, 3.2)));
  assert.ok(es < 3e-7, `seno ${es}`);
  assert.ok(ep < 1e-6, `potencia ${ep}`);
});

function pulsoGrabado(pasos) {
  const arcos = [];
  const ctx = { fillStyle: '', setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, arc: (x, y, r) => arcos.push(x, y, r), fill() {} };
  const p = crearPulso(ctx, 1440, 900, {});
  pasos(p);
  return arcos;
}

test('U27 pulso: misma semilla y mismo recorrido, mismo campo', () => {
  const recorrido = (p) => {
    for (let n = 0; n < 120; n++) {
      if (n > 40) p.apuntar(0.3 + n / 400, 0.5);
      p.paso(1 / 60);
    }
  };
  const a = pulsoGrabado(recorrido), b = pulsoGrabado(recorrido);
  assert.ok(a.length > 1000);
  assert.deepEqual(a, b);
});

test('U27 pulso: el fotograma fijo es siempre el mismo y se dibuja en t = 20', () => {
  assert.equal(T_FIJO, 20);
  const a = pulsoGrabado((p) => p.fijo());
  assert.ok(a.length > 0);
  // Radio de punto 0.6 + 4.9·v: entre 0,6 y 5,5 px.
  for (let k = 2; k < a.length; k += 3) assert.ok(a[k] >= 0.6 && a[k] <= 5.5 + 1e-9);
  assert.equal(firmaArcos(a), firmaArcos(pulsoGrabado((p) => p.fijo())));
});

function firmaArcos(arcos) {
  return arcos.map((v) => Math.round(v * 1000)).join(',');
}
