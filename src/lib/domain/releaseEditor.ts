/**
 * Editor de lanzamientos del Estudio (U16), sin Svelte ni Supabase para
 * probarlo en node: secciones del índice, qué falta para publicar y en qué
 * sección, la validación previa a guardar y cómo se lee el historial.
 *
 * Las reglas son las de E07 sin cambios; el servidor (E06) las repite y es
 * quien decide. Aquí solo se reparten por sección para el índice.
 */
import type { CatalogHistory, CatalogSnapshot } from '../services/adminCatalog';

export type EditorSectionId = 'datos' | 'creditos' | 'clasificacion' | 'medios' | 'historial' | 'propuesta';
export type EditorSection = { id: EditorSectionId; label: string };

const FORM_SECTIONS: ReadonlyArray<EditorSection> = [
  { id: 'datos', label: 'Datos' },
  { id: 'creditos', label: 'Créditos' },
  { id: 'clasificacion', label: 'Clasificación' },
  { id: 'medios', label: 'Medios' }
];

/** Editor del catálogo: el formulario y el historial auditado. */
export const EDITOR_SECTIONS: ReadonlyArray<EditorSection> = [...FORM_SECTIONS, { id: 'historial', label: 'Historial' }];

/** U19: el mismo editor con una propuesta abierta. En lugar del historial, la propuesta. */
export const PROPOSAL_EDITOR_SECTIONS: ReadonlyArray<EditorSection> = [...FORM_SECTIONS, { id: 'propuesta', label: 'Propuesta' }];

/** Id del elemento de cada sección en la página (ancla del índice). */
export const editorSectionAnchor = (id: EditorSectionId) => `editor-${id}`;

/** Nombre de cada campo pendiente y la sección donde se completa. */
const MISSING_SECTION: Record<string, EditorSectionId> = {
  Título: 'datos',
  'Identificador interno': 'datos',
  Fecha: 'datos',
  Tipo: 'datos',
  Sello: 'datos',
  'Artista principal': 'creditos',
  Género: 'clasificacion',
  País: 'clasificacion',
  Portada: 'medios',
  'Link de compra': 'medios'
};

const isHttps = (url: string | null | undefined) => !!url && /^https:\/\//i.test(url);

/** El enlace principal de compra o escucha (E07: uno como máximo). */
export function primaryLink(snapshot: Pick<CatalogSnapshot, 'links'> | null) {
  return snapshot?.links.find((link) => link.is_primary) ?? null;
}

/**
 * Lo que falta para publicar, con los nombres de E07 y en su orden. Es la
 * regla de publicación de E06: título, identificador, fecha, tipo, sello, un
 * artista principal, un género, un país, portada HTTPS y exactamente un
 * enlace principal HTTPS con proveedor.
 */
export function missingFields(snapshot: CatalogSnapshot): string[] {
  const missing: string[] = [];
  if (!snapshot.title.trim()) missing.push('Título');
  if (!snapshot.slug.trim()) missing.push('Identificador interno');
  if (!snapshot.release_date) missing.push('Fecha');
  if (!snapshot.release_type_id) missing.push('Tipo');
  if (!snapshot.label_id) missing.push('Sello');
  if (!snapshot.artist_ids.length) missing.push('Artista principal');
  if (!snapshot.genre_ids.length) missing.push('Género');
  if (!snapshot.country_ids.length) missing.push('País');
  if (!isHttps(snapshot.cover_url)) missing.push('Portada');
  const primary = snapshot.links.filter((link) => link.is_primary);
  if (primary.length !== 1 || !primary[0].provider.trim() || !isHttps(primary[0].url)) missing.push('Link de compra');
  return missing;
}

/** Los mismos pendientes, repartidos por la sección del índice que los resuelve. */
export function missingBySection(snapshot: CatalogSnapshot): Record<EditorSectionId, string[]> {
  const result: Record<EditorSectionId, string[]> = { datos: [], creditos: [], clasificacion: [], medios: [], historial: [], propuesta: [] };
  for (const field of missingFields(snapshot)) result[MISSING_SECTION[field] ?? 'datos'].push(field);
  return result;
}

/**
 * Lo que impide guardar (o publicar, con `publishing`), como una frase, o ''.
 * Mismos mensajes y orden que E07.
 */
export function validateRelease(snapshot: CatalogSnapshot, publishing = false): string {
  if (!snapshot.title.trim()) return 'El título es obligatorio.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-z0-9]+)?$/.test(snapshot.slug)) return 'No pudimos generar el identificador interno. Revisa el título.';
  if (!snapshot.artist_ids.length) return 'Selecciona al menos un artista principal.';
  if (snapshot.artist_ids.some((id) => snapshot.collaborator_ids.includes(id))) return 'Un artista no puede ser principal y colaborador a la vez.';
  const missing = missingFields(snapshot);
  if (publishing && missing.length) return `Completa antes de publicar: ${missing.join(', ')}.`;
  if (snapshot.cover_url && !isHttps(snapshot.cover_url)) return 'La portada debe usar HTTPS.';
  if (snapshot.links.some((link) => !link.provider.trim() || !isHttps(link.url))) return 'Cada enlace requiere proveedor y una URL HTTPS válida.';
  if (snapshot.links.filter((link) => link.is_primary).length > 1) return 'Solo puede haber un enlace principal.';
  return '';
}

/** Proveedor del enlace principal, deducido de la URL (E07). */
export function inferProvider(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('bandcamp.com')) return 'Bandcamp';
    if (host.includes('spotify.com')) return 'Spotify';
    if (host.includes('soundcloud.com')) return 'SoundCloud';
  } catch {
    // Una URL a medio escribir: la validación avisa al guardar.
  }
  return 'Enlace';
}

