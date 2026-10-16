import { supabase } from '$lib/supabase';
import type {
  CatalogCreation,
  ContributionPayloadV3,
  ReleaseTypeSlug,
  SourceDuplicate
} from '$lib/domain/contributionContract';

export type { ReleaseTypeSlug };

export type ProfileRole = 'comunidad' | 'colaborador' | 'admin';
export type ContributionStatus =
  | 'draft'
  | 'pending'
  | 'ready_for_admin'
  | 'changes_requested'
  | 'rejected'
  | 'approved';
export type ContributionQueue = 'community' | 'collaborator' | null;

export const RELEASE_TYPE_OPTIONS: Array<{ value: ReleaseTypeSlug; label: string }> = [
  { value: 'album', label: 'Álbum' },
  { value: 'ep', label: 'EP' },
  { value: 'single', label: 'Single' },
  { value: 'compilado', label: 'Compilado' },
  { value: 'sample-pack', label: 'Sample Pack' }
];

/**
 * Lo que envía la interfaz desde U19 (G2): la propuesta v3 de G1. Las filas guardadas antes de G1
 * pueden traer `version: 2` y sin sello; quien las lee usa valores por defecto.
 */
export type ContributionPayload = ContributionPayloadV3;

export interface DetectedMetadata {
  provider?: string;
  source_available?: boolean;
  title?: string;
  artists?: string[];
  type?: string;
  release_date?: string;
  review?: string;
  cover_url?: string;
  credit_inference_version?: string;
  [key: string]: unknown;
}

export interface Contribution {
  id: string;
  author_id: string;
  status: ContributionStatus;
  source_url: string;
  source_provider: string | null;
  payload: ContributionPayload;
  payload_version: number;
  payload_quality: 'legacy' | 'confirmed';
  detected_metadata: DetectedMetadata;
  queue_kind: ContributionQueue;
  submitted_at: string | null;
  /** U19: desde que el equipo la corrigió, la marcó lista o la revisó; el autor ya no la edita. */
  taken_at?: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  release_id: string | null;
  created_at: string;
  updated_at: string;
}

export type SourceProvider = 'bandcamp' | 'spotify' | 'soundcloud';

function rpcError(error: { message: string; code?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return;
  // details lleva el valor rechazado de los errores v3 (U19); describeContributionError lo usa.
  const next = new Error(error.message) as Error & { code?: string; details?: string | null; hint?: string | null };
  next.code = error.code;
  next.details = error.details ?? null;
  next.hint = error.hint ?? null;
  throw next;
}

export function sourceProviderFor(value: string): SourceProvider | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'bandcamp.com' || host.endsWith('.bandcamp.com')) return 'bandcamp';
    if (host === 'open.spotify.com' || host.endsWith('.spotify.com')) return 'spotify';
    if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) return 'soundcloud';
    return null;
  } catch {
    return null;
  }
}

export type ContributionFieldErrors = Partial<Record<
  'source' | 'title' | 'primary_artists' | 'release_type' | 'release_date' | 'genres' | 'countries' | 'label',
  string
>>;

/** Espejo de los obligatorios para la interfaz; el servidor (v3, U19) decide cada envío. */
export function contributionFieldErrors(sourceUrl: string, payload: ContributionPayload): ContributionFieldErrors {
  const errors: ContributionFieldErrors = {};
  if (!sourceProviderFor(sourceUrl)) errors.source = 'Usa una URL HTTPS de Bandcamp, Spotify o SoundCloud.';
  if (!payload.title.trim()) errors.title = 'El título es obligatorio.';
  if (!payload.primary_artists.some((value) => value.trim())) errors.primary_artists = 'Añade al menos un artista principal.';
  if (!payload.release_type) errors.release_type = 'Confirma el tipo de lanzamiento.';
  if (!payload.release_date) errors.release_date = 'La fecha de lanzamiento es obligatoria.';
  if (!payload.genres.some((value) => value.trim())) errors.genres = 'Añade al menos un género.';
  if (!payload.countries.some((value) => value.trim())) errors.countries = 'Añade al menos un país.';
  if (!payload.label?.trim()) errors.label = 'El sello es obligatorio. Si es autoeditado, elige «Independiente».';
  return errors;
}

export async function getProfileRole(userId: string): Promise<ProfileRole | ''> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  rpcError(error);
  return (data?.role as ProfileRole | undefined) ?? '';
}

