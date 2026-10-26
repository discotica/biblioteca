import { RELEASE_TYPES, type ReleaseType } from './releases.ts';
import { RADAR_AXES, type RadarAxis, type RadarVector, type SearchEntity, type SearchOrder, type SearchTerm } from './searchMatching.ts';

/** The one URL/UI representation of a catalogue search. `mes` is deliberately absent. */
export interface SearchState {
  text: SearchTerm[];
  genres: string[];
  countries: string[];
  type: ReleaseType | null;
  year: string | null;
  radar: RadarVector;
  order: SearchOrder;
  page: number;
  modal: string | null;
}

export interface ParsedSearchState {
  state: SearchState;
  /** Parameters owned by later stages (for example beta) and therefore retained verbatim. */
  unknown: URLSearchParams;
}

export const EMPTY_RADAR: RadarVector = Object.freeze({
  experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0
});

const OWNED_PARAMS = new Set([
  'pais', 'genero', 'texto', 'entidad', 'año', 'type', 'orden', 'p', 'modal', 'mes',
  ...RADAR_AXES.map((axis) => `radar_${axis}`)
]);
const ORDERS = new Set<SearchOrder>(['match', 'radar', 'fecha-desc', 'fecha-asc']);

function asParams(value: URLSearchParams | URL | string): URLSearchParams {
  if (value instanceof URLSearchParams) return new URLSearchParams(value);
  if (value instanceof URL) return new URLSearchParams(value.search);
  return new URLSearchParams(value.startsWith('?') ? value.slice(1) : value);
}

function scalar(values: string[], valid: (value: string) => boolean): string | null {
  for (const raw of values) {
    const value = raw.trim();
    if (valid(value)) return value;
  }
  return null;
}

function strings(params: URLSearchParams, key: string): string[] {
  const seen = new Set<string>();
  return params.getAll(key).reduce<string[]>((result, raw) => {
    const value = raw.trim();
    if (!value || seen.has(value)) return result;
    seen.add(value);
    result.push(value);
    return result;
  }, []);
}

function radarValue(values: string[]): number {
  const raw = scalar(values, (value) => /^[1-5]$/.test(value));
  if (raw === null) return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 0;
}

function parseEntity(raw: string): SearchEntity | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const kind = value.kind;
    if (kind !== 'artist' && kind !== 'label' && kind !== 'release') return null;
    const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : undefined;
    const slug = typeof value.slug === 'string' && value.slug.trim() ? value.slug.trim() : undefined;
    const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : undefined;
    const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim() : undefined;
    if (kind === 'label') return name ? { kind, ...(id ? { id } : {}), ...(slug ? { slug } : {}), name } : null;
    if (!id && !slug) return null;
    return kind === 'artist'
      ? { kind, ...(id ? { id } : {}), ...(slug ? { slug } : {}), ...(name ? { name } : {}) }
      : { kind, ...(id ? { id } : {}), ...(slug ? { slug } : {}), ...(title ? { title } : {}) };
  } catch {
    return null;
  }
}

function entityKey(entity: SearchEntity): string {
  return JSON.stringify(entity);
}

