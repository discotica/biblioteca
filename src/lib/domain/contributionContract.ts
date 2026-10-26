// U19 (G1): contrato v3 de la propuesta y lectura de los errores del servidor. El servidor manda:
// estos tipos y mensajes solo traducen lo que devuelven los RPC documentados en
// docs/modernizacion/u19-estudio-flujo-2026-10-15.md.

export const RADAR_AXES = ['experimental', 'denso', 'sintetico', 'bailable', 'rapido'] as const;
export type RadarAxis = (typeof RADAR_AXES)[number];
export type ContributionRadar = Record<RadarAxis, number>;

export type ReleaseTypeSlug = 'album' | 'ep' | 'single' | 'compilado' | 'sample-pack';

/**
 * Propuesta v3. Artistas y sello van por nombre (si no existen se crean al aceptar); géneros y
 * países, por nombre de la lista seleccionable. `review` y `cover_url` solo los cambia admin.
 */
export interface ContributionPayloadV3 {
  version: 3;
  title: string;
  primary_artists: string[];
  collaborators: string[];
  release_type: ReleaseTypeSlug | '';
  release_date: string;
  genres: string[];
  countries: string[];
  label: string;
  radar?: ContributionRadar;
  team_note?: string;
  review?: string;
  cover_url?: string;
}

/** Respuesta de `check_source_duplicate`. */
export interface SourceDuplicate {
  match: 'none' | 'catalog' | 'queue';
  /** Estado del lanzamiento (`draft`, `published`, `archived`) o de la propuesta. */
  state: string | null;
  /** Solo si el lanzamiento está publicado. */
  release_slug: string | null;
  /** Solo para admin. */
  release_id: string | null;
  /** Solo para el autor de la propuesta o admin. */
  contribution_id: string | null;
}

/** Respuesta de `accept_contribution` y `admin_create_draft_from_suggestion`. */
export interface CatalogCreation {
  release_id: string;
  release_slug: string;
  status: 'draft' | 'published';
  catalog_version: number;
  change_set_id: string;
  contribution_id?: string;
}

export type ContributionErrorField =
  | 'title'
  | 'primary_artists'
  | 'collaborators'
  | 'release_type'
  | 'release_date'
  | 'genres'
  | 'countries'
  | 'label'
  | 'radar'
  | 'team_note'
  | 'review'
  | 'cover_url';

interface ErrorCopy {
  field: ContributionErrorField | null;
  text: (detail: string) => string;
}

const quoted = (detail: string) => (detail ? `«${detail}»` : 'Ese valor');

// Mensajes de los RPC v3 (campo `message` del error). Los que traen un valor lo mandan en `details`.
const ERRORS: Record<string, ErrorCopy> = {
  genre_not_selectable: { field: 'genres', text: (d) => `${quoted(d)} no está en la lista de géneros.` },
  country_not_selectable: { field: 'countries', text: (d) => `${quoted(d)} no está en la lista de países.` },
  genres_required: { field: 'genres', text: () => 'Elige al menos un género.' },
  countries_required: { field: 'countries', text: () => 'Elige al menos un país.' },
  label_required: { field: 'label', text: () => 'El sello es obligatorio. Si es autoeditado, elige «Independiente».' },
  label_invalid: { field: 'label', text: () => 'El sello tiene hasta 160 caracteres.' },
  title_required: { field: 'title', text: () => 'El título es obligatorio.' },
  title_invalid: { field: 'title', text: () => 'El título tiene hasta 300 caracteres.' },
  primary_artists_required: { field: 'primary_artists', text: () => 'Añade al menos un artista principal.' },
  primary_artists_invalid: { field: 'primary_artists', text: () => 'Cada artista tiene de 1 a 160 caracteres.' },
  collaborators_invalid: { field: 'collaborators', text: () => 'Cada artista tiene de 1 a 160 caracteres.' },
  credit_in_both_groups: { field: 'collaborators', text: () => 'Un artista no puede ser principal y colaborador a la vez.' },
  release_type_required: { field: 'release_type', text: () => 'Confirma el tipo de lanzamiento.' },
  release_type_invalid: { field: 'release_type', text: () => 'Ese tipo de lanzamiento no existe.' },
  release_date_required: { field: 'release_date', text: () => 'La fecha de lanzamiento es obligatoria.' },
  release_date_invalid: { field: 'release_date', text: () => 'La fecha no es válida.' },
  radar_invalid: { field: 'radar', text: () => 'El radar lleva los cinco ejes, de 0 a 5.' },
  team_note_invalid: { field: 'team_note', text: () => 'La nota tiene hasta 4000 caracteres.' },
  cover_url_invalid: { field: 'cover_url', text: () => 'La portada usa una URL HTTPS.' },
  field_not_allowed: { field: null, text: () => 'Solo admin cambia la reseña y la portada.' },
  contribution_taken: { field: null, text: () => 'El equipo ya está revisando esta propuesta y ya no se puede editar.' },
  contribution_version_conflict: {
    field: null,
    text: () => 'Alguien guardó esta propuesta después de que la abriste. Recarga para ver la versión actual.'
  },
  payload_invalid: { field: null, text: () => 'La propuesta no tiene el formato esperado.' },
  payload_version_invalid: { field: null, text: () => 'La propuesta no tiene el formato esperado.' }
};

export interface ContributionError {
  field: ContributionErrorField | null;
  message: string;
}

/**
 * Traduce un error de los RPC de propuestas. Devuelve null si no es uno de los errores v3
 * conocidos (la interfaz muestra entonces su mensaje genérico).
 */
export function describeContributionError(error: { message?: string; details?: string | null } | null | undefined): ContributionError | null {
  const copy = error?.message ? ERRORS[error.message] : undefined;
  if (!copy) return null;
  return { field: copy.field, message: copy.text(String(error?.details ?? '').trim()) };
}

/** Radar completo (los cinco ejes, enteros de 0 a 5) o null. Un radar a medias no se envía. */
export function completeRadar(value: Partial<Record<RadarAxis, unknown>> | null | undefined): ContributionRadar | null {
  if (!value) return null;
  const radar = {} as ContributionRadar;
  for (const axis of RADAR_AXES) {
    const number = value[axis];
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 0 || number > 5) return null;
    radar[axis] = number;
  }
  return radar;
}
