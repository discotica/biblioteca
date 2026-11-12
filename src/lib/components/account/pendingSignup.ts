import { authLinkRedirect } from '$lib/domain/account';

/**
 * Correo de la cuenta recién creada, para "Revisa tu correo" (U12). Vive en
 * sessionStorage: sobrevive a recargar la pestaña y no sale del navegador ni
 * viaja en la URL. Si el almacenamiento falla, la pantalla pide el correo.
 */
const KEY = 'discotica:registro-pendiente';

export type PendingSignup = {
  email: string;
  sentAt: number;
  /** Usuario elegido en el alta (U30): siembra la huella de «Revisa tu correo». Es público. */
  username?: string;
};

export function readPendingSignup(): PendingSignup | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (typeof value?.email !== 'string' || typeof value?.sentAt !== 'number') return null;
    return { email: value.email, sentAt: value.sentAt, ...(typeof value.username === 'string' ? { username: value.username } : {}) };
  } catch {
    return null;
  }
}

export function writePendingSignup(pending: PendingSignup) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Sin almacenamiento la pantalla sigue funcionando con el estado de la navegación.
  }
}

/** Destino del enlace de confirmación: /auth/reset canjea el enlace y lleva al perfil (U30). */
export function confirmationRedirect(origin: string) {
  return authLinkRedirect(origin);
}
