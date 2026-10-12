// U4: el lint de tokens rechaza literales nuevos y respeta la lista temporal de excepciones.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkDeclaration, checkQuery, lintSource } from '../scripts/lint-tokens.mjs';

const script = path.resolve('scripts/lint-tokens.mjs');
const rules = (findings) => findings.map((f) => `${f.rule} ${f.value}`);

test('colores literales: hex, funciones, color-mix y nombres', () => {
  assert.deepEqual(rules(checkDeclaration('color', '#96F719')), ['color #96f719']);
  assert.deepEqual(rules(checkDeclaration('border', '1px solid rgba(255, 255, 255, .1)')), ['color rgba(255,255,255,.1)']);
  assert.deepEqual(rules(checkDeclaration('background', 'color-mix(in srgb, var(--color-acento) 10%, transparent)')), ['color color-mix()']);
  assert.deepEqual(rules(checkDeclaration('background', 'white')), ['color white']);
  assert.deepEqual(rules(checkDeclaration('--mi-color', '#fff')), ['color #fff']);
  assert.deepEqual(checkDeclaration('color', 'var(--color-texto-tenue)'), []);
  assert.deepEqual(checkDeclaration('white-space', 'nowrap'), []);
  assert.deepEqual(checkDeclaration('background', 'transparent'), []);
});

test('tamaños de fuente: solo tokens', () => {
  assert.deepEqual(rules(checkDeclaration('font-size', '.72rem')), ['font-size .72rem']);
  assert.deepEqual(rules(checkDeclaration('font-size', 'clamp(1rem, 2vw, 2rem)')), ['font-size clamp(1rem, 2vw, 2rem)']);
  assert.deepEqual(rules(checkDeclaration('font', '700 11px/1 var(--font-ui)')), ['font-size 11px']);
  assert.deepEqual(checkDeclaration('font-size', 'var(--text-2xs)'), []);
  assert.deepEqual(checkDeclaration('font', 'var(--nav-font-weight) var(--nav-font-size)/1 var(--font-ui)'), []);
  assert.deepEqual(checkDeclaration('font', 'inherit'), []);
});

test('radios: escala, pill y círculo', () => {
  assert.deepEqual(rules(checkDeclaration('border-radius', '7px')), ['radius 7px']);
  assert.deepEqual(rules(checkDeclaration('border-top-left-radius', '0 12px')), ['radius 12px']);
  assert.deepEqual(checkDeclaration('border-radius', '0 0 var(--radius-base) var(--radius-base)'), []);
  assert.deepEqual(checkDeclaration('border-radius', '50%'), []);
});

test('breakpoints: solo la escala (y N−1 en max-width)', () => {
  assert.deepEqual(checkQuery('(max-width: 768px)'), []);
  assert.deepEqual(checkQuery('(max-width: 767px)'), []);
  assert.deepEqual(checkQuery('(min-width: 1024px) and (max-width: 1279px)'), []);
  assert.deepEqual(rules(checkQuery('(max-width: 860px)')), ['breakpoint max-width:860px']);
  assert.deepEqual(rules(checkQuery('(min-width: 767px)')), ['breakpoint min-width:767px']);
  assert.deepEqual(rules(checkQuery('(max-width: 40em)')), ['breakpoint max-width:40em']);
});

test('Svelte: estilos, atributos de estilo, SVG y matchMedia', () => {
  const source = [
    '<script>const q = window.matchMedia("(max-width: 900px)");</script>',
    '<svg><path fill="#96f719" /><text font-size="7">A</text></svg>',
    '<p style="color: #fff">x</p>',
    '<style>',
    '  /* color: #000 en comentario no cuenta */',
    '  .a { color: var(--color-texto); border-radius: 6px; }',
    '  @media (max-width: 620px) { .a { font-size: 12px; } }',
    '</style>'
  ].join('\n');
  assert.deepEqual(
    lintSource('src/x.svelte', source).map((f) => `${f.line} ${f.rule} ${f.value}`).sort(),
    ['1 breakpoint max-width:900px', '2 color #96f719', '2 font-size font-size="7"', '3 color #fff', '6 radius 6px', '7 breakpoint max-width:620px', '7 font-size 12px']
  );
});

function fixture(files, exceptions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-lint-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  const exceptionsPath = path.join(dir, 'exceptions.json');
  fs.writeFileSync(exceptionsPath, JSON.stringify(exceptions ?? {}));
  const run = (...extra) => spawnSync(process.execPath, [script, '--root', dir, '--exceptions', exceptionsPath, ...extra], { encoding: 'utf8' });
  return { dir, exceptionsPath, run };
}

test('falla con un literal nuevo y pasa con tokens; tokens.css queda fuera', () => {
  const ok = fixture({
    'src/lib/styles/tokens.css': ':root { --color-texto: #f8ffee; --text-md: 1rem; }',
    'src/lib/A.svelte': '<style>.a { color: var(--color-texto); }</style>'
  });
  assert.equal(ok.run().status, 0);

  fs.writeFileSync(path.join(ok.dir, 'src/lib/A.svelte'), '<style>.a { color: #f8ffee; }</style>');
  const failed = ok.run();
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /src\/lib\/A\.svelte:1 {2}color {2}#f8ffee/);
});

test('las excepciones toleran lo listado, no un literal más, y --prune solo reduce', () => {
  const entry = { rule: 'radius', value: '6px', count: 1, motivo: 'prueba', etapa: 'U5' };
  const fx = fixture({ 'src/B.svelte': '<style>.b { border-radius: 6px; }</style>' }, { 'src/B.svelte': [entry] });
  assert.equal(fx.run().status, 0);

  fs.writeFileSync(path.join(fx.dir, 'src/B.svelte'), '<style>.b { border-radius: 6px; } .c { border-radius: 6px; }</style>');
  assert.equal(fx.run().status, 1, 'una segunda aparición del mismo literal falla');

  fs.writeFileSync(path.join(fx.dir, 'src/B.svelte'), '<style>.b { border-radius: var(--radius-sm); }</style>');
  const stale = fx.run();
  assert.equal(stale.status, 0);
  assert.match(stale.stderr, /excepción sobrante/);
  assert.equal(fx.run('--prune').status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(fx.exceptionsPath, 'utf8')), {});
});
