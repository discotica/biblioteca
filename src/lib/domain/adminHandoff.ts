// Traspaso Sugerir → consola para quien administra (U13). E09 no acepta envíos
// de admin, así que su último paso abre "Nuevo lanzamiento" con lo que rellenó.
// Va por sessionStorage: dura la pestaña, no viaja en la URL y se borra al leerlo.

export const ADMIN_HANDOFF_KEY = 'discotica:sugerir-a-consola';

export type AdminHandoff = {
  sourceUrl: string;
  title: string;
  primaryArtists: string[];
  collaborators: string[];
  /** Nombre visible del tipo (Álbum, EP…), el de los diccionarios. */
  releaseType: string;
  releaseDate: string;
  genres: string[];
  countries: string[];
  label: string;
  note: string;
  coverUrl: string;
};

export function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ');
}

/** Empareja nombres con un diccionario sin distinguir tildes ni mayúsculas. */
export function matchByName<T extends { id: string; name: string }>(entries: T[], names: string[]) {
  const ids: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const match = entries.find((entry) => normalizeName(entry.name) === normalizeName(name));
    if (match) {
      if (!ids.includes(match.id)) ids.push(match.id);
    } else if (name.trim()) missing.push(name.trim());
  }
  return { ids, missing };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function writeAdminHandoff(value: AdminHandoff, target: StorageLike | null = storage()): boolean {
  try {
    target?.setItem(ADMIN_HANDOFF_KEY, JSON.stringify(value));
    return !!target;
  } catch {
    return false;
  }
}

/** Lee y borra el traspaso. Null si no hay o no es válido. */
export function takeAdminHandoff(target: StorageLike | null = storage()): AdminHandoff | null {
  try {
    const raw = target?.getItem(ADMIN_HANDOFF_KEY);
    target?.removeItem(ADMIN_HANDOFF_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AdminHandoff>;
    if (typeof value?.sourceUrl !== 'string' || typeof value.title !== 'string') return null;
    const list = (input: unknown) => (Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : []);
    const text = (input: unknown) => (typeof input === 'string' ? input : '');
    return {
      sourceUrl: value.sourceUrl,
      title: value.title,
      primaryArtists: list(value.primaryArtists),
      collaborators: list(value.collaborators),
      releaseType: text(value.releaseType),
      releaseDate: text(value.releaseDate),
      genres: list(value.genres),
      countries: list(value.countries),
      label: text(value.label),
      note: text(value.note),
      coverUrl: text(value.coverUrl)
    };
  } catch {
    return null;
  }
}