export async function createContributionDraft(input: {
  sourceUrl: string;
  sourceProvider: SourceProvider;
  payload: ContributionPayload;
  detectedMetadata: DetectedMetadata;
}): Promise<Contribution> {
  const { data, error } = await supabase.rpc('create_contribution_draft', {
    p_source_url: input.sourceUrl,
    p_source_provider: input.sourceProvider,
    p_payload: input.payload,
    p_detected_metadata: input.detectedMetadata
  });
  rpcError(error);
  return data as Contribution;
}

export async function saveContributionDraft(id: string, input: {
  sourceUrl: string;
  sourceProvider: SourceProvider;
  payload: ContributionPayload;
  detectedMetadata: DetectedMetadata;
}): Promise<Contribution> {
  const { data, error } = await supabase.rpc('save_contribution_draft', {
    p_contribution_id: id,
    p_source_url: input.sourceUrl,
    p_source_provider: input.sourceProvider,
    p_payload: input.payload,
    p_detected_metadata: input.detectedMetadata
  });
  rpcError(error);
  return data as Contribution;
}

export async function submitContribution(id: string, input: {
  sourceUrl: string;
  sourceProvider: SourceProvider;
  payload: ContributionPayload;
  detectedMetadata: DetectedMetadata;
}): Promise<Contribution> {
  const { data, error } = await supabase.rpc('submit_contribution', {
    p_contribution_id: id,
    p_source_url: input.sourceUrl,
    p_source_provider: input.sourceProvider,
    p_payload: input.payload,
    p_detected_metadata: input.detectedMetadata
  });
  rpcError(error);
  return data as Contribution;
}

type SourceInput = {
  sourceUrl: string;
  sourceProvider: SourceProvider;
  payload: ContributionPayload;
  detectedMetadata: DetectedMetadata;
};

/** U19: el autor edita su propuesta enviada mientras nadie del equipo la haya tomado. */
export async function updateSubmittedContribution(id: string, input: SourceInput): Promise<Contribution> {
  const { data, error } = await supabase.rpc('update_submitted_contribution', {
    p_contribution_id: id,
    p_source_url: input.sourceUrl,
    p_source_provider: input.sourceProvider,
    p_payload: input.payload,
    p_detected_metadata: input.detectedMetadata
  });
  rpcError(error);
  return data as Contribution;
}

/**
 * U19: corrección del equipo (admin o colaborador). `expectedUpdatedAt` es el `updated_at` con el
 * que se abrió, tal como lo devolvió la fila (texto con microsegundos; un Date los pierde); si
 * cambió, el servidor responde contribution_version_conflict. La primera corrección marca la
 * propuesta como tomada.
 */
export async function saveContributionCorrection(id: string, input: {
  expectedUpdatedAt: string;
  payload: ContributionPayloadV3;
  sourceUrl?: string;
  sourceProvider?: SourceProvider;
  note?: string;
}): Promise<Contribution> {
  const { data, error } = await supabase.rpc('save_contribution_correction', {
    p_contribution_id: id,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_payload: input.payload,
    p_source_url: input.sourceUrl ?? null,
    p_source_provider: input.sourceProvider ?? null,
    p_note: input.note ?? null
  });
  rpcError(error);
  return data as Contribution;
}

/** U19: admin acepta como borrador (`publish: false`) o publicando. */
export async function acceptContribution(id: string, input: { publish: boolean; expectedUpdatedAt: string; note?: string }): Promise<CatalogCreation> {
  const { data, error } = await supabase.rpc('accept_contribution', {
    p_contribution_id: id,
    p_publish: input.publish,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_note: input.note ?? null
  });
  rpcError(error);
  return data as CatalogCreation;
}

/** U19: «Crear borrador» de admin desde Sugerir. Crea un borrador del catálogo, sin cola. */
export async function adminCreateDraftFromSuggestion(input: SourceInput & { reason?: string }): Promise<CatalogCreation> {
  const { data, error } = await supabase.rpc('admin_create_draft_from_suggestion', {
    p_source_url: input.sourceUrl,
    p_source_provider: input.sourceProvider,
    p_payload: input.payload,
    p_detected_metadata: input.detectedMetadata,
    p_reason: input.reason ?? null
  });
  rpcError(error);
  return data as CatalogCreation;
}

/** U19: ¿el enlace ya está en el catálogo o en la cola? Nunca devuelve propuestas ajenas. */
export async function checkSourceDuplicate(url: string): Promise<SourceDuplicate> {
  const { data, error } = await supabase.rpc('check_source_duplicate', { p_source_url: url });
  rpcError(error);
  return data as SourceDuplicate;
}

export async function inspectSource(url: string): Promise<DetectedMetadata> {
  const { data, error } = await supabase.functions.invoke('inspect-release-source', { body: { url } });
  rpcError(error);
  return (data ?? {}) as DetectedMetadata;
}

