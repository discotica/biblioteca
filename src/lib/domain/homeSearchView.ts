// Derivaciones y transiciones del SearchState que usa el inicio. Puras: la
// página decide cuándo aplicarlas y cuándo navegar.
import { RADAR_AXES, type RadarVector, type SearchOrder, type SearchTerm } from './searchMatching.ts';
import { createSearchState, entityDisplayName, hasActiveRadar, hasSearchCriteria, type SearchState } from './searchState.ts';

export const RELEASES_PER_PAGE = 12;

/** Forma que esperan `Filtros` y `RadarFiltros`. Alias visual del único estado editable. */
export interface SearchFilterValues {
  pais: string[];
  genero: string[];
  texto: SearchTerm[];
  año: string;
  type: string;
  orden: SearchOrder;
  radar: RadarVector;
}

export type SearchPillKind = 'country' | 'genre' | 'text' | 'year' | 'type' | 'radar';

export interface SearchPill {
  id: string;
  label: string;
  removeLabel: string;
  kind: SearchPillKind;
  value?: SearchTerm;
}

export interface SearchOrderOption {
  value: SearchOrder;
  label: string;
}

/** Lo que emite `Filtros` en `filtrar`. */
export interface SearchFilterForm {
  pais?: string | string[] | null;
  genero?: string | string[] | null;
  texto?: SearchTerm[] | null;
  año?: string | number | null;
  type?: string | null;
}

const EMPTY_RADAR: RadarVector = { experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 };

const radarIsActive = (radar: Partial<RadarVector> | undefined) =>
  RADAR_AXES.some((key) => Number(radar?.[key] ?? 0) > 0);

const textIdentity = (term: SearchTerm) => (typeof term === 'string' ? `text:${term}` : JSON.stringify(term));

export function searchFilterValues(state: SearchState): SearchFilterValues {
  return {
    pais: state.countries,
    genero: state.genres,
    texto: state.text,
    año: state.year ?? '',
    type: state.type ?? '',
    orden: state.order,
    radar: state.radar
  };
}

export function activeSearchPills(state: SearchState): SearchPill[] {
  const filters = searchFilterValues(state);
  return [
    ...filters.pais.map((value): SearchPill => ({ id: `country:${value}`, label: value, removeLabel: `Quitar país ${value}`, kind: 'country', value })),
    ...filters.genero.map((value): SearchPill => ({ id: `genre:${value}`, label: value, removeLabel: `Quitar género ${value}`, kind: 'genre', value })),
    ...filters.texto.map((value, index): SearchPill => {
      const label = typeof value === 'string' ? value : entityDisplayName(value);
      return { id: `text:${index}:${label}`, label: `"${label}"`, removeLabel: `Quitar ${label}`, kind: 'text', value };
    }),
    ...(filters.año ? [{ id: `year:${filters.año}`, label: filters.año, removeLabel: `Quitar año ${filters.año}`, kind: 'year' } as SearchPill] : []),
    ...(filters.type ? [{ id: `type:${filters.type}`, label: filters.type, removeLabel: `Quitar tipo ${filters.type}`, kind: 'type' } as SearchPill] : []),
    ...(radarIsActive(filters.radar) ? [{ id: 'radar', label: 'Radar', removeLabel: 'Quitar Radar', kind: 'radar' } as SearchPill] : [])
  ];
}

export function countActiveFilters(state: SearchState): number {
  return state.countries.length
    + state.genres.length
    + state.text.length
    + (state.year ? 1 : 0)
    + (state.type ? 1 : 0)
    + (radarIsActive(state.radar) ? 1 : 0);
}

/** Órdenes válidos para el estado: fechas sin criterios; coincidencia (y Radar si está activo) con criterios. */
export function availableOrders(state: SearchState): SearchOrderOption[] {
  const dates: SearchOrderOption[] = [
    { value: 'fecha-desc', label: 'Más reciente' },
    { value: 'fecha-asc', label: 'Más antiguo' }
  ];
  if (!hasSearchCriteria(state)) return dates;
  const relevance: SearchOrderOption[] = [{ value: 'match', label: 'Mejor coincidencia' }];
  return hasActiveRadar(state) ? [...relevance, { value: 'radar', label: 'Radar' }, ...dates] : [...relevance, ...dates];
}

