import { redirect } from '@sveltejs/kit';

/**
 * Compatibilidad de la superficie histórica: sólo la home interpreta búsquedas.
 * Se conserva la query completa para que SearchState pueda ignorar `mes` legado y
 * preservar parámetros aún propiedad de E19.
 */
export const load = ({ url }) => {
  throw redirect(307, `/${url.search}`);
};
