#!/usr/bin/env node
// Lint de tokens (U4). Rechaza colores, tamaños de fuente, radios y breakpoints
// literales en componentes y estilos. Los valores viven solo en
// src/lib/styles/tokens.css. Reglas y excepciones: docs/modernizacion/u4-tokens-v2-2026-10-07.md
//
//   npm run lint:tokens                  falla con cualquier literal nuevo
//   npm run lint:tokens -- --prune       quita de las excepciones lo que ya se migró
//   node scripts/lint-tokens.mjs --root <dir> --exceptions <json>   (pruebas)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(option('--root', path.join(here, '..')));
const exceptionsPath = path.resolve(option('--exceptions', path.join(here, 'lint-tokens.exceptions.json')));
const TOKENS_FILE = 'src/lib/styles/tokens.css';
const BREAKPOINTS_FILE = 'src/lib/ui/breakpoints.ts';

/** Cortes de la escala; en max-width también N−1 para complementar un min-width N. */
const BREAKPOINTS = [480, 680, 768, 1024, 1280];
const ALLOWED_WIDTHS = new Set(BREAKPOINTS.flatMap((n) => [n, n - 1]));

const HINT = {
  color: 'usa un color de tokens.css (--color-*); si falta, añádelo allí',
  'font-size': 'usa la escala --text-2xs … --text-display',
  radius: 'usa --radius-xs/sm/base/lg o --radius-pill (50 % se admite para círculos)',
  breakpoint: `solo ${BREAKPOINTS.join(' · ')} px (o N−1 en max-width); en TS, importa $lib/ui/breakpoints`
};

// ---------------------------------------------------------------------------
// Recorrido

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(svelte|css|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

// ---------------------------------------------------------------------------
// Detección

const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]/i;
const NAMED_COLOR = /(^|[\s,(])(white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|cyan|magenta)(?=$|[\s,)!;])/i;
const COLOR_PROPS = /^(color|background|background-color|background-image|border|border-[a-z-]*|outline|outline-color|box-shadow|text-shadow|fill|stroke|stop-color|caret-color|accent-color|text-decoration|text-decoration-color|column-rule|column-rule-color|filter|scrollbar-color|--.*)$/;

/** Devuelve los literales prohibidos de una declaración CSS. */
export function checkDeclaration(prop, rawValue) {
  const value = rawValue.replace(/\s*!important\s*$/i, '').trim();
  const found = [];
  const lower = prop.toLowerCase();

  for (const hex of value.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) found.push({ rule: 'color', value: hex.toLowerCase() });
  for (const fn of value.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^()]*\)/gi) ?? []) {
    if (COLOR_FN.test(fn)) found.push({ rule: 'color', value: fn.replace(/\s+/g, '') });
  }
  if (/color-mix\(/i.test(value)) found.push({ rule: 'color', value: 'color-mix()' });
  if (COLOR_PROPS.test(lower)) {
    const named = value.match(NAMED_COLOR);
    if (named) found.push({ rule: 'color', value: named[2].toLowerCase() });
  }

  if (lower === 'font-size' && !/^(var\(--[\w-]+\)|inherit|initial|unset|revert|100%)$/.test(value)) {
    found.push({ rule: 'font-size', value });
  }
  if (lower === 'font') {
    const size = value.match(/(?:^|\s)(\d*\.?\d+(?:px|rem|em|%|vw|pt))(?=\s*\/|\s)/);
    if (size) found.push({ rule: 'font-size', value: size[1] });
  }

  if (/radius$/.test(lower)) {
    for (const len of value.replace(/var\([^)]*\)/g, '').match(/\d*\.?\d+(?:px|rem|em|%)/g) ?? []) {
      if (len !== '50%' && !/^0+(\.0+)?[a-z%]*$/.test(len)) found.push({ rule: 'radius', value: len });
    }
  }
  return found;
}

/** Literales de ancho en una consulta @media/@container o matchMedia. */
export function checkQuery(query) {
  const found = [];
  for (const m of query.matchAll(/(min|max)-width\s*:\s*(\d*\.?\d+)(px|rem|em)/g)) {
    const px = m[3] === 'px' ? Number(m[2]) : Number(m[2]) * 16;
    const ok = m[3] === 'px' && (m[1] === 'max' ? ALLOWED_WIDTHS.has(px) : BREAKPOINTS.includes(px));
    if (!ok) found.push({ rule: 'breakpoint', value: `${m[1]}-width:${m[2]}${m[3]}` });
  }
  for (const m of query.matchAll(/width\s*(?:<=?|>=?)\s*(\d*\.?\d+)(px|rem|em)/g)) {
    const px = m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16;
    if (!(m[2] === 'px' && ALLOWED_WIDTHS.has(px))) found.push({ rule: 'breakpoint', value: `width:${m[1]}${m[2]}` });
  }
  return found;
}

