/**
 * E19 owns this deliberately small URL contract. SearchState keeps these
 * parameters opaque so the beta can be removed without changing search.
 */
export interface BetaInvitation {
  /** A normalized, display-safe name; null selects the generic copy. */
  name: string | null;
}

export const BETA_INVITATION_MAX_NAME_LENGTH = 40;
export const BETA_FEEDBACK_EMAIL = 'hola@discotica.com';
export const BETA_INVITATION_COPY = {
  genericTitle: 'Bienvenida a la beta de Discótica',
  body: 'Estás entrando a una versión en prueba de nuestra biblioteca. Explora el catálogo y cuéntanos si encuentras algo que podamos mejorar.',
  cta: 'Explorar',
  /** Keep null until product approves a real launch date. */
  launchDate: null as string | null
} as const;

function takeVisibleCharacters(value: string, maxLength: number): string {
  // Segmenter counts a joined emoji or combining sequence as the one visible
  // character it is. Array.from is a safe fallback for older browsers.
  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (locales?: string | string[], options?: { granularity: 'grapheme' }) => {
      segment(value: string): Iterable<{ segment: string }>;
    };
  }).Segmenter;
  if (Segmenter) {
    const segments = new Segmenter(undefined, { granularity: 'grapheme' }).segment(value);
    return Array.from(segments, ({ segment }) => segment).slice(0, maxLength).join('');
  }
  return Array.from(value).slice(0, maxLength).join('');
}

/** Normalizes a URL name without ever turning it into markup. */
export function normalizeBetaName(raw: string | null): string | null {
  if (raw === null) return null;
  const normalized = raw
    .normalize('NFC')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!normalized) return null;
  return takeVisibleCharacters(normalized, BETA_INVITATION_MAX_NAME_LENGTH) || null;
}

/**
 * `beta` is intentionally strict: exactly one bare value or `1` activates.
 * Unknown/malformed beta URLs remain ordinary home URLs and are not treated
 * as credentials or authorization.
 */
export function parseBetaInvitation(params: URLSearchParams): BetaInvitation | null {
  const betaValues = params.getAll('beta');
  if (betaValues.length !== 1 || (betaValues[0] !== '' && betaValues[0] !== '1')) return null;

  // Ambiguous repeated names deliberately fall back to approved generic copy.
  const names = params.getAll('nombre');
  return { name: names.length === 1 ? normalizeBetaName(names[0]) : null };
}

/** Removes every beta-owned instance and leaves search and future params intact. */
export function removeBetaInvitationParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete('beta');
  next.delete('nombre');
  return next;
}

/** Safe for internal hrefs: beta is root-only and must never be carried onward. */
export function withoutBetaInvitationSearch(search: string | URLSearchParams): string {
  const params = removeBetaInvitationParams(
    search instanceof URLSearchParams ? search : new URLSearchParams(search)
  );
  const query = params.toString();
  return query ? `?${query}` : '';
}
