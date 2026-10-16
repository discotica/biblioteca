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

// U19: géneros y países son listas cerradas; artistas y sellos, libres. `dictionaries` es lo que
// devuelve loadDictionaries (o el mismo formato en las pruebas). Sin diccionarios no se valida.
const DICTIONARY_FIELDS = {
  genre: { entities: 'genres', aliases: 'genreAliases', label: 'género', plural: 'géneros' },
  country: { entities: 'countries', aliases: 'countryAliases', label: 'país', plural: 'países' }
};

export function dictionaryIndex(dictionaries) {
  if (!dictionaries) return null;
  const byKey = (rows = [], pick) => new Map(rows.map((row) => [normalize(row.name), pick(row)]));
  const index = {};
  for (const config of Object.values(DICTIONARY_FIELDS)) {
    const entities = byKey(dictionaries[config.entities], (row) => ({ name: row.name, status: row.status }));
    for (const [key, alias] of byKey(dictionaries[config.aliases], (row) => ({ name: row.target, status: row.status }))) {
      if (!entities.has(key)) entities.set(key, alias);
    }
    index[config.entities] = entities;
  }
  index.labelAliases = byKey(dictionaries.labelAliases, (row) => row.target);
  index.artistAliases = byKey(dictionaries.artistAliases, (row) => row.target);
  return index;
}

// Nombre canónico de un género o país de la hoja, o un error legible si no está en la lista.
function closedDictionaryEntity(value, field, index) {
  const config = DICTIONARY_FIELDS[field];
  const match = index[config.entities].get(normalize(value));
  if (!match || match.status === 'retired') {
    return {
      error: `${config.label} desconocido: «${String(value).trim()}». La importación no crea ${config.plural}; usa un valor de la lista o pide a admin que lo añada`
    };
  }
  return { entity: namedEntity(match.name) };
}

function closedDictionaryEntities(values, field, index, rowNumber, errors, warnings, rejected) {
  if (!index) return values.map(namedEntity);
  const entities = [];
  const seen = new Set();
  for (const value of values) {
    const result = closedDictionaryEntity(value, field, index);
    if (result.error) {
      errors.push({ row: rowNumber, field, message: result.error });
      const spelling = String(value).trim();
      const key = `${field}\u0000${normalize(value)}`;
      const entry = rejected.get(key) ?? { field, value: spelling, rows: [] };
      entry.rows.push(rowNumber);
      if (spelling !== entry.value) entry.spellings = [...new Set([...(entry.spellings ?? [entry.value]), spelling])];
      rejected.set(key, entry);
      continue;
    }
    if (seen.has(result.entity.key)) {
      warnings.push({ row: rowNumber, field, message: `valor repetido: ${result.entity.name}; se conserva una sola relación canónica` });
      continue;
    }
    seen.add(result.entity.key);
    entities.push(result.entity);
  }
  return entities;
}