function lintCss(css, offset, source, report) {
  const masked = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  for (const m of masked.matchAll(/@(?:media|container)([^{]+)/g)) {
    for (const f of checkQuery(m[1])) report(f, offset + m.index);
  }
  for (const block of masked.matchAll(/\{([^{}]*)\}/g)) {
    const bodyStart = block.index + 1;
    let cursor = 0;
    for (const decl of block[1].split(';')) {
      const colon = decl.indexOf(':');
      if (colon > 0) {
        const prop = decl.slice(0, colon).trim();
        if (/^[-\w]+$/.test(prop)) {
          for (const f of checkDeclaration(prop, decl.slice(colon + 1))) report(f, offset + bodyStart + cursor + decl.search(/\S/));
        }
      }
      cursor += decl.length + 1;
    }
  }
}

function lintStyleAttribute(text, offset, report) {
  for (const decl of text.split(';')) {
    const colon = decl.indexOf(':');
    if (colon > 0) for (const f of checkDeclaration(decl.slice(0, colon).trim(), decl.slice(colon + 1))) report(f, offset);
  }
}

/** Lint de un archivo. Devuelve [{ rule, value, line }]. */
export function lintSource(rel, source) {
  const findings = [];
  const report = (f, index) => findings.push({ ...f, line: lineAt(source, index) });

  if (rel.endsWith('.css')) {
    lintCss(source, 0, source, report);
  } else if (rel.endsWith('.svelte')) {
    for (const m of source.matchAll(/(<style[^>]*>)([\s\S]*?)<\/style>/g)) lintCss(m[2], m.index + m[1].length, source, report);
    const markup = source.replace(/<style[^>]*>[\s\S]*?<\/style>/g, (s) => s.replace(/[^\n]/g, ' '));
    for (const m of markup.matchAll(/\sstyle="([^"{}]*)"/g)) lintStyleAttribute(m[1], m.index, report);
    for (const m of markup.matchAll(/\s(fill|stroke|stop-color|color)="([^"{}]*)"/g)) {
      for (const f of checkDeclaration(m[1], m[2])) report(f, m.index);
    }
    for (const m of markup.matchAll(/\sfont-size="([^"{}]*)"/g)) report({ rule: 'font-size', value: `font-size="${m[1]}"` }, m.index);
  }
  if (/\.(svelte|ts)$/.test(rel) && rel !== BREAKPOINTS_FILE) {
    for (const m of source.matchAll(/matchMedia\(\s*(['"`])([^'"`]*)\1/g)) for (const f of checkQuery(m[2])) report(f, m.index);
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Excepciones: { "<archivo>": [{ rule, value, count, motivo, etapa }] }

function loadExceptions() {
  if (!fs.existsSync(exceptionsPath)) return {};
  const data = JSON.parse(fs.readFileSync(exceptionsPath, 'utf8'));
  delete data.$comentario;
  return data;
}

const key = (f) => `${f.rule}  ${f.value}`;

function main() {
  const files = walk(path.join(root, 'src'))
    .map((full) => path.relative(root, full).split(path.sep).join('/'))
    .filter((rel) => rel !== TOKENS_FILE)
    .sort();
  const exceptions = loadExceptions();
  const errors = [];
  const stale = [];
  const current = {};

  for (const rel of files) {
    const findings = lintSource(rel, fs.readFileSync(path.join(root, rel), 'utf8'));
    const allowed = new Map((exceptions[rel] ?? []).map((e) => [key(e), e.count]));
    const seen = new Map();
    for (const f of findings) {
      const k = key(f);
      seen.set(k, (seen.get(k) ?? 0) + 1);
      if (seen.get(k) > (allowed.get(k) ?? 0)) errors.push({ rel, ...f });
    }
    for (const e of exceptions[rel] ?? []) {
      const used = seen.get(key(e)) ?? 0;
      if (used < e.count) stale.push({ rel, e, used });
    }
    current[rel] = seen;
  }
  for (const rel of Object.keys(exceptions)) if (!files.includes(rel)) stale.push({ rel, e: null, used: 0 });

  if (flag('--prune') && stale.length) {
    const raw = JSON.parse(fs.readFileSync(exceptionsPath, 'utf8'));
    for (const rel of Object.keys(raw)) {
      if (rel === '$comentario') continue;
      raw[rel] = raw[rel]
        .map((e) => ({ ...e, count: Math.min(e.count, current[rel]?.get(key(e)) ?? 0) }))
        .filter((e) => e.count > 0);
      if (!raw[rel].length) delete raw[rel];
    }
    fs.writeFileSync(exceptionsPath, JSON.stringify(raw, null, 2) + '\n');
    console.log(`lint:tokens — ${stale.length} excepciones reducidas o eliminadas en ${path.relative(root, exceptionsPath)}`);
  } else {
    for (const s of stale) {
      console.warn(s.e
        ? `aviso  ${s.rel}  excepción sobrante "${key(s.e)}" (${s.used}/${s.e.count}): ejecuta npm run lint:tokens -- --prune`
        : `aviso  ${s.rel}  el archivo ya no existe: ejecuta npm run lint:tokens -- --prune`);
    }
  }

  for (const e of errors) console.error(`${e.rel}:${e.line}  ${e.rule}  ${e.value}  → ${HINT[e.rule]}`);
  const total = Object.values(exceptions).reduce((n, list) => n + list.reduce((m, e) => m + e.count, 0), 0);
  if (errors.length) {
    console.error(`\nlint:tokens — ${errors.length} literal(es) fuera de tokens.css en ${files.length} archivos.`);
    process.exit(1);
  }
  console.log(`lint:tokens — OK: ${files.length} archivos, ${total} excepciones temporales.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
