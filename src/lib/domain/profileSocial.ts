/**
 * Redes del perfil (D1). La base guarda solo el usuario normalizado de cada red
 * y valida su formato con las restricciones `profiles_social_*` de
 * `20261006131054_d1_profile_social_and_collection_order.sql`. Este módulo
 * replica esos formatos para avisar antes de guardar, convierte lo que pega la
 * persona (con "@", con URL) en ese usuario y construye la URL pública.
 *
 * Bandcamp tiene dos formas de perfil: página de fan (`bandcamp.com/usuario`) y
 * página de artista (`artista.bandcamp.com`). Se guarda el nombre en
 * `social_bandcamp` y la forma en `social_bandcamp_kind`. Como un nombre suelto
 * no dice cuál de las dos es, para Bandcamp se pide el enlace.
 */

export const SOCIAL_NETWORKS = ['bandcamp', 'soundcloud', 'instagram', 'x', 'facebook'] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];
export type SocialColumn = `social_${SocialNetwork}`;
export type BandcampKind = 'fan' | 'artist';
export const BANDCAMP_KINDS: readonly BandcampKind[] = ['fan', 'artist'];

/** Columnas sociales de `profiles`, tal como se leen y se escriben. */
export type SocialProfileColumns = Partial<Record<SocialColumn, string | null>> & {
  social_bandcamp_kind?: BandcampKind | null;
};

interface HandleFormat {
  pattern: RegExp;
  minLength: number;
  maxLength: number;
  /** Qué se espera, en el texto de error. */
  hint: string;
}

interface NetworkRule extends HandleFormat {
  label: string;
  /** Hosts cuyas URLs se aceptan al pegar un enlace completo. */
  hosts: string[];
  url: (handle: string) => string;
}

const BANDCAMP_HOST = 'bandcamp.com';

const BANDCAMP_FORMATS: Record<BandcampKind, HandleFormat & { url: (handle: string) => string }> = {
  fan: {
    pattern: /^[a-z0-9_-]+$/,
    minLength: 1,
    maxLength: 64,
    hint: 'letras, números, guiones y guiones bajos',
    url: (handle) => `https://bandcamp.com/${handle}`
  },
  artist: {
    pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
    minLength: 1,
    maxLength: 63,
    hint: 'letras, números y guiones, sin guion al inicio ni al final',
    url: (handle) => `https://${handle}.bandcamp.com`
  }
};

const NETWORKS: Record<SocialNetwork, NetworkRule> = {
  // Formato y URL de Bandcamp dependen de la forma: ver BANDCAMP_FORMATS.
  bandcamp: { label: 'Bandcamp', hosts: [BANDCAMP_HOST], ...BANDCAMP_FORMATS.fan },
  soundcloud: {
    label: 'SoundCloud',
    hosts: ['soundcloud.com', 'm.soundcloud.com'],
    pattern: /^[a-z0-9_-]+$/,
    minLength: 3,
    maxLength: 25,
    hint: 'de 3 a 25 letras, números, guiones o guiones bajos',
    url: (handle) => `https://soundcloud.com/${handle}`
  },
  instagram: {
    label: 'Instagram',
    hosts: ['instagram.com'],
    pattern: /^[a-z0-9_]+(\.[a-z0-9_]+)*$/,
    minLength: 1,
    maxLength: 30,
    hint: 'hasta 30 letras, números, puntos o guiones bajos, sin punto al inicio, al final ni dos seguidos',
    url: (handle) => `https://www.instagram.com/${handle}/`
  },
  x: {
    label: 'X (Twitter)',
    hosts: ['x.com', 'twitter.com', 'mobile.twitter.com'],
    pattern: /^[a-z0-9_]+$/,
    minLength: 1,
    maxLength: 15,
    hint: 'hasta 15 letras, números o guiones bajos',
    url: (handle) => `https://x.com/${handle}`
  },
  facebook: {
    label: 'Facebook',
    hosts: ['facebook.com', 'm.facebook.com', 'fb.com'],
    pattern: /^[a-z0-9]+(\.[a-z0-9]+)*$/,
    minLength: 5,
    maxLength: 50,
    hint: 'de 5 a 50 letras, números o puntos',
    url: (handle) => `https://www.facebook.com/${handle}`
  }
};

export function socialColumn(network: SocialNetwork): SocialColumn {
  return `social_${network}`;
}

export function socialLabel(network: SocialNetwork): string {
  return NETWORKS[network].label;
}

export type SocialHandleResult =
  | { ok: true; handle: string | null; bandcampKind?: BandcampKind | null }
  | { ok: false; error: string };

function matchesFormat(format: HandleFormat, handle: string): boolean {
  return handle.length >= format.minLength && handle.length <= format.maxLength && format.pattern.test(handle);
}

