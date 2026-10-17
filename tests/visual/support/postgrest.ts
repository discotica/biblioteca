// Evaluador mínimo de PostgREST sobre filas en memoria. Cubre lo que la app usa
// hoy: select de columnas, filtros eq/neq/in/ilike/like/is/gt/gte/lt/lte, order
// con nullsfirst/nullslast, offset/limit, objeto único y Content-Range.
// Lo que no entiende lo devuelve como `unsupported` para que el informe lo liste.

export type Row = Record<string, unknown>;
export type PostgrestResult = { status: number; body: unknown; headers?: Record<string, string> };

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function parseLiteral(raw: string): unknown {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

function likeToRegExp(pattern: string, flags: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, flags);
}

function compare(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { sensitivity: 'variant' });
}

function filterFor(column: string, expression: string): ((row: Row) => boolean) | null {
  const negate = expression.startsWith('not.');
  const body = negate ? expression.slice(4) : expression;
  const dot = body.indexOf('.');
  if (dot < 0) return null;
  const op = body.slice(0, dot);
  const raw = body.slice(dot + 1);
  let test: ((value: unknown) => boolean) | null = null;
  switch (op) {
    case 'eq': test = (value) => String(value) === raw; break;
    case 'neq': test = (value) => String(value) !== raw; break;
    case 'gt': test = (value) => value != null && compare(value, raw) > 0; break;
    case 'gte': test = (value) => value != null && compare(value, raw) >= 0; break;
    case 'lt': test = (value) => value != null && compare(value, raw) < 0; break;
    case 'lte': test = (value) => value != null && compare(value, raw) <= 0; break;
    case 'is': { const literal = parseLiteral(raw); test = (value) => (value ?? null) === literal; break; }
    case 'like': { const re = likeToRegExp(raw, ''); test = (value) => value != null && re.test(String(value)); break; }
    case 'ilike': { const re = likeToRegExp(raw, 'i'); test = (value) => value != null && re.test(String(value)); break; }
    case 'in': {
      const list = raw.replace(/^\(|\)$/g, '').split(',').map((item) => item.replace(/^"|"$/g, ''));
      test = (value) => list.includes(String(value));
      break;
    }
    default: return null;
  }
  return negate ? (row) => !test!(row[column]) : (row) => test!(row[column]);
}

function sorterFor(order: string) {
  const terms = order.split(',').map((term) => {
    const [column, ...mods] = term.split('.');
    const desc = mods.includes('desc');
    const nullsFirst = mods.includes('nullsfirst') ? true : mods.includes('nullslast') ? false : desc;
    return { column, desc, nullsFirst };
  });
  return (a: Row, b: Row) => {
    for (const { column, desc, nullsFirst } of terms) {
      const va = a[column];
      const vb = b[column];
      if (va == null && vb == null) continue;
      if (va == null) return nullsFirst ? -1 : 1;
      if (vb == null) return nullsFirst ? 1 : -1;
      const result = compare(va, vb);
      if (result !== 0) return desc ? -result : result;
    }
    return 0;
  };
}

function project(row: Row, select: string | null) {
  if (!select || select.trim() === '*') return row;
  const columns = select.split(',').map((part) => part.trim()).filter(Boolean);
  if (columns.some((column) => column === '*' || column.includes('('))) return row;
  return Object.fromEntries(columns.map((column) => {
    const [alias, source] = column.includes(':') ? column.split(':') : [column, column];
    return [alias, row[source]];
  }));
}

/** Evalúa una lectura GET sobre `rows`. Devuelve null si la consulta usa algo no soportado. */
export function evaluateRead(rows: Row[], url: URL, headers: Record<string, string>): PostgrestResult | null {
  let result = rows;
  for (const [key, value] of url.searchParams) {
    if (RESERVED.has(key)) continue;
    if (key === 'or' || key === 'and' || key.includes('.')) return null;
    const filter = filterFor(key, value);
    if (!filter) return null;
    result = result.filter(filter);
  }
  const order = url.searchParams.get('order');
  if (order) result = [...result].sort(sorterFor(order));
  const total = result.length;
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam == null ? Infinity : Number(limitParam);
  result = result.slice(offset, offset + limit);
  const projected = result.map((row) => project(row, url.searchParams.get('select')));
  const rangeEnd = projected.length ? offset + projected.length - 1 : offset - 1;
  const contentRange = projected.length ? `${offset}-${rangeEnd}/${total}` : `*/${total}`;

  if ((headers.accept ?? '').includes('vnd.pgrst.object')) {
    if (projected.length !== 1) {
      return {
        status: 406,
        body: {
          code: 'PGRST116',
          details: `The result contains ${projected.length} rows`,
          hint: null,
          message: 'JSON object requested, multiple (or no) rows returned'
        }
      };
    }
    return { status: 200, body: projected[0], headers: { 'content-range': contentRange } };
  }
  return { status: 200, body: projected, headers: { 'content-range': contentRange } };
}
