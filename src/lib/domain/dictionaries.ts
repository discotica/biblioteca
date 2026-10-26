/**
 * Diccionarios del Estudio (U19, G4): géneros, países, sellos y artistas en
 * /estudio/diccionarios, solo para admin. Aquí viven las pestañas y filtros de
 * la URL, qué operación admite cada diccionario, los textos de cada
 * consecuencia y la traducción de los errores del servidor. Sin Svelte ni
 * Supabase, para probarlo en node.
 *
 * Los permisos y las comprobaciones están en la base
 * (20261016180000_u19_g4_dictionaries.sql); estas reglas solo deciden qué se
 * ofrece.
 */

export type DictionaryKind = 'genre' | 'country' | 'label' | 'artist';
export type DictionaryStatus = 'selectable' | 'legacy' | 'retired';
export type DictionaryFilter = 'all' | 'orphans' | DictionaryStatus;

export type DictionaryItem = {
  id: string;
  name: string;
  slug: string;
  /** Solo géneros y países. */
  status: DictionaryStatus | null;
  /** Lanzamientos de cualquier estado. */
  release_count: number;
  published_count: number;
  aliases: string[];
  /** URL viejas que redirigen (artistas y sellos). */
  slug_aliases: string[];
  /** Slug de la página pública (artistas y sellos). */
  public_slug: string | null;
};

export type DictionaryCounts = Record<DictionaryFilter, number>;

export type DictionaryPage = {
  kind: DictionaryKind;
  filter: DictionaryFilter;
  page: number;
  page_size: number;
  total: number;
  counts: DictionaryCounts;
  items: DictionaryItem[];
};

export const DICTIONARIES_BASE = '/estudio/diccionarios';

export const DICTIONARY_TABS: ReadonlyArray<{ kind: DictionaryKind; slug: string; label: string; singular: string }> = [
  { kind: 'genre', slug: 'generos', label: 'Géneros', singular: 'género' },
  { kind: 'country', slug: 'paises', label: 'Países', singular: 'país' },
  { kind: 'label', slug: 'sellos', label: 'Sellos', singular: 'sello' },
  { kind: 'artist', slug: 'artistas', label: 'Artistas', singular: 'artista' }
];

const tab = (kind: DictionaryKind) => DICTIONARY_TABS.find((entry) => entry.kind === kind)!;

/** Pestaña de la URL (?tipo=); por defecto, Géneros. */
export function dictionaryKindFromSlug(slug: string | null | undefined): DictionaryKind {
  return DICTIONARY_TABS.find((entry) => entry.slug === slug)?.kind ?? 'genre';
}

export function dictionaryLabel(kind: DictionaryKind): string {
  return tab(kind).label;
}

export function dictionarySingular(kind: DictionaryKind): string {
  return tab(kind).singular;
}

/** Géneros y países tienen estado y se crean aquí; sellos y artistas se crean al guardar un lanzamiento. */
export function hasStatus(kind: DictionaryKind): boolean {
  return kind === 'genre' || kind === 'country';
}

export type DictionaryCapabilities = { create: boolean; status: boolean; deleteOrphans: boolean };

export function dictionaryCapabilities(kind: DictionaryKind): DictionaryCapabilities {
  const closed = hasStatus(kind);
  return { create: closed, status: closed, deleteOrphans: !closed };
}

const FILTER_SLUGS: Record<DictionaryFilter, string | null> = {
  all: null,
  orphans: 'sin-lanzamientos',
  selectable: 'seleccionables',
  legacy: 'legado',
  retired: 'retirados'
};

const FILTER_LABELS: Record<DictionaryFilter, string> = {
  all: 'Todos',
  orphans: 'Sin lanzamientos',
  selectable: 'Seleccionables',
  legacy: 'Legado',
  retired: 'Retirados'
};

/** Filtros de la pestaña, en el orden del selector. */
export function dictionaryFilters(kind: DictionaryKind): DictionaryFilter[] {
  return hasStatus(kind) ? ['all', 'selectable', 'legacy', 'retired', 'orphans'] : ['all', 'orphans'];
}

export function dictionaryFilterLabel(filter: DictionaryFilter): string {
  return FILTER_LABELS[filter];
}

/** Filtro de la URL (?filtro=); uno que la pestaña no tiene vuelve a Todos. */
export function dictionaryFilterFromSlug(kind: DictionaryKind, slug: string | null | undefined): DictionaryFilter {
  const filter = (Object.keys(FILTER_SLUGS) as DictionaryFilter[]).find((key) => FILTER_SLUGS[key] === slug) ?? 'all';
  return dictionaryFilters(kind).includes(filter) ? filter : 'all';
}

export function dictionaryFilterSlug(filter: DictionaryFilter): string | null {
  return FILTER_SLUGS[filter];
}

/** Una pestaña, opcionalmente con filtro y búsqueda. Géneros sin filtro es /estudio/diccionarios. */
export function dictionariesHref(kind: DictionaryKind = 'genre', filter: DictionaryFilter = 'all', query = ''): string {
  const params = new URLSearchParams();
  if (kind !== 'genre') params.set('tipo', tab(kind).slug);
  const filterSlug = FILTER_SLUGS[filter];
  if (filterSlug) params.set('filtro', filterSlug);
  if (query.trim()) params.set('q', query.trim());
  const search = params.toString();
  return `${DICTIONARIES_BASE}${search ? `?${search}` : ''}`;
}

export const STATUS_LABELS: Record<DictionaryStatus, string> = {
  selectable: 'Seleccionable',
  legacy: 'Legado',
  retired: 'Retirado'
};

