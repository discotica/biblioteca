/**
 * Barra lateral del Estudio plegada o desplegada (U20), recordada por navegador
 * en localStorage (decisión D4 del rediseño: desplegada por defecto). Toda
 * lectura y escritura va en try/catch: en una ventana privada, con el
 * almacenamiento bloqueado o con un valor extraño, la barra queda desplegada.
 */
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const TOOL_SIDEBAR_KEY = 'discotica:estudio:barra';

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** true solo si la preferencia guardada es «plegada». */
export function readToolSidebarCollapsed(storage: StorageLike | null = defaultStorage(), key = TOOL_SIDEBAR_KEY): boolean {
  try {
    return storage?.getItem(key) === 'collapsed';
  } catch {
    return false;
  }
}

/** Devuelve false si no se pudo guardar; la barra sigue funcionando en memoria. */
export function writeToolSidebarCollapsed(collapsed: boolean, storage: StorageLike | null = defaultStorage(), key = TOOL_SIDEBAR_KEY): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, collapsed ? 'collapsed' : 'expanded');
    return true;
  } catch {
    return false;
  }
}
