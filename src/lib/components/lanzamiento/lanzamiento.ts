/**
 * Datos y enlaces de la tarjeta y la fila de lanzamiento (U8). Puros: no leen
 * la página ni el DOM. Quien los usa pasa la búsqueda actual (`$page.url.search`).
 */
import { normalizeReleaseDate, type ArtistCredit, type Release } from '$lib/domain/releases';
import { createSearchState, parseSearchState, serializeSearchState } from '$lib/domain/searchState';
import { removeBetaInvitationParams, withoutBetaInvitationSearch } from '$lib/domain/betaInvitation';
import { slugify } from '$lib/utils/slugify';
import { slugFromLanzamiento } from '$lib/utils/slugLanzamiento';

/** Dominio público de los enlaces compartidos (el mismo de la ficha). */
export const SHARE_ORIGIN = 'https://biblioteca.discotica.com';

/** Géneros visibles en la tarjeta y la fila; el resto se resume en "+N". */
export const VISIBLE_GENRES = 3;

/** Lo que pintan la tarjeta y la fila, normalizado una vez. */
export type ReleaseSummary = {
  slug: string;
  title: string;
  cover: string;
  year: string;
  /** Primer país: la tarjeta muestra uno. */
  country: string;
  label: string;
  genres: string[];
  moreGenres: string[];
  radar: Release['radar'];
};

const text = (value: unknown) => (value ?? '').toString().trim();
const list = (value: unknown): string[] =>
  (Array.isArray(value) ? value : value ? [value] : []).map(text).filter(Boolean);

export function summarizeRelease(release: Partial<Release> | null | undefined): ReleaseSummary {
  const genres = list(release?.genres?.length ? release.genres : release?.genre);
  return {
    slug: release ? slugFromLanzamiento(release) : '',
    title: text(release?.title),
    cover: text(release?.coverUrl || release?.cover),
    year: release?.releaseDate?.year || normalizeReleaseDate(release?.release_date).year,
    country: list(release?.countries?.length ? release.countries : release?.country)[0] ?? '',
    label: text(release?.label),
    genres: genres.slice(0, VISIBLE_GENRES),
    moreGenres: genres.slice(VISIBLE_GENRES),
    radar: {
      experimental: Number(release?.radar?.experimental ?? 0),
      denso: Number(release?.radar?.denso ?? 0),
      sintetico: Number(release?.radar?.sintetico ?? 0),
      bailable: Number(release?.radar?.bailable ?? 0),
      rapido: Number(release?.radar?.rapido ?? 0)
    }
  };
}

/** La búsqueda que acompaña a los enlaces internos: los filtros sí, la invitación beta no. */
export const carriedSearch = (search: string) => withoutBetaInvitationSearch(search);

export const releaseHref = (slug: string, search: string) => `/lanzamiento/${slug}${carriedSearch(search)}`;

export const labelHref = (label: string, search: string) => `/sello/${slugify(label)}${carriedSearch(search)}`;

export function artistHref(search: string) {
  // E03: un crédito solo enlaza con el slug que entrega el catálogo.
  return (credit: ArtistCredit) => (credit.slug ? `/artista/${credit.slug}${carriedSearch(search)}` : null);
}

/**
 * Catálogo filtrado por un país o un género, conservando el resto de la
 * búsqueda y volviendo a la página 1 sin ficha abierta.
 */
export function filterHref(kind: 'pais' | 'genero', value: string, search: string): string {
  const parsed = parseSearchState(search);
  const state = createSearchState({
    ...parsed.state,
    [kind === 'pais' ? 'countries' : 'genres']: value ? [value] : [],
    page: 1,
    modal: null
  });
  const query = serializeSearchState(state, removeBetaInvitationParams(parsed.unknown)).toString();
  return query ? `/?${query}` : '/';
}

export const shareUrl = (slug: string) => `${SHARE_ORIGIN}/lanzamiento/${slug}`;

/** Clic que el navegador debe resolver solo: otra pestaña, otra ventana, descarga. */
export const isModifiedClick = (event: MouseEvent) =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
