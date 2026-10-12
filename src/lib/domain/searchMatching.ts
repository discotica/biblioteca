import { allArtistCredits, type Release, type ReleaseType } from './releases.ts';

/** Stable, locale-independent key used only for matching; never for display. */
export function normalizeSearchText(value: unknown): string {
  const transliteration: Record<string, string> = {
    'æ': 'ae', 'ǽ': 'ae', 'œ': 'oe', 'ø': 'o', 'ö': 'o', 'å': 'a',
    'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ß': 'ss', 'ſ': 's',
    'ħ': 'h', 'ı': 'i', 'ĸ': 'k', 'ŋ': 'n', 'ŧ': 't'
  };
  return String(value ?? '')
    .toLocaleLowerCase('und')
    .replace(/[æǽœøöåłđðþßſħıĸŋŧ]/g, (character) => transliteration[character] ?? character)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export const RADAR_AXES = ['experimental', 'denso', 'sintetico', 'bailable', 'rapido'] as const;
export type RadarAxis = (typeof RADAR_AXES)[number];
export type RadarVector = Record<RadarAxis, number>;
export type SearchOrder = 'match' | 'radar' | 'fecha-desc' | 'fecha-asc';

/** An E12 typed suggestion. Its identity is matched exactly, never as text. */
export type SearchEntity =
  | { kind: 'artist'; id?: string | null; slug?: string | null; name?: string }
  | { kind: 'label'; id?: string | null; slug?: string | null; name: string }
  | { kind: 'release'; id?: string | null; slug?: string | null; title?: string };
export type SearchTerm = string | SearchEntity;

export interface SearchCriteria {
  text?: SearchTerm[];
  genres?: string[];
  countries?: string[];
  type?: ReleaseType | '' | null;
  year?: string | number | null;
  radar?: Partial<RadarVector>;
  order?: SearchOrder;
}

export type MatchGroup = 'exact' | 'approximate';
export type TextMatchKind = 'exact' | 'prefix' | 'contains' | 'none';
export interface CategoryMatch {
  active: boolean;
  matched: number;
  required: number;
  score: number;
  complete: boolean;
}
export interface ReleaseMatch {
  release: Release;
  eligible: boolean;
  group: MatchGroup | null;
  categories: {
    text: CategoryMatch & { kinds: TextMatchKind[] };
    genre: CategoryMatch;
    radar: CategoryMatch & { distance: number | null; activeAxes: RadarAxis[]; axisDifferences: Partial<RadarVector> };
    country: CategoryMatch;
    type: CategoryMatch;
    year: CategoryMatch;
  };
  /** Lexicographic order: text, genre, Radar, country, type, year. */
  relevanceVector: readonly number[];
  radarDistance: number | null;
  reasons: string[];
}
export interface SearchResult {
  matches: ReleaseMatch[];
  exact: ReleaseMatch[];
  approximate: ReleaseMatch[];
  hasCriteria: boolean;
}

const EMPTY_CATEGORY = (): CategoryMatch => ({ active: false, matched: 0, required: 0, score: 1, complete: true });
const identity = (release: Release) => release.id || release.slug;
const dateDescending = (a: ReleaseMatch, b: ReleaseMatch) =>
  b.release.releaseDate.timestamp - a.release.releaseDate.timestamp || identity(a.release).localeCompare(identity(b.release));
const dateAscending = (a: ReleaseMatch, b: ReleaseMatch) =>
  a.release.releaseDate.timestamp - b.release.releaseDate.timestamp || identity(a.release).localeCompare(identity(b.release));
const vectorDescending = (a: readonly number[], b: readonly number[]) => {
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return b[index] - a[index];
  return 0;
};

function selected(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map(normalizeSearchText).filter(Boolean))];
}

function listMatch(values: string[], wanted: string[]): CategoryMatch {
  if (!wanted.length) return EMPTY_CATEGORY();
  const available = new Set(values.map(normalizeSearchText));
  const matched = wanted.filter((value) => available.has(value)).length;
  return { active: true, matched, required: wanted.length, score: matched / wanted.length, complete: matched === wanted.length };
}

function freeTextKind(value: string, candidate: string): TextMatchKind {
  if (candidate === value) return 'exact';
  if (candidate.startsWith(`${value} `) || candidate.startsWith(value)) return 'prefix';
  return candidate.includes(value) ? 'contains' : 'none';
}

function textMatch(release: Release, terms: SearchTerm[] | undefined): CategoryMatch & { kinds: TextMatchKind[] } {
  const requested = terms ?? [];
  if (!requested.length) return { ...EMPTY_CATEGORY(), kinds: [] };
  const candidates = [release.title, release.label, ...allArtistCredits(release).map((credit) => credit.name)].map(normalizeSearchText);
  const kinds = requested.map((term) => {
    if (typeof term === 'string') {
      const normalized = normalizeSearchText(term);
      if (!normalized) return 'none';
      return candidates.reduce<TextMatchKind>((best, candidate) => {
        const current = freeTextKind(normalized, candidate);
        return ['none', 'contains', 'prefix', 'exact'].indexOf(current) > ['none', 'contains', 'prefix', 'exact'].indexOf(best) ? current : best;
      }, 'none');
    }
    if (term.kind === 'artist') return allArtistCredits(release).some((credit) =>
      (term.id && credit.id === term.id) || (term.slug && credit.slug === term.slug)
    ) ? 'exact' : 'none';
    if (term.kind === 'release') return ((term.id && release.id === term.id) || (term.slug && release.slug === term.slug)) ? 'exact' : 'none';
    // E03 exposes no label entity identity; label suggestions remain exact normalized names until E12 adds one.
    return normalizeSearchText(release.label) === normalizeSearchText(term.name) ? 'exact' : 'none';
  });
  const levels = { none: 0, contains: 1, prefix: 2, exact: 3 } as const;
  const matched = kinds.filter((kind) => kind !== 'none').length;
  const score = kinds.reduce((total, kind) => total + levels[kind], 0) / (requested.length * 3);
  return { active: true, matched, required: requested.length, score, complete: kinds.every((kind) => kind === 'exact'), kinds };
}