function textTerms(params: URLSearchParams): SearchTerm[] {
  const seen = new Set<string>();
  const free = strings(params, 'texto');
  const entities = params.getAll('entidad').map(parseEntity).filter((entity): entity is SearchEntity => Boolean(entity));
  return [...free, ...entities].reduce<SearchTerm[]>((result, term) => {
    const key = typeof term === 'string' ? `text:${term}` : `entity:${entityKey(term)}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(term);
    }
    return result;
  }, []);
}

export function hasSearchCriteria(state: Pick<SearchState, 'text' | 'genres' | 'countries' | 'type' | 'year' | 'radar'>): boolean {
  return Boolean(
    state.text.length || state.genres.length || state.countries.length || state.type || state.year ||
    RADAR_AXES.some((axis) => state.radar[axis] > 0)
  );
}

export function hasActiveRadar(state: Pick<SearchState, 'radar'>): boolean {
  return RADAR_AXES.some((axis) => state.radar[axis] > 0);
}

/** The effective order is never an old artist/title sort and never a stale query value. */
export function normalizeSearchOrder(order: unknown, state: Pick<SearchState, 'text' | 'genres' | 'countries' | 'type' | 'year' | 'radar'>): SearchOrder {
  const candidate = typeof order === 'string' && ORDERS.has(order as SearchOrder) ? order as SearchOrder : null;
  if (!hasSearchCriteria(state)) return 'fecha-desc';
  if (!candidate) return hasActiveRadar(state) ? 'radar' : 'match';
  if (candidate === 'radar' && !hasActiveRadar(state)) return 'match';
  return candidate;
}

export function createSearchState(partial: Partial<SearchState> = {}): SearchState {
  const state = {
    text: partial.text ?? [],
    genres: partial.genres ?? [],
    countries: partial.countries ?? [],
    type: partial.type ?? null,
    year: partial.year ?? null,
    radar: { ...EMPTY_RADAR, ...(partial.radar ?? {}) },
    order: partial.order ?? 'fecha-desc',
    page: partial.page ?? 1,
    modal: partial.modal ?? null
  } satisfies SearchState;
  return { ...state, order: normalizeSearchOrder(partial.order, state) };
}

/** Parses legacy query params once. Invalid/duplicate scalar values choose the first valid value. */
export function parseSearchState(value: URLSearchParams | URL | string): ParsedSearchState {
  const params = asParams(value);
  const radar = Object.fromEntries(RADAR_AXES.map((axis) => [axis, radarValue(params.getAll(`radar_${axis}`))])) as RadarVector;
  const stateWithoutOrder = {
    text: textTerms(params),
    genres: strings(params, 'genero'),
    countries: strings(params, 'pais'),
    type: scalar(params.getAll('type'), (item) => (RELEASE_TYPES as readonly string[]).includes(item)) as ReleaseType | null,
    year: scalar(params.getAll('año'), (item) => /^\d{4}$/.test(item)),
    radar,
    page: Number(scalar(params.getAll('p'), (item) => /^[1-9]\d*$/.test(item)) ?? '1'),
    modal: scalar(params.getAll('modal'), (item) => Boolean(item))
  };
  const order = normalizeSearchOrder(scalar(params.getAll('orden'), (item) => ORDERS.has(item as SearchOrder)), stateWithoutOrder);
  const unknown = new URLSearchParams();
  for (const [key, entry] of params) if (!OWNED_PARAMS.has(key)) unknown.append(key, entry);
  return { state: { ...stateWithoutOrder, order }, unknown };
}

function appendTerms(params: URLSearchParams, terms: SearchTerm[]): void {
  const seen = new Set<string>();
  for (const term of terms) {
    const value = typeof term === 'string' ? term.trim() : term;
    if (!value) continue;
    const key = typeof value === 'string' ? `text:${value}` : `entity:${entityKey(value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    params.append(typeof value === 'string' ? 'texto' : 'entidad', typeof value === 'string' ? value : JSON.stringify(value));
  }
}

/** Serializes canonical owned params and keeps unknown ones for unfinished routes such as E19. */
export function serializeSearchState(input: SearchState, unknown: URLSearchParams | URL | string = ''): URLSearchParams {
  const state = createSearchState(input);
  const params = asParams(unknown);
  appendTerms(params, state.text);
  for (const value of [...new Set(state.countries.map((item) => item.trim()).filter(Boolean))]) params.append('pais', value);
  for (const value of [...new Set(state.genres.map((item) => item.trim()).filter(Boolean))]) params.append('genero', value);
  if (state.year) params.set('año', state.year);
  if (state.type) params.set('type', state.type);
  if (state.order !== 'fecha-desc') params.set('orden', state.order);
  for (const axis of RADAR_AXES) if (state.radar[axis] > 0) params.set(`radar_${axis}`, String(state.radar[axis]));
  if (state.page > 1) params.set('p', String(state.page));
  if (state.modal) params.set('modal', state.modal);
  return params;
}

export function searchStateToCriteria(state: SearchState) {
  return {
    text: state.text,
    genres: state.genres,
    countries: state.countries,
    type: state.type,
    year: state.year,
    radar: state.radar,
    order: state.order
  };
}

export function entityDisplayName(entity: SearchEntity): string {
  return entity.kind === 'release' ? entity.title ?? entity.slug ?? entity.id ?? 'Lanzamiento' : entity.name ?? entity.slug ?? entity.id ?? (entity.kind === 'artist' ? 'Artista' : 'Sello');
}

export type { RadarAxis };
