export const RELEASE_TYPES = ['Álbum', 'EP', 'Single', 'Compilado', 'Sample Pack'] as const;

export type ReleaseType = (typeof RELEASE_TYPES)[number];
export type CreditQuality = 'legacy' | 'proposed' | 'verified';
export type ReleaseSource = 'legacy' | 'canonical';

export interface ArtistCredit {
  id: string | null;
  slug: string | null;
  name: string;
  position: number;
}

export interface ReleaseDateValue {
  iso: string | null;
  display: string;
  year: string;
  month: string;
  timestamp: number;
}

export interface Release {
  /** UUID canónico. Es null únicamente en el adaptador TSV antes de resolver identidad. */
  id: string | null;
  /** Slug canónico o, para TSV sin identidad resuelta, el slug legado calculado. */
  slug: string;
  legacySlug: string | null;
  source: ReleaseSource;
  title: string;
  releaseType: ReleaseType | null;
  releaseDate: ReleaseDateValue;
  primaryArtists: ArtistCredit[];
  collaborators: ArtistCredit[];
  creditQuality: CreditQuality;
  countries: string[];
  genres: string[];
  label: string;
  review: string;
  buyLink: string;
  coverUrl: string;
  radar: {
    experimental: number;
    denso: number;
    sintetico: number;
    bailable: number;
    rapido: number;
  };

  /** Campos de lectura temporales para consumidores visuales pre-E05/E16. */
  artist: string[];
  type: ReleaseType | '';
  country: string[];
  genre: string[];
  release_date: string;
  buy_link: string;
  cover: string;
}

export type CanonicalReleaseRow = {
  id: unknown;
  slug: unknown;
  title: unknown;
  release_date: unknown;
  type: unknown;
  label: unknown;
  review: unknown;
  experimental: unknown;
  denso: unknown;
  sintetico: unknown;
  bailable: unknown;
  rapido: unknown;
  artists: unknown;
  primary_artists?: unknown;
  collaborators?: unknown;
  credit_quality?: unknown;
  genres: unknown;
  countries: unknown;
  buy_link: unknown;
  cover: unknown;
};

export type LegacyReleaseRow = Record<string, unknown>;

const EMPTY_RADAR = Object.freeze({ experimental: 0, denso: 0, sintetico: 0, bailable: 0, rapido: 0 });

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function pad2(value: string | number): string {
  return String(value).padStart(2, '0');
}

function safeUtcTimestamp(year: number, month: number, day: number): number | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? timestamp
    : null;
}

/** Único parser de fechas de catálogo: ISO canónico y DD/MM/YYYY legado. */
export function normalizeReleaseDate(value: unknown): ReleaseDateValue {
  const raw = text(value);
  if (!raw) return { iso: null, display: '', year: '', month: '', timestamp: 0 };

  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestamp = safeUtcTimestamp(year, month, day);
    if (timestamp === null) return { iso: null, display: raw, year: '', month: '', timestamp: 0 };
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    return { iso, display: `${pad2(day)}/${pad2(month)}/${year}`, year: String(year), month: pad2(month), timestamp };
  }

  match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    const timestamp = safeUtcTimestamp(year, month, day);
    if (timestamp === null) return { iso: null, display: raw, year: '', month: '', timestamp: 0 };
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    return { iso, display: `${pad2(day)}/${pad2(month)}/${year}`, year: String(year), month: pad2(month), timestamp };
  }

  return { iso: null, display: raw, year: '', month: '', timestamp: 0 };
}

export function normalizeReleaseType(value: unknown): ReleaseType | null {
  const normalized = text(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (normalized === 'disco' || normalized === 'album') return 'Álbum';
  if (normalized === 'ep') return 'EP';
  if (normalized === 'single') return 'Single';
  if (normalized === 'compilado') return 'Compilado';
  if (normalized === 'sample pack') return 'Sample Pack';
  return null;
}

export function slugifyReleaseIdentity(value: unknown): string {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Compatibilidad exclusiva con URLs TSV antiguas. No usar para escrituras nuevas. */
export function legacyReleaseSlug(title: unknown, firstArtist: unknown): string {
  return slugifyReleaseIdentity(`${text(title)}-${text(firstArtist)}`);
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const raw = text(value);
  return raw ? raw.split(',').map(text).filter(Boolean) : [];
}

function radarValue(value: unknown): number {
  const number = Number(text(value));
  return Number.isFinite(number) ? Math.max(0, Math.min(5, Math.round(number))) : 0;
}

function creditQuality(value: unknown): CreditQuality {
  return value === 'proposed' || value === 'verified' ? value : 'legacy';
}

function canonicalCredits(value: unknown): ArtistCredit[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const name = text(item.name);
      if (!name) return null;
      const position = Number(item.position);
      return {
        id: text(item.id) || null,
        slug: text(item.slug) || null,
        name,
        position: Number.isInteger(position) && position >= 0 ? position : index
      } satisfies ArtistCredit;
    })
    .filter((entry): entry is ArtistCredit => Boolean(entry))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'es'));
}

function legacyCredits(value: unknown): ArtistCredit[] {
  return list(value).map((name, position) => ({ id: null, slug: slugifyReleaseIdentity(name), name, position }));
}

function withCompatibilityFields(release: Omit<Release, 'artist' | 'type' | 'country' | 'genre' | 'release_date' | 'buy_link' | 'cover'>): Release {
  return {
    ...release,
    artist: release.primaryArtists.map((credit) => credit.name),
    type: release.releaseType ?? '',
    country: release.countries,
    genre: release.genres,
    release_date: release.releaseDate.display,
    buy_link: release.buyLink,
    cover: release.coverUrl
  };
}