function radarMatch(release: Release, requested: Partial<RadarVector> | undefined): CategoryMatch & { distance: number | null; activeAxes: RadarAxis[]; axisDifferences: Partial<RadarVector> } {
  const activeAxes = RADAR_AXES.filter((axis) => Number(requested?.[axis] ?? 0) > 0);
  if (!activeAxes.length) return { ...EMPTY_CATEGORY(), distance: null, activeAxes, axisDifferences: {} };
  const axisDifferences = Object.fromEntries(activeAxes.map((axis) => [axis, Math.abs(release.radar[axis] - Math.round(Number(requested?.[axis])))])) as Partial<RadarVector>;
  const differences = activeAxes.map((axis) => axisDifferences[axis] ?? 0);
  const eligible = differences.every((difference) => difference <= 1);
  const distance = differences.reduce((total, difference) => total + difference, 0);
  // Passing the Radar gate is a category match; exactness remains reserved for distance zero.
  const matched = eligible ? activeAxes.length : 0;
  return {
    active: true, matched, required: activeAxes.length, score: eligible ? 1 - distance / activeAxes.length : 0,
    complete: eligible && distance === 0, distance, activeAxes, axisDifferences
  };
}

/** Evaluates one Release without I/O, mutation, UI concerns, or hidden global state. */
export function evaluateReleaseMatch(release: Release, criteria: SearchCriteria = {}): ReleaseMatch {
  const text = textMatch(release, criteria.text);
  const genre = listMatch(release.genres, selected(criteria.genres));
  const country = listMatch(release.countries, selected(criteria.countries));
  const type = criteria.type ? { active: true, matched: release.releaseType === criteria.type ? 1 : 0, required: 1, score: release.releaseType === criteria.type ? 1 : 0, complete: release.releaseType === criteria.type } : EMPTY_CATEGORY();
  const yearText = criteria.year == null ? '' : String(criteria.year).trim();
  const year = yearText ? { active: true, matched: release.releaseDate.year === yearText ? 1 : 0, required: 1, score: release.releaseDate.year === yearText ? 1 : 0, complete: release.releaseDate.year === yearText } : EMPTY_CATEGORY();
  const radar = radarMatch(release, criteria.radar);
  const active = [text, genre, radar, country, type, year].filter((category) => category.active);
  const radarEligible = !radar.active || Object.values(radar.axisDifferences).every((difference) => Number(difference) <= 1);
  const any = active.some((category) => category.matched > 0);
  const exact = active.length > 0 && active.every((category) => category.complete);
  const eligible = radarEligible && (active.length === 0 || any);
  const group = eligible ? (exact ? 'exact' : 'approximate') : null;
  const relevanceVector = [text.score, genre.score, radar.score, country.score, type.score, year.score] as const;
  const reasons = [
    ...text.kinds.map((kind, index) => `text:${index}:${kind}`),
    ...(genre.active ? [`genre:${genre.matched}/${genre.required}`] : []),
    ...(radar.active ? [`radar:${radar.distance};gate:${radarEligible ? 'pass' : 'reject'}`] : []),
    ...(country.active ? [`country:${country.matched}/${country.required}`] : []),
    ...(type.active ? [`type:${type.complete ? 'exact' : 'none'}`] : []),
    ...(year.active ? [`year:${year.complete ? 'exact' : 'none'}`] : [])
  ];
  return { release, eligible, group, categories: { text, genre, radar, country, type, year }, relevanceVector, radarDistance: radar.distance, reasons };
}

/** Evaluates, groups, and orders releases deterministically. Exact results always lead. */
export function matchReleases(releases: readonly Release[], criteria: SearchCriteria = {}): SearchResult {
  const evaluated = releases.map((release) => evaluateReleaseMatch(release, criteria)).filter((match) => match.eligible);
  const order = criteria.order ?? (evaluated.some((match) => match.categories.radar.active) ? 'radar' : 'match');
  const compare = (a: ReleaseMatch, b: ReleaseMatch) => {
    const group = Number(a.group === 'approximate') - Number(b.group === 'approximate');
    if (group) return group;
    if (order === 'fecha-desc') return dateDescending(a, b);
    if (order === 'fecha-asc') return dateAscending(a, b);
    if (order === 'radar') {
      const distance = (a.radarDistance ?? Infinity) - (b.radarDistance ?? Infinity);
      if (distance) return distance;
    }
    return vectorDescending(a.relevanceVector, b.relevanceVector) || dateDescending(a, b);
  };
  const matches = [...evaluated].sort(compare);
  const hasCriteria = Boolean(
    criteria.text?.length || criteria.genres?.length || criteria.countries?.length || criteria.type || criteria.year ||
    RADAR_AXES.some((axis) => Number(criteria.radar?.[axis] ?? 0) > 0)
  );
  return { matches, exact: matches.filter((match) => match.group === 'exact'), approximate: matches.filter((match) => match.group === 'approximate'), hasCriteria };
}