export function withFilterForm(state: SearchState, form: SearchFilterForm): SearchState {
  const preserveOrder = hasSearchCriteria(state) ? state.order : undefined;
  return createSearchState({
    ...state,
    countries: Array.isArray(form.pais) ? form.pais : (form.pais ? [form.pais] : []),
    genres: Array.isArray(form.genero) ? form.genero : (form.genero ? [form.genero] : []),
    text: Array.isArray(form.texto) ? form.texto : [],
    year: /^\d{4}$/.test(String(form.año ?? '')) ? String(form.año) : null,
    type: (form.type || null) as SearchState['type'],
    order: preserveOrder,
    page: 1
  });
}

/** Al activar Radar por primera vez el orden pasa a `radar`; después se respeta el elegido. */
export function withRadar(state: SearchState, values: Partial<Record<keyof RadarVector, unknown>> | null | undefined): SearchState {
  const input = values || {};
  const radar = Object.fromEntries(
    RADAR_AXES.map((key) => [key, Math.round(Number(input[key] ?? 0))])
  ) as RadarVector;
  return createSearchState({
    ...state,
    radar,
    order: !hasActiveRadar(state) && Object.values(radar).some((value) => Number(value) > 0) ? 'radar' : state.order,
    page: 1
  });
}

export function withoutPill(state: SearchState, pill: SearchPill): SearchState {
  switch (pill.kind) {
    case 'country':
      return createSearchState({ ...state, countries: state.countries.filter((value) => value !== pill.value), page: 1 });
    case 'genre':
      return createSearchState({ ...state, genres: state.genres.filter((value) => value !== pill.value), page: 1 });
    case 'text': {
      const identity = textIdentity(pill.value as SearchTerm);
      return createSearchState({ ...state, text: state.text.filter((term) => textIdentity(term) !== identity), page: 1 });
    }
    case 'year':
      return createSearchState({ ...state, year: null, page: 1 });
    case 'type':
      return createSearchState({ ...state, type: null, page: 1 });
    case 'radar':
      return createSearchState({ ...state, radar: { ...EMPTY_RADAR }, page: 1 });
  }
}

export function withPage(state: SearchState, page: number, totalPages: number): SearchState {
  return createSearchState({ ...state, page: Math.max(1, Math.min(page, totalPages)) });
}

export function withOrder(state: SearchState, order: SearchOrder): SearchState {
  return createSearchState({ ...state, order, page: 1 });
}

export function totalPagesFor(count: number): number {
  return Math.max(1, Math.ceil(count / RELEASES_PER_PAGE));
}

export function pageSlice<T>(items: readonly T[], page: number): T[] {
  return items.slice((page - 1) * RELEASES_PER_PAGE, page * RELEASES_PER_PAGE);
}

const countFormatter = new Intl.NumberFormat('es-CO');

/**
 * Contador de la barra de resultados: "13–24 de 2.790 lanzamientos" con varias
 * páginas, "5 lanzamientos" con una, vacío sin resultados. Lo usan el inicio,
 * artista y sello.
 */
export function resultsSummary(page: number, totalPages: number, count: number): string {
  if (!count) return '';
  const n = (value: number) => countFormatter.format(value);
  const noun = count === 1 ? 'lanzamiento' : 'lanzamientos';
  if (totalPages <= 1) return `${n(count)} ${noun}`;
  return `${n((page - 1) * RELEASES_PER_PAGE + 1)}–${n(Math.min(page * RELEASES_PER_PAGE, count))} de ${n(count)} ${noun}`;
}

/** Texto de la región aria-live de resultados. */
export function describeResults(input: {
  loading: boolean;
  error: boolean;
  total: number;
  onlyApproximate: boolean;
  approximateTotal: number;
  mixedGroups: boolean;
  exactOnPage: number;
  approximateOnPage: number;
}): string {
  if (input.loading) return 'Cargando lanzamientos.';
  if (input.error) return 'No pudimos cargar los lanzamientos.';
  if (!input.total) return 'No encontramos lanzamientos con estos filtros.';
  if (input.onlyApproximate) return `${input.approximateTotal} resultados aproximados.`;
  if (input.mixedGroups && input.approximateOnPage) return `${input.exactOnPage} resultados exactos y ${input.approximateOnPage} aproximados en esta página.`;
  return `${input.total} lanzamientos.`;
}
