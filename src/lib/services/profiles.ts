import { supabase } from '$lib/supabase';
import {
  normalizeSocialForm,
  socialLinks,
  type BandcampKind,
  type SocialColumn,
  type SocialFieldErrors,
  type SocialLink,
  type SocialNetwork,
  type SocialProfileColumns
} from '$lib/domain/profileSocial';

/**
 * Perfil (D1). Lecturas públicas y escrituras del dueño sobre `profiles`.
 * Requiere la migración 20261006131054 en el entorno: antes de aplicarla, las
 * columnas sociales y la RPC de aportes no existen y estas llamadas fallan.
 */

/** Columnas públicas del perfil. RLS ya permite leer perfiles a cualquiera. */
export const PUBLIC_PROFILE_COLUMNS =
  'id, username, display_name, bio, created_at, social_bandcamp, social_bandcamp_kind, social_soundcloud, social_instagram, social_x, social_facebook, show_accepted_contributions';

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  created_at: string;
  show_accepted_contributions: boolean;
  /** Forma del perfil de Bandcamp; null si no hay Bandcamp. */
  social_bandcamp_kind: BandcampKind | null;
} & Record<SocialColumn, string | null>;

export interface PublicAcceptedContribution {
  release_id: string;
  accepted_at: string | null;
}

function fail(error: { message: string; code?: string } | null) {
  if (!error) return;
  const next = new Error(error.message) as Error & { code?: string };
  next.code = error.code;
  throw next;
}

export async function loadPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('username', username)
    .maybeSingle();
  fail(error);
  return data as PublicProfile | null;
}

const PROFILE_BASE_COLUMNS = 'id, username, display_name, bio, created_at';

/**
 * Perfil público para `/perfil/[username]` (U14). Sin D1 en el entorno, las
 * columnas sociales no existen (`42703`): se lee lo demás, sin redes ni aportes.
 */
export async function loadProfilePage(
  username: string
): Promise<{ profile: PublicProfile; d1: boolean } | null> {
  try {
    const profile = await loadPublicProfile(username);
    return profile ? { profile, d1: true } : null;
  } catch (error) {
    if ((error as { code?: string }).code !== '42703') throw error;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_BASE_COLUMNS)
    .eq('username', username)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  return {
    profile: {
      ...(data as Pick<PublicProfile, 'id' | 'username' | 'display_name' | 'bio' | 'created_at'>),
      show_accepted_contributions: false,
      social_bandcamp: null,
      social_bandcamp_kind: null,
      social_soundcloud: null,
      social_instagram: null,
      social_x: null,
      social_facebook: null
    },
    d1: false
  };
}

/** Enlaces para SocialLinks: solo redes con usuario válido, en orden fijo. */
export function profileSocialLinks(profile: SocialProfileColumns): SocialLink[] {
  return socialLinks(profile);
}

/**
 * Guarda las redes del dueño. Solo cambia las redes presentes en `input`;
 * vacío las quita. Valida antes de enviar: si hay errores no escribe nada.
 * Bandcamp se recibe como enlace (de artista o de fan) y guarda nombre y forma.
 */
export async function updateOwnSocialHandles(
  profileId: string,
  input: Partial<Record<SocialNetwork, string | null>>
): Promise<{ ok: true; profile: PublicProfile } | { ok: false; errors: SocialFieldErrors }> {
  const normalized = normalizeSocialForm(input);
  if (!normalized.ok) return normalized;
  const { data, error } = await supabase
    .from('profiles')
    .update(normalized.columns)
    .eq('id', profileId)
    .select(PUBLIC_PROFILE_COLUMNS)
    .single();
  fail(error);
  return { ok: true, profile: data as PublicProfile };
}

/** Preferencia "Mostrar mis aportes aceptados" (por defecto, no). */
export async function setShowAcceptedContributions(profileId: string, show: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ show_accepted_contributions: show })
    .eq('id', profileId)
    .select('id')
    .single();
  fail(error);
}