function names(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  return [...new Set(rows.map((row) => String((row as { name?: unknown })?.name ?? '').trim()).filter(Boolean))];
}

/**
 * Géneros y países que se pueden elegir en /sugerir: solo la lista seleccionable (U19). Los de
 * legado se conservan donde ya están, pero no se ofrecen, y el servidor rechaza lo demás.
 */
export async function loadContributionDictionaries(): Promise<{ genres: string[]; countries: string[] }> {
  const [genres, countries] = await Promise.all([
    supabase.from('genres').select('name').eq('status', 'selectable').order('name').limit(1000),
    supabase.from('countries').select('name').eq('status', 'selectable').order('name').limit(1000)
  ]);
  rpcError(genres.error);
  rpcError(countries.error);
  return { genres: names(genres.data), countries: names(countries.data) };
}

const likePattern = (value: string) => `%${value.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;

async function searchNames(table: 'artists' | 'labels', query: string): Promise<string[]> {
  const value = query.trim();
  if (value.length < 2) return [];
  const { data, error } = await supabase.from(table).select('name').ilike('name', likePattern(value)).order('name').limit(20);
  rpcError(error);
  return names(data);
}

/** Artistas del catálogo cuyo nombre contiene `query` (mínimo dos caracteres). */
export const searchArtistNames = (query: string) => searchNames('artists', query);

/** Sellos del catálogo cuyo nombre contiene `query` (mínimo dos caracteres). */
export const searchLabelNames = (query: string) => searchNames('labels', query);

/**
 * Candidatos para el aviso de nombres parecidos (U19): los nombres del catálogo y los valores
 * conservados de los alias que contienen alguno de los `terms`. Quien llama decide cuáles se parecen.
 */
export async function similarCatalogNames(kind: 'artists' | 'labels', terms: string[]): Promise<string[]> {
  const aliasTable = kind === 'artists' ? 'artist_aliases' : 'label_aliases';
  const found = await Promise.all(
    terms.filter((term) => term.trim().length >= 2).map(async (term) => {
      const [catalog, aliases] = await Promise.all([
        searchNames(kind, term),
        supabase.from(aliasTable).select(`name, kept:${kind}(name)`).ilike('name', likePattern(term.trim())).limit(20)
      ]);
      // Sin alias (tabla vacía o aún sin migrar) el aviso sigue con los nombres del catálogo.
      return [...catalog, ...(aliases.error ? [] : names((aliases.data ?? []).map((row: { kept?: unknown }) => row.kept)))];
    })
  );
  return [...new Set(found.flat())];
}

export async function loadContribution(id: string): Promise<Contribution | null> {
  const { data, error } = await supabase.from('contributions').select('*').eq('id', id).maybeSingle();
  rpcError(error);
  return data as Contribution | null;
}

export async function loadOwnContributions(authorId: string): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from('contributions')
    .select('*')
    .eq('author_id', authorId)
    .order('updated_at', { ascending: false });
  rpcError(error);
  return (data ?? []) as Contribution[];
}

/** RLS in E09 shapes this result for the current role; the client does not recreate queue authorization. */
export async function loadEditorialQueue(): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from('contributions')
    .select('*')
    .in('status', ['pending', 'ready_for_admin'])
    .order('submitted_at', { ascending: true, nullsFirst: false });
  rpcError(error);
  return (data ?? []) as Contribution[];
}

/**
 * Propuestas que crearon un lanzamiento (U15, enlace cruzado del Estudio). Solo
 * lectura: las políticas de E09 deciden qué filas ve cada rol.
 */
export async function loadReleaseContributions(releaseId: string): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from('contributions')
    .select('*')
    .eq('release_id', releaseId)
    .order('updated_at', { ascending: false });
  rpcError(error);
  return (data ?? []) as Contribution[];
}

export async function prepareContributionForAdmin(id: string, workingPayload: ContributionPayload, internalNote: string) {
  const { data, error } = await supabase.rpc('prepare_contribution_for_admin', {
    p_contribution_id: id,
    p_working_payload: workingPayload,
    p_internal_note: internalNote || null
  });
  rpcError(error);
  return data as Contribution;
}

export async function reviewContribution(
  id: string,
  action: 'approved' | 'rejected' | 'changes_requested',
  note = ''
) {
  const { data, error } = await supabase.rpc('review_contribution', {
    p_contribution_id: id,
    p_action: action,
    p_note: note || null
  });
  rpcError(error);
  return data as Contribution;
}

export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  ready_for_admin: 'Listo para administración',
  changes_requested: 'Cambios solicitados',
  rejected: 'Rechazado',
  approved: 'Aceptado'
};
