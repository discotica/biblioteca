/**
 * Preferencia grilla/lista por contexto (inicio, colección, artista…), en
 * localStorage. Toda lectura y escritura va en try/catch: en una ventana
 * privada, con el almacenamiento bloqueado o lleno, la vista vuelve a su valor
 * por defecto sin romper la página.
 */
export type ViewMode = 'grid' | 'list';

export const VIEW_MODES: readonly ViewMode[] = ['grid', 'list'];
const PREFIX = 'discotica:vista:';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export const viewPreferenceKey = (context: string) => `${PREFIX}${context}`;

export function isViewMode(value: unknown): value is ViewMode {
  return value === 'grid' || value === 'list';
}

export function readViewPreference(context: string, storage: StorageLike | null = defaultStorage()): ViewMode | null {
  try {
    const value = storage?.getItem(viewPreferenceKey(context));
    return isViewMode(value) ? value : null;
  } catch {
    return null;
  }
}

/** Devuelve false si no se pudo guardar; la vista sigue funcionando en memoria. */
export function writeViewPreference(context: string, mode: ViewMode, storage: StorageLike | null = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(viewPreferenceKey(context), mode);
    return true;
  } catch {
    return false;
  }
}
