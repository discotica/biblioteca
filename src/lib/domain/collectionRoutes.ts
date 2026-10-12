/**
 * "Crate" se renombró a "colección" en la interfaz. Los enlaces compartidos con
 * las rutas viejas siguen llegando: estas reglas los llevan a la ruta nueva sin
 * perder query ni hash. Las mismas reglas viven como 301 en static/.htaccess.
 */
const LEGACY_COLLECTION_ROUTES: Array<[RegExp, string]> = [
  [/^\/mis-crates\/?$/, '/mis-colecciones'],
  [/^\/crate\/([^/]+)\/?$/, '/coleccion/$1']
];

/** Ruta nueva para una ruta vieja de colecciones, o null si no es una de ellas. */
export function legacyCollectionHref(pathname: string, search = '', hash = ''): string | null {
  for (const [pattern, target] of LEGACY_COLLECTION_ROUTES) {
    if (pattern.test(pathname)) return pathname.replace(pattern, target) + search + hash;
  }
  return null;
}