export function adaptCanonicalRelease(row: CanonicalReleaseRow): Release {
  const primaryArtists = canonicalCredits(row.primary_artists);
  const fallbackArtists = primaryArtists.length ? primaryArtists : legacyCredits(row.artists);
  const releaseDate = normalizeReleaseDate(row.release_date);
  const releaseType = normalizeReleaseType(row.type);
  return withCompatibilityFields({
    id: text(row.id) || null,
    slug: text(row.slug),
    legacySlug: null,
    source: 'canonical',
    title: text(row.title),
    releaseType,
    releaseDate,
    primaryArtists: fallbackArtists,
    collaborators: canonicalCredits(row.collaborators),
    creditQuality: creditQuality(row.credit_quality),
    countries: list(row.countries),
    genres: list(row.genres),
    label: text(row.label),
    review: text(row.review),
    buyLink: text(row.buy_link),
    coverUrl: text(row.cover),
    radar: {
      experimental: radarValue(row.experimental),
      denso: radarValue(row.denso),
      sintetico: radarValue(row.sintetico),
      bailable: radarValue(row.bailable),
      rapido: radarValue(row.rapido)
    }
  });
}

export function adaptLegacyRelease(row: LegacyReleaseRow): Release {
  const primaryArtists = legacyCredits(row.artist);
  const slug = legacyReleaseSlug(row.title, primaryArtists[0]?.name);
  return withCompatibilityFields({
    id: null,
    slug,
    legacySlug: slug,
    source: 'legacy',
    title: text(row.title),
    releaseType: normalizeReleaseType(row.type),
    releaseDate: normalizeReleaseDate(row.release_date),
    primaryArtists,
    collaborators: [],
    creditQuality: 'legacy',
    countries: list(row.country),
    genres: list(row.genre),
    label: text(row.label),
    review: text(row.review),
    buyLink: text(row.buy_link),
    coverUrl: text(row.cover),
    radar: {
      experimental: radarValue(row.experimental ?? row.radar_experimental ?? EMPTY_RADAR.experimental),
      denso: radarValue(row.denso ?? row.radar_denso ?? EMPTY_RADAR.denso),
      sintetico: radarValue(row.sintetico ?? row.sintetico_ ?? row.radar_sintetico ?? EMPTY_RADAR.sintetico),
      bailable: radarValue(row.bailable ?? row.bailable_ ?? row.radar_bailable ?? EMPTY_RADAR.bailable),
      rapido: radarValue(row.rapido ?? row.rapido_ ?? row.radar_rapido ?? EMPTY_RADAR.rapido)
    }
  });
}

export function allArtistCredits(release: Release): ArtistCredit[] {
  return [...release.primaryArtists, ...release.collaborators];
}

export function releaseHasArtistSlug(release: Release, slug: string): boolean {
  const wanted = text(slug);
  return allArtistCredits(release).some((credit) => (credit.slug || slugifyReleaseIdentity(credit.name)) === wanted);
}

export function findArtistCredit(release: Release, slug: string): ArtistCredit | null {
  const wanted = text(slug);
  return allArtistCredits(release).find((credit) => (credit.slug || slugifyReleaseIdentity(credit.name)) === wanted) ?? null;
}

export const VARIOUS_ARTISTS_LABEL = 'Varios artistas';

export interface ReleaseCreditSummary {
  /** true solo cuando el tipo es Compilado; nunca por número de artistas. */
  various: boolean;
  /** Créditos que se muestran por nombre (todos los principales; si no hay, los colaboradores). */
  names: ArtistCredit[];
  /** Cuántos colaboradores quedan fuera de `names`: alimenta "y N más". */
  moreCount: number;
  /** "y N más" o '' (con N = moreCount). */
  moreLabel: string;
  /** Texto plano completo: "Varios artistas", "A, B" o "A, B y 2 más". Sin truncar. */
  label: string;
  /** Principales y colaboradores, para menús y vistas completas. */
  credits: ArtistCredit[];
}

/**
 * Regla única de créditos para tarjeta, ficha y recomendaciones.
 * - Compilado: "Varios artistas".
 * - Otro tipo: todos los principales por nombre y, con colaboradores, "y N más".
 * El truncado de nombres largos es de presentación y no vive aquí.
 */
export function summarizeReleaseCredits(release: Pick<Release, 'releaseType' | 'primaryArtists' | 'collaborators'>): ReleaseCreditSummary {
  const primary = release.primaryArtists ?? [];
  const collaborators = release.collaborators ?? [];
  const credits = [...primary, ...collaborators];
  const various = release.releaseType === 'Compilado';
  const names = primary.length ? primary : collaborators;
  const moreCount = primary.length ? collaborators.length : 0;
  const moreLabel = moreCount > 0 ? `y ${moreCount} más` : '';
  const joined = names.map((credit) => credit.name).join(', ');
  return {
    various,
    names,
    moreCount,
    moreLabel,
    label: various ? VARIOUS_ARTISTS_LABEL : [joined, moreLabel].filter(Boolean).join(' '),
    credits
  };
}

export function releaseArtistPresentation(release: Release): { label: string; credits: ArtistCredit[] } {
  const { label, credits } = summarizeReleaseCredits(release);
  return { label, credits };
}
