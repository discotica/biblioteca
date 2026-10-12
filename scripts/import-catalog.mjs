import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'csv-parse/sync';
import pg from 'pg';

const { Client } = pg;

const DEFAULT_SOURCE = 'google-sheets-tsv';

const CANONICAL_RELEASE_TYPES = new Map([
  ['album', { name: 'Álbum', key: 'album', slug: 'album' }],
  ['disco', { name: 'Álbum', key: 'album', slug: 'album' }],
  ['ep', { name: 'EP', key: 'ep', slug: 'ep' }],
  ['single', { name: 'Single', key: 'single', slug: 'single' }],
  ['compilado', { name: 'Compilado', key: 'compilado', slug: 'compilado' }],
  ['sample pack', { name: 'Sample Pack', key: 'sample pack', slug: 'sample-pack' }]
]);

function normalize(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ');
}

function headerKey(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function canonicalReleaseType(value) {
  return CANONICAL_RELEASE_TYPES.get(normalize(value)) ?? null;
}

function digest(value, length = 64) {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function slug(value, key) {
  const base = normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sin-slug';
  return `${base}--${digest(key, 8)}`;
}

function legacySlug(title, artists) {
  const base = normalize(`${title}-${artists[0] ?? ''}`)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'sin-slug';
}

function list(value) {
  return String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function parseDate(value) {
  const source = String(value ?? '').trim();
  if (!source) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) return source;
  const match = source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function validUrl(value) {
  if (!String(value ?? '').trim()) return true;
  try {
    const parsed = new URL(String(value).trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function provider(url) {
  if (!url) return 'unknown';
  const host = new URL(url).hostname.toLowerCase();
  if (host.endsWith('bandcamp.com')) return 'bandcamp';
  if (host.endsWith('spotify.com')) return 'spotify';
  if (host.endsWith('soundcloud.com')) return 'soundcloud';
  return host;
}

function namedEntity(name) {
  const key = normalize(name);
  return { name: String(name).trim(), key, slug: slug(name, key) };
}

function uniqueNamedEntities(values, rowNumber, field, warnings) {
  const entities = [];
  const seen = new Set();
  for (const value of values) {
    const entity = namedEntity(value);
    if (seen.has(entity.key)) {
      warnings.push({ row: rowNumber, field, message: `valor repetido: ${entity.name}; se conserva una sola relación canónica` });
      continue;
    }
    seen.add(entity.key);
    entities.push(entity);
  }
  return entities;
}

function radar(row, errors, rowNumber) {
  const values = {};
  for (const key of ['experimental', 'denso', 'sintetico', 'bailable', 'rapido']) {
    const parsed = Number(String(row[key] ?? '').trim());
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 5) {
      errors.push({ row: rowNumber, field: key, message: 'debe ser un entero entre 0 y 5' });
    }
    values[key] = parsed;
  }
  return values;
}

function getOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function buildImportPayloads(rawTsv, options = {}) {
  const records = parse(rawTsv, {
    bom: true,
    columns: (headers) => headers.map(headerKey),
    delimiter: '\t',
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  });
  const sourceName = options.sourceName ?? DEFAULT_SOURCE;
  const sourceKeyColumn = headerKey(options.sourceKeyColumn ?? 'catalog_key');
  const allowDerivedKeys = Boolean(options.allowDerivedKeys);
  const errors = [];
  const warnings = [];
  const payloads = [];
  const entries = [];

  records.forEach((row, index) => {
    const rowNumber = index + 2;
    const errorStart = errors.length;
    const artists = list(row.artist);
    const title = String(row.title ?? '').trim();
    const rawType = String(row.type ?? '').trim();
    const canonicalType = canonicalReleaseType(rawType);
    const label = String(row.label ?? '').trim();
    const releaseDate = parseDate(row.release_date);
    const genres = list(row.genre);
    const countries = list(row.country);
    const buyLinkInput = String(row.buy_link ?? '').trim();
    const coverInput = String(row.cover ?? '').trim();

    if (!title) errors.push({ row: rowNumber, field: 'title', message: 'es obligatorio' });
    if (!artists.length) errors.push({ row: rowNumber, field: 'artist', message: 'requiere al menos un artista' });
    if (!rawType) {
      errors.push({ row: rowNumber, field: 'type', message: 'es obligatorio' });
    } else if (!canonicalType) {
      errors.push({
        row: rowNumber,
        field: 'type',
        message: 'tipo inválido; permitidos: Álbum, EP, Single, Compilado, Sample Pack'
      });
    }
    if (!label) errors.push({ row: rowNumber, field: 'label', message: 'es obligatorio' });
    if (String(row.release_date ?? '').trim() && !releaseDate) errors.push({ row: rowNumber, field: 'release_date', message: 'debe usar DD/MM/AAAA o AAAA-MM-DD' });
    const releaseRadar = radar(row, errors, rowNumber);

    let buyLink = buyLinkInput;
    if (!validUrl(buyLinkInput)) {
      warnings.push({ row: rowNumber, field: 'buy_link', message: 'URL inválida: se conserva en el payload de origen, pero no se publica como enlace' });
      buyLink = '';
    }
    let cover = coverInput;
    if (!validUrl(coverInput)) {
      warnings.push({ row: rowNumber, field: 'cover', message: 'URL inválida: se conserva en el payload de origen, pero no se publica como portada' });
      cover = '';
    }

    const keyValue = String(row[sourceKeyColumn] ?? '').trim();
    // Derived keys are first-load compatibility only. Keep the raw legacy type
    // in this identity so a pre-E02 Disco row does not acquire a new release.
    const identity = JSON.stringify({ artists: artists.map(normalize), title: normalize(title), releaseDate, type: normalize(rawType), label: normalize(label) });
    if (!keyValue && !allowDerivedKeys) {
      errors.push({ row: rowNumber, field: sourceKeyColumn, message: 'falta una clave estable; use una columna editorial o --allow-derived-keys solo para la primera carga' });
    }
    const sourceKey = keyValue || `derived:${digest(identity)}`;
    const legacy = legacySlug(title, artists);
    const primaryArtists = uniqueNamedEntities(artists, rowNumber, 'artist', warnings);
    const collaborators = uniqueNamedEntities(
      list(row.collaborator ?? row.collaborators),
      rowNumber,
      'collaborator',
      warnings
    );
    const primaryKeys = new Set(primaryArtists.map((artist) => artist.key));
    for (const collaborator of collaborators) {
      if (primaryKeys.has(collaborator.key)) {
        errors.push({
          row: rowNumber,
          field: 'collaborator',
          message: `${collaborator.name} también figura como artista principal; corrija el crédito editorial`
        });
      }
    }

    const payload = {
      source_name: sourceName,
      source_key: sourceKey,
      source_hash: digest(JSON.stringify(row)),
      slug: slug(`${title}-${artists[0] ?? ''}`, sourceKey),
      legacy_slug: legacy,
      title,
      release_date: releaseDate,
      type: canonicalType?.name ?? rawType,
      type_key: canonicalType?.key ?? normalize(rawType),
      type_slug: canonicalType?.slug ?? slug(rawType, normalize(rawType)),
      label,
      label_key: normalize(label),
      label_slug: slug(label, normalize(label)),
      review: String(row.review ?? '').trim(),
      status: 'published',
      primary_artists: primaryArtists,
      collaborators,
      credit_quality: 'legacy',
      genres: genres.map(namedEntity),
      countries: countries.map(namedEntity),
      radar: releaseRadar,
      buy_link: buyLink,
      provider: provider(buyLink),
      cover
    };
    payloads.push(payload);
    entries.push({ payload, rawPayload: row, rowNumber, issues: errors.slice(errorStart) });
  });

  const sourceKeys = new Map();
  payloads.forEach((payload, index) => {
    const first = sourceKeys.get(payload.source_key);
    if (first !== undefined) {
      const issue = { row: index + 2, field: sourceKeyColumn, message: `clave duplicada; también aparece en fila ${first + 2}` };
      errors.push(issue);
      entries[index].issues.push(issue);
    }
    else sourceKeys.set(payload.source_key, index);
  });

  return {
    records: records.length,
    payloads,
    entries,
    errors,
    warnings,
    derivedKeys: payloads.filter((payload) => payload.source_key.startsWith('derived:')).length
  };
}

async function main() {
  const args = process.argv.slice(2);
  const input = getOption(args, '--input') ?? 'static/lanzamientos.tsv';
  const sourceName = getOption(args, '--source-name') ?? DEFAULT_SOURCE;
  const sourceKeyColumn = getOption(args, '--source-key-column') ?? 'catalog_key';
  const dryRun = args.includes('--dry-run');
  const allowDerivedKeys = args.includes('--allow-derived-keys');
  const keepInvalid = args.includes('--keep-invalid');
  const raw = await readFile(resolve(input), 'utf8');
  const report = buildImportPayloads(raw, { sourceName, sourceKeyColumn, allowDerivedKeys });
  const output = {
    input: basename(input),
    inputSha256: digest(raw),
    records: report.records,
    derivedKeys: report.derivedKeys,
    rejectedRows: report.entries.filter((entry) => entry.issues.length).length,
    errors: report.errors,
    warnings: report.warnings
  };

  if ((report.errors.length && !keepInvalid) || dryRun) {
    output.applied = false;
    output.reason = report.errors.length ? (keepInvalid ? 'dry_run' : 'validation_failed') : 'dry_run';
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = report.errors.length ? 1 : 0;
    return;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString && !process.env.PGHOST) {
    throw new Error('Defina DATABASE_URL o las variables PGHOST, PGPORT, PGUSER, PGPASSWORD y PGDATABASE. Use --dry-run para validar sin conectarse.');
  }

  const client = connectionString ? new Client({ connectionString }) : new Client();
  const actions = { created: 0, updated: 0 };
  await client.connect();
  try {
    await client.query('begin');
    actions.rejected = 0;
    for (const entry of report.entries) {
      if (entry.issues.length) {
        await client.query(
          'select private.record_catalog_import_rejection($1, $2, $3, $4, $5::jsonb, $6::jsonb)',
          [
            entry.payload.source_name,
            entry.payload.source_key,
            entry.payload.source_hash,
            entry.rowNumber,
            JSON.stringify(entry.rawPayload),
            JSON.stringify(entry.issues)
          ]
        );
        actions.rejected += 1;
        continue;
      }
      await client.query(
        'delete from public.catalog_import_rejections where source_name = $1 and source_key = $2',
        [entry.payload.source_name, entry.payload.source_key]
      );
      const result = await client.query('select * from private.import_catalog_release($1::jsonb)', [entry.payload]);
      actions[result.rows[0].action] += 1;
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
  console.log(JSON.stringify({ ...output, applied: true, actions }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ applied: false, error: error.message }, null, 2));
    process.exitCode = 1;
  });
}