/**
 * Metadatos de registro con las redes opcionales: `handle_new_user` los copia
 * al perfil. Úsese en `signUp({ options: { data } })` junto a username y demás.
 * Un formato inválido haría fallar el alta, por eso se valida aquí primero.
 */
export function signupSocialMetadata(
  input: Partial<Record<SocialNetwork, string | null>>
): { ok: true; data: Record<string, string> } | { ok: false; errors: SocialFieldErrors } {
  const normalized = normalizeSocialForm(input);
  if (!normalized.ok) return normalized;
  // Incluye social_bandcamp_kind junto a social_bandcamp; omite redes vacías.
  const data: Record<string, string> = {};
  for (const [column, value] of Object.entries(normalized.columns)) {
    if (value) data[column] = value;
  }
  return { ok: true, data };
}

/**
 * Aportes aceptados que muestra un perfil público. Vacío si la persona no lo
 * permite. Solo devuelve el lanzamiento publicado y la fecha de aceptación;
 * los datos del lanzamiento se cargan del catálogo por ID. Máximo 100 por página.
 */
export async function loadPublicAcceptedContributions(
  profileId: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<PublicAcceptedContribution[]> {
  const { data, error } = await supabase.rpc('get_public_accepted_contributions', {
    p_profile_id: profileId,
    p_limit: limit,
    p_offset: offset
  });
  fail(error);
  return (data ?? []) as PublicAcceptedContribution[];
}

/* ---------- Editar cuenta (U12) ---------- */

export type OwnAccountProfile = PublicProfile & { newsletter_opt_in: boolean };

export interface OwnAccountUpdate {
  display_name: string | null;
  bio: string | null;
  newsletter_opt_in: boolean;
  /** Redes tal como las escribe la persona; se omite si el entorno no tiene D1. */
  social?: Partial<Record<SocialNetwork, string | null>>;
}

const ACCOUNT_BASE_COLUMNS = 'id, username, display_name, bio, created_at, newsletter_opt_in';

/**
 * Perfil propio para "Editar cuenta". Mientras D1 no esté aplicada en el
 * entorno, las columnas sociales no existen (`42703`): se lee lo demás y la
 * vista oculta las redes en lugar de fallar entera.
 */
export async function loadOwnAccountProfile(
  profileId: string
): Promise<{ profile: OwnAccountProfile; socialAvailable: boolean }> {
  const full = await supabase
    .from('profiles')
    .select(`${PUBLIC_PROFILE_COLUMNS}, newsletter_opt_in`)
    .eq('id', profileId)
    .single();
  if (!full.error) return { profile: full.data as OwnAccountProfile, socialAvailable: true };
  if (full.error.code !== '42703') fail(full.error);

  const base = await supabase.from('profiles').select(ACCOUNT_BASE_COLUMNS).eq('id', profileId).single();
  fail(base.error);
  return { profile: base.data as OwnAccountProfile, socialAvailable: false };
}

/**
 * Guarda nombre, bio, preferencia de correo y redes en una sola escritura del
 * dueño. Valida las redes antes: si alguna es inválida no escribe nada.
 */
export async function updateOwnAccountProfile(
  profileId: string,
  input: OwnAccountUpdate
): Promise<{ ok: true; profile: OwnAccountProfile } | { ok: false; errors: SocialFieldErrors }> {
  let columns: SocialProfileColumns = {};
  if (input.social) {
    const normalized = normalizeSocialForm(input.social);
    if (!normalized.ok) return normalized;
    columns = normalized.columns;
  }
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: input.display_name,
      bio: input.bio,
      newsletter_opt_in: input.newsletter_opt_in,
      ...columns
    })
    .eq('id', profileId)
    .select(input.social ? `${PUBLIC_PROFILE_COLUMNS}, newsletter_opt_in` : ACCOUNT_BASE_COLUMNS)
    .single();
  fail(error);
  return { ok: true, profile: data as unknown as OwnAccountProfile };
}
