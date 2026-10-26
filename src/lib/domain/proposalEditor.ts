/**
 * U19 (G3): la cola se corrige en el editor del Estudio. Una propuesta (v3, por nombres) se abre en
 * el mismo formulario que un lanzamiento del catálogo (por UUID) y vuelve a ser una propuesta al
 * guardar. Aquí viven esa traducción y qué acciones tiene cada rol, sin Svelte ni Supabase.
 *
 * Los permisos y la validación son del servidor (RPC documentados en el expediente de U19,
 * «Contrato del servidor (G1)»); estas reglas solo deciden qué se muestra.
 */
import type { Artist, CatalogSnapshot, DictionaryEntry } from '../services/adminCatalog';
import { completeRadar, type ContributionPayloadV3, type ReleaseTypeSlug } from './contributionContract.ts';
import { inferProvider, isPendingId, pendingId, pendingName, primaryLink } from './releaseEditor.ts';

/** Respuesta de resolve_catalog_names (G3): id y nombre conservado, o null si se crearía nuevo. */
export type ResolvedName = { name: string; id: string | null; canonical: string | null };

export interface EditableProposal {
  id: string;
  author_id: string;
  status: string;
  queue_kind: string | null;
  source_url: string;
  source_provider: string | null;
  payload: Partial<ContributionPayloadV3> & { version?: number };
  detected_metadata?: Record<string, unknown> | null;
  updated_at: string;
  taken_at?: string | null;
}

type Dictionaries = { genres: DictionaryEntry[]; countries: DictionaryEntry[]; types: DictionaryEntry[] };

/** Sin tildes, mayúsculas ni espacios de más: como emparejan los nombres el servidor y Sugerir. */
const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
const names = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []);
const https = (value: unknown) => (typeof value === 'string' && /^https:\/\//i.test(value.trim()) ? value.trim() : null);

/** La portada que usaría aceptar sin cambios: la de la propuesta o, si falta, la detectada. */
export function proposalCover(proposal: Pick<EditableProposal, 'payload' | 'detected_metadata'>): string | null {
  return https(proposal.payload.cover_url) ?? https(proposal.detected_metadata?.cover_url);
}

/**
 * La propuesta en la forma del formulario. Artistas y sello que ya existen (por nombre o alias,
 * según `resolved`) llevan su UUID; los demás, un id «nuevo:». Géneros y países van por id de la
 * lista; los que no están en ella vuelven en `unknown`, para avisar (el servidor los rechazaría).
 * La reseña empieza con la nota de quien propone, porque aceptar la usa si no hay reseña.
 */
export function proposalToSnapshot(
  proposal: EditableProposal,
  dictionaries: Dictionaries,
  resolved: { artists: ResolvedName[]; labels: ResolvedName[] }
): { snapshot: CatalogSnapshot; artists: Artist[]; labels: DictionaryEntry[]; unknown: { genres: string[]; countries: string[] } } {
  const payload = proposal.payload ?? {};
  const found = (list: ResolvedName[], name: string) => list.find((entry) => fold(entry.name) === fold(name) && entry.id);
  const artists: Artist[] = [];
  const credit = (name: string) => {
    const match = found(resolved.artists, name);
    if (!match?.id) return pendingId(name);
    if (!artists.some((artist) => artist.id === match.id)) artists.push({ id: match.id, name: match.canonical ?? name });
    return match.id;
  };
  const unique = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) === index);
  const primary = unique(names(payload.primary_artists).map(credit));
  const collaborators = unique(names(payload.collaborators).map(credit)).filter((id) => !primary.includes(id));

  const pick = (entries: DictionaryEntry[], values: string[], unknown: string[]) =>
    unique(values.flatMap((value) => {
      const entry = entries.find((item) => fold(item.name) === fold(value));
      if (!entry) unknown.push(value);
      return entry ? [entry.id] : [];
    }));
  const unknown = { genres: [] as string[], countries: [] as string[] };

  const labelName = String(payload.label ?? '').trim();
  const labelMatch = labelName ? found(resolved.labels, labelName) : undefined;
  const labels: DictionaryEntry[] = labelMatch?.id ? [{ id: labelMatch.id, name: labelMatch.canonical ?? labelName }] : [];
  const radar = completeRadar(payload.radar);

  return {
    snapshot: {
      id: '',
      // Sin lanzamiento todavía; el identificador lo pone el servidor al aceptar.
      slug: 'propuesta',
      title: String(payload.title ?? ''),
      release_date: payload.release_date || null,
      release_type_id: dictionaries.types.find((type) => type.slug === payload.release_type)?.id ?? null,
      label_id: labelMatch?.id ?? (labelName ? pendingId(labelName) : null),
      review: String(payload.review ?? payload.team_note ?? ''),
      status: 'draft',
      credit_quality: 'proposed',
      catalog_version: 0,
      updated_at: proposal.updated_at,
      artist_ids: primary,
      collaborator_ids: collaborators,
      genre_ids: pick(dictionaries.genres, names(payload.genres), unknown.genres),
      country_ids: pick(dictionaries.countries, names(payload.countries), unknown.countries),
      radar: radar ?? {},
      links: proposal.source_url
        ? [{ provider: proposal.source_provider || inferProvider(proposal.source_url), url: proposal.source_url, is_primary: true }]
        : [],
      cover_url: proposalCover(proposal)
    },
    artists,
    labels,
    unknown
  };
}