function translateAlias(name, aliases) {
  return aliases?.get(normalize(name)) ?? name;
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

const DEFAULT_MAX_ARCHIVE = 25;

export function importOptions(args) {
  const options = {
    input: getOption(args, '--input') ?? 'static/lanzamientos.tsv',
    sourceName: getOption(args, '--source-name') ?? DEFAULT_SOURCE,
    sourceKeyColumn: getOption(args, '--source-key-column') ?? 'catalog_key',
    dryRun: args.includes('--dry-run'),
    allowDerivedKeys: args.includes('--allow-derived-keys'),
    keepInvalid: args.includes('--keep-invalid'),
    // Reemplazo (paso 8): archiva las claves que la fuente ya no trae, nunca las borra.
    archiveMissing: args.includes('--archive-missing'),
    maxArchive: DEFAULT_MAX_ARCHIVE,
    pruneDictionaries: args.includes('--prune-dictionaries'),
    // Ejecuta todo y termina con ROLLBACK: informe exacto sin escribir.
    rollback: args.includes('--rollback')
  };
  const maxArchive = getOption(args, '--max-archive');
  if (maxArchive !== undefined) {
    if (!/^\d+$/.test(maxArchive)) throw new Error('--max-archive debe ser un entero mayor o igual que 0');
    options.maxArchive = Number(maxArchive);
  }
  if (options.archiveMissing && options.allowDerivedKeys) {
    throw new Error('--archive-missing no se puede usar con --allow-derived-keys: una clave derivada cambia con el contenido');
  }
  return options;
}

// Claves que cuentan como presentes para --archive-missing: solo las filas válidas. Una fila
// rechazada no se publica, así que su lanzamiento se archiva.
export function presentSourceKeys(report) {
  return report.entries.filter((entry) => !entry.issues.length).map((entry) => entry.payload.source_key);
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
  const dictionaries = dictionaryIndex(options.dictionaries);
  const errors = [];
  const warnings = [];
  const payloads = [];
  const entries = [];
  const rejected = new Map();

  records.forEach((row, index) => {
    const rowNumber = index + 2;
    const errorStart = errors.length;
    const artists = list(row.artist).map((name) => translateAlias(name, dictionaries?.artistAliases));
    const title = String(row.title ?? '').trim();
    const rawType = String(row.type ?? '').trim();
    const canonicalType = canonicalReleaseType(rawType);
    const label = translateAlias(String(row.label ?? '').trim(), dictionaries?.labelAliases);
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
      list(row.collaborator ?? row.collaborators).map((name) => translateAlias(name, dictionaries?.artistAliases)),
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
      genres: closedDictionaryEntities(genres, 'genre', dictionaries, rowNumber, errors, warnings, rejected),
      countries: closedDictionaryEntities(countries, 'country', dictionaries, rowNumber, errors, warnings, rejected),
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
    derivedKeys: payloads.filter((payload) => payload.source_key.startsWith('derived:')).length,
    dictionariesChecked: Boolean(dictionaries),
    // Valores de géneros y países que la hoja tiene que corregir, con sus filas.
    rejectedValues: [...rejected.values()].sort((a, b) => a.field.localeCompare(b.field) || b.rows.length - a.rows.length || a.value.localeCompare(b.value, 'es'))
  };
}

// Diccionarios cerrados y alias, leídos de la base de destino (U19).
export async function loadDictionaries(client) {
  const { rows } = await client.query(`
    select 'genres' as kind, name, status, null::text as target from public.genres
    union all select 'countries', name, status, null from public.countries
    union all select 'genreAliases', a.name, g.status, g.name from public.genre_aliases a join public.genres g on g.id = a.genre_id
    union all select 'countryAliases', a.name, c.status, c.name from public.country_aliases a join public.countries c on c.id = a.country_id
    union all select 'labelAliases', a.name, null, l.name from public.label_aliases a join public.labels l on l.id = a.label_id
    union all select 'artistAliases', a.name, null, ar.name from public.artist_aliases a join public.artists ar on ar.id = a.artist_id`);
  const dictionaries = { genres: [], countries: [], genreAliases: [], countryAliases: [], labelAliases: [], artistAliases: [] };
  for (const row of rows) dictionaries[row.kind].push({ name: row.name, status: row.status, target: row.target });
  return dictionaries;
}

async function main() {
  const options = importOptions(process.argv.slice(2));
  const raw = await readFile(resolve(options.input), 'utf8');
  // Con base configurada, también --dry-run valida contra sus diccionarios (U19). Sin base, el dry
  // run solo valida la forma y lo dice en el informe (dictionaries: 'not_checked').
  const connectionString = process.env.DATABASE_URL;
  const hasDatabase = Boolean(connectionString || process.env.PGHOST);
  if (!hasDatabase && !options.dryRun) {
    throw new Error('Defina DATABASE_URL o las variables PGHOST, PGPORT, PGUSER, PGPASSWORD y PGDATABASE. Use --dry-run para validar sin conectarse.');
  }
  const client = hasDatabase ? (connectionString ? new Client({ connectionString }) : new Client()) : null;
  if (client) await client.connect();
  try {
    await runImport(client, options, raw);
  } finally {
    if (client) await client.end();
  }
}

async function runImport(client, options, raw) {
  const { input, sourceName, sourceKeyColumn, dryRun, allowDerivedKeys, keepInvalid, archiveMissing, maxArchive, pruneDictionaries, rollback } = options;
  const dictionaries = client ? await loadDictionaries(client) : undefined;
  const report = buildImportPayloads(raw, { sourceName, sourceKeyColumn, allowDerivedKeys, dictionaries });
  const output = {
    input: basename(input),
    inputSha256: digest(raw),
    records: report.records,
    derivedKeys: report.derivedKeys,
    rejectedRows: report.entries.filter((entry) => entry.issues.length).length,
    dictionaries: report.dictionariesChecked ? 'checked' : 'not_checked',
    rejectedValues: report.rejectedValues,
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

  const actions = { created: 0, updated: 0, republished: 0, unchanged: 0, rejected: 0 };
  let archived = [];
  let pruned = [];
  try {
    await client.query('begin');
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
    if (archiveMissing) {
      const result = await client.query(
        'select * from private.archive_missing_catalog_keys($1, $2::text[], $3)',
        [sourceName, presentSourceKeys(report), maxArchive]
      );
      archived = result.rows;
    }
    if (pruneDictionaries) {
      const result = await client.query('select * from private.prune_unused_catalog_dictionaries()');
      pruned = result.rows;
    }
    await client.query(rollback ? 'rollback' : 'commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
  const summary = { ...output, applied: !rollback, actions };
  if (rollback) summary.reason = 'rollback';
  if (archiveMissing) summary.archived = archived;
  if (pruneDictionaries) {
    summary.pruned = pruned.reduce((counts, row) => ({ ...counts, [row.entity_type]: (counts[row.entity_type] ?? 0) + 1 }), {});
    summary.prunedNames = pruned.map((row) => `${row.entity_type}: ${row.name}`);
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(JSON.stringify({ applied: false, error: error.message }, null, 2));
    process.exitCode = 1;
  });
}
