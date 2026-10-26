// Regenera tests/visual/data/staging.json.gz leyendo staging en SOLO LECTURA.
// Usa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY de .env.local (clave pública).
// Solo hace GET a tablas de lectura pública; nunca escribe ni usa secretos.
//
//   npm run visual:data
//
// Tras regenerar, la línea base deja de ser comparable: hay que volver a capturarla.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(here, 'data', 'staging.json.gz');

function readEnv() {
  const file = path.join(root, '.env.local');
  const fromFile = fs.existsSync(file)
    ? Object.fromEntries(
        fs.readFileSync(file, 'utf8').split('\n')
          .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
          .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()])
      )
    : {};
  const url = process.env.VITE_SUPABASE_URL ?? fromFile.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? fromFile.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.');
  if (/service_role|sb_secret_/.test(key)) throw new Error('La clave no es publicable. Este script solo acepta la clave pública.');
  return { url, key };
}

const { url, key } = readEnv();

async function readAll(table, select, order) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = new URLSearchParams({ select, order, offset: String(offset), limit: String(pageSize) });
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
      method: 'GET',
      headers: { apikey: key, authorization: `Bearer ${key}`, accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

const started = Date.now();
const tables = {
  // Mismo orden que fetchReleases(): fecha descendente y luego id descendente.
  catalog_releases: await readAll('catalog_releases', '*', 'release_date.desc.nullslast,id.desc'),
  labels: await readAll('labels', 'id,name,slug', 'name.asc,id.asc'),
  genres: await readAll('genres', 'id,name,slug', 'name.asc,id.asc'),
  countries: await readAll('countries', 'id,name,slug', 'name.asc,id.asc'),
  release_types: await readAll('release_types', 'id,name,slug', 'name.asc,id.asc'),
  artists: await readAll('artists', 'id,name,slug', 'name.asc,id.asc')
};

const snapshot = {
  // Fecha de grabación y conteos: lo único que cambia entre grabaciones además de los datos.
  recordedAt: new Date().toISOString().slice(0, 10),
  counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
  tables
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(snapshot), { level: 9 }));
console.log(`staging.json.gz escrito (${(fs.statSync(out).size / 1024).toFixed(0)} KB) en ${((Date.now() - started) / 1000).toFixed(1)} s`);
console.log(snapshot.counts);