/**
 * Los enlaces con el principal cambiado a `url`: lo crea al principio, lo
 * reemplaza o, con la URL vacía, lo quita. Los demás enlaces no se tocan.
 */
export function withPrimaryLink(links: CatalogSnapshot['links'], url: string): CatalogSnapshot['links'] {
  const provider = inferProvider(url);
  const index = links.findIndex((link) => link.is_primary);
  if (index < 0) return url ? [{ provider, url, is_primary: true }, ...links] : links;
  if (!url) return links.filter((_, position) => position !== index);
  return links.map((link, position) => (position === index ? { provider, url, is_primary: true } : link));
}

/**
 * Mueve créditos dentro de un grupo o entre grupos, o los añade. `ids` va al
 * grupo `target` delante de `before` (o al final): primero los que ya estaban,
 * en su orden, y después los nuevos. Ningún artista queda en los dos grupos.
 */
export function moveCredits(
  credits: { artist_ids: string[]; collaborator_ids: string[] },
  ids: string[],
  target: 'artist_ids' | 'collaborator_ids',
  before: string | null = null
): { artist_ids: string[]; collaborator_ids: string[] } {
  const present = [...credits.artist_ids, ...credits.collaborator_ids];
  const moving = [
    ...present.filter((id, index) => ids.includes(id) && present.indexOf(id) === index),
    ...ids.filter((id, index) => id && !present.includes(id) && ids.indexOf(id) === index)
  ];
  if (!moving.length) return credits;
  const rest = {
    artist_ids: credits.artist_ids.filter((id) => !moving.includes(id)),
    collaborator_ids: credits.collaborator_ids.filter((id) => !moving.includes(id))
  };
  const list = rest[target];
  const at = before && !moving.includes(before) ? list.indexOf(before) : -1;
  rest[target] = at < 0 ? [...list, ...moving] : [...list.slice(0, at), ...moving, ...list.slice(at)];
  return rest;
}

// ---------------------------------------------------------------------------
// Nombres nuevos (U19): un artista o un sello que no existe se escribe como nombre y se crea al
// guardar (catálogo) o al aceptar (propuesta). En el formulario ocupa el lugar de un UUID con el
// prefijo «nuevo:», así el orden de los créditos, lo que falta para publicar y los cambios sin
// guardar funcionan igual. Nunca llega así al servidor: `withPendingNames` lo traduce.

const PENDING_PREFIX = 'nuevo:';

export const pendingId = (name: string) => `${PENDING_PREFIX}${name.replace(/\s+/g, ' ').trim()}`;
export const isPendingId = (id: string | null | undefined): id is string => typeof id === 'string' && id.startsWith(PENDING_PREFIX);
export const pendingName = (id: string) => id.slice(PENDING_PREFIX.length);

/**
 * El payload del catálogo con los nombres nuevos en la forma de admin_update_catalog_release (G3):
 * los créditos nuevos como `{ name }` en su posición y el sello nuevo como `label_name`.
 */
export function withPendingNames<T extends { artist_ids: string[]; collaborator_ids: string[]; label_id: string | null }>(value: T) {
  const credit = (id: string) => (isPendingId(id) ? { name: pendingName(id) } : id);
  const { label_id, ...rest } = value;
  return {
    ...rest,
    artist_ids: value.artist_ids.map(credit),
    collaborator_ids: value.collaborator_ids.map(credit),
    label_id: isPendingId(label_id) ? null : label_id,
    ...(isPendingId(label_id) ? { label_name: pendingName(label_id) } : {})
  };
}

/**
 * RC2-P1-01: une la lista compartida de artistas con lo que acaba de llegar, por id y sin
 * repetir. Quien la llama tiene que leer la lista después del `await`: dos cargas que se cruzan
 * ya no se pisan.
 */
export function mergeById<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const known = new Set(current.map((entry) => entry.id));
  const fresh = incoming.filter((entry) => !known.has(entry.id) && known.add(entry.id));
  return fresh.length ? [...current, ...fresh] : (current as T[]);
}

// ---------------------------------------------------------------------------
// Historial

/** Nombre de cada operación auditada (E06), en palabras. */
export const OPERATION_LABELS: Record<string, string> = {
  create: 'Alta',
  update: 'Edición',
  publish: 'Publicación',
  archive: 'Archivo',
  revert: 'Reversión',
  slug_redirect: 'Cambio de identificador'
};

/** Nombre de cada campo del snapshot en el historial. */
export const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  slug: 'Identificador',
  release_date: 'Fecha',
  release_type_id: 'Tipo',
  label_id: 'Sello',
  review: 'Reseña',
  status: 'Estado',
  credit_quality: 'Calidad de créditos',
  artist_ids: 'Artistas principales',
  collaborator_ids: 'Colaboradores',
  genre_ids: 'Géneros',
  country_ids: 'Países',
  radar: 'Radar',
  links: 'Enlaces',
  cover_url: 'Portada',
  updated_at: 'Fecha de edición',
  source: 'Procedencia'
};

export const operationLabel = (operation: string) => OPERATION_LABELS[operation] ?? operation;

/** Campos que cambiaron en una entrada del historial, con su nombre. Sin la versión. */
export function changedFields(entry: Pick<CatalogHistory, 'before_state' | 'after_state'>): string[] {
  const before = entry.before_state ?? {};
  const after = entry.after_state ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => key !== 'catalog_version' && key !== 'updated_at' && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => FIELD_LABELS[key] ?? key.replaceAll('_', ' '));
}
