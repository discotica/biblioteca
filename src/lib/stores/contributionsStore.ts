import { supabase } from '$lib/supabase';

export type ProfileRole = 'comunidad' | 'colaborador' | 'admin';
export type ContributionStatus =
  | 'draft'
  | 'pending'
  | 'ready_for_admin'
  | 'changes_requested'
  | 'rejected'
  | 'approved';
export type ContributionQueue = 'community' | 'collaborator' | null;
export type ReleaseTypeSlug = 'album' | 'ep' | 'single' | 'compilado' | 'sample-pack';

export const RELEASE_TYPE_OPTIONS: Array<{ value: ReleaseTypeSlug; label: string }> = [
  { value: 'album', label: 'Álbum' },
  { value: 'ep', label: 'EP' },
  { value: 'single', label: 'Single' },
  { value: 'compilado', label: 'Compilado' },
  { value: 'sample-pack', label: 'Sample Pack' }
];

export interface ContributionPayload {
  version: 2;
  title: string;
  primary_artists: string[];
  collaborators: string[];
  release_type: ReleaseTypeSlug | '';
  release_date: string;
  genres: string[];
  countries: string[];
  label?: string;
  team_note?: string;
}

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
  reviewer_note: string | null;
  reviewed_at: string | null;
  release_id: string | null;
  created_at: string;
  updated_at: string;
}

export type SourceProvider = 'bandcamp' | 'spotify' | 'soundcloud';

/**
 * Altas administrativas (U13): E09 no acepta propuestas de admin, así que su
 * "Sugerir" es el lanzamiento nuevo del Catálogo del Estudio (U15).
 */
export const ADMIN_NEW_RELEASE_HREF = '/estudio/catalogo?nuevo=1';

function rpcError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const next = new Error(error.message) as Error & { code?: string };
  next.code = error.code;
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
  'source' | 'title' | 'primary_artists' | 'release_type' | 'release_date' | 'genres' | 'countries',
  string
>>;

/** UX-only mirror of required fields; E09 remains authoritative for every submission. */
export function contributionFieldErrors(sourceUrl: string, payload: ContributionPayload): ContributionFieldErrors {
  const errors: ContributionFieldErrors = {};
  if (!sourceProviderFor(sourceUrl)) errors.source = 'Usa una URL HTTPS de Bandcamp, Spotify o SoundCloud.';
  if (!payload.title.trim()) errors.title = 'El título es obligatorio.';
  if (!payload.primary_artists.some((value) => value.trim())) errors.primary_artists = 'Añade al menos un artista principal.';
  if (!payload.release_type) errors.release_type = 'Confirma el tipo de lanzamiento.';
  if (!payload.release_date) errors.release_date = 'La fecha de lanzamiento es obligatoria.';
  if (!payload.genres.some((value) => value.trim())) errors.genres = 'Añade al menos un género.';
  if (!payload.countries.some((value) => value.trim())) errors.countries = 'Añade al menos un país.';
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
 * Sugerencias de géneros y países para los Combobox de /sugerir (U13). Son de
 * lectura pública; el payload sigue llevando nombres libres, como en E09.
 */
export async function loadContributionDictionaries(): Promise<{ genres: string[]; countries: string[] }> {
  const [genres, countries] = await Promise.all([
    supabase.from('genres').select('name').order('name').limit(1000),
    supabase.from('countries').select('name').order('name').limit(1000)
  ]);
  rpcError(genres.error);
  rpcError(countries.error);
  return { genres: names(genres.data), countries: names(countries.data) };
}

/** Artistas del catálogo cuyo nombre contiene `query` (mínimo dos caracteres). */
export async function searchArtistNames(query: string): Promise<string[]> {
  const value = query.trim();
  if (value.length < 2) return [];
  const pattern = value.replace(/[\\%_]/g, (character) => `\\${character}`);
  const { data, error } = await supabase
    .from('artists')
    .select('name')
    .ilike('name', `%${pattern}%`)
    .order('name')
    .limit(20);
  rpcError(error);
  return names(data);
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