/** El estado normal no se resalta: la mayoría de la lista es seleccionable. */
export const STATUS_TONES: Record<DictionaryStatus, 'neutral' | 'warning' | 'danger'> = {
  selectable: 'neutral',
  legacy: 'warning',
  retired: 'danger'
};

/** Qué significa cada estado, en la ayuda de la pestaña y del diálogo. */
export const STATUS_HELP: Record<DictionaryStatus, string> = {
  selectable: 'Se ofrece en Sugerir y en el editor.',
  legacy: 'Se conserva en sus lanzamientos y la hoja lo acepta, pero no se ofrece.',
  retired: 'Se conserva hasta que la hoja lo corrija; nadie lo acepta de nuevo.'
};

/** Página pública del valor: la ficha de artista o de sello. Géneros y países no tienen. */
export function dictionaryPublicHref(kind: DictionaryKind, item: Pick<DictionaryItem, 'public_slug'>): string | null {
  if (!item.public_slug) return null;
  if (kind === 'artist') return `/artista/${item.public_slug}`;
  if (kind === 'label') return `/sello/${item.public_slug}`;
  return null;
}

export function releaseCountText(count: number): string {
  return count === 1 ? '1 lanzamiento' : `${count.toLocaleString('es-CO')} lanzamientos`;
}

/** «3 lanzamientos · 2 publicados»: el total cuenta borradores y archivados. */
export function releaseTally(item: Pick<DictionaryItem, 'release_count' | 'published_count'>): string {
  if (!item.release_count) return 'Sin lanzamientos';
  if (item.published_count === item.release_count) return releaseCountText(item.release_count);
  const published = `${item.published_count.toLocaleString('es-CO')} ${item.published_count === 1 ? 'publicado' : 'publicados'}`;
  return `${releaseCountText(item.release_count)} · ${published}`;
}

/** Misma clave que el servidor: sin mayúsculas, tildes ni espacios de más. */
export function dictionaryKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').normalize('NFC').toLowerCase()
    .replace(/[áàäâãå]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c');
}

/** Lo que pasa al renombrar, antes de confirmar. */
export function renameConsequence(kind: DictionaryKind, current: string, next: string): string[] {
  const name = next.trim().replace(/\s+/g, ' ');
  if (!name || name === current) return [];
  const lines = [`«${current}» pasa a llamarse «${name}» en todos sus lanzamientos.`];
  if (dictionaryKey(name) !== dictionaryKey(current)) {
    lines.push(`«${current}» queda como alias: la hoja y Sugerir lo traducen a «${name}».`);
  }
  if (kind === 'artist' || kind === 'label') lines.push('Su URL vieja redirige a la nueva.');
  return lines;
}

/** Lo que pasa al fusionar, antes de confirmar. */
export function mergeConsequence(kind: DictionaryKind, source: Pick<DictionaryItem, 'name' | 'release_count'>, target: string): string[] {
  const moved = source.release_count
    ? `${source.release_count === 1 ? 'Su lanzamiento pasa' : `Sus ${source.release_count.toLocaleString('es-CO')} lanzamientos pasan`} a «${target}».`
    : `No tiene lanzamientos; solo queda su grafía.`;
  const lines = [moved, `«${source.name}» deja de existir y queda como alias de «${target}».`];
  if (kind === 'artist' || kind === 'label') lines.push(`La URL de «${source.name}» redirige a la de «${target}».`);
  if (kind === 'artist') lines.push('Si un lanzamiento tiene a los dos, queda uno; si uno era principal, queda como principal.');
  return lines;
}

/** Resumen del aviso tras cada operación. */
export function mergeDoneText(source: string, target: string, releaseCount: number): string {
  return `«${source}» se fusionó en «${target}»${releaseCount ? ` (${releaseCountText(releaseCount)})` : ''}. Su grafía queda como alias.`;
}

export function deleteDoneText(kind: DictionaryKind, names: string[]): string {
  if (names.length === 1) return `Se borró «${names[0]}».`;
  return `Se borraron ${names.length} ${kind === 'artist' ? 'artistas' : 'sellos'} sin lanzamientos.`;
}

type ServerError = { code?: string; message?: string; details?: string | null } | null | undefined;

/** Error del servidor en lenguaje del equipo, nunca con su código. */
export function describeDictionaryError(error: ServerError): string {
  const details = String(error?.details ?? '').trim();
  switch (error?.message) {
    case 'reason_required':
      return 'Escribe la observación del cambio.';
    case 'dictionary_name_invalid':
      return 'El nombre no puede estar vacío ni pasar de 160 caracteres.';
    case 'dictionary_value_exists':
      return `Ya existe «${details}». Para unirlos, usa «Fusionar con…».`;
    case 'dictionary_alias_exists':
      return `Ese nombre ya es un alias de «${details}». Elige otro o fusiónalos.`;
    case 'dictionary_value_in_use':
      return `No se borró nada: ${details} ${details.includes(',') ? 'tienen' : 'tiene'} lanzamientos.`;
    case 'dictionary_value_not_found':
      return 'Este valor ya no existe. Recarga la lista.';
    case 'merge_same_value':
      return 'Elige otro valor para conservar.';
    case 'dictionary_batch_invalid':
      return 'Se pueden borrar hasta 200 a la vez.';
  }
  if (error?.code === '42501') return 'Solo administración puede cambiar los diccionarios.';
  // PostgREST no encuentra el RPC: la migración de G4 aún no está en este entorno (staging la recibe en G5).
  if (error?.code === 'PGRST202') return 'Este entorno todavía no tiene la pantalla de diccionarios: falta aplicar su migración (U19 G4).';
  return 'El servidor no aceptó el cambio. Inténtalo de nuevo.';
}
