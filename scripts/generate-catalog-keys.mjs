import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';

const input = process.argv[2];
const prefix = process.argv[3] ?? 'rel_';

if (!input) {
  throw new Error('Uso: npm run catalog:keys -- ruta/al/catalogo.tsv [prefijo]');
}

const raw = await readFile(resolve(input), 'utf8');
const rows = parse(raw, { bom: true, delimiter: '\t', relax_quotes: true, relax_column_count: true, skip_empty_lines: true });
const header = rows.shift();
const keyIndex = header.findIndex((value) => String(value).trim().toLocaleLowerCase('es') === 'catalog_key');

if (keyIndex !== -1) {
  console.log('fila\tcatalog_key');
  rows.forEach((row, index) => console.log(`${index + 2}\t${String(row[keyIndex] ?? '').trim()}`));
} else {
  console.log('fila\tcatalog_key');
  rows.forEach((_, index) => console.log(`${index + 2}\t${prefix}${String(index + 1).padStart(6, '0')}`));
}
