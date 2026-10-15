/**
 * Reglas puras de las pantallas de cuenta (U12): con qué se entra, a qué
 * webmail se ofrece ir tras registrarse y cuánto esperar entre reenvíos.
 * Sin Supabase, para probarlas con `node --test`.
 */

export const USERNAME_PATTERN = /^[a-z0-9_-]{3,30}$/;

export type LoginIdentifier =
  | { kind: 'email'; email: string }
  | { kind: 'username'; username: string }
  | { kind: 'invalid' };

/**
 * "Usuario o correo": con `@` es un correo y entra por Supabase Auth; si no,
 * es un usuario y se resuelve en `login-with-username`. Un usuario con formato
 * imposible no se envía: la respuesta sería el mismo error genérico.
 */
export function parseLoginIdentifier(input: string): LoginIdentifier {
  const value = input.trim();
  if (!value) return { kind: 'invalid' };
  if (value.includes('@')) return { kind: 'email', email: value.toLowerCase() };
  const username = value.toLowerCase();
  return USERNAME_PATTERN.test(username) ? { kind: 'username', username } : { kind: 'invalid' };
}

export type Webmail = { label: string; url: string };

// Solo los tres proveedores que pide la ronda 3. Para el resto no hay enlace:
// adivinar el webmail de un dominio propio llevaría a una página equivocada.
const WEBMAILS: Array<{ domains: string[]; webmail: Webmail }> = [
  { domains: ['gmail.com', 'googlemail.com'], webmail: { label: 'Gmail', url: 'https://mail.google.com/mail/' } },
  {
    domains: ['outlook.com', 'outlook.es', 'hotmail.com', 'hotmail.es', 'live.com', 'msn.com'],
    webmail: { label: 'Outlook', url: 'https://outlook.live.com/mail/' }
  },
  { domains: ['icloud.com', 'me.com', 'mac.com'], webmail: { label: 'iCloud Mail', url: 'https://www.icloud.com/mail/' } }
];

/** Webmail del correo, o null si el dominio no es Gmail, Outlook ni iCloud. */
export function webmailFor(email: string): Webmail | null {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return null;
  return WEBMAILS.find((entry) => entry.domains.includes(domain))?.webmail ?? null;
}

/**
 * Espera entre reenvíos del correo de confirmación. Supabase Auth limita por
 * defecto un correo por dirección cada 60 s; esperar lo mismo en la interfaz
 * evita un error que la persona no puede resolver.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Segundos que pide esperar un error de límite de Auth ("…only request this
 * after 42 seconds"), o null si el mensaje no lo dice.
 */
export function retryAfterSeconds(message: string | undefined | null): number | null {
  const match = message?.match(/after (\d+) seconds?/i);
  return match ? Number(match[1]) : null;
}

/** Destino interno seguro tras entrar: solo rutas propias, nunca `//otro-sitio`. */
export function safeRedirect(value: string | null | undefined, fallback = '/mis-colecciones'): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

/**
 * Destino de todos los enlaces de los correos de Auth (confirmar la cuenta,
 * recuperar la contraseña y cambiar el correo). Va sin query: las plantillas
 * añaden `?token_hash=…&type=…` a `{{ .RedirectTo }}` y el tipo dice qué flujo es.
 */
export function authLinkRedirect(origin: string): string {
  return `${origin}/auth/reset`;
}

export type AuthLinkFlow = 'signup' | 'recovery' | 'email_change';
export type AuthOtpType = 'email' | 'recovery' | 'email_change';

export type AuthLink = {
  flow: AuthLinkFlow;
  /** Enlace de las plantillas: se canjea con `verifyOtp`, en cualquier navegador. */
  tokenHash: string | null;
  otpType: AuthOtpType | null;
  /** Enlace PKCE (`{{ .ConfirmationURL }}`): el SDK ya lo canjea al cargar. */
  code: string | null;
  /** Auth devolvió un error en la URL (enlace vencido o usado). */
  error: boolean;
};

const OTP_FLOWS: Record<string, { flow: AuthLinkFlow; otpType: AuthOtpType }> = {
  email: { flow: 'signup', otpType: 'email' },
  signup: { flow: 'signup', otpType: 'email' },
  recovery: { flow: 'recovery', otpType: 'recovery' },
  email_change: { flow: 'email_change', otpType: 'email_change' }
};

/**
 * Lee el enlace de un correo de Auth. El flujo sale del `type` del enlace; los
 * enlaces anteriores lo traían en `flow`. Sin ninguno de los dos, es recuperación.
 */
export function readAuthLink(search: URLSearchParams, hash: URLSearchParams): AuthLink {
  const known = OTP_FLOWS[search.get('type') ?? ''] ?? OTP_FLOWS[hash.get('type') ?? ''];
  const legacy = search.get('flow');
  const flow: AuthLinkFlow = known?.flow
    ?? (legacy === 'signup' || legacy === 'email_change' ? legacy : 'recovery');
  const tokenHash = search.get('token_hash')?.trim() || null;
  return {
    flow,
    tokenHash,
    otpType: tokenHash ? (known?.otpType ?? OTP_FLOWS[flow === 'signup' ? 'email' : flow].otpType) : null,
    code: search.get('code') || null,
    error: Boolean(search.get('error_description') ?? hash.get('error_description'))
  };
}
