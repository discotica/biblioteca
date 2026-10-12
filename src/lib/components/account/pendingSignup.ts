/**
 * Correo de la cuenta recién creada, para "Revisa tu correo" (U12). Vive en
 * sessionStorage: sobrevive a recargar la pestaña y no sale del navegador ni
 * viaja en la URL. Si el almacenamiento falla, la pantalla pide el correo.
 */
const KEY = 'discotica:registro-pendiente';

export type PendingSignup = { email: string; sentAt: number };

export function readPendingSignup(): PendingSignup | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return typeof value?.email === 'string' && typeof value?.sentAt === 'number' ? value : null;
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

/** Destino del enlace de confirmación: /auth/reset crea la sesión y lleva a Mis colecciones. */
export function confirmationRedirect(origin: string) {
  return `${origin}/auth/reset?flow=signup`;
}