function formatFor(network: SocialNetwork, bandcampKind?: BandcampKind | null): HandleFormat | null {
  if (network !== 'bandcamp') return NETWORKS[network];
  return bandcampKind ? BANDCAMP_FORMATS[bandcampKind] : null;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function hostMatches(hostname: string, hosts: string[]): boolean {
  return hosts.includes(hostname.toLowerCase().replace(/^www\./, ''));
}

/** Extrae el usuario de una URL de la red, o null si la URL no es de esa red. */
function handleFromUrl(network: Exclude<SocialNetwork, 'bandcamp'>, value: string): string | null | undefined {
  const looksLikeUrl = /^https?:\/\//i.test(value) || /^(www\.)?[a-z0-9.-]+\.[a-z]{2,}\//i.test(value);
  if (!looksLikeUrl) return undefined;
  const url = parseUrl(value);
  if (!url || !hostMatches(url.hostname, NETWORKS[network].hosts)) return null;
  if (network === 'facebook' && url.pathname.replace(/\/+$/, '') === '/profile.php') {
    return url.searchParams.get('id');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  return segments.length === 1 ? decodeURIComponent(segments[0]) : null;
}

/**
 * Bandcamp: `bandcamp.com/usuario` es una página de fan; `artista.bandcamp.com`
 * (con o sin ruta, p. ej. un enlace a un álbum) es una página de artista.
 */
function normalizeBandcamp(raw: string): SocialHandleResult {
  const askForLink = {
    ok: false as const,
    error: 'Pega el enlace a tu Bandcamp: tu página de artista (artista.bandcamp.com) o de fan (bandcamp.com/usuario).'
  };
  const url = /^https?:\/\//i.test(raw) || /^[a-z0-9.-]*bandcamp\.com(\/|$)/i.test(raw) ? parseUrl(raw) : null;
  if (!url) return askForLink;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let kind: BandcampKind;
  let handle: string;
  if (host === BANDCAMP_HOST) {
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return askForLink;
    kind = 'fan';
    handle = decodeURIComponent(segments[0]).toLowerCase();
  } else if (host.endsWith(`.${BANDCAMP_HOST}`)) {
    kind = 'artist';
    handle = host.slice(0, -(BANDCAMP_HOST.length + 1));
    if (handle.includes('.')) return askForLink;
  } else {
    return askForLink;
  }

  const format = BANDCAMP_FORMATS[kind];
  if (!matchesFormat(format, handle) || (kind === 'artist' && handle === 'www')) {
    return { ok: false, error: `El enlace de Bandcamp no es válido: usa ${format.hint}.` };
  }
  return { ok: true, handle, bandcampKind: kind };
}

/**
 * Convierte lo que escribe la persona en el usuario que guarda la base.
 * Vacío significa quitar la red (`handle: null`). En Bandcamp devuelve además
 * `bandcampKind`.
 */
export function normalizeSocialHandle(network: SocialNetwork, input: string | null | undefined): SocialHandleResult {
  const raw = (input ?? '').trim();
  if (network === 'bandcamp') {
    return raw ? normalizeBandcamp(raw) : { ok: true, handle: null, bandcampKind: null };
  }
  if (!raw) return { ok: true, handle: null };

  const rule = NETWORKS[network];
  const fromUrl = handleFromUrl(network, raw);
  if (fromUrl === null) {
    return { ok: false, error: `Escribe solo tu usuario de ${rule.label}, o pega el enlace a tu perfil.` };
  }
  const handle = (fromUrl ?? raw).replace(/^@/, '').toLowerCase();
  if (!matchesFormat(rule, handle)) {
    return { ok: false, error: `El usuario de ${rule.label} no es válido: usa ${rule.hint}.` };
  }
  return { ok: true, handle };
}

/** true si el valor guardado cumple el formato que acepta la base. */
export function isValidSocialHandle(network: SocialNetwork, handle: string, bandcampKind?: BandcampKind | null): boolean {
  const format = formatFor(network, bandcampKind);
  if (!format || !matchesFormat(format, handle)) return false;
  return !(network === 'bandcamp' && bandcampKind === 'artist' && handle === 'www');
}

/**
 * URL pública del perfil en la red. Devuelve null ante un valor que la base no
 * aceptaría. Bandcamp necesita la forma (`bandcampKind`).
 */
export function socialProfileUrl(
  network: SocialNetwork,
  handle: string | null | undefined,
  bandcampKind?: BandcampKind | null
): string | null {
  if (!handle || !isValidSocialHandle(network, handle, bandcampKind)) return null;
  if (network === 'bandcamp') return BANDCAMP_FORMATS[bandcampKind as BandcampKind].url(handle);
  return NETWORKS[network].url(handle);
}

export interface SocialLink {
  network: SocialNetwork;
  label: string;
  handle: string;
  url: string;
}

/** Enlaces que se muestran en un perfil, en el orden fijo de SOCIAL_NETWORKS. */
export function socialLinks(profile: SocialProfileColumns): SocialLink[] {
  return SOCIAL_NETWORKS.flatMap((network) => {
    const handle = profile[socialColumn(network)] ?? null;
    const url = socialProfileUrl(network, handle, network === 'bandcamp' ? profile.social_bandcamp_kind : null);
    return handle && url ? [{ network, label: NETWORKS[network].label, handle, url }] : [];
  });
}

export type SocialFieldErrors = Partial<Record<SocialNetwork, string>>;

/**
 * Normaliza un formulario completo de redes. Devuelve las columnas listas para
 * `profiles` (null = quitar; Bandcamp incluye `social_bandcamp_kind`) o los
 * errores por red.
 */
export function normalizeSocialForm(
  input: Partial<Record<SocialNetwork, string | null>>
): { ok: true; columns: SocialProfileColumns } | { ok: false; errors: SocialFieldErrors } {
  const columns: SocialProfileColumns = {};
  const errors: SocialFieldErrors = {};
  for (const network of SOCIAL_NETWORKS) {
    if (!(network in input)) continue;
    const result = normalizeSocialHandle(network, input[network]);
    if (!result.ok) {
      errors[network] = result.error;
      continue;
    }
    columns[socialColumn(network)] = result.handle;
    if (network === 'bandcamp') columns.social_bandcamp_kind = result.bandcampKind ?? null;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, columns };
}
