import { get, writable } from 'svelte/store';
import { user } from './authStore';
import { getProfileRole, type ProfileRole } from './contributionsStore';

/**
 * Rol del perfil de la sesión, leído una vez y compartido (U13). El header lo
 * pide al haber sesión, así que al pulsar Sugerir ya se sabe a dónde ir y
 * /sugerir no tiene que esperar ni redirigir después de pintarse.
 */
export const profileRole = writable<{ userId: string; role: ProfileRole | '' } | null>(null);

let pending: { userId: string; promise: Promise<ProfileRole | ''> } | null = null;

export function loadProfileRole(userId: string): Promise<ProfileRole | ''> {
  const current = get(profileRole);
  if (current?.userId === userId) return Promise.resolve(current.role);
  if (pending?.userId === userId) return pending.promise;
  const promise = getProfileRole(userId)
    .then((role) => {
      profileRole.set({ userId, role });
      return role;
    })
    .finally(() => {
      if (pending?.promise === promise) pending = null;
    });
  pending = { userId, promise };
  return promise;
}

/** El rol ya conocido para `userId`, o null si todavía no se sabe. */
export function knownProfileRole(userId: string | undefined): ProfileRole | '' | null {
  const current = get(profileRole);
  return userId && current?.userId === userId ? current.role : null;
}

user.subscribe((value) => {
  if (!value) profileRole.set(null);
});