/**
 * El formulario otra vez como propuesta v3, para save_contribution_correction. Artistas y sello
 * van por nombre (el conservado si existen; si no, el escrito). Reseña y portada solo las manda
 * admin: el servidor rechaza que otro rol las cambie y, si no vienen, conserva las guardadas.
 */
export function snapshotToProposal(
  snapshot: CatalogSnapshot,
  context: {
    base: EditableProposal['payload'];
    role: 'admin' | 'colaborador';
    artists: Artist[];
    labels: DictionaryEntry[];
    genres: DictionaryEntry[];
    countries: DictionaryEntry[];
    types: DictionaryEntry[];
  }
): { payload: ContributionPayloadV3; sourceUrl: string } {
  const nameIn = (entries: DictionaryEntry[], id: string) => entries.find((entry) => entry.id === id)?.name ?? '';
  const credit = (id: string) => (isPendingId(id) ? pendingName(id) : nameIn(context.artists, id));
  const label = snapshot.label_id ? (isPendingId(snapshot.label_id) ? pendingName(snapshot.label_id) : nameIn(context.labels, snapshot.label_id)) : '';
  const radar = completeRadar(snapshot.radar);
  const review = snapshot.review.trim();
  const cover = https(snapshot.cover_url);
  const teamNote = String(context.base.team_note ?? '').trim();
  return {
    payload: {
      version: 3,
      title: snapshot.title.trim(),
      primary_artists: snapshot.artist_ids.map(credit).filter(Boolean),
      collaborators: snapshot.collaborator_ids.map(credit).filter(Boolean),
      release_type: (context.types.find((type) => type.id === snapshot.release_type_id)?.slug ?? '') as ReleaseTypeSlug | '',
      release_date: snapshot.release_date ?? '',
      genres: snapshot.genre_ids.map((id) => nameIn(context.genres, id)).filter(Boolean),
      countries: snapshot.country_ids.map((id) => nameIn(context.countries, id)).filter(Boolean),
      label,
      ...(radar ? { radar } : {}),
      ...(teamNote ? { team_note: teamNote } : {}),
      ...(context.role === 'admin' && review ? { review } : {}),
      ...(context.role === 'admin' && cover ? { cover_url: cover } : {})
    },
    sourceUrl: primaryLink(snapshot)?.url.trim() ?? ''
  };
}

export type ProposalEditorAction = 'save' | 'prepare' | 'accept_draft' | 'accept_publish' | 'changes' | 'reject';

/**
 * Acciones del editor según el rol (tabla del expediente de U19):
 * - admin, con la propuesta en cola: guardar, aceptar como borrador o publicando, pedir cambios y rechazar;
 * - colaborador, con una propuesta comunitaria pendiente ajena: guardar la corrección y marcarla lista;
 * - el resto: solo mirar.
 */
export function proposalEditorActions(proposal: Pick<EditableProposal, 'status' | 'queue_kind' | 'author_id'>, role: string, userId: string): ProposalEditorAction[] {
  if (role === 'admin' && (proposal.status === 'pending' || proposal.status === 'ready_for_admin')) {
    return ['save', 'accept_draft', 'accept_publish', 'changes', 'reject'];
  }
  if (role === 'colaborador' && proposal.queue_kind === 'community' && proposal.status === 'pending' && proposal.author_id !== userId) {
    return ['save', 'prepare'];
  }
  return [];
}

/** Lo que falta para aceptar (la propuesta completa de v3), con los nombres del editor. */
export function missingForAccept(snapshot: CatalogSnapshot): string[] {
  const missing: string[] = [];
  if (!snapshot.title.trim()) missing.push('Título');
  if (!snapshot.release_date) missing.push('Fecha');
  if (!snapshot.release_type_id) missing.push('Tipo');
  if (!snapshot.label_id) missing.push('Sello');
  if (!snapshot.artist_ids.length) missing.push('Artista principal');
  if (!snapshot.genre_ids.length) missing.push('Género');
  if (!snapshot.country_ids.length) missing.push('País');
  if (!primaryLink(snapshot)?.url.trim()) missing.push('Link de compra');
  return missing;
}
